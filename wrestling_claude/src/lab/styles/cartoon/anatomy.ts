import { BIND_POSE, BONES, BONE_INDEX, MIRROR, restPositions } from '../../../body/skeleton';
import type { BoneName } from '../../../body/skeleton';
import { m3Apply, m3FromEuler, m3Identity, m3Mul } from '../../../body/math';
import type { M3, V3 } from '../../../body/math';
import { Kind, Part, Prim } from '../../../body/sdf';

/**
 * Toon anatomy.
 *
 * The same idea as src/body/anatomy.ts (signed-distance masses per bone, skinned
 * from the masses that claim each vertex) but with the audit's corrected
 * proportions as the base and a stylisation layer on top: a heroic V-taper,
 * broad sloping traps, a thick neck, big forearms and hands, strong legs and a
 * slightly larger head. Every athlete gets his own shape and face parameters,
 * so the two real wrestlers read as caricatures of themselves.
 *
 * All coordinates are rest-pose metres for the canonical 1.76 m body (+Y up,
 * facing +Z, +X = the athlete's left). Bones and BONES offsets are untouched.
 */

/** Part ids beyond the engine's own (Torso..Hair = 0..6). */
export const PART = {
  torso: Part.Torso,
  head: Part.Head,
  arm: Part.Arm,
  hand: Part.Hand,
  leg: Part.Leg,
  foot: Part.Foot,
  hair: Part.Hair,
  /** Nose: shaded like skin, excluded from face-normal smoothing. */
  nose: 7 as Part,
  ear: 8 as Part,
  cup: 10 as Part,
  rim: 11 as Part,
  strap: 12 as Part,
  chin: 13 as Part,
} as const;

export type HairCut = 'textured' | 'swept';

/** Everything that makes one athlete's body and face his own. */
export interface ToonShape {
  /** Height / 1.76. */
  scale: number;
  /** Lateral width of the torso masses (V-taper lives in chest + lats). */
  chestW: number;
  /** Depth of the torso masses. */
  chestD: number;
  /** Lat flare. */
  lats: number;
  /** Waist / oblique width. */
  waist: number;
  /** Pelvis width (toon heroes run narrow in the hips). */
  hips: number;
  /** Glute mass. */
  glute: number;
  neck: number;
  traps: number;
  delts: number;
  arm: number;
  forearm: number;
  /** Hand size about the wrist. */
  hand: number;
  thigh: number;
  calf: number;
  /** Uniform head scale about the jaw pivot (toon heads run a little large). */
  head: number;
  /** Head offset on the head bone, canonical metres (a longer neck lifts it). */
  headShift: V3;
  /** Deltoids pushed out from the joint (m): broader shoulders without bigger balls. */
  deltX: number;
  face: FaceShape;
  hair: HairCut;
}

export interface FaceShape {
  /** Cranium width. */
  skullW: number;
  /** Cheekbone width. */
  cheekW: number;
  /** Jaw (gonial) width. */
  jawW: number;
  /** 0 = tapered oval jaw, 1 = square block jaw. */
  jawSquare: number;
  /** Extra face length below the nose, metres (long face > 0). */
  chinDrop: number;
  /** Chin width. */
  chinW: number;
  /** Chin projection, metres. */
  chinFwd: number;
  /** Nose length (drop of the tip), metres. */
  noseLen: number;
  /** Nose width. */
  noseW: number;
  /** Brow ridge prominence. */
  brow: number;
  /** Hairline lift, metres (a high forehead > 0). */
  hairline: number;
}

type Weights = Partial<Record<BoneName, number>>;

/** Which stylisation multiplier a mass takes. */
type Group =
  | 'core'
  | 'torso'
  | 'lat'
  | 'waist'
  | 'hips'
  | 'glute'
  | 'neck'
  | 'trap'
  | 'delt'
  | 'arm'
  | 'fore'
  | 'hand'
  | 'thigh'
  | 'thighTop'
  | 'calf'
  | 'head'
  | 'shoe';

interface Spec {
  bone: BoneName;
  kind: Kind;
  a?: V3;
  b?: V3;
  ra?: number;
  rb?: number;
  c?: V3;
  r?: V3;
  rot?: V3;
  round?: number;
  k: number;
  w?: Weights;
  w0?: Weights;
  w1?: Weights;
  t0?: number;
  t1?: number;
  axis?: number;
  sub?: boolean;
  part: Part;
  grp?: Group;
  clip?: { c: V3; n: V3; k: number };
  noise?: number;
  claim?: number;
  late?: boolean;
}

