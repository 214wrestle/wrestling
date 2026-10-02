import { Matrix4, Vector3 } from 'three';
import type { Character } from '../body/Character';
import type { BoneName } from '../body/skeleton';
import { Solver } from './solver';
import { createPosture, FOOT, P, PostureSpring } from './posture';
import type { Posture } from './posture';
import { createLocal, localToWorld, mirrorLocal } from './spec';
import type { Frame, LocalPose } from './spec';
import { DEFAULT_STANCE, scaleLocal, stancePose } from './stance';
import type { StanceParams } from './stance';
import { Footwork } from './footwork';
import { moveClip, sampleHold, sampleMove } from './clips';
import type { ActiveContact, Role } from './clips';
import { hasSolo, sampleSolo } from './solo';

/**
 * One body's animation.
 *
 * Every frame the animator builds a target posture from what the simulation
 * says this wrestler is doing, chases it with a critically damped spring so
 * changes of state flow instead of snapping, plants the feet, solves the IK and
 * finally closes any grips onto the other body. Nothing here decides anything:
 * it only shows what the bout already decided.
 */

export type AnimView =
  | {
      mode: 'stance';
      x: number;
      z: number;
      yaw: number;
      vx: number;
      vz: number;
      level: number;
      lean: number;
      lead: 1 | -1;
      act: string;
      actT: number;
      actDur: number;
      /** My hand-fight control and his, 0..1. */
      hand: number;
      oppHand: number;
      stamina: number;
      exertion: number;
      /** Hands relaxed and standing tall (between whistles). */
      relaxed?: boolean;
      /** Shaking hands with the opponent before the bout. */
      shake?: boolean;
    }
  | {
      mode: 'paired';
      clip: string;
      hold: boolean;
      role: Role;
      frame: Frame;
      mirror: boolean;
      /** Normalised time for moves. */
      u: number;
      /** Progress along a hold's axis. */
      progress: number;
      intensity: number;
      /** Real root distance at the start of a shot, for warping. */
      dist?: number;
      stamina: number;
      exertion: number;
    }
  | {
      mode: 'solo';
      clip: string;
      x: number;
      z: number;
      yaw: number;
      /** Normalised clip time (wraps for loops). */
      u: number;
      stamina: number;
      exertion: number;
      mirror?: boolean;
      /** Hold a bone of the other body (the official raising a hand). */
      grip?: { hand: 'L' | 'R'; on: BoneName; at: [number, number, number] };
    }
  | {
      mode: 'walk';
      x: number;
      z: number;
      yaw: number;
      vx: number;
      vz: number;
      stamina: number;
      exertion: number;
    };

const _m = new Matrix4();
const _v = new Vector3();
const _v2 = new Vector3();

export class Animator {
  readonly solver: Solver;
  private spring = new PostureSpring();
  private target: Posture = createPosture();
  private display: Posture = createPosture();
  private local: LocalPose = createLocal();
  private feetDesired: Posture = createPosture();
  readonly footwork = new Footwork();
  private footW = 0;
  private phase = Math.random() * 10;
  private breath = Math.random() * 6;
  private contacts: ActiveContact[] = [];
  private gripW = { L: 0, R: 0 };
  private gripBone: { L: BoneName | null; R: BoneName | null } = { L: null, R: null };
  private gripAt = { L: new Vector3(), R: new Vector3() };
  private lastMode = '';
  private halfLife = 0.08;
  private time = 0;
  /** Hand-fight jitter seeds. */
  private seed = Math.random() * 100;
  /** Skip the blend on the next update (cuts, tools). */
  instant = false;

  constructor(readonly character: Character) {
    this.solver = new Solver(character);
  }

  get scale(): number {
    return this.character.scale;
  }

  /** World position of a bone, after the last solve. */
  bonePos(name: BoneName, out: Vector3): Vector3 {
    return this.character.bones[name].getWorldPosition(out);
  }

  /** Head position for look-at targets. */
  headPos(out: Vector3): Vector3 {
    this.character.bones.head.updateWorldMatrix(true, false);
    return out.set(0, 0.09 * this.scale, 0.05 * this.scale).applyMatrix4(this.character.bones.head.matrixWorld);
  }

  /* --------------------------------------------------------------- update */

