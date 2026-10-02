import { BONE_COUNT } from './skeleton';
import { Prim, primAxisT, primDistance, smax, smin } from './sdf';
import type { V3 } from './math';

/**
 * Turns a signed distance body into a skinned triangle mesh.
 *
 * Surface nets on a regular grid, evaluated only near the surface: blocks of the
 * grid that are clearly inside or outside are filled with a single value, and
 * every block keeps the short list of primitives that can affect it. Vertices
 * are then projected onto the true surface, shaded from the field's gradient and
 * skinned from whichever anatomical masses claim them.
 */

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
  part: Float32Array;
}

export interface MeshRegion {
  min: V3;
  max: V3;
  /** Cell size, metres. */
  h: number;
  /** Optional triangle filter on the centroid, for stitching regions. */
  keep?: (x: number, y: number, z: number) => boolean;
}

const BLOCK = 8;

/** Union over a primitive subset, inlined for speed. */
function fieldAt(prims: Prim[], list: Int32Array, x: number, y: number, z: number): number {
  let d = 1e9;
  for (let i = 0; i < list.length; i++) {
    const p = prims[list[i]];
    const pd = primDistance(p, x, y, z);
    d = p.sub ? smax(d, -pd, p.k) : smin(d, pd, p.k);
  }
  return d;
}

