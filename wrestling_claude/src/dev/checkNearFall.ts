import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND,type ScoreEvent} from '../sim/types';
const ok=(v:boolean,m:string)=>{if(!v)throw Error(m)};
function setup(side:0|1,lead=0){
 const events:ScoreEvent[]=[];
 const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{onScore:e=>events.push(e)},21);
 sim.phase='wrestling';sim.clock=180;sim.score[side]=lead;
 sim.bout.setReferee(side,{x:0,z:0},0);
 const p=sim.bout.position;if(p.kind!=='mat')throw Error('Expected mat');p.sub='exposed';
 return {sim,p,events};
}
for(const hz of [30,60,120])for(const side of [0,1] as const){
 for(const [seconds,points] of [[1.9,0],[2.1,2],[3.1,3],[4.1,4],[6,4]]){
  const {sim,p,events}=setup(side);
  for(let i=0;i<Math.round(seconds*hz);i++)sim.tick(1/hz,[NO_COMMAND,NO_COMMAND]);
  ok(sim.score[side]===0&&events.length===0,'count does not prematurely award points');
  ok(p.awarded===points,'correct earned count');
  ok(sim.earnedNearFallPoints===points,'HUD exposes the pending earned count');
  sim.bout.setReferee(side,{x:0,z:0},0);sim.tick(1/hz,[NO_COMMAND,NO_COMMAND]);
  ok(sim.score[side]===points,'released hold awards the full count once');
  ok(sim.earnedNearFallPoints===0,'HUD pending count clears after release');
  ok(events.length===(points?1:0),'one near-fall scoring event per hold');
  sim.tick(1/hz,[NO_COMMAND,NO_COMMAND]);ok(sim.score[side]===points,'no duplicated award');
 }
 const {sim}=setup(side,13);
 for(let i=0;i<hz*4.1;i++)sim.tick(1/hz,[NO_COMMAND,NO_COMMAND]);
 ok(!sim.result&&sim.score[side]===13,'tech margin pending while hold remains');
 sim.bout.setReferee(side,{x:0,z:0},0);sim.tick(1/hz,[NO_COMMAND,NO_COMMAND]);
 ok(sim.result?.type==='technical-fall'&&sim.result.score[side]===17,'hold release completes technical fall');
 const pin=setup(side,13);
 for(let i=0;i<hz*12&&!pin.sim.result;i++)pin.sim.tick(1/hz,side===0?[{...NO_COMMAND,shoot:true,sustainedEffort:true},NO_COMMAND]:[NO_COMMAND,{...NO_COMMAND,shoot:true,sustainedEffort:true}]);
 ok(pin.sim.result?.type==='fall','active pin opportunity survives earned technical-fall margin');
 const buzzer=setup(side,13);buzzer.sim.clock=3.5;
 for(let i=0;i<hz*4&&!buzzer.sim.result;i++)buzzer.sim.tick(1/hz,[NO_COMMAND,NO_COMMAND]);
 ok(buzzer.sim.result?.type==='technical-fall'&&buzzer.sim.result.score[side]===16,'buzzer settles earned points before period change');
}
console.log('NCAA2/3/4 earned counts, release-only award, no double count, tech release/buzzer and fall opportunity pass at30/60/120Hz');
