import type { BufferGeometry } from 'three';
import { MeshBuilder, PART, clamp01, hash, lerp, mixW, smooth } from './mesh';
import type { Ring, V3, W } from './mesh';
import type { Athlete, BodyShape, HeadShape, HairShape } from './athletes';

/**
 * The low-poly athlete.
 *
 * Every segment is a loft of designed cross-sections. Torso, arm and leg sections
 * come from the anatomy audit's target widths, depths and heights (1.76 m frame), so
 * the facets sit on sound proportions: a V from the lats to the waist, conical
 * thighs with the glutes on the legs, full calves, 19 cm hands, a high-top shoe.
 *
 * The head is a hand-placed lattice of planes (brow ridge, socket, cheekbone, nose
 * wedge, jaw line with a real gonial angle, and a down-facing under-jaw plane that
 * separates head from neck), pushed per athlete. Points are authored in a canonical
 * frame and pushed as they are stored, so the shader can paint the face in the
 * canonical frame whatever the athlete's head shape.
 */

const EYE_Y = 1.649;
const HEAD_PIVOT: V3 = [0, 1.575, -0.005];
const HEAD_C: V3 = [0, 1.668, -0.006];
const VERTEX: V3 = [0, 1.762, -0.004];

/* ------------------------------------------------------------------ torso -- */

/** Half-section columns, front midline -> left side -> back midline: [fx, fz]. */
const TORSO_COLS: Array<[number, number]> = [
  [0, 1],
  [0.4, 0.97],
  [0.72, 0.85],
  [0.93, 0.52],
  [1.0, 0.0],
  [0.94, -0.48],
  [0.72, -0.86],
  [0.36, -0.99],
  [0, -0.93],
];

interface TorsoRing {
  y: number;
  hw: number;
  f: number;
  b: number;
  fz?: Array<number | null>;
  fx?: Array<number | null>;
  /** Which width multiplier applies: 0 hip, 1 waist, 2 chest, 3 shoulder. */
  zone: number;
  /** Per-column height offsets (the saddle-shaped hip ring). */
  dy?: number[];
}

/**
 * The torso ends in a saddle-shaped hip ring (lower at the front and back midline)
 * that the two legs continue from: each leg's first ring is that ring's half plus a
 * crotch point, so the singlet is one continuous surface from chest to thigh, with
 * no gusset, pouch or ledge.
 */
const TORSO: TorsoRing[] = [
  {
    y: 0.95,
    hw: 0.158,
    f: 0.079,
    b: 0.13,
    zone: 0,
    fz: [0.88, 0.98, null, null, null, null, -0.92, -1.0, -0.9],
    dy: [-0.036, -0.026, -0.01, 0, 0, 0, -0.006, -0.02, -0.032],
  },
  { y: 1.035, hw: 0.148, f: 0.084, b: 0.106, zone: 0, fz: [null, null, null, null, null, null, null, null, -0.88] },
  { y: 1.1, hw: 0.14, f: 0.087, b: 0.094, zone: 1, fz: [0.98, 1, 0.86, 0.5, null, null, null, -1.0, -0.86] },
  { y: 1.17, hw: 0.146, f: 0.093, b: 0.104, zone: 1, fz: [0.97, 1, 0.86, 0.5, null, null, null, null, -0.88] },
  // Under the pec plate: the ribcage steps back from the chest.
  { y: 1.235, hw: 0.159, f: 0.1, b: 0.117, zone: 2, fz: [0.97, 1, 0.88, 0.52, null, null, null, null, -0.92] },
  // Pec plates, proud of the ribs, with a sternal groove and full lats.
  { y: 1.285, hw: 0.172, f: 0.126, b: 0.127, zone: 2, fz: [0.93, 1.0, 0.9, 0.56, 0.04, -0.46, null, null, -0.94] },
  { y: 1.345, hw: 0.181, f: 0.126, b: 0.132, zone: 3, fz: [0.93, 1.0, 0.92, 0.62, 0.06, null, -0.9, -1.0, -0.95] },
  { y: 1.405, hw: 0.177, f: 0.102, b: 0.122, zone: 3 },
  { y: 1.442, hw: 0.165, f: 0.078, b: 0.106, zone: 3, fz: [null, null, 0.9, 0.6, 0.0, -0.5, null, null, null] },
  { y: 1.472, hw: 0.136, f: 0.056, b: 0.09, zone: 3 },
  { y: 1.497, hw: 0.098, f: 0.04, b: 0.076, zone: 3 },
  { y: 1.518, hw: 0.066, f: 0.032, b: 0.066, zone: 3 },
];

/** Weights on the shared hip ring: the pelvis, with the sides following the thigh. */
function hipRingWeights(x: number): W {
  const side = x >= 0 ? 'L' : 'R';
  return mixW({ hips: 1 }, { [`thigh${side}`]: 1 }, 0.38 * smooth(0.0, 0.15, Math.abs(x)));
}

function torsoWeights(y: number, x: number): W {
  const side = x >= 0 ? 'L' : 'R';
  const ax = Math.abs(x);
  let w: W;
  if (y < 0.99) w = { hips: 1 };
  else if (y < 1.06) w = { hips: 0.6, spine: 0.4 };
  else if (y < 1.12) w = { spine: 0.85, hips: 0.15 };
  else if (y < 1.19) w = { spine: 0.8, chest: 0.2 };
  else if (y < 1.26) w = { spine: 0.5, chest: 0.5 };
  else w = { chest: 1 };
  if (y < 0.93) {
    // The pelvis sides partly follow the thighs.
    const t = smooth(0.04, 0.14, ax) * 0.3;
    w = mixW(w, { [`thigh${side}`]: 1 }, t);
  }
  if (y > 1.35) {
    const t = smooth(0.07, 0.165, ax) * (y > 1.39 ? 0.5 : 0.3);
    w = mixW(w, { [`shoulder${side}`]: 1 }, t);
  }
  if (y > 1.49) w = mixW(w, { neck: 1 }, smooth(0.09, 0.0, ax) * 0.15);
  return w;
}

