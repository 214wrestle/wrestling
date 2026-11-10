import {Bone,Group,Vector3} from 'three';
import {BONES,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import '../anim/library';
import {sampleMove,sampleFootContacts,sampleHold} from '../anim/clips';
import {createLocal} from '../anim/spec';
import {P} from '../anim/posture';
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

let seatedKneeRise=-Infinity;
let worstBootGap=0,bootSamples=0, worstGap=0,minimumKnee=Infinity,minimumFoot=Infinity,peakSpeed=0,context='',kneeContext='',speedContext='';
for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]])for(const hz of [30,60,120]) {
 const a=make(scales[0]),b=make(scales[1]);
 a.anim.instant=false;b.anim.instant=false;
 const prev=new Map<string,Vector3>();
 for(let i=0;i<=hz*3.4;i++) {
  const u=Math.max(0,Math.min(1,(i/hz-.4)/2.6));
  const base={mode:'paired' as const,clip:'sitAndCircleLegDefense',hold:false,frame:{x:0,z:0,yaw:.6},mirror,u,progress:0,intensity:0,stamina:1,exertion:0};
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  for(const [role,own,opp] of [['A',a,b],['B',b,a]] as const) {
   for(const n of ['shinL','shinR','footL','footR','toeL','toeR','handL','handR'] as const) {
    const p=own.anim.bonePos(n,new Vector3());
    if(!p.toArray().every(Number.isFinite))throw Error('Nonfinite seated defense');
    if(i/hz>.4&&n.startsWith('shin')&&p.y/own.scale<minimumKnee){minimumKnee=p.y/own.scale;kneeContext=`${role}${n} u=${u} scale=${scales} hz=${hz}`;}
    if(n.startsWith('foot'))minimumFoot=Math.min(minimumFoot,p.y/own.scale);
    const prior=prev.get(role+n);
    if(prior&&i/hz>.4&&p.distanceTo(prior)*hz>peakSpeed){peakSpeed=p.distanceTo(prior)*hz;speedContext=`${role}${n} u=${u} scale=${scales} hz=${hz}`;}
    prev.set(role+n,p);
   }
   if(role==='B'&&u>=.54&&u<=.85) {
    const knee=own.anim.bonePos(mirror?'shinR':'shinL',new Vector3());
    const hip=own.anim.bonePos('hips',new Vector3());
    seatedKneeRise=Math.max(seatedKneeRise,(knee.y-hip.y)/own.scale);
   }
   if(i/hz<.4)continue;
   for(const c of sampleFootContacts(base.clip,role,u,mirror,false)) {
    if(c.weight<.999)continue;
    const bone=opp.bones[c.on];bone.updateWorldMatrix(true,false);
    const anchor=new Vector3(...c.at).multiplyScalar(opp.scale).applyMatrix4(bone.matrixWorld);
    worstBootGap=Math.max(worstBootGap,own.anim.bonePos(`toe${c.foot}`,new Vector3()).distanceTo(anchor));
    bootSamples++;
   }
   for(const c of sampleMove(base.clip,role,u,mirror,createLocal())) {
    if(c.weight<.99)continue;
    const bone=opp.bones[c.on];bone.updateWorldMatrix(true,false);
    const target=new Vector3(...c.at).multiplyScalar(opp.scale).applyMatrix4(bone.matrixWorld);
    const gap=own.anim.bonePos(`hand${c.hand}`,new Vector3()).distanceTo(target);
    if(gap>worstGap){worstGap=gap;context=`${role}${c.hand} u=${u} scale=${scales} mirror=${mirror} hz=${hz}`;}
   }
  }
 }
}
console.log(JSON.stringify({seatedKneeRise,worstBootGap,bootSamples,worstGap,context,minimumKnee,minimumFoot,peakSpeed,kneeContext,speedContext},null,2));
// The forward thigh stays low enough for the chest-over-thigh defense,
// rather than folding the knee up beside the torso.
if(seatedKneeRise>.24)throw Error('Seated forward knee rises into the torso');
if(bootSamples<100||worstBootGap>.02)throw Error('Hooked foot loses thigh contact');
if(worstGap>.02)throw Error('Seated defense loses rider contact');
if(minimumKnee<.025||minimumFoot<.015)throw Error('Seated defense penetrates the mat');
if(peakSpeed>4)throw Error('Seated defense has an extremity velocity spike');

