import { registerMove } from '../clips';
import { BALL, POST, PALM_DOWN, holdAt } from './kit';

/**
 * Front headlock finishes beside the spin behind (owner's list, November 9): chin whip, shuck and cement mixer.
 * Pair frame: the man with the headlock (A) at -Z facing +Z, the man caught (B) in front of him facing -Z.
 */

// Chin whip: he cups the chin, whips the head away from him and the body follows it round and down in front of
// him; he lands on his side with the rider already beside him.
const CHIN_END = { x: 0.05, z: 0.4, yaw: 90 };
registerMove({
  id: 'chinWhip',
  A: [
    { t: 0, pose: { base: holdAt('fhl', 'A', 0) } },
    { t: 0.32, pose: { hips: [-0.14, 0.6, -0.42], rot: [-20, 42, 0], spine: [18, 0, 0], head: [-18, 0, 0],
      footL: [0.18, BALL, -1.0, -20, 60], footR: [-0.36, BALL, -0.92, -20, 60] } },
    { t: 0.68, pose: { hips: [0.0, 0.5, -0.06], rot: [-6, 58, 0], spine: [20, 0, 0], head: [-15, 0, 0] } },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, CHIN_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('fhl', 'B', 0), palms: [1, 1] } },
    // The chin whipped away, the body starting to follow it.
    { t: 0.32, pose: { hips: [0.02, 0.55, 0.45], rot: [150, 62, 0], spine: [30, -14, 0], head: [20, -40, 0],
      handL: [-0.2, POST, 0.0], handR: [0.2, POST, 0.05], wristL: PALM_DOWN, wristR: PALM_DOWN,
      footL: [-0.33, BALL, 0.77, 150, 60], footR: [-0.07, BALL, 0.92, 150, 60] } },
    { t: 0.68, pose: { hips: [0.05, 0.42, 0.42], rot: [110, 72, 0], spine: [18, 0, 0], head: [10, -20, 0],
      footL: [-0.47, BALL, 0.45, 110, 70], footR: [-0.37, BALL, 0.73, 110, 70] } },
    { t: 1, pose: { base: holdAt('ride', 'B', 0, CHIN_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'neck', at: [0.0, 0.02, 0.08], from: 0, to: 0.6, fade: 0.12 },
    { who: 'A', hand: 'R', on: 'armL', at: [0.0, -0.14, -0.045], from: 0, to: 0.45, fade: 0.1 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.55, to: 1, fade: 0.15 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.75, to: 1, fade: 0.12 },
  ],
});

// Shuck (Heath Sims, Evolve University "Front headlock to shuck"; Kids Professor shuck cues): he is driving into
// the headlock, so the rider pulls the head down and past his hip with his whole body, steps out the other way
// and takes the back as the man goes by.
const SHUCK_END = { x: -0.05, z: -0.2, yaw: 180 };
registerMove({
  id: 'shuck',
  A: [
    { t: 0, pose: { base: holdAt('fhl', 'A', 0.6) } },
    { t: 0.3, pose: { hips: [-0.25, 0.64, -0.62], rot: [40, 36, 0], spine: [16, 10, 0], head: [-15, 0, 0],
      footL: [-0.02, BALL, -1.05, 40, 50], footR: [-0.55, BALL, -0.9, 40, 50] } },
    { t: 0.62, pose: { hips: [-0.42, 0.6, -0.38], rot: [80, 52, 0], spine: [22, 0, 0], head: [-20, 0, 0],
      footL: [-0.8, BALL, -0.55, 80, 60], footR: [-0.85, BALL, -0.05, 80, 60] } },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, SHUCK_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('fhl', 'B', 0.6), palms: [1, 1] } },
    // Pulled past: chest dropping, stumbling forward onto his hands.
    { t: 0.3, pose: { hips: [0, 0.62, 0.24], rot: [180, 62, 0], spine: [30, 8, 0], head: [30, 10, 0],
      footL: [-0.15, BALL, 0.72, 180, 60], footR: [0.15, BALL, 0.66, 180, 60] } },
    { t: 0.62, pose: { hips: [-0.04, 0.5, -0.04], rot: [180, 72, 0], spine: [20, 0, 0], head: [10, 0, 0],
      handL: [-0.22, POST, -0.42], handR: [0.2, POST, -0.42], wristL: PALM_DOWN, wristR: PALM_DOWN,
      footL: [-0.16, BALL, 0.5, 180, 70], footR: [0.16, BALL, 0.46, 180, 70] } },
    { t: 1, pose: { base: holdAt('ride', 'B', 0, SHUCK_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'neck', at: [0.0, 0.02, 0.08], from: 0, to: 0.45, fade: 0.12 },
    { who: 'A', hand: 'R', on: 'armL', at: [0.0, -0.14, -0.045], from: 0, to: 0.35, fade: 0.1 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.55, to: 1, fade: 0.15 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.8, to: 1, fade: 0.12 },
  ],
});

