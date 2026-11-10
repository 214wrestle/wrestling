// The dual meet (owner, November 10): all 12 weights, a drawn starting weight, a pick list per weight sorted by
// rating with no default, the other corner's locked starter, NCAA team points and tiebreakers, and a simulated bout.
import {LEGENDS_WEIGHTS, LEGENDS_TEAMS, ROSTER} from '../sim/roster';
import {MatchSim} from '../sim/MatchSim';
import {NO_COMMAND} from '../sim/types';
import {boutOrder, choiceFor, cornerPick, currentBout, pickOddEven, dualWinner, marquee, newDual, pickList, pickWrestler, recordBout, simulateBout, teamScore, titles, toBoutResult} from '../sim/dual';
import type {Dual} from '../sim/dual';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};

ok(LEGENDS_WEIGHTS.length===12,'all 12 weights');
const [home,away]=['penn-state','iowa'];
ok(LEGENDS_TEAMS.some(t=>t.id===home)&&LEGENDS_TEAMS.some(t=>t.id===away),'teams exist');
// Every team has a wrestler at every weight, and the pick list is in rating order.
for(const t of LEGENDS_TEAMS)for(const w of LEGENDS_WEIGHTS){
  const list=pickList(t.id,w);
  ok(list.length>0,`${t.team} has someone at ${w}`);
  for(let i=1;i<list.length;i++)ok((list[i-1].rating??-1)>=(list[i].rating??-1),`${t.team} ${w} pick list is in rating order`);
}
// The other corner's man is its locked starter.
const iowa157=cornerPick(away,157);
ok(iowa157.legends?.role==='starter','the other corner sends its starter');
// The draw: a starting weight, then up and round, each weight once.
const order=boutOrder(157);
ok(order[0]===157&&order[order.length-1]===149&&new Set(order).size===12,'bouts go up from the draw and wrap round');
// By default the dual starts at 118 and goes up in order (owner); the draw is optional.
{
  const plain=newDual([home,away],'starter',false);
  ok(plain.bouts.map(b=>b.weight).join(',')===LEGENDS_WEIGHTS.join(','),'118 first, then up in order');
  // The draw saves the marquee bout (most titles between them, then rating) for last (owner).
  const drawn=newDual([home,away],'starter',false,Math.random,true);
  const m=marquee([home,away]);
  ok(drawn.bouts[11].weight===m.weight&&drawn.marquee===m.weight,`the marquee bout is last (${m.weight}: ${m.ours.lastName} vs ${m.theirs.lastName}, ${m.titles} titles)`);
  for(const w of LEGENDS_WEIGHTS){const o=pickList(home,w)[0],t=cornerPick(away,w);ok(titles(o)+titles(t)<=m.titles,'no weight has more titles between them');}
  ok(new Set(drawn.bouts.map(b=>b.weight)).size===12,'still every weight once');
  for(const t of LEGENDS_TEAMS.slice(0,6))for(const u of LEGENDS_TEAMS.slice(6,12)){const x=newDual([t.id,u.id],'starter',false,Math.random,true);ok(x.bouts[11].weight===marquee([t.id,u.id]).weight,'marquee last for every pairing');}
  ok(titles(ROSTER.find(w=>w.lastName==='Haines')!)>=2,'titles read from his credentials (owner corrections included)');
}
// No default: the first bout has no pick until the player makes one.
let d:Dual=newDual([home,away],'starter',true,()=>0.5,true);
console.log('Penn State vs Iowa marquee:',marquee([home,away]).weight,marquee([home,away]).ours.lastName,'vs',marquee([home,away]).theirs.lastName,marquee([home,away]).titles,'titles');
ok(d.bouts.length===12&&currentBout(d)!.ours===undefined,'no default pick');
d=pickWrestler(d,pickList(home,currentBout(d)!.weight)[1]?.id??pickList(home,currentBout(d)!.weight)[0].id);
ok(currentBout(d)!.ours!==undefined,'the pick is kept');
// Team points and the order of play.
d=recordBout(d,{winner:0,type:'fall',score:[5,2],teamPoints:6,simulated:true});
d=recordBout(d,{winner:1,type:'decision',score:[2,4],teamPoints:3,simulated:true});
ok(teamScore(d)[0]===6&&teamScore(d)[1]===3,'team points: a fall is 6, a decision 3');
ok(currentBout(d)===d.bouts[2],'on to the third bout');
// Tiebreakers: equal team points, more bouts won.
let t:Dual={...d,bouts:d.bouts.map((b,i)=>({...b,result:i<6?{winner:0 as const,type:'decision' as const,score:[3,1] as [number,number],teamPoints:3,simulated:true}:i<10?{winner:1 as const,type:'technical-fall' as const,score:[1,16] as [number,number],teamPoints:5,simulated:true}:{winner:1 as const,type:'fall' as const,score:[0,2] as [number,number],teamPoints:6,simulated:true}}))};
ok(teamScore(t)[0]===18&&teamScore(t)[1]===32,'team score adds up');
t={...t,bouts:t.bouts.map((b,i)=>i<8?{...b,result:{...b.result!,winner:0,type:'decision',teamPoints:3}}:{...b,result:{...b.result!,winner:1,type:'technical-fall',teamPoints:6}})};
const w=dualWinner(t);
ok(teamScore(t)[0]===24&&teamScore(t)[1]===24&&w.side===0&&/bouts won/.test(w.how),`tied on points, won on bouts (${w.how})`);
// A simulated bout is a real, finished match between the two.
const ids:[string,string]=[pickList(home,157)[0].id,iowa157.id];
const r=simulateBout(ids,true,12345);
ok(!!r&&(r.winner===0||r.winner===1)&&r.teamPoints>=3,'a simulated bout finishes with a winner and team points');
ok(toBoutResult(r,true).simulated,'marked simulated');
ok(ROSTER.find(x=>x.id===ids[0])!.weightClass===157,'same weight');
// The coin toss before the dual (owner): the winner picks odd or even bouts; the second-period choice alternates.
{
  const won=newDual([home,away],'starter',false,()=>0.2);
  ok(won.toss.winner===0&&won.toss.odd===undefined&&choiceFor(won,won.bouts[0])===null,'our team won the toss: odd or even is ours to pick');
  const even=pickOddEven(won,false);
  ok(choiceFor(even,even.bouts[0])===1&&choiceFor(even,even.bouts[1])===0&&choiceFor(even,even.bouts[2])===1,'we took even bouts: the choice alternates, theirs in the 1st, ours in the 2nd');
  const lost=newDual([home,away],'starter',false,()=>0.8);
  ok(lost.toss.winner===1&&lost.toss.odd!==undefined,'their coach picks at once when they win the toss');
  const sides=lost.bouts.map(b=>choiceFor(lost,b));
  ok(sides.every((x,i)=>x===(i%2===0?lost.toss.odd:1-lost.toss.odd!)),'every bout alternates');
}
// A bout in a dual takes the choice from the dual's toss, with no toss of its own.
for(const preset of [0,1] as const){
  let same=0;
  for(let seed=1;seed<=20;seed++){
    const sim:any=new MatchSim([ROSTER[0],ROSTER[1]],{} as any,seed);
    sim.lengthScale=0.15;sim.presetChoice=preset;sim.humanSide=0;sim.startIntros();sim.skipIntros();
    for(let i=0;i<30000&&sim.period<2&&sim.phase!=='positionChoice'&&sim.phase!=='coinToss';i++)sim.tick(1/60,[NO_COMMAND,NO_COMMAND]);
    if(sim.coinTossWinner===preset)same++;
  }
  ok(same===20,`the dual's choice holds in every bout (${same}/20 for side ${preset})`);
}
console.log('Dual: 12 weights from 118 (or a drawn start), rating-ordered pick lists with no default, starters, team points, tiebreakers, simulated bouts');
