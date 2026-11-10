import {Bone,Group,Vector3,Euler,Skeleton,SkinnedMesh,MeshBasicMaterial} from 'three';
import {buildBodyNow} from '../body/factory';
import {headSurfaceMinimum,registerHeadPostDraft} from '../lab/doubleBarFinishDraft';
const meshCache=new Map<number,ReturnType<typeof buildBodyNow>>();
import {BONES,BIND_POSE,BONE_INDEX,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import '../anim/library';
import '../lab/doubleBarFinishDraft';
import {sampleMove} from '../anim/clips';
import {createLocal} from '../anim/spec';
import {P} from '../anim/posture';
import {palmSurface} from '../anim/gableGrip';
function make(scale:number,phase=.5){
 const bones={} as Record<BoneName,Bone>,root=new Group();
 for(const def of BONES){const bone=new Bone();bone.position.set(...def.offset).multiplyScalar(scale);bones[def.name]=bone;if(def.parent)bones[def.parent].add(bone);else root.add(bone);}
 for(const def of BONES){const e=BIND_POSE[def.name];if(e)bones[def.name].quaternion.setFromEuler(new Euler(...e.map(v=>v*Math.PI/180) as [number,number,number]));}
 root.updateMatrixWorld(true);
 if(!meshCache.has(scale))meshCache.set(scale,buildBodyNow({scale,mass:.5,hair:'crop',clothing:'singlet'},'low',false));
 const mesh=new SkinnedMesh(meshCache.get(scale)!.head,new MeshBasicMaterial());mesh.name="review-head";root.add(mesh);mesh.bind(new Skeleton(Object.values(bones)));
 const torso=new SkinnedMesh(meshCache.get(scale)!.body,new MeshBasicMaterial());torso.name="review-body";root.add(torso);torso.bind(new Skeleton(Object.values(bones)));
 for(const b of Object.values(bones))b.quaternion.identity();root.updateMatrixWorld(true);
 const random=Math.random;
 Math.random=()=>phase;
 let anim:Animator;
 try { anim=new Animator({bones,root,scale,boneList:Object.values(bones),dispose:()=>{},motion:DEFAULT_MOTION,setExertion:()=>{}}); } finally { Math.random=random; }
 anim.instant=true;
 return {anim,bones,scale};
}






declare const process:{argv:string[]};
const supportedRelease=process.argv.includes('--supported-release');
const supportedRecover=process.argv.includes('--supported-recover')||supportedRelease;
const supportedEntry=process.argv.includes('--supported-entry');
const supportedHeadPost=process.argv.includes('--supported-head-post')||supportedEntry||supportedRecover;
const supportedPin=process.argv.includes('--supported-pin');
const bridge=process.argv.includes('--bridge');
const release=process.argv.includes('--release')||supportedRelease;
const recover=process.argv.includes('--recover')||release||supportedRecover;
const entry=supportedEntry||process.argv.includes('--entry')||bridge||recover;
const motionClip=supportedRecover?'doubleBarSupportedRecoverDraft':supportedEntry?'doubleBarSupportedEntryDraft':bridge?'doubleBarHeadPostBridgeDraft':recover?'doubleBarHeadPostRecoverDraft':'doubleBarHeadPostEntryDraft';
const hz=Number(process.argv.find(a=>a.startsWith('--hz='))?.slice(5)??30);
if(![30,60,120].includes(hz))throw Error('Use --hz=30,60 or120');
const results:unknown[]=[];
const failures:string[]=[];
for(const mirror of [false,true])for(const top of [.9,1,1.15])for(const bottom of [.9,1,1.15]){
 registerHeadPostDraft(.6,top,bottom);
 const a=make(top),b=make(bottom);
 const v={mode:'paired' as const,clip:supportedPin?'doubleBarSupportedPinDraft':supportedHeadPost?'doubleBarSupportedHeadPostDraft':'doubleBarHeadPostDraft',hold:true,frame:{x:0,z:0,yaw:0},mirror,u:0,progress:0,intensity:0,stamina:1,exertion:0};
 for(let i=0;i<120;i++){a.anim.update(1/60,{...v,role:'A'},b.anim);b.anim.update(1/60,{...v,role:'B'},a.anim);a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);}
 const beforeSupport=headSurfaceMinimum(a.anim.character.root);
 registerHeadPostDraft(.6+.003-beforeSupport,top,bottom);
 for(let i=0;i<120;i++){a.anim.update(1/60,{...v,role:'A'},b.anim);b.anim.update(1/60,{...v,role:'B'},a.anim);a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);}
 const afterSupport=headSurfaceMinimum(a.anim.character.root);
 if(!supportedPin&&Math.abs(afterSupport-.003)>.001)throw Error('Draft head support calibration failed');
 if(entry){
  const source={...v,clip:supportedRecover?'doubleBarSupportedHeadPostDraft':supportedEntry?'doubleBarSupportedPinDraft':bridge||recover?'doubleBarHeadPostDraft':'doubleBarPin'};
  for(let i=0;i<120;i++){
   a.anim.update(1/60,{...source,role:'A'},b.anim);b.anim.update(1/60,{...source,role:'B'},a.anim);
   a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
  }
 }
 b.bones.chest.updateWorldMatrix(true,false);
 const sourceAnchor=new Vector3(0,.03,-.14).multiplyScalar(bottom).applyMatrix4(b.bones.chest.matrixWorld);
 let sourcePalmGap=0,sourceReach=0;
 for(const side of ['L','R'] as const){
  a.bones[`hand${side}`].updateWorldMatrix(true,false);
  sourcePalmGap=Math.max(sourcePalmGap,palmSurface(side,top).applyMatrix4(a.bones[`hand${side}`].matrixWorld).distanceTo(sourceAnchor));
  const lengths=a.anim.solver.limbLengths;
  sourceReach=Math.max(sourceReach,a.anim.bonePos(`arm${side}`,new Vector3()).distanceTo(a.anim.bonePos(`hand${side}`,new Vector3()))/(lengths.arm+lengths.forearm));
 }
 const sourceDefenderToes=(['toeL','toeR'] as const).map(n=>b.anim.bonePos(n,new Vector3()));
 const sourceHands=(['handL','handR'] as const).map(n=>b.anim.bonePos(n,new Vector3()));
 let previousJoints:Vector3[]|undefined;
 const tracked=['toeL','toeR','hips','handL','handR'] as const;
 for(let frame=0;frame<=(entry?(release?4:2)*hz:0);frame++){
 const releasing=release&&frame>2*hz;
 const u=(releasing?frame-2*hz:frame)/(2*hz);
 const activeClip=releasing?(supportedRelease?'doubleBarSupportedReleaseDraft':'doubleBarExit'):motionClip;
 if(entry){
  const view={...v,clip:activeClip,hold:bridge,u,progress:bridge?Math.sin(Math.PI*u)**2:0};
  a.anim.instant=false;b.anim.instant=false;
  if(frame===0){a.anim.instant=true;b.anim.instant=true;}
  a.anim.update(1/hz,{...view,role:'A'},b.anim);b.anim.update(1/hz,{...view,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
 }
 const authored=createLocal();
 const activeContacts=sampleMove(activeClip,'A',u,mirror,authored);
 const fullyLocked=!releasing||activeContacts.filter(c=>c.backClasp&&c.weight>.999).length===2;
 const authoredToes=[P.FOOT_L,P.FOOT_R].map(at=>Array.from(authored.slice(at,at+3)));
 const jointsNow=tracked.map(n=>a.anim.bonePos(n,new Vector3()));
 const speeds=previousJoints?jointsNow.map((p,i)=>p.distanceTo(previousJoints![i])*hz):jointsNow.map(()=>0);
 const footHeights=jointsNow.slice(0,2).map(p=>p.y);
 const kneeHeights=(['shinL','shinR'] as const).map(n=>a.anim.bonePos(n,new Vector3()).y);
 const grounded=footHeights.some(y=>y<=.04)||kneeHeights.some(y=>y<=.08);
 // During each swing, the other toe should retain its mat position.
 const supportSide=bridge?-1:releasing?(supportedRelease?(u<=.58?(mirror?1:0):(mirror?0:1)):-1):recover?(u<=.74?(mirror?0:1):(mirror?1:0)):u<=.34?(mirror?1:0):u<=.7?(mirror?0:1):-1;
 const supportDrift=entry&&previousJoints&&supportSide>=0?Math.hypot(jointsNow[supportSide].x-previousJoints[supportSide].x,jointsNow[supportSide].z-previousJoints[supportSide].z)*hz:0;
 if(entry&&supportDrift>.25)failures.push('Planted support skates during entry');
 if(entry&&!grounded&&headSurfaceMinimum(a.anim.character.root)>.01)failures.push('Entry loses mat support');
 if(entry&&Math.max(...speeds.slice(2))>4)failures.push('Entry body or wrist velocity exceeds 4m/s');
 previousJoints=jointsNow;
 const defenderToes=(['toeL','toeR'] as const).map(n=>b.anim.bonePos(n,new Vector3()));
 const defenderToeDrift=Math.max(...defenderToes.map((p,i)=>p.distanceTo(sourceDefenderToes[i])));
 if(bridge&&defenderToeDrift>.005)failures.push('Bridge loses defender foot support');
 const defenderHeadSurface=headSurfaceMinimum(b.anim.character.root);
 let defenderTorsoSurface=Infinity;
 if(supportedEntry||supportedRecover||frame===0||u===1){
  const torso=b.anim.character.root.getObjectByName('review-body') as SkinnedMesh;
  torso.skeleton.update();const indices=torso.geometry.getAttribute('skinIndex'),weights=torso.geometry.getAttribute('skinWeight');
  for(let i=0;i<indices.count;i++){
   let trunkWeight=0;for(let j=0;j<4;j++)if([BONE_INDEX.hips,BONE_INDEX.spine,BONE_INDEX.chest].includes(indices.getComponent(i,j)))trunkWeight+=weights.getComponent(i,j);
   if(trunkWeight<.8)continue;
   defenderTorsoSurface=Math.min(defenderTorsoSurface,torso.getVertexPosition(i,new Vector3()).applyMatrix4(torso.matrixWorld).y);
  }
  if(defenderTorsoSurface<-.005)failures.push('Defender torso surface passes below mat');
 }
 if(entry&&defenderHeadSurface<-.005)failures.push('Bridge drives defender head below mat');
 const defenderEntryGap=entry&&frame===0?Math.max(...(['handL','handR'] as const).map((n,i)=>b.anim.bonePos(n,new Vector3()).distanceTo(sourceHands[i]))):0;
 if(defenderEntryGap>.005)failures.push('Defender trapped arms pop at entry boundary');
 const movingSupport=headSurfaceMinimum(a.anim.character.root);
 if(movingSupport<-.001)failures.push('Head surface passes below mat during entry');
 b.bones.chest.updateWorldMatrix(true,false);const inv=b.bones.chest.matrixWorld.clone().invert(),anchor=new Vector3(0,.03,-.14).multiplyScalar(bottom).applyMatrix4(b.bones.chest.matrixWorld);
 const defenderShoulderHeights=(['armL','armR'] as const).map(n=>b.anim.bonePos(n,new Vector3()).y);
 if((entry||supportedPin||supportedHeadPost)&&Math.min(...defenderShoulderHeights)<0)failures.push('Defender shoulder joint passes below mat');
 if(fullyLocked&&anchor.y<0)failures.push('Locked clasp anchor lies below mat');
 // The entry must retain both bent arms with the defender's rolling torso.
 const defenderHands=(['handL','handR'] as const).map(n=>b.anim.bonePos(n,new Vector3()).applyMatrix4(inv).divideScalar(bottom).toArray());
 let headCore=Infinity,headWorst:number[]=[];
 a.anim.character.root.traverse(object=>{
  if(!(object instanceof SkinnedMesh)||object.name!=='review-head')return;
  object.skeleton.update();
  for(let i=0;i<object.geometry.getAttribute('position').count;i++){
   const point=object.getVertexPosition(i,new Vector3()).applyMatrix4(object.matrixWorld).applyMatrix4(inv).divideScalar(bottom);
   const distance=Math.sqrt((point.x/.148)**2+((point.y-.02)/.155)**2+((point.z+.002)/.108)**2);
   if(distance<headCore){headCore=distance;headWorst=point.toArray();}
  }
 });
 const elbowFeasibility:unknown[]=[];
 let minimumCore=Infinity,maxPalmGap=0,maxReach=0,worstArm:unknown=null;
 const armReachDetails:unknown[]=[];
 for(const side of ['L','R'] as const){
  a.bones[`hand${side}`].updateWorldMatrix(true,false);
  maxPalmGap=Math.max(maxPalmGap,palmSurface(side,top).applyMatrix4(a.bones[`hand${side}`].matrixWorld).distanceTo(anchor));
  const joints=([`arm${side}`,`forearm${side}`,`hand${side}`] as BoneName[]).map(n=>a.anim.bonePos(n,new Vector3()));
  if((entry||supportedPin||supportedHeadPost)&&joints[2].y<-.005)failures.push('Rider wrist passes below mat');
  const lengths=a.anim.solver.limbLengths;
  const reach=joints[0].distanceTo(joints[2])/(lengths.arm+lengths.forearm);maxReach=Math.max(maxReach,reach);
  armReachDetails.push({side,reach,contactWeight:activeContacts.find(c=>c.hand===side)?.weight??0,shoulder:joints[0].toArray(),elbow:joints[1].toArray(),wrist:joints[2].toArray()});
  const axis=joints[2].clone().sub(joints[0]),distance=axis.length();axis.normalize();
  const along=(lengths.arm**2-lengths.forearm**2+distance**2)/(2*distance);
  const radius=Math.sqrt(Math.max(0,lengths.arm**2-along**2));
  const center=joints[0].clone().addScaledVector(axis,along);
  const basis=new Vector3(Math.abs(axis.y)<.9?0:1,Math.abs(axis.y)<.9?1:0,0).cross(axis).normalize(),other=axis.clone().cross(basis);
  let best=-Infinity,bestElbow:number[]=[];
  for(let n=0;n<(entry&&frame!==Math.round(22*hz/30)&&frame!==hz?0:144);n++){
   const angle=n*Math.PI/72,elbow=center.clone().addScaledVector(basis,radius*Math.cos(angle)).addScaledVector(other,radius*Math.sin(angle));
   let clearance=Infinity;
   for(const [start,end] of [[joints[0],elbow],[elbow,joints[2]]])for(let j=1;j<40;j++){
    const p=start.clone().lerp(end,j/40).applyMatrix4(inv).divideScalar(bottom);
    clearance=Math.min(clearance,Math.sqrt((p.x/.148)**2+((p.y-.02)/.155)**2+((p.z+.002)/.108)**2));
   }
   if(clearance>best){best=clearance;bestElbow=elbow.applyMatrix4(inv).divideScalar(bottom).toArray();}
  }
  elbowFeasibility.push({side,best,bestElbow,radius,reach:distance/(lengths.arm+lengths.forearm)});
  for(let k=0;k<2;k++)for(let j=1;j<40;j++){const p=joints[k].clone().lerp(joints[k+1],j/40).applyMatrix4(inv).divideScalar(bottom);const d=Math.sqrt((p.x/.148)**2+((p.y-.02)/.155)**2+((p.z+.002)/.108)**2);if(d<minimumCore){minimumCore=d;worstArm={side,segment:k,along:j/40,joints:joints.map(q=>q.clone().applyMatrix4(inv).divideScalar(bottom).toArray())};}}
 }
 const rootX=.525*top-.28*bottom+(supportedHeadPost?-.10:0);
 const canonical=supportedPin?[[.65,.025,.4],[.57,.025,-.45]]:[[rootX+.3*top,.025,.2+.5*top],[rootX+.35*top,.025,.2-.6*top]];
 const toeTargets=mirror?[[-canonical[1][0],canonical[1][1],canonical[1][2]],[-canonical[0][0],canonical[0][1],canonical[0][2]]]:canonical;
 const toeErrors=(['L','R'] as const).map((side,i)=>a.anim.bonePos(`toe${side}`,new Vector3()).distanceTo(new Vector3(...toeTargets[i] as [number,number,number])));
 if((!entry||bridge)&&Math.max(...toeErrors)>.001)failures.push('Head-post draft loses planted toe support');
 if(fullyLocked&&maxPalmGap>.02)failures.push('Retained clasp exceeds 20mm gap');
 if(maxReach>.98)failures.push('Arm exceeds reach margin');
 if(minimumCore<1)failures.push('Head-post draft arm enters chest core');
 if(headCore<1)failures.push('Head-post draft head enters torso core');
 results.push({defenderTorsoSurface:Number.isFinite(defenderTorsoSurface)?defenderTorsoSurface:null,claspHeight:anchor.y,defenderShoulderHeights,armReachDetails,release,releasing,activeClip,fullyLocked,recover,bridge,hz,u,defenderToeDrift,defenderHeadSurface,defenderFootHeights:defenderToes.map(p=>p.y),defenderHip:b.anim.bonePos('hips',new Vector3()).toArray(),authoredToes,actualToes:jointsNow.slice(0,2).map(p=>p.toArray()),footHeights,kneeHeights,grounded,speeds,supportDrift,sourcePalmGap,sourceReach,movingSupport,defenderEntryGap,defenderHands,elbowFeasibility,headCore,headWorst,toeErrors,worstArm,mirror,top,bottom,beforeSupport,afterSupport,maxPalmGap,maxReach,minimumCore,headCenter:a.anim.headPos(new Vector3()).toArray(),headSeparation:a.anim.headPos(new Vector3()).distanceTo(b.anim.headPos(new Vector3())),feet:['footL','footR'].map(n=>a.anim.bonePos(n as BoneName,new Vector3()).toArray())});
}
}
console.log(JSON.stringify({note:'Lab draft diagnostics; head-center height is not a mesh support certificate.',results},null,2));

if(failures.length)throw Error([...new Set(failures)].join('; '));
