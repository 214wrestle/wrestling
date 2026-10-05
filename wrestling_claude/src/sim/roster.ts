import { CAREER_RECORDS, ELIGIBILITY_SEASONS, COLLEGE_RECORDS, overallRating, scoreCareer } from './ratings';
import { ATHLETE_PROFILES } from './athleteProfiles';
import type { School, Wrestler } from './types';
import locked from './legends-roster.json';

/**
 * Teams and wrestlers.
 *
 * Locked Legends roster, plus the original fictional balance-check fixtures.
 */

export const SCHOOLS: Record<string, School> = {
  carver: {
    id: 'carver',
    name: 'Carver State',
    mark: 'Carver',
    nickname: 'Ironmen',
    primary: '#a3172c',
    secondary: '#f3e8cf',
    accent: '#ffcd4a',
    gear: '#18191f',
    pattern: 'panel',
    arena: 'Hollis Fieldhouse',
  },
  lakeridge: {
    id: 'lakeridge',
    name: 'Lakeridge',
    mark: 'Lakeridge',
    nickname: 'Blue Hawks',
    primary: '#163a72',
    secondary: '#e3ebf5',
    accent: '#5fa8ff',
    gear: '#0f1c33',
    pattern: 'sash',
    arena: 'Lakeridge Pavilion',
  },
  granite: {
    id: 'granite',
    name: 'Granite A&M',
    mark: 'Granite',
    nickname: 'Quarrymen',
    primary: '#2b2f37',
    secondary: '#c9ced6',
    accent: '#8ee3b0',
    gear: '#2b2f37',
    pattern: 'stripes',
    arena: 'Stonecutters Arena',
  },
  fortwhitman: {
    id: 'fortwhitman',
    name: 'Fort Whitman',
    mark: 'Whitman',
    nickname: 'Sentinels',
    primary: '#1f6b4a',
    secondary: '#f0ead6',
    accent: '#ffd166',
    gear: '#10291f',
    pattern: 'band',
    arena: 'The Garrison',
  },
};

export const PROTOTYPE_ROSTER: Wrestler[] = [
  {
    id: 'reyes',
    firstName: 'Mateo',
    lastName: 'Reyes',
    school: SCHOOLS.carver,
    year: 'JR',
    weightClass: 157,
    seed: 3,
    record: { wins: 21, losses: 2 },
    hometown: 'Bakersfield, CA',
    build: 0.45,
    height: 1.74,
    skinTone: '#9c6b4a',
    hairColor: '#17110d',
    hairStyle: 'crop',
    eyeColor: '#3b2416',
    lead: 1,
    style: 'Fast hands, attacks off the snap',
    attributes: { quickness: 0.84, strength: 0.6, conditioning: 0.78, mat: 0.62, defense: 0.7 },
  },
  {
    id: 'vandyke',
    firstName: 'Cole',
    lastName: 'Van Dyke',
    school: SCHOOLS.lakeridge,
    year: 'SR',
    weightClass: 157,
    seed: 1,
    record: { wins: 24, losses: 1 },
    hometown: 'Dowagiac, MI',
    build: 0.65,
    height: 1.78,
    skinTone: '#e3b796',
    hairColor: '#6b4a24',
    hairStyle: 'buzz',
    eyeColor: '#4d6a86',
    lead: -1,
    style: 'Heavy hips, rides you out',
    attributes: { quickness: 0.66, strength: 0.84, conditioning: 0.74, mat: 0.88, defense: 0.74 },
  },
  {
    id: 'okafor',
    firstName: 'Dez',
    lastName: 'Okafor',
    school: SCHOOLS.granite,
    year: 'SO',
    weightClass: 157,
    seed: 6,
    record: { wins: 17, losses: 5 },
    hometown: 'Camden, NJ',
    build: 0.55,
    height: 1.77,
    skinTone: '#5f3d2b',
    hairColor: '#141010',
    hairStyle: 'curls',
    eyeColor: '#2a1a12',
    lead: 1,
    style: 'Explosive shooter, scrambles everything',
    attributes: { quickness: 0.9, strength: 0.66, conditioning: 0.64, mat: 0.55, defense: 0.6 },
  },
  {
    id: 'lindgren',
    firstName: 'Anders',
    lastName: 'Lindgren',
    school: SCHOOLS.fortwhitman,
    year: 'FR',
    weightClass: 157,
    seed: 9,
    record: { wins: 14, losses: 6 },
    hometown: 'Hastings, MN',
    build: 0.5,
    height: 1.76,
    skinTone: '#efcdae',
    hairColor: '#c9a86a',
    hairStyle: 'crop',
    eyeColor: '#5d7f9c',
    lead: -1,
    style: 'Relentless pace, never stops moving',
    attributes: { quickness: 0.72, strength: 0.7, conditioning: 0.86, mat: 0.68, defense: 0.8 },
  },
];

