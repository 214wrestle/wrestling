import type { Wrestler } from './types';

/**
 * Hidden skill (owner, November 10): the Morenos (Mike Sr., Michael, Gabe and Izzy) and Shawn Rustad wrestle like
 * high-80s wrestlers whatever their credentials say. Their shown ratings, bars and profiles stay as they are; only a
 * bout sees this (Game's matches through playableMatchup, simulated dual bouts through simulateBout).
 */
export const HIDDEN_SKILL: Readonly<Record<string, number>> = {
  'Mike Moreno Sr.': 88,
  'Michael Moreno': 88,
  'Gabe Moreno': 88,
  'Israel "Izzy" Moreno': 88,
  'Shawn Rustad': 88,
};

/** The wrestler as a bout sees him: attributes and the rating edge raised to his hidden level (never lowered). */
export function withHiddenSkill(w: Wrestler): Wrestler {
  const level = HIDDEN_SKILL[`${w.firstName} ${w.lastName}`];
  if (level === undefined || (w.rating ?? 0) >= level) return w;
  const v = level / 100;
  const a = w.attributes;
  return {
    ...w,
    performanceRating: level,
    attributes: {
      ...a,
      quickness: Math.max(a.quickness, v),
      strength: Math.max(a.strength, v),
      conditioning: Math.max(a.conditioning, v),
      mat: Math.max(a.mat, v),
      defense: Math.max(a.defense, v),
      ...(a.legRiding !== undefined ? { legRiding: Math.max(a.legRiding, v) } : {}),
      ...(a.throws !== undefined ? { throws: Math.max(a.throws, v) } : {}),
      ...(a.shots !== undefined ? { shots: Math.max(a.shots, v) } : {}),
      ...(a.scrambling !== undefined ? { scrambling: Math.max(a.scrambling, v) } : {}),
      ...(a.riding !== undefined ? { riding: Math.max(a.riding, v) } : {}),
      ...(a.pinning !== undefined ? { pinning: Math.max(a.pinning, v) } : {}),
      ...(a.bottom !== undefined ? { bottom: Math.max(a.bottom, v) } : {}),
      ...(a.turning !== undefined ? { turning: Math.max(a.turning, v) } : {}),
    },
  };
}
