import {isArmBar,isCradleTurn,flatTurnFor,type ArmBar} from './armBars';
import {legRideSkill,legRideQuality,LEG_CLEAR_THRESHOLD} from './legRideQuality';
import { weightPhysics, absoluteStrength } from './weightPhysics';
import { isScrambleSpecialist, isFootSweepSpecialist, HIGH_PACE_NAMES } from './athleteProfiles';
import { scorerStep } from './techFalls';
import { STYLE_EFFECT, gradeStep, styleStep } from './attributeRatings';
import { MAT } from './rules';
import { pinningMultiplier } from './careerAwards';
import { DEFAULT_PLAN, planEffects, topPlanEffects, type MatchPlan } from './strategy';
import { HOLD_PLACES, MOVES, SHOT_CLIPS, LEG_HOLDS } from './moves';
import type { MatSub, MoveDef, MoveId, NextSpec, Place, Role, ShotKind } from './moves';
import { otherSide } from './types';
import type { Command, ScoreKind, Side, Signature, Vec2, Wrestler } from './types';

/**
 * The bout: two bodies, their balance, their hands and the positions they fight
 * through. No rendering, no clock, no referee — MatchSim owns those and calls
 * `tick` while the whistle says wrestle.
 *
 * The rules of engagement are positional, the way real wrestling is:
 *   - On the feet, level, distance, lean and hand position decide what works.
 *     A shot from the right distance against a high, leaning opponent is hard to
 *     stop; the same shot from too far, or into a low stance, gets sprawled on.
 *     Pressing into a man who gives ground leaves you falling forward — and a
 *     snap down feeds on exactly that.
 *   - Once in on the legs it is a finishing battle: drive through, or he
 *     sprawls the hips back and ends up on top of you in a front headlock.
 *   - On the mat the bottom man's base fights the top man's control. Break him
 *     down before you turn him; stand up before he breaks you down; switch the
 *     moment he over-commits.
 */

export interface Frame {
  x: number;
  z: number;
  yaw: number;
}

export type Act =
  | 'stance'
  | 'reach'
  | 'snap'
  | 'sprawl'
  | 'sprawlRecover'
  | 'fake'
  | 'attackAttempt'
  | 'stagger'
  /** Reactions to a head tap or pull: swat the arm away, tie up the wrist, or the head pops up (a bite). */
  | 'swat'
  | 'tieArm'
  | 'headUp'
  /** Pummeling: swimming an arm inside his, for the underhook. */
  | 'swim'
  | 'idle'
  | 'paired';

export interface Athlete {
  side: Side;
  pos: Vec2;
  vel: Vec2;
  yaw: number;
  /** 0 = deep, 0.45 = working stance, 1 = tall. */
  level: number;
  /** Forward (+) / back (-) balance, roughly -1..1; past 0.6 he is off balance. */
  lean: number;
  /** Hand-fight control, 0..1. 0.3 = wrist control, 0.62 = a tie. */
  hand: number;
  /** Which tie he holds once `hand` reaches 0.62: won tall it is a collar tie, won low an underhook. */
  /** Collar tie, one underhook, or both (a body lock, won by pummeling the second arm in). */
  tie?: 'collar' | 'underhook' | 'bodyLock';
  /** His reach is a tie-up (TIE_UP): close in, he steps in and locks up rather than tapping. */
  tieIn?: boolean;
  /** The pending hand-fight press asked to tie up (Command.tieUp). */
  tieWanted?: boolean;
  /** Seconds left in which he is still reacting to being snapped at: the ankle pick window. */
  snapped?: number;
  /** Seconds left in which he is off balance after his own failed shot: the other man's reshot. */
  reshot?: number;
  /** Seconds left in which his blocked (but sound) shot can be chained straight into another. */
  chain?: number;
  /** Seconds left after he bit on a head tap or pull (head popped up): the moment to go. */
  opened?: number;
  lead: 1 | -1;
  /** Seconds until he may switch his lead leg again (look only). */
  leadSwitchT?: number;
  stamina: number;
  /** Recent effort 0..1, for breathing and sweat. */
  exertion: number;
  act: Act;
  attemptedTechnique?: Command['technique'];
  actT: number;
  actDur: number;
  cooldown: number;
  /** Buffered presses, seconds remaining. */
  buffer: { shoot: number; fight: number; sprawl: number };
  /** Push toward the opponent this tick, -1..1. */
  drive: number;
  /** Seconds since his last fake, for set-ups. */
  sinceFake: number;
  /** Seconds his last opening still counts as a set-up (shoot off his reaction a beat later). */
  setUpT: number;
  /** Seconds of momentum left after he scored (cheaper effort; see FATIGUE). */
  momentumT?: number;
  stats: {
    takedowns: number;
    escapes: number;
    reversals: number;
    nearFalls: number;
    stuffs: number;
    shotsAttempted: number;
  };
  stallTimer: number;
  stallWarned: boolean;
  /** Seconds on top since he last tried to turn him (riding without trying is stalling). */
  sinceTurnTry: number;
}

export type Position =
  | { kind: 'free' }
  | { kind: 'neutral' }
  | {
      kind: 'shot';
      A: Side;
      shot: ShotKind;
      mirror: boolean;
      t: number;
      dur: number;
      frame: Frame;
      quality: number;
      dist: number;
      sprawlAt: number;
      stuffRoll: number;
      /** When the player's wrestler sprawls by reflex if the player does not (shot time, s); -1 none. */
      reflexAt?: number;
      /** A reshot on a man stumbling up from his own failed shot: his hips come back late, if at all. */
      stumbling?: boolean;
      /** Taken with no setup at all (see startShot): easy to read and to counter. */
      cold?: boolean;
      /** How well timed, 0..1 (TIMING): 1 off a live reaction, about .6 set up, 0 cold. */
      timing?: number;
      /** The contact hit has fired (TIMING.impact). */
      hit?: boolean;
    }
  | {
      kind: 'legs';
      A: Side;
      shot: ShotKind;
      mirror: boolean;
      t: number;
      frame: Frame;
      progress: number;
      intensity: number;
      lifted?: number;
      /** Contested arm/leg capture before the spladle roll, not secured control. */
      counterGrip?: number;
      legFinish?: 'trip' | 'double' | 'drive';
      /** Seconds since the defender last worked his whizzer; a beaten shot then kicks out to the feet. */
      whizzer?: number;
      /** Best finish progress so far and when it was reached: no improvement for a while is a stalemate. */
      peak?: number;
      peakAt?: number;
      /** Seconds neither man has worked (driven, lifted, fought the leg): the real stalemate. */
      idleT?: number;
      /** Seconds before the defender can try another counter (crackdown, sit-through, scramble roll). */
      counterCool?: number;
      /** Which way the attacker is circling (running the pipe), the seconds left of his drive burst, the defender's
       *  hop / turn-away burst and his sprawl push (LEG_MOTION). */
      circleDir?: number;
      surge?: number;
      hop?: number;
      push?: number;
    }
  | { kind: 'fhl'; A: Side; mirror?: boolean; t: number; frame: Frame; recover: number; intensity: number; cooldown: number;
      /** 0..1: how hard he is driving into the headlock to dig out (each push adds, it fades); the shuck feeds on it. */
      drive?: number }
  | {
      kind: 'mat';
      A: Side;
      sub: MatSub;
      /** Preserve the captured side when a mirrored counter ends in a lock. */
      mirror?: boolean;
      t: number;
      frame: Frame;
      turnStyle?: 'cradle' | ArmBar;
      legRide?: number;
      pockets?: number;
      legCaught?: number;
      legEntryCool?: number;
      /** Bottom man's base, 0 (flat) .. 1 (solid on all fours). */
      base: number;
      /** Top man's control, 0..1. */
      control: number;
      /** Stand-up hand-fight progress. */
      escape: number;
      /** Seconds of back exposure. */
      expo: number;
      /** 1 when he only flashed over (a tilt, or thrown feet to back): he bellies back out on his own. */
      flash?: number;
      /** Just landed from a mat return: how it resolves on the first tick (see RETURN). */
      landing?: 'flat' | 'turnIn' | 'slam';
      /** A head-and-arm hold (a tight cement mixer): the neck can be cranked, so potentially dangerous. */
      neck?: boolean;
      /** Seconds before the top man can adjust (tighten a flash) again: an adjust is a motion, not a mash. */
      adjustT?: number;
      awarded: 0 | 2 | 3 | 4;
      pin: number;
      pinHold: number;
      fight: number;
      /** Top man over-committed: the switch window. */
      commit: number;
      /** Bottom man's control of the rider's hand at his waist, 0..1 (HANDS). */
      hands?: number;
      /** Bottom man driving his back into the rider, 0..1, fading (HANDS). */
      back?: number;
      /** Seconds left of the explosive window off the whistle from the referee's position (HANDS). */
      whistle?: number;
      /** The top man's breakdown off this whistle (OPENER), and seconds until it lands. */
      opener?: Breakdown;
      openerT?: number;
      /** Seconds he still holds the near ankle (OPENER.ankle.hold). */
      ankleT?: number;
      basing: number;
      /** Seconds before the top man can try another turn. */
      turnCool: number;
      chopStreak?: number;
      chopT?: number;
      /** Flat on his belly (FLAT): a push up (+1) or a chop back down (-1), fading; shown as a heave or a drop. */
      heave?: number;
      /** Seconds since the last chop on a flat man; another inside FLAT.chopWindow hits for less. */
      flatChopT?: number;
      intensity: number;
    }
  | {
      kind: 'move';
      id: MoveId;
      /** Retain the source hold for the renderer's exit animation. */
      turnStyle?: 'cradle' | ArmBar;
      A: Side;
      mirror: boolean;
      t: number;
      dur: number;
      frame: Frame;
      awarded: boolean;
      impacted: boolean;
      scrambleGuard?: number;
      /** After a failed shot that ends on the feet: how long the shooter is off balance (a bad shot). */
      offBalance?: number;
      /** Preserve the actual capture if a defender interrupts an unscored finish. */
      sourceContest?:
        | { kind: 'legs'; shot: ShotKind; lifted?: number; legFinish?: 'trip' | 'double' | 'drive' }
        | { kind: 'fhl'; recover: number };
      /** Where each role starts, in the frame, for root placement. */
      startA: Place;
      startB: Place;
      /** Neutral shots warp from the real distance to the authored one. */
      dist: number;
      /** How well timed, 0..1 (TIMING): a burst plays faster and hits harder. */
      burst?: number;
    };

export interface BoutEvents {
  score?: (side: Side, kind: ScoreKind, detail: string) => void;
  announce?: (text: string, tone: 'score' | 'whistle' | 'warn' | 'big' | 'info', detail?: string) => void;
  impact?: (strength: number, at: Vec2, slowmo: boolean) => void;
  move?: (def: MoveDef, A: Side) => void;
  whistle?: (reason: 'out' | 'stalemate') => void;
  /** The referee stops it for a call (NCAA): `side` locked his hands (a point to the other man), or a hold went
   *  potentially dangerous (no penalty). Either way they restart in the position held. */
  call?: (kind: 'lockedHands' | 'dangerous' | 'slam', side: Side) => void;
  fall?: (winner: Side) => void;
  /** Something the defender should react to, for the HUD and the AI. */
  tell?: (to: Side, what: 'shot' | 'fake' | 'opening' | 'snap' | 'switch' | 'standup') => void;
  /** A press did something — or did not. Drives button feedback. */
  feedback?: (side: Side, button: 'shoot' | 'fight' | 'sprawl', result: 'ok' | 'won' | 'lost' | 'blocked', label?: string) => void;
}

export type LegCounter = 'crackdown' | 'sitThrough' | 'scrambleRoll';
/** Added to a wrestler's chance with his own signature finish. */
export const SIGNATURE_EDGE = 0.06;
export const LEG_COUNTER_LABELS: Record<LegCounter, string> = { crackdown: 'Crackdown', sitThrough: 'Sit through', scrambleRoll: 'Scramble roll' };
/** The defender's counter on the legs, picked by the position: a scramble roll when he is all but finished, a
 * sit-through while a single or high crotch is still low (once the leg is up it is the whizzer's job), and a
 * crackdown over the back on a double or low single. Shots land 0.5-0.65 of the way in, so the windows are set
 * from there. */
export function legCounterFor(s: { shot: ShotKind; progress: number; lifted?: number }): LegCounter | null {
  if (s.progress >= 0.85) return 'scrambleRoll';
  if (s.shot === 'single' || s.shot === 'highCrotch') return (s.lifted ?? 0) < 0.5 ? 'sitThrough' : null;
  return 'crackdown';
}

export const BOUT = {
  maxSpeed: 2.3,
  accel: 10,
  turnRate: 7.5,
  minGap: 0.68,
  contact: 0.84,
  tieRange: 1.0,
  shotMin: 0.5,
  shotMax: 1.5,
  shotIdeal: 0.92,
  shotStamina: 0.04,
  buffer: 0.2,
  reachDur: 0.24,
  snapDur: 0.24,
  sprawlDur: 0.52,
  sprawlRecover: 0.32,
  fakeDur: 0.32,
  staggerDur: 0.42,
  /** Escape progress needed, standing, before the bottom man can turn out. */
  turnOut: 0.62,
  /** With his legs in, the rider can turk once the base is under this (a seated leg is its own breakdown). */
  turkBase: 0.75,
} as const;

/** Shot-quality penalty for a shot taken with no setup at all (see startShot). */
export const COLD_SHOT = 0.12;
/**
 * Well-timed shots are explosive (owner, November 11: "more action, athleticism and explosive moves when it's well
 * timed"). Timing 1 is a shot right off a live reaction (his reach, snap, stumble or recovery from a sprawl, or a reshot):
 * the step comes out `fast` times the usual time, so faster on screen and harder to react to, and hits the legs with a
 * bigger contact `impact`. A set-up shot (fake, hands, lean, angle) is about .6. A cold shot is telegraphed: `cold` times
 * slower, with only the base hit. `at` is when in the step the shooter hits the legs (the clips' contact key).
 */
/**
 * Lift doubles (owner, November 11: "Yes, more lifts"). About half the NCAA doubles sampled in the video review were
 * lifts (DPS "40 Double Legs at 2025 NCAAs"); ours lifted only about 1 in 10, and only if won within 1.2 s. Now about a
 * third of finished doubles for an average man: base plus a strength share, plus `quick` when won inside `quickT`
 * seconds, and never once he is under `gas` stamina. The look changes, not the score.
 */
/**
 * Upper-body throws off his drive (owner, November 11: "Make all of the upper body throws more effective when the opponent
 * is pushing in from their feet. If he is pushing in hard it's easier for the thrower to launch"). Pushing in, 0..1: his
 * speed toward the thrower over `speed` (m/s) plus his forward lean x `lean`. It adds up to `odds` to the lateral drop
 * and headlock (cap raised to `cap`) and makes the throw a burst (TIMING): faster, landing harder. Tied up, only a hard
 * push counts (his stick toward you past `tiedDrive`; standing close is not driving), and with ties common (TIE_UP) the base odds are `dropBase` / `headlockBase` (were
 * 0.42 / 0.37): a throw into a man who is not driving is a gamble, into a man driving in it flies.
 */
export const THROW_PUSH = { speed: 0.9, lean: 0.8, odds: 0.3, cap: 0.85, dropBase: 0.32, headlockBase: 0.27, tiedDrive: 0.4 } as const;
export const LIFT_DOUBLE = { base: 0.12, strength: 0.2, quick: 0.12, quickT: 1.2, gas: 0.3 } as const;
export const TIMING = { fast: 0.86, setUp: 0.6, cold: 1.08, impact: [0.3, 0.6], at: 0.72 } as const;
/**
 * Exposures that are a flash (owner, November 10): a tilt, or thrown feet to back from the feet. He is caught on his
 * back for a couple of quick swipes and bellies back out, so these are mostly the 2-point near falls; the top man
 * squeezing can hold some longer. Locked holds (half nelson, turk, cradles, bars) are where 3s, 4s and falls come from.
 */
export const FLASH_EXPOSURES: ReadonlySet<string> = new Set(['tilt', 'sitOutTurn']);
/**
 * Throws to his back (owner, November 10): a tight throw lands him locked up, a real chance at a 3, a 4 or a fall;
 * only a loose one is a flash he bellies out of for 2. How often it is tight goes with the thrower's power and skill.
 */
/**
 * Fireman's carry to the back (owner, November 11): a won carry sometimes rolls him straight to his back, chest to
 * chest, for a takedown and near fall (Austin DeSanto's inside carry), instead of landing him on his hands and knees.
 */
export const CARRY_BACK = { base: 0.32, strength: 0.4, mat: 0.2 };
export const THROW_EXPOSURES: ReadonlySet<string> = new Set(['lateralDrop', 'headlockThrow', 'cementMixer', 'firemansCarryBack']);
export const throwTight = (w: { strength: number; mat: number; throws?: number }, step = 0) =>
  clamp(0.15 + 0.3 * (w.throws ?? w.strength) + 0.25 * w.mat + STYLE_EFFECT.throwTight * step, 0.2, 0.8);
/** How fast he rolls out of a flash on his own (fight per second; he is off his back at 1). */
export let FLASH_ROLL = 0.3;
/** How much of a flash each squeeze takes away (scaled by mat skill and gas): tightening the hold. */
export let FLASH_TIGHTEN = 0.14;
/** Seconds between adjusts: holding Squeeze and tapping it fast tighten at the same pace. */
export const FLASH_ADJUST = 0.45;
/** Review scans only. */
export const setFlashRoll = (v: number, tighten = FLASH_TIGHTEN) => { FLASH_ROLL = v; FLASH_TIGHTEN = tighten; };
/**
 * Locked hands (owner's list; NCAA Rule 5.8.2): the man in control may not lock his hands around the body or both
 * legs unless all of the bottom man's weight is on his feet (or he is in a near fall). It is a point to the other
 * man and a restart in the position held. In play it is grabbing too early: Ride tight while he is still on a knee
 * coming up, or as a mat return lands and just after (`release` seconds). A rider also slips now and then on his
 * own: `slip` per stand-up or return, less with mat skill, more when tired.
 */
export const LOCKED_HANDS = { grab: 0.45, slip: 0.05, release: 0.4 } as const;
const MAT_RETURNS: ReadonlySet<string> = new Set(['returnMat', 'standingTrip', 'crotchLift']);
/**
 * Mat returns (owner's list, "mat return depth"). How he lands depends on the return and how well it was done:
 * clean (quality over `clean`) and he is flat, a breakdown; ordinary and he is on his base; scrappy (under
 * `scrappy`) and he lands nearly back up. The crotch lift lands cleaner than the lift-and-return, the trip lands him
 * on his hands. As he comes down the bottom man can sit and turn in the moment he lands (Shoot during the return):
 * `turnIn` is its base chance, better the more he had broken the grip, worse off a clean return; if it fails he
 * lands flatter. A tired rider's big lift can come down as a slam (NCAA illegal hold: he must return him to the mat
 * safely), a point to the bottom man. Locked hands still applies as he lands (LOCKED_HANDS).
 */
export const RETURN = { clean: 0.72, scrappy: 0.38, turnIn: 0.16, slam: 0.05 } as const;
/** Chance, each time he strains against a crankable hold the top man is cranking, that the referee calls it
 *  potentially dangerous (see tickExposed). */
export const DANGEROUS_PER_STRAIN = 0.008;
/**
 * Potentially dangerous on the feet (owner's list, after the mat version): the referee stops a front headlock when
 * the top man snaps the head down hard while the man underneath drives up into it (the neck), and a high single leg
 * when he is still lifting a leg the defender is whizzering against (the knee). Chance per snap or whizzer press in
 * that spot; no penalty; they restart on their feet.
 */
export const DANGEROUS_ON_FEET = { snap: 0.04, leg: 0.02 } as const;
/**
 * Scoring pace (owner, November 10: toward real college pace; NCAA 2024-26 per bout, both wrestlers: about 11
 * points, 2.1 takedowns, 2.5 escapes, 0.9 near-fall points, 0.4 riding time; Mat Stats, NWCA). The main levers:
 * `legs` is how hard a leg attack is to finish once he is in (subtracted from the finish rate each second);
 * `fhl` scales the front headlock finishes; `standUp` the stand-up from the referee's position; `standEscape` how fast
 * he breaks the grip on his feet; `sitOut` the sit-out, Granby and turn-in escapes; `turn` how often a turn from
 * top gets him over; `switch` the switch and standing switch (reversals).
 */
// November 10 (pacescan, stand-in vs AI, Varsity): before (legs 0.11, the rest 1) about 32 points a match, 6.4
// takedowns, 6.8 escapes, out from bottom in about 10 s. Leg finishes alone tilted it to the player (the AI's
// takedowns fell three times as fast), the mat levers alone to the AI; together they balance.
// Owner, November 10: a stand-up should work "more like 25%" (escapescan: 21% at standUp 0.55, flat by weight).
export const PACE = { legs: 0.13, fhl: 0.45, standUp: 0.66, standEscape: 0.45, sitOut: 0.45, turn: 0.7, switch: 0.5 };
/**
 * Big men are hard to hold down (owner, November 10: "even higher when you start to get above 184 lbs. The really
 * big guys are hard to hold down and ride"). Extra share on the bottom man's stand-up, sit-out escape and breaking
 * the grip on his feet, and taken off the rider's return, by the bottom man's weight.
 */
export const BIG_BOTTOM: Readonly<Record<number, number>> = { 184: 0.22, 190: 0.27, 197: 0.35, 285: 0.6 };
/**
 * Stand-ups and sit-outs work off back pressure and hand control, and a stand-up is often an explosive move right off
 * the whistle (owner, November 10). On the bottom, Hand fight takes hand control of the rider's wrist (the switch
 * only when he is over, `switchWindow`), Base up drives the back into him (`back`, short-lived), and the first
 * `whistle` seconds from the referee's position are the explosive window. Each adds to the stand-up and sit-out
 * escape chance; a chop breaks some hand control; coming up with the hands starts him further along on his feet.
 */
export const HANDS = { gain: 0.4, fade: 0.25, chopBreak: 0.4, switchWindow: 0.3, backFade: 1.0,
  standUp: 0.2, backStand: 0.12, whistle: 0.9, whistleStand: 0.22, sitOut: 0.12, backSit: 0.1, carry: 0.1 } as const;
/**
 * The top man's breakdown at the whistle from the referee's position (owner, November 10: "give the top man 3-4
 * breakdown options prior to the whistle on the restart"). Chosen before the whistle; it lands `delay` after it unless
 * the bottom man is already gone. Each also shifts the bottom man's whistle stand-up, switch and sit-out while the
 * whistle window lasts (Near ankle: while he holds the ankle, `hold` seconds).
 */
