import { ROSTER } from './roster';
import { iconSchool } from './schoolAbbr';
import { simulateBout, titles } from './dual';
import type { Difficulty } from './ai';
import type { MatchResult, Side, Wrestler } from './types';
import type { WinType } from './rules';

/**
 * A tournament bracket at one weight (owner, November 10), NCAA style: a 32-man bracket, the best 32 at the weight
 * by rating from any school (several from one school is fine; the player's pick is always in), seeded by rating
 * (titles break ties), with teammates kept apart in the first round. Consolations are double elimination with the
 * NCAA cross-overs, placing 1st to 8th (the top eight are All-Americans). Byes only if a weight ever has fewer than 32. The player wrestles or sims his own matches;
 * the rest are simmed as the rounds go.
 */

export type Slot = { seed: number } | { winnerOf: string } | { loserOf: string };

export interface TournamentMatch {
  id: string;
  /** Round label as it is announced ("Quarterfinal", "Blood round"...). */
  round: string;
  /** Championship or consolation side of the bracket; placement matches say what they are for. */
  side: 'championship' | 'consolation' | 'placement';
  slots: [Slot, Slot];
  result?: { winner: Side; type: WinType | 'bye'; score: [number, number]; simulated: boolean };
}

export interface Tournament {
  weight: number;
  /** Entrants by seed: entrants[0] is the 1 seed. */
  entrants: string[];
  /** The player's wrestler. */
  player: string;
  matches: TournamentMatch[];
  difficulty: Difficulty;
  quick: boolean;
}

export const BRACKET = 32;

/** Standard bracket order: 1 v 32, 16 v 17, 8 v 25... (each half keeps the top seeds apart until the final). */
export function bracketOrder(size = BRACKET): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/** Seed order: by shown rating, then titles (the hidden skill never moves a seed). */
export function seedEntrants(ids: string[]): string[] {
  const w = (id: string) => ROSTER.find((x) => x.id === id)!;
  return [...ids].sort((a, b) => (w(b).rating ?? 0) - (w(a).rating ?? 0) || titles(w(b)) - titles(w(a)) || w(a).lastName.localeCompare(w(b).lastName));
}

/** The field: the best 32 at the weight by rating, his pick always among them; teammates apart in the first round. */
export function tournamentField(weight: number, player: Wrestler): string[] {
  let field = seedEntrants(ROSTER.filter((w) => w.weightClass === weight).map((w) => w.id)).slice(0, BRACKET);
  if (!field.includes(player.id)) field = [...field.slice(0, BRACKET - 1), player.id];
  return separateTeammates(seedEntrants(field));
}

/** First-round pairs as seed numbers: [1, 32], [16, 17], ... */
export const firstRoundPairs = (): Array<[number, number]> => {
  const o = bracketOrder();
  return Array.from({ length: BRACKET / 2 }, (_, i) => [o[2 * i], o[2 * i + 1]] as [number, number]);
};

/**
 * Teammates never meet in the first round (owner): when two would, the lower seed swaps lines with the nearest seed
 * that clears it without making a new clash.
 */
export function separateTeammates(seeded: string[]): string[] {
  const s = [...seeded];
  // An Icon wrestles for his own school in a tournament (owner, November 10), so Icons are teammates only of men
  // from that school.
  const school = (seed: number) => { const w = s[seed - 1] ? ROSTER.find((x) => x.id === s[seed - 1])! : null; return w ? iconSchool(w) ?? w.school.id : null; };
  const pairs = firstRoundPairs();
  const partner = (seed: number) => { const p = pairs.find((x) => x.includes(seed))!; return p[0] === seed ? p[1] : p[0]; };
  const clash = (seed: number) => school(seed) !== null && school(seed) === school(partner(seed));
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const [a, b] of pairs) {
      if (!clash(a)) continue;
      const low = Math.max(a, b);
      const near = Array.from({ length: s.length }, (_, i) => i + 1).filter((x) => x !== a && x !== b).sort((x, y) => Math.abs(x - low) - Math.abs(y - low) || x - y);
      for (const c of near) {
        [s[low - 1], s[c - 1]] = [s[c - 1], s[low - 1]];
        if (!clash(low) && !clash(c)) { moved = true; break; }
        [s[low - 1], s[c - 1]] = [s[c - 1], s[low - 1]];
      }
    }
    if (!moved) break;
  }
  return s;
}

