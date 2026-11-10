/** Full bouts with equal styles and each seed replayed on both sides.
 * Synthetic ratings exercise the roster's rating/100 attribute mapping; these
 * fixtures never alter career evidence or the playable roster.
 */
import { MatchSim } from '../sim/MatchSim';
import { WrestlerAI } from '../sim/ai';
import { PROTOTYPE_ROSTER } from '../sim/roster';
import type { Wrestler, Side } from '../sim/types';
const dt=1/60, seeds=100;
function athlete(rating:number,id:string,weightClass:number):Wrestler {
 const v=rating/100;
 return {...PROTOTYPE_ROSTER[0],id,firstName:'Rating',lastName:id,motion:undefined,rating,weightClass,
 attributes:{quickness:v,strength:v,conditioning:v,mat:v,defense:v}};
}
for(const [high,low,weight] of [[85,85,157],[90,85,157],[96,85,157],[96,85,125],[96,85,285]]){
 let wins=0,completed=0,margin=0,numerical=0,total=0;
 const sideWins=[0,0],results:Record<string,number>={};
 for(let seed=0;seed<seeds;seed++)for(const side of [0,1] as const){
  const opponent=(1-side) as Side;
  const pair:[Wrestler,Wrestler]=side===0?[athlete(high,'A',weight),athlete(low,'B',weight)]:[athlete(low,'B',weight),athlete(high,'A',weight)];
  // Hold corner RNG and choice policy fixed; only exchange the ratings.
  // Equal-rating replays must therefore split designated-athlete wins 50/50.
  const ais=[new WrestlerAI(0,'starter',2000+seed*2),new WrestlerAI(1,'starter',2001+seed*2)];
  const sim=new MatchSim(pair,{onTell:(to,what)=>ais[to].onTell(what),onResult:r=>{
   completed++;wins+=Number(r.winner===side);sideWins[side]+=Number(r.winner===side);
   margin+=r.score[side]-r.score[opponent];results[r.type]=(results[r.type]??0)+1;
   if(r.type!=='fall'){numerical++;total+=r.score[0]+r.score[1];}
  }},1000+seed);
  sim.humanSide=0;sim.startIntros();sim.skipIntros();
  for(let i=0;i<60*60*15&&sim.phase!=='results';i++){
   if(sim.phase==='positionChoice')sim.choosePosition((['neutral','top','bottom'] as const)[seed%3]);
   const live=sim.phase==='wrestling';
   sim.tick(dt,[ais[0].update(dt,sim.bout,live,{timeLeft:sim.clock,finalPeriod:sim.period>=3,deficit:sim.score[1]-sim.score[0]}),ais[1].update(dt,sim.bout,live,{timeLeft:sim.clock,finalPeriod:sim.period>=3,deficit:sim.score[0]-sim.score[1]})]);
  }
 }
 if(completed!==seeds*2)throw Error(`Unfinished rating-impact matches at${high}/${low}/${weight}`);
 if(high===low&&wins!==seeds)throw Error('Equal-rating replay has an uncontrolled difference');
 console.log(JSON.stringify({rating:high,opponent:low,weight,matches:completed,wins,winPercent:100*wins/completed,winsAsRed:sideWins[0],winsAsGreen:sideWins[1],averageMargin:margin/completed,numericalCombined:total/numerical,results}));
}
