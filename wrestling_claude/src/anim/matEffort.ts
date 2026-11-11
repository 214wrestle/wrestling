import { P } from './posture';
import type { LocalPose } from './spec';

/** Ride attempts are paired: pressure moves the controlled arm, while the
 * opposite palm remains a support. Contact closure runs after this pose edit.
 * Reference observations: docs/research/folkstyle-film-reference-log.md.
 */
/**
 * The top man's chop on the ride (owner, November 10: "we should see a quick hard chopping motion from the top man.
 * Looks like his arm is just pulling"). Over CHOP.duration: the near hand lifts off the arm (`lift`, to 0.14 s), then
 * strikes down and back into the elbow in 0.06 s (`strike`), and eases off. The bottom man's arm caves on the strike.
 */
export const CHOP = { duration: 0.45, windup: 0.14, hit: 0.06 } as const;
export function chopCurve(age: number): { lift: number; strike: number } {
  const s = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
  const { windup, hit, duration } = CHOP;
  if (age < 0 || age >= duration) return { lift: 0, strike: 0 };
  if (age < windup) return { lift: s(age / windup), strike: 0 };
  if (age < windup + hit) { const k = (age - windup) / hit; return { lift: 1 - k * k, strike: k * k }; }
  return { lift: 0, strike: 1 - s((age - windup - hit) / (duration - windup - hit)) };
}
export function applyChop(pose: LocalPose, top: boolean, lift: number, strike: number, mirror: boolean): void {
  const side = mirror ? -1 : 1;
  if (top) {
    const hand = mirror ? P.HAND_R : P.HAND_L, elbow = mirror ? P.ELBOW_R : P.ELBOW_L;
    // Up off his arm, elbow high...
    pose[hand] += side * 0.1 * lift;
    pose[hand + 1] += 0.3 * lift;
    pose[hand + 2] -= 0.04 * lift;
    pose[elbow + 1] += 0.24 * lift;
    pose[elbow] += side * 0.1 * lift;
    // ...then down and back through the inside of the elbow, shoulder and chest behind it.
    pose[hand] -= side * 0.04 * strike;
    pose[hand + 1] -= 0.06 * strike;
    pose[hand + 2] -= 0.12 * strike;
    pose[P.SPINE] += 0.2 * strike - 0.06 * lift;
    pose[P.SPINE + 1] -= side * 0.08 * strike;
    pose[P.HIPS + 1] -= 0.03 * strike;
    pose[P.HEAD] += 0.06 * strike;
    return;
  }
  // The chopped arm caves at the elbow and the chest drops toward the mat.
  const hand = mirror ? P.HAND_R : P.HAND_L, elbow = mirror ? P.ELBOW_R : P.ELBOW_L;
  pose[hand + 2] -= 0.16 * strike;
  pose[hand + 1] += 0.03 * strike;
  pose[elbow + 2] -= 0.14 * strike;
  pose[elbow] += side * 0.05 * strike;
  pose[P.HIPS] -= side * 0.04 * strike;
  pose[P.HIPS + 1] -= 0.07 * strike;
  pose[P.SPINE] += 0.16 * strike;
  pose[P.HEAD] += 0.1 * strike;
}

export function applyRideEffort(pose: LocalPose, top: boolean, reaction: boolean, button: string, amount: number, mirror: boolean, failedRise = false): void {
  const side = mirror ? -1 : 1;
  const controlledHand = mirror ? P.HAND_R : P.HAND_L;
  const controlledElbow = mirror ? P.ELBOW_R : P.ELBOW_L;
  if (failedRise) {
    // Owner, November 10: the bottom man looked like he was just lying there. A stand-up that does not get all the
    // way is still a real try: up to a foot with his chest up, and the rider follows and drives him back down.
    if (top && reaction) {
      // Follow the hip lift while retaining waist contact; chest
      // pressure folds the attempted rise back into the existing ride.
      pose[P.HIPS + 1] += .08 * amount;
      pose[P.HIPS + 2] += .09 * amount;
      pose[P.SPINE] += .28 * amount;
      pose[P.HEAD] += .08 * amount;
    } else if (!top && !reaction) {
      const steppingFoot = mirror ? P.FOOT_R : P.FOOT_L;
      pose[steppingFoot + 2] += .30 * amount;
      pose[steppingFoot + 1] += .08 * amount;
      pose[P.HIPS + 1] += .2 * amount;
      pose[P.HIPS + 2] -= .05 * amount;
      pose[P.SPINE] -= .3 * amount;
      pose[P.HEAD] -= .12 * amount;
      // Seal the controlled arm while the opposite palm remains a post.
      pose[controlledHand + 2] -= .075 * amount;
      pose[controlledHand + 1] += .035 * amount;
      pose[controlledElbow] -= side * .055 * amount;
    }
    return;
  }
  if (top) {
    // Drive from the existing toe/knee supports; do not slide the feet.
    pose[P.HIPS + 2] += (reaction ? -0.025 : 0.065) * amount;
    pose[P.HIPS + 1] -= 0.025 * amount;
    pose[P.SPINE] += 0.12 * amount;
    pose[P.HEAD] += 0.05 * amount;
    return;
  }
  if (reaction) {
    // The arm being chopped yields; the free palm stays planted. A short
    // asymmetric hip shift lets the defender absorb pressure and square up.
    pose[controlledHand + 2] -= 0.13 * amount;
    pose[controlledHand + 1] += 0.035 * amount;
    pose[controlledElbow + 2] -= 0.10 * amount;
    pose[P.HIPS] -= side * 0.04 * amount;
    pose[P.HIPS + 1] -= 0.045 * amount;
    pose[P.HIPS + 2] += 0.04 * amount;
    pose[P.SPINE] += 0.10 * amount;
    pose[P.HEAD] += 0.08 * amount;
  } else {
    // Base recovery drives through both posts; the palms don't skate along
    // the mat. Hip rotation belongs to the bottom wrestler's switch attempt.
    pose[P.HIPS + 1] += 0.10 * amount;
    // Base up is back pressure: he drives his hips back into the rider (owner, November 10).
    pose[P.HIPS + 2] -= (button === 'sprawl' ? 0.06 : 0.025) * amount;
    pose[P.SPINE] -= 0.18 * amount;
    if (button === 'fight') pose[P.SPINE + 1] += side * 0.20 * amount;
  }
}
