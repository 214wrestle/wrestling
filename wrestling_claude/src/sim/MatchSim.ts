import {isArmBar,ARM_BAR_GRIP_RELEASE} from './armBars';
import { wrestlerFamilyNote, morenoMatchupNote } from './easterEggs';
import {
  MAT,
  POINTS,
  REFEREES,
  type RefereeStall,
  RIDING_TIME_THRESHOLD,
  STALL_WARNING_SECONDS,
  TECH_FALL_MARGIN,
  classifyDecision,
  isSuddenVictory,
  overtimePart,
  overtimeRound,
  periodLength,
  TIEBREAKER_RIDING_EDGE,
} from './rules';
import type { WinType } from './rules';
import { Bout, Rng } from './bout';
import type { BoutEvents } from './bout';
import {CRADLE_GRIP_RELEASE,type MoveDef} from './moves';
import { otherSide } from './types';
import { adaptPlan, planEffects, topPlanEffects, topPlanOf, type MatchPlan } from './strategy';
import type {
  Announcement,
  Command,
  MatchPhase,
  MatchResult,
  ScoreEvent,
  ScoreKind,
  Side,
  StartPosition,
  Vec2,
  Wrestler,
} from './types';

/**
 * The referee and the clock.
 *
 * MatchSim runs the presentation of a collegiate bout — walk-out, handshake,
 * coin toss, three periods with the position choice, overtime — and keeps the
 * book: score, riding time, stalling. The wrestling itself happens in `Bout`.
 */

export interface SimListeners {
  onScore?: (e: ScoreEvent) => void;
  onAnnounce?: (a: Announcement) => void;
  onMove?: (def: MoveDef, actor: Side) => void;
  onImpact?: (strength: number, at: Vec2, slowmo: boolean) => void;
  onWhistle?: (reason: string) => void;
  onPhase?: (phase: MatchPhase, previous: MatchPhase) => void;
  onResult?: (result: MatchResult) => void;
  onTell?: (to: Side, what: 'shot' | 'fake' | 'opening' | 'snap' | 'switch' | 'standup') => void;
  onFeedback?: (side: Side, button: 'shoot' | 'fight' | 'sprawl', result: 'ok' | 'won' | 'lost' | 'blocked', label?: string) => void;
  /** The referee tells a wrestler to work (his stall clock is building) or signals a stalling call. */
  onRefCue?: (side: Side, cue: 'work' | 'stall') => void;
}

const SCORE_LABELS: Record<ScoreKind, string> = {
  takedown: 'Takedown',
  escape: 'Escape',
  reversal: 'Reversal',
  nearFall2: 'Near Fall',
  nearFall3: 'Near Fall',
  nearFall4: 'Near Fall',
  penalty: 'Penalty',
  stalling: 'Stalling',
  ridingTime: 'Riding Time',
};

const SCORE_POINTS: Record<ScoreKind, number> = {
  takedown: POINTS.takedown,
  escape: POINTS.escape,
  reversal: POINTS.reversal,
  nearFall2: POINTS.nearFall2,
  nearFall3: POINTS.nearFall3,
  nearFall4: POINTS.nearFall4,
  penalty: POINTS.penalty,
  stalling: POINTS.stalling,
  ridingTime: POINTS.ridingTime,
};

export const STALL_POINT_AT = 11;
/** Flat on his belly (owner, November 10): after `after` seconds (times the referee's patience) the stall count runs
 *  at `rate`; while he is pushing up, those seconds pass at `pushing` speed. */
export const FLAT_STALL = { after: 4, pushing: 0.4, rate: 0.75 };
/**
 * Stalling on the feet against a man making the match (owner, November 10). Giving ground: his drive under backDrive
 * while the other man's is over pressDrive. One-sided: the other man's recent attacks (fading over `memory` s) at least
 * attackGap more than his, and none of his own for `quiet` s; or moving backwards faster than backSpeed m/s while he
 * comes forward. Rates are stall seconds per second, by the referee's rate.
 */
export const STALL_FEET = { backDrive: -0.15, pressDrive: 0.2, givingRate: 0.55, oneSidedRate: 0.35, attackGap: 3, quiet: 15, memory: 75, slowFade: 0.3, backSpeed: 0.25, unanswered: 5, unansweredStrict: 4 };
/** After a whistle: seconds to get up, then each walks to his side of the center at his own pace. */
export const RETURN_RISE = 0.8;
const RETURN_MARK = [-0.9, 0.9] as const;
/** Owner, November 10: after a whistle they run back to the center (they were walking it). A fresh man runs it
 *  (about 2.9 m/s), a gassed one still jogs (1.9 m/s). */
export const returnSpeed = (stamina: number): number => 1.9 + 1.0 * Math.max(0, Math.min(1, (stamina - 0.15) / 0.5));

export class MatchSim {
  private preWhistleCut = false;
  get topRestartCut(): boolean { return this.preWhistleCut; }
  chooseTopRestart(cut: boolean): void {
    if (this.phase === 'setPosition' && this.bout.top === this.humanSide) this.preWhistleCut = cut;
  }
  readonly wrestlers: [Wrestler, Wrestler];
  readonly bout: Bout;

  phase: MatchPhase = 'attract';
  phaseT = 0;
  phaseDur = Infinity;

  period = 1;
  clock = periodLength(1);
  score: [number, number] = [0, 0];
  /** Net advantage time for side 0; negative favours side 1. */
  ridingTime = 0;
  periodPoints: [number, number] = [0, 0];
  result: MatchResult | null = null;
  coinTossWinner: Side;
  /** Dual meet (owner, November 10): the second-period choice comes from the dual's coin toss, not one in this bout. */
  presetChoice: Side | null = null;
  awaitingChoiceFrom: Side | null = null;
  nextStartPosition: StartPosition = 'neutral';
  lastChoiceBy: Side | null = null;
  scoreLog: ScoreEvent[] = [];
  humanSide: Side = 0;
  /** Seconds in neutral since each wrestler last attempted an attack (stalling). */
  private sinceAttack: [number, number] = [0, 0];
  /** Seconds between periods. The game lengthens it so the player can change the plan. */
  breakSeconds = 2.6;
  /** Set a corner's match plan (walk-out, between periods). */
  setPlan(side: Side, plan: MatchPlan): void { this.bout.plans[side] = plan; }
  plan(side: Side): MatchPlan { return this.bout.plans[side]; }
  /** Quick matches shorten every period. */
  lengthScale = 1;
  /** Cooperative drills have no period time limit. */
  practice = false;

