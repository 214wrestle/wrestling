import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { polygonize } from './mesher';
import type { MeshData } from './mesher';
import { smax, smin } from '../../../body/sdf';
import { primDistance } from './sdf';
import type { Prim } from '../../../body/sdf';
import type { V3 } from '../../../body/math';
import { buildPrims, hairAt, headUnscale, HEAD_PIVOT, PART } from './anatomy';
import type { BodyParams } from './anatomy';
import { headgearPrims, HEAD_ORIGIN } from './headgear';

/**
 * Body generation for the realism style: the game's surface-nets mesher at a
 * finer grid, plus a baked ambient-occlusion term per vertex sampled from the
 * signed distance field itself. The SDF makes AO nearly free and it is what
 * sells the forms: the armpit, the crease under the glutes, between the fingers,
 * the eye sockets, under the jaw. Pure maths, worker-safe.
 */

export interface RealMesh extends MeshData {
  ao: Float32Array;
  /** Relaxed normals for cloth (body mesh only). */
  smoothN?: Float32Array;
}

export interface RealGeometry {
  body: RealMesh;
  head: RealMesh;
  /** Fine face-detail patch (high quality only). */
  face: RealMesh | null;
  hands: RealMesh[];
  headgear: MeshData | null;
  /** Coarse scalp patch the hair shells are grown from (head-joint space). */
  scalp: MeshData | null;
  /** Hair length factor per scalp vertex. */
  scalpLen: Float32Array | null;
  ms: number;
  tris: number;
  /** Stage timings, ms. */
  stages: Record<string, number>;
}

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
  x > b.min[0] + shrink &&
  x < b.max[0] - shrink &&
  y > b.min[1] + shrink &&
  y < b.max[1] - shrink &&
  z > b.min[2] + shrink &&
  z < b.max[2] - shrink;

/** True when the block [lo, hi] lies inside box b shrunk by m. */
const boxIn = (lo: V3, hi: V3, b: Box, m: number) =>
  lo[0] > b.min[0] + m && hi[0] < b.max[0] - m && lo[1] > b.min[1] + m && hi[1] < b.max[1] - m && lo[2] > b.min[2] + m && hi[2] < b.max[2] - m;

/** SDF ambient occlusion: how far the field falls short of free space along the normal. */
/**
 * reachScale shortens the probe on the face (fine features would otherwise
 * self-occlude into grime); it eases back to 1 below fadeY so the seam with the
 * body mesh matches.
 */
function bakeAO(prims: Prim[], m: MeshData, sc: number, reachScale = 1, fadeY = -1, fadeBox?: Box): Float32Array {
  const P = m.positions;
  const N = m.normals;
  const n = P.length / 3;
  const ao = new Float32Array(n);
  const base = [0.005, 0.012, 0.022, 0.036, 0.055].map((d) => d * sc);
  const steps = base.slice();
  const reach = base[base.length - 1] + 0.02 * sc;
  const near: number[] = [];
  for (let v = 0; v < n; v++) {
    const x = P[v * 3];
    const y = P[v * 3 + 1];
    const z = P[v * 3 + 2];
    let k = fadeY < 0 ? reachScale : 1 + (reachScale - 1) * Math.min(1, Math.max(0, (y - fadeY) / (0.04 * sc)));
    if (fadeBox) {
      // Near the box rim (the wrist seam) the probe matches the body mesh's.
      const b = fadeBox;
      const d = Math.min(x - b.min[0], b.max[0] - x, y - b.min[1], b.max[1] - y, z - b.min[2], b.max[2] - z);
      k = 1 + (reachScale - 1) * Math.min(1, Math.max(0, (d - 0.012 * sc) / (0.03 * sc)));
    }
    for (let i = 0; i < base.length; i++) steps[i] = base[i] * k;
    near.length = 0;
    for (let i = 0; i < prims.length; i++) {
      const p = prims[i];
      const dx = x - p.bcx;
      const dy = y - p.bcy;
      const dz = z - p.bcz;
      const r = p.brad + reach + p.k;
      if (dx * dx + dy * dy + dz * dz < r * r) near.push(i);
    }
    let occ = 0;
    let wsum = 0;
    let w = 1;
    for (const s of steps) {
      const qx = x + N[v * 3] * s;
      const qy = y + N[v * 3 + 1] * s;
      const qz = z + N[v * 3 + 2] * s;
      // Only distances below s matter (the term saturates there), so a mass
      // whose bounding sphere is farther than s + k cannot change the result.
      let d = s;
      for (const i of near) {
        const p = prims[i];
        const dx = qx - p.bcx;
        const dy = qy - p.bcy;
        const dz = qz - p.bcz;
        const lb = Math.sqrt(dx * dx + dy * dy + dz * dz) - p.brad;
        if (p.sub) {
          if (lb > p.k) continue;
          d = smax(d, -primDistance(p, qx, qy, qz), p.k);
        } else {
          if (lb > s + p.k) continue;
          d = smin(d, primDistance(p, qx, qy, qz), p.k);
        }
      }
      occ += w * Math.max(0, (s - Math.max(d, 0)) / s);
      wsum += w;
      w *= 0.72;
    }
    ao[v] = Math.max(0, 1 - (occ / wsum) * 1.25);
  }
  return ao;
}