/** Locked names and slots; appearance and equal ratings are prototype placeholders. */
export const LEGENDS_TEAMS = locked.teams;
export const LEGENDS_WEIGHTS = [118, 125, 133, 141, 149, 157, 165, 174, 184, 190, 197, 285];
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const palette = ['#163a72', '#a3172c', '#1f6b4a', '#2b2f37'];
export const ROSTER: Wrestler[] = LEGENDS_TEAMS.flatMap((team, i) => {
  const school: School = {
    id: team.id, name: team.team, mark: team.team, nickname: 'Legends',
    coach: team.staff.join(' · '), rosterNotes: team.notesAndChoices,
    primary: palette[i % palette.length], secondary: '#f3e8cf', accent: '#ffcd4a',
    gear: '#18191f', pattern: 'panel', arena: 'Legends Arena',
  };
  SCHOOLS[school.id] = school;
  const create = (entry: {name: string; weight: string; source: string}, role: 'starter' | 'choice'): Wrestler => {
    const weight = entry.weight === 'HWT' ? 285 : Number(entry.weight);
    const split = entry.name.indexOf(' ');
    return {
      id: `${team.id}-${weight}-${role}-${slug(entry.name)}`,
      firstName: entry.name.slice(0, split), lastName: entry.name.slice(split + 1), school,
      year: 'GR', weightClass: weight, record: {wins: 0, losses: 0}, hometown: ['Trent Paulson', 'Travis Paulson'].includes(entry.name) ? 'Council Bluffs, Iowa · Lewis Central' : '',
      build: Math.max(0.25, Math.min(0.85, (weight - 100) / 220)),
      height: 1.74, skinTone: '#c89a79', hairColor: '#36261e', hairStyle: 'crop',
      eyeColor: '#3b2416', lead: 1,
      style: role === 'starter' ? 'Locked Legends starter' : "Coach’s Choice",
      attributes: {quickness: 0.75, strength: 0.75, conditioning: 0.75, mat: 0.75, defense: 0.75},
      legends: {role, source: entry.source,
        bioNote: entry.name === 'Quentin Wright' ? 'Career accomplishments at 184 and 197; locked Legends slot: 190.' : ['Trent Paulson', 'Travis Paulson'].includes(entry.name) ? 'Twin connection: Trent and Travis Paulson — identical twin brothers from Council Bluffs Lewis Central High School.' : undefined},
    };
  };
  return [...team.starters.map(e => create(e, 'starter')), ...team.choices.map(e => create(e, 'choice'))];
});

for (const w of ROSTER) {
  const career = CAREER_RECORDS[`${w.firstName} ${w.lastName}`];
  if (career) {
    w.ncaaCareer = scoreCareer(career, ELIGIBILITY_SEASONS[`${w.firstName} ${w.lastName}`] ?? 4);
    w.rating = overallRating(`${w.firstName} ${w.lastName}`, w.ncaaCareer, COLLEGE_RECORDS[`${w.firstName} ${w.lastName}`]);
    const value = w.rating / 100;
    w.attributes = {quickness: value, strength: value, conditioning: value, mat: value, defense: value};
  }
  if (w.school.id === 'iowa-state' && w.firstName === 'Dan' && w.lastName === 'Gable') {
    w.rating = 99;
    w.attributes = {quickness: 0.99, strength: 0.99, conditioning: 0.99, mat: 0.99, defense: 0.99};
  }
  const profile = ATHLETE_PROFILES[`${w.firstName} ${w.lastName}`];
  if (!profile) continue;
  Object.assign(w, profile.look);
  w.profile = profile; w.motion = profile.motion; w.appearance = profile.shape;
  w.headgearColor = profile.look.gear; w.style = profile.summary;
}
// Era uniform colours for researched teams; no logos or remote textures.
Object.assign(SCHOOLS['penn-state'], {primary: '#001e44', secondary: '#ffffff', accent: '#ffffff', gear: '#e9e6df', pattern: 'band'});
Object.assign(SCHOOLS.iowa, {primary: '#171717', secondary: '#ffcd00', accent: '#ffcd00', gear: '#171717', pattern: 'band'});

Object.assign(SCHOOLS['iowa-state'], {primary: '#9e1736', secondary: '#f5c635', accent: '#f5c635', gear: '#f0eee7', pattern: 'band'});

export const byId = (id: string): Wrestler => {
  const found = ROSTER.find((w) => w.id === id);
  if (!found) throw new Error(`Unknown wrestler: ${id}`);
  return found;
};

export const DEFAULT_MATCHUP: [string, string] = ['penn-state-157-starter-david-taylor', 'iowa-157-starter-jim-zalesky'];

export interface MeetContext {
  event: string;
  round: string;
  venue: string;
  attendance: number;
}

export const MEET: MeetContext = {
  event: 'College Wrestling Legends',
  round: 'Exhibition',
  venue: 'Legends Arena',
  attendance: 7412,
};

/** The official, built from the same body as the wrestlers. */
export const OFFICIAL: Wrestler = {
  id: 'official',
  firstName: 'Ray',
  lastName: 'Official',
  school: {
    id: 'official',
    name: 'Official',
    mark: '',
    nickname: 'Referee',
    primary: '#e9ecf2',
    secondary: '#1b1d23',
    accent: '#c0392b',
    gear: '#000',
    pattern: 'panel',
    arena: '',
  },
  year: 'GR',
  weightClass: 0,
  record: { wins: 0, losses: 0 },
  hometown: ' ',
  build: 0.3,
  height: 1.8,
  skinTone: '#d9a97f',
  hairColor: '#5a5048',
  hairStyle: 'crop',
  eyeColor: '#3b2a1e',
  lead: 1,
  style: '',
  attributes: { quickness: 0.5, strength: 0.5, conditioning: 0.5, mat: 0.5, defense: 0.5 },
};