  private listeners: SimListeners;
  private eventId = 1;
  private pendingNearFall: {side:Side;kind:'nearFall2'|'nearFall3'|'nearFall4'} | null = null;
  private restart: { pos: StartPosition; top: Side } = { pos: 'neutral', top: 0 };
  /** Who has the choice in the current overtime round's tiebreaker, and whether he deferred it to the second half. */
  tbChooser: Side | null = null;
  tbDeferred = false;
  private rng: Rng;
  /** This match's official and how he reads stalling. */
  readonly referee: RefereeStall;

  constructor(wrestlers: [Wrestler, Wrestler], listeners: SimListeners = {}, seed = Date.now() & 0xffffff) {
    this.wrestlers = wrestlers;
    this.listeners = listeners;
    this.rng = new Rng(seed ^ 0x51ed);
    {
      // Drawn from its own stream so the rest of the match's randomness is unchanged.
      const roll = new Rng(seed ^ 0x7e1f).next();
      let acc = 0;
      this.referee = REFEREES[REFEREES.length - 1].ref;
      for (const r of REFEREES) { acc += r.weight; if (roll < acc) { this.referee = r.ref; break; } }
    }
    const ev: BoutEvents = {
      score: (side, kind, detail) => {
        if(kind==='nearFall2'||kind==='nearFall3'||kind==='nearFall4') this.pendingNearFall={side,kind};
        else {this.releaseNearFall(); if(!this.result)this.award(side,kind,detail);}
      },
      announce: (text, tone, detail) => this.announce({ text, tone, detail, hold: 1.1 }),
      impact: (s, at, slowmo) => listeners.onImpact?.(s, at, slowmo),
      move: (def, A) => {
        // Any attack resets his passivity clock for stalling.
        if (/^(shot|duckUnder|superDuck|slideBy|firemansCarry|footSweep|anklePick|kneePick|throwBy|lateralDrop|headlockThrow|snapDown)/.test(def.id)) {
          this.sinceAttack[A] = 0;
          this.attackLoad[A] += 1;
          this.unansweredAttack(A, /^shot/.test(def.id));
        }
        listeners.onMove?.(def, A);
      },
      whistle: (reason) => this.whistle(reason),
      call: (kind, side) => this.refCall(kind, side),
      fall: (winner) => this.finish(winner, 'fall'),
      tell: (to, what) => listeners.onTell?.(to, what),
      feedback: (side, button, result, label) => listeners.onFeedback?.(side, button, result, label),
    };
    this.bout = new Bout(wrestlers, ev, seed);
    // Drawn after period one; unused beforehand.
    this.coinTossWinner = 0;
    this.layoutIntro();
  }

  /* ------------------------------------------------------------ lifecycle */

  startIntros(): void {
    this.setPhase('intros', 9.2);
    this.layoutIntro();
    const [a, b] = this.wrestlers;
    const family = morenoMatchupNote(a, b) ?? wrestlerFamilyNote(a) ?? wrestlerFamilyNote(b);
    if (family) this.announce({ text: 'Wrestling family connection', detail: family, tone: 'info', hold: 7 });
  }

  skipIntros(): void {
    if (this.phase === 'intros') this.phaseT = this.phaseDur;
  }

  /** The toss winner deferred: the other wrestler chooses for period 2, the winner for period 3. */
  deferred = false;
  /** Only the toss winner, only for the period-2 choice, only once. */
  get canDefer(): boolean {
    if (this.phase !== 'positionChoice') return false;
    // Overtime: the wrestler with the tiebreaker choice may defer it to the second half (Rule 3.14.3).
    if (this.period >= 4) return overtimePart(this.period) === 0 && this.awaitingChoiceFrom === this.tbChooser && !this.tbDeferred;
    return this.period === 1 && this.awaitingChoiceFrom === this.coinTossWinner && !this.deferred;
  }

  choosePosition(pos: StartPosition | 'defer'): void {
    if (this.phase !== 'positionChoice' || this.awaitingChoiceFrom === null) return;
    if (pos === 'defer') {
      if (!this.canDefer) return;
      this.defer();
      return;
    }
    this.applyChoice(this.awaitingChoiceFrom, pos);
  }

  private defer(): void {
    this.awaitingChoiceFrom = null;
    if (this.period >= 4 && this.tbChooser !== null) {
      this.tbDeferred = true;
      this.announce({ text: `${this.wrestlers[this.tbChooser].lastName} defers`, detail: 'Choice in the second tiebreaker period', tone: 'info', hold: 1.8 });
      this.requestPeriodChoice();
      return;
    }
    this.deferred = true;
    this.announce({ text: `${this.wrestlers[this.coinTossWinner].lastName} defers`, detail: 'Choice in the third period', tone: 'info', hold: 1.8 });
    this.requestPeriodChoice();
  }

  /* ----------------------------------------------------------------- tick */

  tick(dt: number, commands: [Command, Command]): void {
    this.bout.pressLimitedSide = this.humanSide ?? null;
    this.phaseT += dt;
    switch (this.phase) {
      case 'intros':
        this.tickIntros();
        break;
      case 'handshake':
        if (this.phaseT >= this.phaseDur) this.beginPeriod(1);
        break;
      case 'coinToss':
        if (this.phaseT >= this.phaseDur) this.requestPeriodChoice();
        break;
      case 'setPosition':
        if (this.bout.position.kind === 'mat' && commands[this.bout.position.A].level) this.preWhistleCut = true;
        if (this.phaseT >= this.phaseDur) this.goWrestle();
        break;
      case 'wrestling':
        this.tickWrestling(dt, commands);
        break;
      case 'whistle':
        this.tickReturn(dt);
        if (this.phaseT >= this.phaseDur) this.resetToPosition(this.restart.pos, this.restart.top);
        break;
      case 'periodBreak':
        if (this.phaseT >= this.phaseDur) this.advancePeriod();
        break;
      case 'celebration':
        if (this.phaseT >= this.phaseDur) this.setPhase('results', Infinity);
        break;
      default:
        break;
    }
  }

  private setPhase(phase: MatchPhase, dur: number): void {
    const previous = this.phase;
    this.phase = phase;
    this.phaseT = 0;
    this.phaseDur = dur;
    this.listeners.onPhase?.(phase, previous);
  }

