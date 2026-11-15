import { Quaternion, Vector3, type PerspectiveCamera } from 'three';
import type { CharacterRig } from '../body/Character';

/**
 * Instant replay, as a console sports game shows one (owner, November 14: "as much like a PlayStation game, like UFC
 * Fight Night ... as you can"). The last `keep` seconds of live wrestling are recorded every frame (each rig's root and
 * bones). A big moment marks a highlight with its own window. When play stops soon after one (a whistle, the end of a
 * period, a fall), the window plays back in slow motion from a low camera on the other side, then play carries on from
 * where it stopped. The player skips it with any button.
 */
export const REPLAY = {
  /** Seconds of play kept. */
  keep: 7,
  /** Slow motion: replay seconds per real second. */
  speed: 0.55,
  /** A highlight this many seconds before the stoppage gets a replay. */
  recent: 6,
  /** Seconds of the stoppage before the replay starts, so the call registers. */
  delay: 0.6,
  /** Camera: distance, height, look height (m), field of view, how far it swings round (rad) over the replay, and how
   *  far it is turned off square to the pair (rad). */
  camera: { distance: 3.5, height: 0.95, look: 0.6, fov: 31, swing: 0.35, turn: 0.3 },
} as const;

/** A big moment: when it happened, how big (ranks highlights), the window shown around it, and where the live camera
 *  was looking from then (rad). */
export interface Highlight { t: number; weight: number; from: number; to: number; azimuth: number }

const FLOATS = 7; // position xyz + quaternion xyzw

export class Replay {
  private rigs: CharacterRig[] = [];
  private stride = 0;
  private ring: Float32Array[] = [];
  private times: Float64Array = new Float64Array(0);
  private head = 0;
  private count = 0;
  private best: Highlight | null = null;
  private live: Float32Array | null = null;
  playing: Highlight | null = null;
  private rt = 0;
  private azimuth = 0;
  private focus = new Vector3();

  /** The rigs to record (the two wrestlers and the referee); clears what was recorded. */
  track(rigs: CharacterRig[]): void {
    this.stop();
    this.rigs = rigs;
    this.stride = rigs.reduce((n, r) => n + (r.boneList.length + 1) * FLOATS, 0);
    const n = Math.ceil(REPLAY.keep * 60) + 8;
    this.ring = Array.from({ length: n }, () => new Float32Array(this.stride));
    this.times = new Float64Array(n);
    this.head = 0;
    this.count = 0;
    this.best = null;
  }

  /** Records this frame of live play at time `t`. */
  record(t: number): void {
    if (!this.rigs.length || this.playing || this.count && t <= this.timeAt(0)) return;
    this.write(this.ring[this.head]);
    this.times[this.head] = t;
    this.head = (this.head + 1) % this.ring.length;
    this.count = Math.min(this.count + 1, this.ring.length);
  }

  /** A big moment at `t`, shown from `before` seconds earlier to `after` seconds later; `azimuth` is the live camera's.
   *  The biggest recent one wins. */
  mark(t: number, weight: number, before: number, after: number, azimuth: number): void {
    const h: Highlight = { t, weight, from: t - before, to: t + after, azimuth };
    if (!this.best || this.best.t < t - REPLAY.recent || weight >= this.best.weight) this.best = h;
  }

  /** Play stopped at `now`: replays the best highlight from the last REPLAY.recent seconds, if there is one. */
  start(now: number): boolean {
    const h = this.best;
    if (!h || this.playing || now - h.t > REPLAY.recent || this.count < 30) return false;
    const first = this.timeAt(this.count - 1), last = this.timeAt(0);
    const from = Math.max(h.from, first), to = Math.min(h.to, last);
    if (to - from < 0.8) return false;
    this.best = null;
    this.live = new Float32Array(this.stride);
    this.write(this.live);
    this.playing = { ...h, from, to };
    this.rt = from;
    // Square across the line between them over the whole window, so neither hides the other, on the live camera's side
    // (the referee works the far side), turned a little; the camera follows the pair's middle as they travel.
    let C = 0, S = 0;
    for (let i = 0; i <= 4; i++) {
      this.sample(from + ((to - from) * i) / 4);
      const [a, b] = this.hips();
      const vx = b.x - a.x, vz = b.z - a.z, len = Math.hypot(vx, vz), th = Math.atan2(vx, vz);
      C += Math.cos(2 * th) * len;
      S += Math.sin(2 * th) * len;
    }
    const line = Math.atan2(S, C) / 2;
    const off = (x: number) => Math.abs(Math.atan2(Math.sin(x - h.azimuth), Math.cos(x - h.azimuth)));
    const side = off(line + Math.PI / 2) <= off(line - Math.PI / 2) ? line + Math.PI / 2 : line - Math.PI / 2;
    this.azimuth = side + REPLAY.camera.turn;
    this.sample(from);
    const [a, b] = this.hips();
    this.focus.copy(a).add(b).multiplyScalar(0.5);
    return true;
  }

