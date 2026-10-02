import { BIND_POSE, BONES, BONE_INDEX, MIRROR, restPositions } from './skeleton';
import type { BoneName } from './skeleton';
import { m3Apply, m3FromEuler, m3Identity, m3Mul } from './math';
import type { M3, V3 } from './math';
import { Kind, Part, Prim } from './sdf';

/**
 * Anatomy.
 *
 * An athletic body described the way a sculptor blocks one in: a core for every
 * segment, then the muscle masses that give a wrestler his shape — traps, delts,
 * lats, quads, calves. Everything is written in rest-pose coordinates (limbs
 * hanging, facing +Z, +X to the body's left) for the canonical 1.76 m athlete,
 * then scaled and moved into the A-shaped bind pose the mesh is built in.
 */

export type HairStyle = 'buzz' | 'crop' | 'curls' | 'bald';
export type Clothing = 'singlet' | 'referee';

export interface BodyParams {
  /** Height / 1.76. */
  scale: number;
  /** 0 = lean, 1 = heavy. Mostly drives muscle mass. */
  mass: number;
  hair: HairStyle;
  clothing: Clothing;
}

type Weights = Partial<Record<BoneName, number>>;

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
  /** Muscle masses scale with build; cores barely do. */
  muscle?: boolean;
  clip?: { c: V3; n: V3; k: number };
  noise?: number;
  claim?: number;
  /** Added after the carving pass (eyelids sit inside the eye sockets). */
  late?: boolean;
}

const cone = (
  bone: BoneName,
  a: V3,
  b: V3,
  ra: number,
  rb: number,
  k: number,
  part: Part,
  extra: Partial<Spec> = {},
): Spec => ({ bone, kind: Kind.Cone, a, b, ra, rb, k, part, ...extra });

const ell = (
  bone: BoneName,
  c: V3,
  r: V3,
  k: number,
  part: Part,
  extra: Partial<Spec> = {},
): Spec => ({ bone, kind: Kind.Ellipsoid, c, r, k, part, ...extra });

const box = (
  bone: BoneName,
  c: V3,
  h: V3,
  round: number,
  k: number,
  part: Part,
  extra: Partial<Spec> = {},
): Spec => ({ bone, kind: Kind.Box, c, r: h, round, k, part, ...extra });

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

/** Both sides of a bilateral structure, authored on the left. */
const pair = (s: Spec): Spec[] => [s, mirror(s)];

/* ------------------------------------------------------------- the body --- */

