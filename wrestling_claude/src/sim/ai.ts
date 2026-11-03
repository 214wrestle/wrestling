import {isArmBar} from './armBars';
import { isScrambleSpecialist, heavyweightActivity, isFootSweepSpecialist, lateAttackUrgency, GABLE_PRESSURE_NAMES } from './athleteProfiles';
import type { Bout } from './bout';
import { BOUT, Rng } from './bout';
import { otherSide } from './types';
import type { Command, Side } from './types';

export type Difficulty = 'practice' | 'walk-on' | 'starter' | 'all-american';

interface Profile {
  effort: number;
  /** Seconds before it reacts to a committed shot. */
  reaction: number;
  /** Chance it reacts to a shot at all. */
  sprawlSkill: number;
  /** Shots per second when a good look is on. */
  aggression: number;
  /** How picky it is about shot quality (0 = shoots anything). */
  patience: number;
  /** Hand-fight presses per second in range. */
  handfight: number;
  /** Presses per second in a scramble or a struggle. */
  mash: number;
  /** Reads the top man's commitment for a switch. */
  switchRead: number;
  /** Bites on fakes. */
  gullible: number;
}

const PROFILES: Record<Difficulty, Profile> = {
  practice: { effort: 0, reaction: 2, sprawlSkill: 0, aggression: 0, patience: 0, handfight: 0, mash: 0.2, switchRead: 0, gullible: 1 },
  'walk-on': { effort: .25, reaction: .7, sprawlSkill: .12, aggression: .15, patience: .1, handfight: .3, mash: 1.2, switchRead: .03, gullible: .8 },
  starter: { effort: .4, reaction: .48, sprawlSkill: .25, aggression: .3, patience: .2, handfight: .55, mash: 2, switchRead: .1, gullible: .65 },
  'all-american': { effort: .6, reaction: .32, sprawlSkill: .4, aggression: .45, patience: .35, handfight: .8, mash: 2.8, switchRead: .2, gullible: .5 },
};

const empty = (): Command => ({ moveX: 0, moveZ: 0, shoot: false, fight: false, sprawl: false, level: false });

/**
 * The opponent. It reads what a player can see — positions, stances, who is
 * reaching — reacts on a human delay and presses the same three buttons.
 * Raising the difficulty makes it sharper and more patient, never clairvoyant.
 */
export class WrestlerAI {
  private p: Profile;
  private rng: Rng;
  private sprawlIn = -1;
  private switchIn = -1;
  private lastCommit = 0;
  private lastPos = '';
  private circleDir = 1;
  private circleT = 0;
  private decideT = 0;
  private mashT = 0;
  private held = { shoot: false, fight: false, sprawl: false };
  private wantDist = 1.05;
  private pushT = 0;
  private levelT = 0;
  private lowLevel = false;
  private effortTime = 0;
  private legDefense: 'sprawl' | 'fight' | null = null;

  constructor(
    private side: Side,
    difficulty: Difficulty = 'starter',
    seed = 1701 + side,
  ) {
    this.p = PROFILES[difficulty];
    this.rng = new Rng(seed);
  }

  setDifficulty(d: Difficulty): void {
    this.p = PROFILES[d];
  }

  /** Called when the bout tells this side a shot is coming. */
  onTell(what: 'shot' | 'snap' | 'switch' | 'standup'): void {
    if (what === 'shot' && this.rng.next() < this.p.sprawlSkill) {
      this.sprawlIn = this.p.reaction * (0.75 + this.rng.next() * 0.55);
    }
  }