export type Breakdown = 'chop' | 'ankle' | 'spiral' | 'legs';
export const BREAKDOWNS: { id: Breakdown; label: string; note: string }[] = [
  { id: 'chop', label: 'Chop', note: 'Chop the near arm and drive him to his belly · a quick stand-up beats it' },
  { id: 'ankle', label: 'Near ankle', note: 'Pull the near ankle and drive · stops the stand-up, breaks less base' },
  { id: 'spiral', label: 'Spiral', note: 'Far wrist and spiral him down · safe against the switch and sit-out' },
  { id: 'legs', label: 'Legs in', note: 'Throw the legs in at the whistle · kills the stand-up, open to the switch' },
];
export const OPENER: { delay: number } & Record<Breakdown, { base: number; control: number; standUp: number; switch: number; sitOut: number; hold?: number }> = {
  delay: 0.35,
  chop: { base: 0.55, control: 0.05, standUp: 0.1, switch: 0.1, sitOut: 0.05 },
  ankle: { base: 0.3, control: 0.15, standUp: -0.25, switch: 0, sitOut: -0.05, hold: 1.5 },
  spiral: { base: 0.42, control: 0.1, standUp: -0.05, switch: -0.15, sitOut: -0.12 },
  legs: { base: 0.12, control: 0.05, standUp: -0.2, switch: 0.2, sitOut: 0.05 },
};
export const bigBottom = (weightClass: number) => 1 + (BIG_BOTTOM[weightClass] ?? (weightClass > 197 ? 0.6 : 0));
/** Review scans only. */
export const setPace = (p: Partial<typeof PACE>) => { Object.assign(PACE, p); };
/**
 * Fatigue (owner, November 10): a man ridden a long time tires, more so fighting off his back; a hard takedown attempt
 * that is fought off costs the shooter; a tired defender gives more openings (counts as set up), reads shots later,
 * bites harder on fakes (a longer recovery, so the reshot is there) and is easier to snap down; a tired attacker
 * finishes worse. Scoring with the crowd behind him gives a short burst (momentum). Per-second rates go through spend()
 * (so conditioning matters); `openings` is the stamina under which he counts as an opening.
 */
export const FATIGUE = {
  ridden: 0.007, back: 0.035, failedShot: 0.012, neutralRecover: 0.03, topRecover: 0.045,
  openings: 0.35, read: 0.45, fakeRecover: 1.0, snap: 0.3, finish: 0.3,
  momentum: 0.12, momentumT: 12, momentumSpend: 0.6,
  /*
   * Owner playtest, November 11: "Even when I'm just like head tapping and faking, I'm down to 0% stamina in the
   * first period, and it really never comes back ... it needs to gradually go down ... especially when you're
   * winning ... when you're on top, you should be recovering stamina, even if you're working ... you should never be
   * at like 0 stamina unless it's like an overtime match, and or they've both been really shooting and scoring a ton."
   * Every cost goes through spend(): the rider pays `topSpend` of it (so working on top still nets a recovery at a
   * normal pace), the man underneath `bottomSpend`; a lead of `leadAt` points or more takes `lead` off; and in
   * regulation the drain slows below `low` (down to `lowMin` of it near empty), so only a hard, shot-heavy match
   * empties the tank. Overtime drops the cushion. Stoppages, the walk back and the period break give back `rest` a
   * second. Being ridden wears the bottom man down only to `riddenFloor`; under it he breathes back `riddenBreath`.
   */
  topSpend: 0.4, bottomSpend: 0.65, lead: 0.3, leadAt: 6, low: 0.45, lowMin: 0.06, rest: 0.03,
  riddenFloor: 0.3, riddenBreath: 0.012,
};
/**
 * Tying up on the feet (owner playtest, November 11: "I wanted to be able to tie up from my feet and where I could either
 * throw or snap or just move the guy around ... you should be able to tie up and kind of pummel fight on your feet and
 * fight for head position and underhooks ... that's where the throws come from. But I wasn't able to do it.").
 * Inside `range` the hand-fight button is a tie-up: he steps in for the collar tie, his odds up by `odds` and the other
 * man's reflex swat cut to `answer` of usual; won, it locks (hand `lock`) and `backOdds` of the time the other man ties
 * back (hand `back`): head to head. Tied, the pair stays within `hold`: whoever moves drags the other with him, the
 * stronger man more (`drag`), and pulling a man who is not driving back makes him lean in (`pullLean`). The second arm
 * in for the body lock is `lockHard` harder than the first (was 0.12). A held tie fades only `holdFade` a second (was
 * 0.03, so a tie came apart on its own within a few seconds); it is the other man's hands that break it.
 */
interface StyleSteps { pace: number; brawl: number; throws: number; phys: number; ride: number; turn: number; pin: number; bottom: number; shots: number; def: number; scram: number; expl: number; end: number; ath: number; clutch: number; heart: number; scorer: number }

/** How fast pin pressure builds, held and on each squeeze (owner, November 12: "Yes, fall rate" — falls had dropped
 *  about 5% at Varsity and 9% at All-American after clutch, heart and the AI's realistic choice of bottom). Falls are
 *  steep in it: of 1,200 even matches, 1.0 gives 284 / 339 (Varsity / All-American), 1.03 gives 305 / 364, 1.08
 *  gives 342 / 404, 1.25 gives 437 / 513. */
export const PIN_PRESSURE = { rate: 1.03 } as const;

export const TIE_UP = { range: 1.05, odds: 0.25, answer: 0.5, lock: 0.72, back: 0.66, backOdds: 0.85, hold: 0.95, drag: 0.9, pullLean: 0.2, lockHard: 0.2, holdFade: 0.008 } as const;
/** Neutral taps (owner playtest, November 11): a fake, a head tap, a snap or a pummel is a breath, not a sprint. Were
 *  0.015, 0.012, 0.035 and 0.02. */
export const TAP_COST = { fake: 0.007, reach: 0.005, snap: 0.02, pummel: 0.01 } as const;
/**
 * Leg battles (owner, November 10: "When I'd pick up a leg, I'd hold it up for maybe 2, 3, 4 seconds, and it would call
 * a stalemate ... there should be a little more of a battle, perhaps even a scramble"). Stalemate only after `idle` s of
 * neither man working; with no progress for `stuck` s after `scrambleAt` s (or at `cap` s) it goes to a scramble.
 */
// Owner: "a stalemate can happen after 7 or 8 seconds if both wrestlers kind of are just hanging on. But if someone's
// working to improve ... it can go 15 or 20 seconds".
/**
 * Broken down flat (owner, November 10): "it just looks like he's laying there on his belly". Each push up shows as a
 * heave (views), and the top man cannot hold him flat just by chopping as fast as he can tap: a chop right after
 * another hits for chopRepeat of the full amount.
 */
export const FLAT = { chopRepeat: 0.3, chopWindow: 0.7, heaveFade: 4 };
/** A chop takes time: one inside `gap` seconds of the last (tapping faster than a man can chop) hits for `rush` of the
 *  full amount and does not build the run of chops (owner, November 10: the bottom man should be up and moving). */
export const CHOP_PACE = { gap: 0.45, rush: 0.35 };
export const LEG_BATTLE = { idle: 7, scrambleAt: 15, stuck: 4, cap: 20, stalemateShare: 0.15 };
/**
 * Owner, November 10: with the leg up "there needs to be more movement and action": he walks him around the mat,
 * drives, runs the pipe to turn the corner and get to the outside; the defender hops, turns away and fights it.
 * The pair circles about a point near the defender (so the attacker does most of the stepping) and travels.
 * Speeds in m/s, turns in rad/s; a tap (attacker Shoot, defender Hand fight / Sprawl) gives a short burst.
 */
export const LEG_MOTION = {
  drive: 0.5, walk: 0.45, give: 0.25, circle: 0.55, pivot: 0.3,
  surge: 1.1, surgeTurn: 0.9, surgeT: 0.35,
  hop: 0.45, hopTurn: 0.8, hopT: 0.3, sprawlBack: 0.45,
  flip: 0.3,
};
/** Seconds an opening still counts as a set-up after it closes: long enough to see the Shoot light and go. */
export const SET_UP_HOLD = 0.5;
/**
 * The edge (owner, November 10; NCAA Rule 5.7): near the line the man in trouble (the defender on the legs or in
 * a front headlock, the bottom man on the mat) works out of bounds with the stick to stop the attack, and the man
 * in control (attacker, top man) turns the action back to the center. Getting out is legal in a scramble; fleeing
 * to avoid being scored on (on his back, or with the takedown all but finished) is stalling (MatchSim.whistle).
 * zone: metres inside the line where it starts; full: where it is at full strength; speed m/s; pivot rad/s.
 */
export const EDGE = { zone: 2.2, full: 1.2, speed: 0.5, pivot: 0.6 } as const;
/** How far inside the line a frame is (negative once out). */
export const edgeDistance = (x: number, z: number) => MAT.circleRadius - Math.hypot(x, z);
/** A defender reads a cold shot off the level change far more often than a set-up one (owner, November 10: bad,
 *  lazy shots should be stopped and countered, not regularly score). Added to the read chance. */
export const COLD_READ = 0.4;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number) => clamp(v, 0, 1);
const wrap = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const smooth = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};

/** Small deterministic generator so a bout can be replayed from a seed. */
export class Rng {
  private s: number;
  constructor(seed = 0x2f6e2b1) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 0xffffffff;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

const makeAthlete = (side: Side, lead: 1 | -1): Athlete => ({
  side,
  pos: { x: 0, z: 0 },
  vel: { x: 0, z: 0 },
  yaw: 0,
  level: 0.45,
  lean: 0,
  hand: 0,
  lead,
  stamina: 1,
  exertion: 0,
  act: 'idle',
  actT: 0,
  actDur: Infinity,
  cooldown: 0,
  buffer: { shoot: 0, fight: 0, sprawl: 0 },
  drive: 0,
  sinceFake: 9,
  setUpT: 0,
  stats: { takedowns: 0, escapes: 0, reversals: 0, nearFalls: 0, stuffs: 0, shotsAttempted: 0 },
  stallTimer: 0,
  stallWarned: false,
  sinceTurnTry: 0,
});

export function frameApply(f: Frame, p: Place): Place {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return { x: f.x + p.x * c + p.z * s, z: f.z - p.x * s + p.z * c, yaw: f.yaw + p.yaw };
}

const TECHNIQUE_LABELS = {duckUnder:'Duck under',superDuck:'Super duck',slideBy:'Slide by',firemansCarry:'Fireman’s carry',footSweep:'Foot sweep',anklePick:'Ankle pick',kneePick:'Knee pick',throwBy:'Throw-by',lateralDrop:'Lateral drop',headlock:'Headlock'};

/** Strength of a sprawl once the attacker is already deep on the legs (crossface / head stuff). */
const DEEP_SPRAWL = 0.65;

/** Seconds between counted presses in a contest: the same rate as holding a button. */
const PRESS_INTERVAL = 0.18;

export class Bout {
  /** Only the cooperative AI partner; player defense remains fully active. */
  practicePartner: Side | null = null;
  readonly athletes: [Athlete, Athlete];
  position: Position = { kind: 'free' };
  private prev: [Command, Command];
  private effortClock: [number, number] = [0, 0];
  private lowRequest: [boolean, boolean] = [false, false];
  private techniqueRequest: [ {id: NonNullable<Command['technique']>; left: number} | null, {id: NonNullable<Command['technique']>; left: number} | null ] = [null, null];
  private scramblePending: [number, number] = [0, 0];
  private scrambleCool: [number, number] = [0, 0];
  private sitOutPending: [number, number] = [0, 0];
  /** Sit out with Lower held: a Granby roll instead. */
  private granbyPending: [number, number] = [0, 0];
  private pressCool: [number, number] = [0, 0];
  /** The human's side. The AI's press rates are its difficulty tuning, so only the human is limited. */
  pressLimitedSide: Side | null = null;
  /** Seconds after a mat return lands in which the rider's hands must come apart (locked hands, NCAA 5.8.2). */
  private lockWatch = 0;
  /** The mat return in the air: how it will land, and whether the bottom man went to turn in as he lands. */
  private returning: { base: number; slam: boolean; turnIn: boolean; escape: number; move: Position } | null = null;
  /** Hand control he had as his stand-up started; he comes up further along with it (HANDS.carry). */
  private risingHands = 0;
  /** The stand-up or return already given its one roll for a rider's own slip. */
  private handsRolled: Position | null = null;
  /** The side a person controls. His wrestler sprawls by reflex on a real shot and keeps
   *  crossfacing on the legs, so defense is not button mashing; pressing still does better. */
  assistedSide: Side | null = null;
  /** Seconds left of recent work toward the line, per side: the referee's read of a man fleeing the mat. */
  edgeOut: [number, number] = [0, 0];
  /** Randomness for looks only (lead switches); never touches outcomes. */
  private styleRng = new Rng(0x5a17c3);
  /** Each corner's match plan. The default changes nothing. */
  plans: [MatchPlan, MatchPlan] = [DEFAULT_PLAN, DEFAULT_PLAN];
  /** Each man's lead on the scoreboard (the match sets it): a lead makes the work cheaper (FATIGUE.lead). */
  scoreLead: [number, number] = [0, 0];
  /** Overtime: no cushion near empty (FATIGUE.low). */
  overtime = false;
  /** Third period or overtime (the match sets it): when clutch counts. */
  late = false;
  private plan(side: Side) { return planEffects(this.plans[side]); }
  private rng: Rng;

  private readonly styleSteps: [StyleSteps, StyleSteps];

  constructor(
    readonly wrestlers: [Wrestler, Wrestler],
    private ev: BoutEvents,
    seed: number,
  ) {
    this.athletes = [makeAthlete(0, wrestlers[0].lead), makeAthlete(1, wrestlers[1].lead)];
    this.rng = new Rng(seed);
    // Pace and brawler grades (attributeRatings.ts STYLE_EFFECT); the owner's high-pace picks count as a 5.
    this.styleSteps = wrestlers.map((w) => ({
      pace: (HIGH_PACE_NAMES as readonly string[]).includes(`${w.firstName} ${w.lastName}`) ? 2 : styleStep(w, 'pace'),
      brawl: styleStep(w, 'brawler'),
      throws: gradeStep(w, 'throws'),
      phys: gradeStep(w, 'physicality'),
      ride: gradeStep(w, 'riding'),
      turn: gradeStep(w, 'turning'),
      pin: gradeStep(w, 'pinning'),
      bottom: gradeStep(w, 'bottom'),
      shots: gradeStep(w, 'shots'),
      def: gradeStep(w, 'defense'),
      scram: gradeStep(w, 'scrambling'),
      expl: gradeStep(w, 'explosiveness'),
      end: gradeStep(w, 'endurance'),
      ath: gradeStep(w, 'athleticism'),
      clutch: gradeStep(w, 'clutch'),
      heart: gradeStep(w, 'heart'),
      scorer: scorerStep(`${w.firstName} ${w.lastName}`),
    })) as [StyleSteps, StyleSteps];
    const none = { moveX: 0, moveZ: 0, shoot: false, fight: false, sprawl: false, level: false };
    this.prev = [{ ...none }, { ...none }];
  }

  /* ------------------------------------------------------------- restarts */

  /** Square off on the starting lines. */
  setNeutral(center: Vec2, axisYaw: number, gap = 1.0): void {
    const dx = Math.sin(axisYaw);
    const dz = Math.cos(axisYaw);
    const [a, b] = this.athletes;
    a.pos = { x: center.x - (dx * gap) / 2, z: center.z - (dz * gap) / 2 };
    b.pos = { x: center.x + (dx * gap) / 2, z: center.z + (dz * gap) / 2 };
    a.yaw = axisYaw;
    b.yaw = axisYaw + Math.PI;
    for (const x of this.athletes) this.resetAthlete(x);
    this.position = { kind: 'neutral' };
  }

  /** Referee's position, `top` on the bottom man's left. */
  setReferee(top: Side, center: Vec2, facing: number): void {
    for (const x of this.athletes) {
      this.resetAthlete(x);
      x.act = 'paired';
    }
    this.position = this.matPosition(top, { x: center.x, z: center.z, yaw: facing }, 'ride', 1);
    if (this.position.kind === 'mat') this.position.whistle = HANDS.whistle;
    this.placeHold();
  }

  /**
   * The whistle from the referee's position: the top man's breakdown (OPENER) starts now. `kind` undefined lets him
   * pick his own (the AI): legs for a leg rider, otherwise mostly the chop.
   */
  whistleBreakdown(kind?: Breakdown | null): Breakdown | null {
    const s = this.position;
    if (s.kind !== 'mat' || s.sub !== 'ride' || kind === null) return null;
    if (kind === undefined) {
      const legRider = !!this.wrestlers[s.A].signature?.legRider;
      const r = this.rng.next();
      kind = legRider ? (r < 0.6 ? 'legs' : r < 0.85 ? 'chop' : 'ankle') : r < 0.38 ? 'chop' : r < 0.63 ? 'ankle' : r < 0.83 ? 'spiral' : 'legs';
    }
    s.opener = kind;
    s.openerT = OPENER.delay;
    return kind;
  }

  /** How the top man's whistle breakdown shifts the bottom man's move (OPENER): only while the whistle window lasts,
   *  or for the stand-up while he still holds the near ankle. */
  private openerEdge(s: Extract<Position, { kind: 'mat' }>, move: 'standUp' | 'switch' | 'sitOut'): number {
    if (!s.opener) return 0;
    const live = (s.whistle ?? 0) > 0 || move === 'standUp' && (s.ankleT ?? 0) > 0;
    return live ? OPENER[s.opener][move] : 0;
  }

  /** Bodies off the clock: intros, whistles, celebrations. */
  setFree(): void {
    this.position = { kind: 'free' };
    for (const x of this.athletes) {
      x.act = 'idle';
      this.scramblePending[x.side] = 0;
    this.scrambleCool[x.side] = 0;
    this.effortClock[x.side] = 0;
    this.lowRequest[x.side] = false;
    this.techniqueRequest[x.side] = null;
    x.vel = { x: 0, z: 0 };
    }
  }

  private resetAthlete(x: Athlete): void {
    this.scramblePending[x.side] = 0;
    this.scrambleCool[x.side] = 0;
    this.effortClock[x.side] = 0;
    this.lowRequest[x.side] = false;
    this.techniqueRequest[x.side] = null;
    x.vel = { x: 0, z: 0 };
    x.level = 0.45;
    x.lean = 0;
    x.hand = 0;
    x.act = 'stance';
    x.actT = 0;
    x.actDur = Infinity;
    x.cooldown = 0.3;
    x.buffer = { shoot: 0, fight: 0, sprawl: 0 };
    x.drive = 0;
    x.stallTimer = 0;
  }

  private matPosition(A: Side, frame: Frame, sub: MatSub, base: number): Position {
    return {
      kind: 'mat',
      A,
      sub,
      t: 0,
      frame,
      base,
      control: 0.5,
      escape: 0,
      expo: 0,
      awarded: 0,
      pin: 0,
      pinHold: 0,
      fight: 0,
      commit: 0,
      basing: 0,
      turnCool: 0,
      intensity: 0,
    };
  }

  /** Cancel an unconsumed shot press; an already committed move keeps wrestling. */
  cancelPendingShot(side: Side): void {
    this.athletes[side].buffer.shoot = 0;
    this.lowRequest[side] = false;
    this.prev[side] = {...this.prev[side], shoot:false, lowSingle:false};
  }

  /** A canceled/menu-boundary choice must not start after recovery. */
  cancelPendingTechnique(side: Side): void {
    this.techniqueRequest[side] = null;
    this.prev[side] = {...this.prev[side], technique:undefined};
  }

  /* ----------------------------------------------------------------- tick */

  tick(dt: number, cmds: [Command, Command]): void {
    for (const a of this.athletes) {
      let c = cmds[a.side];
      const p = this.prev[a.side];
      this.scramblePending[a.side] = c.scramble && !p.scramble ? 2.5 : Math.max(0, this.scramblePending[a.side] - dt);
      this.granbyPending[a.side] = c.sitOut && !p.sitOut && c.level ? 0.3 : Math.max(0, this.granbyPending[a.side] - dt);
      this.sitOutPending[a.side] = c.sitOut && !p.sitOut && !c.level ? 0.3 : Math.max(0, this.sitOutPending[a.side] - dt);
      if (c.lowSingle && !p.lowSingle) c = cmds[a.side] = {...c, shoot:true, level:true};
      // Buffer fresh presses so a tap just before an action opens still counts.
      // Keep one fresh press through a restart or a short return to stance.
      // Fakes, hand fighting and failed attacks should chain into a shot after
      // their recovery completes, rather than swallowing an early tap/hold.
      // Snap/sprawl commitments and paired moves do not get an extended queue.
      const shortRecovery = a.act === 'fake' || a.act === 'reach'
        || a.act === 'attackAttempt' || a.act === 'stagger' || a.act === 'sprawlRecover';
      // A fresh spin-behind press can wait through the initial sprawl recovery
      // or one failed spin's cooldown. Holding never schedules another try.
      const shotBuffer = this.position.kind === 'fhl' && this.position.A === a.side
        ? Math.max(BOUT.buffer, Math.min(0.7, this.position.cooldown + dt))
        : this.position.kind !== 'neutral' ? BOUT.buffer
        : a.act === 'stance' ? Math.max(BOUT.buffer, Math.min(0.4, a.cooldown + dt))
        : shortRecovery ? Math.max(BOUT.buffer, Math.min(0.5, Math.max(a.actDur - a.actT, a.cooldown) + dt))
        : BOUT.buffer;
      // Keep one deliberate technique through the same short recovery as Shoot.
      // A fresh ordinary action replaces an older choice; held input never retries.
      const pendingTechnique = this.techniqueRequest[a.side];
      if (this.position.kind !== 'neutral' || c.shoot && !p.shoot || c.fight && !p.fight || c.sprawl && !p.sprawl) this.techniqueRequest[a.side] = null;
      else if (pendingTechnique) {
        pendingTechnique.left -= dt;
        if (pendingTechnique.left <= 0) this.techniqueRequest[a.side] = null;
      }
      if (this.position.kind === 'neutral' && c.technique && c.technique !== p.technique) {
        if (a.act === 'stance' || shortRecovery) {
          // Neutral recovery itself advances later in this tick; allow its final step.
          this.techniqueRequest[a.side] = {id:c.technique, left:shotBuffer + dt};
          a.buffer.shoot = 0;
          this.lowRequest[a.side] = false;
        } else {
          this.ev.feedback?.(a.side, 'shoot', 'blocked', TECHNIQUE_LABELS[c.technique]);
          this.ev.announce?.('Recover before attacking', 'info', 'Finish your current movement, then try again');
        }
      }
      {
        // Same limit for presses of the attack button during a contest on the mat or legs.
        const held = a.side === this.pressLimitedSide && (this.position.kind === 'legs' || this.position.kind === 'fhl' || this.position.kind === 'mat');
        const open = !held || this.pressCool[a.side] <= 0;
        if (c.shoot && !p.shoot && held && open) this.pressCool[a.side] = PRESS_INTERVAL;
        a.buffer.shoot = c.shoot && !p.shoot && open ? shotBuffer : Math.max(0, a.buffer.shoot - dt);
      }
      const position = this.position;
      // In a contest, tapping faster than the hold rate earns nothing, so holding is always
      // as good as smashing. Attacks and neutral presses are single commitments and stay free.
      const contest = a.side === this.pressLimitedSide && (position.kind === 'fhl' || position.kind === 'legs' || position.kind === 'mat');
      this.pressCool[a.side] = Math.max(0, this.pressCool[a.side] - dt);
      const pressOpen = !contest || this.pressCool[a.side] <= 0;
      const freshFight = c.fight && !p.fight && pressOpen;
      const freshSprawl = c.sprawl && !p.sprawl && pressOpen;
      if (contest && (freshFight || freshSprawl)) this.pressCool[a.side] = PRESS_INTERVAL;
      a.buffer.fight = freshFight ? BOUT.buffer : Math.max(0, a.buffer.fight - dt);
      if (freshFight) a.tieWanted = !!c.tieUp;
      a.buffer.sprawl = freshSprawl ? BOUT.buffer : Math.max(0, a.buffer.sprawl - dt);
      const sustained = c.sustainedEffort && (position.kind === 'fhl' || position.kind === 'legs'
        || position.kind === 'mat' && (position.sub === 'standing' || position.sub === 'exposed' || position.sub === 'spladle' || position.sub === 'flat' && position.A !== a.side));
      if (sustained && (c.shoot || c.fight || c.sprawl)) {
        this.effortClock[a.side] += dt;
        if (this.effortClock[a.side] >= 0.18) {
          this.effortClock[a.side] %= 0.18;
          // Effort becomes the same buffered struggle press used by tapping.
          // Neutral attacks, stand-ups, switches and throws never auto-repeat.
          // Rear-standing hand control repeats for bottom; top's Crotch lift
          // remains one committed attempt per press, like the other returns.
          if (c.fight && !(position.kind === 'mat' && position.sub === 'standing' && position.A === a.side)) a.buffer.fight = BOUT.buffer;
          if (c.sprawl && !(position.kind === 'mat' && position.sub === 'standing')) a.buffer.sprawl = BOUT.buffer;
          if (c.shoot && (position.kind === 'legs' && position.A === a.side || position.kind === 'mat' && (position.sub === 'exposed' || position.sub === 'spladle' || position.sub === 'flat' && position.A !== a.side))) a.buffer.shoot = BOUT.buffer;
        }
      } else this.effortClock[a.side] = 0;
      // Keep the chosen entry attached to its buffered press after a quick release.
      // A new ordinary shot replaces it; expiration clears it before another attack.
      if (c.shoot && !p.shoot) this.lowRequest[a.side] = !!c.lowSingle;
      else if (a.buffer.shoot <= 0) this.lowRequest[a.side] = false;
      this.scrambleCool[a.side] = Math.max(0, this.scrambleCool[a.side] - dt);
      if (this.scramblePending[a.side] > 0 && this.scrambleCool[a.side] <= 0 && a.stamina > 0.12) this.requestScramble(a);
      a.cooldown = Math.max(0, a.cooldown - dt);
      a.actT += dt;
      a.sinceFake += dt;
      if (a.momentumT) a.momentumT = Math.max(0, a.momentumT - dt);
      a.exertion = Math.max(0, a.exertion - dt * 0.05);
    }

    const pos = this.position;
    // An opening holds a moment after it closes, so a set-up is something you can see and shoot off (owner,
    // November 10: the Shoot button lights while the shot is set up).
    for (const a of this.athletes) a.setUpT = pos.kind === 'neutral' && this.setUpNow(a.side) ? SET_UP_HOLD : pos.kind === 'neutral' ? Math.max(0, a.setUpT - dt) : 0;
    if (pos.kind === 'neutral') {
      for (const a of this.athletes) {
        const request = this.techniqueRequest[a.side];
        if (request && a.act === 'stance' && a.cooldown <= 0) {
          this.techniqueRequest[a.side] = null;
          this.tryTieAttack(a, request.id, cmds[otherSide(a.side)]);
          if (this.position !== pos) break;
        }
      }
    }
    if (this.position !== pos) {this.prev = [{...cmds[0]}, {...cmds[1]}]; return;}
    if (this.handsCall(dt, cmds)) {this.prev = [{...cmds[0]}, {...cmds[1]}]; return;}
    this.watchReturn(cmds);
    switch (pos.kind) {
      case 'free':
        break;
      case 'neutral':
        this.tickNeutral(dt, cmds);
        break;
      case 'shot':
        this.tickShot(dt, cmds, pos);
        break;
      case 'legs':
        this.tickLegs(dt, cmds, pos);
        break;
      case 'fhl':
        this.tickFhl(dt, cmds, pos);
        break;
      case 'mat':
        this.tickMat(dt, cmds, pos);
        break;
      case 'move':
        this.tickMove(dt, pos);
        break;
    }

    if (this.position.kind !== 'free') this.checkBounds();
    this.prev = [{ ...cmds[0] }, { ...cmds[1] }];
  }

