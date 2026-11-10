import {ARM_BAR_LABELS,CRADLE_LABELS,flatTurnFor,isArmBar,type TopTurnChoice} from '../sim/armBars';
import { LEG_CLEAR_THRESHOLD } from '../sim/legRideQuality';
import { MOVES } from '../sim/moves';
import { BOUT, EDGE, edgeDistance, legCounterFor, LEG_COUNTER_LABELS } from '../sim/bout';
import { MAT } from '../sim/rules';
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
  legActions?: readonly ('lift' | 'trip' | 'double' | 'drive')[];
}

const P = (label: string, state: ButtonPrompt['state'] = 'idle', alt?: string): ButtonPrompt => (alt ? { label, state, alt } : { label, state });

/** Input instructions are independent of readiness and shared by every device. */
export function actionInstruction(prompt: ButtonPrompt, key: ButtonId): 'Tap' | 'Hold' | 'Tap or hold' | 'Unavailable' {
  if (prompt.label === '—') return 'Unavailable';
  if (prompt.state === 'mash' || ['Squeeze', 'Snap him down', 'Clear capture'].includes(prompt.label)
    || key === 'shoot' && prompt.label === 'Shoot' || key === 'sprawl' && prompt.label === 'Sprawl!') return 'Tap or hold';
  return prompt.state === 'hold' ? 'Hold' : 'Tap';
}


/**
 * The edge of the mat (owner, November 10): which way to move there, and when going out is a stalling call.
 * Nothing when the edge does not matter. Movement only, no new buttons.
 */
export function edgeHintFor(sim: MatchSim, me: Side): string | undefined {
  if (sim.phase !== 'wrestling') return undefined;
  const pos = sim.bout.position;
  if (pos.kind === 'neutral') {
    const you = sim.bout.athletes[me].pos, them = sim.bout.athletes[otherSide(me)].pos;
    const ry = Math.hypot(you.x, you.z), rt = Math.hypot(them.x, them.z);
    if (MAT.circleRadius - ry < 0.9 && rt < ry) return 'Edge: circle off it · backing out is stalling';
    if (MAT.circleRadius - rt < 1.2 && rt > ry + 0.3 && sim.bout.distance() < 1.5) return 'Edge: walk him out · if he backs out, it is stalling';
    return undefined;
  }
  if (pos.kind !== 'legs' && pos.kind !== 'fhl' && pos.kind !== 'mat') return undefined;
  if (edgeDistance(pos.frame.x, pos.frame.z) > EDGE.zone) return undefined;
  const mine = pos.A === me;
  if (pos.kind === 'legs') return mine ? 'Edge: move to the center to turn him in'
    : pos.progress >= 0.75 ? 'Edge: getting out now is fleeing' : 'Edge: move toward the line to get out';
  if (pos.kind === 'fhl') return mine ? 'Edge: move to the center to turn him in' : 'Edge: move toward the line to get out';
  if (mine) return pos.sub === 'standing' ? 'Edge: move toward the line to restart on top (may be called)' : 'Edge: move to the center before you turn him';
  if (pos.sub === 'exposed' || pos.sub === 'spladle') return 'Edge: crawling out on your back is fleeing';
  return pos.sub === 'standing' ? undefined : 'Edge: move toward the line for a fresh restart';
}

/**
 * Locked hands (owner's list; NCAA 5.8.2): on top, the moments when grabbing him (Ride tight) is locking your hands
 * with him not on his feet, a point to him. Shares the hint line with the edge.
 */
export function handsHintFor(sim: MatchSim, me: Side): string | undefined {
  if (sim.phase !== 'wrestling' || sim.bout.handsAtRisk() !== me) return undefined;
  const p = sim.bout.position;
  return p.kind === 'move' && p.id === 'standUp'
    ? 'Hands: he is still on a knee · grabbing now is locked hands'
    : 'Hands: let go as he lands · locked hands is a point';
}

