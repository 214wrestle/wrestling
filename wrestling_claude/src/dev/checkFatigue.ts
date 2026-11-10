// Fatigue (owner, November 10): ridden a long time he tires, more on his back; a tired defender is an opening and is
// easier to snap down; scoring gives a short burst of energy (momentum).
import {Bout, FATIGUE} from '../sim/bout';
import type {Position} from '../sim/bout';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const R=[PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]] as const;
function onMat(sub:'ride'|'exposed',secs:number){
  const b=new Bout([R[0],R[1]],{} as any,5);b.setReferee(0,{x:0,z:0},0);
  const p=b.position as Extract<Position,{kind:'mat'}>;
  if(sub==='exposed')Object.assign(p,{sub:'exposed',expo:0,awarded:0,pin:0});
  p.base=0.9;
  const s0=[b.athletes[0].stamina,b.athletes[1].stamina];
  for(let i=0;i<secs*60&&b.position===p;i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
  return {top:b.athletes[0].stamina-s0[0],bottom:b.athletes[1].stamina-s0[1],t:i0(b,p)};
}
const i0=(b:Bout,p:Position)=>b.position===p;
{
  const r=onMat('ride',20);
  ok(r.bottom<-0.05,`ridden 20 s he tires (${r.bottom.toFixed(3)})`);
  ok(r.top>r.bottom,'the rider tires less than the man underneath');
  const e=onMat('exposed',2);const rr=onMat('ride',2);
  ok(e.bottom<rr.bottom,`on his back he tires faster than ridden (${e.bottom.toFixed(3)} vs ${rr.bottom.toFixed(3)} in 2 s)`);
}
// A tired defender is an opening on his own: the shot counts as set up.
{
  const b=new Bout([R[0],R[1]],{} as any,5);b.setNeutral({x:0,z:0},0,0.95);
  for(let i=0;i<20;i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
  ok(!b.shotSetUp(0),'squared up with a fresh man: not set up');
  b.athletes[1].stamina=FATIGUE.openings-0.05;
  ok(b.shotSetUp(0),'against a tired man: set up');
}
// Easier to snap down when tired.
{
  let fresh=0,tired=0;
  for(let seed=1;seed<=300;seed++)for(const st of [1,0.15]){
    const b=new Bout([R[0],R[1]],{} as any,seed);b.setNeutral({x:0,z:0},0,0.75);
    for(let i=0;i<10;i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
    b.athletes[0].hand=0.8;b.athletes[1].stamina=st;
    const won=(b as any).resolveSnap(b.athletes[0],b.athletes[1]);
    if(won){if(st===1)fresh++;else tired++;}
  }
  ok(tired>fresh+20,`a tired man is snapped down more often (${tired} vs ${fresh} of 300)`);
}
// Momentum: scoring lifts him and makes effort cheaper for a while.
{
  const b=new Bout([R[0],R[1]],{} as any,5);b.athletes[0].stamina=0.5;
  b.momentum(0,3);
  ok(b.athletes[0].stamina>0.5&&(b.athletes[0].momentumT??0)>0,'a takedown gives a burst and momentum');
}
console.log('Fatigue: ridden and on his back he tires; a tired man is an opening and easier to snap; scoring gives momentum');
