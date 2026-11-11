import { registerMove } from '../clips';
import { BALL, POST, PALM_DOWN, holdAt, stanceAt } from './kit';
import type { PoseSpec } from '../spec';

/**
 * More on the mat (owner, November 9): the Granby roll and the standing switch from the bottom, the turk off a
 * leg ride and the crossface cradle on top. Mat frame: origin under the bottom man's hips, +Z the way he faces,
 * +X his left; the top man starts on his left side.
 */

// Granby roll (Wikipedia "Granby roll"; Fanatic Wrestling, Hudson Taylor; FloWrestling "How to hit a Granby"):
// hips up and head tucked, the near leg cross-steps under him, the other kicks high, and he rolls over the
// inside shoulder, compact, coming up facing the rider.
// The rider stays on his knees hugging the waist and is dragged round after him, then both come up (Rebels Wrestling
// "Granby roll breakdown", FJikvdUMhc0 at 30-90 s: the top man is still on his knees holding the waist while the
// legs go over). He used to stand straight up and let go a quarter of the way in.
const GRANBY_KNEES: PoseSpec = { footL: [0.74, BALL, 0.08, -80, 75], footR: [0.8, BALL, -0.26, -80, 75], kneeL: [0.36, -0.3, 0.1], kneeR: [0.42, -0.3, -0.26] };
registerMove({
  id: 'granbyRoll',
  A: [
    { t: 0, pose: { base: holdAt('ride', 'A', 0.3) } },
    // Pulled forward over him as his hips come up.
    { t: 0.22, pose: { ...GRANBY_KNEES, hips: [0.28, 0.5, -0.04], rot: [-36, 46, 0], spine: [32, -6, 2], head: [10, 0, 0] } },
    // Still on his knees, reaching after the hips as they go over.
    { t: 0.44, pose: { ...GRANBY_KNEES, hips: [0.22, 0.48, 0.04], rot: [-46, 52, 0], spine: [34, -4, 0], head: [0, 0, 0],
      handL: [0.12, 0.42, 0.3], handR: [-0.04, 0.46, 0.18] } },
    // Squaring up on his knees as the roller comes round.
    { t: 0.64, pose: { ...GRANBY_KNEES, hips: [0.2, 0.5, -0.1], rot: [-20, 34, 0], spine: [22, 0, 0], head: [-10, 0, 0] } },
    { t: 1, pose: { base: stanceAt({ x: 0.05, z: -0.42, yaw: 0 }, 1) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('ride', 'B', 0.3) } },
    // Hips up, head tucked, the near leg stepping under toward the far side.
    { t: 0.2, pose: { hips: [0, 0.6, -0.04], rot: [0, 72, 0], spine: [40, 0, 0], head: [40, 0, 0],
      footL: [-0.12, 0.08, -0.12, 0, 40], footR: [-0.16, BALL, -0.42, 0, 70], handL: [0.18, POST, 0.4], handR: [-0.18, POST, 0.4], wristL: PALM_DOWN, wristR: PALM_DOWN } },
    // Over the inside shoulder, legs kicked high, compact.
    { t: 0.42, pose: { hips: [0.06, 0.34, 0.18], rot: [40, 80, 0, 160], spine: [30, 0, 0], head: [30, 0, 0],
      footL: [0.0, 0.85, -0.1, 0, 0], footR: [-0.2, 0.75, 0.0, 0, 0], kneeL: [0.04, 0.62, 0.12], kneeR: [-0.14, 0.56, 0.18] } },
    // Come up on a knee facing him.
    { t: 0.74, pose: { hips: [0, 0.42, 0.48], rot: [180, 20, 0], spine: [16, 0, 0], head: [-10, 0, 0],
      footL: [-0.2, BALL, 0.7, 180, 60], footR: [0.18, BALL, 0.36, 180, 20], kneeL: [-0.18, 0.07, 0.42], kneeR: [0.18, 0.45, 0.26] } },
    { t: 1, pose: { base: stanceAt({ x: 0, z: 0.62, yaw: 180 }, 1) } },
  ],
  contacts: [
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0, to: 0.4, fade: 0.12 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0, to: 0.15, fade: 0.08 },
  ],
});

