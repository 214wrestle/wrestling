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
const b=legs('single');b.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND,fight:true}]);
ok(b.position.kind==='move'&&b.position.id==='spladleCounter','stalled inside single admits spladle');
for(let i=0;i<110;i++)b.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND}]);
ok(b.position.kind==='mat'&&b.position.sub==='spladle'&&b.position.A===1,'defender wins locked control');
for(let i=0;i<1800;i++)b.tick(1/60,[{...NO_COMMAND,sprawl:true},{...NO_COMMAND}]);
ok(b.position.kind==='mat'&&b.position.sub==='spladle','elevated shoulders retain lock beyond ordinary exposure timeout');
const outside=legs('highCrotch');outside.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND,fight:true}]);
ok(outside.position.kind==='legs','head-outside high crotch cannot trigger inside single counter');
const fresh=legs('single',1);fresh.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND,fight:true}]);
ok(fresh.position.kind==='legs','fresh single cannot be spladled solely by button press');
let fell=false;const p=legs('single',4.6,()=>{fell=true});
p.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND,fight:true}]);
for(let i=0;i<1800&&!fell;i++)p.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND}]);
ok(fell,'unprotected shoulders in locked spladle eventually concede fall');
console.log('Spladle timing, inside/outside eligibility, retained lock and shoulder fall checks passed');
