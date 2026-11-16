import { registerMove } from '../clips';
import { BALL, POST, holdAt } from './kit';

/**
 * Finishes and scrambles added November 15 (owner: "watch some scramble videos ... from the feet and top position
 * ... try to refine shot finishes"). References: the College Park High School technique handbook (finishes and
 * counters listed by what the opponent does), Cary Kolat's funk roll, Granby-to-Peterson and re-switch videos, Ben
 * Askren and Jordan on single-leg finishes (docs/research/scrambles-nov15.md).
 */

// The trip off a double: head on his chest as he bounces back from the drive, step the inside leg between his feet
// and hook the near leg from the inside; he goes over backwards and turns to his belly to save his back.
const DOUBLE_TRIP_END = { x: 0.35, z: 0.95, yaw: -90 };
registerMove({
  id: 'doubleLegTrip',
  A: [
    { t: 0, pose: { base: holdAt('legsDouble', 'A', 1) } },
    // Up under him, head on his chest, the inside foot stepping in between his feet.
    { t: 0.22, pose: { hips: [0.06, 0.8, 0.4], rot: [0, 22, 0], spine: [16, 0, 0], head: [-18, -20, 0], footL: [0.12, BALL, 0.56, 10, 20], footR: [-0.12, BALL, 0.2, -10, 15] } },
    // The hook: his heel behind the defender's near ankle, chest driving through.
    { t: 0.4, pose: { hips: [0.08, 0.72, 0.56], rot: [0, 34, 0], spine: [18, 0, 0], footL: [0.2, 0.1, 0.8, 20, 40], footR: [-0.14, BALL, 0.36, -10, 25] } },
    { t: 0.6, land: true, pose: { hips: [0.08, 0.5, 0.78], rot: [-10, 58, 0], spine: [14, 0, 0], footL: [0.18, BALL, 0.66, 10, 70], footR: [-0.2, BALL, 0.48, -20, 70], handL: [0.3, POST, 1.1], handR: [-0.2, POST, 1.08] } },
    { t: 0.8, pose: { hips: [0.22, 0.48, 0.78], rot: [-60, 50, 0], spine: [24, 8, 0], elbowL: [0.28, 1.0, 1.15] } },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, DOUBLE_TRIP_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('legsDouble', 'B', 1) } },
    // He bounces back off the drive, upright.
    { t: 0.22, pose: { hips: [0, 0.9, 0.78], rot: [180, -10, 0], spine: [-4, 0, 0], footL: [0.15, BALL, 0.66, 180, 10], footR: [-0.15, BALL, 0.84, 180, 10] } },
    // Near leg hooked, he tips over backwards, reaching back to post.
    { t: 0.4, pose: { hips: [0.04, 0.68, 0.92], rot: [180, -42, 0], spine: [-10, 0, 0], head: [25, 0, 0], footL: [0.15, BALL, 0.68, 180, 20], footR: [-0.15, 0.3, 0.86, 180, 30], handL: [0.4, 0.86, 1.06], handR: [-0.4, 0.86, 1.06] } },
    { t: 0.6, land: true, pose: { hips: [0.06, 0.17, 1.04], rot: [180, -70, 0], spine: [-6, 0, 0], head: [35, 0, 0], footL: [0.2, 0.34, 0.66, 180, 20], footR: [-0.2, 0.4, 0.7, 180, 20], handL: [0.36, POST, 1.3], handR: [-0.36, POST, 1.3] } },
    // Turning off his back to his belly, toward the side his legs went.
    { t: 0.8, pose: { hips: [0.25, 0.3, 1.0], rot: [-120, 40, 0, -60], spine: [10, 0, 0], footL: [0.3, BALL, 0.55, -120, 60], footR: [0.1, BALL, 0.6, -150, 60], handL: [-0.2, POST, 1.15], handR: [0.1, POST, 1.3] } },
    { t: 1, pose: { base: holdAt('ride', 'B', 0, DOUBLE_TRIP_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'thighR', at: [-0.02, -0.25, -0.07], from: 0, to: 0.5, fade: 0.08 },
    { who: 'A', hand: 'R', on: 'thighL', at: [0.02, -0.25, -0.07], from: 0, to: 0.5, fade: 0.08 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.85, to: 1 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.9, to: 1 },
  ],
});

