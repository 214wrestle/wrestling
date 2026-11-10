import { withHiddenSkill } from './hiddenSkill';
import type { Difficulty } from './ai';
import type { Side, Wrestler } from './types';
/** Match-local assistance; historical roster ratings and records stay untouched. */
/** How much harder the player is to turn, by level (subtracted from the AI's turn odds, as turnResist). */
export const PLAYER_TURN_RESIST: Record<Difficulty, number> = { practice: 0, 'walk-on': 0.2, starter: 0.1, 'all-american': 0.1 };

export function playableMatchup(input: [Wrestler,Wrestler], human: Side, difficulty: Difficulty): [Wrestler,Wrestler] {
  // Hidden skill first (owner, November 10: the Morenos and Shawn Rustad wrestle like high-80s wrestlers), then the
  // level's adjustments on top of it.
  const wrestlers = input.map(withHiddenSkill) as [Wrestler,Wrestler];
  // Each level clearly harder than the last: JV forgiving, Varsity a real match, All-American a fight.
  // This scales the opponent on his feet (speed, power, gas). Varsity .9 -> .95 on November 9, with the busier
  // neutral (more fakes, hand fighting, set-up shots), to keep an even Varsity match about 50/50 for a good player.
  // November 10: Varsity and All-American .95 -> 1 (full rating on the feet), paying for the player's new back
  // points from top: 56% -> 51% at Varsity, 45% -> 35% at All-American (techscan, even, 240).
  // November 10, the slower scoring pace (Bout PACE) took Varsity to 45%: .96 / .99. Then the player's own turn
  // resistance (PLAYER_TURN_RESIST) took Varsity to 58%: back to 1 at Varsity. Then longer leg battles and stalling on
  // a man who will not attack (owner) took it to 43%: .96 again.
  const resistance={practice:.3,'walk-on':.8,starter:.96,'all-american':.99}[difficulty];
  // Mat skill and defense keep most of their real value at every level: an easier level gives up
  // takedowns, not tech falls and pins. Owner target for bonus finishes (fall or tech fall) against
  // a good player: about 15% at JV, 10% at Varsity, 5% at All-American.
  const matResistance={practice:.5,'walk-on':.95,starter:1,'all-american':1}[difficulty];
  // The higher the level, the harder the opponent is to turn and to pin. November 10 (owner: falls and near
  // falls were rare): .42/.45/.5 and survival 5/3.2/2.4 left a good player turning the AI on about 1% of real
  // attempts, falls were 1-2% of matches (NCAA nationals: 7-9%), and a turned man was pinned 2% of the time.
  // Survival is tuned against a person holding Squeeze on his back (turnscan HOLD=1: a press every 0.18 s, much
  // stronger than the AI's own squeeze): his falls about 7 / 6 / 3% of matches, bonus finishes 13 / 10 / 7%
  // (owner target about 15 / 10 / 5%), back points about 1.9 / 1.5 / 1.0 a match. Tilts and loose throws are
  // flashes (Bout FLASH_EXPOSURES), mostly a quick 2; locked holds are where the falls come from.
  const turnResist={practice:0,'walk-on':.3,starter:.35,'all-american':.4}[difficulty];
  // A multiplier on each level's base effort, which already rises with level.
  const survival={practice:1,'walk-on':4.6,starter:2.4,'all-american':1.65}[difficulty];
  // Against a person the AI gets few openings, so it needs to attack without one.
  const shotPressure={practice:1,'walk-on':3,starter:6,'all-american':6}[difficulty];
  // A share of the person's reflex sprawl, so an even opponent defends shots on the easier levels;
  // All-American already reads shots well enough on its own.
  const shotDefense={practice:0,'walk-on':.5,starter:.7,'all-american':0}[difficulty];
  const scale=(key:string)=>key==='mat'||key==='defense'?matResistance:resistance;
  // The player is harder to turn too (November 10: the AI scored about 2.3 back points a match off the player at
  // Varsity, a real bout has about 0.9 between both men). Less at the higher levels.
  const playerTurnResist=PLAYER_TURN_RESIST[difficulty];
  return wrestlers.map((w,side)=>side===human?(playerTurnResist?{...w,turnResist:playerTurnResist}:w):{...w,turnResist,survival,shotPressure,shotDefense,attributes:Object.fromEntries(Object.entries(w.attributes).map(([key,value])=>[key,value*scale(key)]))}) as [Wrestler,Wrestler];
}