const M = (id: string, round: string, side: TournamentMatch['side'], a: Slot, b: Slot): TournamentMatch => ({ id, round, side, slots: [a, b] });
const W = (id: string): Slot => ({ winnerOf: id });
const L = (id: string): Slot => ({ loserOf: id });

/**
 * The 32-place double-elimination bracket, in the order the session would wrestle it. Consolation cross-overs: a
 * loser from one quarter of the bracket meets survivors from the other side, so early rematches are avoided.
 */
export function buildMatches(): TournamentMatch[] {
  const order = bracketOrder();
  const m: TournamentMatch[] = [];
  for (let i = 0; i < 16; i++) m.push(M(`r1-${i}`, 'First round', 'championship', { seed: order[2 * i] }, { seed: order[2 * i + 1] }));
  for (let i = 0; i < 8; i++) m.push(M(`r2-${i}`, 'Second round', 'championship', W(`r1-${2 * i}`), W(`r1-${2 * i + 1}`)));
  for (let i = 0; i < 8; i++) m.push(M(`c1-${i}`, 'Consolation round 1', 'consolation', L(`r1-${2 * i}`), L(`r1-${2 * i + 1}`)));
  for (let i = 0; i < 4; i++) m.push(M(`qf-${i}`, 'Quarterfinal', 'championship', W(`r2-${2 * i}`), W(`r2-${2 * i + 1}`)));
  for (let i = 0; i < 8; i++) m.push(M(`c2-${i}`, 'Consolation round 2', 'consolation', W(`c1-${i}`), L(`r2-${7 - i}`)));
  for (let i = 0; i < 4; i++) m.push(M(`c3-${i}`, 'Consolation round 3', 'consolation', W(`c2-${2 * i}`), W(`c2-${2 * i + 1}`)));
  for (let i = 0; i < 2; i++) m.push(M(`sf-${i}`, 'Semifinal', 'championship', W(`qf-${2 * i}`), W(`qf-${2 * i + 1}`)));
  for (let i = 0; i < 4; i++) m.push(M(`c4-${i}`, 'Blood round', 'consolation', W(`c3-${i}`), L(`qf-${3 - i}`)));
  for (let i = 0; i < 2; i++) m.push(M(`c5-${i}`, 'Consolation quarterfinal', 'consolation', W(`c4-${2 * i}`), W(`c4-${2 * i + 1}`)));
  for (let i = 0; i < 2; i++) m.push(M(`c6-${i}`, 'Consolation semifinal', 'consolation', W(`c5-${i}`), L(`sf-${1 - i}`)));
  m.push(M('p7', '7th place', 'placement', L('c5-0'), L('c5-1')));
  m.push(M('p5', '5th place', 'placement', L('c6-0'), L('c6-1')));
  m.push(M('p3', '3rd place', 'placement', W('c6-0'), W('c6-1')));
  m.push(M('final', 'Final', 'placement', W('sf-0'), W('sf-1')));
  return m;
}

export function newTournament(weight: number, player: Wrestler, difficulty: Difficulty, quick: boolean): Tournament {
  return byes({ weight, entrants: tournamentField(weight, player), player: player.id, matches: buildMatches(), difficulty, quick });
}

/** Who fills a slot: a wrestler id, null for a bye, undefined while it is not decided yet. */
export function resolveSlot(t: Tournament, s: Slot): string | null | undefined {
  if ('seed' in s) return t.entrants[s.seed - 1] ?? null;
  const id = 'winnerOf' in s ? s.winnerOf : s.loserOf;
  const m = t.matches.find((x) => x.id === id)!;
  if (!m.result) return undefined;
  const pair = m.slots.map((x) => resolveSlot(t, x)) as [string | null, string | null];
  return 'winnerOf' in s ? pair[m.result.winner] : pair[m.result.winner === 0 ? 1 : 0];
}

