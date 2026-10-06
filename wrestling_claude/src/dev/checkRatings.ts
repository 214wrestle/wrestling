import {careerCredentials} from '../sim/credentials';
import { scoreCareer, seasonPoints, type NcaaSeason, CAREER_RECORDS, overallRating, recordAdjustment, ELIGIBILITY_SEASONS, COLLEGE_RECORDS } from '../sim/ratings';
import { HODGE_AWARDS, PIN_HISTORY, pinningMultiplier } from '../sim/careerAwards';
const assert = (ok: boolean) => { if (!ok) throw new Error('Rating scoring regression'); };
const result = (year: number, place: NcaaSeason['place'], outstandingWrestler = false): NcaaSeason => ({year, place, outstandingWrestler, source: 'test'});
assert([1,2,3,4,5,6,7,8].map(p=>seasonPoints(result(2000,p as NcaaSeason['place']))).join() === '10,9,7,6,5,4,3,2');
assert(seasonPoints(result(2000,'qualifier')) === 1);
assert(scoreCareer([1,2,3,4,5].map((_,i)=>result(2000+i,1))).total === 40);
assert(scoreCareer([1,2,3].map((_,i)=>result(1960+i,1)),3).averagePlacementPoints === 10);
assert(scoreCareer([1,2,3,4].map((_,i)=>result(2000+i,1))).averagePlacementPoints === 10);
const five = scoreCareer([result(2000,1),result(2001,1),result(2002,1),result(2003,2),result(2004,2,true)]);
assert(five.total === 40 && five.bonusPoints === 1 && five.excluded[0].year === 2003);
assert(scoreCareer([result(1972,1),result(1973,1)],2).averagePlacementPoints === 10);
assert(overallRating('Chris Taylor',scoreCareer([result(1972,1),result(1973,1)],2),{wins:87,losses:0,ties:1,source:'test'}) === 94);
const gable = scoreCareer(CAREER_RECORDS['Dan Gable'],3);
assert(gable.total === 30 && gable.placementPoints === 29 && gable.averagePlacementPoints === 29/3);
let rejected = false; try {scoreCareer([result(2000,1),result(2000,2)]);} catch { rejected = true; } assert(rejected);
console.log('Placement scale, four-season cap, era normalization, OW bonus and duplicate-season checks passed');

assert(overallRating('Other athlete',scoreCareer([1999,2000,2001,2002].map(y=>result(y,1,true))), {wins:159, losses:0,source:'test'}) === 98);
assert(overallRating('Cael Sanderson',scoreCareer(CAREER_RECORDS['Cael Sanderson'])) === 99);
assert(recordAdjustment({wins:75, losses:25, source:'test'}) === 0);
assert(recordAdjustment({wins:100, losses:0, source:'test'}) === 1);

