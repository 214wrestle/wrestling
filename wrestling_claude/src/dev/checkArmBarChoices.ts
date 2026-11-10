import {MatchSim} from '../sim/MatchSim';
import {readPrompts} from '../game/prompts';
import {ARM_BAR_LABELS,ARM_BAR_GRIP_RELEASE} from '../sim/armBars';
import {Bout} from '../sim/bout';
import {ARM_BARS} from '../sim/armBars';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
for(const style of ARM_BARS)for(const mirror of [false,true]){
 let wins=0,losses=0;
 for(let seed=1;seed<=100;seed++){
  let scores=0;
  const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{score:()=>scores++},Math.imul(seed,2654435761)>>>0);
  b.setReferee(0,{x:0,z:0},0);
  if(b.position.kind!=='mat')throw Error('setup');
  Object.assign(b.position,{sub:'flat',base:.1,turnCool:0});
  b.tick(1/60,[{...NO_COMMAND,shoot:true,topTurn:{style,mirror}},NO_COMMAND]);
  const p=b.position as import('../sim/bout').Position;
  if(p.kind!=='move'||p.mirror!==mirror)throw Error('Missing selected attempt');
  if(p.id===style+'Turn')wins++;else if(p.id===style+'Resisted')losses++;else throw Error('Wrong move');
  if(scores)throw Error('Premature score');
  for(let i=0;i<150&&(b.position as import('../sim/bout').Position).kind==='move';i++)b.tick(1/60,[NO_COMMAND,NO_COMMAND]);
  const end=b.position as import('../sim/bout').Position;
  if(end.kind!=='mat')throw Error('Missing landing');
  if(p.id===style+'Turn'&&(end.turnStyle!==style||end.mirror!==mirror||end.sub!=='exposed'))throw Error('Lost selected hold');
 }
 if(!wins||!losses)throw Error('Missing outcome coverage');
 console.log(style,mirror,{wins,losses});
}

for(const style of ARM_BARS)for(const hz of [30,60,120])for(const top of [0,1] as const)for(const lead of [0,11]){
 const events:unknown[]=[];
 const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{onScore:e=>events.push(e)},21);
 sim.phase='wrestling';sim.clock=180;sim.score[top]=lead;sim.bout.setReferee(top,{x:0,z:0},0);
 const p=sim.bout.position;if(p.kind!=='mat')throw Error('Mat setup');
 p.sub='flat';
 if(readPrompts(sim,top,{style,mirror:false}).prompts.shoot.label!==ARM_BAR_LABELS[style])throw Error('Wrong turn button');
 p.sub='exposed';p.turnStyle=style;
 for(let i=0;i<Math.ceil(4.1*hz);i++)sim.tick(1/hz,[NO_COMMAND,NO_COMMAND]);
 if(sim.score[top]!==lead||sim.earnedNearFallPoints!==4)throw Error('Early near fall');
 p.fight=1.2;sim.tick(1/hz,[NO_COMMAND,NO_COMMAND]);
 let sawRelease=false;
 for(let i=0;i<hz;i++){
  const before=sim.bout.position;
  const nextU=before.kind==='move'?(before.t+1/hz)/before.dur:0;
  sim.tick(1/hz,[NO_COMMAND,NO_COMMAND]);
  const pos=sim.bout.position;
  if(sim.result&&!sawRelease){
   if(nextU<ARM_BAR_GRIP_RELEASE||sim.score[top]!==lead+4)throw Error('Early tech');
   sawRelease=true;
  }
  if(pos.kind==='move'&&pos.id==='fightOff'){
   const released=pos.t/pos.dur>=ARM_BAR_GRIP_RELEASE;
   if(sim.score[top]!==lead+(released?4:0))throw Error('Release award mismatch');
   if(released)sawRelease=true;
  }
 }
 if(!sawRelease||events.length!==1)throw Error('Missing or duplicate release award');
 if(lead===11&&sim.result?.type!=='technical-fall')throw Error('Missing tech');
}
console.log('Arm-bar labels and release-only scoring/technical falls pass for both wrestlers at 30/60/120 Hz');

const {ROSTER}=await import('../sim/roster');
for(const [name,style] of [['David Taylor','barHalf'],['Spencer Lee','wristBar']] as const){
 const w=ROSTER.find(w=>`${w.firstName} ${w.lastName}`===name);
 if(!w)throw Error('Missing specialist');
 let success=0,resisted=0;
 for(let seed=1;seed<=80;seed++){
  const sim=new MatchSim([w,PROTOTYPE_ROSTER[1]],{},Math.imul(seed,2654435761)>>>0);
  sim.phase='wrestling';sim.clock=180;sim.bout.setReferee(0,{x:0,z:0},0);
  if(sim.bout.position.kind!=='mat')throw Error('Setup');
  Object.assign(sim.bout.position,{sub:'flat',base:.1,turnCool:0});
  if(readPrompts(sim,0).prompts.shoot.label!==ARM_BAR_LABELS[style])throw Error('Specialist prompt missing');
  sim.tick(1/60,[{...NO_COMMAND,shoot:true},NO_COMMAND]);
  const p=sim.bout.position as import('../sim/bout').Position;
  if(p.kind!=='move')throw Error('No specialist attempt');
  if(p.id===style+'Turn')success++;else if(p.id===style+'Resisted')resisted++;else throw Error('Specialist defaults to generic turn');
 }
 if(!success||!resisted)throw Error('Missing specialist outcome coverage');
 console.log(name,{success,resisted});
}
const {WrestlerAI}=await import('../sim/ai');
for(const name of ['David Taylor','Spencer Lee']){
 const w=ROSTER.find(w=>`${w.firstName} ${w.lastName}`===name)!;
 const b=new Bout([w,PROTOTYPE_ROSTER[1]],{},123);
 b.setReferee(0,{x:0,z:0},0);
 if(b.position.kind!=='mat')throw Error('Setup');
 b.position.base=.1;b.position.control=.8;
 const ai=new WrestlerAI(0,'starter',77);
 let brokeDown=false;
 for(let i=0;i<120;i++){
  const cmd=ai.update(1/60,b,true);
  b.tick(1/60,[cmd,NO_COMMAND]);
  const pos=b.position as import('../sim/bout').Position;
  if(pos.kind==='move'){
   if(pos.id!=='breakdown')throw Error('Bar specialist skips setup');
   brokeDown=true;break;
  }
 }
 if(!brokeDown)throw Error('Bar specialist failed to set up');
}
console.log('Specialist AI finishes breakdown before starting its bar series');
