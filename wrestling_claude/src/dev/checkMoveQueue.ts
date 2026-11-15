// Owner, November 14: "improving the fluidity of it and just responsiveness to the moves ... as much like a PlayStation
// game, like UFC". A press in a move's last moments is kept until it ends and goes off then (MOVE_QUEUE); an early press
// still drops; the turn-in as he lands is not also a stand-up. Restarts: shorter waits on the marks (RESTART), the whistle
// soon after the player on top picks his breakdown, and the walk back can be skipped.
import { MOVE_QUEUE, Rng } from '../sim/bout';
import { MatchSim, RESTART } from '../sim/MatchSim';
import { MOVES } from '../sim/moves';
import { PROTOTYPE_ROSTER } from '../sim/roster';
import { NO_COMMAND } from '../sim/types';
import type { Command } from '../sim/types';
const ok = (x: boolean, m: string) => { if (!x) throw Error(m); console.log('ok', m); };
const DT = 1 / 60;
const cmd = (c: Partial<Command>): Command => ({ ...NO_COMMAND, ...c });
function live(seed: number, listeners: any = {}) {
  const sim: any = new MatchSim([PROTOTYPE_ROSTER[0], PROTOTYPE_ROSTER[1]], listeners, seed);
  sim.humanSide = 0; sim.startIntros(); sim.skipIntros();
  for (let i = 0; i < 4000 && sim.phase !== 'wrestling'; i++) { if (sim.phase === 'positionChoice') sim.choosePosition('neutral'); sim.tick(DT, [NO_COMMAND, NO_COMMAND]); }
  sim.referee = { id: 'average', label: '', patience: 40, rate: 1 };
  sim.bout.rng = new Rng(seed * 7919 + 13);
  sim.bout.position = sim.bout.matPosition(0, { x: 0, z: 0, yaw: 0 }, 'ride', 0.8);
  return sim;
}

// The bottom man (side 1) presses Stand up `at` seconds into a stopped sit-out (pulled back to his base): does he go as
// it ends? His answer is his stand-up's own feedback (made or stopped) or the stand-up itself.
const pressInMove = (at: number, seed: number) => {
  let answered = -1, t = 0;
  const sim = live(seed, { onFeedback: (s: number, b: string) => { if (s === 1 && b === 'shoot' && answered < 0) answered = t; } });
  sim.bout.startMove('sitOutPull', 0, { x: 0, z: 0, yaw: 0 }, false);
  const dur = sim.bout.position.dur;
  let standUp = -1;
  for (; t < dur + 1; t += DT) {
    const press = t >= at && t < at + 0.08;
    sim.tick(DT, [cmd({}), cmd({ shoot: press })]);
    const p = sim.bout.position;
    if (standUp < 0 && p.kind === 'move' && p.id === 'standUp') standUp = t;
  }
  return { dur, answered, standUp };
};
{
  const dur = MOVES.sitOutPull.dur;
  let late = 0, lateFast = 0, early = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const l = pressInMove(dur - 0.3, seed);
    const go = [l.answered, l.standUp].filter((x) => x >= 0);
    if (go.length) { late++; if (Math.min(...go) <= l.dur + 0.15) lateFast++; }
    const e = pressInMove(0.2, seed);
    if (e.answered >= 0 || e.standUp >= 0) early++;
  }
  ok(late >= 36, `a press in the last ${MOVE_QUEUE.window} s of a move goes off once it ends (${late} of 40)`);
  ok(lateFast >= late - 2, `... right as it ends, not a beat later (${lateFast} of ${late} within 0.15 s)`);
  ok(early === 0, `a press early in the move still drops: no stand-up from mashing through it (${early} of 40)`);
}
// Turning in as he lands on a mat return spends the press: none of it is left queued for a stand-up once he is down.
{
  let turnIns = 0, leftover = 0;
  for (let seed = 1; seed <= 30; seed++) {
    let turned = false;
    const sim = live(seed, { onFeedback: (s: number, _b: string, _r: string, l?: string) => { if (s === 1 && l === 'Turn in') turned = true; } });
    sim.bout.position = sim.bout.matPosition(0, { x: 0, z: 0, yaw: 0 }, 'standing', 0.8);
    sim.bout.returning = { move: null, base: 0.5, escape: 0, slam: false, turnIn: false };
    sim.bout.startMove('returnMat', 0, { x: 0, z: 0, yaw: 0 }, false);
    sim.bout.returning.move = sim.bout.position;
    const dur = sim.bout.position.dur;
    for (let t = 0; t < dur - 0.17; t += DT) sim.tick(DT, [cmd({}), cmd({ shoot: t >= dur - 0.25 })]);
    if (turned) { turnIns++; if (sim.bout.athletes[1].buffer.shoot > 0) leftover++; }
  }
  ok(turnIns >= 25, `a press late in the mat return is the turn in as he lands (${turnIns} of 30)`);
  ok(leftover === 0, `... and none of it stays queued for a stand-up once he is down (${leftover} of ${turnIns})`);
}
// Restarts: shorter waits on the marks; the player on top gets time to pick, and the whistle comes soon after he picks.
{
  const sim = live(3);
  sim.resetToPosition('top', 1);
  ok(sim.phase === 'setPosition' && sim.phaseDur === RESTART.referee, `the player underneath waits ${RESTART.referee} s on the marks (was 3)`);
  sim.resetToPosition('top', 0);
  ok(sim.phaseDur === RESTART.topPick, `the player on top gets ${RESTART.topPick} s to pick his breakdown`);
  for (let i = 0; i < 30; i++) sim.tick(DT, [NO_COMMAND, NO_COMMAND]);
  sim.chooseBreakdown('chop');
  ok(Math.abs(sim.phaseDur - (sim.phaseT + RESTART.picked)) < 1e-6, `once he picks, the whistle comes ${RESTART.picked} s later`);
  sim.resetToPosition('neutral', 0);
  ok(sim.phaseDur === RESTART.neutral, `neutral restarts wait ${RESTART.neutral} s (was 1.3)`);
}
// The walk back after a stoppage can be skipped: onto the marks once the call is in; without a skip they still run back.
{
  const run = (skip: boolean) => {
    const sim = live(5);
    sim.bout.position = { kind: 'neutral' };
    sim.bout.setNeutral({ x: 2.5, z: 1 }, Math.PI / 2, 1.05);
    sim.restart = { pos: 'neutral', top: 0 };
    sim.walkBack();
    const full = sim.phaseDur;
    if (skip) sim.skipReturn();
    let t = 0;
    for (; t < 10 && sim.phase === 'whistle'; t += DT) sim.tick(DT, [NO_COMMAND, NO_COMMAND]);
    return { t, full, phase: sim.phase };
  };
  const plain = run(false), skipped = run(true);
  ok(plain.phase === 'setPosition' && Math.abs(plain.t - plain.full) < 0.05, `without a skip they run all the way back (${plain.t.toFixed(2)} s)`);
  ok(skipped.phase === 'setPosition' && Math.abs(skipped.t - RESTART.skipAfter) < 0.05, `a skip puts them on the marks once the call is in (${skipped.t.toFixed(2)} s of ${skipped.full.toFixed(2)})`);
}
console.log('Move queue and restarts: late presses go off as a move ends, early ones drop; quicker, skippable restarts');