  update(dt: number, view: AnimView, opp: Animator | null): void {
    this.time += dt;
    this.contacts = [];
    const modeKey = view.mode + (view.mode === 'paired' ? view.clip : view.mode === 'solo' ? view.clip : '');
    const changed = modeKey !== this.lastMode;
    this.lastMode = modeKey;

    let footTarget = 0;
    switch (view.mode) {
      case 'stance':
        this.buildStance(view, opp);
        footTarget = view.act === 'sprawl' || view.act === 'sprawlRecover' ? 0 : 1;
        this.halfLife = view.act === 'sprawl' ? 0.045 : view.act === 'snap' ? 0.05 : 0.075;
        break;
      case 'walk':
        this.buildWalk(view, opp);
        footTarget = 1;
        this.halfLife = 0.1;
        break;
      case 'paired':
        this.buildPaired(view, opp);
        footTarget = 0;
        this.halfLife = view.hold ? 0.09 : changed ? 0.06 : 0.035;
        break;
      case 'solo':
        this.buildSolo(view, opp);
        footTarget = 0;
        this.halfLife = 0.09;
        break;
    }

    // Exertion shows in skin and breathing.
    const ex = 'exertion' in view ? view.exertion : 0;
    const st = 'stamina' in view ? view.stamina : 1;
    this.character.setExertion(Math.min(1, 0.12 + (1 - st) * 0.6 + ex * 0.3), Math.min(1, ex * 0.8 + (1 - st) * 0.5));

    // Transitions get a slightly longer blend so the body travels between states.
    const hl = changed ? Math.max(this.halfLife, 0.07) : this.halfLife;
    if (this.instant) {
      this.spring.reset(this.target);
      this.instant = false;
    } else {
      this.spring.update(this.target, dt, hl);
    }
    this.display.set(this.spring.value);
    this.applyMass(dt);

    // Footwork takes the feet whenever the body is on its feet and free.
    const wasPlanted = this.footW > 0.01;
    this.footW += (footTarget - this.footW) * Math.min(1, dt * (footTarget > this.footW ? 9 : 14));
    if (footTarget > 0) {
      if (!wasPlanted || !this.footwork.isPrimed) this.footwork.reset(this.display);
      const vx = 'vx' in view ? view.vx : 0;
      const vz = 'vz' in view ? view.vz : 0;
      this.footwork.update(dt, this.feetDesired, vx, vz, view.mode === 'walk' ? 0.9 : 1.15);
      this.footwork.apply(this.display, this.footW);
      this.display[P.HIPS + 1] += this.footwork.bounce * this.footW;
    } else if (this.footW < 0.01) {
      this.footwork.invalidate();
    }

    this.solver.apply(this.display);
  }

  /* ----------------------------------------------------------------- mass */

  // A body has mass: the trunk lags when the hips accelerate and settles with
  // a little overshoot; the head lags the trunk. Impacts kick the same springs.
  private lag = { p: 0, pv: 0, r: 0, rv: 0 };
  private prevHx = NaN;
  private prevHz = 0;
  private velX = 0;
  private velZ = 0;

  /** A jolt through the body, e.g. landing on the mat or a hand-fight yank. */
  impulse(strength: number, sideways = 0): void {
    this.lag.pv += strength * 3.2;
    this.lag.rv += sideways * 3;
  }

  private applyMass(dt: number): void {
    const d = this.display;
    const hx = d[P.HIPS];
    const hz = d[P.HIPS + 2];
    if (Number.isNaN(this.prevHx) || dt <= 0) {
      this.prevHx = hx;
      this.prevHz = hz;
      return;
    }
    const vx = (hx - this.prevHx) / dt;
    const vz = (hz - this.prevHz) / dt;
    this.prevHx = hx;
    this.prevHz = hz;
    const ax = (vx - this.velX) / dt;
    const az = (vz - this.velZ) / dt;
    this.velX += (vx - this.velX) * Math.min(1, dt * 20);
    this.velZ += (vz - this.velZ) * Math.min(1, dt * 20);
    // Acceleration in the pelvis frame.
    const qy = d[P.HIPS_Q + 1];
    const qw = d[P.HIPS_Q + 3];
    const yaw = 2 * Math.atan2(qy, qw);
    const fwd = ax * Math.sin(yaw) + az * Math.cos(yaw);
    const side = ax * Math.cos(yaw) - az * Math.sin(yaw);
    const clampA = (v: number) => Math.max(-14, Math.min(14, v));
    // Damped springs (about 5 Hz, a little under critical).
    const k = 900;
    const c = 34;
    const L = this.lag;
    L.pv += (-k * L.p - c * L.pv - clampA(fwd) * 6) * dt;
    L.p += L.pv * dt;
    L.rv += (-k * L.r - c * L.rv + clampA(side) * 4) * dt;
    L.r += L.rv * dt;
    L.p = Math.max(-0.25, Math.min(0.25, L.p));
    L.r = Math.max(-0.2, Math.min(0.2, L.r));
    d[P.SPINE] += L.p;
    d[P.SPINE + 2] += L.r;
    d[P.HEAD] -= L.p * 0.7;
    d[P.HEAD + 2] -= L.r * 0.8;
  }

