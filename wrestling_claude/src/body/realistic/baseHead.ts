import { BASE_HEAD } from './baseHeadData';
import { EYE_Z, HEAD_PIVOT } from './anatomy';
import type { BodyParams } from './anatomy';
import type { MeshData } from './mesher';
import { PART } from './anatomy';
import { warpPoint, photoSample, mouthLift, calmOffsets } from './faceFit';
import { BASE_LANDMARKS } from './faces/baseLandmarks';

/**
 * A face from Blender Studio's CC0 "Human Base Meshes" head on the generated body.
 *
 * Skull and neck are pulled onto each wrestler's own generated surface (`guide`),
 * so hair, headgear and the neck seam still fit. Only the face keeps the base
 * mesh's shape, varied per wrestler by the same face parameters as before.
 */

const EYE_HEIGHT = 1.649;
const FIT = 0.064 / BASE_HEAD.ipd;

/** Canonical mouth line of the base mesh, for the lip paint. */
export const BASE_HEAD_MOUTH_Y = 1.5745;

function decode(): { positions: Float64Array; indices: Uint16Array } {
  const bytes = (text: string) => {
    const raw = atob(text);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out.buffer;
  };
  const q = new Uint16Array(bytes(BASE_HEAD.positions));
  const positions = new Float64Array(q.length);
  for (let i = 0; i < q.length; i++) {
    const c = i % 3;
    const v = BASE_HEAD.lo[c] + (q[i] / 65535) * (BASE_HEAD.hi[c] - BASE_HEAD.lo[c]);
    positions[i] = v * FIT + (c === 1 ? EYE_HEIGHT : c === 2 ? EYE_Z : 0);
  }
  return { positions, indices: new Uint16Array(bytes(BASE_HEAD.indices)) };
}

let decoded: ReturnType<typeof decode> | null = null;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bump = (dx: number, dy: number, dz: number, r: number) => Math.exp(-(dx * dx + dy * dy + dz * dz) / (r * r));

/** Offsets the canonical face by the wrestler's parameters, measured from the neutral generic centre. */
function shapeFace(p: [number, number, number], F: BodyParams['face']): void {
  const [x, y, z] = p;
  const ax = Math.abs(x);
  const sign = x < 0 ? -1 : 1;
  const lower = smooth(1.615, 1.565, y);
  const front = smooth(0.0, 0.06, z);
  // The base head is soft and neutral. Grown athletes have more bone: a heavier
  // brow, a wider jaw and a stronger chin before any individual variation.
  p[0] += sign * ax * lower * 0.07;
  p[2] += bump(ax - 0.028, y - 1.674, z - 0.1, 0.026) * 0.0045;
  p[2] += bump(x, y - 1.535, z - 0.1, 0.03) * 0.004;
  p[1] -= bump(x, y - 1.535, z - 0.1, 0.03) * 0.003;
  p[0] += sign * bump(ax - 0.055, y - 1.555, z - 0.04, 0.03) * 0.004;
  // Jaw and cheekbones widen sideways; the lower face drops with its length.
  p[0] += sign * ax * lower * (F.jaw - 0.0055) * 14;
  p[0] += sign * (F.cheek - 0.003) * bump(ax - 0.06, y - 1.625, z - 0.05, 0.035) * 2;
  p[1] -= lower * front * (F.faceLen + 0.005) * 1.4;
  // Chin forward and wider.
  const chin = bump(x, y - 1.535, z - 0.1, 0.028);
  p[2] += chin * (F.chin - 0.003) * 2.2;
  p[0] += x * chin * (F.chinW - 1.38) * 0.5;
  // Nose: longer, and wider at the wings.
  const nose = bump(x, y - 1.615, z - 0.12, 0.022);
  p[1] -= nose * (F.nose - 0.003) * 1.6;
  p[2] += nose * (F.nose - 0.003) * 0.8;
  p[0] += sign * bump(ax - 0.015, y - 1.61, z - 0.105, 0.012) * F.noseW * 2.4;
  // Brow ridge and hollowed cheeks.
  p[2] += bump(ax - 0.03, y - 1.672, z - 0.1, 0.022) * (F.brow - 0.001) * 2.2;
  p[2] -= bump(ax - 0.05, y - 1.59, z - 0.07, 0.022) * F.hollow * 0.006;
  // Individual bone structure, so one base mesh doesn't read as one person.
  const S = F.baseShape;
  if (S) {
    const face = front * smooth(1.53, 1.56, y) * (1 - smooth(1.7, 1.74, y));
    const below = smooth(1.64, 1.59, y);
    p[0] += x * face * S[0] * 0.04;                                              // face width
    p[1] -= below * front * S[1] * 0.0035;                                       // midface length
    const bridge = bump(x, y - 1.64, z - 0.115, 0.016);
    p[2] += bridge * S[2] * 0.0028;                                              // nose bridge height
    p[0] += sign * bump(ax - 0.015, y - 1.61, z - 0.105, 0.012) * S[3] * 0.0028; // nose wings
    const tip = bump(x, y - 1.612, z - 0.128, 0.012);
    p[1] -= tip * S[4] * 0.0028;                                                 // tip drop
    p[2] += tip * S[4] * 0.0012;
    p[0] += sign * bump(ax - 0.055, y - 1.63, z - 0.06, 0.024) * S[5] * 0.0032;  // cheekbones
    p[1] += bump(ax - 0.055, y - 1.63, z - 0.06, 0.024) * S[6] * 0.0025;         // cheekbone height
    const chinW = bump(x, y - 1.535, z - 0.095, 0.03);
    p[0] += x * chinW * S[7] * 0.14;                                             // square or narrow chin
    p[2] += bump(x, y - BASE_HEAD_MOUTH_Y, z - 0.11, 0.012) * S[8] * 0.0018;     // lip fullness
    p[2] += bump(x, y - 1.715, z - 0.09, 0.03) * S[9] * 0.0035;                  // forehead slope
  }
  // Lip fullness.
  p[2] += bump(x, y - BASE_HEAD_MOUTH_Y, z - 0.11, 0.012) * (F.lips - 1) * 0.02;
}

