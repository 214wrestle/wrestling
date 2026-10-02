/**
 * Tiny dependency-free maths for the body generator, which also runs inside a
 * worker. Matrices are 3x3, row-major; conventions match three.js so rotations
 * authored here mean the same thing to the animation side.
 */

export type V3 = [number, number, number];
export type M3 = Float64Array;

const DEG = Math.PI / 180;

export const m3Identity = (): M3 => Float64Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);

/** Rotation matrix for three.js Euler order 'XYZ', angles in degrees. */
export function m3FromEuler(xd: number, yd: number, zd: number): M3 {
  const x = xd * DEG;
  const y = yd * DEG;
  const z = zd * DEG;
  const a = Math.cos(x);
  const b = Math.sin(x);
  const c = Math.cos(y);
  const d = Math.sin(y);
  const e = Math.cos(z);
  const f = Math.sin(z);
  const ae = a * e;
  const af = a * f;
  const be = b * e;
  const bf = b * f;
  return Float64Array.from([
    c * e,
    -c * f,
    d,
    af + be * d,
    ae - bf * d,
    -b * c,
    bf - ae * d,
    be + af * d,
    a * c,
  ]);
}

export function m3Mul(a: M3, b: M3): M3 {
  const o = new Float64Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return o;
}

export function m3Apply(m: M3, v: V3): V3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
