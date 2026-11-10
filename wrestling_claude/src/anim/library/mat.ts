import { registerHold } from '../clips';
import type { PoseSpec } from '../spec';
import { BALL, KNEE, PALM_DOWN, POST } from './kit';
import type { V3 } from '../spec';

/** Palms turned in toward the belly, for fighting hands at the waist. */
const GRIP_IN: V3 = [-30, 0, 40];

/**
 * Mat positions. Frame: origin under the bottom man's hips, +Z the way he
 * faces, +X his left. The top man starts on that left side, near arm round the
 * waist and far hand on the near elbow, as the rule book has it.
 */

void KNEE;

/* ------------------------------------------------------------------ ride */

const rideB: PoseSpec = {
  palms: [1, 1],
  hips: [0, 0.5, 0],
  rot: [0, 80, 0],
  spine: [6, 0, 0],
  head: [-38, 0, 0],
  look: 0,
  footL: [0.13, BALL, -0.46, 0, 75],
  footR: [-0.13, BALL, -0.46, 0, 75],
  kneeL: [0.14, -0.3, 0.3],
  kneeR: [-0.14, -0.3, 0.3],
  handL: [0.2, POST, 0.5],
  handR: [-0.2, POST, 0.5],
  elbowL: [0.32, 0.3, 0.25],
  elbowR: [-0.32, 0.3, 0.25],
  wristL: PALM_DOWN,
  wristR: PALM_DOWN,
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [1, 1],
};

const rideBBroken: PoseSpec = {
  hips: [0, 0.42, -0.02],
  rot: [0, 86, 0],
  spine: [14, 0, 0],
  head: [-30, 0, 0],
  handL: [0.25, POST, 0.4],
  handR: [-0.25, POST, 0.42],
  elbowL: [0.45, 0.25, 0.2],
  elbowR: [-0.45, 0.25, 0.2],
};

const rideA: PoseSpec = {
  // Referee's position: facing across him on both knees, toes curled under. The near (left) knee is
  // down beside his hip; the outside (right) knee is down a little wider and back toward his feet for
  // base, each shin straight back behind its knee. It had the outside foot up and flat behind the top
  // man's own hips with the knee aimed straight up, which caved the knee in and turned the foot on its
  // side; a side lunge instead threw the foot out sideways (owner: "looks really odd", "wrong still").
  hips: [0.33, 0.48, -0.05],
  rot: [-32, 32, 0],
  spine: [25, -8, 2],
  head: [18, 0, 0],
  look: 0.2,
  footL: [0.74, BALL, 0.08, -80, 75],
  footR: [0.8, BALL, -0.26, -80, 75],
  kneeL: [0.36, -0.3, 0.1],
  kneeR: [0.42, -0.3, -0.26],
  handL: [0.24, 0.3, 0.45],
  // The arm goes over his back to the far side of the waist, never under him.
  handR: [-0.17, 0.5, 0.08],
  elbowL: [0.6, 0.5, 0.2],
  elbowR: [-0.2, 1.0, 0.1],
  wristL: [0, 0, 0],
  wristR: [0, 0, 0],
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [1, 1],
};

const rideADriving: PoseSpec = {
  hips: [0.33, 0.5, -0.1],
  rot: [-34, 40, 0],
  spine: [30, -3, 5],
};

// Leg-ride work starts from a squarer stance, hips higher up his back with both legs behind.
const rideALegWork: PoseSpec = {
  ...rideA,
  hips: [0.3, 0.47, -0.16],
  rot: [-22, 32, 0],
  spine: [30, -14, 4],
  footL: [0.5, BALL, -0.58, -15, 75],
  footR: [0.2, BALL, -0.56, -20, 75],
  kneeL: [0.5, -0.3, 0.35],
  kneeR: [0.2, -0.3, 0.35],
};
registerHold({
  id: 'rideLegWork',
  A: [rideALegWork, { hips: [0.24, 0.5, -0.08], rot: [-20, 42, 0], spine: [34, -16, 6] }],
  B: [rideB, rideBBroken],
  contacts: [
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035] },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12] },
  ],
  struggle: { A: 0.6, B: 0.5 },
  tempo: 0.9,
});

registerHold({
  id: 'ride',
  A: [rideA, rideADriving],
  B: [rideB, rideBBroken],
  contacts: [
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035] },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12] },
  ],
  // Wrapped and settled: only a slow, slight shift of weight until someone acts.
  struggle: { A: 0.2, B: 0.18 },
  tempo: 0.6,
});

