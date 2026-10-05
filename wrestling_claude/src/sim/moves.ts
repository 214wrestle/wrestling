import type { ScoreKind } from './types';

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
export type MatSub = 'ride' | 'flat' | 'standing' | 'exposed';
export type ShotKind = 'double' | 'single' | 'highCrotch';
export const SHOT_CLIPS = { double: 'shotDouble', single: 'shotSingle', highCrotch: 'shotHighCrotch' } as const;
export const LEG_HOLDS = { double: 'legsDouble', single: 'legsSingle', highCrotch: 'legsHighCrotch' } as const;

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
  legsHighCrotch: { A: { x: 0.22, z: 0.04, yaw: -0.2 }, B: { x: 0, z: 0.48, yaw: PI } },
  fhl: { A: { x: 0, z: -0.38, yaw: 0 }, B: { x: 0, z: 0.32, yaw: PI } },
  ride: { A: { x: 0.3, z: -0.14, yaw: -0.25 }, B: { x: 0, z: 0, yaw: 0 } },
  flat: { A: { x: 0.18, z: -0.05, yaw: -0.1 }, B: { x: 0, z: 0.12, yaw: 0 } },
  standing: { A: { x: 0.02, z: -0.34, yaw: 0 }, B: { x: 0, z: 0.02, yaw: 0 } },
  exposed: { A: { x: 0.36, z: 0.1, yaw: -1.4 }, B: { x: 0, z: 0, yaw: 0 } },
} as const;

export const MOVES: Record<string, MoveDef> = {
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
  halfNelson: {
    id: 'halfNelson',
    dur: 1.25,
    impact: { at: 0.78, strength: 0.6 },
    camera: 'mat',
    next: { kind: 'mat', A: 'A', frame: { x: 0, z: 0, yaw: 0 }, sub: 'exposed' },
  },
  tilt: {
    id: 'tilt',
    dur: 1.05,
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