// Cement mixer (Mitch Minotti, Coaches Insider "Front headlock cement mixer"; Mark Hall, FloWrestling short
// offense): head and arm locked, he drops to his knees, walks round to the trapped-arm side and rolls him over
// that shoulder to his back, ending chest to chest.
const CM_END = { x: 0, z: 0.5, yaw: 180 };
registerMove({
  id: 'cementMixer',
  A: [
    { t: 0, pose: { base: holdAt('fhl', 'A', 0) } },
    { t: 0.28, pose: { hips: [-0.08, 0.48, -0.44], rot: [20, 42, 0], spine: [20, 0, 0], head: [-15, 0, 0],
      footL: [0.2, BALL, -1.0, 20, 70], footR: [-0.3, BALL, -0.95, 20, 70] } },
    { t: 0.56, pose: { hips: [-0.3, 0.44, -0.08], rot: [60, 55, 0], spine: [22, 0, 0], head: [-15, 0, 0],
      footL: [-0.7, BALL, -0.5, 60, 75], footR: [-0.9, BALL, 0.0, 60, 75] } },
    { t: 0.8, pose: { hips: [-0.4, 0.36, 0.18], rot: [85, 66, 0], spine: [14, 0, 0], head: [-15, 0, 0] } },
    { t: 1, pose: { base: holdAt('exposed', 'A', 0, CM_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('fhl', 'B', 0), palms: [1, 1] } },
    // Base broken: flattened toward the mat with the head and arm locked.
    { t: 0.28, pose: { hips: [0, 0.4, 0.5], rot: [180, 82, 0], spine: [24, 0, 0], head: [25, 0, 0] } },
    // Rolled over the trapped shoulder. His legs come off the mat and swing over with him (they cross: the left
    // foot ends on the right), knees turning from the mat to the ceiling; unkeyed, they stayed kneeling and he
    // looked hunched instead of turned.
    { t: 0.56, pose: { hips: [0, 0.3, 0.5], rot: [180, 90, 0, 60], spine: [16, 0, 0], head: [15, 0, 0],
      footL: [-0.02, 0.3, 0.92, 250, 0], footR: [0.06, 0.14, 0.96, 260, 0], kneeL: [-0.25, 0.7, 0.5], kneeR: [0.2, 0.6, 0.5] } },
    { t: 0.8, pose: { hips: [0, 0.22, 0.5], rot: [180, 90, 0, 140], spine: [6, 0, 0], head: [-10, 0, 0],
      footL: [0.18, 0.08, 0.92, 330, 0], footR: [-0.2, BALL, 0.9, 20, 0], kneeL: [0.3, 1.2, 0.3], kneeR: [-0.3, 1.2, 0.3] } },
    { t: 1, pose: { base: holdAt('exposed', 'B', 0, CM_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'neck', at: [0.0, 0.02, 0.08], from: 0, to: 0.85, fade: 0.15 },
    { who: 'A', hand: 'R', on: 'armL', at: [0.0, -0.14, -0.045], from: 0, to: 0.8, fade: 0.15 },
  ],
});