const cone = (bone: BoneName, a: V3, b: V3, ra: number, rb: number, k: number, part: Part, extra: Partial<Spec> = {}): Spec => ({
  bone,
  kind: Kind.Cone,
  a,
  b,
  ra,
  rb,
  k,
  part,
  ...extra,
});
const ell = (bone: BoneName, c: V3, r: V3, k: number, part: Part, extra: Partial<Spec> = {}): Spec => ({
  bone,
  kind: Kind.Ellipsoid,
  c,
  r,
  k,
  part,
  ...extra,
});
const box = (bone: BoneName, c: V3, h: V3, round: number, k: number, part: Part, extra: Partial<Spec> = {}): Spec => ({
  bone,
  kind: Kind.Box,
  c,
  r: h,
  round,
  k,
  part,
  ...extra,
});

const mirrorBone = (b: BoneName): BoneName => MIRROR[b] ?? b;
const mirrorV = (v: V3): V3 => [-v[0], v[1], v[2]];
const mirrorW = (w: Weights | undefined): Weights | undefined => {
  if (!w) return undefined;
  const out: Weights = {};
  for (const [k, v] of Object.entries(w)) out[mirrorBone(k as BoneName)] = v;
  return out;
};
function mirror(s: Spec): Spec {
  return {
    ...s,
    bone: mirrorBone(s.bone),
    a: s.a && mirrorV(s.a),
    b: s.b && mirrorV(s.b),
    c: s.c && mirrorV(s.c),
    rot: s.rot && [s.rot[0], -s.rot[1], -s.rot[2]],
    w: mirrorW(s.w),
    w0: mirrorW(s.w0),
    w1: mirrorW(s.w1),
    clip: s.clip && { c: mirrorV(s.clip.c), n: mirrorV(s.clip.n), k: s.clip.k },
  };
}
const pair = (s: Spec): Spec[] => [s, mirror(s)];

/* ------------------------------------------------------------- torso ---- */

function torso(): Spec[] {
  const T = PART.torso;
  return [
    // Pelvis and glutes (narrowed per the audit: no hourglass, no bubble).
    ell('hips', [0, 0.955, -0.012], [0.136, 0.105, 0.1], 0.03, T, { w: { hips: 1 }, grp: 'hips' }),
    ...pair(
      ell('hips', [0.066, 0.905, -0.062], [0.074, 0.09, 0.064], 0.035, T, {
        rot: [10, 0, 0],
        w: { hips: 0.7, thighL: 0.3 },
        grp: 'glute',
      }),
    ),
    // Crotch gusset so the singlet bridges smoothly between the thighs.
    ell('hips', [0, 0.858, -0.005], [0.036, 0.032, 0.056], 0.03, T, { w: { hips: 0.8, thighL: 0.1, thighR: 0.1 } }),
    // Lower belly, waist core, obliques, rectus: flat front, thick through the sides.
    ell('hips', [0, 1.02, 0.0], [0.14, 0.08, 0.082], 0.04, T, { w: { hips: 0.55, spine: 0.45 }, grp: 'waist' }),
    ell('spine', [0, 1.09, -0.016], [0.128, 0.1, 0.086], 0.04, T, { w: { spine: 0.85, hips: 0.15 }, grp: 'waist' }),
    ...pair(ell('spine', [0.09, 1.07, -0.004], [0.038, 0.085, 0.064], 0.035, T, { w: { hips: 0.5, spine: 0.5 }, grp: 'waist' })),
    ell('spine', [0, 1.15, 0.028], [0.09, 0.12, 0.058], 0.03, T, {
      w0: { spine: 0.85, hips: 0.15 },
      w1: { spine: 0.45, chest: 0.55 },
      grp: 'torso',
    }),
    // Ribcage and upper chest: the V-taper's top.
    ell('chest', [0, 1.258, -0.014], [0.138, 0.152, 0.104], 0.045, T, {
      w0: { spine: 0.65, chest: 0.35 },
      w1: { chest: 1 },
      grp: 'torso',
    }),
    ell('chest', [0, 1.36, -0.012], [0.168, 0.092, 0.102], 0.04, T, { w: { chest: 1 }, grp: 'torso' }),
    // Pecs: flat plates that tie into the armpit, not round domes.
    ...pair(
      ell('chest', [0.074, 1.342, 0.072], [0.086, 0.064, 0.03], 0.028, T, {
        rot: [-8, 20, -12],
        w: { chest: 0.82, shoulderL: 0.18 },
        grp: 'torso',
      }),
    ),
    // Lats: a long tapered wedge, widest under the armpit and running down into
    // the waist, so the singlet's side reads as one clean V from armpit to hip.
    ...pair(
      cone('chest', [0.08, 1.12, -0.03], [0.118, 1.31, -0.042], 0.028, 0.05, 0.04, T, {
        w0: { spine: 0.6, chest: 0.4 },
        w1: { chest: 0.85, shoulderL: 0.15 },
        grp: 'lat',
      }),
    ),
    // Traps: broad and sloping from the neck to the shoulder, never shrugged.
    ...pair(
      cone('chest', [0.036, 1.478, -0.048], [0.15, 1.438, -0.036], 0.041, 0.026, 0.032, T, {
        w0: { neck: 0.45, chest: 0.55 },
        w1: { chest: 0.55, shoulderL: 0.45 },
        grp: 'trap',
      }),
    ),
    ell('chest', [0, 1.33, -0.066], [0.112, 0.11, 0.054], 0.04, T, { w: { chest: 1 }, grp: 'torso' }),
    // Paired erectors leave a groove down the lower back.
    ...pair(
      ell('spine', [0.032, 1.11, -0.062], [0.032, 0.12, 0.035], 0.03, T, {
        w0: { hips: 0.55, spine: 0.45 },
        w1: { spine: 0.6, chest: 0.4 },
        grp: 'torso',
      }),
    ),
    // Clavicles.
    ...pair(
      cone('shoulderL', [0.03, 1.443, 0.036], [0.168, 1.438, 0.004], 0.018, 0.021, 0.02, T, {
        w0: { chest: 0.65, shoulderL: 0.35 },
        w1: { shoulderL: 0.85, chest: 0.15 },
      }),
    ),
    // Shoulder blades.
    ...pair(
      ell('chest', [0.098, 1.355, -0.074], [0.058, 0.074, 0.03], 0.03, T, {
        rot: [0, 20, 0],
        w: { chest: 0.55, shoulderL: 0.45 },
        grp: 'torso',
      }),
    ),
  ];
}