  private tickIntros(): void {
    // Walk from the corners to the centre, then stand for the introductions.
    const k = this.walkIn;
    const e = k * k * (3 - 2 * k);
    const [a, b] = this.bout.athletes;
    const prevA = { ...a.pos };
    const prevB = { ...b.pos };
    a.pos = { x: -4.2 + (4.2 - 1.0) * e, z: 1.2 * (1 - e) };
    b.pos = { x: 4.2 - (4.2 - 1.0) * e, z: -1.2 * (1 - e) };
    const dt = 1 / 60;
    a.vel = { x: (a.pos.x - prevA.x) / dt, z: (a.pos.z - prevA.z) / dt };
    b.vel = { x: (b.pos.x - prevB.x) / dt, z: (b.pos.z - prevB.z) / dt };
    if (k < 1) {
      a.yaw = Math.atan2(a.vel.x, a.vel.z) || Math.PI / 2;
      b.yaw = Math.atan2(b.vel.x, b.vel.z) || -Math.PI / 2;
    } else {
      a.yaw += (Math.PI / 2 - a.yaw) * 0.1;
      b.yaw += (-Math.PI / 2 - b.yaw) * 0.1;
      a.vel = { x: 0, z: 0 };
      b.vel = { x: 0, z: 0 };
    }
    if (this.phaseT >= this.phaseDur) {
      // Meet in the middle and shake hands.
      this.bout.setNeutral({ x: 0, z: 0 }, Math.PI / 2, 0.86);
      this.bout.setFree();
      this.setPhase('handshake', 1.7);
    }
  }

  private beginPeriod(period: number): void {
    this.period = period;
    this.clock = periodLength(period) * (period <= 3 ? this.lengthScale : 1);
    this.periodPoints = [0, 0];
    let pos: StartPosition = this.nextStartPosition;
    let top: Side = this.restart.top;
    if (period === 1 || isSuddenVictory(period)) pos = 'neutral';
    this.resetToPosition(pos, top);
  }

  private resetToPosition(pos: StartPosition, top: Side): void {
    this.preWhistleCut = false;
    this.restart = { pos, top };
    if (pos === 'neutral') {
      this.bout.setNeutral({ x: 0, z: 0 }, Math.PI / 2, 1.05);
    } else {
      this.bout.setReferee(top, { x: 0, z: 0 }, Math.PI / 2);
    }
    // Bodies settle onto the marks before the whistle.
    this.setPhase('setPosition', pos === 'neutral' ? 1.3 : 3);
  }

  /** Starts from the set position, still, with play beginning at the whistle. */
  holdForWhistle(dur: number): void {
    this.setPhase('setPosition', dur);
  }

  private goWrestle(): void {
    this.setPhase('wrestling', Infinity);
    this.listeners.onWhistle?.('wrestle');
    const top = this.bout.top;
    if (top !== null && (this.preWhistleCut || topPlanOf(this.bout.plans[top]) === 'cut')) this.bout.cut(top);
    this.preWhistleCut = false;
    this.announce({ text: 'Wrestle!', tone: 'whistle', hold: this.firstWhistle ? 1.8 : 0.8, detail: this.firstWhistle ? `Tonight's referee ${this.referee.label}` : undefined });
    this.firstWhistle = false;
  }
  private firstWhistle = true;

  private advancePeriod(): void {
    if (this.result) return;
    // The opponent's corner adjusts: chase when behind, protect a big lead.
    {
      const ai = otherSide(this.humanSide);
      const was = this.bout.plans[ai];
      let next = adaptPlan(was, this.score[ai] - this.score[otherSide(ai)], this.period >= 2);
      if (this.protectingLead) next = { ...next, style: 'defensive', top: 'ride', protect: true };
      this.bout.plans[ai] = next;
      if (next.style !== was.style) {
        this.announce({ text: `${this.wrestlers[ai].lastName}'s corner: ${next.style === 'aggressive' ? 'go get him' : next.style === 'defensive' ? 'protect the lead' : 'back to the plan'}`, tone: 'info', hold: 2 });
      } else if (topPlanOf(next) !== topPlanOf(was) && topPlanOf(next) !== 'turn') {
        this.announce({ text: `${this.wrestlers[ai].lastName}'s corner: ${topPlanOf(next) === 'ride' ? 'ride him out' : 'cut him, get a takedown'}`, tone: 'info', hold: 2 });
      }
    }
    if (this.period === 3) {
      this.applyRidingTimePoint();
      if (this.result) return;
      const diff = this.score[0] - this.score[1];
      if (diff !== 0) {
        this.finish(diff > 0 ? 0 : 1, classifyDecision(Math.abs(diff)));
        return;
      }
      // Riding time from regulation does not carry into overtime (Rule 3.15.1).
      this.ridingTime = 0;
      this.announce({ text: 'Sudden Victory', detail: 'Two minutes. First points win it.', tone: 'big', hold: 2.4 });
      this.beginPeriod(4);
      return;
    }
    if (this.period >= 4) {
      const part = overtimePart(this.period);
      if (part === 0) {
        this.startTiebreaker();
        return;
      }
      if (part === 1) {
        this.requestPeriodChoice();
        return;
      }
      // End of a tiebreaker pair: more points, or a net riding-time edge of a second or more (Rule 3.16.4).
      const diff = this.score[0] - this.score[1];
      if (diff !== 0) {
        this.finish(diff > 0 ? 0 : 1, 'tiebreaker');
        return;
      }
      if (Math.abs(this.ridingTime) >= TIEBREAKER_RIDING_EDGE) {
        this.finish(this.ridingTime > 0 ? 0 : 1, 'tiebreaker');
        return;
      }
      this.announce({ text: `Sudden Victory ${overtimeRound(this.period) + 1}`, detail: 'One minute. First points win it.', tone: 'big', hold: 2.4 });
      this.beginPeriod(this.period + 1);
      return;
    }
    if (this.period === 1 && this.presetChoice !== null) {
      // In a dual the choice alternates bout by bout from one toss before the dual; no toss in the bout itself.
      this.coinTossWinner = this.presetChoice;
      this.deferred = false;
      this.setPhase('coinToss', 1.6);
      this.announce({ text: 'Dual choice', detail: `${this.wrestlers[this.coinTossWinner].lastName} has the choice from the dual's coin toss: top, bottom, neutral or defer`, tone: 'info', hold: 2.4 });
      return;
    }
    if (this.period === 1) {
      this.coinTossWinner = this.rng.chance(0.5) ? 0 : 1;
      this.deferred = false;
      // A person gets long enough to watch the disc land.
      this.setPhase('coinToss', this.breakSeconds > 2.6 ? 2.8 : 1.6);
      this.announce({
        text: 'Coin toss',
        detail: `${this.wrestlers[this.coinTossWinner].lastName} wins the toss: top, bottom, neutral or defer`,
        tone: 'info',
        hold: 2.4,
      });
      return;
    }
    this.requestPeriodChoice();
  }

