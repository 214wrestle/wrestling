/** Small synthesized soundscape. No network requests or external audio assets. */
export class Sound {
  private context?: AudioContext;
  private master?: GainNode;
  private crowd?: GainNode;
  private enabled = true;
  async start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain(); this.master.gain.value = this.enabled ? 0.32 : 0;
      this.master.connect(this.context.destination);
      const buffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate), data = buffer.getChannelData(0);
      let smooth = 0;
      for (let i = 0; i < data.length; i++) { smooth = (smooth + (Math.random() * 2 - 1) * 0.06) / 1.025; data[i] = smooth * 1.7; }
      const noise = this.context.createBufferSource(); noise.buffer = buffer; noise.loop = true;
      const filter = this.context.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 520; filter.Q.value = 0.5;
      this.crowd = this.context.createGain(); this.crowd.gain.value = 0.09;
      noise.connect(filter); filter.connect(this.crowd); this.crowd.connect(this.master); noise.start();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  setEnabled(value: boolean) { this.enabled = value; if (this.context && this.master) this.master.gain.setTargetAtTime(value ? 0.32 : 0, this.context.currentTime, 0.15); }
  private tone(frequency: number, seconds: number, volume: number, type: OscillatorType = 'sine', end?: number) {
    if (!this.context || !this.master || !this.enabled) return;
    const t = this.context.currentTime, o = this.context.createOscillator(), g = this.context.createGain();
    o.type = type; o.frequency.setValueAtTime(frequency, t); if (end) o.frequency.exponentialRampToValueAtTime(end, t + seconds);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(volume, t + 0.012); g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    o.connect(g); g.connect(this.master); o.start(); o.stop(t + seconds + 0.05);
  }
  whistle() { this.tone(2180, 0.26, 0.24, 'sine', 2400); this.tone(3120, 0.23, 0.075); }
  impact() { this.tone(95, 0.19, 0.65, 'triangle', 35); this.tone(200, 0.08, 0.15, 'sine', 70); }
  score() { this.impact(); this.cheer(0.48); this.tone(660, 0.16, 0.1); }
  finish() { this.whistle(); this.cheer(0.85); this.tone(220, 0.9, 0.13, 'triangle'); this.tone(330, 1.0, 0.13, 'triangle'); this.tone(440, 1.25, 0.12, 'triangle'); }
  cheer(volume: number) {
    if (!this.context || !this.crowd) return;
    const t = this.context.currentTime; this.crowd.gain.cancelScheduledValues(t); this.crowd.gain.setValueAtTime(this.crowd.gain.value, t);
    this.crowd.gain.linearRampToValueAtTime(volume, t + 0.22); this.crowd.gain.exponentialRampToValueAtTime(0.09, t + 3);
  }
  dispose() { void this.context?.close(); }
}
