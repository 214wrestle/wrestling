import {Euler,Quaternion} from 'three';
import {registerMove,sampleMove,type MoveClip} from '../anim/clips';
import {createLocal,mirrorLocal} from '../anim/spec';
import {P} from '../anim/posture';
const base:MoveClip={id:'wristBaseCheck',A:[{t:0,pose:{hips:[0,.4,0]}},{t:1,pose:{hips:[.3,.2,.4]}}],B:[{t:0,pose:{wristL:[-10,12,20]}},{t:1,pose:{wristL:[-25,0,60]}}]};
registerMove(base);
registerMove({...base,id:'wristPulseCheck',wristTurns:[{who:'B',hand:'L',from:.72,peak:.77,to:.80,angles:[-20,0,-20]}]});
for(const role of ['A','B'] as const)for(const t of [0,.71,.72,.73,.77,.79,.80,.81,1]){
 const before=createLocal(),after=createLocal(),mirrored=createLocal(),expected=createLocal();
 sampleMove(base.id,role,t,false,before);sampleMove('wristPulseCheck',role,t,false,after);
 for(let i=0;i<P.SIZE;i++)if(role==='A'||i<P.WRIST_L||i>P.WRIST_L+2||t<=.72||t>=.80)
  if(before[i]!==after[i])throw Error(`Unrelated component changed: ${role}/${t}/${i}`);
 mirrorLocal(after,expected);sampleMove('wristPulseCheck',role,t,true,mirrored);
 if(expected.some((x,i)=>x!==mirrored[i]))throw Error('Mirror mismatch');
 if(role==='B'&&t===.77){
  const q=new Quaternion().setFromEuler(new Euler(before[P.WRIST_L],before[P.WRIST_L+2],before[P.WRIST_L+1],'YXZ'));
  q.multiply(new Quaternion().setFromEuler(new Euler(-Math.PI/9,0,-Math.PI/9)));
  const actual=new Quaternion().setFromEuler(new Euler(after[P.WRIST_L],after[P.WRIST_L+2],after[P.WRIST_L+1],'YXZ'));
  if(q.angleTo(actual)>1e-6)throw Error('Local quaternion correction mismatch');
 }
}
console.log('Wrist pulse: body/other role unchanged, interval isolated, mirror and peak rotation pass');
