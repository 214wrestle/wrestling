import type { TouchKey } from '../engine/TouchGestures';
import type { UiState } from '../game/store';
/** Controls currently offered by the touch panel; also bounds retained input. */
export function availableTouchKeys(state: Pick<UiState,'position'|'top'|'humanSide'|'meters'|'legActions'>): Set<TouchKey> {
 const keys=new Set<TouchKey>(['shoot','fight','sprawl']);
 if(state.position==='Neutral'){keys.add('technique');keys.add('lowSingle');keys.add('level');}
 if(state.position==='Top' && state.top===state.humanSide && !state.meters.some(m=>m.label==='Pin'))keys.add('level');
 if(state.position!=='Neutral' && state.position!=='—')keys.add('scramble');
 if(state.legActions?.length)keys.add('legAction');
 if(state.top!==null && state.meters.some(m=>m.label==='Base')){
  if(state.top===state.humanSide)keys.add('legRide');
  else {keys.add('closePockets');keys.add('catchLeg');}
 }
 return keys;
}