function torso(): Spec[] {
  const T = Part.Torso;
  return [
    ell('hips', [0, 0.955, -0.01], [0.152, 0.105, 0.104], 0.03, T, { w: { hips: 1 } }),
    ...pair(
      ell('hips', [0.066, 0.905, -0.066], [0.076, 0.094, 0.07], 0.035, T, {
        rot: [10, 0, 0],
        w: { hips: 0.7, thighL: 0.3 },
        muscle: true,
      }),
    ),
    ell('hips', [0, 1.02, 0.024], [0.132, 0.08, 0.088], 0.04, T, { w: { hips: 0.55, spine: 0.45 } }),
    ell('spine', [0, 1.09, -0.006], [0.136, 0.1, 0.098], 0.04, T, { w: { spine: 0.85, hips: 0.15 } }),
    ell('spine', [0, 1.142, 0.044], [0.094, 0.118, 0.064], 0.03, T, {
      w0: { spine: 0.85, hips: 0.15 },
      w1: { spine: 0.45, chest: 0.55 },
      muscle: true,
    }),
    ell('chest', [0, 1.255, -0.012], [0.148, 0.155, 0.108], 0.045, T, {
      w0: { spine: 0.65, chest: 0.35 },
      w1: { chest: 1 },
    }),
    ell('chest', [0, 1.358, -0.012], [0.158, 0.094, 0.104], 0.04, T, { w: { chest: 1 } }),
    ...pair(
      ell('chest', [0.07, 1.336, 0.066], [0.079, 0.058, 0.042], 0.026, T, {
        rot: [0, 16, -12],
        w: { chest: 0.82, shoulderL: 0.18 },
        muscle: true,
      }),
    ),
    ...pair(
      ell('chest', [0.113, 1.272, -0.042], [0.054, 0.135, 0.068], 0.036, T, {
        rot: [0, 0, 16],
        w0: { chest: 0.7, spine: 0.3 },
        w1: { chest: 0.8, shoulderL: 0.2 },
        muscle: true,
      }),
    ),
    ...pair(
      cone('chest', [0.034, 1.508, -0.05], [0.152, 1.456, -0.04], 0.046, 0.034, 0.032, T, {
        w0: { neck: 0.45, chest: 0.55 },
        w1: { chest: 0.55, shoulderL: 0.45 },
        muscle: true,
      }),
    ),
    ell('chest', [0, 1.33, -0.066], [0.112, 0.11, 0.054], 0.04, T, { w: { chest: 1 } }),
    ell('spine', [0, 1.1, -0.07], [0.074, 0.12, 0.044], 0.035, T, {
      w0: { hips: 0.55, spine: 0.45 },
      w1: { spine: 0.6, chest: 0.4 },
      muscle: true,
    }),
    ...pair(
      cone('shoulderL', [0.03, 1.456, 0.034], [0.172, 1.456, 0.002], 0.022, 0.028, 0.02, T, {
        w0: { chest: 0.65, shoulderL: 0.35 },
        w1: { shoulderL: 0.85, chest: 0.15 },
      }),
    ),
    ...pair(
      ell('chest', [0.098, 1.355, -0.074], [0.058, 0.074, 0.03], 0.03, T, {
        rot: [0, 20, 0],
        w: { chest: 0.55, shoulderL: 0.45 },
      }),
    ),
  ];
}

function neckAndHead(hair: HairStyle, clothing: Clothing): Spec[] {
  const H = Part.Head;
  const T = Part.Torso;
  const specs: Spec[] = [
    cone('neck', [0, 1.43, -0.026], [0, 1.6, -0.006], 0.066, 0.055, 0.036, T, {
      w0: { chest: 0.35, neck: 0.65 },
      w1: { neck: 0.45, head: 0.55 },
      t0: 0.1,
      t1: 0.95,
    }),
    ...pair(
      cone('neck', [0.017, 1.462, 0.04], [0.05, 1.586, -0.008], 0.017, 0.015, 0.02, T, {
        w0: { neck: 0.8, chest: 0.2 },
        w1: { neck: 0.4, head: 0.6 },
        muscle: true,
      }),
    ),
    ell('head', [0, 1.668, 0.0], [0.076, 0.097, 0.095], 0.02, H, { w: { head: 1 } }),
    ell('head', [0, 1.636, -0.054], [0.064, 0.06, 0.05], 0.025, H, { w: { head: 1 } }),
    ell('head', [0, 1.628, 0.034], [0.063, 0.074, 0.07], 0.025, H, { w: { head: 1 } }),
    ...pair(cone('head', [0.047, 1.59, 0.006], [0.02, 1.55, 0.073], 0.019, 0.018, 0.026, H, { w: { head: 1 } })),
    ell('head', [0, 1.548, 0.082], [0.024, 0.02, 0.018], 0.02, H, { w: { head: 1 } }),
    ...pair(ell('head', [0.047, 1.641, 0.069], [0.02, 0.014, 0.018], 0.015, H, { w: { head: 1 } })),
    ...pair(cone('head', [0.0, 1.693, 0.088], [0.047, 1.692, 0.078], 0.013, 0.012, 0.015, H, { w: { head: 1 } })),
    cone('head', [0, 1.684, 0.092], [0, 1.632, 0.112], 0.008, 0.012, 0.012, H, { w: { head: 1 } }),
    ell('head', [0, 1.627, 0.106], [0.017, 0.01, 0.012], 0.01, H, { w: { head: 1 } }),
    ell('head', [0, 1.592, 0.092], [0.023, 0.01, 0.012], 0.012, H, { w: { head: 1 } }),
    ...pair(ell('head', [0.077, 1.655, -0.006], [0.012, 0.03, 0.02], 0.008, H, { w: { head: 1 } })),
    // Eye sockets, carved, then the lids laid back in over the eyeballs.
    ...pair(ell('head', [0.032, 1.664, 0.1], [0.017, 0.012, 0.016], 0.008, H, { sub: true, claim: 0 })),
    ...pair(
      ell('head', [0.032, 1.6712, 0.0905], [0.0168, 0.0062, 0.0136], 0.004, H, {
        rot: [-12, 0, 0],
        w: { head: 1 },
        late: true,
      }),
    ),
    ...pair(ell('head', [0.032, 1.6566, 0.0912], [0.0158, 0.0042, 0.0126], 0.004, H, { w: { head: 1 }, late: true })),
  ];

  // Hair volume, kept above the hairline by a clip plane.
  const hairline = { c: [0, 1.7, 0.06] as V3, n: [0, -0.62, 0.78] as V3, k: 0.012 };
  if (hair === 'crop' || hair === 'curls') {
    specs.push(
      ell('head', [0, 1.678, -0.006], [0.081, 0.098, 0.1], 0.01, Part.Hair, {
        w: { head: 1 },
        clip: hairline,
        noise: hair === 'curls' ? 0.007 : 0.0015,
        claim: 0.6,
      }),
    );
  }
  if (clothing === 'referee') {
    // A touch of jowl and a fuller neck on the official.
    specs.push(ell('head', [0, 1.565, 0.03], [0.058, 0.03, 0.05], 0.03, H, { w: { head: 0.7, neck: 0.3 } }));
  }
  return specs;
}

