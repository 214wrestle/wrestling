import {Bone,Group,Vector3} from 'three';
import {BONES,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import {sampleHold} from '../anim/clips';
import {createLocal} from '../anim/spec';
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

let worstGap=0,peakSpeed=0,context='';
for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]])for(const hz of [30,60,120]) {
 const a=make(scales[0]),b=make(scales[1]);
 a.anim.instant=false;b.anim.instant=false;
 const previous=new Map<string,Vector3>();
 for(let i=0;i<hz*3;i++){
  const time=i/hz;
  const pockets=Math.max(0,Math.min(1,time<1.7?(time-.6)/.7:1-(time-1.7)/.7));
  const closing=pockets>.3; // Same selection threshold as wrestlerViews.
  const clip=closing?'closedPocketsFlat':'flat';
  const progress=closing?pockets:0;
  const base={mode:'paired' as const,clip,hold:true,frame:{x:0,z:0,yaw:.6},mirror,u:0,progress,intensity:.3,stamina:1,exertion:0};
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(time<.6)continue;
  for(const [role,own,opp] of [['A',a,b],['B',b,a]] as const){
   for(const hand of ['L','R'] as const){
    const point=own.anim.bonePos(`hand${hand}`,new Vector3()),key=role+hand;
    const before=previous.get(key);if(before){const speed=point.distanceTo(before)*hz;if(speed>peakSpeed){peakSpeed=speed;context=`${role}${hand} time=${time} hz=${hz} scales=${scales} mirror=${mirror}`;}}
    previous.set(key,point);
   }
   for(const contact of sampleHold(clip,role,progress,time,.3,mirror,createLocal())){
    const bone=opp.bones[contact.on];bone.updateWorldMatrix(true,false);
    const target=new Vector3(...contact.at).multiplyScalar(opp.scale).applyMatrix4(bone.matrixWorld);
    worstGap=Math.max(worstGap,own.anim.bonePos(`hand${contact.hand}`,new Vector3()).distanceTo(target));
   }
  }
 }
}
console.log(JSON.stringify({worstGap,peakSpeed,context},null,2));
if(worstGap>.02)throw Error('Pocket transition loses grip');

if(peakSpeed>3)throw Error('Pocket transition introduced a wrist-speed spike');