  update(dt: number, bout: Bout, wrestling: boolean, context?: {timeLeft:number; finalPeriod:boolean; deficit:number}): Command {
    const cmd = empty();
    if (!wrestling) {
      this.held = { shoot: false, fight: false, sprawl: false };
      return cmd;
    }
    if(this.p.effort===0)return cmd; // Cooperative practice partner: no attacks or counters.
    this.effortTime+=dt;
    const pos = bout.position;
    const key = pos.kind + (pos.kind === 'mat' ? pos.sub : '');
    if (key !== this.lastPos) {
      this.lastPos = key;
      this.legDefense = null;
      // A human beat to read the new position before acting on it.
      this.decideT = this.p.reaction * 1.6 + this.rng.next() * 0.3;
      this.mashT = this.p.reaction;
    }
    this.decideT -= dt;
    this.mashT -= dt;
    this.circleT -= dt;
    this.pushT -= dt;
    if (this.sprawlIn >= 0) {
      this.sprawlIn -= dt;
      if (this.sprawlIn < 0) {
        cmd.sprawl = true;
        this.sprawlIn = -1;
      }
    }
    if (this.switchIn >= 0) {
      this.switchIn -= dt;
      if (this.switchIn < 0) {
        this.switchIn = -1;
        // Only if the window is still open when the read turns into a move.
        if (pos.kind === 'mat' && pos.sub === 'ride' && pos.A !== this.side && pos.commit > 0) cmd.fight = true;
      }
    }

    switch (pos.kind) {
      case 'neutral':
        this.neutral(dt, bout, cmd, context);
        break;
      case 'shot':
        break;
      case 'legs':
        this.legs(bout, cmd, pos.A === this.side);
        break;
      case 'fhl':
        this.fhl(bout, cmd, pos.A === this.side, pos.recover);
        break;
      case 'mat':
        this.mat(bout, cmd, pos.A === this.side, context);
        break;
      default:
        break;
    }
    if (pos.kind === 'mat' && pos.A !== this.side && (pos.sub === 'ride' || pos.sub === 'flat') && (pos.legRide ?? 0) > 0.05) {
      cmd.closePockets = (pos.legRide ?? 0) < 0.8;
      cmd.catchLeg = (pos.legRide ?? 0) > 0.4;
    }
    const name = `${bout.wrestlers[this.side].firstName} ${bout.wrestlers[this.side].lastName}`;
    if ((pos.kind === 'legs' || pos.kind === 'fhl' || pos.kind === 'mat') && isScrambleSpecialist(name) && this.rng.chance(dt * 0.3)) cmd.scramble = true;
    return this.edges(cmd);
  }

  /** Turn intents into clean press/release edges the sim can count. */
  private edges(cmd: Command): Command {
    const out = { ...cmd };
    for (const k of ['shoot', 'fight', 'sprawl'] as const) {
      if (cmd[k] && this.held[k] && !cmd.sustainedEffort) out[k] = false;
      this.held[k] = cmd[k] && !this.held[k];
    }
    return out;
  }

  private mashBeat(): boolean {
    if (this.mashT > 0) return false;
    this.mashT = (1 / this.p.mash) * (0.7 + this.rng.next() * 0.6);
    return true;
  }

  /* -------------------------------------------------------------- neutral */