/* -------------------------------------------------------- neck + head ---- */

function neck(): Spec[] {
  const T = PART.torso;
  return [
    cone('neck', [0, 1.43, -0.034], [0, 1.6, -0.02], 0.066, 0.057, 0.036, T, {
      w0: { chest: 0.35, neck: 0.65 },
      w1: { neck: 0.45, head: 0.55 },
      t0: 0.1,
      t1: 0.95,
      grp: 'neck',
    }),
    // Sternocleidomastoids.
    ...pair(
      cone('neck', [0.017, 1.462, 0.036], [0.05, 1.584, -0.02], 0.018, 0.016, 0.02, T, {
        w0: { neck: 0.8, chest: 0.2 },
        w1: { neck: 0.4, head: 0.6 },
        grp: 'neck',
      }),
    ),
  ];
}

/** Head masses in canonical head space; scaled about HEAD_PIVOT afterwards. */
function head(f: FaceShape, hair: HairCut): Spec[] {
  const H = PART.head;
  const w = { head: 1 };
  const cd = f.chinDrop;
  const jw = f.jawW;
  const sq = f.jawSquare;
  const specs: Spec[] = [
    // Braincase, a near-vertical forehead and the back of the skull.
    // (The back of the skull is kept short, so the head does not trail behind the ear.)
    ell('head', [0, 1.672, -0.002], [0.0775 * f.skullW, 0.09, 0.094], 0.02, H, { w }),
    ell('head', [0, 1.706, 0.04], [0.062 * f.skullW, 0.042, 0.052], 0.02, H, { w }),
    ell('head', [0, 1.648, -0.05], [0.064 * f.skullW, 0.058, 0.048], 0.025, H, { w }),
    // Mid-face.
    ell('head', [0, 1.618 - cd * 0.3, 0.03], [0.058 * f.cheekW, 0.064 + cd * 0.3, 0.068], 0.025, H, { w }),
    // Jaw: tapered cones for an oval face, a rounded block for a square one.
    ...pair(
      cone('head', [0.043 * jw, 1.579, -0.008], [0.017 * f.chinW, 1.552 - cd, 0.07 + f.chinFwd], 0.016 * (0.9 + sq * 0.25), 0.015, 0.024, H, { w }),
    ),
    box('head', [0, 1.566 - cd * 0.6, 0.028 + f.chinFwd * 0.5], [0.038 * jw, 0.02 + cd * 0.4, 0.042], 0.02, 0.026 + (1 - sq) * 0.02, H, {
      w,
    }),
    ...pair(ell('head', [0.044 * jw, 1.566 - cd * 0.5, 0.014], [0.016 + sq * 0.006, 0.018 + cd * 0.3, 0.03], 0.02, H, { w })),
    // Chin: a forward block, squared underneath on a square jaw.
    ell('head', [0, 1.552 - cd, 0.077 + f.chinFwd], [0.021 * f.chinW, 0.017, 0.017], 0.02, H, { w }),
    box('head', [0, 1.552 - cd, 0.074 + f.chinFwd], [0.017 * f.chinW, 0.012 + sq * 0.002, 0.017], 0.007, 0.012, H, { w }),
    // Cheekbones, and full toon cheeks that fill the hollow beside the muzzle.
    ...pair(ell('head', [0.05 * f.cheekW, 1.633, 0.064], [0.021, 0.013, 0.018], 0.016, H, { w })),
    ...pair(ell('head', [0.036 * f.cheekW, 1.604, 0.07], [0.026, 0.03, 0.024], 0.02, H, { w })),
    // Brow ridge with a glabella and a nasion dip under it.
    ...pair(cone('head', [0.008, 1.671, 0.092], [0.047, 1.673, 0.079], 0.0105 * f.brow, 0.0082 * f.brow, 0.012, H, { w })),
    ell('head', [0, 1.668, 0.094], [0.012, 0.008, 0.009], 0.01, H, { w }),
    // Nose: bridge, tip and wings.
    cone('head', [0, 1.658, 0.093], [0, 1.62 - f.noseLen, 0.115], 0.0075, 0.0105 * f.noseW, 0.01, PART.nose, { w }),
    ell('head', [0, 1.613 - f.noseLen, 0.11], [0.0145 * f.noseW, 0.0098, 0.012], 0.01, PART.nose, { w }),
    ...pair(ell('head', [0.0115 * f.noseW, 1.607 - f.noseLen, 0.098], [0.0072, 0.007, 0.0085], 0.008, PART.nose, { w })),
    // Lips: a soft upper lip and a lower lip; the line itself is painted.
    ell('head', [0, 1.594, 0.09], [0.022, 0.01, 0.012], 0.012, H, { w }),
    ell('head', [0, 1.5875, 0.093], [0.024, 0.0055, 0.0105], 0.008, H, { w, rot: [-15, 0, 0] }),
    ell('head', [0, 1.576, 0.09], [0.021, 0.0065, 0.0105], 0.008, H, { w }),
    // Fill the line between the lips, so a profile never reads as an open mouth.
    ell('head', [0, 1.5825, 0.088], [0.019, 0.0048, 0.0095], 0.006, H, { w }),
    // Ears (mostly under the ear cups).
    // Ears: flat toon shells that stand off the skull and turn a little forward.
    ...pair(ell('head', [0.081 * f.skullW, 1.638, -0.01], [0.0075, 0.031, 0.019], 0.009, PART.ear, { w, rot: [-12, -24, 0] })),
  ];
  specs.push(...hairSpecs(hair, f.hairline));
  return specs;
}

