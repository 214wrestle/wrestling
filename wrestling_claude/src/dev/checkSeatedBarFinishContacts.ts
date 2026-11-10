import {buildBodyNow} from '../body/factory';
const meshCache=new Map<number,ReturnType<typeof buildBodyNow>>();
import {addGripMorph} from '../body/gripMorph';
import {palmSurface,palmGrip} from '../anim/gableGrip';
import {Box3,Bone,Euler,Group,Vector3,Quaternion,Skeleton,SkinnedMesh,Mesh,BufferGeometry,BufferAttribute,MeshBasicMaterial,Raycaster,DoubleSide} from 'three';
import {BONES,BIND_POSE,BONE_INDEX,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import {sampleHold,sampleMove,holdClip,holdLocal,registerHold} from '../anim/clips';
import {P} from '../anim/posture';
import {createLocal} from '../anim/spec';
import '../anim/library';
import {registerSeatedBarDrafts} from '../lab/doubleBarFinishDraft';
const renderedIndices=new WeakMap<object,number[]>();
function visibleIndices(mesh:SkinnedMesh):number[]{
 const g=mesh.geometry;let values=renderedIndices.get(g);if(!values){values=g.index?[...new Set(Array.from(g.index.array))]:Array.from({length:g.getAttribute('position').count},(_,i)=>i);renderedIndices.set(g,values);}return values;
}
// Spatially bucket rendered triangles for exact vertical intersections.
function verticalSurface(mesh:SkinnedMesh){
 mesh.updateWorldMatrix(true,false);mesh.skeleton.update();
 const points=new Map<number,Vector3>();for(const i of visibleIndices(mesh))points.set(i,mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));
 const ix=mesh.geometry.index?.array??Array.from({length:mesh.geometry.getAttribute('position').count},(_,i)=>i);
 const bins=new Map<string,number[]>(),cell=.04;
 for(let i=0;i<ix.length;i+=3){const a=points.get(ix[i])!,b=points.get(ix[i+1])!,c=points.get(ix[i+2])!;
  for(let x=Math.floor(Math.min(a.x,b.x,c.x)/cell);x<=Math.floor(Math.max(a.x,b.x,c.x)/cell);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/cell);z<=Math.floor(Math.max(a.z,b.z,c.z)/cell);z++){const key=x+','+z;const list=bins.get(key)??[];list.push(i);bins.set(key,list);}
 }
 const heights=(p:Vector3)=>{const values:number[]=[];for(const i of bins.get(Math.floor(p.x/cell)+','+Math.floor(p.z/cell))??[]){
  const a=points.get(ix[i])!,b=points.get(ix[i+1])!,c=points.get(ix[i+2])!;
  const det=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(det)<1e-12)continue;
  const u=((b.z-c.z)*(p.x-c.x)+(c.x-b.x)*(p.z-c.z))/det,v=((c.z-a.z)*(p.x-c.x)+(a.x-c.x)*(p.z-c.z))/det,w=1-u-v;
  if(u>=-1e-9&&v>=-1e-9&&w>=-1e-9)values.push(u*a.y+v*b.y+w*c.y);
 }values.sort((a,b)=>a-b);return values.filter((y,i)=>!i||y-values[i-1]>1e-7);};
 return {points,heights};
}
function make(scale:number,phase=.5){
 const bones={} as Record<BoneName,Bone>,root=new Group();
 for(const def of BONES){const bone=new Bone();bone.position.set(...def.offset).multiplyScalar(scale);bones[def.name]=bone;if(def.parent)bones[def.parent].add(bone);else root.add(bone);}
 for(const def of BONES){const e=BIND_POSE[def.name];if(e)bones[def.name].quaternion.setFromEuler(new Euler(...e.map(v=>v*Math.PI/180) as [number,number,number]));}
 root.updateMatrixWorld(true);
 if(!meshCache.has(scale))meshCache.set(scale,buildBodyNow({scale,mass:.5,hair:'crop',clothing:'singlet'},'low',false));
 const torso=new SkinnedMesh(meshCache.get(scale)!.body,new MeshBasicMaterial());root.add(torso);torso.bind(new Skeleton(Object.values(bones)));
 const head=new SkinnedMesh(meshCache.get(scale)!.head,new MeshBasicMaterial());root.add(head);head.bind(new Skeleton(Object.values(bones)));
 const hands=meshCache.get(scale)!.hands.map((geo,i)=>{addGripMorph(geo,i===0?1:-1,scale);const mesh=new SkinnedMesh(geo,new MeshBasicMaterial());root.add(mesh);mesh.bind(new Skeleton(Object.values(bones)));return mesh;});
 for(const bone of Object.values(bones))bone.quaternion.identity();root.updateMatrixWorld(true);
 const random=Math.random;
 Math.random=()=>phase;
 let anim:Animator;
 try { anim=new Animator({bones,root,scale,boneList:Object.values(bones),dispose:()=>{},motion:DEFAULT_MOTION,setExertion:()=>{},setGrip:(hand,amount,kind)=>{const w=hands[hand==='L'?0:1].morphTargetInfluences!;w[0]=Math.max(0,Math.min(1,amount));w[1]=kind==='gable'?w[0]:0;}}); } finally { Math.random=random; }
 anim.instant=true;
 return {anim,bones,scale,torso,head,hands};
}

