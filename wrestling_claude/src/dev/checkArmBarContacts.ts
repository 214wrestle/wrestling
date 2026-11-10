import {palmSurface} from '../anim/gableGrip';
import {P} from '../anim/posture';
import {applyArmBarTurnSteps} from '../anim/armBarEffort';
import {Bone,Group,Vector3} from 'three';
import {BONES,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import {sampleHold,sampleMove} from '../anim/clips';
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

function gripPoint(own:ReturnType<typeof make>,c:{hand:'L'|'R';backClasp?:boolean}){
 const bone=own.bones[`hand${c.hand}`];bone.updateWorldMatrix(true,false);
 return c.backClasp?palmSurface(c.hand,own.scale).applyMatrix4(bone.matrixWorld):own.anim.bonePos(`hand${c.hand}`,new Vector3());
}
let maxGap=0,context='';
for(const id of ['armBar','wristBar','barHalf','doubleBar'])for(const suffix of ['Control','Pin'])for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]])for(const progress of [0,.5,1]){
 const a=make(scales[0]),b=make(scales[1]),clip=id+suffix;
 const view={mode:'paired' as const,clip,hold:true,frame:{x:1,z:1,yaw:.7},mirror,u:0,progress,intensity:0,stamina:1,exertion:0};
 for(let i=0;i<120;i++){
  a.anim.update(1/60,{...view,role:'A'},b.anim);b.anim.update(1/60,{...view,role:'B'},a.anim);
  a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
 }
 for(const contact of sampleHold(clip,'A',progress,0,0,mirror,createLocal())){
  const bone=b.bones[contact.on];bone.updateWorldMatrix(true,false);
  const target=new Vector3(...contact.at).multiplyScalar(b.scale).applyMatrix4(bone.matrixWorld);
  const gap=gripPoint(a,contact).distanceTo(target);
  if(gap>maxGap){maxGap=gap;context=`${clip} ${contact.hand} ${scales} mirror=${mirror} progress=${progress}`;}
 }
}
console.log({maxGap,context});
if(maxGap>.02)throw Error('Arm-bar draft loses secured hand contact');

let movingGap=0,movingContext='',peakWrist=0,speedContext='',minKnee=Infinity,kneeContext='';
for(const id of ['armBar','wristBar','barHalf','doubleBar'])for(const phase of ['Turn','Resisted','Exit','Fall'])for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]])for(const hz of [30,60,120])for(const pinProgress of [0,1]){
 const resisted=phase==='Resisted',exit=phase==='Exit',pinStart=exit||phase==='Fall';
 const a=make(scales[0]),b=make(scales[1]),dt=1/hz,duration=resisted?1.5:exit?.85:2.2;
 for(let warm=0;warm<hz;warm++){
  const v={mode:'paired' as const,clip:pinStart?id+'Pin':'flat',hold:true,frame:{x:0,z:0,yaw:.7},mirror,u:0,progress:pinStart?pinProgress:0,intensity:0,stamina:1,exertion:0};
  a.anim.update(dt,{...v,role:'A'},b.anim);b.anim.update(dt,{...v,role:'B'},a.anim);a.anim.applyContacts(dt,b.anim);b.anim.applyContacts(dt,a.anim);
 }
 const previous=new Map<string,Vector3>();
 for(let i=0;i<(duration+1)*hz;i++){
  const time=i/hz,hold=time>=duration,clip=hold?(resisted||exit?'flat':id+'Pin'):id+phase;
  const view={mode:'paired' as const,clip,hold,frame:{x:0,z:0,yaw:.7},mirror,u:Math.min(1,time/duration),progress:hold?pinProgress:0,intensity:0,stamina:1,exertion:0};
  a.anim.instant=b.anim.instant=false;
  a.anim.update(dt,{...view,role:'A'},b.anim);b.anim.update(dt,{...view,role:'B'},a.anim);
  a.anim.applyContacts(dt,b.anim);b.anim.applyContacts(dt,a.anim);
  for(const [role,own] of [['A',a],['B',b]] as const){
   for(const hand of ['L','R'] as const){
    const point=own.anim.bonePos(`hand${hand}`,new Vector3()),key=role+hand,prior=previous.get(key);
    if(prior&&i>1){const speed=point.distanceTo(prior)*hz;if(speed>peakWrist){peakWrist=speed;speedContext=`${clip} ${key} time=${time} hz=${hz} scales=${scales}`;}}
    previous.set(key,point);
   }
   for(const side of ['L','R'] as const){const y=own.anim.bonePos(`shin${side}`,new Vector3()).y/own.scale;if(y<minKnee){minKnee=y;kneeContext=`${clip} ${role}${side} time=${time} hz=${hz}`;}}
  }
  const contacts=hold?sampleHold(clip,'A',view.progress,time,0,mirror,createLocal()):sampleMove(clip,'A',view.u,mirror,createLocal());
  if(time<(id==='wristBar'?.55:.8)||hold&&time<duration+.4)continue;
  for(const c of contacts){
   if(c.weight<.99)continue;
   const bone=b.bones[c.on];bone.updateWorldMatrix(true,false);
   const gap=gripPoint(a,c).distanceTo(new Vector3(...c.at).multiplyScalar(b.scale).applyMatrix4(bone.matrixWorld));
   if(gap>movingGap){movingGap=gap;movingContext=`${clip} ${c.hand} time=${time} hz=${hz} scales=${scales}`;}
  }
 }
}
console.log({movingGap,movingContext,peakWrist,speedContext,minKnee,kneeContext});
if(movingGap>.02)throw Error('Moving arm bar loses secured grip');
if(peakWrist>4)throw Error('Arm-bar transition wrist spike');
if(minKnee<.025)throw Error('Arm-bar knee crosses mat');