  /** Second pass, once both bodies are posed: close grips onto the opponent. */
  applyContacts(dt: number, opp: Animator | null): void {
    for (const hand of ['L', 'R'] as const) {
      const c = this.contacts.find((x) => x.hand === hand);
      const want = c && opp ? c.weight : 0;
      if (c) {
        this.gripBone[hand] = c.on;
        this.gripAt[hand].set(c.at[0], c.at[1], c.at[2]);
      }
      const rate = want > this.gripW[hand] ? 16 : 10;
      this.gripW[hand] += (want - this.gripW[hand]) * Math.min(1, dt * rate);
      const w = this.gripW[hand];
      const bone = this.gripBone[hand];
      if (w < 0.01 || !bone || !opp) continue;
      const ob = opp.character.bones[bone];
      ob.updateWorldMatrix(true, false);
      _v.copy(this.gripAt[hand]).multiplyScalar(opp.scale).applyMatrix4(ob.matrixWorld);
      const at = hand === 'L' ? P.HAND_L : P.HAND_R;
      this.display[at] += (_v.x - this.display[at]) * w;
      this.display[at + 1] += (_v.y - this.display[at + 1]) * w;
      this.display[at + 2] += (_v.z - this.display[at + 2]) * w;
      this.solver.reachArm(this.display, hand);
    }
  }

  /* --------------------------------------------------------------- stance */

  private stanceParams: StanceParams = { ...DEFAULT_STANCE };

