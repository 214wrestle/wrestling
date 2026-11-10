// Owner, November 10 (a JV match: 18 shots to 2, the man backed up all match, no stalling calls; leg battles stopped
// after 2-4 s). Stalling after 4-5 unanswered shots (4 when he protects a lead); leg battles go on while anyone
// works, a stalemate after about 7 s of nobody working, and a long one settles in a scramble.
import {Bout, LEG_BATTLE} from '../sim/bout';
import {MatchSim, STALL_FEET, returnSpeed} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const cmd=(c:Partial<Command>):Command=>({...NO_COMMAND,...c});
function live(seed=3){
  const notes:string[]=[];
  const sim:any=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{onScore:(e:any)=>notes.push('point:'+e.kind+':'+e.side)} as any,seed);
  sim.humanSide=0;sim.startIntros();sim.skipIntros();
  for(let i=0;i<4000&&sim.phase!=='wrestling';i++){if(sim.phase==='positionChoice')sim.choosePosition('neutral');sim.tick(DT,[NO_COMMAND,NO_COMMAND]);}
  sim.referee={id:'average',label:'',patience:40,rate:1};
  return {sim,notes};
}
// 5 unanswered shots: a warning on him; 5 more: a point to the shooter.
{
  const {sim,notes}=live();
  for(let i=0;i<STALL_FEET.unanswered;i++)sim.unansweredAttack(0,true);
  ok(sim.bout.athletes[1].stallWarned&&!notes.some(n=>n.startsWith('point:stalling')),'five unanswered shots: a warning');
  for(let i=0;i<STALL_FEET.unanswered;i++)sim.unansweredAttack(0,true);
  ok(notes.includes('point:stalling:0'),'five more: a stalling point to the man attacking');
}
// His own attack answers it; tie attacks do not build the count.
{
  const {sim}=live();
  for(let i=0;i<4;i++)sim.unansweredAttack(0,true);
  sim.unansweredAttack(1,false);
  for(let i=0;i<4;i++)sim.unansweredAttack(0,true);
  for(let i=0;i<6;i++)sim.unansweredAttack(0,false);
  ok(!sim.bout.athletes[1].stallWarned,'an attack of his own answers it; snaps and ties do not count as committed shots');
}
// Protecting a lead: four is enough.
{
  const {sim}=live();sim.score=[0,5];
  for(let i=0;i<STALL_FEET.unansweredStrict;i++)sim.unansweredAttack(0,true);
  ok(sim.bout.athletes[1].stallWarned,'ahead and not attacking: four shots is enough');
}
// Leg battles.
function legs(attacker:Partial<Command>,defender:Partial<Command>,max=30){
  let stalemate=false;const moves:string[]=[];
  const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{whistle:(r:string)=>{if(r==='stalemate')stalemate=true},move:(d:any)=>moves.push(d.id)} as any,9);
  for(let k=0;k<25;k++)(b as any).rng.next();
  b.position={kind:'legs',A:0,shot:'single',mirror:false,t:0,frame:{x:0,z:0,yaw:0},progress:0.5,intensity:0.5} as any;
  let t=0;
  for(;t<max&&b.position.kind==='legs';t+=DT)b.tick(DT,[cmd(attacker),cmd(defender)]);
  return {t,stalemate,moves};
}
{
  const idle=legs({},{});
  ok(idle.stalemate&&idle.t>LEG_BATTLE.idle-0.5&&idle.t<LEG_BATTLE.idle+1,`both just hanging on: a stalemate at about ${LEG_BATTLE.idle} s (${idle.t.toFixed(1)})`);
  // Both working (he drives, the defender fights it): no early stalemate; settled by the cap one way or another.
  let early=0,late=0;
  for(let seed=1;seed<=30;seed++){
    const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{whistle:(r:string)=>{if(r==='stalemate'){if(t<LEG_BATTLE.scrambleAt)early++;}}} as any,seed);
    for(let k=0;k<25;k++)(b as any).rng.next();
    b.position={kind:'legs',A:0,shot:'single',mirror:false,t:0,frame:{x:0,z:0,yaw:0},progress:0.5,intensity:0.5} as any;
    let t=0;
    for(let i=0;t<30&&b.position.kind==='legs';i++,t+=DT)b.tick(DT,[cmd({shoot:true}),cmd({fight:i%12<6})]);
    if(t>LEG_BATTLE.cap+0.5)late++;
  }
  ok(early===0,`no stalemate while both are working (${early} of 30 called early)`);
  ok(late===0,`always settled by ${LEG_BATTLE.cap} s (${late} of 30 ran over)`);
}
// Owner, November 10 (second JV match): with the leg up there must be movement, not tap-tap-hold; after a whistle they
// run back to the center.
{
  const start=()=>{const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{} as any,9);
    b.position={kind:'legs',A:0,shot:'single',mirror:false,t:0,frame:{x:0,z:0,yaw:0},progress:0.5,intensity:0.5,lifted:1} as any;return b;};
  // Driving: he walks him across the mat and circles to turn the corner.
  const b=start();
  for(let t=0;t<1&&b.position.kind==='legs';t+=DT)b.tick(DT,[cmd({shoot:true}),cmd({})]);
  const f=(b.position as any).frame;
  ok(b.position.kind==='legs'&&Math.hypot(f.x,f.z)>0.3&&Math.abs(f.yaw)>0.2,`driving moves the pair and turns it (moved ${Math.hypot(f.x,f.z).toFixed(2)} m, turned ${f.yaw.toFixed(2)})`);
  // One push is a visible burst of steps; with nobody working nothing moves.
  const travel=(tap:boolean)=>{const b=start();let i=0;
    for(let t=0;t<0.4;t+=DT,i++)b.tick(DT,[cmd({shoot:tap&&i===0}),cmd({})]);
    const f=(b.position as any).frame;return Math.hypot(f.x,f.z);};
  ok(travel(true)>0.12&&travel(false)<0.01,`a push drives him (${travel(true).toFixed(2)} m), holding still does not (${travel(false).toFixed(2)} m)`);
  ok(returnSpeed(1)>=2.5&&returnSpeed(0)>=1.8,`after a whistle a fresh man runs back (${returnSpeed(1)} m/s), a gassed one jogs (${returnSpeed(0)} m/s)`);
}
console.log('Stalling on unanswered shots; leg battles go on while anyone works, move, and settle in a scramble; they run back to the center');