  private neutral(dt: number, bout: Bout, cmd: Command, context?: {timeLeft:number; finalPeriod:boolean; deficit:number}): void {
    const me = bout.athletes[this.side];
    const them = bout.athletes[otherSide(this.side)];
    const dx = them.pos.x - me.pos.x;
    const dz = them.pos.z - me.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist;
    const nz = dz / dist;

    if (this.circleT <= 0) {
      this.circleT = 0.7 + this.rng.next() * 1.6;
      this.circleDir = this.rng.next() < 0.5 ? -1 : 1;
      const tired = me.stamina < 0.3;
      this.wantDist = tired ? 1.5 : 0.85 + this.rng.next() * 0.4;
    }
    // Stay off the edge.
    const r = Math.hypot(me.pos.x, me.pos.z);
    let inward = 0;
    if (r > 3.6) inward = (r - 3.6) * 1.5;

    let fwd = Math.max(-1, Math.min(1, (dist - this.wantDist) * 2.2));
    // In a tie-up: lean on him, or pull back to bait the snap.
    if (dist < 0.85 && this.pushT <= 0) {
      this.pushT = 0.8 + this.rng.next() * 1.2;
    }
    if (dist < 0.85) fwd = this.pushT > 0.5 ? 0.6 : -0.2;
    const style = bout.wrestlers[this.side].motion;
    const activity = heavyweightActivity(bout.wrestlers[this.side]);
    const urgency=lateAttackUrgency(`${bout.wrestlers[this.side].firstName} ${bout.wrestlers[this.side].lastName}`,context);
    fwd *= (style?.pressure ?? 1) * activity.pressure;
    if(urgency>1) fwd=Math.max(fwd,0.45);
    const lat = this.circleDir * 0.6 * (style?.circle ?? 1);
    cmd.moveX = nx * fwd + nz * lat - (me.pos.x / (r || 1)) * inward;
    cmd.moveZ = nz * fwd - nx * lat - (me.pos.z / (r || 1)) * inward;
    // Sink the level when he is close and threatening; decided, not flickered.
    this.levelT -= dt;
    if (this.levelT <= 0) {
      this.levelT = 0.8 + this.rng.next() * 1.2;
      this.lowLevel = dist < 1.3 && this.rng.next() < 0.5 + this.p.patience * 0.3;
    }
    cmd.level = this.lowLevel && dist < 1.4;

    // Bite on a fake now and then.
    if (them.act === 'fake' && them.actT < 0.05 && this.rng.next() < this.p.gullible) {
      this.sprawlIn = this.p.reaction * 0.8;
    }

    if (me.act !== 'stance' || me.cooldown > 0 || this.decideT > 0) return;
    this.decideT = (1.4 + this.rng.next() * 1.4) / ((style?.tempo ?? 1)*urgency);

    // A look at the legs: how good would a shot be right now?
    const opening =
      Math.max(0, them.lean) * 0.8 +
      Math.max(0, them.level - 0.5) * 0.8 +
      (them.act === 'reach' || them.act === 'stagger' || them.act === 'sprawlRecover' || them.act === 'snap' ? 0.6 : 0) +
      (me.hand - them.hand) * 0.3 +
      (me.sinceFake < 1 ? 0.25 : 0);
    const inRange = dist > 0.62 && dist < 1.25;
    const tired = me.stamina < 0.22;
    if (!tired && context?.finalPeriod && context.timeLeft <= 20 && context.deficit > 0 && dist < 1.4 && this.rng.chance(0.08)) {
      cmd.technique = 'superDuck'; return;
    }
    if (!tired && dist < 1.05 && me.hand >= 0.35 && this.rng.chance(0.025)) {
      const r=this.rng.next();
      cmd.technique=isFootSweepSpecialist(bout.wrestlers[this.side]) && r<0.7 ? 'footSweep' : r<0.45?'duckUnder':r<0.85?'slideBy':'firemansCarry'; return;
    }

    if (inRange && !tired && opening > 0.2 + this.p.patience * 0.8 && this.rng.next() < this.p.aggression * 0.22 * (style?.attackRate ?? 1) * activity.attack * urgency) {
      cmd.shoot = true;
      return;
    }
    if (inRange && !tired && this.rng.next() < this.p.aggression * 0.04 * (1 - this.p.patience) * (style?.attackRate ?? 1) * activity.attack * urgency) {
      cmd.shoot = true;
      return;
    }
    if (me.hand >= 0.62 && (them.lean > 0.15 || them.level > 0.55) && this.rng.next() < 0.55) {
      cmd.fight = true;
      return;
    }
    if (dist < BOUT.tieRange + 0.1 && this.rng.next() < this.p.handfight * 0.25 * (style?.handActivity ?? 1)) {
      cmd.fight = true;
      return;
    }
    if (dist > 1.3 && dist < 1.7 && this.rng.next() < 0.06) cmd.shoot = true; // fake
  }

  /* -------------------------------------------------------------- legs */

  private legs(bout: Bout, cmd: Command, attacking: boolean): void {
    const me = bout.athletes[this.side];
    const them = bout.athletes[otherSide(this.side)];
    if (attacking) {
      cmd.shoot = true;
      // Use the human hold cadence instead of continuous drive with no
      // repeated finishing effort. Both sides pay the shared effort costs.
      cmd.sustainedEffort = true;
      cmd.moveX = them.pos.x - me.pos.x;
      cmd.moveZ = them.pos.z - me.pos.z;
      return;
    }
    // Difficulty gives the defender breathing windows, not the committed
    // attacker. Pausing the entire AI also froze its decision timers.
    if (this.effortTime % 2.5 > 2.5 * this.p.effort) return;
    if (this.decideT <= 0) {
      // Keep pressure through a grip exchange; changing buttons every mash
      // beat creates extra press edges on top of the held effort clock.
      this.legDefense = this.rng.next() < 0.75 ? 'sprawl' : 'fight';
      this.decideT = 0.7 + this.rng.next() * 0.6;
    }
    if (this.legDefense) {
      cmd[this.legDefense] = true;
      cmd.sustainedEffort = true;
    }
  }

  /* ------------------------------------------------------- front headlock */

  private fhl(_bout: Bout, cmd: Command, top: boolean, recover: number): void {
    if (top) {
      if (this.decideT <= 0) {
        this.decideT = 0.9 + this.rng.next() * 0.8;
        if (recover > 0.55 || this.rng.next() < 0.35) cmd.fight = true;
        else cmd.shoot = true;
      }
      return;
    }
    if (this.mashBeat()) {
      if (this.rng.next() < 0.6) cmd.fight = true;
      else cmd.sprawl = true;
    }
  }