/* ------------------------------------------------------------- from top -- */
// Mat frame: origin under the bottom man's hips, +Z the way he faces, +X his left; the top man starts on his left.

// Peterson roll (Cary Kolat, "Granby Roll To Peterson Finish"; Keep Kids Wrestling): trap the waist arm, come up on
// the tripod, hook the near leg, tuck the chin and roll over the far shoulder. The rider is taken over the top with
// him like one log and lands on his back on the far side; the roller comes up on top of him.
const PETERSON_END = { x: -0.55, z: 0.05, yaw: 0 };
registerMove({
  id: 'petersonRoll',
  A: [
    { t: 0, pose: { base: holdAt('ride', 'A', 0.3) } },
    // Pulled forward over him as his hips come up and the near leg is hooked.
    { t: 0.24, pose: { hips: [0.26, 0.52, -0.02], rot: [-40, 48, 0], spine: [30, -6, 2], head: [10, 0, 0] } },
    // Over the top: the trapped arm and hooked leg take him across the roller's back.
    // (A log roll about his own spine, the fourth rot value, never pitched up through sitting.)
    { t: 0.46, pose: { hips: [-0.12, 0.5, 0.02], rot: [-90, 75, 0, -95], spine: [10, 0, 0], footL: [0.1, 0.5, -0.4, -90, 0], footR: [0.25, 0.4, -0.2, -90, 0] } },
    { t: 0.68, land: true, pose: { hips: [-0.55, 0.16, 0.05], rot: [-90, 78, 0, -172], spine: [-6, 0, 0], head: [20, 0, 0], footL: [-0.3, 0.3, -0.5, -90, 40], footR: [-0.2, 0.25, -0.3, -90, 40], handL: [-0.75, POST, 0.4], handR: [-0.45, POST, 0.45] } },
    { t: 1, pose: { base: holdAt('ride', 'B', 0.2, PETERSON_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('ride', 'B', 0.3) } },
    // Up on the tripod, chin tucked, the near leg reaching back to hook his knee.
    { t: 0.22, pose: { hips: [-0.04, 0.6, -0.02], rot: [0, 66, 0], spine: [36, 0, 0], head: [40, 0, 0], footL: [0.22, 0.18, -0.3, 30, 40], footR: [-0.16, BALL, -0.4, 0, 70], handL: [0.16, POST, 0.4], handR: [-0.2, POST, 0.4] } },
    // Rolling over the far shoulder, legs high, the hook still in.
    { t: 0.46, pose: { hips: [-0.22, 0.36, 0.1], rot: [-40, 80, 0, -160], spine: [30, 0, 0], head: [30, 0, 0], footL: [0.05, 0.8, -0.1, 0, 0], footR: [-0.25, 0.72, 0.0, 0, 0] } },
    // Chest to chest across him, perpendicular.
    { t: 0.68, land: true, pose: { hips: [-0.32, 0.46, 0.14], rot: [-90, 70, 0], spine: [12, 0, 0], footL: [-0.05, BALL, 0.45, -90, 70], footR: [0.1, BALL, 0.1, -90, 70], handL: [-0.7, POST, 0.2], handR: [-0.5, POST, -0.1] } },
    { t: 1, pose: { base: holdAt('ride', 'A', 0.2, PETERSON_END) } },
  ],
  contacts: [
    // His waist arm is trapped against the roller's side until it has taken him over.
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0, to: 0.5, fade: 0.1 },
    { who: 'B', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.82, to: 1 },
    { who: 'B', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.9, to: 1 },
  ],
});

