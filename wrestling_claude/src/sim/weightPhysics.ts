import type { Wrestler } from './types';

/** Attributes rank ability within the athlete's weight class. These provisional
 * body scales translate that rank into absolute movement and force; they do not
 * alter the displayed rating or imply measured athlete biomechanics. */
export function weightPhysics(weightClass: number) {
  const mass = Math.max(125, Math.min(285, weightClass)) / 165;
  return { mobility: mass ** -0.23, force: mass ** 0.67 };
}
export function absoluteStrength(wrestler: Wrestler): number {
  return weightPhysics(wrestler.weightClass).force * (0.75 + wrestler.attributes.strength * 0.5);
}
