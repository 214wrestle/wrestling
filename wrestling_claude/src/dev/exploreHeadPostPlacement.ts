import {Bone,Group,Vector3,Euler,Skeleton,SkinnedMesh,MeshBasicMaterial} from 'three';
import {buildBodyNow} from '../body/factory';
import {headSurfaceMinimum} from '../lab/doubleBarFinishDraft';
const meshCache=new Map<number,ReturnType<typeof buildBodyNow>>();
import {BONES,BIND_POSE,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import '../anim/library';
import '../lab/doubleBarFinishDraft';
import {palmSurface} from '../anim/gableGrip';
function make(scale:number,phase=.5){
 const bones={} as Record<BoneName,Bone>,root=new Group();
 for(const def of BONES){const bone=new Bone();bone.position.set(...def.offset).multiplyScalar(scale);bones[def.name]=bone;if(def.parent)bones[def.parent].add(bone);else root.add(bone);}
 for(const def of BONES){const e=BIND_POSE[def.name];if(e)bones[def.name].quaternion.setFromEuler(new Euler(...e.map(v=>v*Math.PI/180) as [number,number,number]));}
 root.updateMatrixWorld(true);
 if(!meshCache.has(scale))meshCache.set(scale,buildBodyNow({scale,mass:.5,hair:'crop',clothing:'singlet'},'low',false));
 const mesh=new SkinnedMesh(meshCache.get(scale)!.head,new MeshBasicMaterial());root.add(mesh);mesh.bind(new Skeleton(Object.values(bones)));
 for(const b of Object.values(bones))b.quaternion.identity();root.updateMatrixWorld(true);
 const random=Math.random;
 Math.random=()=>phase;
 let anim:Animator;
 try { anim=new Animator({bones,root,scale,boneList:Object.values(bones),dispose:()=>{},motion:DEFAULT_MOTION,setExertion:()=>{}}); } finally { Math.random=random; }
 anim.instant=true;
 return {anim,bones,scale};
}







// Offline pose exploration only. Never registers a playable move.
import {registerHold,type Contact} from '../anim/clips';
import {holdAt} from '../anim/library/kit';
import type {PoseSpec} from '../anim/spec';
const results:any[]=[];
for(const yaw of [-90,-60,-30,0,30,60,90])for(const x of [-.3,0,.3,.6])for(const z of [-.2,0,.2,.4])for(const pitch of [110,120,130,140]){
 const a=make(1),b=make(1),angle=yaw*Math.PI/180,c=Math.cos(angle),sn=Math.sin(angle);
 const foot=(l:number,r:number):[number,number,number,number,number]=>[x+l*c+r*sn,.025,z-l*sn+r*c,yaw,30];
 const left=foot(.6,-.3),right=foot(-.7,-.35);
 const contacts:Contact[]=(['L','R'] as const).map(hand=>({who:'A',hand,on:'chest',at:[0,.03,-.14],backClasp:true,elbowGuide:{on:'chest',at:[hand==='L'?.35:-.35,.03,-.45]}}));
 function register(height:number){
  const A:PoseSpec={base:holdAt('doubleBarPin','A',0),hips:[x,height,z],rot:[yaw,pitch,0],spine:[-5,0,0],head:[20,0,0],footL:left,footR:right,kneeL:[left[0],.3,left[2]],kneeR:[right[0],.3,right[2]]};
  const B:PoseSpec={base:holdAt('doubleBarPin','B',0),rot:[0,90,0,170]};
  registerHold({id:'headPostSearch',A:[A,A],B:[B,B],contacts,struggle:{A:0,B:0},tempo:1});
 }
 function pose(){for(let i=0;i<3;i++){const v={mode:'paired' as const,clip:'headPostSearch',hold:true,frame:{x:0,z:0,yaw:0},mirror:false,u:0,progress:0,intensity:0,stamina:1,exertion:0};a.anim.update(1/60,{...v,role:'A'},b.anim);b.anim.update(1/60,{...v,role:'B'},a.anim);a.anim.applyContacts(1,b.anim);b.anim.applyContacts(1,a.anim);}}
 register(.6);pose();const height=.603-headSurfaceMinimum(a.anim.character.root);register(height);pose();
 b.bones.chest.updateWorldMatrix(true,false);const inv=b.bones.chest.matrixWorld.clone().invert();
 const core=(p:Vector3)=>{p=p.clone().applyMatrix4(inv);return Math.sqrt((p.x/.148)**2+((p.y-.02)/.155)**2+((p.z+.002)/.108)**2);};
 let head=Infinity,arm=Infinity,reach=0,gap=0;
 a.anim.character.root.traverse(o=>{if(o instanceof SkinnedMesh){o.skeleton.update();for(let j=0;j<o.geometry.getAttribute('position').count;j++)head=Math.min(head,core(o.getVertexPosition(j,new Vector3()).applyMatrix4(o.matrixWorld)));}});
 for(const side of ['L','R'] as const){
  const ps=([`arm${side}`,`forearm${side}`,`hand${side}`] as BoneName[]).map(n=>a.anim.bonePos(n,new Vector3()));
  reach=Math.max(reach,ps[0].distanceTo(ps[2])/.55);
  const anchor=new Vector3(0,.03,-.14).applyMatrix4(b.bones.chest.matrixWorld);
  gap=Math.max(gap,palmSurface(side,1).applyMatrix4(a.bones[`hand${side}`].matrixWorld).distanceTo(anchor));
  for(let k=0;k<2;k++)for(let j=1;j<40;j++)arm=Math.min(arm,core(ps[k].clone().lerp(ps[k+1],j/40)));
 }
 const toe=Math.max(a.anim.bonePos('toeL',new Vector3()).distanceTo(new Vector3(left[0],left[1],left[2])),a.anim.bonePos('toeR',new Vector3()).distanceTo(new Vector3(right[0],right[1],right[2])));
 const headSep=a.anim.headPos(new Vector3()).distanceTo(b.anim.headPos(new Vector3()));
 const score=Math.max(0,1-head)+Math.max(0,1-arm)+10*gap+10*toe+Math.max(0,reach-.98)+Math.max(0,.25-headSep);
 results.push({yaw,x,z,pitch,height,head,arm,reach,gap,toe,headSep,score});
 a.anim.character.root.traverse(o=>{if(o instanceof SkinnedMesh){o.skeleton.dispose();(o.material as MeshBasicMaterial).dispose();}});
 b.anim.character.root.traverse(o=>{if(o instanceof SkinnedMesh){o.skeleton.dispose();(o.material as MeshBasicMaterial).dispose();}});
}
results.sort((a,b)=>a.score-b.score);console.log(JSON.stringify({tested:results.length,passing:results.filter(r=>r.score<.0001),best:results.slice(0,12)},null,2));
