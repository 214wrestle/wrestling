import {Bout} from '../sim/bout';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
const ok=(v:boolean,m:string)=>{if(!v)throw Error(m)};
for(const technique of ['duckUnder','superDuck','slideBy','firemansCarry','footSweep'] as const){
 let won=0,countered=0;
 for(let seed=1;seed<=80;seed++){
  const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},seed);
  b.setNeutral({x:0,z:0},0,0.9);
  for(let i=0;i<25;i++)b.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND}]);
  b.athletes[0].hand=0.6;
  const gas=b.athletes[0].stamina;
  const cmd:Command={...NO_COMMAND,technique};
  b.tick(1/60,[cmd,{...NO_COMMAND}]);
  ok(b.position.kind==='move','valid setup must commit to paired attack');
  if(b.position.kind==='move'){
   won+=Number(b.position.id===technique);
   countered+=Number(b.position.id==='tieAttackCounter');
  }
  ok(b.athletes[0].stamina<gas,'special attack costs stamina');
 }
 ok(won>0&&countered>0,`${technique} must have both successes and counter exposure`);
}
console.log('Five tie attacks: setup, commitment, stamina and counter exposure verified');

// Same ratings, seed and setup: signature advantage must affect only foot sweeps.
function attempts(name:string, technique:NonNullable<Command['technique']>) {
 let wins=0;
 for(let i=1;i<=400;i++){
  const [firstName,lastName]=name.split(' ');
  const w={...PROTOTYPE_ROSTER[0],firstName,lastName};
  const b=new Bout([w,PROTOTYPE_ROSTER[1]],{},Math.imul(i,2654435761)>>>0);
  b.setNeutral({x:0,z:0},0,.9);
  for(let j=0;j<25;j++)b.tick(1/60,[{...NO_COMMAND},{...NO_COMMAND}]);
  b.athletes[0].hand=.6;
  b.tick(1/60,[{...NO_COMMAND,technique},{...NO_COMMAND}]);
  wins+=Number(b.position.kind==='move' && b.position.id===technique);
 }
 return wins;
}
const generic=attempts('Generic Wrestler','footSweep');
for(const name of ['Steve Mocco','Michael Mocco']){
 ok(attempts(name,'footSweep')>generic,`${name} must receive a functional sweep advantage`);
 ok(attempts(name,'slideBy')===attempts('Generic Wrestler','slideBy'),'signature bonus must not leak to other techniques');
}
console.log('Mocco foot-sweep advantage affects outcomes without changing other tie attacks');

for(const technique of ['duckUnder','superDuck','slideBy','firemansCarry','footSweep'] as const){
 const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},30);
 b.setNeutral({x:0,z:0},0,2.5);
 for(let i=0;i<30;i++)b.tick(1/60,[NO_COMMAND,NO_COMMAND]);
 b.tick(1/60,[{...NO_COMMAND,technique},NO_COMMAND]);
 ok(b.position.kind==='neutral' && b.athletes[0].act==='attackAttempt','out-of-range attack visibly attempts without inventing contact');
 ok(b.athletes[0].attemptedTechnique===technique,'failed entry preserves the requested technique');
 for(let i=0;i<35;i++)b.tick(1/60,[NO_COMMAND,NO_COMMAND]);
 ok(b.athletes[0].act==='stance','attempt recovers to stance');
}
console.log('Unsecured attacks visibly attempt their own technique and recover');
