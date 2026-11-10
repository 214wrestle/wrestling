import {Bone,Group,Vector3} from 'three';
import {BONES,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import '../anim/library';
import {moveClip,registerMove} from '../anim/clips';
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

// Compare the actual elbow bone with an identical run using only hand anchors.
let minEffect=Infinity,maxElbowSpeed=0,cases=0,context="";
for(const clip of ['armBar','wristBar','barHalf','doubleBar'].flatMap(id=>['Turn','Resisted','Exit'].map(phase=>id+phase)))for(const mirror of [false,true])for(const scale of [.9,1,1.15])for(const hz of [30,60,120]){
 const original=moveClip(clip)!;
 const unGuided={...original,contacts:original.contacts?.map(({elbowGuide,...c})=>c)};
 const pairs=[[make(1),make(scale)],[make(1),make(scale)]];
 const duration=clip.endsWith('Turn')?2.2:clip.endsWith('Exit')?.85:1.5,dt=1/hz;
 const elbow=mirror?'forearmL':'forearmR';
 let effect=0,previous:Vector3|undefined,baselinePrevious:Vector3|undefined,baselinePeak=0;
 for(let i=-hz;i<=(duration+1)*hz;i++){
  for(let variant=0;variant<2;variant++){
   registerMove(variant===0?original:unGuided);
   const [a,b]=pairs[variant];
   const landed=i*dt>=duration;
   const target=clip.endsWith('Turn')?clip.replace('Turn','Pin'):'flat';
   const v={mode:'paired' as const,clip:i<0?(clip.endsWith('Exit')?clip.replace('Exit','Pin'):'flat'):landed?target:clip,hold:i<0||landed,
    frame:{x:0,z:0,yaw:.7},mirror,u:Math.max(0,i*dt/duration),progress:0,intensity:0,stamina:1,exertion:0};
   a.anim.instant=b.anim.instant=i<0;
   a.anim.update(dt,{...v,role:'A'},b.anim);b.anim.update(dt,{...v,role:'B'},a.anim);
   a.anim.applyContacts(dt,b.anim);b.anim.applyContacts(dt,a.anim);
  }
  if(i<0)continue;
  const point=pairs[0][0].anim.bonePos(elbow,new Vector3());
  effect=Math.max(effect,point.distanceTo(pairs[1][0].anim.bonePos(elbow,new Vector3())));
  if(previous&&i>1){const speed=point.distanceTo(previous)*hz;if(speed>maxElbowSpeed){maxElbowSpeed=speed;context=`${clip} mirror=${mirror} scale=${scale} hz=${hz} time=${i*dt}`;}}
  const baseline=pairs[1][0].anim.bonePos(elbow,new Vector3());if(baselinePrevious&&i>1)baselinePeak=Math.max(baselinePeak,baseline.distanceTo(baselinePrevious)*hz);baselinePrevious=baseline;previous=point;
 }
 if(baselinePeak>4)console.log({clip,mirror,scale,hz,baselinePeak});
 registerMove(original);minEffect=Math.min(minEffect,effect);cases++;
}
console.log({cases,minEffect,maxElbowSpeed,context});
// Short releases may spend their entire bend budget following the existing plane.
// Effect is reported, not required in every phase.
if(maxElbowSpeed>4)throw Error('Anatomical guide creates elbow snap');
