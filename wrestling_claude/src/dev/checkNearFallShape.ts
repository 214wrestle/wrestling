// Near falls by how he got there (owner, November 10). A tilt, or a loose throw to his back, is a flash: he is caught
// for a couple of quick swipes and bellies back out, mostly a 2-point near fall; a tight throw lands him locked. Locked holds (half nelson, turk, cradles,
// bars) are where the 3s, 4s and falls come from. Squeezing a flash tightens it (a visible adjust), holding it longer.
import {Bout, FLASH_EXPOSURES, THROW_EXPOSURES, throwTight} from '../sim/bout';
import type {Position} from '../sim/bout';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const cmd=(c:Partial<Command>):Command=>({...NO_COMMAND,...c});

ok(['tilt','sitOutTurn'].every(id=>FLASH_EXPOSURES.has(id)),'tilts are flashes');
ok(!['halfNelson','turk','cradle','crossfaceCradle'].some(id=>FLASH_EXPOSURES.has(id)||THROW_EXPOSURES.has(id)),'locked holds are not');
ok(['lateralDrop','headlockThrow','cementMixer'].every(id=>THROW_EXPOSURES.has(id)),'throws to his back are tight or loose');
ok(throwTight({strength:0.95,mat:0.95})>throwTight({strength:0.4,mat:0.4})+0.2,'a strong, skilled thrower lands it tight more often');

/** He is on his back with `flash`; top squeezes (taps) or not; the bottom man fights (taps) or not. */
function expose(flash:number,squeeze:boolean,seed=7,fights=true){
  const won:string[]=[];let pts=0;
  const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{score:(_s:number,k:string)=>{pts+={nearFall2:2,nearFall3:1,nearFall4:1}[k as 'nearFall2']??0},
    feedback:(s:number,_b:string,r:string,l?:string)=>{if(s===0&&r==='won')won.push(l??'')}} as any,seed);
  b.setReferee(0,{x:0,z:0},0);
  const p=b.position as Extract<Position,{kind:'mat'}>;
  Object.assign(p,{sub:'exposed',expo:0,awarded:0,pin:0,flash});
  let t=0;
  for(let i=0;i<12*60&&b.position===p;i++,t+=DT)b.tick(DT,[cmd({shoot:squeeze,fight:squeeze&&i%10<5}),cmd({sprawl:fights&&i%15<7})]);
  return {t,pts,won,fell:b.position.kind==='move'&&b.position.id==='fall'};
}

// Both men working (the top man squeezes like the AI, the bottom man fights): a flash is off his back sooner than a
// locked hold, and the top man visibly tightens the flash as he works it, never a hold that is already locked.
{
  const f=expose(1,true),l=expose(0,true);
  ok(f.t<l.t,`a flash is shorter than a locked hold (${f.t.toFixed(1)} s vs ${l.t.toFixed(1)} s)`);
  ok(f.won.filter(x=>x==='Tightened').length>=2,'squeezing a flash shows him tightening it, step by step');
  ok(l.won.length===0,'a locked hold has nothing to tighten');
}
// Working the flash is what holds it: without the squeeze he is off his back before the count.
{
  const loose=expose(1,false),worked=expose(1,true);
  ok(loose.pts===0&&worked.pts>=2,`an unworked flash scores nothing (${loose.pts}), a worked one scores (${worked.pts})`);
}
// Even if he gives up, a flash is off his back sooner than a locked hold.
ok(expose(1,false,7,false).t<expose(0,false,7,false).t,'a flash is shorter than a locked hold when nobody fights');
console.log('Near falls: a flash is shorter than a locked hold; squeezing tightens it (a visible adjust) and holds it');
