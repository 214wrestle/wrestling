import { ROSTER, LEGENDS_WEIGHTS, LEGENDS_TEAMS } from './roster';
import { MatchSim } from './MatchSim';
import { WrestlerAI, type Difficulty } from './ai';
import type { MatchResult, Side, Wrestler } from './types';
import type { WinType } from './rules';
import { careerCredentials } from './credentials';
import { withHiddenSkill } from './hiddenSkill';

/**
 * A dual meet (owner, November 10): two all-time teams wrestle all 12 legends weights, one bout at each. Team points
 * follow the NCAA: decision 3, major decision 4, technical fall 5, fall 6 (MatchSim.result.teamPoints). The bouts go
 * up from 118 (owner: after 118 you choose your 125, then your 133, and so on); optionally, as in a college dual, a
 * draw sets the starting weight and they wrap round, and the draw always leaves the marquee bout for last (owner). Before each bout the player picks his wrestler at that weight
 * from his team's list, highest rating first, with no default; the other corner sends out its locked starter.
 */

export interface DualBoutResult {
  winner: Side;
  type: WinType;
  score: [number, number];
  teamPoints: number;
  /** Wrestled by the AI on both sides (the player chose Sim bout). */
  simulated: boolean;
}

export interface DualBout {
  weight: number;
  /** The player's pick (side 0); unset until he picks. */
  ours?: string;
  /** The other corner's starter (side 1). */
  theirs: string;
  result?: DualBoutResult;
}

export interface Dual {
  /** The player's team (side 0) and the opponent (side 1), by team id. */
  teams: [string, string];
  /** Bouts in the order wrestled, starting at the drawn weight. */
  bouts: DualBout[];
  difficulty: Difficulty;
  quick: boolean;
  /** With the draw: the marquee weight, wrestled last. */
  marquee?: number;
  /**
   * The coin toss before the dual (owner, November 10): the winning team picks odd or even bouts, and in those bouts
   * its wrestler has the choice of position in the second period; the other team has it in the rest, alternating
   * weight to weight. `odd` is the side with the choice in bouts 1, 3, 5...; unset until the winner picks.
   */
  toss: { winner: Side; odd?: Side };
}

export const teamName = (id: string) => LEGENDS_TEAMS.find((t) => t.id === id)?.team ?? id;

/** His team's wrestlers at a weight, highest rating first (unrated last). */
export function pickList(team: string, weight: number): Wrestler[] {
  return ROSTER.filter((w) => w.school.id === team && w.weightClass === weight)
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.lastName.localeCompare(b.lastName));
}

/** The other corner's man: its locked starter at the weight, else its best-rated wrestler there. */
export function cornerPick(team: string, weight: number): Wrestler {
  const list = pickList(team, weight);
  return list.find((w) => w.legends?.role === 'starter') ?? list[0];
}

/** The draw: a random starting weight, then up the weights, wrapping round. */
export function boutOrder(start: number): number[] {
  const i = Math.max(0, LEGENDS_WEIGHTS.indexOf(start));
  return [...LEGENDS_WEIGHTS.slice(i), ...LEGENDS_WEIGHTS.slice(0, i)];
}

/** National titles plus World and Olympic titles, read from his credentials line (owner corrections included). */
export function titles(w: Wrestler): number {
  const text = careerCredentials(w.ncaaCareer, `${w.firstName} ${w.lastName}`) ?? '';
  const n = (re: RegExp) => Number(text.match(re)?.[1] ?? 0);
  return n(/(\d+)x National Champ/) + n(/(\d+)x World\/Olympic Champ/);
}

export interface Marquee { weight: number; ours: Wrestler; theirs: Wrestler; titles: number; rating: number }

/**
 * The marquee bout (owner, November 10): at each weight, his best-rated man against their starter; the most combined
 * titles (national, World, Olympic), then the highest combined rating.
 */
export function marquee(teams: [string, string]): Marquee {
  const all = LEGENDS_WEIGHTS.map((weight) => {
    const ours = pickList(teams[0], weight)[0], theirs = cornerPick(teams[1], weight);
    return { weight, ours, theirs, titles: titles(ours) + titles(theirs), rating: (ours.rating ?? 0) + (theirs.rating ?? 0) };
  });
  return all.reduce((best, m) => (m.titles > best.titles || (m.titles === best.titles && m.rating > best.rating) ? m : best));
}

/**
 * Bout order. Default: 118 and up. With the draw: it starts at the weight after the marquee one, so the marquee bout
 * is always wrestled last, and wraps round.
 */
export function newDual(teams: [string, string], difficulty: Difficulty, quick: boolean, random = Math.random, draw = false): Dual {
  const m = draw ? marquee(teams) : null;
  const start = m ? LEGENDS_WEIGHTS[(LEGENDS_WEIGHTS.indexOf(m.weight) + 1) % LEGENDS_WEIGHTS.length] : LEGENDS_WEIGHTS[0];
  const winner: Side = random() < 0.5 ? 0 : 1;
  return {
    teams, difficulty, quick, marquee: m?.weight,
    // The other team's coach picks at once (odd or even, a coin flip of his own); the player picks on the dual screen.
    toss: winner === 1 ? { winner, odd: random() < 0.5 ? 1 : 0 } : { winner },
    bouts: boutOrder(start).map((weight) => ({ weight, theirs: cornerPick(teams[1], weight).id })),
  };
}

