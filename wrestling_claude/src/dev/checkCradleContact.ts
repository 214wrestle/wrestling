import {palmSurface} from '../anim/gableGrip';
import {Bone,Group,Vector3,Quaternion} from 'three';
import {BONES,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import {sampleHold} from '../anim/clips';
import {createLocal} from '../anim/spec';
import '../anim/library';
function make(scale:number,phase=.5){
 const bones={} as Record<BoneName,Bone>,root=new Group();
 for(const def of BONES){const bone=new Bone();bone.position.set(...def.offset).multiplyScalar(scale);bones[def.name]=bone;if(def.parent)bones[def.parent].add(bone);else root.add(bone);}
 const random=Math.random;
 Math.random=()=>phase;
 let anim:Animator;
 try { anim=new Animator({bones,root,scale,boneList:Object.values(bones),dispose:()=>{},motion:DEFAULT_MOTION,setExertion:()=>{}}); } finally { Math.random=random; }
 anim.instant=true;
 return {anim,bones,scale};
}

function palms(a:ReturnType<typeof make>){
 const left=a.bones.handL,right=a.bones.handR;
 left.updateWorldMatrix(true,false);right.updateWorldMatrix(true,false);
 return {left:palmSurface('L',a.scale).applyMatrix4(left.matrixWorld),right:palmSurface('R',a.scale).applyMatrix4(right.matrixWorld),
 opposition:new Vector3(-1,0,0).applyQuaternion(left.getWorldQuaternion(new Quaternion())).dot(new Vector3(1,0,0).applyQuaternion(right.getWorldQuaternion(new Quaternion())))};
}
function insideArmLoop(a:ReturnType<typeof make>,point:Vector3){
 const loop=(['armL','forearmL','handL','handR','forearmR','armR'] as BoneName[]).map(n=>a.bones[n].getWorldPosition(new Vector3()));
 let inside=false;
 for(let i=0,j=loop.length-1;i<loop.length;j=i++){
  const p=loop[i],q=loop[j];
  if((p.z>point.z)!==(q.z>point.z) && point.x<(q.x-p.x)*(point.z-p.z)/(q.z-p.z)+p.x)inside=!inside;
 }
 return inside;
}
let failedWraps=0;
let maxHandGap=0, maxRotationError=0,maxPalmGap=0,maxPalmDot=-1;
for(const mirror of [false,true])for(const scale of [.85,1,1.15])for(const progress of [0,.5,1]){
let reference:Vector3|undefined;
for(const yaw of [0,.6,Math.PI/2,Math.PI])for(const x of [0,2]){
 const a=make(scale),b=make(scale);
 for(let i=0;i<120;i++){
  const view={mode:'paired' as const,clip:'cradleHold',hold:true,frame:{x,z:1,yaw},mirror,u:0,progress,intensity:0,stamina:1,exertion:0};
  a.anim.update(1/60,{...view,role:'A'},b.anim);b.anim.update(1/60,{...view,role:'B'},a.anim);
  a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
 }
 const left=a.bones.handL.getWorldPosition(new Vector3()),right=a.bones.handR.getWorldPosition(new Vector3());
 const contacts=sampleHold('cradleHold','A',progress,0,0,mirror,createLocal());
 const anchors=contacts.map(c=>new Vector3(...c.at).multiplyScalar(scale).applyMatrix4(b.bones[c.on].matrixWorld));
 const gap=left.distanceTo(right);maxHandGap=Math.max(maxHandGap,gap);
 const neck=b.bones.neck.getWorldPosition(new Vector3()),knee=b.bones[mirror?'shinR':'shinL'].getWorldPosition(new Vector3());
 if(!insideArmLoop(a,neck)||!insideArmLoop(a,knee)){failedWraps++;if(yaw===0&&x===0)console.log('wrap miss',{mirror,scale,progress,neck:neck.toArray(),knee:knee.toArray(),loop:(['armL','forearmL','handL','handR','forearmR','armR'] as BoneName[]).map(n=>a.bones[n].getWorldPosition(new Vector3()).toArray())});}
 const palm=palms(a);maxPalmGap=Math.max(maxPalmGap,palm.left.distanceTo(palm.right));maxPalmDot=Math.max(maxPalmDot,palm.opposition);
 const midpoint=left.clone().add(right).multiplyScalar(.5).sub(new Vector3(x,0,1)).applyAxisAngle(new Vector3(0,1,0),-yaw);
 if(!reference)reference=midpoint.clone();
 const rotationError=midpoint.distanceTo(reference);
 maxRotationError=Math.max(maxRotationError,rotationError);
 console.log(JSON.stringify({mirror,scale,progress,yaw,x,palmGap:palm.left.distanceTo(palm.right),handsGap:gap,rotationError,anchorsGap:anchors[0].distanceTo(anchors[1])}));
}
}
console.log('Planar neck/knee wrap misses',failedWraps);
if(failedWraps)throw new Error('Neck or knee falls outside projected cradle arm loop');
console.log('Max cradle hand separation',maxHandGap);

console.log('Max cradle rotation error',maxRotationError);
if(maxRotationError>.002)throw new Error('Cradle clasp changes with pair orientation');
console.log({maxPalmGap,maxPalmDot});
if(maxPalmGap>.004||maxPalmDot>-.99)throw new Error('Gable palms fail to meet or oppose');

// Follow the actual turn into its hold without resetting springs or grip state.
let maxTransitionStep=0, maxTurnGap=0;
for(const [as,bs] of [[.9,1.15],[1.15,.9],[1,1]])for(const mirror of [false,true])for(const hz of [30,60,120]){
 const a=make(as),b=make(bs),dt=1/hz;
 const view={mode:'paired' as const,frame:{x:0,z:0,yaw:.7},mirror,progress:0,intensity:0,stamina:1,exertion:0};
 const steps=Math.ceil(1.45*hz);
 let last:Vector3|undefined;
 let turnGap=0,transitionStep=0;
 for(let i=0;i<=steps+hz;i++){
  const hold=i>steps;
  const v={...view,clip:hold?'cradleHold':'cradle',hold,u:Math.min(1,i/steps)};
  a.anim.instant=b.anim.instant=i===0;
  a.anim.update(dt,{...v,role:'A'},b.anim);b.anim.update(dt,{...v,role:'B'},a.anim);
  a.anim.applyContacts(dt,b.anim);b.anim.applyContacts(dt,a.anim);
  const left=a.bones.handL.getWorldPosition(new Vector3()),right=a.bones.handR.getWorldPosition(new Vector3());
  const mid=left.clone().add(right).multiplyScalar(.5);
  if(i===steps+1 && last)transitionStep=mid.distanceTo(last);
  if(i>=steps){const p=palms(a);turnGap=Math.max(turnGap,p.left.distanceTo(p.right));}
  last=mid;
 }
 const neck=b.bones.neck.getWorldPosition(new Vector3()),knee=b.bones[mirror?'shinR':'shinL'].getWorldPosition(new Vector3());
 if(!insideArmLoop(a,neck)||!insideArmLoop(a,knee))throw new Error(`Unequal cradle wrap failed ${as}/${bs} mirror=${mirror} hz=${hz}`);
 maxTransitionStep=Math.max(maxTransitionStep,transitionStep);maxTurnGap=Math.max(maxTurnGap,turnGap);
 console.log(JSON.stringify({as,bs,mirror,hz,transitionStep,turnGap}));
}
console.log({maxTransitionStep,maxTurnGap});
if(maxTransitionStep>.01)throw new Error('Cradle entry-to-hold grip jumps');
if(maxTurnGap>.01)throw new Error('Cradle turn loses palm lock');
const wrapA=make(1),wrapB=make(1);
for(let i=0;i<120;i++){
 const v={mode:'paired' as const,clip:'cradleHold',hold:true,frame:{x:0,z:0,yaw:0},mirror:false,u:0,progress:0,intensity:0,stamina:1,exertion:0};
 wrapA.anim.update(1/60,{...v,role:'A'},wrapB.anim);wrapB.anim.update(1/60,{...v,role:'B'},wrapA.anim);
 wrapA.anim.applyContacts(1/60,wrapB.anim);wrapB.anim.applyContacts(1/60,wrapA.anim);
}
for(const n of ['armL','forearmL','handL','armR','forearmR','handR'] as BoneName[])console.log('top',n,wrapA.bones[n].getWorldPosition(new Vector3()).toArray());
for(const n of ['neck','head','shinL','thighL'] as BoneName[])console.log('bottom',n,wrapB.bones[n].getWorldPosition(new Vector3()).toArray());

// Defensive extension must move the trapped leg without silently dropping the lock.
for(const mirror of [false,true])for(const [as,bs] of [[1,1],[.9,1.15],[1.15,.9]]){
 const a=make(as),b=make(bs),foot=mirror?'footR':'footL',knee=mirror?'shinR':'shinL';
 let restFoot:Vector3|undefined,restKnee:Vector3|undefined;
 let palmGap=0;
 for(let i=0;i<240;i++){
  const resistance=i<120?0:Math.min(.85,(i-120)/80);
  const view={mode:'paired' as const,clip:'cradleHold',hold:true,frame:{x:0,z:0,yaw:0},mirror,u:0,progress:.4,intensity:0,resistance,stamina:1,exertion:0};
  a.anim.update(1/60,{...view,role:'A'},b.anim);b.anim.update(1/60,{...view,role:'B'},a.anim);
  a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
  if(i===119){restFoot=b.bones[foot].getWorldPosition(new Vector3());restKnee=b.bones[knee].getWorldPosition(new Vector3());}
  if(i>=120){const p=palms(a);palmGap=Math.max(palmGap,p.left.distanceTo(p.right));}
 }
 const footTravel=b.bones[foot].getWorldPosition(new Vector3()).distanceTo(restFoot!),kneeTravel=b.bones[knee].getWorldPosition(new Vector3()).distanceTo(restKnee!);
 console.log('Cradle resistance',{mirror,as,bs,footTravel,kneeTravel,palmGap});
 if(footTravel<.015)throw new Error('Defensive cradle extension is invisible');
 if(palmGap>.01)throw new Error('Cradle extension separates the lock before release');
}

// Actual match effort reaches the renderer for either wrestler, not just the lab.
for(const top of [0,1] as const){
 const {MatchSim}=await import('../sim/MatchSim');
 const {PROTOTYPE_ROSTER}=await import('../sim/roster');
 const {NO_COMMAND}=await import('../sim/types');
 const {wrestlerViews}=await import('../game/views');
 const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},21);
 sim.phase='wrestling';sim.clock=180;sim.bout.setReferee(top,{x:0,z:0},0);
 const p=sim.bout.position;if(p.kind!=='mat')throw new Error('Missing mat setup');
 p.sub='exposed';p.turnStyle='cradle';
 const bottom=top===0?1:0;
 for(let i=0;i<25;i++){
  const commands=[{...NO_COMMAND},{...NO_COMMAND}] as [typeof NO_COMMAND,typeof NO_COMMAND];
  commands[bottom]={...NO_COMMAND,fight:true,sustainedEffort:true};
  sim.tick(1/60,commands);
 }
 const v=wrestlerViews(sim)[bottom];
 if(v.mode!=='paired'||v.clip!=='cradleHold'||!(v.resistance!>0)||v.resistance!==p.fight)throw new Error('Cradle defensive effort is not reflected in animation');
}
console.log('Actual match cradle resistance reaches both bottom-wrestler animation roles');

