// The tournament bracket (owner, November 10): a 32-man bracket at one weight, the best 32 by rating from any school
// (his pick always in), seeded, teammates apart in the first round; championship and NCAA double-elimination
// consolations, places 1-8.
import {ROSTER, LEGENDS_WEIGHTS} from '../sim/roster';
import { iconSchool, schoolLabel } from '../sim/schoolAbbr';
import {pickList} from '../sim/dual';
import {bracketOrder, firstRoundPairs, isDone, newTournament, pairOf, placements, playerMatch, seedOf, simMatch, simUntilPlayer, stillIn, tournamentField} from '../sim/tournament';
import type {Tournament} from '../sim/tournament';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const order=bracketOrder();
ok(order.slice(0,4).join(',')==='1,32,16,17'&&new Set(order).size===32,'standard bracket order');
ok(order.indexOf(1)<16&&order.indexOf(2)>=16,'the 1 and 2 seeds are in opposite halves');
// An Icon is on his own school's side in a tournament (owner, November 10).
const school=(id:string)=>{const w=ROSTER.find(w=>w.id===id)!;return iconSchool(w)??w.school.id;};
{
  const mills=ROSTER.find(w=>w.lastName==='Mills'&&w.firstName==='Gene')!;
  ok(schoolLabel(mills).name==='SYRACUSE'&&schoolLabel(mills).abbr==='SYR','an Icon shows his own school in the bracket and profile (Gene Mills, Syracuse)');
  ok(schoolLabel(mills,true).name===mills.school.name,'in a dual he wrestles for the Icons');
  ok(ROSTER.filter(w=>w.school.id==='college-wrestling-icons').every(w=>iconSchool(w)),'every Icon has his school on record');
  ok(iconSchool(ROSTER.find(w=>w.school.id!=='college-wrestling-icons')!)===null,'other teams are their own schools');
}
// Every weight: 32 men, several from a school allowed, never teammates in the first round; a low-rated pick is in.
for(const wt of LEGENDS_WEIGHTS){
  const low=[...ROSTER.filter(w=>w.weightClass===wt)].sort((a,b)=>(a.rating??0)-(b.rating??0))[0];
  const f=tournamentField(wt,low);
  ok(f.length===32&&new Set(f).size===32,`${wt}: 32 men`);
  ok(f.includes(low.id),`${wt}: his pick is in even when he is the lowest rated`);
  for(const [a,b] of firstRoundPairs())ok(school(f[a-1])!==school(f[b-1]),`${wt}: no teammates in the first round (${a} v ${b})`);
}
const multi=LEGENDS_WEIGHTS.some(wt=>{const f=tournamentField(wt,ROSTER.find(w=>w.weightClass===wt)!);return new Set(f.map(school)).size<32;});
ok(multi,'several men from one school make the field');
const me=pickList('iowa-state',157)[0];
let t:Tournament=newTournament(157,me,'starter',true);
ok(t.entrants.length===32&&t.entrants.includes(me.id),'a 32-man bracket with his pick');
ok(t.matches.filter(m=>m.id.startsWith('r1-')&&!m.result).length===16,'sixteen first-round bouts, no byes');
// Run it to the end: his matches simmed too.
let guard=0;
while(!isDone(t)&&guard++<200){const pm=playerMatch(t);t=pm?simMatch(t,pm):simUntilPlayer(t);}
ok(isDone(t),'the tournament runs to the end');
const losses:Record<string,number>={},wins:Record<string,number>={};
// Placement bouts (7th, 5th, 3rd, final) can add a loss after a man's run is over; the run itself ends at two.
for(const m of t.matches){if(!m.result||m.result.type==='bye'||m.side==='placement')continue;const p=pairOf(t,m) as [string,string];losses[p[m.result.winner===0?1:0]]=(losses[p[m.result.winner===0?1:0]]??0)+1;wins[p[m.result.winner]]=(wins[p[m.result.winner]]??0)+1;}
ok(Object.values(losses).every(n=>n<=2),'two losses ends a run');
const pl=placements(t);
ok(pl.length===8&&new Set(pl.map(p=>p.id)).size===8&&pl.map(p=>p.place).join(',')==='1,2,3,4,5,6,7,8','places 1-8, eight different men');
ok(!losses[pl[0].id],'the champion is unbeaten');
ok((losses[pl[2].id]??0)===1&&(losses[pl[1].id]??0)===0,'third place lost once before the placement bouts; the runner-up only in the final');
ok(!stillIn(t),'no one is still in once it is done');
console.log(`Tournament: 32-man brackets, teammates apart in round one, double elimination, places 1-8 (champion seed ${seedOf(t,pl[0].id)}; his pick seed ${seedOf(t,me.id)}, ${placements(t).find(p=>p.id===me.id)?.place??'no place'})`);
