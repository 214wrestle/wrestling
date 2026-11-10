import {ARM_BARS} from './armBars';
import type { ScoreKind } from './types';

/** Normalized instant when a successful cradle defense opens the lock. */
export const CRADLE_GRIP_RELEASE = .255;

/**
 * Moves: the transitions between positions.
 *
 * Positions (neutral, in on the legs, front headlock, the mat rides) are where
 * wrestlers spend their time and make decisions. Moves are what happens in
 * between — a finish, a sprawl, a stand-up — and once one starts it plays out.
 *
 * Every paired move is described in a frame: +Z runs from role A toward role B
 * at the start (or, on the mat, along the bottom man's facing), +X is A's left.
 * `next` says where the bodies end up, in that same frame, so the following
 * position can be anchored exactly where the move left them. The animation for
 * each move lives in the presentation layer under the same id.
 */

export type Role = 'A' | 'B';
export type MatSub = 'ride' | 'flat' | 'standing' | 'exposed' | 'spladle';
export type ShotKind = 'double' | 'single' | 'highCrotch' | 'lowSingle';
export const SHOT_CLIPS = { double: 'shotDouble', single: 'shotSingle', highCrotch: 'shotHighCrotch', lowSingle: 'shotLowSingle' } as const;
export const LEG_HOLDS = { double: 'legsDouble', single: 'legsSingle', highCrotch: 'legsHighCrotch', lowSingle: 'legsLowSingle' } as const;

export interface Place {
  x: number;
  z: number;
  yaw: number;
}

export type NextSpec =
  | { kind: 'neutral'; a: Place; b: Place }
  | { kind: 'legs'; A: Role; frame: Place; shot: ShotKind }
  | { kind: 'fhl'; A: Role; frame: Place }
  | { kind: 'mat'; A: Role; frame: Place; sub: MatSub; base?: number }
  | { kind: 'fall' };

export type CameraHint = 'tight' | 'low' | 'wide' | 'hero' | 'lift' | 'mat';

export interface MoveDef {
  id: string;
  /** Seconds; shots override this from their distance. */
  dur: number;
  award?: { to: Role; kind: ScoreKind; at: number; detail: string };
  impact?: { at: number; strength: number };
  camera: CameraHint;
  next: NextSpec;
  /** Brief slow motion at the impact for the big ones. */
  slowmo?: boolean;
  /** How hard the building reacts the moment it starts, 0..1. */
  crowd?: number;
}

const PI = Math.PI;

/** Where each role's root sits while holding a position, in its frame. */
export const HOLD_PLACES = {
  legsDouble: { A: { x: 0, z: -0.12, yaw: 0 }, B: { x: 0, z: 0.42, yaw: PI } },
  legsSingle: { A: { x: 0.06, z: -0.1, yaw: 0.25 }, B: { x: -0.05, z: 0.45, yaw: PI } },
  legsLowSingle: { A: { x: 0.2, z: 0.08, yaw: -0.2 }, B: { x: 0, z: 0.48, yaw: PI } },
  legsHighCrotch: { A: { x: 0.22, z: 0.04, yaw: -0.2 }, B: { x: 0, z: 0.48, yaw: PI } },
  fhl: { A: { x: 0, z: -0.38, yaw: 0 }, B: { x: 0, z: 0.32, yaw: PI } },
  ride: { A: { x: 0.3, z: -0.14, yaw: -0.25 }, B: { x: 0, z: 0, yaw: 0 } },
  flat: { A: { x: 0.18, z: -0.05, yaw: -0.1 }, B: { x: 0, z: 0.12, yaw: 0 } },
  standing: { A: { x: 0.02, z: -0.34, yaw: 0 }, B: { x: 0, z: 0.02, yaw: 0 } },
  spladle: { A: { x: 0.28, z: 0.05, yaw: -1.4 }, B: { x: 0, z: 0, yaw: 0 } },
  exposed: { A: { x: 0.36, z: 0.1, yaw: -1.4 }, B: { x: 0, z: 0, yaw: 0 } },
} as const;

