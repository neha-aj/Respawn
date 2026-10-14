/* Synthesised audio — same formulas as orange.py. Silent until init(); mute is absolute.
 * Music: an original 120 BPM superhero-disco loop (not the Marvel theme, which is copyrighted). */
import { BEAT } from './config';
import type { Sound } from './sim';

const SR = 22050, TAU = Math.PI * 2;
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mf = (m: number) => 440 * 2 ** ((m - 69) / 12);

export class OrangeAudio {
  private a: AudioContext | null = null;
  private out!: GainNode;
  private buf = new Map<Sound, AudioBuffer>();
  private keys: AudioBuffer[] = [];
  private musicBuf: AudioBuffer | null = null;
  private music: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  muted = false;

  init() {
    if (this.a) { if (!this.muted) void this.a.resume(); return; }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    try {
      const a = (this.a = new Ctx()); this.out = a.createGain(); this.out.connect(a.destination);
      const rnd = seeded(7), nz = () => rnd() * 2 - 1, ex = Math.exp, sin = Math.sin;
      const mk = (dur: number, fn: (t: number) => number) => { const n = Math.floor(dur * SR), b = a.createBuffer(1, n, SR), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.max(-1, Math.min(1, fn(i / SR))) * 0.92; return b; };
      for (const m of [69, 72, 74, 76, 79, 81, 84, 86, 88, 91]) {               // a pentatonic pluck per keystroke
        const f = mf(m); this.keys.push(mk(0.16, (t) => (sin(TAU * f * t) > 0 ? 1 : -1) * 0.22 * ex(-t * 22) + sin(TAU * f * 2 * t) * 0.2 * ex(-t * 30)));
      }
      const saw = (x: number) => (x % 1) * 2 - 1;
      this.buf.set('wrong', mk(0.22, (t) => (saw(t * 92) + saw(t * 97)) * 0.3 * ex(-t * 14)));
      this.buf.set('word', mk(0.45, (t) => [[880, 0], [1108.7, 0.05], [1318.5, 0.1]].reduce((s, [f, d]) => s + (t >= d ? sin(TAU * f * t) * ex(-(t - d) * 9) : 0), 0) * 0.3 + nz() * 0.15 * ex(-t * 18)));
      this.buf.set('cheer', mk(1.1, (t) => nz() * (0.5 + 0.3 * sin(TAU * 9 * t)) * Math.min(1, t * 8) * ex(-t * 2.2) * 0.45));
      this.buf.set('pace', mk(0.9, (t) => [[523.3, 0], [659.3, 0.12], [784, 0.24], [1046.5, 0.36]].reduce((s, [f, d]) => s + (t >= d ? saw(t * f) * ex(-(t - d) * 4) : 0), 0) * 0.18));
      this.buf.set('tick', mk(0.12, (t) => sin(TAU * 1200 * t) * ex(-t * 30) * 0.5));
      this.buf.set('go', mk(0.7, (t) => (sin(TAU * (900 + 400 * Math.min(1, t * 4)) * t) * 0.4 + sin(TAU * 440 * t) * 0.25) * ex(-t * 3)));
      this.buf.set('fail', mk(1.8, (t) => [233.1, 233.8].reduce((s, f) => s + saw(t * f * (1 - 0.06 * Math.floor(t / 0.42))), 0) * 0.16 * (0.6 + 0.4 * sin(TAU * 6 * t)) * ex(-t * 0.9)));
      this.buf.set('win', mk(1.6, (t) => [[392, 0], [523.3, 0.16], [659.3, 0.32], [784, 0.48], [1046.5, 0.64]].reduce((s, [f, d]) => s + (t >= d ? saw(t * f) * ex(-(t - d) * 2.2) : 0), 0) * 0.16));
      this.buf.set('slide', mk(2.4, (t) => (nz() * 0.5 + sin(TAU * 48 * t)) * 0.35 * Math.min(1, t * 3) * ex(-t * 0.8)));
      this.buf.set('portal', mk(2.6, (t) => (sin(TAU * (150 + 600 * t * t) * t) * 0.4 + nz() * 0.1) * Math.min(1, t * 2) * ex(-t * 0.9)));
      this.buf.set('snap', mk(0.9, (t) => nz() * ex(-t * 90) * 0.9 + sin(TAU * 2200 * t) * ex(-t * 60) * 0.3 + nz() * 0.08 * ex(-t * 3)));
      this.buf.set('click', mk(0.05, (t) => sin(TAU * 1700 * t) * ex(-t * 70) * 0.4));
      this.musicBuf = this.makeMusic();
      this.apply();
    } catch { this.a = null; }
  }

