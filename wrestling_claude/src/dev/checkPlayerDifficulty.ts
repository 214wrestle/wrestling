import {MatchSim} from '../sim/MatchSim';
import {WrestlerAI,type Difficulty} from '../sim/ai';
// Frozen pre-change AI provides the same player input policy before and after.
import {WrestlerAI as PlayerAI} from './learningPlayer';
import {ROSTER} from '../sim/roster';
import {playableMatchup} from '../sim/playerDifficulty';
const results=[];
for(const difficulty of ['walk-on','starter','all-american'] as Difficulty[]){
 const row={difficulty,higher:{wins:0,matches:0},lower:{wins:0,matches:0},unfinished:0};
 for(let m=0;m<40;m++){
  const weights=[...new Set(ROSTER.map(w=>w.weightClass))];const weight=weights[m%weights.length];
  const pool=ROSTER.filter(w=>w.weightClass===weight).sort((a,b)=>(a.rating??0)-(b.rating??0));
  const high=pool.at(-1)!,low=pool[0];const higher=m%2===0;const pair=playableMatchup(higher?[high,low]:[low,high],0,difficulty);
  const player=new PlayerAI(0,'starter',4000+m*2),opponent=new WrestlerAI(1,difficulty,4001+m*2);
  const sim=new MatchSim(pair,{onTell:(side,what)=>(side===0?player:opponent).onTell(what)},3000+m);
  sim.humanSide=0;sim.startIntros();sim.skipIntros();
  for(let i=0;i<54000&&sim.phase!=='results';i++){
   if(sim.phase==='positionChoice')sim.choosePosition('top');
   const active=sim.phase==='wrestling';sim.tick(1/60,[player.update(1/60,sim.bout,active),opponent.update(1/60,sim.bout,active)]);
  }
  const band=higher?row.higher:row.lower;band.matches++;if(sim.result?.winner===0)band.wins++;if(!sim.result)row.unfinished++;
 }
 results.push(row);
}
console.log(JSON.stringify(results,null,2));