function torso(m: MeshBuilder, b: BodyShape): V3[] {
  const zoneW = [b.hip, b.waist, b.chest, b.shoulder];
  let hipHalf: V3[] = [];
  const rings: Ring[] = TORSO.map((r, ri) => {
    const wmul = zoneW[r.zone];
    // Dense athletes: the traps rise and fill toward the neck.
    const trapLift = r.y > 1.43 ? b.trap * smooth(1.43, 1.5, r.y) : 0;
    const y = r.y + trapLift;
    const half: V3[] = TORSO_COLS.map(([fx0, fz0], j) => {
      const fx = r.fx?.[j] ?? fx0;
      const fz = r.fz?.[j] ?? fz0;
      const x = fx * r.hw * wmul;
      const z = fz >= 0 ? fz * r.f * b.depth * 1.03 : fz * r.b * b.depth;
      return [x, y + (r.dy?.[j] ?? 0), z];
    });
    if (ri === 0) hipHalf = half;
    const pts: V3[] = [];
    for (let j = 0; j <= 8; j++) pts.push(half[j]);
    for (let j = 7; j >= 1; j--) pts.push([-half[j][0], half[j][1], half[j][2]]);
    return { pts, w: (_j: number, p: V3) => (ri === 0 ? hipRingWeights(p[0]) : torsoWeights(r.y, p[0])) };
  });
  m.loft(rings, {
    part: PART.torso,
    symmetric: true,
    capEnd: [0, 1.512 + b.trap, -0.02],
  });
  return hipHalf;
}

/* ------------------------------------------------------------------- neck -- */

function neck(m: MeshBuilder, b: BodyShape): void {
  const n = b.neck;
  const nz = 1 + (n - 1) * 0.6;
  // Half rings [x, z]: front midline, sternocleidomastoid, side, trap, back midline.
  // The SCM points run from near the sternum (low, forward) to behind the ear (high,
  // lateral), so the front of the neck is a V rather than a pillar.
  const spec: Array<[number, Array<[number, number]>, W]> = [
    [1.455, [[0, 0.036], [0.027, 0.038], [0.064, -0.012], [0.052, -0.07], [0, -0.086]], { chest: 0.7, neck: 0.3 }],
    [1.505, [[0, 0.027], [0.033, 0.026], [0.057, -0.016], [0.046, -0.066], [0, -0.08]], { chest: 0.25, neck: 0.75 }],
    [1.55, [[0, 0.02], [0.041, 0.009], [0.053, -0.022], [0.041, -0.064], [0, -0.074]], { neck: 1 }],
    [1.588, [[0, 0.016], [0.046, -0.006], [0.051, -0.03], [0.038, -0.063], [0, -0.07]], { neck: 0.4, head: 0.6 }],
    [1.625, [[0, -0.002], [0.043, -0.016], [0.045, -0.036], [0.033, -0.06], [0, -0.064]], { head: 1 }],
  ];
  const zc = -0.025;
  const rings: Ring[] = spec.map(([y, half, w]) => {
    const pts: V3[] = [];
    const P = (x: number, z: number): V3 => [x * n, y, zc + (z - zc) * nz];
    for (let j = 0; j <= 4; j++) pts.push(P(half[j][0], half[j][1]));
    for (let j = 3; j >= 1; j--) pts.push(P(-half[j][0], half[j][1]));
    return { pts, w };
  });
  m.loft(rings, { part: PART.skin, symmetric: true, capEnd: true });
}

/* -------------------------------------------------------------- arm, hand -- */

/** Limb section: [hwOut, hwIn, front, back] around (cx, cz). */
function limbRing(y: number, cx: number, cz: number, s: number[], g: number, n = 8, angles?: number[]): V3[] {
  const [out, inn, f, bk] = s;
  const pts: V3[] = [];
  const count = angles ? angles.length : n;
  for (let j = 0; j < count; j++) {
    const a = angles ? (angles[j] * Math.PI) / 180 : (j / n) * Math.PI * 2;
    const sx = Math.sin(a);
    const cz2 = Math.cos(a);
    const diag = Math.abs(sx) > 0.2 && Math.abs(cz2) > 0.2 ? 0.98 : 1;
    // 1.05: facets sit inside the authored outline, so push the corners out to keep the volume.
    const x = sx * (sx >= 0 ? out : inn) * g * diag * 1.05;
    const z = cz2 * (cz2 >= 0 ? f : bk) * g * diag * 1.05;
    pts.push([cx + x, y, cz + z]);
  }
  return pts;
}

function arm(m: MeshBuilder, b: BodyShape): void {
  const X = 0.19;
  const spec: Array<[number, number[], W, number]> = [
    // y, [out, in, front, back], weights, girth group (0 upper, 1 fore)
    // The deltoid flows straight into the arm (no pad), then biceps and triceps
    // planes, a brachialis fill at the elbow and a forearm that tapers to the wrist.
    [1.449, [0.024, 0.018, 0.024, 0.026], { armL: 0.4, shoulderL: 0.6 }, 0],
    [1.432, [0.046, 0.032, 0.046, 0.05], { armL: 0.55, shoulderL: 0.45 }, 0],
    [1.4, [0.055, 0.042, 0.053, 0.057], { armL: 0.8, shoulderL: 0.2 }, 0],
    [1.35, [0.054, 0.046, 0.055, 0.059], { armL: 1 }, 0],
    [1.295, [0.051, 0.047, 0.057, 0.06], { armL: 1 }, 0],
    [1.235, [0.048, 0.045, 0.052, 0.057], { armL: 1 }, 0],
    [1.18, [0.045, 0.042, 0.045, 0.05], { armL: 0.85, forearmL: 0.15 }, 0],
    [1.137, [0.043, 0.039, 0.04, 0.046], { armL: 0.5, forearmL: 0.5 }, 1],
    [1.088, [0.047, 0.04, 0.043, 0.04], { forearmL: 0.85, armL: 0.15 }, 1],
    [1.02, [0.04, 0.035, 0.038, 0.034], { forearmL: 1 }, 1],
    [0.955, [0.029, 0.027, 0.031, 0.028], { forearmL: 1 }, 1],
    [0.9, [0.022, 0.021, 0.027, 0.025], { forearmL: 0.7, handL: 0.3 }, 1],
  ];
  const rings: Ring[] = spec.map(([y, s, w, grp]) => ({
    // The cap leans in toward the neck so the delt flows out of the trap.
    pts: limbRing(y, X - 0.012 * smooth(1.41, 1.449, y), y > 1.15 ? -0.025 : -0.022, s, (grp === 0 ? b.arm : b.forearm) * 1.05),
    w,
  }));
  m.loft(rings, { part: PART.arm, capStart: [X - 0.012, 1.456, -0.026], capEnd: [X, 0.892, -0.022] });
}