/** 1 on the face, 0 where the surface follows the generated skull and neck. */
function faceWeight(x: number, y: number, z: number): number {
  const ahead = smooth(0.012, 0.05, z - Math.abs(x) * 0.3);
  const hairline = 1 - smooth(1.7, 1.735, y);
  // Under the chin the throat belongs to the neck.
  const jawline = smooth(0.03, 0.075, z - (1.55 - Math.min(y, 1.55)) * 1.1) * smooth(1.512, 1.53, y);
  return ahead * hairline * jawline;
}

class Nearest {
  private cells = new Map<number, number[]>();
  constructor(private P: Float32Array, private size: number) {
    for (let i = 0; i < P.length / 3; i++) {
      const k = this.key(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      const list = this.cells.get(k);
      if (list) list.push(i);
      else this.cells.set(k, [i]);
    }
  }
  private key(x: number, y: number, z: number): number {
    const c = (v: number) => Math.floor(v / this.size) + 512;
    return c(x) + c(y) * 1024 + c(z) * 1048576;
  }
  find(x: number, y: number, z: number): number {
    const P = this.P;
    let best = -1;
    let bestD = Infinity;
    for (let reach = 1; reach <= 6 && best < 0; reach += 2) {
      for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) for (let c = -reach; c <= reach; c++) {
        const list = this.cells.get(this.key(x + a * this.size, y + b * this.size, z + c * this.size));
        if (!list) continue;
        for (const i of list) {
          const dx = P[i * 3] - x, dy = P[i * 3 + 1] - y, dz = P[i * 3 + 2] - z;
          const d = dx * dx + dy * dy + dz * dz;
          if (d < bestD) { bestD = d; best = i; }
        }
      }
    }
    return best;
  }
}

/**
 * The base mesh's eyelid margins are open edges around the eye sockets. Shading
 * them reads as a lash line, which the generated head painted by position instead.
 */
export function darkenEyeMargins<T extends MeshData & { ao: Float32Array }>(m: T, sc: number): T {
  const seen = new Map<number, number>();
  const n = m.positions.length / 3;
  const edge = (a: number, b: number) => Math.min(a, b) * n + Math.max(a, b);
  for (let t = 0; t < m.indices.length; t += 3) for (let e = 0; e < 3; e++) {
    const key = edge(m.indices[t + e], m.indices[t + ((e + 1) % 3)]);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const rim = new Uint8Array(n);
  for (const [key, count] of seen) {
    if (count !== 1) continue;
    const a = Math.floor(key / n), b = key % n;
    for (const v of [a, b]) {
      const y = m.positions[v * 3 + 1] / sc, z = m.positions[v * 3 + 2] / sc;
      if (Math.abs(y - EYE_HEIGHT) < 0.025 && z > 0.05) rim[v] = 1;
    }
  }
  const ring = new Uint8Array(n);
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
    if (rim[a] || rim[b] || rim[c]) ring[a] = ring[b] = ring[c] = 1;
  }
  for (let v = 0; v < n; v++) {
    if (rim[v]) m.ao[v] *= 0.3;
    else if (ring[v]) m.ao[v] *= 0.72;
  }
  return m;
}

