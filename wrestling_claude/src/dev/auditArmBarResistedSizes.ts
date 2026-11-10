import {Bone,Group,Vector3,Quaternion,Euler} from 'three';
import {P} from '../anim/posture';
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


let maxPostDrift=0,minPalmY=Infinity,maxPalmY=-Infinity;
let maxLowestFoot=0,maxFootLift=0,worstSupport={};
let maxPressureDrift=0,driftContext={};
let maxFootSpeed=0;
let minHeadGap=Infinity,headContext={};
let maxPressureReachOverrun=0,maxPressureTargetError=0;
for(const bar of ['armBar','wristBar','barHalf','doubleBar'])for(const topScale of [.9,1,1.15])for(const mirror of [false,true])for(const scale of [.9,1,1.15])for(const hz of [30,60,120]){
 const a=make(topScale),b=make(scale),hand=mirror?'handL':'handR';
 let start:Vector3|undefined;
 let pressureFeet:Vector3[]|undefined,previousFeet:Vector3[]|undefined;
 for(let i=0;i<=3.5*hz;i++){
  const t=i/hz,hold=t<1||t>=2.5,u=hold?0:Math.max(0,(t-1)/1.5);
  const v={mode:'paired' as const,clip:hold?'flat':bar+'Resisted',hold,frame:{x:0,z:0,yaw:.7},mirror,u,progress:0,intensity:0,stamina:1,exertion:0};
  a.anim.instant=b.anim.instant=i===0;
  a.anim.update(1/hz,{...v,role:'A'},b.anim);b.anim.update(1/hz,{...v,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(!hold&&u>=(bar==='wristBar'?.49:.36)&&u<=(bar==='wristBar'?.67:.54)){
   const points=['toeL','toeR'].map(name=>a.anim.bonePos(name as BoneName,new Vector3()));
   if(!pressureFeet)pressureFeet=points.map(p=>p.clone());
   const displayed=(a.anim as unknown as {display:Float32Array}).display;
   for(const [side,at] of [['L',P.FOOT_L],['R',P.FOOT_R]] as const){
    const target=new Vector3().fromArray(displayed,at);
    const q=new Quaternion().setFromEuler(new Euler(displayed[at+4],displayed[at+3],displayed[at+5],'YXZ'));
    const ankle=target.clone().sub(new Vector3(0,-.05,.135).multiplyScalar(topScale).applyQuaternion(q));
    const hip=a.anim.bonePos(`thigh${side}`,new Vector3());
    const lengths=a.anim.solver.limbLengths;
    maxPressureReachOverrun=Math.max(maxPressureReachOverrun,(hip.distanceTo(ankle)-lengths.thigh-lengths.shin)/topScale);
    maxPressureTargetError=Math.max(maxPressureTargetError,target.distanceTo(a.anim.bonePos(`toe${side}`,new Vector3()))/topScale);
   }
   points.forEach((p,i)=>{const d=Math.hypot(p.x-pressureFeet![i].x,p.z-pressureFeet![i].z)/topScale;if(d>maxPressureDrift){maxPressureDrift=d;driftContext={bar,topScale,scale,hz,mirror,u,i};}});
  }
  if(t>=1&&t<2.5){
   const gap=a.anim.bonePos('head',new Vector3()).distanceTo(b.anim.bonePos('head',new Vector3()))/((topScale+scale)/2);
   if(gap<minHeadGap){minHeadGap=gap;headContext={bar,topScale,scale,hz,mirror,u};}
  }
  const currentFeet=['toeL','toeR'].map(name=>a.anim.bonePos(name as BoneName,new Vector3()));
  if(previousFeet&&t>=1&&t<2.5)currentFeet.forEach((p,i)=>maxFootSpeed=Math.max(maxFootSpeed,p.distanceTo(previousFeet![i])*hz/topScale));
  previousFeet=currentFeet;
  const feet=['toeL','toeR'].map(name=>a.anim.bonePos(name as BoneName,new Vector3()).y/topScale);
  if(t>=1&&t<2.5){if(Math.min(...feet)>maxLowestFoot){maxLowestFoot=Math.min(...feet);worstSupport={bar,topScale,scale,hz,mirror,u};}maxFootLift=Math.max(maxFootLift,...feet);}
  const p=b.anim.bonePos(hand,new Vector3());
  if(i===hz)start=p.clone();
  if(start&&bar==='armBar'){maxPostDrift=Math.max(maxPostDrift,Math.hypot(p.x-start.x,p.z-start.z)/scale);minPalmY=Math.min(minPalmY,p.y/scale);maxPalmY=Math.max(maxPalmY,p.y/scale);}
 }
}
console.log({maxPostDrift,minPalmY,maxPalmY,maxLowestFoot,maxFootLift,worstSupport,maxPressureDrift,driftContext,maxPressureReachOverrun,maxPressureTargetError,maxFootSpeed,minHeadGap,headContext,measurement:'rendered wrist supporting the palm; toe bone heights'});
if(maxPostDrift>.015)throw Error('Free post slides during resisted single arm bar');
if(minPalmY<.025||maxPalmY>.09)throw Error('Supporting wrist leaves mat support height');

if(maxLowestFoot>.045)throw Error('Rider loses both foot supports during failed bar');
if(maxFootLift<.06)throw Error('Rider slides feet instead of stepping during failed bar');
if(maxPressureReachOverrun>.001)throw Error('Bar pressure exceeds available leg reach');
if(maxPressureTargetError>.002)throw Error('Bar pressure foot misses its solved target');
if(maxPressureDrift>.002)throw Error('Landed feet slide during bar pressure');
if(maxFootSpeed>3.5)throw Error('Bar foot landing or recovery snaps');
