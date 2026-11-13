// Referee calls from the owner's list. Locked hands (NCAA 5.8.2): the rider locks up before the bottom man is on his
// feet, a point to the bottom man, restart top and bottom. Potentially dangerous (2.1.10): a cranked bar, cradle,
// spladle or head and arm the bottom man is fighting is stopped, no penalty, near-fall points kept, same restart.
import type {Position} from '../sim/bout';
import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
import {handsHintFor} from '../game/prompts';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const cmd=(c:Partial<Command>):Command=>({...NO_COMMAND,...c});

function live(seed:number){
  const calls:string[]=[];
  const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{onWhistle:(r:string)=>calls.push(r)} as any,seed);
  sim.humanSide=0;sim.startIntros?.();(sim as any).skipIntros?.();
  for(let i=0;i<4000&&sim.phase!=='wrestling';i++){if(sim.phase==='positionChoice')sim.choosePosition('neutral');sim.tick(DT,[NO_COMMAND,NO_COMMAND]);}
  sim.bout.setReferee(0,{x:0,z:0},0);
  // A fresh generator with a small seed starts with tiny numbers; a match has drawn many before this point.
  for(let k=0;k<25;k++)(sim.bout as any).rng.next();
  return {sim,calls};
}
/** Bottom man (1) starts to stand up; top (0) grabs (taps Ride tight) or not. */
function standUp(seed:number,grab:boolean){
  const {sim,calls}=live(seed);
  const p=sim.bout.position as Extract<Position,{kind:'mat'}>;
  (sim.bout as any).startMove('standUp',0,{...p.frame},false);
  const pts=sim.score[1];
  let hint='';
  // Grabs through the stand-up only; then the action plays out (a call wrestled through is paid when it is over).
  const penalty=()=>sim.scoreLog.some(e=>e.kind==='penalty');
  for(let i=0;i<330&&sim.phase==='wrestling'&&!penalty();i++){hint||=handsHintFor(sim,0)??'';sim.tick(DT,[cmd({sprawl:grab&&i<50&&i%6<3}),NO_COMMAND]);}
  return {sim,called:penalty(),stopped:calls.includes('lockedHands'),pts:sim.score[1]-pts,hint};
}

// Grabbing while he is still on a knee is locked hands: a point to him, a restart with the same man on top (held
// down, or wrestled through and stopped when the action is over).
{
  const r=standUp(3,true);
  ok(r.called&&r.stopped,'grabbing during his stand-up is called');
  ok(r.pts===1,'a point to the bottom man');
  ok((r.sim as any).restart.pos==='top'&&(r.sim as any).restart.top===0,'restart top and bottom, same man on top');
  ok(/still on a knee/.test(r.hint),'the hint warns the rider');
}
// A rider who keeps his hands to himself is rarely called (only his own occasional slip).
{
  let called=0;for(let seed=1;seed<=100;seed++)if(standUp(seed,false).called)called++;
  ok(called<=10,`without a grab, locked hands is rare (${called} of 100 stand-ups)`);
  let grabbed=0;for(let seed=1;seed<=40;seed++)if(standUp(seed,true).called)grabbed++;
  ok(grabbed>=30,`grabbing a man on a knee is usually called (${grabbed} of 40)`);
}
// Owner, November 12: "Only the top man can be called for locked hands." The bottom man mashing every button through
// his own stand-up is never called, and the call (announcement and score banner) names the top man.
{
  let bottomCalled=0,named=0;
  for(let seed=1;seed<=40;seed++){
    const {sim,calls}=live(seed);
    const anns:string[]=[];(sim as any).listeners.onAnnounce=(a:any)=>anns.push(`${a.text} ${a.detail??''}`);
    const p=sim.bout.position as Extract<Position,{kind:'mat'}>;
    (sim.bout as any).startMove('standUp',0,{...p.frame},false);
    for(let i=0;i<330&&sim.phase==='wrestling';i++){const on=i%6<3;sim.tick(DT,[cmd({sprawl:seed%2===0&&i<50&&on}),cmd({sprawl:on,fight:on,shoot:!on})]);}
    void calls;
    for(const e of sim.scoreLog.filter(x=>x.kind==='penalty')){
      if(e.side===1&&anns.some(a=>/^Locked hands red/.test(a)))named++;
      else bottomCalled++;
    }
  }
  ok(bottomCalled===0,`the bottom man is never called for locked hands (${bottomCalled})`);
  ok(named>0,`the call names the top man and the point goes to the bottom man (${named} calls)`);
}
// Owner, November 12: locked hands is mostly the top man locking up as he is about to give up an escape or reversal,
// and they wrestle through it. The rider grabbing through the bottom man's switch: either the lock holds him (play
// stops, a point, restart top and bottom, same man on top) or he wrestles through (the reversal and the point, no
// stoppage). Riding time does not run for the top man while the call is pending.
{
  let held=0,through=0,other=0,rideRan=0;
  for(let seed=1;seed<=40;seed++){
    const {sim,calls}=live(seed);
    const p=sim.bout.position as Extract<Position,{kind:'mat'}>;
    (sim.bout as any).startMove('switch',0,{...p.frame},false);
    const s0=[...sim.score];
    let callT=-1;
    for(let i=0;i<90&&sim.phase==='wrestling';i++){
      const rt=(sim as any).ridingTime,pending=!!(sim as any).pendingLock;
      sim.tick(DT,[cmd({sprawl:i<30&&i%6<3}),NO_COMMAND]);
      if((sim as any).pendingLock&&callT<0)callT=i;
      if(pending&&(sim as any).ridingTime!==rt)rideRan++;
    }
    const pen=sim.scoreLog.filter(e=>e.kind==='penalty'),rev=sim.scoreLog.filter(e=>e.kind==='reversal');
    if(!pen.length)continue;
    const r=(sim as any).restart;
    if(calls.includes('lockedHands')&&!rev.length&&pen[0].side===1&&r.pos==='top'&&r.top===0)held++;
    else if(!calls.includes('lockedHands')&&rev.length===1&&rev[0].side===1&&pen[0].side===1&&callT>=0&&sim.score[1]-s0[1]===3&&sim.phase==='wrestling')through++;
    else other++;
  }
  ok(held>=3,`the lock holds him: stopped, a point, same man on top (${held} of 40)`);
  ok(through>=3,`wrestled through: the reversal and the point, play goes on (${through} of 40)`);
  ok(other===0,`no other outcome (${other})`);
  ok(rideRan===0,`no riding time for the top man while the call is pending (${rideRan} frames)`);
  console.log(`Locked hands on a switch: ${held} held and stopped, ${through} wrestled through for the reversal and the point`);
}
// Wrestled through on a stand-up that does not get out: play goes on, then the point and a top-and-bottom restart.
{
  let pendingSeen=0,ok2=0;
  for(let seed=1;seed<=60;seed++){
    const r=standUp(seed,true);
    const through=r.sim.scoreLog.some(e=>e.kind==='penalty')&&!r.sim.scoreLog.some(e=>e.kind==='escape');
    if(!through||!r.stopped)continue;
    pendingSeen++;
    const rs=(r.sim as any).restart;
    if(r.pts===1&&rs.pos==='top'&&rs.top===0)ok2++;
  }
  ok(pendingSeen>0&&ok2===pendingSeen,`a call that does not end in his escape is stopped for the point, same man on top (${ok2}/${pendingSeen})`);
}
// Once he is up on his feet, locking around the waist is legal: no call while he is standing.
{
  const {sim,calls}=live(5);
  const p=sim.bout.position as Extract<Position,{kind:'mat'}>;p.sub='standing';
  ok(sim.bout.handsAtRisk()===null,'with him on his feet the hands are not at risk');
  for(let i=0;i<10;i++)sim.tick(DT,[NO_COMMAND,NO_COMMAND]);
  ok(!calls.includes('lockedHands'),'no call while he is standing');
}

