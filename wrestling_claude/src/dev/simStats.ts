/**
 * Balance check: AI-vs-AI matches through the simulation only (no rendering),
 * reporting how matches are actually won. Run with `npm run sim:stats -- 40 starter`.
 *
 * Read it for shape, not exact numbers: two AIs are more active than a person.
 * What it catches is a loop (a reversal that keeps reversing), a dead position
 * (rides nobody breaks down) or a move that happens far too often or never.
 */
import { MatchSim } from '../sim/MatchSim';
import { WrestlerAI } from '../sim/ai';
import type { Difficulty } from '../sim/ai';
import { PROTOTYPE_ROSTER, ROSTER as LEGENDS_ROSTER } from '../sim/roster';

declare const process: { argv: string[] };

const N = Number(process.argv[2] ?? 30);
const level = (process.argv[3] ?? 'starter') as Difficulty;
const DT = 1 / 60;
const legends = process.argv[4] === 'legends';
const ROSTER = legends ? LEGENDS_ROSTER : PROTOTYPE_ROSTER;

const moves: Record<string, number> = {};
const results: Record<string, number> = {};
const totals: number[] = [];
const legs: number[] = [];
let matTime = 0;
let footTime = 0;
let rides = 0;

for (let m = 0; m < N; m++) {
  const a = ROSTER[m % ROSTER.length];
  let b = ROSTER[(m + 1 + Math.floor(m / ROSTER.length)) % ROSTER.length];
  if (legends) {
    const opponents = ROSTER.filter(w => w.weightClass === a.weightClass && w.school.id !== a.school.id);
    if (!opponents.length) throw new Error(`No same-weight opponent for ${a.id}`);
    b = opponents[(m + Math.floor(m / ROSTER.length)) % opponents.length];
  } else if (a.id === b.id) b = ROSTER[(m + 1) % ROSTER.length];
  const ais = [new WrestlerAI(0, level, 2000 + m * 2), new WrestlerAI(1, level, 2001 + m * 2)];
  const sim = new MatchSim(
    [a, b],
    {
      onMove: (def) => {
        moves[def.id] = (moves[def.id] ?? 0) + 1;
      },
      onTell: (to, what) => ais[to].onTell(what),
      onResult: (r) => {
        results[r.type] = (results[r.type] ?? 0) + 1;
        totals.push(r.score[0] + r.score[1]);
      },
    },
    1000 + m,
  );
  sim.humanSide = 0;
  sim.startIntros();
  sim.skipIntros();
  let legsT = 0;
  let settled = 'neutral';
  for (let i = 0; i < 60 * 60 * 15 && sim.phase !== 'results'; i++) {
    if (sim.phase === 'positionChoice') sim.choosePosition((['neutral', 'top', 'bottom'] as const)[m % 3]);
    const wrestling = sim.phase === 'wrestling';
    sim.tick(DT, [ais[0].update(DT, sim.bout, wrestling, {timeLeft:sim.clock,finalPeriod:sim.period>=3,deficit:sim.score[1]-sim.score[0]}), ais[1].update(DT, sim.bout, wrestling, {timeLeft:sim.clock,finalPeriod:sim.period>=3,deficit:sim.score[0]-sim.score[1]})]);
    const p = sim.bout.position;
    if (wrestling && p.kind === 'mat') matTime += DT;
    if (wrestling && (p.kind === 'neutral' || p.kind === 'legs' || p.kind === 'fhl')) footTime += DT;
    if (p.kind !== 'move' && p.kind !== 'free' && p.kind !== settled) {
      if (p.kind === 'mat' && settled !== 'mat') rides++;
      settled = p.kind;
    }
    if (p.kind === 'legs') legsT = p.t;
    else if (legsT > 0) {
      legs.push(legsT);
      legsT = 0;
    }
  }
}

const quantile = (list: number[], f: number) => [...list].sort((x, y) => x - y)[Math.floor(f * (list.length - 1))] ?? 0;
console.log(`${N} matches, ${level}`);
for (const [id, n] of Object.entries(moves).sort((x, y) => y[1] - x[1])) console.log(`  ${id.padEnd(14)} ${n}`);
console.log(`mat share ${(matTime / (matTime + footTime)).toFixed(2)}, average ride ${(matTime / Math.max(1, rides)).toFixed(1)}s`);
console.log(`results ${JSON.stringify(results)}, average total points ${(totals.reduce((s, v) => s + v, 0) / Math.max(1, totals.length)).toFixed(1)}`);
console.log(`legs battles: median ${quantile(legs, 0.5).toFixed(2)}s, p75 ${quantile(legs, 0.75).toFixed(2)}s`);
