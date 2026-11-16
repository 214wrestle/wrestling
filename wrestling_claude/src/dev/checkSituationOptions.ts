/**
 * Situation options (owner, November 15): the named moves for each position, in fixed slots, and what each does.
 *
 * - every position offers its own short set, always four slots, and the set and its slots never change while the
 *   position lasts (the buttons must not move mid-situation);
 * - Switch to double sits in the slot the double's own finish takes, so a held finger stays on it;
 * - each named move does what it says: the leg finishes (trip, dump, drive back, switch, lift, double-leg trip,
 *   come up), the turns by name from the ride and the flat, the front-headlock finishes, and the bottom's sit out,
 *   Granby and switch; a tap released before the position takes it still does the move it named;
 * - the finish his reaction gives you (finishRead) is quicker than the one he is set against.
 */
import { Bout, finishRead, type Position } from '../sim/bout';
import { MatchSim } from '../sim/MatchSim';
import { PROTOTYPE_ROSTER } from '../sim/roster';
import { NO_COMMAND, type Command } from '../sim/types';
import { OPTION_SLOTS, optionCommand, readOptions, resolveOption, type OptionId } from '../game/situationOptions';

const ok = (v: unknown, m: string) => { if (!v) throw Error(m); };
const W: [typeof PROTOTYPE_ROSTER[0], typeof PROTOTYPE_ROSTER[1]] = [PROTOTYPE_ROSTER[0], PROTOTYPE_ROSTER[1]];
const seedOf = (n: number) => Math.imul(n, 2654435761) >>> 0;
const cmd = (patch: Partial<Command> = {}): Command => ({ ...NO_COMMAND, ...patch });
const legs = (shot: 'single' | 'double' | 'highCrotch' | 'lowSingle', extra: Partial<Extract<Position, { kind: 'legs' }>> = {}): Extract<Position, { kind: 'legs' }> =>
  ({ kind: 'legs', A: 0, shot, mirror: false, t: 2, frame: { x: 0, z: 0, yaw: 0 }, progress: 0.6, intensity: 0, ...extra });

/* ------------------------------------------------------------ the sets --- */
const sim = new MatchSim(W, {}, 99);
sim.humanSide = 0;
sim.phase = 'wrestling';
const ids = () => readOptions(sim, 0).options.map(o => o?.id ?? null);
const expect = (label: string, want: (OptionId | null)[]) => {
  const got = ids();
  ok(got.length === OPTION_SLOTS, `${label}: always ${OPTION_SLOTS} slots`);
  ok(JSON.stringify(got) === JSON.stringify(want), `${label}: ${JSON.stringify(got)} should be ${JSON.stringify(want)}`);
};
sim.bout.position = legs('single'); expect('single', ['trip', 'dump', 'double', 'driveBack']);
sim.bout.position = legs('highCrotch'); expect('high crotch', ['trip', 'dump', 'double', 'driveBack']);
sim.bout.position = legs('double'); expect('double', ['liftDouble', 'doubleTrip', 'double', null]);
sim.bout.position = legs('lowSingle'); expect('low single', ['comeUp', null, 'double', null]);
sim.bout.position = { ...legs('single'), A: 1 }; expect('defending the legs', [null, null, null, null]);
sim.bout.setReferee(0, { x: 0, z: 0 }, 0);
expect('top, ride', ['tilt', 'cradle', 'turk', 'legsIn']);
(sim.bout.position as unknown as Extract<Position, { kind: 'mat' }>).sub = 'flat';
expect('top, flat', ['halfNelson', 'armBar', 'barHalf', 'crossfaceCradle']);
sim.bout.setReferee(1, { x: 0, z: 0 }, 0);
expect('bottom, ride', ['sitOut', 'granby', 'switch', 'peterson']);
(sim.bout.position as unknown as Extract<Position, { kind: 'mat' }>).sub = 'flat';
expect('bottom, flat', ['hipHeist', null, null, null]);
(sim.bout.position as unknown as Extract<Position, { kind: 'mat' }>).sub = 'standing';
expect('bottom, standing', [null, 'standingSwitch', null, null]);
sim.bout.position = { kind: 'fhl', A: 0, t: 0, frame: { x: 0, z: 0, yaw: 0 }, recover: 0.2, intensity: 0, cooldown: 0 };
expect('front headlock', ['goBehind', 'chinWhip', 'cementMixer', 'shuck']);
sim.bout.position = { kind: 'fhl', A: 1, t: 0, frame: { x: 0, z: 0, yaw: 0 }, recover: 0.2, intensity: 0, cooldown: 0 };
expect('head trapped', ['peekOut', null, null, null]);
sim.bout.setNeutral({ x: 0, z: 0 }, 0, 1);
expect('neutral', [null, null, null, null]);
// Switch to double holds the double's finish slot: a finger on it stays on a move after the switch.
for (const shot of ['single', 'highCrotch', 'lowSingle'] as const) {
  sim.bout.position = legs(shot);
  ok(readOptions(sim, 0).options[2]?.id === 'double', `${shot}: Switch to double in slot 3`);
}
sim.bout.position = legs('double');
ok(readOptions(sim, 0).options[2]?.id === 'double', 'double: its drive in the same slot 3');
console.log('Option sets per position, four fixed slots, and the switch slot shared with the double: passed');

