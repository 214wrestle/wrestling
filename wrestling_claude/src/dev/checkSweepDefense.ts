import {Bone,Group,Vector3} from 'three';
import {BONES,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import {sampleMove} from '../anim/clips';
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

let worst=0,context='';
for(const scales of [[1,1],[.9,1.15],[1.15,.9]]) for(const mirror of [false,true]) for(const hz of [30,60,120]) for(const duration of [.8,1.1,1.5]) {
 const a=make(scales[0]),b=make(scales[1]);
 for(let i=0;i<=duration*hz;i++) {
  const u=i/(duration*hz),base={mode:'paired' as const,clip:'footSweep',hold:false,frame:{x:0,z:0,yaw:.6},mirror,u,progress:0,intensity:0,stamina:1,exertion:0};
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(u<.35||u>.54)continue;
  const contacts=sampleMove('footSweep','B',u,mirror,createLocal());
  if(!contacts.length)throw Error('Foot sweep defender has no hand-fighting contact');
  for(const c of contacts) {
   const target=new Vector3(...c.at).multiplyScalar(a.scale).applyMatrix4(a.bones[c.on].matrixWorld);
   const gap=b.bones[`hand${c.hand}`].getWorldPosition(new Vector3()).distanceTo(target);
   if(gap>worst){worst=gap;context=`scales=${scales} mirror=${mirror} hz=${hz} duration=${duration} u=${u}`;}
  }
 }
}
console.log(`Sweep defensive wrist-control gap ${worst.toFixed(4)}m (${context})`);
if(worst>.03)throw Error('Defender cannot reach the collar-control wrist during foot sweep');
