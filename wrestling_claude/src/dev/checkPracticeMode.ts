import {ROSTER} from '../sim/roster';
import {WrestlerAI} from '../sim/ai';
import {MatchSim} from '../sim/MatchSim';
import {playableMatchup} from '../sim/playerDifficulty';
const raw:[typeof ROSTER[number],typeof ROSTER[number]]=[ROSTER[0],ROSTER[1]];
const before=JSON.stringify(raw);const pair=playableMatchup(raw,0,'practice');
if(pair[0]!==raw[0]||pair[1].rating!==raw[1].rating||JSON.stringify(raw)!==before)throw Error('Roster mutation');
const sim=new MatchSim(pair,{},42);const ai=new WrestlerAI(1,'practice');
for(const top of [null,0,1] as const){
 if(top===null)sim.bout.setNeutral({x:0,z:0},0);else sim.bout.setReferee(top,{x:0,z:0},0);
 for(let i=0;i<600;i++){
  ai.onTell('shot');const cmd=ai.update(1/60,sim.bout,true);
  if(Object.values(cmd).some(Boolean))throw Error('Practice partner attacks or resists');
 }
}
for(const d of ['walk-on','starter','all-american'] as const){const p=playableMatchup(raw,1,d);if(p[1]!==raw[1]||p[0].attributes.defense>=raw[0].attributes.defense)throw Error('Wrong side assisted');}
console.log('Practice cooperation, both human sides, and roster preservation passed');

sim.practice=true;sim.startIntros();sim.skipIntros();sim.clock=180;const no={moveX:0,moveZ:0,shoot:false,fight:false,sprawl:false,level:false};for(let i=0;i<12000;i++)sim.tick(1/60,[no,no]);if(sim.clock!==180||sim.period!==1)throw Error('Practice clock expired');console.log('Practice clock remains unlimited');