/**
 * Hair as chunky toon clumps on top of a thin cap. Tapered sides are painted;
 * only the top carries volume, since the headgear straps sit over the rest.
 */
function hairSpecs(cut: HairCut, lift: number): Spec[] {
  const Hr = PART.hair;
  const w = { head: 1 };
  const hairline = { c: [0, 1.713 + lift, 0.06] as V3, n: [0, -0.6, 0.8] as V3, k: 0.01 };
  const top = { c: [0, 1.708, 0] as V3, n: [0, -1, 0] as V3, k: 0.03 };
  const specs: Spec[] = [
    // Thin cap to the hairline; the clipped sides are painted.
    ell('head', [0, 1.674, -0.008], [0.08, 0.093, 0.101], 0.008, Hr, { w, clip: hairline, claim: 0.7 }),
  ];
  if (cut === 'textured') {
    // Short dense top, pushed forward, the front edge broken into a few chunky points.
    specs.push(ell('head', [0, 1.712, 0.0], [0.07, 0.058, 0.094], 0.016, Hr, { w, clip: top, claim: 0.7 }));
    const points: Array<[number, number, number, number, number]> = [
      // x, y, z, pitch, yaw
      [0.0, 1.748, 0.068, -50, 0],
      [0.024, 1.744, 0.064, -50, 18],
      [-0.024, 1.744, 0.064, -50, -18],
      [0.044, 1.738, 0.05, -44, 34],
      [-0.044, 1.738, 0.05, -44, -34],
    ];
    for (const [x, y, z, pitch, yaw] of points) {
      specs.push(ell('head', [x, y, z], [0.014, 0.008, 0.022], 0.01, Hr, { w, rot: [pitch, yaw, 0], claim: 0.7 }));
    }
  } else {
    // A little longer on top, swept up and across to his right in two big locks.
    specs.push(ell('head', [0, 1.714, -0.004], [0.068, 0.06, 0.094], 0.016, Hr, { w, clip: top, claim: 0.7 }));
    specs.push(ell('head', [0.0, 1.745, 0.03], [0.05, 0.015, 0.056], 0.02, Hr, { w, rot: [-28, -22, 6], claim: 0.7 }));
    // The front lock falls across the forehead toward his right.
    specs.push(ell('head', [-0.026, 1.735, 0.068], [0.036, 0.011, 0.026], 0.014, Hr, { w, rot: [-58, -34, 22], claim: 0.7 }));
    specs.push(ell('head', [0.024, 1.744, 0.06], [0.03, 0.01, 0.026], 0.014, Hr, { w, rot: [-52, -14, -8], claim: 0.7 }));
  }
  return specs;
}

