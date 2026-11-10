import { Bone, Vector3 } from 'three';
import '../anim/library';
import { sampleMove } from '../anim/clips';
import { BONES, type BoneName } from '../body/skeleton';
import { Solver } from '../anim/solver';
import { createLocal, localToWorld } from '../anim/spec';
import { createPosture } from '../anim/posture';

// Check solved joint positions, not authored IK targets: unreachable targets
// can look connected on paper while the renderer clamps the limb short.
const rigs = [0,1].map(() => {
  const bones = {} as Record<BoneName,Bone>;
  for (const d of BONES) {
    const bone = bones[d.name] = new Bone();
    bone.position.fromArray(d.offset);
    if (d.parent) bones[d.parent].add(bone);
  }
  return {bones, solver:new Solver({bones,scale:1})};
});
for (const mirror of [false,true]) for (const u of [.46,.62]) {
  for (const [i,role] of ['A','B'].entries()) {
    const pose=createLocal(), world=createPosture();
    sampleMove('footSweep',role as 'A'|'B',u,mirror,pose);
    localToWorld(pose,{x:0,z:0,yaw:0},world);
    rigs[i].solver.apply(world);
  }
  const sweep=rigs[0].bones[mirror?'footL':'footR'].getWorldPosition(new Vector3());
  const ankle=rigs[1].bones[mirror?'footR':'footL'].getWorldPosition(new Vector3());
  if (sweep.distanceTo(ankle)>.07) throw Error(`Sweep misses ankle at ${u}, mirror=${mirror}`);
}
console.log('Solved foot-sweep ankle contact stays within 7 cm in both mirrored roles');
