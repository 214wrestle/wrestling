// School singlets (owner, November 11): every wrestler wears his school's real singlet from his era, and an Icon wears
// the singlet of the school he wrestled for (Sam Henson Clemson, Kevin Jackson LSU), not a team kit.
import { ROSTER, SCHOOLS, TEAM_COLOURS } from '../sim/roster';
import { iconSchool } from '../sim/schoolAbbr';
import { ERA_KITS, eraKitFor, kitIdOf, schoolColours } from '../body/realistic/eraKits';
import { markLayout } from '../body/realistic/material';
import { MAX_TATTOOS, TATTOO_REGION, TATTOOS } from '../body/realistic/tattoos';
import { RESEARCHED_KITS, SCHOOL_KITS } from '../body/realistic/schoolKits';
const ok = (v: boolean, m: string) => { if (!v) throw Error(m); };
const HEX = /^#[0-9a-f]{6}$/i;

let covered = 0, icons = 0;
const missing: string[] = [];
for (const w of ROSTER) {
  const icon = iconSchool(w);
  const id = icon ? kitIdOf(icon) : w.school.id;
  const seasons = [...(w.ncaaCareer?.counted ?? []), ...(w.ncaaCareer?.excluded ?? [])].map((x) => x.year);
  const season = seasons.length ? Math.round(seasons.reduce((a, b) => a + b, 0) / seasons.length) : undefined;
  const era = eraKitFor(id, season);
  if (!era) { missing.push(`${w.firstName} ${w.lastName} (${id})`); continue; }
  covered++;
  if (icon) { icons++; ok(!!schoolColours(id), `${icon} has researched colours`); }
  if (season !== undefined) ok(season >= era.from - 15 && season <= era.to + 15, `${w.firstName} ${w.lastName}: era ${era.from}-${era.to} near his season ${season}`);
  for (const c of [era.primary, era.secondary, era.piping, era.markColor]) if (c) ok(HEX.test(c), `${id}: colour ${c}`);
}
ok(missing.length === 0, `every wrestler has his school's era singlet; missing: ${missing.join(', ')}`);

// Researched eras run in order without overlaps.
for (const [id, eras] of Object.entries(RESEARCHED_KITS)) for (let i = 1; i < eras.length; i++) ok(eras[i].from > eras[i - 1].to, `${id}: eras overlap at ${eras[i].from}`);

// Named examples from the owner.
const named = (n: string) => ROSTER.find((w) => `${w.firstName} ${w.lastName}` === n)!;
ok(kitIdOf(iconSchool(named('Sam Henson'))!) === 'clemson' && !!eraKitFor('clemson', 1993), 'Sam Henson wears Clemson');
ok(kitIdOf(iconSchool(named('Kevin Jackson'))!) === 'lsu' && !!eraKitFor('lsu', 1985), 'Kevin Jackson wears LSU');
// Team colours (owner, November 11): every real school in its own colours, not the old rotating placeholder, with the
// scoreboard text readable on the team colour and the accent readable on the dark menus.
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const PLACEHOLDER = ['#163a72', '#a3172c', '#1f6b4a', '#2b2f37'];
const schools = new Map(ROSTER.map((w) => [w.school.id, w.school]));
let coloured = 0;
for (const [id, s] of schools) {
  if (id === 'college-wrestling-icons') continue;
  ok(!PLACEHOLDER.includes(s.primary.toLowerCase()), `${id}: real team colour, not the placeholder ${s.primary}`);
  ok(contrast(s.primary, s.secondary) >= 3, `${id}: scoreboard text ${s.secondary} reads on ${s.primary} (${contrast(s.primary, s.secondary).toFixed(1)})`);
  ok(contrast(s.accent, '#0b0e14') >= 3, `${id}: accent ${s.accent} reads on the dark menus (${contrast(s.accent, '#0b0e14').toFixed(1)})`);
  coloured++;
}
for (const [id, c] of Object.entries(TEAM_COLOURS)) {
  const k = SCHOOL_KITS[id];
  // Virginia Tech wrestles in a black singlet; its school colours (the scoreboard) are maroon and orange.
  if (k && id !== 'virginia-tech') ok([k.primary, k.secondary].includes(c.primary), `${id}: team colour ${c.primary} is one of its researched colours ${k.primary}/${k.secondary}`);
}
ok(SCHOOLS.wisconsin.primary === '#c5050c' && SCHOOLS.lehigh.primary === '#4f3324', 'Wisconsin red, Lehigh brown');

