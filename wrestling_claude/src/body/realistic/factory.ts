import type { Wrestler } from '../../sim/types';
import { ATHLETES } from './athletes';
import type { Athlete } from './athletes';
import type { BodyParams } from './anatomy';
import { generateBody } from './generate';
import type { RealGeometry } from './generate';
import { RealCharacter } from './Character';

type Quality = 'high' | 'low';

/** Art estimates from ISU's collegiate photographs, not scanned measurements. */
function moreno(w: Wrestler): Athlete {
  return {
    ...ATHLETES[0], id: w.id, name: 'Michael Moreno', school: 'Iowa State', wordmark: 'IOWA STATE',
    height: w.height, mass: w.build, skin: w.skinTone, hairColor: w.hairColor,
    hair: 'crop', hairLen: 0.009, hairFlow: [0.2, 0.15, 1], hairSides: 0.88,
    hairFront: 1.705, smile: 0, brow: [-0.001, 0.02, 1.6, 1.05], eye: w.eyeColor,
    stubble: 0.01, primary: '#9e1736', secondary: '#9e1736', piping: '#f5c635',
    shoe: '#17171a', shoeAccent: '#f0eee7', gearShell: '#f0eee7', gearStrap: '#f0eee7',
    face: {jaw: 0.004, chin: 0.0005, chinW: 1.3, faceLen: -0.008,
      nose: -0.004, noseW: 0.0018, brow: -0.0018, cheek: 0.004, hollow: 0,
      lips: 0.95, cauli: 0, smile: 0, eyeOpen: 0.8},
    frame: {neck: 1.02, traps: 1.02, torsoW: 1, torsoD: 0.99, limb: 1,
      delt: 1, hips: 1, head: 1},
  };
}

const cache = new Map<string, Promise<RealGeometry>>();
let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;
const pending = new Map<number, {resolve: (geo: RealGeometry) => void; params: BodyParams; quality: Quality; sides: number}>();

function requestGeometry(params: BodyParams, quality: Quality, sides: number): Promise<RealGeometry> {
  const key = JSON.stringify([params, quality, sides]);
  const cached = cache.get(key);
  if (cached) return cached;
  const job = new Promise<RealGeometry>(resolve => {
    if (!workerFailed && !worker) {
      try {
        worker = new Worker(new URL('./worker.ts', import.meta.url), {type: 'module'});
        worker.onmessage = (event: MessageEvent<{id: number; geo: RealGeometry}>) => {
          const job = pending.get(event.data.id);
          pending.delete(event.data.id);
          job?.resolve(event.data.geo);
        };
        worker.onerror = () => {
          workerFailed = true;
          worker?.terminate(); worker = null;
          for (const job of pending.values()) job.resolve(generateBody(job.params, job.quality, true, job.sides));
          pending.clear();
        };
      } catch { workerFailed = true; }
    }
    if (!worker || workerFailed) {resolve(generateBody(params, quality, true, sides)); return;}
    const id = nextId++;
    pending.set(id, {resolve, params, quality, sides});
    worker.postMessage({id, params, quality, sides});
  });
  cache.set(key, job);
  return job;
}

function configuration(w: Wrestler, band: string) {
  const a = moreno(w);
  const scale = a.height / 1.76;
  const params: BodyParams = {scale, mass: a.mass, hair: a.hair, hairFront: a.hairFront, face: a.face, frame: a.frame};
  const options = {
    motion: w.motion,
    look: {skin: a.skin, hair: a.hairColor, primary: a.primary, secondary: a.secondary,
      piping: a.piping, wordmark: a.wordmark, wordmarkColor: a.piping, band, shoe: a.shoe, shoeAccent: a.shoeAccent,
      scale, faceLen: a.face.faceLen, stubble: a.stubble, sides: a.hairSides, brow: a.brow,
      hairFront: a.hairFront, smile: a.smile, headScale: a.frame.head, eyeOpen: a.face.eyeOpen ?? 1, nose: a.face.nose},
    eye: a.eye, gear: {shell: a.gearShell, strap: a.gearStrap}, hairLen: a.hairLen,
    hairFlow: a.hairFlow, pupilY: 1.649, headScale: a.frame.head,
  };
  return {params, options, sides: a.hairSides};
}

export async function buildRealCharacter(w: Wrestler, band: string, quality: Quality): Promise<RealCharacter> {
  const {params, options, sides} = configuration(w, band);
  const geo = await requestGeometry(params, quality, sides);
  return new RealCharacter(geo, options);
}

/** Synchronous comparison lab; the playable game uses the worker above. */
export function buildRealCharacterNow(w: Wrestler, band: string, quality: Quality) {
  const {params, options, sides} = configuration(w, band);
  const geo = generateBody(params, quality, true, sides);
  return {character: new RealCharacter(geo, options), geo};
}
