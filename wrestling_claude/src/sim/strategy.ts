/**
 * Match plan: chosen during the walk-out and adjustable between periods.
 *
 * A plan is a lean, not a cheat code. Every style trades something: going after him
 * opens up your defense and burns gas; sitting back makes you hard to score on but
 * slow to score and closer to a stall call. A focus sharpens one attack.
 * The default plan (balanced, no focus) changes nothing.
 */
export type PlanStyle = 'aggressive' | 'balanced' | 'defensive';
export type PlanFocus = 'none' | 'double' | 'single' | 'highCrotch' | 'ties' | 'snap';
/** What he does with top: work to turn him (the default), ride him out for riding time, or cut him loose. */
export type TopPlan = 'turn' | 'ride' | 'cut';
export interface MatchPlan { style: PlanStyle; focus: PlanFocus; top?: TopPlan; /** AI corner only: protecting a big lead. */ protect?: boolean }

export const PLAN_TOP: { id: TopPlan; label: string; note: string }[] = [
  { id: 'turn', label: 'Turn him', note: 'Work for back points and the fall · a missed turn loosens the ride' },
  { id: 'ride', label: 'Ride', note: 'Tight ride for riding time, hard to escape · weaker turns, and the referee calls stalling sooner if you never try one' },
  { id: 'cut', label: 'Cut', note: 'Let him up for one point and go back to your feet, at the whistle and after takedowns' },
];

export const topPlanOf = (plan: MatchPlan | undefined): TopPlan => plan?.top ?? 'turn';

export interface TopPlanEffects {
  /** Where the rider's control settles while nothing happens (0.45 by default). */
  control: number;
  /** Added to the bottom man's stand-up, switch and sit-out escape chances. */
  escape: number;
  /** Added to the rider's turn chances (tilt, half, bars). */
  turn: number;
  /** Seconds of riding without trying a turn before stall time starts to build. */
  stallGrace: number;
  /** How fast it builds after that. */
  stallRate: number;
}

/**
 * Riding without trying to turn him is stalling (NCAA: the top man must work to improve his position).
 * Every rider gets the same clock; a Ride plan holds him tighter and turns less, so it reaches it sooner.
 */
/**
 * Owner, November 11: "he can't ride parallel and expect to turn someone unless he gets the legs in"; riding parallel
 * and not working for a turn or a fall is more apt to draw stalling on top. Broken down flat on his back with no leg
 * ride, the grace before stall time builds is cut to 60% and it builds 1.4x faster.
 */
export const PARALLEL_STALL = { grace: 0.6, rate: 1.4 };

export function topPlanEffects(plan: MatchPlan | undefined): TopPlanEffects {
  return topPlanOf(plan) === 'ride'
    ? { control: 0.62, escape: -0.13, turn: -0.08, stallGrace: 10, stallRate: 0.6 }
    : { control: 0.45, escape: 0, turn: 0, stallGrace: 15, stallRate: 0.45 };
}

export const DEFAULT_PLAN: MatchPlan = { style: 'balanced', focus: 'none' };

export const PLAN_STYLES: { id: PlanStyle; label: string; note: string }[] = [
  { id: 'aggressive', label: 'Aggressive', note: 'Scores more · more mistakes: tired shots get worse, stuffed shots get countered' },
  { id: 'balanced', label: 'Balanced', note: 'No trade-offs' },
  { id: 'defensive', label: 'Defensive', note: 'Lower scoring, counters his mistakes · stall calls, more so against an attacker' },
];
export const PLAN_FOCUS: { id: PlanFocus; label: string; note: string }[] = [
  { id: 'none', label: 'No focus', note: 'Take what he gives you' },
  { id: 'double', label: 'Double leg', note: 'Square shots go double, and land better' },
  { id: 'single', label: 'Single leg', note: 'Square shots go single, and land better' },
  { id: 'highCrotch', label: 'High crotch', note: 'Square shots go high crotch, and land better (a shot off a collar tie always does)' },
  { id: 'ties', label: 'Ties & picks', note: 'Win ties sooner; duck unders, drags and picks land better' },
  { id: 'snap', label: 'Snap & spin', note: 'Snap downs and spins behind land better' },
];

export interface PlanEffects {
  /** Added to shot quality. */
  attack: number;
  /** Added to tie-attack success (duck under, slide-by, picks, throw-by…). */
  tie: number;
  /** Added to the chance a well-timed sprawl stuffs the shot. */
  defense: number;
  /** Multiplies stamina spent. */
  stamina: number;
  /** Multiplies how fast passive or backing-up time builds toward a stall call. */
  stall: number;
  /** Added to the chance a reach wins the hand fight. */
  handFight: number;
  /** Added to snap-down and spin-behind chances. */
  snap: number;
  /** Shot type a square shot turns into, and the bonus for it. */
  shot?: 'double' | 'single' | 'highCrotch';
  shotBonus: number;
  /** Multiplies how much fatigue spoils a shot (aggressive keeps shooting tired). */
  tiredShot: number;
  /** Added to his own spin-behind / snap off a stuffed shot: scoring off the other man's mistake. */
  counter: number;
  /** Added to the OPPONENT's counter when this man's shot is stuffed: an over-committed shot. */
  overcommit: number;
  /** Extra stall build when the opponent is aggressive (a defender who only backs up). */
  stallVsAttacker: number;
}

export function planEffects(plan: MatchPlan = DEFAULT_PLAN): PlanEffects {
  const e: PlanEffects = { attack: 0, tie: 0, defense: 0, stamina: 1, stall: 1, handFight: 0, snap: 0, shotBonus: 0, tiredShot: 1, counter: 0, overcommit: 0, stallVsAttacker: 1 };
  if (plan.style === 'aggressive') Object.assign(e, { attack: 0.05, tie: 0.04, defense: -0.05, stamina: 1.12, stall: 0.6, handFight: 0.03, tiredShot: 1.7, overcommit: 0.12 });
  if (plan.style === 'defensive') Object.assign(e, { attack: -0.04, tie: -0.03, defense: 0.11, stamina: 0.9, stall: 1.35, counter: 0.16, stallVsAttacker: 1.0 });
  if (plan.focus === 'double' || plan.focus === 'single' || plan.focus === 'highCrotch') { e.shot = plan.focus; e.shotBonus = 0.06; }
  if (plan.focus === 'ties') { e.tie += 0.06; e.handFight += 0.06; }
  if (plan.focus === 'snap') e.snap += 0.08;
  return e;
}

/** How an AI corner adjusts between periods: chase when behind, protect a big lead. */
export function adaptPlan(current: MatchPlan, margin: number, finalPeriod = false): MatchPlan {
  const style: PlanStyle = margin <= -3 ? 'aggressive' : margin >= 5 ? 'defensive' : 'balanced';
  // On top: ahead late, ride it out for the riding-time point; behind late, cut him and go get a
  // takedown (two for one); otherwise work to turn him.
  const top: TopPlan = finalPeriod && margin >= 1 ? 'ride' : finalPeriod && margin <= -2 ? 'cut' : 'turn';
  return { ...current, style, top };
}
