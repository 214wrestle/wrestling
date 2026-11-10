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





// Compare the authored and contact-adjusted arms in the defender's chest frame.
// Diagnostic only: the ellipsoid is a conservative core, not a skin mesh.
const results:unknown[]=[];
function core(v:Vector3){return Math.sqrt((v.x/.148)**2+((v.y-.020)/.155)**2+((v.z+.002)/.108)**2);}
for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]])for(const hz of [30,60,120]){
 const a=make(scales[0]),b=make(scales[1]);let first:unknown=null,worst:unknown=null,minimum=Infinity;
 for(let i=0;i<=6.05*hz;i++){
  const t=i/hz,clip=t<1?'flat':t<3.2?'doubleBarTurn':t<5.2?'doubleBarPin':'doubleBarExit';
  const u=clip==='doubleBarTurn'?(t-1)/2.2:clip==='doubleBarExit'?(t-5.2)/.85:0;
  const v={mode:'paired' as const,clip,hold:clip==='flat'||clip==='doubleBarPin',frame:{x:0,z:0,yaw:0},mirror,u,progress:clip==='doubleBarPin'?(t-3.2)/2:0,intensity:0,stamina:1,exertion:0};
  a.anim.instant=b.anim.instant=i===0;
  a.anim.update(1/hz,{...v,role:'A'},b.anim);b.anim.update(1/hz,{...v,role:'B'},a.anim);
  const before=(['L','R'] as const).map(side=>a.anim.bonePos(`hand${side}`,new Vector3()));
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(clip!=='doubleBarExit')continue;
  b.bones.chest.updateWorldMatrix(true,false);const inv=b.bones.chest.matrixWorld.clone().invert();
  for(const [index,side] of (['L','R'] as const).entries()){
   const points=([`arm${side}`,`forearm${side}`,`hand${side}`] as BoneName[]).map(name=>a.anim.bonePos(name,new Vector3()).applyMatrix4(inv).divideScalar(b.scale));
   let distance=Infinity,segment='',along=0;
   for(let k=0;k<2;k++)for(let j=1;j<40;j++){
    const d=core(points[k].clone().lerp(points[k+1],j/40));
    if(d<distance){distance=d;segment=k?'forearm':'upperArm';along=j/40;}
   }
   const authored=before[index].applyMatrix4(inv).divideScalar(b.scale);
   const sample={t,u,side,distance,segment,along,shoulder:points[0].toArray(),elbow:points[1].toArray(),wrist:points[2].toArray(),endpointCore:points.map(core),authoredWrist:authored.toArray(),authoredWristCore:core(authored)};
   if(distance<1&&!first)first=sample;
   if(distance<minimum){minimum=distance;worst=sample;}
  }
 }
 results.push({mirror,scales,hz,minimum,first,worst});
}
console.log(JSON.stringify({note:'Full-history release; coordinates normalized in defender chest frame.',results},null,2));
