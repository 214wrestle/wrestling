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
// Check actual solved support, not only the authored wrist target.
let worst=0;
for(const mirror of [false,true]) for(const scales of [[1,1],[.9,1.15],[1.15,.9]]) for(const u of [.5,.55,.6,.65,.68]) {
 const a=make(scales[0]),b=make(scales[1]);
 const base={mode:'paired' as const,clip:'finishLowSingle',hold:false,frame:{x:0,z:0,yaw:.6},mirror,u,progress:0,intensity:0,stamina:1,exertion:0};
 for(let i=0;i<30;i++) {
  a.anim.update(1/60,{...base,role:'A'},b.anim);b.anim.update(1/60,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
 }
 const wrist=b.anim.bonePos(mirror?'handR':'handL',new Vector3());
 const gap=Math.abs(wrist.y-.045);
 worst=Math.max(worst,gap);
}
console.log(`Low-single defensive post worst wrist-height gap ${worst.toFixed(4)}m`);
if(worst>.035)throw Error('Low-single defensive post cannot reach the mat');

let dynamicWorst=0,context='';
for(const mirror of [false,true]) for(const scales of [[1,1],[.9,1.15],[1.15,.9]])
for(const hz of [30,60,120]) for(const duration of [.5,.75,1]) {
 const a=make(scales[0]),b=make(scales[1]);
 for(let i=0;i<=Math.ceil(duration*hz);i++) {
  const u=Math.min(1,i/hz/duration);
  const base={mode:'paired' as const,clip:'finishLowSingle',hold:false,frame:{x:0,z:0,yaw:.6},mirror,u,progress:0,intensity:0,stamina:1,exertion:0};
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(u<.56 || u>.68)continue;
  const wrist=b.anim.bonePos(mirror?'handR':'handL',new Vector3());
  const gap=Math.abs(wrist.y-.045);
  if(gap>dynamicWorst){dynamicWorst=gap;context=`mirror=${mirror} scales=${scales} hz=${hz} duration=${duration} u=${u}`;}
 }
}
console.log(`Moving low-single post gap ${dynamicWorst.toFixed(4)}m (${context})`);
if(dynamicWorst>.035)throw Error('Moving low-single post stays airborne after release');
