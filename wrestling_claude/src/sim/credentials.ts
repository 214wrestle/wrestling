import type { CareerScore } from './ratings';

/** Bio honors count the entire verified career, including an extra season
 * excluded from the four-season gameplay rating. Cancelled events add none. */
export function careerCredentials(career?:CareerScore,name?:string):string|undefined {
  if(!career)return;
  const seasons=[...career.counted,...career.excluded];
  const champs=seasons.filter(s=>s.place===1).length;
  // Penn State verifies five AA honors for Brooks, including the cancelled
  // 2020 season. This bio-only honor never becomes an NCAA placement or points.
  // https://gopsusports.com/news/2024/04/3/penn-state-wrestling-season-in-review
  if(champs)return `${champs}x National Champ${name==='Aaron Brooks'?' · 5x AA':''}`;
  const aa=seasons.filter(s=>typeof s.place==='number' && s.place>=1 && s.place<=8).length;
  if(aa)return `${aa}x AA`;
  const qualifiers=seasons.filter(s=>s.place==='qualifier').length;
  if(qualifiers)return `${qualifiers}x NCAA Qualifier`;
}
