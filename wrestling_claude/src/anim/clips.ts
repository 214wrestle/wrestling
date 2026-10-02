import type { BoneName } from '../body/skeleton';
import { MIRROR } from '../body/skeleton';
import { P } from './posture';
import { compileSpec, compileTrack, createLocal, mirrorLocal, sampleTrack } from './spec';
import type { CompiledTrack, Key, LocalPose, PoseSpec, V3 } from './spec';

/**
 * Paired clips: two bodies authored together in one frame.
 *
 * Moves are timelines (keys at normalised time for each role). Holds are the
 * positions wrestlers fight in — a front headlock, a ride — authored as two
 * poles along a progress axis (just got there .. about to break) plus a living
 * struggle on top. Contacts pin a hand to a bone of the other body, so a grip
 * stays a grip however the bodies move.
 */

export type Role = 'A' | 'B';

export interface Contact {
  /** Whose hand. */
  who: Role;
  hand: 'L' | 'R';
  /** Bone on the other body. */
  on: BoneName;
  /** Offset in that bone's local frame (canonical metres). */
  at: V3;
  /** Normalised time window for moves; holds ignore it. */
  from?: number;
  to?: number;
  /** Fade in/out, normalised time. */
  fade?: number;
}

export interface MoveClip {
  id: string;
  A: Key[];
  B: Key[];
  contacts?: Contact[];
  /** Root distance the clip was authored at, for warping shots. */
  startDist?: number;
  /** Normalised time by which the warp has fully closed. */
  warpBy?: number;
}

export interface HoldClip {
  id: string;
  /** Progress 0 and progress 1 poses for each role. */
  A: [PoseSpec, PoseSpec];
  B: [PoseSpec, PoseSpec];
  contacts?: Contact[];
  /** Struggle amplitude per role (metres / degrees scale). */
  struggle?: { A: number; B: number };
  /** Cycle speed of the struggle, Hz. */
  tempo?: number;
}

interface CompiledMove {
  clip: MoveClip;
  A: CompiledTrack;
  B: CompiledTrack;
}

interface CompiledHold {
  clip: HoldClip;
  A: [LocalPose, LocalPose];
  B: [LocalPose, LocalPose];
}

const moves = new Map<string, CompiledMove>();
const holds = new Map<string, CompiledHold>();

export function registerMove(clip: MoveClip): void {
  moves.set(clip.id, { clip, A: compileTrack(clip.A, null), B: compileTrack(clip.B, null) });
}

export function registerHold(clip: HoldClip): void {
  const a0 = compileSpec(clip.A[0], null);
  const b0 = compileSpec(clip.B[0], null);
  holds.set(clip.id, {
    clip,
    A: [a0, compileSpec(clip.A[1], a0)],
    B: [b0, compileSpec(clip.B[1], b0)],
  });
}

/** A hold's pose at a given progress, without the struggle — for joining moves to it. */
export function holdLocal(id: string, role: Role, progress: number): LocalPose {
  const h = holds.get(id);
  if (!h) throw new Error(`Hold ${id} must be registered before moves that use it`);
  const [p0, p1] = role === 'A' ? h.A : h.B;
  const out = createLocal();
  for (let i = 0; i < P.SIZE; i++) out[i] = p0[i] + (p1[i] - p0[i]) * progress;
  return out;
}

export const hasMove = (id: string) => moves.has(id);
export const hasHold = (id: string) => holds.has(id);
export const moveClip = (id: string) => moves.get(id)?.clip;
export const holdClip = (id: string) => holds.get(id)?.clip;

/* --------------------------------------------------------------- sampling */

export interface ActiveContact {
  hand: 'L' | 'R';
  on: BoneName;
  at: V3;
  weight: number;
}

const _tmp = createLocal();

function contactsAt(list: Contact[] | undefined, role: Role, u: number, mirror: boolean, hold: boolean): ActiveContact[] {
  const out: ActiveContact[] = [];
  if (!list) return out;
  for (const c of list) {
    if (c.who !== role) continue;
    let w = 1;
    if (!hold) {
      const from = c.from ?? 0;
      const to = c.to ?? 1;
      const fade = c.fade ?? 0.06;
      if (u < from - fade || u > to + fade) continue;
      if (u < from) w = 1 - (from - u) / fade;
      else if (u > to) w = 1 - (u - to) / fade;
    }
    if (w <= 0) continue;
    out.push(
      mirror
        ? {
            hand: c.hand === 'L' ? 'R' : 'L',
            on: (MIRROR[c.on] ?? c.on) as BoneName,
            at: [-c.at[0], c.at[1], c.at[2]],
            weight: w,
          }
        : { hand: c.hand, on: c.on, at: c.at, weight: w },
    );
  }
  return out;
}

/** Sample a move for one role at normalised time `u` into a frame-space pose. */
export function sampleMove(id: string, role: Role, u: number, mirror: boolean, out: LocalPose): ActiveContact[] {
  const m = moves.get(id);
  if (!m) return [];
  sampleTrack(role === 'A' ? m.A : m.B, u, out);
  if (mirror) mirrorLocal(out, out);
  return contactsAt(m.clip.contacts, role, u, mirror, false);
}

/** Sample a hold: blend the poles by progress and add the struggle. */
export function sampleHold(
  id: string,
  role: Role,
  progress: number,
  phase: number,
  intensity: number,
  mirror: boolean,
  out: LocalPose,
): ActiveContact[] {
  const h = holds.get(id);
  if (!h) return [];
  const [p0, p1] = role === 'A' ? h.A : h.B;
  const k = Math.max(0, Math.min(1, progress));
  for (let i = 0; i < P.SIZE; i++) out[i] = p0[i] + (p1[i] - p0[i]) * k;

  // The struggle: hips and shoulders working against each other, never still.
  const amp = (h.clip.struggle?.[role] ?? 0.5) * (0.25 + 0.75 * intensity);
  const w = phase * Math.PI * 2 * (h.clip.tempo ?? 1.2);
  const r = role === 'A' ? 0 : 1.7;
  const s1 = Math.sin(w + r);
  const s2 = Math.sin(w * 1.63 + r * 2.1);
  const s3 = Math.sin(w * 0.71 + r * 0.6);
  out[P.HIPS] += s1 * 0.02 * amp;
  out[P.HIPS + 1] += s2 * 0.012 * amp;
  out[P.HIPS + 2] += s3 * 0.018 * amp;
  out[P.HIPS_Q] += s3 * 0.05 * amp;
  out[P.SPINE] += s2 * 0.06 * amp;
  out[P.SPINE + 2] += s1 * 0.05 * amp;
  out[P.HEAD + 1] += s3 * 0.08 * amp;
  for (const at of [P.HAND_L, P.HAND_R]) {
    out[at] += Math.sin(w * 2.1 + at) * 0.015 * amp;
    out[at + 2] += Math.cos(w * 1.7 + at) * 0.015 * amp;
  }
  if (mirror) mirrorLocal(out, out);
  return contactsAt(h.clip.contacts, role, 0, mirror, true);
}

/** Scale positions of a frame-space pose for a body that is not 1.76 m. */
export function scalePose(lp: LocalPose, s: number): void {
  if (s === 1) return;
  for (const at of [P.HIPS, P.FOOT_L, P.FOOT_R, P.KNEE_L, P.KNEE_R, P.HAND_L, P.HAND_R, P.ELBOW_L, P.ELBOW_R]) {
    // Heights scale with the body; positions on the mat stay where the pair put them.
    lp[at + 1] *= s;
  }
  void _tmp;
}
