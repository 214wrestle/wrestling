import type { School, Wrestler } from './types';

/**
 * Teams and wrestlers.
 *
 * Deliberately fictional so the project carries no licensing baggage — swap in
 * real programmes by editing this file alone.
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

export const ROSTER: Wrestler[] = [
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

export const byId = (id: string): Wrestler => {
  const found = ROSTER.find((w) => w.id === id);
  if (!found) throw new Error(`Unknown wrestler: ${id}`);
  return found;
};

export const DEFAULT_MATCHUP: [string, string] = ['reyes', 'vandyke'];

export interface MeetContext {
  event: string;
  round: string;
  venue: string;
  attendance: number;
}

export const MEET: MeetContext = {
  event: 'Mid-Continent Conference Championships',
  round: 'Semifinal — 157 lbs',
  venue: 'Hollis Fieldhouse',
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
  hometown: '',
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