// The circle is supported by seated hips: the free palm and rider's free foot
// replant in stages rather than dragging continuously across the floor.
for(const mirror of [false,true])for(const role of ['A','B'] as const){
 const point=role==='A'?(mirror?P.FOOT_L:P.FOOT_R):(mirror?P.HAND_L:P.HAND_R);
 const poses=[.46,.54,.60].map(u=>{const p=createLocal();sampleMove('sitAndCircleLegDefense',role,u,mirror,p);return p;});
 for(let axis=0;axis<3;axis++)if(Math.abs(poses[0][point+axis]-poses[1][point+axis])>.001)throw Error('Circling support drags before lifting');
 if(poses[2][point+1]<poses[1][point+1]+.08)throw Error('Circling support does not lift before replanting');
}
console.log('Defender palm and rider foot retain their plant, then lift to follow the hip circle');

// Contact fades completely out before the move ends, and unrelated live clips
// retain their existing authored foot placement.
for(const mirror of [false,true]) {
 if(sampleFootContacts('sitAndCircleLegDefense','A',0,mirror,false).length)throw Error('Boot contact snaps on at entry');
 if(sampleFootContacts('sitAndCircleLegDefense','A',1.001,mirror,false).length)throw Error('Boot contact remains after release');
 if(sampleFootContacts('legRide','A',.5,mirror,true).length)throw Error('Live ride unexpectedly constrained');
 const c=sampleFootContacts('sitAndCircleLegDefense','A',.6,mirror,false)[0];
 if(c.foot!==(mirror?'R':'L')||c.on!==(mirror?'thighR':'thighL'))throw Error('Boot contact mirrors incorrectly');
}

// Start from the actual live ride, not an already-warmed first move pose.
// Finish in the authored defensive hold to expose entry/exit knee flips.
let transitionPeak=0,transitionContext='',transitionKnee=Infinity,transitionKneeContext='',recoveryGripGap=0;
for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]])for(const hz of [30,60,120]) {
 const a=make(scales[0]),b=make(scales[1]);a.anim.instant=false;b.anim.instant=false;
 const previous=new Map<string,Vector3>();
 for(let i=0;i<hz*8;i++) {
  const time=i/hz;
  const base={mode:'paired' as const,clip:time<1?'legRide':time<3.6?'sitAndCircleLegDefense':time<4.1?'seatedLegDefenseExit':time<5.9?'recoverSeatedLegDefense':time<6.8?'seatedDefenseRecovered':'ride',hold:time<1||(time>=3.6&&time<4.1)||time>=5.9,frame:{x:0,z:0,yaw:.6+(time>=6.8?(mirror?-1:1)*55*Math.PI/180:0)},mirror,u:Math.max(0,Math.min(1,time<4.1?(time-1)/2.6:(time-4.1)/1.8)),progress:time<1?1:0,intensity:0,stamina:1,exertion:0};
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(time>=4.1)for(const [role,own,opp] of [['A',a,b],['B',b,a]] as const){
   const contacts=base.hold?sampleHold(base.clip,role,0,0,0,mirror,createLocal()):sampleMove(base.clip,role,base.u,mirror,createLocal());
   for(const c of contacts){
    // The ordinary ride uses a new waist anchor; allow its explicit regrip.
    if(c.weight<.99 || (time>=6.8&&time<7.15) || (c.hand===(mirror?'L':'R')&&time<6.2))continue;
    const bone=opp.bones[c.on];bone.updateWorldMatrix(true,false);
    const target=new Vector3(...c.at).multiplyScalar(opp.scale).applyMatrix4(bone.matrixWorld);
    recoveryGripGap=Math.max(recoveryGripGap,own.anim.bonePos(`hand${c.hand}`,new Vector3()).distanceTo(target));
   }
  }
  for(const [role,own] of [['A',a],['B',b]] as const)for(const bone of ['shinL','shinR','toeL','toeR','handL','handR'] as const) {
   const point=own.anim.bonePos(bone,new Vector3()),old=previous.get(role+bone);
   if(time>=1&&bone.startsWith('shin')&&point.y/own.scale<transitionKnee){transitionKnee=point.y/own.scale;transitionKneeContext=`${role}${bone} time=${time} hz=${hz} scales=${scales} mirror=${mirror}`;}
   const speed=old?point.distanceTo(old)*hz:0;
   if(time>.8&&speed>transitionPeak){transitionPeak=speed;transitionContext=`${role}${bone} time=${time} hz=${hz} scales=${scales} mirror=${mirror}`;}
   previous.set(role+bone,point);
  }
 }
}
console.log({transitionPeak,transitionContext,transitionKnee,transitionKneeContext,recoveryGripGap});
if(transitionPeak>4)throw Error('Live ride/defense transition has a velocity spike; lab draft is not ready for gameplay');

