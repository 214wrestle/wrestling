import { MAT } from './rules';
import { pinningMultiplier } from './careerAwards';
import { HOLD_PLACES, MOVES, SHOT_CLIPS, LEG_HOLDS } from './moves';
import type { MatSub, MoveDef, MoveId, NextSpec, Place, Role, ShotKind } from './moves';
import { otherSide } from './types';
import type { Command, ScoreKind, Side, Vec2, Wrestler } from './types';

/**
 * The bout: two bodies, their balance, their hands and the positions they fight
 * through. No rendering, no clock, no referee — MatchSim owns those and calls
 * `tick` while the whistle says wrestle.
 *
 * The rules of engagement are positional, the way real wrestling is:
 *   - On the feet, level, distance, lean and hand position decide what works.
 *     A shot from the right distance against a high, leaning opponent is hard to
 *     stop; the same shot from too far, or into a low stance, gets sprawled on.
 *     Pressing into a man who gives ground leaves you falling forward — and a
 *     snap down feeds on exactly that.
 *   - Once in on the legs it is a finishing battle: drive through, or he
 *     sprawls the hips back and ends up on top of you in a front headlock.
 *   - On the mat the bottom man's base fights the top man's control. Break him
 *     down before you turn him; stand up before he breaks you down; switch the
 *     moment he over-commits.
 */

export interface Frame {
  x: number;
  z: number;
  yaw: number;
}

export type Act =
  | 'stance'
  | 'reach'
  | 'snap'
  | 'sprawl'
  | 'sprawlRecover'
  | 'fake'
  | 'stagger'
  | 'idle'
  | 'paired';

export interface Athlete {
  side: Side;
  pos: Vec2;
  vel: Vec2;
  yaw: number;
  /** 0 = deep, 0.45 = working stance, 1 = tall. */
  level: number;
  /** Forward (+) / back (-) balance, roughly -1..1; past 0.6 he is off balance. */
  lean: number;
  /** Hand-fight control, 0..1. 0.3 = wrist control, 0.62 = collar tie. */
  hand: number;
  lead: 1 | -1;
  stamina: number;
  /** Recent effort 0..1, for breathing and sweat. */
  exertion: number;
  act: Act;
  actT: number;
  actDur: number;
  cooldown: number;
  /** Buffered presses, seconds remaining. */
  buffer: { shoot: number; fight: number; sprawl: number };
  /** Push toward the opponent this tick, -1..1. */
  drive: number;
  /** Seconds since his last fake, for set-ups. */
  sinceFake: number;
  stats: {
    takedowns: number;
    escapes: number;
    reversals: number;
    nearFalls: number;
    stuffs: number;
    shotsAttempted: number;
  };
  stallTimer: number;
  stallWarned: boolean;
}

export type Position =
  | { kind: 'free' }
  | { kind: 'neutral' }
  | {
      kind: 'shot';
      A: Side;
      shot: ShotKind;
      mirror: boolean;
      t: number;
      dur: number;
      frame: Frame;
      quality: number;
      dist: number;
      sprawlAt: number;
      stuffRoll: number;
    }
  | {
      kind: 'legs';
      A: Side;
      shot: ShotKind;
      mirror: boolean;
      t: number;
      frame: Frame;
      progress: number;
      intensity: number;
    }
  | { kind: 'fhl'; A: Side; t: number; frame: Frame; recover: number; intensity: number; cooldown: number }
  | {
      kind: 'mat';
      A: Side;
      sub: MatSub;
      t: number;
      frame: Frame;
      /** Bottom man's base, 0 (flat) .. 1 (solid on all fours). */
      base: number;
      /** Top man's control, 0..1. */
      control: number;
      /** Stand-up hand-fight progress. */
      escape: number;
      /** Seconds of back exposure. */
      expo: number;
      awarded: 0 | 2 | 4;
      pin: number;
      pinHold: number;
      fight: number;
      /** Top man over-committed: the switch window. */
      commit: number;
      basing: number;
      /** Seconds before the top man can try another turn. */
      turnCool: number;
      intensity: number;
    }
  | {
      kind: 'move';
      id: MoveId;
      A: Side;
      mirror: boolean;
      t: number;
      dur: number;
      frame: Frame;
      awarded: boolean;
      impacted: boolean;
      /** Where each role starts, in the frame, for root placement. */
      startA: Place;
      startB: Place;
      /** Neutral shots warp from the real distance to the authored one. */
      dist: number;
    };

export interface BoutEvents {
  score?: (side: Side, kind: ScoreKind, detail: string) => void;
  announce?: (text: string, tone: 'score' | 'whistle' | 'warn' | 'big' | 'info', detail?: string) => void;
  impact?: (strength: number, at: Vec2, slowmo: boolean) => void;
  move?: (def: MoveDef, A: Side) => void;
  whistle?: (reason: 'out' | 'stalemate') => void;
  fall?: (winner: Side) => void;
  /** Something the defender should react to, for the HUD and the AI. */
  tell?: (to: Side, what: 'shot' | 'snap' | 'switch' | 'standup') => void;
  /** A press did something — or did not. Drives button feedback. */
  feedback?: (side: Side, button: 'shoot' | 'fight' | 'sprawl', result: 'ok' | 'won' | 'lost' | 'blocked') => void;
}

export const BOUT = {
  maxSpeed: 2.3,
  accel: 10,
  turnRate: 7.5,
  minGap: 0.68,
  contact: 0.84,
  tieRange: 1.0,
  shotMin: 0.5,
  shotMax: 1.5,
  shotIdeal: 0.92,
  buffer: 0.2,
  reachDur: 0.24,
  snapDur: 0.24,
  sprawlDur: 0.52,
  sprawlRecover: 0.32,
  fakeDur: 0.32,
  staggerDur: 0.42,
  /** Escape progress needed, standing, before the bottom man can turn out. */
  turnOut: 0.62,
} as const;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number) => clamp(v, 0, 1);
const wrap = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const smooth = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};

/** Small deterministic generator so a bout can be replayed from a seed. */
export class Rng {
  private s: number;
  constructor(seed = 0x2f6e2b1) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 0xffffffff;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

const makeAthlete = (side: Side, lead: 1 | -1): Athlete => ({
  side,
  pos: { x: 0, z: 0 },
  vel: { x: 0, z: 0 },
  yaw: 0,
  level: 0.45,
  lean: 0,
  hand: 0,
  lead,
  stamina: 1,
  exertion: 0,
  act: 'idle',
  actT: 0,
  actDur: Infinity,
  cooldown: 0,
  buffer: { shoot: 0, fight: 0, sprawl: 0 },
  drive: 0,
  sinceFake: 9,
  stats: { takedowns: 0, escapes: 0, reversals: 0, nearFalls: 0, stuffs: 0, shotsAttempted: 0 },
  stallTimer: 0,
  stallWarned: false,
});

export function frameApply(f: Frame, p: Place): Place {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return { x: f.x + p.x * c + p.z * s, z: f.z - p.x * s + p.z * c, yaw: f.yaw + p.yaw };
}

export class Bout {
  readonly athletes: [Athlete, Athlete];
  position: Position = { kind: 'free' };
  private prev: [Command, Command];
  private rng: Rng;