export const pairOf = (t: Tournament, m: TournamentMatch) => m.slots.map((s) => resolveSlot(t, s)) as [string | null | undefined, string | null | undefined];
const ready = (t: Tournament, m: TournamentMatch) => !m.result && pairOf(t, m).every((x) => x !== undefined);

/** Fill every bye (and every match with no one in it) as soon as it is known. */
export function byes(t: Tournament): Tournament {
  let changed = true;
  let out = t;
  while (changed) {
    changed = false;
    out = {
      ...out,
      matches: out.matches.map((m) => {
        if (!ready(out, m)) return m;
        const [a, b] = pairOf(out, m);
        if (a !== null && b !== null) return m;
        changed = true;
        return { ...m, result: { winner: (a === null ? 1 : 0) as Side, type: 'bye' as const, score: [0, 0] as [number, number], simulated: true } };
      }),
    };
  }
  return out;
}

export function record(t: Tournament, id: string, result: NonNullable<TournamentMatch['result']>): Tournament {
  return byes({ ...t, matches: t.matches.map((m) => (m.id === id ? { ...m, result } : m)) });
}

/** The player's next match: unplayed, both men known, him in it. Null if he has none left. */
export function playerMatch(t: Tournament): TournamentMatch | null {
  return t.matches.find((m) => ready(t, m) && pairOf(t, m).includes(t.player)) ?? null;
}

/** He is still in it: some unplayed match he could yet reach. */
export function stillIn(t: Tournament): boolean {
  if (playerMatch(t)) return true;
  // Not eliminated while a match he is in is waiting on the other man.
  return t.matches.some((m) => !m.result && m.slots.some((s) => resolveSlot(t, s) === t.player));
}

export const isDone = (t: Tournament) => t.matches.every((m) => m.result);

/**
 * Sim everyone else's bouts, in order, until the player's next match is ready (or, once he is out, until the end).
 * `limit` caps the bouts simmed in one call so the screen can stay responsive.
 */
export function simUntilPlayer(t: Tournament, limit = Infinity): Tournament {
  let out = t;
  let n = 0;
  for (;;) {
    if (isDone(out) || n >= limit) return out;
    // Session order: every bout ahead of his in the order goes first, so a round finishes before the next starts.
    const m = out.matches.find((x) => ready(out, x));
    if (!m || pairOf(out, m).includes(out.player)) return out;
    out = simMatch(out, m);
    n++;
  }
}

/** Every bout still to wrestle before his next one (for the screen to show the round is still going). */
export const boutsAhead = (t: Tournament) => {
  const mine = playerMatch(t);
  if (!mine) return 0;
  const i = t.matches.indexOf(mine);
  return t.matches.slice(0, i).filter((m) => !m.result).length;
};

export function simMatch(t: Tournament, m: TournamentMatch): Tournament {
  const [a, b] = pairOf(t, m) as [string, string];
  const r = simulateBout([a, b], t.quick);
  return record(t, m.id, toResult(r, true));
}

export const toResult = (r: MatchResult, simulated: boolean): NonNullable<TournamentMatch['result']> =>
  ({ winner: r.winner, type: r.type, score: [r.score[0], r.score[1]], simulated });

/** Places 1-8 once known (the top eight are All-Americans). */
export function placements(t: Tournament): Array<{ place: number; id: string }> {
  const out: Array<{ place: number; id: string }> = [];
  for (const [id, first] of [['final', 1], ['p3', 3], ['p5', 5], ['p7', 7]] as const) {
    const m = t.matches.find((x) => x.id === id)!;
    if (!m.result) continue;
    const pair = pairOf(t, m) as [string | null, string | null];
    const win = pair[m.result.winner], lose = pair[m.result.winner === 0 ? 1 : 0];
    if (win) out.push({ place: first, id: win });
    if (lose) out.push({ place: first + 1, id: lose });
  }
  return out.sort((x, y) => x.place - y.place);
}

export const seedOf = (t: Tournament, id: string) => t.entrants.indexOf(id) + 1;
