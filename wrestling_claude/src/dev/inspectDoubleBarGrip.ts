import {palmSurface} from '../anim/gableGrip';
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



for(const clip of ['doubleBarControl','doubleBarPin'])for(const progress of [0,.5,1]){
 const a=make(1),b=make(1),dt=1/60;
 const v={mode:'paired' as const,clip,hold:true,frame:{x:0,z:0,yaw:0},mirror:false,u:0,progress,intensity:0,stamina:1,exertion:0};
 for(let i=0;i<60;i++){
 a.anim.update(dt,{...v,role:'A'},b.anim);b.anim.update(dt,{...v,role:'B'},a.anim);
 a.anim.applyContacts(dt,b.anim);b.anim.applyContacts(dt,a.anim);
 }
 const palms=(['L','R'] as const).map(hand=>{const bone=a.bones[`hand${hand}`];bone.updateWorldMatrix(true,false);return palmSurface(hand,1).applyMatrix4(bone.matrixWorld)});
 console.log({clip,progress,palmGap:palms[0].distanceTo(palms[1]),topHandSeparation:a.anim.bonePos('handL',new Vector3()).distanceTo(a.anim.bonePos('handR',new Vector3()))});
}

let minimumAngle=180,maximumAngle=0;
for(const mirror of [false,true])for(const scale of [.9,1,1.15]){
 const a=make(1),b=make(scale);
 for(let i=0;i<=120;i++){
 const v={mode:'paired' as const,clip:'doubleBarTurn',hold:false,frame:{x:0,z:0,yaw:0},mirror,u:i/120,progress:0,intensity:0,stamina:1,exertion:0};
 a.anim.update(1/60,{...v,role:'A'},b.anim);b.anim.update(1/60,{...v,role:'B'},a.anim);
 a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
 if(i<36)continue;
 for(const side of ['L','R'] as const){
 const elbow=b.anim.bonePos(`forearm${side}`,new Vector3());
 const upper=b.anim.bonePos(`arm${side}`,new Vector3()).sub(elbow);
 const lower=b.anim.bonePos(`hand${side}`,new Vector3()).sub(elbow);
 const angle=upper.angleTo(lower)*180/Math.PI;
 minimumAngle=Math.min(minimumAngle,angle);maximumAngle=Math.max(maximumAngle,angle);
 }
 }
}
console.log({minimumAngle,maximumAngle});
if(maximumAngle>135)throw Error('Double-bar defender arm straightens during control');
