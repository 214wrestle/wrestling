// Owner, November 14. Bottom: "move a little more freely unless he is belly flat on the mat. More sit outs, stand ups,
// tripods, quad pods ... chain wrestling and immediately trying the next move if one doesn't work. Hand control,
// clearing hips, and back pressure are all a part of that"; "Any action is better than none". Tilts: "hold the bottom
// wrestler in NF position until they get their counts and then roll them back to their belly, release the hold and try
// it again. It is difficult to pin someone using a tilt"; Spencer Lee's arm-bar tilts. Cut is not a game plan.
// Steveson moves like a lighter man.
import { BOTTOM_CHAIN, ARM_BAR_TILT, TILT_HOLD, Rng } from '../sim/bout';
import { MatchSim } from '../sim/MatchSim';
import { ROSTER, PROTOTYPE_ROSTER } from '../sim/roster';
import { NO_COMMAND } from '../sim/types';
import type { Command, Wrestler } from '../sim/types';
import { PLAN_TOP, playerPlan } from '../sim/strategy';
import { rideUrge } from '../sim/ai';
import { moveWeight } from '../sim/weightPhysics';
import { heavyweightActivity } from '../sim/athleteProfiles';
const ok = (x: boolean, m: string) => { if (!x) throw Error(m); console.log('ok', m); };
const DT = 1 / 60;
const cmd = (c: Partial<Command>): Command => ({ ...NO_COMMAND, ...c });
const named = (n: string) => ROSTER.find((w) => w.legends && `${w.firstName} ${w.lastName}` === n)!;
function live(sub: 'ride' | 'flat' | 'exposed', base: number, seed: number, listeners: any = {}, pair: [Wrestler, Wrestler] = [PROTOTYPE_ROSTER[0], PROTOTYPE_ROSTER[1]]) {
  const sim: any = new MatchSim(pair, listeners, seed);
  sim.humanSide = 0; sim.startIntros(); sim.skipIntros();
  for (let i = 0; i < 4000 && sim.phase !== 'wrestling'; i++) { if (sim.phase === 'positionChoice') sim.choosePosition('neutral'); sim.tick(DT, [NO_COMMAND, NO_COMMAND]); }
  sim.referee = { id: 'average', label: '', patience: 40, rate: 1 };
  sim.bout.position = sim.bout.matPosition(0, { x: 0, z: 0, yaw: 0 }, sub, base);
  return sim;
}