/** The toss winner picks odd or even bouts. */
export function pickOddEven(d: Dual, odd: boolean): Dual {
  return { ...d, toss: { ...d.toss, odd: odd ? d.toss.winner : (d.toss.winner === 0 ? 1 : 0) } };
}

/** Who has the second-period choice in this bout (by its number in the dual), or null before odd/even is picked. */
export function choiceFor(d: Dual, b: DualBout): Side | null {
  if (d.toss.odd === undefined) return null;
  const odd = d.bouts.indexOf(b) % 2 === 0;
  return odd ? d.toss.odd : d.toss.odd === 0 ? 1 : 0;
}

/** The bout up next (the first without a result), or null once all are wrestled. */
export function currentBout(d: Dual): DualBout | null {
  return d.bouts.find((b) => !b.result) ?? null;
}

export function teamScore(d: Dual): [number, number] {
  const s: [number, number] = [0, 0];
  for (const b of d.bouts) if (b.result) s[b.result.winner] += b.result.teamPoints;
  return s;
}

/** A copy of the dual with this result recorded on the current bout. */
export function recordBout(d: Dual, result: DualBoutResult): Dual {
  const cur = currentBout(d);
  return { ...d, bouts: d.bouts.map((b) => (b === cur ? { ...b, result } : b)) };
}

export function pickWrestler(d: Dual, id: string): Dual {
  const cur = currentBout(d);
  return { ...d, bouts: d.bouts.map((b) => (b === cur ? { ...b, ours: id } : b)) };
}

const count = (d: Dual, side: Side, types: WinType[]) => d.bouts.filter((b) => b.result?.winner === side && types.includes(b.result.type)).length;

/**
 * The winner once every bout is done: more team points, then the NCAA dual-meet tiebreakers in order (most bouts won;
 * most falls; most technical falls; most major decisions; most total match points). Null side: still tied.
 */
export function dualWinner(d: Dual): { side: Side | null; how: string } {
  const [a, b] = teamScore(d);
  if (a !== b) return { side: a > b ? 0 : 1, how: `${Math.max(a, b)}–${Math.min(a, b)}` };
  const criteria: Array<[string, (s: Side) => number]> = [
    ['more bouts won', (s) => d.bouts.filter((x) => x.result?.winner === s).length],
    ['more falls', (s) => count(d, s, ['fall'])],
    ['more technical falls', (s) => count(d, s, ['technical-fall'])],
    ['more major decisions', (s) => count(d, s, ['major-decision'])],
    ['more total match points', (s) => d.bouts.reduce((n, x) => n + (x.result?.score[s] ?? 0), 0)],
  ];
  for (const [how, f] of criteria) {
    const x = f(0), y = f(1);
    if (x !== y) return { side: x > y ? 0 : 1, how: `tied ${a}–${b}, won on ${how}` };
  }
  return { side: null, how: `tied ${a}–${b} on every tiebreaker` };
}

export const toBoutResult = (r: MatchResult, simulated: boolean): DualBoutResult =>
  ({ winner: r.winner, type: r.type, score: [r.score[0], r.score[1]], teamPoints: r.teamPoints, simulated });

/**
 * Sim bout: the two wrestle it out AI against AI at their own ratings (no difficulty help either way), full or quick
 * length. Synchronous; a full bout takes a few tenths of a second.
 */
/**
 * Both men in a simulated bout get the same back defense the AI has against a person (turn resistance and how hard
 * he fights off his back). At the AI's raw defaults two AIs pinned each other in 43% of bouts (real top-level duals:
 * falls about 8%, tech falls 8%, majors 17%; dualscan).
 */
export const SIM_BOUT = { turnResist: 0.35, survival: 2.4 };

export function simulateBout(ids: [string, string], quick: boolean, seed = (Math.random() * 2 ** 31) >>> 0, choice: Side | null = null): MatchResult {
  const pair = ids.map((id) => ({ ...withHiddenSkill(ROSTER.find((w) => w.id === id)!), ...SIM_BOUT })) as [Wrestler, Wrestler];
  const ais = [new WrestlerAI(0, 'starter', seed ^ 0x1234), new WrestlerAI(1, 'starter', seed ^ 0x9876)];
  const sim = new MatchSim(pair, { onTell: (to, what) => ais[to].onTell(what) }, seed);
  if (quick) sim.lengthScale = 0.5;
  sim.presetChoice = choice;
  sim.startIntros();
  sim.skipIntros();
  let r = seed || 1;
  const roll = () => ((r = (Math.imul(r, 1103515245) + 12345) >>> 0) / 2 ** 32);
  for (let i = 0; i < 120000 && !sim.result; i++) {
    // Side 0 has no person in a simulated bout: his corner picks like a college wrestler (mostly bottom).
    if (sim.phase === 'positionChoice' && sim.awaitingChoiceFrom !== null) {
      const x = roll();
      sim.choosePosition(x < 0.55 ? 'bottom' : x < 0.85 ? 'neutral' : 'top');
    }
    const live = sim.phase === 'wrestling';
    sim.tick(1 / 60, [ais[0].update(1 / 60, sim.bout, live), ais[1].update(1 / 60, sim.bout, live)]);
  }
  return sim.result!;
}
