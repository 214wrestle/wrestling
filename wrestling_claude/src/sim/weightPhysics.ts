import type { Wrestler } from './types';

/** Attributes rank ability within the athlete's weight class. These provisional
 * body scales translate that rank into absolute movement and force; they do not
 * alter the displayed rating or imply measured athlete biomechanics. */
export function weightPhysics(weightClass: number) {
  const mass = Math.max(125, Math.min(285, weightClass)) / 165;
  return { mobility: mass ** -0.23, force: mass ** 0.67 };
}
/**
 * Owner, November 14: "A guy like Gable Steveson has elite athleticism and is so much quicker and explosive than your
 * typically plodding big HWT." His feet and shot speed scale as if he weighed this much; his force stays his own.
 */
export const MOVES_LIKE: Readonly<Record<string, number>> = { 'Gable Steveson': 197 };
export const moveWeight = (w: Pick<Wrestler, 'firstName' | 'lastName' | 'weightClass'>): number =>
  MOVES_LIKE[`${w.firstName} ${w.lastName}`] ?? w.weightClass;
export function absoluteStrength(wrestler: Wrestler): number {
  return weightPhysics(wrestler.weightClass).force * (0.75 + wrestler.attributes.strength * 0.5);
}
