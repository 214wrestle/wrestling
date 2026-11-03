import type { Difficulty } from './ai';
import type { Side, Wrestler } from './types';
/** Match-local assistance; historical roster ratings and records stay untouched. */
export function playableMatchup(wrestlers: [Wrestler,Wrestler], human: Side, difficulty: Difficulty): [Wrestler,Wrestler] {
  const resistance={practice:.15,'walk-on':.4,starter:.55,'all-american':.7}[difficulty];
  return wrestlers.map((w,side)=>side===human?w:{...w,attributes:Object.fromEntries(Object.entries(w.attributes).map(([key,value])=>[key,value*resistance]))}) as [Wrestler,Wrestler];
}
