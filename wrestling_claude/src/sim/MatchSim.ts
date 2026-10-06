import { wrestlerFamilyNote, morenoMatchupNote } from './easterEggs';
import {
  MAT,
  POINTS,
  RIDING_TIME_THRESHOLD,
  STALL_WARNING_SECONDS,
  TECH_FALL_MARGIN,
  classifyDecision,
  periodLength,
} from './rules';
import type { WinType } from './rules';
import { Bout, Rng } from './bout';
import type { BoutEvents } from './bout';
import type { MoveDef } from './moves';
import { otherSide } from './types';
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
  onTell?: (to: Side, what: 'shot' | 'snap' | 'switch' | 'standup') => void;
  onFeedback?: (side: Side, button: 'shoot' | 'fight' | 'sprawl', result: 'ok' | 'won' | 'lost' | 'blocked') => void;
}

const SCORE_LABELS: Record<ScoreKind, string> = {
  takedown: 'Takedown',
  escape: 'Escape',
  reversal: 'Reversal',
  nearFall2: 'Near Fall',
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
  nearFall4: POINTS.nearFall4 - POINTS.nearFall2,
  penalty: POINTS.penalty,
  stalling: POINTS.stalling,
  ridingTime: POINTS.ridingTime,
};

export const STALL_POINT_AT = 11;

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
  awaitingChoiceFrom: Side | null = null;
  nextStartPosition: StartPosition = 'neutral';
  lastChoiceBy: Side | null = null;
  scoreLog: ScoreEvent[] = [];
  humanSide: Side = 0;
  /** Quick matches shorten every period. */
  lengthScale = 1;

  private listeners: SimListeners;
  private eventId = 1;
  private restart: { pos: StartPosition; top: Side } = { pos: 'neutral', top: 0 };
  private tiebreakTotals: [number, number] = [0, 0];
  private rng: Rng;

  constructor(wrestlers: [Wrestler, Wrestler], listeners: SimListeners = {}, seed = Date.now() & 0xffffff) {
    this.wrestlers = wrestlers;
    this.listeners = listeners;
    this.rng = new Rng(seed ^ 0x51ed);
    const ev: BoutEvents = {
      score: (side, kind, detail) => this.award(side, kind, detail),
      announce: (text, tone, detail) => this.announce({ text, tone, detail, hold: 1.1 }),
      impact: (s, at, slowmo) => listeners.onImpact?.(s, at, slowmo),
      move: (def, A) => listeners.onMove?.(def, A),
      whistle: (reason) => this.whistle(reason),
      fall: (winner) => this.finish(winner, 'fall'),
      tell: (to, what) => listeners.onTell?.(to, what),
      feedback: (side, button, result) => listeners.onFeedback?.(side, button, result),
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

  choosePosition(pos: StartPosition): void {
    if (this.phase !== 'positionChoice' || this.awaitingChoiceFrom === null) return;
    this.applyChoice(this.awaitingChoiceFrom, pos);
  }

  /* ----------------------------------------------------------------- tick */

  tick(dt: number, commands: [Command, Command]): void {
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
    if (period === 1 || period === 4) {
      pos = 'neutral';
    } else if (period === 5) {
      pos = 'top';
      top = this.coinTossWinner;
    } else if (period === 6) {
      pos = 'top';
      top = otherSide(this.coinTossWinner);
    } else if (period === 7) {
      pos = 'top';
      top = this.coinTossWinner;
    }
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

  private goWrestle(): void {
    this.setPhase('wrestling', Infinity);
    this.listeners.onWhistle?.('wrestle');
    if (this.preWhistleCut && this.bout.top !== null) this.bout.cut(this.bout.top);
    this.preWhistleCut = false;
    this.announce({ text: 'Wrestle!', tone: 'whistle', hold: 0.8 });
  }

  private advancePeriod(): void {
    if (this.result) return;
    if (this.period === 3) {
      this.applyRidingTimePoint();
      if (this.result) return;
      const diff = this.score[0] - this.score[1];
      if (diff !== 0) {
        this.finish(diff > 0 ? 0 : 1, classifyDecision(Math.abs(diff)));
        return;
      }
      this.announce({ text: 'Sudden Victory', detail: 'One minute. First points win it.', tone: 'big', hold: 2.4 });
      this.beginPeriod(4);
      return;
    }
    if (this.period === 4) {
      this.announce({ text: 'Tiebreaker', detail: 'Thirty seconds each on top', tone: 'big', hold: 2.2 });
      this.beginPeriod(5);
      return;
    }
    if (this.period === 5) {
      this.beginPeriod(6);
      return;
    }
    if (this.period === 6) {
      const [a, b] = this.tiebreakTotals;
      if (a !== b) {
        this.finish(a > b ? 0 : 1, 'tiebreaker');
        return;
      }
      this.announce({ text: 'Ultimate Ride-Out', detail: 'Hold the ride, win the match', tone: 'big', hold: 2.4 });
      this.beginPeriod(7);
      return;
    }
    if (this.period === 7) {
      this.finish(this.restart.top, 'ultimate-rideout');
      return;
    }
    if (this.period === 1) {
      this.coinTossWinner = this.rng.chance(0.5) ? 0 : 1;
      this.setPhase('coinToss', 1.6);
      this.announce({
        text: 'Coin toss',
        detail: `${this.wrestlers[this.coinTossWinner].lastName} has the choice in the second period`,
        tone: 'info',
        hold: 1.8,
      });
      return;
    }
    this.requestPeriodChoice();
  }

  private requestPeriodChoice(): void {
    const next = this.period + 1;
    const chooser: Side = next === 2 ? this.coinTossWinner : otherSide(this.coinTossWinner);
    this.lastChoiceBy = chooser;
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
    this.announce({ text: `${this.wrestlers[chooser].lastName} chooses ${pos}`, tone: 'info', hold: 1.6 });
    this.period += 1;
    this.clock = periodLength(this.period) * this.lengthScale;
    this.periodPoints = [0, 0];
    this.resetToPosition(pos, top);
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
    this.clock -= dt;
    const top = this.bout.top;
    const p = this.bout.position;
    const riding = top !== null || (p.kind === 'move' && this.isMatMove(p.id));
    if (riding && p.kind !== 'neutral') {
      const t = top ?? (p.kind === 'move' ? p.A : 0);
      this.ridingTime += dt * (t === 0 ? 1 : -1);
    }
    this.bout.tick(dt, commands);
    if (this.phase !== 'wrestling') return;
    if (this.bout.position.kind === 'neutral') this.updateStalling(dt, commands);
    if (this.clock <= 0 && !this.result) {
      this.clock = 0;
      // Let a move that is already in the air land before the buzzer counts.
      if (this.bout.position.kind !== 'move') this.endPeriod();
    }
  }

  private isMatMove(id: string): boolean {
    return ['breakdown', 'rebase', 'halfNelson', 'tilt', 'fightOff', 'standUp', 'returnMat', 'switch', 'escapeTurn'].includes(id);
  }

  private endPeriod(): void {
    this.listeners.onWhistle?.('period');
    if (this.period === 5 || this.period === 6) {
      this.tiebreakTotals[0] += this.periodPoints[0];
      this.tiebreakTotals[1] += this.periodPoints[1];
    }
    this.bout.setFree();
    this.announce({ text: this.period >= 3 ? 'End of period' : `End of period ${this.period}`, tone: 'whistle', hold: 1.6 });
    this.setPhase('periodBreak', 2.6);
  }

  private whistle(reason: 'out' | 'stalemate'): void {
    if (this.phase !== 'wrestling') return;
    this.listeners.onWhistle?.(reason);
    const p = this.bout.position;
    let pos: StartPosition = 'neutral';
    let top: Side = this.restart.top;
    if (p.kind === 'mat') {
      top = p.A;
      pos = 'top';
    } else if (p.kind === 'move' && this.isMatMove(p.id)) {
      top = p.A;
      pos = 'top';
    }
    this.preWhistleCut = false;
    this.restart = { pos, top };
    this.announce({ text: reason === 'out' ? 'Out of bounds' : 'Stalemate', tone: 'whistle', hold: 1.1 });
    this.bout.setFree();
    this.setPhase('whistle', 1.2);
  }

  private updateStalling(dt: number, commands: [Command, Command]): void {
    const dist = this.bout.distance();
    for (const a of this.bout.athletes) {
      const backing = dist > 1.7 && a.drive <= 0.05;
      const fleeing = Math.hypot(a.pos.x, a.pos.z) > MAT.circleRadius - 0.9 && a.drive < -0.3;
      const cmd = commands[a.side];
      const passive = dist <= 1.7 && a.act === 'stance' && Math.hypot(cmd.moveX, cmd.moveZ) < 0.1 && !cmd.shoot && !cmd.fight;
      a.stallTimer = backing || fleeing || passive ? a.stallTimer + dt * (fleeing ? 1.6 : passive ? 0.35 : 1) : Math.max(0, a.stallTimer - dt * 1.6);
      if (!a.stallWarned && a.stallTimer >= STALL_WARNING_SECONDS) {
        a.stallWarned = true;
        this.announce({ text: 'Stalling — warning', detail: this.wrestlers[a.side].lastName, tone: 'warn', hold: 1.4 });
      }
      if (a.stallTimer >= STALL_POINT_AT) {
        a.stallTimer = 0;
        this.award(otherSide(a.side), 'stalling', `on ${this.wrestlers[a.side].lastName}`);
      }
    }
    void commands;
  }

  /* -------------------------------------------------------------- scoring */

  private award(side: Side, kind: ScoreKind, detail?: string): void {
    if (this.result) return;
    const points = SCORE_POINTS[kind];
    this.score[side] += points;
    this.periodPoints[side] += points;
    const event: ScoreEvent = {
      id: this.eventId++,
      side,
      kind,
      points,
      label: detail ? `${SCORE_LABELS[kind]} — ${detail}` : SCORE_LABELS[kind],
      period: this.period,
      clock: this.clock,
    };
    this.scoreLog.push(event);
    this.listeners.onScore?.(event);
    if (this.period === 4) {
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
