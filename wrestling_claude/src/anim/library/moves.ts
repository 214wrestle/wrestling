import { registerMove } from '../clips';
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
        hips: [0.02, 0.56, -0.1],
        rot: [-4, 24, 0],
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
    { who: 'A', hand: 'L', on: 'thighR', at: [-0.02, -0.34, -0.07], from: 0.82, to: 1 },
    { who: 'A', hand: 'R', on: 'thighL', at: [0.02, -0.34, -0.07], from: 0.82, to: 1 },
    // Build the defensive frame during penetration, then retain the hold anchors.
    { who: 'B', hand: 'L', on: 'chest', at: [-0.1, 0.18, -0.12], from: 0.55, to: 1 },
    { who: 'B', hand: 'R', on: 'chest', at: [0.1, 0.18, -0.12], from: 0.65, to: 1 },
  ],
});

registerMove({
  id: 'shotSingle',
  startDist: 1.0,
  warpBy: 0.62,
  A: [
    { t: 0, pose: { base: stanceAt(A_START, 1) } },
    {
      t: 0.3,
      pose: {
        hips: [0.04, 0.6, -0.42],
        rot: [-8, 10, 0],
        spine: [14, -6, 0],
        head: [-38, 0, 0],
        handL: [0.24, 0.66, -0.1],
        handR: [-0.12, 0.66, -0.1],
      },
    },
    {
      t: 0.64,
      pose: {
        hips: [0.08, 0.55, -0.1],
        rot: [-12, 22, 0],
        spine: [12, -8, 0],
        footL: [0.2, 0.07, -0.12, 0, 35],
        footR: [-0.16, BALL, -0.58, -25, 50],
        handL: [0.24, 0.5, 0.36],
        handR: [0.04, 0.52, 0.36],
      },
    },
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
    { who: 'B', hand: 'L', on: 'head', at: [0, 0.1, -0.04], from: 0.55, to: 1 },
    { who: 'B', hand: 'R', on: 'chest', at: [0.1, 0.16, -0.12], from: 0.65, to: 1 },
  ],
});

/* ---------------------------------------------------------------- finishes */

