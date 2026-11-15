/**
 * Dynamic resolution, as console games hold their frame rate (owner, November 14: fluid like a PlayStation game, played
 * on a phone). When frames run long for a while the picture renders at fewer pixels, a step at a time; when it is
 * comfortably fast again it climbs back. If a step down does not speed it up (the time goes elsewhere, not to the
 * pixels) that step is undone and the scale stays put. A display that keeps up never changes anything.
 */
export const ADAPTIVE_RES = {
  /** Average frame seconds that count as slow (under about 50 fps) and as fast (over about 57 fps). */
  slow: 1 / 50, fast: 1 / 57,
  /** Seconds slow before a step down, seconds fast before a step up, seconds after a change before judging it. */
  slowFor: 1.5, fastFor: 8, settle: 2,
  step: 0.85, min: 0.6,
  /** A step down must cut the average frame time by at least this share, or it is undone. */
  gain: 0.08,
  /** A step down this soon after a step up caps the scale there: no flipping back and forth. */
  flip: 12,
} as const;

export class AdaptiveResolution {
  scale = 1;
  private avg = 1 / 60;
  private slowT = 0;
  private fastT = 0;
  private settleT = 0;
  private sinceUp = Infinity;
  private ceiling = 1;
  /** The step down being judged: the average frame time before it and the scale it came from. */
  private trial: { before: number; from: number } | null = null;
  /** A step down did not help: resolution is not what holds this device back, so leave it alone. */
  private locked = false;

  constructor(private apply: (scale: number) => void) {}

  /** Wall seconds of the last frame; `active` false (menus, paused, hidden tab) skips it. */
  update(wall: number, active: boolean): void {
    if (this.locked || !active || wall <= 0 || wall >= 0.1) return;
    this.avg += (wall - this.avg) * Math.min(1, wall * 2.5);
    this.sinceUp += wall;
    if (this.settleT > 0) {
      this.settleT -= wall;
      if (this.settleT > 0) return;
      const trial = this.trial;
      this.trial = null;
      if (trial && this.avg > trial.before * (1 - ADAPTIVE_RES.gain)) {
        this.set(trial.from);
        this.locked = true;
        return;
      }
    }
    this.slowT = this.avg > ADAPTIVE_RES.slow ? this.slowT + wall : 0;
    this.fastT = this.avg < ADAPTIVE_RES.fast ? this.fastT + wall : 0;
    if (this.slowT > ADAPTIVE_RES.slowFor && this.scale > ADAPTIVE_RES.min + 1e-6) {
      const from = this.scale;
      this.set(Math.max(ADAPTIVE_RES.min, this.scale * ADAPTIVE_RES.step));
      if (this.sinceUp < ADAPTIVE_RES.flip) this.ceiling = this.scale;
      else this.trial = { before: this.avg, from };
    } else if (this.fastT > ADAPTIVE_RES.fastFor && this.scale < this.ceiling - 1e-6) {
      this.set(Math.min(this.ceiling, this.scale / ADAPTIVE_RES.step));
      this.sinceUp = 0;
    }
  }

  private set(scale: number): void {
    this.scale = scale;
    this.slowT = 0;
    this.fastT = 0;
    this.settleT = ADAPTIVE_RES.settle;
    this.apply(scale);
  }
}
