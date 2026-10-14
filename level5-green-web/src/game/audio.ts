/* Synthesised audio — same formulas as green.py. Silent until init() (Begin); mute is absolute. */
import type { Sound } from './sim';

const SR = 22050, TAU = Math.PI * 2;
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

export class GreenAudio {
  private a: AudioContext | null = null;
  private out!: GainNode;
  private buf = new Map<Sound, AudioBuffer>();
  private musicBuf: AudioBuffer | null = null;
  private music: AudioBufferSourceNode | null = null;
  muted = false;

  init() {
    if (this.a) { if (!this.muted) void this.a.resume(); return; }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    try {
      const a = (this.a = new Ctx()); this.out = a.createGain(); this.out.connect(a.destination);
      const rnd = seeded(5), nz = () => rnd() * 2 - 1, ex = Math.exp, sin = Math.sin;
      let lp = 0; const soft = (x: number, k = 0.12) => (lp += (x - lp) * k);
      const mk = (dur: number, fn: (t: number) => number) => { const n = Math.floor(dur * SR), b = a.createBuffer(1, n, SR), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.max(-1, Math.min(1, fn(i / SR))) * 0.92; return b; };
      this.buf.set('step', mk(0.09, (t) => soft(nz(), 0.25) * ex(-t * 45) * 1.6));
      this.buf.set('ring', mk(0.5, (t) => sin(TAU * (95 - 60 * t) * t) * ex(-t * 7) * 0.8));
      this.buf.set('rune', mk(1.6, (t) => [440, 523.3, 659.3, 880].reduce((s, f, k) => s + sin(TAU * f * t) * ex(-t * (2 + k)), 0) / 2.6));
      this.buf.set('seal', mk(0.7, (t) => (sin(TAU * 98 * t) + sin(TAU * 103.8 * t)) * ex(-t * 5) * 0.45));
      this.buf.set('energy', mk(1.6, (t) => (sin(TAU * (200 + 500 * t) * t) * 0.4 + sin(TAU * (300 + 760 * t) * t) * 0.3) * Math.min(1, t * 3) * ex(-t * 0.6)));
      this.buf.set('door', mk(1.5, (t) => ((((t * (90 + 30 * sin(TAU * 3 * t))) % 1) * 2 - 1) * 0.35 + soft(nz(), 0.05) * 1.2) * Math.min(1, t * 6) * ex(-t * 1.4)));
      this.buf.set('warp', mk(2.4, (t) => (sin(TAU * (120 + 500 * t * t) * t) * 0.5 + nz() * 0.12) * Math.min(1, t * 2) * ex(-t * 0.9)));
      this.buf.set('scare', mk(1.1, (t) => (nz() * 0.55 + (((t * (1240 + 300 * sin(TAU * 40 * t))) % 1) - 0.5) * 0.9 + (((t * 1311) % 1) - 0.5) * 0.7) * (0.6 + 0.4 * sin(TAU * 23 * t)) * ex(-t * 1.6)));
      this.buf.set('heart', mk(0.55, (t) => sin(TAU * 52 * t) * (ex(-t * 26) + (t > 0.22 ? ex(-(t - 0.22) * 22) * 0.75 : 0)) * 1.1));
      this.buf.set('whisper', mk(1.3, (t) => soft(nz(), 0.4) * (0.5 + 0.5 * sin(TAU * 7 * t)) * sin((Math.PI * t) / 1.3) * 0.9));
      this.buf.set('click', mk(0.06, (t) => sin(TAU * 1500 * t) * ex(-t * 70) * 0.4));
      this.buf.set('over', mk(2.2, (t) => (sin(TAU * (110 - 40 * t) * t) + 0.6 * sin(TAU * (116 - 44 * t) * t)) * ex(-t * 1.2) * 0.5));
      this.musicBuf = this.makeMusic(rnd);
      this.apply();
    } catch { this.a = null; }
  }

  /** 12 s horror bed: detuned drone with slow swell, filtered wind, sparse bell tones with long decay. */
  private makeMusic(rnd: () => number): AudioBuffer {
    const a = this.a!, n = 12 * SR, k = Math.floor(0.3 * SR), raw = new Float32Array(n);
    const bells = Array.from({ length: 5 }, () => [rnd() * 11, [220, 261.6, 311.1, 329.6, 207.7][Math.floor(rnd() * 5)]]);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, swell = 0.55 + 0.45 * Math.sin((TAU * t) / 12);
      const drone = (Math.sin(TAU * 55 * t) + 0.8 * Math.sin(TAU * 55.35 * t) + 0.35 * Math.sin(TAU * 82.4 * t)) * 0.09 * swell;
      lp += (rnd() * 2 - 1 - lp) * (0.02 + 0.015 * Math.sin((TAU * t) / 4));
      const wind = lp * 0.5 * (0.6 + 0.4 * Math.sin((TAU * t) / 6 + 1));
      let bell = 0; for (const [b0, f] of bells) if (t - b0 >= 0 && t - b0 < 3) bell += Math.sin(TAU * f * (t - b0)) * Math.exp(-(t - b0) * 1.5) * 0.06;
      raw[i] = drone + wind + bell;
    }
    for (let i = 0; i < k; i++) raw[i] = raw[i] * (i / k) + raw[n - k + i] * (1 - i / k);       // crossfade the seam
    const b = a.createBuffer(1, n - k, SR), d = b.getChannelData(0);
    for (let i = 0; i < n - k; i++) d[i] = Math.max(-1, Math.min(1, raw[i]));
    return b;
  }

  play(s: Sound, vol = 1) {
    if (!this.a || this.muted) return; const b = this.buf.get(s); if (!b) return;
    const src = this.a.createBufferSource(), g = this.a.createGain(); src.buffer = b; g.gain.value = vol; src.connect(g); g.connect(this.out); src.start();
  }
  musicOn() {
    if (!this.a || this.music || !this.musicBuf) return;
    const s = this.a.createBufferSource(), g = this.a.createGain(); g.gain.value = 0.7; s.buffer = this.musicBuf; s.loop = true; s.connect(g); g.connect(this.out); s.start(); this.music = s;
  }
  setMuted(m: boolean) { this.muted = m; this.apply(); }
  private apply() {
    const a = this.a; if (!a) return;
    try { this.out.disconnect(); } catch { /* not connected */ }
    if (this.muted) void a.suspend(); else { this.out.connect(a.destination); void a.resume(); }
  }
  destroy() { if (this.a) void this.a.close(); this.a = null; this.music = null; }
}