/* ------------------------------------- the set holds while the position does --- */
{
  const b = new Bout(W, {}, seedOf(7));
  b.position = legs('single', { progress: 0.45 });
  const s2 = new MatchSim(W, {}, 7); s2.humanSide = 0; s2.phase = 'wrestling';
  (s2 as unknown as { bout: Bout }).bout = b;
  const first = readOptions(s2, 0);
  let states = new Set<string>();
  for (let i = 0; i < 600 && b.position.kind === 'legs' && b.position.shot === 'single'; i++) {
    // Lift, let it down, the defender whizzers, sprawls and hops: the lights change, the set does not.
    const att = i < 200 ? cmd({ legAction: 'lift' }) : i < 300 ? cmd() : cmd({ legAction: 'lift' });
    const def = cmd({ fight: i % 50 < 10, sprawl: i % 70 > 60 });
    b.tick(1 / 60, [att, def]);
    if (b.position.kind !== 'legs' || b.position.shot !== 'single') break;
    const r = readOptions(s2, 0);
    ok(r.key === first.key, 'single: the key holds while he is on the single');
    ok(JSON.stringify(r.options.map(o => o?.id)) === JSON.stringify(first.options.map(o => o?.id)), 'single: the moves and their slots hold');
    states.add(r.options.map(o => o?.state).join(','));
  }
  ok(states.size > 1, 'single: the lights do change with his reaction');
  console.log(`Single leg: set and slots held over a contested battle (${states.size} light patterns): passed`);
}

