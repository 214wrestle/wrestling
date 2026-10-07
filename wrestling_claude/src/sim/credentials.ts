import {seniorCredentials} from './seniorCredentials';
import type { CareerScore } from './ratings';

/** Bio honors count the entire verified career, including an extra season
 * excluded from the four-season gameplay rating. Cancelled events add none. */
function ncaaCredentials(career?:CareerScore,name?:string):string|undefined {
  // Official Lehigh/UNI bios verify these honors; full season denominators pending.
  if(name === 'Mike Land')return '1x National Champ · 4x AA';
  if(name === 'Bobby Weaver' || name === 'Jacob Holschlag')return '1x AA';
  // NWCA 2001 bracket: fifth; early-season eligibility still under research.
  if(name === 'Mike Fickell')return '1x AA';
  // Virginia Tech NCAA history verifies 1967; full varsity tenure remains pending.
  if(name === 'Neil Fink')return '1x NCAA Qualifier';
  // UNI bio: NCAA third in 2014 and NJCAA champion in 2010; season denominator pending.
  if(name === 'Joe Colon')return '1x NCAA AA · 1x Junior College National Champ';
  // Penn EIWA history: these careers predate the first NCAA tournament (1928).
  if(name === 'Mike Dorizas')return '3x EIWA Champ · Pre-NCAA era';
  if(name === 'Sam Gerson')return '1x EIWA Champ · Pre-NCAA era';
  if(!career)return;
  const seasons=[...career.counted,...career.excluded];
  const champs=seasons.filter(s=>s.place===1).length;
  // Clarion verifies two Division I and two College Division titles (1972–73).
  // Bio honors only: duplicate tournaments never add rating seasons.
  // NWHOF bio 4745: two SUNY Delhi honors and one NCAA honor at Missouri.
  // NC State's 2020 NWCA honors: bio only, no NCAA placement points.
  // https://gopack.com/news/2020/4/20/wrestling-six-from-packwrestle-earn-all-america-accolades-from-nwca
  if(name === 'Daniel Bullard')return '2x AA (1x NCAA · 2020 NWCA Honorable Mention)';
  if(name === 'Tariq Wilson')return '4x AA (3x NCAA · 2020 NWCA Honorable Mention)';
  // UNI verifies 2020 NWCA recognition; cancelled tournament adds no points.
  if(name === 'Taylor Lujan')return '4x NCAA Qualifier · 2020 NWCA All-American';
  if(name === 'Noah Adams')return '3x NCAA Qualifier · 2020 NWCA First-Team All-American';
  // UNI Hall of Fame verifies one NCAA title and two NJCAA titles.
  if(name === 'Tony Davis')return '3x National Champ (1x NCAA · 2x Junior College)';
  // UNI season history and NWHOF: DII title retained in bio, DI result scores 1972.
  if(name === 'Mike McCready')return '1x College Division National Champ · 3x AA';
  // Three DII titles and three DI honors; only one tournament scores each season.
  if(name === 'Kirk Myers')return '3x DII National Champ · 6x AA';
  if(name === 'Mark Cody')return '3x AA (1x NCAA · 2x Junior College)';
  // Nebraska bio: cancelled 2020 honor is bio-only.
  if(name === 'Ridge Lovett')return '1x National Champ · 2020 NWCA Honorable Mention';
  if(name === 'Andrew Alirez')return '1x National Champ · 2020 NWCA Honorable Mention';
  if(name === 'Gray Simons')return '7x National Champ (3x NCAA · 4x NAIA)';
  if(name === 'Rick Sanders')return '5x National Champ (2x DI · 2x DII · 1x NAIA)';
  if(name === 'Carleton Haselrig')return '6x National Champ (3x DI · 3x DII)';
  if(name === 'Wade Schalles')return '4x National Champ (2x DI · 2x College Division)';
  // Penn State verifies five AA honors for Brooks, including the cancelled
  // 2020 season. This bio-only honor never becomes an NCAA placement or points.
  // https://gopsusports.com/news/2024/04/3/penn-state-wrestling-season-in-review
  // Minnesota verifies five Steveson AA honors, including bio-only 2020 NWCA honor.
  // https://gophersports.com/sports/wrestling/roster/gable-steveson/22871
  // Michigan verifies Parris's fourth honor through the 2020 NWCA recognition.
  // https://mgoblue.com/sports/wrestling/roster/mason-parris/23669
  // Gross: third AA is bio-only 2020 NWCA recognition, not a NCAA result.
  // https://uwbadgers.com/news/2020/4/17/wrestling-four-wisconsin-wrestlers-named-nwca-all-americans
  if(champs)return `${champs}x National Champ${['Parker Keckeisen','Greg Kerkvliet','Aaron Brooks','Gable Steveson','Shane Griffith',"Austin O'Connor"].includes(name ?? '')?' · 5x AA':name === 'Mason Parris'?' · 4x AA':name === 'Seth Gross'?' · 3x AA':''}`;
  const aa=seasons.filter(s=>typeof s.place==='number' && s.place>=1 && s.place<=8).length;
  // Verified bio-only 2020 NWCA first-team recognition adds no rating points.
  // https://ohiostatebuckeyes.com/news/2020/4/18/six-buckeyes-earn-nwca-all-america-recognition
  // McFadden: https://theacc.com/news/2020/4/17/athlete-awards-nwca-all-america-honorees-include-17-from-acc.aspx
  if(aa)return `${aa + (['Kollin Moore','Trent Hillger','Austin DeSanto','David McFadden','Hayden Hidlay','Trent Hidlay'].includes(name ?? '') ? 1 : 0)}x AA`;
  const qualifiers=seasons.filter(s=>s.place==='qualifier').length;
  // Norfleet's fourth qualification was for the canceled 2020 tournament: bio only.
  if(qualifiers)return `${qualifiers + (name === 'Kordell Norfleet' ? 1 : 0)}x NCAA Qualifier${['Cameron Caffey', 'Kordell Norfleet'].includes(name ?? '') ? ' · 2020 NWCA All-American' : ''}`;
}

export function careerCredentials(career?:CareerScore,name?:string):string|undefined {
 return [ncaaCredentials(career,name),seniorCredentials(name)].filter(Boolean).join(' · ')||undefined;
}
