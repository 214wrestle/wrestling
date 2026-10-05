import type { Wrestler } from './types';

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
