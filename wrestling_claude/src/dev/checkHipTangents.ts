function assert(condition:boolean,message="Assertion failed"){if(!condition)throw Error(message);}
import {compileTrack,createLocal,sampleTrack,type Key} from '../anim/spec';
import {P} from '../anim/posture';
const keys:Key[]=[{t:0,pose:{hips:[.13,.345,-.14]}},{t:.14,pose:{hips:[.2,.36,-.13]}},{t:.28,pose:{hips:[.28,.38,-.12]}},{t:.44,pose:{hips:[.4,.39,.04]}}];
const original=compileTrack(keys,null);
const changed=keys.map(k=>({...k,pose:{...k.pose}}));changed[2].pose.hips=[.38,.38,-.20];
const automatic=compileTrack(changed,null);
changed[1].hipsVelocity=[(.28-.13)/.28,(.38-.345)/.28,(-.12+.14)/.28];
const fixed=compileTrack(changed,null),a=createLocal(),b=createLocal(),c=createLocal();
for(let i=0;i<=140;i++){const t=i/1000;sampleTrack(original,t,a);sampleTrack(fixed,t,b);for(let j=0;j<3;j++)assert(Math.abs(a[P.HIPS+j]-b[P.HIPS+j])<1e-7,'Opening path changed');}
for(let i=0;i<=440;i++){sampleTrack(automatic,i/1000,a);sampleTrack(fixed,i/1000,b);for(let j=0;j<P.SIZE;j++)if(j<P.HIPS||j>=P.HIPS+3)assert(a[j]===b[j],'Unrelated channel changed');}
const dt=.0001;sampleTrack(fixed,.14-dt,a);sampleTrack(fixed,.14,b);sampleTrack(fixed,.14+dt,c);
for(let j=0;j<3;j++)assert(Math.abs((b[P.HIPS+j]-a[P.HIPS+j])/dt-(c[P.HIPS+j]-b[P.HIPS+j])/dt)<.01,'Velocity discontinuity');
const legacy={...automatic,hipsVelocity:undefined};for(let i=0;i<=440;i++){sampleTrack(automatic,i/1000,a);sampleTrack(legacy,i/1000,b);assert(a.every((value,index)=>value===b[index]),"Default interpolation changed");}
console.log('Hip tangent preserves opening path, joins velocity continuously and leaves unrelated/default channels unchanged');
// Explicit velocities must not defeat authored stops or impact easing.
for(const mode of ['stop','land'] as const){
 const withOverride=keys.map(k=>({...k,pose:{...k.pose}}));
 withOverride[1][mode]=true;withOverride[1].hipsVelocity=[9,8,7];
 const withoutOverride=withOverride.map(k=>({...k,hipsVelocity:undefined}));
 const x=compileTrack(withOverride,null),y=compileTrack(withoutOverride,null);
 const until=mode==='land'?.14:.28;
 for(let i=0;i<=Math.round(until*1000);i++){
  sampleTrack(x,i/1000,a);sampleTrack(y,i/1000,b);
  for(let j=0;j<3;j++)assert(a[P.HIPS+j]===b[P.HIPS+j],`${mode} precedence changed`);
 }
}
console.log('Stop and incoming landing precedence verified');
