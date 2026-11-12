import {registerSupportedArmBarChain} from '../anim/supportedArmBar';
let supportedStudyScaleKey='';
import {playableMatchup} from '../sim/playerDifficulty';
import {actionFraming} from './actionFraming';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { Renderer } from '../engine/Renderer';
import { CameraRig } from '../engine/CameraRig';
import type { CameraMode } from '../engine/CameraRig';
import type { PadState } from '../engine/Input';
import { Input } from '../engine/Input';
import { AudioBus } from '../engine/AudioBus';
import { createGym, createLighting } from '../arena/gym';
import type { Gym } from '../arena/gym';
import { createMat } from '../arena/mat';
import { Scoreboard } from '../arena/scoreboard';
import { MatchSim } from '../sim/MatchSim';
import { resolveHeadClearance, headOverlap } from '../anim/headClearance';
import { WrestlerAI } from '../sim/ai';
import type { Difficulty } from '../sim/ai';
import { byId, OFFICIAL, DEFAULT_MATCHUP } from '../sim/roster';
import { NO_COMMAND, otherSide } from '../sim/types';
import type { Command, MatchPhase, School, Side, StartPosition, Wrestler } from '../sim/types';
import type { MeshQuality } from '../body/generate';
import type { CharacterRig } from '../body/Character';
import { Animator } from '../anim/Animator';
import type { AnimView } from '../anim/Animator';
import '../anim/library';
import { wrestlerViews } from './views';
import { Coaches } from './Coaches';
import { edgeHintFor, handsHintFor, readPrompts } from './prompts';
import { isDone, newTournament, pairOf, playerMatch, record as recordTournament, simMatch, simUntilPlayer, toResult as tournamentResult, type Tournament } from '../sim/tournament';
import { choiceFor, currentBout, newDual, pickList, pickOddEven, pickWrestler, recordBout, simulateBout, toBoutResult, type Dual } from '../sim/dual';
import { ContextControls } from './contextControls';
import { DEFAULT_PLAN, type MatchPlan } from '../sim/strategy';
import type { GameApi, UiStore } from './store';

export type PracticeStart = 'standing' | 'top' | 'bottom' | 'single' | 'double' | 'lowSingle' | 'highCrotch';

/** Celebration confetti. */
class Confetti {
  readonly points: Points;
  private velocities: Float32Array;
  private life = 0;
  private count: number;

  constructor(count = 900) {
    this.count = count;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
    this.points = new Points(
      geo,
      new PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
    );
    this.points.frustumCulled = false;
  }