// Standing switch (Fanatic Wrestling, Ben Askren; FFA Coach "Standing switch"): with the rider's hands locked
// and his weight on him, he sits his hips out to the side, reaches his inside arm back between the rider's
// legs and comes up behind him; the rider goes down on all fours.
const SWITCH_END = { x: 0, z: -0.25, yaw: 0 };
registerMove({
  id: 'standingSwitch',
  // Roles stay as in the standing ride: A was on top, B the man who switches.
  // The rider is levered over at the waist by the arm between his legs, still on his feet, before he goes down
  // (Ben Askren, Fanatic Wrestling uHsKYjJ8pd4 at 62-71 s).
  A: [
    { t: 0, pose: { base: holdAt('standing', 'A', 0.5) } },
    { t: 0.4, pose: { hips: [0.1, 0.62, -0.26], rot: [0, 42, 0], spine: [24, 0, 0] } },
    { t: 0.56, pose: { hips: [0.06, 0.6, -0.2], rot: [0, 58, 0], spine: [32, 0, 0], head: [-20, 0, 0],
      handL: [0.2, 0.38, 0.18], handR: [-0.18, 0.38, 0.18], wristL: PALM_DOWN, wristR: PALM_DOWN } },
    { t: 0.7, land: true, pose: { base: holdAt('ride', 'B', 0, SWITCH_END), hips: [0, 0.48, -0.25] } },
    { t: 1, pose: { base: holdAt('ride', 'B', 0, SWITCH_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('standing', 'B', 0.5) } },
    // Hips out and down to the side, inside arm reaching back between his legs.
    { t: 0.3, pose: { hips: [-0.24, 0.52, -0.08], rot: [-40, 24, 0], spine: [20, -10, 0], head: [-10, -20, 0],
      handR: [-0.06, 0.42, -0.38], footL: [-0.05, BALL, 0.1, -30, 20], footR: [-0.4, BALL, -0.05, -60, 30] } },
    // Up beside and behind him, chest over his back. It dived forward nearly flat, away from the rider.
    { t: 0.55, pose: { hips: [-0.16, 0.66, -0.48], rot: [-60, 28, 0], spine: [26, 0, 0], head: [-14, 0, 0],
      footR: [-0.3, BALL, -0.72, -150, 30], footL: [-0.22, BALL, -0.3, -120, 25] } },
    { t: 0.75, land: true, pose: { base: holdAt('ride', 'A', 0, SWITCH_END) } },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, SWITCH_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'spine', at: [0.04, 0.0, 0.13], from: 0, to: 0.3, fade: 0.1 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.0, 0.13], from: 0, to: 0.3, fade: 0.1 },
    { who: 'B', hand: 'R', on: 'thighR', at: [0, -0.2, 0.06], from: 0.3, to: 0.6, fade: 0.1 },
    { who: 'B', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.75, to: 1, fade: 0.1 },
  ],
});

// Turk off a leg ride (Fanatic Wrestling, the leg ride; Coaches Insider, cross wrist to turk): the near leg
// hooked, he sits back and lifts it, turning him over the trapped leg to his back.
registerMove({
  id: 'turk',
  A: [
    { t: 0, pose: { base: holdAt('legRide', 'A', 1) } },
    { t: 0.35, pose: { hips: [0.3, 0.46, -0.22], rot: [-50, 30, 0], spine: [16, -10, 0] } },
    { t: 0.6, pose: { hips: [0.38, 0.36, 0.04], rot: [-80, 60, 0], spine: [10, 0, 0] } },
    { t: 1, pose: { base: holdAt('exposed', 'A', 0) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('legRide', 'B', 1) } },
    { t: 0.35, pose: { hips: [0, 0.32, 0], rot: [0, 88, 0, 55], spine: [6, 0, -8], head: [-20, 20, 0] } },
    { t: 0.62, pose: { hips: [0, 0.26, 0], rot: [0, 90, 0, 100], spine: [-4, 0, -6], head: [-20, 30, 0] } },
    { t: 1, pose: { base: holdAt('exposed', 'B', 0) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'forearmR', at: [0, -0.1, 0.02], from: 0, to: 0.7, fade: 0.12 },
  ],
});

// Crossface cradle (Wikipedia "Cradle"; Fanatic Wrestling, far-side cradles): perpendicular to him, the crossface
// drives his head to his far knee, the other arm scoops the far leg, the hands lock and he is rolled to his back.
registerMove({
  id: 'crossfaceCradle',
  A: [
    { t: 0, pose: { base: holdAt('flat', 'A', 0) } },
    { t: 0.3, pose: { hips: [0.16, 0.4, 0.06], rot: [-70, 60, 0], spine: [28, 0, 0], head: [10, 0, 0] } },
    { t: 0.55, pose: { hips: [0.2, 0.36, 0.24], rot: [-80, 66, 0], spine: [20, 0, 0] } },
    { t: 0.75, pose: { hips: [0.24, 0.31, 0.34], rot: [-88, 80, 0], spine: [12, 0, 0] } },
    { t: 1, pose: { base: holdAt('cradleHold', 'A', 0) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('flat', 'B', 0) } },
    // Head driven round toward the far knee, curled.
    { t: 0.3, pose: { hips: [0, 0.3, 0], spine: [34, 0, 0], head: [20, -35, 0], kneeL: [-0.05, 0.24, 0.42], footL: [0, BALL, -0.12, 160, 0] } },
    { t: 0.55, pose: { hips: [0, 0.27, 0.02], rot: [0, 90, 0, 40], spine: [24, 0, 0], head: [10, -20, 0] } },
    { t: 0.75, pose: { hips: [0, 0.2, 0.02], rot: [0, 90, 0, 120], spine: [6, 0, 0] } },
    { t: 1, pose: { base: holdAt('cradleHold', 'B', 0) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'neck', at: [0.04, 0, -0.07], from: 0.15, to: 1, fade: 0.1, claspFrom: 0.55 },
    { who: 'A', hand: 'R', on: 'shinL', at: [0, 0.1, 0.025], from: 0.3, to: 1, fade: 0.1, claspFrom: 0.55 },
    { who: 'B', hand: 'L', on: 'forearmL', at: [0, -0.16, 0.055], palm: true, from: 0.65, to: 1, fade: 0.12 },
    { who: 'B', hand: 'R', on: 'handL', at: [0, -0.02, 0.035], palm: true, from: 0.65, to: 1, fade: 0.12 },
  ],
});
