import type { FaceParams, FrameParams, HairCut } from './anatomy';
import type { KitLook } from './material';
import { LIKENESS_BASICS } from './likenessBasics';
import { LIKENESS_PHOTOS } from './likenessPhotos';

/**
 * Researched likenesses of real wrestlers, as they looked in college. Every value is an art
 * estimate fitted by eye to the cited photos (or a listed measurement, for height); none is a
 * scan. Anything left out keeps the generic, per-id value from `factory.ts`.
 *
 * Face numbers use the base head's controls (see `anatomy.ts` FaceParams and `baseHead.ts`):
 * `baseShape` is [face width, midface length, nose bridge, nose wings, nose tip drop,
 * cheekbone width, cheekbone height, chin width, lip fullness, forehead slope], each -1..1.
 */
export interface Likeness {
  /** College years, first and last season (spring year), for the era singlet. */
  years?: [number, number];
  /** Metres; from a listed measurement when `heightSource` is set, otherwise an estimate. */
  height?: number;
  heightSource?: string;
  /** 0 lean .. 1 heavy. */
  mass?: number;
  skin?: string;
  hairColor?: string;
  eye?: string;
  hair?: HairCut;
  /** Hair length on top, metres (0 bald). */
  hairLen?: number;
  /** Density of the clipped sides, 0..1. */
  hairSides?: number;
  /** Front hairline height (lower = fuller hairline; about 1.69–1.72). */
  hairFront?: number;
  hairFlow?: [number, number, number];
  stubble?: number;
  /** Hair texture: 0 tightly coiled .. 1 straight. */
  hairStraight?: number;
  /** Bulk of the hair over the scalp, metres (crop about 0.006, curly top 0.015–0.03). */
  hairVolume?: number;
  /** Side and back hairline lowered over the ears and nape (0..1). */
  hairLow?: number;
  /** Eyebrow lift, slope, arch, thickness. */
  brow?: [number, number, number, number];
  smile?: number;
  face?: Partial<FaceParams>;
  frame?: Partial<FrameParams>;
  /** Overrides the era singlet picked from school and years. */
  kit?: KitLook & { primary?: string; secondary?: string; piping?: string };
  sources: { label: string; url: string; kind: 'photo' | 'film' | 'bio' }[];
  /** What the photos show, and what is still unverified. */
  notes: string;
}

export const LIKENESS: Record<string, Likeness> = {
  'Michael Moreno': {
    years: [2012, 2015],
    height: 1.77,
    mass: 0.44,
    skin: '#dcb291',
    hairColor: '#1c1714',
    eye: '#3a2a20',
    // High fade: sides nearly skin, a spiky top about 2–3 cm brushed up and slightly to his left.
    // Owner: a very short cut on thick, straight, near-black hair.
    hair: 'crop', hairLen: 0.006, hairSides: 0.35, hairFront: 1.705, hairFlow: [0.1, 0.6, 0.85], hairStraight: 1,
    stubble: 0.02,
    // Thick, dark, low and nearly straight brows.
    brow: [-0.003, 0.0, 1.0, 2.0],
    smile: 0.3,
    face: {
      // Rectangular face with a wide jaw, not short: the lower face keeps its length.
      jaw: 0.0098, chin: 0.003, chinW: 1.45, faceLen: -0.0045,
      // Broad bridge and a big rounded tip.
      nose: 0.004, noseW: 0.0012,
      brow: 0.0014, cheek: 0.006, hollow: 0.05,
      // Thin upper lip.
      lips: 0.88, cauli: 0.05,
      // Narrower, slightly hooded almond eyes.
      eyeOpen: 0.62, eyeWidth: 0.93, upperLidHood: 0.0026, foreheadProjection: -0.001,
      // Ears stand out clearly and are on the large side.
      earFlare: 0, earSize: 1.05,
      baseShape: [0.7, 0, 0.3, 0.6, 0.45, 0.5, 0, 0.7, -0.5, 0],
    },
    frame: { neck: 1.13, traps: 1.08, torsoW: 1.0, torsoD: 0.99, limb: 1.0, delt: 1.06, hips: 1.02, head: 1, definition: 0.78 },
    // 2015 NCAA singlet: solid cardinal, gold trim, large gold I-STATE across the chest, gold leg cuffs.
    kit: { cut: 0.1, leg: 0.2, panel: false, cuff: '#f5c635', primary: '#9e1736', piping: '#f5c635' },
    sources: [
      { label: 'Iowa State portrait (2015)', url: 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/isuni.sidearmsports.com/images/2015/10/2/TGCJBIUFSYWIISS.20151002142327.jpg', kind: 'photo' },
      { label: '2015 NCAA hand raise, cardinal I-STATE singlet', url: 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/isuni.sidearmsports.com/images/2015/6/24/Moreno_Michael_NCAA_2014_15_4_.jpg', kind: 'photo' },
      { label: '2015 Big 12 vs Oklahoma State, two-tone gold and cardinal singlet', url: 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/isuni.sidearmsports.com/images/2015/6/24/Moreno_Michael_Big12_2014_15_2.JPG', kind: 'photo' },
      { label: '2014 Rutgers dual, riding on top', url: 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/isuni.sidearmsports.com/images/2015/6/24/Moreno_Michael_Rutgers_2013_14_8.JPG', kind: 'photo' },
      { label: 'Iowa State roster page', url: 'https://cyclones.com/sports/wrestling/roster/michael-moreno/1333', kind: 'bio' },
    ],
    notes: 'Broad, full-cheeked face; wide strong jaw; rounded chin with a slight cleft; thick straight dark brows; dark brown almond eyes; medium-wide nose with a rounded tip; ears stand out a little, no cauliflower. Light olive skin, near-black hair short on the sides and brushed up on top. Lean and muscular. Not modelled yet: Aztec-calendar tattoo on the left thigh, script tattoo on the arm, black sleeve on the right knee. Height is an estimate.',
  },
  // Owner, November 10: "Diakomihalis is a white greek dude"; with no portrait or profile his colouring was drawn at
  // random and came out deep brown. Colours only (light olive skin, near-black straight hair, dark brown eyes);
  // face and build stay generic until a portrait is fitted.
  'Yianni Diakomihalis': {
    years: [2018, 2023],
    skin: '#e0b494',
    hairColor: '#17110d',
    eye: '#3b2416',
    hairStraight: 1,
    sources: [{ label: 'Cornell All-American page', url: 'https://cornellbigred.com/aa.aspx?hid=686', kind: 'bio' }],
    notes: 'Greek-American, light olive skin, dark straight hair, brown eyes (owner). Colours only; no portrait fitted yet.',
  },
};

/** A hand-fitted likeness, over the researched basics (college years, listed height). */
export const likenessFor = (name: string): Likeness | undefined => {
  const hand = LIKENESS[name], basics = LIKENESS_BASICS[name], photo = LIKENESS_PHOTOS[name];
  if (!hand && !basics && !photo) return undefined;
  return hand ? { ...basics, ...photo, ...hand } : { sources: [], notes: 'Researched college years and height; colours and hair read from his portrait.', ...basics, ...photo };
};