  private requestPeriodChoice(): void {
    const next = this.period + 1;
    if (next >= 4) {
      // Tiebreaker halves: the wrestler with the choice picks the first unless he deferred; the other the second.
      const own = this.tbChooser ?? this.coinTossWinner;
      const first = overtimePart(next) === 1;
      const chooser: Side = first !== this.tbDeferred ? own : otherSide(own);
      this.lastChoiceBy = chooser;
      if (first && chooser === own && !this.tbDeferred && chooser !== this.humanSide && this.rng.chance(0.25)) {
        this.defer();
        return;
      }
      if (chooser === this.humanSide) {
        this.awaitingChoiceFrom = chooser;
        this.bout.setFree();
        this.setPhase('positionChoice', Infinity);
      } else this.applyChoice(chooser, this.aiChooseTiebreaker(chooser));
      return;
    }
    // Whoever wins the toss chooses in period 2 unless he defers; then it flips.
    const winnerChooses = (next === 2) !== this.deferred;
    const chooser: Side = winnerChooses ? this.coinTossWinner : otherSide(this.coinTossWinner);
    this.lastChoiceBy = chooser;
    // An AI corner that wins the toss often defers to keep the last choice.
    if (next === 2 && chooser === this.coinTossWinner && !this.deferred && chooser !== this.humanSide && this.rng.chance(0.4)) {
      this.defer();
      return;
    }
    if (chooser === this.humanSide) {
      this.awaitingChoiceFrom = chooser;
      this.bout.setFree();
      this.setPhase('positionChoice', Infinity);
    } else {
      this.applyChoice(chooser, this.aiChoosePosition(chooser));
    }
  }

  private applyChoice(chooser: Side, pos: StartPosition): void {
    this.awaitingChoiceFrom = null;
    this.lastChoiceBy = chooser;
    this.nextStartPosition = pos;
    const top: Side = pos === 'top' ? chooser : pos === 'bottom' ? otherSide(chooser) : chooser;
    // Right after a deferral the two calls would overwrite each other; say both.
    const afterDefer = this.deferred && this.period === 1;
    this.announce({ text: `${this.wrestlers[chooser].lastName} chooses ${pos}`, detail: afterDefer ? `${this.wrestlers[this.coinTossWinner].lastName} deferred to the third period` : undefined, tone: 'info', hold: afterDefer ? 2.4 : 1.6 });
    this.period += 1;
    this.clock = periodLength(this.period) * (this.period <= 3 ? this.lengthScale : 1);
    this.periodPoints = [0, 0];
    this.resetToPosition(pos, top);
  }

  /** Tiebreaker choice: most take bottom for the escape; a strong rider sometimes takes top to ride him out. */
  private aiChooseTiebreaker(side: Side): StartPosition {
    const mat = this.wrestlers[side].attributes.mat;
    return mat > 0.8 && this.rng.chance(0.4) ? 'top' : 'bottom';
  }

  /** Sudden victory ended level: the tiebreaker choice goes to the first offensive scorer in regulation (not escapes
   * or penalty points), else a disc toss; in later rounds to the wrestler who did not have it last time (Rule 3.14.3). */
  private startTiebreaker(): void {
    const round = overtimeRound(this.period);
    let chooser: Side;
    let detail: string;
    if (round === 1) {
      const first = this.scoreLog.find(e => e.period <= 3 && e.kind !== 'escape' && e.kind !== 'stalling' && e.kind !== 'penalty');
      if (first) {
        chooser = first.side;
        detail = `${this.wrestlers[chooser].lastName} scored first: his choice`;
      } else {
        chooser = this.rng.chance(0.5) ? 0 : 1;
        detail = `No offensive points in regulation: disc toss to ${this.wrestlers[chooser].lastName}`;
      }
    } else {
      chooser = otherSide(this.tbChooser ?? this.coinTossWinner);
      detail = `${this.wrestlers[chooser].lastName}'s choice this time`;
    }
    this.tbChooser = chooser;
    this.tbDeferred = false;
    this.ridingTime = 0;
    this.announce({ text: `Tiebreaker ${round}`, detail: `Two 30-second periods. ${detail}`, tone: 'big', hold: 2.4 });
    this.requestPeriodChoice();
  }

  private aiChoosePosition(side: Side): StartPosition {
    const lead = this.score[side] - this.score[otherSide(side)];
    const mat = this.wrestlers[side].attributes.mat;
    if (lead > 0 && mat > 0.55) return 'top';
    if (lead < -2) return 'neutral';
    if (mat > 0.75) return 'top';
    return this.wrestlers[side].attributes.quickness > 0.8 ? 'neutral' : 'bottom';
  }

  /* ------------------------------------------------------------ wrestling */

  private tickWrestling(dt: number, commands: [Command, Command]): void {
    if(!this.practice)this.clock -= dt;
    const top = this.bout.top;
    const p = this.bout.position;
    const riding = top !== null || (p.kind === 'move' && this.isMatMove(p.id));
    if (riding && p.kind !== 'neutral') {
      const t = top ?? (p.kind === 'move' ? p.A : 0);
      this.ridingTime += dt * (t === 0 ? 1 : -1);
    }
    this.bout.tick(dt, commands);
    if (this.phase !== 'wrestling') return;
    const after=this.bout.position;
    // Cradle points become payable when its lock opens, before the belly-down recovery.
    const holdingNearFall=after.kind==='mat'&&(after.sub==='exposed'||after.sub==='spladle')
      || after.kind==='move'&&(after.id==='fall'||after.id==='fightOff' && (after.t/after.dur < (after.turnStyle==='cradle'?CRADLE_GRIP_RELEASE:isArmBar(after.turnStyle)?ARM_BAR_GRIP_RELEASE:1)));
    if(!holdingNearFall)this.releaseNearFall();
    if(this.result)return;
    if (this.bout.position.kind === 'neutral') this.updateStalling(dt, commands);
    else this.updateTopStalling(dt, commands);
    // A Cut plan lets him up once the takedown is secure (two for the takedown, one back for the escape).
    const m = this.bout.position;
    if (m.kind === 'mat' && m.sub === 'ride' && m.t > 0.9 && topPlanOf(this.bout.plans[m.A]) === 'cut') this.bout.cut(m.A);
    if (this.clock <= 0 && !this.result) {
      this.clock = 0;
      // Let a move that is already in the air land before the buzzer counts.
      if (this.bout.position.kind !== 'move') this.endPeriod();
    }
  }