export const MOVES: Record<string, MoveDef> = {
  ...Object.fromEntries(ARM_BARS.flatMap(style=>[
    [style+'Turn',{id:style+'Turn',dur:2.2,camera:'mat',next:{kind:'mat',A:'A',frame:{x:0,z:0,yaw:0},sub:'exposed'}}],
    [style+'Resisted',{id:style+'Resisted',dur:1.5,camera:'mat',next:{kind:'mat',A:'A',frame:{x:0,z:0,yaw:0},sub:'flat',base:.3}}],
  ])) as Record<string,MoveDef>,
  liftedLegTrip: {id:'liftedLegTrip',dur:1.6,camera:'tight',award:{to:'A',kind:'takedown',at:0.85,detail:'Lifted leg — outside trip'},impact:{at:0.7,strength:0.65},next:{kind:'mat',A:'A',frame:{x:0.3,z:0.8,yaw:-PI/2},sub:'ride',base:0.5}},
  liftedLegDrive: {id:'liftedLegDrive',dur:1.6,camera:'tight',award:{to:'A',kind:'takedown',at:0.85,detail:'Lifted leg — drive back'},impact:{at:0.7,strength:0.6},next:{kind:'mat',A:'A',frame:{x:0,z:1.1,yaw:PI},sub:'ride',base:0.55}},
  duckUnder: {id:'duckUnder',dur:1.3,camera:'tight',award:{to:'A',kind:'takedown',at:0.85,detail:'Duck under — control established'},next:{kind:'mat',A:'A',frame:{x:0,z:0.4,yaw:PI},sub:'ride',base:0.5}},
  superDuck: {id:'superDuck',dur:1.6,camera:'tight',award:{to:'A',kind:'takedown',at:0.85,detail:'Super duck — control established'},next:{kind:'mat',A:'A',frame:{x:0,z:0.4,yaw:PI},sub:'ride',base:0.5}},
  footSweep: {id:'footSweep',dur:1.5,camera:'tight',award:{to:'A',kind:'takedown',at:0.9,detail:'Foot sweep — control established'},next:{kind:'mat',A:'A',frame:{x:0,z:0.4,yaw:PI},sub:'ride',base:0.5}},
  slideBy: {id:'slideBy',dur:1.25,camera:'tight',award:{to:'A',kind:'takedown',at:0.85,detail:'Slide by — control established'},next:{kind:'mat',A:'A',frame:{x:0,z:0.4,yaw:PI},sub:'ride',base:0.5}},
  firemansCarry: {id:'firemansCarry',dur:1.8,camera:'tight',award:{to:'A',kind:'takedown',at:0.85,detail:'Fireman’s carry — control established'},next:{kind:'mat',A:'A',frame:{x:0,z:0.4,yaw:PI},sub:'ride',base:0.5}},
  anklePick: {id:'anklePick',dur:1.35,camera:'tight',award:{to:'A',kind:'takedown',at:0.78,detail:'Ankle pick'},next:{kind:'mat',A:'A',frame:{x:0,z:0.4,yaw:PI},sub:'ride',base:0.5}},
  kneePick: {id:'kneePick',dur:1.3,camera:'tight',award:{to:'A',kind:'takedown',at:0.76,detail:'Knee pick'},next:{kind:'mat',A:'A',frame:{x:0,z:0.4,yaw:PI},sub:'ride',base:0.5}},
  throwBy: {id:'throwBy',dur:1.2,camera:'tight',award:{to:'A',kind:'takedown',at:0.85,detail:'Throw-by — control established'},next:{kind:'mat',A:'A',frame:{x:0,z:0.4,yaw:PI},sub:'ride',base:0.5}},
  // Upper-body throws from the clinch land him on his back: the takedown, then the near-fall count runs.
  lateralDrop: {id:'lateralDrop',dur:1.55,camera:'tight',slowmo:true,impact:{at:0.62,strength:0.8},award:{to:'A',kind:'takedown',at:0.66,detail:'Lateral drop — thrown to his back'},next:{kind:'mat',A:'A',frame:{x:0.3,z:0.25,yaw:PI/2},sub:'exposed'}},
  headlockThrow: {id:'headlockThrow',dur:1.5,camera:'tight',slowmo:true,impact:{at:0.62,strength:0.8},award:{to:'A',kind:'takedown',at:0.68,detail:'Headlock — thrown to his back'},next:{kind:'mat',A:'A',frame:{x:0.08,z:-0.62,yaw:3*PI/2},sub:'exposed'}},
  tieAttackCounter: {id:'tieAttackCounter',dur:1.1,camera:'low',next:{kind:'fhl',A:'B',frame:{x:0,z:0.1,yaw:PI}}},
  spladleCounter: {id:'spladleCounter',dur:1.6,camera:'mat',
    award:{to:'B',kind:'takedown',at:0.85,detail:'Spladle counter — control established'},
    next:{kind:'mat',A:'B',frame:{x:0,z:0,yaw:0},sub:'spladle'}},
  shotLowSingle: { id: 'shotLowSingle', dur: 0.5, camera: 'low', next: {kind: 'legs', A: 'A', frame: {x:0,z:0,yaw:0}, shot:'lowSingle'} },
  finishLowSingle: { id: 'finishLowSingle', dur: 1.55, camera: 'low', award: {to:'A',kind:'takedown',at:0.8,detail:'Low single — ankle shelf'}, impact: {at:0.68,strength:0.6}, next: {kind:'mat',A:'A',frame:{x:-0.3,z:0.88,yaw:PI/2},sub:'ride',base:0.55} },
  shotHighCrotch: {
    id: 'shotHighCrotch', dur: 0.44, camera: 'low',
    next: { kind: 'legs', A: 'A', frame: { x: 0, z: 0, yaw: 0 }, shot: 'highCrotch' },
  },
  finishHighCrotch: {
    id: 'finishHighCrotch', dur: 1.65, camera: 'tight', slowmo: true,
    award: { to: 'A', kind: 'takedown', at: 0.76, detail: 'High crotch — cut the corner' },
    impact: { at: 0.65, strength: 0.8 },
    next: { kind: 'mat', A: 'A', frame: { x: -0.3, z: 0.88, yaw: PI / 2 }, sub: 'ride', base: 0.55 },
  },
  /* ---------------------------------------------------------- on the feet */
  shotDouble: {
    id: 'shotDouble',
    dur: 0.42,
    camera: 'low',
    next: { kind: 'legs', A: 'A', frame: { x: 0, z: 0, yaw: 0 }, shot: 'double' },
  },
  shotSingle: {
    id: 'shotSingle',
    dur: 0.42,
    camera: 'low',
    next: { kind: 'legs', A: 'A', frame: { x: 0, z: 0, yaw: 0 }, shot: 'single' },
  },
  finishDouble: {
    id: 'finishDouble',
    dur: 1.35,
    award: { to: 'A', kind: 'takedown', at: 0.72, detail: 'Double leg' },
    impact: { at: 0.6, strength: 0.85 },
    camera: 'low',
    slowmo: true,
    next: { kind: 'mat', A: 'A', frame: { x: -0.35, z: 0.95, yaw: PI / 2 }, sub: 'ride', base: 0.55 },
  },
  liftDouble: {
    id: 'liftDouble',
    dur: 2.1,
    award: { to: 'A', kind: 'takedown', at: 0.74, detail: 'Lift and return' },
    impact: { at: 0.72, strength: 1 },
    camera: 'lift',
    slowmo: true,
    crowd: 0.75,
    next: { kind: 'mat', A: 'A', frame: { x: -0.35, z: 0.95, yaw: PI / 2 }, sub: 'ride', base: 0.45 },
  },
  finishSingle: {
    id: 'finishSingle',
    dur: 1.5,
    award: { to: 'A', kind: 'takedown', at: 0.74, detail: 'Single leg' },
    impact: { at: 0.64, strength: 0.75 },
    camera: 'tight',
    slowmo: true,
    next: { kind: 'mat', A: 'A', frame: { x: 0.3, z: 0.8, yaw: -PI / 2 }, sub: 'ride', base: 0.6 },
  },
  stuffed: {
    id: 'stuffed',
    dur: 0.62,
    impact: { at: 0.45, strength: 0.4 },
    camera: 'tight',
    next: { kind: 'fhl', A: 'B', frame: { x: 0, z: 0.05, yaw: PI } },
  },
  stuffedSingle: {
    id: 'stuffedSingle',
    dur: 0.62,
    impact: { at: 0.45, strength: 0.4 },
    camera: 'tight',
    next: { kind: 'fhl', A: 'B', frame: { x: 0, z: 0.05, yaw: PI } },
  },
  sprawlOut: {
    id: 'sprawlOut',
    dur: 0.7,
    impact: { at: 0.55, strength: 0.45 },
    camera: 'tight',
    next: { kind: 'fhl', A: 'B', frame: { x: 0, z: 0.15, yaw: PI } },
  },
  snapDown: {
    id: 'snapDown',
    dur: 0.55,
    impact: { at: 0.6, strength: 0.4 },
    camera: 'tight',
    next: { kind: 'fhl', A: 'A', frame: { x: 0, z: 0.12, yaw: 0 } },
  },
  goBehind: {
    id: 'goBehind',
    dur: 1.05,
    award: { to: 'A', kind: 'takedown', at: 0.75, detail: 'Spins behind' },
    impact: { at: 0.7, strength: 0.5 },
    camera: 'mat',
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0.32, yaw: PI }, sub: 'ride', base: 0.5 },
  },
  // Front headlock finishes beside the spin behind (owner's list, November 9).
  // Chin whip: chin cupped and whipped away as he comes up; he spins down in front of the rider.
  chinWhip: {
    id: 'chinWhip',
    dur: 0.95,
    award: { to: 'A', kind: 'takedown', at: 0.72, detail: 'Chin whip' },
    impact: { at: 0.66, strength: 0.45 },
    camera: 'mat',
    next: { kind: 'mat', A: 'A', frame: { x: 0.05, z: 0.4, yaw: PI / 2 }, sub: 'ride', base: 0.5 },
  },
  // Shuck: he drives into the headlock and is pulled past; the rider takes the back.
  shuck: {
    id: 'shuck',
    dur: 0.9,
    award: { to: 'A', kind: 'takedown', at: 0.72, detail: 'Shuck' },
    impact: { at: 0.62, strength: 0.45 },
    camera: 'mat',
    next: { kind: 'mat', A: 'A', frame: { x: -0.05, z: -0.2, yaw: PI }, sub: 'ride', base: 0.45 },
  },
  // Cement mixer: head and arm locked, rolled over the trapped shoulder to his back.
  cementMixer: {
    id: 'cementMixer',
    dur: 1.6,
    award: { to: 'A', kind: 'takedown', at: 0.62, detail: 'Cement mixer' },
    impact: { at: 0.6, strength: 0.6 },
    camera: 'mat',
    slowmo: true,
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0.5, yaw: PI }, sub: 'exposed' },
  },
  recover: {
    id: 'recover',
    dur: 0.8,
    camera: 'wide',
    next: {
      kind: 'neutral',
      a: { x: 0, z: -0.55, yaw: 0 },
      b: { x: 0, z: 0.55, yaw: PI },
    },
  },
  // Whizzer kick-out: the defender drives the shoulder down, kicks the leg free, both reset.
  // Counters on the legs (owner's list, November 9), the defender's Shoot, picked by the position.
  // Crackdown: over the back to the far ankle, his head driven to the mat, around for the takedown.
  crackdown: {
    id: 'crackdown',
    dur: 1.35,
    award: { to: 'B', kind: 'takedown', at: 0.76, detail: 'Crackdown' },
    impact: { at: 0.4, strength: 0.5 },
    camera: 'tight',
    next: { kind: 'mat', A: 'B', frame: { x: 0, z: 0.05, yaw: 0 }, sub: 'ride', base: 0.4 },
  },
  // Sit-through: he sits his hips to the mat, turns through and pulls the leg out; both back up, shooter off balance.
  sitThrough: {
    id: 'sitThrough',
    dur: 1.1,
    impact: { at: 0.35, strength: 0.35 },
    camera: 'tight',
    next: { kind: 'neutral', a: { x: 0, z: -0.55, yaw: 0 }, b: { x: 0, z: 0.6, yaw: PI } },
  },
  // Scramble roll: all but taken down, he rolls through over the shooter's back and comes up on top.
  scrambleRoll: {
    id: 'scrambleRoll',
    dur: 1.5,
    award: { to: 'B', kind: 'takedown', at: 0.8, detail: 'Scramble roll' },
    impact: { at: 0.5, strength: 0.45 },
    camera: 'mat',
    slowmo: true,
    next: { kind: 'mat', A: 'B', frame: { x: 0.05, z: -0.1, yaw: 0 }, sub: 'ride', base: 0.45 },
  },
  whizzerKick: {
    id: 'whizzerKick',
    dur: 1.0,
    impact: { at: 0.45, strength: 0.35 },
    camera: 'tight',
    next: {
      kind: 'neutral',
      a: { x: 0, z: -0.5, yaw: 0 },
      b: { x: 0, z: 0.65, yaw: PI },
    },
  },
  // A bad shot down-blocked short: hands on his head, he stops on his knees and both come back up.
  shotBlocked: {
    id: 'shotBlocked',
    dur: 0.8,
    impact: { at: 0.4, strength: 0.35 },
    camera: 'tight',
    next: {
      kind: 'neutral',
      a: { x: 0, z: -0.52, yaw: 0 },
      b: { x: 0, z: 0.62, yaw: PI },
    },
  },
  clash: {
    id: 'clash',
    dur: 0.6,
    impact: { at: 0.3, strength: 0.35 },
    camera: 'tight',
    next: {
      kind: 'neutral',
      a: { x: 0, z: -0.6, yaw: 0 },
      b: { x: 0, z: 0.6, yaw: PI },
    },
  },

  /* ------------------------------------------------------------- the mat */
  breakdown: {
    id: 'breakdown',
    dur: 0.75,
    impact: { at: 0.6, strength: 0.45 },
    camera: 'mat',
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0.05, yaw: 0 }, sub: 'flat' },
  },
  rebase: {
    id: 'rebase',
    dur: 0.7,
    camera: 'mat',
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: -0.05, yaw: 0 }, sub: 'ride', base: 0.6 },
  },
  cradle: {id:'cradle',dur:1.45,camera:'mat',impact:{at:0.78,strength:0.55},next:{kind:'mat',A:'A',frame:{x:0,z:0,yaw:0},sub:'exposed'}},
  halfNelson: {
    id: 'halfNelson',
    // A grind, not a flip: he gives ground over about two seconds (coaching: perpendicular, drive at an angle).
    dur: 2.0,
    impact: { at: 0.78, strength: 0.6 },
    camera: 'mat',
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0, yaw: 0 }, sub: 'exposed' },
  },
  sitOutPull: {
    id: 'sitOutPull',
    dur: 1.7,
    camera: 'mat',
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0, yaw: 0 }, sub: 'ride', base: 0.55 },
  },
  sitOutEscape: {
    id: 'sitOutEscape',
    dur: 1.05,
    award: { to: 'B', kind: 'escape', at: 0.72, detail: 'Sits out and turns in' },
    camera: 'mat',
    next: { kind: 'neutral', a: { x: 0.05, z: -0.42, yaw: 0 }, b: { x: 0, z: 0.62, yaw: PI } },
  },
  sitOutTurn: {
    id: 'sitOutTurn',
    dur: 1.5,
    impact: { at: 0.76, strength: 0.55 },
    camera: 'mat',
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0, yaw: 0 }, sub: 'exposed' },
  },
  tilt: {
    id: 'tilt',
    dur: 1.6,
    impact: { at: 0.72, strength: 0.55 },
    camera: 'mat',
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0, yaw: 0 }, sub: 'exposed' },
  },
  fightOff: {
    id: 'fightOff',
    dur: 0.85,
    camera: 'mat',
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0, yaw: 0 }, sub: 'flat' },
  },
  fall: {
    id: 'fall',
    dur: 2.2,
    impact: { at: 0.32, strength: 1 },
    camera: 'hero',
    slowmo: true,
    next: { kind: 'fall' },
  },
  standUp: {
    id: 'standUp',
    dur: 0.85,
    camera: 'tight',
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0.06, yaw: 0 }, sub: 'standing' },
  },
  escapeTurn: {
    id: 'escapeTurn',
    dur: 0.75,
    award: { to: 'B', kind: 'escape', at: 0.6, detail: 'Turns out' },
    camera: 'tight',
    next: {
      kind: 'neutral',
      a: { x: 0.05, z: -0.42, yaw: 0 },
      b: { x: 0, z: 0.62, yaw: PI },
    },
  },
  returnMat: {
    id: 'returnMat',
    dur: 1.1,
    impact: { at: 0.7, strength: 0.7 },
    camera: 'hero',
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0.05, yaw: 0 }, sub: 'ride', base: 0.35 },
  },
  standingTrip: {
    id: 'standingTrip', dur: 1.05, camera: 'mat',
    impact: { at: 0.7, strength: 0.45 },
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0.05, yaw: 0 }, sub: 'ride', base: 0.35 },
  },
  crotchLift: {
    id: 'crotchLift', dur: 1.5, camera: 'hero',
    impact: { at: 0.72, strength: 0.75 },
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0.05, yaw: 0 }, sub: 'ride', base: 0.35 },
  },
  // Granby roll from the bottom: rolled out from under him, both back on their feet.
  granbyRoll: {
    id: 'granbyRoll',
    dur: 1.4,
    award: { to: 'B', kind: 'escape', at: 0.76, detail: 'Granby roll' },
    impact: { at: 0.45, strength: 0.35 },
    camera: 'mat',
    next: { kind: 'neutral', a: { x: 0.05, z: -0.42, yaw: 0 }, b: { x: 0, z: 0.62, yaw: PI } },
  },
  // Standing switch: he sits his hips out, reaches under and comes up behind; the rider goes down on all fours.
  standingSwitch: {
    id: 'standingSwitch',
    dur: 1.2,
    award: { to: 'B', kind: 'reversal', at: 0.72, detail: 'Standing switch' },
    impact: { at: 0.6, strength: 0.5 },
    camera: 'mat',
    next: { kind: 'mat', A: 'B', frame: { x: 0, z: -0.25, yaw: 0 }, sub: 'ride', base: 0.3 },
  },
  // Turk off the leg ride: the trapped leg lifted, he is turned to his back over it.
  turk: {
    id: 'turk',
    dur: 1.7,
    impact: { at: 0.72, strength: 0.55 },
    camera: 'mat',
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0, yaw: 0 }, sub: 'exposed' },
  },
  // Crossface cradle: crossface drives the head to the far knee, the far leg scooped, hands locked, roll.
  crossfaceCradle: {
    id: 'crossfaceCradle',
    dur: 1.55,
    impact: { at: 0.78, strength: 0.55 },
    camera: 'mat',
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0, yaw: 0 }, sub: 'exposed' },
  },
  switch: {
    id: 'switch',
    dur: 1.0,
    award: { to: 'B', kind: 'reversal', at: 0.7, detail: 'Switch' },
    impact: { at: 0.62, strength: 0.5 },
    camera: 'mat',
    // The man who got switched lands with his base gone; a re-switch is possible, not free.
    next: { kind: 'mat', A: 'B', frame: { x: 0.28, z: -0.12, yaw: 0 }, sub: 'ride', base: 0.3 },
  },
};

export type MoveId = keyof typeof MOVES;
