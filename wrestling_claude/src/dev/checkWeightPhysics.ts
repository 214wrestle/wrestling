import { Bout } from '../sim/bout';
import { PROTOTYPE_ROSTER } from '../sim/roster';
import { NO_COMMAND, type Wrestler } from '../sim/types';
import { absoluteStrength } from '../sim/weightPhysics';
const athlete=(weightClass:number):Wrestler=>({...PROTOTYPE_ROSTER[0],weightClass,attributes:{...PROTOTYPE_ROSTER[0].attributes,quickness:.99,strength:.99}});
const travel=(weight:number)=>{
 const a=athlete(weight),b=new Bout([a,athlete(weight)],{},123);
 b.setNeutral({x:0,z:0},0,5);
 const start={...b.athletes[0].pos};
 for(let i=0;i<30;i++)b.tick(1/60,[{...NO_COMMAND,moveX:1},NO_COMMAND]);
 return Math.hypot(b.athletes[0].pos.x-start.x,b.athletes[0].pos.z-start.z);
};
const light=travel(125),heavy=travel(285);
if(!(light>heavy&&heavy>0))throw Error('Equal within-class quickness must produce slower heavyweight travel');
if(!(absoluteStrength(athlete(285))>absoluteStrength(athlete(125))))throw Error('Equal within-class strength must produce greater heavyweight force');
if(athlete(285).attributes.quickness!==athlete(125).attributes.quickness)throw Error('Class must not change the attribute rating');
console.log(`Equal 99 quickness: lightweight travel ${light.toFixed(3)}m, heavyweight ${heavy.toFixed(3)}m; equal strength increases absolute heavyweight force`);
