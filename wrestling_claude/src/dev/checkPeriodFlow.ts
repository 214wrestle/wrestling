import { MatchSim } from '../sim/MatchSim';
import { PROTOTYPE_ROSTER as ROSTER } from '../sim/roster';
import { NO_COMMAND } from '../sim/types';
const check = (ok: boolean, label: string) => { if (!ok) throw new Error(label); };
for (let seed = 1; seed <= 100; seed++) {
  const phases: string[] = [];
  const sim = new MatchSim([ROSTER[0], ROSTER[1]], { onPhase: p => phases.push(p) }, seed);
  const tick = (dt: number) => sim.tick(dt, [NO_COMMAND, NO_COMMAND]);
  sim.startIntros(); sim.skipIntros(); tick(0); tick(2);
  check(sim.phase === 'setPosition' && sim.period === 1, 'handshake starts period one');
  check(!phases.includes('coinToss'), 'no prematch toss');
  tick(2); sim.clock = 0; tick(0.01); tick(3);
  check(sim.phase === 'coinToss' && sim.period === 1, 'toss after first period');
  const winner = sim.coinTossWinner;
  tick(2);
  if (winner === sim.humanSide) {
    check(sim.awaitingChoiceFrom === winner, 'human toss winner chooses');
    sim.choosePosition('bottom');
    check(sim.top === 1, 'bottom choice places opponent on top');
  }
  check(sim.period === 2 && sim.phase === 'setPosition', 'period two begins after choice');
  tick(2); sim.clock = 0; tick(0.01); tick(3);
  if (winner !== sim.humanSide) {
    check(sim.awaitingChoiceFrom === 0, 'other wrestler chooses period three');
    sim.choosePosition('neutral');
  }
  check(sim.period === 3, 'third period begins');
  check(phases.filter(p => p === 'coinToss').length === 1, 'one toss per match');
}
console.log('100 seeded period-flow checks passed');