  constructor(
    readonly wrestlers: [Wrestler, Wrestler],
    private ev: BoutEvents,
    seed: number,
  ) {
    this.athletes = [makeAthlete(0, wrestlers[0].lead), makeAthlete(1, wrestlers[1].lead)];
    this.rng = new Rng(seed);
    const none = { moveX: 0, moveZ: 0, shoot: false, fight: false, sprawl: false, level: false };
    this.prev = [{ ...none }, { ...none }];
  }

  /* ------------------------------------------------------------- restarts */

  /** Square off on the starting lines. */
  setNeutral(center: Vec2, axisYaw: number, gap = 1.0): void {
    const dx = Math.sin(axisYaw);
    const dz = Math.cos(axisYaw);
    const [a, b] = this.athletes;
    a.pos = { x: center.x - (dx * gap) / 2, z: center.z - (dz * gap) / 2 };
    b.pos = { x: center.x + (dx * gap) / 2, z: center.z + (dz * gap) / 2 };
    a.yaw = axisYaw;
    b.yaw = axisYaw + Math.PI;
    for (const x of this.athletes) this.resetAthlete(x);
    this.position = { kind: 'neutral' };
  }

  /** Referee's position, `top` on the bottom man's left. */
  setReferee(top: Side, center: Vec2, facing: number): void {
    for (const x of this.athletes) {
      this.resetAthlete(x);
      x.act = 'paired';
    }
    this.position = this.matPosition(top, { x: center.x, z: center.z, yaw: facing }, 'ride', 1);
    this.placeHold();
  }

  /** Bodies off the clock: intros, whistles, celebrations. */
  setFree(): void {
    this.position = { kind: 'free' };
    for (const x of this.athletes) {
      x.act = 'idle';
      x.vel = { x: 0, z: 0 };
    }
  }

  private resetAthlete(x: Athlete): void {
    x.vel = { x: 0, z: 0 };
    x.level = 0.45;
    x.lean = 0;
    x.hand = 0;
    x.act = 'stance';
    x.actT = 0;
    x.actDur = Infinity;
    x.cooldown = 0.3;
    x.buffer = { shoot: 0, fight: 0, sprawl: 0 };
    x.drive = 0;
    x.stallTimer = 0;
  }

  private matPosition(A: Side, frame: Frame, sub: MatSub, base: number): Position {
    return {
      kind: 'mat',
      A,
      sub,
      t: 0,
      frame,
      base,
      control: 0.5,
      escape: 0,
      expo: 0,
      awarded: 0,
      pin: 0,
      pinHold: 0,
      fight: 0,
      commit: 0,
      basing: 0,
      turnCool: 0,
      intensity: 0,
    };
  }

  /* ----------------------------------------------------------------- tick */

  tick(dt: number, cmds: [Command, Command]): void {
    for (const a of this.athletes) {
      const c = cmds[a.side];
      const p = this.prev[a.side];
      // Buffer fresh presses so a tap just before an action opens still counts.
      a.buffer.shoot = c.shoot && !p.shoot ? BOUT.buffer : Math.max(0, a.buffer.shoot - dt);
      a.buffer.fight = c.fight && !p.fight ? BOUT.buffer : Math.max(0, a.buffer.fight - dt);
      a.buffer.sprawl = c.sprawl && !p.sprawl ? BOUT.buffer : Math.max(0, a.buffer.sprawl - dt);
      a.cooldown = Math.max(0, a.cooldown - dt);
      a.actT += dt;
      a.sinceFake += dt;
      a.exertion = Math.max(0, a.exertion - dt * 0.05);
    }

    const pos = this.position;
    switch (pos.kind) {
      case 'free':
        break;
      case 'neutral':
        this.tickNeutral(dt, cmds);
        break;
      case 'shot':
        this.tickShot(dt, cmds, pos);
        break;
      case 'legs':
        this.tickLegs(dt, cmds, pos);
        break;
      case 'fhl':
        this.tickFhl(dt, cmds, pos);
        break;
      case 'mat':
        this.tickMat(dt, cmds, pos);
        break;
      case 'move':
        this.tickMove(dt, pos);
        break;
    }

    if (this.position.kind !== 'free') this.checkBounds();
    this.prev = [{ ...cmds[0] }, { ...cmds[1] }];
  }

  /** Consume a buffered press. */
  private take(a: Athlete, b: 'shoot' | 'fight' | 'sprawl'): boolean {
    if (a.buffer[b] > 0) {
      a.buffer[b] = 0;
      return true;
    }
    return false;
  }

  distance(): number {
    const [a, b] = this.athletes;
    return Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
  }

  private setAct(a: Athlete, act: Act, dur: number): void {
    a.act = act;
    a.actT = 0;
    a.actDur = dur;
  }

  private spend(a: Athlete, amount: number): void {
    const w = this.wrestlers[a.side];
    a.stamina = Math.max(0, a.stamina - amount * (1.25 - w.attributes.conditioning * 0.5));
    a.exertion = Math.min(1, a.exertion + amount * 3);
  }

  private recoverStamina(a: Athlete, dt: number, rate: number): void {
    const w = this.wrestlers[a.side];
    a.stamina = Math.min(1, a.stamina + dt * rate * (0.6 + w.attributes.conditioning * 0.8));
  }

  /* -------------------------------------------------------------- neutral */

  private tickNeutral(dt: number, cmds: [Command, Command]): void {
    const [A, B] = this.athletes;

    // Finish timed acts.
    for (const a of this.athletes) {
      if (a.actT < a.actDur) continue;
      const o = this.athletes[otherSide(a.side)];
      switch (a.act) {
        case 'reach':
          this.resolveReach(a, o);
          break;
        case 'snap':
          if (this.resolveSnap(a, o)) return;
          break;
        case 'sprawl':
          this.setAct(a, 'sprawlRecover', BOUT.sprawlRecover);
          break;
        case 'sprawlRecover':
        case 'fake':
        case 'stagger':
          this.setAct(a, 'stance', Infinity);
          break;
        default:
          break;
      }
    }

    // Decisions, in a random order so neither side always acts first.
    const order: Side[] = this.rng.chance(0.5) ? [0, 1] : [1, 0];
    for (const s of order) {
      if (this.position.kind !== 'neutral') return;
      this.neutralDecide(this.athletes[s], this.athletes[otherSide(s)], cmds[s]);
    }
    if (this.position.kind !== 'neutral') return;

    this.neutralMotion(dt, cmds);
    void A;
    void B;
  }

