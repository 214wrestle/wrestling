import type { TouchKey } from '../engine/TouchGestures';
import type { UiState } from '../game/store';
/** Controls currently offered by the touch panel; also bounds retained input. */
export function availableTouchKeys(state: Pick<UiState,'position'|'top'|'humanSide'|'meters'|'legActions'>&{prompts?:{shoot:{label:string}}}&{options?:UiState['options']}): Set<TouchKey> {
 // Simple controls: three buttons plus Lower, and the named moves for this position in their own fixed slots
 // (situation options, owner November 15). Sit out, the finishes and the turns are named moves now.
 const keys=new Set<TouchKey>(['shoot','fight','sprawl']);
 if(state.options?.some(Boolean))keys.add('option');
 const legsIn=state.meters.some(m=>m.label==='Opening the pocket'||m.label==='Leg ride secured');
 if(state.position==='Neutral')keys.add('level');
 if(state.position==='In on the legs')keys.add('level');
 if(state.position==='Top' && state.top===state.humanSide && !state.meters.some(m=>m.label==='Pin'))keys.add('level');
 if(state.top!==null && state.top!==state.humanSide && state.meters.some(m=>m.label==='Base')){
  if(legsIn)keys.add('level');
 }
 return keys;
}