/* ------------------------------------------------------------------ flat */

// Broken down: bottom man on his belly propped on his elbows, top man chest on
// his back, legs spread wide on his toes for base.
const flatB: PoseSpec = {
  hips: [0, 0.13, 0.04],
  rot: [0, 90, 0],
  spine: [-14, 0, 0],
  head: [-45, 18, 0],
  look: 0,
  footL: [0.13, 0.04, -0.98, 0, 150],
  footR: [-0.13, 0.04, -0.98, 0, 150],
  kneeL: [0.14, -0.5, -0.4],
  kneeR: [-0.14, -0.5, -0.4],
  handL: [0.16, 0.05, 0.66],
  handR: [-0.16, 0.05, 0.66],
  elbowL: [0.5, -0.4, 0.45],
  elbowR: [-0.5, -0.4, 0.45],
  wristL: PALM_DOWN,
  wristR: PALM_DOWN,
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [0, 0],
};

// Working up (owner, November 10: "it just looks like he's laying there"): chest off the mat on posted hands, hips
// up, one knee drawn up under him, halfway to the hands-and-knees of the rebase.
const flatBPushing: PoseSpec = {
  hips: [0, 0.27, 0.0],
  rot: [0, 74, 0],
  spine: [-30, 0, 0],
  head: [-50, 8, 0],
  handL: [0.2, POST, 0.56],
  handR: [-0.2, POST, 0.56],
  elbowL: [0.4, 0.1, 0.3],
  elbowR: [-0.4, 0.1, 0.3],
  footL: [0.18, BALL, -0.58, 0, 95],
  footR: [-0.16, BALL, -0.86, 0, 95],
  kneeL: [0.2, -0.5, -0.1],
  toes: [1, 1],
};

const flatA: PoseSpec = {
  hips: [0.13, 0.33, -0.14],
  rot: [0, 80, 0],
  spine: [6, -6, 0],
  head: [-25, -10, 0],
  look: 0,
  footL: [0.55, BALL, -0.92, -20, 80],
  footR: [-0.18, BALL, -0.98, 15, 80],
  kneeL: [0.6, -0.5, -0.3],
  kneeR: [-0.25, -0.5, -0.3],
  handL: [0.2, 0.1, 0.55],
  handR: [-0.15, 0.2, 0.05],
  elbowL: [0.55, 0.5, 0.3],
  elbowR: [0.1, 0.8, -0.1],
  wristL: [0, 0, 0],
  wristR: [0, 0, 0],
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [1, 1],
};

registerHold({
  id: 'flat',
  A: [flatA, { hips: [0.12, 0.37, -0.12], spine: [10, -6, 0] }],
  B: [flatB, flatBPushing],
  contacts: [
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.2, 0.0] },
    { who: 'A', hand: 'R', on: 'hips', at: [-0.13, 0.02, 0.0] },
  ],
  struggle: { A: 0.5, B: 0.8 },
  tempo: 1.1,
});

/* --------------------------------------------------------------- exposed */

// Near fall: bottom man turned toward his back with a half nelson, top man
// chest to chest across him, legs spread for a wide base.
// Written as a roll about the spine from prone (axial 0) so turns interpolate
// as a real roll: 180 is flat on his back.
// Most of the time on his back he is fighting: turned up onto a shoulder (112) while the top
// man drives it down; only near the pin is he flat (178).
const exposedB: PoseSpec = {
  hips: [0, 0.22, 0],
  rot: [0, 90, 0, 112],
  spine: [-8, 0, -6],
  head: [-20, 30, 0],
  look: 0,
  footL: [-0.22, BALL, -0.42, 160, 0],
  footR: [0.24, BALL, -0.38, 200, 0],
  kneeL: [-0.3, 1.2, -0.3],
  kneeR: [0.3, 1.2, -0.3],
  handL: [-0.35, 0.12, 0.45],
  handR: [0.3, 0.4, 0.3],
  elbowL: [-0.6, 0.0, 0.3],
  elbowR: [0.5, 0.0, 0.2],
  wristL: [0, 0, 0],
  wristR: [0, 0, 0],
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [0, 0],
};

const exposedBFlat: PoseSpec = {
  rot: [0, 90, 0, 178],
  hips: [0, 0.13, 0],
  head: [-10, 15, 0],
  handL: [-0.4, 0.05, 0.4],
};

