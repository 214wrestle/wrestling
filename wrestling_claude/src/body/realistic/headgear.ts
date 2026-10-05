import { Kind, Prim } from '../sdf';
import type { Part } from '../sdf';
import { m3FromEuler } from '../math';
import type { M3, V3 } from '../math';

/** Headgear part ids for the gear shader: hard shell, webbing straps, foam rim. */
export const GEAR = { Shell: 0, Strap: 1, Foam: 2 } as const;

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
  const p = strapPrim(c, tangent, normal, len, thick, width);
  p.part = GEAR.Strap as Part;
  return p;
}

function strapPrim(c: V3, tangent: V3, normal: V3, len: number, thick: number, width: number): Prim {
  const p = new Prim();
  p.kind = Kind.Ellipsoid;
  [p.cx, p.cy, p.cz] = c;
  p.rx = len;
  p.ry = thick;
  p.rz = width;
  p.m = frameFromTangent(tangent, normal);
  p.k = 0.006;
  p.bcx = c[0];
  p.bcy = c[1];
  p.bcz = c[2];
  p.brad = Math.max(len, thick, width) * 1.1;
  return p;
}

function ellipsoid(c: V3, r: V3, k: number, sub = false, rot?: V3, part: number = GEAR.Shell): Prim {
  const p = new Prim();
  p.kind = Kind.Ellipsoid;
  [p.cx, p.cy, p.cz] = c;
  [p.rx, p.ry, p.rz] = r;
  if (rot) p.m = m3FromEuler(rot[0], rot[1], rot[2]);
  p.k = k;
  p.sub = sub;
  p.part = part as Part;
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
    prims.push(ellipsoid(s([0.097 * side, 1.638, -0.008]), s([0.016, 0.045, 0.036]), 0.004 * scale));
    prims.push(ellipsoid(s([0.089 * side, 1.638, -0.008]), s([0.01, 0.05, 0.041]), 0.006 * scale, false, undefined, GEAR.Foam));
  }

  // Crown strap: an arc over the top of the head.
  const cx = 0;
  const cy = 1.672;
  const ax = 0.0775 + 0.0145;
  const ay = 0.103;
  const z0 = -0.014;
  for (let deg = -64; deg <= 64; deg += 4) {
    const phi = (deg * Math.PI) / 180;
    const c: V3 = [cx + Math.sin(phi) * ax, cy + Math.cos(phi) * ay, z0];
    const t: V3 = [Math.cos(phi) * ax, -Math.sin(phi) * ay, 0];
    const n: V3 = [Math.sin(phi), Math.cos(phi), 0];
    prims.push(strapPiece(s(c), t, n, 0.009 * scale, 0.0042 * scale, 0.013 * scale));
  }

  // Two straps around the back of the head.
  const back = (y: number, a: number, b: number, zc: number, from: number) => {
    for (let deg = from; deg <= 360 - from; deg += 5) {
      const th = (deg * Math.PI) / 180;
      const c: V3 = [Math.sin(th) * a, y, zc + Math.cos(th) * b];
      const t: V3 = [Math.cos(th) * a, 0, -Math.sin(th) * b];
      const n: V3 = [Math.sin(th) / a, 0, Math.cos(th) / b];
      prims.push(strapPiece(s(c), t, n, 0.008 * scale, 0.0042 * scale, 0.0105 * scale));
    }
  };
  back(1.706, 0.084, 0.103, -0.004, 100);
  back(1.618, 0.074, 0.112, -0.002, 104);

  // Chin strap down from each cup to a cup under the chin.
  const chinPath: V3[] = [
    [0.09, 1.6, -0.002],
    [0.078, 1.582, 0.018],
    [0.064, 1.564, 0.038],
    [0.045, 1.546, 0.058],
    [0.024, 1.534, 0.074],
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
  prims.push(ellipsoid(s([0, 1.538, 0.082]), s([0.026, 0.019, 0.013]), 0.006 * scale, false, [24, 0, 0], GEAR.Foam));

  // Vents on each cup.
  for (const side of [1, -1]) {
    // A ring of vents round the cup centre.
    prims.push(ellipsoid(s([0.115 * side, 1.638, -0.008]), s([0.006, 0.0062, 0.0062]), 0.0015 * scale, true));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      prims.push(
        ellipsoid(s([0.113 * side, 1.638 + Math.cos(a) * 0.024, -0.008 + Math.sin(a) * 0.02]), s([0.006, 0.0042, 0.0042]), 0.0015 * scale, true),
      );
    }
  }

  prims.sort((a, b) => Number(a.sub) - Number(b.sub));
  return prims;
}