  private neutralDecide(a: Athlete, o: Athlete, cmd: Command): void {
    const free = a.act === 'stance' && a.cooldown <= 0;
    const dist = this.distance();

    if (a.buffer.sprawl > 0 && (a.act === 'stance' || a.act === 'fake' || a.act === 'reach')) {
      this.take(a, 'sprawl');
      this.setAct(a, 'sprawl', BOUT.sprawlDur);
      this.spend(a, 0.05);
      this.ev.feedback?.(a.side, 'sprawl', 'ok');
      return;
    }
    if (!free) return;

    if (a.buffer.shoot > 0) {
      this.take(a, 'shoot');
      if (dist >= BOUT.shotMin && dist <= BOUT.shotMax && a.stamina > 0.04) {
        this.startShot(a, o, dist);
      } else {
        // Out of range: a level-change fake that can pull a sprawl.
        this.setAct(a, 'fake', BOUT.fakeDur);
        a.sinceFake = 0;
        this.spend(a, 0.015);
        this.ev.feedback?.(a.side, 'shoot', dist > BOUT.shotMax ? 'blocked' : 'ok');
      }
      return;
    }

    if (a.buffer.fight > 0) {
      this.take(a, 'fight');
      if (dist > BOUT.tieRange + 0.2) {
        this.setAct(a, 'reach', BOUT.reachDur);
        this.ev.feedback?.(a.side, 'fight', 'blocked');
        return;
      }
      if (a.hand >= 0.62) {
        this.setAct(a, 'snap', BOUT.snapDur);
        this.spend(a, 0.035);
        this.ev.tell?.(o.side, 'snap');
      } else {
        this.setAct(a, 'reach', BOUT.reachDur);
        this.spend(a, 0.012);
      }
    }
    void cmd;
  }

  private resolveReach(a: Athlete, o: Athlete): void {
    this.setAct(a, 'stance', Infinity);
    if (this.distance() > BOUT.tieRange + 0.2) return;
    const wa = this.wrestlers[a.side].attributes;
    const wo = this.wrestlers[o.side].attributes;
    let p = 0.55 + (wa.quickness - wo.quickness) * 0.4 + (a.stamina - o.stamina) * 0.2;
    if (o.act === 'reach') p -= 0.18;
    if (o.act !== 'stance' && o.act !== 'reach') p += 0.2;
    if (this.rng.chance(clamp(p, 0.12, 0.92))) {
      a.hand = Math.min(1, a.hand + 0.36);
      o.hand = Math.max(0, o.hand - 0.24);
      this.ev.feedback?.(a.side, 'fight', 'won');
    } else {
      o.hand = Math.min(1, o.hand + 0.12);
      this.ev.feedback?.(a.side, 'fight', 'lost');
    }
  }

  private resolveSnap(a: Athlete, o: Athlete): boolean {
    this.setAct(a, 'stance', Infinity);
    const wa = this.wrestlers[a.side].attributes;
    const wo = this.wrestlers[o.side].attributes;
    let p =
      0.22 +
      Math.max(0, o.lean) * 0.75 +
      Math.max(0, o.level - 0.45) * 0.6 +
      (a.hand - o.hand) * 0.25 +
      (wa.strength - wo.strength) * 0.2;
    if (o.act === 'reach' || o.act === 'stagger' || o.act === 'sprawlRecover' || o.act === 'fake') p += 0.25;
    if (o.act === 'sprawl') p -= 0.3;
    if (this.distance() < BOUT.tieRange + 0.15 && this.rng.chance(clamp(p, 0.08, 0.9))) {
      this.ev.feedback?.(a.side, 'fight', 'won');
      this.startMove('snapDown', a.side, this.pairFrame(a.side), false);
      return true;
    }
    // He postured up: you are reaching and falling forward.
    a.lean = Math.min(1, a.lean + 0.5);
    this.setAct(a, 'stagger', 0.34);
    o.hand = Math.min(1, o.hand + 0.15);
    a.hand = Math.max(0, a.hand - 0.25);
    this.ev.feedback?.(a.side, 'fight', 'lost');
    return false;
  }

  private startShot(a: Athlete, o: Athlete, dist: number): void {
    const wa = this.wrestlers[a.side].attributes;
    const alreadySprawling = o.act === 'sprawl';
    a.stats.shotsAttempted += 1;
    this.spend(a, 0.08);

    // Both shooting at once is a clash of heads, not a takedown.
    if (o.act === 'paired' || (o.buffer.shoot > 0 && o.act === 'stance')) {
      this.ev.announce?.('Scramble', 'info');
      this.startMove('clash', a.side, this.pairFrame(a.side), false);
      return;
    }

    // Individual tendencies choose the attack; an angle favors the near leg.
    // Keep the original selection for athletes without a researched profile.
    const toA = Math.atan2(a.pos.x - o.pos.x, a.pos.z - o.pos.z);
    const off = wrap(toA - o.yaw);
    const angled = Math.abs(off) > 0.36;
    const style = this.wrestlers[a.side].motion?.shots;
    const weights = style ?? { double: 0.7, single: 0.3, highCrotch: 0 };
    const double = angled ? weights.double * 0.25 : weights.double;
    const single = angled ? weights.single * 1.6 : weights.single;
    const roll = style ? this.rng.next() * (double + single + weights.highCrotch) : 0;
    const shot: ShotKind = !style ? (angled || this.rng.chance(0.3) ? 'single' : 'double')
      : roll < double ? 'double' : roll < double + single ? 'single' : 'highCrotch';
    // Near-leg attacks mirror when entering from his left.
    const mirror = shot !== 'double' ? off < 0 : false;

    const fd = clamp01(1 - Math.abs(dist - BOUT.shotIdeal) / 0.55);
    const fl = clamp01(0.5 + (o.level - a.level) * 1.2);
    let q = 0.22 + fd * 0.38 + fl * 0.2;
    if (o.act === 'reach' || o.act === 'snap' || o.act === 'stagger' || o.act === 'sprawlRecover') q += 0.25;
    if (a.sinceFake < 1.2) q += 0.12;
    q += Math.max(0, o.lean) * 0.3;
    q += (a.hand - o.hand) * 0.2;
    if (angled) q += 0.08;
    q -= (1 - a.stamina) * 0.25;
    q = clamp(q, 0.05, 1);

    const dur = (0.3 + 0.28 * Math.max(0, dist - 0.65)) * (1.12 - wa.quickness * 0.25) * (1 + (1 - a.stamina) * 0.3);
    const frame = this.pairFrame(a.side);
    for (const x of this.athletes) {
      x.act = 'paired';
      x.actT = 0;
    }
    this.position = {
      kind: 'shot',
      A: a.side,
      shot,
      mirror,
      t: 0,
      dur,
      frame,
      quality: q,
      dist,
      sprawlAt: alreadySprawling ? 0 : -1,
      stuffRoll: this.rng.next(),
    };
    this.ev.move?.(MOVES[SHOT_CLIPS[shot]], a.side);
    this.ev.tell?.(o.side, 'shot');
    this.ev.feedback?.(a.side, 'shoot', 'ok');
  }

