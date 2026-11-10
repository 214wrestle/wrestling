import { registerMove } from '../clips';
import { BALL, POST, PALM_DOWN, holdAt, stanceAt } from './kit';

/**
 * Counters on the legs (owner's list, November 9): the defender's Shoot, picked by the position.
 * Pair frame: the shooter (A) low at the middle facing +Z, the defender (B) standing in front of him facing -Z.
 * Where the defender ends on top, the ride hold has him in its A role and the shooter in its B role.
 */

// Crackdown: chest heavy on the back, he reaches over to the far ankle, drives the shooter's head to the mat and
// walks round to the side for the takedown.
const CRACK_END = { x: 0, z: 0.05, yaw: 0 };
registerMove({
  id: 'crackdown',
  A: [
    { t: 0, pose: { base: holdAt('legsDouble', 'A', 0.3) } },
    // Head driven down, his grip on the legs breaking.
    { t: 0.38, pose: { hips: [0.04, 0.46, 0.08], rot: [0, 66, 0], spine: [34, 0, 0], head: [40, 0, 0],
      handL: [0.2, POST, 0.4], handR: [-0.2, POST, 0.36], wristL: PALM_DOWN, wristR: PALM_DOWN } },
    { t: 0.7, pose: { hips: [0.02, 0.46, 0.06], rot: [0, 72, 0], spine: [24, 0, 0], head: [30, 0, 0] } },
    { t: 1, pose: { base: holdAt('ride', 'B', 0, CRACK_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('legsDouble', 'B', 0.3) } },
    // Over the back, chest heavy, reaching to the far ankle.
    { t: 0.38, pose: { hips: [0.06, 0.74, 0.5], rot: [180, 62, 0], spine: [44, 0, 0], head: [10, 0, 0],
      footL: [0.2, BALL, 0.88, 180, 40], footR: [-0.16, BALL, 0.92, 180, 40] } },
    // Walking round his side, still on the ankle.
    { t: 0.66, pose: { hips: [0.42, 0.68, 0.36], rot: [-130, 55, 0], spine: [34, 0, 0], head: [0, 0, 0],
      footL: [0.72, BALL, 0.66, -130, 50], footR: [0.86, BALL, 0.3, -130, 50] } },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, CRACK_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'thighR', at: [-0.02, -0.25, -0.07], from: 0, to: 0.3, fade: 0.12 },
    { who: 'A', hand: 'R', on: 'thighL', at: [0.02, -0.25, -0.07], from: 0, to: 0.3, fade: 0.12 },
    { who: 'B', hand: 'L', on: 'spine', at: [0.04, 0.03, 0.12], from: 0.05, to: 0.75, fade: 0.12 },
    { who: 'B', hand: 'R', on: 'shinL', at: [0, -0.15, 0.03], from: 0.22, to: 0.7, fade: 0.12 },
    { who: 'B', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.8, to: 1, fade: 0.12 },
    { who: 'B', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.82, to: 1, fade: 0.12 },
  ],
});

