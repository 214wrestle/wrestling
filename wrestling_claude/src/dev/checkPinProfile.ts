/** Isolate sourced pin pressure from rating, motion and AI differences. */
function assert(value:unknown,message='Pin profile assertion failed'):asserts value {if(!value)throw new Error(message);}
import {Bout} from '../sim/bout';
import {PROTOTYPE_ROSTER, ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import {pinningMultiplier, OWNER_ELITE_PINNERS, PIN_HISTORY} from '../sim/careerAwards';
function pressure(name:string|undefined,side:0|1,sub:'exposed'|'spladle',hz:number,defend=false){
 const wrestlers=PROTOTYPE_ROSTER.slice(0,2).map(w=>({...w,firstName:name?.split(' ')[0]??'Control',lastName:name?.split(' ').slice(1).join(' ')??'Athlete'})) as [typeof PROTOTYPE_ROSTER[number],typeof PROTOTYPE_ROSTER[number]];
 const b=new Bout(wrestlers,{},12);
 b.position={kind:'mat',A:side,sub,t:0,frame:{x:0,z:0,yaw:0},base:.4,control:.5,escape:0,expo:0,awarded:0,pin:0,pinHold:0,fight:0,commit:0,basing:0,turnCool:0,intensity:0};
 for(let i=0;i<hz/2;i++){
  const commands=[{...NO_COMMAND},{...NO_COMMAND}] as [typeof NO_COMMAND,typeof NO_COMMAND];
  commands[side]={...NO_COMMAND,shoot:true,sustainedEffort:true};
  if(defend)commands[(1-side) as 0|1]={...NO_COMMAND,sprawl:true,sustainedEffort:true};
  b.tick(1/hz,commands);
 }
 assert(b.position.kind==='mat');
 return b.position.pin;
}
const eliteNames=Object.keys(OWNER_ELITE_PINNERS);
assert(eliteNames.length===23);
for(const name of eliteNames){
 assert(ROSTER.some(w=>`${w.firstName} ${w.lastName}`===name),name+' must already exist');
 assert(pinningMultiplier(name)===1.4,name+' must receive elite pressure');
}
for(const [name,history] of Object.entries(PIN_HISTORY)){
 if(Object.hasOwn(OWNER_ELITE_PINNERS,name))continue;
 const rate=history.falls!==undefined&&history.bouts?history.falls/history.bouts:0;
 assert(pinningMultiplier(name)===Math.min(1.4,1+rate*.5+(history.gorriaranYears?.length?.1:0)),name+' changed unexpectedly');
}
assert(pinningMultiplier('Unknown Athlete')===1);
for(const name of [...eliteNames,'Spencer Lee'])for(const side of [0,1] as const)for(const sub of ['exposed','spladle'] as const)for(const hz of [30,60,120]){
 const control=pressure(undefined,side,sub,hz),profile=pressure(name,side,sub,hz);
 assert(control>0);
 assert(profile>control,'Verified fall history must increase actual pin pressure with identical attributes and inputs');
 assert(profile<1,'Half a second of squeezing must not immediately establish a fall');
 if(sub==='spladle')assert(pressure(name,side,sub,hz,true)===0,'A protected shoulder must prevent pin buildup');
}
console.log('PASS: 23 existing elite pinners; unchanged nonmembers; actual exposed/spladle pressure, both sides, 30/60/120 Hz; no instant falls; shoulder defense preserved.');
