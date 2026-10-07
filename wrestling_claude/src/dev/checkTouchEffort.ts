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

// Fight squeeze must flash Fight, and repeated defense drains gas and loses leverage.
let feedbackButton = '';
const pinBout = new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]], {feedback: (_side, button) => {feedbackButton=button}},21);
function exposed(stamina:number){
 pinBout.setReferee(0,{x:0,z:0},0);
 pinBout.position={kind:'mat',A:0,sub:'exposed',t:0,frame:{x:0,z:0,yaw:0},base:.4,control:.5,escape:0,expo:0,awarded:0,pin:.4,pinHold:0,fight:0,commit:0,basing:0,turnCool:0,intensity:0};
 pinBout.athletes[1].stamina=stamina;
 pinBout.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND}]);
}
exposed(1);
pinBout.tick(1/60,[{...NO_COMMAND,fight:true},{...NO_COMMAND}]);
ok(feedbackButton==='fight','Fight squeeze reports the actual button');
function resist(stamina:number){
 exposed(stamina);
 pinBout.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND,fight:true}]);
 return (pinBout.position as Extract<Position,{kind:'mat'}>).fight;
}
ok(resist(1)>resist(.05),'tired defender gains less escape progress per effort');
console.log('Correct squeeze feedback and declining defensive leverage verified');


// Resolve the attacker's acknowledgment as well as the defender's success.
for(const attacker of [0,1] as const) for(const phase of ['entry','legs'] as const) {
 const events: string[]=[];
 const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{feedback:(side,button,result)=>events.push(`${side}:${button}:${result}`)},21);
 b.position=phase==='entry'
  ?{kind:'shot',A:attacker,shot:'single',mirror:false,t:0,dur:.6,frame:{x:0,z:0,yaw:0},quality:0,dist:.8,sprawlAt:0,stuffRoll:0}
  :{kind:'legs',A:attacker,shot:'single',mirror:false,t:0,frame:{x:0,z:0,yaw:0},progress:-.1,intensity:.5};
 b.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND}]);
 ok(events.includes(`${attacker}:shoot:lost`),`${phase}: attacker sees resisted result`);
 ok(events.includes(`${1-attacker}:sprawl:won`),`${phase}: defender sees successful result`);
 ok((b.position as Position).kind==='move',`${phase}: normal defensive move still starts`);
}
console.log('Stuffed entries and defended leg finishes notify both wrestlers');
