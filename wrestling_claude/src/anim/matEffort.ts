import { P } from './posture';
import type { LocalPose } from './spec';

/** Ride attempts are paired: pressure moves the controlled arm, while the
 * opposite palm remains a support. Contact closure runs after this pose edit.
 * Reference observations: docs/research/folkstyle-film-reference-log.md.
 */
export function applyRideEffort(pose: LocalPose, top: boolean, reaction: boolean, button: string, amount: number, mirror: boolean, failedRise = false): void {
  const side = mirror ? -1 : 1;
  const controlledHand = mirror ? P.HAND_R : P.HAND_L;
  const controlledElbow = mirror ? P.ELBOW_R : P.ELBOW_L;
  if (failedRise) {
    if (top && reaction) {
      // Follow the initial hip lift while retaining waist contact; chest
      // pressure folds the attempted rise back into the existing ride.
      pose[P.HIPS + 1] += .04 * amount;
      pose[P.HIPS + 2] += .055 * amount;
      pose[P.SPINE] += .20 * amount;
      pose[P.HEAD] += .06 * amount;
    } else if (!top && !reaction) {
      const steppingFoot = mirror ? P.FOOT_R : P.FOOT_L;
      pose[steppingFoot + 2] += .20 * amount;
      pose[steppingFoot + 1] += .065 * amount;
      pose[P.HIPS + 1] += .11 * amount;
      pose[P.HIPS + 2] -= .035 * amount;
      pose[P.SPINE] -= .12 * amount;
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
    pose[P.HIPS + 2] -= 0.025 * amount;
    pose[P.SPINE] -= 0.18 * amount;
    if (button === 'fight') pose[P.SPINE + 1] += side * 0.20 * amount;
  }
}