  private tryTieAttack(a: Athlete, technique: NonNullable<Command['technique']>, defense: Command): void {
    if (technique === 'lateralDrop' || technique === 'headlock') { this.tryUpperThrow(a, technique, defense); return; }
    const opponent = this.athletes[otherSide(a.side)];
    const d = this.distance();
    const big = technique === 'superDuck';
    const cost = big ? 0.11 : technique === 'firemansCarry' ? 0.09 : technique === 'anklePick' || technique === 'kneePick' ? 0.06 : 0.055;
    // A tie holds out to tieRange + 0.15, so an attack off a held tie works anywhere the tie does.
    const reach = big ? 1.4 : a.hand >= 0.62 ? BOUT.tieRange + 0.15 : 1.05;
    if (d < 0.5 || d > reach || a.stamina < cost + 0.1 || (!big && a.hand < 0.35)) {
      this.ev.announce?.('Set up the attack', 'info', 'Close distance and establish hand control');
      this.setAct(a, 'attackAttempt', 0.42);
      a.attemptedTechnique = technique;
      this.ev.feedback?.(a.side, 'shoot', 'blocked', TECHNIQUE_LABELS[technique]);
      a.cooldown = 0.35; return;
    }
    this.spend(a, cost);
    const wa=this.wrestlers[a.side].attributes, wd=this.wrestlers[opponent.side].attributes;
    const opening = a.hand - opponent.hand + Math.max(0, opponent.lean);
    const success = clamp((big ? 0.28 : 0.4) + opening * 0.25 + ((wa.shots ?? wa.quickness)-wd.defense)*0.3 - STYLE_EFFECT.defFinish * this.styleSteps[opponent.side].def
      + (technique==='footSweep' && isFootSweepSpecialist(this.wrestlers[a.side]) ? 0.12 : 0)
      // The ankle pick lives on his reaction to the snap: the foot he steps up on is the one you take.
      + (technique==='anklePick' ? ((opponent.snapped ?? 0) > 0 ? 0.16 : 0) + Math.max(0, opponent.lean) * 0.2 : 0)
      // The underhook lifts his shoulder and loads the far knee.
      + (technique==='kneePick' ? 0.06 : 0)
      + (opponent.act==='reach' ? 0.18 : 0) - (defense.sprawl ? 0.2 : 0) + this.plan(a.side).tie, 0.08, 0.8);
    const wonEntry = this.rng.chance(success);
    // Some carries roll him straight to his back (CARRY_BACK): more often for the stronger, better mat wrestler.
    const toBack = wonEntry && technique === 'firemansCarry'
      && this.rng.chance(clamp(CARRY_BACK.base + (wa.strength - wd.strength) * CARRY_BACK.strength + (wa.mat - 0.5) * CARRY_BACK.mat, 0.15, 0.55));
    this.startMove(!wonEntry ? 'tieAttackCounter' : toBack ? 'firemansCarryBack' : technique, a.side, this.pairFrame(a.side), false);
    // Name the consumed attack even when it was buffered past the input frame.
    // A committed entry is still working; control is not awarded until the finish.
    this.ev.feedback?.(a.side, 'shoot', wonEntry ? 'ok' : 'lost', TECHNIQUE_LABELS[technique]);
  }

  /**
   * Upper-body throws from the clinch. The lateral drop comes off a body lock: hips in under his, lift,
   * arch and turn him to his back (Keep Kids Wrestling body lock guide; Fanatic Wrestling, pinched-elbow
   * lateral drop). The headlock is the overhook man's answer to an underhook: head and arm, hip in,
   * throw him over it (over-under hip toss; Jitsu IQ hip toss). Both land him on his back. A strong man
   * with his hips in wins them; hips back (sprawl) or a stronger man stops them, and a missed headlock
   * gives up your back.
   */
  /** How hard `o` is driving in on `a`, 0..1 (THROW_PUSH): his speed toward him plus his forward lean. */
  pushingIn(o: Athlete, a: Athlete): number {
    const dx = a.pos.x - o.pos.x, dz = a.pos.z - o.pos.z, d = Math.hypot(dx, dz) || 1;
    const toward = (o.vel.x * dx + o.vel.z * dz) / d;
    // Tied up, standing close is not driving (owner playtest, November 11: ties are common now): only his push counts.
    const tied = d < BOUT.tieRange + 0.15 && (a.hand >= 0.62 || o.hand >= 0.62);
    return clamp01((tied ? clamp01((o.drive - THROW_PUSH.tiedDrive) / (1 - THROW_PUSH.tiedDrive)) : Math.max(0, toward) / THROW_PUSH.speed) + Math.max(0, o.lean) * THROW_PUSH.lean);
  }

  private tryUpperThrow(a: Athlete, kind: 'lateralDrop' | 'headlock', defense: Command): void {
    const o = this.athletes[otherSide(a.side)];
    const d = this.distance();
    const hisHooks = o.hand >= 0.62 && (o.tie === 'underhook' || o.tie === 'bodyLock');
    const set = kind === 'lateralDrop' ? a.hand >= 0.62 && a.tie === 'bodyLock' : hisHooks;
    const cost = 0.1;
    if (!set || d > BOUT.tieRange + 0.15 || a.stamina < cost + 0.1) {
      this.ev.announce?.('Set up the throw', 'info', kind === 'lateralDrop' ? 'Pummel for double underhooks first' : 'He needs an underhook on you');
      this.setAct(a, 'attackAttempt', 0.42);
      this.ev.feedback?.(a.side, 'fight', 'blocked', TECHNIQUE_LABELS[kind]);
      a.cooldown = 0.35; return;
    }
    this.spend(a, cost);
    const wa = this.wrestlers[a.side].attributes, wo = this.wrestlers[o.side].attributes;
    // Driving in on him (THROW_PUSH): his own momentum is what launches him.
    const push = this.pushingIn(o, a);
    const p = clamp((kind === 'lateralDrop' ? THROW_PUSH.dropBase : THROW_PUSH.headlockBase) + ((wa.throws ?? wa.strength) - wo.strength) * 0.35 + (wa.quickness - wo.quickness) * 0.1
      + STYLE_EFFECT.throwOdds * this.styleSteps[a.side].throws - STYLE_EFFECT.physResist * this.styleSteps[o.side].phys
      + Math.max(0, o.lean) * 0.3 + (o.act === 'reach' || o.act === 'swim' ? 0.12 : 0) - (defense.sprawl ? 0.25 : 0) + this.plan(a.side).tie
      + push * THROW_PUSH.odds, 0.08, THROW_PUSH.cap);
    if (this.rng.chance(p)) {
      this.startMove(kind === 'lateralDrop' ? 'lateralDrop' : 'headlockThrow', a.side, this.pairFrame(a.side), false);
      // Thrown off his own drive: a burst (TIMING), faster and landing harder.
      this.burst(push, a.side);
      this.ev.feedback?.(a.side, 'fight', 'won', TECHNIQUE_LABELS[kind]);
      return;
    }
    this.ev.feedback?.(a.side, 'fight', 'lost', TECHNIQUE_LABELS[kind]);
    // Missed: he sags his hips and stays square (both reset), or he steps behind the open back.
    if (this.rng.chance(kind === 'headlock' ? 0.45 : 0.35)) {
      this.startMove('throwBy', o.side, this.pairFrame(o.side), false);
      return;
    }
    a.hand = 0.3; a.tie = undefined;
    this.setAct(a, 'stagger', 0.5);
  }

  /**
   * Pummel: swim an arm inside his for the underhook (Evolve University pummeling drill; Mike Krause
   * over-under plan). From his underhook you take your own back; from your underhook you swim the
   * second arm in for double unders, a body lock.
   */
  private pummel(a: Athlete, o: Athlete, second: boolean): void {
    this.setAct(a, 'swim', 0.4);
    this.spend(a, TAP_COST.pummel);
    const wa = this.wrestlers[a.side].attributes, wo = this.wrestlers[o.side].attributes;
    const p = clamp(0.5 + (wa.quickness - wo.quickness) * 0.3 + (wa.strength - wo.strength) * 0.2 + (a.stamina - o.stamina) * 0.2
      + STYLE_EFFECT.physPummel * (this.styleSteps[a.side].phys - this.styleSteps[o.side].phys)
      + this.plan(a.side).handFight + this.plan(a.side).tie * 0.5 - (second ? TIE_UP.lockHard : 0), 0.15, 0.85);
    if (!this.rng.chance(p)) {
      o.hand = Math.min(1, o.hand + 0.06);
      if (second) a.hand = Math.max(0.62, a.hand - 0.08);
      this.ev.feedback?.(a.side, 'fight', 'lost', 'Pummel');
      return;
    }
    if (second) {
      a.tie = 'bodyLock';
      a.hand = Math.max(a.hand, 0.85);
      o.hand = Math.min(o.hand, 0.3);
      o.tie = undefined;
      this.ev.announce?.('Body lock', 'info', 'Double underhooks: Hand fight to throw');
    } else {
      a.tie = 'underhook';
      a.hand = Math.max(a.hand, 0.7);
      // Out of a body lock he keeps one arm in (over-under); out of an underhook he loses it.
      if (o.tie === 'bodyLock') { o.tie = 'underhook'; o.hand = 0.66; }
      // Out of a collar tie he keeps the overhook side (TIE_UP): over-under, his headlock is there.
      else if (o.tie === 'collar' && o.hand >= 0.62) { o.hand = Math.max(TIE_UP.back, o.hand - 0.04); }
      else { o.tie = undefined; o.hand = Math.min(o.hand, 0.5); }
    }
    this.ev.feedback?.(a.side, 'fight', 'won', 'Pummel');
  }

  private requestScramble(a: Athlete): void {
    const s = this.position;
    if (s.kind === 'free' || s.kind === 'neutral') { this.scramblePending[a.side] = 0; return; }
    if (s.kind === 'move') {
      const def = MOVES[s.id];
      if (s.awarded || !def.award || !['takedown','reversal','escape'].includes(def.award.kind)) return;
      const attacker = def.award.to === 'A' ? s.A : otherSide(s.A);
      if (a.side === attacker) { this.scramblePending[a.side] = 0; this.scrambleCool[a.side] = 1.4; this.spend(a, 0.07); s.scrambleGuard = 1.4; return; }
      const sa = this.wrestlers[a.side].attributes, so = this.wrestlers[otherSide(a.side)].attributes;
      const chance = clamp(0.22 - (s.scrambleGuard ? 0.18 : 0) + (sa.scrambling ?? sa.quickness) * 0.24 - (so.scrambling ?? so.quickness) * 0.12
        + STYLE_EFFECT.scrambleOdds * (this.styleSteps[a.side].scram - 0.5 * this.styleSteps[otherSide(a.side)].scram), 0.1, 0.5);
      this.scramblePending[a.side] = 0; this.scrambleCool[a.side] = 1.4; this.spend(a, 0.07);
      if (a.side !== attacker && this.rng.chance(chance)) {
        if (def.award.kind === 'takedown') {
          const source = s.sourceContest;
          if (source?.kind === 'fhl') {
            // The defender squares up where the spin was stopped; do not send
            // the top wrestler all the way back around to the old front.
            this.position = {kind:'fhl', A:s.A, mirror:s.mirror, t:0, frame:this.pairFrame(s.A), recover:source.recover, intensity:1, cooldown:0.35};
          } else {
            // Clip names cannot identify the original leg in a lifted finish.
            // Keep ankle attacks low and keep an elevated capture elevated.
            const shot = source?.shot ?? (s.id.toLowerCase().includes('double') ? 'double' : s.id.toLowerCase().includes('highcrotch') ? 'highCrotch' : s.id === 'finishLowSingle' ? 'lowSingle' : 'single');
            this.position = {kind:'legs', A:s.A, shot, lifted:source?.lifted, legFinish:source?.legFinish, mirror:s.mirror, t:0, frame:s.frame, progress:0.48, intensity:1};
          }
        }
        else {
          const mat = this.matPosition(s.A, s.frame, def.award.kind === 'escape' ? 'standing' : 'ride', 0.8);
          if (mat.kind === 'mat') { mat.mirror = s.mirror; mat.control = 0.3; mat.escape = 0.4; }
          this.position = mat;
        }
        this.placeHold(); this.ev.announce?.('Scramble!', 'info', 'Finish disrupted — control still contested');
      }
      return;
    }
    if (s.kind === 'shot') return;
    this.scramblePending[a.side] = 0;
    const o = this.athletes[otherSide(a.side)];
    const w = this.wrestlers[a.side];
    const specialist = isScrambleSpecialist(`${w.firstName} ${w.lastName}`);
    const skill = (w.attributes.scrambling ?? w.attributes.quickness) * (specialist ? 1.18 : 1) * (1 + STYLE_EFFECT.scrambleSkill * this.styleSteps[a.side].scram);
    this.scrambleCool[a.side] = 1.4;
    this.spend(a, 0.07);
    this.ev.announce?.('Scramble!', 'info', 'Control is still contested');
    if (s.kind === 'legs') {
      // Hip separation and a corner change: no score until the finish wins control.
      const delta = 0.09 * skill * (0.5 + a.stamina) - 0.04 * this.wrestlers[o.side].attributes.defense;
      s.progress = clamp(s.progress + (s.A === a.side ? delta : -delta), 0.02, 0.98);
      s.intensity = 1;
      s.frame.yaw += (s.A === a.side ? 1 : -1) * 0.18;
    } else if (s.kind === 'fhl') {
      s.recover = clamp(s.recover + (s.A === a.side ? -1 : 1) * 0.14 * skill, 0, 1);
      s.intensity = 1;
    } else if (s.kind === 'mat') {
      if (s.A !== a.side) {
        s.base = Math.min(1, s.base + 0.12 * skill);
        s.control = Math.max(0, s.control - 0.1 * skill);
        // Existing switch/escape/fight-off checks decide the outcome.
        a.buffer[s.sub === 'exposed' ? 'sprawl' : s.sub === 'standing' ? 'shoot' : 'fight'] = BOUT.buffer;
      } else {
        s.control = Math.min(1, s.control + 0.07 * skill);
        a.buffer.fight = BOUT.buffer;
      }
      s.intensity = 1;
    }
  }

  /** Consume a buffered press. */
  private take(a: Athlete, b: 'shoot' | 'fight' | 'sprawl'): boolean {
    if (a.buffer[b] > 0) {
      a.buffer[b] = 0;
      return true;
    }
    return false;
  }

  distance(): number {
    const [a, b] = this.athletes;
    return Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
  }

  private setAct(a: Athlete, act: Act, dur: number): void {
    a.act = act;
    a.actT = 0;
    // An athlete is back from an off-balance moment sooner (STYLE_EFFECT.athRecover per step).
    a.actDur = act === 'stagger' || act === 'sprawlRecover' || act === 'headUp' ? dur * this.athBack(a.side) : dur;
  }

  /** How long his off-balance moments last against the usual (athleticism). */
  private athBack(side: Side): number {
    return Math.max(0.5, 1 - STYLE_EFFECT.athRecover * this.styleSteps[side].ath);
  }

  /** Reflex sprawl for the assisted side: a good defender reacts more often and sooner,
   *  but always later than an early read on the level change. Fakes get no reflex. */
  private reflexFor(side: Side, dur: number, cold = false): number {
    // The person's side always has it; the AI gets a share of it on levels that set shotDefense,
    // so an even opponent is not a takedown machine's practice dummy on the easier levels.
    const share = side === this.assistedSide ? 1 : this.wrestlers[side].shotDefense ?? 0;
    if (share <= 0) return -1;
    const def = this.wrestlers[side].attributes.defense;
    // Tired, he reads it later and less often (FATIGUE.read).
    const fresh = 1 - FATIGUE.read * (1 - this.athletes[side].stamina);
    // A defensive grade sharpens the AI's read, not the person's own reflex (owner, November 12): his reactions are his.
    const read = side === this.assistedSide ? 0 : STYLE_EFFECT.defRead * this.styleSteps[side].def;
    if (!this.rng.chance(Math.min(0.95, (0.25 + def * 0.4 + read + (cold ? COLD_READ : 0)) * share * fresh))) return -1;
    // A cold shot is seen coming: the hips go back earlier.
    return dur * (0.65 - def * 0.25) * (cold ? 0.75 : 1);
  }

  /** Rating edge for a side, -1..1: a 15-point rating gap is the full edge. The better man scores
   *  more takedowns and near falls and gives up fewer; the gap matters more the wider it is. */
  private edge(side: Side): number {
    const r = (w: Wrestler) => w.performanceRating ?? w.rating ?? (Object.values(w.attributes).reduce((s, v) => s + v, 0) / 5) * 100;
    return clamp((r(this.wrestlers[side]) - r(this.wrestlers[otherSide(side)])) / 15 + this.moment(side) - this.moment(otherSide(side)), -1, 1);
  }

  /** Clutch, heart and scorer (STYLE_EFFECT): a clutch man's edge late in a close match, a man with heart's while
   *  trailing, a bonus-point scorer's once he is up by a major (chasing the tech fall). */
  private moment(side: Side): number {
    const lead = this.scoreLead[side], st = this.styleSteps[side];
    return (this.late && Math.abs(lead) <= STYLE_EFFECT.clutchClose ? STYLE_EFFECT.clutchEdge * st.clutch : 0)
      + (lead < 0 ? STYLE_EFFECT.heartEdge * st.heart : 0)
      + (lead >= STYLE_EFFECT.scorerLead ? STYLE_EFFECT.scorerEdge * st.scorer : 0);
  }

  private spend(a: Athlete, amount: number): void {
    const w = this.wrestlers[a.side];
    if ((a.momentumT ?? 0) > 0) amount *= FATIGUE.momentumSpend;
    // Owner playtest (FATIGUE): cheaper on top, a little cheaper underneath, cheaper with a lead, and slower near empty.
    const top = this.top;
    if (top === a.side) amount *= FATIGUE.topSpend;
    else if (top !== null) amount *= FATIGUE.bottomSpend;
    amount *= 1 - FATIGUE.lead * clamp01(this.scoreLead[a.side] / FATIGUE.leadAt);
    if (!this.overtime) amount *= clamp(a.stamina / FATIGUE.low, FATIGUE.lowMin, 1);
    // A high-pace man is built for the work on his feet; a slow-pace man pays more for it.
    if (top === null) amount *= 1 - STYLE_EFFECT.paceWork * this.styleSteps[a.side].pace;
    // Heart: he keeps working on an empty tank.
    if (a.stamina < STYLE_EFFECT.heartLow) amount *= 1 - STYLE_EFFECT.heartTired * this.styleSteps[a.side].heart;
    a.stamina = Math.max(0, a.stamina - amount * (1.25 - w.attributes.conditioning * 0.5) * this.plan(a.side).stamina * (1 - STYLE_EFFECT.endSpend * this.styleSteps[a.side].end));
    a.exertion = Math.min(1, a.exertion + amount * 3);
  }

  /** A brawler (grade 4–5) takes `amount` per step of stamina out of the other man; finesse and ungraded men take none. */
  private brawlerWear(a: Athlete, o: Athlete, amount: number): void {
    const step = this.styleSteps[a.side].brawl;
    if (step > 0) this.spend(o, amount * step);
  }

