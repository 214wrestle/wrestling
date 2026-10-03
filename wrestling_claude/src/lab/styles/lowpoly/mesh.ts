import { BufferAttribute, BufferGeometry } from 'three';
import { BONE_INDEX, BONE_NAMES, MIRROR } from '../../../body/skeleton';
import type { BoneName } from '../../../body/skeleton';

/**
 * A tiny mesh builder for hand-authored low-poly parts.
 *
 * Everything is built in the rest pose of the shared skeleton (limbs hanging,
 * facing +Z, +X = the athlete's left), in the canonical 1.76 m frame, then scaled.
 * Parts are lofts: rings of points joined into quads, each vertex carrying its own
 * skin weights and a part id the shader uses to paint it. Left-side parts are
 * authored once and mirrored, so every facet is exactly symmetric.
 */

export type V3 = [number, number, number];
export type W = Partial<Record<BoneName, number>>;

/** Part ids, read by the shader. */
export const PART = {
  torso: 0,
  head: 1,
  arm: 2,
  hand: 3,
  leg: 4,
  shoe: 5,
  hair: 6,
  brow: 7,
  eyeWhite: 8,
  iris: 9,
  pupil: 10,
  gear: 11,
  strap: 12,
  skin: 13,
  chinCup: 14,
  lid: 15,
  lash: 16,
  nose: 17,
} as const;

export interface Ring {
  pts: V3[];
  /** Weights for the whole ring, or per point. */
  w: W | ((j: number, p: V3) => W);
}

export interface LoftOpts {
  part: number | ((p: V3) => number);
  /** Close the first / last ring with a fan to this point (or the ring centre if true). */
  capStart?: boolean | V3;
  capEnd?: boolean | V3;
  /** Mirror-symmetric diagonals for a centred part whose ring runs front -> +X -> back -> -X. */
  symmetric?: boolean;
  /** Weights for the cap tips (default: the ring's first point). */
  capW?: W;
}

const swapSide = (b: BoneName): BoneName => MIRROR[b] ?? b;

export class MeshBuilder {
  pos: number[] = [];
  si: number[] = [];
  sw: number[] = [];
  part: number[] = [];
  /** Pre-push ("canonical") positions: the shader paints faces in this space. */
  canon: number[] = [];
  idx: number[] = [];
  /** Which loft each vertex came from (mirrored copies get their own ids). */
  grp: number[] = [];
  private curGroup = 0;
  /** Optional transform applied to every point as it is stored (e.g. a head push). */
  xform: ((p: V3) => V3) | null = null;

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  vert(p: V3, w: W, part: number): number {
    const entries = Object.entries(w)
      .filter(([, v]) => (v ?? 0) > 1e-4)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .slice(0, 4) as Array<[BoneName, number]>;
    let sum = 0;
    for (const [, v] of entries) sum += v;
    for (let k = 0; k < 4; k++) {
      const e = entries[k];
      this.si.push(e ? BONE_INDEX[e[0]] : 0);
      this.sw.push(e ? e[1] / (sum || 1) : 0);
    }
    const q = this.xform ? this.xform(p) : p;
    this.pos.push(q[0], q[1], q[2]);
    this.canon.push(p[0], p[1], p[2]);
    this.part.push(part);
    this.grp.push(this.curGroup);
    return this.vertexCount - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  p(i: number): V3 {
    return [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]];
  }

