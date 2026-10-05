import type { Wrestler } from './types';

export interface AppearanceShape {
  torso: number; limbs: number; neck: number; shoulders: number;
  faceWidth: number; faceLength: number; jaw: number; nose: number;
}
export interface WrestlingStyle {
  stanceWidth: number; levelOffset: number; tempo: number; handActivity: number;
  pressure: number; circle: number; attackRate: number;
  shots: { double: number; single: number; highCrotch: number };
}
export interface AthleteProfile {
  era: string;
  summary: string;
  appearanceStatus: string;
  shape: AppearanceShape;
  motion: WrestlingStyle;
  look: { height: number; build: number; skinTone: string; hairColor: string; hairStyle: Wrestler['hairStyle']; eyeColor: string; gear: string };
  sources: { label: string; url: string; kind: 'photo' | 'film' | 'bio' }[];
}

export const DEFAULT_MOTION: WrestlingStyle = {
  stanceWidth: 1, levelOffset: 0, tempo: 1, handActivity: 1,
  pressure: 1, circle: 1, attackRate: 1, shots: {double: 0.45, single: 0.35, highCrotch: 0.2},
};
const brandsShape: AppearanceShape = {torso: 1.01, limbs: 1.04, neck: 1.08, shoulders: 1.03, faceWidth: 1.01, faceLength: 0.97, jaw: 1.08, nose: 0};
const brandsMotion: WrestlingStyle = {...DEFAULT_MOTION, stanceWidth: 1.05, levelOffset: -0.035, tempo: 1.08, handActivity: 1.15, pressure: 1.15, circle: 0.85, attackRate: 1.1, shots: {double: 0.55, single: 0.15, highCrotch: 0.3}};
/** Geometry numbers are visual estimates, not verified anthropometric measurements.
 * Motion numbers are an interpretation of era references, not measured technique frequencies. */
export const ATHLETE_PROFILES: Record<string, AthleteProfile> = {
  'Michael Moreno': {
    era: 'Iowa State collegiate, 2013–2015',
    summary: '165-pound Cyclone; technique tendencies pending match-film review.',
    appearanceStatus: 'First likeness sample: official portrait and NCAA action photo reviewed. Geometry, height and colours are art estimates; movement uses the baseline until film is reviewed.',
    shape: {torso: 0.97, limbs: 0.97, neck: 1.02, shoulders: 1.01, faceWidth: 0.98, faceLength: 1.01, jaw: 0.96, nose: 0.002},
    motion: {...DEFAULT_MOTION},
    look: {height: 1.77, build: 0.42, skinTone: '#d6ac90', hairColor: '#241d19', hairStyle: 'crop', eyeColor: '#43362d', gear: '#f0eee7'},
    sources: [
      {label: 'Iowa State portrait and collegiate action photos', url: 'https://cyclones.com/sports/wrestling/roster/michael-moreno/1333', kind: 'photo'},
      {label: 'National Wrestling Hall of Fame collegiate records', url: 'https://nwhof.org/national-wrestling-hall-of-fame/champions-database?tab=ncaa&wrestler=16086', kind: 'bio'},
    ],
  },
  'David Taylor': {
    era: 'Penn State collegiate, 2011–2014',
    summary: 'Mobile leg attacks, angle changes and transitions into top control.',
    appearanceStatus: 'Photo-guided approximation; face and proportions still need refinement.',
    shape: {torso: 0.94, limbs: 0.91, neck: 0.91, shoulders: 0.96, faceWidth: 0.92, faceLength: 1.04, jaw: 0.94, nose: 0.003},
    motion: {...DEFAULT_MOTION, stanceWidth: 0.95, levelOffset: 0.025, tempo: 1.06, handActivity: 0.85, circle: 1.18, shots: {double: 0.25, single: 0.5, highCrotch: 0.25}},
    look: {height: 1.83, build: 0.25, skinTone: '#e5bd9e', hairColor: '#725437', hairStyle: 'curls', eyeColor: '#718999', gear: '#e9e6df'},
    sources: [
      {label: 'NCAA collegiate action photo', url: 'https://www.ncaa.com/news/wrestling/article/2014-01-29/penn-states-david-taylor-continues-lead-most-dominant-standings', kind: 'photo'},
      {label: '2012 NCAA final — Taylor vs Hatchett', url: 'https://www.youtube.com/watch?v=sEtFfFnG6EI', kind: 'film'},
      {label: '2013 NCAA final — Dake vs Taylor', url: 'https://www.youtube.com/watch?v=gmGeSpmYwuI', kind: 'film'},
      {label: 'Penn State collegiate biography', url: 'https://gopsusports.com/sports/wrestling/roster/season/2009-10/player/david-taylor', kind: 'bio'},
    ],
  },
  'Tom Brands': {
    era: 'Iowa collegiate, 1989–1992', summary: 'Forward pressure, committed leg attacks and persistent hand fighting.',
    appearanceStatus: 'Era-guided approximation; face and height are art estimates.',
    shape: {...brandsShape, jaw: 1.09}, motion: brandsMotion,
    look: {height: 1.66, build: 0.48, skinTone: '#e4b99a', hairColor: '#806041', hairStyle: 'crop', eyeColor: '#728b94', gear: '#151515'},
    sources: [
      {label: 'Hall of Fame — collegiate Brands brothers', url: 'https://nwhof.org/news/sports-illustrated-vault-tom-and-terry-brands', kind: 'bio'},
      {label: 'Iowa biography', url: 'https://hawkeyesports.com/sports/wrestling/roster/season/2024-25/staff/tom-brands', kind: 'bio'},
    ],
  },
  'Terry Brands': {
    era: 'Iowa collegiate, 1989–1992', summary: 'Compact stance, close pressure and repeated attacks from hand control.',
    appearanceStatus: 'Collegiate portrait-guided approximation; proportions are art estimates.',
    shape: {...brandsShape, faceWidth: 1.0, jaw: 1.06}, motion: {...brandsMotion, tempo: 1.1, shots: {double: 0.5, single: 0.2, highCrotch: 0.3}},
    look: {height: 1.65, build: 0.45, skinTone: '#e4b99a', hairColor: '#806041', hairStyle: 'crop', eyeColor: '#728b94', gear: '#151515'},
    sources: [
      {label: 'Iowa Hall of Fame — collegiate portrait', url: 'https://hof.hawkeyesports.com/inductees/terry-michael-brands/', kind: 'photo'},
      {label: 'Hall of Fame — Brands brothers', url: 'https://nwhof.org/news/sports-illustrated-vault-tom-and-terry-brands', kind: 'bio'},
    ],
  },
};
