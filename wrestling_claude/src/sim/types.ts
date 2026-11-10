import type { AthleteProfile, WrestlingStyle, AppearanceShape, StanceLook } from './athleteProfiles';
import type { WinType } from './rules';

export type Side = 0 | 1;

export const otherSide = (s: Side): Side => (s === 0 ? 1 : 0);

export interface Vec2 {
  x: number;
  z: number;
}

/* ------------------------------------------------------------- wrestlers --- */

export type SingletPattern = 'panel' | 'sash' | 'stripes' | 'band';
export type HairStyle = 'buzz' | 'crop' | 'curls' | 'afro' | 'bald';

export interface School {
  id: string;
  name: string;
  coach?: string;
  rosterNotes?: string;
  /** Short wordmark printed across the chest. */
  mark: string;
  nickname: string;
  /** Singlet body colour. */
  primary: string;
  /** Trim and panels. */
  secondary: string;
  /** Accent used on the scoreboard and banners. */
  accent: string;
  /** Headgear shell colour. */
  gear: string;
  pattern: SingletPattern;
  arena: string;
}

export interface Wrestler {
  /** Match difficulty only: how much a turn attempt's chance drops against him. */
  turnResist?: number;
  /** Match difficulty only: share (0..1) of the person's reflex sprawl the AI also gets. */
  shotDefense?: number;
  /** Match difficulty only: how much more often the AI takes an unprompted shot. */
  shotPressure?: number;
  /** Match difficulty only: how hard the AI fights off its back, as a mash multiplier. */
  survival?: number;
  id: string;
  rating?: number;
  /** Match only, never shown: the level a bout uses for his rating edge when it differs from the shown rating
   *  (hiddenSkill.ts). */
  performanceRating?: number;
  ncaaCareer?: import('./ratings').CareerScore;
  profile?: AthleteProfile;
  motion?: WrestlingStyle;
  /** Animation only: how his stance looks. Never read by the match logic. */
  stanceLook?: StanceLook;
  appearance?: AppearanceShape;
  headgearColor?: string;
  legends?: { role: 'starter' | 'choice'; source: string; nickname?: string; bioNote?: string };
  firstName: string;
  lastName: string;
  school: School;
  year: 'FR' | 'SO' | 'JR' | 'SR' | 'GR';
  weightClass: number;
  seed?: number;
  record: { wins: number; losses: number };
  hometown: string;
  /** Build: 0 = lean, 1 = thick. */
  build: number;
  /** Height in metres. */
  height: number;
  skinTone: string;
  hairColor: string;
  hairStyle: HairStyle;
  eyeColor: string;
  /** Which foot he leads with in stance. */
  lead: 1 | -1;
  /** One line on how he wrestles, for the tale of the tape. */
  style: string;
  /** His signature finishes (researched; see athleteStyles.ts). The AI leans on them and they land a little more often. */
  signature?: Signature;
  /** 0..1 attributes. */
  /** All attributes are relative to opponents in this weight class, not absolute body output. */
  attributes: {
    /** Shot speed, scramble and hand-fight quickness. */
    quickness: number;
    /** Finishing power, lifts and breakdowns. */
    strength: number;
    /** Stamina pool and recovery. */
    conditioning: number;
    /** Top and bottom technique. */
    mat: number;
    /** Optional reviewed leg-riding technique, 0–1; falls back to mat. */
    legRiding?: number;
    /** Reaction and sprawl. */
    defense: number;
  };
}

/** A wrestler's signature finishes in the positions that offer a choice. Interpretations of cited sources. */
export interface Signature {
  /** Short line for the tale of the tape. */
  label: string;
  /** Front headlock finish he goes to. */
  fhl?: 'goBehind' | 'chinWhip' | 'shuck' | 'cementMixer';
  /** Rides legs on top and turks off them. */
  legRider?: boolean;
  /** Counter on the legs. */
  legCounter?: 'crackdown' | 'sitThrough' | 'scrambleRoll';
  /** Way out from the bottom. */
  bottom?: 'granbyRoll' | 'standingSwitch';
  /** Turn from the flat. */
  turn?: 'cradle' | 'crossfaceCradle' | 'armBar' | 'wristBar' | 'barHalf' | 'doubleBar';
}

/* ------------------------------------------------------------- scoring ---- */

export type ScoreKind =
  | 'takedown'
  | 'escape'
  | 'reversal'
  | 'nearFall2'
  | 'nearFall3'
  | 'nearFall4'
  | 'penalty'
  | 'stalling'
  | 'ridingTime';

export interface ScoreEvent {
  id: number;
  side: Side;
  kind: ScoreKind;
  points: number;
  label: string;
  period: number;
  clock: number;
}

/* ----------------------------------------------------------- match phase --- */

export type MatchPhase =
  | 'attract'
  | 'intros'
  | 'handshake'
  | 'coinToss'
  | 'positionChoice'
  | 'setPosition'
  | 'wrestling'
  | 'whistle'
  | 'periodBreak'
  | 'celebration'
  | 'results';

export interface MatchResult {
  winner: Side;
  type: WinType;
  score: [number, number];
  period: number;
  clock: number;
  teamPoints: number;
}

export type StartPosition = 'neutral' | 'top' | 'bottom';

/* ------------------------------------------------------------- commands --- */

/** Normalised per-tick intent from a human or the AI. */
export interface Command {
  topTurn?: import('./armBars').TopTurnChoice;
  /** U / left bumper: ankle-level single. I / triangle: contest control. */
  /** Touch hold adds capped repeat effort only in sustained struggle positions. */
  legRide?: boolean;
  closePockets?: boolean;
  catchLeg?: boolean;
  legAction?: 'lift' | 'trip' | 'double' | 'drive';
  sustainedEffort?: boolean;
  technique?: 'duckUnder' | 'superDuck' | 'slideBy' | 'firemansCarry' | 'footSweep' | 'anklePick' | 'kneePick' | 'throwBy' | 'lateralDrop' | 'headlock';
  lowSingle?: boolean;
  scramble?: boolean;
  sitOut?: boolean;
  /** AI only: a level-change fake from any distance (a player fakes by shooting out of range). */
  fake?: boolean;
  /** Intended movement on the mat, world space, length <= 1. */
  moveX: number;
  moveZ: number;
  /** J: shoot / turn / stand up. */
  shoot: boolean;
  /** K: hand fight / break down / switch. */
  fight: boolean;
  /** L: sprawl / ride / base. */
  sprawl: boolean;
  /** Shift: drop your level. */
  level: boolean;
}

export const NO_COMMAND: Command = {
  moveX: 0,
  moveZ: 0,
  shoot: false,
  fight: false,
  sprawl: false,
  level: false,
};

/* ----------------------------------------------------------- narration ---- */

export interface Announcement {
  id: number;
  text: string;
  detail?: string;
  tone: 'score' | 'whistle' | 'warn' | 'big' | 'info';
  hold: number;
}