/** Orthonormal pair perpendicular to d, with u biased toward `hint`. */
function frame(d: V3, hint: V3): [V3, V3] {
  const l = Math.hypot(d[0], d[1], d[2]);
  const t: V3 = [d[0] / l, d[1] / l, d[2] / l];
  const dot = hint[0] * t[0] + hint[1] * t[1] + hint[2] * t[2];
  let u: V3 = [hint[0] - dot * t[0], hint[1] - dot * t[1], hint[2] - dot * t[2]];
  const ul = Math.hypot(u[0], u[1], u[2]);
  u = [u[0] / ul, u[1] / ul, u[2] / ul];
  const v: V3 = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
  return [u, v];
}

function tubeRing(c: V3, d: V3, hint: V3, ru: number, rv: number, n: number, phase = 0): V3[] {
  const [u, v] = frame(d, hint);
  const pts: V3[] = [];
  for (let j = 0; j < n; j++) {
    const a = phase + (j / n) * Math.PI * 2;
    const cu = Math.cos(a) * ru;
    const sv = Math.sin(a) * rv;
    pts.push([c[0] + u[0] * cu + v[0] * sv, c[1] + u[1] * cu + v[1] * sv, c[2] + u[2] * cu + v[2] * sv]);
  }
  return pts;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A tube through a chain of points with per-point radii. */
function chain(m: MeshBuilder, pts: V3[], radii: number[], n: number, hint: V3, w: W, part: number, flat = 1, phase = Math.PI / n): void {
  const rings: Ring[] = pts.map((p, i) => {
    const d = i === 0 ? sub(pts[1], pts[0]) : i === pts.length - 1 ? sub(pts[i], pts[i - 1]) : sub(pts[i + 1], pts[i - 1]);
    return { pts: tubeRing(p, d, hint, radii[i], radii[i] * flat, n, phase), w };
  });
  const last = pts[pts.length - 1];
  const dl = sub(last, pts[pts.length - 2]);
  const l = Math.hypot(dl[0], dl[1], dl[2]);
  const r = radii[radii.length - 1] * 0.8;
  m.loft(rings, { part, capStart: true, capEnd: [last[0] + (dl[0] / l) * r, last[1] + (dl[1] / l) * r, last[2] + (dl[2] / l) * r] });
}

function hand(m: MeshBuilder, b: BodyShape): void {
  const X = 0.188;
  const g = 0.5 + 0.5 * b.forearm;
  // Palm: a flat hexagonal block, thumb side forward (+Z), palm facing the thigh (-X).
  const palm: Array<[number, number, number]> = [
    [0.897, 0.019, 0.027],
    [0.866, 0.018, 0.04],
    [0.82, 0.0175, 0.0445],
    [0.789, 0.015, 0.043],
  ];
  const rings: Ring[] = palm.map(([y, hx, hz]) => {
    const pts: V3[] = [
      [X, y, -0.004 + hz],
      [X + hx, y, -0.004 + hz * 0.55],
      [X + hx, y, -0.004 - hz * 0.55],
      [X, y, -0.004 - hz],
      [X - hx, y, -0.004 - hz * 0.55],
      [X - hx, y, -0.004 + hz * 0.55],
    ].map((p) => [X + (p[0] - X) * g, p[1], -0.004 + (p[2] + 0.004) * g] as V3);
    return { pts, w: y > 0.89 ? { handL: 0.7, forearmL: 0.3 } : { handL: 1 } };
  });
  m.loft(rings, { part: PART.hand, capStart: true, capEnd: [X - 0.003, 0.781, -0.004] });

  // Two finger planes (index-middle, ring-little) in a relaxed curl toward the
  // palm: at a distance they read as a hand, not a bunch of sausages or a claw.
  const fingers: Array<[number, number, number, number]> = [
    // z centre, half width, proximal, distal
    [0.0155, 0.0175, 0.046, 0.038],
    [-0.0215, 0.0158, 0.04, 0.032],
  ];
  const knuckle = 0.792;
  const a1 = (26 * Math.PI) / 180;
  const a2 = (62 * Math.PI) / 180;
  for (const [z, hw, lp, ld] of fingers) {
    const zz = -0.004 + (z + 0.004) * g;
    const t = 0.0092 * g;
    const p0: V3 = [X + 0.002, knuckle + 0.004, zz];
    const p1: V3 = [p0[0] - Math.sin(a1) * lp, p0[1] - Math.cos(a1) * lp, zz * 0.98];
    const p2: V3 = [p1[0] - Math.sin(a2) * ld, p1[1] - Math.cos(a2) * ld, zz * 0.95];
    chain(m, [p0, p1, p2], [t, t * 0.95, t * 0.82], 6, [1, 0, 0], { handL: 1 }, PART.hand, (hw * g) / t, 0);
  }
  // Thumb: metacarpal along the front of the palm, then two phalanges curling in.
  chain(
    m,
    [
      [0.183, 0.86, 0.02],
      [0.176, 0.822, 0.047],
      [0.166, 0.792, 0.056],
      [0.156, 0.772, 0.054],
    ],
    [0.0148 * g, 0.013 * g, 0.0116 * g, 0.0104 * g],
    5,
    [1, 0, 0],
    { handL: 1 },
    PART.hand,
  );
}

/* ------------------------------------------------------------- leg, shoe -- */

/** Angles round the left leg (0 = front, 90 = out), matching the hip ring's half plus the crotch. */
const LEG_ANGLES = [-38, -10, 20, 52, 90, 126, 156, 186, 214, 270];
const CROTCH: V3 = [0, 0.884, -0.012];

function leg(m: MeshBuilder, b: BodyShape, hipHalf: V3[]): void {
  const X = 0.09;
  // Below the shared hip ring: the glute's round back, then the gluteal fold.
  const spec: Array<[number, number[], number, W, number]> = [
    // y, [out, in, front, back], cz, weights, girth group (0 thigh, 1 calf)
    [0.875, [0.077, 0.066, 0.08, 0.11], -0.01, { hips: 0.22, thighL: 0.78 }, 0],
    [0.815, [0.078, 0.07, 0.082, 0.085], -0.004, { thighL: 0.94, hips: 0.06 }, 0],
    [0.75, [0.078, 0.069, 0.084, 0.077], 0.0, { thighL: 1 }, 0],
    [0.68, [0.075, 0.066, 0.082, 0.07], 0.004, { thighL: 1 }, 0],
    // Vastus medialis teardrop above the inner knee.
    [0.612, [0.064, 0.067, 0.074, 0.063], 0.005, { thighL: 1 }, 0],
    [0.555, [0.054, 0.062, 0.068, 0.054], 0.006, { thighL: 0.85, shinL: 0.15 }, 0],
    // Kneecap plane in front.
    [0.495, [0.049, 0.047, 0.064, 0.05], 0.006, { thighL: 0.5, shinL: 0.5 }, 1],
    [0.45, [0.047, 0.046, 0.05, 0.058], 0.0, { shinL: 0.85, thighL: 0.15 }, 1],
    // Calf belly set behind the shin, tapering hard to the ankle.
    [0.39, [0.056, 0.058, 0.043, 0.086], -0.006, { shinL: 1 }, 1],
    [0.31, [0.045, 0.047, 0.039, 0.066], -0.008, { shinL: 1 }, 1],
    [0.225, [0.032, 0.031, 0.032, 0.035], -0.008, { shinL: 1 }, 1],
    [0.17, [0.028, 0.027, 0.029, 0.03], -0.01, { shinL: 0.8, footL: 0.2 }, 1],
  ];
  const first: Ring = {
    pts: [...hipHalf, CROTCH],
    w: (_j: number, p: V3) => (p === CROTCH ? { hips: 1 } : hipRingWeights(p[0])),
  };
  const rings: Ring[] = [
    first,
    ...spec.map(([y, s, cz, w, grp]) => ({
      pts: limbRing(y, X, cz, s, grp === 0 ? b.thigh : b.calf, 10, LEG_ANGLES),
      w,
    })),
  ];
  m.loft(rings, { part: PART.leg, capEnd: true });
}

function shoe(m: MeshBuilder): void {
  const X = 0.09;
  // High-top collar wrapping the ankle; the ankle band sits at its top.
  const collar: Array<[number, number, number, W]> = [
    [0.196, 0.032, 0.035, { shinL: 0.8, footL: 0.2 }],
    [0.15, 0.034, 0.04, { shinL: 0.45, footL: 0.55 }],
    [0.1, 0.037, 0.047, { footL: 1 }],
    [0.062, 0.038, 0.05, { footL: 1 }],
  ];
  m.loft(
    collar.map(([y, rx, rz, w]) => ({
      pts: Array.from({ length: 8 }, (_, j) => {
        const a = (j / 8) * Math.PI * 2;
        return [X + Math.sin(a) * rx, y, -0.014 + Math.cos(a) * rz] as V3;
      }),
      w,
    })),
    { part: PART.shoe, capStart: true, capEnd: true },
  );
  // The foot, lofted heel to toe through vertical sections.
  const spec: Array<[number, number, number, W]> = [
    // z, half width, height, weights: a slim, sock-like wrestling shoe.
    [-0.052, 0.028, 0.066, { footL: 1 }],
    [-0.02, 0.032, 0.086, { footL: 1 }],
    [0.03, 0.037, 0.08, { footL: 1 }],
    [0.08, 0.042, 0.058, { footL: 1 }],
    [0.122, 0.044, 0.045, { footL: 0.5, toeL: 0.5 }],
    [0.16, 0.041, 0.038, { toeL: 1 }],
    [0.184, 0.034, 0.032, { toeL: 1 }],
    [0.198, 0.024, 0.025, { toeL: 1 }],
  ];
  const rings: Ring[] = spec.map(([z, w, h, wt]) => {
    const cx = X + clamp01((z + 0.02) / 0.2) * 0.006;
    const sec: Array<[number, number]> = [
      [0, 0],
      [0.9, 0],
      [1, 0.3],
      [0.8, 0.76],
      [0, 1],
      [-0.8, 0.76],
      [-1, 0.3],
      [-0.9, 0],
    ];
    return { pts: sec.map(([fx, fy]) => [cx + fx * w, fy * h, z] as V3), w: wt };
  });
  m.loft(rings, { part: PART.shoe, capStart: [X, 0.034, -0.062], capEnd: [X + 0.006, 0.013, 0.203] });
}

/* ------------------------------------------------------------------- head -- */

type HeadRow = V3[];

/** A skull row from a super-ellipse: y, half width, front, back. */
function skullRow(y: number, hw: number, f: number, bk: number): HeadRow {
  const fxs = [0, 0.2, 0.45, 0.7, 0.88, 1.0, 0.93, 0.63, 0];
  const p = 2.4;
  return fxs.map((fx, j): V3 => {
    const zz = Math.pow(1 - Math.pow(Math.min(0.995, fx), p), 1 / p);
    if (j === 5) return [hw, y, f * 0.2];
    return [fx * hw, y, j <= 4 ? zz * f : -zz * bk];
  });
}

/**
 * The canonical head: rows of nine half-points (front midline, round the left side,
 * to the back midline). Rows need not be level: the lowest two run along the jaw
 * line and under the jaw, so the gonial angle and the under-jaw plane are real edges.
 */
const HEAD_ROWS: HeadRow[] = [
  skullRow(1.753, 0.037, 0.052, 0.058),
  skullRow(1.737, 0.057, 0.078, 0.085),
  skullRow(1.712, 0.072, 0.092, 0.099),
  // forehead
  [[0, 1.69, 0.097], [0.015, 1.69, 0.096], [0.032, 1.69, 0.092], [0.05, 1.69, 0.082], [0.066, 1.69, 0.061], [0.077, 1.69, 0.018], [0.075, 1.69, -0.05], [0.052, 1.69, -0.093], [0, 1.69, -0.104]],
  // brow ridge
  [[0, 1.669, 0.1], [0.014, 1.671, 0.103], [0.032, 1.674, 0.1], [0.05, 1.671, 0.091], [0.065, 1.666, 0.069], [0.076, 1.662, 0.018], [0.076, 1.662, -0.05], [0.052, 1.662, -0.095], [0, 1.662, -0.106]],
  // eyes, in the socket
  [[0, 1.653, 0.094], [0.0135, 1.649, 0.088], [0.032, 1.645, 0.082], [0.05, 1.648, 0.083], [0.065, 1.646, 0.065], [0.075, 1.642, 0.017], [0.075, 1.642, -0.05], [0.051, 1.642, -0.092], [0, 1.642, -0.102]],
  // nose tip, cheekbones
  [[0, 1.616, 0.101], [0.012, 1.622, 0.098], [0.031, 1.627, 0.095], [0.051, 1.628, 0.087], [0.066, 1.627, 0.062], [0.073, 1.624, 0.014], [0.072, 1.622, -0.049], [0.049, 1.62, -0.087], [0, 1.62, -0.096]],
  // nose base, cheek
  [[0, 1.601, 0.101], [0.017, 1.604, 0.097], [0.033, 1.603, 0.092], [0.05, 1.604, 0.08], [0.062, 1.604, 0.056], [0.069, 1.604, 0.01], [0.067, 1.604, -0.046], [0.045, 1.604, -0.08], [0, 1.604, -0.088]],
  // upper lip, mouth corners
  [[0, 1.588, 0.109], [0.014, 1.586, 0.105], [0.027, 1.582, 0.094], [0.045, 1.584, 0.079], [0.058, 1.586, 0.055], [0.065, 1.589, 0.006], [0.061, 1.592, -0.04], [0.041, 1.594, -0.071], [0, 1.594, -0.078]],
  // lower lip, chin top, jaw ramus
  [[0, 1.569, 0.105], [0.015, 1.568, 0.1], [0.028, 1.567, 0.09], [0.043, 1.568, 0.074], [0.055, 1.57, 0.048], [0.061, 1.573, 0.0], [0.057, 1.58, -0.036], [0.038, 1.585, -0.061], [0, 1.585, -0.068]],
  // jaw line: chin to the gonial angle
  [[0, 1.546, 0.101], [0.016, 1.546, 0.098], [0.03, 1.549, 0.085], [0.042, 1.553, 0.065], [0.051, 1.559, 0.038], [0.056, 1.566, -0.006], [0.05, 1.575, -0.036], [0.034, 1.58, -0.058], [0, 1.58, -0.063]],
  // under the jaw: menton back to the throat
  [[0, 1.532, 0.086], [0.016, 1.533, 0.081], [0.026, 1.537, 0.067], [0.034, 1.543, 0.046], [0.04, 1.55, 0.024], [0.043, 1.558, -0.006], [0.041, 1.567, -0.032], [0.029, 1.572, -0.05], [0, 1.573, -0.055]],
];

/** Athlete-specific push of a canonical head point. */
export function headPush(h: HeadShape): (p: V3) => V3 {
  return ([x, y, z]) => {
    const ax = Math.abs(x);
    const sx = Math.sign(x) || 1;
    const front = smooth(0.0, 0.06, z);
    // Lower face: length, jaw breadth, chin.
    if (y < EYE_Y) y = EYE_Y + (y - EYE_Y) * h.faceLength;
    const jawT = smooth(1.628, 1.566, y);
    let nx = ax * lerp(1, h.jaw, jawT);
    const chinT = smooth(1.58, 1.545, y) * front;
    nx *= lerp(1, h.chinWidth, chinT * smooth(0.05, 0.0, ax));
    z += h.chin * chinT * smooth(0.055, 0.0, ax);
    // Cheekbones.
    const cheekT = Math.exp(-(((y - 1.628) / 0.012) ** 2)) * Math.exp(-(((ax - 0.056) / 0.014) ** 2));
    nx += h.cheek * cheekT * 0.6;
    z += h.cheek * cheekT;
    // A real grin lifts the cheek planes up and forward.
    const grinT = h.grin * Math.exp(-(((y - 1.615) / 0.016) ** 2)) * Math.exp(-(((ax - 0.045) / 0.016) ** 2)) * front;
    y += 0.003 * grinT;
    z += 0.003 * grinT;
    // Hollow below the cheekbone, above the jaw.
    const hollowT = Math.exp(-(((y - 1.6) / 0.011) ** 2)) * Math.exp(-(((ax - 0.054) / 0.012) ** 2));
    nx -= h.hollow * hollowT * 0.7;
    z -= h.hollow * hollowT * 0.5;
    // Nose.
    const noseT = smooth(1.66, 1.632, y) * smooth(1.597, 1.61, y) * smooth(0.02, 0.0, ax);
    z += h.nose * noseT;
    if (y < 1.625 && y > 1.596) nx *= lerp(1, h.noseWidth, smooth(0.024, 0.008, ax));
    // Brow ridge.
    const browT = Math.exp(-(((y - 1.671) / 0.007) ** 2)) * front;
    z += h.brow * browT;
    y += h.browY * browT * smooth(0.0, 0.02, ax) * 0.5;
    // Width, then overall size about the head pivot.
    nx *= h.width;
    const s = h.size;
    return [sx * nx * s, HEAD_PIVOT[1] + (y - HEAD_PIVOT[1]) * s, HEAD_PIVOT[2] + (z - HEAD_PIVOT[2]) * s];
  };
}

/** Full 16-point ring from a half row. */
function fullRing(half: HeadRow): V3[] {
  const pts: V3[] = [];
  for (let j = 0; j <= 8; j++) pts.push(half[j]);
  for (let j = 7; j >= 1; j--) pts.push([-half[j][0], half[j][1], half[j][2]]);
  return pts;
}

const FULL_ROWS = HEAD_ROWS.map(fullRing);

/** Surface sampler down one of the 16 columns, at any height, on the canonical head. */
function columnAt(j: number, y: number): V3 {
  const col = FULL_ROWS.map((r) => r[j]);
  if (y >= col[0][1]) {
    const p = col[0];
    const t = clamp01((y - p[1]) / (VERTEX[1] - p[1]));
    return [lerp(p[0], VERTEX[0], t), y, lerp(p[2], VERTEX[2], t)];
  }
  for (let i = 0; i < col.length - 1; i++) {
    const a = col[i];
    const b = col[i + 1];
    if (y <= a[1] && y >= b[1]) {
      const t = (a[1] - y) / (a[1] - b[1] || 1);
      return [lerp(a[0], b[0], t), y, lerp(a[2], b[2], t)];
    }
  }
  return col[col.length - 1];
}

/** Front-face depth at (x, y) on the canonical head (front half only). */
function faceZ(x: number, y: number): number {
  const ring = Array.from({ length: 6 }, (_, j) => columnAt(j, y));
  const ax = Math.abs(x);
  for (let j = 0; j < 5; j++) {
    if (ax >= ring[j][0] && ax <= ring[j + 1][0]) {
      const t = (ax - ring[j][0]) / (ring[j + 1][0] - ring[j][0] || 1);
      return lerp(ring[j][2], ring[j + 1][2], t);
    }
  }
  return ring[5][2];
}

/** Is a canonical point inside the faceted head? (Ring polygon test at its height.) */
function insideHead(p: V3): boolean {
  if (p[1] > VERTEX[1] || p[1] < 1.54) return false;
  const zc = -0.006;
  const ring = Array.from({ length: 16 }, (_, j) => columnAt(j, p[1]));
  const ang = (q: V3) => Math.atan2(q[0], q[2] - zc);
  const a = ang(p);
  const r = Math.hypot(p[0], p[2] - zc);
  for (let j = 0; j < 16; j++) {
    const q0 = ring[j];
    const q1 = ring[(j + 1) % 16];
    const a0 = ang(q0);
    let a1 = ang(q1);
    let aa = a;
    if (a1 < a0) a1 += Math.PI * 2;
    if (aa < a0) aa += Math.PI * 2;
    if (aa < a0 || aa > a1) continue;
    const t = (aa - a0) / (a1 - a0 || 1);
    const ex = lerp(q0[0], q1[0], t);
    const ez = lerp(q0[2], q1[2], t) - zc;
    return r <= Math.hypot(ex, ez);
  }
  return false;
}

/** Where a ray from `c` leaves the faceted head, plus a margin. */
function headSurface(d: V3, margin: number, c: V3 = HEAD_C): V3 {
  const u = norm(d);
  let lo = 0;
  let hi = 0.16;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (insideHead([c[0] + u[0] * mid, c[1] + u[1] * mid, c[2] + u[2] * mid])) lo = mid;
    else hi = mid;
  }
  const k = lo + margin;
  return [c[0] + u[0] * k, c[1] + u[1] * k, c[2] + u[2] * k];
}