  /** Advances the replay by `wall` seconds and poses the rigs and camera; false once it is over. */
  update(wall: number, camera: PerspectiveCamera): boolean {
    const h = this.playing;
    if (!h) return false;
    this.rt += wall * REPLAY.speed;
    if (this.rt >= h.to) { this.stop(); return false; }
    this.sample(this.rt);
    const [a, b] = this.hips();
    this.focus.lerp(a.add(b).multiplyScalar(0.5), 1 - Math.exp(-wall * 4));
    const k = (this.rt - h.from) / Math.max(1e-3, h.to - h.from);
    const c = REPLAY.camera;
    const az = this.azimuth + c.swing * (k - 0.5);
    const dist = c.distance * (1.05 - 0.1 * k);
    camera.position.set(this.focus.x + Math.sin(az) * dist, c.height, this.focus.z + Math.cos(az) * dist);
    camera.lookAt(this.focus.x, c.look, this.focus.z);
    // Keep the shot's width on narrow screens, as the live camera does.
    const fit = Math.max(1, 1.3 / Math.max(0.2, camera.aspect));
    camera.fov = 2 * Math.atan(Math.tan((c.fov * Math.PI) / 360) * fit) * (180 / Math.PI);
    camera.updateProjectionMatrix();
    return true;
  }

  /** Ends the replay and puts every rig back as live play left it. */
  stop(): void {
    if (this.live) this.read(this.live);
    this.live = null;
    this.playing = null;
  }

  /** Seconds of replay left, for the UI. */
  get remaining(): number {
    return this.playing ? (this.playing.to - this.rt) / REPLAY.speed : 0;
  }

  /** Both wrestlers' hips as posed now (the first two rigs). */
  private hips(): [Vector3, Vector3] {
    const a = this.rigs[0].bones.hips.getWorldPosition(new Vector3());
    return [a, (this.rigs[1] ?? this.rigs[0]).bones.hips.getWorldPosition(new Vector3())];
  }

  /** Time of the frame `back` frames before the newest. */
  private timeAt(back: number): number {
    return this.times[(this.head - 1 - back + this.ring.length * 2) % this.ring.length];
  }

  /** Poses the rigs at time `t`, between the two recorded frames around it. */
  private sample(t: number): void {
    let back = 0;
    while (back < this.count - 1 && this.timeAt(back) > t) back++;
    const older = this.ring[(this.head - 1 - back + this.ring.length * 2) % this.ring.length];
    const newerBack = Math.max(0, back - 1);
    const newer = this.ring[(this.head - 1 - newerBack + this.ring.length * 2) % this.ring.length];
    const t0 = this.timeAt(back), t1 = this.timeAt(newerBack);
    const u = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
    this.read(older, newer, u);
  }

  private write(out: Float32Array): void {
    let o = 0;
    for (const rig of this.rigs) {
      for (const obj of [rig.root, ...rig.boneList]) {
        out[o++] = obj.position.x; out[o++] = obj.position.y; out[o++] = obj.position.z;
        out[o++] = obj.quaternion.x; out[o++] = obj.quaternion.y; out[o++] = obj.quaternion.z; out[o++] = obj.quaternion.w;
      }
    }
  }

  private qa = new Quaternion();
  private qb = new Quaternion();
  private read(a: Float32Array, b: Float32Array = a, u = 0): void {
    let o = 0;
    for (const rig of this.rigs) {
      for (const obj of [rig.root, ...rig.boneList]) {
        obj.position.set(a[o] + (b[o] - a[o]) * u, a[o + 1] + (b[o + 1] - a[o + 1]) * u, a[o + 2] + (b[o + 2] - a[o + 2]) * u);
        this.qa.set(a[o + 3], a[o + 4], a[o + 5], a[o + 6]);
        this.qb.set(b[o + 3], b[o + 4], b[o + 5], b[o + 6]);
        obj.quaternion.slerpQuaternions(this.qa, this.qb, u);
        o += FLOATS;
      }
      rig.root.updateMatrixWorld(true);
    }
  }
}
