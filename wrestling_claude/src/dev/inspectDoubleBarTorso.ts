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




// Conservative centerline/core audit. This is not a skinned-mesh collision test.
let minimumCoreDistance=Infinity,context='';
let segment:number[][]=[];
const phaseMinimum:Record<string,number>={};
for(const clip of ['doubleBarTurn','doubleBarPin','doubleBarFall'])for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]]){
 const a=make(scales[0]),b=make(scales[1]);
 for(let i=clip==='doubleBarTurn'?0:-120;i<=132;i++){
 const v={mode:'paired' as const,clip,hold:clip==='doubleBarPin',frame:{x:0,z:0,yaw:0},mirror,u:Math.max(0,Math.min(1,i/132)),progress:Math.max(0,Math.min(1,i/132)),intensity:0,stamina:1,exertion:0};
 a.anim.instant=b.anim.instant=false;
 a.anim.update(1/60,{...v,role:'A'},b.anim);b.anim.update(1/60,{...v,role:'B'},a.anim);
 a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
 if(i<0||(clip==='doubleBarTurn'&&i<40))continue;
 b.bones.chest.updateWorldMatrix(true,false);
 const inv=b.bones.chest.matrixWorld.clone().invert();
 for(const side of ['L','R'] as const)for(const [start,end] of [[`arm${side}`,`forearm${side}`],[`forearm${side}`,`hand${side}`]] as const){
 const p=a.anim.bonePos(start,new Vector3()),q=a.anim.bonePos(end,new Vector3());
 for(let j=1;j<20;j++){
 const point=p.clone().lerp(q,j/20).applyMatrix4(inv).divideScalar(b.scale);
 const d=Math.sqrt((point.x/.148)**2+((point.y-.020)/.155)**2+((point.z+.002)/.108)**2);
 phaseMinimum[clip]=Math.min(phaseMinimum[clip]??Infinity,d);
 if(d<minimumCoreDistance){minimumCoreDistance=d;segment=[a.anim.bonePos(`arm${side}`,new Vector3()).applyMatrix4(inv).divideScalar(b.scale).toArray(),p.clone().applyMatrix4(inv).divideScalar(b.scale).toArray(),q.clone().applyMatrix4(inv).divideScalar(b.scale).toArray()];context=`${clip} ${start}-${end} mirror=${mirror} scales=${scales} u=${v.u} along=${j/20}`;}
 }
 }
 }
}
console.log({phaseMinimum,minimumCoreDistance,context,segment,coreIntersection:minimumCoreDistance<1});
