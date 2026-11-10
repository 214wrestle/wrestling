// Reshot (owner, November 9; Cary Kolat's reshot drill): a bad shot that gets blocked leaves the shooter
// off balance, and the defender's shot right then is a reshot that a stumbling man cannot sprawl on.
import {Bout} from '../sim/bout';
import type {Position} from '../sim/bout';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const R=[PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]] as const;
const cmd=(c:Partial<Command>):Command=>({...NO_COMMAND,...c});

/** A shoots from `dist` off a fake, D sprawls on it. Returns the bout once back in neutral (or wherever it went).
 *  The fake keeps it a set-up shot that is bad only for the distance: a cold one is sprawled into his front
 *  headlock instead (see checkColdShot). */
function shotIntoSprawl(seed:number,dist:number,calls:string[]){
  const b=new Bout([R[0],R[1]],{announce:(t:string)=>calls.push(t)},seed);
  b.setNeutral({x:0,z:0},0,dist);
  for(let i=0;i<20;i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
  b.athletes[0].sinceFake=0.5;
  b.tick(DT,[cmd({shoot:true}),NO_COMMAND]);
  b.tick(DT,[NO_COMMAND,cmd({sprawl:true})]);
  for(let i=0;i<120&&b.position.kind!=='neutral'&&b.position.kind!=='fhl'&&b.position.kind!=='legs';i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
  return b;
}

let blocked=0,offBalance=0,fhl=0;
for(let seed=1;seed<=120;seed++){
  const calls:string[]=[];
  const b=shotIntoSprawl(seed,1.3,calls);
  if(calls.includes('Blocked')){blocked++;const A=b.athletes[0];if(b.position.kind==='neutral'&&A.act==='stagger'&&(A.reshot??0)>0)offBalance++;}
  if(b.position.kind==='fhl')fhl++;
}
ok(blocked>=15,`a bad shot into a sprawl is often blocked short (${blocked}/120)`);
ok(offBalance===blocked,`every blocked bad shot leaves the shooter off balance (${offBalance}/${blocked})`);
ok(fhl>=10,`it is still stuffed into a front headlock some of the time (${fhl}/120)`);

// The defender's reshot against the stumbling shooter (who tries to sprawl and cannot), against a set man.
function counter(seed:number,stumbling:boolean){
  const calls:string[]=[];
  const b=new Bout([R[0],R[1]],{announce:(t:string)=>calls.push(t)},seed);
  b.setNeutral({x:0,z:0},0,0.95);
  for(let i=0;i<20;i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
  const A=b.athletes[0];
  if(stumbling){b['setAct'](A,'stagger',0.9);A.reshot=1.1;}
  b.tick(DT,[NO_COMMAND,cmd({shoot:true})]);
  for(let i=0;i<4;i++)b.tick(DT,[cmd({sprawl:i===1}),NO_COMMAND]);
  for(let i=0;i<60&&b.position.kind==='shot';i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
  const p=b.position as Position;
  return {inOnLegs:p.kind==='legs'&&p.A===1||p.kind==='move'&&p.A===1&&/^(finish|lift)/.test(p.id),called:calls.includes('Reshot!')};
}
let reIn=0,setIn=0,called=0;
for(let seed=1;seed<=100;seed++){const r=counter(seed,true);if(r.inOnLegs)reIn++;if(r.called)called++;if(counter(seed,false).inOnLegs)setIn++;}
ok(called===100,`a shot on a stumbling shooter is called a reshot (${called}/100)`);
ok(reIn>=setIn+25,`the reshot gets in on the legs far more often than a shot on a set man (${reIn} vs ${setIn} of 100)`);
console.log(`Reshot: bad shots blocked ${blocked}/120 (all off balance), stuffed to front headlock ${fhl}/120; reshot in on the legs ${reIn}/100 vs ${setIn}/100 on a set man`);
