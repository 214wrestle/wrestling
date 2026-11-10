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




// Full-history successful turn, pin and recovery, including the settling flat hold.
// Conservative centerline/core audit. This is not a skinned-mesh collision test.
let minimumCoreDistance=Infinity,context='';
let segment:number[][]=[];
let maxHandSpeed=0,handSpeedContext='';
const phaseMinimum:Record<string,number>={};
const phaseContext:Record<string,string>={};
for(const bar of ['armBar','wristBar','barHalf','doubleBar'])for(const mirror of [false,true])for(const topScale of [.9,1,1.15])for(const bottomScale of [.9,1,1.15])for(const hz of [30,60,120]){
 const scales=[topScale,bottomScale];
 const a=make(scales[0]),b=make(scales[1]);
 let previousHands:Vector3[]|undefined;
 for(let i=0;i<=7.05*hz;i++){
 const t=i/hz,clip=t<1?'flat':t<3.2?bar+'Turn':t<5.2?bar+'Pin':t<6.05?bar+'Exit':'flat';
 const hold=clip==='flat'||clip===bar+'Pin';
 const u=clip===bar+'Turn'?(t-1)/2.2:clip===bar+'Exit'?(t-5.2)/.85:0;
 const v={mode:'paired' as const,clip,hold,frame:{x:0,z:0,yaw:0},mirror,u,progress:clip===bar+'Pin'?(t-3.2)/2:0,intensity:0,stamina:1,exertion:0};
 a.anim.instant=b.anim.instant=i===0;
 a.anim.update(1/hz,{...v,role:'A'},b.anim);b.anim.update(1/hz,{...v,role:'B'},a.anim);
 a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
 const hands=(['handL','handR'] as const).map(name=>a.anim.bonePos(name,new Vector3()));
 if(previousHands&&t>=1)hands.forEach((p,index)=>{const speed=p.distanceTo(previousHands![index])*hz/topScale;if(speed>maxHandSpeed){maxHandSpeed=speed;handSpeedContext=`${clip} mirror=${mirror} scales=${scales} hz=${hz} t=${t} hand=${index}`;}});
 previousHands=hands;
 if(t<1)continue;
 b.bones.chest.updateWorldMatrix(true,false);
 const inv=b.bones.chest.matrixWorld.clone().invert();
 for(const side of ['L','R'] as const)for(const [start,end] of [[`arm${side}`,`forearm${side}`],[`forearm${side}`,`hand${side}`]] as const){
 const p=a.anim.bonePos(start,new Vector3()),q=a.anim.bonePos(end,new Vector3());
 for(let j=1;j<20;j++){
 const point=p.clone().lerp(q,j/20).applyMatrix4(inv).divideScalar(b.scale);
 const d=Math.sqrt((point.x/.148)**2+((point.y-.020)/.155)**2+((point.z+.002)/.108)**2);
 const phase=clip==='flat'?bar+'/settled':clip;
 if(d<(phaseMinimum[phase]??Infinity))phaseContext[phase]=`${start}-${end} mirror=${mirror} scales=${scales} hz=${hz} t=${t} u=${v.u} along=${j/20}`;
 phaseMinimum[phase]=Math.min(phaseMinimum[phase]??Infinity,d);
 if(d<minimumCoreDistance){minimumCoreDistance=d;segment=[a.anim.bonePos(`arm${side}`,new Vector3()).applyMatrix4(inv).divideScalar(b.scale).toArray(),p.clone().applyMatrix4(inv).divideScalar(b.scale).toArray(),q.clone().applyMatrix4(inv).divideScalar(b.scale).toArray()];context=`${clip} ${start}-${end} mirror=${mirror} scales=${scales} hz=${hz} u=${v.u} along=${j/20}`;}
 }
 }
 }
}
console.log({phaseMinimum,phaseContext,minimumCoreDistance,context,segment,coreIntersection:minimumCoreDistance<1,maxHandSpeed,handSpeedContext});

// Wrist-bar and double-bar gate regressions; single/half remain diagnostic.
for(const [phase,minimum] of Object.entries(phaseMinimum)){
 if((phase.startsWith('wristBar')||phase.startsWith('doubleBar'))&&minimum<1)throw Error(phase+' enters chest core');
}