// A stopped stand-up ends in different places (owner, November 14: "back down to the mat, broken back down to the
// mat, or he could try to stand up again"); the next different move gets the chain edge; a chop knocks him down.
{
  // The rider stops it: the bout's dice stubbed for the stand-up roll only.
  const stopStandUp = (base: number, seed: number) => {
    let lost = false;
    const sim = live('ride', base, 1, { onFeedback: (s: number, b: string, r: string, l?: string) => { if (s === 1 && b === 'shoot' && r === 'lost' && !l) lost = true; } });
    sim.bout.rng = new Rng(seed * 7919 + 13);
    const p = sim.bout.position; p.control = 0.7;
    const b0 = p.base, chance = sim.bout.rng.chance;
    sim.bout.rng.chance = () => false;
    sim.tick(DT, [cmd({}), cmd({ shoot: true })]);
    sim.bout.rng.chance = chance;
    const q = sim.bout.position;
    const where = q.kind === 'move' && q.id === 'breakdown' ? 'flat' : q === p && (p.pod ?? 0) > 0.95 ? 'half' : q === p ? 'base' : 'other';
    return { sim, p, lost, loss: b0 - p.base, where };
  };
  const ends: Record<string, number> = {};
  let keep: ReturnType<typeof stopStandUp> | null = null;
  for (let seed = 1; seed <= 200; seed++) {
    const r = stopStandUp(0.8, seed);
    if (!r.lost) continue;
    ends[r.where] = (ends[r.where] ?? 0) + 1;
    if (!keep && r.where === 'base') keep = r;
  }
  ok(!ends.other && (ends.flat ?? 0) >= 1 && (ends.flat ?? 0) <= 30 && (ends.half ?? 0) >= 30 && (ends.half ?? 0) <= 100 && (ends.base ?? 0) >= 90,
    `a stopped stand-up ends back on his base (most), still half up to go again, or now and then broken flat (${JSON.stringify(ends)} of 200)`);
  const weak = stopStandUp(0.35, 1);
  ok(weak.lost && !((weak.p.pod ?? 0) > 0) && weak.loss > 0.1, 'off a weak base he is just put back down');
  const { sim, p } = keep!;
  ok(sim.bout.chainEdge(1, 'sitOut') === BOTTOM_CHAIN.chain && sim.bout.chainEdge(1, 'switch') === BOTTOM_CHAIN.chain && sim.bout.chainEdge(1, 'standUp') === 0,
    'right after, a different move gets the chain edge and the same move again does not');
  sim.bout.bottomChain[1].t += BOTTOM_CHAIN.window + 0.05;
  ok(sim.bout.chainEdge(1, 'sitOut') === 0, `the chain edge lasts ${BOTTOM_CHAIN.window} s`);
  p.pod = 1; p.hips = 1; p.chopT = 0;
  sim.tick(DT, [cmd({ fight: true }), cmd({})]);
  ok(sim.bout.position === p && (p.pod ?? 0) === 0 && (p.hips ?? 0) <= 0.41, 'a chop knocks him out of the half-up and down out of his tripod');
}

// The sit-out family: a hip heist out of the tripod; a turn out mostly when the rider is over the top of him, a turn in
// mostly when he is not; a hip heist off his belly.
{
  const sitOut = (sub: 'ride' | 'flat', seed: number, set: (p: any) => void) => {
    const sim = live(sub, sub === 'ride' ? 0.8 : 0.3, 1);
    sim.bout.rng = new Rng(seed * 104729 + 7);
    set(sim.bout.position);
    const chance = sim.bout.rng.chance; let first = true;
    sim.bout.rng.chance = (x: number) => { if (first) { first = false; return true; } return chance.call(sim.bout.rng, x); };
    sim.tick(DT, [cmd({}), cmd({ sitOut: true })]);
    const q = sim.bout.position;
    return q.kind === 'move' ? q.id : 'none';
  };
  ok(sitOut('ride', 1, (p) => { p.hips = 1; }) === 'hipHeist', 'a sit-out out of the tripod is a hip heist');
  const count = (commit: number) => { let out = 0, inn = 0; for (let seed = 1; seed <= 40; seed++) { const id = sitOut('ride', seed, (p) => { p.hips = 0; p.commit = commit; }); if (id === 'sitOutTurnOut') out++; if (id === 'sitOutEscape') inn++; } return { out, inn }; };
  const over = count(0.5), under = count(0);
  ok(over.out > over.inn && under.inn > under.out && over.out + over.inn === 40 && under.out + under.inn === 40,
    `he turns out mostly when the rider is over the top of him (${over.out} out, ${over.inn} in), in otherwise (${under.out} out, ${under.inn} in)`);
  ok(sitOut('flat', 1, () => {}) === 'hipHeistFlat', 'a sit-out off his belly is a hip heist');
}

// On his base the stick clears his hips and moves the pair; flat on his belly it does not.
{
  const sim = live('ride', 0.9, 7); const p = sim.bout.position; p.control = 0.5;
  for (let t = 0; t < 1; t += DT) sim.tick(DT, [cmd({}), cmd({ moveX: 1 })]);
  const moved = Math.hypot(p.frame.x, p.frame.z);
  ok((p.hips ?? 0) >= BOTTOM_CHAIN.tripod && moved > 0.04, `on his base the stick works his hips out up into a tripod (${(p.hips ?? 0).toFixed(2)}) and moves him ${(moved * 100).toFixed(0)} cm`);
  const flat = live('flat', 0, 7); const f = flat.bout.position;
  for (let t = 0; t < 1; t += DT) flat.tick(DT, [cmd({}), cmd({ moveX: 1 })]);
  ok(!(f.hips > 0) && Math.hypot(f.frame.x, f.frame.z) < 0.005, 'flat on his belly the stick does nothing');
}

