import { Kind, Part, Prim } from './sdf';
import { m3FromEuler } from './math';
import type { M3, V3 } from './math';

/**
 * Wrestling headgear: two vented ear cups, a crown strap, two straps round the
 * back of the head and a chin strap with a chin cup. It is rigid, so it is built
 * in head space (the head bone's rest position is the origin) and simply rides
 * on the head bone.
 */

/** Rest-space position of the head joint for the canonical body. */
export const HEAD_ORIGIN: V3 = [0, 1.575, -0.005];

function frameFromTangent(t: V3, n: V3): M3 {
  // Columns: tangent, normal, binormal — a right-handed local->world frame.
  const tl = Math.hypot(t[0], t[1], t[2]) || 1;
  const tx = t[0] / tl;
  const ty = t[1] / tl;
  const tz = t[2] / tl;
  // Remove the tangent component from n.
  const dot = n[0] * tx + n[1] * ty + n[2] * tz;
  let nx = n[0] - dot * tx;
  let ny = n[1] - dot * ty;
  let nz = n[2] - dot * tz;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl;
  ny /= nl;
  nz /= nl;
  const bx = ty * nz - tz * ny;
  const by = tz * nx - tx * nz;
  const bz = tx * ny - ty * nx;
  return Float64Array.from([tx, nx, bx, ty, ny, by, tz, nz, bz]);
}

function strapPiece(c: V3, tangent: V3, normal: V3, len: number, thick: number, width: number): Prim {
  const p = new Prim();
  p.kind = Kind.Ellipsoid;
  [p.cx, p.cy, p.cz] = c;
  p.rx = len;
  p.ry = thick;
  p.rz = width;
  p.m = frameFromTangent(tangent, normal);
  p.k = 0.006;
  p.part = Part.Head;
  p.bcx = c[0];
  p.bcy = c[1];
  p.bcz = c[2];
  p.brad = Math.max(len, thick, width) * 1.1;
  return p;
}

function ellipsoid(c: V3, r: V3, k: number, sub = false, rot?: V3): Prim {
  const p = new Prim();
  p.kind = Kind.Ellipsoid;
  [p.cx, p.cy, p.cz] = c;
  [p.rx, p.ry, p.rz] = r;
  if (rot) p.m = m3FromEuler(rot[0], rot[1], rot[2]);
  p.k = k;
  p.sub = sub;
  p.part = Part.Head;
  p.bcx = c[0];
  p.bcy = c[1];
  p.bcz = c[2];
  p.brad = Math.max(r[0], r[1], r[2]) * 1.05;
  return p;
}

/** Headgear primitives in canonical rest space (scale applied by the caller). */
export function headgearPrims(scale: number): Prim[] {
  const prims: Prim[] = [];
  const s = (v: V3): V3 => [v[0] * scale, v[1] * scale, v[2] * scale];

  // Ear cups with a softer rim against the head.
  for (const side of [1, -1]) {
    prims.push(ellipsoid(s([0.095 * side, 1.652, -0.006]), s([0.017, 0.046, 0.037]), 0.004 * scale));
    prims.push(ellipsoid(s([0.088 * side, 1.652, -0.006]), s([0.011, 0.051, 0.042]), 0.006 * scale));
  }

  // Crown strap: an arc over the top of the head.
  const cx = 0;
  const cy = 1.668;
  const ax = 0.076 + 0.014;
  const ay = 0.097 + 0.013;
  const z0 = -0.014;
  for (let deg = -64; deg <= 64; deg += 4) {
    const phi = (deg * Math.PI) / 180;
    const c: V3 = [cx + Math.sin(phi) * ax, cy + Math.cos(phi) * ay, z0];
    const t: V3 = [Math.cos(phi) * ax, -Math.sin(phi) * ay, 0];
    const n: V3 = [Math.sin(phi), Math.cos(phi), 0];
    prims.push(strapPiece(s(c), t, n, 0.009 * scale, 0.0035 * scale, 0.012 * scale));
  }

  // Two straps around the back of the head.
  const back = (y: number, a: number, b: number, zc: number, from: number) => {
    for (let deg = from; deg <= 360 - from; deg += 5) {
      const th = (deg * Math.PI) / 180;
      const c: V3 = [Math.sin(th) * a, y, zc + Math.cos(th) * b];
      const t: V3 = [Math.cos(th) * a, 0, -Math.sin(th) * b];
      const n: V3 = [Math.sin(th) / a, 0, Math.cos(th) / b];
      prims.push(strapPiece(s(c), t, n, 0.008 * scale, 0.0035 * scale, 0.009 * scale));
    }
  };
  back(1.706, 0.084, 0.103, -0.004, 100);
  back(1.618, 0.074, 0.112, -0.002, 104);

  // Chin strap down from each cup to a cup under the chin.
  const chinPath: V3[] = [
    [0.09, 1.61, -0.002],
    [0.078, 1.584, 0.016],
    [0.062, 1.558, 0.036],
    [0.043, 1.536, 0.056],
    [0.022, 1.522, 0.074],
  ];
  for (const side of [1, -1]) {
    for (let i = 0; i < chinPath.length - 1; i++) {
      const a = chinPath[i];
      const b = chinPath[i + 1];
      for (let f = 0; f < 1; f += 0.34) {
        const c: V3 = [
          (a[0] + (b[0] - a[0]) * f) * side,
          a[1] + (b[1] - a[1]) * f,
          a[2] + (b[2] - a[2]) * f,
        ];
        const t: V3 = [(b[0] - a[0]) * side, b[1] - a[1], b[2] - a[2]];
        const n: V3 = [c[0], 0, c[2] - 0.0];
        prims.push(strapPiece(s(c), t, n, 0.009 * scale, 0.003 * scale, 0.007 * scale));
      }
    }
  }
  prims.push(ellipsoid(s([0, 1.528, 0.086]), s([0.027, 0.02, 0.015]), 0.006 * scale, false, [24, 0, 0]));

  // Vents on each cup.
  for (const side of [1, -1]) {
    prims.push(ellipsoid(s([0.113 * side, 1.668, -0.006]), s([0.006, 0.006, 0.006]), 0.002 * scale, true));
    prims.push(ellipsoid(s([0.113 * side, 1.646, 0.006]), s([0.005, 0.005, 0.005]), 0.002 * scale, true));
    prims.push(ellipsoid(s([0.113 * side, 1.646, -0.018]), s([0.005, 0.005, 0.005]), 0.002 * scale, true));
  }

  prims.sort((a, b) => Number(a.sub) - Number(b.sub));
  return prims;
}
