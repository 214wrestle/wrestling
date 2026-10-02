import { stancePose, DEFAULT_STANCE } from '../stance';
import { createLocal, transformLocal } from '../spec';
import type { LocalPose, V3 } from '../spec';
import { holdLocal } from '../clips';
import type { Role } from '../clips';

/**
 * Authoring kit: shared constants and helpers so poses are written once and
 * moves join holds and stances exactly.
 */

const DEG = 180 / Math.PI;

/** Height of a planted ball of the foot. */
export const BALL = 0.025;
/** Knee joint height with the knee on the mat. */
export const KNEE = 0.055;
/** Wrist height with the palm flat on the mat. */
export const POST = 0.045;

/** Wrist angles: palm flat on the mat, fingers forward. */
export const PALM_DOWN: V3 = [0, 90, -90];
/** Palm facing the body part it holds. */
export const GRIP: V3 = [-20, 0, 0];

export interface At {
  x: number;
  z: number;
  /** Degrees. */
  yaw: number;
}

const rad = (a: At) => ({ x: a.x, z: a.z, yaw: a.yaw / DEG });

/** A wrestler's working stance, standing at `at` in the pair frame. */
export function stanceAt(at: At, lead: 1 | -1 = 1, level = 0.45): LocalPose {
  const lp = stancePose({ ...DEFAULT_STANCE, level, lead }, createLocal());
  return transformLocal(lp, rad(at));
}

/** A hold's pose, placed at `at` inside the move's frame. */
export function holdAt(id: string, role: Role, progress: number, at: At = { x: 0, z: 0, yaw: 0 }): LocalPose {
  return transformLocal(holdLocal(id, role, progress), rad(at));
}

/** Convenience: degrees helper for readability in specs. */
export const deg = (r: number) => r * DEG;