// Validate the live research data, not just synthetic examples of the formula.
for (const [name, seasons] of Object.entries(CAREER_RECORDS)) {
  const eligible = ELIGIBILITY_SEASONS[name] ?? 4;
  if (seasons.length < eligible) throw new Error(`${name}: incomplete season coverage`);
  const career = scoreCareer(seasons, eligible);
  if (career.counted.length !== eligible) throw new Error(`${name}: wrong counted-season total`);
  for (const season of seasons) {
    if (!Number.isInteger(season.year) || !/^https:\/\//.test(season.source)) throw new Error(`${name}: missing season evidence`);
  }
  const rating = overallRating(name, career, COLLEGE_RECORDS[name]);
  if (!Number.isFinite(rating) || rating < 0 || rating > 99 || (rating === 99 && !['Dan Gable', 'Cael Sanderson'].includes(name))) throw new Error(`${name}: invalid overall rating`);
}
console.log(`${Object.keys(CAREER_RECORDS).length} researched careers have complete counted-season coverage and source links`);
const ordinary = scoreCareer([1997,1998,1999,2000].map(y=>result(y,4)));
assert(overallRating('Mark Ironside', ordinary) === overallRating('Other athlete', ordinary) + 1);
assert(overallRating('Spencer Lee', ordinary) === overallRating('Other athlete', ordinary) + 2);
const awards = Object.values(HODGE_AWARDS).flatMap(a=>a.years);
for (let year=1995;year<=2026;year++) assert(awards.filter(y=>y===year).length === ([2001,2021].includes(year)?2:1));
for (const h of Object.values(PIN_HISTORY)) {
  assert(/^https:\/\//.test(h.source));
  if (h.falls !== undefined) assert(Number.isInteger(h.falls) && h.falls>=0 && Number.isInteger(h.bouts) && h.bouts!>=h.falls);
}
assert(pinningMultiplier('Other athlete') === 1);
assert(pinningMultiplier('Mark Perry') > 1);
assert(pinningMultiplier('Jason Nolf') > pinningMultiplier('Ed Ruth'));
console.log('Hodge award coverage 1995–2026, shared awards, rating bonuses and fall-rate tendencies passed');

for (let titles = 0; titles <= 4; titles++) {
  const career = scoreCareer([0,1,2,3].map(i=>result(2000+i,i<titles?1:2,true)));
  assert(overallRating('Other athlete',career,{wins:100,losses:0,source:'test'}) <= 90 + 2*titles);
}
for (const [name,seasons] of Object.entries(CAREER_RECORDS)) {
  if (name !== 'Yojiro Uetake' && seasons.filter(s=>s.place===1).length === 3) assert(overallRating(name,scoreCareer(seasons),COLLEGE_RECORDS[name]) <= 96);
}
assert(overallRating('Dan Gable',gable) === 99);
console.log('Championship tiers and three-title 96 ceiling passed');

// Brackets resolve misleading summary rows: Jim was absent in 1981 and qualified in 1983.
assert(CAREER_RECORDS["Jim Scherr"].find(s=>s.year===1981)?.place===0);
assert(CAREER_RECORDS["Jim Scherr"].find(s=>s.year===1983)?.place==="qualifier");
assert(COLLEGE_RECORDS["Bill Scherr"].losses===18);

const credentialsCareer=scoreCareer([
 {year:2001,place:2,source:'fixture'}, {year:2002,place:3,source:'fixture'},
 {year:2003,place:4,source:'fixture'}, {year:2004,place:5,source:'fixture'},
 {year:2005,place:6,source:'fixture'},
]);
if(careerCredentials(credentialsCareer)!=='5x AA')throw Error('Bio must count all five verified AA seasons, not only four rating seasons');
if(careerCredentials(scoreCareer(CAREER_RECORDS['Steve Mocco']))!=='2x National Champ')throw Error('Mocco credential mismatch');
if(careerCredentials(undefined)!==undefined)throw Error('Pending research must not fabricate credentials');
console.log('Career credentials: full-career AA counts, championship priority and pending evidence verified');
const starocci=scoreCareer(CAREER_RECORDS['Carter Starocci']);
assert(careerCredentials(starocci)==='5x National Champ');
assert(starocci.counted.length===4 && starocci.excluded.length===1 && starocci.placementPoints===40);
const brooks=scoreCareer(CAREER_RECORDS['Aaron Brooks']);
assert(careerCredentials(brooks,'Aaron Brooks')==='4x National Champ · 5x AA');
assert(brooks.counted.length===4 && brooks.placementPoints===40);

assert(overallRating('Yojiro Uetake',scoreCareer(CAREER_RECORDS['Yojiro Uetake'],3),COLLEGE_RECORDS['Yojiro Uetake'])===98);

assert(careerCredentials(undefined,'John Smith')==='6x World/Olympic Champ');
assert(careerCredentials(undefined,'Jordan Burroughs')==='7x World/Olympic Champ · 3x World Bronze Medalist');
assert(careerCredentials(undefined,'Unknown athlete')===undefined);
