// The clinch (owner, November 9): pummeling for underhooks, the body lock, and upper-body throws.
import {Bout} from '../sim/bout';
import type {Position} from '../sim/bout';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const R=[PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]] as const;

function clinch(seed:number){
  const b=new Bout([R[0],R[1]],{},seed);
  b.setNeutral({x:0,z:0},0,0.85);
  for(let i=0;i<30;i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
  return b;
}
/** One press of a command (a frame down, a frame up), then let it play out. */
function press(b:Bout,cmd:Partial<Command>,side=0,frames=60){
  const c=(on:boolean):[Command,Command]=>{const x={...NO_COMMAND,...(on?cmd:{level:cmd.level})};return side===0?[x,NO_COMMAND]:[NO_COMMAND,x]};
  b.tick(DT,c(true));
  for(let i=0;i<frames;i++)b.tick(DT,c(false));
}

// Pummel from the underhook (low + hand fight) for a body lock.
let locks=0,swims=0;
for(let seed=1;seed<=60;seed++){
  const b=clinch(seed);const A=b.athletes[0];
  A.hand=0.8;A.tie='underhook';
  b.tick(DT,[{...NO_COMMAND,level:true,fight:true},NO_COMMAND]);
  if(A.act==='swim')swims++;
  for(let i=0;i<10;i++)b.tick(DT,[{...NO_COMMAND,level:true},NO_COMMAND]);
  if((A.tie as string)==='bodyLock')locks++;
}
ok(swims===60,`low hand fight from an underhook is a pummel (${swims}/60)`);
ok(locks>=15&&locks<=50,`pummeling wins the body lock some of the time (${locks}/60)`);

// From the body lock, hand fight throws him: a lateral drop that lands him on his back for a takedown.
let drops=0,exposed=0,takedowns=0;
for(let seed=1;seed<=80;seed++){
  let td=false;
  const b=new Bout([R[0],R[1]],{score:(side,kind)=>{if(side===0&&kind==='takedown')td=true}},seed);
  b.setNeutral({x:0,z:0},0,0.8);
  for(let i=0;i<20;i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
  const A=b.athletes[0];A.hand=0.9;A.tie='bodyLock';
  b.tick(DT,[{...NO_COMMAND,fight:true},NO_COMMAND]);
  const p=b.position as Position;
  if(p.kind==='move'&&p.id==='lateralDrop'){
    drops++;
    for(let i=0;i<120&&b.position.kind==='move';i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
    const q=b.position as Position;
    if(q.kind==='mat'&&q.sub==='exposed'&&q.A===0)exposed++;
    if(td)takedowns++;
  }
}
// Cold (he is not driving in) it is a gamble (owner playtest, November 11: ties are common now, THROW_PUSH.dropBase);
// off his drive it flies (checkShotTiming).
ok(drops>=12&&drops<=50,`the lateral drop lands some of the time (${drops}/80)`);
ok(exposed===drops&&takedowns===drops,`every lateral drop scores the takedown and lands him exposed (${takedowns}, ${exposed} of ${drops})`);

// His underhook on you: hand fight swims your arm back inside; sideways is the headlock, which can give up your back.
let back=0,heads=0,givenUp=0;
for(let seed=1;seed<=80;seed++){
  const b=clinch(seed);const [A,B]=b.athletes;
  B.hand=0.8;B.tie='underhook';A.hand=0.2;
  press(b,{fight:true},0,12);
  if(A.tie==='underhook'&&B.tie!=='underhook')back++;
  const c=clinch(seed+1000);c.athletes[1].hand=0.8;c.athletes[1].tie='underhook';c.athletes[0].hand=0.2;
  c.tick(DT,[{...NO_COMMAND,technique:'headlock'},NO_COMMAND]);
  c.tick(DT,[NO_COMMAND,NO_COMMAND]);
  const p=c.position as Position;
  if(p.kind==='move'&&p.id==='headlockThrow'&&p.A===0)heads++;
  if(p.kind==='move'&&p.id==='throwBy'&&p.A===1)givenUp++;
}
ok(back>=25,`pummeling back takes the underhook away often (${back}/80)`);
ok(heads>=8&&heads<=45,`the headlock lands some of the time (${heads}/80)`);
ok(givenUp>=10,`a missed headlock can give up the back (${givenUp}/80)`);
console.log(`Clinch: pummel to body lock ${locks}/60, lateral drop ${drops}/80 (all takedowns to his back), pummel back ${back}/80, headlock ${heads}/80, back given up ${givenUp}/80`);