export function readPrompts(sim: MatchSim, me: Side, topTurn?: TopTurnChoice): PromptRead {
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
      // Lit while the shot is set up (owner, November 10): the same rule that decides a cold shot, so the light
      // and what happens on the mat always agree. Dark in range means a cold shot.
      const setUp = inRange && bout.shotSetUp(me);
      // The tie decides the attack: underhook gives knee pick and throw-by; the collar
      // tie gives the snap, and the ankle pick while he reacts to it or leans in.
      const tied = you.hand >= 0.62;
      const underhook = tied && you.tie === 'underhook';
      const bodyLock = tied && you.tie === 'bodyLock';
      const hisHooks = them.hand >= 0.62 && (them.tie === 'underhook' || them.tie === 'bodyLock') && dist <= BOUT.tieRange + 0.15;
      const snapOn = tied && !underhook && !bodyLock;
      const snapHot = snapOn && (them.lean > 0.15 || them.level > 0.55);
      const pickOn = tied && dist <= BOUT.tieRange + 0.15 && (underhook || (them.snapped ?? 0) > 0 || them.lean > 0.1 || them.act === 'stagger' || them.act === 'reach');
      // His bad shot left him off balance, or my blocked shot can be chained: the reshot.
      const reshot = inRange && ((them.reshot ?? 0) > 0 && them.act === 'stagger' || (you.chain ?? 0) > 0 && them.act === 'sprawlRecover');
      const shootLabel = reshot ? 'Reshot' : pickOn ? (underhook ? 'Knee pick' : 'Ankle pick') : snapOn && inRange && dist <= BOUT.tieRange + 0.15 ? 'High crotch' : inRange ? 'Shoot' : 'Fake';
      // He bit on the tap: go now. He is tapping me: answer it.
      const bit = (them.opened ?? 0) > 0 && inRange;
      const tapped = them.act === 'reach' && dist <= BOUT.tieRange + 0.2;
      return {
        position: 'Neutral',
        prompts: {
          shoot: P(shootLabel, inRange && you.stamina <= BOUT.shotStamina ? 'off' : reshot || bit || pickOn && (them.snapped ?? 0) > 0 || setUp ? 'hot' : 'idle',
            reshot ? 'He is off balance — go!' : bit ? 'He bit — go!' : you.hand >= 0.62 && dist <= BOUT.tieRange + 0.15 || you.hand >= 0.35 && dist <= 1.05 ? 'Lower: Fireman’s carry' : dist >= 1.2 ? 'Lower: Low single' : undefined),
          fight: tapped ? P(you.hand >= 0.3 ? 'Tie the wrist' : 'Swat', 'hot', 'Sideways: circle off')
            : P(bodyLock ? 'Lateral drop' : underhook ? 'Throw-by' : hisHooks ? 'Pummel' : snapOn ? 'Snap down' : 'Hand fight', bodyLock || snapHot ? 'hot' : dist > BOUT.tieRange + 0.2 && !(dist < 1.4) ? 'off' : 'idle',
            bodyLock ? undefined
              : underhook ? 'Lower: pummel for a body lock'
              : hisHooks ? 'Sideways: Headlock (risky)'
              : snapOn ? 'Sideways: Duck under · Back: Foot sweep'
              : them.hand >= 0.62 && them.tie !== 'underhook' ? 'Sideways: Duck under'
              : you.hand >= 0.35 ? 'Sideways: Slide-by'
              : dist > 1.05 && dist < 1.4 ? 'Sideways: Super duck' : undefined),
          sprawl: P('Sprawl', 'idle'),
        },
        meters: [{ label: bodyLock ? 'Body lock' : underhook ? 'Underhook' : tied ? 'Collar tie' : 'Hand fight', value: 0.5 + (you.hand - them.hand) * 0.5, tone: 'you', mark: 0.81 }],
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
      const legCounter = legCounterFor(pos);
      const counterAvailable = pos.shot === 'single' && pos.t >= 4.5 && pos.progress < 0.7 && (pos.lifted ?? 0) < 0.3;
      return {
        position: attacking ? 'In on the legs' : 'Defending the shot',
        prompts: attacking
          ? {
              shoot: P('Drive through', 'hold', pos.shot === 'double' ? 'Lower: Finish double' : pos.shot === 'lowSingle' ? undefined : 'Sideways: Trip · Lower: Switch to double'),
              fight: (pos.counterGrip ?? 0) > 0 ? P('Clear capture', 'mash') : pos.shot === 'single' || pos.shot === 'highCrotch' ? P('Lift leg', 'hold') : P('—', 'off'),
              sprawl: P('—', 'off'),
            }
          : {
              // The counter the position allows: crackdown early, sit-through deep on a low leg, scramble roll late.
              shoot: legCounter && (pos.counterCool ?? 0) <= 0 ? P(LEG_COUNTER_LABELS[legCounter], legCounter === 'sitThrough' ? 'hot' : 'idle') : P('—', 'off'),
              fight: P(counterAvailable ? 'Set spladle' : pos.shot !== 'double' ? 'Whizzer' : 'Down block', 'mash'),
              sprawl: P('Crossface', 'hold', 'He crossfaces on his own · hold for more'),
            },
        // Finishes come from the stick and Lower now; no separate finish buttons.
        legActions: [],
        meters: [
          { label: {single:'Single leg',highCrotch:'High crotch',double:'Double leg',lowSingle:'Low single'}[pos.shot], value: pos.progress, tone: attacking ? 'you' : 'them' },
          ...((pos.counterGrip ?? 0) > 0 ? [{label:'Spladle setup',value:pos.counterGrip!,tone:attacking?'them' as const:'you' as const}] : []),
          ...((pos.lifted ?? 0) > 0 ? [{ label: 'Leg lift', value: pos.lifted!, tone: attacking ? 'you' as const : 'them' as const }] : []),
        ],
      };
    }
    case 'fhl': {
      const top = pos.A === me;
      return {
        position: top ? 'Front headlock' : 'Head trapped',
        prompts: top
          ? {
              // The position picks the finish: flat he is spun behind (or Lower for the cement mixer), half way
              // up the chin whip; Sprawl shucks him by while he drives in.
              shoot: pos.recover >= 0.5
                ? P('Chin whip', pos.recover < 0.8 ? 'hot' : 'idle')
                : P('Spin behind', 'hot', pos.recover < 0.4 ? 'Lower: Cement mixer' : undefined),
              fight: P('Snap him down', 'idle'),
              sprawl: P('Shuck', (pos.drive ?? 0) > 0.45 ? 'hot' : 'idle'),
            }
          : { shoot: P('—', 'off'), fight: P('Clear head', 'mash'), sprawl: P('Clear head', 'mash') },
        meters: [{ label: 'Head clear', value: pos.recover, tone: top ? 'them' : 'you' }],
      };
    }
    case 'mat': {
      const top = pos.A === me;
      const label: PositionLabel = top ? 'Top' : 'Bottom';
      const legMeters: Meter[] = [...((pos.legRide ?? 0) > 0 ? [{label:(pos.legRide ?? 0) >= 0.8 ? 'Leg ride secured' : 'Opening the pocket',value:pos.legRide!,tone:top ? 'you' as const : 'them' as const}] : []), ...((pos.pockets ?? 0) > 0.3 ? [{label:'Pockets closed',value:pos.pockets!,tone:top ? 'them' as const : 'you' as const}] : []), ...((pos.legCaught ?? 0) > 0 ? [{label:'Clearing the leg',value:Math.min(1,pos.legCaught!/LEG_CLEAR_THRESHOLD),tone:top ? 'them' as const : 'you' as const}] : [])];
      const legsIn = (pos.legRide ?? 0) > 0;
      if (pos.sub === 'exposed' || pos.sub === 'spladle') {
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
            ? { shoot: P('Trip', 'hot'), fight: P('Crotch lift', 'hot'), sprawl: P('Mat return', 'hot') }
            : { shoot: P('Turn out', pos.escape >= BOUT.turnOut ? 'hot' : 'idle'), fight: P('Hand control', 'mash', 'Lower: Standing switch'), sprawl: P('—', 'off') },
          meters: [{ label: 'Escape', value: pos.escape, tone: top ? 'them' : 'you', mark: BOUT.turnOut }],
        };
      }
      if (pos.sub === 'flat') {
        const preferred=bout.wrestlers[me].motion?.preferredTurn;
        const selected=topTurn?.style ?? (isArmBar(preferred)?preferred:undefined);
        const own=flatTurnFor(`${bout.wrestlers[me].firstName} ${bout.wrestlers[me].lastName}`,preferred);
        const turnLabel=selected ? (isArmBar(selected) ? ARM_BAR_LABELS[selected] : CRADLE_LABELS[selected])
          : (pos.legRide ?? 0) >= 0.8 ? 'Turk' : own==='crossfaceCradle' ? 'Crossface cradle' : own==='cradle' ? 'Cradle' : 'Half nelson';
        return {
          position: label,
          prompts: top
            ? { shoot: P(turnLabel, pos.control > 0.3 ? 'hot' : 'idle'), fight: P('Pressure', 'idle'), sprawl: P('Ride tight', 'idle', 'Lower: tap Cut · hold Legs in') }
            : { shoot: P('Push up', 'mash'), fight: P('Push up', 'mash'), sprawl: P('Push up', 'mash', legsIn ? 'Closes pockets · Lower: Catch leg' : undefined) },
          meters: [{ label: 'Base', value: Math.min(1, pos.base / 0.68), tone: top ? 'them' : 'you' }, ...legMeters],
        };
      }
      // Ride.
      return {
        position: label,
        prompts: top
          ? {
              shoot: (pos.legRide ?? 0) >= 0.8 && pos.base < BOUT.turkBase ? P('Turk', 'hot') : P(pos.base < 0.35 ? 'Tilt him' : 'Turn', pos.base < 0.35 ? 'hot' : 'off'),
              fight: P('Break down', 'idle'),
              sprawl: P('Ride tight', 'idle', 'Lower: tap Cut · hold Legs in'),
            }
          : {
              shoot: P('Stand up', pos.base > 0.4 ? 'idle' : 'off', 'Sit out + Lower: Granby roll'),
              fight: P('Switch', pos.commit > 0 ? 'hot' : 'idle'),
              sprawl: P('Base up', pos.base < 0.5 ? 'hot' : 'idle', legsIn ? 'Closes pockets · Lower: Catch leg' : undefined),
            },
        meters: [{ label: 'Base', value: pos.base, tone: top ? 'them' : 'you', mark: top ? 0.35 : 0.4 }, ...legMeters],
      };
    }
    case 'move': {
      // Being returned to the mat: turn in the moment you land (mat return depth).
      if (pos.A !== me && bout.returnWindow()) return {position: 'Bottom', prompts:{shoot:P('Turn in','hot','As you land'),fight:P('—','off'),sprawl:P('—','off')},meters:[]};
      const award = MOVES[pos.id].award;
      const live = !pos.awarded && award && ['takedown','reversal','escape'].includes(award.kind);
      const defending = live && (award!.to === 'A' ? pos.A !== me : pos.A === me);
      return {position: live ? 'Scramble' : '—', prompts:{shoot:P('—','off'),fight:defending ? P('Scramble','hot') : P('—','off'),sprawl:P('—','off')},meters:[]};
    }
    default:
      return {
        position: '—',
        prompts: { shoot: P('—', 'off'), fight: P('—', 'off'), sprawl: P('—', 'off') },
        meters: [],
      };
  }
}
