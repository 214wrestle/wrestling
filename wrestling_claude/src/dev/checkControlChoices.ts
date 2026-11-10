import {wrestlerViews} from '../game/views';
import {readPrompts} from '../game/prompts';
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
for (const [button,id] of [['shoot','standingTrip'],['fight','crotchLift'],['sprawl','returnMat']] as const) {
 let wins=0;
 for(let seed=1;seed<=100;seed++) {
  let points=0;
  const standing=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{score:()=>points++},Math.imul(seed,2654435761)>>>0);
  standing.setReferee(0,{x:0,z:0},0);
  if(standing.position.kind==='mat'){standing.position.sub='standing';standing.position.control=.9;standing.position.escape=.1;standing.position.t=3;}
  standing.tick(1/60,[{...NO_COMMAND,[button]:true},NO_COMMAND]);
  const p=standing.position;
  if(p.kind==='move'){
   ok(p.id===id,'standing buttons select their distinct return');wins++;
   for(let i=0;i<120;i++)standing.tick(1/60,[NO_COMMAND,NO_COMMAND]);
   // A clean return lands him flat through a breakdown (mat return depth): the same man is still on top.
   const after=standing.position;
   ok((after.kind==='mat'||after.kind==='move'&&after.id==='breakdown')&&after.A===0,'return preserves the original top wrestler');
  }
  ok(points===0,'standing returns never award another takedown');
 }
 ok(wins>0&&wins<100,'standing returns permit success and failure');
}
console.log('Standing trip, crotch lift and mat return preserve control without extra points');

const promptSim = new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},123);
promptSim.phase = 'wrestling';
for (const shot of ['single','highCrotch','double','lowSingle'] as const) {
 promptSim.bout.position={kind:'legs',A:0,shot,mirror:false,t:0,frame:{x:0,z:0,yaw:0},progress:.6,lifted:shot==='single'?.4:0,intensity:0};
 const attack=readPrompts(promptSim,0),defense=readPrompts(promptSim,1);
 // Simple controls: finishes ride on the main buttons (hold Hand fight to lift, Shoot + stick/Lower).
 ok((attack.legActions?.length??0)===0,'no separate finish buttons');
 const liftable=shot==='single'||shot==='highCrotch';
 ok((attack.prompts.fight.label==='Lift leg')===liftable,'Hand fight lifts only a single or high crotch');
 ok((attack.prompts.shoot.alt??'').includes('Trip')===liftable,'trip is offered only where the leg can be lifted');
 ok(shot==='lowSingle'?!attack.prompts.shoot.alt:(attack.prompts.shoot.alt??'').includes('double'),'Lower + Shoot double option matches the grip');
 ok(defense.legActions?.length===0,'defender cannot request attacker leg finishes');
 const name={single:'Single leg',highCrotch:'High crotch',double:'Double leg',lowSingle:'Low single'}[shot];
 ok([attack,defense].every(p=>p.meters.some(m=>m.label===name&&m.value===.6)),'both sides see captured leg type and finish progress');
 if(shot==='single')ok(attack.meters.some(m=>m.label==='Leg lift'),'lift and finish are distinct meters');
}
console.log('Leg finish controls respect grip type and preserve both progress meters');

for(const sub of ['ride','flat'] as const) {
 sim.phase='wrestling';sim.bout.setReferee(0,{x:0,z:0},0);
 if(sim.bout.position.kind!=='mat')throw Error('Expected mat fixture');
 Object.assign(sim.bout.position,{sub,legRide:.5,pockets:.8,legCaught:.4});
 for(const side of [0,1] as const){
  const meters=readPrompts(sim,side).meters;
  for(const [label,value,offense] of [['Opening the pocket',.5,true],['Pockets closed',.8,false],['Clearing the leg',.4/.75,false]] as const){
   const m=meters.find(m=>m.label===label);
   ok(m?.value===value && m.tone===((side===0)===offense?'you':'them'),`${sub} ${side}: ${label} exposes actual contest progress`);
  }
 }
}
console.log('Leg-entry, pocket defense and clearing feedback remain visible when flattened');

for(const sub of ['ride','flat'] as const){
 sim.phase='wrestling';sim.bout.setReferee(0,{x:0,z:0},0);
 // Flat with the pockets closed: pressed all the way down (a flat man working up shows the push instead, owner Nov 10).
 Object.assign(sim.bout.position,{sub,pockets:.8,legRide:0,legCaught:0,...(sub==='flat'?{base:0,heave:0}:{})});
 for(const view of wrestlerViews(sim))ok(view.mode==='paired' && view.clip===(sub==='flat'?'closedPocketsFlat':'closedPockets') && view.progress===.8,'pocket defense follows actual mat posture');
}
console.log('Flat pocket defense routes to prone animation without changing kneeling defense');

for(const sub of ['ride','flat'] as const){
 sim.phase='wrestling';sim.bout.setReferee(0,{x:0,z:0},0);
 Object.assign(sim.bout.position,{sub,pockets:.8,legRide:.5,legCaught:0});
 for(const view of wrestlerViews(sim))ok(view.mode==='paired' && view.clip===(sub==='flat'?'legRideFlat':'legRide') && view.progress===.5 && view.pockets===.8,'leg-entry view preserves actual mat posture and simultaneous defense');
}

for(const sub of ['ride','flat'] as const){
 sim.phase='wrestling';sim.bout.setReferee(0,{x:0,z:0},0);
 Object.assign(sim.bout.position,{sub,pockets:.4,legRide:1,legCaught:.6});
 for(const view of wrestlerViews(sim))ok(view.mode==='paired' && view.clip===(sub==='flat'?'catchRidingLegFlat':'catchRidingLeg') && Math.abs(view.progress-.8)<1e-9,'leg catch preserves prone versus kneeling position and progress');
}
console.log('Prone leg catch routes without lifting bottom into kneeling');

sim.phase='wrestling';sim.bout.setReferee(0,{x:0,z:0},0);
Object.assign(sim.bout.position,{sub:'flat',legRide:1,legCaught:0,pockets:0});
const storedSkill=sim.bout.wrestlers[0].attributes.legRiding;
sim.bout.wrestlers[0].attributes.legRiding=.3;
const weakRide=wrestlerViews(sim)[0];
sim.bout.wrestlers[0].attributes.legRiding=.95;
const strongRide=wrestlerViews(sim)[0];
sim.bout.wrestlers[0].attributes.legRiding=storedSkill;
ok(weakRide.mode==='paired'&&strongRide.mode==='paired'&&weakRide.clip==='legRidePressure'&&strongRide.clip==='legRidePressure'&&strongRide.progress>weakRide.progress,'visible established pressure follows leg-riding technique');
console.log('Established low-base leg ride shows skill-dependent pressure');
