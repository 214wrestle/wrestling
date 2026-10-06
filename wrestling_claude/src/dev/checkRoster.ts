import { morenoFamilyNote, morenoMatchupNote, smithPerryFamilyNote } from '../sim/easterEggs';
import { ROSTER, LEGENDS_TEAMS, LEGENDS_WEIGHTS, byId, DEFAULT_MATCHUP } from '../sim/roster';
const check = (ok: boolean, label: string) => { if (!ok) throw new Error(label); };
check(LEGENDS_TEAMS.length === 25, '25 teams');
check(ROSTER.filter(w => w.legends?.role === 'starter').length === 300, '300 assigned starters');
check(new Set(ROSTER.map(w => w.id)).size === ROSTER.length, 'unique selectable identities');
for (const team of LEGENDS_TEAMS) {
  for (const weight of LEGENDS_WEIGHTS) {
    const starters = ROSTER.filter(w => w.school.id === team.id && w.weightClass === weight && w.legends?.role === 'starter');
    check(starters.length === 1, `${team.team}: one starter at ${weight}`);
    const source = team.starters.find(e => (e.weight === 'HWT' ? 285 : Number(e.weight)) === weight)!;
    check(`${starters[0].firstName} ${starters[0].lastName}` === source.name, 'locked name preserved');
  }
}
check(byId(DEFAULT_MATCHUP[0]).weightClass === byId(DEFAULT_MATCHUP[1]).weightClass, 'matched default weight');
check(!ROSTER.some(w => w.lastName === 'Samson'), 'Hud Samson absent');
check(byId('penn-state-190-starter-quentin-wright').legends?.bioNote?.includes('184 and 197') === true, 'Wright career note');
check(ROSTER.filter(w => w.firstName === 'Dylan' && w.lastName === 'Ness').every(w => w.weightClass === 157), 'Ness locked weights');
check(byId('iowa-state-141-starter-dan-gable').rating === 99, 'Gable 99');
check(byId('iowa-state-141-starter-dan-gable').ncaaCareer?.total === 30, 'Gable verified career points');
console.log(`${LEGENDS_TEAMS.length} teams, 300 assigned starters, ${ROSTER.length - 300} assigned Coach’s Choice slots verified`);

check(ROSTER.every(w => w.firstName.trim().length > 0 && w.lastName.trim().length > 0), 'all entries have first and last names');
for (const [name, weight] of [['Trent', 157], ['Travis', 165]] as const) {
 const w = ROSTER.find(w => w.school.id === 'iowa-state' && w.firstName === name && w.lastName === 'Paulson');
 check(w?.weightClass === weight && !!w.legends?.bioNote?.includes('Lewis Central'), `${name} Paulson slot and twin Easter egg`);
}

const weightsByName = new Map<string, Set<number>>();
for (const w of ROSTER) { const name = `${w.firstName} ${w.lastName}`; const weights = weightsByName.get(name) ?? new Set<number>(); weights.add(w.weightClass); weightsByName.set(name, weights); }
check([...weightsByName.values()].every(weights => weights.size === 1), 'each wrestler has only one weight');

for (const [name, weight] of [['Jeff McGinness', 141], ['Mark Perry', 165]] as const) {
 check(ROSTER.some(w => `${w.firstName} ${w.lastName}` === name && w.school.id === 'iowa' && w.weightClass === weight && w.legends?.role === 'starter'), `${name} approved starter`);
}

for (const [name, weight, role] of [['Ed Banach', 174, 'starter'], ['Chris Campbell', 174, 'choice'], ['Jessman Smith', 184, 'starter'], ['Sammy Brooks', 184, 'choice']] as const) {
 check(ROSTER.some(w => `${w.firstName} ${w.lastName}` === name && w.school.id === 'iowa' && w.weightClass === weight && w.legends?.role === role), `${name} approved Iowa placement`);
}

for (const [school, name, weight] of [['virginia-tech', 'Bo Bassett', 141], ['northern-iowa', 'Israel "Izzy" Moreno', 174]] as const) {
 const entries = ROSTER.filter(w => `${w.firstName} ${w.lastName}` === name);
 check(entries.length === 1 && entries[0].school.id === school && entries[0].weightClass === weight && entries[0].legends?.role === 'choice', `${name} unique approved choice`);
}

const izzy = ROSTER.find(w => w.school.id === 'northern-iowa' && w.firstName === 'Israel')!;
for (const name of ['Mike Moreno Sr.', 'Michael Moreno', 'Gabe Moreno']) {
 const cyclone = ROSTER.find(w => w.school.id === 'iowa-state' && `${w.firstName} ${w.lastName}` === name)!;
 check(!!morenoFamilyNote(izzy) && !!morenoFamilyNote(cyclone), `${name} family notes both ways`);
 check(!!morenoMatchupNote(izzy, cyclone) && morenoMatchupNote(izzy, cyclone) === morenoMatchupNote(cyclone, izzy), 'family matchup independent of corner');
}

check(ROSTER.filter(w=>w.rating===99).map(w=>`${w.firstName} ${w.lastName}`).sort().join('|') === 'Cael Sanderson|Dan Gable', 'Only Gable and Sanderson 99');

for (const name of ['John Smith', 'Pat Smith', 'Mark Perry']) {
 const w = ROSTER.find(w => `${w.firstName} ${w.lastName}` === name)!;
 check(!!w && !!smithPerryFamilyNote(w), `${name} reciprocal Smith–Perry family note`);
}
check(!smithPerryFamilyNote(ROSTER.find(w => w.firstName === 'Jessman')!), 'Unrelated Smith surname does not trigger family note');

const snyder = ROSTER.filter(w => w.firstName === 'Kyle' && w.lastName === 'Snyder');
check(snyder.length === 1 && snyder[0].weightClass === 285 && snyder[0].legends?.role === 'starter', 'Snyder exclusively HWT starter');
check(byId('ohio-state-285-choice-tommy-rowlands').legends?.role === 'choice', 'Rowlands HWT choice');
check(byId('ohio-state-197-starter-kollin-moore').weightClass === 197, 'Moore replacement at 197');

check(byId('ohio-state-197-choice-nick-heflin').legends?.role === 'choice', 'Heflin owner choice at 197');

check(!LEGENDS_TEAMS.some(t => t.id === 'northern-colorado'), 'Northern Colorado removed as a selectable team');
const alirez = ROSTER.filter(w => w.firstName === 'Andrew' && w.lastName === 'Alirez');
check(alirez.length === 1 && alirez[0].school.id === 'college-wrestling-icons' && alirez[0].weightClass === 141 && alirez[0].legends?.role === 'choice', 'Andrew Alirez retained once in legends pool at 141');
