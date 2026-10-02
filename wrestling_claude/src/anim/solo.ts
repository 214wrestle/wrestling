import { compileTrack, sampleTrack } from './spec';
import type { CompiledTrack, Key, LocalPose } from './spec';

/**
 * Solo clips: one body in its own frame (facing +Z) — a sprawl with nothing
 * under it, a celebration, the official's signals. Loops wrap; one-shots hold
 * their last key.
 */

export interface SoloClip {
  id: string;
  keys: Key[];
  loop?: boolean;
  /** Seconds per pass, for loops and time-driven playback. */
  duration?: number;
}

const solos = new Map<string, { clip: SoloClip; track: CompiledTrack }>();

export function registerSolo(clip: SoloClip): void {
  const keys = clip.loop && clip.keys[clip.keys.length - 1].t < 1 ? [...clip.keys, { ...clip.keys[0], t: 1 }] : clip.keys;
  solos.set(clip.id, { clip, track: compileTrack(keys, null) });
}

export const hasSolo = (id: string) => solos.has(id);
export const soloClip = (id: string) => solos.get(id)?.clip;

export function sampleSolo(id: string, u: number, out: LocalPose): boolean {
  const s = solos.get(id);
  if (!s) return false;
  const t = s.clip.loop ? u - Math.floor(u) : Math.max(0, Math.min(1, u));
  sampleTrack(s.track, t, out);
  return true;
}
