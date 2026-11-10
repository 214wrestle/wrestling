import {LEG_CLEAR_THRESHOLD} from '../sim/legRideQuality';
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

let catchGap=0,returnGap=0,proneHip=0,kneeMinimum=Infinity;
let hookKneeAngle=180;
let bootThighGap=Infinity,bootThighContext='';
let worstGap=0,peakSpeed=0,limbSpeed=0,limbContext='',context='',gapContext='';
for(const release of ['retained','gradual','success'] as const)for(const flat of [false,true])for(const pressure of (flat?[0,.5,1]:[1]))for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]])for(const hz of [30,60,120]) {
 const a=make(scales[0]),b=make(scales[1]);
 a.anim.instant=false;b.anim.instant=false;
 const previous=new Map<string,Vector3>();
 let previousClip='';
 const established=new Map<string,{anchor:string,since:number}>();
 for(let i=0;i<hz*4;i++){
  const time=i/hz;
  const cleared=release!=='retained';
  // bout.ts clears legRide and legCaught immediately at .75, not after a fade.
  const clearedNow=release==='success'&&time>=.6+LEG_CLEAR_THRESHOLD*.7;
  const caught=clearedNow?0:Math.max(0,Math.min(1,time<1.7?(time-.6)/.7:1-(time-1.7)/.7));
  const closing=caught>.05; // Same selection threshold as wrestlerViews.
  const clip=closing?(flat?'catchRidingLegFlat':'catchRidingLeg'):(flat?(cleared&&(clearedNow||time>1.7)?'flat':'legRidePressure'):cleared&&(clearedNow||time>2.4)?'ride':'legRide');
  if(clip!==previousClip)established.clear(); // Regrip starts again when the boot is cleared.
  previousClip=clip;
  const progress=clip==='flat'||clip==='ride'?0:closing?Math.min(1,caught/LEG_CLEAR_THRESHOLD):clip==='legRidePressure'?pressure:1;
  const base={mode:'paired' as const,clip,hold:true,frame:{x:0,z:0,yaw:.6},mirror,u:0,progress,intensity:.3,stamina:1,exertion:0};
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(release==='success'&&time>=1.125&&time<=1.925){
   const boot=a.anim.bonePos(mirror?'toeR':'toeL',new Vector3());
   for(const side of ['L','R'] as const){
    const hip=b.anim.bonePos(`thigh${side}`,new Vector3()),knee=b.anim.bonePos(`shin${side}`,new Vector3());
    const line=knee.clone().sub(hip),t=Math.max(0,Math.min(1,boot.clone().sub(hip).dot(line)/line.lengthSq()));
    const gap=boot.distanceTo(hip.addScaledVector(line,t));
    if(gap<bootThighGap){bootThighGap=gap;bootThighContext=`${clip} thigh${side} t=${time} hz=${hz} scales=${scales} mirror=${mirror}`;}
   }
  }
  if(flat&&closing){
   const side=mirror?'R':'L',hip=a.anim.bonePos(`thigh${side}`,new Vector3()),knee=a.anim.bonePos(`shin${side}`,new Vector3()),ankle=a.anim.bonePos(`foot${side}`,new Vector3());
   hookKneeAngle=Math.min(hookKneeAngle,hip.sub(knee).angleTo(ankle.sub(knee))*180/Math.PI);
  }
  if(time<.6)continue;
  if(flat){
   proneHip=Math.max(proneHip,b.anim.bonePos('hips',new Vector3()).y/b.scale);
   for(const own of [a,b])for(const name of ['shinL','shinR'] as const)kneeMinimum=Math.min(kneeMinimum,own.anim.bonePos(name,new Vector3()).y/own.scale);
  }
  for(const [role,own,opp] of [['A',a,b],['B',b,a]] as const){
   for(const hand of ['L','R'] as const){
    const point=own.anim.bonePos(`hand${hand}`,new Vector3()),key=role+hand;
    const before=previous.get(key);if(before){const speed=point.distanceTo(before)*hz;if(speed>peakSpeed){peakSpeed=speed;context=`${release} ${flat?"flat":"ride"} ${role}${hand} time=${time} hz=${hz} scales=${scales} mirror=${mirror}`;}}
    previous.set(key,point);
   }
   for(const bone of ['shinL','shinR','toeL','toeR'] as const){
    const point=own.anim.bonePos(bone,new Vector3()),key=role+bone,before=previous.get(key);
    if(before){const speed=point.distanceTo(before)*hz;if(speed>limbSpeed){limbSpeed=speed;limbContext=`${release} ${clip} ${role}${bone} t=${time} hz=${hz} mirror=${mirror}`;}}
    previous.set(key,point);
   }
   const contacts=sampleHold(clip,role,progress,time,.3,mirror,createLocal());
   for(const hand of ['L','R'])if(!contacts.some(c=>c.hand===hand))established.delete(role+hand);
   for(const contact of contacts){
    const key=role+contact.hand,anchor=contact.on+contact.at.join(',');
    const prior=established.get(key);
    if(contact.weight<.99){established.delete(key);continue;}
    if(!prior||prior.anchor!==anchor){established.set(key,{anchor,since:time});continue;}
    if(time-prior.since<(clip==='flat'||clip==='ride'?.65:.4))continue; // Cleared-leg regrip is authored over .55s, then settles.
    const bone=opp.bones[contact.on];bone.updateWorldMatrix(true,false);
    const target=new Vector3(...contact.at).multiplyScalar(opp.scale).applyMatrix4(bone.matrixWorld);
    const gap=own.anim.bonePos(`hand${contact.hand}`,new Vector3()).distanceTo(target);
    if(closing)catchGap=Math.max(catchGap,gap);else returnGap=Math.max(returnGap,gap);
    if(gap>worstGap){worstGap=gap;gapContext=`${role}${contact.hand} t=${time} hz=${hz} scales=${scales} clip=${clip}`;}
   }
  }
 }
}
console.log(JSON.stringify({hookKneeAngle,bootThighGap,bootThighContext,limbSpeed,limbContext,proneHip,kneeMinimum,worstGap,catchGap,returnGap,gapContext,peakSpeed,context},null,2));
if(catchGap>.02)throw Error('Established leg catch loses grip');
if(returnGap>.02)throw Error('Return to ride loses its established grip');

if(hookKneeAngle<30)throw Error('Hooked knee folds beyond 150 degrees');
if(limbSpeed>4)throw Error('Leg-catch transition introduced a knee or boot speed spike');
if(peakSpeed>3)throw Error('Leg-catch transition introduced a wrist-speed spike');

if(proneHip>.36)throw Error('Flat catch lifts bottom above the low supported base');
if(kneeMinimum<.025)throw Error('Flat catch transition knee penetrates mat');
