import { registerHold, registerMove } from '../clips';
import { BALL, POST, holdAt, stanceAt } from './kit';

// Head outside the near thigh, inside arm high on the leg; unlike the low
// single, the attacker brings the trail foot under his hips and rises through.
registerHold({
  id: 'legsHighCrotch',
  A: [
    { base: holdAt('legsSingle', 'A', 0), hips: [0.22, 0.62, 0.04], rot: [-12, 12, 0], spine: [8, 0, 0], head: [-12, -15, 0], footL: [0.22, BALL, 0.25, 0, 15], footR: [-0.06, BALL, -0.35, -15, 45], handL: [0.08, 0.75, 0.45], handR: [0.2, 0.66, 0.48] },
    { hips: [0.22, 0.86, 0.15], rot: [-12, 8, 0], footR: [-0.04, BALL, 0.02, -15, 15], head: [-8, -15, 0] },
  ],
  B: [
    { base: holdAt('legsSingle', 'B', 0), hips: [0, 0.9, 0.48], rot: [180, 12, -6], footL: [-0.2, BALL, 0.65, 180, 15], footR: [0.15, 0.14, 0.36, 180, 30] },
    { hips: [0, 0.94, 0.55], footR: [0.12, 0.48, 0.31, 180, 35], spine: [4, 0, -12] },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'thighR', at: [0.04, -0.12, 0.06] },
    { who: 'A', hand: 'R', on: 'thighR', at: [-0.04, -0.24, -0.06] },
    { who: 'B', hand: 'R', on: 'chest', at: [0.1, 0.14, -0.12] },
    { who: 'B', hand: 'L', on: 'head', at: [0, 0.09, -0.03] },
  ],
  struggle: { A: 0.8, B: 1 }, tempo: 1.7,
});

registerMove({
  id: 'shotHighCrotch', startDist: 1, warpBy: 0.65,
  A: [
    { t: 0, pose: { base: stanceAt({ x: 0, z: -0.5, yaw: 0 }, 1) } },
    { t: 0.3, pose: { hips: [0.08, 0.58, -0.35], rot: [-12, 12, 0], spine: [8, 0, 0], head: [-20, -10, 0], handL: [0.1, 0.65, 0.05], handR: [0.24, 0.55, 0.08] } },
    { t: 0.65, pose: { hips: [0.22, 0.57, 0.02], footL: [0.2, BALL, 0.2, 0, 25], footR: [-0.06, BALL, -0.38, -15, 55], handL: [0.08, 0.73, 0.45], handR: [0.2, 0.64, 0.45] } },
    { t: 1, pose: { base: holdAt('legsHighCrotch', 'A', 0) } },
  ],
  B: [
    { t: 0, pose: { base: stanceAt({ x: 0, z: 0.5, yaw: 180 }, 1) } },
    { t: 0.55, pose: { hips: [0, 0.88, 0.55], spine: [14, 0, -6] } },
    { t: 1, pose: { base: holdAt('legsHighCrotch', 'B', 0) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'thighR', at: [0.04, -0.12, 0.06], from: 0.82, to: 1 },
    { who: 'A', hand: 'R', on: 'thighR', at: [-0.04, -0.24, -0.06], from: 0.82, to: 1 },
  ],
});

const END = { x: -0.3, z: 0.88, yaw: 90 };
registerMove({
  id: 'finishHighCrotch',
  A: [
    { t: 0, pose: { base: holdAt('legsHighCrotch', 'A', 1) } },
    { t: 0.3, pose: { hips: [0.18, 0.92, 0.4], rot: [25, 6, 0], spine: [8, 0, 0], footL: [0.35, BALL, 0.34, 20, 15], footR: [0.02, BALL, 0.18, 30, 15] } },
    // Step around the support foot before lowering; preserve a visible drive arc.
    { t: 0.48, pose: { hips: [0.04, 0.77, 0.6], rot: [52, 22, 0], spine: [12, 0, 0], footL: [0.12, BALL, 0.51, 55, 25], footR: [-0.19, BALL, 0.37, 65, 35] } },
    { t: 0.65, land: true, pose: { hips: [-0.12, 0.52, 0.76], rot: [75, 42, 0], footL: [-0.2, BALL, 0.35, 85, 50], footR: [-0.3, BALL, 0.85, 85, 60] } },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('legsHighCrotch', 'B', 1) } },
    { t: 0.3, pose: { hips: [0, 1.03, 0.63], rot: [205, -8, -15], footL: [-0.17, BALL, 0.82, 210, 30], footR: [0.14, 0.7, 0.44, 190, 40] } },
    // The defender reaches to brace as his base tips, rather than appearing
    // on both palms only at impact. The captured leg stays elevated.
    { t: 0.48, pose: { hips: [-0.12, 0.71, 0.8], rot: [135, 32, -8, 30], spine: [10, 0, -8], footL: [-0.17, 0.1, 1.0, 135, 50], footR: [0.08, 0.64, 0.57, 130, 50], handL: [-0.51, 0.3, 0.84], handR: [-0.52, 0.37, 1.02] } },
    { t: 0.65, land: true, pose: { hips: [-0.28, 0.24, 0.94], rot: [90, 65, 0, 65], footL: [-0.1, 0.07, 1.15, 90, 70], footR: [-0.1, 0.25, 0.75, 90, 60], handL: [-0.6, POST, 0.85], handR: [-0.6, POST, 1.1] } },
    { t: 1, pose: { base: holdAt('ride', 'B', 0, END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'thighR', at: [0.04, -0.12, 0.06], from: 0, to: 0.6 },
    { who: 'A', hand: 'R', on: 'thighR', at: [-0.04, -0.24, -0.06], from: 0, to: 0.55 },
    // Slide the outside arm to the torso while the inside hand retains the leg,
    // then establish the existing ride grip after the landing.
    { who: 'A', hand: 'R', on: 'chest', at: [0.1, -0.08, 0.08], from: 0.64, to: 0.79 },
    { who: 'A', hand: 'R', on: 'spine', at: [0, 0.02, 0.11], from: 0.85, to: 1 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.9, to: 1 },
  ],
});
