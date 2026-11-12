import { PROVISIONAL_RATINGS } from './provisionalRatings';
import { applyGablePressure, stanceStyleFor } from './athleteProfiles';
import { applyResearchedStyle } from './athleteStyles';
import { ATTRIBUTE_GRADES, RESEARCHED_SUMMARY } from './attributeGrades';
import { STYLE_KEYS, abilityRatings, applyStyleGrades, matchAttributes, overallFromAbilities } from './attributeRatings';
import { CAREER_RECORDS, COLLEGE_RECORDS, overallRating, scoreKnownCareer } from './ratings';
import { DEFAULT_MOTION, HIGH_PACE_NAMES, applyOwnerPace, ATHLETE_MOTION_OVERRIDES, ATHLETE_PROFILES } from './athleteProfiles';
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
/** Owner-locked overalls that the categories do not move (only these two are 99; checkRoster). */
const LOCKED_OVERALL: Record<string, number> = { 'Dan Gable': 99, 'Cael Sanderson': 99 };

/**
 * Overall from attributes (owner, November 12: "Build from attributes"): the career rating seeds every category,
 * researched grades move the categories, the overall is their weighted average, and the five match attributes come
 * from the categories. Owner overrides applied after this (Alger, Ware, Bassett, Iowa pressure, top specialists)
 * still raise the match attributes on top.
 */
function applyAbilityRatings(w: Wrestler): void {
  if (w.rating === undefined) return;
  const name = `${w.firstName} ${w.lastName}`;
  const grades = ATTRIBUTE_GRADES[name] ?? {};
  w.careerRating = w.rating;
  if (Object.keys(grades).length) w.grades = { ...grades };
  w.abilities = abilityRatings(w.rating, grades);
  w.rating = LOCKED_OVERALL[name] ?? overallFromAbilities(w.abilities);
  w.attributes = { ...w.attributes, ...matchAttributes(w.abilities) };
  const style = Object.fromEntries(STYLE_KEYS.filter((k) => grades[k] !== undefined).map((k) => [k, grades[k]!]));
  if (Object.keys(style).length) w.styleGrades = style;
  if (RESEARCHED_SUMMARY[name] && w.legends && /^(Locked Legends starter|Coach’s Choice)$/.test(w.style)) w.style = RESEARCHED_SUMMARY[name];
}

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
        bioNote: entry.name === 'Stephen Neal' ? 'From the mat to the NFL: 3x Super Bowl Champion with the New England Patriots (XXXVI, XXXVIII and XXXIX).' : entry.name === 'Shane Griffith' ? 'Stanford · Keep Stanford Wrestling: His 2021 NCAA title in a plain black singlet helped rally support to save a program slated for elimination. Stanford reversed the decision in May 2021.' : entry.name === 'Evan Bernstein' ? '1988 Greco-Roman Olympian for Israel (Seoul, 90 kg).' : entry.name === 'Royce Alger' ? '2x National Champ · 3x AA. Historical NCAA titles at 167 and 177; locked Legends slot: 174. Source: National Wrestling Hall of Fame.' : entry.name === 'Dan Hodge' ? 'Apple-crushing grip: Dan Hodge could crush an apple with one bare hand. Three NCAA titles at historical 177; Legends slot: 174. Source: National Wrestling Hall of Fame.' : entry.name === 'Quentin Wright' ? 'Career accomplishments at 184 and 197; locked Legends slot: 190.' : ['Trent Paulson', 'Travis Paulson'].includes(entry.name) ? 'Twin connection: Trent and Travis Paulson — identical twin brothers from Council Bluffs Lewis Central High School.' : undefined},
    };
  };
  return [...team.starters.map(e => create(e, 'starter')), ...team.choices.map(e => create(e, 'choice'))];
});