  private neutralMotion(dt: number, cmds: [Command, Command]): void {
    const [A, B] = this.athletes;
    let dx = B.pos.x - A.pos.x;
    let dz = B.pos.z - A.pos.z;
    let dist = Math.hypot(dx, dz) || 1e-4;
    let nx = dx / dist;
    let nz = dz / dist;

    for (const a of this.athletes) {
      const c = cmds[a.side];
      const w = this.wrestlers[a.side].attributes;
      const toward = a.side === 0 ? 1 : -1;
      a.drive = clamp((c.moveX * nx + c.moveZ * nz) * toward, -1, 1);

      // Level: Shift drops it; acts override.
      let levelTarget = c.level ? 0.2 : 0.45;
      if (a.act === 'sprawl') levelTarget = 0.05;
      else if (a.act === 'fake') levelTarget = 0.15;
      else if (a.act === 'sprawlRecover') levelTarget = 0.25;
      else if (a.act === 'stagger') levelTarget = 0.5;
      a.level += (levelTarget - a.level) * Math.min(1, dt * (a.act === 'sprawl' ? 14 : 7));

      const mobile = a.act === 'stance' || a.act === 'reach' || a.act === 'fake' || a.act === 'snap';
      const levelK = 0.55 + 0.45 * clamp01((a.level - 0.12) / 0.33);
      const gas = 0.65 + 0.35 * a.stamina;
      const speed = BOUT.maxSpeed * levelK * gas * (a.act === 'stance' ? 1 : 0.5) * (0.9 + w.quickness * 0.2);
      const len = Math.hypot(c.moveX, c.moveZ);
      let mx = len > 1 ? c.moveX / len : c.moveX;
      let mz = len > 1 ? c.moveZ / len : c.moveZ;
      // Circling a man you are tied up with is slow: the tangential part of
      // the move shrinks as the gap closes, so the pair turns at a human rate.
      const ux = nx * toward;
      const uz = nz * toward;
      const radial = mx * ux + mz * uz;
      const tx0 = mx - radial * ux;
      const tz0 = mz - radial * uz;
      const turnK = Math.max(0.25, Math.min(1, (dist - 0.45) / 0.9));
      mx = radial * ux + tx0 * turnK;
      mz = radial * uz + tz0 * turnK;
      const tx = mobile ? mx * speed : 0;
      const tz = mobile ? mz * speed : 0;
      const ax = tx - a.vel.x;
      const az = tz - a.vel.z;
      const al = Math.hypot(ax, az);
      const maxDv = (mobile ? BOUT.accel : 9) * dt;
      const k = al > maxDv ? maxDv / al : 1;
      a.vel.x += ax * k;
      a.vel.z += az * k;
      if (a.act === 'sprawl') {
        // Hips go back hard.
        a.vel.x -= nx * toward * 1.6 * dt * 6;
        a.vel.z -= nz * toward * 1.6 * dt * 6;
      }
      // Footwork costs little; bursts cost a lot. Recovery slows while moving.
      if (a.act === 'stance') this.recoverStamina(a, dt, 0.045 * (1 - Math.min(1, len) * 0.55));
      else this.recoverStamina(a, dt, 0.015);
      if (c.level) this.spend(a, dt * 0.006);
    }

    // Integrate.
    for (const a of this.athletes) {
      a.pos.x += a.vel.x * dt;
      a.pos.z += a.vel.z * dt;
    }

    dx = B.pos.x - A.pos.x;
    dz = B.pos.z - A.pos.z;
    dist = Math.hypot(dx, dz) || 1e-4;
    nx = dx / dist;
    nz = dz / dist;

    // Chest to chest: whoever drives harder moves the pair, and the loser of
    // that exchange is pushed back off his base.
    const sa = 0.75 + this.wrestlers[0].attributes.strength * 0.5;
    const sb = 0.75 + this.wrestlers[1].attributes.strength * 0.5;
    const inContact = dist < BOUT.contact && A.act !== 'sprawl' && B.act !== 'sprawl';
    let leanA = 0.3 * clamp(A.drive, -1, 1) * (inContact ? 0 : 1);
    let leanB = 0.3 * clamp(B.drive, -1, 1) * (inContact ? 0 : 1);
    if (inContact) {
      const pa = Math.max(0, A.drive) * sa;
      const pb = Math.max(0, B.drive) * sb;
      const net = pa - pb;
      const shove = net * 0.85 * dt;
      A.pos.x += nx * shove;
      A.pos.z += nz * shove;
      B.pos.x += nx * shove;
      B.pos.z += nz * shove;
      leanA = 0.45 * Math.max(0, A.drive) - 0.55 * pb;
      leanB = 0.45 * Math.max(0, B.drive) - 0.55 * pa;
      // Pushing into someone who gives ground leaves you falling forward.
      if (A.drive > 0.3 && B.drive < -0.25) leanA = 0.85;
      if (B.drive > 0.3 && A.drive < -0.25) leanB = 0.85;
      if (pa > 0.2 || pb > 0.2) {
        this.spend(A, dt * 0.012 * pa);
        this.spend(B, dt * 0.012 * pb);
      }
    }
    if (A.act === 'stagger') leanA = Math.max(leanA, 0.55);
    if (B.act === 'stagger') leanB = Math.max(leanB, 0.55);
    A.lean += (clamp(leanA, -1, 1) - A.lean) * Math.min(1, dt * 5);
    B.lean += (clamp(leanB, -1, 1) - B.lean) * Math.min(1, dt * 5);

    // Bodies cannot overlap.
    if (dist < BOUT.minGap) {
      const push = (BOUT.minGap - dist) / 2;
      A.pos.x -= nx * push;
      A.pos.z -= nz * push;
      B.pos.x += nx * push;
      B.pos.z += nz * push;
    }

    // Square up to each other.
    for (const a of this.athletes) {
      const o = this.athletes[otherSide(a.side)];
      const want = Math.atan2(o.pos.x - a.pos.x, o.pos.z - a.pos.z);
      const d = wrap(want - a.yaw);
      const rate = BOUT.turnRate * (a.act === 'stance' ? 1 : 0.4);
      a.yaw += clamp(d, -rate * dt, rate * dt);
    }

    // Hands: ties break as soon as they step out of reach.
    const reach = this.distance() < BOUT.tieRange + 0.15;
    for (const a of this.athletes) {
      a.hand = reach ? Math.max(0, a.hand - dt * 0.03) : Math.max(0, a.hand - dt * 1.6);
    }
  }

  /** Frame with +Z from `a` toward the opponent, origin between them. */
  private pairFrame(aSide: Side): Frame {
    const a = this.athletes[aSide];
    const o = this.athletes[otherSide(aSide)];
    return {
      x: (a.pos.x + o.pos.x) / 2,
      z: (a.pos.z + o.pos.z) / 2,
      yaw: Math.atan2(o.pos.x - a.pos.x, o.pos.z - a.pos.z),
    };
  }

  /* ----------------------------------------------------------------- shot */