  /** He scored: the crowd lifts him for a moment (owner: momentum, short-term energy). */
  momentum(side: Side, points: number): void {
    const a = this.athletes[side];
    a.stamina = Math.min(1, a.stamina + FATIGUE.momentum * Math.min(1, points / 3));
    a.momentumT = FATIGUE.momentumT;
  }

  /** A stoppage, the walk back or the period break: both men get a breath (FATIGUE.rest). */
  rest(dt: number): void {
    for (const a of this.athletes) this.recoverStamina(a, dt, FATIGUE.rest);
  }

  private recoverStamina(a: Athlete, dt: number, rate: number): void {
    const w = this.wrestlers[a.side];
    a.stamina = Math.min(1, a.stamina + dt * rate * (0.6 + w.attributes.conditioning * 0.8) * (1 + STYLE_EFFECT.endRecover * this.styleSteps[a.side].end));
  }

  /* -------------------------------------------------------------- neutral */

  private tickNeutral(dt: number, cmds: [Command, Command]): void {
    const [A, B] = this.athletes;

    // Finish timed acts.
    for (const a of this.athletes) {
      if (a.actT < a.actDur) continue;
      const o = this.athletes[otherSide(a.side)];
      switch (a.act) {
        case 'reach':
          this.resolveReach(a, o);
          break;
        case 'snap':
          if (this.resolveSnap(a, o)) return;
          break;
        case 'sprawl':
          // Tired, he comes back up slower from a bite: the window for the reshot (FATIGUE.fakeRecover).
          this.setAct(a, 'sprawlRecover', BOUT.sprawlRecover * (1 + FATIGUE.fakeRecover * (1 - a.stamina)));
          break;
        case 'sprawlRecover':
        case 'attackAttempt':
        case 'fake':
        case 'stagger':
        case 'swat':
        case 'tieArm':
        case 'headUp':
        case 'swim':
          this.setAct(a, 'stance', Infinity);
          break;
        default:
          break;
      }
    }

    // Decisions, in a random order so neither side always acts first.
    const order: Side[] = this.rng.chance(0.5) ? [0, 1] : [1, 0];
    for (const s of order) {
      if (this.position.kind !== 'neutral') return;
      this.neutralDecide(this.athletes[s], this.athletes[otherSide(s)], cmds[s], cmds[otherSide(s)]);
    }
    if (this.position.kind !== 'neutral') return;

    this.neutralMotion(dt, cmds);
    void A;
    void B;
  }

  private neutralDecide(a: Athlete, o: Athlete, cmd: Command, defense: Command): void {
    const free = a.act === 'stance' && a.cooldown <= 0;
    const dist = this.distance();

    // A bite or a swat makes you late, not helpless: the hips can still go back.
    if (a.buffer.sprawl > 0 && (a.act === 'stance' || a.act === 'fake' || a.act === 'reach' || a.act === 'headUp' || a.act === 'swat' || a.act === 'tieArm')) {
      this.take(a, 'sprawl');
      this.setAct(a, 'sprawl', BOUT.sprawlDur);
      this.spend(a, 0.05);
      this.ev.feedback?.(a.side, 'sprawl', 'ok');
      return;
    }
    if (!free) return;

    // The AI's fake: drop the level as if shooting, without committing (a player fakes from outside range).
    if (cmd.fake && a.buffer.shoot <= 0) {
      this.ev.tell?.(o.side, 'fake');
      this.setAct(a, 'fake', BOUT.fakeDur);
      a.sinceFake = 0;
      this.spend(a, TAP_COST.fake);
      return;
    }

    if (a.buffer.shoot > 0) {
      // The tie decides the attack: knee pick off the underhook; ankle pick off the
      // collar tie while he is reacting to the snap or leaning in. Otherwise a shot.
      const tied = a.hand >= 0.62 && dist <= BOUT.tieRange + 0.15;
      const pick = tied && a.tie === 'underhook' ? 'kneePick'
        : tied && a.tie === 'collar' && ((o.snapped ?? 0) > 0 || o.lean > 0.1 || o.act === 'stagger' || o.act === 'reach') ? 'anklePick' : undefined;
      if (pick) {
        this.take(a, 'shoot');
        this.tryTieAttack(a, pick, defense);
        return;
      }
      this.take(a, 'shoot');
      const inRange = dist >= BOUT.shotMin && dist <= BOUT.shotMax;
      const exhausted = inRange && a.stamina <= BOUT.shotStamina;
      if (inRange && a.stamina > BOUT.shotStamina) {
        // Off a collar tie the shot is a high crotch: the tie pulls his head and the near leg comes
        // with it (owner, November 9: high crotch as a real option, not only an athlete's style).
        this.startShot(a, o, dist, tied && a.tie !== 'underhook' ? 'highCrotch' : undefined);
      } else {
        // Keep the level-change attempt and recovery; explain when fatigue,
        // rather than range, prevents the wrestler from committing to a shot.
        // A level change reads like a shot until it is not: the defender's cue to sprawl.
        this.ev.tell?.(o.side, 'fake');
        this.setAct(a, 'fake', BOUT.fakeDur);
        a.sinceFake = 0;
        this.spend(a, TAP_COST.fake);
        if (exhausted) this.ev.announce?.('Too tired to shoot', 'info', `${this.wrestlers[a.side].lastName}: recover stamina, then try again`);
        this.ev.feedback?.(a.side, 'shoot', exhausted || dist > BOUT.shotMax ? 'blocked' : 'ok');
      }
      return;
    }

    if (a.buffer.fight > 0) {
      this.take(a, 'fight');
      if (dist > BOUT.tieRange + 0.2) {
        this.setAct(a, 'reach', BOUT.reachDur);
        this.ev.feedback?.(a.side, 'fight', 'blocked');
        return;
      }
      if (a.hand >= 0.62 && a.tie === 'bodyLock') {
        // Double unders: the same button throws him (lateral drop).
        this.tryTieAttack(a, 'lateralDrop', defense);
        return;
      }
      if (a.hand >= 0.62 && a.tie === 'underhook') {
        // Low, pummel the second arm in for a body lock; otherwise the same button throws him by.
        if (cmd.level) { this.pummel(a, o, true); return; }
        this.tryTieAttack(a, 'throwBy', defense);
        return;
      }
      if (o.hand >= 0.62 && (o.tie === 'underhook' || o.tie === 'bodyLock') && dist <= BOUT.tieRange + 0.15) {
        // He has an underhook on you: pummel, swim your own arm back inside.
        this.pummel(a, o, false);
        return;
      }
      if (a.hand >= 0.62 && a.tie === 'collar' && cmd.level) {
        // Tied up, low: pummel for the underhook (TIE_UP). He keeps the overhook side, so his headlock is on.
        this.pummel(a, o, false);
        return;
      }
      if (a.hand >= 0.62) {
        this.setAct(a, 'snap', BOUT.snapDur);
        this.spend(a, TAP_COST.snap);
        this.ev.tell?.(o.side, 'snap');
        o.snapped = 0.9;
      } else {
        this.setAct(a, 'reach', BOUT.reachDur);
        this.spend(a, TAP_COST.reach);
        a.tieIn = dist <= TIE_UP.range && !!a.tieWanted;
      }
    }
    void cmd;
  }

  /**
   * A reach is a head tap or pull. The defender always answers it: hand fight back to swat it
   * away (or tie up the wrist if he already has a hand), circle off, or, if he does neither and
   * his reflex misses, his head pops up and he has bitten: the attacker's moment to go.
   */
  private resolveReach(a: Athlete, o: Athlete): void {
    this.setAct(a, 'stance', Infinity);
    if (this.distance() > BOUT.tieRange + 0.2) return;
    const wa = this.wrestlers[a.side].attributes;
    const wo = this.wrestlers[o.side].attributes;
    const tieIn = !!a.tieIn; a.tieIn = false;
    let p = 0.55 + (wa.quickness - wo.quickness) * 0.4 + (a.stamina - o.stamina) * 0.2 + this.plan(a.side).handFight + (tieIn ? TIE_UP.odds : 0);
    if (o.act === 'reach') p -= 0.18;
    if (o.act !== 'stance' && o.act !== 'reach') p += 0.2;
    // His answer. A deliberate one first: hand fighting back, or circling off the tap.
    const dx = a.pos.x - o.pos.x, dz = a.pos.z - o.pos.z, dd = Math.hypot(dx, dz) || 1;
    const lateral = Math.abs((o.vel.x * dz - o.vel.z * dx) / dd);
    const fought = o.buffer.fight > 0 || o.act === 'reach';
    if (o.act === 'stance' && lateral > 0.55) {
      // Circled off it: the hand finds nothing.
      this.ev.feedback?.(a.side, 'fight', 'lost');
      return;
    }
    if (o.act === 'stance' || o.act === 'reach') {
      // Otherwise his reflex: a good hand fighter swats more; a quick tapper beats it more.
      const answer = (fought ? clamp(1 - p + 0.35, 0.2, 0.9) : clamp(0.45 + wo.defense * 0.4 - (wa.quickness - wo.quickness) * 0.4 - this.plan(a.side).handFight, 0.2, 0.88)) * (tieIn ? TIE_UP.answer : 1);
      if (this.rng.chance(answer)) {
        if (fought && o.hand >= 0.3) {
          o.hand = Math.min(1, o.hand + 0.18);
          a.hand = Math.max(0, a.hand - 0.12);
          this.setAct(o, 'tieArm', 0.35);
        } else {
          o.hand = Math.min(1, o.hand + 0.06);
          this.setAct(o, 'swat', 0.25);
        }
        this.ev.feedback?.(a.side, 'fight', 'lost');
        return;
      }
      // He bit: the head comes up. The tap still lands and the shot is open. (Stepping in to tie up is not a tap.)
      if (!tieIn) {
        o.opened = 0.7;
        this.setAct(o, 'headUp', 0.3);
        this.ev.tell?.(a.side, 'opening');
      }
      p = 1;
    }
    if (this.rng.chance(clamp(p, 0.12, 0.92))) {
      const wasTied = a.hand >= 0.62;
      a.hand = Math.min(1, tieIn ? Math.max(TIE_UP.lock, a.hand + 0.36) : a.hand + 0.36);
      // Pummel low and you come up with the underhook; tall, you get the collar tie.
      if (!wasTied && a.hand >= 0.62) a.tie = a.level < 0.33 ? 'underhook' : 'collar';
      if (tieIn && !wasTied && this.rng.chance(TIE_UP.backOdds)) {
        // Head to head: he ties right back (a collar tie, or the overhook side of your underhook).
        o.hand = Math.max(o.hand, TIE_UP.back);
        if (o.tie === undefined || o.tie === 'bodyLock') o.tie = 'collar';
      } else o.hand = Math.max(0, o.hand - 0.24);
      this.ev.feedback?.(a.side, 'fight', 'won', tieIn && !wasTied ? 'Tie up' : undefined);
      // Heavy hands: a brawler's tap that lands takes something out of him.
      this.brawlerWear(a, o, STYLE_EFFECT.brawlTap);
    } else {
      o.hand = Math.min(1, o.hand + 0.12);
      this.ev.feedback?.(a.side, 'fight', 'lost');
    }
  }

  private resolveSnap(a: Athlete, o: Athlete): boolean {
    this.setAct(a, 'stance', Infinity);
    const wa = this.wrestlers[a.side].attributes;
    const wo = this.wrestlers[o.side].attributes;
    let p =
      0.22 +
      Math.max(0, o.lean) * 0.75 +
      Math.max(0, o.level - 0.45) * 0.6 +
      (a.hand - o.hand) * 0.25 +
      (wa.strength - wo.strength) * 0.2 -
      STYLE_EFFECT.physResist * this.styleSteps[o.side].phys +
      this.plan(a.side).snap +
      // Tired legs: easier to snap down (FATIGUE.snap).
      (1 - o.stamina) * FATIGUE.snap;
    if (o.act === 'reach' || o.act === 'stagger' || o.act === 'sprawlRecover' || o.act === 'fake') p += 0.25;
    if (o.act === 'sprawl') p -= 0.3;
    if (this.distance() < BOUT.tieRange + 0.15 && this.rng.chance(clamp(p, 0.08, 0.9))) {
      this.ev.feedback?.(a.side, 'fight', 'won');
      this.brawlerWear(a, o, STYLE_EFFECT.brawlTap);
      this.startMove('snapDown', a.side, this.pairFrame(a.side), false);
      // Snapped right as he reaches, fakes or stumbles (or hangs his weight forward): a burst (TIMING).
      const caught = o.act === 'reach' || o.act === 'stagger' || o.act === 'sprawlRecover' || o.act === 'fake';
      this.burst(caught ? 1 : clamp01((o.lean - 0.15) * 2), a.side);
      return true;
    }
    // He postured up: you are reaching and falling forward.
    a.lean = Math.min(1, a.lean + 0.5);
    this.setAct(a, 'stagger', 0.34);
    o.hand = Math.min(1, o.hand + 0.15);
    a.hand = Math.max(0, a.hand - 0.25);
    this.ev.feedback?.(a.side, 'fight', 'lost');
    return false;
  }

  /** Is a shot by this side set up right now (a fake, a hand-fight edge, a reaction to catch, his lean, an
   *  angle)? A shot without any of these is cold: COLD_SHOT, COLD_READ, and the AI fakes first instead. */
  shotSetUp(side: Side): boolean {
    return this.athletes[side].setUpT > 0 || this.setUpNow(side);
  }

  /** The opening right now: his reaction, a fake, the hands, his lean or an angle. */
  private setUpNow(side: Side): boolean {
    const a = this.athletes[side];
    const o = this.athletes[otherSide(side)];
    const off = wrap(Math.atan2(a.pos.x - o.pos.x, a.pos.z - o.pos.z) - o.yaw);
    return o.act === 'reach' || o.act === 'snap' || o.act === 'stagger' || o.act === 'sprawlRecover'
      || a.sinceFake < 1.2 || o.lean > 0.15 || a.hand - o.hand > 0.2 || Math.abs(off) > 0.36
      // Heavy legs: a tired man is an opening on his own (FATIGUE.openings).
      || o.stamina < FATIGUE.openings;
  }

  private startShot(a: Athlete, o: Athlete, dist: number, prefer?: ShotKind): void {
    const wa = this.wrestlers[a.side].attributes;
    const alreadySprawling = o.act === 'sprawl';
    a.stats.shotsAttempted += 1;
    this.spend(a, 0.08);
    // Shooting on his failed shot (or chaining a blocked one): a reshot.
    const stumbling = (o.reshot ?? 0) > 0 && o.act === 'stagger';
    if (stumbling || (a.chain ?? 0) > 0 && o.act === 'sprawlRecover') {
      this.ev.announce?.('Reshot!', 'info');
      o.reshot = 0; a.chain = 0;
    }

    // Both shooting at once is a clash of heads, not a takedown.
    if (o.act === 'paired' || (o.buffer.shoot > 0 && o.act === 'stance')) {
      this.ev.announce?.('Scramble', 'info');
      this.startMove('clash', a.side, this.pairFrame(a.side), false);
      return;
    }

    // Individual tendencies choose the attack; an angle favors the near leg.
    // Keep the original selection for athletes without a researched profile.
    const toA = Math.atan2(a.pos.x - o.pos.x, a.pos.z - o.pos.z);
    const off = wrap(toA - o.yaw);
    const angled = Math.abs(off) > 0.36;
    // Wrestlers without a researched style: the high crotch is the most common shot (owner, November 9: "high
    // crotches should be much higher"), then the single (44-46% of NCAA D1 quarterfinal takedowns, D3wrestle
    // "More D1 Quarterfinal Analysis", 2014), then the double. It was 70% double / 30% single, no high crotch.
    const style = this.wrestlers[a.side].motion?.shots ?? { double: 0.25, single: 0.35, highCrotch: 0.4 };
    const weights = style;
    const double = angled ? weights.double * 0.25 : weights.double;
    const single = angled ? weights.single * 1.6 : weights.single;
    const roll = this.rng.next() * (double + single + weights.highCrotch);
    const focus = this.plan(a.side);
    const shot: ShotKind = !this.lowRequest[a.side] && prefer ? prefer : !this.lowRequest[a.side] && focus.shot && !angled ? focus.shot : this.lowRequest[a.side] || this.wrestlers[a.side].firstName === 'John' && this.wrestlers[a.side].lastName === 'Smith' && this.rng.chance(0.7) ? 'lowSingle'
      : roll < double ? 'double' : roll < double + single ? 'single' : 'highCrotch';
    // Near-leg attacks mirror when entering from his left.
    // Base high-crotch clip penetrates with the left foot and inside left arm.
    const hand = this.wrestlers[a.side].motion?.highCrotchHand;
    const mirror = shot === 'highCrotch' && hand ? hand === 'right' : shot !== 'double' ? off < 0 : false;

    const fd = clamp01(1 - Math.abs(dist - BOUT.shotIdeal) / 0.55);
    const fl = clamp01(0.5 + (o.level - a.level) * 1.2);
    let q = 0.22 + fd * 0.38 + fl * 0.2;
    if (o.act === 'reach' || o.act === 'snap' || o.act === 'stagger' || o.act === 'sprawlRecover') q += 0.25;
    if (a.sinceFake < 1.2) q += 0.12;
    q += Math.max(0, o.lean) * 0.3;
    q += (a.hand - o.hand) * 0.2;
    if (angled) q += 0.08;
    // Going right as he bites on the tap: his head and hips are up, which the level term
    // already rewards; no extra bonus on top.
    q += focus.attack + (shot === focus.shot ? focus.shotBonus : 0) + 0.14 * this.edge(a.side) + STYLE_EFFECT.shotQuality * this.styleSteps[a.side].shots;
    // Set it up, then execute: a cold shot (no fake, no hand-fight edge, no reaction to catch, no lean, no
    // angle) is easy to read and gets sprawled on or fought off in the legs far more often. Owner, November 10:
    // a low-percentage shot with no setup should rarely score and should often be countered for points; the
    // defender also reads it sooner (COLD_READ, reflexFor and the AI's onTell) and a stopped one ends in his
    // front headlock, not a reset.
    const setUp = this.shotSetUp(a.side);
    if (!setUp) q -= COLD_SHOT;
    // Tired shots are bad shots; an aggressive plan keeps taking them.
    q -= (1 - a.stamina) * 0.25 * focus.tiredShot;
    q = clamp(q, 0.05, 1);

    // Timing (TIMING): right off his reaction, or a reshot, is a burst; set up is good; cold is telegraphed.
    const live = stumbling || o.act === 'reach' || o.act === 'snap' || o.act === 'stagger' || o.act === 'sprawlRecover';
    const timing = live ? 1 : setUp ? TIMING.setUp : 0;
    const speed = live ? TIMING.fast : setUp ? 1 - (1 - TIMING.fast) * TIMING.setUp : TIMING.cold;
    const dur = speed * (1 / weightPhysics(this.wrestlers[a.side].weightClass).mobility) * (0.3 + 0.28 * Math.max(0, dist - 0.65)) * (1.12 - (wa.shots ?? wa.quickness) * 0.25) * (1 - STYLE_EFFECT.shotSpeed * this.styleSteps[a.side].shots - STYLE_EFFECT.explShot * this.styleSteps[a.side].expl) * (1 + (1 - a.stamina) * 0.3);
    const frame = this.pairFrame(a.side);
    for (const x of this.athletes) {
      x.act = 'paired';
      x.actT = 0;
    }
    this.position = {
      kind: 'shot',
      A: a.side,
      shot,
      mirror,
      t: 0,
      dur,
      frame,
      quality: q,
      dist,
      sprawlAt: alreadySprawling ? 0 : -1,
      stuffRoll: this.rng.next(),
      reflexAt: stumbling ? -1 : this.reflexFor(o.side, dur, !setUp),
      stumbling,
      cold: !setUp,
      timing,
    };
    this.ev.move?.(MOVES[SHOT_CLIPS[shot]], a.side);
    this.ev.tell?.(o.side, 'shot');
    this.ev.feedback?.(a.side, 'shoot', 'ok');
  }

