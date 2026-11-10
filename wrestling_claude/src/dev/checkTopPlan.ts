// Top plans (owner, November 9): ride for riding time with a stall call if he never tries to turn,
// work to turn him, or cut him and go back to neutral.
import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {TopPlan} from '../sim/strategy';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;

/** Seconds of riding with nobody acting (bottom still, top holding) until the stalling point, or -1. */
function holdUntilStall(top:TopPlan,turnEvery=0):number{
  let stallAt=-1,t=0;
  const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{onScore:(e:any)=>{if(e.kind==='stalling'&&e.side===1&&stallAt<0)stallAt=t}} as any,7);
  sim.humanSide=0;sim.setPlan(0,{style:'balanced',focus:'none',top});
  sim.phase='setPosition';sim.phaseT=0;sim.phaseDur=0.01;
  sim.bout.setReferee(0,{x:0,z:0},0);
  sim.tick(0.02,[NO_COMMAND,NO_COMMAND]);
  let last=0;
  for(;t<60&&stallAt<0;t+=DT){
    const tryTurn=turnEvery>0&&t-last>=turnEvery;if(tryTurn)last=t;
    sim.tick(DT,[{...NO_COMMAND,shoot:tryTurn},NO_COMMAND]);
    if(sim.bout.position.kind!=='mat')break;
  }
  return stallAt;
}

const ride=holdUntilStall('ride'),turn=holdUntilStall('turn');
ok(ride>15&&ride<40,`a rider who never tries a turn is called for stalling (ride plan at ${ride.toFixed(1)} s)`);
ok(turn>ride,`the ride plan is called sooner than a turn plan (${ride.toFixed(1)} vs ${turn.toFixed(1)} s)`);
ok(holdUntilStall('ride',8)<0,'trying a turn every 8 s keeps the stall clock clear');

// Cut at the whistle and after a takedown.
let escapes=0;
const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{onScore:(e:any)=>{if(e.kind==='escape')escapes++}} as any,9);
sim.humanSide=0;sim.setPlan(0,{style:'balanced',focus:'none',top:'cut'});
sim.phase='setPosition';sim.phaseT=0;sim.phaseDur=0.01;
sim.bout.setReferee(0,{x:0,z:0},0);
sim.tick(0.02,[NO_COMMAND,NO_COMMAND]);
ok(escapes===1&&sim.bout.position.kind==='neutral','a cut plan lets him up at the whistle');
sim.bout.setReferee(0,{x:0,z:0},0);
for(let i=0;i<120;i++)sim.tick(DT,[NO_COMMAND,NO_COMMAND]);
ok(escapes===2&&sim.bout.position.kind==='neutral','a cut plan lets him up once control is secure');
console.log(`Top plans: ride called for stalling at ${ride.toFixed(1)} s, turn plan at ${turn.toFixed(1)} s, regular turn tries keep it clear, cut releases at the whistle and after control`);
