import {registerMove,sampleMove,type MoveClip} from '../anim/clips';
import {createLocal,mirrorLocal} from '../anim/spec';
import {P} from '../anim/posture';
const base:MoveClip={id:'elbowOffsetBase',A:[{t:0,pose:{}},{t:1,pose:{}}],B:[{t:0,pose:{elbowL:[.4,.18,.43]}},{t:1,pose:{elbowL:[.5,.28,.5]}}]};
registerMove(base);
registerMove({...base,id:'elbowOffsetTrial',elbowOffsets:[{who:'B',hand:'L',from:.86,peak:.90,to:.94,offset:[.07,.07,.05]}]});
for(const role of ['A','B'] as const)for(const t of [0,.8,.86,.88,.90,.92,.94,1]){
 const a=createLocal(),b=createLocal(),mirror=createLocal(),expected=createLocal();
 sampleMove(base.id,role,t,false,a);sampleMove('elbowOffsetTrial',role,t,false,b);
 for(let i=0;i<P.SIZE;i++)if(role==='A'||i<P.ELBOW_L||i>P.ELBOW_L+2||t<=.86||t>=.94)if(a[i]!==b[i])throw Error('Offset leaked outside intended role/channel/time');
 mirrorLocal(b,expected);sampleMove('elbowOffsetTrial',role,t,true,mirror);
 if(expected.some((x,i)=>x!==mirror[i]))throw Error('Mirror mismatch');
 if(role==='B'&&t===.90)for(const [i,v] of [.07,.07,.05].entries())if(Math.abs(b[P.ELBOW_L+i]-a[P.ELBOW_L+i]-v)>1e-6)throw Error('Wrong peak');
}
console.log('Elbow offsets preserve other channels, roles, outside interval and mirror correctly');
