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

// Overlapping touch controls must not buy three escapes or spend three efforts.
for (const sub of ['exposed','spladle'] as const) for (const hz of [30,60,120]) {
 const run=(all:boolean)=>{
  const feedback:string[]=[];
  const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{feedback:(side,button)=>{if(side===1)feedback.push(button)}},21);
  b.position={kind:'mat',A:0,sub,t:0,frame:{x:0,z:0,yaw:0},base:.4,control:.5,escape:0,expo:0,awarded:0,pin:.5,pinHold:0,fight:0,commit:0,basing:0,turnCool:0,intensity:0};
  for(let i=0;i<hz*.6;i++)b.tick(1/hz,[NO_COMMAND,{...NO_COMMAND,sprawl:true,fight:all,shoot:all,sustainedEffort:true}]);
  return {stamina:b.athletes[1].stamina,p:b.position as Extract<Position,{kind:'mat'}>,feedback};
 };
 const one=run(false),all=run(true);
 ok(Math.abs(one.stamina-all.stamina)<1e-9,`${sub}/${hz}: overlapping controls cost one effort`);
 ok(Math.abs(one.p.fight-all.p.fight)<1e-9&&Math.abs(one.p.pin-all.p.pin)<1e-9,`${sub}/${hz}: no stacked resistance advantage`);
 for(const button of ['shoot','fight','sprawl'])ok(all.feedback.includes(button),`${sub}/${hz}: ${button} acknowledged`);
}
console.log('Concurrent pin-defense inputs acknowledge every button with one effort at30/60/120Hz');

// Squeezing is work for the top wrestler; fatigue affects both sides' pin leverage.
for(const hz of [30,60,120]) {
 const effort=(side:0|1,gas:number,all=false)=>{
  const events:string[]=[];
  const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{feedback:(s,button)=>events.push(`${s}:${button}`)},21);
  b.position={kind:'mat',A:0,sub:'exposed',t:0,frame:{x:0,z:0,yaw:0},base:.4,control:.5,escape:0,expo:0,awarded:0,pin:.5,pinHold:0,fight:0,commit:0,basing:0,turnCool:0,intensity:0};
  b.athletes[side].stamina=gas;
  const cmd={...NO_COMMAND,fight:true,shoot:all,sustainedEffort:true};
  for(let i=0;i<hz*.5;i++)b.tick(1/hz,side===0?[cmd,NO_COMMAND]:[NO_COMMAND,cmd]);
  return {pin:(b.position as Extract<Position,{kind:'mat'}>).pin,gas:b.athletes[side].stamina,events};
 };
 const fresh=effort(0,1),tired=effort(0,.05),both=effort(0,1,true);
 ok(fresh.gas<.99,'repeated squeeze consumes top stamina');
 ok(fresh.pin>tired.pin,'fatigue reduces top squeezing force');
 ok(effort(1,1).pin<effort(1,.05).pin,'fatigue reduces defensive shoulder relief');
 ok(Math.abs(fresh.gas-both.gas)<1e-9&&Math.abs(fresh.pin-both.pin)<1e-9,'two squeeze controls remain one effort');
 ok(both.events.includes('0:shoot')&&both.events.includes('0:fight'),'both squeeze controls acknowledge effort');
}
console.log('Pin effort costs and fatigue-dependent force pass at30/60/120Hz');

// Retention contests the defender's grip work; loosening the hold earns relief.
for(const hz of [30,60,120]) {
 const contest=(tighten:boolean,gripEscape:number)=>{
  const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},21);
  b.position={kind:'mat',A:0,sub:'exposed',t:0,frame:{x:0,z:0,yaw:0},base:.4,control:.5,escape:0,expo:0,awarded:0,pin:.5,pinHold:0,fight:gripEscape,commit:0,basing:0,turnCool:0,intensity:0};
  b.tick(1/hz,[{...NO_COMMAND,shoot:tighten},{...NO_COMMAND,fight:true}]);
  return b.position as Extract<Position,{kind:'mat'}>;
 };
 ok(contest(true,.4).fight<contest(false,.4).fight,'active tightening preserves grip against the same defensive effort');
 ok(contest(false,.7).pin<contest(false,.1).pin,'looser grip gives defender more shoulder relief');
}
console.log('Grip retention and earned shoulder relief checked at30/60/120Hz');

// Leg-drive holds must receive the same repeated effort as rapid taps;
// otherwise holding only helps the defender while attack taps get extra gains.
function legDrive(mode:'hold'|'tap'|'plain',side:0|1,hz:number){
 const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},21);
 b.position={kind:'legs',A:side,shot:'double',mirror:false,t:0,frame:{x:0,z:0,yaw:0},progress:.3,intensity:.5};
 for(let i=0;i<Math.round(.9*hz);i++){
  const shoot=mode!=='tap'||i%Math.round(.18*hz)===0;
  const attack={...NO_COMMAND,moveZ:1,shoot,sustainedEffort:mode==='hold'};
  b.tick(1/hz,side===0?[attack,{...NO_COMMAND}]:[{...NO_COMMAND},attack]);
 }
 if(b.position.kind!=='legs')throw Error('Leg-drive comparison left contested position');
 return b.position.progress;
}
for(const side of [0,1] as const)for(const hz of [30,60,120]){
 const hold=legDrive('hold',side,hz);
 ok(hold>legDrive('plain',side,hz)+.05,'held drive repeats effort for either attacker');
 ok(Math.abs(hold-legDrive('tap',side,hz))<.04,'held drive and taps have comparable progress');
 ok(Math.abs(hold-legDrive('hold',side,60))<.04,'leg-drive hold is frame-rate stable');
}
console.log('Leg-drive hold/tap effort parity verified for both attackers at30/60/120Hz');
