import { PerspectiveCamera, Vector3 } from 'three';

export type CameraMode =
  | 'attract'
  | 'showcase'
  | 'intro'
  | 'broadcast'
  | 'low'
  | 'tight'
  | 'mat'
  | 'hero'
  | 'lift'
  | 'wide'
  | 'celebration';

interface Shot {
  height: number;
  distance: number;
  lookHeight: number;
  fov: number;
  /** How quickly the camera swings round to its azimuth. */
  orbit: number;
  responsiveness: number;
}

const SHOTS: Record<CameraMode, Shot> = {
  attract: { height: 4.2, distance: 11, lookHeight: 0.9, fov: 38, orbit: 0, responsiveness: 0.8 },
  showcase: { height: 1.05, distance: 5.6, lookHeight: 0.55, fov: 30, orbit: 0.5, responsiveness: 1.2 },
  intro: { height: 1.5, distance: 3.5, lookHeight: 1.3, fov: 32, orbit: 1.2, responsiveness: 1.6 },
  broadcast: { height: 2.15, distance: 5.6, lookHeight: 0.82, fov: 36, orbit: 2.6, responsiveness: 3.2 },
  low: { height: 1.2, distance: 4.6, lookHeight: 0.62, fov: 34, orbit: 1.4, responsiveness: 4 },
  tight: { height: 1.55, distance: 4.0, lookHeight: 0.7, fov: 32, orbit: 1.5, responsiveness: 4 },
  mat: { height: 1.75, distance: 4.0, lookHeight: 0.4, fov: 34, orbit: 1.4, responsiveness: 3.4 },
  hero: { height: 1.05, distance: 4.4, lookHeight: 0.55, fov: 30, orbit: 1.1, responsiveness: 2.8 },
  // Low and a step back, so a man in the air stays in frame under the scorebug.
  lift: { height: 1.15, distance: 5.5, lookHeight: 0.85, fov: 34, orbit: 1.2, responsiveness: 3 },
  wide: { height: 3.6, distance: 8.2, lookHeight: 0.8, fov: 38, orbit: 0.9, responsiveness: 1.8 },
  celebration: { height: 1.6, distance: 4.6, lookHeight: 1.15, fov: 32, orbit: 0.8, responsiveness: 1.8 },
};

const wrap = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

/**
 * The camera operator.
 *
 * Holds a broadcast side view on the action with the player's wrestler on the
 * left, so pushing right always closes on the opponent. Pulls back as they
 * separate, pushes in for the big moments, and carries a little handheld drift
 * and impact shake so nothing feels on rails.
 */
export class CameraRig {
  mode: CameraMode = 'attract';
  private azimuth = 0.6;
  private target = new Vector3(0, 0.9, 0);
  private position = new Vector3(0, 3, 9);
  private current: Shot = { ...SHOTS.attract };
  private shakeAmount = 0;
  private shakeT = 0;
  private punch = 0;
  private time = 0;
  private spread = 0;
  /** Extra orbit for showcase and attract. */
  private spin = 0;

  setMode(mode: CameraMode): void {
    this.mode = mode;
  }

  shake(amount: number): void {
    this.shakeAmount = Math.min(1, this.shakeAmount + amount);
    this.punch = Math.min(1, this.punch + amount * 0.6);
  }

  /**
   * @param focus   Point of interest on the mat.
   * @param azimuth Where the camera should sit, as the direction from the focus.
   * @param spread  Distance between the wrestlers.
   */
  update(dt: number, camera: PerspectiveCamera, focus: Vector3, azimuth: number, spread: number): void {
    this.time += dt;
    const shot = SHOTS[this.mode];
    const k = Math.min(1, dt * 2.6);
    this.current.height += (shot.height - this.current.height) * k;
    this.current.distance += (shot.distance - this.current.distance) * k;
    this.current.lookHeight += (shot.lookHeight - this.current.lookHeight) * k;
    this.current.fov += (shot.fov - this.current.fov) * k;
    this.current.orbit += (shot.orbit - this.current.orbit) * k;
    this.current.responsiveness += (shot.responsiveness - this.current.responsiveness) * k;
    this.spread += (spread - this.spread) * Math.min(1, dt * 2);

    if (this.mode === 'attract') {
      this.spin += dt * 0.07;
      this.azimuth = this.spin;
    } else if (this.mode === 'showcase') {
      this.spin += dt * 0.05;
      const want = azimuth + Math.sin(this.spin) * 0.55;
      this.azimuth += wrap(want - this.azimuth) * Math.min(1, dt * 0.8);
    } else {
      const d = wrap(azimuth - this.azimuth);
      this.azimuth += d * Math.min(1, dt * this.current.orbit);
      this.azimuth += Math.sin(this.time * 0.13) * dt * 0.02;
    }

    this.target.lerp(new Vector3(focus.x, this.current.lookHeight, focus.z), Math.min(1, dt * this.current.responsiveness));
    const dist = this.current.distance + Math.max(0, this.spread - 0.9) * 0.9 - this.punch * 0.55;
    const want = new Vector3(
      this.target.x + Math.sin(this.azimuth) * dist,
      this.current.height + this.punch * 0.08,
      this.target.z + Math.cos(this.azimuth) * dist,
    );
    this.position.lerp(want, Math.min(1, dt * this.current.responsiveness));

    this.shakeT += dt * 26;
    this.shakeAmount *= Math.exp(-dt * 8);
    this.punch *= Math.exp(-dt * 3.6);
    const drift = 0.01;
    const sx = Math.sin(this.time * 0.9) * drift + Math.sin(this.shakeT) * this.shakeAmount * 0.07;
    const sy = Math.cos(this.time * 0.74) * drift + Math.cos(this.shakeT * 1.37) * this.shakeAmount * 0.06;
    camera.position.set(this.position.x + sx, Math.max(0.3, this.position.y + sy), this.position.z);
    camera.lookAt(this.target.x, this.target.y + sy * 0.4, this.target.z);
    const fov = this.current.fov - this.punch * 2.2;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  /** Snap straight to the current shot, for hard cuts. */
  cut(focus: Vector3, azimuth: number): void {
    this.azimuth = azimuth;
    Object.assign(this.current, SHOTS[this.mode]);
    this.target.set(focus.x, this.current.lookHeight, focus.z);
    this.position.set(
      focus.x + Math.sin(azimuth) * this.current.distance,
      this.current.height,
      focus.z + Math.cos(azimuth) * this.current.distance,
    );
  }

  get viewAzimuth(): number {
    return this.azimuth;
  }
}
