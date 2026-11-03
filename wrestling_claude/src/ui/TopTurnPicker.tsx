import {useEffect,useState} from 'react';
import {ARM_BARS,ARM_BAR_LABELS,isArmBar} from '../sim/armBars';
import type {GameApi,UiState} from '../game/store';
export function TopTurnPicker({state,api}:{state:UiState;api:GameApi}){
 const [choice,setChoice]=useState('auto');
 useEffect(()=>()=>api.setTopTurn(undefined),[api]);
 if(state.top!==state.humanSide||!state.meters.some(m=>m.label==='Base'))return null;
 return <label className="top-turn-picker">Top attack
  <select aria-label="Top attack combination" value={choice} onChange={e=>{
   const value=e.target.value;setChoice(value);
   const [style,side]=value.split(':');
   api.setTopTurn(isArmBar(style)?{style,mirror:side==='right'}:undefined);
  }}>
   <option value="auto">Athlete's preferred turn</option>
   {ARM_BARS.flatMap(style=>['left','right'].map(side=><option key={style+side} value={style+':'+side}>{ARM_BAR_LABELS[style]} · {side==='left'?'Left':'Right'}</option>))}
  </select>
  <small>Break down, then tap Turn</small>
 </label>;
}
