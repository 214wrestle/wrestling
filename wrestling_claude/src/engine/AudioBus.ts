/**
 * Sound, synthesised.
 *
 * A wrestling room is mostly crowd noise, shoe squeak, bodies hitting a mat and a
 * whistle. All four are cheap to generate, so the game ships with no audio assets
 * and still has an atmosphere. Everything is gated behind the first user gesture
 * the way browsers require.
 */
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdSource: AudioBufferSourceNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private targetCrowd = 0.08;
  muted = false;

  /** Must be called from a user gesture. */
  async resume(): Promise<void> {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoise(4);
      this.startCrowd();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.72;
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Brown-ish noise reads as a room full of people rather than static.
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  private startCrowd(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 760;
    band.Q.value = 0.55;

    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 2400;
    shelf.gain.value = -8;

    const gain = ctx.createGain();
    gain.gain.value = 0.08;

    src.connect(band).connect(shelf).connect(gain).connect(this.master!);
    src.start();
    this.crowdSource = src;
    this.crowdGain = gain;
  }

  /** Call every frame: eases the crowd toward its target level. */
  update(dt: number, excitement: number): void {
    if (!this.ctx || !this.crowdGain) return;
    this.targetCrowd = 0.055 + excitement * 0.3;
    const g = this.crowdGain.gain;
    g.value += (this.targetCrowd - g.value) * Math.min(1, dt * 1.6);
  }

  private env(
    node: AudioNode,
    attack: number,
    decay: number,
    peak = 1,
  ): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    node.connect(g);
    g.connect(this.master!);
    return g;
  }

  whistle(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // Two close tones plus a warble is what makes a whistle sound like a whistle.
    for (const [freq, detune] of [
      [2380, 0],
      [2460, 8],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 42;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 120;
      lfo.connect(lfoGain).connect(osc.frequency);
      const g = this.env(osc, 0.012, 0.42, 0.26);
      osc.start(now);
      lfo.start(now);
      osc.stop(now + 0.5);
      lfo.stop(now + 0.5);
      void g;
    }
  }

  /** Body hitting the mat. */
  impact(strength: number): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(120 * (0.8 + strength * 0.5), now);
    thump.frequency.exponentialRampToValueAtTime(42, now + 0.22);
    this.env(thump, 0.006, 0.28, 0.3 + strength * 0.45);
    thump.start(now);
    thump.stop(now + 0.35);

    const slap = ctx.createBufferSource();
    slap.buffer = this.noiseBuffer;
    slap.playbackRate.value = 1.4;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500 + strength * 1800;
    slap.connect(lp);
    this.env(lp, 0.004, 0.14, 0.12 + strength * 0.22);
    slap.start(now, Math.random() * 3);
    slap.stop(now + 0.2);
  }

  /** Shoe squeak on the mat. */
  squeak(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900 + Math.random() * 500, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.12);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 6;
    bp.frequency.value = 1400;
    osc.connect(bp);
    this.env(bp, 0.005, 0.1, 0.05);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  buzzer(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 196;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    g.gain.setValueAtTime(0.16, now + 1.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
    osc.connect(g).connect(this.master!);
    osc.start(now);
    osc.stop(now + 1.35);
  }

  /** Short roar layered over the crowd bed. */
  roar(strength: number): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.85;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 620;
    bp.Q.value = 0.5;
    src.connect(bp);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.1 + strength * 0.26, now + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.6 + strength);
    bp.connect(g).connect(this.master!);
    src.start(now, Math.random() * 2);
    src.stop(now + 2.8 + strength);
  }

  /** Rush of air and fabric as a move starts. */
  whoosh(strength: number): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 2.2;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(500, now);
    bp.frequency.exponentialRampToValueAtTime(1800, now + 0.18);
    src.connect(bp);
    this.env(bp, 0.03, 0.2, 0.05 + strength * 0.08);
    src.start(now, Math.random() * 3);
    src.stop(now + 0.3);
  }

  /** A short sting for points: bright for us, low for them. */
  score(ours: boolean): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const notes = ours ? [523.25, 659.25, 783.99] : [392, 329.63];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      const t = now + i * 0.07;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(g).connect(this.master!);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  /** Tactile confirmation for a button press: a tick, a thump or a dull knock. */
  press(result: 'ok' | 'won' | 'lost' | 'blocked'): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (result === 'won') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
      this.env(osc, 0.004, 0.14, 0.22);
      osc.start(now);
      osc.stop(now + 0.18);
    }
    const slap = ctx.createBufferSource();
    slap.buffer = this.noiseBuffer;
    slap.playbackRate.value = result === 'blocked' ? 0.9 : 1.8;
    const f = ctx.createBiquadFilter();
    f.type = result === 'lost' || result === 'blocked' ? 'lowpass' : 'bandpass';
    f.frequency.value = result === 'lost' || result === 'blocked' ? 600 : 2200;
    slap.connect(f);
    this.env(f, 0.002, result === 'ok' ? 0.05 : 0.09, result === 'ok' ? 0.05 : 0.09);
    slap.start(now, Math.random() * 3);
    slap.stop(now + 0.12);
  }

  dispose(): void {
    this.crowdSource?.stop();
    this.ctx?.close();
    this.ctx = null;
  }
}
