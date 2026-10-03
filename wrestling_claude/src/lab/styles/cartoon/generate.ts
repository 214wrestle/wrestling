import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { polygonize } from '../../../body/mesher';
import type { MeshData } from '../../../body/mesher';
import { Kind, Prim, primDistance, smax, smin } from '../../../body/sdf';
import { m3FromEuler } from '../../../body/math';
import type { M3, V3 } from '../../../body/math';
import { buildToonPrims, headPoint, PART } from './anatomy';
import type { ToonShape } from './anatomy';

/**
 * Turns a ToonShape into skinnable geometry: body at a working resolution, the
 * head and both hands again at a finer one, and a rigid headgear in head-bone
 * space. Pure maths apart from the final BufferGeometry wrap, so in the game it
 * would run in the existing body worker and be cached exactly like today.
 */

export interface ToonGeometry {
  body: BufferGeometry;
  head: BufferGeometry;
  hands: BufferGeometry[];
  headgear: BufferGeometry;
  ms: number;
  tris: number;
  /** Triangles per piece: body, head, hands, headgear. */
  parts: number[];
}

/** Rest-space head joint for the canonical body (matches BONES). */
export const HEAD_ORIGIN: V3 = [0, 1.575, -0.005];

interface Box {
  min: V3;
  max: V3;
}

function bounds(prims: Prim[], pad: number): Box {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    if (p.sub) continue;
    min[0] = Math.min(min[0], p.bcx - p.brad);
    min[1] = Math.min(min[1], p.bcy - p.brad);
    min[2] = Math.min(min[2], p.bcz - p.brad);
    max[0] = Math.max(max[0], p.bcx + p.brad);
    max[1] = Math.max(max[1], p.bcy + p.brad);
    max[2] = Math.max(max[2], p.bcz + p.brad);
  }
  return {
    min: [min[0] - pad, Math.max(-pad, min[1] - pad), min[2] - pad],
    max: [max[0] + pad, max[1] + pad, max[2] + pad],
  };
}

const inside = (b: Box, x: number, y: number, z: number, shrink = 0) =>
  x > b.min[0] + shrink && x < b.max[0] - shrink && y > b.min[1] + shrink && y < b.max[1] - shrink && z > b.min[2] + shrink && z < b.max[2] - shrink;

/**
 * Mean-curvature estimate per vertex from the field normals (1/m; negative in
 * creases). Drives the painted ink in folds: armpits, under the pecs, behind
 * the knee, between fingers.
 */
function curvature(m: MeshData): Float32Array {
  const n = m.positions.length / 3;
  const P = m.positions;
  const N = m.normals;
  const sum = new Float32Array(n);
  const cnt = new Float32Array(n);
  const I = m.indices;
  const edge = (a: number, b: number) => {
    const dx = P[b * 3] - P[a * 3];
    const dy = P[b * 3 + 1] - P[a * 3 + 1];
    const dz = P[b * 3 + 2] - P[a * 3 + 2];
    const l2 = dx * dx + dy * dy + dz * dz;
    if (l2 < 1e-12) return;
    const k = ((N[b * 3] - N[a * 3]) * dx + (N[b * 3 + 1] - N[a * 3 + 1]) * dy + (N[b * 3 + 2] - N[a * 3 + 2]) * dz) / l2;
    sum[a] += k;
    cnt[a]++;
    sum[b] += k;
    cnt[b]++;
  };
  const nb: number[][] = Array.from({ length: n }, () => []);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t];
    const b = I[t + 1];
    const c = I[t + 2];
    edge(a, b);
    edge(b, c);
    edge(c, a);
    nb[a].push(b, c);
    nb[b].push(a, c);
    nb[c].push(a, b);
  }
  let k = new Float32Array(n);
  for (let i = 0; i < n; i++) k[i] = cnt[i] ? sum[i] / cnt[i] : 0;
  // Relax so the crease reads as a soft stroke rather than grid noise.
  for (let it = 0; it < 3; it++) {
    const o = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const l = nb[i];
      if (!l.length) {
        o[i] = k[i];
        continue;
      }
      let s = 0;
      for (const j of l) s += k[j];
      o[i] = k[i] * 0.4 + (s / l.length) * 0.6;
    }
    k = o;
  }
  return k;
}

/**
 * Shading normals for cel bands: the field normals averaged over a few rings,
 * so the hard terminator follows the big forms instead of every blended bump.
 */
