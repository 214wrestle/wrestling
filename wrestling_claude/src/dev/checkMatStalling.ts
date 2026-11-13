// Stalling on the mat (owner, November 9): the top man must return a standing opponent to the mat within 5-7 s
// (by referee), and the bottom man must work to get out; lying flat without working up is called sooner.
import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND,otherSide} from '../sim/types';
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

// Top holds him standing and never returns him: called within the referee's 5-7 s. Owner, November 12: "It can be
// called during action and should not stop the match/action. They wrestle through the stall call" (and the point:
// "Action shouldn't stop when the stalling point is awarded either"). No whistle, the same man still on top, and
// another limit later the point, still wrestling.
{
  let called=0,through=0,pointed=0;
  for(const seed of [3,4,5,6,7,8]){
    const {sim,stalls}=onMat(seed);
    const top=(sim.bout.position as any).A;
    const hold=()=>{const s=sim.bout.position as any;if(s.kind==="mat"&&s.sub==="standing"){s.escape=0;s.control=0.9;s.frame.x=0;s.frame.z=0;}};
    {const s=sim.bout.position as any;s.sub='standing';}
    const limit=sim.referee.id==='strict'?5:sim.referee.id==='lenient'?7:6;
    let t=0;
    for(;t<limit+1.5&&sim.phase==='wrestling'&&!sim.bout.athletes[top].stallWarned;t+=DT){hold();sim.tick(DT,[NO_COMMAND,NO_COMMAND]);}
    const p=sim.bout.position as any;
    if(sim.bout.athletes[top].stallWarned&&t>=limit-0.1)called++;
    if(sim.phase==='wrestling'&&p.kind==='mat'&&p.A===top&&p.sub==='standing')through++;
    for(let u=0;u<limit+1.5&&sim.phase==='wrestling'&&!stalls.length;u+=DT){hold();sim.tick(DT,[NO_COMMAND,NO_COMMAND]);}
    const q=sim.bout.position as any;
    if(stalls.includes(otherSide(top))&&sim.phase==='wrestling'&&q.kind==='mat'&&q.A===top)pointed++;
  }
  ok(called===6,`a top man who holds him standing past the referee's limit is called (${called}/6)`);
  ok(through===6,`no whistle for the call: still wrestling, same man on top, bottom man still up (${through}/6)`);
  ok(pointed===6,`the next call is the point, and they still wrestle on in the position held (${pointed}/6)`);
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
// Riding parallel (owner, November 11): broken down flat on his back with no legs in and no turn tries builds top stall
// time sooner and faster than the same rider in the referee's position; with the legs in it is the plain rate.
{
  const topStall=(sub:'flat'|'ride',legRide:number)=>{
    const {sim}=onMat(31);
    let first=-1;
    // The restart breakdown plays first; then hold the position on the mat for 30 s with the top man idle.
    for(let i=0;i<240&&sim.bout.position.kind!=='mat';i++)sim.tick(DT,[NO_COMMAND,NO_COMMAND]);
    for(let t=0;t<30;t+=DT){
      const s=sim.bout.position as any;
      if(s.kind!=='mat'||sim.phase!=='wrestling')break;
      s.sub=sub;s.legRide=legRide;s.escape=0;s.control=0.9;if(sub==='flat')s.base=0;
      sim.tick(DT,[NO_COMMAND,NO_COMMAND]);
      if(first<0&&sim.bout.athletes[0].stallTimer>0)first=t;
    }
    return {timer:sim.bout.athletes[0].stallTimer,first};
  };
  const flat=topStall('flat',0),legs=topStall('flat',1),ride=topStall('ride',0);
  ok(flat.first>0&&ride.first>0&&flat.first<ride.first*0.7,`parallel and idle starts building sooner (flat ${flat.first.toFixed(1)} s, ride ${ride.first.toFixed(1)} s)`);
  ok(flat.timer>ride.timer*1.3,`parallel and idle builds more stall time (flat ${flat.timer.toFixed(1)}, ride ${ride.timer.toFixed(1)})`);
  ok(Math.abs(legs.timer-ride.timer)<0.5&&Math.abs(legs.first-ride.first)<0.2,`legs in is not riding parallel (legs ${legs.timer.toFixed(1)}, ride ${ride.timer.toFixed(1)})`);
  console.log(`Parallel ride: stall builds from ${flat.first.toFixed(1)} s (ride ${ride.first.toFixed(1)} s, legs in ${legs.first.toFixed(1)} s)`);
}
console.log('Mat stalling: top returns him within 5-7 s or is called; bottom must work to get out');
