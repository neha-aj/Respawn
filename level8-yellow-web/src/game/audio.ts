/* Synthesised audio — same formulas as yellow.py. Silent until init(); mute is absolute.
 * Music: an original 140 BPM battle loop in D minor (toms, galloping bass, brass-like stabs, a lead). */
import type { Sound } from './sim';

const SR = 22050, TAU = Math.PI * 2;
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mf = (m: number) => 440 * 2 ** ((m - 69) / 12);
const saw = (x: number) => (x % 1) * 2 - 1;

export class YellowAudio {
  private a: AudioContext | null = null;
  private out!: GainNode;
  private buf = new Map<Sound | 'charge', AudioBuffer>();
  private musicBuf: AudioBuffer | null = null; private music: AudioBufferSourceNode | null = null;
  private chargeSrc: AudioBufferSourceNode | null = null;
  muted = false;

  init() {
    if (this.a) { if (!this.muted) void this.a.resume(); return; }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    try {
      const a = (this.a = new Ctx()); this.out = a.createGain(); this.out.connect(a.destination);
      const rnd = seeded(5), nz = () => rnd() * 2 - 1, ex = Math.exp, sin = Math.sin;
      let lp = 0; const soft = (x: number, k: number) => (lp += (x - lp) * k);
      const mk = (dur: number, fn: (t: number) => number) => { const n = Math.floor(dur * SR), b = a.createBuffer(1, n, SR), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.max(-1, Math.min(1, fn(i / SR))) * 0.92; return b; };
      const set = (k: Sound | 'charge', dur: number, fn: (t: number) => number) => this.buf.set(k, mk(dur, fn));
      set('jab', 0.14, (t) => soft(nz(), 0.3) * ex(-t * 30) * 1.2);
      set('sword', 0.35, (t) => soft(nz(), 0.15 + 0.5 * t) * Math.min(1, t * 20) * ex(-t * 9) * 1.3);
      set('hit', 0.2, (t) => (sin(TAU * (180 - 300 * t) * t) * 0.8 + nz() * 0.5 * ex(-t * 40)) * ex(-t * 16));
      set('heavyhit', 0.45, (t) => (sin(TAU * (120 - 120 * t) * t) + nz() * 0.6 * ex(-t * 25) + sin(TAU * 940 * t) * 0.2 * ex(-t * 12)) * ex(-t * 7) * 0.9);
      set('dodge', 0.25, (t) => soft(nz(), 0.05 + 0.6 * t) * sin((Math.PI * t) / 0.25) * 1.5);
      set('jump', 0.12, (t) => sin(TAU * (220 + 500 * t) * t) * ex(-t * 25) * 0.3);
      set('charge', 1.0, (t) => sin(TAU * 110 * t) * 0.3 + sin(TAU * 220 * t * (1 + 0.003 * sin(TAU * 6 * t))) * 0.25 + nz() * 0.05);
      set('brace', 0.4, (t) => sin(TAU * (300 + 900 * t) * t) * Math.min(1, t * 10) * 0.4);
      set('flash', 1.4, (t) => (sin(TAU * (60 + 40 * ex(-t * 5)) * t) * 0.8 + nz() * 0.6 * ex(-t * 6) + sin(TAU * 1320 * t) * 0.15 * ex(-t * 3)) * ex(-t * 2));
      set('stun', 0.6, (t) => sin(TAU * (600 + 120 * sin(TAU * 10 * t)) * t) * 0.3 * ex(-t * 3));
      set('growl', 0.5, (t) => saw(t * (70 + 20 * sin(TAU * 8 * t))) * 0.35 * Math.min(1, t * 8) * ex(-t * 2));
      set('ko', 1.2, (t) => (sin(TAU * (200 - 140 * t) * t) * 0.6 + nz() * 0.3 * ex(-t * 4)) * ex(-t * 2.2));
      set('crack', 0.3, (t) => nz() * ex(-t * 30) * 0.9 + sin(TAU * 1800 * t) * ex(-t * 40) * 0.2);
      set('shatter', 1.3, (t) => (nz() * 0.7 + [1200, 1700, 2300].reduce((s, f) => s + sin(TAU * f * t), 0) * 0.12) * ex(-t * 3));
      set('slide', 1.6, (t) => (soft(nz(), 0.04) * 1.5 + sin(TAU * 45 * t) * 0.3) * Math.min(1, t * 4) * ex(-t * 0.9));
      set('portal', 1.6, (t) => (sin(TAU * (180 + 400 * t) * t) * 0.35 + sin(TAU * 270 * t) * 0.2) * Math.min(1, t * 3) * ex(-t * 1.2));
      set('win', 2.2, (t) => [[261.6, 0], [329.6, 0.14], [392, 0.28], [523.3, 0.42]].reduce((s, [f, d]) => s + (t >= d ? saw(t * f) * ex(-(t - d) * 1.6) : 0), 0) * 0.16);
      set('lose', 1.8, (t) => (saw(t * 196) + saw(t * 185)) * 0.15 * ex(-t * 1.3));
      set('fight', 0.6, (t) => (saw(t * 220) + saw(t * 330)) * 0.2 * ex(-t * 4));
      set('click', 0.05, (t) => sin(TAU * 1700 * t) * ex(-t * 70) * 0.4);
      this.musicBuf = this.makeMusic();
      this.apply();
    } catch { this.a = null; }
  }

