// Oklahoma State's "Pistols Firing" celebration (owner, November 15: "Can you add the pistol celebration for Oklahoma
// state"): who does it, that it plays for an OSU winner and then the hand raise, that the pistols fire into the air and
// end holstered, and that the finger-pistol hands are meshed apart from the relaxed ones (index longer, thumb out,
// same wrist line).
import '../anim/library';
import { MatchSim } from '../sim/MatchSim';
import { ROSTER } from '../sim/roster';
import { NO_COMMAND } from '../sim/types';
import { firesPistols } from '../sim/schoolAbbr';
import { wrestlerViews } from '../game/views';
import { sampleSolo } from '../anim/solo';
import { createLocal } from '../anim/spec';
import { P } from '../anim/posture';
import { PISTOLS_SECONDS } from '../anim/library/solo';
import { bindPose, NEUTRAL_FACE, NEUTRAL_FRAME } from '../body/realistic/anatomy';
import { m3Apply } from '../body/math';
import type { BodyParams } from '../body/realistic/anatomy';
import { generateBody } from '../body/realistic/generate';
const ok = (x: boolean, m: string) => { if (!x) throw Error(m); console.log('ok', m); };
const DT = 1 / 60;
const idle = [NO_COMMAND, NO_COMMAND] as [typeof NO_COMMAND, typeof NO_COMMAND];

// Who: Oklahoma State's wrestlers, an Icon who wrestled there, nobody else.
const osu = ROSTER.find((w) => w.school.id === 'oklahoma-state')!;
const iowa = ROSTER.find((w) => w.school.id === 'iowa')!;
ok(firesPistols(osu) && !firesPistols(iowa), 'Oklahoma State wrestlers fire the pistols, an Iowa wrestler does not');
const icon = { ...iowa, firstName: 'Test', lastName: 'Icon', school: { ...iowa.school, id: 'college-wrestling-icons' }, legends: { source: 'NCAA — 1990 — Oklahoma State' } };
ok(firesPistols(icon as typeof iowa), 'an Icon who wrestled at Oklahoma State does too');

// When: an OSU winner's celebration is the pistols, then the hand raise; anyone else's is the usual one.
function celebration(winner: typeof osu, loser: typeof osu) {
  const sim = new MatchSim([winner, loser], {} as any, 5);
  sim.humanSide = 0;
  sim.startIntros?.(); (sim as any).skipIntros?.();
  for (let i = 0; i < 4000 && sim.phase !== 'wrestling'; i++) { if (sim.phase === 'positionChoice') sim.choosePosition('neutral'); sim.tick(DT, idle); }
  const s = sim as any; s.period = 3; s.score = [5, 1]; s.clock = 0.01;
  sim.tick(DT, idle);
  const clips: string[] = [];
  for (let t = 0; sim.phase === 'celebration' && t < 5; t += DT) {
    const v = wrestlerViews(sim)[0] as { clip?: string };
    if (clips[clips.length - 1] !== v.clip) clips.push(v.clip ?? '');
    sim.tick(DT, idle);
  }
  return clips;
}
const osuClips = celebration(osu, iowa);
ok(osuClips[0] === 'pistols' && osuClips.includes('handRaised'), `an Oklahoma State winner: ${osuClips.join(' > ')}`);
const iowaClips = celebration(iowa, osu);
ok(iowaClips[0] === 'celebrate' && !iowaClips.includes('pistols'), `an Iowa winner over Oklahoma State: ${iowaClips.join(' > ')}`);
ok(PISTOLS_SECONDS > 2 && PISTOLS_SECONDS < 4, `the routine takes ${PISTOLS_SECONDS} s before the hand raise`);

// Into the air: through the shooting both pistols stay above the head line; it ends holstered at the hips.
const pose = createLocal();
let lowest = Infinity;
for (let u = 0.07; u <= 0.67; u += 0.01) {
  sampleSolo('pistols', u, pose);
  lowest = Math.min(lowest, pose[P.HAND_L + 1], pose[P.HAND_R + 1]);
}
ok(lowest > 1.6, `the pistols fire into the air, never lower than ${lowest.toFixed(2)} m (hands above 1.6 m)`);
sampleSolo('pistols', 1, pose);
ok(Math.abs(pose[P.HAND_L + 1] - 0.99) < 0.05 && Math.abs(pose[P.HAND_R + 1] - 0.99) < 0.05, 'it ends with both pistols holstered at the hips');