const HEAD_W: W = { head: 1 };

function head(m: MeshBuilder, a: Athlete, gear: boolean): void {
  m.xform = headPush(a.head);
  m.loft(
    FULL_ROWS.map((pts) => ({ pts, w: HEAD_W })),
    { part: PART.head, symmetric: true, capStart: VERTEX, capEnd: [0, 1.552, 0.004] },
  );
  hair(m, a.hairShape);
  nose(m);
  brows(m, a.head);
  eyes(m, a.head);
  const mk = m.mark();
  ear(m);
  m.mirrorSince(mk);
  if (gear) headgear(m, a.hairShape);
  m.xform = null;
}

/** Hairline height per half column (front, round the left side, back). */
function hairline(h: HairShape): number[] {
  return [h.line, h.line - 0.001, h.line - 0.003, h.line - 0.009, 1.698, 1.646, 1.662, 1.614, 1.6];
}

function hair(m: MeshBuilder, h: HairShape): void {
  const line = hairline(h);
  const lineAt = (j: number) => line[j <= 8 ? j : 16 - j];
  const centre: V3 = [0, 1.66, -0.006];
  const thick = (y: number) => lerp(h.side, h.top, smooth(1.68, 1.745, y));
  // A shell from the hairline to the crown: thin at the edge so there is no helmet rim.
  const T = [0, 0.14, 0.4, 0.7, 0.92];
  const rings: Ring[] = T.map((t, k) => ({
    pts: Array.from({ length: 16 }, (_, j) => {
      const jj = j <= 8 ? j : 16 - j;
      // A sawtooth at the front edge: alternate columns dip lower.
      const saw = k === 0 && jj <= 4 && jj % 2 === 1 ? -0.007 : 0;
      const y = lerp(lineAt(j) + saw, 1.757, t);
      const p = columnAt(j, y);
      const d = norm(sub(p, centre));
      const th = k === 0 ? 0.0016 : thick(y) * (k === 1 ? 0.75 : 1);
      return add(p, d, th);
    }),
    w: HEAD_W,
  }));
  m.loft(rings, { part: PART.hair, symmetric: true, capEnd: [0, VERTEX[1] + h.top, -0.006] });

  // Chunky faceted tufts: a fringe over the forehead and a jagged crown. Each is a
  // three-sided pyramid lying on the shell and pointing along the hair's flow.
  const tuft = (base: V3, nrm: V3, flow: V3, len: number, width: number, lift: number) => {
    const n = norm(nrm);
    let f = sub(flow, [n[0] * dot(flow, n), n[1] * dot(flow, n), n[2] * dot(flow, n)]);
    f = norm(f);
    const s = norm(cross(n, f));
    const b = add(base, n, -0.002);
    const ring: V3[] = [add(b, s, width * 0.5), add(add(b, n, 0.0045), f, -width * 0.2), add(b, s, -width * 0.5)];
    const tip = add(add(b, f, len), n, len * lift + 0.002);
    m.loft([{ pts: ring, w: HEAD_W }], { part: PART.hair, capStart: add(b, f, -0.004), capEnd: tip });
  };
  const flowAt = (p: V3): V3 => {
    // Forward and to the sweep side on top; down at the back and sides.
    const back = smooth(-0.01, -0.07, p[2]);
    const side = smooth(1.71, 1.67, p[1]);
    const fwd: V3 = [h.sweep * 0.8, -0.15, 1];
    const down: V3 = [Math.sign(p[0]) * 0.2, -1, -0.3];
    const k = Math.max(back, side);
    return norm([lerp(fwd[0], down[0], k), lerp(fwd[1], down[1], k), lerp(fwd[2], down[2], k)]);
  };
  // Crown: rings of tufts by elevation, staggered.
  const DEG = Math.PI / 180;
  const crown: Array<[number, number]> = [];
  for (const [el, n0, spread] of [
    [74, 2, 60],
    [55, 4, 130],
    [36, 6, 210],
  ] as Array<[number, number, number]>) {
    for (let i = 0; i < n0; i++) {
      const az = n0 === 1 ? 0 : -spread / 2 + (spread * i) / (n0 - 1) + (el === 52 ? 6 : 0);
      crown.push([el, az]);
    }
  }
  crown.forEach(([el, az], i) => {
    const d: V3 = [Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), Math.cos(az * DEG) * Math.cos(el * DEG)];
    const p = headSurface(d, thick(1.74) * 0.9);
    const jit = hash(i, 4.1, h.seed);
    tuft(p, sub(p, HEAD_C), flowAt(p), h.chunk * (1.3 + 0.6 * jit), 0.042, h.lift * 0.5);
  });
  // Fringe: flat tufts laid down the forehead from just above the hairline, so the
  // hair edge is a jagged, chunky line rather than a cap rim.
  const nf = 6;
  for (let i = 0; i < nf; i++) {
    const az = -54 + (108 * i) / (nf - 1) + (hash(i, 2.2, h.seed) - 0.5) * 8;
    const yb = h.line + 0.012;
    const c: V3 = [0, yb, -0.006];
    const s0 = headSurface([Math.sin(az * DEG), 0, Math.cos(az * DEG)], 0, c);
    const nrm = norm([Math.sin(az * DEG), 0.25, Math.cos(az * DEG)]);
    const side: V3 = [Math.cos(az * DEG), 0, -Math.sin(az * DEG)];
    const base = add(s0, nrm, thick(yb) * 0.7);
    const f = norm(add(add([0, -1, 0], nrm, 0.22), side, h.sweep * 0.55 + Math.sin(az * DEG) * 0.3));
    const len = h.fringe * (0.8 + 0.45 * hash(i, 7.7, h.seed)) * (1 - 0.3 * (Math.abs(az) / 54) ** 2);
    const w = 0.03;
    const ring: V3[] = [add(base, side, w * 0.5), add(add(base, nrm, 0.004), f, -0.006), add(base, side, -w * 0.5)];
    const tip = add(add(base, f, len), nrm, 0.001 + h.lift * len * 0.6);
    m.loft([{ pts: ring, w: HEAD_W }], { part: PART.hair, capStart: add(base, nrm, -0.004), capEnd: tip });
  }
}

