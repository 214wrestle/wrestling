/** NCAA men's folkstyle scoring. Rendering and input have no scoring authority.
 * Sources and the boundaries of the simulation are documented in docs/RULES.md.
 */
export const RULES = Object.freeze({
  periods: [180, 120, 120] as readonly number[],
  takedown: 3, escape: 1, reversal: 2,
  technicalFall: 15, majorDecision: 8,
  ridingThreshold: 60, fallSeconds: 1,
  firstSuddenVictory: 120, laterSuddenVictory: 60, tiebreaker: 30,
  matRadius: 4.57,
});
export function nearFallPoints(seconds: number): number {
  if (seconds >= 4) return 4;
  if (seconds >= 3) return 3;
  if (seconds >= 2) return 2;
  return 0;
}
export function ridingPoint(a: number, b: number): 0 | 1 | null {
  if (a - b >= RULES.ridingThreshold - 0.00001) return 0;
  if (b - a >= RULES.ridingThreshold - 0.00001) return 1;
  return null;
}
export function stallingPenalty(call: number): number | 'disqualification' {
  if (call <= 1) return 0;
  if (call <= 3) return 1;
  if (call === 4) return 2;
  return 'disqualification';
}
