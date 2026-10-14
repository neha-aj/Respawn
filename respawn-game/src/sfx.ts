/* Transition sounds, synthesised with Web Audio so there are no files to load.
 * Kept quiet and short: they sit between levels, they don't compete with them.
 * Each spectrum band rings one note of an ascending scale, so by RED the player has
 * heard the whole run climb, V → R.
 */

// C major from C5: V I B G Y O R
const BAND_NOTES = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77];

class Sfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private echo: DelayNode | null = null;

  /** Created lazily; resumes if the browser started it suspended. */
  private ac(): AudioContext | null {
    if (!this.ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      const ctx = new C();
      const out = ctx.createGain(); out.gain.value = 0.55; out.connect(ctx.destination);
      // one soft feedback echo shared by the chimes
      const echo = ctx.createDelay(1); echo.delayTime.value = 0.27;
      const fb = ctx.createGain(); fb.gain.value = 0.32;
      const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 2600;
      echo.connect(damp); damp.connect(fb); fb.connect(echo); damp.connect(out);
      this.ctx = ctx; this.out = out; this.echo = echo;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private noise(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; return src;
  }

  private env(ctx: AudioContext, t: number, peak: number, attack: number, decay: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  /** A bell: fundamental plus two inharmonic partials, into the echo. */
  private bell(freq: number, at: number, peak = 0.22, decay = 1.8) {
    const ctx = this.ac(); if (!ctx || !this.out || !this.echo) return;
    const t = ctx.currentTime + at;
    for (const [mult, amp] of [[1, 1], [2.76, 0.28], [5.4, 0.09]] as const) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * mult;
      const g = this.env(ctx, t, peak * amp, 0.006, decay / mult ** 0.5);
      o.connect(g); g.connect(this.out); g.connect(this.echo);
      o.start(t); o.stop(t + decay + 0.1);
    }
  }

  /** Iris closing: a low, soft "whoomp" falling away. */
  irisClose() {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.75);
    const g = this.env(ctx, t, 0.28, 0.03, 0.8);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.9);
    const n = this.noise(ctx, 0.8), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.7);
    const ng = this.env(ctx, t, 0.07, 0.05, 0.65);
    n.connect(f); f.connect(ng); ng.connect(this.out); n.start(t);
  }

  /** Iris opening: an airy rising sweep. */
  irisOpen() {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime;
    const n = this.noise(ctx, 1.2), f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.6;
    f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(4200, t + 1.0);
    const g = this.env(ctx, t, 0.12, 0.45, 0.6);
    n.connect(f); f.connect(g); g.connect(this.out); n.start(t);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(540, t + 0.9);
    const og = this.env(ctx, t, 0.05, 0.4, 0.55);
    o.connect(og); og.connect(this.out); o.start(t); o.stop(t + 1.1);
  }

  /** A spectrum band lights up: its note, with a little shimmer on top. */
  ignite(band: number) {
    this.bell(BAND_NOTES[band] ?? BAND_NOTES[0], 0, 0.22, 2.2);
    this.bell((BAND_NOTES[band] ?? BAND_NOTES[0]) * 2, 0.09, 0.05, 1.2);
  }

  /** Every band lit: the whole scale rolls up, then rings out together. */
  spectrumComplete() {
    BAND_NOTES.forEach((f, i) => this.bell(f, i * 0.11, 0.13, 1.4));
    [BAND_NOTES[0], BAND_NOTES[2], BAND_NOTES[4], BAND_NOTES[0] * 2].forEach((f) => this.bell(f, 0.95, 0.12, 3.2));
  }

  /** Short confirm blip (continue / skip). */
  blip() {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1320, t + 0.05);
    const g = this.env(ctx, t, 0.04, 0.005, 0.12);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.2);
  }
}

export const sfx = new Sfx();
