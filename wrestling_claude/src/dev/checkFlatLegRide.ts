import {Bone,Group,Vector3} from 'three';
import {BONES,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import '../anim/library';
import {sampleHold} from '../anim/clips';
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


let minimum=Infinity,entryHipMinimum=Infinity,pressureKnee=180;
for(const clip of ['legRideFlat','legRidePressure'])for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]])for(const progress of [0,.25,.5,.75,1]) {
 const a=make(scales[0]),b=make(scales[1]);
 const base={mode:'paired' as const,clip,hold:true,frame:{x:0,z:0,yaw:.6},mirror,u:0,progress,intensity:.5,stamina:1,exertion:0,pockets:.8};
 for(let i=0;i<30;i++){
  a.anim.update(1/60,{...base,role:'A'},b.anim);b.anim.update(1/60,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
  if(clip==='legRidePressure'){
   const side=mirror?'R':'L',hip=a.anim.bonePos(`thigh${side}`,new Vector3()),knee=a.anim.bonePos(`shin${side}`,new Vector3()),ankle=a.anim.bonePos(`foot${side}`,new Vector3());
   pressureKnee=Math.min(pressureKnee,hip.sub(knee).angleTo(ankle.sub(knee))*180/Math.PI);
  }
  if(clip==='legRideFlat'&&progress<=.5)entryHipMinimum=Math.min(entryHipMinimum,b.anim.bonePos('hips',new Vector3()).y/b.scale);
  for(const name of ['shinL','shinR'] as const){
   const height=a.anim.bonePos(name,new Vector3()).y/a.scale;
   minimum=Math.min(minimum,height);
   if(height<.025)throw Error(`Rider knee penetrates mat: ${name} ${height} progress=${progress} mirror=${mirror}`);
  }
 }
}
if(entryHipMinimum<.23)throw Error(`Leg entry lacks space beneath the bottom hips: ${entryHipMinimum}`);
console.log({entryHipMinimum,pressureKnee});
if(pressureKnee<30)throw Error('Pressure ride overfolds the knee');
console.log(`Flat leg-entry minimum rider knee center: ${minimum.toFixed(4)}m normalized`);

// A caught riding leg displaces both wrestlers while the free palm stays posted.
let postDrift=0;
for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]]) {
 const posts:Vector3[]=[],hipsA:Vector3[]=[],hipsB:Vector3[]=[];
 for(const progress of [0,.25,.5,.75,1]) {
  const a=make(scales[0]),b=make(scales[1]);
  const base={mode:'paired' as const,clip:'catchRidingLeg',hold:true,frame:{x:0,z:0,yaw:.6},mirror,u:0,progress,intensity:0,stamina:1,exertion:0};
  for(let i=0;i<30;i++){
   a.anim.update(1/60,{...base,role:'A'},b.anim);b.anim.update(1/60,{...base,role:'B'},a.anim);
   a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
  }
  posts.push(b.anim.bonePos(mirror?'handL':'handR',new Vector3()));
  hipsA.push(a.anim.bonePos('hips',new Vector3()));hipsB.push(b.anim.bonePos('hips',new Vector3()));
 }
 for(const post of posts)postDrift=Math.max(postDrift,post.distanceTo(posts[0]));
 if(hipsA[0].distanceTo(hipsA[4])<.08||hipsB[0].distanceTo(hipsB[4])<.08)throw Error('Leg catch lost paired weight shift');
}
if(postDrift>.02)throw Error(`Leg catch drags the free-hand post: ${postDrift}m`);
console.log(`Leg-catch free-hand maximum drift ${postDrift.toFixed(4)}m; both hips shift`);

// Low-base catch: the arm reaches the boot with clearance below the pelvis.
let proneGap=0,proneKnee=Infinity,proneHip=0;
for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]])for(const progress of [0,.25,.5,.75,1]){
 const a=make(scales[0]),b=make(scales[1]);
 const base={mode:'paired' as const,clip:'catchRidingLegFlat',hold:true,frame:{x:0,z:0,yaw:.6},mirror,u:0,progress,intensity:0,stamina:1,exertion:0};
 for(let i=0;i<30;i++){
  a.anim.update(1/60,{...base,role:'A'},b.anim);b.anim.update(1/60,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
 }
 proneHip=Math.max(proneHip,b.anim.bonePos('hips',new Vector3()).y/b.scale);
 for(const name of ['shinL','shinR'] as const)proneKnee=Math.min(proneKnee,a.anim.bonePos(name,new Vector3()).y/a.scale);
 if(progress>=.5)for(const c of sampleHold(base.clip,'B',progress,0,0,mirror,createLocal())){
  if(c.weight<.99)continue; // The hand is still reaching during acquisition.
  const bone=a.bones[c.on];bone.updateWorldMatrix(true,false);
  const target=new Vector3(...c.at).multiplyScalar(a.scale).applyMatrix4(bone.matrixWorld);
  proneGap=Math.max(proneGap,b.anim.bonePos(`hand${c.hand}`,new Vector3()).distanceTo(target));
 }
}
console.log({proneGap,proneKnee,proneHip});
if(proneGap>.025)throw Error('Prone defender cannot reach the caught leg');
if(proneKnee<.025)throw Error('Prone catch drives rider knee through mat');
if(proneHip>.36)throw Error('Prone catch lifts defender above the low supported base');
