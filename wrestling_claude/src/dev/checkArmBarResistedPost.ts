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


let maxPostDrift=0,minPalmY=Infinity,maxPalmY=-Infinity;
let maxLowestFoot=0,maxFootLift=0,worstSupport={};
for(const bar of ['armBar'])for(const topScale of [1])for(const mirror of [false,true])for(const scale of [.9,1,1.15])for(const hz of [30,60,120]){
 const a=make(topScale),b=make(scale),hand=mirror?'handL':'handR';
 let start:Vector3|undefined;
 for(let i=0;i<=3.5*hz;i++){
  const t=i/hz,hold=t<1||t>=2.5,u=hold?0:Math.max(0,(t-1)/1.5);
  const v={mode:'paired' as const,clip:hold?'flat':bar+'Resisted',hold,frame:{x:0,z:0,yaw:.7},mirror,u,progress:0,intensity:0,stamina:1,exertion:0};
  a.anim.instant=b.anim.instant=i===0;
  a.anim.update(1/hz,{...v,role:'A'},b.anim);b.anim.update(1/hz,{...v,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  const feet=['toeL','toeR'].map(name=>a.anim.bonePos(name as BoneName,new Vector3()).y/topScale);
  if(t>=1&&t<2.5){if(Math.min(...feet)>maxLowestFoot){maxLowestFoot=Math.min(...feet);worstSupport={bar,topScale,scale,hz,mirror,u};}maxFootLift=Math.max(maxFootLift,...feet);}
  const p=b.anim.bonePos(hand,new Vector3());
  if(i===hz)start=p.clone();
  if(start&&bar==='armBar'){maxPostDrift=Math.max(maxPostDrift,Math.hypot(p.x-start.x,p.z-start.z)/scale);minPalmY=Math.min(minPalmY,p.y/scale);maxPalmY=Math.max(maxPalmY,p.y/scale);}
 }
}
console.log({maxPostDrift,minPalmY,maxPalmY,maxLowestFoot,maxFootLift,worstSupport,measurement:'rendered wrist supporting the palm; toe bone heights'});
if(maxPostDrift>.015)throw Error('Free post slides during resisted single arm bar');
if(minPalmY<.025||maxPalmY>.09)throw Error('Supporting wrist leaves mat support height');

if(maxLowestFoot>.045)throw Error('Rider loses both foot supports during failed bar');
if(maxFootLift<.06)throw Error('Rider slides feet instead of stepping during failed bar');
