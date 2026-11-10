// Owner, November 10: the bottom man lay on his belly a lot with no visible work, and should be stalled for lying flat.
// Lying flat builds a stall call; pushing that gets nowhere only slows it; a push shows (heave); chops faster than a
// man can chop hit for less, so tapping cannot pin him flat; back on his base the AI goes right away.
import {CHOP_PACE} from '../sim/bout';
import {MatchSim, FLAT_STALL} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const cmd=(c:Partial<Command>):Command=>({...NO_COMMAND,...c});
function live(sub:'flat'|'ride',base:number){
  const sim:any=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{} as any,5);
  sim.humanSide=0;sim.startIntros();sim.skipIntros();
  for(let i=0;i<4000&&sim.phase!=='wrestling';i++){if(sim.phase==='positionChoice')sim.choosePosition('neutral');sim.tick(DT,[NO_COMMAND,NO_COMMAND]);}
  sim.referee={id:'average',label:'',patience:40,rate:1};
  sim.bout.position=sim.bout.matPosition(0,{x:0,z:0,yaw:0},sub,base);
  return sim;
}
// Flat, doing nothing (the top man keeps him flat): warned well inside 13 s.
{
  const sim=live('flat',0);let t=0;
  for(;t<13&&!sim.bout.athletes[1].stallWarned;t+=DT){sim.bout.position.base=0;sim.tick(DT,[cmd({}),cmd({})]);}
  ok(sim.bout.athletes[1].stallWarned,`lying flat: a stalling warning (${t.toFixed(1)} s)`);
}
// Flat but pushing every half second, held down anyway: not yet by 13 s.
{
  const sim=live('flat',0);let i=0;
  for(let t=0;t<13;t+=DT,i++){sim.bout.position.base=0;sim.tick(DT,[cmd({}),cmd({sprawl:i%30===0})]);}
  ok(!sim.bout.athletes[1].stallWarned,`pushing up but held flat: no warning by 13 s (count runs at ${FLAT_STALL.pushing})`);
}
// A push shows: the heave.
{
  const sim=live('flat',0.1);
  sim.tick(DT,[cmd({}),cmd({sprawl:true})]);
  ok((sim.bout.position.heave??0)>0.5,'a push up shows as a heave');
}
// Rushed chops hit for less than paced ones.
{
  const loss=(gap:number)=>{const sim=live('ride',1);const b0=sim.bout.position.base;
    sim.tick(DT,[cmd({fight:true}),cmd({})]);for(let t=0;t<gap;t+=DT)sim.tick(DT,[cmd({}),cmd({})]);
    const b1=sim.bout.position.base;sim.tick(DT,[cmd({fight:true}),cmd({})]);return [b0-b1,b1-sim.bout.position.base];};
  const [first,rushed]=loss(0.15);const [,paced]=loss(0.6);
  ok(rushed<paced*CHOP_PACE.rush*1.6&&rushed<first*0.6,`a chop 0.15 s after the last hits less (${rushed.toFixed(3)} vs ${paced.toFixed(3)} paced)`);
}
console.log('Lying flat is stalling, pushes show, rushed chops hit for less');
