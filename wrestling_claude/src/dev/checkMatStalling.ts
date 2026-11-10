// Stalling on the mat (owner, November 9): the top man must return a standing opponent to the mat within 5-7 s
// (by referee), and the bottom man must work to get out; lying flat without working up is called sooner.
import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;

function onMat(seed:number){
  const stalls:number[]=[];
  const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{onScore:(e:any)=>{if(e.kind==='stalling')stalls.push(e.side)}} as any,seed);
  sim.humanSide=0;
  sim.phase='setPosition';sim.phaseT=0;sim.phaseDur=0.01;
  sim.bout.setReferee(0,{x:0,z:0},0);
  sim.tick(0.02,[NO_COMMAND,NO_COMMAND]);
  return {sim,stalls};
}

// Top holds him standing and never returns him: called within the referee's 5-7 s, and they restart on their feet.
{
  let called=0;
  for(const seed of [3,4,5,6,7,8]){
    const {sim}=onMat(seed);
    const s=sim.bout.position as any;s.sub='standing';s.escape=0;s.control=0.9;
    const limit=sim.referee.id==='strict'?5:sim.referee.id==='lenient'?7:6;
    let t=0;
    for(;t<limit+1.5&&sim.phase==='wrestling'&&(sim.bout.position as any).sub==='standing';t+=DT)sim.tick(DT,[NO_COMMAND,NO_COMMAND]);
    if(sim.phase==='whistle'&&sim.bout.athletes[0].stallWarned&&t>=limit-0.1)called++;
  }
  ok(called===6,`a top man who holds him standing past the referee's limit is called, restart on the feet (${called}/6)`);
}
// Bottom does nothing while the top man keeps trying turns (so only the bottom man is stalling).
{
  const {sim,stalls}=onMat(21);
  let warnedAt=-1,t=0;
  for(;t<90&&sim.phase==='wrestling'&&sim.bout.position.kind==='mat';t+=DT){
    const tryTurn=Math.floor(t/4)!==Math.floor((t-DT)/4);
    sim.tick(DT,[{...NO_COMMAND,shoot:tryTurn} as Command,NO_COMMAND]);
    if(warnedAt<0&&sim.bout.athletes[1].stallWarned)warnedAt=t;
  }
  ok(warnedAt>10&&warnedAt<45,`a bottom man who does not work to get out is warned (${warnedAt.toFixed(1)} s)`);
  ok(!sim.bout.athletes[0].stallWarned&&!stalls.includes(1),'a top man trying turns is not the one called');
}
// Bottom working (a stand-up try every few seconds) is never called.
{
  const {sim}=onMat(22);
  for(let t=0;t<40&&sim.phase==='wrestling'&&sim.bout.position.kind==='mat';t+=DT){
    const go=Math.floor(t/5)!==Math.floor((t-DT)/5);
    sim.tick(DT,[{...NO_COMMAND,shoot:Math.floor(t/4)!==Math.floor((t-DT)/4)} as Command,{...NO_COMMAND,shoot:go} as Command]);
  }
  ok(!sim.bout.athletes[1].stallWarned,'a bottom man who keeps trying to get out is not called');
}
console.log('Mat stalling: top returns him within 5-7 s or is called; bottom must work to get out');