// Potentially dangerous: a cradle cranked while he fights it is stopped some of the time, never a tilt.
function cranked(seed:number,style:'cradle'|undefined,flash:number){
  const {sim,calls}=live(seed);
  const p=sim.bout.position as Extract<Position,{kind:'mat'}>;
  Object.assign(p,{sub:'exposed',expo:0,awarded:0,pin:0,flash,turnStyle:style});
  const pts=sim.score[0];
  for(let i=0;i<8*60&&sim.phase==='wrestling'&&sim.bout.position===p;i++)sim.tick(DT,[cmd({shoot:true,fight:i%10<5}),cmd({sprawl:i%12<6})]);
  for(let i=0;i<30;i++)sim.tick(DT,[NO_COMMAND,NO_COMMAND]);
  return {called:calls.includes('dangerous'),pts:sim.score[0]-pts,sim};
}
{
  let pd=0,kept=0,tilt=0;
  for(let seed=1;seed<=60;seed++){
    const c=cranked(seed,'cradle',0);if(c.called){pd++;if(c.pts>=0&&(c.sim as any).restart.top===0)kept++;}
    if(cranked(seed,undefined,1).called)tilt++;
  }
  ok(pd>=2&&pd<=30,`a cranked cradle is sometimes stopped as potentially dangerous (${pd} of 60)`);
  ok(kept===pd,'no penalty, and they restart with the same man on top');
  ok(tilt===0,'a tilt is never stopped for it');
}
// On the feet: a hard snap into a man driving up out of the front headlock, or whizzering a high-lifted single, is
// sometimes stopped as potentially dangerous; they restart on their feet. A front headlock he is not driving into is not.
{
  let snap=0,calm=0,leg=0,neutral=0;
  for(let seed=1;seed<=80;seed++){
    for(const driving of [true,false]){
      const {sim,calls}=live(seed);
      sim.bout.position={kind:'fhl',A:0,mirror:false,t:0,frame:{x:0,z:0,yaw:0},recover:0.3,intensity:0.5,cooldown:9,drive:driving?0.9:0} as any;
      for(let i=0;i<180&&sim.phase==='wrestling';i++){if(driving)(sim.bout.position as any).drive=0.9;sim.tick(DT,[cmd({fight:i%8<4}),NO_COMMAND]);}
      if(calls.includes('dangerous')){if(driving){snap++;if((sim as any).restart.pos==='neutral')neutral++;}else calm++;}
    }
    const {sim,calls}=live(seed);
    sim.bout.position={kind:'legs',A:0,shot:'single',mirror:false,t:2,frame:{x:0,z:0,yaw:0},progress:0.5,intensity:0.5,lifted:1} as any;
    for(let i=0;i<120&&sim.phase==='wrestling';i++){(sim.bout.position as any).lifted=1;sim.tick(DT,[cmd({legAction:'lift'} as any),cmd({fight:i%10<5})]);}
    if(calls.includes('dangerous'))leg++;
  }
  ok(snap>=3&&snap<=60,`snapping down hard into a driving man is sometimes stopped (${snap} of 80)`);
  ok(neutral===snap,'they restart on their feet');
  ok(calm===0,'not when he is not driving into it');
  ok(leg>=2&&leg<=60,`whizzering a high-lifted leg is sometimes stopped (${leg} of 80)`);
}
console.log('Calls: locked hands on a man not on his feet (a point), potentially dangerous on cranked holds and on the feet (no penalty)');
