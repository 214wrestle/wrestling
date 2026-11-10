import {Bone,Group,Vector3,Quaternion} from 'three';
import {BONES,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {palmSurface,palmGrip} from '../anim/gableGrip';
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


let minRise=Infinity,maxFootDrift=0,minHead=Infinity,minControlledHandMotion=Infinity,minHalfHandApproach=Infinity,maxPeelGap=0,maxPeelSpeed=0,maxPeakPeelGap=0,maxPalmAngle=0,maxReleaseAngularSpeed=0,releaseContext="";
for(const clip of ['armBarPin','wristBarPin','barHalfPin','doubleBarPin'])for(const button of ['shoot','fight'])for(const mirror of [false,true])for(const scale of [.9,1,1.15])for(const hz of [30,60,120]){
 const a=make(1),b=make(scale),a0=make(1),b0=make(scale),dt=1/hz;
 const v={mode:'paired' as const,clip,hold:true,frame:{x:0,z:0,yaw:.7},mirror,u:0,progress:.3,intensity:0,stamina:1,exertion:0};
 let rise=0,halfHandApproach=0,peelGap=Infinity;
 let previousPeel:Vector3|null=null;
 let previousRotation:Quaternion|null=null;
 let previousLocal:Quaternion|null=null;
 const handMotion={handL:0,handR:0};
 for(let i=0;i<2*hz;i++){
  if(i===hz){for(const own of [a,b,a0,b0])own.anim.instant=false;a.anim.effort(button,true,'ok');b.anim.effort(button,false,'ok');}
  for(const [top,bottom] of [[a,b],[a0,b0]]){
   top.anim.update(dt,{...v,role:'A'},bottom.anim);bottom.anim.update(dt,{...v,role:'B'},top.anim);
   top.anim.applyContacts(dt,bottom.anim);bottom.anim.applyContacts(dt,top.anim);
  }
  if(i<hz)continue;
  rise=Math.max(rise,(b.anim.bonePos('hips',new Vector3()).y-b0.anim.bonePos('hips',new Vector3()).y)/scale);
  for(const foot of ['footL','footR'] as const){
   const delta=b.anim.bonePos(foot,new Vector3()).sub(b0.anim.bonePos(foot,new Vector3()));
   maxFootDrift=Math.max(maxFootDrift,Math.hypot(delta.x,delta.z)/scale);
  }
  for(const hand of ['handL','handR'] as const)handMotion[hand]=Math.max(handMotion[hand],b.anim.bonePos(hand,new Vector3()).distanceTo(b0.anim.bonePos(hand,new Vector3()))/scale);
  minHead=Math.min(minHead,b.anim.bonePos('head',new Vector3()).y/scale);
  if(clip==='barHalfPin'||clip==='armBarPin'){
   const half=clip==='barHalfPin';
   const hand=half?(mirror?'handR':'handL'):(mirror?'handL':'handR');
   const distance=b.anim.bonePos(hand,new Vector3()).distanceTo(b.anim.bonePos('neck',new Vector3()));
   const baseline=b0.anim.bonePos(hand,new Vector3()).distanceTo(b0.anim.bonePos('neck',new Vector3()));
   halfHandApproach=Math.max(halfHandApproach,(baseline-distance)/scale);
   const forearm=a.bones[half?(mirror?'forearmL':'forearmR'):(mirror?'forearmR':'forearmL')];forearm.updateWorldMatrix(true,false);
   const anchor=new Vector3(0,half?-.16:-.22,.045).applyMatrix4(forearm.matrixWorld);
   const handBone=b.bones[hand];handBone.updateWorldMatrix(true,false);
   const contact=half?b.anim.bonePos(hand,new Vector3()):palmSurface(mirror?'L':'R',scale).applyMatrix4(handBone.matrixWorld);
   const gap=contact.distanceTo(anchor);
   peelGap=Math.min(peelGap,gap);
   const age=(i-hz+1)*dt;
   if(clip==='armBarPin'&&age>=.18&&age<=.24){
    maxPeakPeelGap=Math.max(maxPeakPeelGap,gap);
    const q=forearm.getWorldQuaternion(new Quaternion());
    const target=palmGrip(anchor,new Vector3(0,0,1).applyQuaternion(q),new Vector3(0,1,0).applyQuaternion(q),mirror?'L':'R',scale);
    maxPalmAngle=Math.max(maxPalmAngle,handBone.getWorldQuaternion(new Quaternion()).angleTo(target.rotation));
   }
   const rotation=handBone.getWorldQuaternion(new Quaternion());
   if(clip==='armBarPin'&&age>=.28&&previousRotation){const speed=rotation.angleTo(previousRotation)/dt;if(speed>maxReleaseAngularSpeed){maxReleaseAngularSpeed=speed;releaseContext=JSON.stringify({age,mirror,scale,hz,button,localSpeed:previousLocal?handBone.quaternion.angleTo(previousLocal)/dt:0});}}
   previousRotation=rotation;previousLocal=handBone.quaternion.clone();
   const current=b.anim.bonePos(hand,new Vector3());
   if(previousPeel)maxPeelSpeed=Math.max(maxPeelSpeed,current.distanceTo(previousPeel)/dt);
   previousPeel=current;
  }
 }
 minRise=Math.min(minRise,rise);
 if(clip==='barHalfPin'){
  minHalfHandApproach=Math.min(minHalfHandApproach,halfHandApproach);
 }
 if(clip==='barHalfPin'||clip==='armBarPin')maxPeelGap=Math.max(maxPeelGap,peelGap);
 if(clip==='wristBarPin')minControlledHandMotion=Math.min(minControlledHandMotion,handMotion[mirror?'handL':'handR']);
 if(clip==='doubleBarPin')minControlledHandMotion=Math.min(minControlledHandMotion,handMotion.handL,handMotion.handR);
}
console.log({minRise,maxFootDrift,minHead,minControlledHandMotion,minHalfHandApproach,maxPeelGap,maxPeelSpeed,maxPeakPeelGap,maxPalmAngle,maxReleaseAngularSpeed,releaseContext});
if(maxReleaseAngularSpeed>25)throw Error('Defensive wrist snaps after releasing palm contact');
if(maxPalmAngle>Math.PI/6)throw Error('Defensive palm fails to face the controlling forearm at peak effort');
if(maxPeakPeelGap>.06)throw Error('Single-bar hand fight lags behind peak defensive pressure');
if(maxPeelSpeed>4)throw Error('Defensive peel snaps during acquisition or release');
if(maxPeelGap>.06)throw Error('Defensive peel never reaches the controlling forearm');
if(minHalfHandApproach<.025)throw Error('Free hand does not approach the half-nelson control area');
if(minControlledHandMotion<.008)throw Error("Trapped-arm effort does not move the rendered hand");
if(minRise<.025)throw Error('Bridge has no visible pelvis lift');
if(maxFootDrift>.015)throw Error('Bridge slides planted feet');
if(minHead<.08)throw Error('Bridge head center too close to mat');