/* --------------------------------------------------------------- arms ---- */

function arms(): Spec[] {
  const A = PART.arm;
  return [
    // Deltoid capped at joint x + 0.05 and joint y + 0.034: round, not epaulettes.
    ...pair(
      ell('armL', [0.197, 1.392, -0.024], [0.046, 0.074, 0.056], 0.03, A, {
        rot: [0, 0, 6],
        w0: { armL: 0.6, shoulderL: 0.4 },
        w1: { shoulderL: 0.45, armL: 0.35, chest: 0.2 },
        t0: 0.25,
        t1: 1,
        grp: 'delt',
      }),
    ),
    ...pair(
      cone('armL', [0.19, 1.43, -0.025], [0.19, 1.15, -0.025], 0.042, 0.036, 0.02, A, {
        w0: { armL: 0.85, shoulderL: 0.15 },
        w1: { armL: 0.5, forearmL: 0.5 },
        t0: 0.72,
        t1: 1,
        grp: 'arm',
      }),
    ),
    ...pair(ell('armL', [0.19, 1.258, -0.002], [0.039, 0.088, 0.04], 0.022, A, { w: { armL: 1 }, grp: 'arm' })),
    ...pair(ell('armL', [0.193, 1.29, -0.054], [0.044, 0.11, 0.037], 0.022, A, { w: { armL: 1 }, grp: 'arm' })),
    ...pair(ell('armL', [0.19, 1.19, -0.022], [0.04, 0.05, 0.034], 0.025, A, { w: { armL: 0.7, forearmL: 0.3 }, grp: 'arm' })),
    ...pair(ell('forearmL', [0.19, 1.135, -0.04], [0.033, 0.03, 0.03], 0.02, A, { w: { armL: 0.5, forearmL: 0.5 } })),
    ...pair(
      cone('forearmL', [0.19, 1.13, -0.025], [0.19, 0.89, -0.022], 0.043, 0.027, 0.02, A, {
        w0: { forearmL: 0.65, armL: 0.35 },
        w1: { forearmL: 0.6, handL: 0.4 },
        grp: 'fore',
      }),
    ),
    ...pair(ell('forearmL', [0.19, 1.078, -0.022], [0.043, 0.09, 0.039], 0.024, A, { w: { forearmL: 1 }, grp: 'fore' })),
    // Brachioradialis: the swell on the thumb side just below the elbow.
    ...pair(ell('forearmL', [0.193, 1.095, 0.006], [0.031, 0.058, 0.03], 0.022, A, { w: { forearmL: 0.85, armL: 0.15 }, grp: 'fore' })),
    ...hand(),
  ];
}

/** Wrist pivot the hand is scaled about. */
const WRIST: V3 = [0.19, 0.89, -0.022];

function hand(): Spec[] {
  const D = PART.hand;
  const w = { handL: 1 };
  // A thick, blocky palm (the palm faces -x on the left hand, the thumb is toward +z).
  const specs: Spec[] = [
    box('handL', [0.188, 0.828, -0.004], [0.0175, 0.045, 0.041], 0.015, 0.014, D, { w, grp: 'hand' }),
    ell('handL', [0.187, 0.83, -0.004], [0.02, 0.05, 0.045], 0.014, D, { w, grp: 'hand' }),
    // Heel of the palm and the thumb pad, so the hand reads as a strong mass.
    ell('handL', [0.178, 0.84, 0.02], [0.016, 0.03, 0.022], 0.012, D, { w, grp: 'hand' }),
  ];
  // Thick, slightly short fingers in a relaxed half curl toward the palm.
  // [z across the palm, radius, proximal, distal, curl]
  const fingers: Array<[number, number, number, number, number]> = [
    [0.025, 0.0112, 0.04, 0.03, 1.0],
    [0.006, 0.0118, 0.043, 0.033, 1.05],
    [-0.013, 0.0112, 0.041, 0.031, 1.1],
    [-0.03, 0.0099, 0.034, 0.026, 1.15],
  ];
  const knuckle = 0.786;
  const DEG = Math.PI / 180;
  for (const [z, r, lp, ld, curl] of fingers) {
    const a1 = 22 * DEG * curl;
    const a2 = 62 * DEG * curl;
    const a: V3 = [0.191, knuckle, z];
    const b: V3 = [a[0] - Math.sin(a1) * lp, knuckle - Math.cos(a1) * lp, z * 1.04];
    const c: V3 = [b[0] - Math.sin(a2) * ld, b[1] - Math.cos(a2) * ld, z * 1.06];
    specs.push(cone('handL', a, b, r, r * 0.97, 0.004, D, { w, grp: 'hand' }));
    specs.push(cone('handL', b, c, r * 0.97, r * 0.82, 0.004, D, { w, grp: 'hand' }));
  }
  // The thumb: its own clear mass, angled across the front of the fingers.
  const t: V3[] = [
    [0.18, 0.86, 0.026],
    [0.171, 0.824, 0.05],
    [0.16, 0.796, 0.058],
    [0.15, 0.778, 0.056],
  ];
  const tr = [0.0142, 0.0128, 0.0114, 0.0098];
  for (let i = 0; i < 3; i++) specs.push(cone('handL', t[i], t[i + 1], tr[i], tr[i + 1], i === 0 ? 0.008 : 0.004, D, { w, grp: 'hand' }));
  return specs.flatMap(pair);
}

