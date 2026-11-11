/**
 * Tattoos (owner, November 11: "you can load tats if you have them"). Where each man's ink is, read from photos or the
 * owner's notes. The designs are generic, drawn in the skin shader (organic linework, a ringed disc, script-like
 * strokes), not copies of the real artwork. The singlet covers whatever it covers. Sides are the wrestler's own.
 */
export type TattooAt = 'sleeve' | 'upperArm' | 'armMedallion' | 'forearm' | 'back' | 'thigh' | 'chestScript';
export interface Tattoo { at: TattooAt; side: 'L' | 'R' }

/** Shader region ids (material.ts, uTattoo[i].x). */
export const TATTOO_REGION: Record<TattooAt, number> = { sleeve: 1, upperArm: 2, armMedallion: 3, forearm: 4, back: 5, thigh: 6, chestScript: 7 };
export const MAX_TATTOOS = 4;

export const TATTOOS: Record<string, { ink: Tattoo[]; source: string }> = {
  // Facing the camera, the sleeve is on the image-right arm: his left, shoulder to wrist (the research note said "right
  // arm", the viewer's right).
  'Ty Watters': { ink: [{ at: 'sleeve', side: 'L' }], source: 'WVU photo, 2026 NCAAs (wvuni.sidearmsports.com IMG_7749)' },
  // Prone, facing left, his left side to the camera: a large piece on the left upper arm and shoulder.
  'Stephen Abas': { ink: [{ at: 'upperArm', side: 'L' }], source: 'calgrappler.com abas.jpg (senior-level match vs Cejudo)' },
  // Facing the camera in a hand fight: ink on the image-right upper arm, his left.
  'Kevin Jack': { ink: [{ at: 'upperArm', side: 'L' }], source: 'gopack.com 2017 NCAA photo (Jack.jpg)' },
  // Facing the camera: a round piece inside the left upper arm by the elbow, a small one on the left forearm, a line of
  // script high on the right chest.
  'David McFadden': { ink: [{ at: 'armMedallion', side: 'L' }, { at: 'forearm', side: 'L' }, { at: 'chestScript', side: 'R' }], source: 'Virginia Tech match photo (cornellbigred.com McFadden_D_20WR)' },
  'Jason Cooley': { ink: [{ at: 'back', side: 'L' }], source: 'Owner, November 10: tattoos on his back' },
  // Aztec-calendar piece on the left thigh (likeness research). His arm script has no side recorded: left off.
  'Michael Moreno': { ink: [{ at: 'thigh', side: 'L' }], source: 'likeness research notes (likeness.ts)' },
};
