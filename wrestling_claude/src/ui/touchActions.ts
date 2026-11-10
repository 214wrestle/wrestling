import type { TouchKey } from '../engine/TouchGestures';
import type { UiState } from '../game/store';
/** Controls currently offered by the touch panel; also bounds retained input. */
export function availableTouchKeys(state: Pick<UiState,'position'|'top'|'humanSide'|'meters'|'legActions'>&{prompts?:{shoot:{label:string}}}): Set<TouchKey> {
 // Simple controls: the stick picks the move, so the panel is three buttons plus Lower
 // (and Sit out on bottom). Technique, finish, scramble and leg-ride buttons are gone.
 const keys=new Set<TouchKey>(['shoot','fight','sprawl']);
 const legsIn=state.meters.some(m=>m.label==='Opening the pocket'||m.label==='Leg ride secured');
 if(state.position==='Neutral')keys.add('level');
 if(state.position==='In on the legs')keys.add('level');
 if(state.position==='Top' && state.top===state.humanSide && !state.meters.some(m=>m.label==='Pin'))keys.add('level');
 if(state.top!==null && state.top!==state.humanSide && state.meters.some(m=>m.label==='Base')){
  if(legsIn)keys.add('level');
  if(state.prompts?.shoot.label==='Stand up')keys.add('sitOut');
 }
 return keys;
}
