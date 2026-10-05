import { buildPrims } from './anatomy';
import type { BodyParams } from './anatomy';
import { headgearPrims, HEAD_ORIGIN } from './headgear';
import { polygonize } from './mesher';
import type { MeshData } from './mesher';
import { Part } from './sdf';
import type { Prim } from './sdf';
import type { V3 } from './math';

/**
 * One call that turns a wrestler's build into ready-to-skin geometry: the body
 * at a working resolution, the head and hands again at a finer one so faces and
 * fingers hold up in close shots, and the headgear. Pure maths, safe to run in a
 * worker.
 */

export interface BodyGeometry {
  body: MeshData;
  head: MeshData;
  hands: MeshData[];
  headgear: MeshData | null;
  ms: number;
}

export type MeshQuality = 'high' | 'low';

interface Box {
  min: V3;
  max: V3;
}

function bounds(prims: Prim[], pad: number): Box {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    if (p.sub) continue;
    min[0] = Math.min(min[0], p.bcx - p.brad);
    min[1] = Math.min(min[1], p.bcy - p.brad);
    min[2] = Math.min(min[2], p.bcz - p.brad);
    max[0] = Math.max(max[0], p.bcx + p.brad);
    max[1] = Math.max(max[1], p.bcy + p.brad);
    max[2] = Math.max(max[2], p.bcz + p.brad);
  }
  return {
    min: [min[0] - pad, Math.max(-pad, min[1] - pad), min[2] - pad],
    max: [max[0] + pad, max[1] + pad, max[2] + pad],
  };
}

const inside = (b: Box, x: number, y: number, z: number, shrink = 0) =>
  x > b.min[0] + shrink &&
  x < b.max[0] - shrink &&
  y > b.min[1] + shrink &&
  y < b.max[1] - shrink &&
  z > b.min[2] + shrink &&
  z < b.max[2] - shrink;

export function generateBody(params: BodyParams, quality: MeshQuality = 'high', withHeadgear = true): BodyGeometry {
  const t0 = performance.now();
  const { prims } = buildPrims(params);
  const sc = params.scale;
  const hBody = (quality === 'high' ? 0.0072 : 0.0105) * sc;
  const hFine = (quality === 'high' ? 0.0027 : 0.0055) * sc;
  const headCut = 1.515 * sc;
  const overlap = 0.006 * sc;

  // Each hand gets its own fine box (in the A-pose they hang well clear of the body).
  const handBoxes: Box[] = [1, -1].map((side) =>
    bounds(
      prims.filter((p) => p.part === Part.Hand && Math.sign(p.bcx) === side),
      0.012 * sc,
    ),
  );

  const b = bounds(prims, hBody * 3);
  const body = polygonize(prims, {
    min: b.min,
    max: b.max,
    h: hBody,
    keep: (x, y, z) => y < headCut + overlap && !handBoxes.some((hb) => inside(hb, x, y, z, overlap)),
  });

  const head = polygonize(prims, {
    min: [-0.15 * sc, headCut - 0.02 * sc, -0.16 * sc],
    max: [0.15 * sc, 1.8 * sc, 0.16 * sc],
    h: hFine,
    keep: (_x, y) => y >= headCut,
  });

  const hands = handBoxes.map((hb) => polygonize(prims, { min: hb.min, max: hb.max, h: hFine }));

  let headgear: MeshData | null = null;
  if (withHeadgear) {
    const hg = headgearPrims(sc);
    const gb = bounds(hg, 0.004 * sc);
    headgear = polygonize(hg, { min: gb.min, max: gb.max, h: (quality === 'high' ? 0.0031 : 0.0046) * sc });
    // Express it relative to the head joint so it can ride on the head bone.
    const ox = HEAD_ORIGIN[0] * sc;
    const oy = HEAD_ORIGIN[1] * sc;
    const oz = HEAD_ORIGIN[2] * sc;
    const p = headgear.positions;
    for (let i = 0; i < p.length; i += 3) {
      p[i] -= ox;
      p[i + 1] -= oy;
      p[i + 2] -= oz;
    }
  }

  return { body, head, hands, headgear, ms: performance.now() - t0 };
}
