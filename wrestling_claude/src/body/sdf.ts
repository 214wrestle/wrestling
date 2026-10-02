import { BONE_COUNT } from './skeleton';
import type { M3, V3 } from './math';

/**
 * Signed distance primitives for building bodies.
 *
 * A body is a smooth union of anatomical masses — round cones for limbs,
 * ellipsoids for muscles, rounded boxes for hands and soles. Each primitive also
 * carries the bones it belongs to, so the same description that shapes the
 * surface decides how that surface is skinned.
 */

export const enum Kind {
  Cone = 0,
  Ellipsoid = 1,
  Box = 2,
}

export const enum Part {
  Torso = 0,
  Head = 1,
  Arm = 2,
  Hand = 3,
  Leg = 4,
  Foot = 5,
  Hair = 6,
}

export class Prim {
  kind: Kind = Kind.Ellipsoid;
  // Round cone.
  ax = 0;
  ay = 0;
  az = 0;
  bx = 0;
  by = 0;
  bz = 0;
  ra = 0;
  rb = 0;
  // Ellipsoid / box: centre, radii (half extents), local->world rotation (row-major).
  cx = 0;
  cy = 0;
  cz = 0;
  rx = 0;
  ry = 0;
  rz = 0;
  m: M3 = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  round = 0;
  /** Smooth-union blend radius. */
  k = 0;
  sub = false;
  /** Unioned after carving, so it can sit inside a carved cavity. */
  late = false;
  /** Optional clip half-space: keep where dot(p - c, n) <= 0. */
  clip: { c: V3; n: V3; k: number } | null = null;
  /** Amplitude of surface noise, for hair. */
  noise = 0;
  // Bounding sphere.
  bcx = 0;
  bcy = 0;
  bcz = 0;
  brad = 0;
  // Skinning: weights at t=0 and t=1 along the main axis, eased between t0..t1.
  w0 = new Float32Array(BONE_COUNT);
  w1 = new Float32Array(BONE_COUNT);
  t0 = 0;
  t1 = 1;
  /** Main axis for ellipsoids / boxes (0=x,1=y,2=z in local space). */
  axis = 1;
  part: Part = Part.Torso;
  /** How strongly this primitive claims vertices for skinning. */
  claim = 1;
}

/* ------------------------------------------------------------ distance ---- */

function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise, roughly -1..1. */
export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);
  const x00 = n000 + (n100 - n000) * ux;
  const x10 = n010 + (n110 - n010) * ux;
  const x01 = n001 + (n101 - n001) * ux;
  const x11 = n011 + (n111 - n011) * ux;
  const y0 = x00 + (x10 - x00) * uy;
  const y1 = x01 + (x11 - x01) * uy;
  return (y0 + (y1 - y0) * uz) * 2 - 1;
}

/** Inigo Quilez's exact round cone. */
function sdRoundCone(
  px: number,
  py: number,
  pz: number,
  p: Prim,
): number {
  const bax = p.bx - p.ax;
  const bay = p.by - p.ay;
  const baz = p.bz - p.az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = p.ra - p.rb;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - p.ax;
  const pay = py - p.ay;
  const paz = pz - p.az;
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const xvx = pax * l2 - bax * y;
  const xvy = pay * l2 - bay * y;
  const xvz = paz * l2 - baz * y;
  const x2 = xvx * xvx + xvy * xvy + xvz * xvz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - p.rb;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - p.ra;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - p.ra;
}

/** Distance from one primitive, ignoring blending. */
export function primDistance(p: Prim, x: number, y: number, z: number): number {
  let d: number;
  if (p.kind === Kind.Cone) {
    d = sdRoundCone(x, y, z, p);
  } else {
    const dx = x - p.cx;
    const dy = y - p.cy;
    const dz = z - p.cz;
    const m = p.m;
    // World -> local is the transpose of local -> world.
    const lx = m[0] * dx + m[3] * dy + m[6] * dz;
    const ly = m[1] * dx + m[4] * dy + m[7] * dz;
    const lz = m[2] * dx + m[5] * dy + m[8] * dz;
    if (p.kind === Kind.Ellipsoid) {
      const ex = lx / p.rx;
      const ey = ly / p.ry;
      const ez = lz / p.rz;
      const fx = ex / p.rx;
      const fy = ey / p.ry;
      const fz = ez / p.rz;
      const k0 = Math.sqrt(ex * ex + ey * ey + ez * ez);
      const k1 = Math.sqrt(fx * fx + fy * fy + fz * fz);
      d = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(p.rx, p.ry, p.rz);
    } else {
      const r = p.round;
      const qx = Math.abs(lx) - p.rx + r;
      const qy = Math.abs(ly) - p.ry + r;
      const qz = Math.abs(lz) - p.rz + r;
      const ox = qx > 0 ? qx : 0;
      const oy = qy > 0 ? qy : 0;
      const oz = qz > 0 ? qz : 0;
      const inner = qx > qy ? (qx > qz ? qx : qz) : qy > qz ? qy : qz;
      d = Math.sqrt(ox * ox + oy * oy + oz * oz) + (inner < 0 ? inner : 0) - r;
    }
  }
  if (p.clip) {
    const c = p.clip;
    const h = (x - c.c[0]) * c.n[0] + (y - c.c[1]) * c.n[1] + (z - c.c[2]) * c.n[2];
    d = smax(d, h, c.k);
  }
  if (p.noise !== 0) {
    d -= p.noise * (0.5 + 0.5 * noise3(x * 95, y * 95, z * 95));
  }
  return d;
}

export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

/** Smooth union of a subset of primitives (additive first, then carves). */
export function unionDistance(prims: Prim[], idx: ArrayLike<number>, x: number, y: number, z: number): number {
  let d = 1e9;
  for (let i = 0; i < idx.length; i++) {
    const p = prims[idx[i]];
    const pd = primDistance(p, x, y, z);
    d = p.sub ? smax(d, -pd, p.k) : smin(d, pd, p.k);
  }
  return d;
}

/** Normalised position of a point along a primitive's main axis, 0..1. */
export function primAxisT(p: Prim, x: number, y: number, z: number): number {
  if (p.kind === Kind.Cone) {
    const bax = p.bx - p.ax;
    const bay = p.by - p.ay;
    const baz = p.bz - p.az;
    const l2 = bax * bax + bay * bay + baz * baz || 1;
    const t = ((x - p.ax) * bax + (y - p.ay) * bay + (z - p.az) * baz) / l2;
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }
  const dx = x - p.cx;
  const dy = y - p.cy;
  const dz = z - p.cz;
  const m = p.m;
  const local =
    p.axis === 0
      ? m[0] * dx + m[3] * dy + m[6] * dz
      : p.axis === 1
        ? m[1] * dx + m[4] * dy + m[7] * dz
        : m[2] * dx + m[5] * dy + m[8] * dz;
  const r = p.axis === 0 ? p.rx : p.axis === 1 ? p.ry : p.rz;
  const t = 0.5 + local / (2 * r);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