/**
 * The nose: a separate five-sided wedge (ridge, two side planes, two base edges set
 * into the face) so it reads as a few clean, hard planes instead of a spike in the
 * face lattice. The shader lights it from its true facet normals.
 */
function nose(m: MeshBuilder): void {
  // y, ridge z, side half-width, side z, base half-width, base z
  const spec: Array<[number, number, number, number, number, number]> = [
    [1.66, 0.096, 0.0055, 0.092, 0.0068, 0.088],
    [1.636, 0.105, 0.0068, 0.099, 0.0085, 0.091],
    [1.618, 0.1155, 0.0102, 0.105, 0.0128, 0.095],
    [1.608, 0.109, 0.0122, 0.102, 0.0128, 0.095],
  ];
  const rings: Ring[] = spec.map(([y, rz, sx, sz, bx, bz]) => ({
    pts: [
      [0, y, rz],
      [sx, y - 0.001, sz],
      [bx, y - 0.002, bz],
      [-bx, y - 0.002, bz],
      [-sx, y - 0.001, sz],
    ],
    w: HEAD_W,
  }));
  m.loft(rings, { part: PART.nose, capStart: true, capEnd: [0, 1.603, 0.102] });
}

function brows(m: MeshBuilder, h: HeadShape): void {
  const mk = m.mark();
  // Chunky prisms set into the brow ridge: inner, middle, outer tail.
  const xs = [0.01, 0.026, 0.044, 0.058];
  const arch = [0.0, 0.0024, 0.003, 0.0004].map((v) => v * h.browArch);
  const thick = [0.0068, 0.0066, 0.0056, 0.0034].map((v) => v * h.browThick);
  const base = EYE_Y + 0.0205 + h.browY;
  const rings: Ring[] = xs.map((x, i) => {
    // Outer tail drops a little; browTilt pulls the inner end down for a hard, level stare.
    const y = base + arch[i] - (i === 3 ? 0.004 * (1 - h.browTilt) : 0) - (i === 0 ? 0.0034 * h.browTilt : i === 1 ? 0.0012 * h.browTilt : 0);
    const z = faceZ(x, y) + 0.0008;
    const t = thick[i];
    const pts: V3[] = [
      [x, y + t * 0.55, z - 0.002],
      [x, y + t * 0.25, z + 0.0034 + h.brow * 0.3],
      [x - 0.0015, y - t * 0.5, z + 0.002],
      [x, y - t * 0.5, z - 0.005],
    ];
    return { pts, w: HEAD_W };
  });
  m.loft(rings, { part: PART.brow, capStart: true, capEnd: true });
  m.mirrorSince(mk);
}

