/* ============================================================================
   Audio — every sound is synthesised with the Web Audio API (original, no
   files, nothing to go missing). Nothing plays until init() is called from
   the Start Level click. Mute is absolute: output unplugged + context suspended.
   ============================================================================ */

type Ctx = AudioContext;

export class AudioManager {
  private a: Ctx | null = null;
  private out!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private verb!: ConvolverNode;
  private noiseBuf!: AudioBuffer;
  private lp!: BiquadFilterNode;
  private pulseGain!: GainNode;
  private timers: number[] = [];
  private tension = 0;
  muted = false;

  get ready() { return !!this.a; }
  private get live() { return !!this.a && !this.muted; }

  init() {
    if (this.a) { if (!this.muted) void this.a.resume(); return; }
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return;
    try {
      const a = (this.a = new C());
      this.out = a.createGain(); this.out.connect(a.destination);
      this.sfx = a.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.out);
      this.music = a.createGain(); this.music.gain.value = 0; this.music.connect(this.out);
      this.verb = a.createConvolver(); this.verb.buffer = this.impulse(3.2);
      const vg = a.createGain(); vg.gain.value = 0.45; this.verb.connect(vg); vg.connect(this.out);
      this.noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.startAmbience();
      this.apply();
    } catch { this.a = null; }
  }

  setMuted(m: boolean) { this.muted = m; this.apply(); }

  private apply() {
    const a = this.a; if (!a) return;
    this.out.gain.cancelScheduledValues(a.currentTime);
    this.out.gain.setValueAtTime(this.muted ? 0 : 1, a.currentTime);
    try { this.out.disconnect(); } catch { /* not connected */ }
    if (this.muted) void a.suspend();
    else { this.out.connect(a.destination); void a.resume(); }
  }

  destroy() {
    this.timers.forEach((t) => clearTimeout(t)); this.timers = [];
    if (this.a) void this.a.close();
    this.a = null;
  }

  /* ---------------- helpers ---------------- */
  private impulse(sec: number) {
    const a = this.a!, len = Math.floor(a.sampleRate * sec), b = a.createBuffer(2, len, a.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    return b;
  }
  private env(g: GainNode, t: number, peak: number, att: number, dec: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
  }
  private tone(freq: number, type: OscillatorType, peak: number, att: number, dec: number, opts: { to?: number; delay?: number; wet?: number; dest?: AudioNode } = {}) {
    if (!this.live) return;
    const a = this.a!, t = a.currentTime + (opts.delay ?? 0);
    const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + att + dec);
    const g = a.createGain(); this.env(g, t, peak, att, dec);
    o.connect(g); g.connect(opts.dest ?? this.sfx);
    if (opts.wet) { const w = a.createGain(); w.gain.value = opts.wet; g.connect(w); w.connect(this.verb); }
    o.start(t); o.stop(t + att + dec + 0.05);
  }
  private noise(peak: number, att: number, dec: number, filter: BiquadFilterType, freq: number, opts: { q?: number; to?: number; delay?: number; wet?: number } = {}) {
    if (!this.live) return;
    const a = this.a!, t = a.currentTime + (opts.delay ?? 0);
    const s = a.createBufferSource(); s.buffer = this.noiseBuf;
    const f = a.createBiquadFilter(); f.type = filter; f.frequency.setValueAtTime(freq, t); f.Q.value = opts.q ?? 1;
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + att + dec);
    const g = a.createGain(); this.env(g, t, peak, att, dec);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    if (opts.wet) { const w = a.createGain(); w.gain.value = opts.wet; g.connect(w); w.connect(this.verb); }
    s.start(t, Math.random()); s.stop(t + att + dec + 0.05);
  }

  /* ---------------- ambience + music ---------------- */
  private startAmbience() {
    const a = this.a!, t = a.currentTime;
    // muffled ocean: low-passed noise with a slow swell
    const n = a.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const nf = a.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 380;
    const ng = a.createGain(); ng.gain.value = 0.18;
    const lfo = a.createOscillator(); lfo.frequency.value = 0.08;
    const lg = a.createGain(); lg.gain.value = 0.08; lfo.connect(lg); lg.connect(ng.gain);
    n.connect(nf); nf.connect(ng); ng.connect(this.music); n.start(); lfo.start();

    // pad: detuned triangles through a lowpass that opens as tension rises
    this.lp = a.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 520; this.lp.Q.value = 3;
    const pg = a.createGain(); pg.gain.value = 0.07; this.lp.connect(pg); pg.connect(this.music);
    const pw = a.createGain(); pw.gain.value = 0.5; pg.connect(pw); pw.connect(this.verb);
    const chords = [[146.83, 220, 261.63, 329.63], [130.81, 196, 246.94, 293.66], [116.54, 174.61, 220, 293.66], [130.81, 196, 233.08, 311.13]];
    const voices = [0, 1, 2, 3].map(() => {
      const o1 = a.createOscillator(), o2 = a.createOscillator(); o1.type = o2.type = 'triangle'; o2.detune.value = 9;
      o1.connect(this.lp); o2.connect(this.lp); o1.start(); o2.start(); return [o1, o2];
    });
    let ci = 0;
    const nextChord = () => {
      if (!this.a) return;
      const now = this.a.currentTime;
      chords[ci % chords.length].forEach((f, i) => voices[i].forEach((o) => o.frequency.setTargetAtTime(f, now, 1.2)));
      ci++;
      this.timers.push(window.setTimeout(nextChord, 7000));
    };
    nextChord();

    // tension pulse: a low heartbeat whose rate and level follow the clock
    this.pulseGain = a.createGain(); this.pulseGain.gain.value = 0; this.pulseGain.connect(this.music);
    const beat = () => {
      if (!this.a) return;
      if (this.tension > 0.55 && !this.muted) {
        const now = this.a.currentTime;
        [0, 0.16].forEach((d, i) => {
          const o = this.a!.createOscillator(); o.frequency.setValueAtTime(62, now + d); o.frequency.exponentialRampToValueAtTime(38, now + d + 0.2);
          const g = this.a!.createGain(); this.env(g, now + d, i ? 0.35 : 0.5, 0.01, 0.22); o.connect(g); g.connect(this.pulseGain);
          o.start(now + d); o.stop(now + d + 0.3);
        });
      }
      this.timers.push(window.setTimeout(beat, this.tension > 0.85 ? 520 : 900));
    };
    beat();

    // distant whale-like bells, sparse
    const bell = () => {
      if (!this.a) return;
      const notes = [293.66, 349.23, 392, 440, 523.25];
      this.tone(notes[Math.floor(Math.random() * notes.length)], 'sine', 0.05, 0.4, 3.2, { wet: 0.9, dest: this.music });
      this.timers.push(window.setTimeout(bell, 5000 + Math.random() * 6000));
    };
    this.timers.push(window.setTimeout(bell, 3000));

    this.music.gain.setValueAtTime(0, t);
    this.music.gain.linearRampToValueAtTime(0.55, t + 4);
  }

  /** 0 = calm, 1 = final seconds. Opens the pad filter and drives the heartbeat. */
  setTension(v: number) {
    this.tension = Math.max(0, Math.min(1, v));
    if (this.a && this.lp) {
      this.lp.frequency.setTargetAtTime(520 + this.tension * 1400, this.a.currentTime, 0.8);
      this.pulseGain.gain.setTargetAtTime(this.tension > 0.55 ? 0.6 : 0, this.a.currentTime, 0.5);
    }
  }

  /* ---------------- sound effects ---------------- */
  click() { this.tone(1400, 'sine', 0.12, 0.002, 0.05, { to: 900 }); this.noise(0.05, 0.001, 0.03, 'highpass', 4000); }
  softClick() { this.tone(900, 'sine', 0.08, 0.002, 0.04, { to: 700 }); }
  key() { this.tone(1800 + Math.random() * 300, 'square', 0.025, 0.001, 0.025); }
  bubble() { const f = 400 + Math.random() * 500; this.tone(f, 'sine', 0.07, 0.005, 0.09, { to: f * 2.4, wet: 0.3 }); }
  footstep() { this.noise(0.12, 0.004, 0.09, 'lowpass', 260, { q: 2 }); this.tone(90, 'sine', 0.12, 0.003, 0.08, { to: 55 }); }
  land() { this.noise(0.2, 0.004, 0.16, 'lowpass', 220); this.tone(70, 'sine', 0.2, 0.004, 0.14, { to: 40 }); }
  interact() { this.tone(620, 'triangle', 0.08, 0.004, 0.12, { to: 880 }); this.bubble(); }
  correct() { [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 'sine', 0.12, 0.01, 0.7, { delay: i * 0.08, wet: 0.6 })); }
  wrong() { this.tone(180, 'sine', 0.18, 0.01, 0.35, { to: 90 }); this.noise(0.12, 0.01, 0.3, 'lowpass', 500, { to: 150 }); setTimeout(() => this.bubble(), 120); }
  creak() { this.noise(0.08, 0.05, 0.4, 'bandpass', 700, { q: 8, to: 420 }); }
  block() { this.tone(300 + Math.random() * 80, 'triangle', 0.08, 0.002, 0.06, { to: 180 }); }
  switchOn(step: number) { this.tone(110, 'sine', 0.3, 0.004, 0.18, { to: 60 }); this.tone([392, 493.88, 587.33][step] ?? 392, 'sine', 0.12, 0.01, 0.9, { delay: 0.05, wet: 0.7 }); }
  doorUnlock() {
    this.noise(0.35, 0.05, 1.4, 'lowpass', 180, { q: 1 });
    this.tone(55, 'sawtooth', 0.12, 0.1, 1.3, { to: 80 });
    [0.0, 0.25, 0.5].forEach((d) => this.tone(240, 'square', 0.05, 0.002, 0.05, { delay: d }));
    this.tone(784, 'sine', 0.1, 0.02, 1.4, { delay: 0.6, wet: 0.8 });
  }
  /* Levels 3–4 */
  select() { this.tone(760, 'sine', 0.09, 0.003, 0.08, { to: 1140 }); }
  zoom(inward: boolean) { this.noise(0.06, 0.02, 0.18, 'bandpass', inward ? 900 : 2200, { q: 4, to: inward ? 2200 : 900 }); }
  trace() { this.tone(1320, 'triangle', 0.035, 0.002, 0.05); }
  eliminate() { this.tone(240, 'square', 0.04, 0.002, 0.06, { to: 160 }); this.noise(0.04, 0.001, 0.04, 'highpass', 3000); }
  segment() { this.tone(980 + Math.random() * 120, 'sine', 0.06, 0.002, 0.05); }
  powerDown() {
    this.tone(440, 'sawtooth', 0.06, 0.02, 2.4, { to: 55, wet: 0.5 });
    this.noise(0.2, 0.1, 2.6, 'lowpass', 1200, { to: 90 });
  }
  sonar(urgent = false) { this.tone(urgent ? 1320 : 1040, 'sine', urgent ? 0.14 : 0.1, 0.005, urgent ? 0.5 : 0.8, { wet: 0.9 }); }
  fail() {
    this.noise(0.4, 0.3, 2.2, 'lowpass', 1600, { to: 120, wet: 0.5 });
    this.tone(220, 'sine', 0.2, 0.05, 1.8, { to: 55 });
    for (let i = 0; i < 6; i++) setTimeout(() => this.bubble(), 200 + i * 140);
  }
  victory() {
    [392, 493.88, 587.33, 783.99, 987.77].forEach((f, i) => this.tone(f, 'sine', 0.13, 0.01, 1.2, { delay: i * 0.12, wet: 0.7 }));
    this.tone(196, 'triangle', 0.1, 0.05, 2.2, { wet: 0.6 });
  }
}
