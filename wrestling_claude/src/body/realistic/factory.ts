import type { Wrestler } from '../../sim/types';
import { animationMotion } from '../../sim/athleteProfiles';
import { likenessFor } from './likeness';
import { eraKitFor } from './eraKits';
import { FIT_FACE, type FaceFitData } from './faceFit';
import { FACE_FITS } from './faces/fits';
import { LIKENESS_PHOTOS } from './likenessPhotos';

/** Portraits for photo-fitted faces, bundled with the game (no remote images at runtime). */
const PORTRAITS = import.meta.glob('./faces/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
/** Dev review: a fitted wrestler's portrait URL and his face outline in it (texture u, v pairs). */
export function portraitFor(name: string): { url: string; oval: number[] } | undefined {
  const fit = FACE_FITS[name];
  const url = fit && PORTRAITS[`./faces/${fit.photo}`];
  return url ? { url, oval: fit.oval } : undefined;
}
import type { Athlete } from './athletes';
import type { BodyParams } from './anatomy';
import { generateBody } from './generate';
import type { RealGeometry } from './generate';
import { RealCharacter } from './Character';

type Quality = 'high' | 'low';

/** Deterministic 0..1 stream from a wrestler id, so a wrestler always looks the same. */
function seeded(id: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shaped(mul: Partial<Record<keyof Athlete['frame'], number>>, f: Athlete['frame']): Athlete['frame'] {
  const out = {...f};
  for (const [k, v] of Object.entries(mul)) (out as Record<string, number>)[k] *= v as number;
  return out;
}

const SKIN = ['#f2d6c2', '#eac4a6', '#e0b494', '#d4a37f', '#c69270', '#b47e5b', '#9c6a4a', '#82553a', '#6a432e', '#523224', '#3e261c'];
/** Rough share of each tone across the roster, lighter to deeper. */
const SKIN_WEIGHT = [6, 10, 12, 12, 10, 9, 8, 7, 6, 5, 4];
const HAIR_LIGHT = ['#17110d', '#2a1d15', '#3d2a1d', '#5a4029', '#7a5a3a', '#a07c50', '#c9a86a', '#8a3f1e'];
const HAIR_LIGHT_WEIGHT = [14, 22, 22, 16, 10, 7, 5, 3];
const EYES_LIGHT = ['#3b2416', '#5a3d24', '#6b5a2f', '#4d6a86', '#6f8fa8', '#5b7a52', '#7a8790'];
const EYES_LIGHT_WEIGHT = [30, 22, 12, 14, 10, 8, 4];

function weighted<T>(r: () => number, items: T[], weights: number[]): T {
  let x = r() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i]; }
  return items[items.length - 1];
}

const lumOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};
const rgbOf = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const nearestLum = (target: number, list: string[]) => list.reduce((b, c) => (Math.abs(lumOf(c) - target) < Math.abs(lumOf(b) - target) ? c : b));
const nearestRgb = (hex: string, list: string[]) => {
  const [r, g, b] = rgbOf(hex);
  const d = (c: string) => { const [x, y, z] = rgbOf(c); return (x - r) ** 2 + (y - g) ** 2 + (z - b) ** 2; };
  return list.reduce((best, c) => (d(c) < d(best) ? c : best));
};
const HAIR_ALL = ['#0f0b09', '#17110d', '#241913', ...HAIR_LIGHT];
/** The tone a skin palette entry names is how the skin should look; the arena's warm lights and the skin
 * shader (which greys the colour by a third) render it tan. Measured against school headshots in the lab
 * (Nov 9): fair skin matched its portraits at about +17% red, +10% green, +23% blue in linear light, which
 * also keeps the deeper tones' own hue while lifting them slightly. */
/** Hair browns render orange under the same warm lights and the shell's sheen; a fifth less saturation
 * brings them back to the colour named (blacks and greys are unchanged). */
