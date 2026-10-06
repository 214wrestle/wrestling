import type { Wrestler } from './types';

export interface HistoricalMeeting {
  winner: string;
  loser: string;
  year: number;
  round: string;
  weight: number;
  result: string;
  source: string;
}
/** Verified historical bouts; game roster weights do not rewrite history. */
export const NCAA_MEETINGS: readonly HistoricalMeeting[] = [
  {winner:"J'den Cox",loser:"Nick Heflin",year:2014,round:"final",weight:197,result:"2–1",source:"https://ohiostatebuckeyes.com/news/2014/3/25/ohio-state-athletics-good-stuff-28"},
  {winner:"Vito Arujau",loser:"Roman Bravo-Young",year:2023,round:"final",weight:133,result:"10–4",source:"https://gopsusports.com/news/2023/03/19/starocci-and-brooks-win-individual-titles-for-national-champion-wrestling-team"},
  {winner:"Eric Juergens",loser:"Johnny Thompson",year:2001,round:"final",weight:133,result:"10–7",source:"https://hawkeyesports.com/news/2019/08/05/wrestling-hall-of-fame-spotlight-eric-juergens"},
  {winner:'Jake Varner',loser:'Craig Brester',year:2010,round:'final',weight:197,result:'5–2',source:'https://cyclones.com/news/2010/3/21/204912702'},
  {winner:'Kyven Gadson',loser:'Kyle Snyder',year:2015,round:'final',weight:197,result:'by fall at 4:24',source:'https://i.turner.ncaa.com/sites/default/files/images/2015/03/22/finalbrackets.pdf'},
  { winner: 'Larry Owings', loser: 'Dan Gable', year: 1970, round: 'final', weight: 142, result: '13–11', source: 'https://nwhof.org/brackets/40#page=11' },
  { winner: 'Kyle Dake', loser: 'David Taylor', year: 2013, round: 'final', weight: 165, result: '5–4', source: 'https://s3.us-east-2.amazonaws.com/sidearm.nextgen.sites/nwca.sidearmsports.com/documents/2023/11/14/NCAA_Championship_2013.pdf#page=17' },
];

export function ncaaMatchupNotes(a: Wrestler, b: Wrestler): HistoricalMeeting[] {
  const names = new Set([`${a.firstName} ${a.lastName}`, `${b.firstName} ${b.lastName}`]);
  if (names.size !== 2) return [];
  return NCAA_MEETINGS.filter(m => names.has(m.winner) && names.has(m.loser));
}

export function historicalMeetingText(m: HistoricalMeeting): string {
  return `These two met in the ${m.year} NCAA tournament ${m.round} at ${m.weight} lbs. ${m.winner} defeated ${m.loser}, ${m.result}.`;
}

export function morenoFamilyNote(w: Wrestler): string | undefined {
  if (w.school.id === 'northern-iowa' && w.firstName === 'Israel' && w.lastName === '"Izzy" Moreno') {
    return 'Moreno family connection: UNI’s Israel “Izzy” Moreno is Michael and Gabe Moreno’s cousin and Mike Moreno Sr.’s nephew. His parents are Rick and Rebekah.';
  }
  if (w.school.id === 'iowa-state' && ['Mike Moreno Sr.', 'Michael Moreno', 'Gabe Moreno'].includes(`${w.firstName} ${w.lastName}`)) {
    return 'Moreno family connection: Michael and Gabe Moreno’s cousin Israel “Izzy” Moreno wrestles for UNI. Izzy is Mike Moreno Sr.’s nephew and the son of Rick and Rebekah.';
  }
}

export function morenoMatchupNote(a: Wrestler, b: Wrestler): string | undefined {
  const schools = new Set([a.school.id, b.school.id]);
  if (schools.has('iowa-state') && schools.has('northern-iowa') && (morenoFamilyNote(a) || morenoFamilyNote(b))) {
    return 'Moreno family ties cross the Iowa State–UNI rivalry: Iowa State and UNI meet on the mat, with cousins Izzy, Michael and Gabe connected beyond their singlets. Izzy is Mike Moreno Sr.’s nephew.';
  }
}

/** Owner-confirmed Smith–Perry family relationship; exact athletes, not surname matching. */
export function smithPerryFamilyNote(w: Wrestler): string | undefined {
  const name = `${w.firstName} ${w.lastName}`;
  if (name === 'Mark Perry' && w.school.id === 'iowa') {
    return 'Family across the rivalry: Iowa’s Mark Perry is the nephew of Oklahoma State brothers John and Pat Smith.';
  }
  if (w.school.id === 'oklahoma-state' && (name === 'John Smith' || name === 'Pat Smith')) {
    return 'Smith–Perry family connection: John and Pat Smith are brothers, and both are uncles of Iowa’s Mark Perry.';
  }
}
export function wrestlerFamilyNote(w: Wrestler): string | undefined {
  return smithPerryFamilyNote(w) ?? morenoFamilyNote(w);
}
