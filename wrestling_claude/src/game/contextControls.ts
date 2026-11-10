import type { PadState } from '../engine/Input';
import type { Bout } from '../sim/bout';
import type { Command, Side } from '../sim/types';
import { otherSide } from '../sim/types';

/**
 * Simple controls: the stick plus Shoot, Hand fight, Sprawl and Level (and Sit out).
 * The position and the stick choose the move, so no technique needs its own key.
 *
 * On the feet (stick sideways = across him, back = away from him):
 *   Hand fight + sideways  his or your collar tie: duck under · wrist control: slide-by ·
 *                          out of reach with no control: super duck · underhook: throw-by
 *   Hand fight + back      collar tie: foot sweep
 *   Shoot + Level          wrist control or a tie: fireman's carry · from outside: low single
 *   (Shoot from a tie is already a knee or ankle pick, Hand fight a snap or throw-by.)
 * In on the legs:          hold Hand fight to lift the leg · Shoot drives ·
 *                          Shoot + sideways trips · Shoot + Level switches to the double
 * During his scoring move: Hand fight scrambles
 * On top, ride:            tap Level to cut him · hold Level to throw in the legs
 * Bottom, legs threatened: Sprawl also closes the pockets · Level catches the leg
 *
 * A choice is made when the button goes down and kept until it is released, so moving
 * the stick mid-hold never turns one move into another. Dedicated keys still work.
 */
export class ContextControls {
  private latched: { fight?: Partial<Command>; shoot?: Partial<Command> } = {};
  private prev = { fight: false, shoot: false, level: false };
  private levelHeld = 0;

  reset(): void {
    this.latched = {};
    this.prev = { fight: false, shoot: false, level: false };
    this.levelHeld = 0;
  }

  map(dt: number, pad: PadState, move: { x: number; z: number }, bout: Bout, side: Side): Partial<Command> {
    const me = bout.athletes[side];
    const o = bout.athletes[otherSide(side)];
    const dx = o.pos.x - me.pos.x, dz = o.pos.z - me.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const fwd = (move.x * dx + move.z * dz) / dist;
    const lat = (move.x * dz - move.z * dx) / dist;
    const sideways = Math.abs(lat) > 0.5 && Math.abs(lat) > Math.abs(fwd);
    const back = fwd < -0.5 && -fwd > Math.abs(lat);
    const pos = bout.position;
    const out: Partial<Command> = {};

    // Decide on the press, keep it for the hold.
    if (pad.fight && !this.prev.fight) this.latched.fight = this.fightChoice(pos, me, o, dist, sideways, back);
    if (!pad.fight) this.latched.fight = undefined;
    // Leg finishes follow the stick live; everything else is chosen on the press.
    if (pad.shoot && (!this.prev.shoot || pos.kind === 'legs')) this.latched.shoot = this.shootChoice(pos, side, me, dist, sideways, pad.level);
    if (!pad.shoot) this.latched.shoot = undefined;
    if (pad.fight && this.latched.fight) Object.assign(out, this.latched.fight);
    if (pad.shoot && this.latched.shoot) Object.assign(out, this.latched.shoot);

    // Holding Hand fight while in on a single or high crotch lifts the leg.
    if (pos.kind === 'legs' && pos.A === side && (pos.shot === 'single' || pos.shot === 'highCrotch') && pad.fight && !(pos.counterGrip ?? 0) && !out.legAction) {
      out.legAction = 'lift';
      out.fight = false;
    }

    // Top in the ride or flat: tap Level to cut, hold it to throw in the legs.
    // The cut is sent on release of a short tap, so a hold never cuts by accident.
    const legWork = pos.kind === 'mat' && pos.A === side && (pos.sub === 'ride' || pos.sub === 'flat');
    if (legWork && pad.level) {
      this.levelHeld += dt;
      out.level = false;
      if (this.levelHeld >= 0.3) out.legRide = true;
    } else if (legWork) {
      out.level = this.prev.level && this.levelHeld < 0.3;
      this.levelHeld = 0;
    } else this.levelHeld = 0;

    // Bottom with his legs coming in: Sprawl also closes the pockets, Level catches the leg.
    if (pos.kind === 'mat' && pos.A !== side && (pos.legRide ?? 0) > 0) {
      if (pad.sprawl) out.closePockets = true;
      if (pad.level && (pos.legRide ?? 0) > 0.25) out.catchLeg = true;
    }

    this.prev = { fight: pad.fight, shoot: pad.shoot, level: pad.level };
    return out;
  }


  private fightChoice(pos: Bout['position'], me: Bout['athletes'][number], o: Bout['athletes'][number], dist: number, sideways: boolean, back: boolean): Partial<Command> | undefined {
    if (pos.kind === 'move') return { scramble: true };
    if (pos.kind !== 'neutral') return undefined;
    const collar = me.hand >= 0.62 && me.tie !== 'underhook' && me.tie !== 'bodyLock';
    const hisCollar = o.hand >= 0.62 && o.tie !== 'underhook' && o.tie !== 'bodyLock';
    const hisHooks = o.hand >= 0.62 && (o.tie === 'underhook' || o.tie === 'bodyLock');
    // His underhook on you, stepping across: head and arm, hip in, throw (a risky headlock).
    if (sideways && hisHooks && !(me.hand >= 0.62 && me.tie === 'underhook')) return { technique: 'headlock', fight: false };
    if (sideways) {
      if (me.hand >= 0.62 && me.tie === 'underhook') return undefined; // the sim throws him by
      if (collar || hisCollar) return { technique: 'duckUnder', fight: false };
      if (me.hand >= 0.35) return { technique: 'slideBy', fight: false };
      if (dist > 1.05 && dist < 1.4) return { technique: 'superDuck', fight: false };
    }
    if (back && collar) return { technique: 'footSweep', fight: false };
    return undefined;
  }

  private shootChoice(pos: Bout['position'], side: Side, me: Bout['athletes'][number], dist: number, sideways: boolean, level: boolean): Partial<Command> | undefined {
    if (pos.kind === 'neutral' && level) {
      if (me.hand >= 0.62 && dist <= 1.15 || me.hand >= 0.35 && dist <= 1.05) return { technique: 'firemansCarry', shoot: false };
      if (dist >= 1.2) return { lowSingle: true };
      return undefined;
    }
    if (pos.kind === 'legs' && pos.A === side && pos.shot !== 'lowSingle') {
      if (level) return { legAction: 'double' };
      if (sideways && pos.shot !== 'double') return { legAction: 'trip' };
      if ((pos.lifted ?? 0) > 0.7) return { legAction: 'drive' };
    }
    return undefined;
  }
}
