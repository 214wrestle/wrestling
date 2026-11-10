import {Bone,Group,Vector3} from 'three';
import {BONES,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
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

// Full transition history, including acquisition and release. Diagnostic only:
// head centers are not complete mesh-collision or anatomical validation.
const phases:Record<string,number>={};
let positions:unknown;
let minimumHeadDistance=Infinity,peakHeadSpeed=0,headContext='',speedContext='';
for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]])for(const hz of [30,60,120]){
 const a=make(scales[0]),b=make(scales[1]);let previous:Vector3|undefined;
 for(let i=0;i<=Math.ceil(7.05*hz);i++){
  const t=i/hz;
  const clip=t<1?'flat':t<3.2?'armBarTurn':t<5.2?'armBarPin':t<6.05?'armBarExit':'flat';
  const hold=clip==='flat'||clip==='armBarPin';
  const u=clip==='armBarTurn'?(t-1)/2.2:clip==='armBarExit'?(t-5.2)/.85:0;
  const v={mode:'paired' as const,clip,hold,frame:{x:0,z:0,yaw:0},mirror,u,progress:clip==='armBarPin'?(t-3.2)/2:0,intensity:0,stamina:1,exertion:0};
  a.anim.instant=b.anim.instant=i===0;
  a.anim.update(1/hz,{...v,role:'A'},b.anim);b.anim.update(1/hz,{...v,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  const head=a.anim.bonePos('head',new Vector3()),other=b.anim.bonePos('head',new Vector3());
  const distance=head.distanceTo(other)/(Math.max(...scales));
  phases[clip]=Math.min(phases[clip]??Infinity,distance);
  if(distance<minimumHeadDistance){minimumHeadDistance=distance;positions={a:head.toArray(),b:other.toArray(),hips:a.anim.bonePos('hips',new Vector3()).toArray()};headContext=`${clip} t=${t} mirror=${mirror} scales=${scales} hz=${hz}`;}
  if(previous&&i>hz){const speed=head.distanceTo(previous)*hz;if(speed>peakHeadSpeed){peakHeadSpeed=speed;speedContext=`${clip} t=${t} mirror=${mirror} scales=${scales} hz=${hz}`;}}
  previous=head;
 }
}
console.log({phases,positions,minimumHeadDistance,headContext,peakHeadSpeed,speedContext});

// Guard the head crossing found during recovery; this does not certify mesh clearance.
if(minimumHeadDistance<.16)throw Error("Arm-bar sequence brings head centers too close");
if(peakHeadSpeed>4)throw Error("Arm-bar recovery head movement snaps");
