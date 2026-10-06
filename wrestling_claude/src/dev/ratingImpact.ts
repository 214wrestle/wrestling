/** Controlled rating-gap audit, not a prediction for a particular historical matchup. */
import { MatchSim } from '../sim/MatchSim';
import { WrestlerAI } from '../sim/ai';
import { PROTOTYPE_ROSTER } from '../sim/roster';
import type { Wrestler } from '../sim/types';
const DT = 1 / 60;
const count = 400;
function athlete(rating: number, id: string): Wrestler {
  const value = rating / 100;
  return {...PROTOTYPE_ROSTER[0], id, firstName: 'Control', lastName: id,
    rating, motion: undefined, profile: undefined, ncaaCareer: undefined,
    attributes: {quickness:value,strength:value,conditioning:value,mat:value,defense:value}};
}
for (const lower of [96, 90, 85]) {
  let wins = 0, completed = 0, margin = 0;
  const finishes: Record<string,number> = {};
  for (let m = 0; m < count; m++) {
    const highSide = m % 2;
    const seedPair = Math.floor(m / 2);
    const high = athlete(96,'high'), low = athlete(lower,'low');
    const ais = [new WrestlerAI(0,'starter',2000+seedPair*2),new WrestlerAI(1,'starter',2001+seedPair*2)];
    const sim = new MatchSim(highSide === 0 ? [high,low] : [low,high], {
      onMove:()=>{}, onTell:(to,what)=>ais[to].onTell(what),
      onResult:r=>{completed++; if(r.winner===highSide)wins++; margin+=r.score[highSide]-r.score[1-highSide]; finishes[r.type]=(finishes[r.type]??0)+1;},
    },1000+seedPair);
    sim.humanSide=0; sim.startIntros(); sim.skipIntros();
    for(let i=0;i<60*60*15 && sim.phase!=='results';i++) {
      if(sim.phase==='positionChoice')sim.choosePosition((['neutral','top','bottom'] as const)[seedPair%3]);
      const active=sim.phase==='wrestling';
      sim.tick(DT,[ais[0].update(DT,sim.bout,active),ais[1].update(DT,sim.bout,active)]);
    }
  }
  console.log(JSON.stringify({matchup:`96 vs ${lower}`,completed,wins,winPercent:100*wins/completed,meanScoreMargin:margin/completed,finishes}));
}
