import type { Bout } from './bout';
import { BOUT, Rng } from './bout';
import { otherSide } from './types';
import type { Command, Side } from './types';

export type Difficulty = 'walk-on' | 'starter' | 'all-american';

interface Profile {
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
  'walk-on': { reaction: 0.34, sprawlSkill: 0.45, aggression: 0.35, patience: 0.2, handfight: 0.6, mash: 3.2, switchRead: 0.15, gullible: 0.6 },
  starter: { reaction: 0.2, sprawlSkill: 0.72, aggression: 0.6, patience: 0.42, handfight: 1.1, mash: 5, switchRead: 0.42, gullible: 0.35 },
  'all-american': { reaction: 0.13, sprawlSkill: 0.9, aggression: 0.85, patience: 0.6, handfight: 1.6, mash: 7, switchRead: 0.75, gullible: 0.15 },
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

  update(dt: number, bout: Bout, wrestling: boolean): Command {
    const cmd = empty();
    if (!wrestling) {
      this.held = { shoot: false, fight: false, sprawl: false };
      return cmd;
    }
    const pos = bout.position;
    const key = pos.kind + (pos.kind === 'mat' ? pos.sub : '');
    if (key !== this.lastPos) {
      this.lastPos = key;
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
        this.neutral(bout, cmd);
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
        this.mat(bout, cmd, pos.A === this.side);
        break;
      default:
        break;
    }
    return this.edges(cmd);
  }

  /** Turn intents into clean press/release edges the sim can count. */
  private edges(cmd: Command): Command {
    const out = { ...cmd };
    for (const k of ['shoot', 'fight', 'sprawl'] as const) {
      if (cmd[k] && this.held[k]) out[k] = false;
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

  private neutral(bout: Bout, cmd: Command): void {
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
    const lat = this.circleDir * 0.6;
    cmd.moveX = nx * fwd + nz * lat - (me.pos.x / (r || 1)) * inward;
    cmd.moveZ = nz * fwd - nx * lat - (me.pos.z / (r || 1)) * inward;
    // Sink the level when he is close and threatening; decided, not flickered.
    this.levelT -= 1 / 60;
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
    this.decideT = 1.4 + this.rng.next() * 1.4;

    // A look at the legs: how good would a shot be right now?
    const opening =
      Math.max(0, them.lean) * 0.8 +
      Math.max(0, them.level - 0.5) * 0.8 +
      (them.act === 'reach' || them.act === 'stagger' || them.act === 'sprawlRecover' || them.act === 'snap' ? 0.6 : 0) +
      (me.hand - them.hand) * 0.3 +
      (me.sinceFake < 1 ? 0.25 : 0);
    const inRange = dist > 0.62 && dist < 1.25;
    const tired = me.stamina < 0.22;

    if (inRange && !tired && opening > 0.2 + this.p.patience * 0.8 && this.rng.next() < this.p.aggression * 0.22 * (bout.wrestlers[this.side].motion?.attackRate ?? 1)) {
      cmd.shoot = true;
      return;
    }
    if (inRange && !tired && this.rng.next() < this.p.aggression * 0.04 * (1 - this.p.patience)) {
      cmd.shoot = true;
      return;
    }
    if (me.hand >= 0.62 && (them.lean > 0.15 || them.level > 0.55) && this.rng.next() < 0.55) {
      cmd.fight = true;
      return;
    }
    if (dist < BOUT.tieRange + 0.1 && this.rng.next() < this.p.handfight * 0.25) {
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
      this.held.shoot = false; // holding J drives; keep it pressed
      cmd.moveX = them.pos.x - me.pos.x;
      cmd.moveZ = them.pos.z - me.pos.z;
      return;
    }
    if (this.mashBeat()) {
      if (this.rng.next() < 0.75) cmd.sprawl = true;
      else cmd.fight = true;
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

  private mat(bout: Bout, cmd: Command, top: boolean): void {
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
      if (pos.sub === 'exposed') {
        cmd.shoot = true;
        this.held.shoot = false;
        if (this.mashBeat()) cmd.fight = true;
        return;
      }
      if (this.decideT > 0) return;
      // A rider works patiently; the chop is a choice, not a reflex.
      this.decideT = pos.sub === 'ride' ? 0.55 + this.rng.next() * 0.7 : 0.3 + this.rng.next() * 0.45;
      if (pos.sub === 'standing') {
        cmd.sprawl = pos.escape > 0.25 || this.rng.next() < 0.5;
        if (!cmd.sprawl) cmd.fight = true;
        return;
      }
      if (pos.sub === 'flat') {
        if (pos.control < 0.35) cmd.sprawl = true;
        else cmd.shoot = this.rng.next() < 0.6;
        if (!cmd.shoot && !cmd.sprawl) cmd.fight = true;
        return;
      }
      // Ride: keep him tight, break him down, then turn him. A chop comes with a
      // quick second one, before he can rebuild the base the first one cost him.
      if (pos.base < 0.32) cmd.shoot = true;
      else if (me.stamina < 0.2 || pos.control < 0.45) cmd.sprawl = true;
      else if (this.rng.next() < 0.5) {
        cmd.fight = true;
        if (pos.base < 0.75) this.decideT = 0.22 + this.rng.next() * 0.12;
      } else cmd.sprawl = true;
      return;
    }

    // Bottom.
    if (pos.sub === 'exposed' || pos.sub === 'flat') {
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