  private tickShot(dt: number, cmds: [Command, Command], s: Extract<Position, { kind: 'shot' }>): void {
    s.t += dt;
    const A = this.athletes[s.A];
    const D = this.athletes[otherSide(s.A)];
    void cmds;
    if (s.sprawlAt < 0 && this.take(D, 'sprawl')) {
      s.sprawlAt = s.t;
      this.ev.feedback?.(D.side, 'sprawl', 'ok');
    }
    // The stuff is decided the moment the sprawl lands.
    if (s.sprawlAt >= 0 && s.sprawlAt <= s.dur) {
      const wd = this.wrestlers[D.side].attributes;
      const late = s.sprawlAt / s.dur;
      const p = clamp(1.2 - s.quality * 0.75 - late * 0.6 + wd.defense * 0.25 + (D.level < 0.35 ? 0.1 : 0), 0, 0.96);
      if (s.stuffRoll < p) {
        D.stats.stuffs += 1;
        this.spend(D, 0.04);
        this.ev.announce?.('Sprawl!', 'info', 'Shot stuffed');
        this.ev.feedback?.(D.side, 'sprawl', 'won');
        this.startMove('stuffed', s.A, s.frame, s.mirror, s.dist);
        return;
      }
      // Too late: he got in, but the hips are already coming back.
      s.quality = Math.max(0.05, s.quality - (1 - late) * 0.4);
      s.sprawlAt = s.dur + 1;
    }
    if (s.t >= s.dur) {
      const progress = clamp(0.32 + s.quality * 0.4, 0.15, 0.85);
      const frame = s.frame;
      this.position = {
        kind: 'legs',
        A: s.A,
        shot: s.shot,
        mirror: s.mirror,
        t: 0,
        frame,
        progress,
        intensity: 0.5,
      };
      this.placeHold();
      void A;
    }
  }

  /* ----------------------------------------------------------------- legs */

  private tickLegs(dt: number, cmds: [Command, Command], s: Extract<Position, { kind: 'legs' }>): void {
    s.t += dt;
    const A = this.athletes[s.A];
    const D = this.athletes[otherSide(s.A)];
    const wa = this.wrestlers[s.A].attributes;
    const wd = this.wrestlers[D.side].attributes;
    const ca = cmds[s.A];
    const cd = cmds[D.side];
    const c = Math.cos(s.frame.yaw);
    const sn = Math.sin(s.frame.yaw);
    const fwdA = ca.moveX * sn + ca.moveZ * c;

    const driving = ca.shoot || fwdA > 0.3;
    let rate = driving ? (0.10 + wa.strength * 0.12 + wa.quickness * 0.05) * (0.55 + 0.45 * A.stamina) : -0.14;
    if (cd.sprawl) rate -= 0.12;
    // A defended grip can remain contested instead of automatically snowballing.
    rate += (s.progress - 0.5) * 0.12;
    s.progress += rate * dt;
    if (this.take(D, 'sprawl')) {
      s.progress -= 0.035 * (0.7 + wd.defense * 0.6) * (0.6 + 0.4 * D.stamina);
      this.spend(D, 0.02);
      this.ev.feedback?.(D.side, 'sprawl', 'ok');
    }
    if (this.take(D, 'fight')) {
      s.progress -= (s.shot !== 'double' ? 0.035 : 0.025) * (0.7 + wd.strength * 0.6);
      this.spend(D, 0.02);
      this.ev.feedback?.(D.side, 'fight', 'ok');
    }
    if (this.take(A, 'shoot')) {
      s.progress += 0.025;
      this.ev.feedback?.(A.side, 'shoot', 'ok');
    }
    if (driving) this.spend(A, dt * 0.05);
    this.spend(D, dt * 0.02);
    s.intensity += ((driving ? 1 : 0.3) - s.intensity) * Math.min(1, dt * 4);
    s.progress = clamp(s.progress, -0.01, 1.01);

    if (s.progress >= 1) {
      // A double won quickly, by a strong man with gas left, often goes up in the air.
      const lift = s.shot === 'double' && s.t < 1.2 && A.stamina > 0.4 && this.rng.chance(0.06 + wa.strength * 0.2);
      this.startMove(s.shot === 'highCrotch' ? 'finishHighCrotch' : s.shot === 'single' ? 'finishSingle' : lift ? 'liftDouble' : 'finishDouble', s.A, s.frame, s.mirror);
      return;
    }
    if (s.progress <= 0) {
      D.stats.stuffs += 1;
      this.ev.announce?.('Sprawls out', 'info');
      this.ev.feedback?.(D.side, 'sprawl', 'won');
      this.startMove('sprawlOut', s.A, s.frame, s.mirror);
      return;
    }
    if (s.t > 8) this.stalemate();
    this.placeHold();
  }

  /* ------------------------------------------------------- front headlock */

  private tickFhl(dt: number, cmds: [Command, Command], s: Extract<Position, { kind: 'fhl' }>): void {
    s.t += dt;
    s.cooldown = Math.max(0, s.cooldown - dt);
    const T = this.athletes[s.A];
    const Bm = this.athletes[otherSide(s.A)];
    const wt = this.wrestlers[s.A].attributes;
    const wb = this.wrestlers[Bm.side].attributes;
    const cb = cmds[Bm.side];

    // Bottom digs his head out.
    let work = 0;
    if (this.take(Bm, 'fight') || this.take(Bm, 'sprawl')) {
      work += 0.16 * (0.7 + wb.quickness * 0.6) * (0.6 + 0.4 * Bm.stamina);
      this.spend(Bm, 0.02);
      this.ev.feedback?.(Bm.side, 'fight', 'ok');
    }
    if (this.take(Bm, 'shoot')) {
      work += 0.06;
      this.ev.feedback?.(Bm.side, 'shoot', 'ok');
    }
    if (cb.fight || cb.sprawl) work += dt * 0.08;
    s.recover = clamp(s.recover + work + dt * 0.04, 0, 1.01);

    // Top: snap him back down, or spin behind.
    if (this.take(T, 'fight')) {
      s.recover = Math.max(0, s.recover - 0.2 * (0.7 + wt.strength * 0.6));
      this.spend(Bm, 0.03);
      this.spend(T, 0.015);
      this.ev.feedback?.(T.side, 'fight', 'ok');
    }
    if (s.cooldown <= 0 && this.take(T, 'shoot')) {
      // Spinning on a man with his hips under him rarely works: snap him down first.
      const p = clamp(0.25 + wt.quickness * 0.22 + (0.55 - s.recover) * 0.55 - (cb.fight || cb.sprawl ? 0.1 : 0), 0.05, 0.8);
      this.spend(T, 0.04);
      if (this.rng.chance(p)) {
        this.ev.feedback?.(T.side, 'shoot', 'won');
        this.startMove('goBehind', s.A, s.frame, false);
        return;
      }
      s.cooldown = 0.65;
      s.recover = Math.min(1, s.recover + 0.22);
      this.ev.feedback?.(T.side, 'shoot', 'lost');
    }
    s.intensity += ((work > 0 ? 1 : 0.35) - s.intensity) * Math.min(1, dt * 3);

    if (s.recover >= 1) {
      this.ev.feedback?.(Bm.side, 'fight', 'won');
      this.startMove('recover', s.A, s.frame, false);
      return;
    }
    if (s.t > 7) this.stalemate();
    this.placeHold();
  }

