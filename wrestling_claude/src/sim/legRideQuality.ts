import type {Wrestler} from './types';
export const LEG_CLEAR_THRESHOLD=.75;
const bounded=(n:number)=>Math.max(0,Math.min(1,n));
/** Provisional fallback uses mat technique until an athlete has a reviewed
 * leg-riding-specific value. Overall career rating alone does not imply it. */
export function legRideSkill(w:Wrestler):number {
  return bounded(w.attributes.legRiding??w.attributes.mat);
}
/** Effective pressure from a seated boot, not merely an attempted entry. */
export function legRideQuality(w:Wrestler,depth:number,stamina:number,caught=0):number {
  const skill=bounded((legRideSkill(w)-.25)/.65);
  return skill*bounded(depth)*(.65+.35*bounded(stamina))*(1-.7*bounded(caught/LEG_CLEAR_THRESHOLD));
}