const gearCache = new Map<string, MeshData>();

/** Headgear meshed once for the canonical 1.76 m head, in head-joint space. */
function canonicalHeadgear(quality: 'high' | 'low'): MeshData {
  const hit = gearCache.get(quality);
  if (hit) return hit;
  const hg = headgearPrims(1);
  const gb = bounds(hg, 0.004);
  const m = polygonize(hg, { min: gb.min, max: gb.max, h: quality === 'high' ? 0.0036 : 0.0048 });
  const p = m.positions;
  for (let i = 0; i < p.length; i += 3) {
    p[i] -= HEAD_ORIGIN[0];
    p[i + 1] -= HEAD_ORIGIN[1];
    p[i + 2] -= HEAD_ORIGIN[2];
  }
  gearCache.set(quality, m);
  return m;
}

export function generateBody(
  params: BodyParams,
  quality: 'high' | 'low' = 'high',
  withHeadgear = true,
  hairSides = 0.6,
): RealGeometry {
  const t0 = performance.now();
  const stages: Record<string, number> = {};
  let tMark = performance.now();
  const lap = (name: string) => {
    const now = performance.now();
    stages[name] = (stages[name] ?? 0) + now - tMark;
    tMark = now;
  };
  const { prims } = buildPrims(params);
  const sc = params.scale;
  const hBody = (quality === 'high' ? 0.0064 : 0.0095) * sc;
  const hFine = (quality === 'high' ? 0.0031 : 0.0045) * sc;
  const hFace = 0.0015 * sc;
  const headCut = 1.515 * sc;
  const overlap = 0.006 * sc;

  const handBoxes: Box[] = [1, -1].map((side) =>
    bounds(
      prims.filter((p) => p.part === PART.Hand && Math.sign(p.bcx) === side),
      0.012 * sc,
    ),
  );

  // Shoes get their own finer mesh (high quality), so the sole edge, toe and
  // heel counter stay crisp: below the ankle-band line, per foot.
  const footTop = 0.15 * sc;
  const footBoxes: Box[] =
    quality === 'high'
      ? [1, -1].map((side) => {
          const fb = bounds(
            prims.filter((p) => p.part === PART.Foot && Math.sign(p.bcx) === side),
            0.01 * sc,
          );
          return { min: fb.min, max: [fb.max[0], footTop, fb.max[2]] as V3 };
        })
      : [];
  const inFoot = (x: number, y: number, z: number, m: number) => footBoxes.some((fb) => inside(fb, x, y, z, m));
  const b = bounds(prims, hBody * 3);
  const body = polygonize(prims, {
    min: b.min,
    max: b.max,
    h: hBody,
    keep: (x, y, z) => y < headCut + overlap && !handBoxes.some((hb) => inside(hb, x, y, z, overlap)) && !inFoot(x, y, z, overlap),
    // Never evaluate the head or the hands at body resolution: they are discarded.
    skip: (lo, hi) =>
      lo[1] > headCut + overlap + 3 * hBody ||
      handBoxes.some((hb) => boxIn(lo, hi, hb, overlap + 3 * hBody)) ||
      footBoxes.some((fb) => boxIn(lo, hi, fb, overlap + 3 * hBody)),
  });
  lap('body');

  // Face detail box (eyes, nose, mouth) meshed at a finer grid so the lid
  // margins and the lips keep a crisp edge; the head mesh leaves a hole there
  // and overlaps it by a couple of millimetres.
  const hsF = params.frame.head;
  const toW = (v: V3): V3 => [
    (HEAD_PIVOT[0] + (v[0] - HEAD_PIVOT[0]) * hsF) * sc,
    (HEAD_PIVOT[1] + (v[1] - HEAD_PIVOT[1]) * hsF) * sc,
    (HEAD_PIVOT[2] + (v[2] - HEAD_PIVOT[2]) * hsF) * sc,
  ];
  const faceBox: Box = { min: toW([-0.05, 1.552, 0.066]), max: toW([0.05, 1.684, 0.135]) };
  const fOverlap = 0.0025 * sc;
  const head = polygonize(prims, {
    min: [-0.15 * sc, headCut - 0.02 * sc, -0.16 * sc],
    max: [0.15 * sc, 1.8 * sc, 0.16 * sc],
    h: hFine,
    keep: (x, y, z) => y >= headCut && !(quality === 'high' && inside(faceBox, x, y, z, fOverlap)),
    skip: (lo, hi) => quality === 'high' && boxIn(lo, hi, faceBox, fOverlap + 3 * hFine),
  });
  lap('head');
  const face =
    quality === 'high'
      ? polygonize(prims, {
          min: [faceBox.min[0] - 0.004 * sc, faceBox.min[1] - 0.004 * sc, faceBox.min[2] - 0.004 * sc],
          max: [faceBox.max[0] + 0.004 * sc, faceBox.max[1] + 0.004 * sc, faceBox.max[2] + 0.004 * sc],
          h: hFace,
          keep: (x, y, z) => inside(faceBox, x, y, z, -fOverlap),
        })
      : null;
  if (face) tuck(face, faceBox, 0.004 * sc, 0.0005 * sc);
  lap('face');

  const hands = handBoxes.map((hb) => polygonize(prims, { min: hb.min, max: hb.max, h: hFine * (quality === 'high' ? 1.15 : 1.45) }));
  hands.forEach((h, i) => tuck(h, handBoxes[i], 0.005 * sc, 0.0007 * sc));
  const feet = footBoxes.map((fb) =>
    polygonize(prims, {
      min: [fb.min[0], fb.min[1], fb.min[2]],
      max: [fb.max[0], fb.max[1] + 0.004 * sc, fb.max[2]],
      h: hFine * 1.6,
      keep: (_x, y) => y < fb.max[1],
    }),
  );
  // Only the top rim (the ankle) meets the body mesh: tuck just that.
  feet.forEach((f, i) => tuck(f, { min: [-9, -9, -9], max: [9, footBoxes[i].max[1], 9] }, 0.005 * sc, 0.0007 * sc));
  lap('hands');

  const withAO = (m: MeshData, reach = 1, fadeY = -1, fadeBox?: Box): RealMesh => {
    const r = { ...m, ao: bakeAO(prims, m, sc, reach, fadeY, fadeBox) };
    lap('ao');
    return r;
  };

  let headgear: MeshData | null = null;
  if (withHeadgear) {
    // The headgear is rigid and the same for everyone: mesh it once at the
    // canonical size and scale the copy (it rides the head bone, in head space).
    const gs = sc * params.frame.head;
    const base = canonicalHeadgear(quality);
    const P = new Float32Array(base.positions.length);
    // Scaled about the head pivot rather than the joint, like the head itself.
    const off = [0, 1, 2].map((c) => sc * (1 - params.frame.head) * (HEAD_PIVOT[c] - HEAD_ORIGIN[c]));
    for (let i = 0; i < P.length; i++) P[i] = base.positions[i] * gs + off[i % 3];
    headgear = { ...base, positions: P };
    lap('headgear');
  }

  const hs = params.frame.head;
  const hairAtScaled = (x: number, y: number, z: number) => {
    const q = headUnscale(x, y, z, hs);
    return hairAt(q[0], q[1], q[2], hairSides, params.hairFront);
  };
  // Scalp patch for the hair shells, coarse: the shells multiply its triangles.
  const headPrims = prims.filter((p) => p.part === PART.Head || p.part === PART.Hair || p.sub);
  const scalpRaw = polygonize(headPrims, {
    min: [-0.12 * sc, 1.58 * sc, -0.14 * sc],
    max: [0.12 * sc, 1.8 * sc, 0.14 * sc],
    h: 0.0046 * sc,
    keep: (x, y, z) => hairAtScaled(x / sc, y / sc, z / sc) > 0.01,
  });
  const scalp = compact(scalpRaw);
  lap('scalp');
  const scalpLen = new Float32Array(scalp.positions.length / 3);
  for (let i = 0; i < scalpLen.length; i++) {
    const x = scalp.positions[i * 3] / sc;
    const y = scalp.positions[i * 3 + 1] / sc;
    const z = scalp.positions[i * 3 + 2] / sc;
    scalpLen[i] = hairAtScaled(x, y, z);
  }
  {
    const p = scalp.positions;
    for (let i = 0; i < p.length; i += 3) {
      p[i] -= HEAD_ORIGIN[0] * sc;
      p[i + 1] -= HEAD_ORIGIN[1] * sc;
      p[i + 2] -= HEAD_ORIGIN[2] * sc;
    }
  }

  const out: RealGeometry = {
    body: { ...withAO(body), smoothN: smoothNormals(body, 10) },
    head: withAO(head, 0.5, 1.565 * sc),
    face: face ? withAO(face, 0.5, 1.565 * sc) : null,
    hands: [...hands.map((h, i) => withAO(h, 0.7, -1, handBoxes[i])), ...feet.map((f) => withAO(f))],
    headgear,
    scalp,
    scalpLen,
    ms: 0,
    tris: 0,
    stages,
  };
  out.tris = [out.body, out.head, out.face, ...out.hands, headgear].reduce((s, m) => s + (m ? m.indices.length / 3 : 0), 0);
  out.ms = performance.now() - t0;
  return out;
}

