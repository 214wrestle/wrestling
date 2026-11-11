// Owner, November 10: stand-ups and sit-outs work off back pressure and hand control; a stand-up is often an
// explosive move right off the whistle; the top man has 3-4 breakdowns to pick before the whistle on the restart.
// Hand fight on the bottom takes the hands (the switch only when the rider is over); hands, back pressure and the
// whistle each raise the stand-up; the chosen breakdown lands after the whistle and changes the bottom man's odds.
import {BREAKDOWNS, HANDS, OPENER} from '../sim/bout';
import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const cmd=(c:Partial<Command>):Command=>({...NO_COMMAND,...c});
function live(){
  const sim:any=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{} as any,5);
  sim.humanSide=0;sim.startIntros();sim.skipIntros();
  for(let i=0;i<4000&&sim.phase!=='wrestling';i++){if(sim.phase==='positionChoice')sim.choosePosition('neutral');sim.tick(DT,[NO_COMMAND,NO_COMMAND]);}
  sim.referee={id:'average',label:'',patience:40,rate:1};
  return sim;
}
const ride=(sim:any,set:Record<string,unknown>={})=>{sim.bout.position=sim.bout.matPosition(0,{x:0,z:0,yaw:0},'ride',0.8);Object.assign(sim.bout.position,{control:0.6,...set});sim.bout.athletes[1].stamina=1;};
// Hand fight with no switch window: hand control, no switch try, no base lost.
{
  const sim=live();ride(sim,{commit:0});
  sim.tick(DT,[cmd({}),cmd({fight:true})]);
  const p=sim.bout.position;
  ok(p.kind==='mat'&&p.sub==='ride'&&(p.hands??0)>0.3&&p.base>=0.79,`hand fight takes the hands (${p.hands}), base kept (${p.base})`);
}
// Hand fight right after a chop (the window): the switch try.
{
  const sim=live();ride(sim,{commit:HANDS.switchWindow+0.2});
  sim.tick(DT,[cmd({}),cmd({fight:true})]);
  const p=sim.bout.position;
  ok(p.kind==='move'&&p.id==='switch'||p.kind==='mat'&&p.base<0.7&&!(p.hands??0),'hand fight in the switch window is the switch');
}
// Stand-up odds: plain, with hands + back pressure, off the whistle, against a held near ankle.
const rate=(set:Record<string,unknown>,n=500)=>{const sim=live();let up=0;
  for(let i=0;i<n;i++){ride(sim,set);sim.tick(DT,[cmd({}),cmd({})]);ride(sim,set);sim.tick(DT,[cmd({}),cmd({shoot:true})]);const p=sim.bout.position;if(p.kind==='move'&&p.id==='standUp')up++;}
  return up/n;};
const plain=rate({}),worked=rate({hands:1,back:1}),whistle=rate({whistle:HANDS.whistle}),ankle=rate({whistle:HANDS.whistle,opener:'ankle'});
ok(worked>plain*1.4,`hands and back pressure raise the stand-up (${(plain*100).toFixed(0)}% -> ${(worked*100).toFixed(0)}%)`);
ok(whistle>plain*1.3,`off the whistle raises the stand-up (${(plain*100).toFixed(0)}% -> ${(whistle*100).toFixed(0)}%)`);
ok(ankle<whistle*0.7,`a near ankle stops the whistle stand-up (${(whistle*100).toFixed(0)}% -> ${(ankle*100).toFixed(0)}%)`);
// Each breakdown lands after the whistle: the chop breaks the base, the ankle is held, the legs go in.
for(const b of BREAKDOWNS){
  const sim=live();sim.bout.setReferee(0,{x:0,z:0},0);
  ok(sim.bout.whistleBreakdown(b.id)===b.id,`${b.label} chosen`);
  const base0=sim.bout.position.base;
  for(let t=0;t<OPENER.delay+0.1;t+=DT)sim.tick(DT,[cmd({}),cmd({})]);
  const p=sim.bout.position;
  if(p.kind==='mat'){
    ok(base0-p.base>OPENER[b.id].base*0.5,`${b.label} breaks the base (${base0.toFixed(2)} -> ${p.base.toFixed(2)})`);
    if(b.id==='ankle')ok((p.ankleT??0)>1,'near ankle held');
    if(b.id==='legs')ok((p.legRide??0)>=1,'legs in');
  } else ok(p.kind==='move'&&p.id==='breakdown',`${b.label}: flat or broken down`);
}
// The player's pick reaches the whistle; the AI picks its own.
{
  const sim=live();sim.bout.setReferee(0,{x:0,z:0},0);sim.chooseBreakdown('spiral');sim.goWrestle();
  ok(sim.bout.position.opener==='spiral','the player\'s breakdown goes at the whistle');
  const ai=live();ai.bout.setReferee(1,{x:0,z:0},0);ai.goWrestle();
  ok(!!ai.bout.position.opener,'the AI on top picks a breakdown');
}
console.log(`Hand control and back pressure (stand-up ${(plain*100).toFixed(0)}% -> ${(worked*100).toFixed(0)}%), off the whistle ${(whistle*100).toFixed(0)}%, near ankle ${(ankle*100).toFixed(0)}%, four whistle breakdowns`);
