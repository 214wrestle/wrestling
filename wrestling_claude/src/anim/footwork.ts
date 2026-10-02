import { FOOT, P } from './posture';
import type { Posture } from './posture';

/**
 * Footwork.
 *
 * Feet are planted in the world and only move by stepping. Each frame the stance
 * says where the feet *should* be; when a planted foot falls too far behind
 * that, it picks up and steps — one foot at a time, the way wrestlers shuffle —
 * aiming slightly ahead of the body's motion so it lands where the body will be.
 * No sliding feet, ever.
 */

interface FootState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Step in progress. */
  stepping: boolean;
  t: number;
  dur: number;
  fx: number;
  fz: number;
  fyaw: number;
  tx: number;
  tz: number;
  tyaw: number;
  lift: number;
}

const wrap = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

const newFoot = (): FootState => ({
  x: 0,
  y: 0.025,
  z: 0,
  yaw: 0,
  stepping: false,
  t: 0,
  dur: 0.2,
  fx: 0,
  fz: 0,
  fyaw: 0,
  tx: 0,
  tz: 0,
  tyaw: 0,
  lift: 0,
});

export class Footwork {
  private feet: [FootState, FootState] = [newFoot(), newFoot()];
  private primed = false;
  /** Fired when a foot lands — drives squeaks and dust. */
  onPlant: ((foot: 0 | 1, x: number, z: number, speed: number) => void) | null = null;
  /** Seconds since the last plant, for a bounce in the hips. */
  sinceLand = 1;

  reset(p: Posture): void {
    for (let i = 0; i < 2; i++) {
      const at = i === 0 ? P.FOOT_L : P.FOOT_R;
      const f = this.feet[i];
      f.x = p[at];
      f.y = p[at + 1];
      f.z = p[at + 2];
      f.yaw = p[at + FOOT.YAW];
      f.stepping = false;
    }
    this.primed = true;
  }

  get isPrimed(): boolean {
    return this.primed;
  }

  invalidate(): void {
    this.primed = false;
  }

  /**
   * @param desired  Posture holding where the stance wants each foot.
   * @param vx,vz    Body velocity on the mat, m/s.
   * @param tempo    1 = normal; higher steps faster (scrambles, sprints).
   */
  update(dt: number, desired: Posture, vx: number, vz: number, tempo = 1): void {
    if (!this.primed) {
      this.reset(desired);
      return;
    }
    this.sinceLand += dt;
    const speed = Math.hypot(vx, vz);

    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      if (!f.stepping) continue;
      f.t += dt;
      // Keep re-aiming the landing while in the air.
      const at = i === 0 ? P.FOOT_L : P.FOOT_R;
      const lead = Math.min(0.12, f.dur * 0.45);
      f.tx = desired[at] + vx * lead;
      f.tz = desired[at + 2] + vz * lead;
      f.tyaw = desired[at + FOOT.YAW];
      if (f.t >= f.dur) {
        f.stepping = false;
        f.x = f.tx;
        f.y = desired[at + 1];
        f.z = f.tz;
        f.yaw = f.tyaw;
        this.sinceLand = 0;
        this.onPlant?.(i as 0 | 1, f.x, f.z, speed);
      }
    }

    const anyStepping = this.feet[0].stepping || this.feet[1].stepping;
    const other = (i: number) => this.feet[1 - i];
    let worst = -1;
    let worstErr = 0;
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      if (f.stepping) continue;
      const at = i === 0 ? P.FOOT_L : P.FOOT_R;
      const dx = desired[at] - f.x;
      const dz = desired[at + 2] - f.z;
      const err = Math.hypot(dx, dz) + Math.abs(wrap(desired[at + FOOT.YAW] - f.yaw)) * 0.12;
      if (err > worstErr) {
        worstErr = err;
        worst = i;
      }
    }

    const threshold = speed > 0.25 ? 0.055 : 0.1;
    if (worst >= 0 && worstErr > threshold) {
      // Allow a second foot to start only once the first is nearly down.
      const o = other(worst);
      const canStart = !anyStepping || (o.stepping && o.t > o.dur * 0.62 && worstErr > 0.16);
      if (canStart) {
        const f = this.feet[worst];
        const at = worst === 0 ? P.FOOT_L : P.FOOT_R;
        f.stepping = true;
        f.t = 0;
        f.dur = Math.max(0.11, Math.min(0.26, 0.13 + worstErr * 0.35)) / tempo;
        f.fx = f.x;
        f.fz = f.z;
        f.fyaw = f.yaw;
        f.tx = desired[at];
        f.tz = desired[at + 2];
        f.tyaw = desired[at + FOOT.YAW];
        f.lift = Math.min(0.07, 0.025 + worstErr * 0.12);
      }
    }
  }

  /**
   * Write the feet into a posture, blended by `weight` (0 leaves the posture's
   * own feet alone).
   */
  apply(p: Posture, weight: number): void {
    if (!this.primed || weight <= 0) return;
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      const at = i === 0 ? P.FOOT_L : P.FOOT_R;
      let x = f.x;
      let z = f.z;
      let y = f.y;
      let yaw = f.yaw;
      let heelExtra = 0;
      if (f.stepping) {
        const u = Math.min(1, f.t / f.dur);
        const e = u * u * (3 - 2 * u);
        x = f.fx + (f.tx - f.fx) * e;
        z = f.fz + (f.tz - f.fz) * e;
        yaw = f.fyaw + wrap(f.tyaw - f.fyaw) * e;
        y = f.y + Math.sin(u * Math.PI) * f.lift;
        heelExtra = Math.sin(u * Math.PI) * 0.35;
      }
      p[at] += (x - p[at]) * weight;
      p[at + 1] += (y - p[at + 1]) * weight;
      p[at + 2] += (z - p[at + 2]) * weight;
      p[at + FOOT.YAW] += wrap(yaw - p[at + FOOT.YAW]) * weight;
      p[at + FOOT.HEEL] += heelExtra * weight;
      if (f.stepping) p[P.TOES + i] = 1 - Math.sin(Math.min(1, f.t / f.dur) * Math.PI) * 0.6;
    }
  }

  /** Lateral and vertical bob in the hips from the stepping rhythm. */
  get bounce(): number {
    const t = this.sinceLand;
    return t < 0.18 ? -Math.sin((t / 0.18) * Math.PI) * 0.012 : 0;
  }
}
