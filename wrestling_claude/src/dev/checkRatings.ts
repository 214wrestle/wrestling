import { scoreCareer, seasonPoints, type NcaaSeason, CAREER_RECORDS, overallRating, recordAdjustment, ELIGIBILITY_SEASONS, COLLEGE_RECORDS } from '../sim/ratings';
const assert = (ok: boolean) => { if (!ok) throw new Error('Rating scoring regression'); };
const result = (year: number, place: NcaaSeason['place'], outstandingWrestler = false): NcaaSeason => ({year, place, outstandingWrestler, source: 'test'});
assert([1,2,3,4,5,6,7,8].map(p=>seasonPoints(result(2000,p as NcaaSeason['place']))).join() === '10,9,7,6,5,4,3,2');
assert(seasonPoints(result(2000,'qualifier')) === 1);
assert(scoreCareer([1,2,3,4,5].map((_,i)=>result(2000+i,1))).total === 40);
assert(scoreCareer([1,2,3].map((_,i)=>result(1960+i,1)),3).averagePlacementPoints === 10);
assert(scoreCareer([1,2,3,4].map((_,i)=>result(2000+i,1))).averagePlacementPoints === 10);
const five = scoreCareer([result(2000,1),result(2001,1),result(2002,1),result(2003,2),result(2004,2,true)]);
assert(five.total === 40 && five.bonusPoints === 1 && five.excluded[0].year === 2003);
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
