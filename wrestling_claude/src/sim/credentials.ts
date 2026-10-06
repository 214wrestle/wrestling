import {seniorCredentials} from './seniorCredentials';
import type { CareerScore } from './ratings';

/** Bio honors count the entire verified career, including an extra season
 * excluded from the four-season gameplay rating. Cancelled events add none. */
function ncaaCredentials(career?:CareerScore,name?:string):string|undefined {
  if(!career)return;
  const seasons=[...career.counted,...career.excluded];
  const champs=seasons.filter(s=>s.place===1).length;
  // Penn State verifies five AA honors for Brooks, including the cancelled
  // 2020 season. This bio-only honor never becomes an NCAA placement or points.
  // https://gopsusports.com/news/2024/04/3/penn-state-wrestling-season-in-review
  // Minnesota verifies five Steveson AA honors, including bio-only 2020 NWCA honor.
  // https://gophersports.com/sports/wrestling/roster/gable-steveson/22871
  if(champs)return `${champs}x National Champ${['Aaron Brooks','Gable Steveson'].includes(name ?? '')?' · 5x AA':''}`;
  const aa=seasons.filter(s=>typeof s.place==='number' && s.place>=1 && s.place<=8).length;
  // Verified bio-only 2020 NWCA first-team recognition adds no rating points.
  // https://ohiostatebuckeyes.com/news/2020/4/18/six-buckeyes-earn-nwca-all-america-recognition
  if(aa)return `${aa + (name === 'Kollin Moore' ? 1 : 0)}x AA`;
  const qualifiers=seasons.filter(s=>s.place==='qualifier').length;
  if(qualifiers)return `${qualifiers}x NCAA Qualifier`;
}

export function careerCredentials(career?:CareerScore,name?:string):string|undefined {
 return [ncaaCredentials(career,name),seniorCredentials(name)].filter(Boolean).join(' · ')||undefined;
}