// Live squeeze/bridge/turn-in pulses must retain grips across body sizes and sides.
let effortGap=0,effortKnee=Infinity;
for(const id of ['armBar','wristBar','barHalf','doubleBar'])for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]])for(const hz of [30,60,120])for(const attacker of [true,false])for(const button of ['shoot','fight']){
 const a=make(scales[0]),b=make(scales[1]),dt=1/hz,clip=id+'Pin';
 const v={mode:'paired' as const,clip,hold:true,frame:{x:0,z:0,yaw:.7},mirror,u:0,progress:.3,intensity:0,stamina:1,exertion:0,resistance:.6};
 for(let i=0;i<2*hz;i++){
  if(i===hz){a.anim.instant=b.anim.instant=false;a.anim.effort(button,!attacker,'ok');b.anim.effort(button,attacker,'ok');}
  a.anim.update(dt,{...v,role:'A'},b.anim);b.anim.update(dt,{...v,role:'B'},a.anim);
  a.anim.applyContacts(dt,b.anim);b.anim.applyContacts(dt,a.anim);
  if(i<hz)continue;
  for(const c of sampleHold(clip,'A',.3,0,0,mirror,createLocal())){
   const bone=b.bones[c.on];bone.updateWorldMatrix(true,false);
   const gap=gripPoint(a,c).distanceTo(new Vector3(...c.at).multiplyScalar(b.scale).applyMatrix4(bone.matrixWorld));
   effortGap=Math.max(effortGap,gap);
  }
  for(const own of [a,b])for(const side of ['L','R'])effortKnee=Math.min(effortKnee,own.anim.bonePos(`shin${side}` as BoneName,new Vector3()).y/own.scale);
 }
}
console.log({effortGap,effortKnee});
if(effortGap>.02||effortKnee<.025)throw Error('Arm-bar effort loses grip or grounded support');

// Throughout escape recovery, one foot must support the top wrestler
// while the other travels. Check both mirrored sides independently of IK.
let recoverySamples=0;
for(const id of ['armBar','wristBar','barHalf','doubleBar'])for(const mirror of [false,true]){
 for(const [from,to,left] of [[0,.25,true],[.25,.5,false],[.5,.75,true],[.75,1,false]] as const){
  const foot=(left!==mirror)?P.FOOT_L:P.FOOT_R;
  const start=createLocal();sampleMove(id+'Exit','A',from,mirror,start);
  for(let i=0;i<=20;i++){
   const u=from+(to-from)*i/20,p=createLocal();sampleMove(id+'Exit','A',u,mirror,p);
   applyArmBarTurnSteps(p,id+'Exit',u,mirror);
   const drift=Math.hypot(p[foot]-start[foot],p[foot+1]-start[foot+1],p[foot+2]-start[foot+2]);
   if(drift>.001)throw new Error(`${id} exit support drift ${drift} at ${u}, mirror=${mirror}`);
   recoverySamples++;
  }
 }
}
console.log({recoverySamples,plantedSupport:'passed'});

let turnSupportSamples=0;
for(const id of ['armBar','wristBar','barHalf','doubleBar'])for(const mirror of [false,true]){
 for(const [from,to,left] of (id==='armBar'?[[.28,.6,false],[.6,.78,true],[.78,1,true]] as const:[[.28,.6,false],[.6,.78,true],[.78,1,true],[.78,1,false]] as const)){
  const foot=left!==mirror?P.FOOT_L:P.FOOT_R;
  const start=createLocal();sampleMove(id+'Turn','A',from,mirror,start);
  applyArmBarTurnSteps(start,id+'Turn',from,mirror);
  for(let i=0;i<=20;i++){
   const u=from+(to-from)*i/20,p=createLocal();sampleMove(id+'Turn','A',u,mirror,p);
   applyArmBarTurnSteps(p,id+'Turn',u,mirror);
   const drift=Math.hypot(p[foot]-start[foot],p[foot+1]-start[foot+1],p[foot+2]-start[foot+2]);
   if(drift>.001)throw Error(`${id} turn support drift ${drift} at ${u}`);
   turnSupportSamples++;
  }
 }
}
console.log({turnSupportSamples,turnSupport:'passed'});