// Real-time exit sampling retains the prior hold's spring/contact state.
let worstExitGap=0,worstExitStep=0,worstReleaseSpeed=0,worstDefenderSpeed=0;
for(const clip of ['cradleFightOff','cradleFall'])for(const mirror of [false,true])for(const [as,bs] of [[1,1],[.9,1.15],[1.15,.9]])for(const hz of [30,60,120]){
 const a=make(as),b=make(bs),dt=1/hz,duration=clip==='cradleFall'?2.2:.85;
 const base={mode:'paired' as const,frame:{x:0,z:0,yaw:.6},mirror,progress:clip==='cradleFall'?1:0,intensity:0,stamina:1,exertion:0};
 for(let i=0;i<hz;i++){
  a.anim.update(dt,{...base,clip:'cradleHold',hold:true,u:0,role:'A'},b.anim);
  b.anim.update(dt,{...base,clip:'cradleHold',hold:true,u:0,role:'B'},a.anim);
  a.anim.applyContacts(dt,b.anim);b.anim.applyContacts(dt,a.anim);
 }
 let previous=palms(a),previousDefender=palms(b),firstStep=0,maxGap=0,releaseSpeed=0,releaseU=0;
 for(let i=0;i<=Math.ceil(duration*hz);i++){
  const u=Math.min(1,i/(duration*hz));a.anim.instant=b.anim.instant=false;
  a.anim.update(dt,{...base,clip,hold:false,u,role:'A'},b.anim);
  b.anim.update(dt,{...base,clip,hold:false,u,role:'B'},a.anim);
  a.anim.applyContacts(dt,b.anim);b.anim.applyContacts(dt,a.anim);
  const p=palms(a);if(i===0)firstStep=Math.max(p.left.distanceTo(previous.left),p.right.distanceTo(previous.right));
  if(clip==='cradleFall'||u<=.2)maxGap=Math.max(maxGap,p.left.distanceTo(p.right));
  if(clip==='cradleFightOff' && u>.2 && u<.6){const speed=Math.max(p.left.distanceTo(previous.left),p.right.distanceTo(previous.right))/dt;if(speed>releaseSpeed){releaseSpeed=speed;releaseU=u;}}
  const defender=palms(b);
  if(clip==='cradleFightOff' && u>.2 && u<.6){const speed=Math.max(defender.left.distanceTo(previousDefender.left)/dt,defender.right.distanceTo(previousDefender.right)/dt);if(speed>worstDefenderSpeed){worstDefenderSpeed=speed;if(speed>10)console.log('Defender release velocity',{mirror,as,bs,hz,u,speed});}}
  previousDefender=defender;previous=p;
 }
 worstReleaseSpeed=Math.max(worstReleaseSpeed,releaseSpeed);
 worstExitGap=Math.max(worstExitGap,maxGap);worstExitStep=Math.max(worstExitStep,firstStep);
 console.log('Cradle exit continuity',{clip,mirror,as,bs,hz,maxGap,firstStep,releaseSpeed,releaseU});
}
console.log({worstExitGap,worstExitStep,worstReleaseSpeed,worstDefenderSpeed});
if(worstExitGap>.01)throw new Error('Cradle exit loses lock while it should be retained');
if(worstExitStep>.025)throw new Error('Cradle exit jumps on its first frame');