function arms(): Spec[] {
  const A = Part.Arm;
  const D = Part.Hand;
  return [
    ...pair(
      ell('armL', [0.21, 1.403, -0.02], [0.054, 0.085, 0.062], 0.04, A, {
        rot: [0, 0, 8],
        w0: { armL: 0.6, shoulderL: 0.4 },
        w1: { shoulderL: 0.45, armL: 0.35, chest: 0.2 },
        t0: 0.25,
        t1: 1,
        muscle: true,
      }),
    ),
    ...pair(
      cone('armL', [0.19, 1.43, -0.025], [0.19, 1.15, -0.025], 0.046, 0.037, 0.02, A, {
        w0: { armL: 0.85, shoulderL: 0.15 },
        w1: { armL: 0.5, forearmL: 0.5 },
        t0: 0.72,
        t1: 1,
      }),
    ),
    ...pair(ell('armL', [0.19, 1.265, 0.002], [0.04, 0.085, 0.042], 0.025, A, { w: { armL: 1 }, muscle: true })),
    ...pair(ell('armL', [0.19, 1.29, -0.05], [0.043, 0.105, 0.043], 0.025, A, { w: { armL: 1 }, muscle: true })),
    ...pair(ell('forearmL', [0.19, 1.135, -0.04], [0.033, 0.03, 0.03], 0.02, A, { w: { armL: 0.5, forearmL: 0.5 } })),
    ...pair(
      cone('forearmL', [0.19, 1.13, -0.025], [0.19, 0.89, -0.022], 0.043, 0.027, 0.02, A, {
        w0: { forearmL: 0.65, armL: 0.35 },
        w1: { forearmL: 0.6, handL: 0.4 },
        t0: 0,
        t1: 1,
      }),
    ),
    ...pair(ell('forearmL', [0.19, 1.06, -0.012], [0.043, 0.075, 0.04], 0.025, A, { w: { forearmL: 1 }, muscle: true })),
    ...pair(box('handL', [0.188, 0.832, -0.006], [0.0145, 0.036, 0.036], 0.0135, 0.014, D, { w: { handL: 1 } })),
    ...pair(ell('handL', [0.189, 0.836, -0.006], [0.0175, 0.044, 0.041], 0.014, D, { w: { handL: 1 } })),
    ...hand(),
  ];
}