  private buildStance(v: Extract<AnimView, { mode: 'stance' }>, opp: Animator | null): void {
    const s = this.stanceParams;
    const c = Math.cos(v.yaw);
    const sn = Math.sin(v.yaw);
    // Velocity in the body frame: lateral motion shifts the weight.
    const lateral = v.vx * c - v.vz * sn;
    const forward = v.vx * sn + v.vz * c;
    this.breath += (1 / 60) * (2.1 + v.exertion * 2.4 + (1 - v.stamina) * 2);
    s.level = v.relaxed ? 0.95 : v.level;
    s.lead = v.lead;
    s.lean = Math.max(-1, Math.min(1, v.lean + forward * 0.08));
    s.side = Math.max(-1, Math.min(1, lateral * 0.35));
    s.phase = this.breath;
    s.fatigue = 1 - v.stamina;
    s.width = v.relaxed ? 0.75 : 1;
    s.guard = v.relaxed ? 0 : 1;
    stancePose(s, this.local);

    const lp = this.local;
    const u = v.actDur > 0 && Number.isFinite(v.actDur) ? Math.min(1, v.actT / v.actDur) : 0;
    const bell = Math.sin(u * Math.PI);
    const leadHand = v.lead === 1 ? P.HAND_L : P.HAND_R;

    if (v.relaxed) {
      // Hands on the hips, chest up, breathing.
      lp[P.HAND_L] = 0.19;
      lp[P.HAND_L + 1] = lp[P.HIPS + 1] + 0.1;
      lp[P.HAND_L + 2] = 0.0;
      lp[P.HAND_R] = -0.19;
      lp[P.HAND_R + 1] = lp[P.HIPS + 1] + 0.1;
      lp[P.HAND_R + 2] = 0.0;
      lp[P.ELBOW_L] = 0.6;
      lp[P.ELBOW_L + 1] = lp[P.HIPS + 1] + 0.3;
      lp[P.ELBOW_L + 2] = -0.2;
      lp[P.ELBOW_R] = -0.6;
      lp[P.ELBOW_R + 1] = lp[P.HIPS + 1] + 0.3;
      lp[P.ELBOW_R + 2] = -0.2;
      lp[P.WRIST_L] = 0.5;
      lp[P.WRIST_R] = 0.5;
      lp[P.SPINE] += (1 - v.stamina) * 0.25;
      lp[P.HEAD] = 0.05;
      if (v.shake && opp) {
        // Right hand out to the middle, a couple of firm pumps.
        const gap = this.distanceTo(opp, v.x, v.z);
        lp[P.HAND_R] = -0.04;
        lp[P.HAND_R + 1] = 0.98 + Math.sin(this.time * 11) * 0.025;
        lp[P.HAND_R + 2] = gap / 2 - 0.02;
        lp[P.ELBOW_R] = -0.4;
        lp[P.ELBOW_R + 1] = 0.8;
        lp[P.ELBOW_R + 2] = -0.2;
        lp[P.WRIST_R] = 0;
        lp[P.WRIST_R + 2] = 1.2;
        lp[P.SPINE] += 0.08;
      }
    } else if (v.act === 'reach') {
      lp[leadHand + 2] += 0.26 * bell;
      lp[leadHand + 1] += 0.06 * bell;
      lp[P.SPINE] += 0.08 * bell;
    } else if (v.act === 'snap') {
      // Hips sink, hands rip down toward the mat.
      lp[P.HIPS + 1] -= 0.1 * bell;
      lp[P.SPINE] += 0.3 * bell;
      lp[P.HAND_L + 1] -= 0.28 * bell;
      lp[P.HAND_R + 1] -= 0.28 * bell;
      lp[P.HAND_L + 2] -= 0.05 * bell;
      lp[P.HAND_R + 2] -= 0.05 * bell;
    } else if (v.act === 'fake') {
      lp[P.HIPS + 1] -= 0.14 * bell;
      lp[P.HIPS + 2] += 0.05 * bell;
      lp[P.SPINE] += 0.12 * bell;
      lp[P.HAND_L + 1] -= 0.16 * bell;
      lp[P.HAND_R + 1] -= 0.16 * bell;
      lp[P.HEAD] += 0.2 * bell;
    } else if (v.act === 'sprawl' || v.act === 'sprawlRecover') {
      const w = v.act === 'sprawl' ? Math.min(1, u * 3.2) : 1 - u;
      if (hasSolo('sprawlSolo')) {
        sampleSolo('sprawlSolo', 0.6, this.scratch);
        for (let i = 0; i < P.SIZE; i++) lp[i] += (this.scratch[i] - lp[i]) * w;
      }
    } else if (v.act === 'stagger') {
      lp[P.SPINE] += 0.25 * bell;
      lp[P.HIPS + 1] -= 0.05 * bell;
      lp[P.HAND_L] += 0.12 * bell;
      lp[P.HAND_R] -= 0.12 * bell;
      lp[P.HAND_L + 1] -= 0.1 * bell;
      lp[P.HAND_R + 1] -= 0.1 * bell;
    }

    // Live hands: small, quick, always working when he is in range.
    const close = opp ? this.distanceTo(opp, v.x, v.z) : 9;
    const engaged = !v.relaxed && close < 1.4;
    if (engaged && v.act === 'stance') {
      const t = this.time + this.seed;
      const amp = 0.035 + (close < 1.1 ? 0.02 : 0);
      lp[P.HAND_L] += Math.sin(t * 5.3) * amp * 0.6;
      lp[P.HAND_L + 1] += Math.sin(t * 6.7 + 1) * amp;
      lp[P.HAND_L + 2] += Math.sin(t * 4.1 + 2) * amp * 1.4;
      lp[P.HAND_R] += Math.sin(t * 4.9 + 3) * amp * 0.6;
      lp[P.HAND_R + 1] += Math.sin(t * 6.1 + 4) * amp;
      lp[P.HAND_R + 2] += Math.sin(t * 4.6 + 5) * amp * 1.4;
    }
    // His collar tie on me pulls my head down.
    if (v.oppHand >= 0.62 && !v.relaxed) {
      lp[P.SPINE] += 0.1;
      lp[P.HEAD] += 0.12;
    }
    // Tied up: heads meet, hips stay back.
    if (!v.relaxed && close < 0.95) {
      const tie = Math.min(1, (0.95 - close) / 0.25);
      lp[P.SPINE] += 0.16 * tie;
      lp[P.HIPS + 2] -= 0.06 * tie;
      lp[P.HEAD] -= 0.1 * tie;
    }

    scaleLocal(lp, this.scale);
    const frame = { x: v.x, z: v.z, yaw: v.yaw };
    localToWorld(lp, frame, this.target);
    // The stance's own feet are where footwork aims.
    this.feetDesired.set(this.target);
    this.lookAtOpponent(opp, 0.85);

    if (v.shake && opp) this.contacts.push({ hand: 'R', on: 'handR', at: [0, -0.03, 0.02], weight: 0.55 });

    // Hands: ties become grips on the other body; without a tie they still go
    // looking for his wrists, so hands meet hands instead of passing through.
    if (opp && !v.relaxed && close < 1.3 && v.act !== 'sprawl' && v.act !== 'sprawlRecover') {
      const myLead: 'L' | 'R' = v.lead === 1 ? 'L' : 'R';
      const myRear: 'L' | 'R' = myLead === 'L' ? 'R' : 'L';
      const opposite = (h: 'L' | 'R'): 'L' | 'R' => (h === 'L' ? 'R' : 'L');
      const t = this.time + this.seed;
      if (v.hand >= 0.62) {
        this.contacts.push({ hand: myLead, on: 'neck', at: [0, 0.045, -0.07], weight: 1 });
        this.contacts.push({ hand: myRear, on: `forearm${opposite(myRear)}` as BoneName, at: [0, -0.1, 0.02], weight: 0.9 });
      } else if (v.hand >= 0.3) {
        this.contacts.push({ hand: myLead, on: `forearm${opposite(myLead)}` as BoneName, at: [0, -0.2, 0.02], weight: 0.95 });
        this.contacts.push({ hand: myRear, on: `hand${opposite(myRear)}` as BoneName, at: [0, 0.0, 0.03], weight: 0.35 + 0.3 * Math.sin(t * 3.1) ** 2 });
      } else if (v.oppHand < 0.3 && close < 1.2) {
        // Fighting for inside position: reach, touch, pull back.
        const reachLead = v.act === 'reach' ? 1 : 0.3 + 0.45 * Math.max(0, Math.sin(t * 2.6));
        const reachRear = 0.2 + 0.4 * Math.max(0, Math.sin(t * 2.1 + 1.7));
        this.contacts.push({ hand: myLead, on: `forearm${opposite(myLead)}` as BoneName, at: [0, -0.22, 0.03], weight: reachLead });
        this.contacts.push({ hand: myRear, on: `forearm${opposite(myRear)}` as BoneName, at: [0, -0.18, 0.03], weight: reachRear });
      } else if (v.act === 'reach') {
        this.contacts.push({ hand: myLead, on: 'neck', at: [0, 0.05, -0.05], weight: Math.sin(u * Math.PI) });
      }
    }
  }