  /* ------------------------------------------------------------------ mat */

  private tickMat(dt: number, cmds: [Command, Command], s: Extract<Position, { kind: 'mat' }>): void {
    s.t += dt;
    s.commit = Math.max(0, s.commit - dt);
    s.basing = Math.max(0, s.basing - dt);
    s.turnCool = Math.max(0, s.turnCool - dt);
    const T = this.athletes[s.A];
    const Bm = this.athletes[otherSide(s.A)];
    const wt = this.wrestlers[s.A].attributes;
    const wb = this.wrestlers[Bm.side].attributes;
    const ct = cmds[s.A];
    const c = Math.cos(s.frame.yaw);
    const sn = Math.sin(s.frame.yaw);
    const drive = clamp(ct.moveX * sn + ct.moveZ * c, -1, 1);

    if (s.sub === 'exposed') {
      this.tickExposed(dt, cmds, s, T, Bm);
      return;
    }

    if (s.sub === 'ride') {
      s.base = Math.min(1, s.base + dt * 0.09 * (0.6 + wb.mat * 0.8));
      s.control += (0.45 - s.control) * dt * 0.25;
      if (drive > 0.3) {
        s.base -= dt * 0.1 * drive;
        // Riding pressure is not a lunge; only a hard drive leaves a little weight out front.
        if (drive > 0.75) s.commit = Math.max(s.commit, 0.15);
        this.spend(T, dt * 0.02);
      }
      // Top.
      if (this.take(T, 'fight')) {
        const hit = 0.3 * (0.75 + wt.mat * 0.5) * (0.6 + 0.4 * T.stamina) * (s.basing > 0 ? 0.5 : 1);
        s.base -= hit;
        s.commit = 0.5;
        this.spend(T, 0.035);
        this.ev.feedback?.(T.side, 'fight', 'ok');
        if (s.base <= 0) {
          this.startMove('breakdown', s.A, s.frame, false);
          return;
        }
      }
      if (this.take(T, 'shoot')) {
        if (s.base < 0.35 && s.turnCool <= 0) {
          const p = clamp(0.45 + wt.mat * 0.3 - wb.defense * 0.25 - s.base, 0.1, 0.85);
          this.spend(T, 0.05);
          if (this.rng.chance(p)) {
            this.ev.feedback?.(T.side, 'shoot', 'won');
            this.startMove('tilt', s.A, s.frame, false);
            return;
          }
          s.turnCool = 0.9;
          s.base = Math.min(1, s.base + 0.15);
          this.ev.feedback?.(T.side, 'shoot', 'lost');
        } else {
          s.control = Math.max(0, s.control - 0.2);
          s.commit = 0.6;
          this.ev.feedback?.(T.side, 'shoot', 'blocked');
        }
      }
      if (this.take(T, 'sprawl')) {
        s.control = Math.min(1, s.control + 0.25);
        this.ev.feedback?.(T.side, 'sprawl', 'ok');
      }
      // Bottom.
      if (this.take(Bm, 'sprawl')) {
        s.base = Math.min(1, s.base + 0.16);
        s.basing = 0.5;
        this.ev.feedback?.(Bm.side, 'sprawl', 'ok');
      }
      if (this.take(Bm, 'shoot')) {
        this.spend(Bm, 0.05);
        // Standing up off a weak base into a tight rider just gets you chopped back down.
        const p = clamp(0.3 + wb.quickness * 0.25 - s.control * 0.5 + (s.base - 0.5) * 0.6 + (1 - T.stamina) * 0.2, 0.05, 0.85);
        if (s.base > 0.4 && this.rng.chance(p)) {
          this.ev.tell?.(T.side, 'standup');
          this.ev.feedback?.(Bm.side, 'shoot', 'won');
          this.startMove('standUp', s.A, s.frame, false);
          return;
        }
        s.base -= 0.12;
        s.control = Math.min(1, s.control + 0.08);
        this.ev.feedback?.(Bm.side, 'shoot', 'lost');
      }
      if (this.take(Bm, 'fight')) {
        this.spend(Bm, 0.05);
        // A switch beats weight that is out front: the more he just committed, the better it is.
        const p = clamp(0.1 + s.commit * 0.8 + (wb.mat - wt.mat) * 0.25 + wb.quickness * 0.1, 0.05, 0.85);
        this.ev.tell?.(T.side, 'switch');
        if (s.base > 0.25 && this.rng.chance(p)) {
          this.ev.feedback?.(Bm.side, 'fight', 'won');
          this.startMove('switch', s.A, s.frame, false);
          return;
        }
        s.base -= 0.22;
        this.ev.feedback?.(Bm.side, 'fight', 'lost');
      }
      s.base = clamp(s.base, 0, 1);
      if (s.base <= 0) {
        this.startMove('breakdown', s.A, s.frame, false);
        return;
      }
    } else if (s.sub === 'flat') {
      s.base = Math.min(1, s.base + dt * 0.05);
      if (this.take(T, 'shoot')) {
        if (s.turnCool > 0) {
          this.ev.feedback?.(T.side, 'shoot', 'blocked');
        } else {
          // The half needs control and a bottom man who is not fighting it.
          const p = clamp(
            0.26 + wt.mat * 0.3 + wt.strength * 0.1 - wb.defense * 0.25 - s.base * 0.5 + (s.control - 0.5) * 0.3,
            0.06,
            0.85,
          );
          this.spend(T, 0.05);
          if (this.rng.chance(p)) {
            this.ev.feedback?.(T.side, 'shoot', 'won');
            this.startMove('halfNelson', s.A, s.frame, false);
            return;
          }
          s.control = Math.max(0, s.control - 0.18);
          s.base = Math.min(1, s.base + 0.12);
          s.turnCool = 0.8;
          this.ev.feedback?.(T.side, 'shoot', 'lost');
        }
      }
      if (this.take(T, 'fight')) {
        s.base = Math.max(0, s.base - 0.15);
        this.spend(T, 0.02);
        this.ev.feedback?.(T.side, 'fight', 'ok');
      }
      if (this.take(T, 'sprawl')) {
        s.control = Math.min(1, s.control + 0.2);
        this.ev.feedback?.(T.side, 'sprawl', 'ok');
      }
      for (const b of ['sprawl', 'fight', 'shoot'] as const) {
        if (this.take(Bm, b)) {
          s.base += 0.15 * (0.7 + wb.mat * 0.6) * (0.6 + 0.4 * Bm.stamina);
          this.spend(Bm, 0.025);
          this.ev.feedback?.(Bm.side, b, 'ok');
        }
      }
      if (s.base >= 0.68) {
        this.startMove('rebase', s.A, s.frame, false);
        return;
      }
    } else if (s.sub === 'standing') {
      s.escape = Math.max(0, s.escape - dt * 0.04);
      s.control = Math.min(1, s.control + dt * 0.05);
      if (this.take(Bm, 'fight')) {
        // Breaking the lock is hand-fighting, finger by finger; a tight lock gives less.
        s.escape += 0.11 * (0.7 + wb.quickness * 0.6) * (0.6 + 0.4 * Bm.stamina) * (1.25 - s.control * 0.5);
        this.spend(Bm, 0.02);
        this.ev.feedback?.(Bm.side, 'fight', 'ok');
      }
      if (this.take(Bm, 'shoot')) {
        if (s.escape >= BOUT.turnOut) {
          this.ev.feedback?.(Bm.side, 'shoot', 'won');
          this.startMove('escapeTurn', s.A, s.frame, false);
          return;
        }
        s.escape += 0.07;
        this.ev.feedback?.(Bm.side, 'shoot', 'lost');
      }
      if (this.take(T, 'sprawl')) {
        // Returns need a lock and a man who has not yet broken it.
        const p = clamp(0.22 + wt.strength * 0.35 + s.control * 0.25 - s.escape * 0.7 + Math.min(0.15, s.t * 0.05), 0.05, 0.9);
        this.spend(T, 0.05);
        if (this.rng.chance(p)) {
          this.ev.feedback?.(T.side, 'sprawl', 'won');
          this.startMove('returnMat', s.A, s.frame, false);
          return;
        }
        s.escape += 0.15;
        this.ev.feedback?.(T.side, 'sprawl', 'lost');
      }
      if (this.take(T, 'fight')) {
        s.control = Math.min(1, s.control + 0.15);
        s.escape = Math.max(0, s.escape - 0.08);
        this.ev.feedback?.(T.side, 'fight', 'ok');
      }
      if (s.escape >= 1) {
        this.startMove('escapeTurn', s.A, s.frame, false);
        return;
      }
    }

    // Pair drifts as the top man drives.
    if (s.sub === 'ride' || s.sub === 'flat') {
      const lat = clamp(ct.moveX * c - ct.moveZ * sn, -1, 1);
      s.frame.x += (sn * Math.max(0, drive) * 0.25 + c * lat * 0.12) * dt;
      s.frame.z += (c * Math.max(0, drive) * 0.25 - sn * lat * 0.12) * dt;
    }
    s.intensity += (Math.min(1, Math.abs(drive) + (Bm.buffer.fight + Bm.buffer.shoot > 0 ? 0.5 : 0)) - s.intensity) * Math.min(1, dt * 3);
    this.recoverStamina(T, dt, 0.035);
    this.recoverStamina(Bm, dt, 0.03);
    this.placeHold();
  }