// Stacked and arched wordmarks (owner OK, November 11): every one fits the chest. The mark is 0.2 m wide at 1024 px,
// so its height in metres is 0.2 * height / 1024; the top stays put and it must end well above the waist (about 0.11 m).
// Letters measured as a condensed face, about 0.58 em each.
const measure = (font: string, s: string) => Number(/(\d+)px/.exec(font)![1]) * 0.58 * s.length;
let stacked = 0, arched = 0;
const allEras = [...Object.entries(ERA_KITS), ...Object.entries(RESEARCHED_KITS)];
for (const [id, eras] of allEras) for (const e of eras) {
  if (!e.mark?.includes('\n') && !e.markArch) continue;
  const lay = markLayout(e.mark ?? 'WORDMARK', !!e.markArch, measure);
  const metres = (0.2 * lay.height) / 1024;
  ok(metres <= 0.115, `${id} ${e.from}: mark ${JSON.stringify(e.mark)} is ${metres.toFixed(3)} m tall, fits the chest`);
  ok(lay.rows.every((r) => r.width <= 940), `${id} ${e.from}: every line fits across the chest`);
  if (e.mark?.includes('\n')) { stacked++; ok(lay.rows.length === 2, `${id} ${e.from}: two lines`); }
  if (e.markArch) arched++;
}
ok(ERA_KITS['penn-state'].filter((e) => e.mark === 'PENN\nSTATE').map((e) => e.from).join() === '1980,1992', 'Penn State 1980-2008: PENN over STATE');
const bak = markLayout('CAL STATE\nBAKERSFIELD', false, measure);
ok(bak.rows[1].size < bak.rows[0].size, 'a long second line comes out smaller (BAKERSFIELD under CAL STATE)');
const psu = markLayout('PENN\nSTATE', false, measure);
ok(psu.rows[0].size === psu.rows[1].size, 'PENN and STATE in the same letter size');
ok(markLayout('IOWA STATE', false, measure).height === 256, 'a one-line mark keeps the old one-line texture');
console.log(`Wordmarks: ${stacked} stacked and ${arched} arched eras fit the chest`);

// Tattoos (owner, November 11: "you can load tats if you have them"): every tattooed name is on the roster, each has a
// source, at most MAX_TATTOOS pieces, in places the shader draws.
for (const [name, t] of Object.entries(TATTOOS)) {
  ok(ROSTER.some((w) => `${w.firstName} ${w.lastName}` === name), `tattoos: ${name} is on the roster`);
  ok(t.ink.length > 0 && t.ink.length <= MAX_TATTOOS && t.source.length > 0, `tattoos: ${name} has 1-${MAX_TATTOOS} pieces and a source`);
  for (const i of t.ink) ok(TATTOO_REGION[i.at] > 0 && (i.side === 'L' || i.side === 'R'), `tattoos: ${name} ${i.at} ${i.side}`);
}
console.log(`Tattoos: ${Object.keys(TATTOOS).length} wrestlers with ink from photos or the owner`);

console.log(`Team colours: ${coloured} schools in their own colours, readable on the scoreboard and menus`);
console.log(`School singlets: ${covered} wrestlers in their school's era singlet (${icons} Icons in their own school's), ${Object.keys(RESEARCHED_KITS).length} researched schools`);