export function polygonize(prims: Prim[], region: MeshRegion): MeshData {
  const { min, max, h } = region;
  const nx = Math.ceil((max[0] - min[0]) / h) + 1;
  const ny = Math.ceil((max[1] - min[1]) / h) + 1;
  const nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const values = new Float32Array(nx * ny * nz);
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);

  const bx = Math.ceil(nx / BLOCK);
  const by = Math.ceil(ny / BLOCK);
  const bz = Math.ceil(nz / BLOCK);
  const blockLists: Int32Array[] = new Array(bx * by * bz);
  const empty = new Int32Array(0);
  const hd = (BLOCK * h * Math.sqrt(3)) / 2;
  let maxK = 0;
  for (const p of prims) maxK = Math.max(maxK, p.k);

  const scratchD = new Float64Array(prims.length);
  const scratchIdx = new Int32Array(prims.length);
  const blockAt = (ib: number, jb: number, kb: number) => ib + bx * (jb + by * kb);
  const evaluated = new Uint8Array(bx * by * bz);

  for (let kb = 0; kb < bz; kb++) {
    for (let jb = 0; jb < by; jb++) {
      for (let ib = 0; ib < bx; ib++) {
        const i0 = ib * BLOCK;
        const j0 = jb * BLOCK;
        const k0 = kb * BLOCK;
        const i1 = Math.min(nx, i0 + BLOCK);
        const j1 = Math.min(ny, j0 + BLOCK);
        const k1 = Math.min(nz, k0 + BLOCK);
        const qx = min[0] + ((i0 + i1 - 1) / 2) * h;
        const qy = min[1] + ((j0 + j1 - 1) / 2) * h;
        const qz = min[2] + ((k0 + k1 - 1) / 2) * h;

        // Candidate primitives near this block.
        let dmin = 1e9;
        let n = 0;
        for (let p = 0; p < prims.length; p++) {
          const pr = prims[p];
          const ddx = qx - pr.bcx;
          const ddy = qy - pr.bcy;
          const ddz = qz - pr.bcz;
          const sphere = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) - pr.brad;
          if (sphere > hd + maxK + 0.03) continue;
          const d = primDistance(pr, qx, qy, qz);
          scratchD[n] = d;
          scratchIdx[n] = p;
          n++;
          if (!pr.sub && d < dmin) dmin = d;
        }
        let m = 0;
        const keep: number[] = [];
        for (let c = 0; c < n; c++) {
          const pr = prims[scratchIdx[c]];
          const d = scratchD[c];
          if (pr.sub ? d < hd + pr.k + 0.004 : d < dmin + 2 * hd + pr.k + 0.004) {
            keep.push(scratchIdx[c]);
            m++;
          }
        }
        const list = m ? Int32Array.from(keep) : empty;
        blockLists[ib + bx * (jb + by * kb)] = list;

        const center = m ? fieldAt(prims, list, qx, qy, qz) : 1e3;
        if (Math.abs(center) > hd * 1.4 + 2 * h) {
          const fillValue = center > 0 ? Math.max(center - hd, h) : Math.min(center + hd, -h);
          for (let k = k0; k < k1; k++)
            for (let j = j0; j < j1; j++)
              for (let i = i0; i < i1; i++) values[at(i, j, k)] = fillValue;
          continue;
        }
        evaluated[blockAt(ib, jb, kb)] = 1;
        for (let k = k0; k < k1; k++) {
          const z = min[2] + k * h;
          for (let j = j0; j < j1; j++) {
            const y = min[1] + j * h;
            for (let i = i0; i < i1; i++) {
              values[at(i, j, k)] = fieldAt(prims, list, min[0] + i * h, y, z);
            }
          }
        }
      }
    }
  }

  // Cells and edges can only cross the surface in or next to evaluated blocks.
  const active = new Uint8Array(bx * by * bz);
  for (let kb = 0; kb < bz; kb++)
    for (let jb = 0; jb < by; jb++)
      for (let ib = 0; ib < bx; ib++) {
        if (!evaluated[blockAt(ib, jb, kb)]) continue;
        for (let dz = -1; dz <= 0; dz++)
          for (let dy = -1; dy <= 0; dy++)
            for (let dx = -1; dx <= 0; dx++) {
              const a = ib + dx;
              const b = jb + dy;
              const c = kb + dz;
              if (a >= 0 && b >= 0 && c >= 0) active[blockAt(a, b, c)] = 1;
            }
      }
  const forActive = (limit: [number, number, number], fn: (i: number, j: number, k: number) => void) => {
    for (let kb = 0; kb < bz; kb++)
      for (let jb = 0; jb < by; jb++)
        for (let ib = 0; ib < bx; ib++) {
          if (!active[blockAt(ib, jb, kb)]) continue;
          const i1 = Math.min(limit[0], ib * BLOCK + BLOCK);
          const j1 = Math.min(limit[1], jb * BLOCK + BLOCK);
          const k1 = Math.min(limit[2], kb * BLOCK + BLOCK);
          for (let k = kb * BLOCK; k < k1; k++)
            for (let j = jb * BLOCK; j < j1; j++) for (let i = ib * BLOCK; i < i1; i++) fn(i, j, k);
        }
  };

  const listFor = (x: number, y: number, z: number): Int32Array => {
    const i = Math.min(nx - 1, Math.max(0, Math.round((x - min[0]) / h)));
    const j = Math.min(ny - 1, Math.max(0, Math.round((y - min[1]) / h)));
    const k = Math.min(nz - 1, Math.max(0, Math.round((z - min[2]) / h)));
    return blockLists[Math.floor(i / BLOCK) + bx * (Math.floor(j / BLOCK) + by * Math.floor(k / BLOCK))];
  };

  /* ---------------------------------------------------- surface nets ---- */

  const cellIndex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cellAt = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const corner = new Float64Array(8);
  const EDGES = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  const OFF = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ];

  forActive([nx - 1, ny - 1, nz - 1], (i, j, k) => {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = values[at(i + OFF[c][0], j + OFF[c][1], k + OFF[c][2])];
      corner[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) return;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let count = 0;
    for (const [a, b] of EDGES) {
      const va = corner[a];
      const vb = corner[b];
      if (va < 0 === vb < 0) continue;
      const t = va / (va - vb);
      sx += OFF[a][0] + (OFF[b][0] - OFF[a][0]) * t;
      sy += OFF[a][1] + (OFF[b][1] - OFF[a][1]) * t;
      sz += OFF[a][2] + (OFF[b][2] - OFF[a][2]) * t;
      count++;
    }
    cellIndex[cellAt(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / count) * h, min[1] + (j + sy / count) * h, min[2] + (k + sz / count) * h);
  });

  const quads: number[] = [];
  const pushQuad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) quads.push(d, c, b, a);
    else quads.push(a, b, c, d);
  };
  // One quad per grid edge that crosses the surface, joining the four cells
  // around it; wound so the face points from inside to outside.
  forActive([nx, ny, nz], (i, j, k) => {
    const v0 = values[at(i, j, k)] < 0;
    if (i < nx - 1 && j > 0 && k > 0 && j < ny - 1 && k < nz - 1) {
      if (v0 !== values[at(i + 1, j, k)] < 0) {
        pushQuad(
          cellIndex[cellAt(i, j - 1, k - 1)],
          cellIndex[cellAt(i, j, k - 1)],
          cellIndex[cellAt(i, j, k)],
          cellIndex[cellAt(i, j - 1, k)],
          !v0,
        );
      }
    }
    if (j < ny - 1 && i > 0 && k > 0 && i < nx - 1 && k < nz - 1) {
      if (v0 !== values[at(i, j + 1, k)] < 0) {
        pushQuad(
          cellIndex[cellAt(i - 1, j, k - 1)],
          cellIndex[cellAt(i - 1, j, k)],
          cellIndex[cellAt(i, j, k)],
          cellIndex[cellAt(i, j, k - 1)],
          !v0,
        );
      }
    }
    if (k < nz - 1 && i > 0 && j > 0 && i < nx - 1 && j < ny - 1) {
      if (v0 !== values[at(i, j, k + 1)] < 0) {
        pushQuad(
          cellIndex[cellAt(i - 1, j - 1, k)],
          cellIndex[cellAt(i, j - 1, k)],
          cellIndex[cellAt(i, j, k)],
          cellIndex[cellAt(i - 1, j, k)],
          !v0,
        );
      }
    }
  });

  /* ------------------------------------------- projection and normals ---- */

  const vcount = pos.length / 3;
  const positions = new Float32Array(pos);
  const normals = new Float32Array(vcount * 3);
  const eps = Math.min(0.0009, h * 0.25);
  const K = [
    [1, -1, -1],
    [-1, -1, 1],
    [-1, 1, -1],
    [1, 1, 1],
  ];
  const grad = (list: Int32Array, x: number, y: number, z: number, out: Float64Array) => {
    out[0] = out[1] = out[2] = 0;
    for (const [a, b, c] of K) {
      const d = fieldAt(prims, list, x + a * eps, y + b * eps, z + c * eps);
      out[0] += a * d;
      out[1] += b * d;
      out[2] += c * d;
    }
  };
  const g = new Float64Array(3);
  const weights = new Float32Array(vcount * BONE_COUNT);
  const part = new Float32Array(vcount);
  const tau = 0.008;
  const tight = new Int32Array(prims.length);
  const tightD = new Float64Array(prims.length);
  for (let v = 0; v < vcount; v++) {
    let x = positions[v * 3];
    let y = positions[v * 3 + 1];
    let z = positions[v * 3 + 2];

    // A per-vertex shortlist: only masses close enough to shape or claim it.
    const list = listFor(x, y, z);
    let dmin = 1e9;
    for (let i = 0; i < list.length; i++) {
      const p = prims[list[i]];
      const d = primDistance(p, x, y, z);
      tightD[i] = d;
      if (!p.sub && d < dmin) dmin = d;
    }
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const p = prims[list[i]];
      const d = tightD[i];
      if (p.sub ? d < p.k + 0.02 : d < dmin + Math.max(2 * p.k, tau * 6) + 0.012) tight[n++] = list[i];
    }
    const sl = tight.subarray(0, n);

    for (let it = 0; it < 2; it++) {
      const d = fieldAt(prims, sl, x, y, z);
      if (Math.abs(d) < 1e-5) break;
      grad(sl, x, y, z, g);
      const gl = Math.sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) || 1;
      let step = d / gl;
      const limit = h * 0.6;
      if (step > limit) step = limit;
      if (step < -limit) step = -limit;
      x -= (g[0] / gl) * step;
      y -= (g[1] / gl) * step;
      z -= (g[2] / gl) * step;
    }
    positions[v * 3] = x;
    positions[v * 3 + 1] = y;
    positions[v * 3 + 2] = z;
    grad(sl, x, y, z, g);
    const gl = Math.sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) || 1;
    normals[v * 3] = g[0] / gl;
    normals[v * 3 + 1] = g[1] / gl;
    normals[v * 3 + 2] = g[2] / gl;

    // Skinning: every nearby mass claims the vertex in proportion to how close
    // it comes to being the surface here, and lends it its bones.
    let best = -1;
    let bestW = 0;
    let smin2 = 1e9;
    for (let i = 0; i < n; i++) {
      const p = prims[sl[i]];
      if (p.sub || p.claim <= 0) continue;
      const d = primDistance(p, x, y, z);
      tightD[i] = d;
      if (d < smin2) smin2 = d;
    }
    const base = v * BONE_COUNT;
    for (let i = 0; i < n; i++) {
      const p = prims[sl[i]];
      if (p.sub || p.claim <= 0) continue;
      const rel = tightD[i] - smin2;
      if (rel > tau * 6) continue;
      const w = p.claim * Math.exp(-rel / tau);
      if (w > bestW) {
        bestW = w;
        best = sl[i];
      }
      const t = primAxisT(p, x, y, z);
      let s = (t - p.t0) / Math.max(1e-6, p.t1 - p.t0);
      s = s < 0 ? 0 : s > 1 ? 1 : s * s * (3 - 2 * s);
      for (let bIdx = 0; bIdx < BONE_COUNT; bIdx++) {
        const bw = p.w0[bIdx] + (p.w1[bIdx] - p.w0[bIdx]) * s;
        if (bw) weights[base + bIdx] += w * bw;
      }
    }
    part[v] = best >= 0 ? prims[best].part : 0;
  }

  /* -------------------------------------------------------- triangles ---- */

  const tris: number[] = [];
  const P = positions;
  const d2 = (a: number, b: number) =>
    (P[a * 3] - P[b * 3]) ** 2 + (P[a * 3 + 1] - P[b * 3 + 1]) ** 2 + (P[a * 3 + 2] - P[b * 3 + 2]) ** 2;
  const keepTri = (a: number, b: number, c: number) => {
    if (!region.keep) return true;
    return region.keep(
      (P[a * 3] + P[b * 3] + P[c * 3]) / 3,
      (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3,
      (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3,
    );
  };
  for (let q = 0; q < quads.length; q += 4) {
    const a = quads[q];
    const b = quads[q + 1];
    const c = quads[q + 2];
    const d = quads[q + 3];
    if (d2(a, c) <= d2(b, d)) {
      if (keepTri(a, b, c)) tris.push(a, b, c);
      if (keepTri(a, c, d)) tris.push(a, c, d);
    } else {
      if (keepTri(a, b, d)) tris.push(a, b, d);
      if (keepTri(b, c, d)) tris.push(b, c, d);
    }
  }

  /* --------------------------------------------------------- skinning ---- */

  // Relax the weights across the surface so joints bend smoothly.
  const neighbours: number[][] = Array.from({ length: vcount }, () => []);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t];
    const b = tris[t + 1];
    const c = tris[t + 2];
    neighbours[a].push(b, c);
    neighbours[b].push(a, c);
    neighbours[c].push(a, b);
  }
  // Normalise first so relaxation averages comparable vectors.
  for (let v = 0; v < vcount; v++) {
    let sum = 0;
    for (let b = 0; b < BONE_COUNT; b++) sum += weights[v * BONE_COUNT + b];
    if (sum > 0) for (let b = 0; b < BONE_COUNT; b++) weights[v * BONE_COUNT + b] /= sum;
  }
  const tmp = new Float32Array(weights.length);
  for (let iter = 0; iter < 3; iter++) {
    for (let v = 0; v < vcount; v++) {
      const nb = neighbours[v];
      const base = v * BONE_COUNT;
      if (!nb.length) {
        for (let b = 0; b < BONE_COUNT; b++) tmp[base + b] = weights[base + b];
        continue;
      }
      const inv = 1 / nb.length;
      for (let b = 0; b < BONE_COUNT; b++) {
        let s = 0;
        for (const n of nb) s += weights[n * BONE_COUNT + b];
        tmp[base + b] = weights[base + b] * 0.5 + s * inv * 0.5;
      }
    }
    weights.set(tmp);
  }

  const skinIndex = new Uint16Array(vcount * 4);
  const skinWeight = new Float32Array(vcount * 4);
  const top = [0, 0, 0, 0];
  const topW = [0, 0, 0, 0];
  for (let v = 0; v < vcount; v++) {
    const base = v * BONE_COUNT;
    topW.fill(-1);
    top.fill(0);
    for (let b = 0; b < BONE_COUNT; b++) {
      const w = weights[base + b];
      if (w <= topW[3]) continue;
      let slot = 3;
      while (slot > 0 && w > topW[slot - 1]) {
        topW[slot] = topW[slot - 1];
        top[slot] = top[slot - 1];
        slot--;
      }
      topW[slot] = w;
      top[slot] = b;
    }
    let sum = 0;
    for (let s = 0; s < 4; s++) {
      if (topW[s] < 0.02) topW[s] = 0;
      sum += topW[s];
    }
    for (let s = 0; s < 4; s++) {
      skinIndex[v * 4 + s] = top[s];
      skinWeight[v * 4 + s] = sum > 0 ? topW[s] / sum : s === 0 ? 1 : 0;
    }
  }

  return {
    positions,
    normals,
    indices: Uint32Array.from(tris),
    skinIndex,
    skinWeight,
    part,
  };
}