  private isMatMove(id: string): boolean {
    return ['sitOutPull', 'sitOutTurn', 'sitOutEscape', 'breakdown', 'rebase', 'halfNelson', 'cradle', 'tilt', 'fightOff', 'standUp', 'returnMat', 'standingTrip', 'crotchLift', 'switch', 'escapeTurn'].includes(id);
  }

  private endPeriod(): void {
    this.releaseNearFall();
    if(this.result)return;
    this.listeners.onWhistle?.('period');
    this.bout.setFree();
    this.announce({ text: this.period >= 3 ? 'End of period' : `End of period ${this.period}`, tone: 'whistle', hold: 1.6 });
    this.setPhase('periodBreak', this.breakSeconds);
  }

  private whistle(reason: 'out' | 'stalemate' | 'stall'): void {
    this.releaseNearFall();
    if(this.result)return;
    if (this.phase !== 'wrestling') return;
    this.listeners.onWhistle?.(reason);
    const p = this.bout.position;
    let pos: StartPosition = 'neutral';
    let top: Side = this.restart.top;
    if (reason === 'stall') {
      // Stalling on top with the bottom man standing: they restart on their feet.
      pos = 'neutral';
    } else if (p.kind === 'mat') {
      top = p.A;
      pos = 'top';
    } else if (p.kind === 'move' && this.isMatMove(p.id)) {
      top = p.A;
      pos = 'top';
    }
    this.preWhistleCut = false;
    this.restart = { pos, top };
    // Backing off the mat on the feet, not defending a shot and not driven out by him, is stalling
    // (owner, November 9): a warning the first time, then a point.
    let fled: Side | null = null;
    if (reason === 'out' && p.kind === 'neutral') {
      for (const a of this.bout.athletes) {
        const r = Math.hypot(a.pos.x, a.pos.z);
        const outward = r > MAT.circleRadius - 0.05 && a.vel.x * a.pos.x + a.vel.z * a.pos.z > 0;
        if (outward && a.drive < -0.2 && a.act !== 'sprawl' && a.act !== 'sprawlRecover') fled = a.side;
      }
    }
    // The edge (owner, November 10; NCAA Rule 5.7.5, 5.7.9 and 5.7.10). Getting out of a scramble or off a bad
    // ride is legal, but fleeing to avoid being scored on is called every time: crawling out on his back, or
    // bailing out of a takedown that is all but finished. Pushing or pulling him out to force a restart is
    // stalling too, which a referee calls some of the time (more often the strict ones): the rider pushing the
    // standing bottom man out to keep control, or a man shoving him off the mat with no attack.
    let edgeCall: [Side, string] | null = null;
    if (reason === 'out') {
      const out = this.bout.edgeOut;
      const odds = 0.35 * this.referee.rate;
      if (p.kind === 'mat' && (p.sub === 'exposed' || p.sub === 'spladle') && out[otherSide(p.A)] > 0) edgeCall = [otherSide(p.A), 'Fled the mat on his back'];
      else if (p.kind === 'legs' && p.progress >= 0.75 && out[otherSide(p.A)] > 0) edgeCall = [otherSide(p.A), 'Fled the mat to stop the takedown'];
      else if (p.kind === 'mat' && p.sub === 'standing' && out[p.A] > 0 && this.rng.chance(odds)) edgeCall = [p.A, 'Pushed him out to keep control'];
      else if (p.kind === 'neutral' && fled === null) {
        for (const a of this.bout.athletes) {
          const o = this.bout.athletes[otherSide(a.side)];
          // Only a shove through a man who was holding his ground: walking down a man who gives ground is the
          // pressure that makes him back out (his call, above).
          const shoved = Math.hypot(o.pos.x, o.pos.z) > Math.hypot(a.pos.x, a.pos.z) && a.drive > 0.6 && o.drive > 0.1 && this.sinceAttack[a.side] > 1.5;
          if (shoved && this.rng.chance(odds * 0.5)) edgeCall = [a.side, 'Pushed him off the mat'];
        }
      }
    }
    if (reason !== 'stall') this.announce({ text: reason === 'out' ? 'Out of bounds' : 'Stalemate', tone: 'whistle', hold: 1.1 });
    if (fled !== null) this.callStalling(fled, 'Backed off the mat');
    else if (edgeCall) this.callStalling(edgeCall[0], edgeCall[1]);
    this.walkBack();
  }

  /** Both get up and walk back to their side of the center; the restart waits for the slower one. */
  private walkBack(): void {
    this.bout.setFree();
    const dist = this.bout.athletes.map((a) => Math.hypot(a.pos.x - RETURN_MARK[a.side], a.pos.z));
    this.returnSpeed = this.bout.athletes.map((a) => returnSpeed(a.stamina)) as [number, number];
    const walk = Math.max(dist[0] / this.returnSpeed[0], dist[1] / this.returnSpeed[1]);
    this.setPhase('whistle', Math.min(7, Math.max(1.2, RETURN_RISE + walk + 0.35)));
  }

