import { primDistance as baseDistance, smax } from '../../../body/sdf';
import type { Prim } from '../../../body/sdf';
import type { M3, V3 } from '../../../body/math';

/**
 * The game's SDF primitives plus one extra the face needs: a private carve.
 * A primitive may carry an ellipsoid `cut` that is subtracted from that
 * primitive alone before it joins the union. That is how the eyelids get an
 * almond aperture (a lid shell with a hole) and how lip edges get a crisp
 * parting line, without carving the neighbouring masses.
 */

export interface Cut {
  c: V3;
  /** Half extents. */
  r: V3;
  /** Local->world rotation, row-major (as Prim.m). */
  m: M3;
  /** Blend radius of the carve. */
  k: number;
}

/** Extra clip half-space: keep where dot(p - c, n) <= 0, blended over k. */
export interface Plane {
  c: V3;
  n: V3;
  k: number;
  /** Above this height the plane bends away (recedes by fk per metre), so it only trims below. */
  fy?: number;
  fk?: number;
}

export type PrimX = Prim & { cut?: Cut | null; planes?: Plane[] | null };

function ellipsoid(c: Cut, x: number, y: number, z: number): number {
  const dx = x - c.c[0];
  const dy = y - c.c[1];
  const dz = z - c.c[2];
  const m = c.m;
  const lx = m[0] * dx + m[3] * dy + m[6] * dz;
  const ly = m[1] * dx + m[4] * dy + m[7] * dz;
  const lz = m[2] * dx + m[5] * dy + m[8] * dz;
  const ex = lx / c.r[0];
  const ey = ly / c.r[1];
  const ez = lz / c.r[2];
  const fx = ex / c.r[0];
  const fy = ey / c.r[1];
  const fz = ez / c.r[2];
  const k0 = Math.sqrt(ex * ex + ey * ey + ez * ez);
  const k1 = Math.sqrt(fx * fx + fy * fy + fz * fz);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(c.r[0], c.r[1], c.r[2]);
}

export function primDistance(p: PrimX, x: number, y: number, z: number): number {
  let d = baseDistance(p, x, y, z);
  const pl = p.planes;
  if (pl) {
    for (let i = 0; i < pl.length; i++) {
      const q = pl[i];
      let h = (x - q.c[0]) * q.n[0] + (y - q.c[1]) * q.n[1] + (z - q.c[2]) * q.n[2];
      if (q.fy !== undefined) {
        // Smooth bend (quadratic over 2w, then linear), so there is no crease.
        const w = 0.02;
        const t = y - (q.fy - w);
        if (t > 0) h -= (q.fk ?? 1) * (t < 2 * w ? (t * t) / (4 * w) : t - w);
      }
      d = smax(d, h, q.k);
    }
  }
  const c = p.cut;
  if (!c) return d;
  return smax(d, -ellipsoid(c, x, y, z), c.k);
}
