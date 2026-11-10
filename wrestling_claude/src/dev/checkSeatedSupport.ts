import {Bone,Group,Vector3,Euler,Skeleton,SkinnedMesh,MeshBasicMaterial} from 'three';
import {BONES,BIND_POSE,BONE_INDEX,type BoneName} from '../body/skeleton';
import {buildBodyNow} from '../body/factory';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import '../anim/library';

// Sample the skinned posterior hip surface, not just the pelvis joint.
// Standard-size body only; mixed-size motion is covered separately.
for(const clip of ['seatedLegDefense','seatedLegDefenseExit'])for(const mirror of [false,true])for(const role of ['A','B'] as const){
const buffers=buildBodyNow({scale:1,mass:.5,hair:'crop',clothing:'singlet'},'low',false);
const bones={} as Record<BoneName,Bone>,root=new Group();
for(const d of BONES){const b=new Bone();bones[d.name]=b;b.position.set(...d.offset);if(d.parent)bones[d.parent].add(b);else root.add(b);const e=BIND_POSE[d.name];if(e)b.quaternion.setFromEuler(new Euler(...e.map(v=>v*Math.PI/180) as [number,number,number]));}
root.updateMatrixWorld(true);
const skeleton=new Skeleton(Object.values(bones));
const mesh=new SkinnedMesh(buffers.body,new MeshBasicMaterial());root.add(mesh);mesh.bind(skeleton);
for(const b of Object.values(bones))b.quaternion.identity();root.updateMatrixWorld(true);
const anim=new Animator({bones,root,scale:1,boneList:Object.values(bones),motion:DEFAULT_MOTION,dispose:()=>{},setExertion:()=>{}});

anim.instant=true;
anim.update(1/60,{mode:'paired',clip,hold:true,frame:{x:0,z:0,yaw:0},mirror,u:0,progress:0,intensity:0,stamina:1,exertion:0,role},null);
root.updateMatrixWorld(true);skeleton.update();
const pos=buffers.body.getAttribute('position'),skin=buffers.body.getAttribute('skinIndex'),weights=buffers.body.getAttribute('skinWeight');
let minimum=Infinity,count=0;
for(let i=0;i<pos.count;i++){
 const v=new Vector3().fromBufferAttribute(pos,i);
 let hipWeight=0;
 for(let j=0;j<4;j++)if(skin.getComponent(i,j)===BONE_INDEX.hips)hipWeight+=weights.getComponent(i,j);
 if(hipWeight<.4||v.y>.98||v.y<.82||v.z>0)continue;
 minimum=Math.min(minimum,mesh.getVertexPosition(i,new Vector3()).y);count++;
}
console.log({clip,mirror,role,hipSurfaceMinimum:minimum,count});
if(count<100||minimum<-.005||minimum>.035)throw Error('Seated hip surface floats or penetrates mat');
}
