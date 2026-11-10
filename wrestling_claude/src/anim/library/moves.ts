import { registerMove } from '../clips';
import type { PoseSpec } from '../spec';
import { BALL, GRIP, PALM_DOWN, POST, holdAt, stanceAt } from './kit';

/**
 * Transitions. First and last keys are taken straight from the stance or hold
 * they leave and land in (placed with the same frame offsets the simulation
 * uses), so a move always starts where the bodies are and ends exactly where
 * the next position begins. Only the middle is authored by hand.
 */

const A_START = { x: 0, z: -0.5, yaw: 0 };
const B_START = { x: 0, z: 0.5, yaw: 180 };

/* ------------------------------------------------------------------ shots */

registerMove({
  id: 'shotDouble',
  startDist: 1.0,
  warpBy: 0.62,
  A: [
    { t: 0, pose: { base: stanceAt(A_START, 1) } },
    {
      t: 0.3,
      pose: {
        hips: [0, 0.6, -0.42],
        rot: [0, 10, 0],
        spine: [14, 0, 0],
        head: [-38, 0, 0],
        handL: [0.2, 0.66, -0.12],
        handR: [-0.2, 0.66, -0.12],
      },
    },
    {
      t: 0.64,
      pose: {
        hips: [0.1, 0.56, -0.1],
        rot: [-5, 24, -6],
        spine: [10, -6, 0],
        head: [-30, -15, 0],
        footL: [0.15, 0.07, -0.1, 0, 35],
        footR: [-0.24, BALL, -0.6, -20, 50],
        handL: [0.16, 0.56, 0.36],
        handR: [-0.16, 0.56, 0.36],
      },
    },
    { t: 1, pose: { base: holdAt('legsDouble', 'A', 0) } },
  ],
  B: [
    { t: 0, pose: { base: stanceAt(B_START, 1) } },
    { t: 0.55, pose: { hips: [0, 0.86, 0.55], spine: [22, 0, 0], head: [22, 0, 0] } },
    { t: 1, pose: { base: holdAt('legsDouble', 'B', 0) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'thighR', at: [-0.02, -0.25, -0.07], from: 0.82, to: 1 },
    { who: 'A', hand: 'R', on: 'thighL', at: [0.02, -0.25, -0.07], from: 0.82, to: 1 },
    // Build the defensive frame during penetration, then retain the hold anchors.
    { who: 'B', hand: 'L', on: 'chest', at: [-0.1, 0.18, -0.12], from: 0.55, to: 1, fade: 0.2 },
    { who: 'B', hand: 'R', on: 'chest', at: [0.1, 0.18, -0.12], from: 0.65, to: 1, fade: 0.2 },
  ],
});

// Standard single: outside sweep, corner turn, then gather. Low single stays separate.
registerMove({
  id: 'shotSingle',
  startDist: 1.0,
  warpBy: 0.62,
  A: [
    { t: 0, pose: { base: stanceAt(A_START, 1) } },
    {
      t: 0.3,
      pose: {
        hips: [0.20, 0.60, -0.36],
        rot: [-24, 10, 0],
        spine: [14, -10, 0],
        head: [-38, 0, 0],
        footL: [0.34, 0.06, -0.22, -20, 35],
        handL: [0.34, 0.61, 0.03],
        handR: [0.08, 0.62, -0.04],
      },
    },
    {
      t: 0.64,
      pose: {
        hips: [0.38, 0.53, 0.02],
        rot: [-42, 22, 0],
        spine: [12, -8, 0],
        footL: [0.46, BALL, 0.03, -35, 55],
        kneeL: [0.40, 0.12, 0.30],
        footR: [0.02, BALL, -0.43, -40, 55],
        handL: [0.30, 0.43, 0.38],
        handR: [0.10, 0.49, 0.41],
        // Elbows already where the single-leg hold carries them, so nothing swings at the hand-off.
        elbowL: [0.6, 0.6, 0.4],
        elbowR: [-0.3, 0.7, 0.5],
      },
    },
    // Collect the leg after rounding the outside of the lead knee, staying angled.
    { t: .82, pose: { hips: [.31,.54,.06], rot: [-40,20,0],
      footL: [.44,BALL,-.14,-25,65], footR: [.02,.06,-.20,-40,20],
      kneeL: [.38,.10,.35], handL: [.22,.45,.48],handR: [.07,.50,.48], elbowL: [.6,.6,.4], elbowR: [-.3,.7,.5] } },
    { t: 1, pose: { base: holdAt('legsSingle', 'A', 0) } },
  ],
  B: [
    { t: 0, pose: { base: stanceAt(B_START, 1) } },
    { t: 0.55, pose: { hips: [-0.03, 0.88, 0.55], spine: [20, 0, -4], head: [20, 0, 0] } },
    { t: 1, pose: { base: holdAt('legsSingle', 'B', 0) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'shinR', at: [0.0, -0.04, -0.05], from: 0.82, to: 1 },
    { who: 'A', hand: 'R', on: 'thighR', at: [0.03, -0.32, 0.07], from: 0.82, to: 1 },
    { who: 'B', hand: 'L', on: 'head', at: [0, 0.1, -0.04], from: 0.55, to: 1, fade: 0.2 },
    // Whizzer: the arm on the attacked side overhooks his near arm (reference S1rUJQXhnoY).
    { who: 'B', hand: 'R', on: 'armL', at: [0.0, -0.07, -0.045], from: 0.65, to: 1, fade: 0.2 },
  ],
});

/* ---------------------------------------------------------------- finishes */

// Drive through, he goes over backwards onto his hip, turns to his belly to
// keep his back off the mat, and A comes round on top.
const DOUBLE_END = { x: -0.35, z: 0.95, yaw: 90 };
registerMove({
  id: 'finishDouble',
  // Stand up under him with the head tight on his chest, then turn the corner: the back leg
  // sweeps round like a windshield wiper and he tips over onto his side, landing at an angle.
  A: [
    { t: 0, pose: { base: holdAt('legsDouble', 'A', 1) } },
    {
      t: 0.22,
      pose: {
        hips: [0.08, 0.84, 0.36],
        rot: [0, 24, -6],
        spine: [16, 4, 0],
        head: [-20, -25, 0],
        footL: [0.2, BALL, 0.3, 0, 12],
        footR: [-0.04, BALL, 0.12, -20, 15],
      },
    },
    {
      t: 0.42,
      pose: {
        hips: [-0.06, 0.76, 0.5],
        rot: [40, 30, 0],
        spine: [18, 0, 0],
        footL: [0.14, BALL, 0.48, 20, 15],
        footR: [-0.4, BALL, 0.3, 60, 20],
      },
    },
    {
      t: 0.6,
      land: true,
      pose: {
        hips: [-0.16, 0.5, 0.74],
        rot: [50, 62, 0],
        spine: [14, 0, 0],
        footL: [0.06, BALL, 0.42, 40, 70],
        footR: [-0.36, BALL, 0.42, 60, 70],
        handL: [0.1, 0.25, 1.05],
        handR: [-0.25, 0.25, 1.0],
      },
    },
    {
      t: 0.8,
      pose: {
        hips: [-0.3, 0.48, 0.74],
        rot: [60, 50, 0],
        spine: [24, -10, 0],
        // Drape the arm over his back now, so it is already in the ride when the ride begins.
        elbowR: [-0.25, 1.0, 1.15],
      },
    },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, DOUBLE_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('legsDouble', 'B', 1) } },
    {
      t: 0.22,
      pose: {
        hips: [0, 0.88, 0.8],
        rot: [180, -12, 0],
        spine: [-4, 0, 0],
        head: [-6, 0, 0],
        footL: [0.15, 0.2, 0.66, 180, 30],
        footR: [-0.15, BALL, 0.84, 180, 10],
      },
    },
    {
      t: 0.42,
      pose: {
        hips: [-0.06, 0.74, 0.92],
        rot: [180, -35, 0],
        spine: [-10, 0, 0],
        head: [25, 0, 0],
        footL: [0.15, 0.32, 0.68, 180, 30],
        footR: [-0.15, 0.18, 0.84, 180, 30],
        handL: [-0.4, 0.9, 1.05],
        handR: [0.4, 0.9, 1.05],
      },
    },
    {
      t: 0.6,
      land: true,
      pose: {
        hips: [-0.08, 0.16, 1.04],
        rot: [180, -70, 0],
        spine: [-6, 0, 0],
        head: [35, 0, 0],
        footL: [0.2, 0.32, 0.66, 180, 20],
        footR: [-0.2, 0.36, 0.7, 180, 20],
        handL: [-0.36, POST, 1.3],
        handR: [0.36, POST, 1.3],
      },
    },
    {
      t: 0.8,
      pose: {
        hips: [-0.25, 0.3, 1.0],
        rot: [120, 40, 0, 60],
        spine: [10, 0, 0],
        footL: [-0.1, BALL, 0.6, 150, 60],
        footR: [-0.3, BALL, 0.55, 120, 60],
        handL: [-0.1, POST, 1.3],
        handR: [0.2, POST, 1.15],
      },
    },
    { t: 1, pose: { base: holdAt('ride', 'B', 0, DOUBLE_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'thighR', at: [-0.02, -0.25, -0.07], from: 0, to: 0.56, fade: 0.08 },
    { who: 'A', hand: 'R', on: 'thighL', at: [0.02, -0.25, -0.07], from: 0, to: 0.56, fade: 0.08 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.85, to: 1 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.9, to: 1 },
  ],
});

// The crowd-pleaser, a swing finish (reference: "Double Leg Swing Finish", YouTube short
// tmidv3LOATw): step up under him and stand tall so he lies face down across the shoulders,
// hips beside the head, then turn and drop the far shoulder so his head and hands go down
// first and his legs swing over. He lands on his hands and knees with the attacker chest on hips.
registerMove({
  id: 'liftDouble',
  A: [
    { t: 0, pose: { base: holdAt('legsDouble', 'A', 1) } },
    {
      t: 0.18,
      pose: {
        hips: [0, 0.66, 0.42],
        rot: [0, 24, 0],
        spine: [12, 0, 0],
        head: [-14, -30, 0],
        footL: [0.16, BALL, 0.52, 0, 15],
        footR: [-0.2, BALL, 0.18, -10, 25],
      },
    },
    {
      t: 0.38,
      pose: {
        hips: [0.02, 0.92, 0.48],
        rot: [0, 4, 0],
        spine: [-8, 0, 0],
        head: [-6, -30, 10],
        footL: [0.18, BALL, 0.58, 5, 0],
        footR: [-0.2, BALL, 0.36, -10, 0],
      },
    },
    {
      t: 0.5,
      pose: {
        hips: [0.0, 0.9, 0.52],
        rot: [25, 8, 0],
        spine: [-2, 0, 0],
        footL: [0.22, BALL, 0.64, 25, 0],
        footR: [-0.18, BALL, 0.36, 20, 10],
      },
    },
    {
      // Turns and drops the far shoulder so his head goes down first.
      t: 0.62,
      pose: {
        hips: [-0.08, 0.76, 0.6],
        rot: [55, 28, 0],
        spine: [12, 0, -10],
        footL: [0.22, BALL, 0.72, 50, 20],
        footR: [-0.24, BALL, 0.36, 45, 30],
      },
    },
    {
      // Follows him down, chest over his hips.
      t: 0.72,
      land: true,
      pose: {
        hips: [-0.24, 0.6, 0.62],
        rot: [75, 55, 0],
        spine: [24, 0, 0],
        footL: [-0.55, BALL, 0.3, 75, 60],
        footR: [-0.75, BALL, 0.62, 75, 60],
      },
    },
    {
      t: 0.86,
      pose: {
        hips: [-0.3, 0.48, 0.74],
        rot: [60, 50, 0],
        spine: [24, -10, 0],
      },
    },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, DOUBLE_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('legsDouble', 'B', 1) } },
    {
      t: 0.18,
      pose: {
        hips: [0, 0.98, 0.7],
        rot: [180, 6, 0],
        spine: [12, 0, 0],
        head: [12, 0, 0],
        footL: [0.15, 0.3, 0.72, 180, 20],
        footR: [-0.15, 0.2, 0.8, 180, 20],
        elbowL: [-0.6, 1.5, 0.5],
        elbowR: [0.6, 1.5, 0.5],
      },
    },
    {
      // Draped across his shoulders face down: hips beside his head, chest over the far
      // shoulder, legs out the other side, arms hanging.
      t: 0.38,
      pose: {
        hips: [-0.27, 1.56, 0.4],
        rot: [90, 84, 0],
        spine: [6, 0, 0],
        head: [-10, 0, 0],
        footL: [-1.02, 1.36, 0.32, 90, 20],
        footR: [-1.0, 1.3, 0.52, 90, 20],
        handL: [0.5, 1.0, 0.3],
        handR: [0.55, 1.0, 0.56],
        elbowL: [0.4, 1.4, 0.1],
        elbowR: [0.45, 1.4, 0.76],
      },
    },
    { t: 0.5, pose: { hips: [-0.24, 1.55, 0.5], rot: [90, 92, 0] } },
    {
      // The swing: head and hands go down to the mat, legs arc up and over.
      t: 0.62,
      pose: {
        hips: [-0.12, 1.2, 0.78],
        rot: [90, 125, 0],
        spine: [10, 0, 0],
        head: [-30, 0, 0],
        footL: [-0.75, 1.6, 0.68, 90, 40],
        footR: [-0.7, 1.55, 0.9, 90, 40],
        handL: [0.32, 0.3, 0.78],
        handR: [0.36, 0.3, 1.08],
        wristL: PALM_DOWN,
        wristR: PALM_DOWN,
      },
    },
    {
      // Lands on his hands and knees, already in the bottom position.
      t: 0.72,
      land: true,
      pose: {
        hips: [-0.32, 0.52, 0.95],
        rot: [90, 78, 0],
        spine: [6, 0, 0],
        head: [-35, 0, 0],
        footL: [-0.82, 0.4, 0.82, 90, 65],
        footR: [-0.82, 0.36, 1.08, 90, 65],
        handL: [0.15, POST, 0.75],
        handR: [0.15, POST, 1.15],
        elbowL: [-0.1, 0.3, 0.63],
        elbowR: [-0.1, 0.3, 1.27],
      },
    },
    // Hands land first, then the knees and feet come down behind.
    { t: 0.8, pose: { hips: [-0.34, 0.5, 0.95], footL: [-0.8, BALL, 0.82, 90, 75], footR: [-0.8, BALL, 1.08, 90, 75] } },
    { t: 1, pose: { base: holdAt('ride', 'B', 0, DOUBLE_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'thighR', at: [-0.02, -0.2, -0.08], from: 0, to: 0.7 },
    { who: 'A', hand: 'R', on: 'thighL', at: [0.02, -0.2, -0.08], from: 0, to: 0.7 },
    { who: 'B', hand: 'L', on: 'chest', at: [-0.12, 0.12, -0.13], from: 0, to: 0.3, fade: 0.08 },
    { who: 'B', hand: 'R', on: 'chest', at: [0.12, 0.12, -0.13], from: 0, to: 0.3, fade: 0.08 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.88, to: 1 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.93, to: 1 },
  ],
});

// Lift the leg, turn the corner and run the pipe; he hops, loses the standing
// leg and goes down to his side, then turns to his base.
const SINGLE_END = { x: 0.3, z: 0.8, yaw: -90 };
registerMove({
  id: 'finishSingle',
  A: [
    { t: 0, pose: { base: holdAt('legsSingle', 'A', 1) } },
    {
      t: 0.35,
      pose: {
        hips: [0.2, 0.8, 0.25],
        rot: [-50, 18, 0],
        spine: [14, -10, 0],
        footL: [0.36, BALL, 0.06, -40, 15],
        footR: [0.0, BALL, -0.12, -60, 20],
        kneeR: [-0.3, 0.1, 0.2],
      },
    },
    { t: .52, pose: { handR: [.16, .68, .70], elbowR: [.44, .72, .45] } },
    {
      t: 0.62,
      land: true,
      pose: {
        hips: [0.40, 0.48, 0.50],
        rot: [-80, 30, -8],
        spine: [20, 0, 0],
        footL: [0.66, BALL, 0.28, -85, 15],
        footR: [0.18, BALL, 0.76, -90, 20],
        // Keep the bent knees on a continuous path into the ride.
        kneeL: [0, -0.3, 0.8],
        kneeR: [-0.4, 0.2, 0.5],
        handR: [.24, .48, .84],
        elbowR: [.54, .63, .62],
      },
    },
    { t: .76, pose: { handL: [.10, .40, .88], elbowL: [-.08, .62, .62] } },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, SINGLE_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('legsSingle', 'B', 1) } },
    {
      t: 0.35,
      pose: {
        hips: [0.05, 0.86, 0.66],
        rot: [150, -10, 18],
        spine: [0, 0, -12],
        footL: [-0.08, BALL, 0.78, 160, 30],
        footR: [0.2, 0.62, 0.38, 140, 40],
        handL: [-0.4, 0.8, 0.7],
        handR: [0.3, 0.9, 0.5],
      },
    },
    {
      t: 0.62,
      land: true,
      pose: {
        hips: [0.25, 0.2, 0.86],
        rot: [-90, 60, 0, -70],
        spine: [8, 0, 0],
        footL: [-0.1, 0.06, 0.85, -60, 90],
        footR: [-0.05, 0.25, 0.55, -80, 60],
        handL: [0.5, POST, 0.95],
        handR: [0.5, POST, 0.6],
      },
    },
    { t: 1, pose: { base: holdAt('ride', 'B', 0, SINGLE_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'shinR', at: [0.0, -0.04, -0.05], from: 0, to: 0.67 },
    { who: 'A', hand: 'R', on: 'thighR', at: [0.03, -0.32, 0.07], from: 0, to: 0.46 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.72, to: 1 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.9, to: 1 },
  ],
});

/* --------------------------------------------------------------- sprawls */

// He sprawls on the shot: hips slam back and down on the shooter's head and
// shoulders, and they settle into a front headlock with the sprawler on top.
const STUFF_END = { x: 0, z: 0.05, yaw: 180 };
registerMove({
  id: 'stuffed',
  startDist: 1.0,
  warpBy: 0.3,
  A: [
    {
      t: 0,
      pose: {
        base: stanceAt(A_START, 1),
        hips: [0.02, 0.58, -0.18],
        rot: [-4, 22, 0],
        spine: [10, 0, 0],
        head: [-30, 0, 0],
        handL: [0.16, 0.56, 0.3],
        handR: [-0.16, 0.56, 0.3],
      },
    },
    {
      t: 0.45,
      land: true,
      pose: {
        hips: [0, 0.42, -0.1],
        rot: [0, 72, 0],
        spine: [24, 0, 0],
        head: [20, 0, 0],
        footL: [0.16, BALL, -0.5, 0, 75],
        footR: [-0.16, BALL, -0.52, 0, 75],
        handL: [0.15, 0.3, 0.42],
        handR: [-0.15, 0.3, 0.42],
      },
    },
    { t: 1, pose: { base: holdAt('fhl', 'B', 0, STUFF_END) } },
  ],
  B: [
    { t: 0, pose: { base: stanceAt(B_START, 1) } },
    {
      t: 0.4,
      land: true,
      pose: {
        // Feet kicked back wide and long, toes flat so the hips slide; hips heavy on his head.
        hips: [0, 0.34, 0.6],
        rot: [180, 74, 0],
        spine: [16, 0, 0],
        head: [-20, 0, 0],
        footL: [-0.42, 0.05, 1.5, 180, 110],
        footR: [0.42, 0.05, 1.48, 180, 110],
        // Head and hands: near hand already on the back of his neck, the other over his near arm,
        // where the grips take hold (they were keyed behind his shoulders and snapped ~30 cm forward).
        handL: [-0.02, 0.56, 0.44],
        handR: [0.17, 0.5, 0.36],
      },
    },
    { t: 1, pose: { base: holdAt('fhl', 'A', 0, STUFF_END) } },
  ],
  contacts: [
    { who: 'B', hand: 'L', on: 'neck', at: [0.0, 0.02, 0.08], from: 0.45, to: 1 },
    { who: 'B', hand: 'R', on: 'armL', at: [0.0, -0.14, -0.045], from: 0.55, to: 1 },
  ],
});

// On a single he turns with the shot to face it, drops the hip of the attacked leg onto the
// shooter's shoulder and squares up, rather than kicking straight back into open mat.
registerMove({
  id: 'stuffedSingle',
  startDist: 1.0,
  warpBy: 0.3,
  A: [
    {
      t: 0,
      pose: {
        base: stanceAt(A_START, 1),
        hips: [0.14, 0.58, -0.16],
        rot: [-20, 22, 0],
        spine: [10, -6, 0],
        head: [-30, 0, 0],
        handL: [0.3, 0.56, 0.3],
        handR: [0.02, 0.56, 0.3],
      },
    },
    {
      t: 0.45,
      land: true,
      pose: {
        hips: [0.12, 0.42, -0.1],
        rot: [-24, 72, 0],
        spine: [24, -6, 0],
        head: [20, 0, 0],
        footL: [0.3, BALL, -0.5, -10, 75],
        footR: [-0.04, BALL, -0.52, -10, 75],
        handL: [0.28, 0.3, 0.42],
        handR: [0.02, 0.3, 0.42],
      },
    },
    { t: 1, pose: { base: holdAt('fhl', 'B', 0, STUFF_END) } },
  ],
  B: [
    { t: 0, pose: { base: stanceAt(B_START, 1) } },
    {
      t: 0.4,
      land: true,
      pose: {
        hips: [0.14, 0.34, 0.62],
        rot: [152, 72, 8],
        spine: [16, 0, 0],
        head: [-20, 0, 0],
        footL: [-0.34, 0.05, 1.42, 160, 110],
        footR: [0.52, 0.05, 1.3, 150, 110],
        handL: [-0.05, 0.45, 0.15],
        handR: [0.25, 0.45, 0.15],
      },
    },
    { t: 1, pose: { base: holdAt('fhl', 'A', 0, STUFF_END) } },
  ],
  contacts: [
    { who: 'B', hand: 'L', on: 'neck', at: [0.0, 0.02, 0.08], from: 0.45, to: 1 },
    { who: 'B', hand: 'R', on: 'armL', at: [0.0, -0.14, -0.045], from: 0.55, to: 1 },
  ],
});

const SPRAWL_END = { x: 0, z: 0.15, yaw: 180 };
registerMove({
  id: 'sprawlOut',
  A: [
    { t: 0, pose: { base: holdAt('legsDouble', 'A', 0) } },
    {
      t: 0.5,
      land: true,
      pose: {
        hips: [0, 0.42, -0.02],
        rot: [0, 70, 0],
        spine: [22, 0, 0],
        head: [18, 0, 0],
        handL: [0.22, POST, 0.26],
        handR: [-0.22, POST, 0.26],
        elbowL: [0.38, 0.30, 0.16],
        elbowR: [-0.38, 0.30, 0.16],
        wristL: PALM_DOWN,
        wristR: PALM_DOWN,
        footL: [0.16, BALL, -0.44, 0, 75],
        footR: [-0.16, BALL, -0.46, 0, 75],
      },
    },
    { t: 1, pose: { base: holdAt('fhl', 'B', 0, SPRAWL_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('legsDouble', 'B', 0) } },
    {
      t: 0.45,
      land: true,
      pose: {
        hips: [0, 0.34, 0.66],
        rot: [180, 74, 0],
        spine: [16, 0, 0],
        footL: [-0.42, 0.05, 1.56, 180, 110],
        footR: [0.42, 0.05, 1.54, 180, 110],
      },
    },
    { t: 1, pose: { base: holdAt('fhl', 'A', 0, SPRAWL_END) } },
  ],
  contacts: [
    { who: 'B', hand: 'L', on: 'neck', at: [0.0, 0.02, 0.08], from: 0.15, to: 1 },
    { who: 'B', hand: 'R', on: 'armL', at: [0.0, -0.14, -0.045], from: 0.3, to: 1 },
  ],
});

/* ------------------------------------------------------------- snap down */

const SNAP_END = { x: 0, z: 0.12, yaw: 0 };
registerMove({
  id: 'snapDown',
  A: [
    { t: 0, pose: { base: stanceAt({ x: 0, z: -0.42, yaw: 0 }, 1) } },
    {
      t: 0.4,
      pose: {
        hips: [0, 0.62, -0.6],
        rot: [0, 30, 0],
        spine: [38, 0, 0],
        head: [10, 0, 0],
        handL: [0.05, 0.6, 0.05],
        handR: [-0.1, 0.55, 0.1],
      },
    },
    { t: 1, pose: { base: holdAt('fhl', 'A', 0, SNAP_END) } },
  ],
  B: [
    { t: 0, pose: { base: stanceAt({ x: 0, z: 0.42, yaw: 180 }, 1), palms: [1, 1] } },
    {
      t: 0.45,
      land: true,
      pose: {
        hips: [0, 0.68, 0.55],
        rot: [180, 60, 0],
        spine: [42, 0, 0],
        head: [30, 0, 0],
        handL: [-0.2, POST, 0.0],
        handR: [0.2, POST, 0.0],
        wristL: PALM_DOWN,
        wristR: PALM_DOWN,
      },
    },
    { t: 1, pose: { base: holdAt('fhl', 'B', 0, SNAP_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'neck', at: [0, 0.045, -0.07], from: 0, to: 0.5 },
    { who: 'A', hand: 'L', on: 'neck', at: [0.0, 0.02, 0.08], from: 0.62, to: 1 },
    { who: 'A', hand: 'R', on: 'armL', at: [0.0, -0.14, -0.045], from: 0.7, to: 1 },
  ],
});

/* ---------------------------------------------------- off the headlock */

// Spin behind (Pat Smith, JROB 44FnZbXRiYY): he stays up on his feet with his hips high, keeps
// his chest heavy on the back and pivots on the shoulder in a tight circle, the head wrapped
// and the near tricep blocked, then lands chest on back with the arms around the waist.
const BEHIND_END = { x: 0, z: 0.32, yaw: 180 };
registerMove({
  id: 'goBehind',
  A: [
    { t: 0, pose: { base: holdAt('fhl', 'A', 0) } },
    {
      t: 0.3,
      pose: {
        hips: [-0.3, 0.7, -0.24],
        rot: [60, 70, 0],
        spine: [28, 0, 0],
        head: [-25, 0, 0],
        footL: [-0.7, BALL, -0.82, 60, 60],
        footR: [-1.0, BALL, -0.3, 60, 60],
      },
    },
    {
      t: 0.55,
      pose: {
        hips: [-0.42, 0.7, 0.2],
        rot: [100, 70, 0],
        spine: [30, 0, 0],
        head: [-25, 0, 0],
        footL: [-1.1, BALL, 0.0, 100, 60],
        footR: [-1.0, BALL, 0.58, 100, 60],
      },
    },
    {
      t: 0.78,
      pose: {
        hips: [-0.22, 0.63, 0.72],
        rot: [150, 64, 0],
        spine: [28, 0, 0],
        head: [-20, 0, 0],
        footL: [-0.8, BALL, 1.14, 150, 60],
        footR: [-0.3, BALL, 1.42, 150, 60],
      },
    },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, BEHIND_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('fhl', 'B', 0), palms: [1, 1] } },
    {
      t: 0.5,
      pose: {
        hips: [0, 0.52, 0.4],
        rot: [180, 75, 0],
        spine: [14, 0, 0],
        handL: [-0.2, POST, -0.1],
        handR: [0.2, POST, -0.1],
        wristL: PALM_DOWN,
        wristR: PALM_DOWN,
      },
    },
    { t: 1, pose: { base: holdAt('ride', 'B', 0, BEHIND_END) } },
  ],
  contacts: [
    // Head stays wrapped through the first half of the spin, then that hand slides onto the back.
    { who: 'A', hand: 'L', on: 'neck', at: [0.0, 0.02, 0.08], from: 0, to: 0.5 },
    { who: 'A', hand: 'L', on: 'chest', at: [0.06, 0.05, -0.1], from: 0.5, to: 0.84, fade: 0.14 },
    // The near tricep stays blocked until he is past the shoulder.
    { who: 'A', hand: 'R', on: 'armL', at: [0.0, -0.14, -0.045], from: 0, to: 0.62 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.62, to: 1, fade: 0.16 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.84, to: 1 },
  ],
});

// He digs his head out, posts a foot and stands back up to his stance.
registerMove({
  id: 'recover',
  A: [
    { t: 0, pose: { base: holdAt('fhl', 'A', 1) } },
    { t: 0.3, pose: { handL: [0.08, 0.94, -0.12], handR: [-0.2, 0.82, -0.1], elbowL: [0.35, 0.65, -0.4], elbowR: [-0.4, 0.55, -0.45] } },
    { t: 0.5, pose: { handL: [0.18, 1.02, -0.3], handR: [-0.18, 0.95, -0.25], hips: [0, 0.7, -0.6], rot: [0, 26, 0], spine: [22, 0, 0], footL: [0.2, BALL, -0.75, 0, 30], footR: [-0.2, BALL, -1.05, -20, 40] } },
    { t: 1, pose: { base: stanceAt({ x: 0, z: -0.55, yaw: 0 }, 1) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('fhl', 'B', 1), handR: [0.18, 0.85, 0.12], elbowR: [0.4, 0.6, 0.35] } },
    {
      t: 0.45,
      pose: {
        handL: [-0.22, 0.95, 0.1], handR: [0.22, 1, 0.16],
        hips: [0, 0.68, 0.52],
        rot: [180, 36, 0],
        spine: [20, 0, 0],
        head: [-30, 0, 0],
        footL: [-0.2, BALL, 0.36, 185, 20],
        footR: [0.18, BALL, 0.86, 175, 70],
      },
    },
    { t: 1, pose: { base: stanceAt({ x: 0, z: 0.55, yaw: 180 }, 1) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'neck', at: [0.0, 0.02, 0.08], from: 0, to: 0.3 },
    { who: 'A', hand: 'R', on: 'armL', at: [0.0, -0.14, -0.045], from: 0, to: 0.25 },
  ],
});

// Both shoot at once: heads meet, both bounce off.
registerMove({
  id: 'clash',
  A: [
    { t: 0, pose: { base: stanceAt(A_START, 1) } },
    { t: 0.3, land: true, pose: { hips: [0, 0.6, -0.36], rot: [0, 30, 0], spine: [26, 0, 0], head: [-10, 0, 0] } },
    { t: 1, pose: { base: stanceAt({ x: 0, z: -0.6, yaw: 0 }, 1) } },
  ],
  B: [
    { t: 0, pose: { base: stanceAt(B_START, 1) } },
    { t: 0.3, land: true, pose: { hips: [0, 0.6, 0.36], rot: [180, 30, 0], spine: [26, 0, 0], head: [-10, 0, 0] } },
    { t: 1, pose: { base: stanceAt({ x: 0, z: 0.6, yaw: 180 }, 1) } },
  ],
});

// Blocked short (Cary Kolat, "Reshot Drill"): he shoots from too far or without a setup, the defender
// down-blocks his head and shoulders with both hands, hips back; the shooter stops short on his knee and
// hands, then both come back up to their stances, the shooter a beat late.
registerMove({
  id: 'shotBlocked',
  A: [
    { t: 0, pose: { base: stanceAt(A_START, 1) } },
    { t: 0.3, pose: { hips: [0, 0.52, -0.14], rot: [0, 40, 0], spine: [16, 0, 0], head: [-28, 0, 0],
      footL: [0.17, BALL, 0.1, 0, 30], footR: [-0.17, BALL, -0.5, 0, 60], handL: [0.18, 0.5, 0.34], handR: [-0.18, 0.5, 0.34] } },
    { t: 0.5, land: true, pose: { hips: [0, 0.44, -0.22], rot: [0, 52, 0], spine: [18, 0, 0], head: [-38, 0, 0],
      footL: [0.18, BALL, 0.02, 0, 30], footR: [-0.17, BALL, -0.62, 0, 80], kneeR: [-0.2, -0.3, 0.3],
      handL: [0.22, POST, 0.2], handR: [-0.22, POST, 0.2], wristL: PALM_DOWN, wristR: PALM_DOWN } },
    { t: 1, pose: { base: stanceAt({ x: 0, z: -0.52, yaw: 0 }, 1) } },
  ],
  B: [
    { t: 0, pose: { base: stanceAt(B_START, 1) } },
    { t: 0.3, pose: { hips: [0, 0.66, 0.66], rot: [180, 34, 0], spine: [12, 0, 0], head: [-40, 0, 0],
      footL: [-0.18, BALL, 0.86, 180, 35], footR: [0.18, BALL, 0.84, 180, 35] } },
    { t: 0.55, pose: { hips: [0, 0.62, 0.72], rot: [180, 40, 0], spine: [14, 0, 0], head: [-38, 0, 0] } },
    { t: 1, pose: { base: stanceAt({ x: 0, z: 0.62, yaw: 180 }, 1) } },
  ],
  contacts: [
    { who: 'B', hand: 'L', on: 'head', at: [0.06, 0.06, 0.02], from: 0.2, to: 0.62, fade: 0.1 },
    { who: 'B', hand: 'R', on: 'head', at: [-0.06, 0.06, 0.02], from: 0.2, to: 0.62, fade: 0.1 },
  ],
});

/* ------------------------------------------------------------------ mat */

const AT0 = { x: 0, z: 0, yaw: 0 };

// Chop: a hard strike at the near elbow while the near knee slides into his near
// knee, taking both supports on that side at once. The arm buckles in under him,
// the near shoulder drops first, and the hips drive him flat.
registerMove({
  id: 'breakdown',
  A: [
    { t: 0, pose: { base: holdAt('ride', 'A', 1) } },
    { t: 0.12, pose: { spine: [14, -8, 0], shrugL: [6, 0] } },
    // Knee in: the near foot and hips slide forward, the bend aimed at his knee.
    { t: 0.28, pose: { hips: [0.25, 0.49, -0.07], rot: [-20, 46, 0], footR: [0.2, BALL, -0.46, -25, 75], kneeR: [0.24, -0.3, 0.6] } },
    { t: 0.46, pose: { hips: [0.2, 0.47, 0.02], rot: [-15, 62, 0], spine: [22, -10, 0], footR: [0.16, BALL, -0.4, -25, 70], kneeR: [0.2, -0.3, 0.6] } },
    { t: 1, pose: { base: holdAt('flat', 'A', 0, { x: 0, z: 0.05, yaw: 0 }) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('ride', 'B', 1) } },
    { t: 0.16, pose: { hips: [0, 0.5, 0.0], rot: [0, 80, 0] } },
    // Both near supports go: the arm buckles and the knee is knocked in.
    { t: 0.28, pose: { hips: [0.015, 0.46, 0.01], rot: [0, 84, -10], handL: [0.25, 0.1, 0.34], elbowL: [0.5, 0.22, 0.14], footL: [0.11, BALL, -0.54, 0, 80], kneeL: [0.12, -0.3, 0.3] } },
    { t: 0.46, pose: { hips: [0.01, 0.3, 0.02], rot: [0, 88, -18], handL: [0.3, 0.14, 0.24], elbowL: [0.6, 0.06, 0.12], footL: [0.1, 0.04, -0.82, 0, 125], kneeL: [0.12, -0.5, -0.1] } },
    { t: 0.72, land: true, pose: { hips: [0, 0.15, 0.05], rot: [0, 90, -4], spine: [-6, 0, 0], handL: [0.32, 0.05, 0.4], elbowL: [0.6, 0, 0.3], handR: [-0.2, 0.06, 0.62], elbowR: [-0.5, -0.2, 0.45] } },
    { t: 1, pose: { base: holdAt('flat', 'B', 0, { x: 0, z: 0.05, yaw: 0 }) } },
  ],
  contacts: [
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0, to: 0.6 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.02, 0.0], from: 0.17, to: 1, fade: 0.1,
      atPath: [{ t: 0.17, at: [0, -0.02, 0.0] }, { t: 0.5, at: [0, -0.06, 0.0] }, { t: 0.9, at: [0, -0.2, 0.0] }] },
    { who: 'A', hand: 'R', on: 'hips', at: [-0.13, 0.02, 0.0], from: 0.75, to: 1 },
  ],
});

// Far tricep: the arm over his back reaches across for the far tricep, then the hips
// drive forward through him. The far arm is pulled in and he goes down flat.
registerMove({
  id: 'breakdownDrive',
  A: [
    { t: 0, pose: { base: holdAt('ride', 'A', 1) } },
    { t: 0.16, pose: { rot: [-20, 42, 0], spine: [32, -16, 6], handR: [-0.2, 0.74, 0.42], elbowR: [0.02, 0.9, 0.12] } },
    { t: 0.42, pose: { hips: [0.14, 0.47, 0.08], rot: [-10, 60, 0], spine: [24, -8, 0], footL: [0.42, BALL, -0.44, -15, 75], footR: [0.12, BALL, -0.42, -20, 75] } },
    { t: 1, pose: { base: holdAt('flat', 'A', 0, { x: 0, z: 0.05, yaw: 0 }) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('ride', 'B', 1) } },
    { t: 0.2, pose: { hips: [0, 0.5, 0.01], rot: [0, 80, 0] } },
    { t: 0.32, pose: { hips: [-0.015, 0.45, 0.04], rot: [0, 84, 8], handR: [-0.25, 0.1, 0.36], elbowR: [-0.5, 0.22, 0.14] } },
    { t: 0.48, pose: { hips: [-0.01, 0.3, 0.1], rot: [0, 88, 12], handR: [-0.3, 0.14, 0.26], elbowR: [-0.6, 0.06, 0.12], footR: [-0.1, 0.04, -0.82, 0, 125], kneeR: [-0.12, -0.5, -0.1], footL: [0.1, 0.04, -0.82, 0, 125], kneeL: [0.12, -0.5, -0.1] } },
    { t: 0.72, land: true, pose: { hips: [0, 0.15, 0.07], rot: [0, 90, 4], spine: [-6, 0, 0], handR: [-0.32, 0.05, 0.42], elbowR: [-0.6, 0, 0.3], handL: [0.2, 0.06, 0.62], elbowL: [0.5, -0.2, 0.45] } },
    { t: 1, pose: { base: holdAt('flat', 'B', 0, { x: 0, z: 0.05, yaw: 0 }) } },
  ],
  contacts: [
    // Both hands leave the ride grips from where they are, not from the clip's rest pose.
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0, to: 0.2, fade: 0.1 },
    { who: 'A', hand: 'R', on: 'armR', at: [0, -0.2, -0.03], from: 0.24, to: 0.66, fade: 0.14 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0, to: 0.12, fade: 0.06 },
    { who: 'A', hand: 'L', on: 'spine', at: [0.1, 0.0, 0.08], from: 0.14, to: 0.6, fade: 0.12 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.2, 0.0], from: 0.74, to: 1, fade: 0.1 },
    { who: 'A', hand: 'R', on: 'hips', at: [-0.13, 0.02, 0.0], from: 0.8, to: 1, fade: 0.08 },
  ],
});

