import { Bone, Quaternion, Vector3 } from 'three';
import { BONES } from '../body/skeleton';
import type { BoneName } from '../body/skeleton';
import { Solver } from '../anim/solver';
import { createLocal, localToWorld } from '../anim/spec';
import { P, createPosture } from '../anim/posture';
import { sampleHold, sampleMove } from '../anim/clips';
import '../anim/library';

// Exercise the actual solved bones, not only the authored wrist targets.
for (const mirror of [false,true]) for (const progress of [0,.5,1]) for (const yaw of [0,1.2]) {
  const bones = {} as Record<BoneName,Bone>;
  for (const def of BONES) {
    const bone = new Bone(); bone.position.set(...def.offset); bones[def.name]=bone;
    if (def.parent) bones[def.parent].add(bone);
  }
  const pose=createLocal(); sampleHold('ride','B',progress,0,0,mirror,pose);
  const world=createPosture(); localToWorld(pose,{x:0,z:0,yaw},world);
  const solver=new Solver({bones,scale:1}); solver.apply(world);
  for (const side of ['L','R'] as const) {
    const q=bones[`hand${side}`].getWorldQuaternion(new Quaternion());
    const normal=new Vector3(side==='L'?-1:1,0,0).applyQuaternion(q);
    const fingers=new Vector3(0,-1,0).applyQuaternion(q);
    if (normal.y > -.999 || Math.abs(fingers.y) > .001) throw new Error(`Unplanted palm ${side}, mirror=${mirror}, progress=${progress}, yaw=${yaw}`);
  }
  // A raised hand must be free to adopt its authored grip orientation.
  world[P.HAND_L + 1] = .5;
  solver.apply(world);
  const supported = bones.handL.getWorldQuaternion(new Quaternion());
  world[P.PALMS] = 0;
  solver.apply(world);
  const released = bones.handL.getWorldQuaternion(new Quaternion());
  if (supported.normalize().angleTo(released.normalize()) > 1e-6) throw new Error(`Mat support constrained a raised grip: ${supported.angleTo(released)} ${supported.toArray()} ${released.toArray()}`);
}
console.log('Solved ride palms face the mat with horizontal fingers across progress, sides and world rotations');

// A returned wrestler opens both hands to receive the mat rather than landing
// on the grip-oriented edges of the hands inherited from standing hand control.
for (const [clip,t] of [['returnMat',.72],['standingTrip',.7],['crotchLift',.72]] as const)
for (const mirror of [false,true]) for (const yaw of [0,1.2]) {
 const bones = {} as Record<BoneName,Bone>;
 for (const def of BONES) {
  const bone=new Bone(); bone.position.set(...def.offset); bones[def.name]=bone;
  if(def.parent)bones[def.parent].add(bone);
 }
 const local=createLocal(),world=createPosture();
 sampleMove(clip,'B',t,mirror,local);localToWorld(local,{x:0,z:0,yaw},world);
 new Solver({bones,scale:1}).apply(world);
 for(const side of ['L','R'] as const) {
  const q=bones[`hand${side}`].getWorldQuaternion(new Quaternion());
  const normal=new Vector3(side==='L'?-1:1,0,0).applyQuaternion(q);
  if(normal.y>-.999)throw Error(`${clip} landing palm ${side} does not face the mat (${normal.y.toFixed(3)})`);
 }
}
console.log('Mat return, rear trip and crotch-lift landings open both palms toward the mat');