/**
 * Tucks a patch's rim a fraction of a millimetre under the coarser mesh it
 * overlaps, so the seam never shows as a step or a ring (wrists, face patch).
 */
function tuck(m: MeshData, box: Box, width: number, depth: number, skipBelowY = -Infinity): void {
  const P = m.positions;
  const N = m.normals;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    if (y < skipBelowY) continue;
    const d = Math.min(x - box.min[0], box.max[0] - x, y - box.min[1], box.max[1] - y, z - box.min[2], box.max[2] - z);
    if (d >= width) continue;
    const k = depth * (1 - Math.max(0, d) / width);
    P[i] -= N[i] * k;
    P[i + 1] -= N[i + 1] * k;
    P[i + 2] -= N[i + 2] * k;
  }
}

/** Drops vertices no kept triangle uses. */
function compact(m: MeshData): MeshData {
  const n = m.positions.length / 3;
  const remap = new Int32Array(n).fill(-1);
  let count = 0;
  for (const i of m.indices) if (remap[i] < 0) remap[i] = count++;
  const pick = <T extends Float32Array | Uint16Array>(src: T, k: number, make: (len: number) => T): T => {
    const out = make(count * k);
    for (let i = 0; i < n; i++) {
      const j = remap[i];
      if (j < 0) continue;
      for (let c = 0; c < k; c++) out[j * k + c] = src[i * k + c];
    }
    return out;
  };
  return {
    positions: pick(m.positions, 3, (l) => new Float32Array(l)),
    normals: pick(m.normals, 3, (l) => new Float32Array(l)),
    skinIndex: pick(m.skinIndex, 4, (l) => new Uint16Array(l)),
    skinWeight: pick(m.skinWeight, 4, (l) => new Float32Array(l)),
    part: pick(m.part, 1, (l) => new Float32Array(l)),
    indices: Uint32Array.from(m.indices, (i) => remap[i]),
  };
}

