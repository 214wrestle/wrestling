// Owner, November 12: overall ratings built from attribute categories ("Build from attributes"), seeded by each
// wrestler's career rating and moved by the researched grades (docs/research/wrestler-styles.json).
import { ROSTER } from '../sim/roster';
import { ATTRIBUTE_GRADES } from '../sim/attributeGrades';
import { ABILITY_KEYS, OVERALL_WEIGHTS, categoryRating, overallFromAbilities } from '../sim/attributeRatings';
const ok = (x: boolean, m: string) => { if (!x) throw Error(m); };
const name = (w: { firstName: string; lastName: string }) => `${w.firstName} ${w.lastName}`;
const by = (n: string) => ROSTER.find((w) => name(w) === n)!;

ok(Math.abs(ABILITY_KEYS.reduce((s, k) => s + OVERALL_WEIGHTS[k], 0) - 1) < 1e-9, 'overall weights sum to 1');
for (const n of Object.keys(ATTRIBUTE_GRADES)) ok(ROSTER.some((w) => name(w) === n), `graded name is on the roster: ${n}`);

// Grades move a category the right way; no grade leaves it alone; a 5 never pulls a higher-rated man down.
ok(categoryRating(85) === 85, 'ungraded category stays at the career rating');
ok(categoryRating(85, 5) > 85 && categoryRating(85, 4) > 85 && categoryRating(85, 2) < 85 && categoryRating(85, 1) < categoryRating(85, 2), 'grades pull the right way');
ok(categoryRating(99, 5) === 99, 'a 5 keeps a 99 at 99');

let moved = 0, worst = 0;
for (const w of ROSTER.filter((x) => x.legends)) {
  const n = name(w);
  ok(w.abilities !== undefined && w.careerRating !== undefined, `${n} has category ratings`);
  const locked = n === 'Dan Gable' || n === 'Cael Sanderson';
  ok(w.rating === (locked ? 99 : overallFromAbilities(w.abilities!)), `${n}'s overall is built from his categories`);
  if (!ATTRIBUTE_GRADES[n]) ok(w.rating === w.careerRating && ABILITY_KEYS.every((k) => w.abilities![k] === w.careerRating), `unresearched ${n} keeps his career level`);
  if (w.rating !== w.careerRating) moved++;
  worst = Math.max(worst, Math.abs(w.rating! - w.careerRating!));
}
ok(worst <= 8, `no overall moves more than 8 from his career rating (${worst})`);
ok(ROSTER.filter((w) => w.rating === 99).map(name).sort().join('|') === 'Cael Sanderson|Dan Gable', 'only Gable and Sanderson are 99');

// The categories reach the match: a researched rider/turner has a better mat attribute than his career level, a
// stingy defender a better defense than quickness, and owner overrides still sit on top.
const zain = by('Zain Retherford');
ok(zain.attributes.mat > zain.careerRating! / 100, `Retherford's riding and turning lift his mat attribute (${zain.attributes.mat.toFixed(2)})`);
const kemp = by('Lee Kemp');
ok(kemp.abilities!.defense > kemp.careerRating!, `Kemp's defense grade lifts his defense (${kemp.abilities!.defense} vs ${kemp.careerRating})`);
ok(by('Teyon Ware').attributes.defense >= 0.95 && by('Royce Alger').attributes.conditioning === 0.98, 'owner overrides still apply on top');
const flat = ROSTER.filter((w) => w.legends && ATTRIBUTE_GRADES[name(w)] && new Set(Object.values(w.attributes)).size > 1).length;
ok(flat > 300, `researched wrestlers no longer have five equal attributes (${flat})`);
console.log(`Attribute ratings: ${moved} overalls moved by the categories (most ${worst}); ${flat} wrestlers with distinct match attributes`);