// Drive through, he goes over backwards onto his hip, turns to his belly to
// keep his back off the mat, and A comes round on top.
const DOUBLE_END = { x: -0.35, z: 0.95, yaw: 90 };
registerMove({
  id: 'finishDouble',
  A: [
    { t: 0, pose: { base: holdAt('legsDouble', 'A', 1) } },
    {
      t: 0.34,
      pose: {
        hips: [0, 0.64, 0.46],
        rot: [0, 40, 0],
        spine: [22, 0, 0],
        footL: [0.2, BALL, 0.34, 0, 30],
        footR: [-0.2, BALL, -0.02, -10, 40],
      },
    },
    {
      t: 0.6,
      land: true,
      pose: {
        hips: [-0.04, 0.5, 0.74],
        rot: [10, 70, 0],
        spine: [14, 0, 0],
        footL: [0.16, BALL, 0.24, 0, 70],
        footR: [-0.26, BALL, 0.28, 0, 70],
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
      },
    },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, DOUBLE_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('legsDouble', 'B', 1) } },
    {
      t: 0.3,
      pose: {
        hips: [0, 0.78, 0.92],
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
      t: 0.56,
      land: true,
      pose: {
        hips: [0, 0.16, 1.06],
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
    { who: 'A', hand: 'L', on: 'thighR', at: [-0.02, -0.34, -0.07], from: 0, to: 0.5 },
    { who: 'A', hand: 'R', on: 'thighL', at: [0.02, -0.34, -0.07], from: 0, to: 0.5 },
    { who: 'A', hand: 'R', on: 'spine', at: [0, 0.02, 0.11], from: 0.85, to: 1 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.9, to: 1 },
  ],
});

// The crowd-pleaser: step up under him, stand tall with both legs wrapped so his
// feet leave the mat, turn the corner and bring him back down safely to his hip,
// then come round on top as he turns to his base. Same landing as the drive-through.
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
      t: 0.54,
      pose: {
        hips: [0.02, 0.88, 0.56],
        rot: [35, 8, 0],
        spine: [-4, 0, 0],
        footL: [0.24, BALL, 0.66, 35, 0],
        footR: [-0.14, BALL, 0.36, 25, 10],
      },
    },
    {
      t: 0.64,
      pose: {
        hips: [-0.04, 0.72, 0.64],
        rot: [55, 26, 0],
        spine: [10, 0, 0],
        footL: [0.22, BALL, 0.68, 45, 20],
        footR: [-0.2, BALL, 0.36, 40, 30],
      },
    },
    {
      t: 0.72,
      land: true,
      pose: {
        hips: [-0.08, 0.52, 0.72],
        rot: [70, 40, 0],
        spine: [16, 0, 0],
        footL: [0.16, BALL, 0.5, 60, 60],
        footR: [-0.24, BALL, 0.3, 60, 60],
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
      t: 0.38,
      pose: {
        hips: [-0.04, 1.26, 0.7],
        rot: [180, 22, 0],
        spine: [26, 0, 0],
        head: [20, 0, 0],
        footL: [0.06, 0.5, 0.82, 180, -20],
        footR: [-0.18, 0.44, 0.86, 180, -20],
        handL: [-0.14, 1.36, 0.38],
        handR: [0.1, 1.38, 0.38],
        elbowL: [-0.6, 1.8, 0.5],
        elbowR: [0.6, 1.8, 0.5],
      },
    },
    {
      t: 0.54,
      pose: {
        hips: [0.04, 1.12, 0.84],
        rot: [205, 10, -20],
        spine: [16, 0, 0],
        footL: [0.3, 0.6, 1.0, 200, 0],
        footR: [0.12, 0.5, 1.05, 200, 0],
        handL: [-0.1, 1.3, 0.46],
        handR: [0.16, 1.34, 0.5],
      },
    },
    {
      t: 0.64,
      pose: {
        hips: [0.0, 0.72, 0.98],
        rot: [190, -40, -10],
        spine: [0, 0, 0],
        head: [30, 0, 0],
        footL: [0.25, 0.78, 0.74, 190, 0],
        footR: [0.05, 0.72, 0.68, 190, 0],
        handL: [-0.45, 0.5, 1.2],
        handR: [0.3, 0.5, 1.25],
        elbowL: [-0.8, 0.9, 1.0],
        elbowR: [0.8, 0.9, 1.0],
      },
    },
    {
      t: 0.72,
      land: true,
      pose: {
        hips: [-0.05, 0.17, 1.04],
        rot: [180, -66, 0, 40],
        spine: [-4, 0, 0],
        head: [32, 0, 0],
        footL: [0.25, 0.3, 0.7, 180, 20],
        footR: [0.0, 0.34, 0.66, 180, 20],
        handL: [-0.4, POST, 1.3],
        handR: [0.36, POST, 1.32],
      },
    },
    {
      t: 0.86,
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
    { who: 'A', hand: 'L', on: 'thighR', at: [-0.02, -0.2, -0.08], from: 0, to: 0.7 },
    { who: 'A', hand: 'R', on: 'thighL', at: [0.02, -0.2, -0.08], from: 0, to: 0.7 },
    { who: 'B', hand: 'L', on: 'chest', at: [-0.12, 0.12, -0.13], from: 0, to: 0.58 },
    { who: 'B', hand: 'R', on: 'chest', at: [0.12, 0.12, -0.13], from: 0, to: 0.58 },
    { who: 'A', hand: 'R', on: 'spine', at: [0, 0.02, 0.11], from: 0.88, to: 1 },
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
      },
    },
    {
      t: 0.62,
      land: true,
      pose: {
        hips: [0.32, 0.55, 0.5],
        rot: [-80, 55, 0],
        spine: [20, 0, 0],
        footL: [0.62, BALL, 0.3, -90, 60],
        footR: [0.5, BALL, 0.7, -90, 60],
      },
    },
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
    { who: 'A', hand: 'L', on: 'shinR', at: [0.0, -0.04, -0.05], from: 0, to: 0.6 },
    { who: 'A', hand: 'R', on: 'thighR', at: [0.03, -0.32, 0.07], from: 0, to: 0.55 },
    { who: 'A', hand: 'R', on: 'spine', at: [0, 0.02, 0.11], from: 0.85, to: 1 },
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
        hips: [0, 0.45, 0.72],
        rot: [180, 58, 0],
        spine: [18, 0, 0],
        head: [-20, 0, 0],
        footL: [-0.26, BALL, 1.42, 180, 72],
        footR: [0.24, BALL, 1.4, 180, 72],
        handL: [-0.15, 0.45, 0.15],
        handR: [0.15, 0.45, 0.15],
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
        hips: [0, 0.46, 0.82],
        rot: [180, 60, 0],
        spine: [16, 0, 0],
        footL: [-0.26, BALL, 1.5, 180, 72],
        footR: [0.24, BALL, 1.48, 180, 72],
      },
    },
    { t: 1, pose: { base: holdAt('fhl', 'A', 0, SPRAWL_END) } },
  ],
  contacts: [
    { who: 'B', hand: 'L', on: 'neck', at: [0.0, 0.02, 0.08], from: 0.5, to: 1 },
    { who: 'B', hand: 'R', on: 'armL', at: [0.0, -0.14, -0.045], from: 0.6, to: 1 },
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
    { t: 0, pose: { base: stanceAt({ x: 0, z: 0.42, yaw: 180 }, 1) } },
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

// Spin behind: he circles past the shoulder to the back and drops on top.
const BEHIND_END = { x: 0, z: 0.32, yaw: 180 };
registerMove({
  id: 'goBehind',
  A: [
    { t: 0, pose: { base: holdAt('fhl', 'A', 0) } },
    {
      t: 0.35,
      pose: {
        hips: [-0.5, 0.56, -0.32],
        rot: [55, 40, 0],
        spine: [24, 0, 0],
        footL: [-0.6, BALL, -0.9, 30, 50],
        footR: [-0.95, BALL, -0.5, 60, 50],
      },
    },
    {
      t: 0.7,
      pose: {
        hips: [-0.46, 0.5, 0.36],
        rot: [150, 38, 0],
        spine: [26, 0, 0],
        footL: [-0.5, BALL, 0.86, 150, 70],
        footR: [-0.88, BALL, 0.55, 140, 70],
      },
    },
    { t: 1, pose: { base: holdAt('ride', 'A', 0, BEHIND_END) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('fhl', 'B', 0) } },
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
    { who: 'A', hand: 'L', on: 'neck', at: [0.0, 0.02, 0.08], from: 0, to: 0.25 },
    { who: 'A', hand: 'R', on: 'armL', at: [0.0, -0.14, -0.045], from: 0, to: 0.45 },
    { who: 'A', hand: 'R', on: 'spine', at: [0, 0.02, 0.11], from: 0.72, to: 1 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.85, to: 1 },
  ],
});

// He digs his head out, posts a foot and stands back up to his stance.
registerMove({
  id: 'recover',
  A: [
    { t: 0, pose: { base: holdAt('fhl', 'A', 1) } },
    { t: 0.5, pose: { hips: [0, 0.7, -0.6], rot: [0, 26, 0], spine: [22, 0, 0], footL: [0.2, BALL, -0.75, 0, 30], footR: [-0.2, BALL, -1.05, -20, 40] } },
    { t: 1, pose: { base: stanceAt({ x: 0, z: -0.55, yaw: 0 }, 1) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('fhl', 'B', 1) } },
    {
      t: 0.45,
      pose: {
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

/* ------------------------------------------------------------------ mat */

const AT0 = { x: 0, z: 0, yaw: 0 };

// Chop the near arm and drive: he collapses onto his belly.
registerMove({
  id: 'breakdown',
  A: [
    { t: 0, pose: { base: holdAt('ride', 'A', 1) } },
    { t: 0.4, pose: { hips: [0.22, 0.44, 0.0], rot: [-15, 60, 0], spine: [20, -10, 0] } },
    { t: 1, pose: { base: holdAt('flat', 'A', 0, { x: 0, z: 0.05, yaw: 0 }) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('ride', 'B', 1) } },
    {
      t: 0.42,
      pose: {
        hips: [0, 0.34, 0.02],
        rot: [0, 88, -14],
        handL: [0.32, 0.2, 0.3],
        elbowL: [0.6, 0.0, 0.2],
      },
    },
    { t: 0.72, land: true, pose: { hips: [0, 0.15, 0.05], rot: [0, 90, -4], spine: [-6, 0, 0] } },
    { t: 1, pose: { base: holdAt('flat', 'B', 0, { x: 0, z: 0.05, yaw: 0 }) } },
  ],
  contacts: [
    { who: 'A', hand: 'R', on: 'spine', at: [0, 0.02, 0.11], from: 0, to: 0.6 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.2, 0.0], from: 0.3, to: 1 },
    { who: 'A', hand: 'R', on: 'hips', at: [-0.13, 0.02, 0.0], from: 0.75, to: 1 },
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
    { who: 'A', hand: 'R', on: 'spine', at: [0, 0.02, 0.11], from: 0.6, to: 1 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.7, to: 1 },
  ],
});

// Half nelson: arm under the near arm to the back of the neck, walk the hips
// toward the head and lever him over onto his back.
registerMove({
  id: 'halfNelson',
  A: [
    { t: 0, pose: { base: holdAt('flat', 'A', 0) } },
    { t: 0.35, pose: { hips: [0.24, 0.38, 0.06], rot: [-40, 72, 0], spine: [10, -10, 0] } },
    { t: 0.7, pose: { hips: [0.4, 0.34, 0.2], rot: [-75, 74, 0], spine: [8, 0, 0] } },
    { t: 1, pose: { base: holdAt('exposed', 'A', 0) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('flat', 'B', 0) } },
    { t: 0.4, pose: { rot: [0, 90, 0, 30], head: [-20, -20, 0], handL: [0.3, 0.3, 0.5] } },
    { t: 0.78, land: true, pose: { hips: [0, 0.15, 0.0], rot: [0, 90, 0, 120] } },
    { t: 1, pose: { base: holdAt('exposed', 'B', 0) } },
  ],
  contacts: [
    { who: 'A', hand: 'L', on: 'neck', at: [0, 0.04, -0.07], from: 0.2, to: 1 },
    { who: 'A', hand: 'R', on: 'hips', at: [-0.13, 0.02, 0.0], from: 0, to: 0.5 },
    { who: 'A', hand: 'R', on: 'thighR', at: [0, -0.2, 0.05], from: 0.75, to: 1 },
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

// Stand-up: post the outside foot, hand control, up to his feet; the top man
// comes up behind him and locks his hands.
registerMove({
  id: 'standUp',
  A: [
    { t: 0, pose: { base: holdAt('ride', 'A', 0) } },
    { t: 0.45, pose: { hips: [0.15, 0.62, -0.26], rot: [-10, 30, 0], spine: [24, -6, 0], footL: [0.35, BALL, -0.4, 0, 30] } },
    { t: 1, pose: { base: holdAt('standing', 'A', 0, { x: 0, z: 0.06, yaw: 0 }) } },
  ],
  B: [
    { t: 0, pose: { base: holdAt('ride', 'B', 0) } },
    { t: 0.2, pose: {
      hips: [0, 0.51, -0.01], rot: [0, 72, 0], spine: [8, 0, 0],
      footL: [0.22, 0.12, -0.04, 10, 35],
      handR: [-0.2, POST, 0.5],
    } },
    { t: 0.32, pose: {
      hips: [0, 0.46, 0], rot: [0, 70, 0], spine: [8, 0, 0],
      footL: [0.2, BALL, 0.2, 10, 15], handR: [-0.2, POST, 0.5],
    } },
    {
      t: 0.4,
      pose: {
        hips: [0, 0.58, 0.0],
        rot: [0, 50, 0],
        spine: [10, 0, 0],
        footL: [0.2, BALL, 0.2, 10, 15],
        handL: [0.10, 0.64, 0.18],
        elbowL: [0.22, 0.52, 0.08],
        handR: [-0.18, 0.22, 0.4], palms: [0, 0],
      },
    },
    { t: 0.62, pose: {
      hips: [0, 0.72, 0.02], rot: [0, 30, 0], spine: [8, 0, 0],
      footL: [0.2, BALL, 0.2, 10, 15],
      handR: [-0.12, 0.72, 0.22], palms: [0, 0],
      elbowL: [0.25, 0.68, 0.04], elbowR: [-0.25, 0.66, 0.04],
    } },
    { t: 1, pose: { base: holdAt('standing', 'B', 0, { x: 0, z: 0.06, yaw: 0 }) } },
  ],
  contacts: [
    { who: 'A', hand: 'R', on: 'spine', at: [0, 0.02, 0.11], from: 0, to: 1 },
    { who: 'A', hand: 'L', on: 'spine', at: [0.04, 0.0, 0.13], from: 0.65, to: 1 },
    { who: 'B', hand: 'L', on: 'handR', at: [0, -0.02, 0.02], from: 0.3, to: 0.66 },
    { who: 'B', hand: 'L', on: 'handL', at: [0, -0.02, 0.02], from: 0.74, to: 1 },
    { who: 'B', hand: 'R', on: 'handR', at: [0, -0.02, 0.02], from: 0.72, to: 1 },
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
    { t: 0.72, land: true, pose: { hips: [0.15, 0.5, -0.2], rot: [-10, 50, 0], spine: [24, -10, 0] } },
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
    { who: 'A', hand: 'L', on: 'spine', at: [0.04, 0.0, 0.13], from: 0, to: 0.7 },
    { who: 'A', hand: 'R', on: 'spine', at: [-0.04, 0.0, 0.13], from: 0, to: 0.6 },
    { who: 'A', hand: 'R', on: 'spine', at: [0, 0.02, 0.11], from: 0.75, to: 1 },
    { who: 'A', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.75, to: 1 },
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
    // Sit out to the far side, hips low, reaching back over his arm.
    {
      t: 0.3,
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
    // Hips swing out and round behind him.
    {
      t: 0.62,
      pose: {
        hips: [0.2, 0.3, -0.42],
        rot: [-40, 55, 0],
        spine: [16, 10, 0],
        head: [-10, 10, 0],
        footL: [0.0, BALL, -0.55, -20, 60],
        footR: [-0.25, BALL, -0.75, -30, 60],
        kneeL: [0.0, -0.4, 0.0],
        kneeR: [-0.3, -0.4, -0.2],
      },
    },
    { t: 1, pose: { base: holdAt('ride', 'A', 0.2, SWITCH_END) } },
  ],
  contacts: [
    { who: 'A', hand: 'R', on: 'spine', at: [0, 0.02, 0.11], from: 0, to: 0.22 },
    { who: 'B', hand: 'L', on: 'thighR', at: [0.03, -0.15, 0.06], from: 0.22, to: 0.66 },
    { who: 'B', hand: 'R', on: 'spine', at: [0, 0.02, 0.11], from: 0.8, to: 1 },
    { who: 'B', hand: 'L', on: 'forearmL', at: [0, -0.04, -0.035], from: 0.88, to: 1 },
  ],
});

void GRIP;
