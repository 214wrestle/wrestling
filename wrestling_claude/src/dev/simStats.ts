/**
 * Balance check: AI-vs-AI matches through the simulation only (no rendering),
 * reporting how matches are actually won. Run with `npm run sim:stats -- 40 starter`.
 *
 * Read it for shape, not exact numbers: two AIs are more active than a person.
 * What it catches is a loop (a reversal that keeps reversing), a dead position
 * (rides nobody breaks down) or a move that happens far too often or never.
 */
import { MatchSim } from '../sim/MatchSim';
import type { Position } from '../sim/bout';
import { WrestlerAI } from '../sim/ai';
import type { Difficulty } from '../sim/ai';
import { PROTOTYPE_ROSTER, ROSTER as LEGENDS_ROSTER } from '../sim/roster';

declare const process: { argv: string[] };

const N = Number(process.argv[2] ?? 30);
const level = (process.argv[3] ?? 'starter') as Difficulty;
const DT = 1 / 60;
const legends = process.argv[4] === 'legends';
const ALL_ROSTER = legends ? LEGENDS_ROSTER : PROTOTYPE_ROSTER;
const requestedAthlete = process.argv[5];
const ROSTER = requestedAthlete ? ALL_ROSTER.filter(w => w.id === requestedAthlete) : ALL_ROSTER;
if (!ROSTER.length) throw new Error(`Unknown diagnostic athlete: ${requestedAthlete}`);

const moves: Record<string, number> = {};
const scoring: Record<string, {events:number;points:number}> = {};
const whistles: Record<string, number> = {};
const legExits: Record<string, Record<string, number>> = {};
const results: Record<string, number> = {};
const totals: number[] = [];
// Compare bracket numerical finishes with numerical finishes, excluding pin scores.
const numericalTypes = new Set(['decision', 'major-decision', 'technical-fall', 'sudden-victory', 'tiebreaker', 'ultimate-rideout']);
const numerical: {winner:number;loser:number;weight:number}[] = [];
type RatingBand = {matches:number; higherWins:number; numericalTotals:number[]; results:Record<string,number>};
const ratingBands = new Map<string, RatingBand>();
const gapBand = (gap:number) => gap === 0 ? 'equal' : gap < 5 ? '1–4' : gap < 10 ? '5–9' : gap < 15 ? '10–14' : '15+';
let unfinished = 0;
const legs: number[] = [];
let matTime = 0;
let footTime = 0;
let rides = 0;
type Exposure = {kind:string;seconds:number;peakPin:number;topStart:number;bottomStart:number;topEnd:number;bottomEnd:number;exit:string};
const exposures: Exposure[] = [];