  burst(at: Vector3, a: [number, number, number], b: [number, number, number]): void {
    const pos = this.points.geometry.getAttribute('position') as Float32BufferAttribute;
    const col = this.points.geometry.getAttribute('color') as Float32BufferAttribute;
    for (let i = 0; i < this.count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.6;
      pos.setXYZ(i, at.x + Math.cos(ang) * r, 5.4 + Math.random() * 4.5, at.z + Math.sin(ang) * r);
      this.velocities[i * 3] = (Math.random() - 0.5) * 1.3;
      this.velocities[i * 3 + 1] = -0.6 - Math.random() * 1.1;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 1.3;
      const c = Math.random() < 0.5 ? a : b;
      col.setXYZ(i, c[0], c[1], c[2]);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.life = 9;
    (this.points.material as PointsMaterial).opacity = 1;
  }

  update(dt: number): void {
    if (this.life <= 0) return;
    this.life -= dt;
    const pos = this.points.geometry.getAttribute('position') as Float32BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      arr[i * 3] += this.velocities[i * 3] * dt;
      arr[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      arr[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      this.velocities[i * 3] += Math.sin(arr[i * 3 + 1] * 4 + i) * dt * 0.7;
    }
    pos.needsUpdate = true;
    (this.points.material as PointsMaterial).opacity = Math.max(0, Math.min(1, this.life / 2.5));
  }
}

const FIXED_DT = 1 / 60;
const RED_BAND = '#d42a20';
const GREEN_BAND = '#1f9d4c';

const hexRgb = (c: string): [number, number, number] => {
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

interface Body {
  char: CharacterRig;
  anim: Animator;
  wrestler: Wrestler;
}

/**
 * Game.
 *
 * Owns the render loop and wires the simulation to everything that draws,
 * sounds or reads it. Nothing below this line knows about React, and nothing in
 * the simulation knows about three.js.
 */
export class Game implements GameApi {
  private topTurn: import('../sim/armBars').TopTurnChoice | undefined;
  private context = new ContextControls();
  private footworkAi: WrestlerAI | undefined;
  private autoAi?: WrestlerAI;
  /** Which mirror side the camera holds for the current mat sequence (null on the feet). */
  private matCamSide: 1 | -1 | null = null;
  /** The player's last plan carries into the next match. */
  private playerPlan: MatchPlan = DEFAULT_PLAN;
  setTopTurn(choice: import('../sim/armBars').TopTurnChoice | undefined):void {this.topTurn=choice;}
  private renderer: Renderer;
  private cameraRig = new CameraRig();
  private input: Input;
  private audio = new AudioBus();
  private gym: Gym;
  private scoreboard: Scoreboard;
  private matGroup: Group | null = null;
  private quality: MeshQuality;

  sim: MatchSim | null = null;
  private ai: WrestlerAI | null = null;
  private bodies: [Body, Body] | null = null;
  private official: Body | null = null;
  /** The two corner coaches for the current match (owner, November 11). */
  private coaches: Coaches | null = null;
  private confetti = new Confetti();
  private buildToken = 0;

  private accumulator = 0;
  private lastTime = 0;
  private raf = 0;
  private timeScale = 1;
  private slowMoT = 0;
  private hitStop = 0;
  private excitement = 0.1;
  private frameTimes: number[] = [];
  private uiClock = 0;
  private running = false;
  private squeakT = 0;
  private resizeObserver: ResizeObserver | null = null;
  private feedbackId = 1;
  // Named attacks share the sim's shoot channel; preserve the input's label
  // during this tick so its acknowledgement matches the button the player used.
  private namedAttackFeedback: string | undefined;
  private refSignal: { side: Side; t: number } | null = null;
  /** The referee's hand out toward a wrestler: work (his stall clock is building) or a stalling call. */
  private refCue: { side: Side; t: number } | null = null;
  private lastPhase: MatchPhase = 'attract';
  private restartCut = false;
  private camFocus = new Vector3();
  private lens = 0;
  private reactUntil = 0;
  private clockT = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private store: UiStore,
  ) {
    const coarse = matchMedia('(pointer: coarse)').matches || (import.meta.env.DEV && new URLSearchParams(location.search).has('touch'));
    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.quality = coarse && small ? 'low' : 'high';
    this.renderer = new Renderer(canvas, this.quality === 'low' ? 'medium' : 'high');
    this.input = new Input();
    const home = byId(DEFAULT_MATCHUP[0]).school;
    const away = byId(DEFAULT_MATCHUP[1]).school;
    this.gym = createGym(home, away);
    this.renderer.scene.add(this.gym.group);
    createLighting(this.renderer.scene);
    this.scoreboard = new Scoreboard(home, away);
    this.scoreboard.group.position.set(0, 8.1, 0);
    this.renderer.scene.add(this.scoreboard.group);
    this.renderer.scene.add(this.confetti.points);
    this.setMat(home);

    this.resizeObserver = new ResizeObserver(() => this.renderer.resize());
    if (canvas.parentElement) this.resizeObserver.observe(canvas.parentElement);
    window.addEventListener('resize', this.onResize);

    this.input.on('pause', () => {
      const s = this.store.getSnapshot();
      if (s.screen === 'playing' && !s.result) this.setPaused(!s.paused);
    });
    this.input.on('help', () => this.toggleHelp());
    this.input.on('mute', () => this.toggleMute());
    this.input.on('confirm', () => {
      if (this.sim?.phase === 'intros') this.skipIntros();
    });
    this.input.onDevice = (device) => this.store.set({ device });
    window.addEventListener('blur', this.clearPendingTechnique);

    this.store.set({ touchControls: coarse });
    void this.buildOfficial();
    this.preview(this.store.getSnapshot().matchup);

    if (import.meta.env.DEV) {
      (window as unknown as { matRivals: unknown }).matRivals = this;
    }
    this.loop(performance.now());
  }

  private onResize = () => this.renderer.resize();

  private setMat(host: School): void {
    if (this.matGroup) this.renderer.scene.remove(this.matGroup);
    this.matGroup = createMat(host);
    this.renderer.scene.add(this.matGroup);
  }

  /* ------------------------------------------------------------- bodies --- */

  private async buildCharacter(w: Wrestler, band: string | null): Promise<CharacterRig> {
    const { buildRealCharacter, buildRealOfficial } = await import('../body/realistic/factory');
    return w.id === OFFICIAL.id ? buildRealOfficial(w, this.quality) : buildRealCharacter(w, band ?? '#111', this.quality);
  }

  private async buildCoach(w: Wrestler): Promise<CharacterRig> {
    const { buildRealCoach } = await import('../body/realistic/factory');
    return buildRealCoach(w, this.quality);
  }

  private async buildOfficial(): Promise<void> {
    const char = await this.buildCharacter(OFFICIAL, null);
    this.official = { char, anim: new Animator(char), wrestler: OFFICIAL };
    this.renderer.scene.add(char.root);
  }

  private async buildPair(matchup: [string, string]): Promise<[Body, Body] | null> {
    const token = ++this.buildToken;
    const ws: [Wrestler, Wrestler] = [byId(matchup[0]), byId(matchup[1])];
    const chars = await Promise.all([this.buildCharacter(ws[0], RED_BAND), this.buildCharacter(ws[1], GREEN_BAND)]);
    if (token !== this.buildToken) {
      for (const c of chars) c.dispose();
      return null;
    }
    return [
      { char: chars[0], anim: new Animator(chars[0]), wrestler: ws[0] },
      { char: chars[1], anim: new Animator(chars[1]), wrestler: ws[1] },
    ];
  }

  private installBodies(bodies: [Body, Body]): void {
    this.removeBodies();
    this.bodies = bodies;
    for (const b of bodies) this.renderer.scene.add(b.char.root);
  }

  private removeBodies(): void {
    if (!this.bodies) return;
    for (const b of this.bodies) {
      this.renderer.scene.remove(b.char.root);
      b.char.dispose();
    }
    this.bodies = null;
  }

  /* --------------------------------------------------------------- API ---- */

  /** Title screen: show the selected pair squaring off. */
  preview(matchup: [string, string]): void {
    this.store.set({ matchup });
    const current = this.bodies?.map((b) => b.wrestler.id).join('|');
    if (current === matchup.join('|')) return;
    void this.buildPair(matchup).then((bodies) => {
      if (!bodies || this.running) return;
      this.installBodies(bodies);
      for (const b of bodies) b.anim.instant = true;
      this.setMat(bodies[0].wrestler.school);
    });
  }

  start(options: { humanSide: Side; difficulty: Difficulty; matchup: [string, string]; quick: boolean; choice?: Side | null }): void {
    this.input.clearTouch();
    this.input.clearKeyboardPresses();
    void this.audio.resume();
    this.teardownMatch();
    this.store.set({ screen: 'loading', loading: 0.2, matchup: options.matchup });
    const ready =
      this.bodies && this.bodies.map((b) => b.wrestler.id).join('|') === options.matchup.join('|')
        ? Promise.resolve(this.bodies)
        : this.buildPair(options.matchup);
    void ready.then((bodies) => {
      if (!bodies) return;
      if (bodies !== this.bodies) this.installBodies(bodies);
      this.beginMatch(options);
    });
  }

  private beginMatch(options: { humanSide: Side; difficulty: Difficulty; matchup: [string, string]; quick: boolean; choice?: Side | null }, practice = false): void {
    this.input.clearKeyboardPresses();
    const bodies = this.bodies!;
    const wrestlers: [Wrestler, Wrestler] = [bodies[0].wrestler, bodies[1].wrestler];
    const human = options.humanSide;
    const sim = new MatchSim(playableMatchup(wrestlers,human,options.difficulty), {
      onScore: (e) => {
        this.audio.roar(e.points >= 3 ? 0.9 : 0.5);
        this.audio.score(e.side === human);
        this.gym.excite(e.points >= 3 ? 0.6 : 0.3);
        this.excitement = Math.min(1, this.excitement + 0.45);
        this.refSignal = { side: e.side, t: 1.6 };
        this.coaches?.onScore(e);
        this.store.set({ lastScore: e, scoreLog: [...sim.scoreLog] });
      },
      onRefCue: (side) => { this.refCue = { side, t: 1.5 }; },
      onAnnounce: (a) => {
        this.store.set({ announcement: a });
        window.setTimeout(() => {
          if (this.store.getSnapshot().announcement?.id === a.id) this.store.set({ announcement: null });
        }, a.hold * 1000);
      },
      onMove: (def) => {
        this.cameraRig.setMode(def.camera as CameraMode);
        this.audio.whoosh(0.5);
        if (def.crowd) {
          this.gym.excite(def.crowd);
          this.audio.roar(def.crowd * 0.7);
        }
      },
      onImpact: (strength, _at, slowmo) => {
        // Freeze-frame on contact, then let it breathe.
        this.hitStop = Math.max(this.hitStop, 0.04 + strength * 0.07);
        for (const b of bodies) b.anim.impulse(strength * 0.8, (Math.random() - 0.5) * strength * 0.5);
        this.cameraRig.shake(strength * 0.8);
        this.audio.impact(strength);
        this.input.rumble(0.25 + strength * 0.6, 90 + strength * 140);
        this.gym.excite(strength * 0.35);
        if (slowmo && strength >= 0.7) {
          this.timeScale = 0.35;
          this.slowMoT = 0.42;
        }
      },
      onWhistle: (reason) => {
        this.audio.whistle();
        if (reason === 'period' || reason === 'finish') this.audio.buzzer();
      },
      onPhase: (phase) => this.onPhase(phase),
      onResult: (result) => {
        const winner = wrestlers[result.winner].school;
        this.confetti.burst(new Vector3(sim.center.x, 0, sim.center.z), hexRgb(winner.primary), hexRgb(winner.accent));
        this.audio.roar(1);
        this.gym.excite(1);
        this.renderer.setBloom(0.5);
        this.store.set({ result, lastScore: null, announcement: null, react: null });
        // Tournament: his match goes in the bracket (his side in the bracket may be either slot).
        const tour = this.store.getSnapshot().tournament;
        const tm = tour && playerMatch(tour);
        if (tour && tm && human === 0 && wrestlers[0].id === tour.player) {
          const pair = pairOf(tour, tm);
          if (pair.includes(wrestlers[1].id)) {
            const r = tournamentResult(result, false);
            this.store.set({ tournament: recordTournament(tour, tm.id, pair[0] === tour.player ? r : { ...r, winner: r.winner === 0 ? 1 : 0, score: [r.score[1], r.score[0]] }) });
          }
        }
        // Dual meet: a finished bout goes on the team score.
        const dual = this.store.getSnapshot().dual;
        const bout = dual && currentBout(dual);
        if (dual && bout && bout.ours === wrestlers[0].id && bout.theirs === wrestlers[1].id && human === 0) {
          this.store.set({ dual: recordBout(dual, toBoutResult(result, false)) });
        }
      },
      onTell: (to, what) => {
        if (to !== human) {
          this.ai?.onTell(what);
          return;
        }
        // Most sprawls come off the level change: a fake or half shot gets the same cue as a
        // real shot, because at that instant you cannot tell them apart.
        // He bit on my tap: the moment to go.
        if (what === 'opening') {
          this.store.set({ react: { button: 'shoot', label: 'Go!', id: this.feedbackId++ } });
          this.reactUntil = this.clockT + 0.6;
          return;
        }
        if (what === 'shot' || what === 'fake') {
          this.store.set({ react: { button: 'sprawl', label: 'Sprawl!', id: this.feedbackId++ } });
          this.reactUntil = this.clockT + (what === 'shot' ? 0.55 : 0.4);
        }
      },
      onFeedback: (side, button, result, label) => {
        bodies[side].anim.effort(button, false, result);
        bodies[otherSide(side)].anim.effort(button, true, result);
        // Winning a hand fight yanks the other man's head and shoulders.
        if (result === 'won' && button === 'fight') bodies[otherSide(side)].anim.impulse(0.35, (Math.random() - 0.5) * 0.6);
        if (result === 'lost' && button === 'fight') bodies[side].anim.impulse(0.2, 0);
        if (side !== human) return;
        this.audio.press(result);
        if (result === 'won') this.input.rumble(0.35, 70);
        this.store.set({ flash: { button, label: label ?? (button === 'shoot' && this.namedAttackFeedback ? this.namedAttackFeedback : this.store.getSnapshot().prompts[button].label), result, id: this.feedbackId++ } });
      },
    });
    sim.humanSide = human;
    sim.practice = options.difficulty==='practice';
    // A coach in each corner (not in practice).
    if (!practice && !sim.practice) {
      this.coaches = new Coaches(this.renderer.scene, (w) => this.buildCoach(w));
      void this.coaches.load(wrestlers);
    }
    sim.bout.practicePartner = sim.practice ? otherSide(human) : null;
    sim.lengthScale = options.quick ? 0.5 : 1;
    // A dual bout takes its second-period choice from the dual's coin toss.
    sim.presetChoice = options.choice ?? null;
    // Time between periods to see the toss and change the plan.
    sim.breakSeconds = 4.5;
    // The player's wrestler sprawls by reflex and crossfaces on his own; pressing does better.
    sim.bout.assistedSide = human;
    sim.setPlan(human, this.playerPlan);
    this.sim = sim;
    this.ai = new WrestlerAI(otherSide(human), options.difficulty);

    for (const b of bodies) {
      b.anim.footwork.onPlant = (_f, _x, _z, speed) => {
        if (speed > 0.6 && this.squeakT <= 0) {
          this.squeakT = 0.25 + Math.random() * 0.4;
          this.audio.squeak();
        }
      };
    }

    this.setMat(wrestlers[0].school);
    this.renderer.scene.remove(this.scoreboard.group);
    this.scoreboard = new Scoreboard(wrestlers[0].school, wrestlers[1].school);
    this.scoreboard.group.position.set(0, 8.1, 0);
    this.renderer.scene.add(this.scoreboard.group);

    this.store.set({
      screen: 'playing',
      loading: 1,
      wrestlers,
      humanSide: human,
      difficulty: options.difficulty,
      quick: options.quick,
      result: null,
      lastScore: null,
      scoreLog: [],
      score: [0, 0],
      paused: false,
      announcement: null,
      react: null,
      flash: null,
    });
    this.running = true;
    if(practice || options.difficulty==='practice'){
      sim.bout.setNeutral({x:0,z:0},Math.PI/2,1.05);
      sim.phase='wrestling';
      this.onPhase('wrestling');
    }else sim.startIntros();
    for (const b of bodies) b.anim.instant = true;
  }

  /** Start a fresh cooperative repetition, retaining the selected athletes. */
  resetPractice(start: PracticeStart = 'standing'): MatchSim | null {
    if((!import.meta.env.DEV && this.store.getSnapshot().difficulty!=='practice') || !this.bodies)return null;
    const s=this.store.getSnapshot();
    this.input.clearTouch();
    this.input.clearKeyboardPresses();
    this.teardownMatch();
    this.renderer.setBloom(.3);
    this.beginMatch({humanSide:s.humanSide,difficulty:s.difficulty,
      matchup:[this.bodies[0].wrestler.id,this.bodies[1].wrestler.id],quick:s.quick},true);
    const sim=this.sim;
    if(!sim)return null;
    if(start==='top'||start==='bottom') {
      sim.bout.setReferee(start==='top'?s.humanSide:otherSide(s.humanSide),{x:0,z:0},Math.PI/2);
      sim.holdForWhistle(1.2);
    } else if(start!=='standing') {
      sim.bout.position={kind:'legs',A:s.humanSide,shot:start,mirror:false,t:0,
        frame:{x:0,z:0,yaw:s.humanSide===0?Math.PI/2:-Math.PI/2},progress:.6,intensity:0};
    }
    this.setPaused(false);
    this.syncUi();
    return sim;
  }

  rematch(): void {
    const s = this.store.getSnapshot();
    if (!s.wrestlers) return;
    this.renderer.setBloom(0.3);
    this.start({ humanSide: s.humanSide, difficulty: s.difficulty, matchup: [s.wrestlers[0].id, s.wrestlers[1].id], quick: s.quick });
  }

  /* ---------------------------------------------------------- tournament --- */

  startTournament(options: { pick: string; difficulty: Difficulty; quick: boolean }): void {
    const w = byId(options.pick);
    const tournament = newTournament(w.weightClass, w, options.difficulty, options.quick);
    this.store.set({ screen: 'tournament', tournament, dual: null, difficulty: options.difficulty, quick: options.quick });
    this.runTournamentSims();
  }

  /** Sim the other bouts a few at a time until his next match is ready (or to the end once he is out). */
  private runTournamentSims(toEnd = false): void {
    this.store.set({ tournamentBusy: true });
    const step = () => {
      let t = this.store.getSnapshot().tournament;
      if (!t) { this.store.set({ tournamentBusy: false }); return; }
      if (toEnd) {
        for (let i = 0; i < 3 && !isDone(t); i++) { const m = playerMatch(t); t = m ? simMatch(t, m) : simUntilPlayer(t, 1); }
      } else t = simUntilPlayer(t, 3);
      this.store.set({ tournament: t });
      const nextUp = t.matches.find((m) => !m.result && pairOf(t, m).every((x) => x !== undefined));
      const more = toEnd ? !isDone(t) : !!nextUp && !pairOf(t, nextUp).includes(t.player);
      if (more) window.setTimeout(step, 0);
      else { this.store.set({ tournamentBusy: false }); this.previewTournament(t); }
    };
    window.setTimeout(step, 30);
  }

  private previewTournament(t: Tournament): void {
    const m = playerMatch(t);
    if (!m) return;
    const [a, b] = pairOf(t, m);
    this.preview([t.player, (a === t.player ? b : a)!]);
  }

  wrestleTournament(): void {
    const t = this.store.getSnapshot().tournament;
    const m = t && playerMatch(t);
    if (!t || !m || this.store.getSnapshot().tournamentBusy) return;
    const [a, b] = pairOf(t, m);
    this.start({ humanSide: 0, difficulty: t.difficulty, matchup: [t.player, (a === t.player ? b : a)!], quick: t.quick });
  }

  simTournamentBout(): void {
    const t = this.store.getSnapshot().tournament;
    const m = t && playerMatch(t);
    if (!t || !m || this.store.getSnapshot().tournamentBusy) return;
    this.store.set({ tournament: simMatch(t, m) });
    this.runTournamentSims();
  }

  simTournamentRest(): void {
    if (this.store.getSnapshot().tournamentBusy) return;
    this.runTournamentSims(true);
  }

  toTournament(): void {
    if (!this.store.getSnapshot().tournament) { this.toTitle(); return; }
    this.toTitle();
    this.store.set({ screen: 'tournament' });
    this.runTournamentSims();
  }

  leaveTournament(): void {
    this.store.set({ tournament: null, tournamentBusy: false });
    this.toTitle();
  }

  /* ----------------------------------------------------------- dual meet --- */

  startDual(options: { teams: [string, string]; difficulty: Difficulty; quick: boolean; draw?: boolean }): void {
    const dual = newDual(options.teams, options.difficulty, options.quick, Math.random, options.draw);
    this.store.set({ screen: 'dual', dual, tournament: null, difficulty: options.difficulty, quick: options.quick });
    this.previewDual(dual);
  }

  /** Show the next bout's pair in the arena: his pick, or until he picks, his top-rated man there. */
  private previewDual(dual: Dual): void {
    const bout = currentBout(dual);
    if (!bout) return;
    this.preview([bout.ours ?? pickList(dual.teams[0], bout.weight)[0].id, bout.theirs]);
  }

  pickOddEven(odd: boolean): void {
    const dual = this.store.getSnapshot().dual;
    if (!dual || dual.toss.winner !== 0 || dual.toss.odd !== undefined) return;
    this.store.set({ dual: pickOddEven(dual, odd) });
  }

  pickDual(id: string): void {
    const dual = this.store.getSnapshot().dual;
    if (!dual || !currentBout(dual)) return;
    const next = pickWrestler(dual, id);
    this.store.set({ dual: next });
    this.previewDual(next);
  }

  wrestleDual(): void {
    const dual = this.store.getSnapshot().dual;
    const bout = dual && currentBout(dual);
    if (!dual || !bout?.ours || choiceFor(dual, bout) === null) return;
    this.start({ humanSide: 0, difficulty: dual.difficulty, matchup: [bout.ours, bout.theirs], quick: dual.quick, choice: choiceFor(dual, bout) });
  }

  simDual(): void {
    const dual = this.store.getSnapshot().dual;
    const bout = dual && currentBout(dual);
    if (!dual || !bout?.ours || choiceFor(dual, bout) === null) return;
    const next = recordBout(dual, toBoutResult(simulateBout([bout.ours, bout.theirs], dual.quick, undefined, choiceFor(dual, bout)), true));
    this.store.set({ dual: next });
    this.previewDual(next);
  }

  /** From a bout (finished or left) back to the dual's bout sheet. */
  toDual(): void {
    const dual = this.store.getSnapshot().dual;
    if (!dual) { this.toTitle(); return; }
    this.toTitle();
    this.store.set({ screen: 'dual' });
    this.previewDual(dual);
  }

  leaveDual(): void {
    this.store.set({ dual: null });
    this.toTitle();
  }

  toTitle(): void {
    this.input.clearTouch();
    this.input.clearKeyboardPresses();
    this.teardownMatch();
    this.running = false;
    this.cameraRig.setMode('showcase');
    this.renderer.setBloom(0.3);
    this.store.set({ screen: 'title', result: null, announcement: null, paused: false, react: null });
    if (this.bodies) for (const b of this.bodies) b.anim.instant = true;
  }

  choosePosition(pos: StartPosition | 'defer'): void {
    this.sim?.choosePosition(pos);
    // Deferring hands the choice over; the next snapshot says who chooses now.
    this.store.set({ awaitingChoice: this.sim?.phase === 'positionChoice', canDefer: !!this.sim?.canDefer });
  }

  setPlan(plan: MatchPlan): void {
    this.playerPlan = plan;
    if (this.sim) this.sim.setPlan(this.sim.humanSide, plan);
    this.store.set({ plan });
  }

  private clearPendingTechnique = (): void => {
    if (this.sim) {
      // Released presses already sampled during recovery must not survive a menu/blur.
      // This only clears pending intent; committed shots and moves keep their state.
      this.sim.bout.cancelPendingShot(this.sim.humanSide);
      this.sim.bout.cancelPendingTechnique(this.sim.humanSide);
    }
  };

  setPaused(paused: boolean): void {
    if (this.sim) {
      // Released presses already sampled during recovery must not survive a menu/blur.
      // This only clears pending intent; committed shots and moves keep their state.
      this.sim.bout.cancelPendingShot(this.sim.humanSide);
      this.sim.bout.cancelPendingTechnique(this.sim.humanSide);
    }
    this.input.clearTouch();
    this.input.clearKeyboardPresses();
    this.store.set({ paused });
  }

  toggleHelp(): void {
    this.store.set({ showHelp: !this.store.getSnapshot().showHelp });
  }

  toggleMute(): void {
    const muted = !this.store.getSnapshot().muted;
    this.audio.setMuted(muted);
    this.store.set({ muted });
  }

  cancelTouch(key?: import("../engine/TouchGestures").TouchKey): void {
    const cancelTechnique = (!key || key === 'technique') && this.input.ownsTouchTechnique;
    if (this.input.cancelTouch(key) && this.sim) this.sim.bout.cancelPendingShot(this.sim.humanSide);
    if (cancelTechnique && this.sim) this.sim.bout.cancelPendingTechnique(this.sim.humanSide);
  }

  setTouch(state: PadState): void {
    this.input.touch = state;
    if (Object.values(state).some(Boolean)) { this.input.device = 'touch'; this.store.set({ device: 'touch' }); }
  }

  chooseTopRestart(cut: boolean): void { this.sim?.chooseTopRestart(cut); }
  chooseBreakdown(kind: import('../sim/bout').Breakdown): void { this.sim?.chooseBreakdown(kind); }

  skipIntros(): void {
    this.sim?.skipIntros();
  }

  /* ------------------------------------------------------------- phases --- */

  private onPhase(phase: MatchPhase): void {
    const walkedBack = this.lastPhase === 'whistle' && phase === 'setPosition' && this.sim?.bout.top === null;
    this.lastPhase = phase;
    // They walked back to the center themselves; they just step onto the marks.
    if (walkedBack) {
      this.cameraRig.setMode('broadcast');
      return;
    }
    switch (phase) {
      case 'intros':
        this.cameraRig.setMode('intro');
        break;
      case 'handshake':
      case 'coinToss':
      case 'whistle':
        this.cameraRig.setMode('wide');
        break;
      case 'periodBreak':
        // The period ends wherever they are, often one man on his back. Cut to the wide shot
        // with both already up, as a broadcast does, instead of snapping them off the mat.
        this.cameraRig.setMode('wide');
        this.restartCut = true;
        if (this.bodies) for (const b of this.bodies) b.anim.instant = true;
        break;
      case 'positionChoice':
        this.cameraRig.setMode('wide');
        this.store.set({ awaitingChoice: true });
        break;
      case 'setPosition':
        this.cameraRig.setMode(this.sim?.bout.top !== null ? 'mat' : 'broadcast');
        // The sim has just moved them onto the marks. Cut there like a broadcast
        // rather than letting the spring fling both bodies across the mat.
        this.restartCut = true;
        if (this.bodies) for (const b of this.bodies) b.anim.instant = true;
        break;
      case 'wrestling':
        this.cameraRig.setMode(this.sim?.bout.top !== null ? 'mat' : 'broadcast');
        break;
      case 'celebration':
        this.cameraRig.setMode('celebration');
        break;
      case 'results':
        this.store.set({ screen: 'results' });
        break;
      default:
        break;
    }
  }

  /* --------------------------------------------------------------- loop --- */

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const wall = Math.min(0.1, (now - this.lastTime) / 1000 || FIXED_DT);
    this.lastTime = now;
    this.clockT += wall;
    this.frameTimes.push(wall);
    if (this.frameTimes.length > 45) this.frameTimes.shift();
    this.input.poll();

    const paused = this.store.getSnapshot().paused;
    if (this.slowMoT > 0) {
      this.slowMoT -= wall;
      if (this.slowMoT <= 0) this.timeScale = 1;
    } else {
      this.timeScale += (1 - this.timeScale) * Math.min(1, wall * 6);
    }
    let dt = paused ? 0 : wall * this.timeScale;
    if (this.hitStop > 0) {
      this.hitStop -= wall;
      dt = 0;
    }
    this.squeakT -= dt;

    if (this.sim && this.bodies && this.running) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < 5) {
        this.step(FIXED_DT);
        this.accumulator -= FIXED_DT;
        steps++;
      }
      this.present(dt, wall);
    } else {
      this.presentShowcase(wall);
    }

