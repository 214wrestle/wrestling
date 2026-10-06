import { MOVES } from '../sim/moves';
import { BOUT } from '../sim/bout';
import type { MatchSim } from '../sim/MatchSim';
import { otherSide } from '../sim/types';
import type { Side } from '../sim/types';
import type { ButtonId, ButtonPrompt, Meter, PositionLabel } from './store';

/**
 * What each button does right now, and whether now is the moment.
 *
 * Wrestling is all context: the same button that shoots on the feet stands you
 * up from bottom. The HUD reads this every few frames so the player always
 * knows their three options — and sees a button light up when the position
 * gives them an opening.
 */

export interface PromptRead {
  position: PositionLabel;
  prompts: Record<ButtonId, ButtonPrompt>;
  meters: Meter[];
}

const P = (label: string, state: ButtonPrompt['state'] = 'idle'): ButtonPrompt => ({ label, state });

export function readPrompts(sim: MatchSim, me: Side): PromptRead {
  const bout = sim.bout;
  const pos = bout.position;
  const you = bout.athletes[me];
  const them = bout.athletes[otherSide(me)];
  const dist = bout.distance();
  const wrestling = sim.phase === 'wrestling';

  if (!wrestling) {
    return {
      position: sim.phase === 'setPosition' && bout.top !== null ? (bout.top === me ? 'Top' : 'Bottom') : 'Neutral',
      prompts: { shoot: P('Shoot', 'off'), fight: P('Hand fight', 'off'), sprawl: P('Sprawl', 'off') },
      meters: [],
    };
  }

  switch (pos.kind) {
    case 'neutral': {
      const inRange = dist >= BOUT.shotMin && dist <= BOUT.shotMax;
      const ideal = dist > 0.7 && dist < 1.2;
      const opening =
        them.lean > 0.3 ||
        them.level > 0.6 ||
        them.act === 'reach' ||
        them.act === 'stagger' ||
        them.act === 'sprawlRecover' ||
        them.act === 'snap';
      const snapOn = you.hand >= 0.62;
      const snapHot = snapOn && (them.lean > 0.15 || them.level > 0.55);
      return {
        position: 'Neutral',
        prompts: {
          shoot: P(inRange ? 'Shoot' : 'Fake', inRange && ideal && opening ? 'hot' : 'idle'),
          fight: P(snapOn ? 'Snap down' : 'Hand fight', snapHot ? 'hot' : dist > BOUT.tieRange + 0.2 ? 'off' : 'idle'),
          sprawl: P('Sprawl', 'idle'),
        },
        meters: [{ label: 'Hand fight', value: 0.5 + (you.hand - them.hand) * 0.5, tone: 'you', mark: 0.81 }],
      };
    }
    case 'shot': {
      const attacking = pos.A === me;
      return {
        position: attacking ? 'In on the legs' : 'Defending the shot',
        prompts: attacking
          ? { shoot: P('Drive', 'hold'), fight: P('—', 'off'), sprawl: P('—', 'off') }
          : { shoot: P('—', 'off'), fight: P('—', 'off'), sprawl: P('Sprawl!', 'hot') },
        meters: [],
      };
    }
    case 'legs': {
      const attacking = pos.A === me;
      return {
        position: attacking ? 'In on the legs' : 'Defending the shot',
        prompts: attacking
          ? { shoot: P('Drive through', 'hold'), fight: P('—', 'off'), sprawl: P('—', 'off') }
          : {
              shoot: P('—', 'off'),
              fight: P(pos.shot !== 'double' ? 'Whizzer' : 'Down block', 'mash'),
              sprawl: P('Sprawl hips', 'mash'),
            },
        meters: [{ label: (pos.lifted ?? 0) > 0 ? 'Leg lift' : 'Finish', value: (pos.lifted ?? 0) > 0 ? pos.lifted! : pos.progress, tone: attacking ? 'you' : 'them' }],
      };
    }
    case 'fhl': {
      const top = pos.A === me;
      return {
        position: top ? 'Front headlock' : 'Head trapped',
        prompts: top
          ? { shoot: P('Spin behind', pos.recover < 0.5 ? 'hot' : 'idle'), fight: P('Snap him down', 'idle'), sprawl: P('—', 'off') }
          : { shoot: P('—', 'off'), fight: P('Clear head', 'mash'), sprawl: P('Clear head', 'mash') },
        meters: [{ label: 'Head clear', value: pos.recover, tone: top ? 'them' : 'you' }],
      };
    }
    case 'mat': {
      const top = pos.A === me;
      const label: PositionLabel = top ? 'Top' : 'Bottom';
      if (pos.sub === 'exposed') {
        return {
          position: label,
          prompts: top
            ? { shoot: P('Squeeze', 'hold'), fight: P('Squeeze', 'mash'), sprawl: P('—', 'off') }
            : { shoot: P('Bridge', 'mash'), fight: P('Turn in', 'mash'), sprawl: P('Fight off back', 'mash') },
          meters: [
            { label: 'Pin', value: pos.pin, tone: top ? 'you' : 'them' },
            { label: 'Fight off', value: pos.fight, tone: top ? 'them' : 'you' },
          ],
        };
      }
      if (pos.sub === 'standing') {
        return {
          position: label,
          prompts: top
            ? { shoot: P('—', 'off'), fight: P('Lock hands', 'idle'), sprawl: P('Return to mat', 'hot') }
            : { shoot: P('Turn out', pos.escape >= BOUT.turnOut ? 'hot' : 'idle'), fight: P('Hand control', 'mash'), sprawl: P('—', 'off') },
          meters: [{ label: 'Escape', value: pos.escape, tone: top ? 'them' : 'you', mark: 0.55 }],
        };
      }
      if (pos.sub === 'flat') {
        return {
          position: label,
          prompts: top
            ? { shoot: P('Half nelson', pos.control > 0.3 ? 'hot' : 'idle'), fight: P('Pressure', 'idle'), sprawl: P('Ride tight', 'idle') }
            : { shoot: P('Push up', 'mash'), fight: P('Push up', 'mash'), sprawl: P('Push up', 'mash') },
          meters: [{ label: 'Base', value: Math.min(1, pos.base / 0.68), tone: top ? 'them' : 'you' }],
        };
      }
      // Ride.
      return {
        position: label,
        prompts: top
          ? {
              shoot: P(pos.base < 0.35 ? 'Tilt him' : 'Turn', pos.base < 0.35 ? 'hot' : 'off'),
              fight: P('Break down', 'idle'),
              sprawl: P('Ride tight', 'idle'),
            }
          : {
              shoot: P('Stand up', pos.base > 0.3 ? 'idle' : 'off'),
              fight: P('Switch', pos.commit > 0 ? 'hot' : 'idle'),
              sprawl: P('Base up', pos.base < 0.5 ? 'hot' : 'idle'),
            },
        meters: [{ label: 'Base', value: pos.base, tone: top ? 'them' : 'you', mark: 0.35 }, ...((pos.legRide ?? 0) > 0 ? [{label:(pos.legRide ?? 0) >= 0.8 ? 'Leg ride secured' : 'Opening the pocket',value:pos.legRide!,tone:top ? 'you' as const : 'them' as const}] : []), ...((pos.pockets ?? 0) > 0.3 ? [{label:'Pockets closed',value:pos.pockets!,tone:top ? 'them' as const : 'you' as const}] : []), ...((pos.legCaught ?? 0) > 0 ? [{label:'Clearing the leg',value:pos.legCaught!,tone:top ? 'them' as const : 'you' as const}] : [])],
      };
    }
    case 'move': {
      const award = MOVES[pos.id].award;
      return {position: !pos.awarded && award && ['takedown','reversal','escape'].includes(award.kind) ? 'Scramble' : '—', prompts:{shoot:P('—','off'),fight:P('—','off'),sprawl:P('—','off')},meters:[]};
    }
    default:
      return {
        position: '—',
        prompts: { shoot: P('—', 'off'), fight: P('—', 'off'), sprawl: P('—', 'off') },
        meters: [],
      };
  }
}