export function buildBaseHead(params: BodyParams, guide: MeshData, headCutCanonical: number): MeshData {
  decoded ??= decode();
  const sc = params.scale;
  const hs = params.frame.head;
  const src = decoded.positions;
  const n = src.length / 3;
  const near = new Nearest(guide.positions, 0.012 * sc);
  const positions = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const part = new Float32Array(n).fill(PART.Head);
  // Photo fit: warp toward the portrait's landmarks, keeping the warped canonical points to project the photo.
  const fit = params.faceFit && BASE_LANDMARKS.length ? params.faceFit : null;
  const canon = fit ? new Float32Array(n * 3) : null;
  const faceF = fit ? new Float32Array(n) : null;
  const moved = fit ? new Float32Array(n) : null;
  const G = guide.positions;
  const GN = guide.normals;
  const q: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    q[0] = src[i * 3]; q[1] = src[i * 3 + 1]; q[2] = src[i * 3 + 2];
    const f = faceWeight(q[0], q[1], q[2]);
    // A fitted face takes its shape out to the edge of the face (cheek sides, jaw): the fit's weight
    // rises twice as fast as the face weight, and the generic guide pulls that much less there.
    const fw = fit ? Math.min(1, f * 2) : f;
    shapeFace(q, params.face);
    if (fit) {
      const x0 = q[0], y0 = q[1], z0 = q[2];
      // The photo is sampled where the point sits in the portrait (full fit, before the jaw closes);
      // the surface is built with a big smile relaxed.
      canon![i * 3] = x0; canon![i * 3 + 1] = y0; canon![i * 3 + 2] = z0;
      warpPoint(canon!.subarray(i * 3, i * 3 + 3) as unknown as [number, number, number], BASE_LANDMARKS, fit.offsets, fw);
      warpPoint(q, BASE_LANDMARKS, calmOffsets(fit), fw);
      faceF![i] = f;
      q[1] += mouthLift(x0, y0, fit) * fw;
      // Baked occlusion is measured on the unwarped head; how far this point moved says how wrong it is.
      moved![i] = Math.min(1, Math.hypot(q[0] - x0, q[1] - y0, q[2] - z0) / 0.005);
    }
    const wx = (HEAD_PIVOT[0] + (q[0] - HEAD_PIVOT[0]) * hs) * sc;
    const wy = (HEAD_PIVOT[1] + (q[1] - HEAD_PIVOT[1]) * hs) * sc;
    const wz = (HEAD_PIVOT[2] + (q[2] - HEAD_PIVOT[2]) * hs) * sc;
    const j = near.find(wx, wy, wz);
    let ox = 0, oy = 0, oz = 0;
    if (j >= 0) {
      // Onto the guide's tangent plane, so the coarse grid never shows as facets.
      const d = (G[j * 3] - wx) * GN[j * 3] + (G[j * 3 + 1] - wy) * GN[j * 3 + 1] + (G[j * 3 + 2] - wz) * GN[j * 3 + 2];
      const pull = 1 - fw;
      ox = GN[j * 3] * d * pull; oy = GN[j * 3 + 1] * d * pull; oz = GN[j * 3 + 2] * d * pull;
      for (let s = 0; s < 4; s++) {
        skinIndex[i * 4 + s] = guide.skinIndex[j * 4 + s];
        skinWeight[i * 4 + s] = guide.skinWeight[j * 4 + s];
      }
    } else skinWeight[i * 4] = 1;
    positions[i * 3] = wx + ox;
    positions[i * 3 + 1] = wy + oy;
    positions[i * 3 + 2] = wz + oz;
  }
  // Drop the shoulder cuff; the body mesh takes over at the cut.
  const cut = headCutCanonical * sc;
  const kept: number[] = [];
  const I = decoded.indices;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if ((positions[a * 3 + 1] + positions[b * 3 + 1] + positions[c * 3 + 1]) / 3 >= cut) kept.push(a, b, c);
  }
  const indices = Uint32Array.from(kept);
  const normals = new Float32Array(n * 3);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const at of [a, b, c]) { normals[at] += nx; normals[at + 1] += ny; normals[at + 2] += nz; }
  }
  for (let i = 0; i < n * 3; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= l; normals[i + 1] /= l; normals[i + 2] /= l;
  }
  let photo: Float32Array | undefined;
  if (fit) {
    photo = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const s = photoSample(canon!.subarray(i * 3, i * 3 + 3), normals[i * 3 + 2], fit, faceF![i]);
      photo[i * 4] = s[0]; photo[i * 4 + 1] = s[1]; photo[i * 4 + 2] = s[2]; photo[i * 4 + 3] = moved![i];
    }
  }
  return { positions, normals, indices, skinIndex, skinWeight, part, photo };
}