/* --------------------------------------------------------- leg finishes --- */
const finishWith = (shot: 'single' | 'highCrotch' | 'double' | 'lowSingle', id: OptionId, extra: Partial<Extract<Position, { kind: 'legs' }>> = {}, defend: Partial<Command> = {}, seed = 3) => {
  const b = new Bout(W, {}, seedOf(seed));
  b.practicePartner = null;
  b.position = legs(shot, { progress: 0.9, ...extra });
  for (let i = 0; i < 600 && b.position.kind === 'legs'; i++) b.tick(1 / 60, [cmd(optionCommand(id)), cmd(defend)]);
  return b.position as Position;
};
for (const [id, move] of [['trip', 'liftedLegTrip'], ['dump', 'liftedLegDump'], ['driveBack', 'liftedLegDrive']] as const) {
  let got = '';
  for (let seed = 1; seed < 40 && got !== move; seed++) {
    const p = finishWith('single', id, { lifted: 1 }, {}, seed);
    got = p.kind === 'move' ? p.id : p.kind;
  }
  ok(got === move, `single, leg up: ${id} finishes with ${move} (got ${got})`);
}
{
  // Holding a raised-leg finish from a low leg raises it first, then finishes with it.
  let raised = false;
  for (let seed = 1; seed < 40 && !raised; seed++) {
    const p = finishWith('single', 'dump', { lifted: 0, progress: 0.75 }, {}, seed);
    raised = p.kind === 'move' && p.id === 'liftedLegDump';
  }
  ok(raised, 'single, leg low: holding Dump lifts the leg and dumps him');
}
{
  const b = new Bout(W, {}, seedOf(5));
  b.position = legs('single', { lifted: 0, progress: 0.5 });
  b.tick(1 / 60, [cmd(optionCommand('double')), cmd()]);
  ok(b.position.kind === 'legs' && b.position.shot === 'double', 'single: Switch to double makes it a double');
  // He plants the foot and whizzers: the football tackle is right there. Driving into you, his legs are back.
  const c = new Bout(W, {}, seedOf(6));
  c.position = legs('single', { lifted: 0, progress: 0.5, whizzer: 1 });
  c.tick(1 / 60, [cmd(optionCommand('double')), cmd()]);
  ok(c.position.kind === 'legs' && c.position.shot === 'double' && c.position.progress > 0.5, 'switching on his whizzer gains ground');
  const e = new Bout(W, {}, seedOf(9));
  e.position = legs('single', { lifted: 0, progress: 0.5, push: 0.3 });
  e.tick(1 / 60, [cmd(optionCommand('double')), cmd()]);
  ok(e.position.kind === 'legs' && e.position.shot === 'double' && e.position.progress < 0.5, 'switching into his sprawl gives up ground');
  const d = new Bout(W, {}, seedOf(8));
  d.position = legs('lowSingle', { progress: 0.5 });
  d.tick(1 / 60, [cmd(optionCommand('comeUp')), cmd()]);
  ok(d.position.kind === 'legs' && d.position.shot === 'single' && Math.abs((d.position.lifted ?? 0) - 0.55) < 0.05, 'low single: Come up makes it a high single with the leg up');
}
for (const [id, move] of [['liftDouble', 'liftDouble'], ['doubleTrip', 'doubleLegTrip']] as const) {
  let got = '';
  for (let seed = 1; seed < 40 && got !== move; seed++) {
    const p = finishWith('double', id, {}, {}, seed);
    got = p.kind === 'move' ? p.id : p.kind;
  }
  ok(got === move, `double: ${id} finishes with ${move} (got ${got})`);
}
console.log('Leg finishes by name (trip, dump, drive back, switch, come up, lift, double-leg trip): passed');

/* ------------------------------------------- the reaction decides the finish --- */
{
  // Same capture, same effort: the finish his reaction gives you is quicker than the one he is set against.
  // Seconds to finish (a finish that never comes counts as the full 12 s), over 80 tries.
  const time = (id: OptionId, defend: (i: number) => Partial<Command>, at: Partial<Extract<Position, { kind: 'legs' }>>) => {
    let total = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const b = new Bout(W, {}, seedOf(seed + 100));
      b.position = legs('single', { lifted: 1, progress: 0.5, ...at });
      let t = 0;
      for (let i = 0; i < 720 && b.position.kind === 'legs'; i++) { b.tick(1 / 60, [cmd(optionCommand(id)), cmd(defend(i))]); t += 1 / 60; }
      const p = b.position as Position;
      total += p.kind === 'move' && p.id.startsWith('liftedLeg') ? t : 12;
    }
    return total / 80;
  };
  // Driving into you (sprawling in, in pulses) as the finish is picked: the dump is on, the drive back is not.
  const heavy = (i: number) => ({ sprawl: i % 45 < 6 });
  const dumpHeavy = time('dump', heavy, { push: 0.3 }), driveHeavy = time('driveBack', heavy, { push: 0.3 });
  ok(dumpHeavy < driveHeavy - 0.3, `driving into you: dump ${dumpHeavy.toFixed(2)} s should beat drive back ${driveHeavy.toFixed(2)} s`);
  ok(finishRead({ shot: 'single', progress: 0.5, lifted: 1, push: 0.2 }, 'dump') === 'hot', 'driving into a raised leg: the dump reads hot');
  ok(finishRead({ shot: 'single', progress: 0.5, lifted: 0, whizzer: 1 }, 'double') === 'hot', 'planting and whizzering: the switch reads hot');
  ok(finishRead({ shot: 'single', progress: 0.5, lifted: 1, hop: 0.2 }, 'trip') === 'hot', 'hopping on the other leg: the trip reads hot');
  ok(finishRead({ shot: 'single', progress: 0.5, lifted: 1 }, 'drive') === 'hot', 'standing tall on one leg: the drive back reads hot');
  ok(finishRead({ shot: 'single', progress: 0.5, lifted: 0, push: 0.2 }, 'double') === 'cold', 'sprawling his hips back: the switch reads cold');
  ok(finishRead({ shot: 'double', progress: 0.7, push: 0.2 }, 'liftDouble') === 'cold', 'a sprawling man is not lifted');
  console.log(`Reads: driving into you, dump ${dumpHeavy.toFixed(2)} s against drive back ${driveHeavy.toFixed(2)} s: passed`);
}