    // Title screen: frame the face-off to the right of the menu.
    const wide = this.renderer.camera.aspect > 1.3;
    const shiftTarget = this.store.getSnapshot().screen === 'title' && wide ? 0.17 : 0;
    this.lens += (shiftTarget - this.lens) * Math.min(1, wall * 5);
    this.renderer.setLensShift(Math.abs(this.lens) < 0.002 ? 0 : this.lens);

    this.gym.update(wall);
    this.confetti.update(wall);
    this.excitement = Math.max(0.08, this.excitement - wall * 0.25);
    this.audio.update(wall, this.excitement);
    this.renderer.render();

    this.uiClock += wall;
    if (this.uiClock > 0.05) {
      this.uiClock = 0;
      this.syncUi();
    }
  };

  /** Stick in screen space to a world direction, using the camera. */
  private stickToWorld(x: number, y: number): { x: number; z: number } {
    const az = this.cameraRig.viewAzimuth;
    const rx = Math.cos(az);
    const rz = -Math.sin(az);
    const fx = -Math.sin(az);
    const fz = -Math.cos(az);
    return { x: rx * x + fx * y, z: rz * x + fz * y };
  }

  private step(dt: number): void {
    const sim = this.sim!;
    const pad = this.input.state();
    const move = this.stickToWorld(pad.x, pad.y);
    // The position and stick pick the move; a dedicated key, where one is pressed, still wins.
    const ctx = sim.phase === 'wrestling' ? this.context.map(dt, pad, move, sim.bout, sim.humanSide) : {};
    const human: Command = {
      moveX: move.x,
      moveZ: move.z,
      shoot: ctx.shoot ?? pad.shoot,
      topTurn:this.topTurn,
      sustainedEffort: pad.sustainedEffort,
      legAction: pad.legAction ?? ctx.legAction,
      legRide: pad.legRide || ctx.legRide,
      closePockets: pad.closePockets || ctx.closePockets,
      catchLeg: pad.catchLeg || ctx.catchLeg,
      technique: pad.technique ?? ctx.technique,
      lowSingle: pad.lowSingle || ctx.lowSingle,
      scramble: pad.scramble || ctx.scramble,
      sitOut: pad.sitOut,
      fight: ctx.fight ?? pad.fight,
      tieUp: ctx.tieUp,
      sprawl: pad.sprawl,
      level: ctx.level ?? pad.level,
    };
    const wrestling = sim.phase === 'wrestling';
    let aiCmd = import.meta.env.DEV && new URLSearchParams(location.search).has('passive') ? NO_COMMAND : this.ai!.update(dt, sim.bout, wrestling, {timeLeft:sim.clock,finalPeriod:sim.period>=3,deficit:sim.score[sim.humanSide]-sim.score[otherSide(sim.humanSide)]});
    // Dev review: ?footwork drives both wrestlers with the AI's movement only (no attacks),
    // so the stance footwork can be watched without scoring interrupting it.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('footwork')) {
      this.footworkAi ??= new WrestlerAI(sim.humanSide, 'starter', 77);
      const mine = this.footworkAi.update(dt, sim.bout, wrestling);
      // Hand fighting stays (taps, swats, bites); no snaps or attacks, so they stay on their feet.
      const [me, him] = [sim.bout.athletes[sim.humanSide], sim.bout.athletes[otherSide(sim.humanSide)]];
      Object.assign(human, { ...NO_COMMAND, moveX: mine.moveX, moveZ: mine.moveZ, level: mine.level, fight: mine.fight && me.hand < 0.62 });
      aiCmd = { ...NO_COMMAND, moveX: aiCmd.moveX, moveZ: aiCmd.moveZ, level: aiCmd.level, fight: aiCmd.fight && him.hand < 0.62 };
    }
    // Dev review: ?autoplay lets an AI wrestle the player's side too, to watch whole matches.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('autoplay')) {
      this.autoAi ??= new WrestlerAI(sim.humanSide, 'starter', 91);
      Object.assign(human, this.autoAi.update(dt, sim.bout, wrestling, {timeLeft:sim.clock,finalPeriod:sim.period>=3,deficit:sim.score[otherSide(sim.humanSide)]-sim.score[sim.humanSide]}));
    }
    const commands: [Command, Command] = sim.humanSide === 0 ? [human, aiCmd] : [aiCmd, human];
    const techniqueLabels = {duckUnder:'Duck under',superDuck:'Super duck',slideBy:'Slide by',firemansCarry:'Fireman’s carry',footSweep:'Foot sweep',anklePick:'Ankle pick',kneePick:'Knee pick',throwBy:'Throw-by',lateralDrop:'Lateral drop',headlock:'Headlock'};
    this.namedAttackFeedback = human.technique ? techniqueLabels[human.technique] : human.lowSingle ? 'Low single' : undefined;
    sim.tick(dt, sim.phase === 'positionChoice' || sim.phase === 'results' ? [NO_COMMAND, NO_COMMAND] : commands);
    this.namedAttackFeedback = undefined;
  }

  private present(dt: number, wall: number): void {
    const sim = this.sim!;
    const [a, b] = this.bodies!;
    const views = wrestlerViews(sim);
    // Render the reviewed seated chain; simulation timing and scoring stay unchanged.
    {
      const first=views[0];
      if(first.mode==='paired'){
        const top=first.role==='A'?a:b,bottom=first.role==='A'?b:a;
        const key=top.anim.scale+':'+bottom.anim.scale;
        if(key!==supportedStudyScaleKey){registerSupportedArmBarChain(top.anim.scale,bottom.anim.scale);supportedStudyScaleKey=key;}
        const clips:Record<string,string>={flat:'flatPressureDraft',armBarTurn:'armBarSupportedSeatedTurnDraft',armBarResisted:'armBarSupportedResistedDraft',armBarPin:'armBarSupportedSeatedFinishDraft',armBarExit:'armBarSupportedSeatedExitDraft',armBarFall:'armBarSupportedSeatedFallDraft'};
        for(const view of views)if(view.mode==='paired' && clips[view.clip]){
          view.clip=clips[view.clip];
          if(view.hold)view.progress=0;
        }
      }
    }

    const adt = Math.max(dt, 1e-4);
    a.anim.update(adt, views[0], b.anim);
    b.anim.update(adt, views[1], a.anim);
    // Heads never pass through the other wrestler; done before grips so hands follow the head.
    const devQuery = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
    if (!devQuery?.has("noclear")) resolveHeadClearance(a.anim, b.anim, adt, [views[0].mode === 'paired', views[1].mode === 'paired']);
    if (devQuery?.has('headstats')) recordHeadOverlap(a.anim, b.anim, views);
    // Head control must settle before the bottom hand peels that moving arm, including its fading grip during the exit.
    const secondControlsHead=views[1].mode==="paired" && (views[1].clip==="tieAttackCounter"
      ? views[1].role==="B"
      : ["fhl","recover","goBehind","chinWhip","shuck","cementMixer"].includes(views[1].clip) && views[1].role==="A");
    if(secondControlsHead){
      b.anim.applyContacts(adt,a.anim);
      a.anim.applyContacts(adt,b.anim);
    }else{
      a.anim.applyContacts(adt,b.anim);
      b.anim.applyContacts(adt,a.anim);
    }

    // Camera: side-on to the action with the player's man on the left.
    const human = sim.humanSide;
    const hp = sim.bout.athletes[human].pos;
    const op = sim.bout.athletes[otherSide(human)].pos;
    let focus = new Vector3((hp.x + op.x) / 2, 0, (hp.z + op.z) / 2);
    let azimuth = Math.atan2(op.x - hp.x, op.z - hp.z) - Math.PI / 2;
    const pos = sim.bout.position;
    if (pos.kind === 'mat' || (pos.kind === 'move' && this.isMatClip(pos.id))) {
      const f = pos.frame;
      focus = new Vector3(f.x, 0, f.z);
      // From the bottom man's front quarter, so both faces read. Either mirror side works, so a mat
      // sequence takes whichever is nearer the current view and keeps it until they are back on their
      // feet: no half-circle swing after a takedown.
      const matAzimuth = (s: number) => f.yaw + (Math.PI / 2) * s - 0.45 * s;
      if (this.matCamSide === null) {
        const turn = (s: number) => Math.abs(Math.atan2(Math.sin(matAzimuth(s) - this.cameraRig.viewAzimuth), Math.cos(matAzimuth(s) - this.cameraRig.viewAzimuth)));
        this.matCamSide = turn(1) <= turn(-1) ? 1 : -1;
      }
      azimuth = matAzimuth(this.matCamSide);
      const standing = (pos.kind === 'mat' && pos.sub === 'standing') || (pos.kind === 'move' && (pos.id === 'standUp' || pos.id === 'escapeTurn'));
      if (sim.phase === 'wrestling') this.cameraRig.setMode(standing ? 'tight' : pos.kind === 'mat' ? 'mat' : this.cameraRig.mode);
    } else if (sim.phase === 'wrestling' && (pos.kind === 'neutral' || pos.kind === 'fhl' || pos.kind === 'legs')) {
      this.cameraRig.setMode(pos.kind === 'neutral' ? 'broadcast' : 'tight');
    }
    if (!(pos.kind === 'mat' || (pos.kind === 'move' && this.isMatClip(pos.id)))) this.matCamSide = null;

    if (sim.phase === 'intros') {
      // Walk out together, then about three seconds on each man.
      const t = sim.phaseT;
      const introFocus: Side | null = t < 3.5 ? null : t < 6.4 ? 0 : 1;
      if (this.store.getSnapshot().introFocus !== introFocus) this.store.set({ introFocus });
      if (introFocus !== null) {
        const w = sim.bout.athletes[introFocus];
        focus = new Vector3(w.pos.x, 0, w.pos.z);
        azimuth = w.yaw + 0.5 * (introFocus === 0 ? -1 : 1);
        this.cameraRig.setMode('intro');
      } else {
        this.cameraRig.setMode('wide');
      }
    } else if (this.store.getSnapshot().introFocus !== null) {
      this.store.set({ introFocus: null });
    }
    if (sim.result && (sim.phase === 'celebration' || sim.phase === 'results')) {
      const w = sim.bout.athletes[sim.result.winner];
      focus = new Vector3(w.pos.x, 0, w.pos.z);
      azimuth = w.yaw + 0.35;
    }

    const r = Math.hypot(focus.x, focus.z);
    if (r > 4.6) focus.multiplyScalar(4.6 / r);
    if (this.restartCut) {
      this.restartCut = false;
      this.camFocus.copy(focus);
      this.cameraRig.cut(focus, azimuth);
    }
    this.camFocus.lerp(focus, Math.min(1, wall * 8));
    this.cameraRig.update(wall, this.renderer.camera, this.camFocus, azimuth, sim.distance(), actionFraming(pos,sim.phase==='wrestling',r));

    this.updateOfficial(adt, wall);
    this.coaches?.update(adt, sim, this.bodies ? [this.bodies[0].anim, this.bodies[1].anim] : null);

    this.scoreboard.update({
      score: sim.score,
      period: sim.period,
      clock: sim.clock,
      ridingTime: sim.ridingTime,
      nearFall: pos.kind === 'mat' && pos.sub === 'exposed' ? pos.expo : 0,
    });
  }

  private isMatClip(id: string): boolean {
    return /^(armBar|wristBar|barHalf|doubleBar)/.test(id) || ['sitOutPull', 'sitOutTurn', 'sitOutEscape', 'breakdown', 'rebase', 'halfNelson', 'cradle', 'tilt', 'fightOff', 'fall', 'standUp', 'returnMat', 'standingTrip', 'crotchLift', 'switch', 'escapeTurn'].includes(id);
  }

  /** The official works the far side of the action and signals the score. */
  private updateOfficial(dt: number, wall: number): void {
    const off = this.official;
    const sim = this.sim;
    if (!off || !sim) return;
    const pos = sim.bout.position;
    const center = sim.center;
    const camAz = this.cameraRig.viewAzimuth;
    let x = center.x - Math.sin(camAz) * 2.1 + Math.cos(camAz) * 0.6;
    let z = center.z - Math.cos(camAz) * 2.1 - Math.sin(camAz) * 0.6;
    const r = Math.hypot(x, z);
    if (r > 5.6) {
      x *= 5.6 / r;
      z *= 5.6 / r;
    }
    let clip = 'refWatch';
    let u = 0;
    let mirror = false;
    let opp: Animator | null = this.bodies ? this.bodies[0].anim : null;
    let grip: { hand: 'L' | 'R'; on: 'handL'; at: [number, number, number] } | undefined;
    // At a mat restart he stands in front of the pair, facing them, until the whistle.
    const matRestart = sim.phase === 'setPosition' && pos.kind === 'mat';
    if (matRestart) {
      // Biased to the camera's far side so he stays in the shot.
      x = center.x + Math.sin(pos.frame.yaw) * 1.7 - Math.sin(camAz) * 1.1;
      z = center.z + Math.cos(pos.frame.yaw) * 1.7 - Math.cos(camAz) * 1.1;
    }
    if (this.refCue && !this.refSignal) {
      this.refCue.t -= wall;
      clip = 'refWork';
      u = (1.5 - this.refCue.t) / 0.7;
      // His hand goes out toward the wrestler: the red band (left hand) for red, the green (right) for green.
      mirror = this.refCue.side === 1;
      if (this.refCue.t <= 0) this.refCue = null;
    } else if (this.refSignal) {
      this.refSignal.t -= wall;
      clip = 'refPoints';
      // Red band on the left wrist for the red wrestler, green on the right.
      mirror = this.refSignal.side === 1;
      if (this.refSignal.t <= 0) this.refSignal = null;
    } else if (pos.kind === 'mat' && pos.sub === 'exposed') {
      clip = 'refCount';
      u = pos.expo;
      // Down by the shoulders to see them, as NCAA referees do on a near fall (a little wider than for the fall).
      const B = sim.bout.athletes[otherSide(pos.A)];
      x = B.pos.x - Math.sin(camAz) * 1.1;
      z = B.pos.z - Math.cos(camAz) * 1.1;
    } else if (pos.kind === 'move' && pos.id === 'fall') {
      clip = 'refSlap';
      u = Math.min(1, pos.t / pos.dur);
      // Down beside the shoulders.
      const B = sim.bout.athletes[otherSide(pos.A)];
      x = B.pos.x - Math.sin(camAz) * 0.9;
      z = B.pos.z - Math.cos(camAz) * 0.9;
    } else if (matRestart) {
      clip = 'refStand';
    } else if (pos.kind === 'mat' || (pos.kind === 'move' && this.isMatClip(pos.id))) {
      clip = 'refMat';
    } else if (sim.phase === 'celebration' || sim.phase === 'results') {
      const w = sim.result ? sim.bout.athletes[sim.result.winner] : null;
      if (w && sim.phaseT > 3) {
        clip = 'refRaise';
        x = w.pos.x + Math.cos(w.yaw) * 0.42;
        z = w.pos.z - Math.sin(w.yaw) * 0.42;
        // Hold the winner's wrist up.
        opp = this.bodies ? this.bodies[sim.result!.winner].anim : opp;
        grip = { hand: 'R', on: 'handL', at: [0, 0.04, 0] };
      } else {
        clip = 'refStand';
      }
    } else if (sim.phase !== 'wrestling') {
      clip = 'refStand';
    }
    // Move between spots by circling the action at a working distance, never
    // through it.
    const p = this.refPos;
    const curAng = Math.atan2(p.x - center.x, p.z - center.z);
    const curR = Math.hypot(p.x - center.x, p.z - center.z);
    const tgtAng = Math.atan2(x - center.x, z - center.z);
    const tgtR = Math.hypot(x - center.x, z - center.z);
    const speed = 2.4;
    const dAng = wrapAngle(tgtAng - curAng);
    const maxAng = (speed * dt) / Math.max(curR, 0.8);
    const ang = curAng + Math.max(-maxAng, Math.min(maxAng, dAng));
    const rad = curR + Math.max(-speed * dt, Math.min(speed * dt, tgtR - curR));
    const nx = clip === 'refSlap' || clip === 'refRaise' ? p.x + (x - p.x) * Math.min(1, dt * 4) : center.x + Math.sin(ang) * rad;
    const nz = clip === 'refSlap' || clip === 'refRaise' ? p.z + (z - p.z) * Math.min(1, dt * 4) : center.z + Math.cos(ang) * rad;
    const vx = (nx - p.x) / Math.max(dt, 1e-4);
    const vz = (nz - p.z) / Math.max(dt, 1e-4);
    p.x = nx;
    p.z = nz;
    const moving = Math.hypot(vx, vz) > 0.45 && clip !== 'refSlap';
    const yaw = Math.atan2(center.x - nx, center.z - nz);
    const view: AnimView = moving
      ? { mode: 'walk', x: nx, z: nz, yaw: Math.atan2(vx, vz), vx, vz, stamina: 1, exertion: 0 }
      : { mode: 'solo', clip, x: nx, z: nz, yaw, u, stamina: 1, exertion: 0, mirror, grip };
    off.anim.update(Math.max(dt, 1e-4), view, opp);
    off.anim.applyContacts(Math.max(dt, 1e-4), opp);
  }

  private refPos = { x: 0, z: -2.2 };

  /** Title screen: the matchup squaring off under the lights. */
  private presentShowcase(wall: number): void {
    const focus = new Vector3(0, 0, 0);
    if (this.bodies) {
      const [a, b] = this.bodies;
      const mk = (x: number, yaw: number, lead: 1 | -1): AnimView => ({
        mode: 'stance',
        x,
        z: 0,
        yaw,
        vx: 0,
        vz: 0,
        level: 0.5,
        lean: 0,
        lead,
        act: 'stance',
        actT: 0,
        actDur: Infinity,
        hand: 0,
        oppHand: 0,
        stamina: 1,
        exertion: 0,
      });
      a.anim.update(wall, mk(-0.62, Math.PI / 2, a.wrestler.lead), b.anim);
      b.anim.update(wall, mk(0.62, -Math.PI / 2, b.wrestler.lead), a.anim);
      a.anim.applyContacts(wall, b.anim);
      b.anim.applyContacts(wall, a.anim);
    }
    if (this.official) {
      // Off to the side, waiting for the bout.
      this.official.anim.update(wall, { mode: 'solo', clip: 'refStand', x: -2.6, z: -2.4, yaw: 0.8, u: 0, stamina: 1, exertion: 0 }, null);
    }
    this.cameraRig.setMode(this.store.getSnapshot().screen === 'title' ? 'showcase' : 'attract');
    this.cameraRig.update(wall, this.renderer.camera, focus, 0.25, 1.2);
    this.scoreboard.update({ score: [0, 0], period: 1, clock: 180, ridingTime: 0, nearFall: 0 });
  }

  /* ----------------------------------------------------------------- ui --- */

  private syncUi(): void {
    const fps = this.frameTimes.length
      ? Math.round(1 / (this.frameTimes.reduce((x, y) => x + y, 0) / this.frameTimes.length))
      : 0;
    const sim = this.sim;
    if (!sim || !this.running) {
      this.store.set({ fps });
      return;
    }
    const me = sim.humanSide;
    const read = readPrompts(sim, me, this.topTurn);
    const pos = sim.bout.position;
    const a = sim.bout.athletes;
    const snap = this.store.getSnapshot();
    let react = snap.react && this.clockT > this.reactUntil ? null : snap.react;
    // The stand-up tell begins an uninterruptible rise. Cue the human only
    // once the rear-standing return is actionable, with its full response time.
    // The AI still receives the original tell and keeps its existing timing.
    const canReturn = read.prompts.sprawl.label === 'Mat return';
    if (canReturn && snap.prompts.sprawl.label !== 'Mat return') {
      react = { button: 'sprawl', label: 'Return him!', id: this.feedbackId++ };
      this.reactUntil = this.clockT + 1.1;
    } else if (!canReturn && react?.label === 'Return him!') {
      react = null;
    }
    this.store.set({
      phase: sim.phase,
      period: sim.period,
      clock: sim.clock,
      score: [sim.score[0], sim.score[1]],
      ridingTime: sim.ridingTime,
      stamina: [a[0].stamina, a[1].stamina],
      hand: [a[0].hand, a[1].hand],
      top: sim.bout.top,
      position: read.position,
      prompts: read.prompts,
      topRestartCut: sim.topRestartCut,
      topRestartBreakdown: sim.topRestartBreakdown,
      meters: read.meters,
      legActions: read.legActions,
      edgeHint: handsHintFor(sim, me) ?? edgeHintFor(sim, me),
      nearFall: { active: sim.earnedNearFallPoints > 0 || pos.kind === 'mat' && (pos.sub === 'exposed' || pos.sub === 'spladle'), timer: pos.kind === 'mat' ? pos.expo : 0, earned: sim.earnedNearFallPoints },
      stats: [{ ...a[0].stats }, { ...a[1].stats }],
      awaitingChoice: sim.phase === 'positionChoice',
      coinTossWinner: sim.period > 1 || sim.phase === 'coinToss' || sim.phase === 'positionChoice' ? sim.coinTossWinner : null,
      canDefer: sim.canDefer,
      plan: sim.plan(sim.humanSide),
      opponentPlan: sim.plan(otherSide(sim.humanSide)),
      refereeNote: `Referee ${sim.referee.label}`,
      stalls: ([0, 1] as const).map((s) => ({
        warned: sim.bout.athletes[s].stallWarned,
        // A stalling point is scored for the other man.
        points: sim.scoreLog.filter((e) => e.kind === 'stalling' && e.side !== s).length,
      })) as [{ warned: boolean; points: number }, { warned: boolean; points: number }],
      react,
      fps,
    });
  }

  /* ------------------------------------------------------------ teardown -- */

  private teardownMatch(): void {
    this.coaches?.dispose();
    this.coaches = null;
    this.sim = null;
    this.ai = null;
    this.accumulator = 0;
    this.timeScale = 1;
    this.slowMoT = 0;
    this.hitStop = 0;
    this.refSignal = null;
    void this.lastPhase;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.clearPendingTechnique);
    this.resizeObserver?.disconnect();
    this.teardownMatch();
    this.removeBodies();
    this.input.dispose();
    this.audio.dispose();
    this.renderer.dispose();
    void this.canvas;
  }
}

/** Dev review (?headstats): deepest head overlap into the other body, per situation, in window.__headStats. */
function recordHeadOverlap(a: Animator, b: Animator, views: AnimView[]): void {
  const stats = ((window as unknown as { __headStats?: Record<string, { max: number; frames: number; over2: number; over5: number }> }).__headStats ??= {});
  const pen = Math.max(headOverlap(a, b).length(), headOverlap(b, a).length());
  const v = views[0];
  const key = v.mode === 'paired' ? `paired:${v.clip}` : v.mode === 'stance' ? `stance:${v.act}` : v.mode;
  const s = (stats[key] ??= { max: 0, frames: 0, over2: 0, over5: 0 });
  s.frames++;
  s.max = Math.max(s.max, pen);
  if (pen > 0.02) s.over2++;
  if (pen > 0.05) s.over5++;
}