  /** 8 bars: four-on-the-floor kick, claps, hats, octave disco bass, a heroic brass-style lead and a soft pad. */
  private makeMusic(): AudioBuffer {
    const a = this.a!, n = Math.floor(32 * BEAT * SR), buf = new Float32Array(n), rnd = seeded(3), nz = () => rnd() * 2 - 1;
    const add = (start: number, dur: number, fn: (t: number) => number) => { const s0 = Math.floor(start * SR), e = Math.min(n, s0 + Math.floor(dur * SR)); for (let i = s0; i < e; i++) buf[i] += fn((i - s0) / SR); };
    const chords: [number, number[]][] = [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]], [45, [57, 60, 64]], [41, [57, 60, 65]], [43, [55, 59, 62]], [40, [56, 59, 64]]];
    for (let b = 0; b < 32; b++) {
      const t0 = b * BEAT;
      add(t0, 0.3, (t) => Math.sin(TAU * (45 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9) * 0.55);
      if (b % 2 === 1) add(t0, 0.18, (t) => nz() * Math.exp(-t * 22) * 0.28);
      add(t0 + BEAT / 2, 0.05, (t) => nz() * Math.exp(-t * 80) * 0.14);
      add(t0 + BEAT * 0.75, 0.03, (t) => nz() * Math.exp(-t * 120) * 0.06);
    }
    chords.forEach(([root, tones], bar) => {
      for (let e = 0; e < 8; e++) { const f = mf(root + (e % 2 ? 12 : 0)); add(bar * 4 * BEAT + (e * BEAT) / 2, 0.2, (t) => (Math.sin(TAU * f * t) + 0.35 * (Math.sin(TAU * f * t) > 0 ? 1 : -1)) * Math.exp(-t * 7) * 0.24); }
      for (const m of tones) { const f = mf(m); add(bar * 4 * BEAT, 4 * BEAT, (t) => Math.sin(TAU * f * t) * 0.05 * Math.min(1, t * 4) * Math.min(1, (4 * BEAT - t) * 4)); }
    });
    const melody = [[0, .5, 69], [.5, .5, 69], [1, 1.5, 76], [2.5, .5, 74], [3, 1, 72], [4, .5, 72], [4.5, .5, 74], [5, 1.5, 77], [6.5, .5, 76], [7, 1, 72],
      [8, .5, 76], [8.5, .5, 76], [9, 1.5, 79], [10.5, .5, 77], [11, 1, 76], [12, 1, 74], [13, 1, 71], [14, 2, 74],
      [16, .5, 69], [16.5, .5, 72], [17, .5, 76], [17.5, 1.5, 81], [19, 1, 79], [20, 1.5, 77], [21.5, .5, 76], [22, 1, 72], [23, 1, 69],
      [24, .5, 71], [24.5, .5, 74], [25, 1.5, 79], [26.5, .5, 77], [27, 1, 74], [28, 1, 76], [29, 1, 80], [30, 2, 83]];
    for (const [beat, dur, m] of melody) {
      const f = mf(m), d = dur * BEAT;
      add(beat * BEAT, d, (t) => {
        const v = f * (1 + 0.004 * Math.sin(TAU * 5.5 * t) * Math.min(1, t * 3));
        const s = ((t * v) % 1) * 2 - 1 + (((t * v * 1.005) % 1) * 2 - 1) * 0.6;
        return s * 0.085 * Math.min(1, t * 40) * (0.75 + 0.25 * Math.exp(-t * 6)) * Math.min(1, (d - t) * 25);
      });
    }
    let lp = 0, peak = 0;
    for (let i = 0; i < n; i++) { lp += (buf[i] - lp) * 0.55; buf[i] = lp; peak = Math.max(peak, Math.abs(lp)); }
    const out = a.createBuffer(1, n, SR), d = out.getChannelData(0), k = 0.92 / Math.max(peak, 1e-6);
    for (let i = 0; i < n; i++) d[i] = buf[i] * k;
    return out;
  }

  play(s: Sound, vol = 1) {
    if (!this.a || this.muted) return; const b = this.buf.get(s); if (!b) return;
    const src = this.a.createBufferSource(), g = this.a.createGain(); src.buffer = b; g.gain.value = vol; src.connect(g); g.connect(this.out); src.start();
  }
  key(i: number) {
    if (!this.a || this.muted || !this.keys.length) return;
    const src = this.a.createBufferSource(); src.buffer = this.keys[i % this.keys.length]; src.connect(this.out); src.start();
  }
  musicCmd(cmd: 'on' | 'pause' | 'resume' | 'stop') {
    if (!this.a) return;
    if (cmd === 'stop' || cmd === 'on') { try { this.music?.stop(); } catch { /* already stopped */ } this.music = null; }
    if (cmd === 'on' && this.musicBuf) {
      const s = this.a.createBufferSource(), g = this.a.createGain(); g.gain.value = 0.55; s.buffer = this.musicBuf; s.loop = true; s.connect(g); g.connect(this.out); s.start();
      this.music = s; this.musicGain = g;
    }
    if (this.musicGain && (cmd === 'pause' || cmd === 'resume')) this.musicGain.gain.setTargetAtTime(cmd === 'pause' ? 0 : 0.55, this.a.currentTime, 0.03);
  }
  setMuted(m: boolean) { this.muted = m; this.apply(); }
  private apply() {
    const a = this.a; if (!a) return;
    try { this.out.disconnect(); } catch { /* not connected */ }
    if (this.muted) void a.suspend(); else { this.out.connect(a.destination); void a.resume(); }
  }
  destroy() { if (this.a) void this.a.close(); this.a = null; this.music = null; }
}
