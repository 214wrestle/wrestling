import {Bone,Group,Vector3} from 'three';
import {BONES} from '../body/skeleton';
import type {BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import '../anim/library';
Math.random=()=>.5;
let worst=0,context='';
for(const hz of [30,60,120]) for(const scale of [.9,1,1.15]) for(const switchAt of [.8,1,1.2,1.4,1.6]) {
 const bones={} as Record<BoneName,Bone>,root=new Group();
 for(const def of BONES){const b=new Bone();b.position.set(...def.offset).multiplyScalar(scale);bones[def.name]=b;if(def.parent)bones[def.parent].add(b);else root.add(b);}
 const anim=new Animator({bones,root,scale,boneList:Object.values(bones),dispose:()=>{},motion:DEFAULT_MOTION,setExertion:()=>{}});anim.instant=true;
 let prior:Vector3[]|undefined;
 for(let frame=0;frame<hz*2.5;frame++) {
  const t=frame/hz,walking=t<switchAt;
  const base={x:0,z:.85*Math.min(t,switchAt),yaw:0,vx:0,vz:walking?.85:0,stamina:1,exertion:0};
  anim.update(1/hz,walking?{...base,mode:'walk'}:{...base,mode:'stance',level:.45,lean:0,lead:1,act:'stance',actT:0,actDur:0,hand:0,oppHand:0},null);
  const hands=[bones.handL.getWorldPosition(new Vector3()),bones.handR.getWorldPosition(new Vector3())];
  if(prior&&t>=switchAt&&t<switchAt+.15)for(let i=0;i<2;i++) {
   const speed=hands[i].distanceTo(prior[i])*hz/scale;
   if(speed>worst){worst=speed;context=`hz=${hz} scale=${scale} switch=${switchAt} t=${t} hand=${i}`;}
  }
  prior=hands;
 }
}
console.log(`Walk-to-stance peak wrist speed ${worst.toFixed(3)}m/s relative to body size (${context})`);
if(worst>5)throw Error('Walk-to-stance transition snaps a hand');