function smoothNormals(m: MeshData, iterations: number): Float32Array {
  const n = m.positions.length / 3;
  const part = m.part;
  const I = m.indices;
  const nb: number[][] = Array.from({ length: n }, () => []);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t];
    const b = I[t + 1];
    const c = I[t + 2];
    nb[a].push(b, c);
    nb[b].push(a, c);
    nb[c].push(a, b);
  }
  let cur = Float32Array.from(m.normals);
  for (let it = 0; it < iterations; it++) {
    const o = new Float32Array(cur.length);
    for (let i = 0; i < n; i++) {
      let x = cur[i * 3];
      let y = cur[i * 3 + 1];
      let z = cur[i * 3 + 2];
      const hairI = part[i] > 5.5 && part[i] < 6.5;
      for (const j of nb[i]) {
        // Hair and skin smooth separately so the hairline keeps its edge.
        const wj = (part[j] > 5.5 && part[j] < 6.5) === hairI ? 0.5 : 0.04;
        x += cur[j * 3] * wj;
        y += cur[j * 3 + 1] * wj;
        z += cur[j * 3 + 2] * wj;
      }
      const l = Math.hypot(x, y, z) || 1;
      o[i * 3] = x / l;
      o[i * 3 + 1] = y / l;
      o[i * 3 + 2] = z / l;
    }
    cur = o;
  }
  return cur;
}

/**
 * Cel-shading normals from a "puffed" body: the gradient of the field sampled a
 * few centimetres outside the surface, where every muscle bump has melted into
 * the big forms. Terminators then sweep across a limb or the ribcage as one
 * clean shape instead of breaking up over each blended mass. Mixed with a
 * little of the mesh-smoothed normal so silhouettes still turn properly.
 */
function offsetNormals(prims: Prim[], m: MeshData, d: number, keepLocal: number, smooth: Float32Array, only?: (i: number) => boolean): Float32Array {
  const P = m.positions;
  const N = m.normals;
  const n = P.length / 3;
  const out = new Float32Array(P.length);
  const live = prims.filter((p) => !p.sub);
  const subs = prims.filter((p) => p.sub);
  const all = [...live, ...subs];
  const reach = d * 2.2;
  const list: Prim[] = [];
  const field = (x: number, y: number, z: number) => {
    let v = 1e9;
    for (const p of list) {
      const pd = primDistance(p, x, y, z);
      v = p.sub ? smax(v, -pd, p.k) : smin(v, pd, p.k + d * 0.6);
    }
    return v;
  };
  const e = d * 0.35;
  for (let i = 0; i < n; i++) {
    if (only && !only(i)) {
      out[i * 3] = smooth[i * 3];
      out[i * 3 + 1] = smooth[i * 3 + 1];
      out[i * 3 + 2] = smooth[i * 3 + 2];
      continue;
    }
    const nx0 = N[i * 3];
    const ny0 = N[i * 3 + 1];
    const nz0 = N[i * 3 + 2];
    const x = P[i * 3] + nx0 * d;
    const y = P[i * 3 + 1] + ny0 * d;
    const z = P[i * 3 + 2] + nz0 * d;
    list.length = 0;
    for (const p of all) {
      const dx = x - p.bcx;
      const dy = y - p.bcy;
      const dz = z - p.bcz;
      const r = p.brad + reach + p.k;
      if (dx * dx + dy * dy + dz * dz < r * r) list.push(p);
    }
    let gx = nx0;
    let gy = ny0;
    let gz = nz0;
    if (list.length) {
      gx = field(x + e, y, z) - field(x - e, y, z);
      gy = field(x, y + e, z) - field(x, y - e, z);
      gz = field(x, y, z + e) - field(x, y, z - e);
      const l = Math.hypot(gx, gy, gz) || 1;
      gx /= l;
      gy /= l;
      gz /= l;
      // Never let the proxy face away from the true surface (deep creases).
      const dp = gx * nx0 + gy * ny0 + gz * nz0;
      if (dp < 0.2) {
        const t = (0.2 - dp) / 1.2;
        gx += (nx0 - gx) * t;
        gy += (ny0 - gy) * t;
        gz += (nz0 - gz) * t;
      }
    }
    const sx = smooth[i * 3] * keepLocal + gx * (1 - keepLocal);
    const sy = smooth[i * 3 + 1] * keepLocal + gy * (1 - keepLocal);
    const sz = smooth[i * 3 + 2] * keepLocal + gz * (1 - keepLocal);
    const l = Math.hypot(sx, sy, sz) || 1;
    out[i * 3] = sx / l;
    out[i * 3 + 1] = sy / l;
    out[i * 3 + 2] = sz / l;
  }
  return out;
}

/** Head mesh: the neck below the jaw uses the body's puffed normals so the seam does not show. */
function neckBlend(m: MeshData, head: Float32Array, body: Float32Array): Float32Array {
  const out = Float32Array.from(head);
  for (let i = 0; i < m.part.length; i++) {
    if (m.part[i] > 0.5) continue;
    out[i * 3] = body[i * 3];
    out[i * 3 + 1] = body[i * 3 + 1];
    out[i * 3 + 2] = body[i * 3 + 2];
  }
  return out;
}