/* --------------------------------------------------------------- legs ---- */

function legs(): Spec[] {
  const L = PART.leg;
  const F = PART.foot;
  return [
    ...pair(
      cone('thighL', [0.09, 0.93, 0.0], [0.09, 0.5, 0.005], 0.072, 0.052, 0.03, L, {
        w0: { hips: 0.4, thighL: 0.6 },
        w1: { thighL: 0.55, shinL: 0.45 },
        grp: 'thighTop',
      }),
    ),
    ...pair(
      ell('thighL', [0.096, 0.735, 0.026], [0.064, 0.17, 0.056], 0.03, L, {
        rot: [0, 0, -3],
        w0: { thighL: 0.85, shinL: 0.15 },
        w1: { thighL: 0.9, hips: 0.1 },
        grp: 'thigh',
      }),
    ),
    // Vastus lateralis: the outer quad sweep.
    ...pair(
      ell('thighL', [0.126, 0.7, 0.014], [0.032, 0.15, 0.046], 0.03, L, {
        rot: [0, 0, -4],
        w0: { thighL: 0.85, shinL: 0.15 },
        w1: { thighL: 0.9, hips: 0.1 },
        grp: 'thigh',
      }),
    ),
    ...pair(ell('thighL', [0.068, 0.566, 0.032], [0.033, 0.06, 0.036], 0.02, L, { w: { thighL: 0.8, shinL: 0.2 }, grp: 'thigh' })),
    ...pair(
      ell('thighL', [0.09, 0.74, -0.036], [0.058, 0.155, 0.05], 0.03, L, {
        w0: { thighL: 0.8, shinL: 0.2 },
        w1: { thighL: 0.85, hips: 0.15 },
        grp: 'thigh',
      }),
    ),
    ...pair(ell('thighL', [0.055, 0.8, -0.008], [0.05, 0.11, 0.06], 0.03, L, { w: { thighL: 0.85, hips: 0.15 }, grp: 'thigh' })),
    ...pair(ell('shinL', [0.09, 0.49, 0.008], [0.048, 0.048, 0.046], 0.02, L, { w: { thighL: 0.5, shinL: 0.5 } })),
    ...pair(ell('shinL', [0.09, 0.505, 0.042], [0.024, 0.03, 0.014], 0.015, L, { w: { thighL: 0.35, shinL: 0.65 } })),
    ...pair(
      cone('shinL', [0.09, 0.48, 0.0], [0.09, 0.12, -0.008], 0.048, 0.032, 0.02, L, {
        w0: { shinL: 0.85, thighL: 0.15 },
        w1: { shinL: 0.7, footL: 0.3 },
        grp: 'calf',
      }),
    ),
    ...pair(ell('shinL', [0.106, 0.395, -0.034], [0.04, 0.1, 0.044], 0.025, L, { w: { shinL: 1 }, grp: 'calf' })),
    ...pair(ell('shinL', [0.072, 0.38, -0.034], [0.043, 0.105, 0.047], 0.025, L, { w: { shinL: 1 }, grp: 'calf' })),
    ...pair(ell('shinL', [0.09, 0.29, -0.03], [0.044, 0.09, 0.034], 0.03, L, { w: { shinL: 1 }, grp: 'calf' })),
    // Wrestling shoe: collar, heel, instep, toe box and two sole pads.
    ...pair(
      cone('footL', [0.09, 0.075, -0.012], [0.09, 0.15, -0.01], 0.039, 0.035, 0.015, F, {
        w0: { footL: 0.6, shinL: 0.4 },
        w1: { shinL: 0.85, footL: 0.15 },
        grp: 'shoe',
      }),
    ),
    ...pair(ell('footL', [0.09, 0.045, -0.022], [0.033, 0.042, 0.043], 0.02, F, { w: { footL: 1 }, grp: 'shoe' })),
    ...pair(
      ell('footL', [0.09, 0.05, 0.05], [0.039, 0.042, 0.072], 0.02, F, {
        axis: 2,
        w0: { footL: 1 },
        w1: { footL: 0.6, toeL: 0.4 },
        t0: 0.55,
        t1: 1,
        grp: 'shoe',
      }),
    ),
    ...pair(ell('toeL', [0.088, 0.03, 0.152], [0.037, 0.024, 0.06], 0.02, F, { w: { toeL: 1 }, grp: 'shoe' })),
    ...pair(ell('footL', [0.09, 0.007, -0.03], [0.032, 0.007, 0.042], 0.012, F, { w: { footL: 1 }, grp: 'shoe' })),
    ...pair(
      ell('footL', [0.089, 0.008, 0.115], [0.044, 0.008, 0.09], 0.012, F, {
        axis: 2,
        w0: { footL: 1 },
        w1: { toeL: 1 },
        t0: 0.3,
        t1: 0.6,
        grp: 'shoe',
      }),
    ),
  ];
}

