import { registerHold } from '../clips';
import type { PoseSpec } from '../spec';
import { BALL, GRIP } from './kit';

/**
 * Positions on the feet. Frame: A (the attacker / the man on top of the front
 * headlock) starts at -Z facing +Z; B starts at +Z facing -Z. +X is A's left,
 * which is B's right.
 */

/* ------------------------------------------------------------ double leg */

// Just in: lead knee down, chest on his thighs, head on the outside, arms
// wrapped behind both knees. He is still upright, hands on the back.
const doubleA0: PoseSpec = {
  hips: [0.11, 0.51, 0.06],
  rot: [-6, 22, -10],
  spine: [12, 4, 0],
  head: [-20, -35, 0],
  look: 0,
  footL: [0.14, BALL, -0.36, 0, 70],
  footR: [-0.24, BALL, -0.14, -15, 10],
  kneeL: [0.16, -0.3, 0.7],
  kneeR: [-0.32, 0.8, 0.8],
  handL: [0.12, 0.5, 0.6],
  handR: [-0.12, 0.5, 0.6],
  elbowL: [0.5, 0.7, 0.5],
  elbowR: [-0.5, 0.7, 0.5],
  wristL: GRIP,
  wristR: GRIP,
  shrugL: [0, 10],
  shrugR: [0, 10],
  toes: [1, 1],
};

// Driving through: up off the knee, feet under the hips, shoulder pressure
// stays low enough to retain both knee grips instead of standing out of them.
const doubleA1: PoseSpec = {
  hips: [0.11, 0.59, 0.26],
  rot: [-6, 30, -10],
  spine: [20, 4, 0],
  head: [-20, -25, 0],
  footL: [0.16, BALL, 0.38, 0, 18],
  footR: [-0.2, BALL, -0.2, -10, 35],
  kneeL: [0.3, 0.6, 0.9],
  kneeR: [-0.3, 0.5, 0.6],
};

const doubleB0: PoseSpec = {
  hips: [0, 0.88, 0.52],
  rot: [180, 24, 0],
  spine: [36, 0, 0],
  head: [20, 0, 0],
  look: 0,
  footL: [0.16, BALL, 0.54, 185, 8],
  footR: [-0.16, BALL, 0.56, 175, 8],
  kneeL: [0.2, 0.5, -0.4],
  kneeR: [-0.2, 0.5, -0.4],
  handL: [-0.12, 0.95, 0.1],
  handR: [0.12, 0.95, 0.1],
  elbowL: [-0.6, 1.3, 0.6],
  elbowR: [0.6, 1.3, 0.6],
  wristL: [10, 0, 0],
  wristR: [10, 0, 0],
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [1, 1],
};

const doubleB1: PoseSpec = {
  hips: [0, 0.84, 0.74],
  rot: [180, -14, 0],
  spine: [-4, 0, 0],
  head: [-10, 0, 0],
  footL: [0.15, 0.24, 0.62, 180, 30],
  footR: [-0.15, BALL, 0.86, 180, 10],
  kneeL: [0.2, 0.6, 0.2],
};

registerHold({
  id: 'legsDouble',
  A: [doubleA0, doubleA1],
  B: [doubleB0, doubleB1],
  contacts: [
    { who: 'A', hand: 'L', on: 'thighR', at: [-0.02, -0.25, -0.07] },
    { who: 'A', hand: 'R', on: 'thighL', at: [0.02, -0.25, -0.07] },
    { who: 'B', hand: 'L', on: 'chest', at: [-0.1, 0.18, -0.12] },
    { who: 'B', hand: 'R', on: 'chest', at: [0.1, 0.18, -0.12] },
  ],
  struggle: { A: 0.9, B: 0.8 },
  tempo: 1.6,
});

/* ------------------------------------------------------------ single leg */

// In on his right leg, rarely square: hips outside the leg and turned in, the crown
// of the head in the ribs until he elevates, hands clasped round the knee.
const singleA0: PoseSpec = {
  hips: [0.25, 0.56, 0.04],
  rot: [-38, 20, 0],
  spine: [18, -6, 0],
  head: [40, 55, 0],
  look: 0,
  footL: [0.42, BALL, -0.2, -25, 70],
  footR: [0.02, BALL, -0.2, -40, 12],
  kneeL: [0.25, -0.3, 0.7],
  kneeR: [-0.3, 0.8, 0.8],
  handL: [0.2, 0.45, 0.5],
  handR: [0.05, 0.5, 0.5],
  elbowL: [0.6, 0.6, 0.4],
  elbowR: [-0.3, 0.7, 0.5],
  wristL: GRIP,
  wristR: GRIP,
  shrugL: [0, 10],
  shrugR: [0, 10],
  toes: [1, 1],
};

