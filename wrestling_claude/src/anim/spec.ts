import { Euler, Quaternion, Vector3 } from 'three';
import { FOOT, P } from './posture';
import type { Posture } from './posture';

/**
 * Authoring poses.
 *
 * A pose is written the way a coach describes one, in a local frame: where the
 * hips are, how the pelvis is turned, how far the spine bends, where each foot
 * and hand is, which way the knees and elbows point. Units are metres and
 * degrees. The frame is either one wrestler's own (facing +Z) or a pair's
 * (+Z running from the attacker toward the defender, +X the attacker's left).
 *
 * Specs compile to a LocalPose — the posture layout, but in frame space with
 * Euler angles — which interpolates cleanly and converts to a world posture.
 */

export type V3 = [number, number, number];
/** Ball of the foot (x, y, z), yaw (deg, 0 = along +Z), heel lift (deg). */
export type FootSpec = [number, number, number, number, number];

export interface PoseSpec {
  /** Start from this compiled pose instead of the previous key. */
  base?: LocalPose;
  hips?: V3;
  /** Pelvis yaw, pitch (forward +), roll, and optionally roll about the spine — degrees. */
  rot?: V3 | [number, number, number, number];
  /** Spine bend: pitch (forward +), twist, side bend — degrees. */
  spine?: V3;
  /** Head relative to the chest: pitch (chin down +), yaw, roll — degrees. */
  head?: V3;
  /** 0..1: how strongly the head tracks the look target. */
  look?: number;
  footL?: FootSpec;
  footR?: FootSpec;
  kneeL?: V3;
  kneeR?: V3;
  handL?: V3;
  handR?: V3;
  elbowL?: V3;
  elbowR?: V3;
  /** Wrist flex, deviation, twist — degrees. */
  wristL?: V3;
  wristR?: V3;
  /** Shoulder elevation, protraction — degrees. */
  shrugL?: [number, number];
  shrugR?: [number, number];
  /** Toe flattening, per foot. */
  toes?: [number, number];
}

export type LocalPose = Float32Array;

const DEG = Math.PI / 180;

export const createLocal = (): LocalPose => new Float32Array(P.SIZE);

function put3(dst: LocalPose, at: number, v: V3, scale = 1): void {
  dst[at] = v[0] * scale;
  dst[at + 1] = v[1] * scale;
  dst[at + 2] = v[2] * scale;
}

/** Apply a spec on top of `base` (unspecified fields inherit). */
export function compileSpec(spec: PoseSpec, base: LocalPose | null, out: LocalPose = createLocal()): LocalPose {
  if (spec.base) out.set(spec.base);
  else if (base) out.set(base);
  if (spec.hips) put3(out, P.HIPS, spec.hips);
  if (spec.rot) {
    out[P.HIPS_Q] = spec.rot[0] * DEG;
    out[P.HIPS_Q + 1] = spec.rot[1] * DEG;
    out[P.HIPS_Q + 2] = spec.rot[2] * DEG;
    out[P.HIPS_Q + 3] = (spec.rot[3] ?? 0) * DEG;
  }
  if (spec.spine) put3(out, P.SPINE, spec.spine, DEG);
  if (spec.head) put3(out, P.HEAD, spec.head, DEG);
  if (spec.look !== undefined) out[P.LOOK_W] = spec.look;
  const foot = (at: number, f: FootSpec | undefined) => {
    if (!f) return;
    out[at] = f[0];
    out[at + 1] = f[1];
    out[at + 2] = f[2];
    out[at + FOOT.YAW] = f[3] * DEG;
    out[at + FOOT.HEEL] = f[4] * DEG;
  };
  foot(P.FOOT_L, spec.footL);
  foot(P.FOOT_R, spec.footR);
  if (spec.kneeL) put3(out, P.KNEE_L, spec.kneeL);
  if (spec.kneeR) put3(out, P.KNEE_R, spec.kneeR);
  if (spec.handL) put3(out, P.HAND_L, spec.handL);
  if (spec.handR) put3(out, P.HAND_R, spec.handR);
  if (spec.elbowL) put3(out, P.ELBOW_L, spec.elbowL);
  if (spec.elbowR) put3(out, P.ELBOW_R, spec.elbowR);
  if (spec.wristL) put3(out, P.WRIST_L, spec.wristL, DEG);
  if (spec.wristR) put3(out, P.WRIST_R, spec.wristR, DEG);
  if (spec.shrugL) {
    out[P.SHRUG_L] = spec.shrugL[0] * DEG;
    out[P.SHRUG_L + 1] = spec.shrugL[1] * DEG;
  }
  if (spec.shrugR) {
    out[P.SHRUG_R] = spec.shrugR[0] * DEG;
    out[P.SHRUG_R + 1] = spec.shrugR[1] * DEG;
  }
  if (spec.toes) {
    out[P.TOES] = spec.toes[0];
    out[P.TOES + 1] = spec.toes[1];
  }
  return out;
}