/* ---------------------------------------------------------- bind pose ---- */

export interface BindPose {
  pos: Record<BoneName, V3>;
  rot: Record<BoneName, M3>;
  rest: Record<BoneName, V3>;
}

export function bindPose(scale: number): BindPose {
  const rest = restPositions(scale);
  const pos = {} as Record<BoneName, V3>;
  const rot = {} as Record<BoneName, M3>;
  for (const b of BONES) {
    const e = BIND_POSE[b.name];
    const local = e ? m3FromEuler(e[0], e[1], e[2]) : m3Identity();
    if (!b.parent) {
      pos[b.name] = [b.offset[0] * scale, b.offset[1] * scale, b.offset[2] * scale];
      rot[b.name] = local;
      continue;
    }
    const pr = rot[b.parent];
    const pp = pos[b.parent];
    const o = m3Apply(pr, [b.offset[0] * scale, b.offset[1] * scale, b.offset[2] * scale]);
    pos[b.name] = [pp[0] + o[0], pp[1] + o[1], pp[2] + o[2]];
    rot[b.name] = m3Mul(pr, local);
  }
  return { pos, rot, rest };
}

/* ------------------------------------------------------------ compile ---- */

/** The head grows about this point (just under the jaw), so a bigger head grows up and out. */
export const HEAD_PIVOT: V3 = [0, 1.56, 0.0];

function groupGirth(g: Group | undefined, s: ToonShape): number {
  switch (g) {
    case 'torso':
      return 1;
    case 'lat':
      return s.lats;
    case 'waist':
      return s.waist;
    case 'hips':
      return s.hips;
    case 'glute':
      return s.glute;
    case 'neck':
      return s.neck;
    case 'trap':
      return s.traps;
    case 'delt':
      return s.delts;
    case 'arm':
      return s.arm;
    case 'fore':
      return s.forearm;
    case 'thigh':
      return s.thigh;
    case 'thighTop':
      // The thigh's core cone grows less than the muscles on it, so heavy legs
      // bulk up through the quads instead of widening the hips into a rectangle.
      return 1 + (s.thigh - 1) * 0.2;
    case 'calf':
      return s.calf;
    default:
      return 1;
  }
}

