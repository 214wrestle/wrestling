import {Bone,Group,Vector3,Euler,Skeleton,SkinnedMesh,MeshBasicMaterial} from 'three';
import {BONES,BIND_POSE,BONE_INDEX,type BoneName} from '../body/skeleton';
import {buildBodyNow} from '../body/factory';
import {bindPose} from '../body/anatomy';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import '../anim/library';
const buffers=buildBodyNow({scale:1,mass:.5,hair:'crop',clothing:'singlet'},'low',false);
const bones={} as Record<BoneName,Bone>,root=new Group();
for(const d of BONES){const b=new Bone();bones[d.name]=b;b.position.set(...d.offset);if(d.parent)bones[d.parent].add(b);else root.add(b);const e=BIND_POSE[d.name];if(e)b.quaternion.setFromEuler(new Euler(...e.map(v=>v*Math.PI/180) as [number,number,number]));}
root.updateMatrixWorld(true);
const skeleton=new Skeleton(Object.values(bones));
const mesh=new SkinnedMesh(buffers.body,new MeshBasicMaterial());root.add(mesh);mesh.bind(skeleton);
for(const b of Object.values(bones))b.quaternion.identity();root.updateMatrixWorld(true);
const anim=new Animator({bones,root,scale:1,boneList:Object.values(bones),motion:DEFAULT_MOTION,dispose:()=>{},setExertion:()=>{}});
anim.instant=true;
anim.update(1/60,{mode:'paired',clip:'cradleHold',hold:true,frame:{x:0,z:0,yaw:0},mirror:false,u:0,progress:.5,intensity:0,stamina:1,exertion:0,role:'B'},null);
skeleton.update();
const position=buffers.body.getAttribute('position'),skin=buffers.body.getAttribute('skinIndex'),weights=buffers.body.getAttribute('skinWeight');
const bind=bindPose(1),target=new Vector3(...bind.pos.shinL);
let closest=Infinity,index=0;
for(let i=0;i<position.count;i++){const d=new Vector3().fromBufferAttribute(position,i).distanceTo(target);if(d<closest){closest=d;index=i;}}
console.log({knee:bones.shinL.getWorldPosition(new Vector3()).toArray(),meshKnee:mesh.getVertexPosition(index,new Vector3()).toArray(),bindVertex:new Vector3().fromBufferAttribute(position,index).toArray(),distance:closest,skin:[skin.getX(index),skin.getY(index),skin.getZ(index),skin.getW(index)],weights:[weights.getX(index),weights.getY(index),weights.getZ(index),weights.getW(index)],shinIndex:BONE_INDEX.shinL});

const rendered=mesh.getVertexPosition(index,new Vector3()),joint=bones.shinL.getWorldPosition(new Vector3());
if(rendered.distanceTo(joint)>.08)throw new Error('Skinned knee surface does not follow folded leg');
console.log('Skinned knee surface distance',rendered.distanceTo(joint));