function renderHair(hex: string): string {
  const [r, g, b] = rgbOf(hex);
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  return '#' + [r, g, b].map((c) => Math.round(l + (c - l) * 0.8).toString(16).padStart(2, '0')).join('');
}
function renderSkin(hex: string): string {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const srgb = (c: number) => Math.round(255 * Math.min(1, c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
  // The film curve also crushes deep tones (Ed Ruth and Kerry McCoy rendered near black beside their
  // headshots), so the lift grows as the tone deepens: about x1.2 for fair skin, x2 for deep brown.
  const L = lumOf(hex);
  const k = 1 + 1.6 * (1 - L) ** 2;
  const gain = [1.17 * k, 1.1 * k, 1.23 * k];
  return '#' + rgbOf(hex).map((c, i) => srgb(lin(c) * gain[i]).toString(16).padStart(2, '0')).join('');
}
/** Colours from a portrait, mapped onto real skin, hair and eye tones: a photo's colour cast or black and white
 * says nothing reliable, its lightness does (with a lift for the photo's own shading). */
function photoColours(fit: FaceFitData): {skin: string; hair?: string; eye?: string} {
  const skin = nearestLum(lumOf(fit.skin) * 1.2, SKIN);
  const hair = fit.hair ? (fit.mono ? nearestLum(lumOf(fit.hair) * 1.1, HAIR_ALL.filter((c) => c !== '#8a3f1e')) : nearestRgb(fit.hair, HAIR_ALL)) : undefined;
  const eye = fit.eye ? (fit.mono ? (lumOf(fit.eye) > 0.3 ? '#5d7890' : '#3b2416') : nearestRgb(fit.eye, [...EYES_LIGHT, '#2a1a12', '#3b2416', '#4a2f1c'])) : undefined;
  return {skin, hair, eye};
}


type BodyType = 'average' | 'lean' | 'stocky' | 'muscular' | 'rangy';
const BODY_TYPES: Record<BodyType, {height: number; mass: number; frame: Partial<Record<keyof Athlete['frame'], number>>}> = {
  average: {height: 0, mass: 0, frame: {}},
  lean: {height: 0.01, mass: -0.06, frame: {torsoW: 0.96, torsoD: 0.95, limb: 0.93, traps: 0.9, neck: 0.96, delt: 0.96, hips: 0.97}},
  stocky: {height: -0.035, mass: 0.06, frame: {torsoW: 1.05, torsoD: 1.07, limb: 1.07, hips: 1.06, neck: 1.06, traps: 1.06}},
  muscular: {height: 0, mass: 0.04, frame: {delt: 1.09, traps: 1.14, limb: 1.05, torsoW: 1.04, neck: 1.04}},
  rangy: {height: 0.045, mass: -0.03, frame: {limb: 0.95, torsoW: 0.97, torsoD: 0.97, delt: 0.98}},
};

/** Colouring for roster entries without researched appearance: deterministic per id. */
function colouring(w: Wrestler, r: () => number): {skin: string; hair: string; eye: string} {
  if (w.profile) return {skin: w.skinTone, hair: w.hairColor, eye: w.eyeColor};
  const tone = SKIN.indexOf(weighted(r, SKIN, SKIN_WEIGHT));
  const deep = tone >= 6;
  const hair = deep ? weighted(r, ['#0f0b09', '#17110d', '#241913'], [5, 4, 2])
    : tone >= 4 ? weighted(r, HAIR_LIGHT.slice(0, 4), [5, 4, 3, 1])
    : weighted(r, HAIR_LIGHT, HAIR_LIGHT_WEIGHT);
  const eye = tone >= 4 ? weighted(r, ['#2a1a12', '#3b2416', '#4a2f1c'], [4, 4, 2]) : weighted(r, EYES_LIGHT, EYES_LIGHT_WEIGHT);
  return {skin: SKIN[tone], hair, eye};
}

/**
 * A generic, human-looking athlete for any roster entry. Colouring (skin, hair,
 * eyes) comes from the roster unchanged; only facial structure, haircut detail
 * and build proportions are varied, deterministically per wrestler id. These are
 * not likenesses.
 */
/** The season his era singlet comes from: the likeness's years, else his NCAA seasons. */
function seasonOf(w: Wrestler, years?: [number, number]): number | undefined {
  if (years) return Math.round((years[0] + years[1]) / 2);
  const seasons = [...(w.ncaaCareer?.counted ?? []), ...(w.ncaaCareer?.excluded ?? [])].map((x) => x.year);
  return seasons.length ? Math.round(seasons.reduce((a, b) => a + b, 0) / seasons.length) : undefined;
}

function generic(w: Wrestler): Athlete {
  const a = drawn(w);
  const L = likenessFor(a.name);
  const era = eraKitFor(w.school.id, seasonOf(w, L?.years));
  const kit = L?.kit ?? era?.kit;
  const colours = {
    primary: L?.kit?.primary ?? era?.primary ?? a.primary,
    secondary: L?.kit?.secondary ?? era?.secondary ?? a.secondary,
    piping: L?.kit?.piping ?? era?.piping ?? a.piping,
  };
  if (!L) return {...a, ...colours, kit};
  return {
    ...a, ...colours, kit,
    height: L.height ?? a.height, mass: L.mass ?? a.mass,
    skin: L.skin ?? a.skin, hairColor: L.hairColor ?? a.hairColor, eye: L.eye ?? a.eye,
    hair: L.hair ?? a.hair, hairLen: L.hairLen ?? a.hairLen, hairSides: L.hairSides ?? a.hairSides,
    hairFront: L.hairFront ?? a.hairFront, hairFlow: L.hairFlow ?? a.hairFlow,
    stubble: L.stubble ?? a.stubble, hairStraight: L.hairStraight ?? a.hairStraight, hairVolume: L.hairVolume ?? a.hairVolume, hairLow: L.hairLow ?? a.hairLow, brow: L.brow ?? a.brow, smile: L.smile ?? a.smile,
    face: {...a.face, ...L.face, smile: L.smile ?? L.face?.smile ?? a.face.smile},
    frame: {...a.frame, ...L.frame},
  };
}

/** Default hair texture where nothing is researched: curls and afros coil, the deepest skin tones
 * mostly have tightly coiled hair, everyone else straight. A researched likeness sets it per person. */
function hairTexture(style: Wrestler['hairStyle'], skin: string): number {
  if (style === 'curls' || style === 'afro') return 0;
  const n = parseInt(skin.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum < 0.42 ? 0.1 : 0.85;
}

/** The generic per-id athlete; a researched likeness (above) refines it. */
function drawn(w: Wrestler): Athlete {
  const r = seeded(w.id);
  const span = (a: number, b: number) => a + (b - a) * r();
  const colour = colouring(w, r);
  const researched = !!w.profile || !!likenessFor(`${w.firstName} ${w.lastName}`);
  const type = researched ? BODY_TYPES.average
    : BODY_TYPES[weighted(r, ['average', 'lean', 'stocky', 'muscular', 'rangy'] as BodyType[], [30, 20, 18, 18, 14])];
  const build = Math.max(0, Math.min(1, w.build + type.mass + (w.profile ? 0 : span(-0.05, 0.05))));
  let hair: Athlete['hair'] = 'crop';
  let hairLen = span(0.006, 0.0105);
  let hairSides = span(0.7, 0.9);
  let hairFlow: [number, number, number] = [span(-0.1, 0.25), span(0.05, 0.35), span(0.85, 1)];
  switch (w.hairStyle) {
    case 'buzz': hair = 'buzz'; hairLen = span(0.0025, 0.004); hairSides = span(0.55, 0.75); break;
    case 'bald': hair = 'buzz'; hairLen = 0; hairSides = 0; break;
    case 'curls': hairLen = span(0.011, 0.014); hairSides = span(0.8, 0.95); break;
    case 'afro': hairLen = span(0.014, 0.018); hairSides = 0.95; break;
    default: {
      const pick = r();
      if (pick < 0.25) { hair = 'buzz'; hairLen = span(0.003, 0.0045); hairSides = span(0.55, 0.75); }
      else if (pick < 0.5) { hair = 'swept'; hairLen = span(0.009, 0.0115); hairFlow = [span(0.35, 0.6), span(0.05, 0.2), span(0.8, 0.9)]; }
    }
  }
  const smile = span(0, 0.8);
  // Roster entries without researched appearance share a 1.74 m placeholder;
  // give them a plausible height for their weight class instead.
  const t = Math.max(0, Math.min(1, (w.weightClass - 118) / (285 - 118)));
  const height = w.profile || w.weightClass === 0 ? w.height : 1.62 + t * 0.26 + type.height + span(-0.025, 0.025);
  return {
    id: w.id, name: `${w.firstName} ${w.lastName}`, school: w.school.name, wordmark: w.school.mark,
    height, mass: build, skin: colour.skin, hairColor: colour.hair,
    hair, hairLen, hairFlow, hairSides, hairFront: span(1.69, 1.708), smile,
    brow: [span(-0.002, 0), span(0.02, 0.11), span(1.5, 2.0), span(1.0, 1.3)],
    eye: colour.eye, stubble: span(0, 0.035), hairStraight: hairTexture(w.hairStyle, colour.skin),
    primary: w.school.primary, secondary: w.school.secondary, piping: w.school.accent,
    shoe: '#15161b', shoeAccent: w.school.primary,
    gearShell: w.headgearColor ?? w.school.gear, gearStrap: w.headgearColor ?? w.school.gear,
    face: {
      jaw: span(0.004, 0.007) + build * 0.0015, chin: span(0.002, 0.0045), chinW: span(1.3, 1.45),
      faceLen: span(-0.007, -0.003), nose: span(0.002, 0.0045), noseW: span(-0.0012, 0.0008),
      brow: span(0.0005, 0.0018), cheek: span(0.001, 0.004) + build * 0.002, hollow: Math.max(0, span(0, 0.45) - build * 0.3),
      roundedCheeks: true, naturalNasalBase: false, closedMouth: true, foreheadProjection: span(-0.002, 0.001),
      lips: span(0.95, 1.1), cauli: span(0, 0.45), smile, eyeOpen: span(0.84, 0.96), eyeWidth: span(0.92, 0.99),
      upperLidHood: span(0.0011, 0.0022), naturalLidFold: true,
      // Its own seed, so adding this leaves every other drawn value unchanged.
      baseShape: Array.from({length: 10}, ((face) => () => face() * 2 - 1)(seeded(`${w.id}:face`))),
    },
    frame: shaped(type.frame, {
      neck: 0.95 + build * 0.25 + span(-0.02, 0.02), traps: 0.95 + build * 0.4 + span(-0.03, 0.03),
      // Weight goes on the trunk and hips; limbs grow more slowly, or big men get balloon arms.
      torsoW: 0.94 + build * 0.3, torsoD: 0.92 + build * 0.4, limb: 0.95 + build * 0.1,
      delt: 0.98 + build * 0.12 + span(-0.02, 0.02), hips: 0.97 + build * 0.1, head: 1, definition: span(0.65, 0.8) - build * 0.2,
    }),
  };
}

/** Faces come from the CC0 base head rather than the generated head. */
const BASE_HEAD_DEFAULT = true;

const cache = new Map<string, Promise<RealGeometry>>();
/** Two workers, so both wrestlers of a pair build at the same time. */
const POOL = 2;
const workers: Array<Worker | null> = [];
let workerFailed = false;
let nextId = 1;
const pending = new Map<number, {resolve: (geo: RealGeometry) => void; params: BodyParams; quality: Quality; sides: number}>();

function failAll(): void {
  workerFailed = true;
  for (const w of workers) w?.terminate();
  workers.length = 0;
  for (const job of pending.values()) job.resolve(generateBody(job.params, job.quality, true, job.sides));
  pending.clear();
}

function workerFor(id: number): Worker | null {
  if (workerFailed) return null;
  const slot = id % POOL;
  if (!workers[slot]) {
    try {
      const w = new Worker(new URL('./worker.ts', import.meta.url), {type: 'module'});
      w.onmessage = (event: MessageEvent<{id: number; geo: RealGeometry}>) => {
        const job = pending.get(event.data.id);
        pending.delete(event.data.id);
        job?.resolve(event.data.geo);
      };
      w.onerror = failAll;
      workers[slot] = w;
    } catch { workerFailed = true; return null; }
  }
  return workers[slot];
}

function requestGeometry(params: BodyParams, quality: Quality, sides: number): Promise<RealGeometry> {
  const key = JSON.stringify([params, quality, sides]);
  const cached = cache.get(key);
  if (cached) return cached;
  const job = new Promise<RealGeometry>(resolve => {
    const id = nextId++;
    const worker = workerFor(id);
    if (!worker) {resolve(generateBody(params, quality, true, sides)); return;}
    pending.set(id, {resolve, params, quality, sides});
    worker.postMessage({id, params, quality, sides});
  });
  cache.set(key, job);
  // Browsing the roster would otherwise keep every body ever previewed.
  while (cache.size > 8) cache.delete(cache.keys().next().value!);
  return job;
}

/** Development only: ?face.jaw=0.004&frame.neck=1.1 overrides, for tuning in the lab. */
function devOverrides(a: Athlete): Athlete {
  if (!import.meta.env.DEV || typeof location === 'undefined') return a;
  const q = new URLSearchParams(location.search);
  const face = {...a.face} as Record<string, unknown>;
  const frame = {...a.frame} as Record<string, unknown>;
  const kit = {...a.kit} as Record<string, unknown>;
  for (const [k, v] of q) {
    const n = Number(v);
    if (k.startsWith('face.')) face[k.slice(5)] = Number.isNaN(n) ? v === 'true' : n;
    if (k.startsWith('frame.')) frame[k.slice(6)] = n;
    // &kit.cut=1&kit.leg=0.14&kit.tights=%23111111&kit.panel=0 tries an era singlet.
    if (k.startsWith('kit.')) kit[k.slice(4)] = k === 'kit.panel' ? v !== '0' : Number.isNaN(n) ? v : n;
  }
  return {...a, face: face as unknown as Athlete['face'], frame: frame as unknown as Athlete['frame'], kit: kit as Athlete['kit']};
}

function eyeShiftOf(fit: FaceFitData): [[number, number, number], [number, number, number]] {
  const cap = (v: number) => Math.max(-0.0035, Math.min(0.0035, v));
  const eye = (ids: number[]): [number, number, number] => {
    const m = [0, 0, 0];
    for (const i of ids) for (let c = 0; c < 3; c++) m[c] += fit.offsets[i * 3 + c] / ids.length;
    return [cap(m[0]), cap(m[1]), cap(m[2] * 0.5)];
  };
  return [eye([473, 362, 263, 386, 374]), eye([468, 33, 133, 159, 145])];
}

/** Lab only: build with a fit that isn't saved yet, or adjust the athlete (the fit lab's base head). */
export interface BuildOverride { fit?: FaceFitData; photo?: string; athlete?: (a: Athlete) => Athlete }

function configuration(w: Wrestler, band: string, override?: BuildOverride) {
  let fit = override?.fit ?? FACE_FITS[`${w.firstName} ${w.lastName}`];
  // Dev: &fitDepth=2 scales the fit's stored depth offsets (saved at half strength) to try more or less depth.
  const depth = import.meta.env.DEV && typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('fitDepth') ?? 1) : 1;
  if (fit && depth !== 1) fit = {...fit, offsets: fit.offsets.map((v, i) => (i % 3 === 2 ? v * depth : v))};
  const photo = override?.photo ?? (fit ? PORTRAITS[`./faces/${fit.photo}`] : undefined);
  const drawnAthlete = override?.athlete ? override.athlete(generic(w)) : generic(w);
  // A photo-fitted face is built from the base head's zero point (the fit is measured from it);
  // only the ears, which are not part of the base head, keep their own shape. Skin comes from the photo.
  const a = devOverrides(fit && photo && !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('photo') === '0')
    ? {...drawnAthlete, skin: likenessFor(`${w.firstName} ${w.lastName}`)?.skin ?? photoColours(fit).skin,
      hairStraight: likenessFor(`${w.firstName} ${w.lastName}`)?.hairStraight ?? hairTexture(w.hairStyle, likenessFor(`${w.firstName} ${w.lastName}`)?.skin ?? photoColours(fit).skin),
      hairColor: likenessFor(`${w.firstName} ${w.lastName}`)?.hairColor ?? photoColours(fit).hair ?? drawnAthlete.hairColor,
      eye: likenessFor(`${w.firstName} ${w.lastName}`)?.eye ?? photoColours(fit).eye ?? drawnAthlete.eye, face: {...FIT_FACE, cauli: drawnAthlete.face.cauli, earFlare: drawnAthlete.face.earFlare, earSize: drawnAthlete.face.earSize}}
    : drawnAthlete);
  const fitted = a.face === drawnAthlete.face ? undefined : fit;
  const scale = a.height / 1.76;
  const baseHead = (typeof location === 'undefined' || !import.meta.env.DEV ? BASE_HEAD_DEFAULT : new URLSearchParams(location.search).get('basehead') !== null ? new URLSearchParams(location.search).get('basehead') !== '0' : BASE_HEAD_DEFAULT);
  const params: BodyParams = {faceFit: baseHead ? fitted : undefined, baseHead, scale, mass: a.mass, hair: a.hair, hairFront: a.hairFront, sculptedSweep: a.hair === 'swept', hairVolume: a.hairVolume, hairLow: a.hairLow, face: a.face, frame: a.frame};
  const options = {
    motion: animationMotion(w),
    look: {facePhoto: fitted ? photo : undefined, photoMean: fitted?.skin, photoChroma: LIKENESS_PHOTOS[`${w.firstName} ${w.lastName}`]?.photoCast ? 0.2 : undefined, photoGain: import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('photoGain') ? Number(new URLSearchParams(location.search).get('photoGain')) : undefined, kit: a.kit, skin: renderSkin(a.skin), hair: renderHair(a.hairColor), primary: a.primary, secondary: a.secondary,
      baseHead, abs: Math.max(0.5, Math.min(1, 1.15 - a.mass * 0.75)), piping: a.piping, chestEmblem: a.id === w.id && a.name === 'Michael Moreno', wordmark: a.wordmark, wordmarkColor: a.piping, band, shoe: a.shoe, shoeAccent: a.shoeAccent,
      scale, faceLen: a.face.faceLen, stubble: a.stubble, sides: a.hairSides, hairStraight: a.hairStraight, brow: a.brow,
      hairFront: a.hairFront, hairLow: a.hairLow, smile: a.smile, headScale: a.frame.head, eyeOpen: a.face.eyeOpen ?? 1, naturalLidFold: a.face.naturalLidFold, eyeWidth: a.face.eyeWidth, naturalNasalBase: a.face.naturalNasalBase, nose: a.face.nose},
    eye: a.eye, gear: {shell: a.gearShell, strap: a.gearStrap}, hairLen: a.hairLen,
    hairFlow: a.hairFlow, pupilY: 1.649, headScale: a.frame.head,
    // The eyeballs follow the fitted eyes, or the photo's lids close over a generic eye and white shows all
    // round: the mean of the iris and the four lid points (+x eye: 473, 362, 263, 386, 374; -x eye: 468, 33,
    // 133, 159, 145), which is what the lids follow. Depth counts half, as in the face warp; capped at 3.5 mm
    // because a turned head in the portrait skews them (Krieger, Varner).
    eyeShift: fitted && baseHead ? eyeShiftOf(fitted) : undefined,
  };
  return {params, options, sides: a.hairSides};
}

export async function buildRealCharacter(w: Wrestler, band: string, quality: Quality): Promise<RealCharacter> {
  const {params, options, sides} = configuration(w, band);
  const geo = await requestGeometry(params, quality, sides);
  return new RealCharacter(geo, options);
}

/** The official: the same realistic body in a striped shirt and slacks, no headgear. */
export async function buildRealOfficial(w: Wrestler, quality: Quality): Promise<RealCharacter> {
  const {params, options, sides} = configuration(w, '#111');
  const geo = await requestGeometry(params, quality, sides);
  return new RealCharacter(geo, {...options, noGear: true, look: {...options.look, referee: true, wordmark: '', shoeAccent: '#15161b'}});
}

/** Synchronous comparison lab; the playable game uses the worker above. */
export function buildRealCharacterNow(w: Wrestler, band: string, quality: Quality, override?: BuildOverride) {
  const {params, options, sides} = configuration(w, band, override);
  const geo = generateBody(params, quality, true, sides);
  return {character: new RealCharacter(geo, options), geo};
}
