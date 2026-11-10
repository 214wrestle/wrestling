import {Bone,Group,Vector3,Quaternion} from 'three';
import {BONES,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import {sampleHold, sampleMove} from '../anim/clips';
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
for(const scales of [[1,1],[.9,1.15],[1.15,.9]]) for(const mirror of [false,true]) for(const hz of [30,60,120]) {
 const a=make(scales[0]),b=make(scales[1]);
 for(let i=0;i<=hz*3;i++) {
  const progress=Math.min(1,i/hz/2),base={mode:'paired' as const,clip:'spladleSetup',hold:true,frame:{x:0,z:0,yaw:.6},mirror,u:0,progress,intensity:0,stamina:1,exertion:0};
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(i<hz)continue;
  const contacts=sampleHold('spladleSetup','B',progress,0,0,mirror,createLocal());
  for(const c of contacts) {
   const target=new Vector3(...c.at).multiplyScalar(a.scale).applyMatrix4(a.bones[c.on].matrixWorld);
   const gap=b.bones[`hand${c.hand}`].getWorldPosition(new Vector3()).distanceTo(target);
   if(gap>worst){worst=gap;context=`scales=${scales} mirror=${mirror} hz=${hz} progress=${progress} hand=${c.hand} on=${c.on}`;}
  }
 }
}
console.log(`Spladle capture hand gap ${worst.toFixed(4)}m (${context})`);
if(worst>.035)throw Error('Spladle setup cannot reach captured arm/leg');

let rollWorst=0,rollContext='',handoffWorst=0;
for(const scales of [[1,1],[.9,1.15],[1.15,.9]]) for(const mirror of [false,true]) for(const hz of [30,60,120]) for(const duration of [1.2,1.6,2]) {
 const a=make(scales[0]),b=make(scales[1]);
 for(let i=0;i<hz;i++) {
  const held={mode:'paired' as const,clip:'spladleSetup',hold:true,frame:{x:0,z:0,yaw:.6},mirror,u:0,progress:1,intensity:0,stamina:1,exertion:0};
  a.anim.update(1/hz,{...held,role:'A'},b.anim);b.anim.update(1/hz,{...held,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
 }
 for(let i=0;i<=duration*hz;i++) {
  const u=i/(duration*hz),base={mode:'paired' as const,clip:'spladleCounter',hold:false,frame:{x:0,z:0,yaw:.6},mirror,u,progress:0,intensity:0,stamina:1,exertion:0};
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  const contacts=sampleMove('spladleCounter','B',u,mirror,createLocal());
  if(!contacts.length)throw Error('Spladle roll loses all captured-leg contacts');
  for(const c of contacts) {
   if(c.weight<1 || (c.hand===(mirror?'R':'L') && u>.12 && u<.73))continue;
   const target=new Vector3(...c.at).multiplyScalar(a.scale).applyMatrix4(a.bones[c.on].matrixWorld);
   const gap=b.bones[`hand${c.hand}`].getWorldPosition(new Vector3()).distanceTo(target);
   if(gap>rollWorst){rollWorst=gap;rollContext=`scales=${scales} mirror=${mirror} hz=${hz} duration=${duration} u=${u} hand=${c.hand}`;}
  }
 }
 const retained=mirror?'L':'R';
 const before=b.bones[`hand${retained}`].getWorldPosition(new Vector3());
 const lock={mode:'paired' as const,clip:'spladle',hold:true,frame:{x:0,z:0,yaw:.6},mirror,u:0,progress:0,intensity:0,stamina:1,exertion:0};
 a.anim.update(1/hz,{...lock,role:'B'},b.anim);b.anim.update(1/hz,{...lock,role:'A'},a.anim);
 a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
 handoffWorst=Math.max(handoffWorst,b.bones[`hand${retained}`].getWorldPosition(new Vector3()).distanceTo(before));
}
console.log(`Spladle roll captured-arm/leg gap ${rollWorst.toFixed(4)}m (${rollContext})`);
if(rollWorst>.035)throw Error('Spladle roll loses retained leg');

console.log(`Roll-to-lock retained-hand displacement ${handoffWorst.toFixed(4)}m`);
if(handoffWorst>.04)throw Error('Role change jumps the retained leg grip');

// The exposed wrestler must actually face upward near the mat; an axial
// twist can otherwise cancel the fold while all hand-contact checks pass.
let shoulderMin=Infinity,shoulderMax=-Infinity,headMin=Infinity,frontMin=1,headContext='';
for(const scales of [[1,1],[.9,1.15],[1.15,.9]])for(const mirror of [false,true])for(const progress of [0,1])for(const hz of [30,60,120]) {
 const a=make(scales[0]),b=make(scales[1]);
 for(let i=0;i<hz*2;i++){
  const base={mode:'paired' as const,clip:'spladle',hold:true,frame:{x:0,z:0,yaw:.6},mirror,u:0,progress,intensity:1,stamina:1,exertion:0};
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(i<hz)continue;
  for(const hand of ['L','R']as const){
   const y=b.bones[`arm${hand}`].getWorldPosition(new Vector3()).y/b.scale;
   shoulderMin=Math.min(shoulderMin,y);shoulderMax=Math.max(shoulderMax,y);
  }
  const headY=b.bones.head.getWorldPosition(new Vector3()).y/b.scale;
  if(headY<headMin){headMin=headY;headContext=`scales=${scales} progress=${progress} mirror=${mirror} hz=${hz}`;}
  frontMin=Math.min(frontMin,new Vector3(0,0,1).applyQuaternion(b.bones.chest.getWorldQuaternion(new Quaternion())).y);
 }
}
console.log(`Spladle normalized shoulder joints ${shoulderMin.toFixed(3)}–${shoulderMax.toFixed(3)}m, head joint min${headMin.toFixed(3)}m (${headContext}), chest front Y min${frontMin.toFixed(3)}`);
if(shoulderMin<.045||shoulderMax>.18||headMin<.045||frontMin<.85)throw Error('Spladle back exposure/head clearance geometry regressed');
