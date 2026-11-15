// Instant replay (owner, November 14: "as much like a PlayStation game, like UFC Fight Night ... as you can"): a big
// moment shortly before play stops is played back in slow motion, posed as it was recorded; live play is put back
// exactly afterwards; an old moment is not replayed; the bigger moment wins.
import { Bone, Euler, Group, PerspectiveCamera, Quaternion } from 'three';
import { BONES } from '../body/skeleton';
import { Replay, REPLAY } from '../game/Replay';
const ok = (x: boolean, m: string) => { if (!x) throw Error(m); console.log('ok', m); };
const rig = () => {
  const bones: any = {}, root = new Group();
  for (const d of BONES) { const b = new Bone(); b.position.set(...d.offset); bones[d.name] = b; d.parent ? bones[d.parent].add(b) : root.add(b); }
  return { root, bones, boneList: Object.values(bones) as Bone[], scale: 1 } as any;
};
// Both men walk along x at 1 m/s and the first one's spine turns, so every recorded frame is different.
const pose = (rigs: any[], t: number) => {
  rigs.forEach((r, i) => { r.bones.hips.position.set(t + i * 0.8, 0.9, 0); r.bones.spine.rotation.set(0, t * 0.5, 0); r.root.updateMatrixWorld(true); });
};
const make = () => {
  const rigs = [rig(), rig()];
  const replay = new Replay();
  replay.track(rigs);
  return { rigs, replay };
};
const DT = 1 / 60;
{
  const { rigs, replay } = make();
  let t = 0;
  for (; t < 5; t += DT) { pose(rigs, t); replay.record(t); }
  replay.mark(3, 3, 2, 0.8, 0);
  pose(rigs, 99); // live play has moved on (the walk back)
  ok(replay.start(t), 'a big moment shortly before play stops is replayed');
  const cam = new PerspectiveCamera(36, 1.6, 0.1, 100);
  let wall = 0, maxErr = 0;
  while (replay.update(DT, cam)) {
    wall += DT;
    const shown = (replay as any).rt as number;
    maxErr = Math.max(maxErr, Math.abs(rigs[0].bones.hips.position.x - shown), Math.abs(rigs[1].bones.hips.position.x - (shown + 0.8)));
    if (wall > 20) break;
  }
  ok(Math.abs(wall - 2.8 / REPLAY.speed) < 0.1, `it plays the moment's window (2.8 s) in slow motion: ${wall.toFixed(2)} s at ${REPLAY.speed}x`);
  ok(maxErr < 0.02, `every replayed frame is posed as recorded (worst ${maxErr.toFixed(3)} m)`);
  const liveSpine = new Quaternion().setFromEuler(new Euler(0, 99 * 0.5, 0));
  ok(Math.abs(rigs[0].bones.hips.position.x - 99) < 1e-6 && rigs[0].bones.spine.quaternion.angleTo(liveSpine) < 1e-4, 'afterwards live play is put back exactly as it was');
  ok(!replay.start(t), 'a moment is replayed once');
}
{
  const { rigs, replay } = make();
  for (let t = 0; t < 5; t += DT) { pose(rigs, t); replay.record(t); }
  replay.mark(1, 3, 2, 0.8, 0);
  ok(!replay.start(1 + REPLAY.recent + 0.5), `a moment more than ${REPLAY.recent} s before play stops is not replayed`);
}
{
  const { rigs, replay } = make();
  for (let t = 0; t < 6; t += DT) { pose(rigs, t); replay.record(t); }
  replay.mark(2.5, 4, 1, 0.5, 0);
  replay.mark(4.5, 1.2, 1, 0.5, 0);
  replay.start(6);
  ok(Math.abs((replay.playing?.t ?? 0) - 2.5) < 1e-9, 'the bigger moment of the stretch is the one replayed');
  replay.stop();
}
{
  const { rigs, replay } = make();
  for (let t = 0; t < 3; t += DT) { pose(rigs, t); replay.record(t); }
  pose(rigs, 1); replay.record(1); // a frame stamped out of order
  replay.mark(2, 3, 1, 0.5, 0);
  ok(replay.start(3) && (replay as any).timeAt(0) > 2.9, 'a frame stamped out of order is not recorded');
  replay.stop();
}
console.log('Instant replay: slow-motion window, recorded poses, live play restored, once, recent, biggest');
