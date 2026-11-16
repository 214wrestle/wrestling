import { BOTTOM_CHAIN, BOUT, finishRead, HANDS, LIFT_DOUBLE } from '../sim/bout';
import type { LegAction } from '../sim/types';
import type { MatchSim } from '../sim/MatchSim';
import type { Command, Side } from '../sim/types';

/**
 * The moves for the position you are in (owner, November 15: "situational options scaled down depending on
 * position (ex. single leg: trips, switch to double, dump)", and "the pinning combinations are really hard to get
 * to on the mobile control. Try providing options by the position they are in").
 *
 * Each position offers at most four named moves, always in the same slots: a move that is not on right now dims,
 * it never disappears or reorders while the position lasts (owner: "make sure they don't move mid-situation").
 * Related positions keep a move in the same slot (Switch to double on a single sits where the double's finish
 * does), so a finger still holding it after the switch is still on it.
 *
 * The three action buttons keep doing what they did; these are the named moves that used to hide behind the
 * stick, Lower or the top attack picker. On a phone they are buttons above the action buttons; on a keyboard they
 * are 1 to 4.
 */

export const OPTION_SLOTS = 4;

export type OptionId =
  // In on the legs.
  | 'trip' | 'dump' | 'double' | 'driveBack' | 'liftDouble' | 'doubleTrip' | 'comeUp'
  // On the legs, defending.
  | 'funk'
  // Front headlock, on top.
  | 'goBehind' | 'chinWhip' | 'cementMixer' | 'shuck'
  // Head trapped.
  | 'peekOut'
  // Top, while he Granby rolls: roll through with him.
  | 'follow'
  // Top: riding and turning.
  | 'tilt' | 'cradle' | 'turk' | 'legsIn' | 'halfNelson' | 'armBar' | 'barHalf' | 'crossfaceCradle'
  // Bottom.
  | 'sitOut' | 'granby' | 'switch' | 'hipHeist' | 'standingSwitch' | 'peterson';

export type OptionInput = 'Tap' | 'Hold';

export interface SituationOption {
  id: OptionId;
  label: string;
  /** Hot: the position gives it to you now. Off: not on yet (it still works, it just rarely does). */
  state: 'idle' | 'hot' | 'off';
  input: OptionInput;
}

export interface SituationRead {
  /** Which position these belong to: the set and its slots stay the same while this does. */
  key: string;
  /** Always OPTION_SLOTS long; null is an empty slot. */
  options: (SituationOption | null)[];
}

const NONE: SituationRead = { key: 'none', options: [null, null, null, null] };

const O = (id: OptionId, label: string, state: SituationOption['state'], input: OptionInput = 'Tap'): SituationOption => ({ id, label, state, input });
const slots = (key: string, ...options: (SituationOption | null)[]): SituationRead =>
  ({ key, options: Array.from({ length: OPTION_SLOTS }, (_, i) => options[i] ?? null) });