/** Mirror a local pose left-to-right (swaps limbs, negates x and yaw/roll). */
export function mirrorLocal(src: LocalPose, out: LocalPose = createLocal()): LocalPose {
  const s = src;
  const tmp = new Float32Array(s);
  const mx = (at: number) => {
    tmp[at] = -tmp[at];
  };
  // Swap left/right blocks.
  const swap = (a: number, b: number, n: number) => {
    for (let i = 0; i < n; i++) {
      tmp[a + i] = s[b + i];
      tmp[b + i] = s[a + i];
    }
  };
  swap(P.FOOT_L, P.FOOT_R, 6);
  swap(P.KNEE_L, P.KNEE_R, 3);
  swap(P.HAND_L, P.HAND_R, 3);
  swap(P.ELBOW_L, P.ELBOW_R, 3);
  swap(P.WRIST_L, P.WRIST_R, 3);
  swap(P.SHRUG_L, P.SHRUG_R, 2);
  tmp[P.TOES] = s[P.TOES + 1];
  tmp[P.TOES + 1] = s[P.TOES];
  for (const at of [P.HIPS, P.FOOT_L, P.FOOT_R, P.KNEE_L, P.KNEE_R, P.HAND_L, P.HAND_R, P.ELBOW_L, P.ELBOW_R]) mx(at);
  // Yaw and roll flip; pitch stays.
  tmp[P.HIPS_Q] = -s[P.HIPS_Q];
  tmp[P.HIPS_Q + 2] = -s[P.HIPS_Q + 2];
  tmp[P.HIPS_Q + 3] = -s[P.HIPS_Q + 3];
  tmp[P.SPINE + 1] = -s[P.SPINE + 1];
  tmp[P.SPINE + 2] = -s[P.SPINE + 2];
  tmp[P.HEAD + 1] = -s[P.HEAD + 1];
  tmp[P.HEAD + 2] = -s[P.HEAD + 2];
  tmp[P.FOOT_L + FOOT.YAW] = -tmp[P.FOOT_L + FOOT.YAW];
  tmp[P.FOOT_R + FOOT.YAW] = -tmp[P.FOOT_R + FOOT.YAW];
  tmp[P.FOOT_L + FOOT.ROLL] = -tmp[P.FOOT_L + FOOT.ROLL];
  tmp[P.FOOT_R + FOOT.ROLL] = -tmp[P.FOOT_R + FOOT.ROLL];
  out.set(tmp);
  return out;
}

/* --------------------------------------------------------------- frames --- */

/** A frame on the mat: origin and the world yaw its +Z axis points along. */
export interface Frame {
  x: number;
  z: number;
  yaw: number;
}

const _q = new Quaternion();
const _qa = new Quaternion();
const _qf = new Quaternion();
const _e = new Euler(0, 0, 0, 'YXZ');

function xform(src: LocalPose, at: number, f: Frame, c: number, s: number, out: Posture): void {
  const lx = src[at];
  const lz = src[at + 2];
  out[at] = f.x + lx * c + lz * s;
  out[at + 1] = src[at + 1];
  out[at + 2] = f.z - lx * s + lz * c;
}

/** Convert a frame-space pose to a world posture. */
export function localToWorld(src: LocalPose, f: Frame, out: Posture): void {
  out.set(src);
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  for (const at of [P.HIPS, P.LOOK, P.FOOT_L, P.FOOT_R, P.KNEE_L, P.KNEE_R, P.HAND_L, P.HAND_R, P.ELBOW_L, P.ELBOW_R]) {
    xform(src, at, f, c, s, out);
  }
  out[P.FOOT_L + FOOT.YAW] = src[P.FOOT_L + FOOT.YAW] + f.yaw;
  out[P.FOOT_R + FOOT.YAW] = src[P.FOOT_R + FOOT.YAW] + f.yaw;
  _q.setFromEuler(_e.set(src[P.HIPS_Q + 1], src[P.HIPS_Q], src[P.HIPS_Q + 2], 'YXZ'));
  // Roll about the spine's own axis, for bodies turned onto a shoulder.
  if (src[P.HIPS_Q + 3] !== 0) _q.multiply(_qa.setFromAxisAngle(Y_UP, src[P.HIPS_Q + 3]));
  _qf.setFromAxisAngle(Y_UP, f.yaw);
  _qf.multiply(_q);
  out[P.HIPS_Q] = _qf.x;
  out[P.HIPS_Q + 1] = _qf.y;
  out[P.HIPS_Q + 2] = _qf.z;
  out[P.HIPS_Q + 3] = _qf.w;
}

const Y_UP = new Vector3(0, 1, 0);

