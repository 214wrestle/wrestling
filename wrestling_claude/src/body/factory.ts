import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import type { BodyParams } from './anatomy';
import { generateBody } from './generate';
import type { BodyGeometry, MeshQuality } from './generate';
import type { MeshData } from './mesher';

/**
 * Builds and caches body geometry off the main thread.
 *
 * Generating a body takes a few hundred milliseconds of pure maths, so it runs
 * in a worker and the result is cached by build: the same wrestler in a rematch
 * costs nothing. If workers are unavailable it quietly runs inline.
 */

export interface BodyBuffers {
  body: BufferGeometry;
  head: BufferGeometry;
  hands: BufferGeometry[];
  headgear: BufferGeometry | null;
  ms: number;
}

const cache = new Map<string, Promise<BodyBuffers>>();
const workers: Worker[] = [];
let workerFailed = false;
let nextId = 1;
let roundRobin = 0;
const pending = new Map<number, (g: BodyGeometry) => void>();

/** A small pool, so the two wrestlers and the official build in parallel. */
function getWorker(): Worker | null {
  if (workerFailed) return null;
  const size = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
  try {
    while (workers.length < size) {
      const w = new Worker(new URL('./body.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<{ id: number; geo: BodyGeometry }>) => {
        const resolve = pending.get(e.data.id);
        pending.delete(e.data.id);
        resolve?.(e.data.geo);
      };
      w.onerror = () => {
        workerFailed = true;
      };
      workers.push(w);
    }
  } catch {
    workerFailed = true;
    return null;
  }
  roundRobin = (roundRobin + 1) % workers.length;
  return workers[roundRobin];
}

function toGeometry(m: MeshData): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(m.normals, 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(m.skinIndex, 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute(m.skinWeight, 4));
  g.setAttribute('aPart', new Float32BufferAttribute(m.part, 1));
  g.setIndex(new BufferAttribute(m.indices, 1));
  g.computeBoundingSphere();
  return g;
}

function toBuffers(geo: BodyGeometry): BodyBuffers {
  return {
    body: toGeometry(geo.body),
    head: toGeometry(geo.head),
    hands: geo.hands.map(toGeometry),
    headgear: geo.headgear ? toGeometry(geo.headgear) : null,
    ms: geo.ms,
  };
}

export function requestBody(
  params: BodyParams,
  quality: MeshQuality = 'high',
  withHeadgear = true,
): Promise<BodyBuffers> {
  const key = JSON.stringify([params, quality, withHeadgear]);
  const hit = cache.get(key);
  if (hit) return hit;

  const job = new Promise<BodyBuffers>((resolve) => {
    const w = getWorker();
    if (!w) {
      resolve(toBuffers(generateBody(params, quality, withHeadgear)));
      return;
    }
    const id = nextId++;
    pending.set(id, (geo) => resolve(toBuffers(geo)));
    w.postMessage({ id, params, quality, withHeadgear });
  });
  cache.set(key, job);
  return job;
}

/** Synchronous build, for tools and tests. */
export function buildBodyNow(params: BodyParams, quality: MeshQuality = 'high', withHeadgear = true): BodyBuffers {
  return toBuffers(generateBody(params, quality, withHeadgear));
}