  private scratch: LocalPose = createLocal();

  private distanceTo(opp: Animator, x: number, z: number): number {
    const h = opp.character.bones.hips.position;
    return Math.hypot(h.x - x, h.z - z);
  }

  private lookAtOpponent(opp: Animator | null, weight: number): void {
    if (!opp) {
      this.target[P.LOOK_W] = 0;
      return;
    }
    opp.headPos(_v2);
    this.target[P.LOOK] = _v2.x;
    this.target[P.LOOK + 1] = _v2.y - 0.05;
    this.target[P.LOOK + 2] = _v2.z;
    this.target[P.LOOK_W] = weight;
  }

  /* ----------------------------------------------------------------- walk */

  private buildWalk(v: Extract<AnimView, { mode: 'walk' }>, opp: Animator | null): void {
    const speed = Math.hypot(v.vx, v.vz);
    const s = this.stanceParams;
    this.breath += (1 / 60) * 2;
    Object.assign(s, DEFAULT_STANCE, { level: 0.97, width: 0.62, guard: 0, phase: this.breath, lead: 1 });
    stancePose(s, this.local);
    const lp = this.local;
    // Upright walk: feet side by side, arms swinging opposite the legs.
    lp[P.FOOT_L + 2] = 0.04;
    lp[P.FOOT_R + 2] = -0.02;
    lp[P.FOOT_L + FOOT.YAW] = 0.08;
    lp[P.FOOT_R + FOOT.YAW] = -0.08;
    lp[P.FOOT_L + FOOT.HEEL] = 0;
    lp[P.FOOT_R + FOOT.HEEL] = 0;
    lp[P.HIPS_Q] = 0;
    lp[P.HIPS_Q + 1] = 0.04;
    lp[P.SPINE] = 0.04;
    lp[P.SPINE + 1] = 0;
    lp[P.HEAD] = -0.05;
    this.phase += (1 / 60) * speed * 2.6;
    const swing = Math.sin(this.phase) * Math.min(1, speed) * 0.18;
    lp[P.HAND_L] = 0.2;
    lp[P.HAND_L + 1] = 0.82;
    lp[P.HAND_L + 2] = 0.02 + swing;
    lp[P.HAND_R] = -0.2;
    lp[P.HAND_R + 1] = 0.82;
    lp[P.HAND_R + 2] = 0.02 - swing;
    lp[P.ELBOW_L] = 0.35;
    lp[P.ELBOW_L + 1] = 1.0;
    lp[P.ELBOW_L + 2] = -0.4;
    lp[P.ELBOW_R] = -0.35;
    lp[P.ELBOW_R + 1] = 1.0;
    lp[P.ELBOW_R + 2] = -0.4;
    lp[P.WRIST_L] = 0;
    lp[P.WRIST_R] = 0;
    lp[P.WRIST_L + 2] = 0;
    lp[P.WRIST_R + 2] = 0;
    scaleLocal(lp, this.scale);
    localToWorld(lp, { x: v.x, z: v.z, yaw: v.yaw }, this.target);
    this.feetDesired.set(this.target);
    this.lookAtOpponent(opp, opp ? 0.3 : 0);
  }

