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


import {registerSeatedBarDrafts} from '../lab/doubleBarFinishDraft';
let minRise=Infinity,maxFootDrift=0,maxReturn=0;
for(const mirror of [false,true])for(const topScale of [.9,1,1.15])for(const scale of [.9,1,1.15])for(const button of ['shoot','fight']){
 registerSeatedBarDrafts(topScale);
 const a=make(topScale),b=make(scale),a0=make(topScale),b0=make(scale),dt=1/60;
 const v={mode:'paired' as const,clip:'armBarSeatedFinishDraft',hold:true,frame:{x:0,z:0,yaw:.7},mirror,u:0,progress:0,intensity:0,stamina:1,exertion:0};
 let rise=0;
 for(let i=0;i<180;i++){
  if(i===60){for(const own of [a,b,a0,b0])own.anim.instant=false;a.anim.effort(button,true,'ok');b.anim.effort(button,false,'ok');}
  for(const [top,bottom] of [[a,b],[a0,b0]]){
   top.anim.update(dt,{...v,role:'A'},bottom.anim);bottom.anim.update(dt,{...v,role:'B'},top.anim);
   top.anim.applyContacts(dt,bottom.anim);bottom.anim.applyContacts(dt,top.anim);
  }
  if(i<60)continue;
  const displacement=b.anim.bonePos('hips',new Vector3()).sub(b0.anim.bonePos('hips',new Vector3()));
  if(!Number.isFinite(displacement.length()))throw Error('Nonfinite pose');
  rise=Math.max(rise,displacement.y/scale);
  for(const foot of ['footL','footR'] as const){const delta=b.anim.bonePos(foot,new Vector3()).sub(b0.anim.bonePos(foot,new Vector3()));maxFootDrift=Math.max(maxFootDrift,Math.hypot(delta.x,delta.z)/scale);}
  if(i===179)maxReturn=Math.max(maxReturn,displacement.length()/scale);
 }
 minRise=Math.min(minRise,rise);
}
console.log({minRise,maxFootDrift,maxReturn,note:'Skeleton response only; mesh contact and rendered review remain required.'});
if(minRise<.01||maxFootDrift>.01||maxReturn>.005)throw Error('Seated effort response gate failed');
