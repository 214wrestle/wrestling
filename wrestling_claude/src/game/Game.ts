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
import { Input } from '../engine/Input';
import { AudioBus } from '../engine/AudioBus';
import { createGym, createLighting } from '../arena/gym';
import type { Gym } from '../arena/gym';
import { createMat } from '../arena/mat';
import { Scoreboard } from '../arena/scoreboard';
import { MatchSim } from '../sim/MatchSim';
import { WrestlerAI } from '../sim/ai';
import type { Difficulty } from '../sim/ai';
import { byId, OFFICIAL, DEFAULT_MATCHUP } from '../sim/roster';
import { NO_COMMAND, otherSide } from '../sim/types';
import type { Command, MatchPhase, School, Side, StartPosition, Wrestler } from '../sim/types';
import { requestBody } from '../body/factory';
import type { MeshQuality } from '../body/generate';
import { Character } from '../body/Character';
import type { CharacterRig } from '../body/Character';
import { Animator } from '../anim/Animator';
import type { AnimView } from '../anim/Animator';
import '../anim/library';
import { wrestlerViews } from './views';
import { readPrompts } from './prompts';
import type { GameApi, UiStore } from './store';

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
  private refSignal: { side: Side; t: number } | null = null;
  private lastPhase: MatchPhase = 'attract';
  private camFocus = new Vector3();
  private lens = 0;
  private reactUntil = 0;
  private clockT = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private store: UiStore,
  ) {
    const coarse = matchMedia('(pointer: coarse)').matches;
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
    if (w.firstName === 'Michael' && w.lastName === 'Moreno') {
      const { buildRealCharacter } = await import('../body/realistic/factory');
      return buildRealCharacter(w, band ?? '#111', this.quality);
    }
    const scale = w.height / 1.76;
    const referee = w.id === OFFICIAL.id;
    const buffers = await requestBody(
      { scale, mass: w.build, hair: w.hairStyle, shape: w.appearance, clothing: referee ? 'referee' : 'singlet' },
      this.quality,
      !referee,
    );
    return new Character(buffers, {
      shape: w.appearance, motion: w.motion,
      look: {
        skin: w.skinTone,
        hair: w.hairColor,
        hairStyle: w.hairStyle,
        primary: w.school.primary,
        secondary: w.school.secondary,
        accent: w.school.accent,
        pattern: w.school.pattern,
        wordmark: w.school.mark,
        band: band ?? '#111',
        shoe: '#15161b',
        shoeAccent: w.school.primary,
        clothing: referee ? 'referee' : 'singlet',
        eye: w.eyeColor,
        scale,
      },
      gear: referee ? null : { shell: w.headgearColor ?? w.school.gear, strap: w.headgearColor ?? w.school.gear },
    });
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

  start(options: { humanSide: Side; difficulty: Difficulty; matchup: [string, string]; quick: boolean }): void {
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

  private beginMatch(options: { humanSide: Side; difficulty: Difficulty; matchup: [string, string]; quick: boolean }): void {
    const bodies = this.bodies!;
    const wrestlers: [Wrestler, Wrestler] = [bodies[0].wrestler, bodies[1].wrestler];
    const human = options.humanSide;
    const sim = new MatchSim(wrestlers, {
      onScore: (e) => {
        this.audio.roar(e.points >= 3 ? 0.9 : 0.5);
        this.audio.score(e.side === human);
        this.gym.excite(e.points >= 3 ? 0.6 : 0.3);
        this.excitement = Math.min(1, this.excitement + 0.45);
        this.refSignal = { side: e.side, t: 1.6 };
        this.store.set({ lastScore: e, scoreLog: [...sim.scoreLog] });
      },
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
      },
      onTell: (to, what) => {
        if (to !== human) {
          this.ai?.onTell(what);
          return;
        }
        if (what === 'shot') {
          this.store.set({ react: { button: 'sprawl', label: 'Sprawl!', id: this.feedbackId++ } });
          this.reactUntil = this.clockT + 0.55;
        } else if (what === 'standup') {
          this.store.set({ react: { button: 'sprawl', label: 'Return him!', id: this.feedbackId++ } });
          this.reactUntil = this.clockT + 1.1;
        }
      },
      onFeedback: (side, button, result) => {
        // Winning a hand fight yanks the other man's head and shoulders.
        if (result === 'won' && button === 'fight') bodies[otherSide(side)].anim.impulse(0.35, (Math.random() - 0.5) * 0.6);
        if (result === 'lost' && button === 'fight') bodies[side].anim.impulse(0.2, 0);
        if (side !== human) return;
        this.audio.press(result);
        if (result === 'won') this.input.rumble(0.35, 70);
        this.store.set({ flash: { button, result, id: this.feedbackId++ } });
      },
    });
    sim.humanSide = human;
    sim.lengthScale = options.quick ? 0.5 : 1;
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
    sim.startIntros();
    for (const b of bodies) b.anim.instant = true;
  }

  rematch(): void {
    const s = this.store.getSnapshot();
    if (!s.wrestlers) return;
    this.renderer.setBloom(0.3);
    this.start({ humanSide: s.humanSide, difficulty: s.difficulty, matchup: [s.wrestlers[0].id, s.wrestlers[1].id], quick: s.quick });
  }

  toTitle(): void {
    this.teardownMatch();
    this.running = false;
    this.cameraRig.setMode('showcase');
    this.renderer.setBloom(0.3);
    this.store.set({ screen: 'title', result: null, announcement: null, paused: false, react: null });
    if (this.bodies) for (const b of this.bodies) b.anim.instant = true;
  }

  choosePosition(pos: StartPosition): void {
    this.sim?.choosePosition(pos);
    this.store.set({ awaitingChoice: false });
  }

  setPaused(paused: boolean): void {
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

  setTouch(state: { x: number; y: number; shoot: boolean; fight: boolean; sprawl: boolean; level: boolean }): void {
    this.input.touch = state;
    if (state.shoot || state.fight || state.sprawl || state.x || state.y) this.store.set({ device: 'touch' });
  }

  skipIntros(): void {
    this.sim?.skipIntros();
  }

  /* ------------------------------------------------------------- phases --- */

  private onPhase(phase: MatchPhase): void {
    this.lastPhase = phase;
    switch (phase) {
      case 'intros':
        this.cameraRig.setMode('intro');
        break;
      case 'handshake':
      case 'coinToss':
      case 'periodBreak':
      case 'whistle':
        this.cameraRig.setMode('wide');
        break;
      case 'positionChoice':
        this.cameraRig.setMode('wide');
        this.store.set({ awaitingChoice: true });
        break;
      case 'setPosition':
        this.cameraRig.setMode(this.sim?.bout.top !== null ? 'mat' : 'broadcast');
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
    const human: Command = {
      moveX: move.x,
      moveZ: move.z,
      shoot: pad.shoot,
      fight: pad.fight,
      sprawl: pad.sprawl,
      level: pad.level,
    };
    const wrestling = sim.phase === 'wrestling';
    const aiCmd = this.ai!.update(dt, sim.bout, wrestling);
    const commands: [Command, Command] = sim.humanSide === 0 ? [human, aiCmd] : [aiCmd, human];
    sim.tick(dt, sim.phase === 'positionChoice' || sim.phase === 'results' ? [NO_COMMAND, NO_COMMAND] : commands);
  }

  private present(dt: number, wall: number): void {
    const sim = this.sim!;
    const [a, b] = this.bodies!;
    const views = wrestlerViews(sim);
    const adt = Math.max(dt, 1e-4);
    a.anim.update(adt, views[0], b.anim);
    b.anim.update(adt, views[1], a.anim);
    a.anim.applyContacts(adt, b.anim);
    b.anim.applyContacts(adt, a.anim);

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
      // From the bottom man's front-left, so both faces read.
      const side = pos.A === human ? 1 : -1;
      azimuth = f.yaw + (Math.PI / 2) * side - 0.45 * side;
      const standing = (pos.kind === 'mat' && pos.sub === 'standing') || (pos.kind === 'move' && (pos.id === 'standUp' || pos.id === 'escapeTurn'));
      if (sim.phase === 'wrestling') this.cameraRig.setMode(standing ? 'tight' : pos.kind === 'mat' ? 'mat' : this.cameraRig.mode);
    } else if (sim.phase === 'wrestling' && (pos.kind === 'neutral' || pos.kind === 'fhl' || pos.kind === 'legs')) {
      this.cameraRig.setMode(pos.kind === 'neutral' ? 'broadcast' : 'tight');
    }

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
    this.camFocus.lerp(focus, Math.min(1, wall * 8));
    this.cameraRig.update(wall, this.renderer.camera, this.camFocus, azimuth, sim.distance());

    this.updateOfficial(adt, wall);

    this.scoreboard.update({
      score: sim.score,
      period: sim.period,
      clock: sim.clock,
      ridingTime: sim.ridingTime,
      nearFall: pos.kind === 'mat' && pos.sub === 'exposed' ? pos.expo : 0,
    });
  }

  private isMatClip(id: string): boolean {
    return ['breakdown', 'rebase', 'halfNelson', 'tilt', 'fightOff', 'fall', 'standUp', 'returnMat', 'switch', 'escapeTurn'].includes(id);
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
    if (this.refSignal) {
      this.refSignal.t -= wall;
      clip = 'refPoints';
      // Red band on the left wrist for the red wrestler, green on the right.
      mirror = this.refSignal.side === 1;
      if (this.refSignal.t <= 0) this.refSignal = null;
    } else if (pos.kind === 'mat' && pos.sub === 'exposed') {
      clip = 'refCount';
      u = pos.expo;
    } else if (pos.kind === 'move' && pos.id === 'fall') {
      clip = 'refSlap';
      u = Math.min(1, pos.t / pos.dur);
      // Down beside the shoulders.
      const B = sim.bout.athletes[otherSide(pos.A)];
      x = B.pos.x - Math.sin(camAz) * 0.9;
      z = B.pos.z - Math.cos(camAz) * 0.9;
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
    const read = readPrompts(sim, me);
    const pos = sim.bout.position;
    const a = sim.bout.athletes;
    const snap = this.store.getSnapshot();
    const react = snap.react && this.clockT > this.reactUntil ? null : snap.react;
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
      meters: read.meters,
      nearFall: { active: pos.kind === 'mat' && pos.sub === 'exposed', timer: pos.kind === 'mat' ? pos.expo : 0 },
      stats: [{ ...a[0].stats }, { ...a[1].stats }],
      awaitingChoice: sim.phase === 'positionChoice',
      react,
      fps,
    });
  }

  /* ------------------------------------------------------------ teardown -- */

  private teardownMatch(): void {
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
    this.resizeObserver?.disconnect();
    this.teardownMatch();
    this.removeBodies();
    this.input.dispose();
    this.audio.dispose();
    this.renderer.dispose();
    void this.canvas;
  }
}
