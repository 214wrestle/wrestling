import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import {wrestlerViews} from '../game/views';
import {sampleMove} from '../anim/clips';
import {createLocal} from '../anim/spec';
import {P} from '../anim/posture';
import '../anim/library';
for(const top of [0,1] as const)for(const mirror of [false,true])for(const cradle of [false,true])for(const finish of ['fightOff','fall'] as const){
 const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},21);
 sim.phase='wrestling';sim.clock=180;sim.bout.setReferee(top,{x:0,z:0},0);
 const p=sim.bout.position;if(p.kind!=='mat')throw new Error('Mat setup missing');
 p.sub='exposed';p.mirror=mirror;p.turnStyle=cradle?'cradle':undefined;
 if(finish==='fightOff')p.fight=1.2;else{p.pin=1.1;p.pinHold=1.1;}
 sim.tick(1/60,[NO_COMMAND,NO_COMMAND]);
 const views=wrestlerViews(sim);
 for(const v of views){
  const expected=cradle?(finish==='fall'?'cradleFall':'cradleFightOff'):finish;
  if(v.mode!=='paired'||v.clip!==expected||v.hold)throw new Error(`Wrong exit: ${expected}`);
  if(cradle&&v.mirror!==mirror)throw new Error('Cradle exit lost mirror');
 }
}
for(const mirror of [false,true]){
 const pose=createLocal();
 const early=sampleMove('cradleFightOff','A',.1,mirror,pose);
 if(early.filter(c=>c.clasp&&c.weight>.9).length!==2)throw new Error('Exit drops lock before hand fight');
 if(sampleMove('cradleFightOff','A',.5,mirror,pose).some(c=>c.clasp))throw new Error('Broken cradle still locked');
 for(const role of ['A','B'] as const)for(let i=0;i<=20;i++)for(const clip of ['cradleFightOff','cradleFall']){
  const contacts=sampleMove(clip,role,i/20,mirror,pose);
  if(!pose.every(Number.isFinite))throw new Error('Nonfinite exit pose');
  if(clip==='cradleFall'&&role==='A'&&contacts.filter(c=>c.clasp).length!==2)throw new Error('Fall loses cradle');
 }
 const foot=mirror?P.FOOT_R:P.FOOT_L;
 sampleMove('cradleFightOff','B',0,mirror,pose);const start=pose[foot+2];
 sampleMove('cradleFightOff','B',.7,mirror,pose);
 if(start-pose[foot+2]<.4)throw new Error('Freed leg does not kick out');
}
console.log('Cradle-specific exits preserve initial lock, release before kick-out, retain fall hold and mirror; generic pins unchanged');

// Count once at the shared grip-release point, not at the end of belly-down recovery.
const {CRADLE_GRIP_RELEASE}=await import('../sim/moves');
for(const hz of [30,60,120])for(const top of [0,1] as const)for(const lead of [0,11]){
 const events:unknown[]=[];
 const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{onScore:e=>events.push(e)},21);
 sim.phase='wrestling';sim.clock=180;sim.score[top]=lead;sim.bout.setReferee(top,{x:0,z:0},0);
 const p=sim.bout.position;if(p.kind!=='mat')throw new Error('Missing mat');
 p.sub='exposed';p.turnStyle='cradle';
 for(let i=0;i<Math.ceil(4.1*hz);i++)sim.tick(1/hz,[NO_COMMAND,NO_COMMAND]);
 if(sim.score[top]!==lead||sim.earnedNearFallPoints!==4)throw new Error('Count awarded before release');
 p.fight=1.2;sim.tick(1/hz,[NO_COMMAND,NO_COMMAND]);
 let sawRelease=false;
 for(let i=0;i<hz;i++){
  const before=sim.bout.position;
  const nextU=before.kind==='move'?(before.t+1/hz)/before.dur:0;
  sim.tick(1/hz,[NO_COMMAND,NO_COMMAND]);
  const pos=sim.bout.position;
  if(sim.result && !sawRelease){
   if(nextU<CRADLE_GRIP_RELEASE||sim.score[top]!==lead+4)throw new Error('Technical fall occurred before cradle release');
   sawRelease=true;
  }
  if(pos.kind==='move'&&pos.id==='fightOff'){
   const released=pos.t/pos.dur>=CRADLE_GRIP_RELEASE;
   if(sim.score[top] !== lead+(released?4:0))throw new Error('Near-fall award and cradle release disagree');
   if(released)sawRelease=true;
  }
 }
 if(lead===11 && sim.result?.type!=='technical-fall')throw new Error('Cradle release did not complete earned technical fall');
 if(!sawRelease||events.length!==1)throw new Error('Missing or duplicate release award');
}
console.log('Cradle near-fall award follows grip opening at30/60/120Hz without duplicate points');