// A tilt held for the count is rolled back to the ride on a working base to go again; it seldom pins. (Against a
// squeezing rider and a man who does nothing it goes the 3 or 4; most AI tilts are the 2: outputs/nov14-bottom/tiltends.ts.)
{
  let rolled = 0, falls = 0, counted = 0, floorKept = true;
  for (let seed = 1; seed <= 30; seed++) {
    const scores: string[] = [];
    const sim = live('exposed', 0, seed, { onScore: (e: any) => scores.push(e.kind) });
    const p = sim.bout.position; p.tilted = true; p.flash = 1;
    let i = 0;
    for (let t = 0; t < 7 && sim.phase === 'wrestling' && !sim.result; t += DT, i++) {
      sim.tick(DT, [cmd({ shoot: true, fight: i % 20 === 0 }), cmd({})]);
      if (sim.bout.position === p && (p.flash ?? 0) < TILT_HOLD.floor - 1e-9) floorKept = false;
      if (sim.bout.position.kind === 'mat' && sim.bout.position !== p) break;
    }
    if (sim.result?.type === 'fall') falls++;
    if (scores.some((k) => /^nearFall/.test(k))) counted++;
    const q = sim.bout.position;
    if (q.kind === 'mat' && q.sub === 'ride' && Math.abs(q.base - TILT_HOLD.base) < 0.05) rolled++;
  }
  ok(floorKept, `squeezing a tilt never locks it past a flash of ${TILT_HOLD.floor}`);
  ok(falls <= 3, `a tilt held by a squeezing rider against a passive man seldom pins (${falls} of 30)`);
  ok(counted >= 25 && rolled >= 25, `held for his count he rolls him back to the ride to go again (${counted} near falls, ${rolled} rolled back of 30)`);
}

// Spencer Lee's arm-bar tilt holds him over tighter than an ordinary tilt.
{
  const flashAfterTilt = (w: Wrestler) => {
    const opp = ROSTER.find((x) => x.legends && x.weightClass === w.weightClass && x !== w)!;
    const sim = live('ride', 0.2, 3, {}, [w, opp]);
    sim.bout.startMove('tilt', 0, { x: 0, z: 0, yaw: 0 }, false);
    for (let t = 0; t < 3 && sim.bout.position.kind === 'move'; t += DT) sim.tick(DT, [cmd({}), cmd({})]);
    const q = sim.bout.position;
    return q.kind === 'mat' && q.sub === 'exposed' && q.tilted ? q.flash : -1;
  };
  ok(flashAfterTilt(named('Spencer Lee')) === ARM_BAR_TILT.loose, `Spencer Lee's tilt is a flash of ${ARM_BAR_TILT.loose}`);
  ok(flashAfterTilt(named('Zain Retherford')) === 1, 'an ordinary tilt is a full flash');
}

// Cut is not a plan; the long-ride urge; Steveson.
ok(!PLAN_TOP.some((t) => (t.id as string) === 'cut') && playerPlan({ style: 'balanced', focus: 'none', top: 'cut' }).top === 'turn', 'cut is not a game plan for the player');
ok(rideUrge(9) === 0 && rideUrge(18) === 1, 'the bottom man\'s urge builds from 10 to 18 s ridden');
const steveson = named('Gable Steveson');
ok(moveWeight(steveson) === 197 && heavyweightActivity(steveson).attack > 1, 'Steveson moves like a 197-pounder and attacks like an active heavyweight');
console.log('Bottom chain, tilt holds, Lee, cut and Steveson checks pass');