function eyes(m: MeshBuilder, h: HeadShape): void {
  const lid = h.lid;
  const mk = m.mark();
  const cx = 0.032;
  const cz = 0.0832;
  const r = 0.0118;
  const c: V3 = [cx, EYE_Y, cz];
  // A faceted eyeball, pole forward, set back in the socket.
  const rings: Ring[] = [];
  for (const phi of [0.45, 0.95, 1.5, 2.3]) {
    const pts: V3[] = [];
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2 + Math.PI / 8;
      pts.push([c[0] + Math.sin(phi) * Math.cos(a) * r, c[1] + Math.sin(phi) * Math.sin(a) * r, c[2] + Math.cos(phi) * r]);
    }
    rings.push({ pts, w: HEAD_W });
  }
  m.loft(rings, { part: PART.eyeWhite, capStart: [c[0], c[1], c[2] + r], capEnd: [c[0], c[1], c[2] - r] });
  // The iris, pupil and catchlight are painted on the ball in the shader: a big,
  // dark, graphic iris with one hard catchlight reads at any distance.
  // Lids: an upper awning with a dark lash line, and a lower lid, wrapped on the ball.
  const onBall = (x: number, y: number, lift: number): number => {
    const dx = x - cx;
    const dy = y - EYE_Y;
    return cz + Math.sqrt(Math.max(0, r * r - dx * dx - dy * dy)) + lift;
  };
  const us = [-0.95, -0.5, 0.05, 0.55, 0.95];
  const upper: Ring[] = [];
  const lash: Ring[] = [];
  const lower: Ring[] = [];
  for (const u of us) {
    const x = cx + u * 0.0152;
    const k = 1 - u * u;
    // Almond: the upper lid peaks a little inside of centre, the lower is flatter.
    const yU = EYE_Y + 0.0012 + (0.0048 - lid) * Math.sqrt(k) + 0.0006 * u;
    const yL = EYE_Y - 0.0022 - (0.0034 - 0.0016 * h.grin) * Math.sqrt(k) + 0.0008 * u + 0.0008 * h.grin;
    const zU = onBall(x, yU, 0.0011);
    const zL = onBall(x, yL, 0.0008);
    upper.push({
      pts: [
        [x, yU + 0.0006, zU + 0.0009],
        [x, yU + 0.0055, zU + 0.0003],
        [x, yU + 0.0095, zU - 0.006],
        [x, yU - 0.0002, zU - 0.0035],
      ],
      w: HEAD_W,
    });
    lash.push({
      pts: [
        [x, yU - 0.0006 - 0.0005 * k, zU + 0.0013],
        [x, yU + 0.001, zU + 0.0012],
        [x, yU + 0.0002, zU - 0.002],
      ],
      w: HEAD_W,
    });
    lower.push({
      pts: [
        [x, yL - 0.0002, zL + 0.0008],
        [x, yL - 0.0045, zL - 0.0008],
        [x, yL - 0.0045, zL - 0.006],
        [x, yL + 0.0003, zL - 0.003],
      ],
      w: HEAD_W,
    });
  }
  m.loft(upper, { part: PART.lid, capStart: true, capEnd: true });
  m.loft(lash, { part: PART.lash, capStart: true, capEnd: true });
  m.loft(lower, { part: PART.lid, capStart: true, capEnd: true });
  m.mirrorSince(mk);
}