// Following the Granby (Cary Kolat, "Rolling with a Granby Roll from Top"): the rider does not let go; he rolls
// through over the hips with the roller, chest to back, and lands on top again as the roller comes off his shoulders.
const FOLLOW_END = { x: 0.05, z: 0.3, yaw: -90 };
registerMove({
  id: 'granbyFollow',
  A: [
    // Where the Granby had him: on his knees, reaching after the hips going over.
    { t: 0, pose: { footL: [0.74, BALL, 0.08, -80, 75], footR: [0.8, BALL, -0.26, -80, 75], kneeL: [0.36, -0.3, 0.1], kneeR: [0.42, -0.3, -0.26], hips: [0.22, 0.48, 0.04], rot: [-46, 52, 0], spine: [34, -4, 0], handL: [0.12, 0.42, 0.3], handR: [-0.04, 0.46, 0.18] } },
    // Diving over the hips after him, chest on his back.
    { t: 0.35, pose: { hips: [0.05, 0.62, 0.1], rot: [-90, 70, 0], spine: [30, 0, 0], head: [10, 0, 0], footL: [0.5, BALL, -0.1, -80, 60], footR: [0.45, BALL, -0.4, -80, 60] } },
    { t: 0.6, land: true, pose: { hips: [0.2, 0.5, 0.28], rot: [-100, 55, 0], spine: [26, 0, 0], footL: [0.5, BALL, 0.0, -100, 70], footR: [0.48, BALL, 0.4, -100, 70] } },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, FOLLOW_END) } },
  ],
  B: [
    // Over the inside shoulder, legs high (the Granby's own roll).
    { t: 0, pose: { hips: [0.06, 0.34, 0.18], rot: [40, 80, 0, 160], spine: [30, 0, 0], head: [30, 0, 0], footL: [0.0, 0.85, -0.1, 0, 0], footR: [-0.2, 0.75, 0.0, 0, 0], kneeL: [0.04, 0.62, 0.12], kneeR: [-0.14, 0.56, 0.18] } },
    // Coming off his shoulders with the rider still on him: he lands back on his hands and knees.
    { t: 0.4, pose: { hips: [0.06, 0.42, 0.28], rot: [-60, 70, 0, 40], spine: [20, 0, 0], head: [10, 0, 0], footL: [0.3, BALL, 0.0, -60, 60], footR: [0.25, BALL, 0.45, -60, 60], handL: [-0.3, POST, 0.1], handR: [-0.2, POST, 0.5] } },
    { t: 0.6, land: true, pose: { hips: [0.05, 0.45, 0.3], rot: [-90, 40, 0], spine: [20, 0, 0], handL: [-0.35, POST, 0.1], handR: [-0.35, POST, 0.5] } },
    { t: 1, pose: { base: holdAt('ride', 'B', 0, FOLLOW_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.2, to: 1, fade: 0.15 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.85, to: 1 },
  ],
});

/* ----------------------------------------------------------- on the feet -- */