/**
 * Normals relaxed over the surface (a few Laplacian passes): the singlet uses
 * them so lycra bridges the small dips between muscles instead of following
 * every one, which is what made it look wet and stained.
 */
function smoothNormals(m: MeshData, passes: number): Float32Array {
  const n = m.positions.length / 3;
  let cur = Float32Array.from(m.normals);
  let nxt = new Float32Array(cur.length);
  const idx = m.indices;
  const cnt = new Float32Array(n);
  for (let p = 0; p < passes; p++) {
    nxt.set(cur);
    cnt.fill(1);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      for (const [i, j, k] of [[a, b, c], [b, c, a], [c, a, b]]) {
        nxt[i * 3] += cur[j * 3] + cur[k * 3];
        nxt[i * 3 + 1] += cur[j * 3 + 1] + cur[k * 3 + 1];
        nxt[i * 3 + 2] += cur[j * 3 + 2] + cur[k * 3 + 2];
        cnt[i] += 2;
      }
    }
    for (let i = 0; i < n; i++) {
      const x = nxt[i * 3], y = nxt[i * 3 + 1], z = nxt[i * 3 + 2];
      const l = Math.hypot(x, y, z) || 1;
      nxt[i * 3] = x / l;
      nxt[i * 3 + 1] = y / l;
      nxt[i * 3 + 2] = z / l;
    }
    [cur, nxt] = [nxt, cur];
  }
  return cur;
}

export function toGeometry(m: MeshData | RealMesh): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(m.normals, 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(m.skinIndex, 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute(m.skinWeight, 4));
  g.setAttribute('aPart', new Float32BufferAttribute(m.part, 1));
  const ao = 'ao' in m ? m.ao : new Float32Array(m.positions.length / 3).fill(1);
  g.setAttribute('aAO', new Float32BufferAttribute(ao, 1));
  const sn = 'smoothN' in m && m.smoothN ? m.smoothN : m.normals;
  g.setAttribute('aSmoothN', new Float32BufferAttribute(sn, 3));
  g.setIndex(new BufferAttribute(m.indices, 1));
  g.computeBoundingSphere();
  return g;
}