function ear(m: MeshBuilder): void {
  const spec: Array<[number, number, number, number, number]> = [
    // y, x centre, z centre, half thickness, half width
    [1.607, 0.072, -0.002, 0.006, 0.009],
    [1.622, 0.075, -0.006, 0.0085, 0.015],
    [1.645, 0.077, -0.012, 0.009, 0.018],
    [1.664, 0.076, -0.017, 0.008, 0.014],
  ];
  const rings: Ring[] = spec.map(([y, x, z, t, w]) => ({
    pts: Array.from({ length: 6 }, (_, j) => {
      const a = (j / 6) * Math.PI * 2;
      return [x + Math.sin(a) * t, y, z + Math.cos(a) * w] as V3;
    }),
    w: HEAD_W,
  }));
  m.loft(rings, { part: PART.skin, capStart: true, capEnd: [0.074, 1.674, -0.019] });
}

/* --------------------------------------------------------------- headgear -- */

function headgear(m: MeshBuilder, hair: HairShape): void {
  // Straps ride on top of the hair, pressing it a little.
  const lift = hair.top + 0.002;
  const strap = (path: V3[], width: number, thick: number, part: number, centre: V3 = HEAD_C) => {
    const rings: Ring[] = path.map((p, i) => {
      const d = i === 0 ? sub(path[1], path[0]) : i === path.length - 1 ? sub(p, path[i - 1]) : sub(path[i + 1], path[i - 1]);
      const [u, v] = frame(d, sub(p, centre));
      // u: out from the skull, v: across the strap.
      const pts: V3[] = [add(add(p, u, thick), v, width), add(add(p, u, thick), v, -width), add(add(p, u, -thick), v, -width), add(add(p, u, -thick), v, width)];
      return { pts, w: HEAD_W };
    });
    m.loft(rings, { part, capStart: true, capEnd: true });
  };
  const DEG = Math.PI / 180;

  // Crown strap: over the top, leaning a little back.
  const crown: V3[] = [];
  for (let a = -96; a <= 96; a += 16) {
    const r = a * DEG;
    crown.push(headSurface([Math.sin(r), Math.cos(r), -0.24], lerp(hair.side + 0.003, lift + 0.001, Math.cos(r) ** 2)));
  }
  strap(crown, 0.011, 0.0025, PART.strap);
  // Two straps round the back of the head.
  for (const [e0, e1] of [
    [-0.08, 0.62],
    [-0.2, -0.6],
  ]) {
    const path: V3[] = [];
    for (let a = 88; a <= 272; a += 23) {
      const r = a * DEG;
      const t = 1 - Math.abs(a - 180) / 92;
      path.push(headSurface([Math.sin(r), lerp(e0, e1, smooth(0, 1, t)), Math.cos(r)], hair.side + hair.chunk * 0.3 + 0.003));
    }
    strap(path, 0.0095, 0.0025, PART.strap);
  }

  // Chin strap: from each cup, down along the jaw line and under the chin.
  const R = HEAD_ROWS;
  const out = (p: V3, k: number, c: V3 = [0, 1.6, -0.01]): V3 => add(p, norm(sub(p, c)), k);
  const half: V3[] = [
    [0.084, 1.61, 0.004],
    out(lerpV(R[9][5], R[10][5], 0.72), 0.003),
    out(lerpV(R[10][4], R[11][4], 0.68), 0.003),
    out(lerpV(R[10][3], R[11][3], 0.8), 0.003),
    out(lerpV(R[10][2], R[11][2], 0.88), 0.0028),
    out(lerpV(R[10][1], R[11][1], 0.93), 0.0028),
  ];
  const chinPath = [...half, out(lerpV(R[10][0], R[11][0], 0.95), 0.0028), ...half.slice().reverse().map((p): V3 => [-p[0], p[1], p[2]])];
  // A slim strap in the team colour, a few mm under the jaw line.
  strap(chinPath, 0.0038, 0.0016, PART.strap, [0, 1.6, -0.01]);

  // Ear cups: flat faceted ovals hugging the skull, with a rim.
  const mk = m.mark();
  const cupY = 1.637;
  const cupZ = -0.01;
  // A rounded oval cup: a rim ring against the skull, the shell, and a domed face.
  const cup: Array<[number, number, number]> = [
    [0.07, 0.034, 0.03],
    [0.083, 0.035, 0.031],
    [0.09, 0.032, 0.028],
    [0.0945, 0.022, 0.019],
  ];
  const cupRings: Ring[] = cup.map(([x, hy, hz]) => ({
    pts: Array.from({ length: 8 }, (_, j) => {
      const a = (j / 8) * Math.PI * 2 + Math.PI / 8;
      return [x, cupY + Math.cos(a) * hy, cupZ + Math.sin(a) * hz] as V3;
    }),
    w: HEAD_W,
  }));
  m.loft(cupRings, { part: PART.gear, capStart: true, capEnd: [0.0965, cupY, cupZ] });
  m.mirrorSince(mk);
}

function lerpV(a: V3, b: V3, t: number): V3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/* ------------------------------------------------------------------ build -- */

export interface BuiltBody {
  geometry: BufferGeometry;
  triangles: number;
  ms: number;
}

export function buildBody(a: Athlete, opts: { headgear: boolean } = { headgear: true }): BuiltBody {
  const t0 = performance.now();
  const m = new MeshBuilder();
  const hipHalf = torso(m, a.body);
  neck(m, a.body);
  const limbs = m.mark();
  arm(m, a.body);
  hand(m, a.body);
  leg(m, a.body, hipHalf);
  shoe(m);
  m.mirrorSince(limbs);
  head(m, a, opts.headgear);
  // Blend shading normals across the body's part joins (not the head details).
  m.weldParts = [PART.torso, PART.leg, PART.arm, PART.skin];
  const geometry = m.geometry(a.height / 1.76);
  return { geometry, triangles: m.idx.length / 3, ms: performance.now() - t0 };
}