  private neutralMotion(dt: number, cmds: [Command, Command]): void {
    const [A, B] = this.athletes;
    let dx = B.pos.x - A.pos.x;
    let dz = B.pos.z - A.pos.z;
    let dist = Math.hypot(dx, dz) || 1e-4;
    let nx = dx / dist;
    let nz = dz / dist;

    for (const a of this.athletes) {
      const c = cmds[a.side];
      const w = this.wrestlers[a.side].attributes;
      const toward = a.side === 0 ? 1 : -1;
      a.drive = clamp((c.moveX * nx + c.moveZ * nz) * toward, -1, 1);

      // Level: Shift drops it; acts override.
      let levelTarget = c.level ? 0.2 : 0.45;
      if (a.act === 'sprawl') levelTarget = 0.05;
      else if (a.act === 'fake') levelTarget = 0.15;
      else if (a.act === 'sprawlRecover') levelTarget = 0.25;
      else if (a.act === 'stagger') levelTarget = 0.5;
      else if (a.act === 'headUp') levelTarget = 0.62;
      a.level += (levelTarget - a.level) * Math.min(1, dt * (a.act === 'sprawl' ? 14 : 7));

      const mobile = a.act === 'stance' || a.act === 'reach' || a.act === 'fake' || a.act === 'snap' || a.act === 'swat' || a.act === 'tieArm' || a.act === 'headUp';
      const levelK = 0.55 + 0.45 * clamp01((a.level - 0.12) / 0.33);
      const gas = 0.65 + 0.35 * a.stamina;
      const speed = BOUT.maxSpeed * weightPhysics(this.wrestlers[a.side].weightClass).mobility * levelK * gas * (a.act === 'stance' ? 1 : 0.5) * (0.9 + w.quickness * 0.2) * (1 + STYLE_EFFECT.athMove * this.styleSteps[a.side].ath);
      const len = Math.hypot(c.moveX, c.moveZ);
      let mx = len > 1 ? c.moveX / len : c.moveX;
      let mz = len > 1 ? c.moveZ / len : c.moveZ;
      // Circling a man you are tied up with is slow: the tangential part of
      // the move shrinks as the gap closes, so the pair turns at a human rate.
      const ux = nx * toward;
      const uz = nz * toward;
      const radial = mx * ux + mz * uz;
      const tx0 = mx - radial * ux;
      const tz0 = mz - radial * uz;
      const turnK = Math.max(0.25, Math.min(1, (dist - 0.45) / 0.9));
      mx = radial * ux + tx0 * turnK;
      mz = radial * uz + tz0 * turnK;
      const tx = mobile ? mx * speed : 0;
      const tz = mobile ? mz * speed : 0;
      const ax = tx - a.vel.x;
      const az = tz - a.vel.z;
      const al = Math.hypot(ax, az);
      const maxDv = (mobile ? BOUT.accel : 9) * dt;
      const k = al > maxDv ? maxDv / al : 1;
      a.vel.x += ax * k;
      a.vel.z += az * k;
      if (a.act === 'sprawl') {
        // Hips go back hard.
        a.vel.x -= nx * toward * 1.6 * dt * 6;
        a.vel.z -= nz * toward * 1.6 * dt * 6;
      }
      // Footwork costs little; bursts cost a lot. Recovery slows while moving.
      // Tied up with a brawler there is no breather: his weight on you cuts your recovery (STYLE_EFFECT.brawlBreath).
      const o = this.athletes[otherSide(a.side)];
      const smothered = o.hand >= 0.62 && this.distance() < BOUT.tieRange + 0.15
        ? 1 - STYLE_EFFECT.brawlBreath * Math.max(0, this.styleSteps[o.side].brawl) : 1;
      if (a.act === 'stance') this.recoverStamina(a, dt, FATIGUE.neutralRecover * (1 - Math.min(1, len) * 0.55) * smothered);
      else this.recoverStamina(a, dt, 0.015 * smothered);
      if (c.level) this.spend(a, dt * 0.006);
    }

    // Integrate.
    for (const a of this.athletes) {
      a.pos.x += a.vel.x * dt;
      a.pos.z += a.vel.z * dt;
    }

    dx = B.pos.x - A.pos.x;
    dz = B.pos.z - A.pos.z;
    dist = Math.hypot(dx, dz) || 1e-4;
    nx = dx / dist;
    nz = dz / dist;

    // Chest to chest: whoever drives harder moves the pair, and the loser of
    // that exchange is pushed back off his base.
    const sa = absoluteStrength(this.wrestlers[0]) * (1 + STYLE_EFFECT.physForce * this.styleSteps[0].phys);
    const sb = absoluteStrength(this.wrestlers[1]) * (1 + STYLE_EFFECT.physForce * this.styleSteps[1].phys);
    const inContact = dist < BOUT.contact && A.act !== 'sprawl' && B.act !== 'sprawl';
    let leanA = 0.3 * clamp(A.drive, -1, 1) * (inContact ? 0 : 1);
    let leanB = 0.3 * clamp(B.drive, -1, 1) * (inContact ? 0 : 1);
    if (inContact) {
      const pa = Math.max(0, A.drive) * sa;
      const pb = Math.max(0, B.drive) * sb;
      const net = pa - pb;
      const bodyMass = (this.wrestlers[0].weightClass + this.wrestlers[1].weightClass) / 330;
      const shove = net / bodyMass * 0.85 * dt;
      A.pos.x += nx * shove;
      A.pos.z += nz * shove;
      B.pos.x += nx * shove;
      B.pos.z += nz * shove;
      leanA = 0.45 * Math.max(0, A.drive) - 0.55 * pb / weightPhysics(this.wrestlers[0].weightClass).force;
      leanB = 0.45 * Math.max(0, B.drive) - 0.55 * pa / weightPhysics(this.wrestlers[1].weightClass).force;
      // Pushing into someone who gives ground leaves you falling forward.
      if (A.drive > 0.3 && B.drive < -0.25) leanA = 0.85;
      if (B.drive > 0.3 && A.drive < -0.25) leanB = 0.85;
      if (pa > 0.2 || pb > 0.2) {
        this.spend(A, dt * 0.012 * pa);
        this.spend(B, dt * 0.012 * pb);
      }
    }
    if (A.act === 'stagger') leanA = Math.max(leanA, 0.55);
    if (B.act === 'stagger') leanB = Math.max(leanB, 0.55);
    A.lean += (clamp(leanA, -1, 1) - A.lean) * Math.min(1, dt * 5);
    B.lean += (clamp(leanB, -1, 1) - B.lean) * Math.min(1, dt * 5);

    // Tied up (TIE_UP): the tie holds them together, so whoever moves drags the other with him (the stronger man
    // more), and a man pulled while not driving back comes forward onto his toes.
    if ((A.hand >= 0.62 || B.hand >= 0.62) && dist > TIE_UP.hold && dist < BOUT.tieRange + 0.15 && A.act !== 'sprawl' && B.act !== 'sprawl') {
      const excess = (dist - TIE_UP.hold) * TIE_UP.drag;
      const awayA = -(A.vel.x * nx + A.vel.z * nz), awayB = B.vel.x * nx + B.vel.z * nz;
      const share = clamp(0.5 + (awayA - awayB) * 0.4 + (sa - sb) * 0.3, 0.1, 0.9);
      // share: how much of the gap B closes (A pulling away or stronger drags B).
      B.pos.x -= nx * excess * share; B.pos.z -= nz * excess * share;
      A.pos.x += nx * excess * (1 - share); A.pos.z += nz * excess * (1 - share);
      if (awayA > 0.3 && B.drive <= 0.1) B.lean = Math.max(B.lean, TIE_UP.pullLean * Math.min(1, awayA));
      if (awayB > 0.3 && A.drive <= 0.1) A.lean = Math.max(A.lean, TIE_UP.pullLean * Math.min(1, awayB));
    }
    // A body lock holds them chest to chest.
    if (A.hand >= 0.62 && A.tie === 'bodyLock' || B.hand >= 0.62 && B.tie === 'bodyLock') {
      const pull = Math.min(Math.max(0, dist - 0.72) / 2, dt * 0.8);
      A.pos.x += nx * pull; A.pos.z += nz * pull;
      B.pos.x -= nx * pull; B.pos.z -= nz * pull;
    }
    // Bodies cannot overlap.
    if (dist < BOUT.minGap) {
      const push = (BOUT.minGap - dist) / 2;
      A.pos.x -= nx * push;
      A.pos.z -= nz * push;
      B.pos.x += nx * push;
      B.pos.z += nz * push;
    }

    // Square up to each other.
    for (const a of this.athletes) {
      const o = this.athletes[otherSide(a.side)];
      const want = Math.atan2(o.pos.x - a.pos.x, o.pos.z - a.pos.z);
      const d = wrap(want - a.yaw);
      const rate = BOUT.turnRate * (a.act === 'stance' ? 1 : 0.4);
      a.yaw += clamp(d, -rate * dt, rate * dt);
    }

    // Now and then a wrestler switches his lead leg while circling outside the tie. Look only:
    // it uses its own generator so match outcomes never change.
    for (const a of this.athletes) {
      a.leadSwitchT = (a.leadSwitchT ?? 3 + this.styleRng.next() * 6) - dt;
      if (a.leadSwitchT <= 0) {
        a.leadSwitchT = 5 + this.styleRng.next() * 8;
        if (a.act === 'stance' && this.distance() > BOUT.tieRange && this.styleRng.next() < 0.6) a.lead = a.lead === 1 ? -1 : 1;
      }
    }

    // Hands: ties break as soon as they step out of reach.
    const reach = this.distance() < BOUT.tieRange + 0.15;
    for (const a of this.athletes) {
      // A held tie stays until it is fought off (TIE_UP.holdFade), loose hands drift apart faster.
      a.hand = reach ? Math.max(0, a.hand - dt * (a.hand >= 0.62 ? TIE_UP.holdFade : 0.03)) : Math.max(0, a.hand - dt * 1.6);
      // Tied up with a brawler: his weight on your head wears you down every second.
      if (reach && a.hand >= 0.62) this.brawlerWear(a, this.athletes[otherSide(a.side)], STYLE_EFFECT.brawlTied * dt);
      if (a.hand < 0.62) a.tie = undefined;
      if (a.snapped) a.snapped = Math.max(0, a.snapped - dt);
      if (a.reshot) a.reshot = Math.max(0, a.reshot - dt);
      if (a.chain) a.chain = Math.max(0, a.chain - dt);
      if (a.opened) a.opened = Math.max(0, a.opened - dt);
    }
  }

  /** Frame with +Z from `a` toward the opponent, origin between them. */
  private pairFrame(aSide: Side): Frame {
    const a = this.athletes[aSide];
    const o = this.athletes[otherSide(aSide)];
    return {
      x: (a.pos.x + o.pos.x) / 2,
      z: (a.pos.z + o.pos.z) / 2,
      yaw: Math.atan2(o.pos.x - a.pos.x, o.pos.z - a.pos.z),
    };
  }

  /* ----------------------------------------------------------------- shot */

  private tickShot(dt: number, cmds: [Command, Command], s: Extract<Position, { kind: 'shot' }>): void {
    s.t += dt;
    const A = this.athletes[s.A];
    const D = this.athletes[otherSide(s.A)];
    void cmds;
    // Off balance from his own shot, he cannot get the hips back until the shot is nearly in.
    if (s.sprawlAt < 0 && !(s.stumbling && s.t < s.dur * 0.75) && this.take(D, 'sprawl')) {
      s.sprawlAt = s.t;
      this.ev.feedback?.(D.side, 'sprawl', 'ok');
    }
    // No press yet: the wrestler's own reflex may still get the hips back, later than a read would.
    if (s.sprawlAt < 0 && (s.reflexAt ?? -1) >= 0 && s.t >= s.reflexAt!) {
      s.sprawlAt = s.t;
      this.ev.feedback?.(D.side, 'sprawl', 'ok');
    }
    // The stuff is decided the moment the sprawl lands.
    if (s.sprawlAt >= 0 && s.sprawlAt <= s.dur) {
      const wd = this.wrestlers[D.side].attributes;
      const late = s.sprawlAt / s.dur;
      const p = clamp(1.2 - s.quality * 0.75 - late * 0.6 + wd.defense * 0.25 + STYLE_EFFECT.defStuff * this.styleSteps[D.side].def + (D.level < 0.35 ? 0.1 : 0) + this.plan(D.side).defense + 0.14 * this.edge(D.side), 0, 0.96);
      if (s.stuffRoll < p) {
        D.stats.stuffs += 1;
        this.spend(D, 0.04);
        // A bad shot (from too far, or poorly set up) is often down-blocked short instead: both end up on
        // their feet with the shooter off balance, the moment for the defender's reshot. A sound shot is
        // sometimes blocked too; then the shooter recovers fast and can chain straight into another
        // (Cary Kolat's reshot drill: shoot, get stopped, come back up and shoot again).
        // A cold shot is sprawled on and ends in his front headlock, where the defender can score.
        const bad = s.dist > 1.12 || s.quality < 0.42;
        if (this.rng.chance(s.cold ? 0.1 : bad ? 0.45 : 0.2)) {
          this.ev.announce?.('Blocked', 'info', bad ? 'Bad shot: he is off balance' : 'Shot stopped short');
          this.ev.feedback?.(A.side, 'shoot', 'lost');
          this.ev.feedback?.(D.side, 'sprawl', 'won');
          this.startMove('shotBlocked', s.A, s.frame, false, s.dist);
          if (this.position.kind === 'move') this.position.offBalance = bad ? 0.9 : 0;
          return;
        }
        this.ev.announce?.('Sprawl!', 'info', s.cold ? 'No setup: he saw it coming' : 'Shot stuffed');
        this.ev.feedback?.(A.side, 'shoot', 'lost');
        this.ev.feedback?.(D.side, 'sprawl', 'won');
        this.startMove(s.shot === 'single' || s.shot === 'lowSingle' ? 'stuffedSingle' : 'stuffed', s.A, s.frame, s.mirror, s.dist);
        return;
      }
      // Too late: he got in, but the hips are already coming back.
      s.quality = Math.max(0.05, s.quality - (1 - late) * 0.4);
      s.sprawlAt = s.dur + 1;
    }
    // He hits the legs: a contact hit, bigger the better timed (TIMING). Not if the hips are already back.
    if (!s.hit && s.t >= s.dur * TIMING.at && (s.sprawlAt < 0 || s.sprawlAt > s.dur)) {
      s.hit = true;
      const at = frameApply(s.frame, { x: 0, z: 0.3, yaw: 0 });
      const [lo, hi] = TIMING.impact;
      this.ev.impact?.(lo + (hi - lo) * (s.timing ?? 0), { x: at.x, z: at.z }, false);
    }
    if (s.t >= s.dur) {
      const progress = clamp(0.32 + s.quality * 0.4, 0.15, 0.85);
      const frame = s.frame;
      this.position = {
        kind: 'legs',
        A: s.A,
        shot: s.shot,
        mirror: s.mirror,
        t: 0,
        frame,
        progress,
        intensity: 0.5,
      };
      this.placeHold();
      void A;
    }
  }

  /* ----------------------------------------------------------------- legs */

  private tickLegs(dt: number, cmds: [Command, Command], s: Extract<Position, { kind: 'legs' }>): void {
    s.t += dt;
    const A = this.athletes[s.A];
    const D = this.athletes[otherSide(s.A)];
    const wa = this.wrestlers[s.A].attributes;
    const wd = this.wrestlers[D.side].attributes;
    const ca = cmds[s.A];
    const cd = cmds[D.side];
    const cooperative = D.side === this.practicePartner && !cd.sprawl && !cd.fight && !cd.shoot;
    const c = Math.cos(s.frame.yaw);
    const sn = Math.sin(s.frame.yaw);
    const fwdA = ca.moveX * sn + ca.moveZ * c;

    const needsLift = ca.legAction === 'lift' || ca.legAction === 'trip' || ca.legAction === 'double';
    if (needsLift && (s.shot === 'single' || s.shot === 'highCrotch') && A.stamina > 0.15) {
      const wasBelowFull = (s.lifted ?? 0) < 1;
      s.lifted = Math.min(1, (s.lifted ?? 0) + dt * (0.6 + wa.strength * 0.5) * (1 + STYLE_EFFECT.physLift * this.styleSteps[A.side].phys));
      this.spend(A, dt * 0.045);
      // Lift alone never finishes, so tell the player when to choose the finish.
      if (wasBelowFull && s.lifted >= 1 && ca.legAction === 'lift') this.ev.announce?.('Leg up', 'info', 'Now Trip or Drive back');
    }
    // A deliberate Drive choice replaces an earlier Trip even after defense
    // lowers the leg. With a low capture, run the ordinary shot finish instead.
    // Release/cancel still remembers the choice; converted doubles keep theirs.
    if (ca.legAction === 'drive' && this.prev[A.side].legAction !== 'drive' && (s.shot === 'single' || s.shot === 'highCrotch')) {
      s.legFinish = (s.lifted ?? 0) > 0.7 ? 'drive' : undefined;
    }
    if ((s.lifted ?? 0) > 0.7 && ca.legAction && ca.legAction !== 'lift') s.legFinish = ca.legAction;
    // Remember the conversion so the same held control can drive its finish.
    if (s.legFinish === 'double' && s.shot !== 'double') { s.shot = 'double'; s.lifted = 0; }
    // A selected finish keeps its identity, but pressure still needs live input
    // until the finishing animation commits. Releasing/cancelling a hold rests
    // the attacker instead of supplying free pressure from the stored choice.
    const driving = ca.shoot || ca.legAction === 'drive' || ca.legAction === 'double' && s.shot === 'double' || fwdA > 0.3 || ca.legAction === 'trip' && s.legFinish === 'trip';
    const lifting = needsLift && (s.shot === 'single' || s.shot === 'highCrotch');
    if (ca.legAction && ca.legAction !== this.prev[A.side].legAction) {
      const label = {lift:'Lift leg',trip:'Trip',double:s.shot === 'double' ? 'Finish double' : 'Switch double',drive:'Drive back'}[ca.legAction];
      this.ev.announce?.(label, 'info', A.stamina <= 0.15 && lifting ? 'Not enough stamina to lift' : lifting && (s.lifted ?? 0) <= 0.7 ? 'Working to elevate the leg' : 'Driving the finish');
    }
    if (driving && s.legFinish === 'drive') { s.frame.x += sn * dt * 0.35; s.frame.z += c * dt * 0.35; }
    if (driving && s.legFinish === 'trip') s.frame.yaw += dt * (s.mirror ? -0.4 : 0.4);
    // Let a fresh capture settle while the player recognizes the finish controls.
    // This only removes idle grip decay: sprawls, grip clearing and poor position
    // still beat the entry; this grants no driving force or automatic finish.
    const settlingGrip = s.t <= 1.2 && !driving && !lifting;
    // His grip slips when he stops working, fast if the defender is fighting it; if neither man is working, both are
    // just hanging on (owner: a stalemate after 7 or 8 seconds), so it barely slips.
    const defending = cd.sprawl || cd.fight || D.side === this.assistedSide;
    let rate = lifting && !driving ? 0.015 : driving ? (0.10 + wa.strength * 0.12 + (wa.shots ?? wa.quickness) * 0.05) * (0.55 + 0.45 * A.stamina) * (1 + STYLE_EFFECT.shotDrive * this.styleSteps[A.side].shots) : settlingGrip ? 0 : defending ? -0.14 : -0.02;
    // Once he is deep on the legs a sprawl is hard to hit: the defender keeps trying,
    // stuffing the head and crossfacing, which slows the finish more than it stops it.
    // The big sprawls happen earlier, off the level change (see tickShot).
    // The player's wrestler keeps crossfacing on his own at half effort; holding Sprawl is full effort.
    const crossface = cd.sprawl ? 1 : D.side === this.assistedSide && !cd.fight ? 0.5 : 0;
    if (crossface) rate -= (0.18 + wd.defense * 0.12) * (0.55 + 0.45 * D.stamina) * DEEP_SPRAWL * crossface * (1 + STYLE_EFFECT.defSprawl * this.styleSteps[D.side].def);
    // A defended grip can remain contested instead of automatically snowballing.
    rate += (s.progress - 0.5) * 0.12;
    // In on the legs is a fight, not a formality: the defender's hips and hands always count
    // for something, and the better wrestler wins more of these.
    // (November 9: -0.08 to -0.11. With neutral much busier, more of the extra attacks are fought off on the
    // legs instead of scoring, keeping match totals near where they were.)
    rate += 0.1 * this.edge(A.side) - PACE.legs;
    if (driving && s.legFinish && s.legFinish !== 'double') rate += 0.07 * (0.5 + A.stamina);
    // Both just hanging on: nothing moves much either way until the referee stops it (LEG_BATTLE.idle).
    if (!driving && !lifting && !defending && !settlingGrip) rate = -0.02;
    if (cd.fight && s.lifted) s.lifted = Math.max(0, s.lifted - dt * 0.18);
    // Let a learner inspect finish choices without the idle partner escaping.
    if (cooperative && !driving) rate = lifting ? Math.max(0, rate) : 0;
    s.progress += rate * dt;
    if (this.take(D, 'sprawl')) {
      s.push = LEG_MOTION.hopT;
      s.progress -= 0.035 * (0.7 + wd.defense * 0.6) * (0.6 + 0.4 * D.stamina) * DEEP_SPRAWL * (1 + STYLE_EFFECT.defSprawl * this.styleSteps[D.side].def);
      this.spend(D, 0.02);
      this.ev.feedback?.(D.side, 'sprawl', 'ok');
    }
    const counterAvailable = s.shot === 'single' && s.t >= 4.5 && s.progress < 0.7 && (s.lifted ?? 0) < 0.3;
    // A head-inside opening still needs an arm/leg capture before the roll.
    // Time in the single alone must never grant a locked pinning combination.
    s.counterGrip = counterAvailable ? Math.max(0, (s.counterGrip ?? 0) - dt * (0.10 + (driving ? 0.12 * A.stamina : 0))) : 0;
    if (this.take(A, 'fight')) {
      s.counterGrip = Math.max(0, (s.counterGrip ?? 0) - 0.22 * (0.5 + wa.defense * 0.5) * (0.5 + A.stamina * 0.5));
      this.spend(A, 0.02);
      this.ev.feedback?.(A.side, 'fight', 'ok');
    }
    if (this.take(D, 'fight')) {
      if (counterAvailable && D.stamina > 0.2) {
        s.counterGrip = Math.min(1, (s.counterGrip ?? 0) + 0.24 * (0.5 + wd.mat * 0.5) * (0.5 + D.stamina * 0.5));
        this.spend(D, 0.025);
        this.ev.feedback?.(D.side, 'fight', 'ok');
        if (s.counterGrip >= 1) {
          this.ev.announce?.('Spladle counter', 'info', 'Arm and leg captured');
          this.startMove('spladleCounter', s.A, s.frame, s.mirror);
          return;
        }
      } else {
        // Whizzering a leg he is still lifting high: the knee. See DANGEROUS_ON_FEET.
        if ((s.lifted ?? 0) > 0.8 && needsLift && this.ev.call && this.rng.chance(DANGEROUS_ON_FEET.leg)) { this.ev.call('dangerous', s.A); return; }
        s.progress -= (s.shot !== 'double' ? 0.035 : 0.025) * (0.7 + wd.strength * 0.6);
        this.spend(D, 0.02);
        // He hops and turns away from the way the attacker is circling; sometimes the attacker switches direction.
        s.hop = LEG_MOTION.hopT;
        if (this.rng.chance(LEG_MOTION.flip)) s.circleDir = -(s.circleDir ?? 1);
        this.ev.feedback?.(D.side, 'fight', 'ok');
        // On a leg attack his clearing hand is the whizzer: overhook the arm, hip in.
        if (s.shot !== 'double') {
          if (!s.whizzer) this.ev.announce?.('Whizzer', 'info', 'Keep it heavy to kick the leg free');
          s.whizzer = 1.2;
        }
      }
    }
    // The defender's Shoot is the counter, and the position picks which (owner: keep the controls simple).
    s.counterCool = Math.max(0, (s.counterCool ?? 0) - dt);
    const counter = legCounterFor(s);
    if (counter && s.counterCool <= 0 && !cooperative && this.take(D, 'shoot')) {
      const specialist = isScrambleSpecialist(`${this.wrestlers[D.side].firstName} ${this.wrestlers[D.side].lastName}`);
      const lifted = s.lifted ?? 0;
      const p = counter === 'crackdown'
        ? clamp(0.12 + wd.strength * 0.15 + wd.defense * 0.15 + (0.7 - s.progress) * 0.4 - wa.quickness * 0.1 + (s.shot === 'lowSingle' ? 0.1 : 0), 0.05, 0.5)
        : counter === 'sitThrough'
          ? clamp(0.18 + (wd.scrambling ?? wd.quickness) * 0.2 + wd.mat * 0.1 + STYLE_EFFECT.scrambleCounter * this.styleSteps[D.side].scram - (s.progress - 0.5) * 0.4 - lifted * 0.4 - wa.strength * 0.1, 0.05, 0.5)
          : clamp(0.06 + (wd.scrambling ?? wd.quickness) * 0.18 + wd.mat * 0.08 + STYLE_EFFECT.scrambleCounter * this.styleSteps[D.side].scram + (specialist ? 0.12 : 0) - wa.mat * 0.06, 0.04, 0.35);
      this.spend(D, 0.05);
      const label = LEG_COUNTER_LABELS[counter];
      if (this.rng.chance((p + this.signatureEdge(D.side, 'legCounter', counter)) * (0.6 + 0.4 * D.stamina))) {
        this.ev.feedback?.(D.side, 'shoot', 'won', label);
        this.ev.feedback?.(A.side, 'shoot', 'lost');
        D.stats.stuffs += 1;
        this.startMove(counter, s.A, s.frame, s.mirror);
        // Sat through and out: the shooter comes up off balance.
        if (counter === 'sitThrough' && this.position.kind === 'move') this.position.offBalance = 0.6;
        return;
      }
      this.ev.feedback?.(D.side, 'shoot', 'lost', label);
      // A failed scramble roll gives him the finish; the others give up ground.
      if (counter === 'scrambleRoll') s.progress = 1.01;
      else s.progress = Math.min(1.01, s.progress + (counter === 'sitThrough' ? 0.12 : 0.1));
      s.counterCool = 1;
    }
    if (this.take(A, 'shoot')) {
      s.progress += 0.025;
      // Each push is a visible drive: a burst of steps that turns the corner (LEG_MOTION).
      s.surge = LEG_MOTION.surgeT;
      // A finishing burst is extra work beyond maintaining forward pressure,
      // just as the defender's repeated grip-clearing efforts cost stamina.
      this.spend(A, 0.012);
      this.ev.feedback?.(A.side, 'shoot', 'ok');
    }
    if (driving) this.spend(A, dt * 0.05);
    if (!cooperative || driving || lifting) this.spend(D, dt * 0.02);
    s.intensity += ((driving ? 1 : 0.3) - s.intensity) * Math.min(1, dt * 4);
    s.progress = clamp(s.progress, -0.01, 1.01);
    if (s.whizzer) s.whizzer = Math.max(0, s.whizzer - dt) || undefined;

    if (s.progress >= 1) {
      // A double won by a man with gas left often goes up in the air (LIFT_DOUBLE): more for the strong, more again
      // when he gets there fast.
      const lift = s.shot === 'double' && A.stamina > LIFT_DOUBLE.gas
        && this.rng.chance(LIFT_DOUBLE.base + wa.strength * LIFT_DOUBLE.strength + (s.t < LIFT_DOUBLE.quickT ? LIFT_DOUBLE.quick : 0));
      // Defense may lower a previously raised leg while Drive is held.
      // Keep the effort, but finish from the capture's actual elevation.
      this.startMove(s.legFinish === 'trip' ? 'liftedLegTrip' : s.legFinish === 'drive' && (s.lifted ?? 0) > 0.7 ? 'liftedLegDrive' : s.shot === 'lowSingle' ? 'finishLowSingle' : s.shot === 'highCrotch' ? 'finishHighCrotch' : s.shot === 'single' ? 'finishSingle' : lift ? 'liftDouble' : 'finishDouble', s.A, s.frame, s.mirror);
      return;
    }
    // A hard attempt that is fought off costs him: the longer he fought on the legs, the more (FATIGUE.failedShot).
    if (s.progress <= 0) this.spend(A, FATIGUE.failedShot * Math.min(8, s.t));
    if (s.progress <= 0 && s.whizzer && s.shot !== 'double') {
      // Beaten with the whizzer: he kicks the leg free and both are back on their feet.
      D.stats.stuffs += 1;
      this.ev.announce?.('Whizzer kicks out', 'info');
      this.ev.feedback?.(A.side, 'shoot', 'lost');
      this.ev.feedback?.(D.side, 'fight', 'won');
      this.startMove('whizzerKick', s.A, s.frame, s.mirror);
      // Kicked free, the shooter is down on his hands: off balance as they come up.
      if (this.position.kind === 'move') this.position.offBalance = 0.8;
      return;
    }
    if (s.progress <= 0) {
      D.stats.stuffs += 1;
      this.ev.announce?.('Sprawls out', 'info');
      this.ev.feedback?.(A.side, 'shoot', 'lost');
      this.ev.feedback?.(D.side, 'sprawl', 'won');
      this.startMove('sprawlOut', s.A, s.frame, s.mirror);
      return;
    }
    // A contested leg battle travels: he keeps driving, the defender keeps giving ground and
    // circling his hips away, so a scramble that starts off center often ends off the mat with
    // no score (checkBounds blows the whistle).
    const working = driving || cd.sprawl || cd.fight || crossface > 0;
    if (!cooperative && s.legFinish !== 'drive') this.legMotion(s, A, driving, lifting, working, dt);
    // Owner, November 10: holding a leg up for a few seconds is not a stalemate. A leg battle goes on while either man
    // works it, even with the leg back down on the mat; a stalemate is only nobody working. A long one with nobody
    // getting anywhere goes to a scramble that settles it (LEG_BATTLE).
    if (s.peak === undefined || s.progress > s.peak + 0.04) { s.peak = s.progress; s.peakAt = s.t; }
    const working2 = driving || lifting || cd.fight || cd.sprawl || cd.shoot || crossface > 0;
    s.idleT = working2 ? 0 : (s.idleT ?? 0) + dt;
    if (!cooperative && s.idleT > LEG_BATTLE.idle) {
      this.ev.announce?.('Stalemate', 'info', 'Neither man working');
      this.stalemate();
      return;
    }
    const stuck = s.t > LEG_BATTLE.scrambleAt && s.t - (s.peakAt ?? 0) > LEG_BATTLE.stuck;
    if (!cooperative && (stuck || s.t > LEG_BATTLE.cap)) {
      this.legScramble(s, A, D, wa, wd);
      return;
    }
    // At the edge he works out to stop it; the deeper the attacker is, the more he can turn the corner instead.
    if (!cooperative) this.edgeWork(s.frame, s.A, D.side, 0.15 + s.progress * 0.55, 1.3 - s.progress, cmds, dt, 'att');
    this.placeHold();
  }

