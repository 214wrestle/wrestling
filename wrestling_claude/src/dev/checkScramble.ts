import { applyOwnerPace, HIGH_PACE_NAMES, isScrambleSpecialist, heavyweightActivity } from '../sim/athleteProfiles';
import { ROSTER } from '../sim/roster';
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

ok(isScrambleSpecialist("Ben Askren"),"Askren must receive scramble specialist behavior");
ok(!isScrambleSpecialist("Max Askren"),"specialist status cannot leak by surname");
ok(ROSTER.find(w => w.firstName === "Ben" && w.lastName === "Askren")?.hairStyle === "afro","Askren must use his own curly afro silhouette");

for (const name of ['Kyle Snyder','Nick Gwiazdowski','Mason Parris','Steve Mocco','Michael Mocco','Cole Konrad','Tommy Rowlands','Dreshaun Ross']) {
 const entries=ROSTER.filter(w=>`${w.firstName} ${w.lastName}`===name);
 ok(entries.length>0,`${name} must resolve to approved roster`);
 for(const w of entries)ok(heavyweightActivity(w).attack===1.25,`${name} must initiate actively at heavyweight`);
}
const ordinaryHeavy=heavyweightActivity({firstName:'Other',lastName:'Wrestler',weightClass:285});
ok(ordinaryHeavy.attack===0.65,'ordinary heavyweight initiation must be lower');
ok(heavyweightActivity({firstName:'Kyle',lastName:'Snyder',weightClass:197}).attack===1,'heavyweight pace cannot affect another weight');
console.log('Heavyweight activity exceptions and weight isolation passed');

const metcalf=ROSTER.find(w=>w.firstName==='Brent'&&w.lastName==='Metcalf');
ok(metcalf?.motion?.highCrotchHand==='left','Metcalf specialty must be left-handed');
ok((metcalf?.motion?.shots.highCrotch??0)>0.6,'Metcalf must favor high crotches');

for(const name of HIGH_PACE_NAMES)ok(applyOwnerPace(name).tempo>=1.2,`${name} must sustain higher pace`);
ok(applyOwnerPace('Bo Bassett').tempo>applyOwnerPace('David Taylor').tempo,'Bassett receives strongest sustained tempo');