for (const w of ROSTER) {
  const career = CAREER_RECORDS[`${w.firstName} ${w.lastName}`];
  if (career) {
    w.ncaaCareer = scoreKnownCareer(`${w.firstName} ${w.lastName}`, career);
    w.rating = overallRating(`${w.firstName} ${w.lastName}`, w.ncaaCareer, COLLEGE_RECORDS[`${w.firstName} ${w.lastName}`]);
    const value = w.rating / 100;
    w.attributes = {quickness: value, strength: value, conditioning: value, mat: value, defense: value};
  }
  const resolution = PROVISIONAL_RATINGS[`${w.firstName} ${w.lastName}`];
  if (!career && resolution) {
    w.rating = resolution.rating;
    const value = w.rating / 100;
    w.attributes = {quickness:value,strength:value,conditioning:value,mat:value,defense:value};
    if (w.legends) w.legends.bioNote = [w.legends.bioNote,resolution.note].filter(Boolean).join(' ');
  }
  if (w.school.id === 'iowa-state' && w.firstName === 'Dan' && w.lastName === 'Gable') {
    w.rating = 99;
    w.attributes = {quickness: 0.99, strength: 0.99, conditioning: 0.99, mat: 0.99, defense: 0.99};
  }
  applyAbilityRatings(w);
  const profile = ATHLETE_PROFILES[`${w.firstName} ${w.lastName}`];
  if (!profile) continue;
  Object.assign(w, profile.look);
  w.profile = profile; w.motion = profile.motion; w.appearance = profile.shape;
  w.headgearColor = profile.look.gear; w.style = profile.summary;
}
// School uniform colours and locally drawn marks; no remote textures.
Object.assign(SCHOOLS.cornell, {primary: '#b31b1b', secondary: '#ffffff', accent: '#ffffff', mark: 'C', pattern: 'panel'});
Object.assign(SCHOOLS['penn-state'], {primary: '#001e44', secondary: '#ffffff', accent: '#ffffff', gear: '#e9e6df', pattern: 'band'});
Object.assign(SCHOOLS.iowa, {primary: '#171717', secondary: '#ffcd00', accent: '#ffcd00', gear: '#171717', pattern: 'band'});

Object.assign(SCHOOLS['iowa-state'], {primary: '#9e1736', secondary: '#f5c635', accent: '#f5c635', gear: '#f0eee7', pattern: 'band'});

/**
 * Real team colours for every other school (owner, November 11: "Yes, fix them"; they were a rotating placeholder of
 * four, so Wisconsin and Lehigh came out green). From the singlet photo research (outputs/nov11-singlets) and each
 * school's official colours. primary paints the scoreboard, banners and plates; secondary is the text on it (so it
 * must read on primary); accent is drawn as text on the dark menus (so it must read on dark).
 */
export const TEAM_COLOURS: Record<string, { primary: string; secondary: string; accent: string }> = {
  nebraska: { primary: '#d00000', secondary: '#ffffff', accent: '#ff5a4f' },
  minnesota: { primary: '#7a0019', secondary: '#ffcc33', accent: '#ffcc33' },
  'oklahoma-state': { primary: '#fe5c00', secondary: '#151515', accent: '#fe5c00' },
  oklahoma: { primary: '#841617', secondary: '#fdf9d8', accent: '#fdf9d8' },
  'ohio-state': { primary: '#bb0000', secondary: '#ffffff', accent: '#a7b1b7' },
  michigan: { primary: '#00274c', secondary: '#ffcb05', accent: '#ffcb05' },
  'michigan-state': { primary: '#18453b', secondary: '#ffffff', accent: '#7bbd9f' },
  wisconsin: { primary: '#c5050c', secondary: '#ffffff', accent: '#ff5a5f' },
  'arizona-state': { primary: '#8c1d40', secondary: '#ffc627', accent: '#ffc627' },
  'oregon-state': { primary: '#dc4405', secondary: '#151515', accent: '#f26a2e' },
  illinois: { primary: '#13294b', secondary: '#e84a27', accent: '#e84a27' },
  indiana: { primary: '#990000', secondary: '#eeedeb', accent: '#eeedeb' },
  'north-carolina': { primary: '#7bafd4', secondary: '#13294b', accent: '#7bafd4' },
  'northern-iowa': { primary: '#4b116f', secondary: '#ffcc00', accent: '#ffcc00' },
  lehigh: { primary: '#4f3324', secondary: '#ffffff', accent: '#c9a77c' },
  'virginia-tech': { primary: '#630031', secondary: '#ffffff', accent: '#cf4420' },
  'west-virginia': { primary: '#002855', secondary: '#eaaa00', accent: '#eaaa00' },
  missouri: { primary: '#f1b82d', secondary: '#000000', accent: '#f1b82d' },
  'nc-state': { primary: '#cc0000', secondary: '#ffffff', accent: '#ff5a5a' },
  penn: { primary: '#011f5b', secondary: '#ffffff', accent: '#e8434b' },
};
for (const [id, c] of Object.entries(TEAM_COLOURS)) if (SCHOOLS[id]) Object.assign(SCHOOLS[id], c);

export const byId = (id: string): Wrestler => {
  const found = ROSTER.find((w) => w.id === id);
  if (!found) throw new Error(`Unknown wrestler: ${id}`);
  return found;
};

/** The match the title screen opens on (owner, November 12): Gable vs Owings, the 1970 NCAA final at 142 that ended
 *  Gable's 181-match winning streak. */
export const DEFAULT_MATCHUP: [string, string] = ['iowa-state-141-starter-dan-gable', 'college-wrestling-icons-141-starter-larry-owings'];

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