  /* ------------------------------------------------------- front headlock */

  /** A small edge on a wrestler's own signature finish (owner's list, item 4): practised moves land a bit more. */
  private signatureEdge<K extends keyof Signature>(side: Side, key: K, value: Signature[K]): number {
    return this.wrestlers[side].signature?.[key] === value ? SIGNATURE_EDGE : 0;
  }

  private tickFhl(dt: number, cmds: [Command, Command], s: Extract<Position, { kind: 'fhl' }>): void {
    s.t += dt;
    s.cooldown = Math.max(0, s.cooldown - dt);
    const T = this.athletes[s.A];
    const Bm = this.athletes[otherSide(s.A)];
    const wt = this.wrestlers[s.A].attributes;
    const wb = this.wrestlers[Bm.side].attributes;
    const cb = cmds[Bm.side];

    // Snapping and circling for the go-behind, he digs and backs out: the pair keeps moving.
    this.drift(s.frame, 0.42, dt);
    // Bottom digs his head out.
    let work = 0;
    if (this.take(Bm, 'fight') || this.take(Bm, 'sprawl')) {
      work += 0.16 * (0.7 + wb.quickness * 0.6) * (0.6 + 0.4 * Bm.stamina);
      this.spend(Bm, 0.02);
      this.ev.feedback?.(Bm.side, 'fight', 'ok');
    }
    if (this.take(Bm, 'shoot')) {
      work += 0.06;
      this.ev.feedback?.(Bm.side, 'shoot', 'ok');
    }
    if (cb.fight || cb.sprawl) work += dt * 0.08;
    s.recover = clamp(s.recover + work + dt * 0.04, 0, 1.01);
    s.drive = clamp((s.drive ?? 0) + (work > 0 ? 0.22 : 0) + (cb.fight || cb.sprawl ? dt * 0.4 : 0) - dt * 0.3, 0, 1);

    // Top: snap him back down, or spin behind.
    if (this.take(T, 'fight')) {
      // Snapped down hard while he drives up into it: the neck. See DANGEROUS_ON_FEET.
      if ((s.drive ?? 0) > 0.6 && this.ev.call && this.rng.chance(DANGEROUS_ON_FEET.snap)) { this.ev.call('dangerous', s.A); return; }
      s.recover = Math.max(0, s.recover - 0.2 * (0.7 + wt.strength * 0.6));
      this.spend(Bm, 0.03);
      this.spend(T, 0.015);
      this.ev.feedback?.(T.side, 'fight', 'ok');
    }
    // Off a stuffed shot: a defensive plan looks for the counter, an aggressive shooter over-commits.
    const planEdge = this.plan(T.side).snap + this.plan(T.side).counter + this.plan(Bm.side).overcommit;
    const busy = cb.fight || cb.sprawl ? 0.1 : 0;
    if (s.cooldown <= 0 && this.take(T, 'shoot')) {
      // The position picks the finish (owner: keep the controls simple). Lower + Shoot with him broken down is
      // the cement mixer; once he is half way up the chin whip uses his rise; otherwise the spin behind, which
      // rarely works on a man with his hips under him, so snap him down first.
      const mixer = !!cmds[T.side].level && s.recover < 0.4;
      const whip = !mixer && s.recover >= 0.5;
      const id = mixer ? 'cementMixer' : whip ? 'chinWhip' : 'goBehind';
      const p = mixer
        ? clamp(0.14 + wt.strength * 0.2 + wt.mat * 0.15 + (0.4 - s.recover) * 0.7 - wb.defense * 0.15 - busy + planEdge * 0.5, 0.04, 0.5)
        : whip
          ? clamp(0.2 + wt.quickness * 0.25 - wb.defense * 0.12 - (s.recover - 0.5) * 0.3 - busy * 0.5 + planEdge, 0.05, 0.5)
          : clamp(0.25 + wt.quickness * 0.22 + (0.55 - s.recover) * 0.55 - busy + planEdge, 0.05, 0.8);
      this.spend(T, mixer ? 0.07 : 0.04);
      if (this.rng.chance((p + this.signatureEdge(T.side, 'fhl', id)) * PACE.fhl * (1 - FATIGUE.finish * (1 - T.stamina)))) {
        this.ev.feedback?.(T.side, 'shoot', 'won', mixer ? 'Cement mixer' : whip ? 'Chin whip' : undefined);
        this.startMove(id, s.A, s.frame, false);
        // Spun right off the sprawl, before his hips are back under him (film: the sprawler is swinging round
        // within half a second): a burst (TIMING). Off his rise, the chin whip uses his drive the same way.
        if (id === 'goBehind') this.burst(clamp01(1 - s.t / 0.9) * clamp01((0.5 - s.recover) * 3), s.A);
        if (id === 'chinWhip') this.burst(clamp01(((s.drive ?? 0) - 0.4) * 2), s.A);
        return;
      }
      // A missed cement mixer costs more: he was halfway to rolling and the man underneath comes up.
      s.cooldown = mixer ? 0.9 : 0.65;
      s.recover = Math.min(1, s.recover + (mixer ? 0.35 : 0.22));
      this.ev.feedback?.(T.side, 'shoot', 'lost', mixer ? 'Cement mixer' : whip ? 'Chin whip' : undefined);
    }
    // Shuck (Sprawl, otherwise unused on top here): best while he drives into the headlock to dig out.
    if (s.cooldown <= 0 && this.take(T, 'sprawl')) {
      const p = clamp(0.08 + wt.quickness * 0.25 + (s.drive ?? 0) * 0.4 + this.plan(T.side).counter + this.signatureEdge(T.side, 'fhl', 'shuck'), 0.04, 0.6) * PACE.fhl;
      this.spend(T, 0.04);
      if (this.rng.chance(p)) {
        this.ev.feedback?.(T.side, 'sprawl', 'won', 'Shuck');
        this.startMove('shuck', s.A, s.frame, false);
        return;
      }
      s.cooldown = 0.6;
      s.recover = Math.min(1, s.recover + 0.15);
      this.ev.feedback?.(T.side, 'sprawl', 'lost', 'Shuck');
    }
    s.intensity += ((work > 0 ? 1 : 0.35) - s.intensity) * Math.min(1, dt * 3);

    if (s.recover >= 1) {
      this.ev.feedback?.(Bm.side, 'fight', 'won');
      this.startMove('recover', s.A, s.frame, false);
      return;
    }
    if (s.t > 5) this.stalemate();
    // At the edge the caught man backs out to clear it; the man on the head turns him back in.
    this.edgeWork(s.frame, s.A, Bm.side, 0.6 - s.recover * 0.3, 0.5 + s.recover * 0.6, cmds, dt, 'att');
    this.placeHold();
  }

  /* ------------------------------------------------------------------ mat */

  /** When the rider's hands are locked with the bottom man not on his feet; see LOCKED_HANDS. */
  handsAtRisk(): Side | null {
    const p = this.position;
    if (p.kind === 'move' && p.id === 'standUp' && p.t / p.dur < 0.7) return p.A;
    if (p.kind === 'move' && MAT_RETURNS.has(p.id) && p.t / p.dur > 0.72) return p.A;
    if (p.kind === 'mat' && p.sub === 'ride' && this.lockWatch > 0) return p.A;
    return null;
  }

  /** During a mat return: the bottom man going to turn in as he lands (Shoot), once, in the second half. */
  private watchReturn(cmds: [Command, Command]): void {
    const r = this.returning, p = this.position;
    if (!r || p !== r.move || p.kind !== 'move' || r.turnIn) return;
    const B = otherSide(p.A);
    if (p.t / p.dur > 0.3 && cmds[B].shoot && !this.prev[B].shoot) {
      r.turnIn = true;
      this.ev.feedback?.(B, 'shoot', 'ok', 'Turn in');
    }
  }

  /** The return in the air right now, for the HUD: the bottom man's moment to turn in as he lands. */
  returnWindow(): boolean {
    const r = this.returning, p = this.position;
    return !!r && p === r.move && p.kind === 'move' && p.t / p.dur > 0.3 && !r.turnIn;
  }

  private handsCall(dt: number, cmds: [Command, Command]): boolean {
    this.lockWatch = Math.max(0, this.lockWatch - dt);
    const top = this.handsAtRisk();
    if (top === null || this.practicePartner !== null || !this.ev.call) return false;
    const p = this.position;
    let locked = false;
    // Grabbing the waist now (Ride tight) is locking up on a man who is not on his feet.
    if (cmds[top].sprawl && !this.prev[top].sprawl && this.rng.chance(LOCKED_HANDS.grab)) locked = true;
    // His own slip: once per stand-up or return.
    if (!locked && p.kind === 'move' && this.handsRolled !== p) {
      this.handsRolled = p;
      const w = this.wrestlers[top].attributes;
      locked = this.rng.chance(LOCKED_HANDS.slip * (1.3 - w.mat) * (1.4 - 0.6 * this.athletes[top].stamina));
    }
    if (!locked) return false;
    this.lockWatch = 0;
    this.ev.call?.('lockedHands', top);
    return true;
  }

  /** Voluntary release: one escape, never a takedown or a free neutral reset. */
  cut(side: Side): boolean {
    const s = this.position;
    if (s.kind !== 'mat' || s.A !== side || s.sub === 'exposed' || s.sub === 'spladle') return false;
    const bottom = otherSide(side);
    this.athletes[bottom].stats.escapes += 1;
    this.ev.score?.(bottom, 'escape', 'Voluntary release — cut');
    if (this.position !== s) return true;
    this.setNeutral({x:s.frame.x,z:s.frame.z}, s.frame.yaw, 1.1);
    this.ev.announce?.('Cut', 'info', 'Escape awarded — both wrestlers neutral');
    return true;
  }