  /* ------------------------------------------------------------------ mat */

  private mat(bout: Bout, cmd: Command, top: boolean, context?:{timeLeft:number;finalPeriod:boolean;deficit:number}): void {
    const pos = bout.position;
    if (pos.kind !== 'mat') return;
    const me = bout.athletes[this.side];
    if (top) {
      // Drive gently into him while riding.
      const fx = Math.sin(pos.frame.yaw);
      const fz = Math.cos(pos.frame.yaw);
      if (pos.sub === 'ride' && this.rng.next() < 0.6) {
        cmd.moveX = fx * 0.4;
        cmd.moveZ = fz * 0.4;
      }
      if ((pos.sub === 'exposed' || pos.sub === 'spladle')) {
        cmd.shoot = true;
        this.held.shoot = false;
        if (this.mashBeat()) cmd.fight = true;
        return;
      }
      if (this.decideT > 0) return;
      const style = bout.wrestlers[this.side].motion;
      // A rider works patiently; the chop is a choice, not a reflex.
      this.decideT = (pos.sub === 'ride' ? 0.55 + this.rng.next() * 0.7 : 0.3 + this.rng.next() * 0.45) * (style?.topPatience ?? 1);
      if (pos.sub === 'standing') {
        // Give bottom time to peel hands before another return attempt.
        this.decideT = (0.9 + this.rng.next() * 0.6) / this.p.effort;
        cmd.sprawl = pos.escape > 0.25 || this.rng.next() < 0.5;
        if (!cmd.sprawl) cmd.fight = true;
        return;
      }
      if (pos.sub === 'flat') {
        if (pos.control < 0.35) cmd.sprawl = true;
        else cmd.shoot = this.rng.next() < Math.min(0.85, 0.6 * (style?.turnPreference ?? 1));
        if (!cmd.shoot && !cmd.sprawl) cmd.fight = true;
        return;
      }
      // Protect established control through the whistle rather than force a risky turn.
      const rider=bout.wrestlers[this.side];
      if(context && context.timeLeft<=12 && GABLE_PRESSURE_NAMES.has(`${rider.firstName} ${rider.lastName}`) && pos.sub==='ride') {cmd.sprawl=true;return;}
      // Ride: keep him tight, break him down, then turn him. A chop comes with a
      // quick second one, before he can rebuild the base the first one cost him.
      // A failed turn leaves a short recovery window. Retain the ride and
      // continue breaking the base instead of forcing a blocked repeat tilt
      // that the simulation penalizes by releasing control.
      if (pos.base < 0.32 && pos.turnCool <= 0) {
        // Bar specialists finish the breakdown before committing their arm control.
        if(isArmBar(style?.preferredTurn))cmd.fight=true;else cmd.shoot=true;
      }
      else if (pos.base < 0.32 && pos.turnCool > 0) cmd.fight = true;
      else if (me.stamina < 0.2 || pos.control < 0.45) cmd.sprawl = true;
      else if (this.rng.next() < 0.5) {
        cmd.fight = true;
        if (pos.base < 0.75) this.decideT = 0.22 + this.rng.next() * 0.12;
      } else cmd.sprawl = true;
      return;
    }

    // Bottom.
    if ((pos.sub === 'exposed' || pos.sub === 'spladle') || pos.sub === 'flat') {
      if (this.mashBeat()) cmd.sprawl = true;
      return;
    }
    if (pos.sub === 'standing') {
      if (this.mashBeat()) {
        if (pos.escape >= BOUT.turnOut) cmd.shoot = true;
        else cmd.fight = true;
      }
      return;
    }
    // Ride: a chop or a lunge is the switch window. Read it once, on a human
    // delay, rather than fishing for it; otherwise build a base and stand.
    const lunge = pos.commit >= 0.4 && pos.commit > this.lastCommit + 0.2;
    this.lastCommit = pos.commit;
    if (lunge && this.switchIn < 0 && this.rng.next() < this.p.switchRead * 0.18) {
      this.switchIn = this.p.reaction * (0.7 + this.rng.next() * 0.5);
      return;
    }
    if (this.switchIn >= 0 || this.decideT > 0) return;
    this.decideT = 0.35 + this.rng.next() * 0.5;
    // Build the base first; stand when he has loosened up.
    if (pos.base < 0.6) cmd.sprawl = true;
    else if (this.rng.next() < 0.35 + (1 - pos.control) * 0.5) cmd.shoot = true;
    else cmd.sprawl = true;
  }
}
