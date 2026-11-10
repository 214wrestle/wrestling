import {Quaternion} from 'three';
import {registerMove,sampleMove,moveClip,type MoveClip} from '../anim/clips';
import {createLocal,mirrorLocal} from '../anim/spec';
import {P} from '../anim/posture';
import '../anim/library';
import {registerSeatedBarDrafts} from '../lab/doubleBarFinishDraft';
const base:MoveClip={id:'pathBaseCheck',A:[{t:0,pose:{hips:[0,.4,0]}},{t:1,pose:{hips:[.2,.4,0]}}],B:[{t:0,pose:{wristL:[0,0,0]}},{t:1,pose:{wristL:[0,0,0]}}]};
registerMove(base);
registerMove({...base,id:'pathScopeCheck',wristPaths:[{who:'B',hand:'L',keys:[{t:.3,rotation:[0,0,0,1]},{t:.5,rotation:[.2,0,0,Math.sqrt(.96)]},{t:.7,rotation:[0,0,0,1]}]}]});
for(const role of ['A','B'] as const)for(const t of [0,.29,.3,.4,.5,.6,.7,.71,1]){
 const a=createLocal(),b=createLocal(),mirror=createLocal(),expected=createLocal();
 sampleMove(base.id,role,t,false,a);sampleMove('pathScopeCheck',role,t,false,b);
 for(let i=0;i<P.SIZE;i++)if(role==='A'||i<P.WRIST_L||i>P.WRIST_L+2||t<.3||t>.7)
  if(a[i]!==b[i])throw Error('Path changes unrelated pose or outside interval');
 mirrorLocal(b,expected);sampleMove('pathScopeCheck',role,t,true,mirror);
 if(mirror.some((x,i)=>x!==expected[i]))throw Error('Path mirroring mismatch');
 if(role==='B'&&t===.5&&Math.abs(b[P.WRIST_L]-2*Math.asin(.2))>1e-6)throw Error('Path key not reproduced');
}
registerSeatedBarDrafts(1);
if(moveClip('wristBarSeatedTurnDraft')!.wristPaths?.length)throw Error('Wrist variant inherits experimental single-bar path');
for(const path of moveClip('armBarSeatedTurnDraft')!.wristPaths??[]){
 let previous=-Infinity;
 for(const key of path.keys){if(key.t<=previous||Math.abs(new Quaternion().fromArray(key.rotation).length()-1)>1e-6)throw Error('Invalid path keys');previous=key.t;}
}
console.log('Wrist paths: isolation, boundaries, mirroring, keys and variant separation pass');