  private tickMat(dt: number, cmds: [Command, Command], s: Extract<Position, { kind: 'mat' }>): void {
    if (s.landing) {
      const l = s.landing;
      s.landing = undefined;
      if (l === 'slam') { this.ev.call?.('slam', s.A); return; }
      if (l === 'turnIn') { this.ev.feedback?.(otherSide(s.A), 'shoot', 'won', 'Turn in'); this.startMove('sitOutEscape', s.A, s.frame, false); return; }
      this.ev.announce?.('Back to the mat', 'info', 'A clean return: he lands flat');
      this.startMove('breakdown', s.A, s.frame, false);
      return;
    }
    if (cmds[s.A].level && !this.prev[s.A].level && this.cut(s.A)) return;
    s.t += dt;
    s.commit = Math.max(0, s.commit - dt);
    s.basing = Math.max(0, s.basing - dt);
    s.turnCool = Math.max(0, s.turnCool - dt);
    const T = this.athletes[s.A];
    const Bm = this.athletes[otherSide(s.A)];
    const wt = this.wrestlers[s.A].attributes;
    const wb = this.wrestlers[Bm.side].attributes;
    const ct = cmds[s.A];
    const c = Math.cos(s.frame.yaw);
    const sn = Math.sin(s.frame.yaw);
    const drive = clamp(ct.moveX * sn + ct.moveZ * c, -1, 1);

    // The bottom man works toward the line (to stop a ride or a turn, or to get off his back); the rider drags
    // him back to the center. Crawling out on his back is fleeing (MatchSim.whistle).
    if (s.sub === 'standing') this.edgeWork(s.frame, s.A, Bm.side, 0.4 + s.control * 0.6, 1, cmds, dt, 'both', true);
    else if (s.sub === 'exposed' || s.sub === 'spladle') this.edgeWork(s.frame, s.A, Bm.side, 0.8, s.sub === 'spladle' ? 0.15 : 0.35, cmds, dt);
    else this.edgeWork(s.frame, s.A, Bm.side, 0.4 + s.control * 0.4, 0.5 + s.base * 0.5, cmds, dt);

    if (s.sub === 'exposed' || s.sub === 'spladle') {
      this.tickExposed(dt, cmds, s, T, Bm);
      return;
    }

    if (s.sub === 'ride' || s.sub === 'flat') {
      const cb = cmds[Bm.side];
      s.pockets = clamp((s.pockets ?? 0.2) + dt * (cb.closePockets ? 0.65 * (0.5 + Bm.stamina) : -0.35), 0, 1);
      if (cb.closePockets) this.spend(Bm, dt * 0.04);
      s.legEntryCool = Math.max(0, (s.legEntryCool ?? 0) - dt);
      if (ct.legRide && T.stamina > 0.12) {
        this.spend(T, dt * 0.055);
        // Open the elbow/hip pocket first; closed pockets impede that work.
        const space = (0.12 + legRideSkill(this.wrestlers[s.A]) * 0.12) * (0.5 + T.stamina) * (1 - s.pockets * 0.55) * (1 + this.signatureEdge(s.A, 'legRider', true) * 10);
        s.legRide = clamp((s.legRide ?? 0) + dt * space, 0, 1);
        if (s.legRide >= 0.65 && s.legRide < 0.8 && s.legEntryCool <= 0) {
          // A signature leg rider (Retherford's "suffocating legs") threads them through closed pockets far more often.
          const chance = clamp(0.6 + (legRideSkill(this.wrestlers[s.A]) - wb.defense) * 0.25 - s.pockets * 0.5 - (cb.catchLeg ? 0.2 : 0) + this.signatureEdge(s.A, 'legRider', true) * 4, 0.08, 0.85);
          if (this.rng.chance(chance)) { s.legRide = 1; this.ev.announce?.('Leg ride in', 'info', 'Leg threaded through the hip pocket'); }
          else { s.legRide = 0.4; this.ev.announce?.('Leg entry denied', 'info', 'Bottom keeps the pocket closed'); }
          s.legEntryCool = 1.2;
        }
      } else if ((s.legRide ?? 0) < 0.8) s.legRide = Math.max(0, (s.legRide ?? 0) - dt * 0.08);
      if (cb.catchLeg && (s.legRide ?? 0) > 0.25 && Bm.stamina > 0.1) {
        this.spend(Bm, dt * 0.052);
        s.legCaught = clamp((s.legCaught ?? 0) + dt * (0.2 + (wb.bottom ?? wb.mat) * 0.2) * (0.5 + Bm.stamina) - (ct.legRide ? dt * 0.1 * legRideSkill(this.wrestlers[s.A]) : 0), 0, 1);
        if (s.legCaught >= LEG_CLEAR_THRESHOLD) { s.legRide = 0; s.legCaught = 0; s.legEntryCool = 1.2; s.control = Math.max(0, s.control - 0.15); this.ev.announce?.('Leg cleared', 'info', 'Inside arm catches and removes the leg'); }
      } else s.legCaught = Math.max(0, (s.legCaught ?? 0) - dt * 0.1);
      if ((s.legRide ?? 0) >= 0.8) {
        const quality=legRideQuality(this.wrestlers[s.A],s.legRide!,T.stamina,s.legCaught);
        // Loose legs provide little pressure and can cost control when attacked.
        s.control=clamp(s.control+dt*(.02+.08*quality-(cb.catchLeg?.06*(1-quality):0)),0,1);
        s.base=Math.max(0,s.base-dt*(.01+.07*quality));
      }
    }

    if (s.sub === 'ride') {
      const ride = this.styleSteps[T.side].ride;
      if (Bm.side !== this.practicePartner) s.base = Math.min(1, s.base + dt * 0.09 * (0.6 + (wb.bottom ?? wb.mat) * 0.8) * (1 - STYLE_EFFECT.rideBase * ride) * (1 + STYLE_EFFECT.bottomBase * this.styleSteps[Bm.side].bottom));
      const tp = topPlanEffects(this.plans[s.A]);
      s.control += (clamp01(tp.control + STYLE_EFFECT.rideControl * ride) - s.control) * dt * 0.25;
      s.chopT = Math.max(0, (s.chopT ?? 0) - dt);
      s.hands = Math.max(0, (s.hands ?? 0) - dt * HANDS.fade);
      s.back = Math.max(0, (s.back ?? 0) - dt * HANDS.backFade);
      s.whistle = Math.max(0, (s.whistle ?? 0) - dt);
      s.ankleT = Math.max(0, (s.ankleT ?? 0) - dt);
      // The breakdown he chose before the whistle lands (OPENER).
      if (s.opener && s.openerT !== undefined) {
        s.openerT -= dt;
        if (s.openerT <= 0) {
          s.openerT = undefined;
          const o = OPENER[s.opener];
          const label = BREAKDOWNS.find(b => b.id === s.opener)!.label;
          s.base -= o.base * (0.75 + (wt.riding ?? wt.mat) * 0.5) * (1 + STYLE_EFFECT.rideBreak * this.styleSteps[T.side].ride) * (0.6 + 0.4 * T.stamina) * (s.basing > 0 ? 0.6 : 1);
          s.control = Math.min(1, s.control + o.control);
          if (s.opener === 'chop') s.commit = 0.5;
          if (s.opener === 'ankle') s.ankleT = o.hold;
          if (s.opener === 'legs') { s.legRide = 1; s.commit = 0.4; }
          this.spend(T, 0.04);
          this.ev.feedback?.(T.side, 'fight', 'ok', label);
          if (s.base <= 0) {
            this.startMove('breakdown', s.A, s.frame, false);
            return;
          }
        }
      }
      if (drive > 0.3) {
        s.base -= dt * 0.1 * drive;
        // Riding pressure is not a lunge; only a hard drive leaves a little weight out front.
        if (drive > 0.75) s.commit = Math.max(s.commit, 0.15);
        this.spend(T, dt * 0.02);
      }
      // Top.
      if (this.take(T, 'fight')) {
        // Chops in quick succession build: basing can answer one, not a steady run of them,
        // though a tougher opponent gives up less to the run.
        const rushed = (s.chopT ?? 0) > 1.1 - CHOP_PACE.gap;
        s.chopStreak = rushed ? s.chopStreak ?? 0 : (s.chopT ?? 0) > 0 ? Math.min(3, (s.chopStreak ?? 0) + 1) : 0;
        // Breaking him down is working toward a turn, so it buys some time against a stall call.
        T.sinceTurnTry = Math.max(0, T.sinceTurnTry - 2.5);
        s.chopT = 1.1;
        const hit = 0.3 * (0.75 + (wt.riding ?? wt.mat) * 0.5) * (1 + STYLE_EFFECT.rideBreak * this.styleSteps[T.side].ride) * (0.6 + 0.4 * T.stamina) * (s.basing > 0 ? 0.5 : 1) * (1 + s.chopStreak * Math.max(0.04, 0.14 - (this.wrestlers[Bm.side].turnResist ?? 0) * 0.5)) * (rushed ? CHOP_PACE.rush : 1);
        s.base -= hit;
        s.commit = 0.5;
        s.hands = Math.max(0, (s.hands ?? 0) - HANDS.chopBreak);
        this.spend(T, 0.035);
        this.ev.feedback?.(T.side, 'fight', 'ok');
        if (s.base <= 0) {
          this.startMove('breakdown', s.A, s.frame, false);
          return;
        }
      }
      if (this.take(T, 'shoot')) {
        T.sinceTurnTry = 0;
        // With his legs in he can turn him off the leg (a turk) before the base is all the way down.
        const legsIn = (s.legRide ?? 0) >= 0.8;
        if ((s.base < 0.35 || legsIn && s.base < BOUT.turkBase) && s.turnCool <= 0) {
          const resist = this.wrestlers[Bm.side].turnResist ?? 0;
          const p = clamp(0.35 + (wt.turning ?? wt.mat) * 0.3 + STYLE_EFFECT.turnOdds * this.styleSteps[T.side].turn - wb.defense * 0.25 - (legsIn ? Math.max(0, s.base - 0.5) * 0.6 : s.base) + 0.15 * this.edge(T.side) - resist + tp.turn + (legsIn ? this.signatureEdge(T.side, 'legRider', true) : 0), Math.max(0.02, 0.08 - resist * 0.12), 0.85);
          this.spend(T, 0.05);
          if (this.rng.chance(p * PACE.turn)) {
            this.ev.feedback?.(T.side, 'shoot', 'won');
            const turnId = legsIn ? 'turk' : this.wrestlers[s.A].motion?.preferredTurn === 'cradle' ? 'cradle' : 'tilt';
            this.startMove(turnId, s.A, s.frame, false);
            // A tilt off his own drive (basing up or driving back into him) rocks him over fast (TIMING).
            if (turnId === 'tilt') this.burst(clamp01(Math.max(s.basing ?? 0, s.back ?? 0) * 2), s.A);
            return;
          }
          s.turnCool = 0.9;
          s.base = Math.min(1, s.base + 0.15);
          this.ev.feedback?.(T.side, 'shoot', 'lost');
        } else {
          s.control = Math.max(0, s.control - 0.2);
          s.commit = 0.6;
          this.ev.feedback?.(T.side, 'shoot', 'blocked');
        }
      }
      if (this.take(T, 'sprawl')) {
        s.control = Math.min(1, s.control + 0.25);
        this.ev.feedback?.(T.side, 'sprawl', 'ok');
      }
      // Sit-out: off a working base he sits through. He turns in for the escape, or the rider
      // gets under the arm and pulls him back: to his back, or he fights back to his base.
      // Granby roll: cross-step under, kick the other leg high and roll over the inside shoulder (Wikipedia
      // "Granby roll"; Fanatic Wrestling, Hudson Taylor; FloWrestling "How to hit a Granby"). Best off the
      // rider's own drive; a tight ride stops it, and stopped mid-roll he gives up base.
      if (this.granbyPending[Bm.side] > 0 && s.base > 0.3) {
        this.granbyPending[Bm.side] = 0;
        this.spend(Bm, 0.07);
        const p = clamp(0.24 + wb.quickness * 0.3 - s.control * 0.35 + s.commit * 0.5 + (1 - T.stamina) * 0.15 + this.signatureEdge(Bm.side, 'bottom', 'granbyRoll'), 0.06, 0.6) * PACE.sitOut;
        if (T.side === this.practicePartner || this.rng.chance(p)) {
          this.ev.feedback?.(Bm.side, 'shoot', 'won', 'Granby roll');
          this.startMove('granbyRoll', s.A, s.frame, false);
          return;
        }
        s.base = Math.max(0, s.base - 0.25);
        s.control = Math.min(1, s.control + 0.1);
        this.ev.feedback?.(Bm.side, 'shoot', 'lost', 'Granby roll');
      }
      if (this.sitOutPending[Bm.side] > 0 && s.base > 0.3) {
        this.sitOutPending[Bm.side] = 0;
        this.spend(Bm, 0.06);
        const escape = clamp(0.2 + wb.quickness * 0.25 - s.control * 0.4 - STYLE_EFFECT.rideHold * this.styleSteps[T.side].ride + STYLE_EFFECT.bottomOdds * this.styleSteps[Bm.side].bottom + (s.base - 0.5) * 0.5 + (1 - T.stamina) * 0.2 + tp.escape + HANDS.sitOut * (s.hands ?? 0) + HANDS.backSit * (s.back ?? 0) + this.openerEdge(s, 'sitOut'), 0.05, 0.62) * PACE.sitOut * bigBottom(this.wrestlers[Bm.side].weightClass);
        const turn = clamp(0.12 + (wt.turning ?? wt.mat) * 0.25 + STYLE_EFFECT.turnOdds * this.styleSteps[T.side].turn - wb.defense * 0.25 - (this.wrestlers[Bm.side].turnResist ?? 0), 0.03, 0.5);
        const id = T.side === this.practicePartner || this.rng.chance(escape) ? 'sitOutEscape' : this.rng.chance(turn) ? 'sitOutTurn' : 'sitOutPull';
        this.startMove(id, s.A, s.frame, false);
        // Off the hand control, his back pressure or right on the whistle, the short sit and turn-in explode (TIMING).
        if (id === 'sitOutEscape') this.burst(clamp01((s.hands ?? 0) + (s.back ?? 0) + ((s.whistle ?? 0) > 0 ? 0.5 : 0)), otherSide(s.A));
        return;
      }
      // Bottom.
      if (this.take(Bm, 'sprawl')) {
        s.base = Math.min(1, s.base + 0.16);
        s.basing = 0.5;
        // Building up is driving his back into the rider: the pressure a stand-up or sit-out goes off.
        s.back = 1;
        this.ev.feedback?.(Bm.side, 'sprawl', 'ok');
      }
      if (this.take(Bm, 'shoot')) {
        this.spend(Bm, 0.05);
        // Standing up off a weak base into a tight rider just gets you chopped back down. Back pressure, hand
        // control and going right off the whistle make it (HANDS).
        const off = HANDS.standUp * (s.hands ?? 0) + HANDS.backStand * (s.back ?? 0) + ((s.whistle ?? 0) > 0 ? HANDS.whistleStand : 0) + this.openerEdge(s, 'standUp');
        const p = clamp(0.3 + wb.quickness * 0.25 - s.control * 0.5 + (s.base - 0.5) * 0.6 + (1 - T.stamina) * 0.2 + tp.escape + off, 0.05, 0.85) * PACE.standUp * bigBottom(this.wrestlers[Bm.side].weightClass);
        // A cooperative practice partner lets a learner rehearse the escape.
        if (T.side === this.practicePartner || s.base > 0.4 && this.rng.chance(p)) {
          this.ev.tell?.(T.side, 'standup');
          this.ev.feedback?.(Bm.side, 'shoot', 'won', (s.whistle ?? 0) > 0 ? 'Off the whistle' : undefined);
          this.risingHands = s.hands ?? 0;
          this.startMove('standUp', s.A, s.frame, false);
          return;
        }
        this.ev.feedback?.(Bm.side, 'shoot', 'lost');
        s.base -= 0.12;
        s.control = Math.min(1, s.control + 0.08);
      }
      if (s.commit < HANDS.switchWindow && this.take(Bm, 'fight')) {
        // Hand fight: take the rider's wrist at the waist (HANDS). A tight rider gives it up slower.
        this.spend(Bm, 0.02);
        s.hands = Math.min(1, (s.hands ?? 0) + HANDS.gain * (0.7 + wb.quickness * 0.6) * (1.15 - 0.4 * s.control) * (0.6 + 0.4 * Bm.stamina));
        this.ev.feedback?.(Bm.side, 'fight', 'ok', 'Hand control');
      } else if (this.take(Bm, 'fight')) {
        this.spend(Bm, 0.05);
        // A switch beats weight that is out front: the more he just committed, the better it is.
        const p = clamp(0.1 + s.commit * 0.8 + ((wb.bottom ?? wb.mat) - (wt.riding ?? wt.mat)) * 0.25 - STYLE_EFFECT.rideHold * this.styleSteps[T.side].ride + STYLE_EFFECT.bottomOdds * this.styleSteps[Bm.side].bottom + wb.quickness * 0.1 + tp.escape + this.openerEdge(s, 'switch'), 0.05, 0.85) * PACE.switch;
        this.ev.tell?.(T.side, 'switch');
        if (s.base > 0.25 && this.rng.chance(p)) {
          this.ev.feedback?.(Bm.side, 'fight', 'won');
          this.startMove('switch', s.A, s.frame, false);
          return;
        }
        s.base -= 0.22;
        this.ev.feedback?.(Bm.side, 'fight', 'lost');
      }
      s.base = clamp(s.base, 0, 1);
      if (s.base <= 0) {
        this.startMove('breakdown', s.A, s.frame, false);
        return;
      }
    } else if (s.sub === 'flat') {
      const preferred=this.wrestlers[s.A].motion?.preferredTurn;
      const choice=ct.topTurn;
      const selectedBar=choice&&isArmBar(choice.style)?{style:choice.style,mirror:choice.mirror}:!choice&&isArmBar(preferred)?{style:preferred,mirror:false}:undefined;
      // A chosen cradle, or (with no choice) his legs in for a turk, else his own turn from the flat.
      const legsIn=(s.legRide??0)>=0.8;
      const wName=`${this.wrestlers[s.A].firstName} ${this.wrestlers[s.A].lastName}`;
      const flatTurn=choice&&isCradleTurn(choice.style)?choice.style:legsIn&&!choice?'turk':flatTurnFor(wName,preferred);
      if (Bm.side !== this.practicePartner) s.base = Math.min(1, s.base + dt * 0.05);
      s.heave = (s.heave ?? 0) * Math.exp(-dt * FLAT.heaveFade);
      s.flatChopT = Math.max(0, (s.flatChopT ?? 0) - dt);
      if (this.take(T, 'shoot')) {
        T.sinceTurnTry = 0;
        if (s.turnCool > 0) {
          this.ev.feedback?.(T.side, 'shoot', 'blocked');
        } else {
          // The half needs control and a bottom man who is not fighting it.
          const p = clamp(
            0.26 + (wt.turning ?? wt.mat) * 0.3 + STYLE_EFFECT.turnOdds * this.styleSteps[T.side].turn + wt.strength * 0.1 - wb.defense * 0.25 - s.base * 0.5 + (s.control - 0.5) * 0.3 - (this.wrestlers[Bm.side].turnResist ?? 0) + topPlanEffects(this.plans[s.A]).turn,
            // Against good defense the floor is what decides it, since the top man can keep trying;
            // a hard-to-turn opponent (difficulty level vs a person) lowers the floor too.
            Math.max(0.015, 0.06 - (this.wrestlers[Bm.side].turnResist ?? 0) * 0.1),
            0.85,
          );
          this.spend(T, 0.05);
          // A flattened cooperative drill partner allows the turn. Active defense
          // and ordinary matches retain the existing resistance calculation.
          const defense = cmds[Bm.side];
          const cooperativeTurn = Bm.side === this.practicePartner && s.base <= 0.05
            && !defense.shoot && !defense.fight && !defense.sprawl;
          if (cooperativeTurn || this.rng.chance(p * PACE.turn)) {
            this.ev.feedback?.(T.side, 'shoot', 'won');
            this.startMove(selectedBar ? selectedBar.style+'Turn' : isArmBar(flatTurn) ? 'halfNelson' : flatTurn, s.A, s.frame, selectedBar?.mirror??false);
            return;
          }
          s.control = Math.max(0, s.control - 0.18);
          s.base = Math.min(1, s.base + 0.12);
          s.turnCool = 0.8;
          this.ev.feedback?.(T.side, 'shoot', 'lost');
          if(selectedBar){this.startMove(selectedBar.style+'Resisted',s.A,s.frame,selectedBar.mirror);return;}
        }
      }
      if (this.take(T, 'fight')) {
        s.base = Math.max(0, s.base - 0.15 * (s.flatChopT > 0 ? FLAT.chopRepeat : 1));
        s.flatChopT = FLAT.chopWindow;
        s.heave = -0.6;
        this.spend(T, 0.02);
        this.ev.feedback?.(T.side, 'fight', 'ok');
      }
      if (this.take(T, 'sprawl')) {
        s.control = Math.min(1, s.control + 0.2);
        this.ev.feedback?.(T.side, 'sprawl', 'ok');
      }
      // All three buttons push up; holding several together is still one push.
      let pushed = false;
      for (const b of ['sprawl', 'fight', 'shoot'] as const) {
        if (this.take(Bm, b) && !pushed) {
          pushed = true;
          s.base += 0.15 * (0.7 + (wb.bottom ?? wb.mat) * 0.6) * (0.6 + 0.4 * Bm.stamina) * (1 + STYLE_EFFECT.bottomBase * this.styleSteps[Bm.side].bottom);
          s.heave = 1;
          this.spend(Bm, 0.025);
          this.ev.feedback?.(Bm.side, b, 'ok');
        }
      }
      if (s.base >= 0.68) {
        this.startMove('rebase', s.A, s.frame, false);
        return;
      }
    } else if (s.sub === 'standing') {
      // Up on his feet the bottom man walks the rider toward the edge; out of bounds restarts them.
      this.drift(s.frame, 0.5 * (0.5 + 0.5 * Bm.stamina), dt);
      s.escape = Math.max(0, s.escape - dt * 0.04);
      s.control = Math.min(1, s.control + dt * 0.05);
      // Standing switch (Hand fight with Lower): his locked hands and forward drive carry him through; it works
      // best once the lock is loosening (Fanatic Wrestling, Ben Askren; FFA Coach "Standing switch").
      if (cmds[Bm.side].level && this.take(Bm, 'fight')) {
        this.spend(Bm, 0.06);
        const p = clamp(0.1 + wb.quickness * 0.2 + s.escape * 0.4 + ((wb.bottom ?? wb.mat) - (wt.riding ?? wt.mat)) * 0.2 - STYLE_EFFECT.rideHold * this.styleSteps[T.side].ride + STYLE_EFFECT.bottomOdds * this.styleSteps[Bm.side].bottom - s.control * 0.2 + this.signatureEdge(Bm.side, 'bottom', 'standingSwitch'), 0.04, 0.45) * PACE.switch;
        if (T.side === this.practicePartner || this.rng.chance(p)) {
          this.ev.feedback?.(Bm.side, 'fight', 'won', 'Standing switch');
          this.startMove('standingSwitch', s.A, s.frame, false);
          return;
        }
        s.control = Math.min(1, s.control + 0.1);
        s.escape = Math.max(0, s.escape - 0.1);
        this.ev.feedback?.(Bm.side, 'fight', 'lost', 'Standing switch');
      }
      if (this.take(Bm, 'fight')) {
        // Breaking the lock is hand-fighting, finger by finger; a tight lock gives less.
        s.escape += 0.11 * PACE.standEscape * bigBottom(this.wrestlers[Bm.side].weightClass) * (1 - STYLE_EFFECT.rideBase * this.styleSteps[T.side].ride) * (1 + STYLE_EFFECT.bottomEscape * this.styleSteps[Bm.side].bottom) * (0.7 + wb.quickness * 0.6) * (0.6 + 0.4 * Bm.stamina) * (1.25 - s.control * 0.5) * (1 + 0.3 * this.edge(Bm.side));
        this.spend(Bm, 0.02);
        this.ev.feedback?.(Bm.side, 'fight', 'ok');
      }
      if (this.take(Bm, 'shoot')) {
        if (s.escape >= BOUT.turnOut) {
          this.spend(Bm, 0.02);
          this.ev.feedback?.(Bm.side, 'shoot', 'won');
          this.startMove('escapeTurn', s.A, s.frame, false);
          return;
        }
        s.escape += 0.07;
        this.spend(Bm, 0.02);
        this.ev.feedback?.(Bm.side, 'shoot', 'lost');
      }
      // Rear standing control: three returns with different effort and escape risks.
      const returnAction = this.take(T, 'sprawl') ? 'returnMat'
        : this.take(T, 'shoot') ? 'standingTrip'
        : this.take(T, 'fight') ? 'crotchLift' : null;
      if (returnAction) {
        const trip = returnAction === 'standingTrip';
        const lift = returnAction === 'crotchLift';
        const skill = trip ? wt.quickness : wt.strength;
        const p = clamp(0.22 + skill * 0.35 + s.control * 0.25 - s.escape * 0.7
          + Math.min(0.15, s.t * 0.05) + (lift ? -0.08 + T.stamina * 0.08 : 0), 0.05, 0.9) / bigBottom(this.wrestlers[Bm.side].weightClass);
        this.spend(T, lift ? 0.075 : trip ? 0.035 : 0.05);
        const button = trip ? 'shoot' : lift ? 'fight' : 'sprawl';
        if (this.rng.chance(p)) {
          this.ev.feedback?.(T.side, button, 'won');
          const q = clamp(0.25 + skill * 0.35 + s.control * 0.3 - s.escape * 0.5 + (lift ? 0.18 : trip ? -0.15 : 0) + (this.rng.next() - 0.5) * 0.45, 0, 1);
          const slam = !trip && T.stamina < 0.3 && this.rng.chance(RETURN.slam * (1.3 - wt.mat) * (lift ? 1.6 : 1));
          const escape = s.escape;
          this.startMove(returnAction, s.A, s.frame, false);
          this.returning = { base: q > RETURN.clean ? 0 : q < RETURN.scrappy ? 0.6 : 0.35, slam, turnIn: false, escape, move: this.position };
          return;
        }
        s.escape += lift ? 0.2 : trip ? 0.1 : 0.15;
        this.ev.feedback?.(T.side, button, 'lost');
      }
      if (s.escape >= 1) {
        this.startMove('escapeTurn', s.A, s.frame, false);
        return;
      }
    }

    // Pair drifts as the top man drives.
    if (s.sub === 'ride' || s.sub === 'flat') {
      const lat = clamp(ct.moveX * c - ct.moveZ * sn, -1, 1);
      s.frame.x += (sn * Math.max(0, drive) * 0.25 + c * lat * 0.12) * dt;
      s.frame.z += (c * Math.max(0, drive) * 0.25 - sn * lat * 0.12) * dt;
    }
    s.intensity += (Math.min(1, Math.abs(drive) + (Bm.buffer.fight + Bm.buffer.shoot > 0 ? 0.5 : 0)) - s.intensity) * Math.min(1, dt * 3);
    // The rider gets a little back; the man underneath carrying his weight only tires, more against a tight ride and
    // with the legs in (FATIGUE). Up on his feet he gets a breath.
    this.recoverStamina(T, dt, FATIGUE.topRecover);
    // Carrying him wears the bottom man down to about riddenFloor, not to empty (owner playtest, November 11); under it
    // he gets a slow breath back between his own efforts.
    if ((s.sub === 'ride' || s.sub === 'flat') && Bm.stamina > FATIGUE.riddenFloor) this.spend(Bm, dt * FATIGUE.ridden * (0.5 + s.control) * ((s.legRide ?? 0) >= 0.8 ? 1.4 : 1));
    else this.recoverStamina(Bm, dt, s.sub === 'ride' || s.sub === 'flat' ? FATIGUE.riddenBreath : 0.01);
    this.placeHold();
  }

  private tickExposed(
    dt: number,
    cmds: [Command, Command],
    s: Extract<Position, { kind: 'mat' }>,
    T: Athlete,
    Bm: Athlete,
  ): void {
    const wt = this.wrestlers[T.side].attributes;
    const wb = this.wrestlers[Bm.side].attributes;
    const locked = s.sub === 'spladle';
    // A tight leg cradle can persist with the shoulders elevated. Holding
    // defensive base protects the shoulder line but does not break the lock.
    const shouldersUp = locked && cmds[Bm.side].sprawl && Bm.stamina > 0.03;
    if (shouldersUp) {this.spend(Bm, dt * 0.008); s.pin = Math.max(0, s.pin - dt * 0.23);}
    s.expo += dt;
    // Fighting off his back is the hardest work there is (FATIGUE.back); holding him there costs a little too.
    this.spend(Bm, dt * FATIGUE.back);
    this.spend(T, dt * FATIGUE.back * 0.3);
    // A flash: he is already rolling back to his belly. It speeds up once the first count is in, so most flashes
    // are a quick 2; the top man's squeeze still slows it. A flash is seldom a pin.
    const flash = s.flash ?? 0;
    s.adjustT = Math.max(0, (s.adjustT ?? 0) - dt);
    if (flash > 0) s.fight += dt * flash * FLASH_ROLL * (s.expo < 1.5 ? 0.35 : 1) * (0.6 + 0.4 * Bm.stamina);
    if (s.awarded === 0 && s.expo >= 2) {
      s.awarded = 2;
      T.stats.nearFalls += 1;
      this.ev.score?.(T.side, 'nearFall2', 'Near fall');
      if (this.position !== s) return;
    } else if (s.awarded === 2 && s.expo >= 3) {
      s.awarded = 3;
      this.ev.score?.(T.side, 'nearFall3', 'Near fall · 3 total');
      if (this.position !== s) return;
    } else if (s.awarded === 3 && s.expo >= 4) {
      s.awarded = 4;
      this.ev.score?.(T.side, 'nearFall4', 'Near fall');
      if (this.position !== s) return;
    }
    const ct = cmds[T.side];
    const wrestler = this.wrestlers[T.side];
    const pinSkill = pinningMultiplier(`${wrestler.firstName} ${wrestler.lastName}`, this.styleSteps[T.side].pin);
    const squeezeGas = 0.5 + 0.5 * T.stamina;
    // Tightening also preserves the grip. Defensive hand work earns room to
    // lift the shoulders; it must contend with an actively maintained hold.
    if (ct.shoot || ct.fight) s.fight = Math.max(0, s.fight - dt * 0.12 * (0.7 + (wt.pinning ?? wt.mat) * 0.6) * squeezeGas);
    if (!shouldersUp && (locked || ct.shoot || ct.fight)) s.pin += dt * (1 - 0.6 * flash) * (locked ? 0.16 : 0.22) * (0.7 + wt.strength * 0.6) * pinSkill * squeezeGas * 0.85 * (1 + 0.25 * this.edge(T.side)) * PIN_PRESSURE.rate;
    // Both squeeze buttons report their own result. Concurrent presses are one effort.
    const squeezeShoot = this.take(T, 'shoot');
    const squeezeFight = this.take(T, 'fight');
    if (squeezeShoot || squeezeFight) {
      if (!shouldersUp) s.pin += 0.06 * pinSkill * squeezeGas * PIN_PRESSURE.rate;
      this.spend(T, 0.02);
      // Owner, November 10: with him on his back the top man adjusts to tighten the hold and drives him deeper.
      // On a flash each squeeze takes a little of his roll-out away, so working it can hold a tilt for a 3 or a 4;
      // fully tight it is a locked hold. A visible adjust (a bigger effort pulse) each time it tightens a step.
      let lockedIn = false;
      if (flash > 0 && !shouldersUp && (s.adjustT ?? 0) <= 0) {
        s.adjustT = FLASH_ADJUST;
        s.flash = Math.max(0, flash - FLASH_TIGHTEN * (0.6 + 0.8 * (wt.pinning ?? wt.mat)) * squeezeGas);
        lockedIn = Math.ceil(s.flash * 4) < Math.ceil(flash * 4);
      }
      const r = shouldersUp ? 'blocked' : lockedIn ? 'won' : 'ok';
      if (squeezeShoot) this.ev.feedback?.(T.side, 'shoot', r, lockedIn ? 'Tightened' : undefined);
      if (squeezeFight) this.ev.feedback?.(T.side, 'fight', r, lockedIn ? 'Tightened' : undefined);
    }
    let resisted = false;
    for (const b of ['sprawl', 'fight', 'shoot'] as const) {
      if (this.take(Bm, b)) {
        resisted = true;
        this.ev.feedback?.(Bm.side, b, 'ok');
      }
    }
    // Multiple controls in one frame are one physical effort, just like squeeze.
    // Acknowledge each control without triple-charging stamina or escape progress.
    if (resisted) {
      s.fight += (locked ? 0.018 : 0.11) * (0.7 + wb.defense * 0.6) * (0.5 + 0.5 * Bm.stamina)
      const gripRoom = locked ? 1 : 0.35 + 0.65 * clamp(s.fight, 0, 1);
      s.pin = Math.max(0, s.pin - 0.08 * (0.5 + 0.5 * Bm.stamina) * gripRoom);
      this.spend(Bm, 0.02);
    }
    // Potentially dangerous (owner's list; NCAA Rule 2.1.10): a bar, a cradle, a spladle or a head and arm being
    // cranked while he fights it can force a limb or the neck toward its limit, and the referee stops it. No
    // penalty; near-fall points already earned count; they restart top and bottom. Never with a fall being counted.
    const crankable = locked || s.turnStyle !== undefined || s.neck;
    if (resisted && crankable && (ct.shoot || ct.fight) && s.pinHold <= 0 && this.rng.chance(DANGEROUS_PER_STRAIN)) {
      this.ev.call?.('dangerous', T.side);
      return;
    }
    s.fight = Math.max(0, s.fight - dt * 0.08);
    s.pin = clamp(s.pin - dt * 0.05, 0, 1.2);
    s.intensity += (Math.min(1, s.pin + s.fight) - s.intensity) * Math.min(1, dt * 4);
    if (s.pin >= 1) {
      s.pinHold += dt;
      if (s.pinHold >= 1) {
        this.startMove('fall', s.A, s.frame, false);
        return;
      }
    } else {
      s.pinHold = Math.max(0, s.pinHold - dt);
    }
    if (s.fight >= 1 || !locked && s.expo > 8) {
      this.ev.announce?.('Fights off his back', 'info');
      this.ev.feedback?.(Bm.side, 'sprawl', 'won');
      this.startMove('fightOff', s.A, s.frame, false);
      return;
    }
    this.placeHold();
  }