/**
 * Fingers and thumb, slightly curled the way a relaxed hand hangs. Built small
 * enough that the hand mesh (at head resolution) keeps them distinct.
 */
function hand(): Spec[] {
  const D = Part.Hand;
  const specs: Spec[] = [];
  // [z across the palm, radius, proximal length, distal length]
  const fingers: Array<[number, number, number, number]> = [
    [0.023, 0.0096, 0.04, 0.032],
    [0.004, 0.01, 0.043, 0.035],
    [-0.015, 0.0094, 0.04, 0.033],
    [-0.032, 0.0085, 0.032, 0.027],
  ];
  const knuckle = 0.797;
  for (const [z, r, lp, ld] of fingers) {
    const a: V3 = [0.19, knuckle, z];
    const b: V3 = [0.185, knuckle - lp, z + z * 0.06];
    const c: V3 = [0.172, knuckle - lp - ld * 0.92, z + z * 0.1];
    specs.push(...pair(cone('handL', a, b, r, r * 0.92, 0.004, D, { w: { handL: 1 } })));
    specs.push(...pair(cone('handL', b, c, r * 0.92, r * 0.82, 0.004, D, { w: { handL: 1 } })));
  }
  // Thumb: metacarpal along the front of the palm, then the phalanx.
  const t0: V3 = [0.183, 0.862, 0.022];
  const t1: V3 = [0.176, 0.826, 0.046];
  const t2: V3 = [0.168, 0.798, 0.053];
  specs.push(...pair(cone('handL', t0, t1, 0.0125, 0.0108, 0.008, D, { w: { handL: 1 } })));
  specs.push(...pair(cone('handL', t1, t2, 0.0108, 0.0092, 0.005, D, { w: { handL: 1 } })));
  return specs;
}