// He pushes back up to his hands and knees.
registerMove({
  id: 'rebase',
  A: [
    { t: 0, pose: { base: holdAt('flat', 'A', 1) } },
    { t: 1, pose: { base: holdAt('ride', 'A', 0.4, { x: 0, z: -0.05, yaw: 0 }) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('flat', 'B', 1) } },
    { t: 0.5, pose: { hips: [0, 0.36, 0.0], rot: [0, 76, 0], spine: [-4, 0, 0] } },
    { t: 1, pose: { base: holdAt('ride', 'B', 0.3, { x: 0, z: -0.05, yaw: 0 }) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.2, 0.0], from: 0, to: 0.3 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.6, to: 1 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.7, to: 1 },
  ],
});

// Half nelson: arm under the near arm to the back of the neck, walk the hips
// toward the head and lever him over onto his back. Coaching references: get
// perpendicular and drive at an angle toward the head, squared to the near
// shoulder; it is a grind, so he gives ground a little at a time (his near
// shoulder lifts, then the hips turn) before he goes over.
registerMove({
  id: 'halfNelson',
  A: [
    { t: 0, pose: { base: holdAt('flat', 'A', 0) } },
    { t: 0.3, pose: { hips: [0.2, 0.38, 0.02], rot: [-30, 72, 0], spine: [12, -10, 0] } },
    { t: 0.55, pose: { hips: [0.32, 0.37, 0.12], rot: [-55, 73, 0], spine: [10, -6, 0] } },
    { t: 0.76, pose: { hips: [0.4, 0.34, 0.2], rot: [-75, 74, 0], spine: [8, 0, 0] } },
    { t: 1, pose: { base: holdAt('exposed', 'A', 0) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('flat', 'B', 0) } },
    { t: 0.3, pose: { rot: [0, 90, 0, 15], head: [-16, -14, 0], handL: [0.3, 0.3, 0.5] } },
    { t: 0.55, pose: { rot: [0, 90, 0, 50], head: [-20, -20, 0], handL: [0.3, 0.3, 0.5] } },
    { t: 0.8, land: true, pose: { hips: [0, 0.15, 0.0], rot: [0, 90, 0, 120] } },
    { t: 1, pose: { base: holdAt('exposed', 'B', 0) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'neck', at: [0, 0.04, -0.07], from: 0.2, to: 1 },
    { who: 'A', hand: 'R', on: 'hips', at: [-0.13, 0.02, 0.0], from: 0, to: 0.5 },
    { who: 'A', hand: 'R', on: 'thighR', at: [0, -0.2, 0.05], from: 0.75, to: 1 },
  ],
});

// Sit-out: he plants the outside leg and inside hand and throws the inside leg straight through,
// then sits back hard into the rider's hips, abs tight, elbows in and hands at his stomach.
const SIT_THROUGH_B: PoseSpec = { hips: [0.02, 0.36, -0.04], rot: [0, 42, -8], spine: [10, 0, 0], head: [-14, 0, 0],
  footL: [0.1, 0.1, 0.34, 0, 30], footR: [-0.22, BALL, -0.24, 0, 10], kneeL: [0.2, 0.4, 0.4], kneeR: [-0.3, 0.6, 0],
  handL: [0.22, POST, 0.22], handR: [-0.12, 0.5, 0.22], elbowL: [0.34, 0.3, 0.1], elbowR: [-0.24, 0.42, 0.04] };
// Sat through, he drives his back into the rider (back pressure) with the head up before he turns in.
const SIT_B: PoseSpec = { hips: [0, 0.13, -0.08], rot: [0, -4, 0], spine: [-10, 0, 0], head: [-20, 0, 0],
  footL: [0.22, 0.05, 0.62, 0, 20], footR: [-0.22, 0.05, 0.62, 0, 20], kneeL: [0.3, 0.5, 0.4], kneeR: [-0.3, 0.5, 0.4],
  handL: [0.1, 0.42, 0.22], handR: [-0.1, 0.42, 0.22], elbowL: [0.24, 0.42, 0.0], elbowR: [-0.24, 0.42, 0.0] };
// The rider stays chest to his back, then goes under the near arm to the neck and pulls him over.
const SIT_A: PoseSpec = { hips: [0.14, 0.46, -0.36], rot: [-20, 40, 0], spine: [28, -4, 0], elbowL: [0.24, 0.28, -0.24] };
const SIT_PULL_B: PoseSpec = { ...SIT_B, hips: [0, 0.13, -0.1], rot: [0, -14, 0], spine: [-16, 0, 0], head: [10, 0, 0] };
const SIT_PULL_A: PoseSpec = { hips: [0.14, 0.42, -0.42], rot: [-20, 28, 0], spine: [20, -4, 0], elbowL: [0.22, 0.26, -0.3] };
registerMove({
  id: 'sitOutPull',
  A: [
    { t: 0, pose: { base: holdAt('ride', 'A', 0.3) } },
    { t: 0.3, pose: SIT_A },
    { t: 0.55, pose: SIT_PULL_A },
    { t: 1, pose: { base: holdAt('ride', 'A', 0.45) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('ride', 'B', 0.3) } },
    { t: 0.16, pose: SIT_THROUGH_B },
    { t: 0.32, pose: SIT_B },
    { t: 0.55, pose: SIT_PULL_B },
    { t: 0.74, pose: SIT_B },
    { t: 1, pose: { base: holdAt('ride', 'B', 0.45) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0, to: 0.12, fade: 0.1 },
    // Never let go (reference xWfANYUZUqA, 1:30 to 1:41): the hand slides from his wrist up the
    // back of the arm to the armpit, then on to the neck, each grip fading into the next.
    { who: 'A', hand: 'L', on: 'armL', at: [0, -0.22, -0.045], from: 0.12, to: 0.38, fade: 0.1,
      atPath: [{ t: 0.12, at: [0, -0.22, -0.045] }, { t: 0.38, at: [0, -0.05, -0.05] }] },
    { who: 'A', hand: 'L', on: 'neck', at: [0, 0.04, -0.07], from: 0.42, to: 0.62, fade: 0.12 },
    // And back down the arm to the wrist as he settles back into the ride.
    { who: 'A', hand: 'L', on: 'armL', at: [0, -0.05, -0.05], from: 0.68, to: 0.82, fade: 0.1,
      atPath: [{ t: 0.68, at: [0, -0.05, -0.05] }, { t: 0.82, at: [0, -0.22, -0.045] }] },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.9, to: 1, fade: 0.1 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0, to: 1 },
  ],
});
registerMove({
  id: 'sitOutEscape',
  A: [
    { t: 0, pose: { base: holdAt('ride', 'A', 0.3) } },
    { t: 0.32, pose: SIT_A },
    { t: 1, pose: { base: stanceAt({ x: 0.05, z: -0.42, yaw: 0 }, 1) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('ride', 'B', 0.3) } },
    { t: 0.16, pose: SIT_THROUGH_B },
    { t: 0.36, pose: SIT_B },
    { t: 0.64, pose: { hips: [0.06, 0.34, 0.2], rot: [110, 40, 0], spine: [12, 6, 0], handL: [0.2, POST, 0.1], handR: [-0.1, POST, 0.5] } },
    { t: 1, pose: { base: stanceAt({ x: 0, z: 0.62, yaw: 180 }, 1) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0, to: 0.14, fade: 0.08 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0, to: 0.36, fade: 0.14 },
  ],
});
registerMove({
  id: 'sitOutTurn',
  A: [
    { t: 0, pose: { base: holdAt('ride', 'A', 0.3) } },
    { t: 0.28, pose: SIT_A },
    { t: 0.5, pose: SIT_PULL_A },
    { t: 1, pose: { base: holdAt('exposed', 'A', 0) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('ride', 'B', 0.3) } },
    { t: 0.14, pose: SIT_THROUGH_B },
    { t: 0.3, pose: SIT_B },
    { t: 0.5, pose: SIT_PULL_B },
    { t: 0.76, land: true, pose: { hips: [0, 0.15, 0.0], rot: [0, 90, 0, 120] } },
    { t: 1, pose: { base: holdAt('exposed', 'B', 0) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0, to: 0.12, fade: 0.1 },
    // Never let go (reference xWfANYUZUqA, 1:30 to 1:41): the hand slides from his wrist up the
    // back of the arm to the armpit, then on to the neck, each grip fading into the next.
    { who: 'A', hand: 'L', on: 'armL', at: [0, -0.22, -0.045], from: 0.12, to: 0.38, fade: 0.1,
      atPath: [{ t: 0.12, at: [0, -0.22, -0.045] }, { t: 0.38, at: [0, -0.05, -0.05] }] },
    { who: 'A', hand: 'L', on: 'neck', at: [0, 0.04, -0.07], from: 0.42, to: 1, fade: 0.12 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0, to: 0.62 },
    { who: 'A', hand: 'R', on: 'thighR', at: [0, -0.2, 0.05], from: 0.76, to: 1, fade: 0.1 },
    { who: 'B', hand: 'R', on: 'chest', at: [-0.08, 0.12, 0.12], from: 0.88, to: 1, fade: 0.1 },
  ],
});

// Tilt from the ride: trap the near arm, drive across and rock him over.
registerMove({
  id: 'tilt',
  A: [
    { t: 0, pose: { base: holdAt('ride', 'A', 1) } },
    { t: 0.4, pose: { hips: [0.3, 0.4, 0.05], rot: [-40, 60, 0], spine: [16, -10, 0] } },
    { t: 1, pose: { base: holdAt('exposed', 'A', 0) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('ride', 'B', 1) } },
    { t: 0.45, pose: { hips: [0, 0.32, 0.0], rot: [0, 86, 0, 45] } },
    { t: 0.72, land: true, pose: { hips: [0, 0.16, 0.0], rot: [0, 90, 0, 120] } },
    { t: 1, pose: { base: holdAt('exposed', 'B', 0) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0, to: 0.35 },
    { who: 'A', hand: 'L', on: 'neck', at: [0, 0.04, -0.07], from: 0.55, to: 1 },
    { who: 'A', hand: 'R', on: 'thighR', at: [0, -0.2, 0.05], from: 0.4, to: 1 },
  ],
});

// He bridges and turns back to his belly.
registerMove({
  id: 'fightOff',
  A: [
    { t: 0, pose: { base: holdAt('exposed', 'A', 0) } },
    { t: 0.5, pose: { hips: [0.32, 0.4, 0.1], rot: [-50, 70, 0] } },
    { t: 1, pose: { base: holdAt('flat', 'A', 0.3, AT0) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('exposed', 'B', 0) } },
    { t: 0.4, pose: { hips: [0, 0.26, 0.0], rot: [0, 90, 0, 150], spine: [-25, 0, 0] } },
    { t: 1, pose: { base: holdAt('flat', 'B', 0.5, AT0) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'neck', at: [0, 0.04, -0.07], from: 0, to: 0.3 },
    { who: 'A', hand: 'R', on: 'hips', at: [-0.13, 0.02, 0.0], from: 0.7, to: 1 },
  ],
});

// Shoulders flat. He holds it while the official slaps the mat.
registerMove({
  id: 'fall',
  A: [
    { t: 0, pose: { base: holdAt('exposed', 'A', 1) } },
    { t: 0.3, land: true, pose: { hips: [0.38, 0.26, 0.24], spine: [2, 0, 0] } },
    { t: 1, stop: true, pose: { hips: [0.38, 0.26, 0.24] } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('exposed', 'B', 1) } },
    { t: 0.3, land: true, pose: { rot: [0, 90, 0, 178], hips: [0, 0.12, 0] } },
    { t: 1, stop: true, pose: { rot: [0, 90, 0, 178] } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'neck', at: [0, 0.04, -0.07], from: 0, to: 1 },
    { who: 'A', hand: 'R', on: 'thighR', at: [0, -0.2, 0.05], from: 0, to: 1 },
  ],
});

// Stand-up, inside leg: he sits back with his chest rising and takes the hand at his waist with
// his inside hand, the other still posted. The inside foot plants, then both hands take the grip,
// chest upright and back pressure into the rider, who stays on his knees. Then both feet, wide and low, and up with the rider behind him.
registerMove({
  id: 'standUp',
  A: [
    { t: 0, pose: { base: holdAt('ride', 'A', 0) } },
    { t: 0.36, pose: { hips: [0.2, 0.5, -0.3], rot: [-22, 28, 0], spine: [20, -4, 0] } },
    { t: 0.62, pose: { hips: [0.14, 0.64, -0.34], rot: [-10, 28, 0], spine: [16, -4, 0], footL: [0.42, BALL, -0.5, -15, 60], footR: [0.02, BALL, -0.62, -20, 60] } },
    { t: 1, pose: { base: holdAt('standing', 'A', 0, { x: 0, z: 0.06, yaw: 0 }) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('ride', 'B', 0) } },
    { t: 0.2, pose: { hips: [0, 0.4, -0.08], rot: [0, 36, 0], spine: [4, 0, 0], head: [-10, 0, 0], handL: [0.1, 0.5, 0.2],
      handR: [-0.22, POST, 0.3], footL: [0.22, 0.12, -0.04, 10, 35] } },
    { t: 0.32, pose: { hips: [0, 0.44, -0.05], rot: [0, 22, 0], spine: [2, 0, 0], head: [-8, 0, 0], handL: [0.1, 0.5, 0.2],
      handR: [-0.22, POST, 0.3], footL: [0.2, BALL, 0.26, 10, 4], kneeL: [0.24, 0.6, 0.5], kneeR: [-0.16, -0.3, 0.2] } },
    { t: 0.44, pose: { hips: [0, 0.48, -0.03], rot: [0, 10, 0], spine: [0, 0, 0], head: [-6, 0, 0], handR: [-0.08, 0.5, 0.2],
      footL: [0.2, BALL, 0.26, 10, 4], kneeL: [0.24, 0.6, 0.5], kneeR: [-0.16, -0.3, 0.2] } },
    { t: 0.62, pose: { hips: [0, 0.62, 0.0], rot: [0, 10, 0], spine: [0, 0, 0], head: [-4, 0, 0],
      footL: [0.24, BALL, 0.26, 10, 4], footR: [-0.24, BALL, -0.08, -10, 8], kneeL: [0.3, 0.6, 0.6], kneeR: [-0.3, 0.6, 0.5] } },
    { t: 1, pose: { base: holdAt('standing', 'B', 0, { x: 0, z: 0.06, yaw: 0 }) } },
  ],
  contacts: [
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0, to: 1 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0, to: 0.16, fade: 0.08 },
    { who: 'A', hand: 'L', on: 'spine', at: [0.04, 0.0, 0.13], from: 0.46, to: 1, fade: 0.2 },
    { who: 'B', hand: 'L', on: 'handR', at: [0, -0.02, 0.02], from: 0.14, to: 1, fade: 0.1 },
    { who: 'B', hand: 'R', on: 'handR', at: [0.02, -0.04, 0.02], from: 0.38, to: 0.7, fade: 0.1 },
    { who: 'B', hand: 'R', on: 'handR', at: [0, -0.02, 0.02], from: 0.84, to: 1, fade: 0.12 },
  ],
});

// He peels the hands and turns to face: an escape.
registerMove({
  id: 'escapeTurn',
  A: [
    { t: 0, pose: { base: holdAt('standing', 'A', 1) } },
    { t: 1, pose: { base: stanceAt({ x: 0.05, z: -0.42, yaw: 0 }, 1) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('standing', 'B', 1) } },
    { t: 0.45, pose: { hips: [0.1, 0.85, 0.3], rot: [100, 14, 0], spine: [10, 10, 0] } },
    { t: 1, pose: { base: stanceAt({ x: 0, z: 0.62, yaw: 180 }, 1) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'spine', at: [0.04, 0.0, 0.13], from: 0, to: 0.2 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.0, 0.13], from: 0, to: 0.15 },
  ],
});

// Lift and return him to the mat, sweeping his leg out.
registerMove({
  id: 'returnMat',
  A: [
    { t: 0, pose: { base: holdAt('standing', 'A', 0) } },
    { t: 0.4, pose: { hips: [0.0, 0.78, -0.3], rot: [0, 10, 0], spine: [4, 0, 0] } },
    { t: 0.72, land: true, pose: { hips: [0.15, 0.5, -0.2], rot: [-10, 50, 0], spine: [24, -10, 0], handL: [.24, .3, .42], elbowL: [.48, .45, .2] } },
    { t: 1, pose: { base: holdAt('ride', 'A', 0.2, { x: 0, z: 0.05, yaw: 0 }) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('standing', 'B', 0), palms: [1, 1] } },
    {
      t: 0.4,
      pose: {
        hips: [0, 1.02, 0.05],
        rot: [0, 10, 0],
        footL: [0.18, 0.25, 0.1, 10, 40],
        footR: [-0.18, 0.2, 0.0, -10, 40],
      },
    },
    { t: 0.62, pose: { hips: [0, 0.58, 0.03], rot: [0, 62, 0], spine: [6, 0, 0], handL: [0.22, POST, 0.4], handR: [-0.22, POST, 0.42] } },
    { t: 0.72, land: true, pose: { hips: [0, 0.48, 0.02], rot: [0, 70, 0], handL: [0.22, POST, 0.4], handR: [-0.22, POST, 0.42], palms: [1, 1] } },
    { t: 1, pose: { base: holdAt('ride', 'B', 0.4, { x: 0, z: 0.05, yaw: 0 }) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'spine', at: [0.04, 0.0, 0.13], from: 0, to: 0.60, fade: 0.08 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0, to: 1 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.94, to: 1, fade: 0.23 },
  ],
});

// Switch: reach back over his arm, sit the hips out and come up on top.
const SWITCH_END = { x: 0.28, z: -0.12, yaw: 0 };
registerMove({
  id: 'switch',
  A: [
    { t: 0, pose: { base: holdAt('ride', 'A', 1) } },
    // His near arm is trapped and his weight goes with the drive: he tips to his hip.
    {
      t: 0.42,
      pose: {
        hips: [0.3, 0.38, -0.06],
        rot: [-15, 72, 0, -25],
        spine: [16, 0, -8],
        footL: [0.55, BALL, -0.55, -15, 70],
        footR: [0.25, 0.1, -0.6, -20, 60],
      },
    },
    {
      t: 0.72,
      land: true,
      pose: {
        hips: [0.3, 0.44, -0.1],
        rot: [-5, 80, 0, 0],
        spine: [10, 0, 0],
      },
    },
    { t: 1, pose: { base: holdAt('ride', 'B', 0.3, SWITCH_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('ride', 'B', 0) } },
    // Sit out to the far side, hips low, reaching back over his arm. His foot comes from behind him to out in front
    // (about 1.5 m): given a little longer than a third of the clip so the shins do not snap (bigger bottom man).
    {
      t: 0.36,
      pose: {
        hips: [-0.2, 0.2, -0.02],
        rot: [-55, 30, 0],
        spine: [6, 18, 0],
        head: [-20, 30, 0],
        footL: [0.02, BALL, 0.5, -50, 0],
        footR: [-0.42, BALL, 0.28, -75, 0],
        kneeL: [0.1, 1.0, 0.8],
        kneeR: [-0.5, 1.0, 0.6],
        handR: [-0.48, POST, 0.18],
        wristR: PALM_DOWN,
      },
    },
    // Lift the sit-out post and replant it beneath the circling shoulder.
    { t: 0.5, pose: { handR: [-0.25, 0.24, -0.08], elbowR: [-0.4, 0.38, -0.24] } },
    // Hips swing out and round behind him.
    {
      t: 0.62,
      pose: {
        hips: [0.2, 0.3, -0.42],
        rot: [-40, 55, 0],
        spine: [16, 10, 0],
        head: [-10, 10, 0],
        footL: [0.0, BALL, -0.45, -20, 60],
        footR: [-0.25, BALL, -0.65, -30, 60],
        kneeL: [0.0, -0.4, 0.0],
        kneeR: [-0.3, -0.4, -0.2],
        handR: [-0.12, POST, -0.24], elbowR: [-0.32, 0.3, -0.4],
      },
    },
    { t: 1, pose: { base: holdAt('ride', 'A', 0.2, SWITCH_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0, to: 0.22 },
    { who: 'B', hand: 'L', on: 'thighR', at: [0.03, -0.15, 0.06], from: 0.22, to: 0.66 },
    { who: 'B', hand: 'R', on: 'spine', at: [-0.04, 0.03, 0.12], from: 0.8, to: 1 },
    { who: 'B', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.88, to: 1 },
  ],
});

void GRIP;
