// The Shoot button lights while the shot is set up (owner, November 10). It uses the same rule that decides a cold
// shot, so lit means a set-up shot and dark in range means a cold one. An opening holds for SET_UP_HOLD after it
// closes so a person can see it and go.
import {SET_UP_HOLD} from '../sim/bout';
import type {Position} from '../sim/bout';
import {MatchSim} from '../sim/MatchSim';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
import {readPrompts} from '../game/prompts';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const cmd=(c:Partial<Command>):Command=>({...NO_COMMAND,...c});

function squareUp(dist=0.95){
  const sim=new MatchSim([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{} as any,11);
  sim.humanSide=0;sim.startIntros?.();(sim as any).skipIntros?.();
  for(let i=0;i<4000&&sim.phase!=='wrestling';i++){if(sim.phase==='positionChoice')sim.choosePosition('neutral');sim.tick(DT,[NO_COMMAND,NO_COMMAND]);}
  sim.bout.setNeutral({x:0,z:0},0,dist);
  for(let i=0;i<20;i++)sim.tick(DT,[NO_COMMAND,NO_COMMAND]);
  return sim;
}
const shoot=(sim:MatchSim)=>readPrompts(sim,0).prompts.shoot;
const run=(sim:MatchSim,s:number)=>{for(let i=0;i<Math.round(s/DT);i++)sim.tick(DT,[NO_COMMAND,NO_COMMAND]);};

// Squared up with nothing: in range but dark, and the shot would be cold.
{
  const sim=squareUp();
  ok(shoot(sim).label==='Shoot','in range the button says Shoot');
  ok(shoot(sim).state==='idle'&&!sim.bout.shotSetUp(0),'squared up with no setup the button is dark');
  // A fake lights it.
  sim.bout.athletes[0].sinceFake=0.5;
  ok(shoot(sim).state==='hot','off a fake the button lights');
}

// The opening holds a moment after it closes, then the light goes out.
{
  const sim=squareUp();
  sim.bout.athletes[0].sinceFake=1.15;run(sim,0.1); // the fake's window closes during this
  ok(sim.bout.athletes[0].sinceFake>1.2,'the fake itself is over');
  ok(shoot(sim).state==='hot','but the light holds a moment');
  run(sim,SET_UP_HOLD+0.1);
  ok(shoot(sim).state==='idle','then it goes dark');
}

// Lit means a set-up shot, dark means a cold one.
{
  const lit=squareUp();lit.bout.athletes[0].sinceFake=1.15;run(lit,0.25);
  ok(shoot(lit).state==='hot','still lit');
  lit.tick(DT,[cmd({shoot:true}),NO_COMMAND]);
  const a=lit.bout.position as Extract<Position,{kind:'shot'}>;
  ok(a.kind==='shot'&&!a.cold,'a shot while the button is lit is not cold');
  const dark=squareUp();
  ok(shoot(dark).state==='idle','dark');
  dark.tick(DT,[cmd({shoot:true}),NO_COMMAND]);
  const c=dark.bout.position as Extract<Position,{kind:'shot'}>;
  ok(c.kind==='shot'&&c.cold===true,'a shot while it is dark is cold');
}

// Out of range it is a fake, and it never lights for a shot.
{
  const sim=squareUp(2.4);
  sim.bout.athletes[0].sinceFake=0.5;
  ok(shoot(sim).label==='Fake'&&shoot(sim).state!=='hot','out of range: Fake, not lit');
}
console.log('Shoot light: dark when cold, lit off a setup, holds a moment, and agrees with the cold-shot rule');