/* --------------------------------------------------------------- turns --- */
const turnWith = (sub: 'ride' | 'flat', id: OptionId, setup: (p: Extract<Position, { kind: 'mat' }>) => void, tapOnly = false) => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 80; seed++) {
    const b = new Bout(W, {}, seedOf(seed));
    b.setReferee(0, { x: 0, z: 0 }, 0);
    const p = b.position as Extract<Position, { kind: 'mat' }>;
    p.sub = sub; p.base = 0.1; p.control = 0.9; p.turnCool = 0; setup(p);
    // A tap: one tick with the option down, then released before (or as) the position takes it.
    b.tick(1 / 60, [cmd(optionCommand(id)), cmd()]);
    for (let i = 0; i < (tapOnly ? 3 : 1); i++) b.tick(1 / 60, [cmd(), cmd()]);
    if (b.position.kind === 'move') seen.add(b.position.id);
  }
  return seen;
};
for (const [id, sub, move] of [
  ['tilt', 'ride', 'tilt'], ['cradle', 'ride', 'cradle'],
  ['halfNelson', 'flat', 'halfNelson'], ['armBar', 'flat', 'armBarTurn'], ['barHalf', 'flat', 'barHalfTurn'], ['crossfaceCradle', 'flat', 'crossfaceCradle'],
] as const) {
  const seen = turnWith(sub, id, () => undefined, true);
  ok(seen.has(move), `${sub}: ${id} turns him with ${move} (saw ${[...seen].join(', ') || 'nothing'})`);
  ok([...seen].every(m => m === move || m.endsWith('Resisted')), `${sub}: ${id} never becomes another turn (saw ${[...seen].join(', ')})`);
}
{
  const seen = turnWith('ride', 'turk', p => { p.legRide = 1; p.base = 0.5; });
  ok(seen.has('turk'), 'ride, legs in: Turk turns him over the leg');
  const none = turnWith('ride', 'turk', p => { p.legRide = 0; p.base = 0.1; });
  ok(!none.has('turk') && !none.has('tilt'), 'ride, no legs: Turk cannot be thrown (and is not a tilt)');
}
console.log('Turns by name from the ride and the flat, kept with a released tap: passed');

/* ------------------------------------------------------ front headlock --- */
for (const [id, move, recover] of [['goBehind', 'goBehind', 0.2], ['chinWhip', 'chinWhip', 0.6], ['cementMixer', 'cementMixer', 0.2], ['shuck', 'shuck', 0.3]] as const) {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 120; seed++) {
    const b = new Bout(W, {}, seedOf(seed));
    b.position = { kind: 'fhl', A: 0, t: 1, frame: { x: 0, z: 0, yaw: 0 }, recover, intensity: 0, cooldown: 0, drive: id === 'shuck' ? 0.8 : 0 };
    b.tick(1 / 60, [cmd(optionCommand(id)), cmd()]);
    b.tick(1 / 60, [cmd(), cmd()]);
    const after = b.position as Position;
    if (after.kind === 'move') seen.add(after.id);
  }
  ok(seen.has(move) && [...seen].every(m => m === move), `front headlock: ${id} finishes with ${move} only (saw ${[...seen].join(', ')})`);
}
{
  // Named against the position it rarely works: a chin whip on a man still flat, a cement mixer on one half up.
  const rate = (id: OptionId, recover: number) => {
    let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const b = new Bout(W, {}, seedOf(seed + 500));
      b.position = { kind: 'fhl', A: 0, t: 1, frame: { x: 0, z: 0, yaw: 0 }, recover, intensity: 0, cooldown: 0 };
      b.tick(1 / 60, [cmd(optionCommand(id)), cmd()]);
      const after = b.position as Position;
      if (after.kind === 'move' && after.id === (id === 'chinWhip' ? 'chinWhip' : 'cementMixer')) n++;
    }
    return n / 300;
  };
  ok(rate('chinWhip', 0.1) < rate('chinWhip', 0.6), 'a chin whip works off his rise, not on a flat man');
  ok(rate('cementMixer', 0.7) < rate('cementMixer', 0.2), 'a cement mixer works on a broken-down man, not one half up');
}
console.log('Front headlock finishes by name, at the odds the position gives: passed');