/**
 * Re-express a pose authored in a child frame (placed at `p` inside the parent
 * frame) in the parent frame. Used to start or end a move exactly on a hold.
 */
export function transformLocal(src: LocalPose, p: Frame, out: LocalPose = createLocal()): LocalPose {
  const tmp = new Float32Array(src);
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  for (const at of [P.HIPS, P.LOOK, P.FOOT_L, P.FOOT_R, P.KNEE_L, P.KNEE_R, P.HAND_L, P.HAND_R, P.ELBOW_L, P.ELBOW_R]) {
    const lx = src[at];
    const lz = src[at + 2];
    tmp[at] = p.x + lx * c + lz * s;
    tmp[at + 2] = p.z - lx * s + lz * c;
  }
  tmp[P.HIPS_Q] = src[P.HIPS_Q] + p.yaw;
  tmp[P.FOOT_L + FOOT.YAW] = src[P.FOOT_L + FOOT.YAW] + p.yaw;
  tmp[P.FOOT_R + FOOT.YAW] = src[P.FOOT_R + FOOT.YAW] + p.yaw;
  out.set(tmp);
  return out;
}

/** Frame-space point to world. */
export function frameToWorld(f: Frame, x: number, y: number, z: number, out: Vector3): Vector3 {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return out.set(f.x + x * c + z * s, y, f.z - x * s + z * c);
}

/** World point to frame space. */
export function worldToFrame(f: Frame, x: number, y: number, z: number, out: Vector3): Vector3 {
  const dx = x - f.x;
  const dz = z - f.z;
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return out.set(dx * c - dz * s, y, dx * s + dz * c);
}

/* --------------------------------------------------------------- tracks --- */

export interface Key {
  /** Normalised time 0..1. */
  t: number;
  pose: PoseSpec;
  /** Come to rest at this key (zero tangent) — a held position or a stop. */
  stop?: boolean;
  /** Arrive accelerating, like a body landing: ease-in into this key. */
  land?: boolean;
}

export interface CompiledTrack {
  times: number[];
  poses: LocalPose[];
  stop: boolean[];
  land: boolean[];
}

/** Yaw-like channels: each key is unwrapped to sit within half a turn of the last. */
const WRAP_SLOTS = [P.HIPS_Q, P.FOOT_L + FOOT.YAW, P.FOOT_R + FOOT.YAW];

export function compileTrack(keys: Key[], base: LocalPose | null): CompiledTrack {
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  const poses: LocalPose[] = [];
  let prev = base;
  for (const k of sorted) {
    const lp = compileSpec(k.pose, prev);
    if (prev) {
      for (const s of WRAP_SLOTS) {
        while (lp[s] - prev[s] > Math.PI) lp[s] -= Math.PI * 2;
        while (lp[s] - prev[s] < -Math.PI) lp[s] += Math.PI * 2;
      }
    }
    poses.push(lp);
    prev = lp;
  }
  return {
    times: sorted.map((k) => k.t),
    poses,
    stop: sorted.map((k) => !!k.stop),
    land: sorted.map((k) => !!k.land),
  };
}

/**
 * Sample a track at normalised time `u` with a time-aware Catmull-Rom spline,
 * so motion flows through keys instead of stopping at each one.
 */
export function sampleTrack(tr: CompiledTrack, u: number, out: LocalPose): void {
  const n = tr.times.length;
  if (n === 1 || u <= tr.times[0]) {
    out.set(tr.poses[0]);
    return;
  }
  if (u >= tr.times[n - 1]) {
    out.set(tr.poses[n - 1]);
    return;
  }
  let i = 0;
  while (i < n - 2 && u > tr.times[i + 1]) i++;
  const t0 = tr.times[i];
  const t1 = tr.times[i + 1];
  const h = t1 - t0 || 1e-6;
  let s = (u - t0) / h;
  const a = tr.poses[i];
  const b = tr.poses[i + 1];
  const pa = i > 0 ? tr.poses[i - 1] : null;
  const pb = i + 2 < n ? tr.poses[i + 2] : null;
  const ta = i > 0 ? tr.times[i - 1] : t0;
  const tb = i + 2 < n ? tr.times[i + 2] : t1;
  const stopA = tr.stop[i] || !pa;
  const stopB = tr.stop[i + 1] || !pb;
  const land = tr.land[i + 1];
  if (land) s = s * s; // accelerate into an impact

  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  for (let k = 0; k < P.SIZE; k++) {
    const va = a[k];
    const vb = b[k];
    // Tangents in value-per-segment units.
    const ma = stopA || land ? 0 : ((vb - pa![k]) / (t1 - ta)) * h;
    const mb = stopB || land ? 0 : ((pb![k] - va) / (tb - t0)) * h;
    out[k] = h00 * va + h10 * ma + h01 * vb + h11 * mb;
  }
}
