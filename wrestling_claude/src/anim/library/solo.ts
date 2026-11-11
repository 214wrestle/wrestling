import { registerSolo } from '../solo';
import type { PoseSpec } from '../spec';
import { BALL, PALM_DOWN, POST } from './kit';

/**
 * One body, its own frame (facing +Z): the sprawl with nothing under it,
 * celebrations, and the official's work.
 */

const tall: PoseSpec = {
  hips: [0, 0.95, 0],
  rot: [0, 0, 0],
  spine: [-4, 0, 0],
  head: [-8, 0, 0],
  look: 0,
  footL: [0.15, BALL, 0.03, 8, 0],
  footR: [-0.15, BALL, -0.01, -8, 0],
  kneeL: [0.2, 0.5, 0.8],
  kneeR: [-0.2, 0.5, 0.8],
  handL: [0.22, 0.86, 0.0],
  handR: [-0.22, 0.86, 0.0],
  elbowL: [0.4, 1.0, -0.4],
  elbowR: [-0.4, 1.0, -0.4],
  wristL: [0, 0, 0],
  wristR: [0, 0, 0],
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [1, 1],
};

/* ---------------------------------------------------------------- sprawl */

const sprawl: PoseSpec = {
  hips: [0, 0.36, -0.38],
  rot: [0, 72, 0],
  spine: [14, 0, 0],
  head: [-38, 0, 0],
  look: 0.9,
  footL: [0.26, BALL, -1.16, 0, 72],
  footR: [-0.26, BALL, -1.14, 0, 72],
  kneeL: [0.3, -0.6, -0.9],
  kneeR: [-0.3, -0.6, -0.9],
  handL: [0.22, POST, 0.3],
  handR: [-0.22, POST, 0.3],
  elbowL: [0.5, 0.2, 0.0],
  elbowR: [-0.5, 0.2, 0.0],
  wristL: PALM_DOWN,
  wristR: PALM_DOWN,
  shrugL: [0, 0],
  shrugR: [0, 0],
  toes: [1, 1],
};
registerSolo({ id: 'sprawlSolo', keys: [{ t: 0, pose: sprawl }, { t: 1, pose: {} }] });

/* ----------------------------------------------------------- celebration */

registerSolo({
  id: 'celebrate',
  loop: true,
  keys: [
    {
      t: 0,
      pose: {
        ...tall,
        spine: [-10, 0, 0],
        head: [-30, 0, 0],
        handL: [0.34, 1.92, 0.08],
        handR: [-0.34, 1.92, 0.08],
        elbowL: [0.8, 1.6, 0],
        elbowR: [-0.8, 1.6, 0],
      },
    },
    {
      t: 0.5,
      pose: {
        hips: [0, 0.92, 0],
        spine: [-6, 0, 0],
        head: [-15, 0, 0],
        handL: [0.24, 1.58, 0.12],
        handR: [-0.24, 1.58, 0.12],
        elbowL: [0.7, 1.45, -0.1],
        elbowR: [-0.7, 1.45, -0.1],
      },
    },
  ],
});

registerSolo({
  id: 'dejected',
  keys: [
    {
      t: 0,
      pose: {
        ...tall,
        hips: [0, 0.86, -0.06],
        rot: [0, 30, 0],
        spine: [32, 0, 0],
        head: [25, 0, 0],
        footL: [0.18, BALL, 0.04, 10, 0],
        footR: [-0.18, BALL, 0.0, -10, 0],
        handL: [0.15, 0.54, 0.26],
        handR: [-0.15, 0.54, 0.26],
        elbowL: [0.5, 0.8, 0.2],
        elbowR: [-0.5, 0.8, 0.2],
        wristL: PALM_DOWN,
        wristR: PALM_DOWN,
      },
    },
  ],
});

registerSolo({
  id: 'handRaised',
  keys: [
    {
      t: 0,
      pose: {
        ...tall,
        spine: [-6, 0, 0],
        head: [-12, 0, 0],
        handL: [0.32, 1.9, 0.06],
        elbowL: [0.7, 1.5, 0.0],
        handR: [-0.24, 0.84, 0.05],
      },
    },
  ],
});

/* -------------------------------------------------------------- official */

const refWatch: PoseSpec = {
  ...tall,
  hips: [0, 0.86, -0.05],
  rot: [0, 28, 0],
  spine: [26, 0, 0],
  head: [-34, 0, 0],
  look: 1,
  footL: [0.2, BALL, 0.05, 12, 0],
  footR: [-0.2, BALL, -0.02, -12, 0],
  handL: [0.16, 0.58, 0.22],
  handR: [-0.16, 0.58, 0.22],
  elbowL: [0.5, 0.8, 0.2],
  elbowR: [-0.5, 0.8, 0.2],
  wristL: PALM_DOWN,
  wristR: PALM_DOWN,
};
registerSolo({ id: 'refWatch', keys: [{ t: 0, pose: refWatch }] });

