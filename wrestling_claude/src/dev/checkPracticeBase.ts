import { Bout, type Position } from '../sim/bout';
import { PROTOTYPE_ROSTER } from '../sim/roster';
import { NO_COMMAND, type Side } from '../sim/types';
const assert=(v:boolean,m:string)=>{if(!v)throw Error(m)};
for(const top of [0,1] as Side[])for(const hz of [30,60,120])for(const sub of ['ride','flat'] as const){
 const bottom=(1-top) as Side;
 const create=(partner:Side|null)=>{
  const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},21);
  b.practicePartner=partner;
  b.position={kind:'mat',A:top,sub,t:0,frame:{x:0,z:0,yaw:0},base:.4,control:.5,escape:0,expo:0,awarded:0,pin:0,pinHold:0,fight:0,commit:0,basing:0,turnCool:0,intensity:0};
  return b;
 };
 const b=create(bottom);
 for(let i=0;i<hz*20;i++)b.tick(1/hz,[{...NO_COMMAND},{...NO_COMMAND}]);
 assert(b.position.kind==='mat'&&b.position.sub===sub&&Math.abs(b.position.base-.4)<1e-6,'cooperative partner preserves setup for twenty seconds');
 for(const partner of [null,top]){
  const normal=create(partner);
  normal.tick(1/hz,[{...NO_COMMAND},{...NO_COMMAND}]);
  assert((normal.position as Extract<Position,{kind:'mat'}>).base>.4,'match and human base recovery preserved');
 }
 if(sub==='flat'){
  const cmds=[{...NO_COMMAND},{...NO_COMMAND}] as [typeof NO_COMMAND,typeof NO_COMMAND];
  cmds[bottom]={...NO_COMMAND,fight:true};b.tick(1/hz,cmds);
  assert(b.position.kind==='mat'&&b.position.base>.4,'explicit defensive input still works');
 }
}
console.log('Practice setup retention, both sides, 30/60/120Hz, normal recovery and active defense PASS');

// Normal top setup must permit repeated move drills without random rejection.
for (const top of [0,1] as Side[]) for (const mirror of [false,true]) for (let seed=1;seed<=40;seed++) {
 const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},seed);
 b.practicePartner=(1-top) as Side;
 b.position={kind:'mat',A:top,sub:'flat',t:0,frame:{x:0,z:0,yaw:0},base:0,control:.5,escape:0,expo:0,awarded:0,pin:0,pinHold:0,fight:0,commit:0,basing:0,turnCool:0,intensity:0};
 const commands=[{...NO_COMMAND},{...NO_COMMAND}] as [import('../sim/types').Command,import('../sim/types').Command];
 commands[top]={...NO_COMMAND,shoot:true,topTurn:{style:'armBar',mirror}};
 b.tick(1/60,commands);
 const outcome=b.position as Position;
 assert(outcome.kind==='move' && outcome.id==='armBarTurn','flattened Practice partner allows arm-bar drill');
}
console.log('Cooperative arm-bar attempts: both top roles, mirrored sides, forty seeds PASS');

for (const scenario of ['active defense','base intact','ordinary match'] as const) {
 let resisted=0;
 for (let seed=1;seed<=80;seed++) {
  const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},seed*7919);
  b.practicePartner=scenario==='ordinary match'?null:1;
  b.position={kind:'mat',A:0,sub:'flat',t:0,frame:{x:0,z:0,yaw:0},base:scenario==='base intact'?.4:0,control:.5,escape:0,expo:0,awarded:0,pin:0,pinHold:0,fight:0,commit:0,basing:0,turnCool:0,intensity:0};
  b.tick(1/60,[{...NO_COMMAND,shoot:true,topTurn:{style:'armBar',mirror:false}},{...NO_COMMAND,fight:scenario==='active defense'}]);
  const outcome=b.position as Position;
  if(outcome.kind==='move' && outcome.id==='armBarResisted')resisted++;
 }
 assert(resisted>0,scenario+' must retain turn resistance');
}
console.log('Active defense, intact base and ordinary matches retain resisted turns PASS');
