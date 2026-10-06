/** Paired seeded full matches isolate rating strength from athlete style/name. */
import { MatchSim } from '../sim/MatchSim';
import { WrestlerAI } from '../sim/ai';
import { PROTOTYPE_ROSTER } from '../sim/roster';
import type { Wrestler } from '../sim/types';
const dt=1/60;
function athlete(rating:number,id:string):Wrestler {
 const v=rating/100;
 return {...PROTOTYPE_ROSTER[0],id,firstName:'Rating',lastName:id,motion:undefined,rating,
 attributes:{quickness:v,strength:v,conditioning:v,mat:v,defense:v}};
}
for(const high of [85,96]){
 let wins=0,completed=0,margin=0;
 for(let seed=0;seed<100;seed++){
  const side=(seed%2) as 0|1;
  const pair:[Wrestler,Wrestler]=side===0?[athlete(high,'A'),athlete(85,'B')]:[athlete(85,'B'),athlete(high,'A')];
  const ais=[new WrestlerAI(0,'starter',2000+seed*2),new WrestlerAI(1,'starter',2001+seed*2)];
  const sim=new MatchSim(pair,{onTell:(to,what)=>ais[to].onTell(what),onResult:r=>{completed++;wins+=Number(r.winner===side);margin+=r.score[side]-r.score[side===0?1:0];}},1000+seed);
  sim.humanSide=0;sim.startIntros();sim.skipIntros();
  for(let i=0;i<60*60*15&&sim.phase!=='results';i++){
   if(sim.phase==='positionChoice')sim.choosePosition((['neutral','top','bottom'] as const)[seed%3]);
   sim.tick(dt,[ais[0].update(dt,sim.bout,sim.phase==='wrestling'),ais[1].update(dt,sim.bout,sim.phase==='wrestling')]);
  }
 }
 if(completed!==100)throw Error('Unfinished rating-impact matches');
 console.log(JSON.stringify({rating:high,opponent:85,matches:completed,wins,averageMargin:margin/completed}));
}