  /**
   * The referee stops it for a call (owner's list). Locked hands (NCAA 5.8.2): a point to the other man.
   * Potentially dangerous (2.1.10): no penalty, near-fall points already earned count. A slam (an illegal hold:
   * he must return a lifted man to the mat safely): a point to the other man. All restart in the position held:
   * top and bottom, the same man on top.
   */
  private refCall(kind: 'lockedHands' | 'dangerous' | 'slam', side: Side): void {
    this.releaseNearFall();
    if (this.result || this.phase !== 'wrestling') return;
    const p = this.bout.position;
    const top = p.kind === 'mat' || p.kind === 'move' ? p.A : side;
    this.listeners.onWhistle?.(kind);
    this.announce(kind === 'lockedHands'
      ? { text: 'Locked hands', tone: 'whistle', detail: 'Hands locked around him while he was down: a point', hold: 1.6 }
      : kind === 'slam'
      ? { text: 'Illegal slam', tone: 'whistle', detail: 'A lifted man must come back to the mat safely: a point', hold: 1.6 }
      : { text: 'Potentially dangerous', tone: 'whistle', detail: 'Stopped for safety · no penalty', hold: 1.6 });
    if (kind === 'lockedHands') this.award(otherSide(side), 'penalty', 'Locked hands');
    if (kind === 'slam') this.award(otherSide(side), 'penalty', 'Illegal slam');
    if (this.result) return;
    this.preWhistleCut = false;
    // On the feet (a front headlock or a leg attack stopped as potentially dangerous) they restart neutral.
    const onFeet = p.kind === 'neutral' || p.kind === 'shot' || p.kind === 'legs' || p.kind === 'fhl';
    this.restart = onFeet ? { pos: 'neutral', top: this.restart.top } : { pos: 'top', top };
    this.walkBack();
  }

  /** After a whistle: up off the mat, then walk to the restart mark, then face the opponent. */
  private returnSpeed: [number, number] = [1.4, 1.4];
  private tickReturn(dt: number): void {
    for (const a of this.bout.athletes) {
      const prev = { ...a.pos };
      if (this.phaseT > RETURN_RISE) {
        const dx = RETURN_MARK[a.side] - a.pos.x, dz = -a.pos.z, d = Math.hypot(dx, dz);
        // Ease off over the last stretch onto the mark rather than stopping dead from a run.
        const step = Math.min(d, this.returnSpeed[a.side] * Math.max(0.3, Math.min(1, d / 0.9)) * dt);
        if (d > 1e-3) a.pos = { x: a.pos.x + (dx / d) * step, z: a.pos.z + (dz / d) * step };
      }
      a.vel = { x: (a.pos.x - prev.x) / Math.max(dt, 1e-4), z: (a.pos.z - prev.z) / Math.max(dt, 1e-4) };
      const moving = Math.hypot(a.vel.x, a.vel.z) > 0.05;
      const want = moving ? Math.atan2(a.vel.x, a.vel.z) : a.side === 0 ? Math.PI / 2 : -Math.PI / 2;
      a.yaw += Math.atan2(Math.sin(want - a.yaw), Math.cos(want - a.yaw)) * Math.min(1, dt * 6);
    }
  }

  /**
   * Owner, November 10: "if a wrestler is constantly backing up and not making any offensive attempts, then he should
   * get hit for stalling after 4 or 5 committed offensive attempts by the other wrestler, especially when he is trying
   * to avoid action or protect a lead." Committed attempts (shots, not fakes) a man has faced since his
   * own last one (his own shot or tie attack resets it); at 4 shots (a strict referee, or any referee when he is ahead)
   * or 5, stalling on him: a warning the first
   * time, then a point. The count starts again after each call.
   */
  private unanswered: [number, number] = [0, 0];
  private unansweredAttack(attacker: Side, shot: boolean): void {
    const other = otherSide(attacker);
    // Any attack of his own answers it; only shots (committed attempts) build the other man's count.
    this.unanswered[attacker] = 0;
    if (!shot) return;
    this.unanswered[other] += 1;
    if (this.practice || this.phase !== 'wrestling') return;
    const ahead = this.score[other] > this.score[attacker];
    const limit = this.referee.id === 'strict' || ahead ? STALL_FEET.unansweredStrict : STALL_FEET.unanswered;
    if (this.unanswered[other] >= limit) {
      this.unanswered[other] = 0;
      this.callStalling(other, ahead ? 'Protecting the lead, no attacks' : 'No attacks of his own');
    }
  }

  /** Each man's recent attacks, fading over a minute or so: who is making the match. */
  private attackLoad: [number, number] = [0, 0];

  private updateStalling(dt: number, commands: [Command, Command]): void {
    // Unlimited drills allow time to inspect controls and rehearse a setup.
    if (this.practice) return;
    const dist = this.bout.distance();
    const fade = Math.exp(-dt / STALL_FEET.memory);
    this.attackLoad = [this.attackLoad[0] * fade, this.attackLoad[1] * fade];
    for (const a of this.bout.athletes) {
      const o = this.bout.athletes[otherSide(a.side)];
      const onFeet = this.bout.position.kind === 'neutral';
      // Owner, November 10 (JV: 18 shots to 2, the man walked backwards all match, no calls): a man who keeps giving
      // ground to a man walking him down is stalling at any distance, and so is a man who lets him do all the
      // attacking (several more attacks than him lately and none of his own for a while). While the other man is
      // clearly making the match, stall time fades slowly instead of vanishing in every lull.
      // Giving ground: steering away from him, or actually being walked backwards while he comes forward.
      const ux = (o.pos.x - a.pos.x) / (dist || 1), uz = (o.pos.z - a.pos.z) / (dist || 1);
      const backing2 = -(a.vel.x * ux + a.vel.z * uz) > STALL_FEET.backSpeed && -(o.vel.x * ux + o.vel.z * uz) > STALL_FEET.backSpeed * 0.8;
      const givingGround = onFeet && dist < 2.4 && (a.drive < STALL_FEET.backDrive && o.drive > STALL_FEET.pressDrive || backing2);
      const oneSided = onFeet && this.attackLoad[o.side] - this.attackLoad[a.side] >= STALL_FEET.attackGap && this.sinceAttack[a.side] > STALL_FEET.quiet;
      const backing = dist > 1.7 && a.drive <= 0.05;
      const fleeing = Math.hypot(a.pos.x, a.pos.z) > MAT.circleRadius - 0.9 && a.drive < -0.3;
      const cmd = commands[a.side];
      // Stalling is mostly not trying: idle in front of him, or half a minute on the feet without an attack.
      if (this.bout.position.kind === 'neutral') this.sinceAttack[a.side] += dt;
      const idle = Math.hypot(cmd.moveX, cmd.moveZ) < 0.1 && !cmd.shoot && !cmd.fight;
      // Owner, November 9: the referee should call stalling on the feet more (none in 48 test matches).
      // No real attempt (shot or tie attack) for 40 s builds stall time, hand fighting and fakes or not,
      // like a referee who wants to see offense: a warning about a minute in, a point some 20 s later.
      // (It was 75 s, and only while standing still in stance, so constant hand fighting reset it.)
      // How long he waits, and how hard he calls it, depends on tonight's referee. After the warning, a
      // passive man has longer before the point (owner: about 20 s was too soon unless it is blatant);
      // backing out or running from him (blatant) is called as fast as ever.
      const ref = this.referee;
      const noOffense = this.sinceAttack[a.side] > ref.patience && a.act !== 'paired';
      const passive = dist <= 1.7 && (a.act === 'stance' && idle || noOffense);
      const passiveRate = (idle && a.act === 'stance' ? 0.35 : 0.3) * ref.rate * (a.stallWarned ? 0.4 : 1);
      const giving = (givingGround ? STALL_FEET.givingRate : 0) + (oneSided ? STALL_FEET.oneSidedRate : 0);
      const rate = fleeing ? 1.6 : backing ? 1 : passive || giving > 0 ? Math.max(passive ? passiveRate : 0, giving * ref.rate * (a.stallWarned ? 0.7 : 1)) : 0;
      a.stallTimer = rate > 0 ? a.stallTimer + dt * rate * planEffects(this.bout.plans[a.side]).stall * (this.bout.plans[otherSide(a.side)].style === 'aggressive' ? planEffects(this.bout.plans[a.side]).stallVsAttacker : 1) : Math.max(0, a.stallTimer - dt * (oneSided ? STALL_FEET.slowFade : 1.6));
      this.cueWork(a.side, 'attack, get to his legs');
      if (!a.stallWarned && a.stallTimer >= STALL_WARNING_SECONDS) {
        a.stallWarned = true;
        this.listeners.onRefCue?.(a.side, 'stall');
        this.announce({ text: `Stalling ${a.side === 0 ? 'red' : 'green'}`, detail: 'Warning', tone: 'warn', hold: 1.4 });
      }
      if (a.stallTimer >= STALL_POINT_AT) {
        a.stallTimer = 0;
        this.award(otherSide(a.side), 'stalling');
      }
    }
    void commands;
  }