const exposedA: PoseSpec = {
  hips: [0.44, 0.3, 0.26],
  rot: [-90, 76, 0],
  spine: [8, 0, 0],
  head: [-15, 0, 0],
  look: 0,
  footL: [1.12, BALL, 0.72, -100, 80],
  footR: [1.15, BALL, -0.22, -80, 80],
  kneeL: [1.0, -0.5, 0.8],
  kneeR: [1.0, -0.5, -0.3],
  handL: [-0.05, 0.12, 0.5],
  handR: [0.1, 0.2, -0.2],
  elbowL: [0.0, -0.3, 0.9],
  elbowR: [0.3, 0.7, -0.6],
  wristL: [0, 0, 0],
  wristR: [0, 0, 0],
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [1, 1],
};

registerHold({
  id: 'exposed',
  A: [exposedA, { hips: [0.38, 0.28, 0.1], spine: [4, 0, 0] }],
  B: [exposedB, exposedBFlat],
  contacts: [
    { who: 'A', hand: 'L', on: 'neck', at: [0, 0.04, -0.07] },
    { who: 'A', hand: 'R', on: 'thighR', at: [0, -0.2, 0.05] },
    { who: 'B', hand: 'R', on: 'chest', at: [-0.08, 0.12, 0.12] },
  ],
  struggle: { A: 0.4, B: 1 },
  tempo: 1.6,
});

/* -------------------------------------------------------------- standing */

// Bottom man has stood up; top man is behind him, hands locked at the belly. He works the escape with back
// pressure (owner, November 9): feet out in front, head and chest up, leaning his back into the rider while he
// peels the hands. It was folded forward, away from the rider. References: Wrestling Tips "Stand up" (lean back
// into him, pressure on his hand tie), Instructables bottom escapes, Coaches Insider (Dave Crowell) turn-in stand.
const standingB: PoseSpec = {
  hips: [0, 0.8, -0.06],
  rot: [0, -4, 0],
  spine: [-6, 0, 0],
  head: [-24, 0, 0],
  look: 0,
  footL: [0.2, BALL, 0.14, 10, 12],
  footR: [-0.2, BALL, 0.08, -10, 12],
  kneeL: [0.3, 0.6, 0.8],
  kneeR: [-0.3, 0.6, 0.8],
  handL: [0.08, 0.92, 0.2],
  handR: [-0.08, 0.92, 0.2],
  elbowL: [0.27, 0.8, 0.0],
  elbowR: [-0.27, 0.8, 0.0],
  wristL: GRIP_IN,
  wristR: GRIP_IN,
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [1, 1],
};

// Breaking the grip: hips screwed out to the side and pivoting in toward him, still sitting back into him.
const standingBTurning: PoseSpec = {
  hips: [0.1, 0.78, 0.0],
  rot: [40, 2, 0],
  spine: [-6, 22, 0],
  head: [-22, 35, 0],
  footL: [0.3, BALL, 0.14, 40, 15],
  footR: [-0.1, BALL, -0.04, 25, 15],
};

const standingA: PoseSpec = {
  // Offset the head beside the defender's shoulder while keeping hip pressure (with his back pressure, the
  // heads would otherwise meet).
  hips: [0.12, 0.8, -0.36],
  rot: [0, 24, 0],
  spine: [12, 0, -12],
  head: [8, -18, 8],
  look: 0,
  footL: [0.22, BALL, -0.42, 10, 15],
  footR: [-0.16, BALL, -0.7, -15, 25],
  kneeL: [0.3, 0.5, 0.4],
  kneeR: [-0.3, 0.5, 0.2],
  handL: [0.04, 0.88, 0.15],
  handR: [-0.04, 0.88, 0.15],
  elbowL: [0.5, 0.9, -0.4],
  elbowR: [-0.5, 0.9, -0.4],
  wristL: [0, 0, 0],
  wristR: [0, 0, 0],
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [1, 1],
};

registerHold({
  id: 'standing',
  A: [standingA, { hips: [0.12, 0.82, -0.34], rot: [10, 22, 0] }],
  B: [standingB, standingBTurning],
  contacts: [
    { who: 'A', hand: 'L', on: 'spine', at: [0.04, 0.0, 0.13] },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.0, 0.13] },
    { who: 'B', hand: 'L', on: 'handL', at: [0, -0.02, 0.02] },
    { who: 'B', hand: 'R', on: 'handR', at: [0, -0.02, 0.02] },
  ],
  struggle: { A: 0.6, B: 0.9 },
  tempo: 1.4,
});