/* -------------------------------------------------------------- bottom --- */
{
  const tries = (id: OptionId, setup: (p: Extract<Position, { kind: 'mat' }>) => void = () => undefined) => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const b = new Bout(W, {}, seedOf(seed + 900));
      b.setReferee(1, { x: 0, z: 0 }, 0);
      const p = b.position as Extract<Position, { kind: 'mat' }>;
      p.base = 0.8; p.control = 0.4; setup(p);
      b.tick(1 / 60, [cmd(optionCommand(id)), cmd()]);
      for (let i = 0; i < 3; i++) b.tick(1 / 60, [cmd(), cmd()]);
      if (b.position.kind === 'move') seen.add(b.position.id);
    }
    return seen;
  };
  const sw = tries('switch');
  ok(sw.has('switch'), 'bottom: Switch goes for the switch even before he commits (rarely works then)');
  ok(tries('granby').has('granbyRoll'), 'bottom: Granby rolls');
  const sit = tries('sitOut');
  ok(['sitOutEscape', 'sitOutTurnOut', 'sitOutPull', 'sitOutTurn', 'hipHeist'].some(m => sit.has(m)), 'bottom: Sit out sits out');
  // A switch with his weight committed works far more often than one called early.
  const early = [...Array(300)].filter((_, i) => { const b = new Bout(W, {}, seedOf(i + 2000)); b.setReferee(1, { x: 0, z: 0 }, 0); const p = b.position as Extract<Position, { kind: 'mat' }>; p.base = 0.8; p.commit = 0; b.tick(1 / 60, [cmd(optionCommand('switch')), cmd()]); return b.position.kind === 'move' && b.position.id === 'switch'; }).length;
  const late = [...Array(300)].filter((_, i) => { const b = new Bout(W, {}, seedOf(i + 2000)); b.setReferee(1, { x: 0, z: 0 }, 0); const p = b.position as Extract<Position, { kind: 'mat' }>; p.base = 0.8; p.commit = 0.6; b.tick(1 / 60, [cmd(optionCommand('switch')), cmd()]); return b.position.kind === 'move' && b.position.id === 'switch'; }).length;
  ok(late > early * 2, `switch: committed rider ${late}/300 against early ${early}/300`);
  console.log(`Bottom: sit out, Granby, switch by name (early ${early}/300, into his weight ${late}/300): passed`);
}

/* ------------------------------------------------------------ resolving --- */
{
  sim.bout.position = legs('single');
  const r = readOptions(sim, 0);
  ok(resolveOption(r, 'dump', undefined) === 'dump', 'a touch press resolves by the move it showed');
  ok(resolveOption(r, 'halfNelson', undefined) === undefined, 'a move this position does not offer is ignored');
  ok(resolveOption(r, undefined, 2) === 'dump' && resolveOption(r, undefined, 4) === 'driveBack', 'keys 1-4 are the slots');
  sim.bout.position = legs('double');
  ok(resolveOption(readOptions(sim, 0), undefined, 4) === undefined, 'an empty slot does nothing');
  console.log('Touch and keyboard presses resolve to the move on show: passed');
}

