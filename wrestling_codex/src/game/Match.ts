import { RULES, nearFallPoints, ridingPoint, stallingPenalty } from './rules';
import { clamp, clockText, other, type Choice, type Controls, type MatchSettings, type MatchState, type Move, type Side, type Wrestler } from './types';
import { OpponentAI, type OpponentController } from './OpponentAI';

const athlete = (x: number, heading: number): Wrestler => ({ x, z: 0, heading, stamina: 100, setup: 0, cooldown: 0, defending: false, defenseAge: 0, speed: 0, move: 'idle', moveTime: 0, moveDuration: 1, passive: 0, warnings: 0, lastGroundAction: '', attempts: 0, takedowns: 0, escapes: 0, reversals: 0 });

export class Match {
  state!: MatchState;
  settings: MatchSettings;
  private seed: number;
  private eventId = 0;
  private opponent: OpponentController;
  private velocity = [{ x: 0, z: 0 }, { x: 0, z: 0 }];
  private buffered: [null | { key: 'primary' | 'secondary' | 'setup'; ttl: number }, null | { key: 'primary' | 'secondary' | 'setup'; ttl: number }] = [null, null];
  private readonly initialSeed: number;

  constructor(settings: Partial<MatchSettings> = {}, seed = 4317, opponent: OpponentController = new OpponentAI()) {
    this.settings = { difficulty: 'club', clockSpeed: 2, sound: true, quality: 'high', ...settings };
    this.seed = this.initialSeed = seed;
    this.opponent = opponent;
    this.reset(false);
  }
  random(): number { this.seed = (Math.imul(1664525, this.seed) + 1013904223) | 0; return (this.seed >>> 0) / 4294967296; }
  reset(start = true) {
    this.seed = this.initialSeed + this.eventId;
    const firstChoice: Side = this.random() > 0.5 ? 0 : 1;
    this.state = {
      phase: start ? 'intro' : 'menu', previousPhase: 'wrestling', age: 0, phaseAge: 0,
      period: 1, stage: 'regulation', overtimeRound: 0, remaining: 180,
      score: [0, 0], riding: [0, 0], overtimeRiding: [0, 0], regulationRidingAwarded: false,
      firstScorer: null, firstChoice, secondChoice: other(firstChoice), choiceFor: null, canDefer: false, secondTieChoice: 1,
      wrestlers: [athlete(-1.15, Math.PI / 2), athlete(1.15, -Math.PI / 2)],
      top: null, control: 50, exposure: 0, nearFallCount: 0, pin: 0,
      exchange: null, restartTime: 0, events: [], result: null,
    };
    this.opponent.reset();
    this.buffered = [null, null];
    this.velocity = [{ x: 0, z: 0 }, { x: 0, z: 0 }];
  }
  start() { this.reset(true); }
  beginWrestling() {
    const s = this.state;
    s.phase = 'wrestling'; s.phaseAge = 0;
    this.opponent.reset(this.settings.difficulty === 'club' ? 3.2 : 1.6);
    this.event('WRESTLE', 'Control the center. Create an opening.', 'whistle');
  }
  pause() {
    const s = this.state;
    if (s.phase === 'paused') { s.phase = s.previousPhase; return; }
    if (s.phase === 'wrestling' || s.phase === 'intro' || s.phase === 'break') { s.previousPhase = s.phase; s.phase = 'paused'; }
  }
  event(text: string, detail = '', kind: 'score' | 'whistle' | 'action' | 'warning' | 'finish' = 'action', side?: Side) {
    this.state.events.push({ id: ++this.eventId, text, detail, kind, side, at: this.state.age });
    if (this.state.events.length > 60) this.state.events.shift();
  }
  motion(side: Side, move: Move, duration = 0.65) {
    const w = this.state.wrestlers[side]; w.move = move; w.moveTime = 0; w.moveDuration = duration;
  }
  distance() { const [a, b] = this.state.wrestlers; return Math.hypot(a.x - b.x, a.z - b.z); }
  step(dt: number, input: Controls, opponentInput?: Controls) {
    dt = clamp(dt, 0, 0.05);
    const s = this.state;
    if (s.phase === 'paused' || s.phase === 'menu') return;
    s.age += dt; s.phaseAge += dt;
    if (s.phase === 'intro') { if (s.phaseAge >= 6.5) this.beginWrestling(); return; }
    if (s.phase === 'finished') return;
    if (s.phase === 'break') {
      for (const w of s.wrestlers) w.stamina = Math.min(100, w.stamina + dt * 7);
      if (s.choiceFor === 1 && s.phaseAge > 2.8) this.choose(this.state.stage === 'regulation' && this.random() > 0.82 ? 'neutral' : 'bottom');
      else if (s.choiceFor === null && s.phaseAge > 2.8) this.resumePeriod();
      return;
    }
    if (s.restartTime > 0) {
      s.restartTime -= dt;
      if (s.restartTime <= 0) this.event('WRESTLE', s.top === null ? 'Back to the center.' : 'Restart in referee’s position.', 'whistle');
      return;
    }
    dt = Math.min(dt, s.remaining / this.settings.clockSpeed);
    const inputs: [Controls, Controls] = [{ ...input }, { ...(opponentInput ?? this.opponent.decide(s, this.settings.difficulty, dt, () => this.random())) }];
    for (let n = 0; n < 2; n++) {
      const i = n as Side, w = s.wrestlers[i], c = inputs[i];
      w.cooldown = Math.max(0, w.cooldown - dt);
      w.moveTime += dt;
      if (w.moveTime > w.moveDuration) w.move = 'idle';
      w.defending = c.defend && w.stamina > 5 && !(s.exposure > 0 && s.top === i);
      w.defenseAge = w.defending ? w.defenseAge + dt : 0;
      w.setup = Math.max(0, w.setup - dt * 0.07);
      const regen = s.top === null ? 5.4 : 3.5;
      w.stamina = clamp(w.stamina + dt * (w.defending ? -5 : regen), 0, 100);
      w.passive += dt * this.settings.clockSpeed;
      const action = c.primary ? 'primary' : c.secondary ? 'secondary' : c.setup ? 'setup' : null;
      if (action) this.buffered[i] = w.cooldown > 0 || s.exchange ? { key: action, ttl: 0.35 } : null;
      const buffered = this.buffered[i];
      if (buffered) {
        buffered.ttl -= dt;
        if (buffered.ttl <= 0) this.buffered[i] = null;
        else if (w.cooldown <= 0 && !s.exchange) { c[buffered.key] = true; this.buffered[i] = null; }
      }
    }
    if (s.exchange) this.updateExchange(dt);
    else if (s.top === null) this.neutral(dt, inputs);
    else this.ground(dt, inputs);
    if (s.phase !== 'wrestling') return;
    // The final partial simulation tick cannot create riding time beyond the horn.
    const matchDt = Math.min(s.remaining, dt * this.settings.clockSpeed);
    if (s.top !== null) {
      if (s.stage === 'regulation') s.riding[s.top] += matchDt;
      else s.overtimeRiding[s.top] += matchDt;
    }
    s.remaining = Math.max(0, s.remaining - matchDt);
    if (s.remaining <= 0) { this.endPeriod(); return; }
    this.boundary();
    for (let n = 0; n < 2; n++) {
      const i = n as Side, w = s.wrestlers[i];
      // This is the game's referee heuristic, not an NCAA fixed stalling timer.
      if (w.passive > 45 && (s.top === i || s.top === null) && !s.exchange && s.exposure === 0) this.stall(i);
    }
  }
  private neutral(dt: number, controls: [Controls, Controls]) {
    const s = this.state;
    for (let n = 0; n < 2; n++) {
      const i = n as Side, w = s.wrestlers[i], opp = s.wrestlers[other(i)], c = controls[i];
      const mag = Math.hypot(c.x, c.z), normal = Math.max(1, mag);
      const speed = (c.sprint && w.stamina > 15 ? 2.6 : 1.65) * (w.defending ? 0.46 : 1) * (0.6 + w.stamina / 250);
      const velocity = this.velocity[i], targetX = c.x / normal * speed, targetZ = c.z / normal * speed;
      const dx = targetX - velocity.x, dz = targetZ - velocity.z, change = Math.hypot(dx, dz);
      const acceleration = (mag > 0.1 ? 14 : 20) * dt;
      const fraction = Math.min(1, acceleration / Math.max(change, 0.001));
      velocity.x += dx * fraction; velocity.z += dz * fraction;
      w.x += velocity.x * dt; w.z += velocity.z * dt;
      const edge = Math.hypot(w.x, w.z);
      if (edge > 6) { w.x *= 6 / edge; w.z *= 6 / edge; }
      w.speed = Math.hypot(velocity.x, velocity.z);
      if (c.sprint && mag > 0.1) w.stamina = Math.max(0, w.stamina - dt * 9);
      w.heading = Math.atan2(opp.x - w.x, opp.z - w.z);
    }
    const [a, b] = s.wrestlers;
    const d = this.distance();
    if (d < 0.98) {
      const nx = (b.x - a.x) / Math.max(d, 0.01), nz = (b.z - a.z) / Math.max(d, 0.01), push = (0.98 - d) * 0.5;
      a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
      for (const i of [0, 1] as const) {
        const velocity = this.velocity[i], toward = velocity.x * nx + velocity.z * nz;
        if (i === 0 ? toward > 0 : toward < 0) { velocity.x -= nx * toward; velocity.z -= nz * toward; }
      }
    }
    for (let n = 0; n < 2; n++) {
      const i = n as Side, w = s.wrestlers[i], c = controls[i], opp = s.wrestlers[other(i)];
      if (w.cooldown > 0 || s.exchange) continue;
      if (c.setup) {
        if (this.distance() > 1.9) { this.motion(i, 'handfight', 0.45); w.cooldown = 0.45; if (i === 0) this.event('CLOSE THE DISTANCE', 'Hand fighting works inside the engagement ring.'); continue; }
        w.stamina = Math.max(0, w.stamina - 7); w.setup = Math.min(1, w.setup + 0.4);
        opp.stamina = Math.max(0, opp.stamina - 3); w.cooldown = 0.62; w.passive = 0;
        this.motion(i, 'handfight', 0.6);
        this.event(w.setup > 0.65 ? 'OPENING CREATED' : 'HAND FIGHT', w.setup > 0.65 ? 'Attack now. Your opponent is off balance.' : 'Move their hands. Set up your shot.', 'action', i);
      } else if (c.primary || c.secondary) {
        if (w.stamina < 16) { if (i === 0) this.event('RECOVER YOUR STANCE', 'Create space to recover stamina.', 'warning'); continue; }
        const range = c.secondary ? 1.65 : 2.15;
        if (this.distance() > range) { w.stamina -= 7; w.cooldown = 0.8; this.motion(i, c.secondary ? 'snap' : 'shot', 0.55); if (i === 0) this.event('OUT OF RANGE', 'Step closer before committing to an attack.'); continue; }
        const dist = this.distance();
        s.exchange = { kind: c.secondary ? 'snap' : 'shot', actor: i, age: 0, duration: c.secondary ? 0.78 : 0.9,
          quality: w.setup * 0.72 + (w.stamina - opp.stamina) * 0.005 + 0.5 + (c.sprint ? 0.08 : 0),
          startX: w.x, startZ: w.z, directionX: (opp.x - w.x) / dist, directionZ: (opp.z - w.z) / dist };
        w.stamina -= c.secondary ? 16 : 21; w.setup = Math.max(0, w.setup - 0.55); w.cooldown = 1.3;
        w.attempts++; w.passive = 0;
        this.motion(i, c.secondary ? 'snap' : 'shot', s.exchange.duration);
        this.event(c.secondary ? 'SNAP DOWN' : 'DOUBLE LEG', i === 1 ? 'Defend now — hold SPACE to sprawl.' : 'Drive through the hips.', 'action', i);
      }
    }
  }
  private updateExchange(dt: number) {
    const s = this.state, e = s.exchange!;
    const a = s.wrestlers[e.actor], b = s.wrestlers[other(e.actor)];
    e.age += dt;
    if (e.kind === 'shot') {
      const amount = Math.min(dt * 1.7, Math.max(0, this.distance() - 0.72));
      a.x += e.directionX * amount; a.z += e.directionZ * amount;
    }
    if (e.kind === 'takedown' || e.kind === 'reversal') {
      const heading = e.kind === 'takedown' ? Math.atan2(e.directionX, e.directionZ) : a.heading;
      const dx = Math.sin(heading), dz = Math.cos(heading), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      const blend = 1 - Math.exp(-dt * 8);
      a.x += (mx - dx * 0.38 + dz * 0.14 - a.x) * blend;
      a.z += (mz - dz * 0.38 - dx * 0.14 - a.z) * blend;
      b.x += (mx + dx * 0.22 - b.x) * blend; b.z += (mz + dz * 0.22 - b.z) * blend;
      for (const w of [a, b]) w.heading += Math.atan2(Math.sin(heading - w.heading), Math.cos(heading - w.heading)) * blend;
    }
    if (e.kind === 'escape') {
      const separation = Math.max(0, Math.min(dt * 1.1, (1.6 - this.distance()) / 2));
      a.x += Math.sin(a.heading) * separation; a.z += Math.cos(a.heading) * separation;
      b.x -= Math.sin(a.heading) * separation; b.z -= Math.cos(a.heading) * separation;
    }
    if (e.age < e.duration) return;
    if (e.kind === 'shot' || e.kind === 'snap') {
      const timelyDefense = b.defending && b.defenseAge < 1.4;
      const defense = b.defending ? (e.kind === 'shot' ? (timelyDefense ? 0.72 : 0.5) : 0.19) : 0;
      const success = e.quality - defense + (this.random() - 0.5) * 0.18 > 0.52;
      if (success) {
        s.exchange = { ...e, kind: 'takedown', age: 0, duration: 0.85 };
        this.motion(e.actor, 'takedown', 0.85); this.motion(other(e.actor), 'takedown', 0.85);
      } else {
        s.exchange = { ...e, kind: 'sprawl', age: 0, duration: 0.62 };
        this.motion(other(e.actor), 'sprawl', 0.75); b.setup = Math.min(1, b.setup + 0.45); b.passive = 0;
        this.event('SHOT DEFENDED', e.actor === 1 ? 'Good hips. Counter with a setup and shot.' : 'Set up your next attack with L.', 'action', other(e.actor));
      }
    } else if (e.kind === 'takedown') {
      s.exchange = null; this.setGround(e.actor);
      a.takedowns++; this.award(e.actor, RULES.takedown, 'TAKEDOWN');
    } else if (e.kind === 'sprawl') {
      a.x -= e.directionX * 0.38; a.z -= e.directionZ * 0.38; s.exchange = null;
    } else if (e.kind === 'escape') {
      s.exchange = null; this.releaseNearFall();
      if (s.phase !== 'wrestling') return;
      s.top = null; a.escapes++;
      this.award(e.actor, RULES.escape, 'ESCAPE');
    } else if (e.kind === 'reversal') {
      s.exchange = null; this.releaseNearFall();
      if (s.phase !== 'wrestling') return;
      this.setGround(e.actor); a.reversals++;
      this.award(e.actor, RULES.reversal, 'REVERSAL');
    }
  }
  setGround(top: Side) {
    const s = this.state; s.top = top; s.control = 50; s.exposure = 0; s.nearFallCount = 0; s.pin = 0;
    const a = s.wrestlers[top], b = s.wrestlers[other(top)];
    const heading = a.heading, dx = Math.sin(heading), dz = Math.cos(heading);
    a.heading = b.heading = heading;
    const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
    b.x = x + dx * 0.22; b.z = z + dz * 0.22;
    a.x = x - dx * 0.38 + dz * 0.14; a.z = z - dz * 0.38 - dx * 0.14;
    this.velocity = [{ x: 0, z: 0 }, { x: 0, z: 0 }];
    for (const w of s.wrestlers) { w.cooldown = 0.65; w.passive = 0; w.move = 'idle'; }
  }
  private ground(dt: number, c: [Controls, Controls]) {
    const s = this.state, top = s.top!, bottom = other(top);
    const a = s.wrestlers[top], b = s.wrestlers[bottom], tc = c[top], bc = c[bottom];
    a.speed = b.speed = 0;
    // Crawling lets the defensive wrestler seek a legal boundary restart.
    const crawl = 0.3 * dt;
    for (const w of s.wrestlers) { w.x += bc.x * crawl; w.z += bc.z * crawl; }
    if (s.exposure > 0) {
      s.exposure += dt;
      s.nearFallCount = Math.max(s.nearFallCount, Math.min(4, s.exposure));
      const bridge = bc.defend && b.stamina > 7;
      const pressure = tc.primaryHeld && a.stamina > 8;
      b.stamina = Math.max(0, b.stamina - dt * (bridge ? 9 : 2));
      a.stamina = Math.max(0, a.stamina - dt * (pressure ? 7 : 2));
      s.control = clamp(s.control + dt * (pressure ? 11 : -8) - dt * (bridge ? 21 : 0), 0, 100);
      // Exposure alone is not a fall. Both shoulders must be flat for a continuous second.
      s.pin = !bridge && pressure && s.control > 94 && s.exposure > 1.8 ? s.pin + dt : 0;
      if (s.pin >= RULES.fallSeconds) { this.finish(top, 'Fall'); return; }
      if (s.control < 48 || s.exposure > 8.0) { this.releaseNearFall(); s.control = 48; this.motion(bottom, 'switch', 0.65); }
      return;
    }
    s.control = clamp(s.control + dt * (tc.defend ? 1.9 : -1.5), 0, 100);
    if (tc.setup && a.cooldown <= 0) {
      this.event('OPTIONAL RELEASE', 'One escape point to the defensive wrestler.', 'action', bottom);
      s.exchange = { kind: 'escape', actor: bottom, age: 0, duration: 0.8, quality: 0, startX: b.x, startZ: b.z, directionX: 0, directionZ: 0 };
      this.motion(bottom, 'standup', 0.8); return;
    }
    if ((tc.primary || tc.secondary) && a.cooldown <= 0 && a.stamina >= 11) {
      const alternate = a.lastGroundAction !== (tc.primary ? 'primary' : 'secondary');
      a.lastGroundAction = tc.primary ? 'primary' : 'secondary';
      s.control += (tc.secondary ? 15 : 19) + (alternate ? 5 : 0) - (bc.defend ? 7 : 0);
      a.stamina -= 12; a.cooldown = 0.82; a.passive = 0;
      this.motion(top, tc.secondary ? 'breakdown' : 'turn', 0.75);
      if (s.control >= 94 && tc.primary) {
        s.exposure = 0.001; s.nearFallCount = 0; s.pin = 0; s.control = 90;
        this.event('DANGER · NEAR FALL', top === 0 ? 'Hold J for pressure. Keep both shoulders down.' : 'Hold SPACE to bridge out!', 'warning', top);
      } else if (top === 0) this.event(tc.secondary ? 'BREAKDOWN' : 'WORKING THE HALF', 'Build control, then turn with J.', 'action', top);
    }
    if ((bc.primary || bc.secondary || bc.setup) && b.cooldown <= 0 && b.stamina >= 10) {
      const action = bc.secondary ? 'secondary' : bc.setup ? 'setup' : 'primary';
      const alternate = action !== b.lastGroundAction; b.lastGroundAction = action;
      const gain = (bc.secondary ? 17 : 23) + (alternate ? 6 : 0) - (tc.defend ? 10 : 0);
      s.control -= gain; b.stamina -= bc.secondary ? 15 : 12; b.cooldown = 0.8; b.passive = 0;
      this.motion(bottom, bc.secondary ? 'switch' : bc.setup ? 'heist' : 'standup', 0.72);
      if (s.control <= 7) {
        s.exchange = { kind: bc.secondary ? 'reversal' : 'escape', actor: bottom, age: 0, duration: 0.85, quality: 0, startX: b.x, startZ: b.z, directionX: 0, directionZ: 0 };
      } else if (bottom === 0) this.event(bc.secondary ? 'HIP SWITCH' : bc.setup ? 'HIP HEIST' : 'BUILD YOUR BASE', 'Chain different escapes to break control.', 'action', bottom);
    }
    s.control = clamp(s.control, 0, 100);
  }
  releaseNearFall(checkEnd = true) {
    const s = this.state, top = s.top, points = nearFallPoints(s.nearFallCount);
    s.exposure = 0; s.pin = 0; s.nearFallCount = 0;
    if (points > 0 && top !== null) this.award(top, points, 'NEAR FALL', checkEnd);
  }
  award(side: Side, points: number, label: string, checkEnd = true) {
    const s = this.state;
    if (s.result) return;
    s.score[side] += points;
    if (s.firstScorer === null && s.stage === 'regulation' && ['TAKEDOWN', 'REVERSAL', 'NEAR FALL', 'RIDING TIME'].includes(label)) s.firstScorer = side;
    this.event(`+${points} ${label}`, side === 0 ? 'Northwood earns the points.' : 'Ridgefield earns the points.', 'score', side);
    if (!checkEnd) return;
    if (Math.abs(s.score[0] - s.score[1]) >= RULES.technicalFall) this.finish(s.score[0] > s.score[1] ? 0 : 1, 'Technical fall');
    else if (s.stage === 'sudden') this.finish(side, 'Sudden victory');
  }
  stall(side: Side) {
    const w = this.state.wrestlers[side]; w.passive = 0; w.warnings++;
    const penalty = stallingPenalty(w.warnings);
    if (penalty === 'disqualification') this.finish(other(side), 'Disqualification');
    else if (penalty) this.award(other(side), penalty, 'STALLING');
    else this.event('STALLING WARNING', `${side === 0 ? 'Northwood' : 'Ridgefield'} must work to score.`, 'warning', side);
  }
  private boundary() {
    const s = this.state;
    if (s.exchange) return;
    // A body-radius approximation of NCAA's one-wrestler-in-bounds criterion.
    const outside = s.wrestlers.map(w => Math.hypot(w.x, w.z) > RULES.matRadius + 0.42);
    if (outside[0] && outside[1]) {
      this.releaseNearFall(); if (s.phase !== 'wrestling') return;
      this.center(); s.restartTime = 1.5;
      this.event('OUT OF BOUNDS', 'Return to center. No step-out point in folkstyle.', 'whistle');
    }
  }
  center() {
    const s = this.state;
    if (s.top === null) {
      s.wrestlers[0].x = -1.05; s.wrestlers[1].x = 1.05;
      s.wrestlers[0].z = s.wrestlers[1].z = 0;
    } else {
      s.wrestlers[0].x = s.wrestlers[1].x = 0;
      s.wrestlers[0].z = s.wrestlers[1].z = 0; this.setGround(s.top);
    }
    for (const w of s.wrestlers) { w.passive = 0; w.speed = 0; }
  }
  endPeriod() {
    const s = this.state;
    if (s.result) return;
    this.releaseNearFall(false);
    s.exchange = null; s.top = null; s.phase = 'break'; s.phaseAge = 0;
    if (s.stage === 'regulation' && s.period < 3) {
      if (Math.abs(s.score[0] - s.score[1]) >= RULES.technicalFall) { this.finish(s.score[0] > s.score[1] ? 0 : 1, 'Technical fall'); return; }
      s.period++; s.remaining = RULES.periods[s.period - 1];
      s.choiceFor = s.period === 2 ? s.firstChoice : s.secondChoice; s.canDefer = s.period === 2;
      this.event('END OF PERIOD', `Period ${s.period}. ${s.choiceFor === 0 ? 'Your' : 'Ridgefield’s'} choice of position.`, 'whistle');
    } else if (s.stage === 'regulation') {
      if (!s.regulationRidingAwarded) {
        s.regulationRidingAwarded = true;
        const side = ridingPoint(...s.riding);
        if (side !== null) this.award(side, 1, 'RIDING TIME', false);
        if (s.result) return;
      }
      if (s.score[0] !== s.score[1]) {
        const margin = Math.abs(s.score[0] - s.score[1]);
        this.finish(s.score[0] > s.score[1] ? 0 : 1, margin >= 15 ? 'Technical fall' : margin >= 8 ? 'Major decision' : 'Decision');
      } else this.startSuddenVictory();
    } else if (s.stage === 'sudden') {
      s.stage = 'tiebreak1'; s.remaining = RULES.tiebreaker;
      s.choiceFor = s.firstScorer ?? (this.random() < 0.5 ? 0 : 1); s.canDefer = true; s.secondTieChoice = other(s.choiceFor);
      this.event('TIEBREAKERS', 'Two 30-second periods. Each wrestler gets a choice.', 'whistle');
    } else if (s.stage === 'tiebreak1') {
      s.stage = 'tiebreak2'; s.remaining = RULES.tiebreaker;
      s.choiceFor = s.secondTieChoice; s.canDefer = false;
      this.event('SECOND TIEBREAKER', 'The second 30-second period must be completed.', 'whistle');
    } else {
      if (s.score[0] !== s.score[1]) this.finish(s.score[0] > s.score[1] ? 0 : 1, 'Decision');
      else if (Math.abs(s.overtimeRiding[0] - s.overtimeRiding[1]) >= 1 - 0.00001) this.finish(s.overtimeRiding[0] > s.overtimeRiding[1] ? 0 : 1, 'Riding time');
      else this.startSuddenVictory();
    }
    this.center();
  }
  private startSuddenVictory() {
    const s = this.state; s.stage = 'sudden'; s.overtimeRound++;
    s.remaining = s.overtimeRound === 1 ? RULES.firstSuddenVictory : RULES.laterSuddenVictory;
    s.choiceFor = null; s.canDefer = false;
    this.event('SUDDEN VICTORY', 'First score wins. Start from neutral.', 'whistle');
  }
  choose(choice: Choice) {
    const s = this.state;
    if (s.phase !== 'break' || s.choiceFor === null) return;
    const side = s.choiceFor;
    if (choice === 'defer' && s.canDefer) {
      if (s.stage === 'regulation') s.secondChoice = side;
      else s.secondTieChoice = side;
      s.choiceFor = other(side); s.canDefer = false; s.phaseAge = 0; return;
    }
    if (choice === 'defer') return;
    s.top = choice === 'neutral' ? null : choice === 'top' ? side : other(side);
    s.choiceFor = null; this.center(); this.resumePeriod();
  }
  private resumePeriod() {
    const s = this.state; s.phase = 'wrestling'; s.phaseAge = 0; s.restartTime = 1.1;
    for (const w of s.wrestlers) w.stamina = Math.min(100, w.stamina + 10);
    this.center();
  }
  finish(winner: Side, method: NonNullable<MatchState['result']>['method']) {
    const s = this.state;
    if (s.result) return;
    const elapsed = s.stage === 'regulation' ? RULES.periods.slice(0, s.period).reduce((a, b) => a + b, 0) - s.remaining : 420;
    s.result = { winner, method, time: clockText(elapsed) }; s.phase = 'finished'; s.phaseAge = 0; s.exchange = null;
    s.exposure = 0; s.nearFallCount = 0; s.pin = 0; s.top = null;
    this.motion(winner, 'celebrate', 9999);
    this.event(method.toUpperCase(), `${winner === 0 ? 'Northwood' : 'Ridgefield'} wins ${s.score[0]}–${s.score[1]}.`, 'finish', winner);
  }
  get periodLabel() {
    const s = this.state;
    return s.stage === 'regulation' ? `PERIOD ${s.period}` : s.stage === 'sudden' ? `SV ${s.overtimeRound}` : `TB ${s.overtimeRound} · ${s.stage === 'tiebreak1' ? '1' : '2'}`;
  }
}