function toGeometry(m: MeshData, smooth = 0, normals?: Float32Array): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normals ?? (smooth > 0 ? smoothNormals(m, smooth) : m.normals), 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(m.skinIndex, 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute(m.skinWeight, 4));
  g.setAttribute('aPart', new Float32BufferAttribute(m.part, 1));
  g.setAttribute('aCurv', new Float32BufferAttribute(curvature(m), 1));
  // The true surface normal (the shading normal above is smoothed): used for the thin rim.
  g.setAttribute('aTrueN', new Float32BufferAttribute(m.normals, 3));
  g.setIndex(new BufferAttribute(m.indices, 1));
  g.computeBoundingSphere();
  return g;
}

/* ------------------------------------------------------------ headgear ---- */

function frame(t: V3, n: V3): M3 {
  const tl = Math.hypot(t[0], t[1], t[2]) || 1;
  const tx = t[0] / tl;
  const ty = t[1] / tl;
  const tz = t[2] / tl;
  const d = n[0] * tx + n[1] * ty + n[2] * tz;
  let nx = n[0] - d * tx;
  let ny = n[1] - d * ty;
  let nz = n[2] - d * tz;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl;
  ny /= nl;
  nz /= nl;
  const bx = ty * nz - tz * ny;
  const by = tz * nx - tx * nz;
  const bz = tx * ny - ty * nx;
  return Float64Array.from([tx, nx, bx, ty, ny, by, tz, nz, bz]);
}

function gearEll(c: V3, r: V3, k: number, part: number, m?: M3, sub = false): Prim {
  const p = new Prim();
  p.kind = Kind.Ellipsoid;
  [p.cx, p.cy, p.cz] = c;
  [p.rx, p.ry, p.rz] = r;
  if (m) p.m = m;
  p.k = k;
  p.sub = sub;
  p.part = part as Prim['part'];
  p.bcx = c[0];
  p.bcy = c[1];
  p.bcz = c[2];
  p.brad = Math.max(r[0], r[1], r[2]) * 1.08;
  p.w0[4] = 1;
  p.w1[4] = 1;
  return p;
}

/**
 * Toon headgear fitted to this athlete's (scaled) head; returned in bind space.
 * Flat matte ear shells (vents and a highlight are painted), flat bands that hug
 * the skull, and a wide chin strap running from the bottom of each shell under
 * the jaw into a chin cup in the strap colour.
 */
function headgearPrims(shape: ToonShape): Prim[] {
  const f = shape.face;
  const s = shape.scale * shape.head;
  const H = (v: V3) => headPoint(v, shape);
  const prims: Prim[] = [];
  const cupY = 1.641;
  const cupZ = -0.008;
  const cupX = 0.097 * f.skullW;
  for (const side of [1, -1]) {
    // A flat shell and a soft rim against the head.
    prims.push(gearEll(H([(cupX + 0.002) * side, cupY, cupZ]), [0.013 * s, 0.051 * s, 0.043 * s], 0.006 * s, PART.cup));
    prims.push(gearEll(H([(cupX - 0.007) * side, cupY, cupZ]), [0.011 * s, 0.049 * s, 0.041 * s], 0.008 * s, PART.cup));
  }
  // Crown band over the hair.
  const cy = 1.662;
  const ax = 0.093 * f.skullW;
  const ay = 0.118;
  for (let deg = -62; deg <= 62; deg += 4) {
    const phi = (deg * Math.PI) / 180;
    const c: V3 = [Math.sin(phi) * ax, cy + Math.cos(phi) * ay, -0.012];
    const t: V3 = [Math.cos(phi) * ax, -Math.sin(phi) * ay, 0];
    const n: V3 = [Math.sin(phi), Math.cos(phi), 0];
    prims.push(gearEll(H(c), [0.01 * s, 0.003 * s, 0.016 * s], 0.006 * s, PART.strap, frame(t, n)));
  }
  // Two flat bands round the back of the head.
  const back = (y: number, a: number, b: number, zc: number, from: number) => {
    for (let deg = from; deg <= 360 - from; deg += 5) {
      const th = (deg * Math.PI) / 180;
      const c: V3 = [Math.sin(th) * a, y, zc + Math.cos(th) * b];
      const t: V3 = [Math.cos(th) * a, 0, -Math.sin(th) * b];
      const n: V3 = [Math.sin(th) / a, 0, Math.cos(th) / b];
      prims.push(gearEll(H(c), [0.009 * s, 0.003 * s, 0.012 * s], 0.006 * s, PART.strap, frame(t, n)));
    }
  };
  back(1.712, 0.09 * f.skullW, 0.104, -0.004, 102);
  back(1.62, 0.08 * f.skullW, 0.11, -0.002, 106);
  // Wide, flat chin straps from the bottom of each shell, under the jaw, into the cup.
  const cd = f.chinDrop;
  const cf = f.chinFwd;
  const path: V3[] = [
    [0.09 * f.skullW, 1.598, -0.006],
    [0.074 * f.jawW, 1.566, 0.02],
    [0.05 * f.jawW, 1.545 - cd * 0.6, 0.046 + cf * 0.6],
    [0.022 * f.chinW, 1.535 - cd, 0.066 + cf],
  ];
  for (const side of [1, -1]) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      for (let q = 0; q < 1; q += 0.2) {
        const c: V3 = [(a[0] + (b[0] - a[0]) * q) * side, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q];
        const t: V3 = [(b[0] - a[0]) * side, b[1] - a[1], b[2] - a[2]];
        const n: V3 = [c[0] * 8, -0.6, c[2] * 4];
        prims.push(gearEll(H(c), [0.008 * s, 0.0026 * s, 0.011 * s], 0.005 * s, PART.chin, frame(t, n)));
      }
    }
  }
  // Chin cup, cupping the front and underside of the chin.
  prims.push(gearEll(H([0, 1.537 - cd, 0.074 + cf]), [0.025 * s, 0.012 * s, 0.02 * s], 0.006 * s, PART.chin, m3FromEuler(-35, 0, 0)));
  return prims;
}

