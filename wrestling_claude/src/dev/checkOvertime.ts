// Overtime follows the NCAA rulebook (Rules 3.14.3 and 3.15-3.17): SV-1 2:00 from neutral and first points win;
// then two 30-second tiebreaker periods with the choice to the first offensive scorer in regulation (a disc toss if
// there was none), who may defer to the second half; points or a net riding-time edge of a second or more win the
// pair; otherwise SV-2 1:00 and another pair with the choice to the other wrestler. Regulation riding time does not
// carry over.
import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import {periodLabel, periodLength} from '../sim/rules';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const idle=[NO_COMMAND,NO_COMMAND] as [typeof NO_COMMAND,typeof NO_COMMAND];

ok(periodLength(4)===120&&periodLength(7)===60&&periodLength(10)===60,'SV-1 is two minutes, later sudden-victory periods one');
ok(periodLength(5)===30&&periodLength(6)===30&&periodLength(8)===30,'tiebreaker periods are thirty seconds');
ok(periodLabel(4)==='SV1'&&periodLabel(5)==='TB1'&&periodLabel(6)==='TB1'&&periodLabel(7)==='SV2'&&periodLabel(9)==='TB2','overtime labels');

/** A match at the end of a tied third period; side 0 is the human. `log` seeds the regulation scoring. */
function tiedAfterRegulation(seed:number,log:{side:0|1;kind:string}[]){
  const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{} as any,seed);
  sim.humanSide=0;
  sim.startIntros?.();(sim as any).skipIntros?.();
  for(let i=0;i<4000&&sim.phase!=='wrestling';i++){if(sim.phase==='positionChoice')sim.choosePosition('neutral');sim.tick(DT,idle);}
  const s=sim as any;
  s.period=3;s.score=[0,0];s.scoreLog=[];
  for(const e of log){const pts=e.kind==='takedown'?3:e.kind==='escape'?1:e.kind==='reversal'?2:1;s.score[e.side]+=pts;s.scoreLog.push({id:0,side:e.side,kind:e.kind,points:pts,label:e.kind,period:1,clock:60});}
  const diff=s.score[0]-s.score[1];if(diff>0)s.score[1]+=diff;else s.score[0]-=diff;
  s.ridingTime=30;// under the one-minute threshold: no riding-time point, and it must not carry into overtime
  s.clock=0.01;
  return sim;
}
/** Tick until wrestling resumes, a choice is wanted from the human, or the match ends. */
function untilAction(sim:MatchSim){
  for(let i=0;i<3000;i++){
    sim.tick(DT,idle);
    if(sim.result||sim.phase==='positionChoice'||(sim.phase==='wrestling'&&sim.clock<periodLength(sim.period)-0.05))return;
  }
  throw Error('stuck in '+sim.phase);
}
/** End the current period with nothing scored. */
function runOut(sim:MatchSim,riding=0){
  const s=sim as any;
  if(riding)s.ridingTime=riding;
  s.clock=0.01;
  untilAction(sim);
}

// Into SV-1: two minutes, from neutral, regulation riding time gone.
{
  const sim=tiedAfterRegulation(3,[{side:0,kind:'escape'},{side:1,kind:'takedown'}]);
  untilAction(sim);
  ok(sim.period===4&&Math.abs(sim.clock-120)<1,'tied after regulation goes to a two-minute sudden victory');
  ok(sim.bout.position.kind==='neutral','sudden victory starts in neutral');
  ok(Math.abs(sim.ridingTime)<1,'regulation riding time does not carry into overtime');
  // First points in sudden victory win it.
  (sim as any).award(0,'takedown','check');
  ok(sim.result?.winner===0&&sim.result?.type==='sudden-victory','first points in sudden victory win');
}