  /**
   * Stalling on the mat (owner, November 9). Each referee reads it his own way (patience and rate):
   * - Top, riding without trying to turn him: stall time builds after a grace (Ride plans sooner).
   * - Top, the bottom man up on his feet and not returned to the mat within 5-7 s (5 strict, 6 by the
   *   book, 7 lenient): stalling on top, and they restart on their feet.
   * - Bottom, not working to get out (no stand-up, switch or sit-out) or lying flat not working up:
   *   stall time builds, sooner when flat.
   * A warning first; after it, a passive man builds toward the point at 0.4x.
   */
  private standingT = 0;
  private sinceEscapeTry: [number, number] = [0, 0];
  /** Seconds flat on his belly this spell, counted at FLAT_STALL.pushing while he is pushing (owner, November 10). */
  private flatQuiet: [number, number] = [0, 0];
  private pushAgo: [number, number] = [9, 9];
  private updateTopStalling(dt: number, commands: [Command, Command]): void {
    if (this.practice) return;
    const p = this.bout.position;
    const ref = this.referee;
    const patience = ref.patience / 40;
    // Top, bottom standing: return him or it is stalling.
    if (p.kind === 'mat' && p.sub === 'standing') {
      this.standingT += dt;
      const limit = ref.id === 'strict' ? 5 : ref.id === 'lenient' ? 7 : 6;
      if (this.standingT > limit) {
        this.standingT = 0;
        this.callStalling(p.A, 'Did not return him to the mat');
        this.whistle('stall');
        return;
      }
    } else this.standingT = 0;
    const riding = p.kind === 'mat' && (p.sub === 'ride' || p.sub === 'flat');
    for (const a of this.bout.athletes) {
      const onTop = riding && p.A === a.side;
      const onBottom = riding && p.A !== a.side;
      let build = 0;
      if (onTop) {
        a.sinceTurnTry += dt;
        const e = topPlanEffects(this.bout.plans[a.side]);
        if (a.sinceTurnTry > e.stallGrace * patience) build = e.stallRate;
      } else a.sinceTurnTry = 0;
      if (onBottom) {
        const c = commands[a.side];
        const flat = p.kind === 'mat' && p.sub === 'flat';
        if (flat) {
          // Owner, November 10: lying flat on his belly is stalling. Pushing up that gets him nowhere only slows
          // the count; getting back to his base (or out) ends the spell.
          this.pushAgo[a.side] = c.shoot || c.fight || c.sprawl ? 0 : this.pushAgo[a.side] + dt;
          this.flatQuiet[a.side] += dt * (this.pushAgo[a.side] < 1 ? FLAT_STALL.pushing : 1);
          if (this.flatQuiet[a.side] > FLAT_STALL.after * patience) build = FLAT_STALL.rate;
        } else {
          this.flatQuiet[a.side] = 0;
          // Trying to get out: stand-up, switch, sit-out.
          const working = c.shoot || c.fight || c.sitOut;
          this.sinceEscapeTry[a.side] = working ? 0 : this.sinceEscapeTry[a.side] + dt;
          if (this.sinceEscapeTry[a.side] > 12 * patience) build = 0.45;
        }
      } else { this.sinceEscapeTry[a.side] = 0; this.flatQuiet[a.side] = 0; }
      if (build > 0) a.stallTimer += dt * build * ref.rate * (a.stallWarned ? 0.4 : 1);
      else if (p.kind === 'mat') a.stallTimer = Math.max(0, a.stallTimer - dt * 1.6);
      if (onTop || onBottom) this.cueWork(a.side, onTop ? 'work to turn him' : 'work to get out');
      if (!a.stallWarned && a.stallTimer >= STALL_WARNING_SECONDS) {
        a.stallWarned = true;
        this.listeners.onRefCue?.(a.side, 'stall');
        this.announce({ text: `Stalling ${a.side === 0 ? 'red' : 'green'}`, detail: onTop ? 'Warning: work to turn him' : 'Warning: work to get out', tone: 'warn', hold: 1.4 });
      }
      if (a.stallTimer >= STALL_POINT_AT) {
        a.stallTimer = 0;
        a.sinceTurnTry = 0;
        this.sinceEscapeTry[a.side] = 0;
        this.flatQuiet[a.side] = 0;
        this.award(otherSide(a.side), 'stalling');
      }
    }
  }

