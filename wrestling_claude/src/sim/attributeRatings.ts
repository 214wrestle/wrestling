import type { Wrestler } from './types';
import { DEFAULT_MOTION, HIGH_PACE_NAMES } from './athleteProfiles';

/**
 * Attribute ratings (owner, November 11–12: "assign different ratings for a series of their attributes (shots,
 * throws, defense, pinning, riding, bottom, clutch, turning, endurance, heart, etc) so their attributes contribute
 * to their overall rating"; "add athleticism, explosiveness, brawler, physicality"; chose "Build from attributes").
 *
 * Each wrestler's career-based rating (ratings.ts) is the starting point for every category. A researched 1–5
 * grade (attributeGrades.ts, from docs/research/wrestler-styles.json) pulls that category halfway toward the
 * grade's level; no grade leaves it at the career rating. The overall is the weighted average of the ability
 * categories. Pace and brawler say how he wrestles, not how well, so they are style grades outside the overall.
 * What each category does in a match is the owner's to define next; for now they feed the five match attributes.
 */
export const ABILITY_KEYS = ['shots', 'throws', 'defense', 'scrambling', 'pinning', 'riding', 'turning', 'bottom',
  'endurance', 'clutch', 'heart', 'athleticism', 'explosiveness', 'physicality'] as const;
export const STYLE_KEYS = ['pace', 'brawler'] as const;
export type AbilityKey = typeof ABILITY_KEYS[number];
export type StyleKey = typeof STYLE_KEYS[number];
export type GradeKey = AbilityKey | StyleKey;
export type AbilityRatings = Record<AbilityKey, number>;

export const ABILITY_LABELS: Record<AbilityKey, string> = {
  shots: 'Shots', throws: 'Throws', defense: 'Defense', scrambling: 'Scrambling', pinning: 'Pinning',
  riding: 'Riding', turning: 'Turning', bottom: 'Bottom', endurance: 'Endurance', clutch: 'Clutch', heart: 'Heart',
  athleticism: 'Athleticism', explosiveness: 'Explosiveness', physicality: 'Physicality',
};

/** How much each category counts toward the overall (sums to 1). */
export const OVERALL_WEIGHTS: Record<AbilityKey, number> = {
  shots: 0.14, defense: 0.12, riding: 0.08, bottom: 0.08, turning: 0.07, pinning: 0.07, endurance: 0.07,
  scrambling: 0.06, clutch: 0.06, athleticism: 0.06, physicality: 0.06, explosiveness: 0.05, throws: 0.04, heart: 0.04,
};

/** Where a grade points: 5 among the best ever at it, 4 a clear strength, 3 solid, 2 a known weakness, 1 a hole. */
export const GRADE_LEVEL: Record<1 | 2 | 3 | 4 | 5, number> = { 5: 97, 4: 91, 3: 84, 2: 76, 1: 68 };
/** Share of the way a grade pulls the category from his career rating toward the grade's level. */
export const GRADE_PULL = 0.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** One category: his career rating, pulled toward the grade's level. A 5 never pulls a higher-rated man down. */
export function categoryRating(career: number, grade?: 1 | 2 | 3 | 4 | 5): number {
  if (grade === undefined) return career;
  const level = grade === 5 ? Math.max(GRADE_LEVEL[5], career) : GRADE_LEVEL[grade];
  return clamp(Math.round(career + GRADE_PULL * (level - career)), 40, 99);
}

export function abilityRatings(career: number, grades: Partial<Record<GradeKey, 1 | 2 | 3 | 4 | 5>> = {}): AbilityRatings {
  return Object.fromEntries(ABILITY_KEYS.map((k) => [k, categoryRating(career, grades[k])])) as AbilityRatings;
}

export function overallFromAbilities(r: AbilityRatings): number {
  return Math.round(ABILITY_KEYS.reduce((s, k) => s + OVERALL_WEIGHTS[k] * r[k], 0));
}

/**
 * The five match attributes from the categories, until each category gets its own effect:
 * quickness (shot speed, scrambles, hand fight), strength (physicality: push, lifts, breakdowns), throws (lateral
 * drops and headlocks), conditioning (stamina),
 * mat (rides, turns, pins, escapes), defense (sprawls, shot defense).
 */
