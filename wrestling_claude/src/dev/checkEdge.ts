// The edge of the mat (owner, November 10; NCAA Rule 5.7). Near the line the man in trouble works out with the
// stick and the man in control turns it back to the center; a rider about to lose a standing bottom man may push
// him out; a bottom man off a bad ride gets a fresh restart; crawling out on his back is fleeing (a stalling call).
import {Bout, EDGE, edgeDistance} from '../sim/bout';
import type {Position} from '../sim/bout';
import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
import {edgeHintFor} from '../game/prompts';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const R=[PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]] as const;
const cmd=(c:Partial<Command>):Command=>({...NO_COMMAND,...c});
const OUT={moveX:1,moveZ:0},IN={moveX:-1,moveZ:0};

/** A ride whose hips sit `d` metres inside the line on +X, top facing along the line (so his own drive is not
 *  toward it). Ticks until the whistle or `max` seconds; returns seconds taken (Infinity if it stayed in). */
function rideOut(sub:'ride'|'exposed',d:number,bottom:Partial<Command>,top:Partial<Command>,max=6){
  let out=false;
  const b=new Bout([R[0],R[1]],{whistle:(r:string)=>{if(r==='out')out=true}} as any,7);
  b.setReferee(0,{x:4.88-d,z:0},0);
  const p=b.position as Extract<Position,{kind:'mat'}>;
  if(sub==='exposed')Object.assign(p,{sub:'exposed',expo:0,awarded:0,pin:0});
  p.base=0.3;
  for(let i=0;i<max*60&&!out;i++)b.tick(DT,[cmd(top),cmd(bottom)]);
  return {t:out?b.position.kind==='mat'?Infinity:0:Infinity,out,b};
}

// The bottom man works out from a ride for a fresh restart; doing nothing, he stays in.
{
  const idle=rideOut('ride',1.0,{},{});
  const work=rideOut('ride',1.0,OUT,{});
  ok(!idle.out,'a ride a metre from the line stays in when nobody works the edge');
  ok(work.out,'the bottom man working toward the line gets out for a restart');
  // The rider dragging him back to the center keeps him in.
  const held=rideOut('ride',1.0,OUT,IN);
  ok(!held.out,'a rider dragging him to the center keeps him in');
}

// Far from the line, the stick does nothing to the position.
{
  const b=new Bout([R[0],R[1]],{},7);b.setReferee(0,{x:0,z:0},0);
  const f=(b.position as Extract<Position,{kind:'mat'}>).frame;const x0=f.x;
  for(let i=0;i<60;i++)b.tick(DT,[NO_COMMAND,cmd(OUT)]);
  ok(Math.abs((b.position as any).frame.x-x0)<0.02,'in the middle of the mat the bottom man cannot crawl anywhere');
  ok(edgeDistance(0,0)>EDGE.zone,'the edge zone is only near the line');
}

// In a match: crawling out on his back is fleeing; out of a ride it is a fresh restart with no call.
function matchAtEdge(sub:'ride'|'exposed',d=0.7){
  const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{} as any,11);
  sim.humanSide=0;sim.startIntros?.();(sim as any).skipIntros?.();
  for(let i=0;i<4000&&sim.phase!=='wrestling';i++){if(sim.phase==='positionChoice')sim.choosePosition('neutral');sim.tick(DT,[NO_COMMAND,NO_COMMAND]);}
  sim.bout.setReferee(0,{x:4.88-d,z:0},0);
  const p=sim.bout.position as Extract<Position,{kind:'mat'}>;
  if(sub==='exposed')Object.assign(p,{sub:'exposed',expo:0,awarded:0,pin:0});
  p.base=0.3;
  const before=sim.score[0];
  for(let i=0;i<360&&sim.phase==='wrestling';i++)sim.tick(DT,[NO_COMMAND,cmd(OUT)]);
  return {sim,warned:sim.bout.athletes[1].stallWarned,pts:sim.score[0]-before};
}
{
  const r=matchAtEdge('ride');
  ok(r.sim.phase!=='wrestling','the ride went out of bounds');
  ok(!r.warned,'getting out of a ride for a fresh restart is legal');
  ok((r.sim as any).restart.pos==='top'&&(r.sim as any).restart.top===0,'and they restart with the same man on top');
  const e=matchAtEdge('exposed',0.35);
  ok(e.sim.phase!=='wrestling','the bottom man crawled out on his back');
  ok(e.warned||e.pts>0,'crawling out on his back is called as fleeing');
}

// The hint says which way to move.
{
  const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{} as any,11);
  sim.humanSide=1;sim.startIntros?.();(sim as any).skipIntros?.();
  for(let i=0;i<4000&&sim.phase!=='wrestling';i++){if(sim.phase==='positionChoice')sim.choosePosition('neutral');sim.tick(DT,[NO_COMMAND,NO_COMMAND]);}
  sim.bout.setReferee(0,{x:4.88-0.7,z:0},0);
  ok(/toward the line for a fresh restart/.test(edgeHintFor(sim,1)??''),'bottom at the edge: move toward the line for a fresh restart');
  ok(/to the center/.test(edgeHintFor(sim,0)??''),'top at the edge: move to the center');
  sim.bout.setReferee(0,{x:0,z:0},0);
  ok(edgeHintFor(sim,1)===undefined,'no hint in the middle of the mat');
}
console.log('Edge: the bottom man works out for a restart, the rider drags him back, crawling out on his back is fleeing');