  /* ---------------------------------------------------------------- moves */

  private startMove(id: MoveId, A: Side, frame: Frame, mirror: boolean, dist = 1): void {
    const def = MOVES[id];
    const from = this.position;
    // Held actions continue on the side where control was established,
    // including front-headlock grips carried out of a mirrored sprawl.
    // An explicit left/right arm-bar choice is the deliberate side-change case.
    const choosesBarSide = isArmBar(id.replace(/(?:Turn|Resisted)$/, ''));
    const holdA = this.athletes[A];
    const holdB = this.athletes[otherSide(A)];
    // Record where each role's root sits in the move's frame right now.
    const toLocal = (a: Athlete): Place => {
      const dx = a.pos.x - frame.x;
      const dz = a.pos.z - frame.z;
      const c = Math.cos(frame.yaw);
      const s = Math.sin(frame.yaw);
      return { x: dx * c - dz * s, z: dx * s + dz * c, yaw: wrap(a.yaw - frame.yaw) };
    };
    let dur = def.dur;
    if (id === 'shotDouble' || id === 'shotSingle' || id === 'shotHighCrotch' || id === 'shotLowSingle') dur = from.kind === 'shot' ? from.dur : def.dur;
    this.position = {
      kind: 'move',
      id,
      A,
      turnStyle: from.kind==='mat'?from.turnStyle:undefined,
      sourceContest: from.kind === 'legs' ? {kind:'legs', shot:from.shot, lifted:from.lifted, legFinish:from.legFinish}
        : from.kind === 'fhl' ? {kind:'fhl', recover:from.recover} : undefined,
      mirror: (from.kind === 'mat' || from.kind === 'fhl') && !choosesBarSide ? from.mirror ?? mirror : mirror,
      t: 0,
      dur,
      frame: { ...frame },
      awarded: false,
      impacted: false,
      startA: toLocal(holdA),
      startB: toLocal(holdB),
      dist,
    };
    for (const a of this.athletes) {
      a.act = 'paired';
      a.actT = 0;
    }
    this.ev.move?.(def, A);
  }

  /** The move just started is well timed (0..1): it plays faster, by TIMING.fast at 1, and hits harder. */
  private burst(b: number, side?: Side): void {
    const m = this.position;
    if (m.kind !== 'move' || b <= 0) return;
    // An explosive man's burst is bigger (STYLE_EFFECT.explBurst per step; up to 1.5 for a 5).
    m.burst = clamp01(b) * Math.max(0.5, 1 + STYLE_EFFECT.explBurst * (side === undefined ? 0 : this.styleSteps[side].expl));
    m.dur *= 1 - (1 - TIMING.fast) * m.burst;
  }

  private tickMove(dt: number, m: Extract<Position, { kind: 'move' }>): void {
    m.t += dt;
    m.scrambleGuard = Math.max(0, (m.scrambleGuard ?? 0) - dt);
    const def = MOVES[m.id];
    const u = Math.min(1, m.t / m.dur);
    if (def.impact && !m.impacted && u >= def.impact.at) {
      m.impacted = true;
      const at = frameApply(m.frame, { x: 0, z: 0.3, yaw: 0 });
      // A well-timed move (burst) lands harder: up to TIMING.impact's top.
      const strength = def.impact.strength + Math.max(0, TIMING.impact[1] - def.impact.strength) * (m.burst ?? 0);
      this.ev.impact?.(strength, { x: at.x, z: at.z }, !!def.slowmo);
    }
    if (def.award && !m.awarded && u >= def.award.at) {
      m.awarded = true;
      const to = def.award.to === 'A' ? m.A : otherSide(m.A);
      const st = this.athletes[to].stats;
      if (def.award.kind === 'takedown') st.takedowns += 1;
      if (def.award.kind === 'escape') st.escapes += 1;
      if (def.award.kind === 'reversal') st.reversals += 1;
      // A takedown that started as a high crotch is credited as one, however it was finished (it was
      // labelled "Lifted leg" or "Double leg", hiding how often the high crotch scores).
      const fromHighCrotch = m.sourceContest?.kind === 'legs' && m.sourceContest.shot === 'highCrotch' && def.award.kind === 'takedown' && m.id !== 'finishHighCrotch';
      const detail = fromHighCrotch
        ? `High crotch — ${m.id === 'liftedLegTrip' ? 'outside trip' : m.id === 'liftedLegDrive' ? 'drive back' : 'to the double'}`
        : def.award.detail;
      this.ev.score?.(to, def.award.kind, detail);
      if (this.position !== m) return; // scoring ended the bout
    }
    this.placeMove(m, u);
    for (const a of this.athletes) this.spend(a, dt * 0.01);
    if (m.t >= m.dur) this.completeMove(m);
  }

  private completeMove(m: Extract<Position, { kind: 'move' }>): void {
    const next: NextSpec = MOVES[m.id].next;
    const sideOf = (r: Role): Side => (r === 'A' ? m.A : otherSide(m.A));
    const sub = (p: Place): Frame => {
      const q = m.mirror ? { x: -p.x, z: p.z, yaw: -p.yaw } : p;
      return frameApply(m.frame, q);
    };
    switch (next.kind) {
      case 'fall':
        this.ev.fall?.(m.A);
        this.position = { kind: 'free' };
        return;
      case 'neutral': {
        const a = this.athletes[m.A];
        const b = this.athletes[otherSide(m.A)];
        const pa = sub(next.a);
        const pb = sub(next.b);
        a.pos = { x: pa.x, z: pa.z };
        a.yaw = pa.yaw;
        b.pos = { x: pb.x, z: pb.z };
        b.yaw = pb.yaw;
        for (const x of this.athletes) {
          this.resetAthlete(x);
          x.cooldown = 0.25;
        }
        if (m.offBalance) {
          // A bad shot: the shooter stumbles up off balance and can neither sprawl nor attack yet;
          // the other man, set, has a moment to reshoot.
          this.setAct(a, 'stagger', m.offBalance);
          a.reshot = m.offBalance * this.athBack(a.side) + 0.2;
          b.cooldown = 0.1;
        } else if (m.id === 'shotBlocked') {
          // A sound shot stopped short: the shooter is back quickly while the blocker is still coming up.
          a.cooldown = 0.05;
          a.chain = 0.9;
          this.setAct(b, 'sprawlRecover', 0.45);
        }
        this.position = { kind: 'neutral' };
        return;
      }
      case 'legs':
        this.position = {
          kind: 'legs',
          A: sideOf(next.A),
          shot: next.shot,
          mirror: m.mirror,
          t: 0,
          frame: sub(next.frame),
          progress: 0.4,
          intensity: 0.5,
        };
        break;
      case 'fhl':
        this.position = { kind: 'fhl', A: sideOf(next.A), mirror: m.mirror, t: 0, frame: sub(next.frame), recover: 0.15, intensity: 0.5, cooldown: 0.35 };
        break;
      case 'mat': {
        const mat = this.matPosition(sideOf(next.A), sub(next.frame), next.sub, next.base ?? 0);
        if (mat.kind === 'mat') {
          if (next.sub === 'standing') { mat.escape = 0.15 + (m.id === 'standUp' ? HANDS.carry * this.risingHands : 0); this.risingHands = 0; }
          // next.frame already reflects the finish; preserve its handed hold too.
          mat.mirror = m.mirror;
          if (m.id === 'cradle' || m.id === 'crossfaceCradle') mat.turnStyle = 'cradle';
          const bar=m.id.replace(/Turn$/,'');
          if(isArmBar(bar))mat.turnStyle=bar;
          if(m.id.endsWith('Resisted'))mat.turnCool=.8;
          if (next.sub === 'exposed' && FLASH_EXPOSURES.has(m.id)) mat.flash = 1;
          if (next.sub === 'exposed' && THROW_EXPOSURES.has(m.id)) mat.flash = this.rng.chance(throwTight(this.wrestlers[mat.A].attributes, this.styleSteps[mat.A].throws)) ? 0 : 1;
          if (next.sub === 'exposed' && m.id === 'cementMixer' && mat.flash === 0) mat.neck = true;
          // Fighting off your back leaves you scrambling, not flat and helpless.
          if (next.sub === 'flat') mat.base = m.id === 'fightOff' ? 0.45 : 0;
          if (m.id === 'fightOff') mat.turnCool = 1.6;
          if (m.id === 'rebase' || ['returnMat', 'standingTrip', 'crotchLift'].includes(m.id)) mat.turnCool = 0.6;
          if (MAT_RETURNS.has(m.id)) this.lockWatch = LOCKED_HANDS.release;
          if (MAT_RETURNS.has(m.id) && this.returning?.move === m) {
            const r = this.returning;
            this.returning = null;
            const wb = this.wrestlers[otherSide(mat.A)].attributes;
            mat.base = r.base;
            if (r.slam) mat.landing = 'slam';
            else if (r.turnIn && this.rng.chance(clamp(RETURN.turnIn + wb.quickness * 0.2 + r.escape * 0.45 - (r.base === 0 ? 0.12 : 0), 0.05, 0.6) * PACE.sitOut)) mat.landing = 'turnIn';
            else {
              if (r.turnIn) mat.base = Math.max(0, mat.base - 0.25);
              if (mat.base === 0) mat.landing = 'flat';
            }
          }
          // Whoever just put him there starts with a tight hold on him.
          const def = MOVES[m.id];
          if (def.award?.kind === 'takedown' || def.award?.kind === 'reversal') mat.control = 0.68;
          else if (['returnMat', 'standingTrip', 'crotchLift'].includes(m.id)) mat.control = 0.62;
        }
        this.position = mat;
        break;
      }
    }
    for (const a of this.athletes) {
      a.act = 'paired';
      a.actT = 0;
    }
    this.placeHold();
  }

  /**
   * A long leg battle settles in a scramble (owner): the attacker comes out with it more often the deeper he is, the
   * fresher and the better he is; otherwise the defender clears it (whizzer kick on a single, sprawled out on a
   * double), and now and then the referee still has to stop it.
   */
  private legScramble(s: Extract<Position, { kind: 'legs' }>, A: Athlete, D: Athlete, wa: Wrestler['attributes'], wd: Wrestler['attributes']): void {
    const pTD = clamp(0.32 + (s.progress - 0.5) * 0.9 + 0.15 * this.edge(A.side) + (A.stamina - D.stamina) * 0.35 + ((wa.shots ?? wa.quickness) - wd.defense) * 0.2 + STYLE_EFFECT.shotFinish * this.styleSteps[A.side].shots - STYLE_EFFECT.defFinish * this.styleSteps[D.side].def
      + STYLE_EFFECT.scrambleFinish * (this.styleSteps[A.side].scram - this.styleSteps[D.side].scram), 0.08, 0.8);
    const roll = this.rng.next();
    this.ev.announce?.('Scramble!', 'big', 'Fighting it out on the leg');
    if (roll < pTD) {
      this.startMove(s.legFinish === 'trip' ? 'liftedLegTrip' : s.shot === 'lowSingle' ? 'finishLowSingle' : s.shot === 'highCrotch' ? 'finishHighCrotch' : s.shot === 'single' ? 'finishSingle' : 'finishDouble', s.A, s.frame, s.mirror);
      return;
    }
    if (roll < 1 - LEG_BATTLE.stalemateShare) {
      D.stats.stuffs += 1;
      this.ev.feedback?.(A.side, 'shoot', 'lost');
      this.ev.feedback?.(D.side, 'fight', 'won');
      this.startMove(s.shot !== 'double' ? 'whizzerKick' : 'sprawlOut', s.A, s.frame, s.mirror);
      if (s.shot !== 'double' && this.position.kind === 'move') this.position.offBalance = 0.8;
      return;
    }
    this.ev.announce?.('Stalemate', 'info', 'Neither man could finish the scramble');
    this.stalemate();
  }

  /** Abandon a stalled position: the official restarts them on their feet. */
  private stalemate(): void {
    this.ev.whistle?.('stalemate');
    this.position = { kind: 'free' };
  }

  /**
   * Edge work (see EDGE). `def` pushes the stick toward the line to work out, `att` toward the center to turn it
   * back; each man's pull is scaled by how well the position is going for him (`powA`, `powD`) and his gas.
   * With `attOut` the man in control may also pull toward the line: a rider about to lose the standing bottom
   * man pushes or rolls out for a restart on top (owner, November 10). Elsewhere his stick only counts toward
   * the center, since pressing at the opponent is his drive. With `pivot` the pair also turns: the attacker
   * turns the corner so his drive heads back in ('att'), or the standing pair's walk turns out or in ('both').
   */
  private edgeWork(frame: Frame, att: Side, def: Side, powA: number, powD: number, cmds: [Command, Command], dt: number, pivot?: 'att' | 'both', attOut = false): void {
    this.edgeOut[0] = Math.max(0, this.edgeOut[0] - dt);
    this.edgeOut[1] = Math.max(0, this.edgeOut[1] - dt);
    if (this.practicePartner !== null && this.practicePartner !== undefined) return;
    const r = Math.hypot(frame.x, frame.z);
    const zone = clamp01((EDGE.zone - (MAT.circleRadius - r)) / (EDGE.zone - EDGE.full));
    if (zone <= 0 || r < 0.2) return;
    const ux = frame.x / r, uz = frame.z / r;
    const ca = cmds[att], cd = cmds[def];
    const out = clamp01(cd.moveX * ux + cd.moveZ * uz);
    const toward = clamp(ca.moveX * ux + ca.moveZ * uz, -1, attOut ? 1 : 0);
    const D = this.athletes[def], A = this.athletes[att];
    const pullD = out * powD * (0.5 + 0.5 * D.stamina) * zone;
    const pullA = toward * powA * (0.5 + 0.5 * A.stamina) * zone;
    if (out > 0.3) this.edgeOut[def] = 1;
    if (toward > 0.3) this.edgeOut[att] = 1;
    const v = (pullD + pullA) * EDGE.speed;
    frame.x += ux * v * dt;
    frame.z += uz * v * dt;
    if (pivot) {
      // Turning the forward drive toward the line raises its outward part: d(f.u)/dyaw = fz*ux - fx*uz.
      const fx = Math.sin(frame.yaw), fz = Math.cos(frame.yaw);
      const sgn = fz * ux - fx * uz >= 0 ? 1 : -1;
      const outward = fx * ux + fz * uz;
      const turn = (pullA < 0 ? (outward > -0.5 ? pullA : 0) : outward < 0.9 ? pullA : 0) + (pivot === 'both' && outward < 0.9 ? pullD : 0);
      frame.yaw = wrap(frame.yaw + sgn * turn * EDGE.pivot * dt);
    }
  }

  /**
   * The leg battle moves (LEG_MOTION): driving or walking him on a lifted leg, the attacker circles to turn the
   * corner; a defender who is only fighting it gives ground and turns his hips away; taps add bursts.
   */
  private legMotion(s: Extract<Position, { kind: 'legs' }>, A: Athlete, driving: boolean, lifting: boolean, working: boolean, dt: number): void {
    if (this.practicePartner !== null && this.practicePartner !== undefined) return;
    const M = LEG_MOTION;
    const dir = (s.circleDir ??= s.mirror ? -1 : 1);
    const gas = 0.5 + 0.5 * A.stamina;
    // On a knee in a low single he cannot run the pipe yet; the higher the leg, the more he can move him.
    const up = s.shot === 'double' ? 1 : 0.45 + 0.55 * (s.lifted ?? 0);
    let speed = 0;
    let turn = 0;
    if (driving) { speed += M.drive * gas; turn += M.circle * dir * up; }
    else if (lifting && (s.lifted ?? 0) > 0.4) { speed += M.walk * (s.lifted ?? 0); turn += M.circle * dir; }
    else if (working) { speed += M.give; turn -= M.circle * 0.5 * dir; }
    if (s.surge) {
      const k = s.surge / M.surgeT;
      speed += M.surge * k * gas;
      turn += M.surgeTurn * dir * k * up;
      s.surge = Math.max(0, s.surge - dt) || undefined;
    }
    if (s.hop) {
      const k = s.hop / M.hopT;
      speed += M.hop * k;
      turn -= M.hopTurn * dir * k;
      s.hop = Math.max(0, s.hop - dt) || undefined;
    }
    if (s.push) {
      speed -= M.sprawlBack * (s.push / M.hopT);
      s.push = Math.max(0, s.push - dt) || undefined;
    }
    // On a double he drives on a knee: mostly straight ahead, little circling (it would drag the knee sideways).
    if (s.shot === 'double') turn *= 0.35;
    const f = s.frame;
    if (turn) {
      // Rotate about a point between them, nearer the defender.
      const px = f.x + Math.sin(f.yaw) * M.pivot;
      const pz = f.z + Math.cos(f.yaw) * M.pivot;
      f.yaw += turn * dt;
      f.x = px - Math.sin(f.yaw) * M.pivot;
      f.z = pz - Math.cos(f.yaw) * M.pivot;
    }
    if (speed) this.drift(f, speed, dt);
  }

  /** A live scramble travels across the mat along the frame's facing; near the edge it goes out. */
  private drift(frame: Frame, speed: number, dt: number): void {
    if (this.practicePartner !== null && this.practicePartner !== undefined) return;
    frame.x += Math.sin(frame.yaw) * speed * dt;
    frame.z += Math.cos(frame.yaw) * speed * dt;
  }

  /* ---------------------------------------------------------- placements */

  private holdPlaces(): { A: Place; B: Place; frame: Frame; ASide: Side; mirror: boolean } | null {
    const p = this.position;
    switch (p.kind) {
      case 'legs':
        return { ...(HOLD_PLACES[LEG_HOLDS[p.shot]]), frame: p.frame, ASide: p.A, mirror: p.mirror };
      case 'fhl':
        return { ...HOLD_PLACES.fhl, frame: p.frame, ASide: p.A, mirror: p.mirror ?? false };
      case 'mat':
        return { ...HOLD_PLACES[p.sub], frame: p.frame, ASide: p.A, mirror: p.mirror ?? false };
      case 'shot':
        return null;
      default:
        return null;
    }
  }

  /** Keep roots where the held position puts them (camera, referee, bounds). */
  private placeHold(): void {
    const h = this.holdPlaces();
    if (!h) return;
    const place = (side: Side, p: Place) => {
      const q = h.mirror ? { x: -p.x, z: p.z, yaw: -p.yaw } : p;
      const w = frameApply(h.frame, q);
      const a = this.athletes[side];
      a.pos = { x: w.x, z: w.z };
      a.yaw = w.yaw;
      a.vel = { x: 0, z: 0 };
    };
    place(h.ASide, h.A);
    place(otherSide(h.ASide), h.B);
  }

  private placeMove(m: Extract<Position, { kind: 'move' }>, u: number): void {
    const next = MOVES[m.id].next;
    let endA: Place | null = null;
    let endB: Place | null = null;
    if (next.kind === 'neutral') {
      endA = next.a;
      endB = next.b;
    } else if (next.kind !== 'fall') {
      const holdKey =
        next.kind === 'legs'
          ? LEG_HOLDS[next.shot]
          : next.kind === 'fhl'
            ? 'fhl'
            : next.sub;
      const hold = HOLD_PLACES[holdKey];
      const ra = next.A === 'A' ? hold.A : hold.B;
      const rb = next.A === 'A' ? hold.B : hold.A;
      endA = frameApply(next.frame, ra);
      endB = frameApply(next.frame, rb);
    }
    if (!endA || !endB) return;
    const k = smooth(u);
    const lerpPlace = (a: Place, b: Place): Place => ({
      x: a.x + (b.x - a.x) * k,
      z: a.z + (b.z - a.z) * k,
      yaw: a.yaw + wrap(b.yaw - a.yaw) * k,
    });
    const mir = (p: Place): Place => (m.mirror ? { x: -p.x, z: p.z, yaw: -p.yaw } : p);
    const pa = frameApply(m.frame, lerpPlace(m.startA, mir(endA)));
    const pb = frameApply(m.frame, lerpPlace(m.startB, mir(endB)));
    const A = this.athletes[m.A];
    const B = this.athletes[otherSide(m.A)];
    A.pos = { x: pa.x, z: pa.z };
    A.yaw = pa.yaw;
    B.pos = { x: pb.x, z: pb.z };
    B.yaw = pb.yaw;
  }

  /* ------------------------------------------------------------- boundary */

  private checkBounds(): void {
    const p = this.position;
    const limit = MAT.circleRadius + 0.15;
    if (p.kind === 'neutral') {
      if (this.athletes.some((a) => Math.hypot(a.pos.x, a.pos.z) > limit)) this.ev.whistle?.('out');
      return;
    }
    const f = 'frame' in p ? p.frame : null;
    if (f && Math.hypot(f.x, f.z) > MAT.circleRadius + 0.05) this.ev.whistle?.('out');
  }

  /* --------------------------------------------------------------- reads */

  get top(): Side | null {
    const p = this.position;
    if (p.kind === 'mat') return p.A;
    return null;
  }

  /** Centre of the action, for the camera and the official. */
  get center(): Vec2 {
    const [a, b] = this.athletes;
    return { x: (a.pos.x + b.pos.x) / 2, z: (a.pos.z + b.pos.z) / 2 };
  }

  get axisYaw(): number {
    const [a, b] = this.athletes;
    return Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
  }
}
