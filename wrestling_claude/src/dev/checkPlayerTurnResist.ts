// The player is harder to turn (November 10: the AI scored about 2.3 back points a match off the player at Varsity;
// a real bout has about 0.9 between both men). By level, less at the higher levels; the AI keeps its own resistance.
import {ROSTER} from '../sim/roster';
import {playableMatchup,PLAYER_TURN_RESIST} from '../sim/playerDifficulty';
const ok=(x:boolean,m:string)=>{if(!x)throw Error(m)};
ok(PLAYER_TURN_RESIST['walk-on']>=PLAYER_TURN_RESIST.starter&&PLAYER_TURN_RESIST.starter>=PLAYER_TURN_RESIST['all-american']&&PLAYER_TURN_RESIST['all-american']>0,'harder to turn at the easier levels, still some at All-American');
ok(PLAYER_TURN_RESIST.practice===0,'no change in practice');
const pair:[any,any]=[ROSTER[0],ROSTER.find(w=>w.weightClass===ROSTER[0].weightClass&&w.id!==ROSTER[0].id)!];
for(const level of ['walk-on','starter','all-american'] as const){
  for(const human of [0,1] as const){
    const m=playableMatchup(pair,human,level);
    ok(m[human].turnResist===PLAYER_TURN_RESIST[level],`${level}: the player (side ${human}) gets his turn resistance`);
    ok((m[1-human].turnResist??0)>PLAYER_TURN_RESIST[level],`${level}: the AI is still the harder man to turn`);
  }
}
console.log('Player turn resistance: the AI turns the player less, by level; the AI keeps its own');
