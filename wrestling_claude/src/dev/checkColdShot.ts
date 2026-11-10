// Cold shots (owner, November 10: "low % shots that don't have a set up should have a low success rate and a
// higher % for the defensive wrestler to counter the shot and score"). A shot with no fake, hand-fight edge,
// reaction to catch, lean or angle is flagged cold, is a worse shot, is read more often and sooner by the
// defender's reflex, and a sprawl on it ends in his front headlock (where he scores), not a reset.
import {Bout, COLD_SHOT} from '../sim/bout';
import type {Position} from '../sim/bout';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
import type {Command} from '../sim/types';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const DT=1/60;
const R=[PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]] as const;
const cmd=(c:Partial<Command>):Command=>({...NO_COMMAND,...c});

/** Square up at `dist`; with `fake`, A has just faked. Returns the bout as A's shot starts. */
function shotFrom(seed:number,dist:number,fake:boolean,calls:string[]=[]){
  const b=new Bout([R[0],R[1]],{announce:(t:string,_k:string,sub?:string)=>calls.push(t+(sub?': '+sub:''))} as any,seed);
  b.setNeutral({x:0,z:0},0,dist);
  for(let i=0;i<20;i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
  if(fake)b.athletes[0].sinceFake=0.5;
  ok(b.shotSetUp(0)===fake,`square with ${fake?'a fake':'nothing'} the shot is ${fake?'set up':'cold'}`);
  b.tick(DT,[cmd({shoot:true}),NO_COMMAND]);
  return b;
}

// Flag and quality: the same shot without the setup is cold and clearly worse.
{
  const c=shotFrom(5,0.95,false).position as Extract<Position,{kind:'shot'}>;
  const s=shotFrom(5,0.95,true).position as Extract<Position,{kind:'shot'}>;
  ok(c.kind==='shot'&&s.kind==='shot','both shots start');
  ok(c.cold===true&&!s.cold,'the shot with no setup is flagged cold');
  ok(s.quality-c.quality>=COLD_SHOT,`a cold shot is a clearly worse shot (${c.quality.toFixed(2)} vs ${s.quality.toFixed(2)})`);
}

// The defender's reflex (the player's assisted side) catches a cold shot far more often, and sooner.
{
  let cold=0,set=0,coldAt=0,setAt=0;
  for(let seed=1;seed<=200;seed++){
    for(const fake of [false,true]){
      const b=new Bout([R[0],R[1]],{},seed);b.assistedSide=1;
      b.setNeutral({x:0,z:0},0,0.95);
      for(let i=0;i<20;i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
      if(fake)b.athletes[0].sinceFake=0.5;
      b.tick(DT,[cmd({shoot:true}),NO_COMMAND]);
      const p=b.position as Extract<Position,{kind:'shot'}>;
      if((p.reflexAt??-1)>=0){if(fake){set++;setAt+=p.reflexAt!/p.dur}else{cold++;coldAt+=p.reflexAt!/p.dur}}
    }
  }
  ok(cold>=set+50,`the reflex sprawls on far more cold shots (${cold} vs ${set} of 200)`);
  ok(coldAt/cold<setAt/set,'and earlier in the shot');
}

// A sprawl on a cold shot from a good distance ends in his front headlock nearly always, with the reason called.
{
  let fhl=0,blocked=0,legs=0,why=0;
  for(let seed=1;seed<=120;seed++){
    const calls:string[]=[];
    const b=shotFrom(seed,0.95,false,calls);
    b.tick(DT,[NO_COMMAND,cmd({sprawl:true})]);
    for(let i=0;i<120&&b.position.kind!=='neutral'&&b.position.kind!=='fhl'&&b.position.kind!=='legs';i++)b.tick(DT,[NO_COMMAND,NO_COMMAND]);
    if(b.position.kind==='fhl')fhl++;
    if(b.position.kind==='legs')legs++;
    if(calls.some(c=>c.startsWith('Blocked')))blocked++;
    if(calls.some(c=>c.includes('No setup')))why++;
  }
  ok(fhl>=90,`an early sprawl on a cold shot puts him in the defender's front headlock (${fhl}/120)`);
  ok(blocked<=20,`a cold shot is rarely just blocked back to neutral (${blocked}/120)`);
  ok(legs<=10,`a cold shot sprawled on early rarely gets to the legs (${legs}/120)`);
  ok(why>=fhl-5,`the callout says why: no setup (${why}/${fhl})`);
}
console.log('Cold shots: flagged, worse, read more often and sooner, and a sprawl on one ends in his front headlock');