// Sit-through: the leg caught low, he sits his hips to the mat, swings through to face the shooter and pulls the
// leg out, then both come back up to their feet.
registerMove({
  id: 'sitThrough',
  A: [
    { t: 0, pose: { base: holdAt('legsSingle', 'A', 0) } },
    // His grip stripped as the hips drop away; he falls forward onto a hand.
    { t: 0.42, pose: { hips: [0.18, 0.5, 0.2], rot: [-20, 50, 0], spine: [26, 0, 0], head: [10, 0, 0],
      handL: [0.3, POST, 0.6], wristL: PALM_DOWN } },
    { t: 1, pose: { base: stanceAt({ x: 0, z: -0.55, yaw: 0 }, 1) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('legsSingle', 'B', 0) } },
    // Hips down to the mat, feet in front, the caught leg pulled through.
    { t: 0.35, land: true, pose: { hips: [0.02, 0.22, 0.68], rot: [180, -14, 0], spine: [-6, 0, 0], head: [10, 0, 0],
      footL: [0.18, BALL, 0.2, 180, 0], footR: [-0.18, BALL, 0.24, 180, 0],
      handL: [-0.3, POST, 0.82], handR: [0.3, POST, 0.82], wristL: PALM_DOWN, wristR: PALM_DOWN } },
    // Up on a knee facing him.
    { t: 0.68, pose: { hips: [0, 0.46, 0.68], rot: [180, 20, 0], spine: [12, 0, 0], head: [-10, 0, 0],
      footL: [0.18, BALL, 0.4, 180, 20], footR: [-0.18, BALL, 0.86, 180, 60], kneeR: [-0.18, 0.07, 0.6] } },
    { t: 1, pose: { base: stanceAt({ x: 0, z: 0.6, yaw: 180 }, 1) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'thighR', at: [-0.02, -0.25, -0.07], from: 0, to: 0.3, fade: 0.12 },
    { who: 'A', hand: 'R', on: 'shinR', at: [0.02, -0.05, -0.05], from: 0, to: 0.3, fade: 0.12 },
  ],
});

// Scramble roll: all but taken down, he drops to his hip beside the shooter, rolls through over the shoulder
// past his side and comes up behind him on top.
const ROLL_END = { x: 0.05, z: -0.1, yaw: 0 };
registerMove({
  id: 'scrambleRoll',
  A: [
    { t: 0, pose: { base: holdAt('legsDouble', 'A', 0.8) } },
    // Carried over with the roll, then back to his hands and knees.
    { t: 0.4, pose: { hips: [0.08, 0.42, 0.24], rot: [10, 60, 0, 30], spine: [24, 0, 0], head: [20, 0, 0] } },
    { t: 0.72, pose: { hips: [0.06, 0.44, 0.0], rot: [0, 70, 0], spine: [20, 0, 0], head: [20, 0, 0],
      handL: [0.2, POST, 0.4], handR: [-0.2, POST, 0.4], wristL: PALM_DOWN, wristR: PALM_DOWN } },
    { t: 1, pose: { base: holdAt('ride', 'B', 0, ROLL_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('legsDouble', 'B', 0.8) } },
    // Down on his hip beside him.
    { t: 0.28, land: true, pose: { hips: [0.3, 0.3, 0.38], rot: [150, 30, 0, -50], spine: [20, 0, 0], head: [20, 0, 0],
      footL: [0.3, BALL, 0.0, 150, 20], footR: [0.05, BALL, 0.1, 150, 20] } },
    // Rolling through past his side, legs over.
    { t: 0.52, pose: { hips: [0.42, 0.3, 0.06], rot: [90, 90, 0, 170], spine: [24, 0, 0], head: [30, 0, 0],
      footL: [0.5, 0.55, 0.45, 0, 0], footR: [0.3, 0.6, 0.5, 0, 0], kneeL: [0.5, 0.6, 0.2], kneeR: [0.32, 0.62, 0.25] } },
    // Up on his knees behind the hip.
    { t: 0.78, pose: { hips: [0.42, 0.45, -0.16], rot: [-90, 40, 0], spine: [20, 0, 0], head: [-10, 0, 0],
      footL: [0.86, BALL, -0.3, -90, 70], footR: [0.86, BALL, 0.1, -90, 70], kneeL: [0.5, 0.07, -0.3], kneeR: [0.5, 0.07, 0.05] } },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, ROLL_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'thighR', at: [-0.02, -0.25, -0.07], from: 0, to: 0.28, fade: 0.12 },
    { who: 'A', hand: 'R', on: 'thighL', at: [0.02, -0.25, -0.07], from: 0, to: 0.28, fade: 0.12 },
    { who: 'B', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.82, to: 1, fade: 0.12 },
    { who: 'B', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.85, to: 1, fade: 0.12 },
  ],
});
