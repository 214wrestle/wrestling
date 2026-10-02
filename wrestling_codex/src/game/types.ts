export type Side = 0 | 1;
export type Phase = 'menu' | 'intro' | 'wrestling' | 'break' | 'paused' | 'finished';
export type Stage = 'regulation' | 'sudden' | 'tiebreak1' | 'tiebreak2';
export type Difficulty = 'club' | 'varsity' | 'champion';
export type Choice = 'neutral' | 'top' | 'bottom' | 'defer';
export type Move = 'idle' | 'handfight' | 'shot' | 'snap' | 'sprawl' | 'takedown' | 'standup' | 'switch' | 'heist' | 'turn' | 'breakdown' | 'celebrate';

export interface Controls {
  x: number;
  z: number;
  primary: boolean;
  secondary: boolean;
  setup: boolean;
  defend: boolean;
  sprint: boolean;
  primaryHeld: boolean;
}
export const emptyControls = (): Controls => ({ x: 0, z: 0, primary: false, secondary: false, setup: false, defend: false, sprint: false, primaryHeld: false });

export interface Wrestler {
  x: number; z: number; heading: number;
  stamina: number; setup: number; cooldown: number;
  defending: boolean; defenseAge: number; speed: number;
  move: Move; moveTime: number; moveDuration: number;
  passive: number; warnings: number; lastGroundAction: string;
  attempts: number; takedowns: number; escapes: number; reversals: number;
}
export interface Exchange {
  kind: 'shot' | 'snap' | 'takedown' | 'sprawl' | 'escape' | 'reversal';
  actor: Side; age: number; duration: number; quality: number;
  startX: number; startZ: number; directionX: number; directionZ: number;
}
export interface MatchEvent { id: number; text: string; detail: string; side?: Side; kind: 'score' | 'whistle' | 'action' | 'warning' | 'finish'; at: number }
export interface Result { winner: Side; method: 'Fall' | 'Technical fall' | 'Major decision' | 'Decision' | 'Sudden victory' | 'Riding time' | 'Disqualification'; time: string }
export interface MatchSettings { difficulty: Difficulty; clockSpeed: number; sound: boolean; quality: 'high' | 'balanced'; }
export interface MatchState {
  phase: Phase; previousPhase: Phase; age: number; phaseAge: number;
  period: number; stage: Stage; overtimeRound: number; remaining: number;
  score: [number, number]; riding: [number, number]; overtimeRiding: [number, number];
  regulationRidingAwarded: boolean; firstScorer: Side | null;
  firstChoice: Side; secondChoice: Side; choiceFor: Side | null; canDefer: boolean;
  secondTieChoice: Side;
  wrestlers: [Wrestler, Wrestler]; top: Side | null;
  control: number; exposure: number; nearFallCount: number; pin: number;
  exchange: Exchange | null; restartTime: number;
  events: MatchEvent[]; result: Result | null;
}
export const other = (side: Side): Side => side === 0 ? 1 : 0;
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const clockText = (seconds: number) => `${Math.floor(Math.max(0, Math.ceil(seconds)) / 60)}:${String(Math.max(0, Math.ceil(seconds)) % 60).padStart(2, '0')}`;
