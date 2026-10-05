import { BIND_POSE, BONES, BONE_INDEX, MIRROR, restPositions } from '../skeleton';
import type { BoneName } from '../skeleton';
import { m3Apply, m3FromEuler, m3Identity, m3Mul } from '../math';
import type { M3, V3 } from '../math';
import { Kind, Prim } from '../sdf';
import type { Part } from '../sdf';
import type { PrimX } from './sdf';

/**
 * Broadcast-realism anatomy.
 *
 * Same sculptor's method as the game's src/body/anatomy.ts (a core per segment,
 * then the muscle masses), on the same skeleton, but re-proportioned against real
 * anthropometry for a 165 lb college wrestler: a sloped trapezius line instead of
 * a shrug, deltoids that wrap the joint instead of perching on it, a V-taper that
 * is widest at the armpit, thick obliques instead of a pinched waist, conical
 * thighs, real calves, 19 cm hands and a believable wrestling shoe. The head is
 * rebuilt around a full braincase with per-athlete face parameters, so two real
 * people can be told apart.
 *
 * All coordinates are rest-pose metres for the canonical 1.76 m body (+Y up,
 * facing +Z, +X the athlete's left), then scaled and moved into the A-pose.
 */

/** Part ids painted by the material. The first seven match src/body/sdf.ts. */
export const PART = {
  Torso: 0,
  Head: 1,
  Arm: 2,
  Hand: 3,
  Leg: 4,
  Foot: 5,
  Hair: 6,
  Ear: 7,
  Lip: 8,
  Lid: 9,
} as const;

export type HairCut = 'crop' | 'swept' | 'buzz';

/** Facial structure, offsets in metres from a neutral, well-proportioned male face. */
export interface FaceParams {
  /** Gonial (jaw angle) half-width offset. + = squarer, wider jaw. */
  jaw: number;
  /** Chin projection forward. */
  chin: number;
  /** Chin width multiplier (1 = neutral). */
  chinW: number;
  /** Lower face length: + drops the chin and jaw line. */
  faceLen: number;
  /** Nose length: + longer bridge, lower tip. */
  nose: number;
  /** Alar width offset. */
  noseW: number;
  /** Brow ridge projection / heaviness. */
  brow: number;
  /** Cheekbone half-width offset. */
  cheek: number;
  /** Hollow under the cheekbones, 0..1 (lean faces). */
  hollow: number;
  /** Lip fullness multiplier. */
  lips: number;
  /** Cauliflower ear amount, 0..1. */
  cauli: number;
  /** Mouth-corner lift, matches the paint. */
  smile: number;
  /** Eye aperture height multiplier (1 = 9.8 mm). */
  eyeOpen?: number;
}

/** Body frame, multipliers on the neutral build. */
export interface FrameParams {
  neck: number;
  traps: number;
  /** Shoulder girdle and ribcage width. */
  torsoW: number;
  torsoD: number;
  /** Limb girth. */
  limb: number;
  delt: number;
  /** Pelvis and thigh mass. */
  hips: number;
  /** Head size multiplier about HEAD_PIVOT (head-to-height ratio). */
  head: number;
}

export interface BodyParams {
  /** Height / 1.76. */
  scale: number;
  /** 0 = lean, 1 = heavy. Mostly drives muscle mass. */
  mass: number;
  hair: HairCut;
  /** Height of the front hairline plane (canonical metres; lower = fuller hairline). */
  hairFront: number;
  face: FaceParams;
  frame: FrameParams;
}

export const NEUTRAL_FACE: FaceParams = {
  jaw: 0,
  chin: 0,
  chinW: 1,
  faceLen: 0,
  nose: 0,
  noseW: 0,
  brow: 0,
  cheek: 0,
  hollow: 0,
  lips: 1,
  cauli: 0,
  smile: 0.5,
};

export const NEUTRAL_FRAME: FrameParams = { neck: 1, traps: 1, torsoW: 1, torsoD: 1, limb: 1, delt: 1, hips: 1, head: 1 };

type Weights = Partial<Record<BoneName, number>>;

interface PlaneSpec {
  c: V3;
  n: V3;
  k: number;
  /** Bend-away height and rate (see sdf.ts Plane). */
  fy?: number;
  fk?: number;
}

/** Clip plane through three points, its outside facing away from `inside`. */
function plane3(a: V3, b: V3, c: V3, inside: V3, k: number): PlaneSpec {
  const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  n = [n[0] / l, n[1] / l, n[2] / l];
  if (n[0] * (inside[0] - a[0]) + n[1] * (inside[1] - a[1]) + n[2] * (inside[2] - a[2]) > 0) n = [-n[0], -n[1], -n[2]];
  return { c: a, n, k };
}

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
  part: number;
  /** Muscle masses scale with build; cores barely do. */
  muscle?: boolean;
  /** Extra girth multiplier (frame). */
  g?: number;
  clip?: { c: V3; n: V3; k: number };
  /** Ellipsoid carved from this primitive alone (see sdf.ts). */
  cut?: { c: V3; r: V3; rot?: V3; k: number };
  /** Extra clip half-spaces for this primitive alone (crisp jaw lines). */
  planes?: PlaneSpec[];
  noise?: number;
  claim?: number;
  late?: boolean;
}