export function matchAttributes(r: AbilityRatings): Wrestler['attributes'] {
  const mix = (parts: [AbilityKey, number][]) => parts.reduce((s, [k, w]) => s + r[k] * w, 0) / 100;
  return {
    quickness: mix([['explosiveness', 0.5], ['athleticism', 0.5]]),
    scrambling: mix([['scrambling', 1]]),
    shots: mix([['shots', 1]]),
    strength: mix([['physicality', 1]]),
    throws: mix([['throws', 1]]),
    riding: mix([['riding', 1]]),
    turning: mix([['turning', 1]]),
    pinning: mix([['pinning', 1]]),
    bottom: mix([['bottom', 1]]),
    conditioning: mix([['endurance', 0.7], ['heart', 0.3]]),
    mat: mix([['riding', 0.3], ['turning', 0.25], ['bottom', 0.25], ['pinning', 0.2]]),
    defense: mix([['defense', 1]]),
  };
}

/**
 * Pace and brawler in a match (owner, November 12: "Pace and brawler"). Per grade step from 3 (so a 5 is two steps,
 * a 1 two steps the other way); no grade, no effect.
 * Pace: how often the AI decides, attacks and hand fights; and a high-pace man is built for it, so his own work on
 * the feet costs less stamina (player or AI). Owner-selected pace (HIGH_PACE_NAMES) keeps its own numbers.
 * Brawler: the AI walks forward, hand fights and ties up more and circles less; heavy hands wear the other man down
 * (his landed taps and snaps, and every second tied up with him, cost the opponent stamina, and his tie takes away
 * most of the breather a man gets standing in a tie). A low grade is a clean,
 * finesse wrestler: circles more, ties up less, no wear.
 */
export const STYLE_EFFECT = {
  paceTempo: 0.08, paceAttack: 0.08, paceHands: 0.04, paceWork: 0.06,
  brawlPressure: 0.06, brawlHands: 0.06, brawlCircle: 0.08, brawlTie: 0.3,
  /** Stamina off the opponent per brawler step: a landed tap or snap, and per second tied up. */
  brawlTap: 0.004, brawlTied: 0.004,
  /** Share of his breathing (neutral recovery) a brawler's tie takes away, per step. */
  brawlBreath: 0.3,
  /** Throws (owner, November 12: "Throws and physicality"): success odds, how tight he lands (flash vs straight to
   *  the back) and how often the AI looks for a throw, per step. */
  throwOdds: 0.05, throwTight: 0.05, throwAI: 0.35,
  /** Physicality: push in a tie, lift speed on a leg, pummel odds, and resisting throws and snaps, per step. */
  physForce: 0.08, physLift: 0.08, physPummel: 0.03, physResist: 0.04,
  /** Riding (owner, November 12: "Riding and turning"): breakdown force, control he settles into, how much slower the
   *  bottom man rebuilds his base, and off his escape and switch odds, per step; AI top patience. */
  rideBreak: 0.04, rideControl: 0.03, rideBase: 0.05, rideHold: 0.03, ridePatience: 0.08,
  /** Turning: turn odds (tilt, turk, half nelson, sit-out turn) per step; AI turn preference. */
  turnOdds: 0.025, turnAI: 0.06,
  /** Pinning (owner, November 12: "Pinning and bottom"): pin pressure per step (5 = 1.2, 1 = 0.8), never below the
   *  sourced fall-rate multiplier for a 3 or better; the owner's elite pinners keep 1.4 (careerAwards.ts). */
  pinGrade: 0.1,
  /** Bottom: base rebuild and stand-up progress, and sit-out/switch odds, per step. */
  bottomBase: 0.06, bottomEscape: 0.06, bottomOdds: 0.03,
  /** Shots (owner, November 12: "Shots and defense"): faster penetration (shorter shot), cleaner entry (shot quality),
   *  drive on the legs, finishing a leg scramble, and how often the AI shoots, per step. */
  shotSpeed: 0.04, shotQuality: 0.03, shotDrive: 0.05, shotFinish: 0.03, shotAI: 0.08,
  /** Defense: reading the shot (AI read and reflex sprawl), stuffing it when the sprawl lands, crossface and sprawl on
   *  the legs, and off the other man's leg scramble and attacks, per step. */
  defRead: 0.04, defStuff: 0.04, defSprawl: 0.06, defFinish: 0.03,
  /** Scrambling (owner, November 12: "Scrambling and explosiveness"): breaking up a finish when he scrambles, how far a
   *  scramble moves the position, his leg counters (sit-through, scramble roll) and coming out of a leg scramble, per
   *  step; the AI scrambles more (presses a second per step, graded 4–5). */
  scrambleOdds: 0.04, scrambleSkill: 0.08, scrambleCounter: 0.03, scrambleFinish: 0.03, scrambleAI: 0.1,
  /** Explosiveness: a well-timed move (a burst, TIMING) plays faster and hits harder, ×(1 + explBurst) per step; his
   *  shots get to the legs explShot faster per step. */
  explBurst: 0.25, explShot: 0.03,
  /** Endurance (owner, November 12: "Endurance and athleticism"): stamina spent on all his work, and his recovery
   *  (breathing in neutral and on top, stoppages, period breaks), per step. */
  endSpend: 0.05, endRecover: 0.06,
  /** Athleticism: foot speed on the feet, and how fast he is back from an off-balance moment (stumbling up from a
   *  stopped shot, coming up from his own sprawl or a fake, head up from a snap), per step. */
  athMove: 0.03, athRecover: 0.1,
  /** Clutch (owner, November 12: "Clutch and heart"): his rating edge in the third period and overtime when the score
   *  is within a takedown (clutchClose), per step; edge 1 is a 15-point rating gap, so a 5 is worth about 2 points. */
  clutchEdge: 0.07, clutchClose: 3,
  /** Heart: his rating edge while trailing (which also makes him harder to turn and pin), and his work near an empty
   *  tank (under heartLow stamina) costing less, per step. A separate off-his-back fight bonus cut falls by a fifth
   *  (heart is graded 3–5 only, nothing offsets it) and was dropped. */
  heartEdge: 0.05, heartTired: 0.08, heartLow: 0.35,
  /** Bonus-point scorer, from career tech falls per win (owner, November 12: "Yes, use them"; techFalls.ts, -1..2):
   *  his edge once he leads by a major (scorerLead) per step; the AI corner protects a lead at 7 + scorerProtect a
   *  step (a +2 never protects before the tech fall, a grinder protects at 5 up) and cuts him loose to go for
   *  takedowns instead of riding when ahead. */
  scorerEdge: 0.05, scorerLead: 8, scorerProtect: 4,
} as const;

