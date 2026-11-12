import {isArmBar} from './armBars';
import { isScrambleSpecialist, heavyweightActivity, isFootSweepSpecialist, lateAttackUrgency, GABLE_PRESSURE_NAMES } from './athleteProfiles';
import type { Bout } from './bout';
import { BOUT, COLD_READ, EDGE, Rng, edgeDistance, legCounterFor } from './bout';
import { otherSide } from './types';
import { STYLE_EFFECT, gradeStep, styleStep } from './attributeRatings';
import { MAT } from './rules';
import { topPlanEffects, topPlanOf, PARALLEL_STALL } from './strategy';
import type { Command, Side } from './types';

export type Difficulty = 'practice' | 'walk-on' | 'starter' | 'all-american';

/** Chance the AI shoots right off his reach or snap (once per opening): base + aggression share. */
export const POUNCE = { base: 0.12, aggression: 0.5 } as const;

/**
 * Hand fighting in neutral (owner, November 11: "Yes, more hand fighting"; the review found neutral stretches of up to
 * 48 s with no attack and under one tie won a minute). The AI fights in exchanges: after a hand fight it goes again
 * `gap` seconds later with chance `chain`, up to `max` in a row, fighting for the wrists instead of one reach and back
 * to circling. A hand fighter steps into tie range (`closeDist`) with chance handfight x `close` when it picks its
 * distance, and fights more often in range (`inRange`, `outside`: per-decision chance x handfight). AI only: the rules
 * for the person are unchanged.
 */