const cone = (bone: BoneName, a: V3, b: V3, ra: number, rb: number, k: number, part: number, extra: Partial<Spec> = {}): Spec => ({
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

const ell = (bone: BoneName, c: V3, r: V3, k: number, part: number, extra: Partial<Spec> = {}): Spec => ({
  bone,
  kind: Kind.Ellipsoid,
  c,
  r,
  k,
  part,
  ...extra,
});

const box = (bone: BoneName, c: V3, h: V3, round: number, k: number, part: number, extra: Partial<Spec> = {}): Spec => ({
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
    cut: s.cut && { c: mirrorV(s.cut.c), r: s.cut.r, rot: s.cut.rot && [s.cut.rot[0], -s.cut.rot[1], -s.cut.rot[2]], k: s.cut.k },
    planes: s.planes && s.planes.map((q) => ({ ...q, c: mirrorV(q.c), n: mirrorV(q.n) })),
  };
}

const pair = (s: Spec): Spec[] => [s, mirror(s)];

/* ------------------------------------------------------------- the body --- */

function torso(f: FrameParams): Spec[] {
  const T = PART.Torso;
  const W = f.torsoW;
  const D = f.torsoD;
  const H = f.hips;
  return [
    // Pelvis.
    ell('hips', [0, 0.955, -0.012], [0.138 * H, 0.105, 0.1 * D], 0.03, T, { w: { hips: 1 } }),
    // Glutes: full but tied into the hamstrings, not a shelf.
    ...pair(
      ell('hips', [0.068, 0.912, -0.066], [0.072 * H, 0.088, 0.046 * H * H], 0.045, T, {
        rot: [18, 0, 0],
        w: { hips: 0.7, thighL: 0.3 },
        muscle: true,
      }),
    ),
    // Gusset, so the crotch bridges smoothly under the singlet.
    ell('hips', [0, 0.862, -0.008], [0.03, 0.026, 0.05], 0.035, T, { w: { hips: 0.8, thighL: 0.1, thighR: 0.1 } }),
    // Lower belly, flat.
    ell('hips', [0, 1.02, 0.002], [0.132 * W, 0.08, 0.083 * D], 0.04, T, { w: { hips: 0.55, spine: 0.45 } }),
    // Waist: wide through the obliques, shallow front to back.
    ell('spine', [0, 1.09, -0.014], [0.142 * W, 0.1, 0.088 * D], 0.04, T, { w: { spine: 0.85, hips: 0.15 } }),
    ...pair(
      ell('spine', [0.1 * W, 1.09, 0.0], [0.034, 0.085, 0.066 * D], 0.035, T, {
        w: { hips: 0.5, spine: 0.5 },
        muscle: true,
      }),
    ),
    // Rectus abdominis.
    ell('spine', [0, 1.15, 0.03 * D], [0.09 * W, 0.12, 0.06], 0.03, T, {
      w0: { spine: 0.85, hips: 0.15 },
      w1: { spine: 0.45, chest: 0.55 },
      muscle: true,
    }),
    // Ribcage.
    ell('chest', [0, 1.262, -0.016], [0.14 * W, 0.15, 0.099 * D], 0.045, T, {
      w0: { spine: 0.65, chest: 0.35 },
      w1: { chest: 1 },
    }),
    // Upper chest, widest at the armpits.
    ell('chest', [0, 1.358, -0.012], [0.158 * W, 0.094, 0.104 * D], 0.04, T, { w: { chest: 1 } }),
    // Pectorals: flat plates tied into the armpit.
    ...pair(
      ell('chest', [0.074 * W, 1.346, 0.071 * D], [0.09 * W, 0.065, 0.029], 0.03, T, {
        rot: [-8, 20, -14],
        w: { chest: 0.86, shoulderL: 0.14 },
        muscle: true,
      }),
    ),
    // Lower chest wall under the pecs (costal margin and serratus): it carries the
    // pec's lower edge down into the abs so the profile has no undercut and the
    // singlet bridges instead of tucking.
    ...pair(
      ell('chest', [0.058 * W, 1.272, 0.042 * D], [0.07 * W, 0.05, 0.042 * D], 0.045, T, {
        w0: { spine: 0.3, chest: 0.7 },
        w1: { chest: 1 },
      }),
    ),
    // Axillary tie-in under the pec.
    ...pair(
      ell('chest', [0.13 * W, 1.355, 0.012], [0.032, 0.05, 0.05], 0.03, T, {
        w: { chest: 0.78, shoulderL: 0.22 },
        muscle: true,
      }),
    ),
    // Lats: long axis leaning out at the top, the real V.
    ...pair(
      ell('chest', [0.114 * W, 1.29, -0.042], [0.057 * W, 0.13, 0.062 * D], 0.036, T, {
        rot: [0, 0, -16],
        w0: { chest: 0.7, spine: 0.3 },
        w1: { chest: 0.8, shoulderL: 0.2 },
        muscle: true,
      }),
    ),
    // Trapezius: slopes from the neck to the acromion.
    ...pair(
      // Heavier traps thicken down and out, never up the neck past y 1.53.
      cone('chest', [0.036, 1.49 - (f.traps - 1) * 0.012, -0.046], [0.15 * W, 1.448, -0.034], 0.044 * (1 + (f.traps - 1) * 0.35), 0.028 * (1 + (f.traps - 1) * 0.6), 0.038, T, {
        w0: { neck: 0.4, chest: 0.6 },
        w1: { chest: 0.55, shoulderL: 0.45 },
        muscle: true,
      }),
    ),
    // Upper trapezius belly: the wrestler's yoke, so the neck-to-shoulder line
    // runs out at 15-20 degrees instead of dropping off the neck.
    ...pair(
      ell('chest', [0.082 * W, 1.478, -0.044], [0.05 * W, 0.03 * f.traps, 0.034 * f.traps], 0.035, T, {
        rot: [0, 0, -20],
        w0: { neck: 0.3, chest: 0.7 },
        w1: { chest: 0.6, shoulderL: 0.4 },
        axis: 0,
        muscle: true,
      }),
    ),
    // Sternum between the pecs, so the chest is one plate, not two mounds with
    // a valley (that valley shadowed the singlet's wordmark).
    ell('chest', [0, 1.33, 0.07 * D], [0.03 * W, 0.06, 0.03], 0.03, T, { w: { chest: 1 } }),
    // Mid-trap / rhomboid mass.
    ell('chest', [0, 1.33, -0.066 * D], [0.112 * W, 0.11, 0.054], 0.04, T, { w: { chest: 1 } }),
    // Paired erectors leave a groove down the spine.
    ...pair(
      ell('spine', [0.032, 1.11, -0.062 * D], [0.032, 0.12, 0.035], 0.03, T, {
        w0: { hips: 0.55, spine: 0.45 },
        w1: { spine: 0.6, chest: 0.4 },
        muscle: true,
      }),
    ),
    // Acromion and the top of the shoulder: carries the trap's slope over into
    // the deltoid cap so the shoulder is one rounded line, not a bar and a ball.
    ...pair(
      ell('shoulderL', [0.163 * W, 1.438, -0.022], [0.04 * W, 0.022, 0.038], 0.032, T, {
        rot: [0, 0, -14],
        w0: { chest: 0.5, shoulderL: 0.5 },
        w1: { shoulderL: 0.85, armL: 0.15 },
        axis: 0,
        muscle: true,
      }),
    ),
    // Clavicles.
    ...pair(
      cone('shoulderL', [0.03, 1.451, 0.036], [0.168 * W, 1.446, 0.004], 0.018, 0.021, 0.02, T, {
        w0: { chest: 0.65, shoulderL: 0.35 },
        w1: { shoulderL: 0.85, chest: 0.15 },
      }),
    ),
    // Scapulae.
    ...pair(
      ell('chest', [0.098 * W, 1.355, -0.074 * D], [0.058, 0.074, 0.03], 0.03, T, {
        rot: [0, 20, 0],
        w: { chest: 0.55, shoulderL: 0.45 },
      }),
    ),
  ];
}

/** Eyeball centre depth (canonical); the eye meshes sit here. */
export const EYE_Z = 0.0858;

/** Rest-space point the head scales about (the jaw/neck junction). */
export const HEAD_PIVOT: V3 = [0, 1.6, -0.01];

/** Canonical (unscaled-head) coordinates of a canonical rest-space point on the head. */
export function headUnscale(x: number, y: number, z: number, hs: number): V3 {
  return [HEAD_PIVOT[0] + (x - HEAD_PIVOT[0]) / hs, HEAD_PIVOT[1] + (y - HEAD_PIVOT[1]) / hs, HEAD_PIVOT[2] + (z - HEAD_PIVOT[2]) / hs];
}

/** Lower neck: a thick column that blends broadly into the traps. Built before the head. */
function neckBase(frame: FrameParams): Spec[] {
  const T = PART.Torso;
  const N = frame.neck;
  return [
    cone('neck', [0, 1.43, -0.03], [0, 1.54, -0.024], 0.06 * N, 0.051 * N, 0.04, T, {
      w0: { chest: 0.35, neck: 0.65 },
      w1: { neck: 1 },
      t0: 0.15,
      t1: 0.9,
    }),
    // Sternocleidomastoids, lower half, from the sternal notch.
    ...pair(
      cone('neck', [0.02, 1.462, 0.038], [0.04, 1.535, 0.004], 0.017 * N, 0.016 * N, 0.022, T, {
        w0: { neck: 0.8, chest: 0.2 },
        w1: { neck: 1 },
        muscle: true,
      }),
    ),
    // Thyroid cartilage.
    ell('neck', [0, 1.512, 0.03], [0.0075, 0.011, 0.008], 0.014, T, { w: { neck: 1 } }),
    // Nape.
    ell('neck', [0, 1.52, -0.052], [0.05 * N, 0.05, 0.03], 0.03, T, { w: { neck: 1 } }),
  ];
}

/**
 * Upper neck, unioned after the head with a small blend so the jaw line and the
 * occipital ridge stay crisp: the head sits on the neck rather than melting into it.
 */
function neckTop(frame: FrameParams): Spec[] {
  const T = PART.Torso;
  const N = frame.neck;
  const nw = { w0: { neck: 1 }, w1: { neck: 0.25, head: 0.75 }, t0: 0.35, t1: 0.95 };
  return [
    cone('neck', [0, 1.495, -0.025], [0, 1.6, -0.024], 0.0505 * N, 0.043 * N, 0.012, T, nw),
    ...pair(
      cone('neck', [0.036, 1.515, 0.008], [0.044, 1.596, -0.026], 0.0158 * N, 0.013 * N, 0.012, T, {
        w0: { neck: 1 },
        w1: { neck: 0.3, head: 0.7 },
        muscle: true,
      }),
    ),
    ell('neck', [0, 1.56, -0.05], [0.046 * N, 0.04, 0.03], 0.014, T, { w0: { neck: 1 }, w1: { neck: 0.4, head: 0.6 } }),
  ];
}

function head(face: FaceParams, hair: HairCut, hairFront: number): Spec[] {
  const H = PART.Head;
  const hw = { w: { head: 1 } };
  const F = face;
  const L = F.faceLen;
  const J = F.jaw;
  const C = F.chin;
  const CW = F.chinW;
  // Eyeball centre (radius 0.0119): the lids and sockets are built round it.
  const E: V3 = [0.032, 1.649, EYE_Z];
  // Skeletal landmarks of the lower face. The jaw is built like a sculptor's
  // block-in: one solid for the face, cut by the planes of the mandible, so the
  // jaw line runs as one clean edge from the ear to the chin.
  const gon: V3 = [0.056 + J, 1.566 - L * 0.5 - Math.max(0, J), -0.009];
  const gonR: V3 = [-gon[0], gon[1], gon[2]];
  const men: V3 = [0, 1.532 - L, 0.079 + C];
  const chinC: V3 = [0.02 * CW, 1.537 - L, 0.08 + C];
  const zyg: V3 = [0.066 + F.cheek + J * 0.6, 1.622, 0.026];
  const inner: V3 = [0, 1.6, 0.02];
  const under = plane3(gon, gonR, men, inner, 0.007);
  // Masseter plane: the side of the face from the cheekbone to the jaw angle.
  const massL = plane3(gon, zyg, [gon[0] - 0.003, gon[1] + 0.004, 0.035], inner, 0.03);
  const mirP = (q: PlaneSpec): PlaneSpec => ({ ...q, c: mirrorV(q.c), n: mirrorV(q.n) });
  // Mandible body: trims the lower front corner of the block (the jowl), so the
  // jaw narrows from the angle to the chin while the cheek above stays full.
  const bodyL0 = plane3(gon, chinC, [0.05 + J * 0.5, 1.61, 0.06], inner, 0.02);
  // Set 3 mm inside the landmarks: the smooth unions round it back out.
  // It bends away above the mouth corners, so it trims the jowl but never the cheek.
  const bodyL: PlaneSpec = {
    ...bodyL0,
    c: [bodyL0.c[0] - bodyL0.n[0] * 0.003, bodyL0.c[1] - bodyL0.n[1] * 0.003, bodyL0.c[2] - bodyL0.n[2] * 0.003],
    fy: 1.597 - L * 0.4,
    fk: 0.6,
  };
  const sideL = massL;
  const sideR = mirP(massL);
  // Back of the ramus, from the jaw angle up to the joint in front of the ear.
  const ramus = plane3(gon, gonR, [0, 1.634, 0.0], [0, 1.6, 0.04], 0.01);
  const specs: Spec[] = [
    // Braincase: a wide parietal vault, a near-vertical forehead and the occiput.
    ell('head', [0, 1.675, -0.008], [0.0755, 0.088, 0.088], 0.02, H, hw),
    ell('head', [0, 1.704, -0.018], [0.071, 0.058, 0.079], 0.02, H, hw),
    ell('head', [0, 1.697, 0.042], [0.06, 0.054, 0.056], 0.03, H, hw),
    ell('head', [0, 1.646, -0.053], [0.062, 0.052, 0.046], 0.025, H, hw),
    // Temples.
    ...pair(ell('head', [0.051, 1.668, 0.026], [0.015, 0.028, 0.03], 0.03, H, hw)),
    // The face block: maxilla and mandible as one solid, trimmed by the
    // underside of the jaw, the two jaw planes and the back of the ramus.
    ell('head', [0, 1.6 - L * 0.5, 0.02], [0.068 + F.cheek * 0.5, 0.084 + L * 0.5, 0.08], 0.017, H, {
      ...hw,
      planes: [under, sideL, sideR, bodyL, mirP(bodyL), ramus],
    }),
    // Midface under the eyes, to the nose.
    ell('head', [0, 1.628, 0.046], [0.05, 0.034, 0.054], 0.02, H, hw),
    // Infraorbital cheek under each eye.
    ...pair(ell('head', [0.031, 1.626, 0.072], [0.02, 0.0135, 0.019], 0.02, H, { rot: [0, -20, 0], ...hw })),
    // Lateral orbital rim: joins the end of the brow to the cheekbone, so the
    // side of the eye socket is a ridge, not a groove.
    ...pair(ell('head', [0.0535, 1.651, 0.06], [0.0085, 0.021, 0.0125], 0.014, H, { rot: [0, -35, -8], ...hw })),
    // Malar fat pad: the soft front of the cheek between the eye, the nose wing
    // and the cheekbone, so the cheek is one full plane, never a groove.
    ...pair(ell('head', [0.034, 1.616 + F.smile * 0.0006, 0.066 + F.smile * 0.0004], [0.018, 0.02, 0.02], 0.022, H, { rot: [0, -25, 0], ...hw })),
    // Buccal fill over the masseter: a young athlete's cheek is full between the
    // cheekbone and the jaw, trimmed by the same jaw planes so it never sags.
    ...pair(ell('head', [0.05 + J * 0.5, 1.598, 0.036], [0.013, 0.026, 0.027], 0.024, H, { ...hw, planes: [massL, bodyL] })),
    // Lower cheek beside the mouth (over the buccinator), filled out to the jaw
    // plane so the side of the lower face is flat-to-convex, never a crease.
    ...pair(ell('head', [0.036 + J * 0.4, 1.587 - L * 0.4, 0.058], [0.017, 0.024, 0.021], 0.02, H, { rot: [0, -20, 0], ...hw, planes: [bodyL] })),
    // Cheekbones (zygoma body) and the arch back to the ear: the widest point of the face.
    ...pair(ell('head', [0.044 + F.cheek, 1.629, 0.058], [0.015, 0.0165, 0.02], 0.022, H, { rot: [0, -40, 0], ...hw })),
    ...pair(cone('head', [0.057 + F.cheek, 1.633, 0.042], [0.061, 1.636, 0.006], 0.0062, 0.005, 0.014, H, hw)),
    // Mouth barrel over the teeth: a narrow, rounded front so the mouth corners
    // sit back (no muzzle).
    ell('head', [0, 1.588 - L * 0.4, 0.056], [0.03, 0.03, 0.043], 0.02, H, { ...hw, planes: [under, bodyL, mirP(bodyL)] }),
    // Chin: a flat-fronted mental eminence on the jaw's underside plane.
    ell('head', [0, 1.55 - L, 0.082 + C], [0.0185 * CW, 0.017, 0.0165], 0.014, H, { ...hw, planes: [under] }),
    // Mentalis: fills the fold under the lower lip.
    ell('head', [0, 1.5655 - L * 0.7, 0.083 + C * 0.6], [0.016, 0.0095, 0.012], 0.014, H, hw),
    // Parotid fill behind the ramus, so the jaw sits on the neck.
    ...pair(ell('head', [0.044, 1.612, -0.018], [0.016, 0.02, 0.02], 0.016, H, hw)),
    // Brow ridge and glabella, leaving a shallow nasion dip.
    ...pair(
      cone(
        'head',
        [0.008, 1.6715 - F.brow * 0.3, 0.0945 + F.brow],
        [0.047, 1.6735 - F.brow * 0.3, 0.0845 + F.brow * 0.6],
        0.0115 + F.brow * 0.3,
        0.009 + F.brow * 0.2,
        0.022,
        H,
        hw,
      ),
    ),
    ell('head', [0, 1.668, 0.0945 + F.brow * 0.6], [0.0125, 0.0085, 0.0095], 0.01, H, hw),
    // Nose: bridge, tip, alae. An adult nose: a real bridge and a defined tip.
    cone('head', [0, 1.6535, 0.0978], [0, 1.6195 - F.nose, 0.1185 + F.nose * 0.3], 0.0074 + F.noseW * 0.3, 0.0094 + F.noseW * 0.4, 0.012, H, hw),
    // Nasal bones: the bridge stands clear of the eyes, as an adult's does.
    cone('head', [0, 1.66, 0.096], [0, 1.638, 0.1065], 0.0068 + F.noseW * 0.2, 0.0066 + F.noseW * 0.2, 0.008, H, hw),
    ell('head', [0, 1.6135 - F.nose, 0.1135 + F.nose * 0.3], [0.0118 + F.noseW * 0.4, 0.009, 0.011], 0.007, H, hw),
    ...pair(ell('head', [0.0118 + F.noseW, 1.608 - F.nose * 0.8, 0.0995], [0.0068, 0.0068, 0.0088], 0.009, H, hw)),
    // Upper lip skin: the philtrum slope from the nose base to the vermilion.
    ell('head', [0, 1.596 - L * 0.25, 0.086], [0.017, 0.0105, 0.0135], 0.012, H, hw),
    // Philtrum columns.
    ...pair(cone('head', [0.0042, 1.6035 - L * 0.25, 0.1003], [0.0052, 1.591 - L * 0.28, 0.1032], 0.002, 0.002, 0.004, H, hw)),
    // Upper vermilion in two halves meeting in a Cupid's bow: thin and firm.
    ...pair(
      ell('head', [0.0082, 1.5868 - L * 0.3, 0.0962], [0.0152, 0.0036 * F.lips, 0.0082], 0.0045, PART.Lip, {
        rot: [-6, 22, -4 + F.smile * 1.3],
        ...hw,
      }),
    ),
    // Lower vermilion, a little fuller, closed against the upper lip.
    ...pair(
      ell('head', [0.0068, 1.5775 - L * 0.4, 0.0955], [0.0142, 0.0046 * F.lips, 0.0085 * Math.sqrt(F.lips)], 0.005, PART.Lip, {
        rot: [4, 22, F.smile * 1.3],
        ...hw,
      }),
    ),
    // Nasolabial cheek, so a soft fold runs from the nose wing to the mouth corner.
    ...pair(ell('head', [0.026, 1.601, 0.07], [0.011, 0.018, 0.013], 0.018, H, { rot: [0, 20, -22], ...hw })),
    // Mouth corners: a small pit where the lips tuck into the cheek.
    ...pair(ell('head', [0.0236, 1.5815 - L * 0.35 + F.smile * 0.00055, 0.0875], [0.0018, 0.0022, 0.0024], 0.004, H, { sub: true, claim: 0 })),
    // The closed line between the lips: a hairline crease, not a gap.
    ...pair(
      ell('head', [0.0092, 1.5822 - L * 0.35, 0.1045], [0.0125, 0.0011, 0.0024], 0.0025, H, { rot: [0, 24, F.smile * 1.4], sub: true, claim: 0 }),
    ),
    // Eye sockets, carved; the lids are unioned after (late) into the hollow.
    ...pair(ell('head', [0.032, 1.6505, EYE_Z + 0.0102], [0.0158, 0.0108, 0.0115], 0.009, H, { sub: true, claim: 0 })),
    // Lids: one shell that hugs the eyeball, with an almond aperture carved
    // through it: about 30 x 10.5 mm, the upper margin 1 mm over the iris, the
    // lower margin at the iris edge, the outer corner a little higher.
    ...pair(
      ell('head', [E[0] + 0.0006, E[1] + 0.0003, E[2]], [0.0168, 0.014, 0.0139], 0.01, PART.Lid, {
        ...hw,
        late: true,
        cut: { c: [E[0] + 0.0007, E[1] - 0.0004, E[2] + 0.013], r: [0.0152, 0.0049 * (F.eyeOpen ?? 1), 0.0165], rot: [0, 0, 5], k: 0.0018 },
      }),
    ),
    // Brow fat pad over the upper lid: the soft hood that makes the lid fold.
    ...pair(ell('head', [E[0] + 0.002, E[1] + 0.0132, E[2] + 0.0088], [0.014, 0.0045, 0.0062], 0.006, H, { rot: [-20, 0, 8], ...hw })),
  ];

  specs.push(...ears(F.cauli));

  // Hair volume above the hairline (clip plane), short and textured.
  const hairline = { c: [0, hairFront, 0.07] as V3, n: [0, -0.5, 0.866] as V3, k: 0.01 };
  if (hair !== 'buzz') {
    const t = hair === 'swept' ? 0.009 : 0.006;
    specs.push(
      ell('head', [0, 1.708 + t * 0.4, -0.013 + t * 0.2], [0.0785 + t * 0.25, 0.06 + t, 0.082 + t * 0.6], 0.012, PART.Hair, {
        ...hw,
        clip: hairline,
        noise: 0.0014,
        claim: 0.7,
      }),
    );
  }
  return specs;
}

/**
 * Ears: a tilted disc for the auricle, a rolled helix rim, the lobe, and a carved
 * concha bowl. Cauliflower thickens and lumps the upper helix.
 */
function ears(cauli: number): Spec[] {
  const E = PART.Ear;
  const hw = { w: { head: 1 } };
  const specs: Spec[] = [];
  // Ear centre and its outward-facing tilt (ears flare back and out).
  const cx = 0.079;
  const cy = 1.638;
  const cz = -0.007;
  specs.push(ell('head', [cx, cy, cz], [0.008 + cauli * 0.002, 0.03, 0.018], 0.008, E, { rot: [-14, 22, 0], ...hw }));
  // Helix rim: an arc around the top and back.
  const rim: V3[] = [];
  for (let i = 0; i <= 7; i++) {
    const a = (-20 + i * 30) * (Math.PI / 180);
    // a sweeps from front-top over the top and down the back.
    const y = cy + 0.004 + Math.cos(a) * 0.028;
    const z = cz - 0.002 - Math.sin(a) * 0.017;
    rim.push([cx + 0.006 + Math.sin(a) * 0.002, y, z]);
  }
  for (let i = 0; i < rim.length - 1; i++) {
    const lump = cauli * (i >= 1 && i <= 3 ? 0.0028 : 0.001);
    specs.push(cone('head', rim[i], rim[i + 1], 0.0034 + lump, 0.0034 + lump, 0.003, E, hw));
  }
  // Lobe.
  specs.push(ell('head', [cx + 0.002, cy - 0.026, cz + 0.004], [0.006, 0.009, 0.008], 0.006, E, hw));
  // Tragus.
  specs.push(ell('head', [cx - 0.001, cy - 0.006, cz + 0.016], [0.004, 0.005, 0.004], 0.004, E, hw));
  if (cauli > 0) {
    specs.push(ell('head', [cx + 0.007, cy + 0.016, cz - 0.004], [0.004 * cauli + 0.001, 0.007, 0.006], 0.004, E, hw));
  }
  // Concha bowl, carved after the union.
  specs.push(
    ell('head', [cx + 0.0105, cy - 0.006 + cauli * 0.004, cz + 0.003], [0.0045, 0.011 - cauli * 0.004, 0.0075], 0.003, E, {
      sub: true,
      claim: 0,
    }),
  );
  // Scapha groove between rim and antihelix.
  specs.push(
    ell('head', [cx + 0.0105, cy + 0.014, cz - 0.004], [0.003, 0.009 * (1 - cauli * 0.6), 0.0055], 0.002, E, { sub: true, claim: 0 }),
  );
  return [...specs, ...specs.map(mirror)];
}

function arms(f: FrameParams): Spec[] {
  const A = PART.Arm;
  const D = PART.Hand;
  const G = f.limb;
  return [
    // Deltoid: wraps the joint; lateral surface held within joint + 5 cm.
    ...pair(
      ell('armL', [0.195, 1.384, -0.024], [0.045 * f.delt, 0.084, 0.057 * f.delt], 0.045, A, {
        rot: [0, 0, 8],
        w0: { armL: 0.92, shoulderL: 0.08 },
        w1: { shoulderL: 0.5, armL: 0.42, chest: 0.08 },
        t0: 0.25,
        t1: 1,
        muscle: true,
      }),
    ),
    // Humerus core.
    ...pair(
      cone('armL', [0.19, 1.43, -0.025], [0.19, 1.15, -0.025], 0.042 * G, 0.036 * G, 0.02, A, {
        w0: { armL: 0.85, shoulderL: 0.15 },
        w1: { armL: 0.5, forearmL: 0.5 },
        t0: 0.72,
        t1: 1,
      }),
    ),
    // Biceps, triceps, brachialis, all on the humerus axis.
    ...pair(ell('armL', [0.19, 1.255, -0.002], [0.044 * G, 0.092, 0.041 * G], 0.022, A, { w: { armL: 1 }, muscle: true })),
    ...pair(ell('armL', [0.193, 1.285, -0.054], [0.047 * G, 0.115, 0.039 * G], 0.022, A, { w: { armL: 1 }, muscle: true })),
    ...pair(
      ell('armL', [0.19, 1.19, -0.022], [0.04 * G, 0.05, 0.034 * G], 0.025, A, { w: { armL: 0.7, forearmL: 0.3 }, muscle: true }),
    ),
    // Olecranon.
    ...pair(ell('forearmL', [0.19, 1.137, -0.047], [0.024, 0.026, 0.022], 0.014, A, { w: { armL: 0.5, forearmL: 0.5 } })),
    // Forearm: a wrestler's, thick to the wrist.
    ...pair(
      cone('forearmL', [0.19, 1.13, -0.025], [0.19, 0.905, -0.012], 0.042 * G, 0.024 * G, 0.022, A, {
        w0: { forearmL: 0.65, armL: 0.35 },
        w1: { forearmL: 0.6, handL: 0.4 },
        t0: 0,
        t1: 1,
      }),
    ),
    ...pair(ell('forearmL', [0.19, 1.07, -0.02], [0.044 * G, 0.1, 0.039 * G], 0.028, A, { w: { forearmL: 1 }, muscle: true })),
    // Distal forearm: flat and wide where the tendons run, so the forearm
    // tapers into the wrist instead of pinching.
    ...pair(
      ell('forearmL', [0.19, 0.955, -0.012], [0.024 * G, 0.07, 0.031 * G], 0.03, A, {
        w0: { forearmL: 0.7, handL: 0.3 },
        w1: { forearmL: 1 },
        muscle: true,
      }),
    ),
    // Brachioradialis on the thumb side.
    ...pair(
      ell('forearmL', [0.2, 1.105, 0.002], [0.027 * G, 0.085, 0.026 * G], 0.025, A, {
        w0: { forearmL: 0.8, armL: 0.2 },
        w1: { forearmL: 1 },
        muscle: true,
      }),
    ),
    // Wrist.
    ...pair(ell('forearmL', [0.19, 0.9, -0.007], [0.0195, 0.024, 0.029], 0.024, A, { w: { forearmL: 0.5, handL: 0.5 } })),
    // Palm.
    ...pair(box('handL', [0.188, 0.826, -0.004], [0.0145, 0.046, 0.04], 0.0135, 0.014, D, { w: { handL: 1 } })),
    ...pair(ell('handL', [0.189, 0.828, -0.004], [0.017, 0.052, 0.044], 0.014, D, { w: { handL: 1 } })),
    // Knuckles (metacarpal heads) and a gently arched back of the hand.
    ...[0.022, 0.005, -0.012, -0.027].flatMap((kz, i) =>
      pair(ell('handL', [0.1995, 0.785, kz], [0.0085, 0.0095, 0.0085 - i * 0.0005], 0.008, D, { w: { handL: 1 } })),
    ),
    ...pair(ell('handL', [0.193, 0.83, -0.002], [0.012, 0.045, 0.036], 0.016, D, { w: { handL: 1 } })),
    // Thenar pad.
    ...pair(ell('handL', [0.18, 0.834, 0.024], [0.016, 0.026, 0.016], 0.012, D, { rot: [0, 0, -10], w: { handL: 1 } })),
    ...hand(),
  ];
}

/**
 * Fingers in three phalanges, held together in a relaxed curl that increases
 * from the index to the little finger; the thumb rests along the index.
 */
function hand(): Spec[] {
  const D = PART.Hand;
  const specs: Spec[] = [];
  // [z across the palm, radius, proximal, distal (middle+distal), curl at knuckle, middle, tip]
  const fingers: Array<[number, number, number, number, number, number, number]> = [
    [0.0232, 0.0099, 0.041, 0.034, 20, 44, 60],
    [0.0055, 0.0103, 0.044, 0.037, 22, 48, 63],
    [-0.0123, 0.0098, 0.041, 0.034, 25, 52, 67],
    [-0.028, 0.0089, 0.034, 0.028, 28, 56, 71],
  ];
  const knuckle = 0.78;
  const DEG = Math.PI / 180;
  const dir = (deg: number): V3 => [-Math.sin(deg * DEG), -Math.cos(deg * DEG), 0];
  const add = (p: V3, d: V3, l: number, spread: number): V3 => [p[0] + d[0] * l, p[1] + d[1] * l, p[2] + d[2] * l + spread * l];
  for (const [z, r, lp, ld, c0, c1, c2] of fingers) {
    // Fingers held together: only a slight fan.
    const spread = z * 0.04;
    const a: V3 = [0.19, knuckle + 0.004, z];
    const b = add(a, dir(c0), lp, spread);
    const m = add(b, dir(c1), ld * 0.56, spread);
    const c = add(m, dir(c2), ld * 0.44, spread);
    specs.push(...pair(cone('handL', a, b, r, r * 0.92, 0.003, D, { w: { handL: 1 } })));
    specs.push(...pair(cone('handL', b, m, r * 0.92, r * 0.84, 0.0025, D, { w: { handL: 1 } })));
    specs.push(...pair(cone('handL', m, c, r * 0.84, r * 0.74, 0.0025, D, { w: { handL: 1 } })));
  }
  // Thumb resting along the front of the index finger.
  const t: V3[] = [
    [0.183, 0.86, 0.02],
    [0.178, 0.826, 0.039],
    [0.174, 0.798, 0.045],
    [0.171, 0.776, 0.043],
  ];
  const tr = [0.013, 0.0114, 0.01, 0.0088];
  for (let i = 0; i < 3; i++) {
    specs.push(...pair(cone('handL', t[i], t[i + 1], tr[i], tr[i + 1], i === 0 ? 0.008 : 0.003, D, { w: { handL: 1 } })));
  }
  return specs;
}

function legs(f: FrameParams): Spec[] {
  const L = PART.Leg;
  const F = PART.Foot;
  const G = f.limb;
  const Hm = f.hips;
  return [
    // Femur core: a cone, biggest at the gluteal fold.
    ...pair(
      cone('thighL', [0.09, 0.93, 0.0], [0.09, 0.5, 0.005], 0.08 * Hm, 0.052 * G, 0.03, L, {
        w0: { hips: 0.4, thighL: 0.6 },
        w1: { thighL: 0.55, shinL: 0.45 },
        t0: 0,
        t1: 1,
      }),
    ),
    // Quads.
    ...pair(
      ell('thighL', [0.096, 0.735, 0.027], [0.069 * Hm, 0.17, 0.06 * Hm], 0.03, L, {
        rot: [0, 0, -3],
        w0: { thighL: 0.85, shinL: 0.15 },
        w1: { thighL: 0.9, hips: 0.1 },
        muscle: true,
      }),
    ),
    // Vastus lateralis sweep.
    ...pair(
      ell('thighL', [0.131, 0.69, 0.004], [0.038 * Hm, 0.14, 0.054 * Hm], 0.03, L, {
        rot: [0, 0, -4],
        w0: { thighL: 0.85, shinL: 0.15 },
        w1: { thighL: 0.9, hips: 0.1 },
        muscle: true,
      }),
    ),
    // VMO teardrop.
    ...pair(ell('thighL', [0.065, 0.574, 0.028], [0.036 * Hm, 0.062, 0.038 * Hm], 0.02, L, { w: { thighL: 0.8, shinL: 0.2 }, muscle: true })),
    // Hamstrings.
    ...pair(
      ell('thighL', [0.09, 0.74, -0.036], [0.058 * Hm, 0.155, 0.05 * Hm], 0.03, L, {
        w0: { thighL: 0.8, shinL: 0.2 },
        w1: { thighL: 0.85, hips: 0.15 },
        muscle: true,
      }),
    ),
    // Upper hamstring under the gluteal fold, so the glute is not a shelf.
    ...pair(ell('thighL', [0.084, 0.83, -0.058], [0.05 * Hm, 0.055, 0.04 * Hm], 0.04, L, { w: { thighL: 0.75, hips: 0.25 }, muscle: true })),
    // Adductors.
    ...pair(ell('thighL', [0.055, 0.8, -0.008], [0.05 * Hm, 0.11, 0.06], 0.03, L, { w: { thighL: 0.85, hips: 0.15 }, muscle: true })),
    // Knee and patella.
    ...pair(ell('shinL', [0.09, 0.49, 0.008], [0.047, 0.048, 0.045], 0.03, L, { w: { thighL: 0.5, shinL: 0.5 } })),
    ...pair(ell('shinL', [0.09, 0.505, 0.04], [0.02, 0.024, 0.011], 0.022, L, { w: { thighL: 0.35, shinL: 0.65 } })),
    // Shin core.
    ...pair(
      cone('shinL', [0.09, 0.48, 0.0], [0.09, 0.12, -0.008], 0.047 * G, 0.031, 0.02, L, {
        w0: { shinL: 0.85, thighL: 0.15 },
        w1: { shinL: 0.7, footL: 0.3 },
        t0: 0,
        t1: 1,
      }),
    ),
    // Tibialis anterior.
    ...pair(ell('shinL', [0.1, 0.37, 0.024], [0.018 * G, 0.085, 0.017], 0.02, L, { w: { shinL: 1 }, muscle: true })),
    // Gastrocnemius heads and soleus: a real calf.
    ...pair(ell('shinL', [0.105, 0.4, -0.036], [0.04 * G, 0.095, 0.046 * G], 0.025, L, { w: { shinL: 1 }, muscle: true })),
    ...pair(ell('shinL', [0.074, 0.39, -0.038], [0.046 * G, 0.1, 0.05 * G], 0.025, L, { w: { shinL: 1 }, muscle: true })),
    // Achilles: the calf tapers into a cord above the heel.
    ...pair(cone('shinL', [0.09, 0.235, -0.036], [0.09, 0.095, -0.04], 0.017, 0.012, 0.02, L, { w: { shinL: 0.85, footL: 0.15 } })),
    ...pair(ell('shinL', [0.09, 0.29, -0.03], [0.044 * G, 0.09, 0.034 * G], 0.025, L, { w: { shinL: 1 }, muscle: true })),
    // The foot, sculpted as a foot (malleoli, heel, arch, ball, toes); the shoe
    // is this surface painted, so it hugs like a real wrestling shoe instead of
    // a boot. Collar just above the ankle bones.
    ...pair(
      cone('footL', [0.09, 0.07, -0.012], [0.09, 0.168, -0.01], 0.037, 0.034, 0.016, F, {
        w0: { footL: 0.6, shinL: 0.4 },
        w1: { shinL: 0.9, footL: 0.1 },
      }),
    ),
    ...pair(ell('footL', [0.111, 0.078, -0.014], [0.011, 0.016, 0.013], 0.012, F, { w: { footL: 0.5, shinL: 0.5 } })),
    ...pair(ell('footL', [0.069, 0.084, -0.008], [0.011, 0.016, 0.013], 0.012, F, { w: { footL: 0.5, shinL: 0.5 } })),
    // Heel.
    ...pair(ell('footL', [0.09, 0.04, -0.03], [0.031, 0.04, 0.037], 0.02, F, { w: { footL: 1 } })),
    // Midfoot and instep, sloping down to the toes.
    ...pair(
      ell('footL', [0.091, 0.042, 0.045], [0.039, 0.039, 0.074], 0.02, F, {
        rot: [8, 0, 0],
        axis: 2,
        w0: { footL: 1 },
        w1: { footL: 0.6, toeL: 0.4 },
        t0: 0.55,
        t1: 1,
      }),
    ),
    // Ball of the foot, a little wider on the outside, then the toe box.
    ...pair(ell('footL', [0.093, 0.025, 0.128], [0.047, 0.025, 0.046], 0.02, F, { w0: { footL: 0.5, toeL: 0.5 } })),
    ...pair(ell('toeL', [0.088, 0.019, 0.18], [0.041, 0.019, 0.043], 0.018, F, { rot: [0, 6, 0], w: { toeL: 1 } })),
    // Thin split sole: heel pad and forefoot pad.
    ...pair(ell('footL', [0.09, 0.0075, -0.026], [0.0345, 0.0075, 0.0425], 0.006, F, { w: { footL: 1 } })),
    ...pair(
      ell('footL', [0.091, 0.0075, 0.128], [0.0495, 0.0075, 0.094], 0.008, F, {
        axis: 2,
        w0: { footL: 1 },
        w1: { toeL: 1 },
        t0: 0.3,
        t1: 0.6,
      }),
    ),
  ];
}

/* ----------------------------------------------------------- hair mask --- */

const sstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Irregular hairline offset (metres); mirrored in the material shader. */
export function hairlineNoise(x: number, y: number, z: number): number {
  return 0.0022 * Math.sin(x * 260 + 1.3) + 0.0014 * Math.sin(x * 610 + y * 90 + 0.4) + 0.0009 * Math.sin(z * 420 + x * 150);
}

/**
 * Where hair grows, in canonical rest coordinates: 0 = skin, else the relative
 * hair length (1 on top, shorter on the clipped sides), already multiplied by a
 * soft density falloff a few millimetres wide at the hairline so the edge
 * feathers instead of stopping on a triangle boundary. Mirrors the material.
 */
export function hairAt(x: number, y: number, z: number, sides: number, hairFront = 1.71): number {
  const ax = Math.abs(x);
  if (y < 1.575) return 0;
  // Front hairline with a gentle M: it recedes a little at the temples.
  const hf = hairFront + 0.007 * sstep(0.016, 0.044, ax);
  const front = -0.5 * (y - hf) + 0.866 * (z - 0.07) + hairlineNoise(x, y, z);
  const fFront = sstep(0.006, -0.009, front);
  // Side line: temple corner, a rounded sideburn in front of the ear, over the
  // ear, then down behind it to a tapered nape.
  let y1 = 1.635 + (1.69 - 1.635) * sstep(0.016, 0.03, z);
  y1 += (1.672 - y1) * sstep(0.006, -0.002, z);
  y1 += (1.594 - y1) * sstep(-0.021, -0.065, z);
  const w = 0.006 + 0.008 * sstep(-0.03, -0.07, z);
  const fSide = sstep(-w * 0.5, w, y - y1 + hairlineNoise(z, y, x) * 0.8);
  const dens = Math.min(fFront, fSide);
  if (dens <= 0) return 0;
  const gate = sstep(0.044, 0.064, ax);
  const top = sstep(1.7, 1.73, y) * (1 - gate * 0.5);
  return (sides * 0.35 + (1 - sides * 0.35) * top) * dens;
}

/* ------------------------------------------------------------ bind pose --- */

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

/* -------------------------------------------------------------- compile --- */

function scaleHead(s: Spec, hs: number): Spec {
  const P = HEAD_PIVOT;
  const v = (q: V3 | undefined): V3 | undefined => q && [P[0] + (q[0] - P[0]) * hs, P[1] + (q[1] - P[1]) * hs, P[2] + (q[2] - P[2]) * hs];
  return {
    ...s,
    a: v(s.a),
    b: v(s.b),
    c: v(s.c),
    r: s.r && [s.r[0] * hs, s.r[1] * hs, s.r[2] * hs],
    ra: s.ra !== undefined ? s.ra * hs : undefined,
    rb: s.rb !== undefined ? s.rb * hs : undefined,
    round: s.round !== undefined ? s.round * hs : undefined,
    k: s.k * hs,
    noise: s.noise !== undefined ? s.noise * hs : undefined,
    clip: s.clip && { c: v(s.clip.c)!, n: s.clip.n, k: s.clip.k * hs },
    cut: s.cut && { c: v(s.cut.c)!, r: [s.cut.r[0] * hs, s.cut.r[1] * hs, s.cut.r[2] * hs], rot: s.cut.rot, k: s.cut.k * hs },
    planes: s.planes && s.planes.map((q) => ({ ...q, c: v(q.c)!, k: q.k * hs, fy: q.fy !== undefined ? P[1] + (q.fy - P[1]) * hs : undefined, fk: q.fk })),
  };
}

function toPrim(s: Spec, params: BodyParams, bind: BindPose): Prim {
  const p = new Prim();
  const sc = params.scale;
  const girth = (s.muscle ? 0.9 + params.mass * 0.2 : 0.97 + params.mass * 0.06) * (s.g ?? 1);

  const headish = s.part === PART.Head || s.part === PART.Ear || s.part === PART.Lip || s.part === PART.Lid || s.part === PART.Hair;
  if (headish && params.frame.head !== 1) s = scaleHead(s, params.frame.head);
  const restOrigin = bind.rest[s.bone];
  const bp = bind.pos[s.bone];
  const br = bind.rot[s.bone];
  const xf = (v: V3): V3 => {
    const local: V3 = [v[0] * sc - restOrigin[0], v[1] * sc - restOrigin[1], v[2] * sc - restOrigin[2]];
    const w = m3Apply(br, local);
    return [bp[0] + w[0], bp[1] + w[1], bp[2] + w[2]];
  };

  p.kind = s.kind;
  p.k = s.k * sc;
  p.sub = !!s.sub;
  p.part = s.part as Part;
  p.claim = s.claim ?? 1;
  p.noise = (s.noise ?? 0) * sc;
  const gg = headish || s.part === PART.Hand || s.part === PART.Foot ? 1 : girth;

  if (s.kind === Kind.Cone) {
    const a = xf(s.a!);
    const b = xf(s.b!);
    [p.ax, p.ay, p.az] = a;
    [p.bx, p.by, p.bz] = b;
    p.ra = s.ra! * sc * gg;
    p.rb = s.rb! * sc * gg;
    p.bcx = (a[0] + b[0]) / 2;
    p.bcy = (a[1] + b[1]) / 2;
    p.bcz = (a[2] + b[2]) / 2;
    p.brad = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2 + Math.max(p.ra, p.rb);
  } else {
    const c = xf(s.c!);
    [p.cx, p.cy, p.cz] = c;
    const r = s.r!;
    const g = s.kind === Kind.Ellipsoid ? gg : 1;
    p.rx = r[0] * sc * g;
    p.ry = r[1] * sc * (s.kind === Kind.Ellipsoid ? Math.sqrt(g) : 1);
    p.rz = r[2] * sc * g;
    p.round = (s.round ?? 0) * sc;
    const local = s.rot ? m3FromEuler(s.rot[0], s.rot[1], s.rot[2]) : m3Identity();
    p.m = m3Mul(br, local);
    p.axis = s.axis ?? (p.ry >= p.rx && p.ry >= p.rz ? 1 : p.rx >= p.rz ? 0 : 2);
    p.bcx = c[0];
    p.bcy = c[1];
    p.bcz = c[2];
    p.brad = Math.max(p.rx, p.ry, p.rz) * 1.05 + p.noise;
  }

  if (s.clip) {
    p.clip = { c: xf(s.clip.c), n: m3Apply(br, s.clip.n), k: s.clip.k * sc };
  }
  if (s.cut) {
    const local = s.cut.rot ? m3FromEuler(s.cut.rot[0], s.cut.rot[1], s.cut.rot[2]) : m3Identity();
    (p as PrimX).cut = {
      c: xf(s.cut.c),
      r: [s.cut.r[0] * sc, s.cut.r[1] * sc, s.cut.r[2] * sc],
      m: m3Mul(br, local),
      k: s.cut.k * sc,
    };
  }
  if (s.planes) {
    (p as PrimX).planes = s.planes.map((q) => ({ c: xf(q.c), n: m3Apply(br, q.n), k: q.k * sc, fy: q.fy !== undefined ? xf([0, q.fy, 0])[1] : undefined, fk: q.fk }));
  }
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

export function buildPrims(params: BodyParams): { prims: Prim[]; bind: BindPose } {
  const bind = bindPose(params.scale);
  const specs = [
    ...torso(params.frame),
    ...neckBase(params.frame),
    ...head(params.face, params.hair, params.hairFront),
    ...neckTop(params.frame),
    ...arms(params.frame),
    ...legs(params.frame),
  ];
  const prims = specs.map((s) => toPrim(s, params, bind));
  const order = (p: Prim) => (p.late ? 2 : p.sub ? 1 : 0);
  prims.sort((a, b) => order(a) - order(b));
  return { prims, bind };
}
