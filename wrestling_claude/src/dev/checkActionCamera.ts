import {PerspectiveCamera,Vector3} from 'three';
import {CameraRig} from '../engine/CameraRig';
import {actionFraming} from '../game/actionFraming';
import {Bout,type Position} from '../sim/bout';
import {PROTOTYPE_ROSTER} from '../sim/roster';
const ok=(v:boolean,m:string)=>{if(!v)throw Error(m);};
const bout=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},21);
bout.setReferee(0,{x:0,z:0},0);
const mat=bout.position;
if(mat.kind!=='mat')throw Error('fixture');
mat.sub='exposed';mat.turnStyle='barHalf';mat.mirror=true;
ok(actionFraming(mat,true,4.7).pin===1,'Exposed back framing');
ok(actionFraming(mat,false,4.7).pin===0,'No action framing outside wrestling');
const move={kind:'move',id:'fightOff',A:0,mirror:true,t:0,dur:.85,frame:mat.frame,turnStyle:'barHalf',awarded:false,impacted:false,startA:{x:0,z:0,yaw:0},startB:{x:0,z:0,yaw:0},dist:.5} as Position;
if(move.kind!=='move')throw Error('fixture');
for(const u of [0,.2,.4]){move.t=u*move.dur;ok(actionFraming(move,true,0).pin===1,'Release retains pin view');}
move.t=.7*move.dur;ok(Math.abs(actionFraming(move,true,0).pin!-.5)<1e-6,'Recovery gradual');
move.t=move.dur;ok(actionFraming(move,true,0).pin===0,'Recovery returns normal view');
move.id='fall';ok(actionFraming(move,true,0).pin===1,'Fall retains pin view');
let maxScreen=0,maxStep=0,maxOrbitStep=0;
for(const aspect of [390/844,844/390,16/9])for(const hz of [30,60,120])for(const mirror of [false,true])for(const theta of [0,Math.PI/2,Math.PI,-Math.PI+.01]){
 const camera=new PerspectiveCamera(34,aspect,.1,100),rig=new CameraRig();
 rig.setMode('mat');
 const focus=new Vector3(Math.sin(theta)*4.6,0,Math.cos(theta)*4.6),az=theta+Math.PI;
 rig.cut(focus,az);
 let prior=camera.position.clone(),priorAz=rig.viewAzimuth;
 for(let i=0;i<5*hz;i++){
  const pin=Math.min(1,i/hz),edge=Math.min(1,i/hz);
  rig.update(1/hz,camera,focus,az,.8,{pin,mirror,edge});
  if(i>0){maxStep=Math.max(maxStep,camera.position.distanceTo(prior));maxOrbitStep=Math.max(maxOrbitStep,Math.abs(rig.viewAzimuth-priorAz));}
  prior.copy(camera.position);priorAz=rig.viewAzimuth;
 }
 camera.updateMatrixWorld(true);
 // A representative prone pair envelope, including lifted knees and a bridge.
 for(const x of [-1.1,1.1])for(const z of [-1.1,1.1])for(const y of [.04,.9]){
  const p=new Vector3(focus.x+x,y,focus.z+z).project(camera);
  maxScreen=Math.max(maxScreen,Math.abs(p.x),Math.abs(p.y));
  ok(Math.abs(p.x)<.95&&Math.abs(p.y)<.95,'Pin body envelope cropped');
 }
}
ok(maxStep<.12,'Abrupt camera position change');ok(maxOrbitStep<.04,'Abrupt camera orbit');
console.log({maxScreen,maxStep,maxOrbitStep});
console.log('Exposure/release continuity and portrait/landscape edge framing pass at30/60/120Hz');
