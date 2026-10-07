import { FOOT, P } from './posture';
import type { Posture } from './posture';

/**
 * Footwork.
 *
 * Feet are planted in the world and only move by stepping. Each frame the stance
 * says where the feet *should* be; when a planted foot falls too far behind
 * that, it picks up and steps — one foot at a time, the way wrestlers shuffle —
 * aiming slightly ahead of the body's motion so it lands where the body will be.
 * Planted targets stay fixed; the Animator blends these with authored poses.
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
  heel: number;
  fheel: number;
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
  heel: 0,
  fheel: 0,
});

export class Footwork {
  private feet: [FootState, FootState] = [newFoot(), newFoot()];
  private primed = false;
  private walking = false;
  private bodyScale = 1;
  private toeOffWeight = 0;
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
      f.heel = p[at + FOOT.HEEL];
      f.fheel = f.heel;
    }
    this.toeOffWeight = 0;
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
  update(dt: number, desired: Posture, vx: number, vz: number, tempo = 1, walking = false, bodyScale = 1): void {
    this.bodyScale = bodyScale;
    this.walking = walking;
    if (!this.primed) {
      this.reset(desired);
      return;
    }
    this.sinceLand += dt;
    const speed = Math.hypot(vx, vz);
    const relativeSpeed = speed / bodyScale;
    // Release the toe-off roll when travel stops, even if the final planted
    // foot remains slightly behind the pelvis inside the step dead zone.
    const toeOffTarget = walking ? Math.min(1, relativeSpeed / .2) : 0;
    this.toeOffWeight += (toeOffTarget - this.toeOffWeight) * (1 - Math.exp(-dt / .08));

    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      if (!f.stepping) continue;
      f.t += dt;
      // Keep re-aiming the landing while in the air.
      const at = i === 0 ? P.FOOT_L : P.FOOT_R;
      // Predict only the remaining swing time. Using the full duration on
      // every frame makes a walking foot chase the body too far forward.
      const lead = walking ? Math.max(0, f.dur - f.t) * .65 : Math.min(.12, f.dur * .45);
      // Commit the landing before touchdown, rather than chasing a moving target.
      if (f.t < f.dur * .6) {
        // Redirect an airborne foot over time. Instant endpoint replacement
        // turns abrupt joystick reversals into a visible jump along the arc.
        const dx = desired[at] + vx * lead - f.tx;
        const dz = desired[at + 2] + vz * lead - f.tz;
        const distance = Math.hypot(dx, dz);
        const follow = distance > 0 ? Math.min(1, (3 * bodyScale + speed) * dt / distance) : 1;
        f.tx += dx * follow;
        f.tz += dz * follow;
        const turn = wrap(desired[at + FOOT.YAW] - f.tyaw);
        f.tyaw += Math.max(-8 * dt, Math.min(8 * dt, turn));
      }
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
    let worst = -1;
    let worstErr = 0;
    let bestPriority = -Infinity;
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      if (f.stepping) continue;
      const at = i === 0 ? P.FOOT_L : P.FOOT_R;
      const dx = desired[at] - f.x;
      const dz = desired[at + 2] - f.z;
      const err = Math.hypot(dx, dz) + Math.abs(wrap(desired[at + FOOT.YAW] - f.yaw)) * 0.12;
      // When both feet need an equal adjustment, open the stance in the
      // travel direction first. The larger trailing-foot error then catches up.
      const other = this.feet[1-i];
      const leadsTravel = speed > .05 && (f.x-other.x)*vx + (f.z-other.z)*vz > 0;
      const priority = err + (!walking && leadsTravel ? .02 : 0);
      if (priority > bestPriority) {
        bestPriority = priority;
        worstErr = err;
        worst = i;
      }
    }

    const threshold = (walking ? .12 : relativeSpeed > .25 ? .075 : .1) * bodyScale;
    if (worst >= 0 && worstErr > threshold) {
      // Transfer support only after touchdown; never float on two swinging feet.
      // Upright walking includes double support: load the newly planted
      // foot before lifting the other. Shorten this at faster travel speeds.
      const transferTime = walking ? Math.max(0, .12 - relativeSpeed * .1) : 0;
      const canStart = !anyStepping && this.sinceLand >= transferTime;
      if (canStart) {
        const f = this.feet[worst];
        const at = worst === 0 ? P.FOOT_L : P.FOOT_R;
        f.stepping = true;
        f.t = 0;
        f.dur = (walking ? Math.max(.26, .42 - relativeSpeed * .075)
          : Math.min(Math.max(.16, Math.min(.28, .17 + worstErr * .2)), .28 / (1 + relativeSpeed * .6))) * Math.min(1, bodyScale) / tempo;
        f.fx = f.x;
        f.fz = f.z;
        f.fyaw = f.yaw;
        f.fheel = f.heel;
        f.tx = desired[at] + vx * f.dur * (walking ? .65 : .45);
        f.tz = desired[at + 2] + vz * f.dur * (walking ? .65 : .45);
        f.tyaw = desired[at + FOOT.YAW];
        // A small settling/pivot step should skim the mat, not lift the knee
        // as high as a full stride. Measure travel independently of yaw error.
        const travel = Math.hypot(f.tx - f.fx, f.tz - f.fz) / bodyScale;
        const stride = Math.min(1, travel / .35);
        const walkingLift = .022 + .043 * stride * stride * (3 - 2 * stride);
        f.lift = (walking ? walkingLift : Math.min(.045, .018 + travel * .06)) * bodyScale;
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
      if (this.walking && !f.stepping) {
        // As the pelvis passes the support foot, rise onto its toes before lift.
        const behind = (p[P.HIPS] - f.x) * Math.sin(f.yaw) + (p[P.HIPS + 2] - f.z) * Math.cos(f.yaw);
        const load = Math.max(0, Math.min(1, (behind / this.bodyScale - .02) / .23));
        heelExtra = load * load * (3 - 2 * load) * .3 * this.toeOffWeight;
      }
      if (f.stepping) {
        const u = Math.min(1, f.t / f.dur);
        const e = u * u * u * (10 + u * (-15 + 6 * u));
        x = f.fx + (f.tx - f.fx) * e;
        z = f.fz + (f.tz - f.fz) * e;
        yaw = f.fyaw + wrap(f.tyaw - f.fyaw) * e;
        y = f.y + Math.sin(u * Math.PI) ** 2 * f.lift;
        heelExtra = this.walking ? (1-e) * f.fheel + Math.sin(2 * u * Math.PI) * .22 : Math.sin(u * Math.PI) * .25;
        // A dorsiflexed foot rotates its heel down around the ball target.
        // Limit that rotation to the available clearance instead of clipping.
        if (this.walking && heelExtra < 0) heelExtra = Math.max(heelExtra, -Math.asin(Math.min(1, (y-f.y)/(.23*this.bodyScale))));
      }
      p[at] += (x - p[at]) * weight;
      p[at + 1] += (y - p[at + 1]) * weight;
      p[at + 2] += (z - p[at + 2]) * weight;
      p[at + FOOT.YAW] += wrap(yaw - p[at + FOOT.YAW]) * weight;
      f.heel = heelExtra;
      p[at + FOOT.HEEL] += heelExtra * weight;
      if (f.stepping) p[P.TOES + i] = 1 - Math.sin(Math.min(1, f.t / f.dur) * Math.PI) * 0.6;
    }
  }

  /** Signed support loading: positive while the left foot carries the body. */
  get support(): number {
    return this.feet.reduce((sum, f, i) => sum + (f.stepping ? (i === 0 ? -1 : 1) * Math.sin(Math.PI * Math.min(1, f.t / f.dur)) ** 2 : 0), 0);
  }

  /** Lateral and vertical bob in the hips from the stepping rhythm. */
  get bounce(): number {
    if (this.walking) {
      // Rise smoothly over the supporting leg, then settle into double support.
      // No landing-triggered jolt, including when the final step comes to rest.
      return this.feet.reduce((rise, f) => rise + (f.stepping
        ? Math.sin(Math.PI * Math.min(1, f.t / f.dur)) ** 2 * Math.min(.018 * this.bodyScale, f.lift * .2)
        : 0), 0);
    }
    const t = this.sinceLand;
    // Ease into and out of absorption: a sine alone changes pelvis velocity
    // instantly at touchdown and at the end of the landing response.
    return t < 0.18 ? -(Math.sin((t / 0.18) * Math.PI) ** 2) * 0.008 * this.bodyScale : 0;
  }
}