function gripPoint(own:ReturnType<typeof make>,c:{hand:'L'|'R';backClasp?:boolean;palm?:boolean}){
 const bone=own.bones[`hand${c.hand}`];bone.updateWorldMatrix(true,false);
 return c.backClasp||c.palm?palmSurface(c.hand,own.scale).applyMatrix4(bone.matrixWorld):own.anim.bonePos(`hand${c.hand}`,new Vector3());
}
declare const process:{argv:string[]};
const transition=process.argv.find(x=>x.startsWith('--transition='))?.slice(13);
if(transition&&!['exit','fall'].includes(transition))throw Error('Unsupported transition');
const entry=process.argv.includes('--entry')||!!transition;
const moveSeconds=transition==='exit'?.85:2.2;
const destinationHold=process.argv.find(x=>x.startsWith('--destination='))?.slice(14)??(transition==='exit'?'flat':'armBarSeatedFinishDraft');
const settle=process.argv.includes('--settle');
const baselineHold=process.argv.find(x=>x.startsWith('--baseline-hold='))?.slice(16);
const holdMotion=process.argv.includes('--hold-motion');
if(holdMotion&&(!baselineHold||!process.argv.includes('--stream')))throw Error('Hold motion requires baseline hold and --stream');
const holdSeconds=2;
const riderLift=Number(process.argv.find(x=>x.startsWith('--rider-lift='))?.slice(13)??0);
if(!Number.isFinite(riderLift)||riderLift<0||riderLift>.3||riderLift&&!baselineHold)throw Error('Rider lift requires baseline hold and range0-.3');
const riderForward=Number(process.argv.find(x=>x.startsWith('--rider-forward='))?.slice(16)??0);
if(!Number.isFinite(riderForward)||Math.abs(riderForward)>.3||riderForward&&!baselineHold)throw Error('Rider forward requires baseline hold and range-.3 to.3');
if(baselineHold&&entry)throw Error('Baseline hold cannot be combined with a move');
const effort=process.argv.find(x=>x.startsWith('--effort='))?.slice(9);
if(effort&&!['shoot','fight','none'].includes(effort))throw Error('Unsupported effort');
if(effort&&(entry||baselineHold))throw Error('Effort audit uses seated hold, not entry');
const repeatEffort=process.argv.includes('--repeat-effort');
if(repeatEffort&&!effort)throw Error('--repeat-effort requires --effort');
const effortSeconds=repeatEffort?3:1;
const entryVariant=process.argv.find(x=>x.startsWith('--variant='))?.slice(10)??'armBar';
if(!['armBar','wristBar','armBarPressure','armBarSupported'].includes(entryVariant))throw Error('Unsupported entry variant');
const sourceHold=process.argv.find(x=>x.startsWith('--source='))?.slice(9)??(transition?'armBarSeatedFinishDraft':'flat');
const frameRate=Number(process.argv.find(x=>x.startsWith('--hz='))?.split('=')[1]??60);
if(![30,60,120].includes(frameRate))throw Error('Use --hz=30,60,120');
const dt=1/frameRate;
const stream=process.argv.includes('--stream');
const torsoVertices=process.argv.includes('--torso-vertices');
const torsoRayChecks:unknown[]=[];
const inspectTorsoRays=process.argv.includes('--inspect-torso-rays');
const torsoVertexSamples:Array<{role:string,mirror:boolean,scales:number[],progress:number,tested:number,covered:number,ambiguous:number,inside:number,near:number,maxDepth:number,worst:number[],worstBone:string,opponentBones:string[],rayParity:number|null}>=[];
const pressureOnly=process.argv.includes('--pressure-only');
const bakedPressure=process.argv.includes('--baked-pressure');
if(bakedPressure&&!pressureOnly)throw Error('Baked pressure requires pressure-only');
const pressureGrid=process.argv.includes('--pressure-grid');
if(pressureGrid&&!pressureOnly)throw Error('Pressure grid requires pressure-only');
if(pressureOnly&&!baselineHold)throw Error('Pressure measurement requires a baseline hold');
const pressure:Array<{clip:string,mirror:boolean,scales:number[],progress:number,samples:Array<{x:number,z:number,gap:number|null}>}>=[];
const handFootOnly=process.argv.includes('--hand-foot-only');
// Positive box distance proves surface separation; overlap is only a candidate.
const handFootBoxes:Array<{progress:number,mirror:boolean,scales:number[],hand:string,foot:string,gap:number,orientedGap:number}>=[];
const feetOnly=process.argv.includes('--feet-only');
const limbsOnly=process.argv.includes('--limbs-only');
const legsOnly=process.argv.includes('--legs-only');
const forearmsOnly=process.argv.includes('--forearms-only');
const wristMotionOnly=process.argv.includes('--wrist-motion-only');
const wristMotion:Array<{progress:number,mirror:boolean,scales:number[],rotation:number[]}>=[];
const fineWristGrid=process.argv.includes('--fine-wrist-grid');
const wristFlexGrid=fineWristGrid?Array.from({length:13},(_,i)=>-40+i*5):[-60,-40,-20,0,20,40,60];
const wristDeviationGrid=fineWristGrid?Array.from({length:9},(_,i)=>-20+i*5):[-20,0,20];
const wristScan=process.argv.includes('--wrist-scan');
const wristCandidates:unknown[]=[];
const forearmClearance:Array<{progress:number,mirror:boolean,scales:number[],role:string,side:string,selfCore:number,otherCore:number,selfPoint:number[],otherPoint:number[],selfBone:string,otherBone:string,jointCores:Record<string,{self:number,other:number}>,jointPositions:Record<string,{self:number[],other:number[],pair:number[],axes?:Record<string,number[]>}>}>=[];
const legClearance:Array<{progress:number,mirror:boolean,scales:number[],role:string,side:string,core:number,floor:number,floorBone:string,joints:Record<string,number[]>}>=[];
const gripsOnly=process.argv.includes('--grips-only');
const searchElbows=!process.argv.includes('--no-feasibility');
const bothCores=process.argv.includes('--both-cores');
const limbFloors:Array<{progress:number,mirror:boolean,scales:number[],role:string,side:string,floor:number,floorBone:string,shoulder:number[],elbow:number[],wrist:number[]}>=[];
const feet:Array<{progress:number,mirror:boolean,scales:number[],side:string,ball:number[],extension:number}>=[];
const streams=new Map<string,{a:ReturnType<typeof make>,b:ReturnType<typeof make>,steps:number}>();
// Dense endpoints replay the uninterrupted entry from the same settled source.
const focusedPhase=process.argv.find(x=>x.startsWith('--phase='))?.slice(8);
if(focusedPhase!==undefined&&(!Number.isFinite(Number(focusedPhase))||Number(focusedPhase)<0||Number(focusedPhase)>1))throw Error('Phase must be between zero and one');
const entryPhases=focusedPhase!==undefined?[Number(focusedPhase)]:process.argv.includes('--frames')?Array.from({length:Math.round((moveSeconds+(settle?1:0))*frameRate)+1},(_,i)=>i/(moveSeconds*frameRate)):process.argv.includes('--dense')?Array.from({length:21},(_,i)=>i/20):[.25,.5,.75,1];
let maxGap=0,context='';
const gripSamples:Array<{progress:number,mirror:boolean,scales:number[],hand:string,gap:number,reach:number,shoulder:number[],target:number[],wristTarget:number[],wristLocal:number[],wristReach:number,effectiveWeight:number}>=[];
const feasibility:Array<{progress:number,mirror:boolean,scales:number[],side:string,best:number,elbow:number[],pairElbow:number[],reach:number,reachableBest:number|null,bestTurn:number|null}>=[];
const coreSurfaceProbes:Array<{role:string,mirror:boolean,scales:number[],progress:number,point:number[],heights:number[],aboveTop:number|null}>=[];
const surfaces:Array<{clip:string,mirror:boolean,scales:number[],progress:number,role:string,headCore:number,torsoCore:number,torsoFloor:number,torsoPoint:number[],opponentPoint:number[],torsoBone:string}>=[];
const clearance:Array<{clip:string,mirror:boolean,scales:number[],progress:number,minimumCore:number,side:string,segment:number,joints:number[][]}>=[];
const support:Array<{clip:string,mirror:boolean,scales:number[],progress:number,hipSurface:number}>=[];
const perVariant:Record<string,{gap:number,context:string,shoulder:number[],target:number[],wrist:number[]}>={};
for(const id of (entry||effort||baselineHold?[entryVariant]:['armBar','wristBar','barHalf','doubleBar']))for(const suffix of [transition==='exit'?'SeatedExitDraft':transition==='fall'?'SeatedFallDraft':entry?'SeatedTurnDraft':'SeatedFinishDraft'])for(const mirror of [false,true])for(const scales of [.9,1,1.15].flatMap(top=>[.9,1,1.15].map(bottom=>[top,bottom])))for(const progress of (effort?Array.from({length:effortSeconds*frameRate+1},(_,i)=>i/frameRate):entry?entryPhases:holdMotion?Array.from({length:holdSeconds*frameRate+1},(_,i)=>i/(holdSeconds*frameRate)):[0,.5,1]).filter(t=>!process.argv.includes('--roll-window')||(t>=.70&&t<=.87))){
 registerSeatedBarDrafts(scales[0],scales[1]);
 if(baselineHold&&(riderLift||riderForward)){const h=holdClip(baselineHold)!;const poses=([0,1] as const).map(t=>{const p=holdLocal(baselineHold,'A',t);p[P.HIPS+1]+=riderLift;p[P.HIPS+2]+=riderForward;return {base:p};});registerHold({...h,A:poses as typeof h.A});}
 const streamKey=`${id}:${mirror}:${scales}`;
 const cached=(entry||effort||holdMotion)&&stream?streams.get(streamKey):undefined;
 const a=cached?.a??make(scales[0]),b=cached?.b??make(scales[1]),clip=baselineHold??id+suffix;
 const view={mode:'paired' as const,clip,hold:true,frame:{x:1,z:1,yaw:.7},mirror,u:0,progress:effort||holdMotion?0:progress,intensity:0,stamina:1,exertion:0};
 for(let i=0;!cached&&i<2*frameRate;i++){
  if(entry){view.clip=sourceHold;view.progress=0;}
  a.anim.update(dt,{...view,role:'A'},b.anim);b.anim.update(dt,{...view,role:'B'},a.anim);
  a.anim.applyContacts(dt,b.anim);b.anim.applyContacts(dt,a.anim);
 }
 if(entry){
  view.clip=clip;view.hold=false;
  a.anim.instant=b.anim.instant=false;
  const steps=Math.round(progress*moveSeconds*frameRate);
  for(let i=(cached?.steps??0)+1;i<=steps;i++){
   view.u=Math.min(1,i/(moveSeconds*frameRate));
   view.clip=settle&&i>Math.round(moveSeconds*frameRate)?(transition?destinationHold:id+'SeatedFinishDraft'):clip;
   view.hold=settle&&i>Math.round(moveSeconds*frameRate);
   if(view.hold)view.progress=0;
   a.anim.update(dt,{...view,role:'A'},b.anim);b.anim.update(dt,{...view,role:'B'},a.anim);
   a.anim.applyContacts(dt,b.anim);b.anim.applyContacts(dt,a.anim);
  }
  view.u=Math.min(1,steps/(moveSeconds*frameRate));
  view.clip=settle&&steps>Math.round(moveSeconds*frameRate)?(transition?destinationHold:id+'SeatedFinishDraft'):clip;
  view.hold=settle&&steps>Math.round(moveSeconds*frameRate);
  if(view.hold)view.progress=0;
  if(stream)streams.set(streamKey,{a,b,steps});
 }
 if(holdMotion){
  a.anim.instant=b.anim.instant=false;
  const steps=Math.round(progress*holdSeconds*frameRate);
  for(let i=(cached?.steps??0)+1;i<=steps;i++){
   view.progress=i/(holdSeconds*frameRate);
   a.anim.update(dt,{...view,role:'A'},b.anim);b.anim.update(dt,{...view,role:'B'},a.anim);
   a.anim.applyContacts(dt,b.anim);b.anim.applyContacts(dt,a.anim);
  }
  view.progress=progress;
  streams.set(streamKey,{a,b,steps});
 }
 if(effort){
  a.anim.instant=b.anim.instant=false;
  if(!cached&&effort!=='none'){a.anim.effort(effort,true,'ok');b.anim.effort(effort,false,'ok');}
  const steps=Math.round(progress*frameRate);
  for(let i=(cached?.steps??0)+1;i<=steps;i++){
   if(repeatEffort && effort!=='none' && i<2*frameRate && i%Math.round(.2*frameRate)===0){a.anim.effort(effort,true,'ok');b.anim.effort(effort,false,'ok');}
   a.anim.update(dt,{...view,role:'A'},b.anim);b.anim.update(dt,{...view,role:'B'},a.anim);
   a.anim.applyContacts(dt,b.anim);b.anim.applyContacts(dt,a.anim);
  }
  if(stream)streams.set(streamKey,{a,b,steps});
 }
 if(wristMotionOnly){wristMotion.push({progress,mirror,scales,rotation:b.bones[mirror?'handR':'handL'].quaternion.toArray()});continue;}
 for(const side of ['L','R'] as const){
  const ball=a.anim.bonePos(`toe${side}`,new Vector3());
  const hip=a.anim.bonePos(`thigh${side}`,new Vector3());
  const ankle=a.anim.bonePos(`foot${side}`,new Vector3());
  const lengths=a.anim.solver.limbLengths;
  feet.push({progress,mirror,scales,side,ball:ball.toArray(),extension:hip.distanceTo(ankle)/(lengths.thigh+lengths.shin)});
 }
 if(handFootOnly){
  const boxFor=(ids:number[],meshes:SkinnedMesh[],rotation?:Quaternion)=>{
   const box=new Box3();
   for(const mesh of meshes){mesh.updateWorldMatrix(true,false);mesh.skeleton.update();
    const ix=mesh.geometry.getAttribute('skinIndex'),wt=mesh.geometry.getAttribute('skinWeight');
    for(const i of visibleIndices(mesh)){let weight=0;for(let j=0;j<4;j++)if(ids.includes(ix.getComponent(i,j)))weight+=wt.getComponent(i,j);
     if(weight>=.8){const point=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);if(rotation)point.applyQuaternion(rotation);box.expandByPoint(point);}}
   }
   if(box.isEmpty())throw Error('Missing hand/foot surface');return box;
  };
  const footBoxes=(['L','R'] as const).map(side=>boxFor([BONE_INDEX[`foot${side}`],BONE_INDEX[`toe${side}`]],[a.torso]));
  for(const hand of ['L','R'] as const){const box=boxFor([BONE_INDEX[`hand${hand}`]],[a.torso,...a.hands]);
   for(const [i,foot] of (['L','R'] as const).entries()){
    const other=footBoxes[i];
    const gap=Math.max(...(['x','y','z'] as const).map(axis=>Math.max(box.min[axis]-other.max[axis],other.min[axis]-box.max[axis])));
    // Also test bounds aligned with each actual limb. A positive gap
    // on any of these axes proves separation; overlap still proves nothing.
    let orientedGap=gap;
    if(gap<=0)for(const bone of [a.bones[`hand${hand}`],a.bones[`foot${foot}`]]){
     const rotation=bone.getWorldQuaternion(new Quaternion()).invert();
     const handBox=boxFor([BONE_INDEX[`hand${hand}`]],[a.torso,...a.hands],rotation);
     const footBox=boxFor([BONE_INDEX[`foot${foot}`],BONE_INDEX[`toe${foot}`]],[a.torso],rotation);
     orientedGap=Math.max(orientedGap,...(['x','y','z'] as const).map(axis=>Math.max(handBox.min[axis]-footBox.max[axis],footBox.min[axis]-handBox.max[axis])));
    }
    handFootBoxes.push({progress,mirror,scales,hand,foot,gap,orientedGap});
   }
  }
  continue;
 }
 if(torsoVertices){
  const surfaces=[verticalSurface(a.torso),verticalSurface(b.torso)];
  for(const [role,own,other,index] of [['A',a,b,0],['B',b,a,1]] as const){
   const weight=own.torso.geometry.getAttribute('skinWeight'),skin=own.torso.geometry.getAttribute('skinIndex');
   let tested=0,covered=0,ambiguous=0,inside=0,near=0,maxDepth=0,worst:number[]=[],worstBone='';const opponentBones:string[]=[];
   for(const [i,p] of surfaces[index].points){let sum=0;for(let j=0;j<4;j++)if([BONE_INDEX.hips,BONE_INDEX.spine,BONE_INDEX.chest].includes(skin.getComponent(i,j)))sum+=weight.getComponent(i,j);if(sum<.8)continue;tested++;
    const ys=surfaces[1-index].heights(p);if(!ys.length)continue;covered++;if(ys.length%2){ambiguous++;continue;}
    let distance=Infinity,depth=0;for(let j=0;j<ys.length;j+=2){distance=Math.min(distance,Math.abs(p.y-ys[j]),Math.abs(p.y-ys[j+1]));if(p.y>ys[j]&&p.y<ys[j+1])depth=Math.max(depth,Math.min(p.y-ys[j],ys[j+1]-p.y));}
    if(depth>0)inside++;if(distance<=.01)near++;if(depth>maxDepth){maxDepth=depth;worst=p.toArray();let dominant=0;for(let j=1;j<4;j++)if(weight.getComponent(i,j)>weight.getComponent(i,dominant))dominant=j;worstBone=BONES[skin.getComponent(i,dominant)].name;}
   }
   let rayParity:number|null=null;if(worst.length){other.torso.computeBoundingSphere();const side=other.torso.material.side;other.torso.material.side=DoubleSide;const ray=new Raycaster(new Vector3(worst[0],3,worst[2]),new Vector3(0,-1,0));const hits=ray.intersectObject(other.torso,false);const otherSkin=other.torso.geometry.getAttribute('skinIndex'),otherWeight=other.torso.geometry.getAttribute('skinWeight');for(const hit of hits){if(!hit.face)continue;const tally=new Map<number,number>();for(const vertex of [hit.face.a,hit.face.b,hit.face.c])for(let j=0;j<4;j++){const bone=otherSkin.getComponent(vertex,j);tally.set(bone,(tally.get(bone)??0)+otherWeight.getComponent(vertex,j));}const bone=[...tally].sort((a,b)=>b[1]-a[1])[0][0];opponentBones.push(BONES[bone].name);}const ys=hits.map(h=>h.point.y).sort((a,b)=>a-b).filter((y,i,arr)=>!i||y-arr[i-1]>1e-7);other.torso.material.side=side;const expected=surfaces[1-index].heights(new Vector3(...worst));rayParity=ys.length===expected.length?Math.max(0,...ys.map((y,i)=>Math.abs(y-expected[i]))):Infinity;}
   if(inspectTorsoRays&&worst.length&&maxDepth>.005){
    const material=other.torso.material,oldSide=material.side;material.side=DoubleSide;
    const rays=(['x','y','z'] as const).map(axis=>{
     const origin=new Vector3(...worst);origin[axis]=-3;
     const direction=new Vector3();direction[axis]=1;
     const hits=new Raycaster(origin,direction).intersectObject(other.torso,false);
     const skin=other.torso.geometry.getAttribute('skinIndex'),weight=other.torso.geometry.getAttribute('skinWeight');
     return {axis,hits:hits.map(hit=>{
      const face=hit.face!;const vertices=[face.a,face.b,face.c];
      const points=vertices.map(i=>other.torso.getVertexPosition(i,new Vector3()).applyMatrix4(other.torso.matrixWorld));
      const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
      const tally=new Map<number,number>();for(const i of vertices)for(let j=0;j<4;j++){const bone=skin.getComponent(i,j);tally.set(bone,(tally.get(bone)??0)+weight.getComponent(i,j));}
      return {distanceFromPoint:hit.point[axis]-worst[['x','y','z'].indexOf(axis)],normalDot:normal.dot(direction),bone:BONES[[...tally].sort((a,b)=>b[1]-a[1])[0][0]].name};
     })};
    });
    material.side=oldSide;torsoRayChecks.push({role,mirror,scales,progress,worst,maxDepth,rays});
   }
   torsoVertexSamples.push({role,mirror,scales,progress,tested,covered,ambiguous,inside,near,maxDepth,worst,worstBone,opponentBones,rayParity});
  }
  continue;
 }
 if(pressureOnly){
  // Signed vertical underside/back gap. Null means no shared torso coverage.
  const ray=new Raycaster();const samples:Array<{x:number,z:number,gap:number|null}>=[];
  for(const own of [a,b]){own.torso.material.side=DoubleSide;own.torso.updateWorldMatrix(true,false);own.torso.skeleton.update();own.torso.computeBoundingSphere();}
  // Freeze the exact skinned vertices once per pose; raycasts then avoid
  // reskinning the same triangles for every probe. Keep legacy path for parity.
  const bake=(own:typeof a)=>{
   const source=own.torso.geometry,positions=new Float64Array(source.getAttribute('position').count*3);
   const ix=source.getAttribute('skinIndex'),wt=source.getAttribute('skinWeight');
   for(const i of visibleIndices(own.torso)){const v=own.torso.getVertexPosition(i,new Vector3()).applyMatrix4(own.torso.matrixWorld);v.toArray(positions,i*3);}
   const triangles:number[]=[];const indices=source.index?.array??Array.from({length:positions.length/3},(_,i)=>i);
   for(let k=0;k<indices.length;k+=3){let weight=0;for(let n=0;n<3;n++)for(let j=0;j<4;j++)if([BONE_INDEX.hips,BONE_INDEX.spine,BONE_INDEX.chest].includes(ix.getComponent(indices[k+n],j)))weight+=wt.getComponent(indices[k+n],j)/3;if(weight>=.8)triangles.push(indices[k],indices[k+1],indices[k+2]);}
   const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.setIndex(triangles);
   const mesh=new Mesh(geometry,new MeshBasicMaterial({side:DoubleSide}));mesh.updateMatrixWorld(true);return mesh;
  };
  const frozen=bakedPressure?[bake(a),bake(b)]:null;
  const probes=pressureGrid?Array.from({length:9},(_,x)=>Array.from({length:7},(_,y)=>[(x-4)*.035,(y-3)*.035])).flat():[[0,0],[-.05,0],[.05,0],[0,-.05],[0,.05]];
  for(const [x,y] of probes){
   const probe=new Vector3(x,y,0).multiplyScalar(a.scale).applyMatrix4(a.bones.chest.matrixWorld);
   ray.set(new Vector3(probe.x,3,probe.z),new Vector3(0,-1,0));
   const heights=(own:typeof a)=>ray.intersectObject(own.torso,false).filter(hit=>{
    if(!hit.face)return false;
    const ix=own.torso.geometry.getAttribute('skinIndex'),wt=own.torso.geometry.getAttribute('skinWeight');let weight=0;
    for(const v of [hit.face.a,hit.face.b,hit.face.c])for(let j=0;j<4;j++)if([BONE_INDEX.hips,BONE_INDEX.spine,BONE_INDEX.chest].includes(ix.getComponent(v,j)))weight+=wt.getComponent(v,j)/3;
    return weight>=.8;
   }).map(hit=>hit.point.y);
   const top=frozen?ray.intersectObject(frozen[0],false).map(h=>h.point.y):heights(a),bottom=frozen?ray.intersectObject(frozen[1],false).map(h=>h.point.y):heights(b);
   samples.push({x:probe.x,z:probe.z,gap:top.length&&bottom.length?Math.min(...top)-Math.max(...bottom):null});
  }
  if(frozen)for(const mesh of frozen){mesh.geometry.dispose();mesh.material.dispose();}
  pressure.push({clip,mirror,scales,progress,samples});continue;
 }
 if(feetOnly)continue;
 if(forearmsOnly){
  for(const [role,own,other] of [['A',a,b],['B',b,a]] as const){
   own.torso.updateWorldMatrix(true,false);own.torso.skeleton.update();
   own.bones.chest.updateWorldMatrix(true,false);other.bones.chest.updateWorldMatrix(true,false);
   const selfInverse=own.bones.chest.matrixWorld.clone().invert(),otherInverse=other.bones.chest.matrixWorld.clone().invert();
   const core=(v:Vector3)=>Math.sqrt((v.x/.148)**2+((v.y-.02)/.155)**2+((v.z+.002)/.108)**2);
   for(const side of ['L','R'] as const){
    const ids=[BONE_INDEX[`forearm${side}`],BONE_INDEX[`hand${side}`]];
    let selfCore=Infinity,otherCore=Infinity,selfPoint:number[]=[],otherPoint:number[]=[],selfBone='',otherBone='';
    for(const surfaceMesh of [own.torso,...own.hands]){
     surfaceMesh.updateWorldMatrix(true,false);surfaceMesh.skeleton.update();
     const ix=surfaceMesh.geometry.getAttribute('skinIndex'),wt=surfaceMesh.geometry.getAttribute('skinWeight');
     for(const i of visibleIndices(surfaceMesh)){
     let weight=0;for(let j=0;j<4;j++)if(ids.includes(ix.getComponent(i,j)))weight+=wt.getComponent(i,j);
     if(weight<.8)continue;
     let dominant=0;for(let j=1;j<4;j++)if(wt.getComponent(i,j)>wt.getComponent(i,dominant))dominant=j;
     const surfaceBone=BONES[ix.getComponent(i,dominant)].name;
     const world=surfaceMesh.getVertexPosition(i,new Vector3()).applyMatrix4(surfaceMesh.matrixWorld);
     const local=world.clone().applyMatrix4(selfInverse).divideScalar(own.scale),distance=core(local);
     if(distance<selfCore){selfCore=distance;selfPoint=local.toArray();selfBone=surfaceBone;}
     const otherLocal=world.applyMatrix4(otherInverse).divideScalar(other.scale),otherDistance=core(otherLocal);
     if(otherDistance<otherCore){otherCore=otherDistance;otherPoint=otherLocal.toArray();otherBone=surfaceBone;}
    }
    }
    // An endpoint inside a core cannot be fixed by changing the elbow guide alone.
    const jointCores:Record<string,{self:number,other:number}>={};
    const jointPositions:Record<string,{self:number[],other:number[],pair:number[],axes?:Record<string,number[]>}>={};
    for(const joint of ['arm','forearm','hand'] as const){
     const world=own.anim.bonePos(`${joint}${side}`,new Vector3());
     const pair=world.clone().sub(new Vector3(view.frame.x,0,view.frame.z)).applyAxisAngle(new Vector3(0,1,0),-view.frame.yaw).divideScalar(own.scale);if(mirror)pair.x*=-1;
     jointPositions[joint]={pair:pair.toArray(),self:world.clone().applyMatrix4(selfInverse).divideScalar(own.scale).toArray(),other:world.clone().applyMatrix4(otherInverse).divideScalar(other.scale).toArray()};
     if(joint==='hand'){
      // Unit hand axes in the wearer's chest frame: -Y follows the fingers.
      // Keep orientation separate from endpoints when diagnosing surface crossings.
      const basis=own.bones[`hand${side}`].matrixWorld.clone().premultiply(selfInverse);
      jointPositions[joint].axes={};
      for(const [name,axis] of [['x',new Vector3(1,0,0)],['y',new Vector3(0,1,0)],['z',new Vector3(0,0,1)]] as const)
       jointPositions[joint].axes![name]=axis.transformDirection(basis).toArray();
     }
     jointCores[joint]={self:core(world.clone().applyMatrix4(selfInverse).divideScalar(own.scale)),
      other:core(world.applyMatrix4(otherInverse).divideScalar(other.scale))};
    }
    if(wristScan&&role==='B'&&side===(mirror?'R':'L')){
     const bone=own.bones[`hand${side}`],saved=bone.quaternion.clone();
     const vertices:Array<{mesh:typeof own.torso,index:number}>=[];
     for(const mesh of [own.torso,...own.hands]){const ix=mesh.geometry.getAttribute('skinIndex'),wt=mesh.geometry.getAttribute('skinWeight');for(const i of visibleIndices(mesh)){let weight=0;for(let j=0;j<4;j++)if(ids.includes(ix.getComponent(i,j)))weight+=wt.getComponent(i,j);if(weight>=.8)vertices.push({mesh,index:i});}}
     // Include the wrist seam and forearm, matching the main surface audit.
     // Feasibility only: bounded local offsets, not an animation or joint-limit proof.
     try{for(const flex of wristFlexGrid)for(const deviation of wristDeviationGrid){
      bone.quaternion.copy(saved).multiply(new Quaternion().setFromEuler(new Euler(flex*Math.PI/180,0,deviation*Math.PI/180*(mirror?-1:1))));
      bone.updateWorldMatrix(true,true);own.torso.skeleton.update();
      let self=Infinity,opponent=Infinity,floor=Infinity;
      for(const {mesh,index} of vertices){mesh.skeleton.update();const world=mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld);floor=Math.min(floor,world.y);self=Math.min(self,core(world.clone().applyMatrix4(selfInverse).divideScalar(own.scale)));opponent=Math.min(opponent,core(world.applyMatrix4(otherInverse).divideScalar(other.scale)));}
      wristCandidates.push({progress,mirror,scales,flex,deviation,self,opponent,floor,rotation:bone.quaternion.toArray(),turn:saved.angleTo(bone.quaternion)});
     }}finally{bone.quaternion.copy(saved);bone.updateWorldMatrix(true,true);own.torso.skeleton.update();}
    }
    forearmClearance.push({progress,mirror,scales,role,side,selfCore,otherCore,selfPoint,otherPoint,selfBone,otherBone,jointCores,jointPositions});
   }
  }
  continue;
 }
 if(legsOnly){
  for(const [role,own,other] of [['A',a,b],['B',b,a]] as const){
   own.torso.updateWorldMatrix(true,false);own.torso.skeleton.update();
   other.bones.chest.updateWorldMatrix(true,false);
   const inverse=other.bones.chest.matrixWorld.clone().invert();
   const ix=own.torso.geometry.getAttribute('skinIndex'),wt=own.torso.geometry.getAttribute('skinWeight');
   for(const side of ['L','R'] as const){
    const ids=[BONE_INDEX[`thigh${side}`],BONE_INDEX[`shin${side}`],BONE_INDEX[`foot${side}`],BONE_INDEX[`toe${side}`]];
    let floor=Infinity,core=Infinity,floorBone='';
    for(const i of visibleIndices(own.torso)){
     let weight=0;for(let j=0;j<4;j++)if(ids.includes(ix.getComponent(i,j)))weight+=wt.getComponent(i,j);
     if(weight<.8)continue;
     const point=own.torso.getVertexPosition(i,new Vector3()).applyMatrix4(own.torso.matrixWorld);
     if(point.y<floor){floor=point.y;let largest=-1;for(let j=0;j<4;j++)if(wt.getComponent(i,j)>largest){largest=wt.getComponent(i,j);floorBone=BONES[ix.getComponent(i,j)].name;}}
     point.applyMatrix4(inverse).divideScalar(other.scale);
     core=Math.min(core,Math.sqrt((point.x/.148)**2+((point.y-.02)/.155)**2+((point.z+.002)/.108)**2));
    }
    legClearance.push({progress,mirror,scales,role,side,core,floor,floorBone,joints:{hip:own.anim.bonePos(`thigh${side}`,new Vector3()).toArray(),knee:own.anim.bonePos(`shin${side}`,new Vector3()).toArray(),ankle:own.anim.bonePos(`foot${side}`,new Vector3()).toArray(),toe:own.anim.bonePos(`toe${side}`,new Vector3()).toArray()}});
   }
  }
  continue;
 }
 if(limbsOnly){
  for(const [role,own] of [['A',a],['B',b]] as const){
   own.torso.updateWorldMatrix(true,false);own.torso.skeleton.update();
   for(const side of ['L','R'] as const){
    const ids=[BONE_INDEX[`arm${side}`],BONE_INDEX[`forearm${side}`],BONE_INDEX[`hand${side}`]];
    let floor=Infinity,floorBone='';
    for(const surfaceMesh of [own.torso,...own.hands]){
     surfaceMesh.updateWorldMatrix(true,false);surfaceMesh.skeleton.update();
     const ix=surfaceMesh.geometry.getAttribute('skinIndex'),wt=surfaceMesh.geometry.getAttribute('skinWeight');
     for(const i of visibleIndices(surfaceMesh)){
     let weight=0;for(let j=0;j<4;j++)if(ids.includes(ix.getComponent(i,j)))weight+=wt.getComponent(i,j);
     if(weight>=.8){const y=surfaceMesh.getVertexPosition(i,new Vector3()).applyMatrix4(surfaceMesh.matrixWorld).y;
      if(y<floor){floor=y;let largest=-1;for(let j=0;j<4;j++)if(wt.getComponent(i,j)>largest){largest=wt.getComponent(i,j);floorBone=BONES[ix.getComponent(i,j)].name;}}}
    }
    }
    limbFloors.push({progress,mirror,scales,role,side,floor,floorBone,shoulder:own.anim.bonePos(`arm${side}`,new Vector3()).toArray(),elbow:own.anim.bonePos(`forearm${side}`,new Vector3()).toArray(),wrist:own.anim.bonePos(`hand${side}`,new Vector3()).toArray()});
   }
  }
  continue;
 }
 if(!gripsOnly){
 a.torso.updateWorldMatrix(true,false);a.torso.skeleton.update();
 const indices=a.torso.geometry.getAttribute('skinIndex'),weights=a.torso.geometry.getAttribute('skinWeight');
 let hipSurface=Infinity;
 for(const i of visibleIndices(a.torso)){
  let hipWeight=0;for(let j=0;j<4;j++)if(indices.getComponent(i,j)===BONE_INDEX.hips)hipWeight+=weights.getComponent(i,j);
  if(hipWeight<.8)continue;
  hipSurface=Math.min(hipSurface,a.torso.getVertexPosition(i,new Vector3()).applyMatrix4(a.torso.matrixWorld).y);
 }
 support.push({clip,mirror,scales,progress,hipSurface});
 b.bones.chest.updateWorldMatrix(true,false);const inverse=b.bones.chest.matrixWorld.clone().invert();
 let minimumCore=Infinity,worstSide='',worstSegment=0,worstJoints:number[][]=[];
 for(const side of ['L','R'] as const){
  const joints=([`arm${side}`,`forearm${side}`,`hand${side}`] as BoneName[]).map(n=>a.anim.bonePos(n,new Vector3()).applyMatrix4(inverse).divideScalar(b.scale));
  if(searchElbows&&(entry||(id==='doubleBar'&&progress===0))){
   const l=a.anim.solver.limbLengths,upper=l.arm/b.scale,lower=l.forearm/b.scale;
   const axis=joints[2].clone().sub(joints[0]),distance=axis.length();axis.normalize();
   const along=(upper*upper-lower*lower+distance*distance)/(2*distance),radius=Math.sqrt(Math.max(0,upper*upper-along*along));
   const center=joints[0].clone().addScaledVector(axis,along);
   const basis=new Vector3(Math.abs(axis.y)<.9?0:1,Math.abs(axis.y)<.9?1:0,0).cross(axis).normalize(),other=axis.clone().cross(basis);
   a.bones.chest.updateWorldMatrix(true,false);
   const ownInverse=a.bones.chest.matrixWorld.clone().invert();
   let best=-Infinity,elbow:number[]=[],reachableBest=-Infinity,bestTurn:number|null=null;
   const previous=(a.anim.solver as unknown as {elbowFramePlanes:Map<Bone,Vector3>}).elbowFramePlanes.get(a.bones[`arm${side}`]);
   const worldAxis=axis.clone().transformDirection(b.bones.chest.matrixWorld);
   const transported=previous?.clone().addScaledVector(worldAxis,-previous.dot(worldAxis)).normalize();
   for(let n=0;n<144;n++){
    const angle=n*Math.PI/72,e=center.clone().addScaledVector(basis,radius*Math.cos(angle)).addScaledVector(other,radius*Math.sin(angle));
    let margin=Infinity;
    for(const [start,end] of [[joints[0],e],[e,joints[2]]])for(let j=1;j<40;j++){
     const p=start.clone().lerp(end,j/40);margin=Math.min(margin,Math.sqrt((p.x/.148)**2+((p.y-.02)/.155)**2+((p.z+.002)/.108)**2));
    }
    if(bothCores)for(let j=0;j<=40;j++){
     // Own shoulder belongs at the chest surface; inspect the free forearm,
     // whose entire elbow-to-wrist path must remain outside the torso.
     const p=e.clone().lerp(joints[2],j/40).multiplyScalar(b.scale).applyMatrix4(b.bones.chest.matrixWorld).applyMatrix4(ownInverse).divideScalar(a.scale);
     margin=Math.min(margin,Math.sqrt((p.x/.148)**2+((p.y-.02)/.155)**2+((p.z+.002)/.108)**2));
    }
    const candidate=e.clone().sub(center).normalize().transformDirection(b.bones.chest.matrixWorld);
    const turn=transported?Math.acos(Math.max(-1,Math.min(1,transported.dot(candidate)))):0;
    if(turn<=4/frameRate+1e-6)reachableBest=Math.max(reachableBest,margin);
    if(margin>best){best=margin;elbow=e.toArray();bestTurn=turn;}
   }
   const pairElbow=new Vector3(...elbow as [number,number,number]).multiplyScalar(b.scale).applyMatrix4(b.bones.chest.matrixWorld)
    .sub(new Vector3(view.frame.x,0,view.frame.z)).applyAxisAngle(new Vector3(0,1,0),-view.frame.yaw).divideScalar(a.scale);
   if(mirror)pairElbow.x*=-1;
   feasibility.push({progress,mirror,scales,side,best,elbow,pairElbow:pairElbow.toArray(),reach:distance/(upper+lower),reachableBest:Number.isFinite(reachableBest)?reachableBest:null,bestTurn});
  }
  for(let segment=0;segment<2;segment++)for(let j=1;j<40;j++){
   const p=joints[segment].clone().lerp(joints[segment+1],j/40);
   const distance=Math.sqrt((p.x/.148)**2+((p.y-.02)/.155)**2+((p.z+.002)/.108)**2);
   if(distance<minimumCore){minimumCore=distance;worstSide=side;worstSegment=segment;worstJoints=joints.map(p=>p.toArray());}
  }
 }
 clearance.push({clip,mirror,scales,progress,minimumCore,side:worstSide,segment:worstSegment,joints:worstJoints});
 for(const [role,own,other] of [['A',a,b],['B',b,a]] as const){
  other.bones.chest.updateWorldMatrix(true,false);const inv=other.bones.chest.matrixWorld.clone().invert();
  let headCore=Infinity,torsoCore=Infinity,torsoFloor=Infinity;
  let torsoPoint:number[]=[],opponentPoint:number[]=[];let torsoBone='';
  for(const mesh of [own.head,own.torso]){
   mesh.updateWorldMatrix(true,false);mesh.skeleton.update();
   const indices=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
   for(const i of visibleIndices(mesh)){
    let regionWeight=0;for(let j=0;j<4;j++)if((mesh===own.head?[BONE_INDEX.head]:[BONE_INDEX.hips,BONE_INDEX.spine,BONE_INDEX.chest]).includes(indices.getComponent(i,j)))regionWeight+=weights.getComponent(i,j);
    if(regionWeight<(mesh===own.head?.99:.8))continue;
    const world=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);
    if(mesh===own.torso)torsoFloor=Math.min(torsoFloor,world.y);
    const p=world.clone().applyMatrix4(inv).divideScalar(other.scale);
    const d=Math.sqrt((p.x/.148)**2+((p.y-.02)/.155)**2+((p.z+.002)/.108)**2);
    if(mesh===own.head)headCore=Math.min(headCore,d);else if(d<torsoCore){torsoCore=d;torsoPoint=world.toArray();opponentPoint=p.toArray();let largest=0;for(let j=1;j<4;j++)if(weights.getComponent(i,j)>weights.getComponent(i,largest))largest=j;torsoBone=BONES[indices.getComponent(i,largest)].name;}
   }
  }
  surfaces.push({clip,mirror,scales,progress,role,headCore,torsoCore,torsoFloor,torsoPoint,opponentPoint,torsoBone});
  if(process.argv.includes('--probe-core')&&torsoCore<1){
   other.torso.updateWorldMatrix(true,false);other.torso.skeleton.update();other.torso.computeBoundingSphere();
   const side=other.torso.material.side;other.torso.material.side=DoubleSide;
   const ray=new Raycaster(new Vector3(torsoPoint[0],3,torsoPoint[2]),new Vector3(0,-1,0));
   const heights=ray.intersectObject(other.torso,false).map(hit=>hit.point.y);
   other.torso.material.side=side;
   coreSurfaceProbes.push({role,mirror,scales,progress,point:torsoPoint,heights,aboveTop:heights.length?torsoPoint[1]-Math.max(...heights):null});
  }
 }

 }

 for(const contact of (entry&&!view.hold?sampleMove(view.clip,'A',view.u,mirror,createLocal()):sampleHold(view.clip,'A',effort||view.hold&&entry?0:progress,0,0,mirror,createLocal())).filter(c=>c.weight>.999)){
  const bone=b.bones[contact.on];bone.updateWorldMatrix(true,false);
  const target=new Vector3(...contact.at).multiplyScalar(b.scale).applyMatrix4(bone.matrixWorld);
  const rotation=bone.getWorldQuaternion(new Quaternion());
  const wristTarget=contact.palm?palmGrip(target,new Vector3(contact.at[0],0,contact.at[2]).applyQuaternion(rotation),new Vector3(0,1,0).applyQuaternion(rotation),contact.hand,a.scale).wrist:target.clone();
  const wristLocal=wristTarget.clone().sub(new Vector3(view.frame.x,0,view.frame.z)).applyAxisAngle(new Vector3(0,1,0),-view.frame.yaw);
  const effectiveWeight=(a.anim as unknown as {gripW:Record<'L'|'R',number>}).gripW[contact.hand];
  const gap=gripPoint(a,contact).distanceTo(target);
  const shoulder=a.anim.bonePos(`arm${contact.hand}`,new Vector3());
  const lengths=a.anim.solver.limbLengths;
  gripSamples.push({progress,mirror,scales,hand:contact.hand,gap,reach:shoulder.distanceTo(target)/(lengths.arm+lengths.forearm),shoulder:shoulder.toArray(),target:target.toArray(),wristTarget:wristTarget.toArray(),wristLocal:wristLocal.toArray(),wristReach:shoulder.distanceTo(wristTarget)/(lengths.arm+lengths.forearm),effectiveWeight});
  if(!perVariant[id]||gap>perVariant[id].gap)perVariant[id]={gap,context:`${contact.hand} ${scales} mirror=${mirror}`,shoulder:a.anim.bonePos(`arm${contact.hand}`,new Vector3()).toArray(),target:target.toArray(),wrist:gripPoint(a,contact).toArray()};
  if(gap>maxGap){maxGap=gap;context=`${clip} ${contact.hand} ${scales} mirror=${mirror} progress=${progress}`;}
 }
}
console.log(JSON.stringify({torsoRayChecks,handFootBoxes,torsoVertexSamples,coreSurfaceProbes,bakedPressure,holdMotion,holdSeconds,pressureGrid,pressure,riderForward,riderLift,baselineHold,transition,moveSeconds,effort,repeatEffort,wristMotion,wristCandidates,auditMode:handFootOnly?'hand-foot-bounds-observation':torsoVertices?'torso-vertices-vertical-mesh-intersections':pressureOnly?'chest-back-gap-observation':wristMotionOnly?'wrist-local-motion':forearmsOnly?'forearm-and-hand-torso-surfaces':legsOnly?'leg-torso-and-mat-surfaces':feetOnly?'foot-observation-only':limbsOnly?'arm-mat-surfaces':gripsOnly?'grip-only':'contact-and-body',sourceHold,settle,frameRate,bothCores,maxGap,context,gripSamples,perVariant,support,clearance,surfaces,feasibility,feet,limbFloors,legClearance,forearmClearance},null,2));
const failures:string[]=[];
if(torsoVertexSamples.some(x=>x.maxDepth>.005))failures.push('Torso vertex penetrates rendered opponent mesh by more than .005m vertically');
if(torsoVertexSamples.some(x=>x.rayParity!==null&&x.rayParity>1e-6))failures.push('Vertical intersection parity failed');
if(forearmClearance.some(x=>!Number.isFinite(x.selfCore)||x.selfCore<1))failures.push('Forearm or hand crosses own torso core');
if(forearmClearance.some(x=>!Number.isFinite(x.otherCore)||x.otherCore<1))failures.push('Forearm or hand crosses opponent torso core');
if(legClearance.some(x=>!Number.isFinite(x.floor)||x.floor<-.005))failures.push('Leg surface passes below mat');
if(legClearance.some(x=>!Number.isFinite(x.core)||x.core<1))failures.push('Leg surface crosses opponent torso core');
if(limbFloors.some(x=>!Number.isFinite(x.floor)||x.floor<-.005))failures.push('Arm surface passes below mat');
if(maxGap>.02)failures.push('Secured hand contact lost');
if(support.some(x=>!Number.isFinite(x.hipSurface)||x.hipSurface<-.005||(!entry&&!baselineHold&&x.hipSurface>.015)))failures.push(baselineHold?'Pelvis surface passes below mat':'Seated pelvis surface is not supported on mat');
if(clearance.some(x=>x.minimumCore<1))failures.push('Rider arm crosses defender torso core');
if(surfaces.some(x=>x.headCore<1||x.torsoCore<1))failures.push('Head or torso surface crosses opponent core');
if(surfaces.some(x=>x.torsoFloor<-.005))failures.push('Torso surface passes below mat');
if(failures.length)throw Error(failures.join('; '));