function legs(): Spec[] {
  const L = Part.Leg;
  const F = Part.Foot;
  return [
    ...pair(
      cone('thighL', [0.09, 0.93, 0.0], [0.09, 0.5, 0.005], 0.087, 0.055, 0.03, L, {
        w0: { hips: 0.4, thighL: 0.6 },
        w1: { thighL: 0.55, shinL: 0.45 },
        t0: 0,
        t1: 1,
      }),
    ),
    ...pair(
      ell('thighL', [0.098, 0.705, 0.034], [0.066, 0.178, 0.062], 0.03, L, {
        rot: [0, 0, -3],
        w0: { thighL: 0.85, shinL: 0.15 },
        w1: { thighL: 0.9, hips: 0.1 },
        muscle: true,
      }),
    ),
    ...pair(ell('thighL', [0.068, 0.566, 0.032], [0.033, 0.06, 0.036], 0.02, L, { w: { thighL: 0.8, shinL: 0.2 }, muscle: true })),
    ...pair(
      ell('thighL', [0.092, 0.71, -0.042], [0.06, 0.165, 0.055], 0.03, L, {
        w0: { thighL: 0.8, shinL: 0.2 },
        w1: { thighL: 0.85, hips: 0.15 },
        muscle: true,
      }),
    ),
    ...pair(ell('thighL', [0.052, 0.81, -0.005], [0.042, 0.115, 0.055], 0.03, L, { w: { thighL: 0.85, hips: 0.15 }, muscle: true })),
    ...pair(ell('shinL', [0.09, 0.49, 0.008], [0.048, 0.048, 0.046], 0.02, L, { w: { thighL: 0.5, shinL: 0.5 } })),
    ...pair(ell('shinL', [0.09, 0.505, 0.042], [0.024, 0.03, 0.014], 0.015, L, { w: { thighL: 0.35, shinL: 0.65 } })),
    ...pair(
      cone('shinL', [0.09, 0.48, 0.0], [0.09, 0.12, -0.008], 0.048, 0.032, 0.02, L, {
        w0: { shinL: 0.85, thighL: 0.15 },
        w1: { shinL: 0.7, footL: 0.3 },
        t0: 0,
        t1: 1,
      }),
    ),
    ...pair(ell('shinL', [0.104, 0.385, -0.032], [0.036, 0.095, 0.042], 0.025, L, { w: { shinL: 1 }, muscle: true })),
    ...pair(ell('shinL', [0.076, 0.375, -0.03], [0.038, 0.1, 0.045], 0.025, L, { w: { shinL: 1 }, muscle: true })),
    // The shoe: a high-top collar, heel, midfoot, toe box and sole.
    ...pair(
      cone('footL', [0.09, 0.075, -0.012], [0.09, 0.176, -0.01], 0.047, 0.043, 0.015, F, {
        w0: { footL: 0.6, shinL: 0.4 },
        w1: { shinL: 0.85, footL: 0.15 },
      }),
    ),
    ...pair(ell('footL', [0.09, 0.046, -0.034], [0.042, 0.045, 0.05], 0.02, F, { w: { footL: 1 } })),
    ...pair(
      box('footL', [0.09, 0.036, 0.045], [0.04, 0.03, 0.075], 0.025, 0.02, F, {
        axis: 2,
        w0: { footL: 1 },
        w1: { footL: 0.6, toeL: 0.4 },
        t0: 0.55,
        t1: 1,
      }),
    ),
    ...pair(ell('toeL', [0.09, 0.03, 0.15], [0.042, 0.03, 0.06], 0.02, F, { w: { toeL: 1 } })),
    ...pair(
      box('footL', [0.09, 0.012, 0.055], [0.044, 0.012, 0.142], 0.01, 0.01, F, {
        axis: 2,
        w0: { footL: 1 },
        w1: { toeL: 1 },
        t0: 0.55,
        t1: 0.72,
      }),
    ),
  ];
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

function toPrim(s: Spec, params: BodyParams, bind: BindPose): Prim {
  const p = new Prim();
  const sc = params.scale;
  const girth = s.muscle ? 0.9 + params.mass * 0.2 : 0.97 + params.mass * 0.06;
  const cloth =
    params.clothing === 'referee'
      ? s.part === Part.Leg
        ? 0.012
        : s.part === Part.Torso || s.part === Part.Arm
          ? 0.008
          : 0
      : 0;

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
  p.part = s.part;
  p.claim = s.claim ?? 1;
  p.noise = (s.noise ?? 0) * sc;

  if (s.kind === Kind.Cone) {
    const a = xf(s.a!);
    const b = xf(s.b!);
    [p.ax, p.ay, p.az] = a;
    [p.bx, p.by, p.bz] = b;
    p.ra = s.ra! * sc * girth + cloth;
    p.rb = s.rb! * sc * girth + cloth;
    p.bcx = (a[0] + b[0]) / 2;
    p.bcy = (a[1] + b[1]) / 2;
    p.bcz = (a[2] + b[2]) / 2;
    p.brad = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2 + Math.max(p.ra, p.rb);
  } else {
    const c = xf(s.c!);
    [p.cx, p.cy, p.cz] = c;
    const r = s.r!;
    const g = s.kind === Kind.Ellipsoid ? girth : 1;
    p.rx = r[0] * sc * g + cloth;
    p.ry = r[1] * sc * (s.kind === Kind.Ellipsoid ? Math.sqrt(g) : 1) + cloth;
    p.rz = r[2] * sc * g + cloth;
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
  const specs = [...torso(), ...neckAndHead(params.hair, params.clothing), ...arms(), ...legs()];
  const prims = specs.map((s) => toPrim(s, params, bind));
  // Carving primitives come after everything they carve; late masses after that.
  const order = (p: Prim) => (p.late ? 2 : p.sub ? 1 : 0);
  prims.sort((a, b) => order(a) - order(b));
  return { prims, bind };
}