for (let m = 0; m < N; m++) {
  const a = ROSTER[m % ROSTER.length];
  let b = ROSTER[(m + 1 + Math.floor(m / ROSTER.length)) % ROSTER.length];
  if (legends) {
    const opponents = ALL_ROSTER.filter(w => w.weightClass === a.weightClass && w.school.id !== a.school.id);
    if (!opponents.length) throw new Error(`No same-weight opponent for ${a.id}`);
    b = opponents[(m + Math.floor(m / ROSTER.length)) % opponents.length];
  } else if (a.id === b.id) b = ROSTER[(m + 1) % ROSTER.length];
  const ais = [new WrestlerAI(0, level, 2000 + m * 2), new WrestlerAI(1, level, 2001 + m * 2)];
  let whistleThisTick: string | undefined;
  const sim = new MatchSim(
    [a, b],
    {
      onMove: (def) => {
        moves[def.id] = (moves[def.id] ?? 0) + 1;
      },
      onTell: (to, what) => ais[to].onTell(what),
      onWhistle: (reason) => {
        whistles[reason] = (whistles[reason] ?? 0) + 1;
        whistleThisTick = reason;
      },
      onScore: (event) => {
        const bucket = scoring[event.kind] ??= {events:0,points:0};
        bucket.events++;
        bucket.points += event.points;
      },
      onResult: (r) => {
        results[r.type] = (results[r.type] ?? 0) + 1;
        totals.push(r.score[0] + r.score[1]);
        if (a.rating !== undefined && b.rating !== undefined) {
          const gap = Math.abs(a.rating - b.rating);
          const band = gapBand(gap);
          const row = ratingBands.get(band) ?? {matches:0,higherWins:0,numericalTotals:[],results:{}};
          const higher = a.rating >= b.rating ? 0 : 1;
          row.matches++;
          if (gap > 0) row.higherWins += Number(r.winner === higher);
          row.results[r.type] = (row.results[r.type] ?? 0) + 1;
          if (numericalTypes.has(r.type)) row.numericalTotals.push(r.score[0] + r.score[1]);
          ratingBands.set(band,row);
        }
        if (numericalTypes.has(r.type)) numerical.push({
          winner: Math.max(...r.score), loser: Math.min(...r.score), weight: a.weightClass,
        });
      },
    },
    1000 + m,
  );
  sim.humanSide = 0;
  sim.startIntros();
  sim.skipIntros();
  let legsT = 0;
  let settled = 'neutral';
  let exposurePosition: Position | undefined;
  let exposure: Exposure | undefined;
  const closeExposure = (exit:string) => {
    if(exposure){exposure.exit=exit;exposures.push(exposure);}
    exposure=undefined;exposurePosition=undefined;
  };
  for (let i = 0; i < 60 * 60 * 15 && sim.phase !== 'results'; i++) {
    if (sim.phase === 'positionChoice') sim.choosePosition((['neutral', 'top', 'bottom'] as const)[m % 3]);
    const wrestling = sim.phase === 'wrestling';
    const beforePosition = sim.bout.position;
    whistleThisTick = undefined;
    sim.tick(DT, [ais[0].update(DT, sim.bout, wrestling, {timeLeft:sim.clock,finalPeriod:sim.period>=3,deficit:sim.score[1]-sim.score[0]}), ais[1].update(DT, sim.bout, wrestling, {timeLeft:sim.clock,finalPeriod:sim.period>=3,deficit:sim.score[0]-sim.score[1]})]);
    const p = sim.bout.position;
    // Count actual contested-leg exits, not all shot animations: an entry can
    // be stuffed before a leg is secured. Phase exits include period endings.
    if (wrestling && beforePosition.kind === 'legs' && (p !== beforePosition || sim.phase !== 'wrestling')) {
      const row = legExits[beforePosition.shot] ??= {};
      const exit = whistleThisTick ? `whistle:${whistleThisTick}` : sim.phase !== 'wrestling' ? `phase:${sim.phase}` : p.kind === 'move' ? p.id : p.kind;
      row[exit] = (row[exit] ?? 0) + 1;
    }
    const exposed = p.kind==='mat' && (p.sub==='exposed'||p.sub==='spladle');
    if(exposure && (p!==exposurePosition || !wrestling)) closeExposure(p.kind==='move'?p.id:sim.phase);
    if(wrestling && exposed){
      const top=sim.bout.athletes[p.A],bottom=sim.bout.athletes[p.A===0?1:0];
      if(!exposure){
        exposurePosition=p;
        exposure={kind:p.sub,seconds:0,peakPin:0,topStart:top.stamina,bottomStart:bottom.stamina,topEnd:top.stamina,bottomEnd:bottom.stamina,exit:''};
      }
      exposure.seconds+=DT;
      exposure.peakPin=Math.max(exposure.peakPin,p.pin);
      exposure.topEnd=top.stamina;exposure.bottomEnd=bottom.stamina;
    }
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
  closeExposure(sim.phase==='results'?'results':'diagnostic-limit');
  if (sim.phase !== 'results') unfinished++;
}

const quantile = (list: number[], f: number) => [...list].sort((x, y) => x - y)[Math.floor(f * (list.length - 1))] ?? 0;
console.log(`${N} requested matches, ${totals.length} completed, ${unfinished} unfinished, ${level}, ${legends ? 'legends' : 'prototype'}`);
for (const [id, n] of Object.entries(moves).sort((x, y) => y[1] - x[1])) console.log(`  ${id.padEnd(14)} ${n}`);
console.log(`mat share ${(matTime / (matTime + footTime)).toFixed(2)}, average ride ${(matTime / Math.max(1, rides)).toFixed(1)}s`);
console.log(`results ${JSON.stringify(results)}, average total points ${(totals.reduce((s, v) => s + v, 0) / Math.max(1, totals.length)).toFixed(1)}`);
const mean = (list:number[]) => list.length ? (list.reduce((sum,v)=>sum+v,0)/list.length).toFixed(2) : 'n/a';
console.log(`bracket-comparable numerical finishes: n=${numerical.length}, winner ${mean(numerical.map(r=>r.winner))}, loser ${mean(numerical.map(r=>r.loser))}, combined ${mean(numerical.map(r=>r.winner+r.loser))}; falls excluded`);
if (legends) for (const weight of [...new Set(numerical.map(r=>r.weight))].sort((a,b)=>a-b)) {
  const rows = numerical.filter(r=>r.weight===weight);
  console.log(`  weight ${weight}: n=${rows.length}, combined ${mean(rows.map(r=>r.winner+r.loser))}`);
}
console.log(`completed scoring events ${JSON.stringify(scoring)}`);
console.log(`referee whistles ${JSON.stringify(whistles)}`);
console.log(`contested-leg exits by final shot type ${JSON.stringify(legExits)}`);
console.log(`legs battles: median ${quantile(legs, 0.5).toFixed(2)}s, p75 ${quantile(legs, 0.75).toFixed(2)}s`);

for(const kind of ['exposed','spladle']){
 const rows=exposures.filter(e=>e.kind===kind);
 if(!rows.length){console.log(`${kind} contests: n=0`);continue;}
 const exits:Record<string,number>={};for(const e of rows)exits[e.exit]=(exits[e.exit]??0)+1;
 console.log(`${kind} contests: n=${rows.length}, median ${quantile(rows.map(e=>e.seconds),.5).toFixed(2)}s, mean peak pin ${mean(rows.map(e=>e.peakPin))}, peak>=1 ${rows.filter(e=>e.peakPin>=1).length}, exits ${JSON.stringify(exits)}`);
 console.log(`  stamina top ${mean(rows.map(e=>e.topStart))}→${mean(rows.map(e=>e.topEnd))}, bottom ${mean(rows.map(e=>e.bottomStart))}→${mean(rows.map(e=>e.bottomEnd))}; top starts<.2 ${rows.filter(e=>e.topStart<.2).length}, bottom starts<.2 ${rows.filter(e=>e.bottomStart<.2).length}`);
 for (const [lo,hi] of [[0,.2],[.2,.5],[.5,.8],[.8,1.01]]) {
  const group=rows.filter(e=>e.bottomStart>=lo&&e.bottomStart<hi);
  const falls=group.filter(e=>e.exit==='fall');
  console.log(`  bottom starting gas ${lo}–${Math.min(1,hi)}: contests ${group.length}, falls ${falls.length}, top starting gas ${mean(group.map(e=>e.topStart))}`);
 }
}

console.log('Rating gaps (observational roster matchups; athlete styles and sample sizes differ):');
for(const band of ['equal','1–4','5–9','10–14','15+']) {
 const row=ratingBands.get(band);
 if(!row)continue;
 console.log(`  gap ${band}: n=${row.matches}, higher-rated wins ${band==='equal'?'n/a':`${row.higherWins}/${row.matches} (${(100*row.higherWins/row.matches).toFixed(1)}%)`}, numerical combined ${mean(row.numericalTotals)} (n=${row.numericalTotals.length}), results ${JSON.stringify(row.results)}`);
}
