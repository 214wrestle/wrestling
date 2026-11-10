import type { FaceParams } from './anatomy';

/**
 * Photo-fitted faces. The base head's face is warped so its 478 MediaPipe face landmarks land
 * where a wrestler's portrait puts them, and the portrait is projected onto the warped face.
 *
 * `?lab=facefit` (dev only) measures everything: it runs MediaPipe's face landmarker once on a
 * render of the base head (BASE_LANDMARKS, `faces/baseLandmarks.ts`) and once per portrait
 * (`faces/fits.ts`). Runtime only applies the stored numbers; nothing calls MediaPipe in the game.
 */

/** Face parameters every fitted face is measured with and built with: the base head's own zero point. */
export const FIT_FACE: FaceParams = {
  jaw: 0.0055, chin: 0.003, chinW: 1.38, faceLen: -0.005, nose: 0.003, noseW: 0, brow: 0.001,
  cheek: 0.003, hollow: 0, lips: 1, cauli: 0, smile: 0, eyeOpen: 0.9, eyeWidth: 0.95,
  upperLidHood: 0.0016, naturalLidFold: true, roundedCheeks: true, naturalNasalBase: false,
  closedMouth: true, foreheadProjection: 0, baseShape: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

/** MediaPipe's face-oval landmark loop, in order around the face. */
export const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

/** What a fit stores; offsets and coordinates are canonical metres (1.76 m body, head scale 1). */
export interface FaceFitData {
  /** Portrait file name in `faces/`. */
  photo: string;
  /** Per landmark: where the portrait puts it minus where the base head has it (x, y, z). */
  offsets: number[];
  /** Canonical point -> photo texture coordinates: u = a·q + a0, v = b·q + b0 ([ax, ay, az, a0, bx, by, bz, b0]). */
  toPhoto: number[];
  /** Face outline in photo texture coordinates (u, v pairs), shrunk a touch so no hair or background bleeds in. */
  oval: number[];
  /** The base head's mouth line (canonical height) and how far the portrait's lips were apart (metres).
   * Everything below the mouth rises by the gap, so the jaw closes without folding under the chin. */
  mouthY: number;
  mouthGap: number;
  /** Mean skin colour sampled from the cheeks (sRGB hex). */
  skin: string;
  /** Eyebrow colour (darkest part of the brows, standing in for the hair) and iris colour, from the portrait. */
  hair?: string;
  eye?: string;
  /** The portrait is black and white: its colours say nothing about skin, hair or eyes, only how light they are. */
  mono?: boolean;
  /** Where the portrait came from. */
  source: string;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Warps one canonical point by the fit (weighted toward nearby landmarks); `f` is how much of it is face. */
export function warpPoint(q: [number, number, number], base: ArrayLike<number>, offsets: ArrayLike<number>, f: number): void {
  if (f <= 0) return;
  const s2 = 2 * 0.0085 * 0.0085;
  let wx = 0, wy = 0, wz = 0, ws = 0;
  for (let i = 0; i < base.length; i += 3) {
    const dx = q[0] - base[i], dy = q[1] - base[i + 1], dz = q[2] - base[i + 2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > 0.0012) continue;
    const w = Math.exp(-d2 / s2);
    wx += w * offsets[i]; wy += w * offsets[i + 1]; wz += w * offsets[i + 2]; ws += w;
  }
  if (ws <= 0) return;
  // Full strength among the landmarks, fading out past the last of them.
  const k = f * (ws / (ws + 0.35)) / ws;
  q[0] += wx * k; q[1] += wy * k; q[2] += wz * k;
}

/** MediaPipe's lip landmarks (outer and inner contours). */
const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 185, 40, 39, 37, 0, 267, 269, 270, 409,
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 191, 80, 81, 82, 13, 312, 311, 310, 415];

const calm = new WeakMap<FaceFitData, Float32Array>();
/** How much of a smile the relaxed shape takes out (0 for a closed mouth, 0.6 for a 12 mm lip gap). */
const calmShare = (fit: FaceFitData) => 0.6 * smooth(0.004, 0.012, fit.mouthGap);
/**
 * Offsets for the face's shape with a big smile relaxed: the lip landmarks are drawn toward their common
 * offset (up to 60% for a 12 mm lip gap), so the mouth is built closer to neutral. The photo is still sampled
 * where the full fit puts each point, so the portrait's lips follow the calmer shape instead of a stretched grin.
 */
export function calmOffsets(fit: FaceFitData): ArrayLike<number> {
  let out = calm.get(fit);
  if (out) return out;
  out = Float32Array.from(fit.offsets);
  const k = calmShare(fit);
  if (k > 0) {
    const mean = [0, 0, 0];
    for (const i of LIPS) for (let c = 0; c < 3; c++) mean[c] += fit.offsets[i * 3 + c] / LIPS.length;
    for (const i of LIPS) for (let c = 0; c < 3; c++) out[i * 3 + c] = fit.offsets[i * 3 + c] * (1 - k) + mean[c] * k;
  }
  calm.set(fit, out);
  return out;
}

/**
 * How far a base-head point (its height before the warp) moves up (+) or down (-) to close the portrait's
 * open mouth. In a smile the teeth are nearly together and the lips part over them, so the lips close toward
 * each other (each half the gap) within a couple of centimetres; the chin and the nose stay where the photo
 * puts them. (Lifting the whole lower face by the gap shortened every smiling face and rounded the chin.)
 */
export function mouthLift(x0: number, y0: number, fit: FaceFitData): number {
  // The relaxed lips already close part of the gap; close only what is left, or the lips cross.
  const half = 0.5 * fit.mouthGap * (1 - calmShare(fit));
  // Toward the corners and cheeks the band widens, as skin stretches over a wider area there.
  const k = smooth(0.012, 0.045, Math.abs(x0));
  const d = y0 - fit.mouthY;
  // Up below the mouth line, down above it, each fading out toward chin and nose. Between the lips the
  // change is a sharp step (they meet); out on the cheeks it is a smooth crossing, so no crease runs across.
  const below = smooth(-0.018 - 0.012 * k, -0.002, d);
  const above = 1 - smooth(0.002, 0.012 + 0.008 * k, d);
  const w = 0.0012 + 0.016 * k;
  const t = smooth(-w, w, d);
  return half * ((1 - t) * below - t * above);
}

/** Photo texture coordinates and blend for a warped canonical point (before the mouth lift) with its normal. */
export function photoSample(q: ArrayLike<number>, nz: number, fit: FaceFitData, f: number): [number, number, number] {
  const T = fit.toPhoto;
  const u = T[0] * q[0] + T[1] * q[1] + T[2] * q[2] + T[3];
  const v = T[4] * q[0] + T[5] * q[1] + T[6] * q[2] + T[7];
  // Inside the oval, feathered wide over the outer part so no edge shows; the side planes stretch
  // the projection, so fade them.
  const d = insideDistance(u, v, fit.oval);
  // The top of the outline runs along the hairline, where the photo has hair, fringe and its shadow:
  // fade out over the top sixth of the face instead of carrying a dark band onto the forehead.
  const [vBot, vTop] = ovalSpan(fit);
  const fromTop = (vTop - v) / Math.max(1e-6, vTop - vBot);
  const mask = smooth(0, 0.075, d) * smooth(0.02, 0.17, fromTop) * smooth(0.25, 0.6, nz) * Math.min(1, f * 1.5);
  return [u, v, mask];
}

const spans = new WeakMap<FaceFitData, [number, number]>();
/** Lowest and highest v of the face outline (texture v runs up). */
function ovalSpan(fit: FaceFitData): [number, number] {
  let s = spans.get(fit);
  if (!s) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 1; i < fit.oval.length; i += 2) { lo = Math.min(lo, fit.oval[i]); hi = Math.max(hi, fit.oval[i]); }
    s = [lo, hi];
    spans.set(fit, s);
  }
  return s;
}

/** Signed distance (positive inside) from (u, v) to a closed polygon, in texture units. */
function insideDistance(u: number, v: number, poly: number[]): number {
  let inside = false;
  let best = Infinity;
  const n = poly.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2], yi = poly[i * 2 + 1], xj = poly[j * 2], yj = poly[j * 2 + 1];
    if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
    const ex = xj - xi, ey = yj - yi;
    const t = Math.max(0, Math.min(1, ((u - xi) * ex + (v - yi) * ey) / (ex * ex + ey * ey || 1)));
    const px = xi + ex * t - u, py = yi + ey * t - v;
    best = Math.min(best, Math.hypot(px, py));
  }
  return inside ? best : -best;
}
