/**
 * Posture: everything the solver needs to pose a body, as one flat array.
 *
 * Positions are world space (metres), angles are radians. Keeping it flat makes
 * blending, springs and copying trivial and allocation-free: a posture is just
 * numbers, and the solver turns numbers into bone rotations.
 *
 * Limb ends are targets, not angles — the hips go here, the ball of each foot
 * goes there, the wrists go there — and knees and elbows bend toward pole
 * points. That is what keeps feet planted and hands on an opponent.
 */

export const P = {
  /** Pelvis position. */
  HIPS: 0,
  /** Pelvis orientation quaternion (x, y, z, w). */
  HIPS_Q: 3,
  /** Total spine bend from pelvis to chest: pitch (forward +), yaw (twist), roll (side). */
  SPINE: 7,
  /** Head relative to the chest: pitch (chin down +), yaw, roll. */
  HEAD: 10,
  /** Look-at target and weight. */
  LOOK: 13,
  LOOK_W: 16,
  /** Feet: ball of the foot, yaw (world), heel lift, roll. */
  FOOT_L: 17,
  FOOT_R: 23,
  /** Knee pole points. */
  KNEE_L: 29,
  KNEE_R: 32,
  /** Wrist targets. */
  HAND_L: 35,
  HAND_R: 38,
  /** Elbow pole points. */
  ELBOW_L: 41,
  ELBOW_R: 44,
  /** Wrist angles relative to the forearm: flex, deviation, twist. */
  WRIST_L: 47,
  WRIST_R: 50,
  /** Shoulder girdle: elevation, protraction. */
  SHRUG_L: 53,
  SHRUG_R: 55,
  /** Toe flattening weight per foot (1 = toes flat on the mat). */
  TOES: 57,
  /** World-flat palm support weight per hand; zero preserves authored wrists. */
  PALMS: 59,
  SIZE: 61,
} as const;

/** Height of the ball-of-foot joint when the sole is flat on the mat. */
export const BALL_Y = 0.025;

/** Offsets within a foot block. */
export const FOOT = { BALL: 0, YAW: 3, HEEL: 4, ROLL: 5 } as const;

export type Posture = Float32Array;

export const createPosture = (): Posture => {
  const p = new Float32Array(P.SIZE);
  p[P.HIPS_Q + 3] = 1;
  p[P.TOES] = 1;
  p[P.TOES + 1] = 1;
  return p;
};

/** Indices that hold quaternions and must be blended as rotations. */
const QUAT_SLOTS = [P.HIPS_Q];

/** Indices holding angles that may wrap (foot yaw). */
const ANGLE_SLOTS = [P.FOOT_L + FOOT.YAW, P.FOOT_R + FOOT.YAW];

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** out = a + (b - a) * t, with quaternions slerped and yaw taking the short way. */
export function blendPosture(a: Posture, b: Posture, t: number, out: Posture): void {
  for (let i = 0; i < P.SIZE; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  for (const s of ANGLE_SLOTS) out[s] = a[s] + wrapAngle(b[s] - a[s]) * t;
  for (const s of QUAT_SLOTS) slerpSlot(a, b, s, t, out);
}

export function copyPosture(src: Posture, out: Posture): void {
  out.set(src);
}

function slerpSlot(a: Posture, b: Posture, s: number, t: number, out: Posture): void {
  let ax = a[s];
  let ay = a[s + 1];
  let az = a[s + 2];
  let aw = a[s + 3];
  const bx = b[s];
  const by = b[s + 1];
  const bz = b[s + 2];
  const bw = b[s + 3];
  let cos = ax * bx + ay * by + az * bz + aw * bw;
  if (cos < 0) {
    cos = -cos;
    ax = -ax;
    ay = -ay;
    az = -az;
    aw = -aw;
  }
  let k0 = 1 - t;
  let k1 = t;
  if (cos < 0.9995) {
    const th = Math.acos(Math.min(1, cos));
    const sn = Math.sin(th);
    k0 = Math.sin((1 - t) * th) / sn;
    k1 = Math.sin(t * th) / sn;
  }
  let x = ax * k0 + bx * k1;
  let y = ay * k0 + by * k1;
  let z = az * k0 + bz * k1;
  let w = aw * k0 + bw * k1;
  const l = Math.sqrt(x * x + y * y + z * z + w * w) || 1;
  x /= l;
  y /= l;
  z /= l;
  w /= l;
  out[s] = x;
  out[s + 1] = y;
  out[s + 2] = z;
  out[s + 3] = w;
}

/**
 * Critically damped spring toward a target posture: smooth, never overshoots,
 * keeps velocity across target changes — the difference between a body that
 * moves and one that snaps between poses.
 */
export class PostureSpring {
  readonly value = createPosture();
  private vel = new Float32Array(P.SIZE);
  private primed = false;

  /** Jump straight to a posture with no motion. */
  reset(to: Posture): void {
    this.value.set(to);
    this.vel.fill(0);
    this.primed = true;
  }

  /**
   * @param halfLife Seconds for the remaining distance to halve. Separate values
   *                 per group would be overkill; callers pick one per state.
   */
  update(target: Posture, dt: number, halfLife: number): void {
    if (!this.primed) {
      this.reset(target);
      return;
    }
    // Keep each quaternion on the target's hemisphere so lanes spring the short way.
    for (const s of QUAT_SLOTS) {
      const d =
        this.value[s] * target[s] +
        this.value[s + 1] * target[s + 1] +
        this.value[s + 2] * target[s + 2] +
        this.value[s + 3] * target[s + 3];
      if (d < 0) {
        for (let k = 0; k < 4; k++) {
          this.value[s + k] = -this.value[s + k];
          this.vel[s + k] = -this.vel[s + k];
        }
      }
    }
    const y = (4 * 0.69314718) / Math.max(1e-4, halfLife) / 2;
    const eydt = Math.exp(-y * dt);
    for (let i = 0; i < P.SIZE; i++) {
      let diff = this.value[i] - target[i];
      if (i === P.FOOT_L + FOOT.YAW || i === P.FOOT_R + FOOT.YAW) diff = wrapAngle(diff);
      const j1 = this.vel[i] + diff * y;
      this.value[i] = target[i] + eydt * (diff + j1 * dt);
      this.vel[i] = eydt * (this.vel[i] - j1 * y * dt);
    }
    for (const s of QUAT_SLOTS) {
      const v = this.value;
      const l = Math.sqrt(v[s] * v[s] + v[s + 1] * v[s + 1] + v[s + 2] * v[s + 2] + v[s + 3] * v[s + 3]) || 1;
      for (let k = 0; k < 4; k++) v[s + k] /= l;
    }
  }

  /** Current velocity of one lane, for secondary motion. */
  velocity(i: number): number {
    return this.vel[i];
  }
}
