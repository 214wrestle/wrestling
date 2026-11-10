// Backing off the mat on the feet is stalling (owner, November 9): a warning, then a point. Being driven out
// by the other man is not.
import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;

/** Neutral near the edge: side 0 at the line with his back to it, side 1 facing him from the centre. */
function atEdge(seed:number){
  const stalls:number[]=[];
  const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{onScore:(e:any)=>{if(e.kind==='stalling')stalls.push(e.side)}} as any,seed);
  sim.humanSide=0;
  sim.phase='setPosition';sim.phaseT=0;sim.phaseDur=0.01;
  sim.bout.setNeutral({x:0,z:0},Math.PI/2,1);
  sim.tick(0.02,[NO_COMMAND,NO_COMMAND]);
  const [a,b]=sim.bout.athletes;
  a.pos={x:4.3,z:0};b.pos={x:3.3,z:0};a.yaw=-Math.PI/2;b.yaw=Math.PI/2;
  return {sim,stalls};
}
/** Run until the out-of-bounds whistle (or 6 s), with each side's command. */
function untilOut(sim:MatchSim,c0:Partial<Command>,c1:Partial<Command>){
  for(let i=0;i<360&&sim.phase==='wrestling';i++)sim.tick(DT,[{...NO_COMMAND,...c0},{...NO_COMMAND,...c1}]);
  return sim.phase;
}

// Backing straight off the mat (away from him, +x): warned the first time, a point for him the second.
{
  const {sim,stalls}=atEdge(11);
  ok(untilOut(sim,{moveX:1},{})==='whistle','backing off the mat blows the out-of-bounds whistle');
  ok(sim.bout.athletes[0].stallWarned&&stalls.length===0,'the first time he backs off he is warned');
  const again=atEdge(12);again.sim.bout.athletes[0].stallWarned=true;
  untilOut(again.sim,{moveX:1},{});
  ok(again.stalls.length===1&&again.stalls[0]===1,'backing off again gives him a point');
}
// Driven out: he stands his ground and the other man walks him off the mat. No call.
{
  const {sim,stalls}=atEdge(13);
  untilOut(sim,{},{moveX:1});
  ok(!sim.bout.athletes[0].stallWarned&&stalls.length===0,'being driven out is not stalling');
}
console.log('Backing off the mat: warning, then a point; being driven out: no call');
