import {Bone,Group,Vector3} from 'three';
import {BONES,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import '../anim/library';
import {moveClip,registerMove,sampleMove} from '../anim/clips';
import {P} from '../anim/posture';
import {createLocal} from '../anim/spec';
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

// Measure actual shoulder-joint movement toward the head, not just pose keys.
// Head center is a proxy; this does not establish skin contact with the ear.
const original=moveClip('armBarTurn')!;
const baseline={...original,B:original.B.map(k=>({...k,pose:{...k.pose,shrugL:[0,0] as [number,number]}}))};
let minimumApproach=Infinity;
for(const mirror of [false,true])for(const scale of [.9,1,1.15]){
 const distances:number[]=[];
 for(const clip of [original,baseline]){
  registerMove(clip);
  const a=make(1),b=make(scale);
  const v={mode:'paired' as const,clip:'armBarTurn',hold:false,frame:{x:0,z:0,yaw:.7},mirror,u:.44,progress:0,intensity:0,stamina:1,exertion:0};
  for(let i=0;i<120;i++){
   a.anim.update(1/60,{...v,role:'A'},b.anim);b.anim.update(1/60,{...v,role:'B'},a.anim);
   a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
  }
  distances.push(b.anim.bonePos(mirror?'armR':'armL',new Vector3()).distanceTo(b.anim.bonePos('head',new Vector3()))/scale);
 }
 minimumApproach=Math.min(minimumApproach,distances[1]-distances[0]);
}
registerMove(original);
console.log({minimumApproach,units:'metres at canonical scale'});
if(minimumApproach<.02)throw Error('Trapped shoulder does not rise toward head');

// A cleared bar should not re-turn the defender while recovering chest to mat.
let maximumReverseRoll=0;
for(const mirror of [false,true]){
 let previous=Infinity;
 for(let i=0;i<=200;i++){
  const pose=createLocal();sampleMove('armBarExit','B',i/200,mirror,pose);
  const roll=Math.abs(pose[P.HIPS_Q+3]);
  maximumReverseRoll=Math.max(maximumReverseRoll,roll-previous);previous=roll;
 }
}
console.log({maximumReverseRoll});
if(maximumReverseRoll>.001)throw Error('Arm-bar release reverses the defender roll');