/* ----------------------------------------------------------- generate ---- */

export function generateToon(shape: ToonShape, quality: 'high' | 'low' = 'high'): ToonGeometry {
  const t0 = performance.now();
  const { prims } = buildToonPrims(shape);
  const sc = shape.scale;
  const hBody = (quality === 'high' ? 0.0085 : 0.011) * sc;
  const hFine = (quality === 'high' ? 0.0036 : 0.0056) * sc;
  const headCut = 1.515 * sc;
  const overlap = 0.006 * sc;

  const handBoxes: Box[] = [1, -1].map((side) =>
    bounds(
      prims.filter((p) => p.part === PART.hand && Math.sign(p.bcx) === side),
      0.012 * sc,
    ),
  );
  const b = bounds(prims, hBody * 3);
  const body = polygonize(prims, {
    min: b.min,
    max: b.max,
    h: hBody,
    keep: (x, y, z) => y < headCut + overlap && !handBoxes.some((hb) => inside(hb, x, y, z, overlap)),
  });
  const top = headPoint([0, 1.81, 0], shape)[1];
  const head = polygonize(prims, {
    min: [-0.17 * sc, headCut - 0.02 * sc, -0.2 * sc],
    max: [0.17 * sc, top, 0.2 * sc],
    h: hFine,
    keep: (_x, y) => y >= headCut,
  });
  const hands = handBoxes.map((hb) => polygonize(prims, { min: hb.min, max: hb.max, h: hFine }));

  const hg = headgearPrims(shape);
  const gb = bounds(hg, 0.004 * sc);
  const gear = polygonize(hg, { min: gb.min, max: gb.max, h: (quality === 'high' ? 0.0052 : 0.0064) * sc });
  const gp = gear.positions;
  for (let i = 0; i < gp.length; i += 3) {
    gp[i] -= HEAD_ORIGIN[0] * sc;
    gp[i + 1] -= HEAD_ORIGIN[1] * sc;
    gp[i + 2] -= HEAD_ORIGIN[2] * sc;
  }
  const meshes = [body, head, ...hands, gear];
  const tris = meshes.reduce((a, m) => a + m.indices.length / 3, 0);
  const bodyN = offsetNormals(prims, body, 0.03 * sc, 0.25, smoothNormals(body, 6));
  const handN = hands.map((h) => offsetNormals(prims, h, 0.012 * sc, 0.3, smoothNormals(h, 2)));
  // On the head mesh only the neck below the jaw needs the body's puffed normals
  // (the face and hair are shaded from proxies), so only those vertices sample the field.
  const headN = offsetNormals(prims, head, 0.03 * sc, 0.25, smoothNormals(head, 6), (i) => head.part[i] < 0.5);
  const out: ToonGeometry = {
    body: toGeometry(body, 0, bodyN),
    head: toGeometry(head, 0, neckBlend(head, smoothNormals(head, 26), headN)),
    hands: hands.map((h, i) => toGeometry(h, 0, handN[i])),
    headgear: toGeometry(gear, 4),
    ms: 0,
    tris,
    parts: [body, head, hands[0], gear].map((m) => m.indices.length / 3),
  };
  out.ms = performance.now() - t0;
  return out;
}