  /* --------------------------------------------------------------- paired */

  private buildPaired(v: Extract<AnimView, { mode: 'paired' }>, opp: Animator | null): void {
    const lp = this.local;
    const contacts = v.hold
      ? sampleHold(v.clip, v.role, v.progress, (this.phase += 1 / 60), v.intensity, v.mirror, lp)
      : sampleMove(v.clip, v.role, v.u, v.mirror, lp);
    this.contacts = contacts;

    // Shots start from wherever the bodies really were: close the gap to the
    // authored contact over the first part of the move.
    const clip = !v.hold ? moveClip(v.clip) : undefined;
    if (clip?.startDist && v.dist !== undefined) {
      const k = Math.min(1, v.u / (clip.warpBy ?? 0.55));
      const e = 1 - k * k * (3 - 2 * k);
      const off = ((v.dist - clip.startDist) / 2) * e * (v.role === 'A' ? -1 : 1);
      for (const at of [P.HIPS, P.FOOT_L, P.FOOT_R, P.KNEE_L, P.KNEE_R, P.HAND_L, P.HAND_R, P.ELBOW_L, P.ELBOW_R]) {
        lp[at + 2] += off;
      }
    }

    localToWorld(lp, v.frame, this.target);
    this.feetDesired.set(this.target);
    const lw = lp[P.LOOK_W];
    this.lookAtOpponent(opp, lw);
  }

  /* ----------------------------------------------------------------- solo */

  private buildSolo(v: Extract<AnimView, { mode: 'solo' }>, opp: Animator | null): void {
    const lp = this.local;
    if (!sampleSolo(v.clip, v.u, lp)) {
      stancePose({ ...DEFAULT_STANCE, level: 0.95, guard: 0 }, lp);
    }
    if (v.mirror) mirrorLocal(lp, lp);
    if (v.grip && opp) this.contacts.push({ ...v.grip, weight: 1 });
    scaleLocal(lp, this.scale);
    localToWorld(lp, { x: v.x, z: v.z, yaw: v.yaw }, this.target);
    this.feetDesired.set(this.target);
    this.lookAtOpponent(opp, lp[P.LOOK_W]);
  }

  /** Root position of the pelvis right now (world). */
  hipsWorld(out: Vector3): Vector3 {
    return out.set(this.display[P.HIPS], this.display[P.HIPS + 1], this.display[P.HIPS + 2]);
  }

  /** Bone world matrix, for attaching props. */
  boneMatrix(name: BoneName): Matrix4 {
    this.character.bones[name].updateWorldMatrix(true, false);
    return _m.copy(this.character.bones[name].matrixWorld);
  }
}
