export const ARM_BARS = ['armBar','wristBar','barHalf','doubleBar'] as const;
export type ArmBar = typeof ARM_BARS[number];
/** The top man's chosen turn from the flat: an arm-bar combination, or a cradle (near side or crossface). */
export type CradleTurn = 'cradle' | 'crossfaceCradle';
export type TopTurnChoice = {style:ArmBar|CradleTurn;mirror:boolean};
export const CRADLE_LABELS:Record<CradleTurn,string>={cradle:'Cradle',crossfaceCradle:'Crossface cradle'};
export const isCradleTurn=(value:unknown):value is CradleTurn=>value==='cradle'||value==='crossfaceCradle';
/**
 * A wrestler's turn from the flat when he has no researched preference: most go to the half nelson, about one
 * in four to the crossface cradle (fixed per wrestler, so the button label stays true).
 */
export function flatTurnFor(name:string, preferred?:string):'halfNelson'|CradleTurn|ArmBar{
  if(isArmBar(preferred)||isCradleTurn(preferred))return preferred;
  let h=0;for(let i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))>>>0;
  return h%4===0?'crossfaceCradle':'halfNelson';
}
export function isArmBar(value:unknown):value is ArmBar {return ARM_BARS.includes(value as ArmBar);}
export const ARM_BAR_LABELS:Record<ArmBar,string>={armBar:'Arm bar',wristBar:'Wrist + bar',barHalf:'Bar + half',doubleBar:'Double bar'};

// Full release of the bar during the belly-down recovery.
export const ARM_BAR_GRIP_RELEASE = .4;