  private tickExposed(
    dt: number,
    cmds: [Command, Command],
    s: Extract<Position, { kind: 'mat' }>,
    T: Athlete,
    Bm: Athlete,
  ): void {
    const wt = this.wrestlers[T.side].attributes;
    const wb = this.wrestlers[Bm.side].attributes;
    s.expo += dt;
    if (s.awarded === 0 && s.expo >= 2) {
      s.awarded = 2;
      T.stats.nearFalls += 1;
      this.ev.score?.(T.side, 'nearFall2', 'Near fall');
    } else if (s.awarded === 2 && s.expo >= 5) {
      s.awarded = 4;
      this.ev.score?.(T.side, 'nearFall4', 'Near fall');
    }
    const ct = cmds[T.side];
    const wrestler = this.wrestlers[T.side];
    const pinSkill = pinningMultiplier(`${wrestler.firstName} ${wrestler.lastName}`);
    if (ct.shoot || ct.fight) s.pin += dt * 0.22 * (0.7 + wt.strength * 0.6) * pinSkill;
    if (this.take(T, 'shoot') || this.take(T, 'fight')) {
      s.pin += 0.06 * pinSkill;
      this.ev.feedback?.(T.side, 'shoot', 'ok');
    }
    for (const b of ['sprawl', 'fight', 'shoot'] as const) {
      if (this.take(Bm, b)) {
        s.fight += 0.11 * (0.7 + wb.defense * 0.6) * (0.5 + 0.5 * Bm.stamina);
        s.pin = Math.max(0, s.pin - 0.08);
        this.spend(Bm, 0.02);
        this.ev.feedback?.(Bm.side, b, 'ok');
      }
    }
    s.fight = Math.max(0, s.fight - dt * 0.08);
    s.pin = clamp(s.pin - dt * 0.05, 0, 1.2);
    s.intensity += (Math.min(1, s.pin + s.fight) - s.intensity) * Math.min(1, dt * 4);
    if (s.pin >= 1) {
      s.pinHold += dt;
      if (s.pinHold >= 1) {
        this.startMove('fall', s.A, s.frame, false);
        return;
      }
    } else {
      s.pinHold = Math.max(0, s.pinHold - dt);
    }
    if (s.fight >= 1 || s.expo > 8) {
      this.ev.announce?.('Fights off his back', 'info');
      this.ev.feedback?.(Bm.side, 'sprawl', 'won');
      this.startMove('fightOff', s.A, s.frame, false);
      return;
    }
    this.placeHold();
  }

  /* ---------------------------------------------------------------- moves */

  private startMove(id: MoveId, A: Side, frame: Frame, mirror: boolean, dist = 1): void {
    const def = MOVES[id];
    const from = this.position;
    const holdA = this.athletes[A];
    const holdB = this.athletes[otherSide(A)];
    // Record where each role's root sits in the move's frame right now.
    const toLocal = (a: Athlete): Place => {
      const dx = a.pos.x - frame.x;
      const dz = a.pos.z - frame.z;
      const c = Math.cos(frame.yaw);
      const s = Math.sin(frame.yaw);
      return { x: dx * c - dz * s, z: dx * s + dz * c, yaw: wrap(a.yaw - frame.yaw) };
    };
    let dur = def.dur;
    if (id === 'shotDouble' || id === 'shotSingle' || id === 'shotHighCrotch') dur = from.kind === 'shot' ? from.dur : def.dur;
    this.position = {
      kind: 'move',
      id,
      A,
      mirror,
      t: 0,
      dur,
      frame: { ...frame },
      awarded: false,
      impacted: false,
      startA: toLocal(holdA),
      startB: toLocal(holdB),
      dist,
    };
    for (const a of this.athletes) {
      a.act = 'paired';
      a.actT = 0;
    }
    this.ev.move?.(def, A);
  }

  private tickMove(dt: number, m: Extract<Position, { kind: 'move' }>): void {
    m.t += dt;
    const def = MOVES[m.id];
    const u = Math.min(1, m.t / m.dur);
    if (def.impact && !m.impacted && u >= def.impact.at) {
      m.impacted = true;
      const at = frameApply(m.frame, { x: 0, z: 0.3, yaw: 0 });
      this.ev.impact?.(def.impact.strength, { x: at.x, z: at.z }, !!def.slowmo);
    }
    if (def.award && !m.awarded && u >= def.award.at) {
      m.awarded = true;
      const to = def.award.to === 'A' ? m.A : otherSide(m.A);
      const st = this.athletes[to].stats;
      if (def.award.kind === 'takedown') st.takedowns += 1;
      if (def.award.kind === 'escape') st.escapes += 1;
      if (def.award.kind === 'reversal') st.reversals += 1;
      this.ev.score?.(to, def.award.kind, def.award.detail);
      if (this.position !== m) return; // scoring ended the bout
    }
    this.placeMove(m, u);
    for (const a of this.athletes) this.spend(a, dt * 0.01);
    if (m.t >= m.dur) this.completeMove(m);
  }

