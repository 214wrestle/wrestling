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
