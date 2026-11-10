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




// Diagnostic: can a different bend plane clear the chest with the same endpoints?
// Samples the geometric two-bone elbow circle, not shoulder mobility or skin.
let collisions=0,clearable=0,blocked=0,wristInside=0,shoulderInside=0,worstBest=Infinity,worst:unknown;
const counts:Record<string,{collisions:number;clearable:number;blocked:number}>={};
function clearance(p:Vector3,e:Vector3,q:Vector3,inv:import('three').Matrix4,scale:number){
 let minimum=Infinity;
 for(const [a,b] of [[p,e],[e,q]])for(let j=1;j<20;j++){
  const v=a.clone().lerp(b,j/20).applyMatrix4(inv).divideScalar(scale);
  minimum=Math.min(minimum,Math.sqrt((v.x/.148)**2+((v.y-.020)/.155)**2+((v.z+.002)/.108)**2));
 }
 return minimum;
}
for(const bar of ['armBar','wristBar','barHalf','doubleBar'])for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]]){
 const a=make(scales[0]),b=make(scales[1]);
 for(let i=0;i<=423;i++){
  const t=i/60,clip=t<1?'flat':t<3.2?bar+'Turn':t<5.2?bar+'Pin':t<6.05?bar+'Exit':'flat';
  const hold=clip==='flat'||clip===bar+'Pin',u=clip===bar+'Turn'?(t-1)/2.2:clip===bar+'Exit'?(t-5.2)/.85:0;
  const v={mode:'paired' as const,clip,hold,frame:{x:0,z:0,yaw:0},mirror,u,progress:clip===bar+'Pin'?(t-3.2)/2:0,intensity:0,stamina:1,exertion:0};
  a.anim.instant=b.anim.instant=i===0;
  a.anim.update(1/60,{...v,role:'A'},b.anim);b.anim.update(1/60,{...v,role:'B'},a.anim);
  a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
  if(hold&&clip==='flat')continue;
  b.bones.chest.updateWorldMatrix(true,false);const inv=b.bones.chest.matrixWorld.clone().invert();
  for(const side of ['L','R'] as const){
   const p=a.anim.bonePos(`arm${side}`,new Vector3()),q=a.anim.bonePos(`hand${side}`,new Vector3()),e=a.anim.bonePos(`forearm${side}`,new Vector3());
   const current=clearance(p,e,q,inv,b.scale);if(current>=1)continue;
   const core=(point:Vector3)=>{const v=point.clone().applyMatrix4(inv).divideScalar(b.scale);return Math.sqrt((v.x/.148)**2+((v.y-.020)/.155)**2+((v.z+.002)/.108)**2);};
   if(core(q)<1)wristInside++;if(core(p)<1)shoulderInside++;
   const stats=counts[clip]??(counts[clip]={collisions:0,clearable:0,blocked:0});stats.collisions++;collisions++;
   const axis=q.clone().sub(p),d=axis.length();axis.normalize();
   const {arm:l1,forearm:l2}=a.anim.solver.limbLengths;
   const along=(l1*l1-l2*l2+d*d)/(2*d),radius=Math.sqrt(Math.max(0,l1*l1-along*along));
   const center=p.clone().addScaledVector(axis,along);
   const basis=new Vector3(Math.abs(axis.y)<.9?0:1,Math.abs(axis.y)<.9?1:0,0).cross(axis).normalize(),other=axis.clone().cross(basis).normalize();
   let best=current;
   for(let k=0;k<72;k++){
    const angle=k*Math.PI/36,candidate=center.clone().addScaledVector(basis,radius*Math.cos(angle)).addScaledVector(other,radius*Math.sin(angle));
    best=Math.max(best,clearance(p,candidate,q,inv,b.scale));
   }
   if(best>=1){clearable++;stats.clearable++;}else{blocked++;stats.blocked++;}
   if(best<worstBest){worstBest=best;worst={clip,t,u,mirror,scales,side,current,best,shoulder:p.toArray(),wrist:q.toArray(),radius,reach:d/(l1+l2)};}
  }
 }
}
console.log({collisions,clearable,blocked,wristInside,shoulderInside,counts,worstBest,worst,note:'A sampled geometric feasibility diagnostic, not an anatomical solver or clearance certification.'});
