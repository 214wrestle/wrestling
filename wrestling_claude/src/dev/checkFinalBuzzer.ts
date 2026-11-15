// The game plan between periods (Hud's PlanCard, shown in the period break) only comes up for a match going on (owner,
// November 15: "At the end of the 3rd period, the match strategy is coming up every time. It should only come up when
// the match is going to OT"). A buzzer that decides the match ends it there: regulation with its riding-time point, or
// a tiebreaker pair; a level one breaks before overtime, and the first two periods still break.
import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m);console.log('ok',m);};
const DT=1/60;
const idle=[NO_COMMAND,NO_COMMAND] as [typeof NO_COMMAND,typeof NO_COMMAND];

/** A match wrestling in `period` with the score and riding time given, a moment before the buzzer. */
function atBuzzer(period:number,score:[number,number],riding=0){
  const phases:string[]=[];
  const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{onPhase:(p:string)=>phases.push(p)} as any,7);
  sim.humanSide=0;
  sim.startIntros?.();(sim as any).skipIntros?.();
  for(let i=0;i<4000&&sim.phase!=='wrestling';i++){if(sim.phase==='positionChoice')sim.choosePosition('neutral');sim.tick(DT,idle);}
  const s=sim as any;
  s.period=period;s.score=[...score];s.ridingTime=riding;s.clock=0.01;
  phases.length=0;
  return {sim,phases};
}
/** Tick past the buzzer until the match ends or wrestling (or a choice) is under way again. */
function past(sim:MatchSim){
  for(let i=0;i<3000;i++){
    sim.tick(DT,idle);
    if(sim.result||sim.phase==='positionChoice'||(sim.phase==='wrestling'&&sim.clock>1))return;
  }
  throw Error('stuck in '+sim.phase);
}

// Regulation decided on points: the match ends at the buzzer, no break, no game plan.
{
  const {sim,phases}=atBuzzer(3,[5,2]);
  sim.tick(DT,idle);
  ok(sim.result?.winner===0&&sim.result.type==='decision'&&sim.phase==='celebration','a lead at the end of regulation is the decision at the buzzer');
  ok(!phases.includes('periodBreak'),'no period break (and so no game plan) when regulation decides it');
}
// Level on points, but a minute of riding time: the riding-time point decides it at the buzzer.
{
  const {sim,phases}=atBuzzer(3,[4,4],75);
  sim.tick(DT,idle);
  ok(sim.result?.winner===0&&sim.result.score[0]===5&&sim.result.score[1]===4,'the riding-time point is added at the buzzer and wins it');
  ok(!phases.includes('periodBreak'),'no period break when the riding-time point decides it');
}
// One point down with the riding-time point coming: level, so overtime, and the game plan comes up first.
{
  const {sim,phases}=atBuzzer(3,[3,4],75);
  sim.tick(DT,idle);
  ok(!sim.result&&sim.phase==='periodBreak'&&sim.score[0]===4&&sim.score[1]===4,'a riding-time point that levels it goes to the break before overtime');
  past(sim);
  ok(!sim.result&&sim.period===4,'then sudden victory');
  ok(phases.filter((p)=>p==='periodBreak').length===1,'one break before overtime');
}
// Level, no riding time: the break before sudden victory, as before.
{
  const {sim}=atBuzzer(3,[2,2],20);
  sim.tick(DT,idle);
  ok(!sim.result&&sim.phase==='periodBreak','level after regulation breaks before sudden victory');
}
// The tiebreaker pair decided on points or riding time ends at the buzzer; level, it breaks before the next sudden victory.
{
  const a=atBuzzer(6,[6,5]);
  a.sim.tick(DT,idle);
  ok(a.sim.result?.type==='tiebreaker'&&!a.phases.includes('periodBreak'),'a tiebreaker pair won on points ends at the buzzer');
  const b=atBuzzer(6,[5,5],-2);
  b.sim.tick(DT,idle);
  ok(b.sim.result?.winner===1&&b.sim.result.type==='tiebreaker'&&!b.phases.includes('periodBreak'),'a riding-time edge in the tiebreaker pair ends it at the buzzer');
  const c=atBuzzer(6,[5,5],0.4);
  c.sim.tick(DT,idle);
  ok(!c.sim.result&&c.sim.phase==='periodBreak','a level tiebreaker pair breaks before the next sudden victory');
}
// The first two periods still break, game plan and all, whatever the score.
for(const period of [1,2]){
  const {sim}=atBuzzer(period,[7,0]);
  sim.tick(DT,idle);
  ok(!sim.result&&sim.phase==='periodBreak',`period ${period} ends in the break`);
}
// The winner's celebration runs 7.5 s to the results unless skipped; a skip asked for early waits for its first second.
{
  const full=atBuzzer(3,[5,2]);
  full.sim.tick(DT,idle);
  let t=0;for(;t<20&&full.sim.phase==='celebration';t+=DT)full.sim.tick(DT,idle);
  ok(full.sim.phase==='results'&&Math.abs(t-7.5)<0.1,`unskipped, the celebration runs its 7.5 s (${t.toFixed(2)} s)`);
  const early=atBuzzer(3,[5,2]);
  early.sim.tick(DT,idle);
  ok(early.sim.skipCelebration()&&early.sim.phase==='celebration','a skip at the buzzer is kept, not taken at once');
  let e=0;for(;e<20&&early.sim.phase==='celebration';e+=DT)early.sim.tick(DT,idle);
  ok(early.sim.phase==='results'&&e>0.9&&e<1.1,`it goes to the results at the celebration's first second (${e.toFixed(2)} s)`);
  const late=atBuzzer(3,[5,2]);
  late.sim.tick(DT,idle);
  for(let i=0;i<120;i++)late.sim.tick(DT,idle);
  ok(late.sim.skipCelebration()&&late.sim.phase==='results','a skip two seconds in goes straight to the results');
  ok(!late.sim.skipCelebration(),'nothing to skip on the results');
}
console.log('Final buzzer: a decided match ends at the buzzer; the break and its game plan only come before more wrestling; the celebration can be skipped to the results');
