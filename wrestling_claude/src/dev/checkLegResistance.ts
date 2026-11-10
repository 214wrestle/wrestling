import {Bout} from '../sim/bout';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND, type Side, type Command} from '../sim/types';
const ok=(v:boolean,m:string)=>{if(!v)throw Error(m)};
function sample(hz:number, side:Side, defense:number, gas:number, resisting=true,burst=true){
 const ws=PROTOTYPE_ROSTER.slice(0,2).map(w=>({...w,attributes:{...w.attributes}})) as [typeof PROTOTYPE_ROSTER[number],typeof PROTOTYPE_ROSTER[number]];
 const defender=side===0?1:0;
 ws[defender].attributes.defense=defense;
 const b=new Bout(ws,{},21);
 b.position={kind:'legs',A:side,shot:'double',mirror:side===1,t:0,frame:{x:0,z:0,yaw:0},progress:.5,intensity:.5};
 b.athletes[defender].stamina=gas;
 const commands:[Command,Command]=[{...NO_COMMAND},{...NO_COMMAND}];
 commands[side]={...NO_COMMAND,shoot:true,sustainedEffort:burst};
 commands[defender]={...NO_COMMAND,sprawl:resisting,sustainedEffort:resisting};
 for(let i=0;i<hz*.6;i++)b.tick(1/hz,commands);
 ok(b.position.kind==='legs','brief balanced contest remains engaged');
 if(b.position.kind!=='legs')throw Error('unreachable');
 return {progress:b.position.progress,gas:b.athletes[side].stamina};
}
for(const side of [0,1] as const){
 const values=[];
 for(const hz of [30,60,120]){
  const strong=sample(hz,side,.95,1).progress,weak=sample(hz,side,.25,1).progress,tired=sample(hz,side,.95,.2).progress,idle=sample(hz,side,.95,1,false).progress;
  ok(strong<weak,'better defense resists more');
  ok(strong<tired,'fatigue weakens resistance');
  ok(strong<idle,'holding sprawl opposes drive');
  ok(sample(hz,side,.95,1,true,true).gas < sample(hz,side,.95,1,true,false).gas,'repeated finishing bursts cost more than maintaining drive');
  values.push(strong);
 }
 ok(Math.max(...values)-Math.min(...values)<.015,'leg resistance is stable across frame rates');
}
console.log('Leg resistance responds to defense, fatigue and held input on both sides at30/60/120Hz');
