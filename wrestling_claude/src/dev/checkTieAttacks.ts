import {Bout} from '../sim/bout';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
const ok=(v:boolean,m:string)=>{if(!v)throw Error(m)};
for(const technique of ['duckUnder','superDuck','slideBy','firemansCarry'] as const){
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
console.log('Four tie attacks: setup, commitment, stamina and counter exposure verified');