export const HAND_FIGHT = { tieUp: 0.2, pummel: 0.14, lockPummel: 0.12, coldDrop: 0.1, coldHeadlock: 0.025, chain: 0.6, gap: [0.3, 0.55], max: 3, close: 0.6, closeDist: 0.92, inRange: 0.55, outside: 0.3 } as const;

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
  'walk-on': { effort: .3, reaction: .7, sprawlSkill: .12, aggression: .15, patience: .1, handfight: .3, mash: 1.2, switchRead: .03, gullible: .8 },
  // November 9: the faster neutral (more hand fighting, fakes and set-up shots) gave a good player more to
  // counter, so Varsity and All-American defend better to stay as hard as they were (sprawl reaction and
  // skill up, fewer bites on fakes), and fight a shot that gets in on the legs a bit more of the time
  // (effort), so more attacks get fought off instead of scoring. Measured with outputs/nov09-gameplay/techscan.ts.
  starter: { effort: .56, reaction: .38, sprawlSkill: .38, aggression: .3, patience: .2, handfight: .55, mash: 2, switchRead: .1, gullible: .55 },
  'all-american': { effort: .65, reaction: .3, sprawlSkill: .5, aggression: .36, patience: .35, handfight: .8, mash: 2.8, switchRead: .2, gullible: .46 },
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
  private goIn = -1;
  /** His corner's plan style, refreshed every update (onTell has no bout). */
  private planStyle: 'aggressive' | 'balanced' | 'defensive' = 'balanced';
  /** The bout from the last update, so a tell can see what kind of shot is coming. */
  /** The mat return already decided on (turn in as he lands or not). */
  private turnInMove: unknown = null;
  private lastBout: Bout | null = null;
  /** Protecting a lead, this stretch he backs out at the line instead of circling off it. */
  private bailOut = false;
  /** This stretch, with his back to the line he circles off it rather than giving ground (better levels do). */
  private circlesOff = true;
  /** The position his edge plan was rolled for, and the roll. */
  private edgeFor: unknown = null;
  private edgeRoll = 1;
  /** Review only: the neutral pace before November 9 (decisions every ~2.1 s, fewer hand fights and fakes),
   *  for a stand-in player in balance scans, so only the opponent's pace changes. */
  classicPace = false;
  /** Review only: the stand-in player of the balance scans, fixed at the All-American profile and neutral
   *  pace of November 8, so tuning the levels does not also change the yardstick. */
  standIn(): this {
    this.classicPace = true;
    this.p = { effort: .6, reaction: .32, sprawlSkill: .46, aggression: .36, patience: .35, handfight: .8, mash: 2.8, switchRead: .2, gullible: .5 };
    return this;
  }
  private fakeFollowed = false;
  private switchIn = -1;
  private lastCommit = 0;
  /** He was flat a moment ago: back on his base he goes right away (owner, November 10: up and moving). */
  private wasFlat = false;
  private bottomWait = 0;
  /** Already decided whether to explode off this whistle. */
  private whistleRead = false;
  private lastPos = '';
  private circleDir = 1;
  private moveX = 0;
  private moveZ = 0;
  private circleT = 0;
  private decideT = 0;
  private mashT = 0;
  private held = { shoot: false, fight: false, sprawl: false };
  private wantDist = 1.05;
  private pushT = 0;
  private levelT = 0;
  private lowLevel = false;
  private reshotTried = false;
  private legRideFor: unknown = null;
  private ridingLegs = false;
  private legInT = 0;
  private pocketsFor: unknown = null;
  private closesPockets = true;
  private reshotIn: number | undefined;
  private pounceTried = false;
  private pounceIn: number | undefined;
  private throwTried = false;
  private chainLeft = 0;
  private chainT = 0;
  private effortTime = 0;
  private legDefense: 'sprawl' | 'fight' | null = null;
  private legFinishChoice: 'trip' | 'double' | 'drive' | null = null;

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
  onTell(what: 'shot' | 'fake' | 'opening' | 'snap' | 'switch' | 'standup'): void {
    // A defensive corner sits on the shot: reads it more often and sooner; an aggressive one less.
    const read = this.planStyle === 'defensive' ? 0.15 : this.planStyle === 'aggressive' ? -0.05 : 0;
    const quick = this.planStyle === 'defensive' ? 0.8 : 1;
    // A cold shot (no setup) is far easier to read, and is read sooner.
    const cold = this.lastBout?.position.kind === 'shot' && !!this.lastBout.position.cold;
    // A defensive man (defense grade) reads it more often (STYLE_EFFECT.defRead per step).
    const defRead = this.lastBout ? STYLE_EFFECT.defRead * gradeStep(this.lastBout.wrestlers[this.side], 'defense') : 0;
    if (what === 'shot' && this.rng.next() < this.p.sprawlSkill + read + defRead + (cold ? COLD_READ : 0)) {
      // Read off the level change, not the contact: the hips go back while he is still coming in.
      this.sprawlIn = this.p.reaction * 0.55 * quick * (cold ? 0.7 : 1) * (0.75 + this.rng.next() * 0.55);
    }
    // He bit on my tap: go, if I read it in time.
    if (what === 'opening' && this.rng.next() < 0.05 + this.p.aggression * 0.15) {
      this.goIn = this.p.reaction * (0.4 + this.rng.next() * 0.4);
    }
  }

  /** A thrower looks for the throw more (STYLE_EFFECT.throwAI per throws grade step; never below a third). */
  private throwKeen(bout: Bout): number {
    return Math.max(0.33, 1 + STYLE_EFFECT.throwAI * gradeStep(bout.wrestlers[this.side], 'throws'));
  }

  update(dt: number, bout: Bout, wrestling: boolean, context?: {timeLeft:number; finalPeriod:boolean; deficit:number}): Command {
    const cmd = empty();
    this.lastBout = bout;
    if (!wrestling) {
      this.held = { shoot: false, fight: false, sprawl: false };
      // Every whistle is a fresh start, even when play stopped and restarts in the same position.
      this.lastPos = 'whistle';
      return cmd;
    }
    if(this.p.effort===0)return cmd; // Cooperative practice partner: no attacks or counters.
    this.planStyle = bout.plans[this.side].style;
    this.effortTime+=dt;
    const pos = bout.position;
    const key = pos.kind + (pos.kind === 'mat' ? pos.sub : '');
    if (key !== this.lastPos) {
      const fromWhistle = this.lastPos === 'whistle';
      this.lastPos = key;
      this.legDefense = null;
      this.legFinishChoice = null;
      // A human beat to read the new position before acting on it.
      this.decideT = this.p.reaction * 1.6 + this.rng.next() * 0.3;
      // Off the whistle on the feet, a moment to feel him out (step in, touch hands) before the
      // first fake or shot; it was instant, so both men often faked in the first second.
      if (fromWhistle && key === 'neutral') this.decideT += 0.3 + this.rng.next() * 0.6;
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
    if (this.goIn >= 0) {
      this.goIn -= dt;
      if (this.goIn < 0) {
        this.goIn = -1;
        if (pos.kind === 'neutral' && bout.athletes[this.side].stamina > 0.2) cmd.shoot = true;
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

    // Being returned to the mat: sit and turn in as he lands, now and then (more often the better he is).
    if (pos.kind === 'move' && pos.A !== this.side && bout.returnWindow() && this.turnInMove !== pos) {
      this.turnInMove = pos;
      if (this.rng.next() < 0.15 + this.p.effort * 0.35) cmd.shoot = true;
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
    this.edgeTactics(bout, cmd);
    if (pos.kind === 'mat' && pos.A !== this.side && (pos.sub === 'ride' || pos.sub === 'flat') && (pos.legRide ?? 0) > 0.05) {
      // Close the pockets while he threads the leg; once it is in, reach back for it after a beat (a good
      // mat man feels it sooner). Catching it before it was in used to clear every leg the moment it landed.
      const legIn = (pos.legRide ?? 0) >= 0.8;
      // Not every bottom man keeps his pockets shut on every ride; better mat men and harder levels do it more
      // often (an All-American nearly always: open pockets were worth 10 points of win rate to a good player).
      if (this.pocketsFor !== pos) { this.pocketsFor = pos; this.closesPockets = this.rng.next() < 0.4 + bout.wrestlers[this.side].attributes.mat * 0.4 + (this.p.effort - 0.3) * 0.9; }
      cmd.closePockets = !legIn && this.closesPockets;
      if (!legIn) this.legInT = 0;
      else this.legInT += dt;
      cmd.catchLeg = legIn && this.legInT > 1.8 - bout.wrestlers[this.side].attributes.mat * 1.2;
    } else this.legInT = 0;
    const name = `${bout.wrestlers[this.side].firstName} ${bout.wrestlers[this.side].lastName}`;
    // Scramble specialists (and researched scramblers, STYLE_EFFECT.scrambleAI a second per step above 3) scramble.
    const scramRate = (isScrambleSpecialist(name) ? 0.3 : 0) + STYLE_EFFECT.scrambleAI * Math.max(0, gradeStep(bout.wrestlers[this.side], 'scrambling'));
    if ((pos.kind === 'legs' || pos.kind === 'fhl' || pos.kind === 'mat') && scramRate > 0 && this.rng.chance(dt * scramRate)) cmd.scramble = true;
    return this.edges(cmd);
  }

  /**
   * The edge in a scramble and on the mat (owner, November 10; see EDGE in bout.ts). The man in trouble works out
   * of bounds: the defender on the legs or in a front headlock, the bottom man broken down or ridden with legs
   * (a fresh restart), and now and then a man on his back (fleeing: a stalling call). The man in control turns
   * it back to the center, except a rider about to lose a standing bottom man, who pushes him out to restart on
   * top. Better wrestlers play the edge more often.
   */
  private edgeTactics(bout: Bout, cmd: Command): void {
    const pos = bout.position;
    if (pos.kind !== 'legs' && pos.kind !== 'fhl' && pos.kind !== 'mat') return;
    const f = pos.frame;
    if (edgeDistance(f.x, f.z) > EDGE.zone) return;
    if (this.edgeFor !== pos) { this.edgeFor = pos; this.edgeRoll = this.rng.next(); }
    const r = Math.hypot(f.x, f.z) || 1;
    const out = () => { cmd.moveX = f.x / r; cmd.moveZ = f.z / r; };
    const back = () => { cmd.moveX = -f.x / r; cmd.moveZ = -f.z / r; };
    const smart = this.edgeRoll < 0.4 + this.p.effort * 0.8;
    const mine = pos.A === this.side;
    // Turning the corner costs the attacker his drive, so only some do it; the man in trouble nearly always goes.
    const turns = this.edgeRoll < 0.25 + this.p.effort * 0.6;
    if (pos.kind === 'legs') { if (mine) { if (turns) back(); } else if (smart && pos.progress > 0.3) out(); return; }
    if (pos.kind === 'fhl') { if (mine) { if (turns) back(); } else if (smart && pos.recover < 0.7) out(); return; }
    if (mine) {
      if (pos.sub === 'standing' && pos.escape > 0.45 && this.edgeRoll < 0.3 + this.p.effort * 0.5) out();
      else if (smart) back();
      return;
    }
    if (pos.sub === 'exposed' || pos.sub === 'spladle') { if (this.edgeRoll < 0.35) out(); return; }
    const trouble = pos.base < 0.5 || (pos.legRide ?? 0) > 0.5 || pos.control > 0.6;
    if ((pos.sub === 'ride' || pos.sub === 'flat') && trouble && smart) out();
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

  private mashBeat(effort = 1): boolean {
    if (this.mashT > 0) return false;
    this.mashT = (1 / (this.p.mash * effort)) * (0.7 + this.rng.next() * 0.6);
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
      // Commit to a direction: circle for a couple of seconds, usually the same way,
      // and now and then stop to set the feet instead of reversing on the spot.
      this.circleT = 1.4 + this.rng.next() * 2;
      const r = this.rng.next();
      this.circleDir = r < 0.3 ? 0 : r < 0.52 ? -(this.circleDir || 1) : (this.circleDir || (this.rng.next() < 0.5 ? -1 : 1));
      const tired = me.stamina < 0.3;
      // A hand fighter steps in to tie up (HAND_FIGHT.close) instead of hanging at the edge of range.
      this.wantDist = tired ? 1.5 : !this.classicPace && this.rng.next() < this.p.handfight * HAND_FIGHT.close ? HAND_FIGHT.closeDist : 0.85 + this.rng.next() * 0.4;
      this.bailOut = !!bout.plans[this.side].protect && this.rng.next() < 0.3;
      this.circlesOff = this.rng.next() < 0.45 + this.p.effort * 0.7;
    }
    // Stay off the edge.
    const r = Math.hypot(me.pos.x, me.pos.z);
    let inward = 0;
    if (r > 3.6) inward = (r - 3.6) * 1.5;

    // Close or open the gap gently; a hair off the ideal distance is not worth a step.
    const gap = dist - this.wantDist;
    let fwd = Math.abs(gap) < 0.08 ? 0 : Math.max(-1, Math.min(1, gap * 1.5));
    // In a tie-up: lean on him, or pull back to bait the snap.
    if (dist < 0.85 && this.pushT <= 0) {
      this.pushT = 0.8 + this.rng.next() * 1.2;
    }
    if (dist < 0.85) fwd = this.pushT > 0.5 ? 0.6 : -0.2;
    const style = bout.wrestlers[this.side].motion;
    const activity = heavyweightActivity(bout.wrestlers[this.side]);
    // His corner's plan: chase or sit on it, and which attack to look for.
    const plan = bout.plans[this.side];
    // Protecting a big lead, he picks his shots: about half as many attacks.
    const planRate = (plan.style === 'aggressive' ? 1.25 : plan.style === 'defensive' ? 0.75 : 1) * (plan.protect ? 0.35 : 1);
    // The referee's stall clock running on him: he goes looking for a shot, as a wrestler does after a warning.
    const urgency=lateAttackUrgency(`${bout.wrestlers[this.side].firstName} ${bout.wrestlers[this.side].lastName}`,context)
      * (bout.athletes[this.side].stallTimer > 2 ? 1.35 : 1);
    fwd *= (style?.pressure ?? 1) * activity.pressure;
    // A defensive corner keeps its distance and gives ground (and gets warned for it);
    // an aggressive one walks him down.
    if (plan.style === 'defensive') fwd = fwd > 0 ? fwd * 0.6 : fwd - 0.25;
    else if (plan.style === 'aggressive' && fwd > 0) fwd *= 1.2;
    if(urgency>1) fwd=Math.max(fwd,0.45);
    let lat = this.circleDir * 0.32 * (style?.circle ?? 1);
    // The edge on the feet (owner, November 10). A pressure wrestler walks a man with his back to the line
    // straight out, so that giving ground is a stalling call on him; protecting a lead, a wrestler near the
    // line sometimes backs out to kill the action (and risks the same call).
    const theirR = Math.hypot(them.pos.x, them.pos.z);
    const presser = GABLE_PRESSURE_NAMES.has(`${bout.wrestlers[this.side].firstName} ${bout.wrestlers[this.side].lastName}`)
      || plan.style === 'aggressive' || (style?.pressure ?? 1) > 1.1;
    if (presser && theirR > MAT.circleRadius - 1.6 && theirR > r + 0.3 && dist < 1.3) { fwd = Math.max(fwd, 0.85); lat = 0; }
    if (this.bailOut && r > MAT.circleRadius - 0.9 && dist < 1.2 && theirR < r) { fwd = -0.8; inward = 0; }
    else if (this.circlesOff && r > MAT.circleRadius - 1.3 && theirR < r - 0.2 && dist < 1.6) { fwd = Math.max(fwd, 0); lat = (this.circleDir || 1) * 0.85; }
    // Ease the stick toward the new intent so direction changes are steps, not snaps.
    const wantX = nx * fwd + nz * lat - (me.pos.x / (r || 1)) * inward;
    const wantZ = nz * fwd - nx * lat - (me.pos.z / (r || 1)) * inward;
    const ease = 1 - Math.exp(-dt / 0.3);
    this.moveX += (wantX - this.moveX) * ease;
    this.moveZ += (wantZ - this.moveZ) * ease;
    cmd.moveX = this.moveX;
    cmd.moveZ = this.moveZ;
    // Sink the level when he is close and threatening; decided, not flickered.
    this.levelT -= dt;
    if (this.levelT <= 0) {
      this.levelT = 0.8 + this.rng.next() * 1.2;
      this.lowLevel = dist < 1.3 && this.rng.next() < 0.5 + this.p.patience * 0.3;
    }
    cmd.level = this.lowLevel && dist < 1.4;

    // Bite on a fake now and then.
    // Tired, he bites more often (owner: fatigue).
    if (them.act === 'fake' && them.actT < 0.05 && this.rng.next() < this.p.gullible * (1 + (1 - bout.athletes[this.side].stamina))) {
      this.sprawlIn = this.p.reaction * 0.8;
    }

    // Set it up, then shoot: right after his own fake he often follows with the real thing while the
    // opponent is still up from the bite (the fake's quality bonus makes it a good shot). Checked every
    // frame, once per fake, so the follow-up is not lost waiting for the next decision.
    // Never into a sprawl: if he bit and his hips are back, wait for him to come back up (or reach), which
    // is the opening the fake was for; if he did not bite, a follow-up is just an ordinary shot.
    if (!this.classicPace && me.act === 'stance' && me.cooldown <= 0 && me.sinceFake > 0.12 && me.sinceFake < 1.3 && !this.fakeFollowed
      && them.act !== 'sprawl') {
      const bit = them.act === 'sprawlRecover' || them.act === 'reach' || them.act === 'headUp';
      if (bit || me.sinceFake > 0.45) {
        this.fakeFollowed = true;
        const inReach = dist > 0.62 && dist < 1.35;
        if (inReach && me.stamina > 0.22 && this.rng.next() < (bit ? 0.28 + this.p.aggression * 0.35 : 0.05 + this.p.aggression * 0.12) * (bout.plans[this.side].protect ? 0.25 : 1)) { cmd.shoot = true; return; }
      }
    }
    if (me.sinceFake > 1.4) this.fakeFollowed = false;
    // Reshot (owner, November 9; Cary Kolat's reshot drill). His bad shot left him stumbling up off
    // balance: go, once, after a human beat to see it. Or my own sound shot was blocked and he is still
    // coming up out of the block: chain straight into another.
    const hisWindow = (them.reshot ?? 0) > 0 && them.act === 'stagger';
    const myChain = (me.chain ?? 0) > 0 && them.act === 'sprawlRecover';
    if ((hisWindow || myChain) && !this.reshotTried) {
      this.reshotIn ??= this.p.reaction * 0.7 + this.rng.next() * 0.15;
      this.reshotIn -= dt;
      if (this.reshotIn <= 0 && me.act === 'stance' && me.cooldown <= 0) {
        this.reshotTried = true;
        if (dist > 0.6 && dist < 1.4 && me.stamina > 0.22 && this.rng.next() < (hisWindow ? 0.3 + this.p.aggression * 0.3 : 0.2 + this.p.aggression * 0.3) * (bout.plans[this.side].protect ? 0.25 : 1)) { cmd.shoot = true; return; }
      }
    } else if (!hisWindow && !myChain) { this.reshotTried = false; this.reshotIn = undefined; }
    // Pounce (owner, November 11: explosive moves when well timed). His reach or snap is a live opening for a
    // moment; a good wrestler goes right then, a human beat after seeing it, instead of at his next decision when it
    // has passed. Once per opening. The shot is then a TIMING burst.
    const live = !this.classicPace && (them.act === 'reach' || them.act === 'snap') && them.actT < 0.5;
    if (live && !this.pounceTried) {
      this.pounceIn ??= this.p.reaction * 0.6 + this.rng.next() * 0.12;
      this.pounceIn -= dt;
      if (this.pounceIn <= 0 && me.act === 'stance' && me.cooldown <= 0) {
        this.pounceTried = true;
        if (dist > 0.62 && dist < 1.3 && me.stamina > 0.22
          && this.rng.next() < POUNCE.base + this.p.aggression * POUNCE.aggression * (bout.plans[this.side].protect ? 0.25 : 1)) { cmd.shoot = true; return; }
      }
    } else if (!live) { this.pounceTried = false; this.pounceIn = undefined; }
    // Throw him off his own drive (THROW_PUSH): with the grip for it and him pushing in hard, go right then, once per
    // push, not at the next decision.
    const push = this.classicPace ? 0 : bout.pushingIn(them, me);
    if (push > 0.55 && !this.throwTried && me.act === 'stance' && me.cooldown <= 0 && me.stamina > 0.25) {
      this.throwTried = true;
      const lock = me.hand >= 0.62 && me.tie === 'bodyLock';
      const overhook = them.hand >= 0.62 && (them.tie === 'underhook' || them.tie === 'bodyLock');
      if (lock && this.rng.next() < (0.35 + this.p.aggression * 0.3) * this.throwKeen(bout)) { cmd.technique = 'lateralDrop'; return; }
      if (overhook && this.rng.next() < (0.12 + this.p.aggression * 0.2) * this.throwKeen(bout)) { cmd.technique = 'headlock'; return; }
    } else if (push < 0.3) this.throwTried = false;
    // Hand-fight exchanges (HAND_FIGHT): keep fighting the wrists a beat after the last hand fight, not only at the
    // next decision.
    if (this.chainLeft > 0) {
      this.chainT -= dt;
      if (this.chainT <= 0 && me.act === 'stance' && me.cooldown <= 0) {
        if (dist < BOUT.tieRange + 0.2 && me.stamina > 0.2 && !(me.hand >= 0.62 && (me.tie === 'underhook' || me.tie === 'bodyLock'))) {
          cmd.fight = true;
          this.chainLeft--;
          this.chainT = HAND_FIGHT.gap[0] + this.rng.next() * (HAND_FIGHT.gap[1] - HAND_FIGHT.gap[0]);
          return;
        }
        this.chainLeft = 0;
      }
    }
    if (me.act !== 'stance' || me.cooldown > 0 || this.decideT > 0) return;
    // A real neutral exchange is constant: hands, a fake, a look, a shot. Decide about every 1.25 s
    // (was every 2.1 s, which left long stretches of two men circling; owner: "too slow, few attacks").
    this.decideT = (this.classicPace ? 1.4 + this.rng.next() * 1.4 : 0.8 + this.rng.next() * 0.9) / ((style?.tempo ?? 1)*urgency);

    // A look at the legs: how good would a shot be right now?
    const opening =
      Math.max(0, them.lean) * 0.8 +
      Math.max(0, them.level - 0.5) * 0.8 +
      (them.act === 'reach' || them.act === 'stagger' || them.act === 'sprawlRecover' || them.act === 'snap' ? 0.6 : 0) +
      (me.hand - them.hand) * 0.3 +
      (me.sinceFake < 1 ? 0.25 : 0);
    const inRange = dist > 0.62 && dist < 1.25;
    // An aggressive corner keeps him shooting even when he is gassed: that is where the bad shots come from.
    const tired = me.stamina < (plan.style === 'aggressive' ? 0.12 : 0.22);
    if (!tired && context?.finalPeriod && context.timeLeft <= 20 && context.deficit > 0 && dist < 1.4 && this.rng.chance(0.08)) {
      cmd.technique = 'superDuck'; return;
    }
    if (!tired && dist < 1.05 && me.hand >= 0.35 && this.rng.chance(plan.focus === 'ties' ? 0.05 : 0.025)) {
      const r=this.rng.next();
      cmd.technique=isFootSweepSpecialist(bout.wrestlers[this.side]) && r<0.7 ? 'footSweep' : r<0.45?'duckUnder':r<0.85?'slideBy':'firemansCarry'; return;
    }

    // Per decision, the shot chances are trimmed so the faster decisions keep the overall shot rate near
    // the old one; the extra activity is hand fighting, fakes and set-up shots.
    const coldTrim = this.classicPace ? 1 : 0.55;
    // Set it up first (owner, November 10: lazy shots get stopped and countered). With nothing to shoot off,
    // a disciplined wrestler fakes to make the opening instead; the better the level, the more often.
    const setUpFirst = () => !this.classicPace && !bout.shotSetUp(this.side) && this.rng.next() < 0.3 + this.p.patience * 1.5;
    if (inRange && !tired && opening > 0.2 + this.p.patience * 0.8 && this.rng.next() < this.p.aggression * 0.18 * coldTrim * (style?.attackRate ?? 1) * activity.attack * urgency * planRate) {
      if (setUpFirst()) cmd.fake = true; else cmd.shoot = true;
      return;
    }
    if (inRange && !tired && this.rng.next() < this.p.aggression * 0.032 * coldTrim * (bout.wrestlers[this.side].shotPressure ?? 1) * (1 - this.p.patience) * (style?.attackRate ?? 1) * activity.attack * urgency * planRate) {
      if (setUpFirst()) cmd.fake = true; else cmd.shoot = true;
      return;
    }
    // The clinch (owner, November 9: upper-body throws and pummeling as real options). Double unders: throw
    // him. One underhook: sometimes pummel the second arm in (low) for the body lock. His underhook on me:
    // swim back inside, or now and then the headlock over it (risky: a miss gives up the back).
    const clinch = dist < BOUT.tieRange + 0.15;
    const hisHooks = them.hand >= 0.62 && (them.tie === 'underhook' || them.tie === 'bodyLock');
    // With ties common (TIE_UP) the AI throws mostly off his drive (the block above); into a man standing his ground it
    // is a rarer gamble, and the body lock is worked for, not taken at every decision.
    if (clinch && me.hand >= 0.62 && me.tie === 'bodyLock' && !tired && this.rng.next() < HAND_FIGHT.coldDrop * (0.6 + this.p.aggression) * this.throwKeen(bout)) {
      cmd.technique = 'lateralDrop'; return;
    }
    if (clinch && me.hand >= 0.62 && me.tie === 'underhook' && !tired && this.rng.next() < HAND_FIGHT.lockPummel * (plan.focus === 'ties' ? 1.4 : 1) * this.throwKeen(bout)) {
      this.lowLevel = true; this.levelT = 0.6; cmd.level = true; cmd.fight = true; return;
    }
    if (clinch && hisHooks && !(me.hand >= 0.62 && me.tie === 'underhook')) {
      if (!tired && this.rng.next() < HAND_FIGHT.coldHeadlock * (0.5 + this.p.aggression * 0.7) * this.throwKeen(bout)) { cmd.technique = 'headlock'; return; }
      if (this.rng.next() < 0.45 + this.p.handfight * 0.3) { cmd.fight = true; return; }
    }
    if (me.hand >= 0.62 && me.tie !== 'bodyLock' && (them.lean > 0.15 || them.level > 0.55) && this.rng.next() < (plan.focus === 'snap' ? 0.75 : 0.55)) {
      cmd.fight = true;
      return;
    }
    // A collar tie is a high-crotch setup: the tie pulls his head and the near leg comes with it.
    if (!this.classicPace && clinch && me.hand >= 0.62 && me.tie === 'collar' && !tired && this.rng.next() < 0.05 + this.p.aggression * 0.08) {
      cmd.shoot = true;
      return;
    }
    // Tied up head to head (owner playtest, November 11): pummel low for the underhook, the fight for inside position.
    if (clinch && me.hand >= 0.62 && me.tie === 'collar' && !tired && this.rng.next() < HAND_FIGHT.pummel) {
      this.lowLevel = true; this.levelT = 0.6; cmd.level = true; cmd.fight = true; return;
    }
    // Fighting for the tie starts an exchange (HAND_FIGHT.chain); tied, the same button is a snap, which does not chain.
    const startChain = () => {
      if (!this.classicPace && me.hand < 0.62 && this.rng.next() < HAND_FIGHT.chain) {
        this.chainLeft = 1 + Math.floor(this.rng.next() * (HAND_FIGHT.max - 1));
        this.chainT = HAND_FIGHT.gap[0] + this.rng.next() * (HAND_FIGHT.gap[1] - HAND_FIGHT.gap[0]);
      }
    };
    // Holding an underhook or a body lock the same button throws; plain hand fighting must not fire it by accident
    // (owner playtest, November 11: ties are common now). He keeps the grip and throws only by choice (above).
    const holdingHooks = me.hand >= 0.62 && (me.tie === 'underhook' || me.tie === 'bodyLock');
    if (!holdingHooks && dist < BOUT.tieRange + 0.1 && this.rng.next() < this.p.handfight * (this.classicPace ? 0.25 : HAND_FIGHT.inRange) * (style?.handActivity ?? 1)) {
      cmd.fight = true;
      // Some of his presses in close step in and tie up (TIE_UP), the rest are hand fighting as before.
      if (me.hand < 0.62 && this.rng.next() < HAND_FIGHT.tieUp * (1 + STYLE_EFFECT.brawlTie * styleStep(bout.wrestlers[this.side], 'brawler'))) cmd.tieUp = true;
      // About a third of the clinch hand fighting is pummeling low for the underhook, not reaching for the head.
      if (!this.classicPace && me.hand < 0.62 && this.rng.next() < 0.35) { this.lowLevel = true; this.levelT = 0.6; cmd.level = true; }
      startChain();
      return;
    }
    // From a step outside, fight for the hands too: reach, swat, bring the tie.
    if (!this.classicPace && !holdingHooks && dist < BOUT.tieRange + 0.4 && this.rng.next() < this.p.handfight * HAND_FIGHT.outside * (style?.handActivity ?? 1)) {
      cmd.fight = true;
      startChain();
      return;
    }
    if (this.classicPace) { if (dist > 1.3 && dist < 1.7 && this.rng.next() < 0.06) cmd.shoot = true; return; } // the old fake
    // A level-change fake from his normal distance: sells the shot, reads the reaction, and sets up the real
    // one (see the follow-up above). Good wrestlers fake constantly; about one in five decisions.
    if (dist > 0.7 && dist < 1.6 && this.rng.next() < 0.2 + this.p.aggression * 0.2) cmd.fake = true;
  }

  /* -------------------------------------------------------------- legs */

  private legs(bout: Bout, cmd: Command, attacking: boolean): void {
    const me = bout.athletes[this.side];
    const them = bout.athletes[otherSide(this.side)];
    if (attacking) {
      const pos = bout.position;
      if (pos.kind === 'legs' && (pos.shot === 'single' || pos.shot === 'highCrotch')) {
        // Choose once per capture: finish the movement instead of changing
        // grips every frame. Low gas or an almost-won leg needs a simple drive.
        if (!this.legFinishChoice) {
          const doublePreference = bout.wrestlers[this.side].motion?.shots.double ?? .45;
          const roll = this.rng.next();
          this.legFinishChoice = me.stamina < .35 || pos.progress > .75 ? 'drive'
            : roll < .45 ? 'trip' : roll < .45 + doublePreference * .5 ? 'double' : 'drive';
        }
        cmd.legAction = me.stamina > .15 ? this.legFinishChoice : 'drive';
      }
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
      // Now and then a counter instead (the position picks which): crackdown early, sit-through on a deep
      // single, a scramble roll when all but finished (scramble specialists far more often).
      const pos = bout.position;
      const counter = pos.kind === 'legs' && (pos.counterCool ?? 0) <= 0 ? legCounterFor(pos) : null;
      if (counter) {
        const me = bout.wrestlers[this.side];
        const chance = me.signature?.legCounter === counter ? 0.35
          : counter === 'scrambleRoll' ? (isScrambleSpecialist(`${me.firstName} ${me.lastName}`) ? 0.35 : 0.08 + 0.06 * Math.max(0, gradeStep(me, 'scrambling')))
          : counter === 'sitThrough' ? 0.25 : 0.16;
        if (this.rng.next() < chance) { cmd.shoot = true; return; }
      }
    }
    if (this.legDefense) {
      cmd[this.legDefense] = true;
      cmd.sustainedEffort = true;
    }
  }

  /* ------------------------------------------------------- front headlock */

  private fhl(bout: Bout, cmd: Command, top: boolean, recover: number): void {
    if (top) {
      if (this.decideT <= 0) {
        this.decideT = 0.9 + this.rng.next() * 0.8;
        const pos = bout.position;
        const driving = pos.kind === 'fhl' && (pos.drive ?? 0) > 0.45;
        const mat = bout.wrestlers[this.side].attributes.mat;
        // He is driving in to dig out: sometimes shuck him by.
        if (driving && this.rng.next() < 0.5) cmd.sprawl = true;
        // Half way up: chin whip now and then rather than snapping him back first.
        else if (recover >= 0.5 && recover < 0.8 && this.rng.next() < 0.3) cmd.shoot = true;
        // A signature go-behind man spins as soon as he has him down rather than snapping again.
        else if (recover > 0.55 || this.rng.next() < (bout.wrestlers[this.side].signature?.fhl === 'goBehind' ? 0.15 : 0.35)) cmd.fight = true;
        else {
          cmd.shoot = true;
          // Broken down flat: a strong mat man sometimes goes for the cement mixer.
          if (recover < 0.4 && this.rng.next() < 0.2 + mat * 0.25) cmd.level = true;
        }
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
      // A strong mat man rides legs on about one ride in five: legs in held, then the turk off them.
      if (this.legRideFor !== pos) {
        this.legRideFor = pos;
        // A signature leg rider throws them in on most rides.
        this.ridingLegs = bout.wrestlers[this.side].signature?.legRider ? this.rng.next() < 0.7 : bout.wrestlers[this.side].attributes.mat >= 0.8 && this.rng.next() < 0.2;
      }
      if (this.ridingLegs && (pos.sub === 'ride' || pos.sub === 'flat') && me.stamina > 0.2) cmd.legRide = true;
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
        // Mat return depth: the trip (quick, cheap, lands him on his hands) as well as the crotch lift.
        if (!cmd.sprawl) { if (this.rng.next() < 0.45) cmd.shoot = true; else cmd.fight = true; }
        return;
      }
      // A turn started at the line ends out of bounds: ride him tight while edgeTactics drags him back in.
      if (edgeDistance(pos.frame.x, pos.frame.z) < 1.3) { cmd.sprawl = true; return; }
      if (pos.sub === 'flat') {
        // Flat on his back with no legs in is riding parallel: the official's patience is shorter (PARALLEL_STALL).
        const flatGrace = topPlanEffects(bout.plans[this.side]).stallGrace * ((pos.legRide ?? 0) >= 0.8 ? 1 : PARALLEL_STALL.grace);
        const riding = topPlanOf(bout.plans[this.side]) === 'ride' && me.stallTimer < 4 && (bout.plans[this.side].protect || me.sinceTurnTry < flatGrace - 3);
        if (pos.control < 0.35 || riding && this.rng.next() < 0.75) cmd.sprawl = true;
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
      // Riding him out (a Ride plan): stay tight and on top of him rather than turning, until the
      // referee's patience runs short; then break him down and try a turn to clear the stall clock.
      const tplan = topPlanOf(bout.plans[this.side]);
      // Protecting a lead he waits for the referee's warning before he risks a turn.
      // (The referee's clock right now, not whether he was ever warned: one early warning on the feet
      // used to make every later ride a turning ride.)
      const nearCall = me.stallTimer >= 4;
      const mustTry = nearCall || !bout.plans[this.side].protect && me.sinceTurnTry > topPlanEffects(bout.plans[this.side]).stallGrace - 3;
      // A signature leg rider rides by turking off the legs, so with them in he goes for it even on a Ride plan.
      const turkMan = !!bout.wrestlers[this.side].signature?.legRider && (pos.legRide ?? 0) >= 0.8;
      if (tplan === 'ride' && !mustTry && !turkMan) {
        if (me.stamina < 0.2 || pos.control < 0.6 || this.rng.next() < 0.6) cmd.sprawl = true;
        else cmd.fight = true;
        return;
      }
      // Legs in: chop the far arm to break his base, then turk him.
      if ((pos.legRide ?? 0) >= 0.8 && pos.base >= BOUT.turkBase && this.rng.next() < 0.7) { cmd.fight = true; this.decideT = 0.25 + this.rng.next() * 0.15; return; }
      if ((pos.base < 0.32 || (pos.legRide ?? 0) >= 0.8 && pos.base < BOUT.turkBase) && pos.turnCool <= 0) {
        // Bar specialists finish the breakdown before committing their arm control.
        // With the legs in the turn is the turk, bar man or not.
        if(isArmBar(style?.preferredTurn)&&(pos.legRide??0)<0.8)cmd.fight=true;else cmd.shoot=true;
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
    if (pos.sub === 'flat') this.wasFlat = true;
    else if (pos.sub !== 'ride') this.wasFlat = false;
    if ((pos.sub === 'exposed' || pos.sub === 'spladle') || pos.sub === 'flat') {
      // A wrestler fights hardest on his back; without this every turn is a pin.
      // Flat: he keeps working up (owner, November 10: up and moving, not lying on his belly).
      if (this.mashBeat(pos.sub === 'flat' ? (this.p.effort >= 0.6 ? 1.7 : 1.35) : bout.wrestlers[this.side].survival ?? 1.6)) cmd.sprawl = true;
      return;
    }
    if (pos.sub === 'standing') {
      if (this.mashBeat()) {
        if (pos.escape >= BOUT.turnOut) cmd.shoot = true;
        else {
          cmd.fight = true;
          // Now and then, once the lock is loosening, the standing switch instead of peeling the hands.
          if (pos.escape > 0.25 && this.rng.next() < 0.1) cmd.level = true;
        }
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
    // Owner, November 10: a stand-up is often an explosive move right off the whistle.
    if ((pos.whistle ?? 0) > 0 && !this.whistleRead) {
      this.whistleRead = true;
      if (pos.base > 0.42 && this.rng.next() < 0.35 + 0.25 * this.p.effort) {
        cmd.shoot = true;
        this.bottomWait = 0;
        return;
      }
    }
    if ((pos.whistle ?? 0) <= 0) this.whistleRead = false;
    if (this.switchIn >= 0 || this.decideT > 0) return;
    this.decideT = 0.35 + this.rng.next() * 0.5;
    // Nobody sits on the bottom rebuilding for long. After a few quiet seconds he goes for it
    // as soon as he has enough base for it to work; off less it would only cost him the base.
    this.bottomWait += 1;
    if (this.wasFlat) { this.wasFlat = false; this.bottomWait = 99; }
    // (Owner, November 10: the bottom man should be up and moving; this was 3 + 1.5 / effort + up to 2 beats.)
    if (this.bottomWait >= 1.5 + 1 / this.p.effort + this.rng.next() * 1.5 && pos.base > 0.42) {
      // Hands first (owner: stand-ups work off back pressure and hand control), then up.
      if (pos.commit < 0.3 && (pos.hands ?? 0) < 0.35 && this.rng.next() < 0.75) {
        cmd.fight = true;
        this.decideT = 0.18 + this.rng.next() * 0.12;
        return;
      }
      this.bottomWait = 0;
      if (pos.commit >= 0.4) cmd.fight = true;
      else cmd.shoot = true;
      return;
    }
    // Now and then he sits out instead of standing.
    // (About one in four of those a Granby roll, best right after his drive.)
    const granbyMan = bout.wrestlers[this.side].signature?.bottom === 'granbyRoll';
    // (Owner, November 10: more stand-ups and sit-outs; this was 0.12 / 0.08.)
    if (pos.base > 0.5 && this.rng.next() < (granbyMan ? 0.18 : 0.14)) { cmd.sitOut = true; cmd.level = granbyMan || pos.commit > 0.3 || this.rng.next() < 0.25; this.bottomWait = 0; return; }
    // Build the base first; stand when he has loosened up.
    if (pos.base < 0.6) cmd.sprawl = true;
    else if (this.rng.next() < 0.35 + (1 - pos.control) * 0.5) { cmd.shoot = true; this.bottomWait = 0; }
    else cmd.sprawl = true;
  }
}
