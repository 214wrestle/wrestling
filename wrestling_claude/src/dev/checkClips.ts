import { applyRideEffort } from '../anim/matEffort';
import { P } from '../anim/posture';
import '../anim/library';
import { hasMove, hasHold, sampleMove, sampleHold } from '../anim/clips';
import { createLocal } from '../anim/spec';
import { MOVES, HOLD_PLACES, SHOT_CLIPS, LEG_HOLDS } from '../sim/moves';

// A missing registered clip silently leaves a default pose in the renderer.
// Check the actual sim-to-animation contracts, including both mirrored roles.
for (const id of Object.keys(MOVES)) {
  if (!hasMove(id)) throw new Error(`Missing animation: ${id}`);
  for (const role of ['A', 'B'] as const) for (const mirror of [false, true]) for (let step = 0; step <= 20; step++) {
    const pose = createLocal();
    sampleMove(id, role, step / 20, mirror, pose);
    if (!pose.every(Number.isFinite)) throw new Error(`Invalid move pose: ${id}`);
  }
}
for (const id of Object.keys(HOLD_PLACES)) {
  if (!hasHold(id)) throw new Error(`Missing hold: ${id}`);
  for (const role of ['A', 'B'] as const) for (const mirror of [false, true]) for (const progress of [0, 0.5, 1]) {
    const pose = createLocal();
    sampleHold(id, role, progress, 0.4, 1, mirror, pose);
    if (!pose.every(Number.isFinite)) throw new Error(`Invalid hold pose: ${id}`);
  }
}
for (const shot of ['double', 'single', 'highCrotch', 'lowSingle'] as const) {
  if (!hasMove(SHOT_CLIPS[shot]) || !hasHold(LEG_HOLDS[shot])) throw new Error(`Incomplete attack: ${shot}`);
}
console.log('Every simulation move and hold has finite paired animation poses, including mirrored high crotches');
for (const id of ['legRide','closedPockets','catchRidingLeg','cradleHold']) {
  if (!hasHold(id)) throw new Error(`Missing contextual hold: ${id}`);
  for (const role of ['A','B'] as const) for (const mirror of [false,true]) for (const progress of [0,0.5,1]) {
    const pose=createLocal(); sampleHold(id,role,progress,0.4,1,mirror,pose);
    if (!pose.every(Number.isFinite)) throw new Error(`Invalid contextual hold: ${id}`);
  }
}

// A defensive reaction must move the controlled arm without unplanting the
// free palm. Mirrored attacks must preserve the same support on the other side.
for (const mirror of [false, true]) {
  const pose = createLocal();
  sampleHold('ride', 'B', .5, 0, 0, mirror, pose);
  const before = pose.slice();
  applyRideEffort(pose, false, true, 'fight', 1, mirror);
  const free = mirror ? P.HAND_L : P.HAND_R;
  const controlled = mirror ? P.HAND_R : P.HAND_L;
  for (let i=0;i<3;i++) if (pose[free+i] !== before[free+i]) throw new Error('Breakdown moved the free support palm');
  if (pose[controlled+2] >= before[controlled+2]) throw new Error('Controlled arm did not yield to breakdown');
  for (const at of [P.FOOT_L,P.FOOT_R]) for (let i=0;i<3;i++) if (pose[at+i] !== before[at+i]) throw new Error('Breakdown slid a planted foot');
}
console.log('Ride reactions preserve free-hand and foot supports in both orientations');

// Standups remain controlled until an escape occurs. No gap may drop every
// rider contact midway through the rise; the free post remains fixed until the foot plant.
for (const mirror of [false,true]) {
  for (let i=0;i<=100;i++) {
    const contacts=sampleMove('standUp','A',i/100,mirror,createLocal());
    if (!contacts.some(c=>c.weight > .99)) throw new Error('Standup lost all rider contact');
  }
  const early=createLocal(), posted=createLocal();
  sampleMove('standUp','B',.2,mirror,early);
  sampleMove('standUp','B',.32,mirror,posted);
  const hand=mirror ? P.HAND_L : P.HAND_R;
  for(let axis=0;axis<3;axis++) if(Math.abs(early[hand+axis]-posted[hand+axis])>1e-6) throw new Error('Standup support hand skates');
  const foot=mirror ? P.FOOT_R : P.FOOT_L;
  if(early[foot+1] <= posted[foot+1]+.05) throw new Error('Standup step did not clear the mat');
}
console.log('Standup preserves rider contact and planted hand through its stepping phase');
for (const mirror of [false,true]) {
  const control=sampleMove('standUp','B',.4,mirror,createLocal());
  if(!control.some(c=>c.on === (mirror ? 'handL' : 'handR') && c.weight > .99)) throw new Error('Bottom hand control begins too late in standup');
}
for (const mirror of [false,true]) {
  const pose=createLocal(); sampleHold('ride','B',.5,0,0,mirror,pose);
  const before=pose.slice();
  applyRideEffort(pose,false,false,'shoot',1,mirror,true);
  const foot=mirror ? P.FOOT_R : P.FOOT_L;
  const post=mirror ? P.HAND_L : P.HAND_R;
  if(pose[foot+1] <= before[foot+1] || pose[foot+2] <= before[foot+2]) throw new Error('Failed standup did not initiate a step');
  for(let axis=0;axis<3;axis++) if(pose[post+axis] !== before[post+axis]) throw new Error('Failed standup moved its free-hand target');
  const settled=before.slice(); applyRideEffort(settled,false,false,'shoot',0,mirror,true);
  if(settled.some((v,i)=>v!==before[i])) throw new Error('Failed standup does not return to its ride pose');
}
console.log('Failed standups initiate a mirrored step, preserve the free post and settle to the ride');


// Defensive frames must already be engaged before leg-hold transition.
for(const [move,hold] of [['shotDouble','legsDouble'],['shotSingle','legsSingle'],['shotHighCrotch','legsHighCrotch']]) for(const mirror of [false,true]) {
 const expected=sampleHold(hold,'B',0,0,0,mirror,createLocal());
 const entry=sampleMove(move,'B',.8,mirror,createLocal());
 for(const anchor of expected) {
  if(!entry.some(c=>c.hand===anchor.hand && c.on===anchor.on && c.weight>.9 && c.at.every((v,i)=>v===anchor.at[i])))
   throw Error(`${move}: missing continuous defensive hold anchor`);
 }
}
console.log('Single/double/high-crotch entries establish the same defensive frame as their leg holds');