for (const w of ROSTER) {
  const motion = ATHLETE_MOTION_OVERRIDES[`${w.firstName} ${w.lastName}`];
  if (motion) {w.motion = motion; w.style = w.lastName === 'Alger' ? 'Relentless grinder — elite hand fighting, forward pressure and exceptional gas tank' : w.lastName === 'Ware' ? 'Patient defensive specialist — difficult to score on, selective explosive attacks; inactivity risks stalling' : 'Left-handed high-crotch specialist';}
  if (w.firstName === 'Teyon' && w.lastName === 'Ware') {w.attributes.defense = Math.max(w.attributes.defense,0.95); w.attributes.quickness = Math.max(w.attributes.quickness,0.94); w.attributes.shots = Math.max(w.attributes.shots ?? 0,0.94);}
  if (w.firstName === 'Royce' && w.lastName === 'Alger') w.attributes.conditioning = 0.98;
}

for (const w of ROSTER) {
 const name = `${w.firstName} ${w.lastName}`;
 if ((HIGH_PACE_NAMES as readonly string[]).includes(name)) w.motion = applyOwnerPace(name, w.motion);
 if (name === 'Bo Bassett') {
   w.style = 'Machine Gun Mindset — non-stop motor, heart, pace, technician';
   // Owner profile, November 2: conditioning sustains the motor; mat skill
   // supports technique. Heart is a descriptive trait, not a fabricated stat.
   w.attributes.conditioning = .98;
   w.attributes.mat = .95;
 }
}

for (const w of ROSTER) applyGablePressure(w);

/** Owner-selected nicknames preserve canonical names used by ratings and roster locks. */
const athleteNicknames: Record<string,string> = {'Randy Lewis':'LewBoo','Kyle Dake':'Kid Dynamite','David Taylor':'The Magic Man','Steve Mocco':'The Bear','Nick Simmons':'The East Lansing Strangler'};
for (const w of ROSTER) {
 const name = `${w.firstName} ${w.lastName}`;
 if (w.legends && athleteNicknames[name]) w.legends.nickname = athleteNicknames[name];
 if (name === 'Matt Feast' && w.legends) w.legends.bioNote = 'College record: 118–xx (losses unknown).';
 if (name === 'Rob Rohn') {
  w.style = 'Cement mixer specialist — counterattack pinning threat';
  if (w.legends) w.legends.bioNote = 'Never count him out: trailing Oklahoma’s Josh Lambrecht 14–2 late in the third period of the 2002 NCAA 184-pound final, Rohn hit a cement mixer for the championship-winning pin. Four consecutive falls in 13:28 earned him the tournament’s Gorriaran Award.';
 }
 if (name === 'Aden Valencia' && w.legends) w.legends.bioNote = 'Stanford · 2026 NCAA champion at 149 pounds; first Stanford freshman to win an NCAA title.';
 if (name === 'Jax Forrest') w.style = 'High-pace point scorer and elite scrambler — repeated attacks and creative counters in contested positions';
 if (name === 'Sergio Vega') {
  w.motion = {...(w.motion ?? DEFAULT_MOTION), topPatience:1.1, turnPreference:1.3, preferredTurn:'cradle'};
  w.style = 'Cradle pinning specialist — locks the head and knee together, turns and maintains finishing pressure';
 }
 if (name === 'Nick Simmons') {
  w.motion = {...(w.motion ?? DEFAULT_MOTION), topPatience:1.15, turnPreference:1.35};
  w.attributes.mat = Math.max(w.attributes.mat,0.97);
  w.style = 'The East Lansing Strangler — suffocating top pressure, spladle specialist and relentless pinning';
 }
 if (name === 'Spencer Lee' || name === 'David Taylor') {
  w.motion = {...(w.motion ?? DEFAULT_MOTION), topPatience:1.1, turnPreference:1.35, preferredTurn:name==='David Taylor'?'barHalf':'wristBar'};
  w.attributes.mat = Math.max(w.attributes.mat,0.98);
  w.style = name === 'David Taylor'
   ? 'The Magic Man — arm bars and tilts; deep half nelsons from crab rides, quick side switches and pinning pressure'
   : 'Arm-bar and tilt specialist — high-scoring turns and strong pinning pressure';
 }
}

// Individual stances (animation only), after every motion override above.
for (const w of ROSTER) {
 const style = stanceStyleFor(`${w.firstName} ${w.lastName}`, w.motion ?? DEFAULT_MOTION);
 w.lead = style.lead; w.stanceLook = style.look;
 // Researched lead foot, stance and attacks, where film or recaps show them.
 applyResearchedStyle(w);
 // Researched pace and brawler grades shape his tendencies on top (attributeRatings.ts STYLE_EFFECT).
 applyStyleGrades(w);
}
