import {MatchSim} from '../sim/MatchSim';
import {readPrompts} from '../game/prompts';
import { Bout } from '../sim/bout';
import { PROTOTYPE_ROSTER } from '../sim/roster';
import { NO_COMMAND } from '../sim/types';
const ok=(v:boolean,m:string)=>{if(!v)throw Error(m)};
const frame={x:0,z:0,yaw:0};
function legs(shot:'single'|'highCrotch',age=4.6,onFall?:()=>void){
 const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{fall:onFall},21);
 b.position={kind:'legs',A:0,shot,mirror:false,t:age,frame:{...frame},progress:0.45,intensity:0.5};
 return b;
}
const b=legs('single');b.tick(1/60,[NO_COMMAND,{...NO_COMMAND,fight:true}]);
ok(b.position.kind==='legs'&&(b.position.counterGrip??0)>0,'first effort starts capture, not an automatic roll');
for(let i=0;i<180&&b.position.kind==='legs';i++)b.tick(1/60,[NO_COMMAND,{...NO_COMMAND,fight:true,sustainedEffort:true}]);
ok((b.position as import('../sim/bout').Position).kind==='move','unopposed sustained capture can secure counter');
for(let i=0;i<110;i++)b.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND}]);
ok(b.position.kind==='mat'&&b.position.sub==='spladle'&&b.position.A===1,'defender wins locked control');
for(let i=0;i<1800;i++)b.tick(1/60,[{...NO_COMMAND,sprawl:true},{...NO_COMMAND}]);
ok(b.position.kind==='mat'&&b.position.sub==='spladle','elevated shoulders retain lock beyond ordinary exposure timeout');
const outside=legs('highCrotch');outside.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND,fight:true}]);
ok(outside.position.kind==='legs','head-outside high crotch cannot trigger inside single counter');
const fresh=legs('single',1);fresh.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND,fight:true}]);
ok(fresh.position.kind==='legs','fresh single cannot be spladled solely by button press');
let fell=false;const p=legs('single',4.6,()=>{fell=true});
for(let i=0;i<180&&p.position.kind==='legs';i++)p.tick(1/60,[NO_COMMAND,{...NO_COMMAND,fight:true,sustainedEffort:true}]);
for(let i=0;i<1800&&!fell;i++)p.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND}]);
ok(fell,'unprotected shoulders in locked spladle eventually concede fall');
console.log('Spladle timing, inside/outside eligibility, retained lock and shoulder fall checks passed');

for(const hz of [30,60,120]) {
 for(const held of [false,true]) {
  const c=legs('single');
  let rolled=false;
  for(let i=0;i<hz*3&&c.position.kind==='legs';i++){
   c.tick(1/hz,[NO_COMMAND,{...NO_COMMAND,fight:held||i%Math.round(hz*.2)===0,sustainedEffort:held}]);
   const pos=c.position as import('../sim/bout').Position;
   rolled=pos.kind==='move'&&pos.id==='spladleCounter';
  }
  ok(rolled,`${hz}Hz ${held?'hold':'tap'} secures unopposed capture`);
 }
 const clear=legs('single');
 if(clear.position.kind==='legs')clear.position.counterGrip=.8;
 clear.tick(1/hz,[{...NO_COMMAND,fight:true},NO_COMMAND]);
 ok(clear.position.kind==='legs'&&(clear.position.counterGrip??1)<.65,'attacker can clear capture before lock');
 const lift=legs('single');
 if(lift.position.kind==='legs'){lift.position.counterGrip=.8;lift.position.lifted=.5;}
 lift.tick(1/hz,[{...NO_COMMAND,legAction:'lift'},{...NO_COMMAND,fight:true}]);
 ok(lift.position.kind==='legs'&&lift.position.counterGrip===0,'elevating the leg removes grounded capture opportunity');
}
console.log('Contested setup, tap/hold cadence, clear capture and elevated-leg protection passed at30/60/120Hz');

const display=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},21);
display.phase='wrestling';display.bout.position=legs('single').position;
if(display.bout.position.kind==='legs')display.bout.position.counterGrip=.4;
ok(readPrompts(display,1).prompts.fight.label==='Set spladle','defender gets explicit setup action');
ok(readPrompts(display,0).prompts.fight.label==='Clear capture','attacker gets explicit prevention action');
ok(readPrompts(display,0).meters.some(m=>m.label==='Spladle setup'&&m.value===.4),'capture progress is visible to attacker');
console.log('Both wrestlers receive named capture controls and progress feedback');

for(const mirror of [false,true]) {
 const side=legs('single');
 if(side.position.kind==='legs')side.position.mirror=mirror;
 for(let i=0;i<300&&side.position.kind!=='mat';i++)side.tick(1/60,[NO_COMMAND,{...NO_COMMAND,fight:true,sustainedEffort:true}]);
 ok(side.position.kind==='mat'&&side.position.sub==='spladle'&&side.position.mirror===mirror,'locked spladle preserves counter orientation');
}
console.log('Both captured sides survive the roll-to-hold transition');
