import type { CareerScore } from './ratings';

/** Bio honors count the entire verified career, including an extra season
 * excluded from the four-season gameplay rating. Cancelled events add none. */
export function careerCredentials(career?:CareerScore):string|undefined {
  if(!career)return;
  const seasons=[...career.counted,...career.excluded];
  const champs=seasons.filter(s=>s.place===1).length;
  if(champs)return `${champs}x National Champ`;
  const aa=seasons.filter(s=>typeof s.place==='number' && s.place>=1 && s.place<=8).length;
  if(aa)return `${aa}x AA`;
  const qualifiers=seasons.filter(s=>s.place==='qualifier').length;
  if(qualifiers)return `${qualifiers}x NCAA Qualifier`;
}
