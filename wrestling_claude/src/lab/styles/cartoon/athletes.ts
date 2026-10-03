import type { ToonShape } from './anatomy';
import type { ToonLook } from './toon';

/**
 * The two athletes, as caricatures built from published facts (heights,
 * builds, school colours) and widely-seen photo cues. No photos or logos are
 * used; the likeness lives in silhouette, jaw, brow, hair and colours.
 *
 * Kyle Dake (Cornell): 1.75 m, compact and dense at 165 lb, thick neck and
 * traps, square jaw, straight low brows, serious. Dark tapered hair with a
 * textured top.
 * David Taylor (Penn State): 1.83 m, long and lean at the same weight, longer
 * neck and face, narrower jaw, an easy "Magic Man" smile. Lighter brown hair,
 * a little longer on top and swept across.
 */

export interface Athlete {
  name: string;
  school: string;
  label: string;
  height: number;
  shape: ToonShape;
  look: Omit<ToonLook, 'scale' | 'headScale' | 'chestW' | 'noseLen' | 'noseW' | 'cupX' | 'hairUp' | 'chinDrop' | 'chinFwd' | 'jawW' | 'headShift'>;
}

const dakeScale = 1.75 / 1.76;
const taylorScale = 1.83 / 1.76;

export const DAKE: Athlete = {
  name: 'Kyle Dake',
  school: 'Cornell',
  label: 'Kyle Dake · Cornell',
  height: 1.75,
  shape: {
    scale: dakeScale,
    // Compact and dense: broad shoulders and traps, a thick neck, heavy legs.
    chestW: 1.24,
    chestD: 1.06,
    lats: 1.3,
    waist: 0.88,
    hips: 0.84,
    glute: 0.92,
    neck: 1.42,
    traps: 1.55,
    delts: 1.42,
    deltX: 0.012,
    arm: 1.2,
    forearm: 1.38,
    hand: 1.12,
    thigh: 1.3,
    calf: 1.34,
    head: 1.2,
    headShift: [0, 0, -0.01],
    hair: 'textured',
    face: {
      skullW: 1.05,
      cheekW: 1.1,
      jawW: 1.12,
      jawSquare: 1,
      chinDrop: 0.003,
      chinW: 1.22,
      chinFwd: 0.02,
      noseLen: 0.003,
      noseW: 1.18,
      brow: 1.4,
      hairline: -0.004,
    },
  },
  look: {
    skin: '#E2B391',
    hair: '#3A2A1F',
    brow: '#2a1d15',
    eye: '#6b4f33',
    primary: '#B31B1B',
    secondary: '#FFFFFF',
    trim: '#FFFFFF',
    piping: '#1A1A1A',
    band: '#d8262a',
    shoe: '#1d1c22',
    shoeAccent: '#B31B1B',
    gearShell: '#B31B1B',
    gearRim: '#1A1A1A',
    gearStrap: '#1A1A1A',
    wordmark: 'Cornell',
    hairFlow: [0, 0.35, 1],
    hairAcross: [1, 0, 0],
    face: {
      eyeX: 0.0365,
      eyeY: 1.6505,
      eyeW: 0.0205,
      eyeUp: 0.0062,
      eyeLo: 0.0046,
      eyeTilt: 0.04,
      iris: 0.0074,
      // Low, straight brows that dip toward the nose: a determined V, not a worried one.
      browY: 0.0088,
      browRise: 0.0042,
      browArch: 0.0004,
      browIn: 0.0066,
      browOut: 0.0036,
      browLen: 0.054,
      knit: 1,
      mouthW: 0.0255,
      mouthCurve: 0,
      mouthWeight: 0.0011,
      mouthY: 0.001,
      grin: 0,
      hollow: 0,
      cleft: 0.9,
      hairPeak: 0.006,
      hairRecede: 0.011,
      hairJag: 0.0025,
    },
  },
};

export const TAYLOR: Athlete = {
  name: 'David Taylor',
  school: 'Penn State',
  label: 'David Taylor · Penn State',
  height: 1.83,
  shape: {
    scale: taylorScale,
    // Long and lean: a narrower, flatter ribcage, a long neck, slimmer limbs.
    chestW: 1.0,
    chestD: 0.9,
    lats: 1.2,
    waist: 0.78,
    hips: 0.74,
    glute: 0.76,
    neck: 0.9,
    traps: 1.0,
    delts: 1.24,
    deltX: 0,
    arm: 1.04,
    forearm: 1.2,
    hand: 1.16,
    thigh: 1.08,
    calf: 1.1,
    head: 1.12,
    headShift: [0, 0.012, -0.01],
    hair: 'swept',
    face: {
      skullW: 0.93,
      cheekW: 0.96,
      jawW: 0.86,
      jawSquare: 0.3,
      chinDrop: 0.018,
      chinW: 1.0,
      chinFwd: 0.014,
      noseLen: 0.006,
      noseW: 0.94,
      brow: 1.05,
      hairline: 0.007,
    },
  },
  look: {
    skin: '#EBC3A4',
    hair: '#6B4E33',
    brow: '#4a3322',
    eye: '#5f8fc2',
    primary: '#001E44',
    secondary: '#FFFFFF',
    trim: '#FFFFFF',
    piping: '#1E407C',
    band: '#1f9d4a',
    shoe: '#15182a',
    shoeAccent: '#FFFFFF',
    gearShell: '#001E44',
    gearRim: '#FFFFFF',
    gearStrap: '#0d2a55',
    wordmark: 'Penn State',
    hairFlow: [-0.75, 0.25, 0.6],
    hairAcross: [0.6, 0, 0.75],
    face: {
      eyeX: 0.034,
      eyeY: 1.6505,
      eyeW: 0.0195,
      eyeUp: 0.0074,
      eyeLo: 0.0047,
      eyeTilt: 0.04,
      iris: 0.0076,
      browY: 0.0165,
      browRise: 0.001,
      browArch: 0.0028,
      browIn: 0.0048,
      browOut: 0.0028,
      browLen: 0.05,
      knit: 0,
      mouthW: 0.0275,
      mouthCurve: 9,
      mouthWeight: 0.0009,
      mouthY: 0,
      grin: 0.0058,
      hollow: 0.8,
      cleft: 0,
      hairPeak: 0,
      hairRecede: 0.002,
      hairJag: 0.0009,
    },
  },
};