/* ------------------------------------------------------------ scrambles --- */
{
  // Peterson roll from the bottom: a reversal into the ride, far better with the rider's weight over him.
  const peterson = (commit: number) => {
    let won = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const b = new Bout(W, {}, seedOf(seed + 3000));
      b.setReferee(1, { x: 0, z: 0 }, 0);
      const p = b.position as Extract<Position, { kind: 'mat' }>;
      p.base = 0.8; p.commit = commit; p.control = 0.5;
      b.tick(1 / 60, [cmd(optionCommand('peterson')), cmd()]);
      const after = b.position as Position;
      if (after.kind === 'move' && after.id === 'petersonRoll') won++;
    }
    return won;
  };
  const flat = peterson(0), over = peterson(0.6);
  ok(over > flat * 1.8 && over > 0, `Peterson roll: rider over him ${over}/300 against square ${flat}/300`);
  // It is a reversal: the roller ends on top with two points.
  {
    const scores: string[] = [];
    const b = new Bout(W, { score: (side, kind) => scores.push(`${side}:${kind}`) }, seedOf(77));
    b.practicePartner = 1;
    b.setReferee(1, { x: 0, z: 0 }, 0);
    (b.position as Extract<Position, { kind: 'mat' }>).base = 0.8;
    b.tick(1 / 60, [cmd(optionCommand('peterson')), cmd()]);
    for (let i = 0; i < 200 && b.position.kind === 'move'; i++) b.tick(1 / 60, [cmd(), cmd()]);
    ok(scores.includes('0:reversal') && b.position.kind === 'mat' && b.position.A === 0, `Peterson roll reverses him (scores ${scores.join(',')})`);
  }
  // Following the Granby: the rider who rolls with him keeps him (no escape), sometimes.
  {
    let followed = 0, escaped = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const scores: string[] = [];
      const b = new Bout(W, { score: (side, kind) => scores.push(`${side}:${kind}`) }, seedOf(seed + 4000));
      b.setReferee(0, { x: 0, z: 0 }, 0);
      (b.position as Extract<Position, { kind: 'mat' }>).base = 0.8;
      b.practicePartner = 0; // the rider lets the roll go off, so every try starts the Granby
      b.tick(1 / 60, [cmd(), cmd({ sitOut: true, level: true })]);
      b.practicePartner = null;
      ok((b.position as Position).kind === 'move' && (b.position as Extract<Position, { kind: 'move' }>).id === 'granbyRoll', 'the Granby goes');
      b.tick(1 / 60, [cmd(), cmd()]);
      b.tick(1 / 60, [cmd(optionCommand('follow')), cmd()]);
      const now = b.position as Position;
      if (now.kind === 'move' && now.id === 'granbyFollow') followed++;
      for (let i = 0; i < 200 && (b.position as Position).kind === 'move'; i++) b.tick(1 / 60, [cmd(), cmd()]);
      if (scores.includes('1:escape')) escaped++;
    }
    ok(followed > 10 && escaped > 10, `Granby: followed ${followed}/200, escaped ${escaped}/200`);
    console.log(`Scrambles from top: Peterson roll ${over}/300 with his weight over (square ${flat}/300), Granby followed ${followed}/200: passed`);
  }
  // Peek-out from under the sprawl: out and back in on a double the other way, or re-sprawled.
  {
    let out = 0, caught = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const b = new Bout(W, {}, seedOf(seed + 5000));
      b.position = { kind: 'fhl', A: 0, t: 1, frame: { x: 0, z: 0, yaw: 0 }, recover: 0.3, intensity: 0, cooldown: 0 };
      b.tick(1 / 60, [cmd(), cmd(optionCommand('peekOut'))]);
      const now = b.position as Position;
      if (now.kind === 'move' && now.id === 'peekOut') {
        out++;
        for (let i = 0; i < 200 && (b.position as Position).kind === 'move'; i++) b.tick(1 / 60, [cmd(), cmd()]);
        const next = b.position as Position;
        ok(next.kind === 'legs' && next.A === 1 && next.shot === 'double', 'peeked out: he is in on a double the other way');
      } else if (now.kind === 'fhl' && now.recover < 0.3) caught++;
    }
    ok(out > 20 && caught > 100, `peek-out: out ${out}/300, re-sprawled ${caught}/300`);
    // The whizzer go-behind: a defender who beats a single with the whizzer sometimes goes behind for the takedown.
    let behind = 0, kicked = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const b = new Bout(W, {}, seedOf(seed + 6000));
      b.position = legs('single', { progress: 0.02, whizzer: 1 });
      b.tick(1 / 60, [cmd(), cmd({ fight: true })]);
      const now = b.position as Position;
      if (now.kind === 'move' && now.id === 'whizzerGoBehind') behind++;
      if (now.kind === 'move' && now.id === 'whizzerKick') kicked++;
    }
    ok(behind > 10 && kicked > behind, `whizzer: go-behind ${behind}/300, kick-out ${kicked}/300`);
    console.log(`Scrambles from the feet: peek-out ${out}/300 (re-sprawled ${caught}), whizzer go-behind ${behind}/300 (kick-outs ${kicked}): passed`);
  }
}
