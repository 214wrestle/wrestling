import { Bout } from '../sim/bout';
import { PROTOTYPE_ROSTER } from '../sim/roster';
import { NO_COMMAND } from '../sim/types';
const ok=(v:boolean,m:string)=>{if(!v)throw Error(m)};
const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},123);
b.setNeutral({x:0,z:0},0,1);
for(let i=0;i<25;i++)b.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND}]);
b.tick(1/60,[{...NO_COMMAND,lowSingle:true}, {...NO_COMMAND}]);
ok(b.position.kind==='shot' && b.position.shot==='lowSingle','manual ankle attack must select low-single clip');
for(let i=0;i<60 && b.position.kind!=='legs';i++)b.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND}]);
ok(b.position.kind==='legs','ankle entry establishes contested grip');
if(b.position.kind==='legs'){
 const before=b.position.progress,gas=b.athletes[1].stamina;
 b.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND,scramble:true}]);
 ok(b.position.progress<before,'defensive scramble contests attacking control');
 ok(b.athletes[1].stamina<gas,'scramble spends stamina');
 const after=b.position.progress;
 b.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND,scramble:true}]);
 ok(Math.abs(after-b.position.progress)<0.02,'holding scramble cannot repeatedly grant bursts');
}
b.setReferee(0,{x:0,z:0},0);
b.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND,scramble:false}]);
for(let i=0;i<100;i++)b.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND}]);
const gas=b.athletes[1].stamina;
b.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND,scramble:true}]);
ok(b.athletes[1].stamina<gas,'mat scramble remains an effort, not a free escape');
console.log('Low-single selection, contested grips, stamina and held-button checks passed');
