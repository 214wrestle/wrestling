import type { FaceParams, FrameParams, HairCut } from './anatomy';

/**
 * The two athletes of the 2013 NCAA 165 lb final, as respectful stylised
 * likenesses built from published facts (height, build, colouring, era) rather
 * than photos. Face and frame parameters carry the caricature cues: Dake broad,
 * square-jawed, thick-necked and compact; Taylor long-faced, long-necked, lean.
 */

export interface Athlete {
  id: string;
  name: string;
  school: string;
  wordmark: string;
  height: number;
  mass: number;
  skin: string;
  hairColor: string;
  hair: HairCut;
  /** Shell hair length on top, metres. */
  hairLen: number;
  hairFlow: [number, number, number];
  /** Density of the clipped sides, 0..1. */
  hairSides: number;
  /** Front hairline height. */
  hairFront: number;
  /** Mouth-corner lift. */
  smile: number;
  /** Eyebrow lift, slope, arch, thickness. */
  brow: [number, number, number, number];
  eye: string;
  stubble: number;
  primary: string;
  secondary: string;
  piping: string;
  shoe: string;
  shoeAccent: string;
  gearShell: string;
  gearStrap: string;
  face: FaceParams;
  frame: FrameParams;
}

export const ATHLETES: [Athlete, Athlete] = [
  {
    id: 'dake',
    name: 'Kyle Dake',
    school: 'Cornell',
    wordmark: 'CORNELL',
    height: 1.75,
    mass: 0.62,
    skin: '#E2B391',
    hairColor: '#3A2A1F',
    hair: 'crop',
    hairLen: 0.0095,
    hairFlow: [0, 0.35, 1],
    hairSides: 0.85,
    hairFront: 1.7,
    smile: 0.5,
    brow: [-0.002, 0.11, 2.0, 1.25],
    eye: '#5A4632',
    stubble: 0.03,
    primary: '#B31B1B',
    secondary: '#FFFFFF',
    piping: '#1A1A1A',
    shoe: '#141418',
    shoeAccent: '#B31B1B',
    gearShell: '#B31B1B',
    gearStrap: '#1A1A1A',
    face: {
      jaw: 0.0045,
      chin: 0.0065,
      chinW: 1.25,
      faceLen: -0.0025,
      nose: 0.001,
      noseW: 0.002,
      brow: 0.0018,
      cheek: 0.002,
      hollow: 0.3,
      lips: 0.9,
      cauli: 0.55,
      smile: 0.5,
      eyeOpen: 1.02,
    },
    frame: { neck: 1.12, traps: 1.3, torsoW: 1.07, torsoD: 1.05, limb: 1.1, delt: 1.05, hips: 1.06, head: 1.03 },
  },
  {
    id: 'taylor',
    name: 'David Taylor',
    school: 'Penn State',
    wordmark: 'PENN STATE',
    height: 1.83,
    mass: 0.38,
    skin: '#EBC3A4',
    hairColor: '#6B4E33',
    hair: 'swept',
    hairLen: 0.0115,
    hairFlow: [0.55, 0.1, 0.85],
    hairSides: 0.8,
    hairFront: 1.694,
    smile: 5.5,
    brow: [-0.0012, 0.07, 1.6, 1.05],
    eye: '#6F8FA8',
    stubble: 0.02,
    primary: '#001E44',
    secondary: '#FFFFFF',
    piping: '#1E407C',
    shoe: '#0e1a33',
    shoeAccent: '#dfe4ec',
    gearShell: '#001E44',
    gearStrap: '#0b1222',
    face: {
      jaw: -0.0025,
      chin: 0.004,
      chinW: 1.15,
      faceLen: 0.0022,
      nose: 0.003,
      noseW: -0.0015,
      brow: 0.0008,
      cheek: 0.001,
      hollow: 0.5,
      lips: 0.9,
      cauli: 0.25,
      smile: 5.5,
      eyeOpen: 1.06,
    },
    frame: { neck: 1.0, traps: 1.05, torsoW: 0.99, torsoD: 0.96, limb: 0.98, delt: 1.0, hips: 0.95, head: 1.0 },
  },
];