function toPrim(spec: Spec, shape: ToonShape, bind: BindPose, isHead: boolean): Prim {
  const p = new Prim();
  const sc = shape.scale;
  const g = groupGirth(spec.grp, shape);
  const torsoLike =
    spec.grp === 'torso' || spec.grp === 'lat' || spec.grp === 'core' || spec.grp === 'waist' || spec.grp === 'trap' || spec.grp === 'hips';
  // Torso width/depth stylisation moves centres too, so masses stay attached.
  const wx = torsoLike ? (spec.grp === 'waist' || spec.grp === 'core' || spec.grp === 'hips' ? Math.sqrt(shape.chestW) : shape.chestW) : 1;
  const wz = torsoLike ? shape.chestD : 1;

  let s = spec;
  // Pre-transform in canonical space: head scaling about the pivot, hand about the wrist.
  const pre = (v: V3): V3 => {
    let o: V3 = v;
    if (isHead) {
      const hs = shape.head;
      o = [
        HEAD_PIVOT[0] + (o[0] - HEAD_PIVOT[0]) * hs + shape.headShift[0],
        HEAD_PIVOT[1] + (o[1] - HEAD_PIVOT[1]) * hs + shape.headShift[1],
        HEAD_PIVOT[2] + (o[2] - HEAD_PIVOT[2]) * hs + shape.headShift[2],
      ];
    } else if (spec.grp === 'hand') {
      const hs = shape.hand;
      const wr: V3 = [WRIST[0] * Math.sign(v[0] || 1), WRIST[1], WRIST[2]];
      o = [wr[0] + (o[0] - wr[0]) * hs, wr[1] + (o[1] - wr[1]) * hs, wr[2] + (o[2] - wr[2]) * hs];
    } else if (torsoLike) {
      o = [o[0] * wx, o[1], o[2] * wz];
    } else if (spec.grp === 'delt') {
      o = [o[0] + Math.sign(o[0]) * shape.deltX, o[1], o[2]];
    }
    return o;
  };
  const rs = isHead ? shape.head : spec.grp === 'hand' ? shape.hand : 1;
  s = { ...s, a: s.a && pre(s.a), b: s.b && pre(s.b), c: s.c && pre(s.c), clip: s.clip && { ...s.clip, c: pre(s.clip.c), k: s.clip.k * rs } };

  const restOrigin = bind.rest[s.bone];
  const bp = bind.pos[s.bone];
  const br = bind.rot[s.bone];
  const xf = (v: V3): V3 => {
    const local: V3 = [v[0] * sc - restOrigin[0], v[1] * sc - restOrigin[1], v[2] * sc - restOrigin[2]];
    const w = m3Apply(br, local);
    return [bp[0] + w[0], bp[1] + w[1], bp[2] + w[2]];
  };

  p.kind = s.kind;
  p.k = s.k * sc * rs;
  p.sub = !!s.sub;
  p.part = s.part;
  p.claim = s.claim ?? 1;
  p.noise = (s.noise ?? 0) * sc;

  if (s.kind === Kind.Cone) {
    const a = xf(s.a!);
    const b = xf(s.b!);
    [p.ax, p.ay, p.az] = a;
    [p.bx, p.by, p.bz] = b;
    const rg = g * rs * (torsoLike ? Math.sqrt(wx) : 1);
    p.ra = s.ra! * sc * rg;
    p.rb = s.rb! * sc * rg;
    p.bcx = (a[0] + b[0]) / 2;
    p.bcy = (a[1] + b[1]) / 2;
    p.bcz = (a[2] + b[2]) / 2;
    p.brad = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2 + Math.max(p.ra, p.rb);
  } else {
    const c = xf(s.c!);
    [p.cx, p.cy, p.cz] = c;
    const r = s.r!;
    const gy = s.kind === Kind.Ellipsoid ? Math.sqrt(g) : 1;
    p.rx = r[0] * sc * g * rs * wx;
    p.ry = r[1] * sc * gy * rs;
    p.rz = r[2] * sc * g * rs * wz;
    p.round = (s.round ?? 0) * sc * rs;
    const local = s.rot ? m3FromEuler(s.rot[0], s.rot[1], s.rot[2]) : m3Identity();
    p.m = m3Mul(br, local);
    p.axis = s.axis ?? (p.ry >= p.rx && p.ry >= p.rz ? 1 : p.rx >= p.rz ? 0 : 2);
    p.bcx = c[0];
    p.bcy = c[1];
    p.bcz = c[2];
    p.brad = Math.max(p.rx, p.ry, p.rz) * 1.05 + p.noise;
  }

  if (s.clip) p.clip = { c: xf(s.clip.c), n: m3Apply(br, s.clip.n), k: s.clip.k * sc };
  p.late = !!s.late;

  const fill = (dst: Float32Array, src: Weights) => {
    let sum = 0;
    for (const v of Object.values(src)) sum += v ?? 0;
    for (const [name, v] of Object.entries(src)) dst[BONE_INDEX[name as BoneName]] = (v ?? 0) / (sum || 1);
  };
  const constant: Weights = s.w ?? { [s.bone]: 1 };
  fill(p.w0, s.w0 ?? constant);
  fill(p.w1, s.w1 ?? s.w0 ?? constant);
  p.t0 = s.t0 ?? 0;
  p.t1 = s.t1 ?? 1;
  return p;
}

export function buildToonPrims(shape: ToonShape): { prims: Prim[]; bind: BindPose } {
  const bind = bindPose(shape.scale);
  const body = [...torso(), ...neck(), ...arms(), ...legs()].map((s) => toPrim(s, shape, bind, false));
  const hd = head(shape.face, shape.hair).map((s) => toPrim(s, shape, bind, true));
  const prims = [...body, ...hd];
  const order = (p: Prim) => (p.late ? 2 : p.sub ? 1 : 0);
  prims.sort((a, b) => order(a) - order(b));
  return { prims, bind };
}

/** Canonical -> bind-space transform for a head-space point (used by the headgear). */
export function headPoint(v: V3, shape: ToonShape): V3 {
  const hs = shape.head;
  const sc = shape.scale;
  return [
    (HEAD_PIVOT[0] + (v[0] - HEAD_PIVOT[0]) * hs + shape.headShift[0]) * sc,
    (HEAD_PIVOT[1] + (v[1] - HEAD_PIVOT[1]) * hs + shape.headShift[1]) * sc,
    (HEAD_PIVOT[2] + (v[2] - HEAD_PIVOT[2]) * hs + shape.headShift[2]) * sc,
  ];
}