// Peek-out (College Park handbook; Jordan's single-leg system, the "Auble"): flattened under the sprawl, he steps up
// one leg, knee-slides the other, posts the far hand and slips his head out under the arm, then turns straight back
// in on the hips. The sprawler squares up to him: they are on a double the other way.
// Front headlock frame: the top man at z -0.38 facing +Z, the trapped man at z 0.32 facing him.
const PEEK_END = { x: 0.5, z: -0.35, yaw: -90 };
registerMove({
  id: 'peekOut',
  A: [
    { t: 0, pose: { base: holdAt('fhl', 'A', 0.4) } },
    // Still sprawled as the head comes out, then turning to face him.
    { t: 0.35, pose: { hips: [0.0, 0.62, -0.34], rot: [20, 30, 0], spine: [20, 0, 0] } },
    { t: 0.65, pose: { hips: [0.04, 0.84, -0.34], rot: [60, 14, 0], spine: [10, 0, 0], footL: [0.2, BALL, -0.2, 60, 15], footR: [-0.1, BALL, -0.55, 60, 15] } },
    { t: 1, pose: { base: holdAt('legsDouble', 'B', 0, PEEK_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('fhl', 'B', 0.4) } },
    // One leg steps up, the far hand posts, the head slides out beside his hip.
    { t: 0.3, pose: { hips: [0.18, 0.46, 0.24], rot: [215, 45, 0], spine: [20, 0, 0], head: [-20, 30, 0], footL: [0.15, BALL, 0.7, 210, 40], footR: [0.4, BALL, 0.4, 230, 20], handR: [0.5, POST, 0.0], handL: [0.15, POST, -0.05] } },
    { t: 0.55, pose: { hips: [0.42, 0.5, -0.02], rot: [250, 40, 0], spine: [18, 0, 0], head: [-15, 10, 0], footL: [0.5, BALL, 0.45, 250, 40], footR: [0.75, BALL, 0.1, 260, 30], handR: [0.5, POST, -0.4] } },
    // Turning in on his hips.
    { t: 0.8, pose: { hips: [0.58, 0.55, -0.3], rot: [270, 32, 0], spine: [14, 0, 0], footL: [0.75, BALL, -0.15, 270, 30], footR: [0.85, BALL, -0.5, 270, 30] } },
    { t: 1, pose: { base: holdAt('legsDouble', 'A', 0, PEEK_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'neck', at: [0.0, 0.02, 0.08], from: 0, to: 0.3, fade: 0.1 },
    { who: 'A', hand: 'R', on: 'armL', at: [0.0, -0.14, -0.045], from: 0, to: 0.22, fade: 0.1 },
    { who: 'B', hand: 'L', on: 'thighR', at: [-0.02, -0.25, -0.07], from: 0.84, to: 1, fade: 0.12 },
    { who: 'B', hand: 'R', on: 'thighL', at: [0.02, -0.25, -0.07], from: 0.84, to: 1, fade: 0.12 },
  ],
});

// Whizzer to the go-behind (College Park handbook; "Shin whizzer, kick out, go behind"): the overhook bounces him,
// the head is stuffed and the hip turned in, the leg kicked straight back free; the shooter goes down on his hands
// and the defender circles behind him for the takedown.
const WGB_END = { x: 0.05, z: 0.15, yaw: 0 };
registerMove({
  id: 'whizzerGoBehind',
  A: [
    { t: 0, pose: { base: holdAt('legsSingle', 'A', 0.3) } },
    // Head stuffed, driven down as the leg goes.
    { t: 0.28, pose: { hips: [0.05, 0.56, 0.02], rot: [10, 62, 0], spine: [24, 0, 0], head: [30, 0, 0], handL: [0.12, 0.3, 0.4], handR: [-0.05, 0.3, 0.42] } },
    { t: 0.5, land: true, pose: { hips: [0.05, 0.46, 0.1], rot: [0, 64, 0], spine: [20, 0, 0], handL: [0.2, POST, 0.48], handR: [-0.18, POST, 0.48], footL: [0.15, BALL, -0.35, 0, 70], footR: [-0.15, BALL, -0.4, 0, 70] } },
    { t: 1, pose: { base: holdAt('ride', 'B', 0.3, WGB_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('legsSingle', 'B', 0.3) } },
    // Hip turned in on the overhook, the held leg kicked straight back.
    { t: 0.28, pose: { hips: [-0.04, 0.8, 0.5], rot: [195, 30, 15], spine: [20, 0, 10], footR: [-0.12, 0.42, 0.95, 180, 20] } },
    // The kicked foot lands behind; he starts round.
    { t: 0.5, pose: { hips: [0.16, 0.72, 0.5], rot: [140, 38, 0], spine: [22, 0, 0], footR: [-0.1, BALL, 0.85, 160, 30], footL: [0.3, BALL, 0.6, 130, 30] } },
    { t: 0.74, pose: { hips: [0.38, 0.62, 0.18], rot: [60, 45, 0], spine: [24, 0, 0], footL: [0.62, BALL, 0.2, 60, 50], footR: [0.48, BALL, 0.55, 60, 50] } },
    { t: 1, pose: { base: holdAt('ride', 'A', 0.3, WGB_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'shinR', at: [0, -0.08, -0.04], from: 0, to: 0.24, fade: 0.08 },
    { who: 'A', hand: 'R', on: 'thighR', at: [0.02, -0.3, 0.05], from: 0, to: 0.2, fade: 0.08 },
    { who: 'B', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.78, to: 1 },
    { who: 'B', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.88, to: 1 },
  ],
});
