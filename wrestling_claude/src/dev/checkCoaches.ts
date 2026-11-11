// Corner coaches (owner, November 11): each wrestler's coach reacts to good and bad results for his man.
import '../anim/library';
import { hasSolo } from '../anim/solo';
import { Coaches, COACH_REACTION, coachFor } from '../game/Coaches';
import { COACH_CHAIRS, CHAIR_SEAT } from '../arena/gym';
import { MatchSim } from '../sim/MatchSim';
import { PROTOTYPE_ROSTER } from '../sim/roster';
import { NO_COMMAND } from '../sim/types';
import { MAT } from '../sim/rules';
const ok = (v: boolean, m: string) => { if (!v) throw Error(m); };

for (const id of ['coachSit', 'coachYell', 'coachUrge', 'coachCheer', 'coachDismay', 'coachLoss']) ok(hasSolo(id), `coach clip ${id} registered`);

// Chairs: one per corner on the table side, off the mat and facing in.
ok(COACH_CHAIRS.length === 2 && COACH_CHAIRS[0].x < 0 && COACH_CHAIRS[1].x > 0, "red's chair on the left, green's on the right");
for (const c of COACH_CHAIRS) {
  ok(Math.abs(c.z) > MAT.halfSize, 'chair is off the mat');
  ok(Math.abs(Math.atan2(-c.x, -c.z) - c.yaw) < 1e-9, 'chair faces the mat centre');
}
ok(CHAIR_SEAT > 0.4 && CHAIR_SEAT < 0.5, 'chair seat at sitting height');

// A coach wears his wrestler's school and is not a real person's likeness.
const [a, b] = [PROTOTYPE_ROSTER[0], PROTOTYPE_ROSTER[1]];
const ca = coachFor(a, 0);
ok(ca.school.id === a.school.id && ca.firstName === 'Coach' && ca.id !== a.id, 'coach in his wrestler’s school colours');

const sim = new MatchSim([a, b], {} as any, 5);
sim.phase = 'wrestling';
const coaches = new Coaches(null as any, async () => { throw Error('no bodies in the check'); });
ok(coaches.clipFor(0, sim) === 'coachSit' && coaches.clipFor(1, sim) === 'coachSit', 'both seated to start');

// A takedown for red: red's coach is up cheering, green's has his hands on his head; both sit back down after.
coaches.onScore({ id: 1, side: 0, kind: 'takedown', points: 3, label: '', period: 1, clock: 100 });
ok(coaches.clipFor(0, sim) === 'coachCheer', 'his man scores: cheer');
ok(coaches.clipFor(1, sim) === 'coachDismay', 'points against: dismay');
for (let t = 0; t < COACH_REACTION.cheer[1] + 0.1; t += 1 / 60) coaches.tick(1 / 60, { ...sim, phase: 'periodBreak' } as any);
ok(!['coachCheer', 'coachDismay'].includes(coaches.clipFor(0, sim)) && !['coachCheer', 'coachDismay'].includes(coaches.clipFor(1, sim)), 'reactions end');

// Riding time is a quiet point: his coach cheers, the other does not react.
coaches.onScore({ id: 2, side: 1, kind: 'ridingTime', points: 1, label: '', period: 3, clock: 0 });
ok(coaches.clipFor(1, sim) === 'coachCheer' && coaches.clipFor(0, sim) !== 'coachDismay', 'riding time: only a small cheer');
for (let t = 0; t < 3; t += 1 / 60) coaches.tick(1 / 60, { ...sim, phase: 'periodBreak' } as any);

// A near fall: both coaches are up urging.
const pos: any = sim.bout.position;
sim.bout.position = { ...pos, kind: 'mat', sub: 'exposed', A: 0 } as any;
ok(coaches.clipFor(0, sim) === 'coachUrge' && coaches.clipFor(1, sim) === 'coachUrge', 'near fall: both up urging');
sim.bout.position = pos;

// While they wrestle, his coach coaches in bursts.
let yelled = 0;
for (let t = 0; t < 30; t += 1 / 60) { coaches.tick(1 / 60, sim); if (coaches.clipFor(0, sim) === 'coachYell') yelled++; }
ok(yelled > 60 && yelled < 30 * 60 * 0.7, `coaching in bursts while they wrestle (${(yelled / 60).toFixed(1)} s of 30)`);

// The result: the winner's coach celebrates, the loser's slumps.
(sim as any).phase = 'results';
(sim as any).result = { winner: 1 };
ok(coaches.clipFor(1, sim) === 'coachCheer' && coaches.clipFor(0, sim) === 'coachLoss', 'result: winner cheers, loser slumps');
void NO_COMMAND;
console.log(`Corner coaches: seated, cheer and dismay on points, urge on near falls, coach in bursts (${(yelled / 60).toFixed(1)} s of 30), win and loss`);