  private makeMusic() {
    const a = this.a!, beat = 60 / 140, n = Math.floor(32 * beat * SR), buf = new Float32Array(n), rnd = seeded(2);
    const add = (start: number, dur: number, fn: (t: number) => number) => { const s0 = Math.floor(start * SR), e = Math.min(n, s0 + Math.floor(dur * SR)); for (let i = s0; i < e; i++) buf[i] += fn((i - s0) / SR); };
    const roots = [38, 38, 34, 36, 38, 38, 41, 40];
    for (let b = 0; b < 32; b++) {
      const t0 = b * beat;
      add(t0, 0.25, (t) => Math.sin(TAU * (50 + 70 * Math.exp(-t * 28)) * t) * Math.exp(-t * 10) * 0.5);
      if (b % 2) add(t0, 0.15, (t) => (rnd() * 2 - 1) * Math.exp(-t * 25) * 0.22);
      for (const k of [0.5, 0.75]) add(t0 + beat * k, 0.18, (t) => Math.sin(TAU * (140 - 60 * t) * t) * Math.exp(-t * 14) * 0.18);
    }
    roots.forEach((r, bar) => {
      for (let e = 0; e < 8; e++) { const f = mf(r + (e === 3 || e === 6 ? 7 : 0)); add(bar * 4 * beat + (e * beat) / 2, 0.2, (t) => saw(t * f) * 0.16 * Math.exp(-t * 9)); }
      for (const m of [r + 24, r + 27, r + 31]) { const f = mf(m); for (const st of [0, 2.5]) add(bar * 4 * beat + st * beat, 0.35, (t) => (saw(t * f) + saw(t * f * 1.004)) * 0.035 * Math.min(1, t * 60) * Math.exp(-t * 5)); }
    });
    const lead = [[0, 1.5, 74], [1.5, .5, 72], [2, 2, 69], [4, 1, 70], [5, 1, 72], [6, 2, 74], [8, 1.5, 77], [9.5, .5, 76], [10, 2, 74], [12, 4, 72],
      [16, 1.5, 74], [17.5, .5, 72], [18, 2, 69], [20, 1, 70], [21, 1, 72], [22, 2, 74], [24, 1, 77], [25, 1, 79], [26, 2, 81], [28, 4, 76]];
    for (const [b0, d, m] of lead) { const f = mf(m), dd = d * beat; add(b0 * beat, dd, (t) => saw(t * f) * 0.06 * Math.min(1, t * 30) * Math.min(1, (dd - t) * 20) * (0.8 + 0.2 * Math.sin(TAU * 5 * t))); }
    let lp = 0, peak = 1e-6;
    for (let i = 0; i < n; i++) { lp += (buf[i] - lp) * 0.5; buf[i] = lp; peak = Math.max(peak, Math.abs(lp)); }
    const out = a.createBuffer(1, n, SR), d = out.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (buf[i] / peak) * 0.9;
    return out;
  }

  play(s: Sound, vol = 1) {
    if (!this.a || this.muted) return; const b = this.buf.get(s); if (!b) return;
    const src = this.a.createBufferSource(), g = this.a.createGain(); src.buffer = b; g.gain.value = vol; src.connect(g); g.connect(this.out); src.start();
  }
  charge(on: boolean) {
    if (!this.a) return;
    if (on && !this.chargeSrc && !this.muted) {
      const s = this.a.createBufferSource(), g = this.a.createGain(); g.gain.value = 0.35; s.buffer = this.buf.get('charge')!; s.loop = true; s.connect(g); g.connect(this.out); s.start(); this.chargeSrc = s;
    } else if (!on && this.chargeSrc) { try { this.chargeSrc.stop(); } catch { /* already stopped */ } this.chargeSrc = null; }
  }
  musicOn(on: boolean) {
    if (!this.a) return;
    if (!on) { try { this.music?.stop(); } catch { /* already stopped */ } this.music = null; return; }
    if (this.music || !this.musicBuf) return;
    const s = this.a.createBufferSource(), g = this.a.createGain(); g.gain.value = 0.45; s.buffer = this.musicBuf; s.loop = true; s.connect(g); g.connect(this.out); s.start(); this.music = s;
  }
  setMuted(m: boolean) { this.muted = m; this.apply(); }
  private apply() {
    const a = this.a; if (!a) return;
    try { this.out.disconnect(); } catch { /* not connected */ }
    if (this.muted) void a.suspend(); else { this.out.connect(a.destination); void a.resume(); }
  }
  destroy() { if (this.a) void this.a.close(); this.a = null; this.music = null; this.chargeSrc = null; }
}
