import { COLLEGE_RECORDS, overallRating, scoreCareer, type NcaaSeason } from './ratings';

/** Owner requested resolution using existing evidence on 2026-10-06.
 * These assumptions are not verified NCAA season ledgers. Never insert fictional
 * zero seasons into CAREER_RECORDS just to satisfy a completeness check. */
export interface ProvisionalResolution {
  rating: number;
  basis: 'college-estimate' | 'developmental' | 'pre-ncaa';
  note: string;
  evidence: string;
}
const estimate = (name: string, finishes: NcaaSeason['place'][], denominator: 2 | 3 | 4) =>
  overallRating(name, scoreCareer(finishes.map((place,i)=>({year:2000+i,place,source:'calculation-only'})),denominator), COLLEGE_RECORDS[name]);
// Synthetic years above are calculation indices only: no synthetic career is exposed or saved.
export const PROVISIONAL_RATINGS: Record<string, ProvisionalResolution> = {
  'Tony Purler': {rating:estimate('Tony Purler',['qualifier',3,1],3),basis:'college-estimate',note:'Provisional college rating: based on three documented NCAA seasons; suspended 1992 season excluded.',evidence:'docs/rosters/rating-research-tony-purler-pending.md'},
  'Joe Colon': {rating:estimate('Joe Colon',['qualifier',3],2),basis:'college-estimate',note:'Provisional college rating: two UNI varsity seasons; missed 2013 season excluded. Junior-college title is a bio credential only.',evidence:'docs/rosters/rating-research-joe-colon-pending.md'},
  'Jacob Holschlag': {rating:estimate('Jacob Holschlag',['qualifier',5],2),basis:'college-estimate',note:'Provisional college rating: two completed NCAA seasons; lost injury seasons and canceled 2020 tournament excluded.',evidence:'docs/rosters/rating-research-jacob-holschlag-pending.md'},
  'Mason Lenhard': {rating:estimate('Mason Lenhard',['qualifier','qualifier','qualifier'],3),basis:'college-estimate',note:'Provisional college rating: three documented NCAA seasons; injury hiatus excluded.',evidence:'docs/rosters/rating-research-purler-lenhard-pending.md'},
  'Shawn Rustad': {rating:estimate('Shawn Rustad',['qualifier'],4),basis:'college-estimate',note:'Provisional college rating: one documented NCAA qualification, conservatively spread across four assumed seasons.',evidence:'docs/rosters/shawn-rustad-research-pending.md'},
  'Neil Fink': {rating:estimate('Neil Fink',['qualifier'],3),basis:'college-estimate',note:'Provisional college rating: one documented NCAA qualification, using an assumed three-season era allowance.',evidence:'docs/rosters/rating-research-neil-fink-pending.md'},
  'Sam Gerson': {rating:75,basis:'pre-ncaa',note:'Pre-NCAA era estimate: retained gameplay baseline; EIWA and Olympic credentials do not create NCAA points.',evidence:'src/sim/credentials.ts'},
  ...Object.fromEntries(Object.entries({
    'Michael Mocco': 75,
    'Dreshaun Ross': 84,
    'Ashton Honnold': 65,
    'Israel "Izzy" Moreno': 53,
    'Bo Bassett': 84,
    'Coby Merrill': 78,
  }).map(([name,rating])=>[name,{rating,basis:'developmental' as const,note:'Owner-assigned developmental rating (October 7, 2026); not an NCAA career rating.',evidence:'docs/rosters/developmental-ratings-owner-2026-10-07.md'}])),
};