registerSolo({
  id: 'refStand',
  keys: [{ t: 0, pose: { ...tall, head: [-5, 0, 0], look: 1, handL: [0.1, 0.92, -0.12], handR: [-0.1, 0.92, -0.12], elbowL: [0.4, 1.0, -0.5], elbowR: [-0.4, 1.0, -0.5] } }],
});

// Down on a knee to see the mat work.
registerSolo({
  id: 'refMat',
  keys: [
    {
      t: 0,
      pose: {
        ...tall,
        hips: [0, 0.5, -0.05],
        rot: [0, 20, 0],
        spine: [24, 0, 0],
        head: [-25, 0, 0],
        look: 1,
        footL: [0.2, BALL, 0.36, 10, 0],
        footR: [-0.16, BALL, -0.42, -5, 75],
        kneeL: [0.3, 0.8, 1.0],
        kneeR: [-0.2, -0.3, 0.4],
        handL: [0.12, 0.56, 0.32],
        handR: [0.04, 0.58, 0.3],
        wristL: PALM_DOWN,
        wristR: PALM_DOWN,
      },
    },
  ],
});

// "Work!": the near arm out toward the wrestler at chest height, palm up, the forearm beckoning him in
// (the stalling cue before a warning, and with the call itself). The side is chosen by mirroring.
registerSolo({
  id: 'refWork',
  loop: true,
  keys: [
    { t: 0, pose: { ...tall, spine: [6, 0, 0], head: [-4, 0, 0], look: 0.8, handL: [0.42, 1.22, 0.42], elbowL: [0.7, 1.1, 0.0], wristL: [-20, 0, -80] } },
    { t: 0.5, pose: { handL: [0.36, 1.32, 0.26], elbowL: [0.7, 1.1, 0.0], wristL: [30, 0, -80] } },
  ],
});

// Signal: one arm straight up (the side is chosen by mirroring).
registerSolo({
  id: 'refPoints',
  keys: [
    { t: 0, pose: { ...tall, head: [-5, 0, 0], look: 0.6, handL: [0.28, 1.98, 0.12], elbowL: [0.8, 1.5, -0.2] } },
  ],
});

// Near-fall count: the arm sweeps down once a second. Down on one knee beside the shoulders with the head low, looking
// across them (2025 NCAA pins, DPS Breakdowns g9xqkEf3Xrc at 25 s and 45 s: the referee is at mat level by the heads;
// it was a half squat at 0.6 m).
const refCountBase: PoseSpec = {
  ...refWatch,
  hips: [0, 0.44, -0.12],
  rot: [0, 30, 0],
  spine: [34, 0, 0],
  head: [-42, 0, 0],
  look: 1,
  footL: [0.2, BALL, 0.26, 10, 0],
  footR: [-0.18, BALL, -0.5, -10, 80],
  kneeL: [0.24, 0.55, 0.7],
  kneeR: [-0.2, -0.3, 0.2],
  handR: [-0.12, 0.42, 0.3],
  elbowR: [-0.4, 0.5, 0.1],
};
registerSolo({
  id: 'refCount',
  loop: true,
  keys: [
    { t: 0, pose: { ...refCountBase, handL: [0.4, 1.05, 0.25], elbowL: [0.7, 0.95, -0.15] } },
    { t: 0.5, pose: { handL: [0.32, 0.22, 0.5], elbowL: [0.6, 0.5, 0.2] } },
  ],
});

// The fall: down on the mat to see the shoulders, then the slap.
registerSolo({
  id: 'refSlap',
  keys: [
    {
      t: 0,
      pose: {
        ...tall,
        hips: [0, 0.16, -0.1],
        rot: [0, 88, 12],
        spine: [-18, 0, 0],
        head: [-40, 0, 0],
        look: 1,
        footL: [0.2, 0.04, -0.95, 0, 150],
        footR: [-0.2, 0.04, -0.95, 0, 150],
        kneeL: [0.2, -0.5, -0.4],
        kneeR: [-0.2, -0.5, -0.4],
        handL: [0.25, 0.5, 0.5],
        handR: [-0.2, POST, 0.55],
        elbowL: [0.6, 0.3, 0.2],
        elbowR: [-0.5, -0.3, 0.3],
        wristL: PALM_DOWN,
        wristR: PALM_DOWN,
        toes: [0, 0],
      },
    },
    { t: 0.55, pose: { handL: [0.32, 0.65, 0.48] } },
    { t: 0.7, land: true, pose: { handL: [0.3, POST, 0.55] } },
    { t: 1, stop: true, pose: { handL: [0.3, POST, 0.55] } },
  ],
});

/* ---------------------------------------------------------------- coaches */

// Corner coaches (owner, November 11: "a coach in the corner ... who has reactions to good and bad results for their
// wrestler"). Origin at the centre of his chair's seat (CHAIR_SEAT 0.46 m), facing the mat. Seated poses keep the hips
// over the seat; standing ones step out in front of the chair.