// An obsolete contact anchor previously produced a ~25 m/s one-frame snap.
if(worstReleaseSpeed>10)throw new Error('Cradle wrist snaps as its clasp releases');

// Defender's palms must meet the opponent's wrist/forearm surface, not put
// their own wrist inside that surface with fingers pointing through the arm.
let defenderGap=0,defenderNormalError=0;
for(const mirror of [false,true])for(const [as,bs] of [[1,1],[.9,1.15],[1.15,.9]])for(const yaw of [0,1.2]){
 const a=make(as),b=make(bs);
 const base={mode:'paired' as const,clip:'cradleHold',hold:true,frame:{x:1,z:2,yaw},mirror,u:0,progress:.5,intensity:0,stamina:1,exertion:0};
 for(let i=0;i<120;i++){
  a.anim.update(1/60,{...base,role:'A'},b.anim);b.anim.update(1/60,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
 }
 const contacts=sampleHold('cradleHold','B',.5,0,0,mirror,createLocal());
 for(const c of contacts){
  if(!c.palm)throw new Error('Cradle defender is missing a palm-surface grip');
  const bone=a.bones[c.on],hand=b.bones[`hand${c.hand}`];
  bone.updateWorldMatrix(true,false);hand.updateWorldMatrix(true,false);
  const target=new Vector3(...c.at).multiplyScalar(as).applyMatrix4(bone.matrixWorld);
  const actual=palmSurface(c.hand,bs).applyMatrix4(hand.matrixWorld);
  const outward=new Vector3(c.at[0],0,c.at[2]).normalize().applyQuaternion(bone.getWorldQuaternion(new Quaternion()));
  const normal=new Vector3(c.hand==='L'?-1:1,0,0).applyQuaternion(hand.getWorldQuaternion(new Quaternion()));
  defenderGap=Math.max(defenderGap,target.distanceTo(actual));
  defenderNormalError=Math.max(defenderNormalError,1+normal.dot(outward));
 }
}
console.log({defenderGap,defenderNormalError});
if(defenderGap>.01||defenderNormalError>.02)throw new Error('Defender palm misses or faces away from the cradle grip');

if(worstDefenderSpeed>10)throw new Error('Defender hand snaps through the cradle release');
