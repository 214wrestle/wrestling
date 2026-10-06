import { Bout, type Position } from '../sim/bout';
import { PROTOTYPE_ROSTER } from '../sim/roster';
import { NO_COMMAND } from '../sim/types';
const ok=(v:boolean,m:string)=>{if(!v)throw Error(m)};
function trial(sub:'standing'|'exposed',mode:'hold'|'tap'|'plain',side:0|1,dt=1/60){
 const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},21);
 b.position={kind:'mat',A:0,sub,t:0,frame:{x:0,z:0,yaw:0},base:.4,control:.5,escape:0,expo:0,awarded:0,pin:0,pinHold:0,fight:0,commit:0,basing:0,turnCool:0,intensity:0};
 for(let i=0;i<Math.round(.9/dt);i++){
  const c={...NO_COMMAND,fight:mode==='tap'?i%Math.round(.18/dt)===0:true,sustainedEffort:mode==='hold'};
  b.tick(dt,side===0?[c,{...NO_COMMAND}]:[{...NO_COMMAND},c]);
 }
 return {p:b.position as Extract<Position,{kind:'mat'}>,stamina:b.athletes[side].stamina};
}
for(const sub of ['standing','exposed'] as const){
 const hold=trial(sub,'hold',1),plain=trial(sub,'plain',1),tap=trial(sub,'tap',1);
 const value=(r:typeof hold)=>sub==='standing'?r.p.escape:r.p.fight;
 ok(value(hold)>value(plain),'holding builds defensive struggle effort: '+sub);
 ok(Math.abs(value(hold)-value(tap))<.14,'rapid taps and hold both help: '+sub);
 ok(hold.stamina<plain.stamina,'repeated defensive effort costs stamina');
 ok(Math.abs(value(hold)-value(trial(sub,'hold',1,1/30)))<.04,'hold cadence stable across frame rates');
}
ok(trial('exposed','hold',0).p.pin>trial('exposed','plain',0).p.pin,'holding adds offensive pin pressure');
console.log('Touch hold and rapid taps improve grip/back struggles; stamina and frame-rate checks passed');
