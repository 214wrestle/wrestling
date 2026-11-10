// Hidden skill (owner, November 10): the Morenos (Mike Sr., Michael, Gabe, Izzy) and Shawn Rustad wrestle like
// high-80s wrestlers in a bout, but their shown rating, attribute bars and profile do not change.
import {ROSTER} from '../sim/roster';
import {HIDDEN_SKILL,withHiddenSkill} from '../sim/hiddenSkill';
import {playableMatchup} from '../sim/playerDifficulty';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
const names=['Mike Moreno Sr.','Michael Moreno','Gabe Moreno','Israel "Izzy" Moreno','Shawn Rustad'];
ok(names.every(n=>HIDDEN_SKILL[n]>=86&&HIDDEN_SKILL[n]<=89),'all five are set to the high 80s');
for(const n of names){
  const w=ROSTER.find(x=>`${x.firstName} ${x.lastName}`===n);
  ok(!!w,`${n} is on the roster`);
  // Shown: unchanged (rating from credentials, bars = rating / 100), with nothing hidden on the roster object.
  ok((w!.rating??0)<HIDDEN_SKILL[n]&&w!.attributes.mat===(w!.rating??0)/100&&w!.performanceRating===undefined,`${n}: shown rating ${w!.rating} and bars unchanged`);
  // In a bout: high 80s.
  const b=withHiddenSkill(w!);
  ok(b.performanceRating===HIDDEN_SKILL[n]&&Object.values(b.attributes).every(v=>v>=0.86),`${n}: a bout sees the high 80s`);
  ok(b.rating===w!.rating,`${n}: the bout copy still shows the same rating`);
  // Through a player's match, for him and against him.
  const other=ROSTER.find(x=>x.weightClass===w!.weightClass&&x.id!==w!.id)!;
  ok(playableMatchup([w!,other],0,'starter')[0].performanceRating===HIDDEN_SKILL[n],`${n}: applied when the player wrestles as him`);
  ok((playableMatchup([other,w!],0,'starter')[1].performanceRating??0)===HIDDEN_SKILL[n],`${n}: applied when the AI wrestles as him`);
}
// Nobody else is touched.
ok(ROSTER.filter(w=>!names.includes(`${w.firstName} ${w.lastName}`)).every(w=>withHiddenSkill(w)===w),'no one else changes');
console.log('Hidden skill: the Morenos and Shawn Rustad wrestle like high-80s wrestlers; shown ratings and bars unchanged');
