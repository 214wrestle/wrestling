// Mat return depth (owner's list). How a return lands depends on how well it was done: clean and he is flat (a
// breakdown), ordinary on his base, scrappy nearly back up. Being returned, the bottom man can turn in as he lands
// (Shoot), an escape when it works. A tired rider's big lift can come down as an illegal slam (a point to him).
import {Bout, RETURN} from '../sim/bout';
import type {Position} from '../sim/bout';
import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
import {readPrompts} from '../game/prompts';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const cmd=(c:Partial<Command>):Command=>({...NO_COMMAND,...c});
ok(RETURN.clean>RETURN.scrappy,'clean is above scrappy');

/** He is standing; top returns him with `button`; bottom turns in as he lands or not. What follows, by move id. */
function ret(seed:number,button:'sprawl'|'fight'|'shoot',control:number,escape:number,turnIn:boolean,stamina=1){
  const moves:string[]=[];const calls:string[]=[];
  const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{move:(d:any)=>moves.push(d.id),call:(k:string)=>calls.push(k)} as any,Math.imul(seed,2654435761)>>>0);
  for(let k=0;k<25;k++)(b as any).rng.next();
  b.setReferee(0,{x:0,z:0},0);
  const p=b.position as Extract<Position,{kind:'mat'}>;Object.assign(p,{sub:'standing',control,escape,t:3});
  b.athletes[0].stamina=stamina;
  for(let i=0;i<150;i++)b.tick(DT,[cmd(i===0?{[button]:true}:{}),cmd({shoot:turnIn&&b.returnWindow()&&i%2===0})]);
  return {moves,calls,returned:moves.some(m=>['returnMat','standingTrip','crotchLift'].includes(m))};
}

// A good return off tight control lands him flat more often than a scrappy one off a loosening grip.
{
  let good=0,bad=0,gn=0,bn=0;
  for(let seed=1;seed<=120;seed++){
    const g=ret(seed,'sprawl',0.95,0,false);if(g.returned){gn++;if(g.moves.includes('breakdown'))good++;}
    const s=ret(seed,'sprawl',0.3,0.5,false);if(s.returned){bn++;if(s.moves.includes('breakdown'))bad++;}
  }
  ok(gn>20&&bn>10,'returns happen');
  ok(good/gn>bad/bn+0.15,`a clean return lands him flat more often (${good}/${gn} vs ${bad}/${bn})`);
}
// Turning in as he lands escapes some of the time; never without trying.
{
  let tried=0,escaped=0,idle=0;
  for(let seed=1;seed<=120;seed++){
    const t=ret(seed,'sprawl',0.6,0.4,true);if(t.returned){tried++;if(t.moves.includes('sitOutEscape'))escaped++;}
    if(ret(seed,'sprawl',0.6,0.4,false).moves.includes('sitOutEscape'))idle++;
  }
  ok(escaped>=8&&escaped<=tried*0.6,`turning in as he lands works some of the time (${escaped}/${tried})`);
  ok(idle===0,'never without trying');
}
// The prompt: while being returned, the bottom man's Shoot says Turn in.
{
  const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{} as any,9);
  sim.humanSide=1;sim.startIntros?.();(sim as any).skipIntros?.();
  for(let i=0;i<4000&&sim.phase!=='wrestling';i++){if(sim.phase==='positionChoice')sim.choosePosition('neutral');sim.tick(DT,[NO_COMMAND,NO_COMMAND]);}
  let seen=false;
  for(let tries=0;tries<20&&!seen;tries++){
    sim.bout.setReferee(0,{x:0,z:0},0);
    Object.assign(sim.bout.position,{sub:'standing',control:0.95,escape:0,t:3});
    for(let i=0;i<90&&!seen;i++){sim.tick(DT,[cmd(i===0?{sprawl:true}:{}),NO_COMMAND]);if(readPrompts(sim,1).prompts.shoot.label==='Turn in')seen=true;}
  }
  ok(seen,'being returned, Shoot reads Turn in');
}
// A slam only off a tired rider's lift, never a fresh one.
{
  let tired=0,fresh=0;
  for(let seed=1;seed<=300;seed++){
    if(ret(seed,'fight',0.95,0,false,0.15).calls.includes('slam'))tired++;
    if(ret(seed,'fight',0.95,0,false,1).calls.includes('slam'))fresh++;
  }
  ok(tired>=2&&tired<=40,`a tired rider's lift is sometimes a slam (${tired} of 300)`);
  ok(fresh===0,'a fresh rider never slams him');
}
console.log('Mat returns: clean lands flat, turn in as you land, a tired lift can be a slam');
