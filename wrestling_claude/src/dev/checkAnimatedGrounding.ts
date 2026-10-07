import {Bone,Group,Vector3} from 'three';
import {BONES} from '../body/skeleton';
import type {BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import '../anim/library';
// Full animator including spring, inertial torso and procedural footwork.
let worst=0,context='';
for(const mode of ['stance','walk'] as const) for(const scale of [.9,1,1.15]) for(const hz of [30,60,120]) for(const speed of mode==='walk'?[0,.2,.4,.65,1.2]:[.65,2.7]) {
 const bones={} as Record<BoneName,Bone>,root=new Group();
 for(const def of BONES){const b=new Bone();b.position.set(...def.offset).multiplyScalar(scale);bones[def.name]=b;if(def.parent)bones[def.parent].add(b);else root.add(b);}
 const anim=new Animator({bones,root,scale,boneList:Object.values(bones),dispose:()=>{},motion:DEFAULT_MOTION,setExertion:()=>{}});anim.instant=true;
 for(let frame=0;frame<hz*3;frame++){
  const base={x:mode==='stance'?speed*frame/hz:0,z:mode==='walk'?speed*frame/hz:0,yaw:0,vx:mode==='stance'?speed:0,vz:mode==='walk'?speed:0,stamina:1,exertion:0};
  anim.update(1/hz,mode==='walk'?{...base,mode}:{...base,mode,level:.8,lean:0,lead:1,act:'stance',actT:0,actDur:0,hand:0,oppHand:0},null);
  if(frame<hz/2)continue;
  const left=bones.toeL.getWorldPosition(new Vector3()),right=bones.toeR.getWorldPosition(new Vector3());
  const gap=Math.min(left.y,right.y)-.025*scale;
  if(gap>worst){worst=gap;context=`mode=${mode} scale=${scale} hz=${hz} speed=${speed}`;}
 }
}
console.log(`Worst support gap ${worst.toFixed(4)}m (${context})`);
if(worst>.025)throw Error('Animated locomotion loses ground support');

// After movement stops, low frame rates must not leave the trunk oscillating.
for(const hz of [20,30,60,120]) {
 const bones={} as Record<BoneName,Bone>,root=new Group();
 for(const def of BONES){const b=new Bone();b.position.set(...def.offset);bones[def.name]=b;if(def.parent)bones[def.parent].add(b);else root.add(b);}
 const anim=new Animator({bones,root,scale:1,boneList:Object.values(bones),dispose:()=>{},motion:DEFAULT_MOTION,setExertion:()=>{}});anim.instant=true;
 let previous=bones.spine.quaternion.clone(),maxSettledChange=0;
 for(let frame=0;frame<hz*4;frame++) {
  const t=frame/hz;
  anim.update(1/hz,{mode:'walk',x:0,z:Math.min(t,1),yaw:0,vx:0,vz:t<1?1:0,stamina:1,exertion:0},null);
  if(t>2.5) {
   for(const toe of [bones.toeL,bones.toeR]) {
    if(Math.abs(toe.getWorldPosition(new Vector3()).y-.025)>.025)
     throw Error(`Walking stop foot gap at ${hz}Hz t=${t}: ${toe.getWorldPosition(new Vector3()).y-.025}`);
   }
  }
  if(t>2.5)maxSettledChange=Math.max(maxSettledChange,previous.angleTo(bones.spine.quaternion));
  previous.copy(bones.spine.quaternion);
 }
 console.log(`Stopped torso at ${hz}Hz: ${maxSettledChange.toFixed(4)}rad/frame`);
 if(maxSettledChange>.03)throw Error('Torso keeps shaking after locomotion stops');
}
