/**
 * Bracket abbreviations for the schools (owner, November 10: "Oklahoma State, you would put OSU. Same for Ohio State.
 * Iowa would just be Iowa. Nebraska would be NEB. Iowa State ISU, and so on"). The rest follow the usual bracket short
 * forms.
 */
export const SCHOOL_ABBR: Readonly<Record<string, string>> = {
  'penn-state': 'PSU',
  iowa: 'IOWA',
  nebraska: 'NEB',
  'iowa-state': 'ISU',
  minnesota: 'MINN',
  'oklahoma-state': 'OSU',
  oklahoma: 'OU',
  'ohio-state': 'OSU',
  michigan: 'MICH',
  'michigan-state': 'MSU',
  wisconsin: 'WIS',
  'arizona-state': 'ASU',
  'oregon-state': 'ORST',
  illinois: 'ILL',
  cornell: 'CORN',
  indiana: 'IND',
  'north-carolina': 'UNC',
  'northern-iowa': 'UNI',
  lehigh: 'LEH',
  'virginia-tech': 'VT',
  'west-virginia': 'WVU',
  missouri: 'MIZZ',
  'nc-state': 'NCST',
  penn: 'PENN',
  'college-wrestling-icons': 'ICON',
};

export const schoolAbbr = (id: string, name: string) => SCHOOL_ABBR[id] ?? name.slice(0, 4);

/**
 * Icons (owner, November 10): the College Wrestling Icons are a team only for the dual meet. You still pick them from
 * the Icons list, but in single matches and tournaments (the bracket, the profile, the scorebug) each one shows his
 * own school, read from his locked roster line ("118 — Gene Mills — Syracuse").
 */
const ICONS = 'college-wrestling-icons';
const ICON_SCHOOL_NAMED: Readonly<Record<string, string>> = { 'Shane Griffith': 'Stanford', 'Aden Valencia': 'Stanford' };
const ICON_SCHOOL_ABBR: Readonly<Record<string, string>> = {
  Syracuse: 'SYR', 'Fresno State': 'FRES', Clarion: 'CLAR', Washington: 'WASH', Stanford: 'STAN', LSU: 'LSU',
  Edinboro: 'EDIN', Northwestern: 'NW', American: 'AMER', 'Pitt-Johnstown': 'UPJ', 'Lock Haven': 'LHU',
  'Portland State': 'PORT', 'Cal State Bakersfield': 'CSUB', 'Northern Colorado': 'UNCO',
};

type Schooled = { firstName: string; lastName: string; school: { id: string; name: string }; legends?: { source: string } };

/** An Icon's own school, or null for everyone else (and for an Icon whose school is not on record). */
export function iconSchool(w: Schooled): string | null {
  if (w.school.id !== ICONS) return null;
  const named = ICON_SCHOOL_NAMED[`${w.firstName} ${w.lastName}`];
  if (named) return named;
  const m = /^\S+ — .+ — (.+)$/.exec(w.legends?.source ?? '');
  return m ? m[1].trim() : null;
}

/** The school to show: his own for an Icon outside a dual meet, otherwise his team. */
export function schoolLabel(w: Schooled, inDual = false): { name: string; abbr: string } {
  const own = inDual ? null : iconSchool(w);
  // Capitals, as the team names are stored ("PENN STATE").
  if (own) return { name: own.toUpperCase(), abbr: ICON_SCHOOL_ABBR[own] ?? own.slice(0, 4).toUpperCase() };
  return { name: w.school.name, abbr: schoolAbbr(w.school.id, w.school.name) };
}
