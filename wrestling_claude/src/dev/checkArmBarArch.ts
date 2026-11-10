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


// Compare actual squeeze motion with an identical idle pair. The sit-through
// must arch from its supports without detaching the established arm contact.
let minimumHipRise=Infinity,maximumFootDrift=0;
for(const mirror of [false,true])for(const scale of [.9,1,1.15])for(const hz of [30,60,120]){
 const a=make(scale),b=make(1),a0=make(scale),b0=make(1),dt=1/hz;
 const v={mode:'paired' as const,clip:'armBarPin',hold:true,frame:{x:0,z:0,yaw:.7},mirror,u:0,progress:.3,intensity:0,stamina:1,exertion:0};
 let rise=0;
 for(let i=0;i<2*hz;i++){
  if(i===hz){for(const own of [a,b,a0,b0])own.anim.instant=false;a.anim.effort('shoot',false,'ok');b.anim.effort('shoot',true,'ok');}
  for(const [top,bottom] of [[a,b],[a0,b0]]){
   top.anim.update(dt,{...v,role:'A'},bottom.anim);bottom.anim.update(dt,{...v,role:'B'},top.anim);
   top.anim.applyContacts(dt,bottom.anim);bottom.anim.applyContacts(dt,top.anim);
  }
  if(i<hz)continue;
  rise=Math.max(rise,(a.anim.bonePos('hips',new Vector3()).y-a0.anim.bonePos('hips',new Vector3()).y)/scale);
  for(const foot of ['footL','footR'] as const)maximumFootDrift=Math.max(maximumFootDrift,a.anim.bonePos(foot,new Vector3()).distanceTo(a0.anim.bonePos(foot,new Vector3()))/scale);
 }
 minimumHipRise=Math.min(minimumHipRise,rise);
}
console.log({minimumHipRise,maximumFootDrift});
if(minimumHipRise<.02||maximumFootDrift>.002)throw Error('Sit-through squeeze loses its planted-foot arch');
