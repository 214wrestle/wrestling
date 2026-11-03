export const ARM_BARS = ['armBar','wristBar','barHalf','doubleBar'] as const;
export type ArmBar = typeof ARM_BARS[number];
export type TopTurnChoice = {style:ArmBar;mirror:boolean};
export function isArmBar(value:unknown):value is ArmBar {return ARM_BARS.includes(value as ArmBar);}
export const ARM_BAR_LABELS:Record<ArmBar,string>={armBar:'Arm bar',wristBar:'Wrist + bar',barHalf:'Bar + half',doubleBar:'Double bar'};

// Full release of the bar during the belly-down recovery.
export const ARM_BAR_GRIP_RELEASE = .4;