// Step outside to bring the leg up: more of an angle, head still in on the ribs.
const singleA1: PoseSpec = {
  hips: [0.31, 0.76, 0.12],
  rot: [-50, 24, 0],
  spine: [16, -6, 0],
  head: [-14, -6, 0],
  footL: [0.52, BALL, 0.04, -40, 12],
  footR: [0.14, BALL, -0.24, -55, 20],
  kneeL: [0.4, 0.8, 0.6],
  kneeR: [-0.3, 0.8, 0.3],
};

const singleB0: PoseSpec = {
  hips: [-0.06, 0.9, 0.52],
  rot: [180, 10, 6],
  spine: [16, 0, -8],
  head: [8, 0, 0],
  look: 0,
  footL: [-0.2, BALL, 0.64, 190, 10],
  footR: [0.13, 0.12, 0.34, 170, 25],
  kneeL: [-0.25, 0.5, 0.2],
  kneeR: [0.2, 0.4, -0.3],
  handL: [-0.02, 0.9, 0.12],
  handR: [0.14, 0.95, 0.12],
  elbowL: [-0.6, 1.2, 0.6],
  elbowR: [0.6, 1.2, 0.6],
  wristL: [10, 0, 0],
  wristR: [10, 0, 0],
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [1, 0],
};

const singleB1: PoseSpec = {
  hips: [-0.06, 0.9, 0.58],
  rot: [180, -6, 10],
  spine: [0, 0, -10],
  footL: [-0.18, BALL, 0.7, 190, 30],
  footR: [0.08, 0.62, 0.24, 170, 40],
  kneeR: [0.15, 0.9, -0.3],
};

registerHold({
  id: 'legsSingle',
  A: [singleA0, singleA1],
  B: [singleB0, singleB1],
  contacts: [
    { who: 'A', hand: 'L', on: 'shinR', at: [0.0, -0.04, -0.05] },
    { who: 'A', hand: 'R', on: 'thighR', at: [0.03, -0.32, 0.07] },
    { who: 'B', hand: 'L', on: 'head', at: [0.0, 0.1, -0.04] },
    // Whizzer: overhook his near arm, the other hand on the head.
    { who: 'B', hand: 'R', on: 'armL', at: [0.0, -0.07, -0.045] },
  ],
  struggle: { A: 0.8, B: 1 },
  tempo: 1.8,
});

/* --------------------------------------------------------- front headlock */

// He is down on his knees with his head under A's chest; A has sprawled his
// hips back and wrapped the head, other hand on the near arm.
const fhlB0: PoseSpec = {
  hips: [0, 0.58, 0.46],
  rot: [180, 66, 0],
  spine: [38, 0, 0],
  head: [35, 0, 0],
  look: 0,
  footL: [-0.15, BALL, 0.86, 180, 75],
  footR: [0.15, BALL, 0.86, 180, 75],
  kneeL: [-0.15, -0.3, 0.1],
  kneeR: [0.15, -0.3, 0.1],
  handL: [-0.22, 0.055, 0.02],
  handR: [0.12, 0.38, -0.08],
  elbowL: [-0.5, 0.2, 0.2],
  elbowR: [0.5, 0.2, 0.2],
  wristL: GRIP,
  wristR: GRIP,
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [1, 1],
  palms: [1, 0],
};

const fhlB1: PoseSpec = {
  hips: [0, 0.62, 0.36],
  rot: [180, 32, 0],
  spine: [16, 0, 0],
  head: [-30, 0, 0],
  handL: [-0.22, 0.66, 0.08],
  elbowL: [-0.4, 0.45, 0.3],
};

const fhlA0: PoseSpec = {
  hips: [0, 0.52, -0.66],
  rot: [0, 50, 0],
  spine: [14, 0, 0],
  head: [-20, 0, 0],
  look: 0,
  footL: [0.26, BALL, -1.36, 0, 72],
  footR: [-0.24, BALL, -1.32, 0, 72],
  kneeL: [0.3, -0.6, -0.9],
  kneeR: [-0.28, -0.6, -0.9],
  handL: [0.0, 0.42, 0.0],
  handR: [-0.2, 0.45, 0.1],
  elbowL: [0.35, 0.28, -0.15],
  elbowR: [-0.35, 0.28, -0.1],
  wristL: GRIP,
  wristR: GRIP,
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [1, 1],
};

const fhlA1: PoseSpec = {
  hips: [0, 0.56, -0.56],
  rot: [0, 38, 0],
  spine: [14, 0, 0],
  footL: [0.26, BALL, -1.2, 0, 60],
  footR: [-0.24, BALL, -1.16, 0, 60],
};

registerHold({
  id: 'fhl',
  A: [fhlA0, fhlA1],
  B: [fhlB0, fhlB1],
  contacts: [
    { who: 'A', hand: 'L', on: 'neck', at: [0.0, 0.02, 0.08] },
    { who: 'A', hand: 'R', on: 'armL', at: [0.0, -0.14, -0.045] },
    // One hand supports the base; the free hand peels the controlling forearm.
    { who: 'B', hand: 'R', on: 'forearmL', at: [0.0, -0.16, 0.04] },
  ],
  struggle: { A: 0.6, B: 1 },
  tempo: 1.5,
});