// Seated, leaning in with forearms on his thighs and hands together, eyes on his man.
const coachSit: PoseSpec = {
  ...tall,
  hips: [0, 0.56, -0.03],
  rot: [0, 12, 0],
  spine: [24, 0, 0],
  head: [-30, 0, 0],
  look: 1,
  footL: [0.17, BALL, 0.44, 8, 0],
  footR: [-0.17, BALL, 0.42, -8, 0],
  kneeL: [0.3, 0.7, 1.0],
  kneeR: [-0.3, 0.7, 1.0],
  handL: [0.07, 0.66, 0.36],
  handR: [-0.07, 0.66, 0.36],
  elbowL: [0.6, 0.1, 0.2],
  elbowR: [-0.6, 0.1, 0.2],
  wristL: [0, 0, 0],
  wristR: [0, 0, 0],
};
registerSolo({
  id: 'coachSit',
  loop: true,
  keys: [
    { t: 0, pose: coachSit },
    { t: 0.5, pose: { spine: [28, 0, 0], handL: [0.08, 0.64, 0.38], handR: [-0.06, 0.65, 0.37] } },
  ],
});

// Still seated, coaching: right hand cupped to the mouth, left arm out pointing at the mat, pumping.
registerSolo({
  id: 'coachYell',
  loop: true,
  keys: [
    { t: 0, pose: { ...coachSit, spine: [30, 0, 0], head: [-34, 0, 0], handR: [-0.06, 1.16, 0.34], elbowR: [-0.7, 0.9, -0.1],
      handL: [0.3, 0.98, 0.66], elbowL: [0.7, 0.8, 0.0], wristL: PALM_DOWN } },
    { t: 0.5, pose: { spine: [26, 0, 0], handL: [0.28, 0.86, 0.62] } },
  ],
});

// Up out of the chair, bent over the edge of the mat urging him on (a near fall, or his man in danger): both hands out
// and pushing down, palms down.
const coachStand: PoseSpec = {
  ...tall,
  hips: [0, 0.9, 0.36],
  spine: [26, 0, 0],
  head: [-34, 0, 0],
  look: 1,
  footL: [0.18, BALL, 0.42, 10, 0],
  footR: [-0.18, BALL, 0.36, -10, 0],
  kneeL: [0.3, 0.5, 1.0],
  kneeR: [-0.3, 0.5, 1.0],
};
registerSolo({
  id: 'coachUrge',
  loop: true,
  keys: [
    { t: 0, pose: { ...coachStand, handL: [0.2, 1.05, 0.82], handR: [-0.2, 1.05, 0.82], elbowL: [0.6, 0.9, 0.2], elbowR: [-0.6, 0.9, 0.2],
      wristL: PALM_DOWN, wristR: PALM_DOWN } },
    { t: 0.5, pose: { spine: [30, 0, 0], handL: [0.2, 0.86, 0.78], handR: [-0.2, 0.86, 0.78] } },
  ],
});

// Points for his man: up out of the chair with both fists pumping.
registerSolo({
  id: 'coachCheer',
  loop: true,
  keys: [
    { t: 0, pose: { ...coachStand, hips: [0, 0.94, 0.34], spine: [-6, 0, 0], head: [-14, 0, 0],
      handL: [0.3, 1.9, 0.46], handR: [-0.3, 1.9, 0.46], elbowL: [0.8, 1.6, 0.1], elbowR: [-0.8, 1.6, 0.1] } },
    { t: 0.5, pose: { hips: [0, 0.9, 0.34], spine: [4, 0, 0], handL: [0.3, 1.5, 0.5], handR: [-0.3, 1.5, 0.5],
      elbowL: [0.8, 1.2, 0.2], elbowR: [-0.8, 1.2, 0.2] } },
  ],
});

// Points against: up, hands on top of his head, leaning back.
registerSolo({
  id: 'coachDismay',
  loop: true,
  keys: [
    { t: 0, pose: { ...coachStand, hips: [0, 0.95, 0.3], spine: [-8, 0, 0], head: [-16, 0, 0],
      handL: [0.09, 1.72, 0.3], handR: [-0.09, 1.72, 0.3], elbowL: [0.9, 1.7, 0.1], elbowR: [-0.9, 1.7, 0.1] } },
    { t: 0.5, pose: { spine: [-3, 6, 0], head: [-10, 8, 0] } },
  ],
});

// Lost: back in the chair, slumped, elbows on his knees and head down.
registerSolo({
  id: 'coachLoss',
  keys: [
    { t: 0, pose: { ...coachSit, spine: [38, 0, 0], head: [30, 0, 0], handL: [0.13, 0.6, 0.42], handR: [-0.13, 0.6, 0.42],
      wristL: PALM_DOWN, wristR: PALM_DOWN } },
  ],
});

// Raise the winner: arm up holding his wrist.
registerSolo({
  id: 'refRaise',
  keys: [
    { t: 0, pose: { ...tall, head: [-10, 0, 0], look: 0.5, handR: [-0.3, 1.85, 0.25], elbowR: [-0.7, 1.4, -0.2] } },
  ],
});