if(transitionKnee<.025)throw Error('Live seated-defense transition knee penetrates mat');

// Rider must release the waist before his posting hand supports the circle.
for(const mirror of [false,true]) {
 const hand=mirror?'L':'R';
 if(sampleMove('sitAndCircleLegDefense','A',.46,mirror,createLocal()).some(c=>c.hand===hand))throw Error('Posting hand still locked to waist');
 const at=mirror?P.HAND_L:P.HAND_R;
 const poses=[.46,.54,.6].map(u=>{const p=createLocal();sampleMove('sitAndCircleLegDefense','A',u,mirror,p);return p;});
 for(let axis=0;axis<3;axis++)if(Math.abs(poses[0][at+axis]-poses[1][at+axis])>.001)throw Error('Rider post drags before lifting');
 if(poses[2][at+1]-poses[1][at+1]<.06)throw Error('Rider post needs a visible lift');
}

if(recoveryGripGap>.02)throw Error('Rider loses established control grip during recovery');

let interruptedPeak=0,interruptedContext='',interruptedKnee=Infinity,interruptedGripGap=0;
for(const cut of [.1,.2,.24,.26,.3,.33,.35,.4,.5,.6,.7,.8,.9])for(const scales of [[1,1],[.9,1.15],[1.15,.9]])for(const mirror of [false,true])for(const hz of [30,60,120]){
 const a=make(scales[0]),b=make(scales[1]);a.anim.instant=false;b.anim.instant=false;
 const start=1+2.6*cut,previous=new Map<string,Vector3>();
 for(let i=0;i<hz*(start+3.6);i++){
  const time=i/hz;
  const base={mode:'paired' as const,clip:time<1?'legRide':time<start?'sitAndCircleLegDefense':time<start+1.8?'recoverSeatedLegDefense':time<start+2.4?'seatedDefenseRecovered':'ride',hold:time<1||time>=start+1.8,frame:{x:0,z:0,yaw:.6+(time>=start+2.4?(mirror?-1:1)*55*Math.PI/180:0)},mirror,u:Math.max(0,Math.min(1,time<start?(time-1)/2.6:(time-start)/1.8)),progress:time<1?1:0,intensity:0,stamina:1,exertion:0};
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(time>=start+2.8){
   for(const contact of sampleHold('ride','A',0,0,0,mirror,createLocal())){
    const bone=b.bones[contact.on];bone.updateWorldMatrix(true,false);
    const target=new Vector3(...contact.at).multiplyScalar(b.scale).applyMatrix4(bone.matrixWorld);
    interruptedGripGap=Math.max(interruptedGripGap,a.anim.bonePos(`hand${contact.hand}`,new Vector3()).distanceTo(target));
   }
  }
  for(const [role,own] of [['A',a],['B',b]] as const)for(const bone of ['shinL','shinR','toeL','toeR','handL','handR'] as const){
   const point=own.anim.bonePos(bone,new Vector3()),old=previous.get(role+bone),speed=old?point.distanceTo(old)*hz:0;
   if(time>start&&bone.startsWith('shin'))interruptedKnee=Math.min(interruptedKnee,point.y/own.scale);
   if(time>start&&speed>interruptedPeak){interruptedPeak=speed;interruptedContext=`cut=${cut} ${role}${bone} time=${time} hz=${hz} scales=${scales} mirror=${mirror}`;}
   previous.set(role+bone,point);
  }
 }
}
console.log({interruptedPeak,interruptedContext,interruptedKnee,interruptedGripGap});
if(interruptedGripGap>.02)throw Error('Interrupted defense fails to reestablish ordinary ride grip');
if(interruptedKnee<.025)throw Error('Interrupted defense knee penetrates floor');
if(interruptedPeak>4)throw Error('Interrupted defense snaps into recovery');
