import type { Wrestler } from './types';

export interface AppearanceShape {
  torso: number; limbs: number; neck: number; shoulders: number;
  faceWidth: number; faceLength: number; jaw: number; nose: number;
}
export interface WrestlingStyle {
  stanceWidth: number; levelOffset: number; tempo: number; handActivity: number;
  pressure: number; circle: number; attackRate: number;
  topPatience?: number; turnPreference?: number;
  preferredTurn?: 'cradle';
  highCrotchHand?: 'left' | 'right';
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
  'Ben Askren': {
    era: 'Missouri collegiate, 2004–2007',
    summary: 'Funky Ben: unorthodox scrambling and transitions into pinning positions.',
    appearanceStatus: 'Curly afro silhouette implemented; facial likeness and individual scramble animations remain in progress.',
    shape: {torso: 1, limbs: 1, neck: 1, shoulders: 1, faceWidth: 1, faceLength: 1, jaw: 1, nose: 0},
    motion: {...DEFAULT_MOTION},
    look: {height: 1.78, build: 0.45, skinTone: '#dfb598', hairColor: '#65482e', hairStyle: 'afro', eyeColor: '#705b45', gear: '#171717'},
    sources: [
      {label: 'Missouri: Askren discusses collegiate funk and curly hair', url: 'https://mutigers.com/news/2008/06/18/olympic-wrestler-missouris-ben-askren-meets-the-press', kind: 'bio'},
      {label: 'Missouri: Funky nickname and collegiate pinning record', url: 'https://mutigers.com/news/2013/07/29/former-tigers-askren-chandler-set-to-defend-bellator-world-titles', kind: 'bio'},
    ],
  },
  'Michael Moreno': {
    era: 'Iowa State collegiate, 2013–2015',
    summary: 'Patient top control with a cradle option; documented NCAA cradle and spladle pins in 2013, and a ride-to-pin against Isaac Jordan in 2015.',
    appearanceStatus: 'Likeness reconstruction in progress. Official photos guide art estimates; top-control tendencies interpret documented bouts, not measured film frequencies.',
    shape: {torso: 0.97, limbs: 0.97, neck: 1.02, shoulders: 1.01, faceWidth: 0.98, faceLength: 0.98, jaw: 0.98, nose: 0.001},
    motion: {...DEFAULT_MOTION, topPatience: 1.2, turnPreference: 1.15, preferredTurn: 'cradle'},
    look: {height: 1.77, build: 0.42, skinTone: '#d6ac90', hairColor: '#241d19', hairStyle: 'crop', eyeColor: '#43362d', gear: '#f0eee7'},
    sources: [
      {label: 'Iowa State portrait and collegiate action photos', url: 'https://cyclones.com/sports/wrestling/roster/michael-moreno/1333', kind: 'photo'},
      {label: '2013 NCAA report: cradle over Baumbach and spladle over Martin',url:'https://cyclones.com/news/2013/3/22/206873161',kind:'bio'},
      {label: '2015 Wisconsin bout: ride and turn to pin',url:'https://cyclones.com/news/2015/2/22/209902298',kind:'bio'},
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

/** Provisional style interpretation; the contest still requires control and stamina. */
export const isScrambleSpecialist = (name: string): boolean => [
  "Yianni Diakomihalis", "Jesse Delgado", "Ben Askren",
].includes(name);

/** Owner-selected heavyweight activity. Provisional tendencies, not measured film rates.
 * This changes initiation, never scoring or defensive ability. */
const ACTIVE_HEAVYWEIGHTS = new Set([
  'Kyle Snyder', 'Nick Gwiazdowski', 'Mason Parris', 'Steve Mocco',
  'Michael Mocco', 'Cole Konrad', 'Tommy Rowlands', 'Dreshaun Ross',
]);
export function heavyweightActivity(w: Pick<Wrestler, 'firstName' | 'lastName' | 'weightClass'>): {attack: number; pressure: number} {
  if (w.weightClass !== 285) return {attack: 1, pressure: 1};
  return ACTIVE_HEAVYWEIGHTS.has(`${w.firstName} ${w.lastName}`)
    ? {attack: 1.25, pressure: 1.08}
    : {attack: 0.65, pressure: 0.9};
}

/** Owner-confirmed specialty; percentages are provisional attack selection weights. */
export const ATHLETE_MOTION_OVERRIDES: Record<string, WrestlingStyle> = {
  'Teyon Ware': {...DEFAULT_MOTION, tempo:0.9,pressure:0.85,circle:1.1,attackRate:0.6},
  'Royce Alger': {...DEFAULT_MOTION, tempo:1.25,handActivity:1.45,pressure:1.3,circle:0.85,attackRate:1.2},
  'Brent Metcalf': {...DEFAULT_MOTION, highCrotchHand: 'left',
    shots: {double: 0.2, single: 0.15, highCrotch: 0.65}},
};

/** Owner-selected pace; numbers remain provisional until film calibration. */
export const HIGH_PACE_NAMES = [
 'Bo Bassett', 'David Taylor', 'Jason Nolf', 'Mitchell Mesenbrink',
 'Tom Brands', 'Terry Brands', 'Mark Ironside', 'Doug Schwab',
] as const;
export function applyOwnerPace(name: string, base: WrestlingStyle = DEFAULT_MOTION): WrestlingStyle {
 if (!(HIGH_PACE_NAMES as readonly string[]).includes(name)) return base;
 const bassett = name === 'Bo Bassett';
 return {...base, tempo: Math.max(base.tempo, bassett ? 1.3 : 1.2),
   handActivity: Math.max(base.handActivity, bassett ? 1.3 : 1.2),
   attackRate: Math.max(base.attackRate, bassett ? 1.25 : 1.15),
   pressure: Math.max(base.pressure, 1.1)};
}

/** Owner-selected signature technique; exact athletes, not all heavyweights. */
export function isFootSweepSpecialist(w: Wrestler): boolean {
  return ['Steve Mocco', 'Michael Mocco'].includes(`${w.firstName} ${w.lastName}`);
}

/** Owner-described earlier Iowa cohort (through roughly 2002), plus explicit Metcalf exception. Exact identities, not a school-wide inheritance rule. */
export const GABLE_PRESSURE_NAMES = new Set(['Brent Metcalf','T.J. Williams','Royce Alger','Tom Brands','Terry Brands','Mark Ironside','Eric Juergens','Lincoln McIlravy','Joe Williams','Jim Zalesky','Barry Davis','Randy Lewis','Ed Banach','Lou Banach','Duane Goldman','Chris Campbell','Mark Reiland','Terry Steiner','Troy Steiner','Jeff McGinness','Kevin Dresser','Jim Heffernan','Brad Penrith','Jessie Whitmer','Lee Fullhart']);
export const IOWA_LATE_ATTACK_NAMES = new Set(['Royce Alger','Tom Brands','Terry Brands','Mark Ironside','Eric Juergens']);
export function lateAttackUrgency(name:string, context?:{timeLeft:number;finalPeriod:boolean;deficit:number}):number {
 if(!IOWA_LATE_ATTACK_NAMES.has(name)||!context?.finalPeriod||context.deficit<=0||context.timeLeft>60)return 1;
 return 1.25+0.25*(1-Math.max(0,context.timeLeft)/60);
}
export function applyGablePressure(w:Wrestler):void {
 const name=`${w.firstName} ${w.lastName}`;
 if(w.school.id!=='iowa'||!GABLE_PRESSURE_NAMES.has(name))return;
 const m=w.motion??DEFAULT_MOTION;
 w.motion={...m,tempo:Math.max(m.tempo,1.1),handActivity:Math.max(m.handActivity,1.35),pressure:Math.max(m.pressure,1.2),circle:Math.min(m.circle,.9),attackRate:Math.min(m.attackRate,0.95)};
 w.attributes.conditioning=Math.max(w.attributes.conditioning,IOWA_LATE_ATTACK_NAMES.has(name)?.97:.93);
 const pressureStyle='Heavy head ties, persistent hand fighting and sustained pace';
 if(!w.style?.includes(pressureStyle)) w.style=w.style ? `${w.style}; ${pressureStyle}` : pressureStyle;
}