// SV-1 level: the tiebreaker choice goes to the first offensive scorer (side 1's takedown, not side 0's escape).
{
  const sim=tiedAfterRegulation(4,[{side:0,kind:'escape'},{side:1,kind:'takedown'}]);
  untilAction(sim);runOut(sim);
  ok(sim.tbChooser===1,'the first offensive scorer in regulation has the tiebreaker choice');
  // The AI may defer; then the human chooses the first half.
  if(sim.phase==='positionChoice'){ok(sim.tbDeferred&&!sim.canDefer,'after his deferral the human picks the first half, with no defer');sim.choosePosition('bottom');untilAction(sim);}
  ok(sim.period===5&&sim.bout.position.kind!=='neutral'||sim.period===5,'first tiebreaker period under way');
  ok(Math.abs(sim.clock-30)<1,'tiebreaker periods are thirty seconds');
  // Second half: the other man's choice (the human's unless the AI deferred).
  runOut(sim);
  if(sim.phase==='positionChoice'){ok(!sim.canDefer,'no defer in the second half');sim.choosePosition('bottom');untilAction(sim);}
  ok(sim.period===6,'second tiebreaker period under way');
  // Level on points, a second and a half of net riding time for side 0: he wins the tiebreaker.
  runOut(sim,1.5);
  ok(sim.result?.winner===0&&sim.result?.type==='tiebreaker','a net riding-time edge of a second or more wins the tiebreaker');
}

// Level on points and under a second of riding: SV-2 for one minute, then the other man has the choice.
{
  const sim=tiedAfterRegulation(5,[{side:1,kind:'takedown'}]);
  untilAction(sim);runOut(sim);
  // First half (answer the human's choice if it comes to him), then the second, ending with half a second of riding.
  if(sim.phase==='positionChoice'){sim.choosePosition('top');untilAction(sim);}
  ok(sim.period===5,'first tiebreaker half');
  runOut(sim);
  if(sim.phase==='positionChoice'){sim.choosePosition('top');untilAction(sim);}
  ok(sim.period===6,'second tiebreaker half');
  runOut(sim,0.5);
  ok(!sim.result&&sim.period===7&&Math.abs(sim.clock-60)<1,'a level tiebreaker goes to a one-minute second sudden victory');
  runOut(sim);
  ok(sim.tbChooser===0,'the second tiebreaker choice goes to the wrestler who did not have the first');
}

// The human with the choice may defer: the other man picks the first half, the human the second.
{
  const sim=tiedAfterRegulation(6,[{side:0,kind:'takedown'}]);
  untilAction(sim);runOut(sim);
  ok(sim.phase==='positionChoice'&&sim.canDefer,'the human with the tiebreaker choice may defer');
  sim.choosePosition('defer');
  untilAction(sim);
  ok(sim.period===5&&sim.lastChoiceBy===1,'after the deferral the other man picks the first half');
  runOut(sim);
  ok(sim.phase==='positionChoice'&&!sim.canDefer,'the deferring wrestler picks the second half');
}

// No offensive points in regulation (escapes only): a disc toss gives the choice.
{
  const sim=tiedAfterRegulation(7,[{side:0,kind:'escape'},{side:1,kind:'escape'}]);
  untilAction(sim);runOut(sim);
  ok(sim.tbChooser===0||sim.tbChooser===1,'with only escapes in regulation a disc toss gives the choice');
}

// Points in a tiebreaker period do not end it; the pair is wrestled out and the points decide.
{
  const sim=tiedAfterRegulation(8,[{side:1,kind:'takedown'}]);
  untilAction(sim);runOut(sim);
  if(sim.phase==='positionChoice'){sim.choosePosition('bottom');untilAction(sim);}
  (sim as any).award(0,'escape','check');
  ok(!sim.result,'an escape in the first tiebreaker period does not end the match');
  runOut(sim);
  if(sim.phase==='positionChoice'){sim.choosePosition('top');untilAction(sim);}
  runOut(sim);
  ok(sim.result?.winner===0&&sim.result?.type==='tiebreaker','more points over the two tiebreaker periods win');
}
console.log('Overtime follows the NCAA sequence: SV-1 2:00, tiebreaker choice to the first offensive scorer with defer, points or a second of riding time, SV-2 1:00, choice alternates');
