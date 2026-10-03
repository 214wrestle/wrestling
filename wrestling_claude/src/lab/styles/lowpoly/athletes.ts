/**
 * The two athletes of the 2013 NCAA 165 lb final, as build and look parameters.
 * Likenesses are loose and respectful: proportions, face shape and colouring
 * from public facts; no photos, logos or marks.
 */

export interface HeadShape {
  /** Uniform head scale about the head pivot (head-to-height ratio). */
  size: number;
  /** Overall breadth. */
  width: number;
  /** Jaw breadth below the cheekbones. */
  jaw: number;
  /** Lower-face length below the eyes. */
  faceLength: number;
  /** Chin projection (m) and chin breadth. */
  chin: number;
  chinWidth: number;
  /** Cheekbone push (m). */
  cheek: number;
  /** Nose projection (m), width and length. */
  nose: number;
  noseWidth: number;
  /** Brow ridge projection (m) and brow height (m). */
  brow: number;
  browY: number;
  /** Painted brow thickness and arch. */
  browThick: number;
  browArch: number;
  /** 0 = relaxed brow, 1 = level outer tail and lowered inner end. */
  browTilt: number;
  /** Mouth: corner lift (smile) and width. */
  smile: number;
  /** Upper-lid drop (m): a hooded, intense look. */
  lid: number;
  /** Hollow under the cheekbones (m). */
  hollow: number;
  /** 0 = closed mouth, 1 = a wide, toothy grin. */
  grin: number;
}

export interface BodyShape {
  shoulder: number;
  chest: number;
  waist: number;
  hip: number;
  depth: number;
  neck: number;
  /** Trap height offset (m): dense necks sit in higher traps. */
  trap: number;
  arm: number;
  forearm: number;
  thigh: number;
  calf: number;
}

export interface HairShape {
  /** Shell thickness on top and at the sides (m). */
  top: number;
  side: number;
  /** Front hairline height (canonical frame, m). */
  line: number;
  /** Fringe tuft length (m) and how far the tufts lift (0 = lie forward and down, 1 = stand up). */
  fringe: number;
  lift: number;
  /** Fringe and crown sweep: -1 toward his right, +1 toward his left. */
  sweep: number;
  /** Crown tuft length (m): the chunky, jagged texture on top. */
  chunk: number;
  seed: number;
}

export interface Athlete {
  name: string;
  school: string;
  label: string;
  height: number;
  skin: string;
  hair: string;
  eye: string;
  primary: string;
  secondary: string;
  trim: string;
  piping: string;
  gearShell: string;
  gearStrap: string;
  /** Rim ring where the ear cup meets the skull. */
  gearTrim: string;
  shoe: string;
  shoeAccent: string;
  band: string;
  wordmark: string;
  head: HeadShape;
  body: BodyShape;
  hairShape: HairShape;
}

/** Kyle Dake, Cornell, senior: 5-9, compact and dense, square face, thick neck. */
export const DAKE: Athlete = {
  name: 'Kyle Dake',
  school: 'Cornell',
  label: 'Kyle Dake · Cornell',
  height: 1.75,
  skin: '#E2B391',
  hair: '#3A2A1F',
  eye: '#5A4632',
  primary: '#B31B1B',
  secondary: '#FFFFFF',
  trim: '#1A1A1A',
  piping: '#1A1A1A',
  gearShell: '#B31B1B',
  gearStrap: '#8f1717',
  gearTrim: '#1A1A1A',
  shoe: '#1d1c21',
  shoeAccent: '#B31B1B',
  band: '#c8261f',
  wordmark: 'CORNELL',
  head: {
    size: 1.07,
    width: 1.08,
    jaw: 1.17,
    faceLength: 0.93,
    chin: 0.002,
    chinWidth: 1.15,
    cheek: 0.0,
    nose: 0.0,
    noseWidth: 1.06,
    brow: 0.003,
    browY: -0.0035,
    browThick: 1.15,
    browArch: 0.15,
    browTilt: 1.0,
    smile: -0.15,
    lid: 0.0009,
    hollow: 0,
    grin: 0,
  },
  body: {
    shoulder: 1.1,
    chest: 1.09,
    waist: 1.1,
    hip: 1.03,
    depth: 1.06,
    neck: 1.22,
    trap: 0.012,
    arm: 1.1,
    forearm: 1.08,
    thigh: 1.12,
    calf: 1.1,
  },
  hairShape: { top: 0.011, side: 0.0045, line: 1.714, fringe: 0.026, lift: 0.1, sweep: 0.15, chunk: 0.011, seed: 3 },
};

/** David Taylor, Penn State, junior: 6-0, long and lean, long oval face. */
export const TAYLOR: Athlete = {
  name: 'David Taylor',
  school: 'Penn State',
  label: 'David Taylor · Penn State',
  height: 1.83,
  skin: '#EBC3A4',
  hair: '#6B4E33',
  eye: '#6F8FA8',
  primary: '#001E44',
  secondary: '#FFFFFF',
  trim: '#FFFFFF',
  piping: '#1E407C',
  gearShell: '#001E44',
  gearStrap: '#1E407C',
  gearTrim: '#f2f2f2',
  shoe: '#14182a',
  shoeAccent: '#1E407C',
  band: '#1f9d4a',
  wordmark: 'PENN STATE',
  head: {
    size: 1.03,
    width: 0.96,
    jaw: 0.95,
    faceLength: 1.06,
    chin: -0.001,
    chinWidth: 0.88,
    cheek: 0.004,
    nose: 0.005,
    noseWidth: 1.0,
    brow: 0.0018,
    browY: -0.001,
    browThick: 1.1,
    browArch: 0.7,
    browTilt: 0.2,
    smile: 1,
    lid: 0.0005,
    hollow: 0.003,
    grin: 1,
  },
  body: {
    shoulder: 0.99,
    chest: 0.97,
    waist: 0.94,
    hip: 0.96,
    depth: 0.96,
    neck: 1.0,
    trap: 0.002,
    arm: 0.97,
    forearm: 0.97,
    thigh: 0.97,
    calf: 0.97,
  },
  hairShape: { top: 0.016, side: 0.005, line: 1.72, fringe: 0.026, lift: 0.2, sweep: -0.85, chunk: 0.012, seed: 11 },
};
