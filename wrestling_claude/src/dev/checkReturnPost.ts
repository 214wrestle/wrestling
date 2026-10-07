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
let worst=0, context=''; const byClip=new Map<string,number>();
for(const clip of ['returnMat','standingTrip','crotchLift'])
for(const mirror of [false,true]) for(const scales of [[1,1],[.9,1.15],[1.15,.9]])
for(const hz of [30,60,120]) for(const duration of [.65,.8,1]) {
 const a=make(scales[0]),b=make(scales[1]);
 for(let i=0;i<=Math.ceil(duration*hz);i++) {
  const u=Math.min(1,i/hz/duration);
  const base={mode:'paired' as const,clip,hold:false,frame:{x:0,z:0,yaw:.6},mirror,u,progress:0,intensity:0,stamina:1,exertion:0};
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(u<.8 || u>.95)continue;
  for(const hand of ['handL','handR'] as const) {
   const wrist=b.anim.bonePos(hand,new Vector3());
   const gap=Math.abs(wrist.y-.045*scales[1]); byClip.set(clip,Math.max(byClip.get(clip)??0,gap));
   if(gap>worst){worst=gap;context=`${clip} mirror=${mirror} scales=${scales} hz=${hz} duration=${duration} u=${u} ${hand}`;}
  }
 }
}
console.log(Object.fromEntries(byClip));
console.log(`Return defensive wrist-height gap ${worst.toFixed(4)}m (${context})`);

if(worst>.025)throw Error('Defensive hands remain airborne after a standing return');
