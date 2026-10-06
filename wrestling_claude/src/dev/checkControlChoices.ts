import {Bout} from '../sim/bout';
import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
let escapes=0;
const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{score:(_,kind)=>{if(kind==='escape')escapes++}},123);
b.setNeutral({x:0,z:0},0,1);
const gas=b.athletes[0].stamina;
b.tick(1/60,[{...NO_COMMAND,scramble:true},NO_COMMAND]);
ok(b.position.kind==='neutral','neutral scramble cannot initiate offense');
ok(b.athletes[0].stamina===gas,'invalid scramble must not spend stamina');
b.setReferee(0,{x:0,z:0},0);
ok(!b.cut(1),'bottom cannot voluntarily award an escape');
ok(b.cut(0)&&escapes===1&&b.position.kind==='neutral','cut awards exactly one escape and neutral');
ok(!b.cut(0)&&escapes===1,'cut cannot award twice');
for(const shot of ['single','highCrotch'] as const){
 b.position={kind:'legs',A:0,shot,mirror:false,t:0,frame:{x:0,z:0,yaw:0},progress:0.65,intensity:0};
 for(let i=0;i<55;i++)b.tick(1/60,[{...NO_COMMAND,legAction:'lift'},NO_COMMAND]);
 ok(b.position.kind==='legs'&&(b.position.lifted??0)>0.7,'single and high crotch can elevate leg without automatic score');
 b.tick(1/60,[{...NO_COMMAND,legAction:'double',shoot:true},NO_COMMAND]);
 ok(b.position.kind==='legs'&&b.position.shot==='double','lifted leg switches to double');
}
for(const action of ['trip','drive'] as const){
 b.position={kind:'legs',A:0,shot:'single',mirror:false,t:0,frame:{x:0,z:0,yaw:0},progress:0.98,intensity:0,lifted:1};
 for(let i=0;i<20&&b.position.kind==='legs';i++)b.tick(1/60,[{...NO_COMMAND,legAction:action,shoot:true},NO_COMMAND]);
 const finished=b.position as import('../sim/bout').Position;
 ok(finished.kind==='move'&&finished.id===(action==='trip'?'liftedLegTrip':'liftedLegDrive'),'distinct lifted-leg finish');
}
const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},123);
sim.humanSide=0;
sim.phase='setPosition';sim.phaseT=0;sim.phaseDur=3;
sim.bout.setReferee(0,{x:0,z:0},0);
sim.chooseTopRestart(true);sim.tick(0.1,[NO_COMMAND,NO_COMMAND]);
ok(sim.score[1]===0,'prewhistle cut must not score before wrestling starts');
sim.tick(3,[NO_COMMAND,NO_COMMAND]);
ok(sim.score[1]===1&&sim.bout.position.kind==='neutral','preselected cut applies at whistle');
console.log('Cut ownership, one-point release, prewhistle timing, neutral scramble restriction and elevated-leg branches passed');
let openEntries=0,closedEntries=0;
for(let seed=1;seed<=100;seed++){
 for(const closed of [false,true]){
  const ride=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},Math.imul(seed,2654435761)>>>0);
  ride.setReferee(0,{x:0,z:0},0);
  for(let i=0;i<1200;i++)ride.tick(1/60,[{...NO_COMMAND,legRide:true},{...NO_COMMAND,closePockets:closed}]);
  const p=ride.position;
  if(p.kind==='mat'&&(p.legRide??0)>=0.8){if(closed)closedEntries++;else openEntries++}
 }
}
ok(openEntries>closedEntries,'closed pockets reduce leg-ride entries across identical seeds');
const clear=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},7);
clear.setReferee(0,{x:0,z:0},0);
if(clear.position.kind==='mat')clear.position.legRide=1;
for(let i=0;i<250;i++)clear.tick(1/60,[NO_COMMAND,{...NO_COMMAND,catchLeg:true}]);
ok(clear.position.kind==='mat'&&(clear.position.legRide??0)<0.8,'inside-arm catch clears the riding leg');
console.log(`Leg rides: open pockets ${openEntries}/100, closed pockets ${closedEntries}/100; inside-arm clearance passed`);
let disrupted=0, guarded=0;
for(let seed=1;seed<=100;seed++)for(const guard of [false,true]){
 const finish=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},Math.imul(seed,2654435761)>>>0);
 finish.position={kind:'move',id:'finishSingle',A:0,mirror:false,t:0.2,dur:1.6,frame:{x:0,z:0,yaw:0},awarded:false,impacted:false,startA:{x:0,z:0,yaw:0},startB:{x:0,z:0.5,yaw:Math.PI},dist:0.5};
 finish.tick(1/60,[{...NO_COMMAND,scramble:guard},{...NO_COMMAND,scramble:true}]);
 const p=finish.position as import('../sim/bout').Position;
 if(p.kind==='legs'){if(guard)guarded++;else disrupted++}
}
ok(disrupted>0&&disrupted<100,'a scramble can disrupt a finish but cannot guarantee it');
ok(guarded<disrupted,'offensive counter-scramble protects contested finish');
console.log(`Contested finish: ${disrupted}/100 disrupted; ${guarded}/100 with offensive counter-scramble`);
for(const id of ['switch','escapeTurn'] as const){
 let contested=0;
 for(let seed=1;seed<=100;seed++){
  const move=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},Math.imul(seed,2654435761)>>>0);
  move.position={kind:'move',id,A:0,mirror:false,t:0.1,dur:1,frame:{x:0,z:0,yaw:0},awarded:false,impacted:false,startA:{x:0,z:0,yaw:0},startB:{x:0,z:0,yaw:0},dist:0.5};
  move.tick(1/60,[{...NO_COMMAND,scramble:true},NO_COMMAND]);
  if((move.position as import('../sim/bout').Position).kind==='mat')contested++;
 }
 ok(contested>0&&contested<100,`${id}: pre-score scramble restores a contested mat position`);
}