  /** Adds a triangle wound so its normal points away from `ref`. */
  triOut(a: number, b: number, c: number, ref: V3): void {
    const A = this.p(a);
    const B = this.p(b);
    const C = this.p(c);
    const ux = B[0] - A[0];
    const uy = B[1] - A[1];
    const uz = B[2] - A[2];
    const vx = C[0] - A[0];
    const vy = C[1] - A[1];
    const vz = C[2] - A[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const cx = (A[0] + B[0] + C[0]) / 3 - ref[0];
    const cy = (A[1] + B[1] + C[1]) / 3 - ref[1];
    const cz = (A[2] + B[2] + C[2]) / 3 - ref[2];
    if (nx * cx + ny * cy + nz * cz >= 0) this.tri(a, b, c);
    else this.tri(a, c, b);
  }

  loft(rings: Ring[], o: LoftOpts): void {
    this.curGroup++;
    const n = rings[0].pts.length;
    const partOf = (p: V3) => (typeof o.part === 'number' ? o.part : o.part(p));
    const ids: number[][] = rings.map((r) =>
      r.pts.map((p, j) => this.vert(p, typeof r.w === 'function' ? r.w(j, p) : r.w, partOf(p))),
    );
    // Centres in stored (transformed) space, so winding tests match the stored points.
    const centre = (ring: number[]): V3 => {
      const c: V3 = [0, 0, 0];
      for (const i of ring) {
        const p = this.p(i);
        c[0] += p[0] / ring.length;
        c[1] += p[1] / ring.length;
        c[2] += p[2] / ring.length;
      }
      return c;
    };
    const centres = ids.map(centre);
    for (let i = 0; i < rings.length - 1; i++) {
      const ref: V3 = [
        (centres[i][0] + centres[i + 1][0]) / 2,
        (centres[i][1] + centres[i + 1][1]) / 2,
        (centres[i][2] + centres[i + 1][2]) / 2,
      ];
      for (let j = 0; j < n; j++) {
        const j1 = (j + 1) % n;
        const a = ids[i][j];
        const b = ids[i][j1];
        const c = ids[i + 1][j1];
        const d = ids[i + 1][j];
        // Split each quad along the diagonal that makes a ridge rather than a
        // valley: convex folds read as sculpted planes. Ties fall back to a
        // mirror-symmetric pattern.
        const A = this.p(a);
        const B = this.p(b);
        const C = this.p(c);
        const D = this.p(d);
        const dist = (p: V3, q: V3) => Math.hypot((p[0] + q[0]) / 2 - ref[0], (p[1] + q[1]) / 2 - ref[1], (p[2] + q[2]) / 2 - ref[2]);
        const dac = dist(A, C);
        const dbd = dist(B, D);
        const tie = Math.abs(dac - dbd) < 2e-4;
        const flip = tie ? (o.symmetric ? j >= n / 2 : false) : dbd > dac;
        if (!flip) {
          this.triOut(a, b, c, ref);
          this.triOut(a, c, d, ref);
        } else {
          this.triOut(a, b, d, ref);
          this.triOut(b, c, d, ref);
        }
      }
    }
    const all: V3 = [0, 0, 0];
    for (const c of centres) {
      all[0] += c[0] / centres.length;
      all[1] += c[1] / centres.length;
      all[2] += c[2] / centres.length;
    }
    const cap = (ri: number, tip: boolean | V3 | undefined) => {
      if (!tip) return;
      const r = rings[ri];
      let t: V3;
      if (tip === true) {
        t = [0, 0, 0];
        for (const p of r.pts) for (let k = 0; k < 3; k++) t[k] += p[k] / r.pts.length;
      } else t = tip;
      const w = o.capW ?? (typeof r.w === 'function' ? r.w(0, r.pts[0]) : r.w);
      const c = this.vert(t, w, partOf(t));
      // Reference point: pushed back along the loft so the fan faces outward.
      const other = centres[ri === 0 ? Math.min(1, rings.length - 1) : Math.max(0, ri - 1)];
      const ref: V3 = rings.length > 1 ? other : all;
      for (let j = 0; j < n; j++) this.triOut(ids[ri][j], ids[ri][(j + 1) % n], c, ref);
    };
    cap(0, o.capStart);
    cap(rings.length - 1, o.capEnd);
  }

  /** Marks the current end of the buffers, for mirrorSince. */
  mark(): { v: number; i: number } {
    return { v: this.vertexCount, i: this.idx.length };
  }

  /** Duplicates everything added since `m`, mirrored across X with bones swapped. */
  mirrorSince(m: { v: number; i: number }): void {
    const v0 = m.v;
    const v1 = this.vertexCount;
    const i1 = this.idx.length;
    const off = v1 - v0;
    for (let v = v0; v < v1; v++) {
      this.pos.push(-this.pos[v * 3], this.pos[v * 3 + 1], this.pos[v * 3 + 2]);
      this.canon.push(-this.canon[v * 3], this.canon[v * 3 + 1], this.canon[v * 3 + 2]);
      for (let k = 0; k < 4; k++) {
        const bi = this.si[v * 4 + k];
        const name = BONE_NAMES[bi];
        this.si.push(BONE_INDEX[swapSide(name)]);
        this.sw.push(this.sw[v * 4 + k]);
      }
      this.part.push(this.part[v]);
      this.grp.push(this.grp[v] + 100000);
    }
    for (let i = m.i; i < i1; i += 3) {
      // Reversed winding: mirroring flips handedness.
      this.idx.push(this.idx[i] + off, this.idx[i + 2] + off, this.idx[i + 1] + off);
    }
  }

  /** Scales every position (for the athlete's height). */
  geometry(scale: number): BufferGeometry {
    const g = new BufferGeometry();
    const p = Float32Array.from(this.pos, (v) => v * scale);
    g.setAttribute('position', new BufferAttribute(p, 3));
    g.setAttribute('skinIndex', new BufferAttribute(Uint16Array.from(this.si), 4));
    g.setAttribute('skinWeight', new BufferAttribute(Float32Array.from(this.sw), 4));
    g.setAttribute('aPart', new BufferAttribute(Float32Array.from(this.part), 1));
    g.setAttribute('aCanon', new BufferAttribute(Float32Array.from(this.canon), 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    if (this.weldParts.length) this.weldNormals(g);
    g.computeBoundingSphere();
    return g;
  }

  /** Parts whose seams are blended by weldNormals. */
  weldParts: number[] = [];

  /**
   * Shading-normal welding across intersecting parts: where two lofts meet (torso
   * and thigh, torso and arm, neck and chest), each vertex's normal is blended with
   * the normals of nearby vertices of the other loft, so the poster bands run
   * across the join instead of breaking along an intersection seam.
   */
  weldNormals(g: BufferGeometry, radius = 0.045): void {
    const nAttr = g.getAttribute('normal') as BufferAttribute;
    const src = Float32Array.from(nAttr.array as Float32Array);
    const out = nAttr.array as Float32Array;
    const ids: number[] = [];
    for (let v = 0; v < this.vertexCount; v++) if (this.weldParts.includes(this.part[v])) ids.push(v);
    const P = this.pos;
    for (const a of ids) {
      let nx = src[a * 3];
      let ny = src[a * 3 + 1];
      let nz = src[a * 3 + 2];
      let wsum = 1;
      let near = 0;
      for (const b of ids) {
        if (this.grp[b] === this.grp[a]) continue;
        const dx = P[a * 3] - P[b * 3];
        const dy = P[a * 3 + 1] - P[b * 3 + 1];
        const dz = P[a * 3 + 2] - P[b * 3 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d >= radius) continue;
        const w = 1 - d / radius;
        const ww = w * w;
        nx += src[b * 3] * ww;
        ny += src[b * 3 + 1] * ww;
        nz += src[b * 3 + 2] * ww;
        wsum += ww;
        near = Math.max(near, w);
      }
      if (near === 0) continue;
      const l = Math.hypot(nx, ny, nz) || 1;
      out[a * 3] = nx / l;
      out[a * 3 + 1] = ny / l;
      out[a * 3 + 2] = nz / l;
      void wsum;
    }
    nAttr.needsUpdate = true;
  }
}

/* ------------------------------------------------------------ helpers ---- */

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const smooth = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Blends two weight maps. */
export function mixW(a: W, b: W, t: number): W {
  const out: W = {};
  for (const [k, v] of Object.entries(a)) out[k as BoneName] = (out[k as BoneName] ?? 0) + (v ?? 0) * (1 - t);
  for (const [k, v] of Object.entries(b)) out[k as BoneName] = (out[k as BoneName] ?? 0) + (v ?? 0) * t;
  return out;
}

/** Deterministic hash in 0..1. */
export function hash(a: number, b = 0, c = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
