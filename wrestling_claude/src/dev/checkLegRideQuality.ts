import {Bout} from '../sim/bout';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND,type Command,type Side} from '../sim/types';
import {legRideQuality} from '../sim/legRideQuality';
const ok=(v:boolean,m:string)=>{if(!v)throw Error(m)};
function sample(skill:number,hz:number,side:Side,defend:boolean){
 const ws=PROTOTYPE_ROSTER.slice(0,2).map(w=>({...w,attributes:{...w.attributes}})) as [typeof PROTOTYPE_ROSTER[number],typeof PROTOTYPE_ROSTER[number]];
 ws[side].attributes.legRiding=skill;
 const b=new Bout(ws,{},21);b.setReferee(side,{x:0,z:0},0);
 if(b.position.kind!=='mat')throw Error('setup');
 Object.assign(b.position,{sub:'flat',base:.1,control:.5,legRide:1,legCaught:0,pockets:0});
 const commands:[Command,Command]=[{...NO_COMMAND},{...NO_COMMAND}];
 commands[side].legRide=true;commands[side===0?1:0].catchLeg=defend;
 for(let i=0;i<hz*.7;i++)b.tick(1/hz,commands);
 if(b.position.kind!=='mat')throw Error('short pressure fixture must remain on mat');
 return {control:b.position.control,base:b.position.base,caught:b.position.legCaught??0};
}
for(const side of [0,1] as const)for(const defend of [false,true]){
 const results=[];
 for(const hz of [30,60,120]){
  const weak=sample(.3,hz,side,defend),strong=sample(.95,hz,side,defend);
  ok(strong.control>weak.control,'specialist maintains more control');
  ok(strong.base<=weak.base,'specialist applies more flattening pressure');
  if(defend)ok(strong.caught<weak.caught,'specialist resists the inside-arm catch');
  results.push(strong.control);
 }
 ok(Math.max(...results)-Math.min(...results)<.015,'pressure stable across frame rates');
}
const w=PROTOTYPE_ROSTER[0];
ok(legRideQuality(w,1,1)>legRideQuality(w,1,.2),'fatigue reduces effective pressure');
ok(legRideQuality(w,1,1)>legRideQuality(w,1,1,.6),'caught boot loses pressure');
console.log({weak:sample(.3,60,0,true),strong:sample(.95,60,0,true)});
console.log('Leg riding skill, fatigue and defensive catch affect pressure without automatic scoring');