/** The named moves for the human's position right now. */
export function readOptions(sim: MatchSim, me: Side): SituationRead {
  if (sim.phase !== 'wrestling') return NONE;
  const pos = sim.bout.position;
  switch (pos.kind) {
    case 'legs': {
      if (pos.A !== me) return slots('legs:defend');
      // Lit exactly when the sim's read says his reaction gives you that finish (finishRead), like the shoot light.
      const lit = (f: LegAction): SituationOption['state'] => finishRead(pos, f) === 'hot' ? 'hot' : 'idle';
      if (pos.shot === 'double') {
        return slots('legs:double',
          O('liftDouble', 'Lift', sim.bout.athletes[me].stamina <= LIFT_DOUBLE.gas ? 'off' : lit('liftDouble'), 'Hold'),
          O('doubleTrip', 'Trip', lit('doubleTrip'), 'Hold'),
          // Same slot as Switch to double on the single, so a finger switching grips stays on its finish.
          O('double', 'Drive through', 'idle', 'Hold'));
      }
      if (pos.shot === 'lowSingle') {
        return slots('legs:lowSingle',
          O('comeUp', 'Come up', lit('comeUp'), 'Hold'),
          null,
          O('double', 'Switch to double', lit('double'), 'Hold'));
      }
      return slots(`legs:${pos.shot}`,
        O('trip', 'Trip', lit('trip'), 'Hold'),
        O('dump', 'Dump', lit('dump'), 'Hold'),
        O('double', 'Switch to double', lit('double'), 'Hold'),
        O('driveBack', 'Drive back', lit('drive'), 'Hold'));
    }
    case 'fhl': {
      // Flattened under the sprawl: peek out and turn back in (SCRAMBLE.peek), best while he recovers from a miss.
      if (pos.A !== me) return slots('fhl:bottom', O('peekOut', 'Peek out', pos.cooldown > 0 ? 'hot' : 'idle'));
      const wait = pos.cooldown > 0;
      const st = (hot: boolean): SituationOption['state'] => wait ? 'off' : hot ? 'hot' : 'idle';
      return slots('fhl:top',
        O('goBehind', 'Go behind', st(pos.recover < 0.4)),
        O('chinWhip', 'Chin whip', st(pos.recover >= 0.5 && pos.recover < 0.8)),
        O('cementMixer', 'Cement mixer', pos.recover >= 0.5 ? 'off' : st(pos.recover < 0.4)),
        O('shuck', 'Shuck', st((pos.drive ?? 0) > 0.45)));
    }
    case 'mat': {
      const top = pos.A === me;
      if (pos.sub === 'exposed' || pos.sub === 'spladle') return slots(top ? 'mat:pin' : 'mat:back');
      if (top) {
        const legsIn = (pos.legRide ?? 0) >= 0.8;
        if (pos.sub === 'ride') {
          const broken = pos.base < 0.35 && pos.turnCool <= 0;
          return slots('top:ride',
            O('tilt', 'Tilt', broken ? 'hot' : 'off'),
            O('cradle', 'Cradle', broken ? 'hot' : 'off'),
            O('turk', 'Turk', legsIn && pos.base < BOUT.turkBase && pos.turnCool <= 0 ? 'hot' : 'off'),
            O('legsIn', 'Legs in', legsIn ? 'off' : 'idle', 'Hold'));
        }
        if (pos.sub === 'flat') {
          const ready: SituationOption['state'] = pos.turnCool > 0 ? 'off' : pos.control > 0.3 ? 'hot' : 'idle';
          return slots('top:flat',
            O('halfNelson', 'Half nelson', ready),
            O('armBar', 'Arm bar', ready),
            O('barHalf', 'Bar + half', ready),
            O('crossfaceCradle', 'Crossface cradle', ready));
        }
        return slots('top:standing');
      }
      if (pos.sub === 'ride') {
        const based = pos.base > 0.3;
        const chain = sim.bout.bottomChain[me];
        const afterGranby = chain.last === 'granby' && chain.t >= 0 && chain.t < BOTTOM_CHAIN.window;
        const set = (pos.hands ?? 0) > 0.5 || (pos.back ?? 0) > 0.5 || (pos.whistle ?? 0) > 0 || (pos.pod ?? 0) > 0.3 || (pos.hips ?? 0) > 0.5;
        return slots('bottom:ride',
          O('sitOut', 'Sit out', !based ? 'off' : set ? 'hot' : 'idle'),
          O('granby', 'Granby', !based ? 'off' : pos.commit > 0.3 ? 'hot' : 'idle'),
          O('switch', 'Switch', pos.base <= 0.25 ? 'off' : pos.commit >= HANDS.switchWindow ? 'hot' : 'idle'),
          // Off his weight out front, or right off a Granby he stopped (SCRAMBLE.peterson).
          O('peterson', 'Peterson roll', !based ? 'off' : pos.commit > 0.3 || afterGranby ? 'hot' : 'idle'));
      }
      if (pos.sub === 'flat') return slots('bottom:flat', O('hipHeist', 'Hip heist', 'idle'));
      return slots('bottom:standing', null, O('standingSwitch', 'Standing switch', 'idle'));
    }
    case 'move':
      // He Granby rolls out from under you: roll through with him (SCRAMBLE), until the escape is in.
      if (pos.id === 'granbyRoll' && pos.A === me && !pos.awarded) return slots('move:granby', O('follow', 'Follow', 'hot'));
      return NONE;
    default:
      return NONE;
  }
}

/** What an option does while it is held: the command fields it sets. */
export function optionCommand(id: OptionId): Partial<Command> {
  switch (id) {
    case 'trip': return { legAction: 'trip' };
    case 'dump': return { legAction: 'dump' };
    case 'double': return { legAction: 'double' };
    case 'driveBack': return { legAction: 'driveBack' };
    case 'liftDouble': return { legAction: 'liftDouble' };
    case 'doubleTrip': return { legAction: 'doubleTrip' };
    case 'comeUp': return { legAction: 'comeUp' };
    case 'funk': return { shoot: true };
    case 'goBehind': return { shoot: true, fhlFinish: 'goBehind' };
    case 'chinWhip': return { shoot: true, fhlFinish: 'chinWhip' };
    case 'cementMixer': return { shoot: true, fhlFinish: 'cementMixer' };
    case 'shuck': return { sprawl: true };
    case 'peekOut': return { peekOut: true };
    case 'follow': return { scramble: true };
    case 'tilt': return { shoot: true, topTurn: { style: 'tilt', mirror: false } };
    case 'cradle': return { shoot: true, topTurn: { style: 'cradle', mirror: false } };
    case 'turk': return { shoot: true, topTurn: { style: 'turk', mirror: false } };
    case 'legsIn': return { legRide: true };
    case 'halfNelson': return { shoot: true, topTurn: { style: 'halfNelson', mirror: false } };
    case 'armBar': return { shoot: true, topTurn: { style: 'armBar', mirror: false } };
    case 'barHalf': return { shoot: true, topTurn: { style: 'barHalf', mirror: false } };
    case 'crossfaceCradle': return { shoot: true, topTurn: { style: 'crossfaceCradle', mirror: false } };
    case 'sitOut': return { sitOut: true };
    case 'granby': return { sitOut: true, level: true };
    case 'switch': return { fight: true, switchTry: true };
    case 'hipHeist': return { sitOut: true };
    case 'standingSwitch': return { fight: true, level: true };
    case 'peterson': return { peterson: true };
  }
}

/** The option the human is asking for: a touch option by id, or a keyboard slot (1-4) read from the position now. */
export function resolveOption(read: SituationRead, id: string | undefined, slot: number | undefined): OptionId | undefined {
  if (id) return read.options.some(o => o?.id === id) ? id as OptionId : undefined;
  if (slot && slot >= 1 && slot <= OPTION_SLOTS) return read.options[slot - 1]?.id;
  return undefined;
}
