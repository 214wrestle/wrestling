// Well-timed shots are explosive (owner, November 11: "more action, athleticism and explosive moves when it's well
// timed"). A shot right off his reaction (a reach, a snap) bursts in faster and hits the legs harder than a set-up
// shot, and a cold shot is slower; the contact hit fires when he gets in, never when the hips are already back. The AI
// pounces on a live opening instead of waiting for its next decision.
import {Bout, TIMING} from '../sim/bout';
import type {Position} from '../sim/bout';
import {WrestlerAI as AI, POUNCE, HAND_FIGHT} from '../sim/ai';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const R=[PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]] as const;
const cmd=(c:Partial<Command>):Command=>({...NO_COMMAND,...c});
// Spread seeds: the xorshift's first rolls from tiny seeds are all near zero (every early chance passes).
const spread=(s:number)=>(s*2654435761)>>>0;

type Kind='live'|'setUp'|'cold';
/** A's shot from 0.95 m: off his reach, after a fake, or with nothing. Collects contact hits. */
function shot(seed:number,kind:Kind,hits:number[]=[]){
  const b=new Bout([R[0],R[1]],{impact:(s:number)=>hits.push(s)} as any,spread(seed));
  b.setNeutral({x:0,z:0},0,0.95);
  for(let i=0;i<20;i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
  if(kind==='setUp')b.athletes[0].sinceFake=0.5;
  if(kind==='live'){const o=b.athletes[1];o.act='reach';o.actT=0.05;o.actDur=0.4;}
  b.tick(DT,[cmd({shoot:true}),NO_COMMAND]);
  return b;
}
const posOf=(b:Bout)=>b.position as Extract<Position,{kind:'shot'}>;

// Faster the better timed, and timing recorded.
{
  const live=posOf(shot(5,'live')),set=posOf(shot(5,'setUp')),cold=posOf(shot(5,'cold'));
  ok(live.kind==='shot'&&set.kind==='shot'&&cold.kind==='shot','all three shots start');
  ok(live.timing===1&&set.timing===TIMING.setUp&&cold.timing===0,'timing: 1 off his reaction, set up in between, 0 cold');
  ok(live.dur<set.dur&&set.dur<cold.dur,`off his reaction fastest, cold slowest (${live.dur.toFixed(3)} < ${set.dur.toFixed(3)} < ${cold.dur.toFixed(3)} s)`);
  ok(Math.abs(live.dur/cold.dur-TIMING.fast/TIMING.cold)<1e-6,'by the TIMING factors');
}

// The contact hit: once, when he gets in, bigger the better timed; none when he is sprawled on early.
{
  const strengths:Record<Kind,number[]>={live:[],setUp:[],cold:[]};
  for(const kind of ['live','setUp','cold'] as Kind[])for(let seed=1;seed<=40;seed++){
    const hits:number[]=[];
    const b=shot(seed,kind,hits);
    for(let i=0;i<60&&b.position.kind==='shot';i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
    ok(hits.length<=1,'at most one contact hit per shot');
    if(b.position.kind==='legs')ok(hits.length===1,`a ${kind} shot that gets in hits the legs`);
    strengths[kind].push(...hits);
  }
  const avg=(a:number[])=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
  ok(strengths.live.length>0&&strengths.cold.length>0,'shots got in');
  ok(avg(strengths.live)>avg(strengths.setUp)&&avg(strengths.setUp)>avg(strengths.cold),
    `harder hit the better timed (${avg(strengths.live).toFixed(2)} > ${avg(strengths.setUp).toFixed(2)} > ${avg(strengths.cold).toFixed(2)})`);
  let early=0;
  for(let seed=1;seed<=40;seed++){
    const hits:number[]=[];
    const b=shot(seed,'cold',hits);
    b.tick(DT,[NO_COMMAND,cmd({sprawl:true})]);
    for(let i=0;i<60&&b.position.kind==='shot';i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
    if(b.position.kind!=='legs'){early++;ok(hits.length===0,'no hit on a shot sprawled on before he got in');}
  }
  ok(early>20,`an early sprawl stops most cold shots (${early}/40)`);
}

// Bursts on moves (snap-down, spin behind, chin whip, tilt, sit-out escape): a well-timed one plays faster by the TIMING
// factor and lands harder than the same move untimed.
for (const id of ['snapDown','goBehind','chinWhip','tilt','sitOutEscape'] as const){
  const run=(b:number)=>{
    const hits:number[]=[];
    const bt=new Bout([R[0],R[1]],{impact:(s:number)=>hits.push(s)} as any,3);
    bt.setNeutral({x:0,z:0},0,0.9);
    const x=bt as any;
    x.startMove(id,0,x.pairFrame(0),false);
    x.burst(b);
    const m=bt.position as Extract<Position,{kind:'move'}>;
    const dur=m.dur;
    for(let i=0;i<200&&bt.position.kind==='move';i++)bt.tick(DT,[NO_COMMAND,NO_COMMAND]);
    return {dur,hit:hits[0]??0};
  };
  const plain=run(0),sharp=run(1);
  ok(Math.abs(sharp.dur/plain.dur-TIMING.fast)<1e-6,`${id}: a burst plays at ${TIMING.fast} of the time`);
  if(plain.hit>0)ok(sharp.hit>plain.hit,`${id}: and lands harder (${plain.hit.toFixed(2)} -> ${sharp.hit.toFixed(2)})`);
}

// Lift doubles (owner: "Yes, more lifts"): about a third of finished doubles, more for a strong man, none when gassed.
{
  const share=(strength:number,stamina:number,t:number)=>{
    let lifts=0;const n=400;
    for(let seed=1;seed<=n;seed++){
      const w0={...R[0],attributes:{...R[0].attributes,strength}};
      // Spread seeds: the xorshift's first rolls from tiny seeds are all near zero.
      const b=new Bout([w0,R[1]],{},spread(seed));
      b.setNeutral({x:0,z:0},0,0.9);
      const x=b as any;
      b.athletes[0].stamina=stamina;
      b.position={kind:'legs',A:0,shot:'double',mirror:false,t,frame:x.pairFrame(0),progress:1.01,intensity:0.5} as any;
      // At the 1.01 ceiling: the defender's resistance takes a little back each tick.
      b.tick(DT,[NO_COMMAND,NO_COMMAND]);
      if(b.position.kind==='move'&&(b.position as any).id==='liftDouble')lifts++;
    }
    return lifts/n;
  };
  const avg=share(0.75,0.8,2),strong=share(0.95,0.8,2),fast=share(0.75,0.8,0.8),gassed=share(0.95,0.2,0.8);
  ok(avg>0.2&&avg<0.38,`an average man lifts about a third of his doubles (${(avg*100).toFixed(0)}%)`);
  ok(strong>avg&&fast>avg,`more for a strong man (${(strong*100).toFixed(0)}%) and when he gets there fast (${(fast*100).toFixed(0)}%)`);
  ok(gassed===0,'never when he is gassed');
  console.log(`Lift doubles: average ${(avg*100).toFixed(0)}%, strong ${(strong*100).toFixed(0)}%, fast ${(fast*100).toFixed(0)}%, gassed 0%`);
}

// Upper-body throws off his drive (owner: "more effective when the opponent is pushing in ... easier for the thrower to
// launch"): driving in on the thrower raises the lateral drop and the headlock, and a throw off his drive is a burst.
{
  const rate=(kind:'lateralDrop'|'headlock',speed:number)=>{
    let won=0,burst=0;const n=400;
    for(let seed=1;seed<=n;seed++){
      const b=new Bout([R[0],R[1]],{},spread(seed+900));
      b.setNeutral({x:0,z:0},0,0.9);
      const [a,o]=b.athletes as any;
      if(kind==='lateralDrop'){a.hand=0.8;a.tie='bodyLock';}else{o.hand=0.8;o.tie='underhook';}
      // He drives straight at the thrower at `speed` m/s.
      const dx=a.pos.x-o.pos.x,dz=a.pos.z-o.pos.z,d=Math.hypot(dx,dz);
      o.vel={x:dx/d*speed,z:dz/d*speed};
      (b as any).tryUpperThrow(a,kind,NO_COMMAND);
      const p=b.position as any;
      if(p.kind==='move'&&(p.id==='lateralDrop'||p.id==='headlockThrow')){won++;if((p.burst??0)>0.5)burst++;}
    }
    return {won:won/n,burst:burst/Math.max(1,won)};
  };
  for(const kind of ['lateralDrop','headlock'] as const){
    const still=rate(kind,0),hard=rate(kind,1);
    ok(hard.won>=still.won+0.15,`${kind}: he drives in hard and it lands far more often (${(still.won*100).toFixed(0)}% -> ${(hard.won*100).toFixed(0)}%)`);
    ok(hard.burst>0.9&&still.burst===0,`${kind}: and off his drive it is a burst`);
    console.log(`Throws off his drive: ${kind} ${(still.won*100).toFixed(0)}% standing still, ${(hard.won*100).toFixed(0)}% when he drives in`);
  }
}

// Hand fighting (owner: "Yes, more hand fighting"): in tie range the AI fights the hands often and in exchanges, a
// press following the last within HAND_FIGHT.gap instead of one reach and back to circling.
{
  let presses=0,quick=0,secs=0;
  for(let seed=1;seed<=60;seed++){
    const b=new Bout([R[0],R[1]],{},spread(seed));
    b.setNeutral({x:0,z:0},0,0.95);
    const ai=new AI(0,'starter',spread(seed+500));
    let last=-9,prev=false;
    for(let i=0;i<600;i++){
      const c=ai.update(DT,b,true);
      // Hold the distance in tie range so only the hands are measured.
      b.tick(DT,[{...c,moveX:0,moveZ:0,shoot:false,fake:false,technique:undefined} as any,NO_COMMAND]);
      if(b.position.kind!=='neutral')break;
      const t=i*DT;secs+=DT;
      if(c.fight&&!prev){presses++;if(t-last<=HAND_FIGHT.gap[1]+0.1)quick++;last=t;}
      prev=!!c.fight;
    }
  }
  const perMin=presses/(secs/60);
  ok(perMin>=15,`the AI hand fights often in tie range (${perMin.toFixed(1)} a minute)`);
  ok(quick/presses>=0.25,`and in exchanges (${(quick/presses*100).toFixed(0)}% follow the last within ${HAND_FIGHT.gap[1]} s)`);
  console.log(`Hand fighting: ${perMin.toFixed(1)} a minute in tie range, ${(quick/presses*100).toFixed(0)}% in exchanges`);
}

// The AI pounces: his reach in range draws a shot right then, often, not only at its next decision.
{
  let shots=0;
  for(let seed=1;seed<=200;seed++){
    const b=new Bout([R[0],R[1]],{},spread(seed));
    b.setNeutral({x:0,z:0},0,0.95);
    const ai=new AI(0,'all-american',spread(seed));
    for(let i=0;i<20;i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
    const o=b.athletes[1];o.act='reach';o.actT=0;o.actDur=0.45;
    let shot=false;
    for(let i=0;i<24&&!shot;i++){const c=ai.update(DT,b,true);if(c.shoot)shot=true;o.actT+=DT;}
    if(shot)shots++;
  }
  ok(shots>=200*POUNCE.base,`the AI shoots right off his reach (${shots}/200 within 0.4 s)`);
  console.log(`Shot timing: live ${(TIMING.fast*100).toFixed(0)}% of the usual time, cold ${(TIMING.cold*100).toFixed(0)}%; hits ${TIMING.impact.join('-')}; AI pounces on ${shots}/200 reaches`);
}