// The hands: meshed from the pistol pose, apart from the relaxed hands (bending the relaxed index out of the fused
// fingers tore a web of skin).
const params: BodyParams = { scale: 1, mass: 0.5, hair: 'crop', hairFront: 1.69, face: NEUTRAL_FACE, frame: NEUTRAL_FRAME };
const plain = generateBody(params, 'low', false);
ok(!plain.pistolHands, 'a body built without them has no pistol hands');
const geo = generateBody({ ...params, pistolHands: true }, 'low', false);
ok(geo.pistolHands?.length === 2, 'a body built with them has a left and a right pistol hand');
// Extents in the hand's own authoring frame (as gripMorph.ts reads it): hand hanging, fingers down (-y), thumb in
// front (+z); the mesh itself is in the skeleton's bind pose.
const bind = bindPose(1);
const ext = (p: Float32Array, hand: 'handL' | 'handR') => {
  const rot = bind.rot[hand], origin = bind.pos[hand], rest = bind.rest[hand], side = hand === 'handL' ? 1 : -1;
  const inverse = new Float64Array([rot[0], rot[3], rot[6], rot[1], rot[4], rot[7], rot[2], rot[5], rot[8]]);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    const l = m3Apply(inverse, [p[i] - origin[0], p[i + 1] - origin[1], p[i + 2] - origin[2]]);
    const q = [(l[0] + rest[0]) * side, l[1] + rest[1], l[2] + rest[2]];
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); }
  }
  return { lo, hi };
};
for (let i = 0; i < 2; i++) {
  const side = i === 0 ? 'left' : 'right', hand = i === 0 ? 'handL' : 'handR';
  const relaxed = ext(geo.hands[i].positions, hand), pistol = ext(geo.pistolHands![i].positions, hand);
  const tris = geo.pistolHands![i].indices.length / 3;
  ok(tris > 800, `${side} pistol hand meshed (${tris} triangles)`);
  ok(pistol.lo[1] < relaxed.lo[1] - 0.008, `${side}: the straight index reaches ${((relaxed.lo[1] - pistol.lo[1]) * 100).toFixed(1)} cm past the relaxed fingers`);
  ok(pistol.hi[2] > relaxed.hi[2] + 0.02, `${side}: the thumb stands out ${((pistol.hi[2] - relaxed.hi[2]) * 100).toFixed(1)} cm as the hammer`);
  // Near the wrist it covers no more forearm than the relaxed hand: within 6 cm of the joint every vertex stays inside
  // the relaxed hand's extent but for one mesh cell (that rim is tucked under the body mesh, as the relaxed hand's is).
  const R = geo.hands[i].positions, Q = geo.pistolHands![i].positions, w = bind.pos[hand];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < R.length; v += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], R[v + k]); hi[k] = Math.max(hi[k], R[v + k]); }
  let worst = 0;
  for (let v = 0; v < Q.length; v += 3) {
    if (Math.hypot(Q[v] - w[0], Q[v + 1] - w[1], Q[v + 2] - w[2]) > 0.06) continue;
    for (let k = 0; k < 3; k++) worst = Math.max(worst, lo[k] - Q[v + k], Q[v + k] - hi[k]);
  }
  ok(worst < 0.007, `${side}: at the wrist it stays on the relaxed hand's seam (${(worst * 1000).toFixed(1)} mm past it, one cell allowed)`);
  ok(geo.pistolHands![i].skinIndex.length === (geo.pistolHands![i].positions.length / 3) * 4, `${side}: skinned to the skeleton`);
}
console.log('Oklahoma State pistols: OSU winners (and OSU Icons) fire into the air, then the hand raise; pistol hands meshed apart');
