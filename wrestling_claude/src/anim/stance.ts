import { BALL_Y, FOOT, P } from './posture';
import { createLocal } from './spec';
import type { LocalPose } from './spec';

/**
 * The neutral stance, generated rather than keyframed.
 *
 * A real stance is a set of relationships — feet staggered and a little wider
 * than the shoulders, hips sunk, back flat, head up, elbows in, hands alive —
 * that flex with level, lean and fatigue. Generating it from those parameters
 * keeps every in-between state looking like a stance instead of a blend of two.
 *
 * Output is in the wrestler's own frame (facing +Z) for a 1.76 m body; callers
 * scale positions with `scaleLocal`.
 */

export interface StanceParams {
  /** 0 = deep, 0.45 = working stance, 1 = standing tall. */
  level: number;
  /** +1 = left foot leads, -1 = right foot leads. */
  lead: 1 | -1;
  /** Weight forward (+) or back (-), -1..1. */
  lean: number;
  /** Weight to the left (+) or right (-), -1..1. */
  side: number;
  /** Breathing / bounce phase, radians. */
  phase: number;
  /** 0..1 tiredness: hands drop, back rounds, breathing deepens. */
  fatigue: number;
  /** Stance width multiplier. */
  width: number;
  /** 0..1: hands up and working (1) or relaxed (0). */
  guard: number;
}

export const DEFAULT_STANCE: StanceParams = {
  level: 0.45,
  lead: 1,
  lean: 0,
  side: 0,
  phase: 0,
  fatigue: 0,
  width: 1,
  guard: 1,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const DEG = Math.PI / 180;

export function stancePose(s: StanceParams, out: LocalPose = createLocal()): LocalPose {
  out.fill(0);
  const lead = s.lead;
  const lv = Math.min(1, Math.max(0, s.level));
  const breath = Math.sin(s.phase);
  const deep = 1 - lv;

  // Hips sink with level; weight shifts move them over the working foot.
  const hipsY = lerp(0.6, 0.93, lv) - Math.abs(s.side) * 0.015 + breath * 0.006 * (1 + s.fatigue);
  const hipsZ = -0.03 - s.lean * 0.05 - deep * 0.02;
  const hipsX = s.side * 0.05;
  out[P.HIPS] = hipsX;
  out[P.HIPS + 1] = hipsY;
  out[P.HIPS + 2] = hipsZ;

  // Pelvis: turned a touch so the lead hip is forward, tilted forward with depth.
  out[P.HIPS_Q] = -12 * lead * DEG * (0.4 + lv * 0.6);
  out[P.HIPS_Q + 1] = (8 + deep * 18 + s.lean * 6) * DEG;
  out[P.HIPS_Q + 2] = -s.side * 5 * DEG;

  // Spine: flat back angled forward; counter-twist squares the chest up.
  out[P.SPINE] = (10 + deep * 14 + s.lean * 10 + s.fatigue * 8 + breath * 1.2) * DEG;
  out[P.SPINE + 1] = 10 * lead * DEG * (0.4 + lv * 0.6);
  out[P.SPINE + 2] = s.side * 4 * DEG;

  // Head up, eyes on the opponent.
  out[P.HEAD] = (-30 - deep * 12) * DEG;
  out[P.LOOK_W] = 0.85;

  // Feet: lead foot forward and pointing in a touch, rear foot back and out,
  // up on the balls of the feet.
  const w = s.width;
  const leadX = 0.17 * w * lead;
  const rearX = -0.2 * w * lead;
  const stagger = lerp(0.42, 0.24, lv);
  const leadZ = stagger * 0.55;
  const rearZ = -stagger * 0.45;
  const lf = lead === 1 ? P.FOOT_L : P.FOOT_R;
  const rf = lead === 1 ? P.FOOT_R : P.FOOT_L;
  out[lf] = leadX;
  out[lf + 1] = BALL_Y;
  out[lf + 2] = leadZ;
  out[lf + FOOT.YAW] = -6 * lead * DEG;
  out[lf + FOOT.HEEL] = lerp(18, 6, lv) * DEG;
  out[rf] = rearX;
  out[rf + 1] = BALL_Y;
  out[rf + 2] = rearZ;
  out[rf + FOOT.YAW] = -28 * lead * DEG;
  out[rf + FOOT.HEEL] = lerp(34, 14, lv) * DEG;
  out[P.TOES] = 1;
  out[P.TOES + 1] = 1;

  // Knees point over the toes, a little outward.
  const kneeFor = (fx: number, fz: number, kneeAt: number) => {
    out[kneeAt] = fx * 1.35;
    out[kneeAt + 1] = 0.45;
    out[kneeAt + 2] = fz + 0.7;
  };
  kneeFor(out[P.FOOT_L], out[P.FOOT_L + 2], P.KNEE_L);
  kneeFor(out[P.FOOT_R], out[P.FOOT_R + 2], P.KNEE_R);

  // Hands: elbows in, hands out front at chest height; they sag as he tires.
  const handY = hipsY + lerp(0.08, 0.24, s.guard) - s.fatigue * 0.08 - deep * 0.02;
  const reach = lerp(0.3, 0.5, s.guard) + deep * 0.05 + s.lean * 0.03;
  const leadHand = lead === 1 ? P.HAND_L : P.HAND_R;
  const rearHand = lead === 1 ? P.HAND_R : P.HAND_L;
  out[leadHand] = 0.17 * lead;
  out[leadHand + 1] = handY + 0.03;
  out[leadHand + 2] = reach + 0.06 + s.lean * 0.04;
  out[rearHand] = -0.15 * lead;
  out[rearHand + 1] = handY - 0.03;
  out[rearHand + 2] = reach - 0.02 + s.lean * 0.04;

  // Elbows down, in and slightly back.
  out[P.ELBOW_L] = 0.4;
  out[P.ELBOW_L + 1] = hipsY - 0.3;
  out[P.ELBOW_L + 2] = 0.12;
  out[P.ELBOW_R] = -0.4;
  out[P.ELBOW_R + 1] = hipsY - 0.3;
  out[P.ELBOW_R + 2] = 0.12;

  // Palms down and forward.
  out[P.WRIST_L] = -15 * DEG;
  out[P.WRIST_L + 2] = 35 * DEG;
  out[P.WRIST_R] = -15 * DEG;
  out[P.WRIST_R + 2] = 35 * DEG;
  out[P.SHRUG_L] = (4 + s.fatigue * 4) * DEG;
  out[P.SHRUG_R] = (4 + s.fatigue * 4) * DEG;
  return out;
}

/** Scale every position in a local pose (for taller or shorter bodies). */
export function scaleLocal(lp: LocalPose, scale: number): void {
  if (scale === 1) return;
  for (const at of [P.HIPS, P.LOOK, P.FOOT_L, P.FOOT_R, P.KNEE_L, P.KNEE_R, P.HAND_L, P.HAND_R, P.ELBOW_L, P.ELBOW_R]) {
    lp[at] *= scale;
    lp[at + 1] *= scale;
    lp[at + 2] *= scale;
  }
}