  /* -------------------------------------------------------------- scoring */

  /** Referee's held count, not yet part of the awarded scoreboard. */
  get earnedNearFallPoints(): number {
    return this.pendingNearFall ? POINTS[this.pendingNearFall.kind] : 0;
  }

  private releaseNearFall(): void {
    const earned=this.pendingNearFall;
    this.pendingNearFall=null;
    if(earned&&!this.result)this.award(earned.side,earned.kind,'Near fall');
  }

  /**
   * The opponent's corner protects a big lead: up 7 or more, he wrestles defensively on his
   * feet (about a third of his attacks) and rides on top instead of hunting turns, back to the plan under 4.
   * Owner: a tech fall between two elite wrestlers must be rare (target about 5% at All-American); it was
   * about 11%, nearly all the AI running up the score on the player.
   */
  /**
   * Before a stalling call a referee tells him to work ("Work, red!"), with a hand out toward him, once per
   * build-up of stall time, so a call is never a surprise.
   */
  private workCued: [boolean, boolean] = [false, false];
  private cueWork(side: Side, what: string): void {
    const a = this.bout.athletes[side];
    if (a.stallTimer < 0.5) { this.workCued[side] = false; return; }
    if (this.workCued[side] || a.stallTimer < 2.5) return;
    this.workCued[side] = true;
    this.announce({ text: `Work, ${side === 0 ? 'red' : 'green'}!`, detail: `Referee: ${what}`, tone: 'info', hold: 1.3 });
    this.listeners.onRefCue?.(side, 'work');
  }

  /** An immediate stalling call (blatant: backing off the mat): the warning if he has none, else a point. */
  private callStalling(side: Side, detail: string): void {
    const a = this.bout.athletes[side];
    a.stallTimer = 0;
    this.listeners.onRefCue?.(side, 'stall');
    if (!a.stallWarned) {
      a.stallWarned = true;
      this.announce({ text: `Stalling ${side === 0 ? 'red' : 'green'}`, detail: `Warning: ${detail.toLowerCase()}`, tone: 'warn', hold: 1.6 });
      return;
    }
    this.award(otherSide(side), 'stalling', detail);
  }

  private protectingLead = false;
  private protectLead(): void {
    const ai = otherSide(this.humanSide);
    const lead = this.score[ai] - this.score[this.humanSide];
    if (!this.protectingLead && lead >= 7) {
      this.protectingLead = true;
      this.bout.plans[ai] = { ...this.bout.plans[ai], style: 'defensive', top: 'ride', protect: true };
      this.announce({ text: `${this.wrestlers[ai].lastName}'s corner: protect the lead`, tone: 'info', hold: 2 });
    } else if (this.protectingLead && lead < 4) {
      this.protectingLead = false;
      this.bout.plans[ai] = { ...adaptPlan(this.bout.plans[ai], lead, this.period >= 3), protect: false };
    }
  }

  private award(side: Side, kind: ScoreKind, detail?: string): void {
    if (this.result) return;
    const points = SCORE_POINTS[kind];
    this.score[side] += points;
    this.periodPoints[side] += points;
    // The crowd lifts the man who just scored (owner: momentum, short-term energy). Not for penalties, stalling or
    // riding time, which the crowd does not roar for.
    if (kind !== 'penalty' && kind !== 'stalling' && kind !== 'ridingTime') this.bout.momentum(side, points);
    const event: ScoreEvent = {
      id: this.eventId++,
      side,
      kind,
      points,
      label: kind === 'stalling' ? `Stalling ${side === 0 ? 'green' : 'red'}` : detail ? `${SCORE_LABELS[kind]} — ${detail}` : SCORE_LABELS[kind],
      period: this.period,
      clock: this.clock,
    };
    this.scoreLog.push(event);
    this.listeners.onScore?.(event);
    this.protectLead();
    if (isSuddenVictory(this.period)) {
      this.finish(side, 'sudden-victory');
      return;
    }
    const margin = Math.abs(this.score[0] - this.score[1]);
    if (margin >= TECH_FALL_MARGIN) this.finish(this.score[0] > this.score[1] ? 0 : 1, 'technical-fall');
  }

  private applyRidingTimePoint(): void {
    if (Math.abs(this.ridingTime) < RIDING_TIME_THRESHOLD) return;
    const side: Side = this.ridingTime > 0 ? 0 : 1;
    this.score[side] += POINTS.ridingTime;
    const event: ScoreEvent = {
      id: this.eventId++,
      side,
      kind: 'ridingTime',
      points: POINTS.ridingTime,
      label: 'Riding time',
      period: this.period,
      clock: 0,
    };
    this.scoreLog.push(event);
    this.listeners.onScore?.(event);
  }

  private finish(winner: Side, type: WinType): void {
    if (this.result) return;
    this.pendingNearFall=null;
    const margin = Math.abs(this.score[0] - this.score[1]);
    this.result = {
      winner,
      type,
      score: [this.score[0], this.score[1]],
      period: this.period,
      clock: this.clock,
      teamPoints: type === 'fall' ? 6 : type === 'technical-fall' ? 5 : margin >= 8 ? 4 : 3,
    };
    this.bout.setFree();
    this.listeners.onWhistle?.('finish');
    this.listeners.onResult?.(this.result);
    this.setPhase('celebration', 7.5);
  }

  private announce(a: Omit<Announcement, 'id'>): void {
    this.listeners.onAnnounce?.({ id: this.eventId++, ...a });
  }

  /* ------------------------------------------------------------- layouts */

  private layoutIntro(): void {
    const [a, b] = this.bout.athletes;
    a.pos = { x: -4.2, z: 1.2 };
    b.pos = { x: 4.2, z: -1.2 };
    a.yaw = Math.PI / 2;
    b.yaw = -Math.PI / 2;
  }

  /** Walk-in progress during the introductions, 0..1. */
  get walkIn(): number {
    return this.phase === 'intros' ? Math.min(1, this.phaseT / 3.4) : 1;
  }

  /* --------------------------------------------------------------- reads */

  distance(): number {
    return this.bout.distance();
  }

  get center(): Vec2 {
    return this.bout.center;
  }

  get axisYaw(): number {
    return this.bout.axisYaw;
  }

  get top(): Side | null {
    return this.bout.top;
  }
}
