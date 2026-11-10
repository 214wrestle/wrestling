import { applyOwnerPace, HIGH_PACE_NAMES, isScrambleSpecialist, heavyweightActivity } from '../sim/athleteProfiles';
import { ROSTER } from '../sim/roster';
import { Bout, type Position } from '../sim/bout';
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

// Owner-selected 2026 champion profiles must reach actual contest mechanics.
const vega=ROSTER.find(w=>w.firstName==='Sergio'&&w.lastName==='Vega')!;
const forrest=ROSTER.find(w=>w.firstName==='Jax'&&w.lastName==='Forrest')!;
let cradleSelected=false;
for(let seed=1;seed<=30&&!cradleSelected;seed++){
 const bout=new Bout([vega,PROTOTYPE_ROSTER[1]],{},seed);
 bout.setReferee(0,{x:0,z:0},0);
 if(bout.position.kind!=='mat')throw Error('Expected referee mat position');
 bout.position.sub='flat';bout.position.base=0;bout.position.control=.8;
 bout.tick(1/60,[{...NO_COMMAND,shoot:true},{...NO_COMMAND}]);
 const after = bout.position as Position;
 if(after.kind==='move'){
  ok(after.id==='cradle','Vega successful turn uses cradle');
  cradleSelected=true;
 }
}
ok(cradleSelected,'Vega has a successful cradle attempt');
function scrambleProgress(specialist:boolean){
 const wrestler=specialist?forrest:{...forrest,firstName:'Control',lastName:'Wrestler'};
 const bout=new Bout([PROTOTYPE_ROSTER[0],wrestler],{},31);
 bout.position={kind:'legs',A:0,shot:'single',mirror:false,t:0,frame:{x:0,z:0,yaw:0},progress:.5,intensity:.5};
 bout.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND,scramble:true}]);
 return bout.position.kind==='legs'?bout.position.progress:1;
}
ok(scrambleProgress(true)<scrambleProgress(false),'Forrest specialist improves defensive scramble versus identical ordinary attributes');
ok((forrest.motion?.attackRate??0)>1,'Forrest retains elevated attack pace');
console.log('Vega cradle selection and Forrest pace/scramble mechanics verified');