  private completeMove(m: Extract<Position, { kind: 'move' }>): void {
    const next: NextSpec = MOVES[m.id].next;
    const sideOf = (r: Role): Side => (r === 'A' ? m.A : otherSide(m.A));
    const sub = (p: Place): Frame => {
      const q = m.mirror ? { x: -p.x, z: p.z, yaw: -p.yaw } : p;
      return frameApply(m.frame, q);
    };
    switch (next.kind) {
      case 'fall':
        this.ev.fall?.(m.A);
        this.position = { kind: 'free' };
        return;
      case 'neutral': {
        const a = this.athletes[m.A];
        const b = this.athletes[otherSide(m.A)];
        const pa = sub(next.a);
        const pb = sub(next.b);
        a.pos = { x: pa.x, z: pa.z };
        a.yaw = pa.yaw;
        b.pos = { x: pb.x, z: pb.z };
        b.yaw = pb.yaw;
        for (const x of this.athletes) {
          this.resetAthlete(x);
          x.cooldown = 0.25;
        }
        this.position = { kind: 'neutral' };
        return;
      }
      case 'legs':
        this.position = {
          kind: 'legs',
          A: sideOf(next.A),
          shot: next.shot,
          mirror: m.mirror,
          t: 0,
          frame: sub(next.frame),
          progress: 0.4,
          intensity: 0.5,
        };
        break;
      case 'fhl':
        this.position = { kind: 'fhl', A: sideOf(next.A), t: 0, frame: sub(next.frame), recover: 0.15, intensity: 0.5, cooldown: 0.35 };
        break;
      case 'mat': {
        const mat = this.matPosition(sideOf(next.A), sub(next.frame), next.sub, next.base ?? 0);
        if (mat.kind === 'mat') {
          if (next.sub === 'standing') mat.escape = 0.15;
          // Fighting off your back leaves you scrambling, not flat and helpless.
          if (next.sub === 'flat') mat.base = m.id === 'fightOff' ? 0.45 : 0;
          if (m.id === 'fightOff') mat.turnCool = 1.6;
          if (m.id === 'rebase' || m.id === 'returnMat') mat.turnCool = 0.6;
          // Whoever just put him there starts with a tight hold on him.
          const def = MOVES[m.id];
          if (def.award?.kind === 'takedown' || def.award?.kind === 'reversal') mat.control = 0.68;
          else if (m.id === 'returnMat') mat.control = 0.62;
        }
        this.position = mat;
        break;
      }
    }
    for (const a of this.athletes) {
      a.act = 'paired';
      a.actT = 0;
    }
    this.placeHold();
  }

  /** Abandon a stalled position: the official restarts them on their feet. */
  private stalemate(): void {
    this.ev.whistle?.('stalemate');
    this.position = { kind: 'free' };
  }

  /* ---------------------------------------------------------- placements */

  private holdPlaces(): { A: Place; B: Place; frame: Frame; ASide: Side; mirror: boolean } | null {
    const p = this.position;
    switch (p.kind) {
      case 'legs':
        return { ...(HOLD_PLACES[LEG_HOLDS[p.shot]]), frame: p.frame, ASide: p.A, mirror: p.mirror };
      case 'fhl':
        return { ...HOLD_PLACES.fhl, frame: p.frame, ASide: p.A, mirror: false };
      case 'mat':
        return { ...HOLD_PLACES[p.sub], frame: p.frame, ASide: p.A, mirror: false };
      case 'shot':
        return null;
      default:
        return null;
    }
  }

  /** Keep roots where the held position puts them (camera, referee, bounds). */
  private placeHold(): void {
    const h = this.holdPlaces();
    if (!h) return;
    const place = (side: Side, p: Place) => {
      const q = h.mirror ? { x: -p.x, z: p.z, yaw: -p.yaw } : p;
      const w = frameApply(h.frame, q);
      const a = this.athletes[side];
      a.pos = { x: w.x, z: w.z };
      a.yaw = w.yaw;
      a.vel = { x: 0, z: 0 };
    };
    place(h.ASide, h.A);
    place(otherSide(h.ASide), h.B);
  }

  private placeMove(m: Extract<Position, { kind: 'move' }>, u: number): void {
    const next = MOVES[m.id].next;
    let endA: Place | null = null;
    let endB: Place | null = null;
    if (next.kind === 'neutral') {
      endA = next.a;
      endB = next.b;
    } else if (next.kind !== 'fall') {
      const holdKey =
        next.kind === 'legs'
          ? LEG_HOLDS[next.shot]
          : next.kind === 'fhl'
            ? 'fhl'
            : next.sub;
      const hold = HOLD_PLACES[holdKey];
      const ra = next.A === 'A' ? hold.A : hold.B;
      const rb = next.A === 'A' ? hold.B : hold.A;
      endA = frameApply(next.frame, ra);
      endB = frameApply(next.frame, rb);
    }
    if (!endA || !endB) return;
    const k = smooth(u);
    const lerpPlace = (a: Place, b: Place): Place => ({
      x: a.x + (b.x - a.x) * k,
      z: a.z + (b.z - a.z) * k,
      yaw: a.yaw + wrap(b.yaw - a.yaw) * k,
    });
    const mir = (p: Place): Place => (m.mirror ? { x: -p.x, z: p.z, yaw: -p.yaw } : p);
    const pa = frameApply(m.frame, lerpPlace(m.startA, mir(endA)));
    const pb = frameApply(m.frame, lerpPlace(m.startB, mir(endB)));
    const A = this.athletes[m.A];
    const B = this.athletes[otherSide(m.A)];
    A.pos = { x: pa.x, z: pa.z };
    A.yaw = pa.yaw;
    B.pos = { x: pb.x, z: pb.z };
    B.yaw = pb.yaw;
  }

  /* ------------------------------------------------------------- boundary */

  private checkBounds(): void {
    const p = this.position;
    const limit = MAT.circleRadius + 0.15;
    if (p.kind === 'neutral') {
      if (this.athletes.some((a) => Math.hypot(a.pos.x, a.pos.z) > limit)) this.ev.whistle?.('out');
      return;
    }
    const f = 'frame' in p ? p.frame : null;
    if (f && Math.hypot(f.x, f.z) > MAT.circleRadius + 0.05) this.ev.whistle?.('out');
  }

  /* --------------------------------------------------------------- reads */

  get top(): Side | null {
    const p = this.position;
    if (p.kind === 'mat') return p.A;
    return null;
  }

  /** Centre of the action, for the camera and the official. */
  get center(): Vec2 {
    const [a, b] = this.athletes;
    return { x: (a.pos.x + b.pos.x) / 2, z: (a.pos.z + b.pos.z) / 2 };
  }

  get axisYaw(): number {
    const [a, b] = this.athletes;
    return Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
  }
}