/** Grade steps from 3: -2..2, 0 when ungraded. */
export const styleStep = (w: Pick<Wrestler, 'styleGrades'>, k: StyleKey): number => (w.styleGrades?.[k] ?? 3) - 3;
/** Any researched grade as steps from 3: -2..2, 0 when ungraded. */
export const gradeStep = (w: Pick<Wrestler, 'grades'>, k: GradeKey): number => (w.grades?.[k] ?? 3) - 3;

/** The AI's tendencies from the pace and brawler grades (run after every motion override in roster.ts). */
export function applyStyleGrades(w: Wrestler): void {
  const pace = (HIGH_PACE_NAMES as readonly string[]).includes(`${w.firstName} ${w.lastName}`) ? 0 : styleStep(w, 'pace');
  const brawl = styleStep(w, 'brawler');
  const ride = gradeStep(w, 'riding'), turn = gradeStep(w, 'turning'), shots = gradeStep(w, 'shots');
  if (!pace && !brawl && !ride && !turn && !shots) return;
  const m = w.motion ?? DEFAULT_MOTION;
  const E = STYLE_EFFECT;
  w.motion = {
    ...m,
    tempo: m.tempo * (1 + E.paceTempo * pace),
    attackRate: m.attackRate * (1 + E.paceAttack * pace) * (1 + E.shotAI * shots),
    handActivity: m.handActivity * (1 + E.paceHands * pace) * (1 + E.brawlHands * brawl),
    pressure: m.pressure * (1 + E.brawlPressure * brawl),
    circle: m.circle * (1 - E.brawlCircle * brawl),
    ...(ride ? { topPatience: (m.topPatience ?? 1) * (1 + E.ridePatience * ride) } : {}),
    ...(turn ? { turnPreference: (m.turnPreference ?? 1) * (1 + E.turnAI * turn) } : {}),
  };
}
