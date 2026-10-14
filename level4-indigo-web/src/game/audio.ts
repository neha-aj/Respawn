/* Synthesised audio — same formulas as indigo.py. Silent until init() (Start); mute is absolute. */
import type { Sound } from './sim';

const SR = 22050, TAU = Math.PI * 2;
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

export class IndigoAudio {
  private a: AudioContext | null = null;
  private out!: GainNode;
  private buf = new Map<Sound, AudioBuffer>();
  private musicBuf: AudioBuffer | null = null;
  private music: AudioBufferSourceNode | null = null;
  private engineGain: GainNode | null = null;
  muted = false;

  init() {
    if (this.a) { if (!this.muted) void this.a.resume(); return; }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    try {
      const a = (this.a = new Ctx()); this.out = a.createGain(); this.out.connect(a.destination);
      const rnd = seeded(11), nz = () => rnd() * 2 - 1, ex = Math.exp, sin = Math.sin;
      const mk = (dur: number, fn: (t: number) => number) => { const n = Math.floor(dur * SR), b = a.createBuffer(1, n, SR), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.max(-1, Math.min(1, fn(i / SR))) * 0.92; return b; };
      this.buf.set('gun', mk(0.3, (t) => (nz() * ex(-t * 30) * 0.7 + sin(TAU * (180 - 120 * t) * t) * ex(-t * 12)) * 0.8));
      this.buf.set('strike', mk(0.5, (t) => ([620, 931, 1312].reduce((s, f) => s + sin(TAU * f * t), 0) / 3) * ex(-t * 7) * 0.6));
      this.buf.set('ricochet', mk(0.35, (t) => sin(TAU * (2600 - 2000 * t) * t) * ex(-t * 11) * 0.45));
      this.buf.set('zap', mk(0.4, (t) => (((t * (240 + 1800 * t)) % 1) * 2 - 1) * ex(-t * 7) * 0.5));
      this.buf.set('boom', mk(1.4, (t) => (nz() * ex(-t * 3.2) * 0.85 + sin(TAU * 42 * t) * ex(-t * 2.4)) * 0.95));
      this.buf.set('alarm', mk(0.25, (t) => sin(TAU * 880 * t) * ((t * 16) % 2 < 1 ? 1 : 0) * ex(-t * 4) * 0.25));
      this.buf.set('chime', mk(1.2, (t) => [523.3, 659.3, 784, 1046.5].reduce((s, f, k) => s + sin(TAU * f * t) * ex(-t * (3 + k)), 0) / 3));
      this.buf.set('warp', mk(2.4, (t) => (sin(TAU * (120 + 500 * t * t) * t) * 0.5 + nz() * 0.15) * Math.min(1, t * 2) * ex(-t * 0.9)));
      this.buf.set('click', mk(0.06, (t) => sin(TAU * 1700 * t) * ex(-t * 70) * 0.4));
      this.buf.set('empty', mk(0.12, (t) => sin(TAU * 200 * t) * ex(-t * 30) * 0.5));
      // looping engine rumble whose gain follows the thrust key
      const eng = mk(1.0, (t) => (nz() * 0.6 + sin(TAU * 55 * t) * 0.4) * 0.35), es = a.createBufferSource(), eg = a.createGain();
      es.buffer = eng; es.loop = true; eg.gain.value = 0; es.connect(eg); eg.connect(this.out); es.start(); this.engineGain = eg;
      this.musicBuf = this.makeMusic();
      this.apply();
    } catch { this.a = null; }
  }

  /** Ambient space loop, 80 BPM: minor-9 pad with slow swells + sparse cyber arpeggio with echo. */
  private makeMusic(): AudioBuffer {
    const a = this.a!, beat = 60 / 80, n = Math.floor(16 * beat * SR), b = a.createBuffer(1, n, SR), d = b.getChannelData(0);
    const chords: [number, number[]][] = [[55, [1, 1.189, 1.498, 1.782, 2.245]], [43.65, [1, 1.189, 1.498, 1.782, 2.245]], [49, [1, 1.26, 1.498, 1.888, 2.245]], [41.2, [1, 1.189, 1.498, 2, 2.378]]];
    const arp = [2, 3, 4, 3, 2, 4, 3, 1], delay = Math.floor(beat * 0.75 * SR);
    for (let i = 0; i < n; i++) {
      const t = i / SR, bt = t / beat, [root, iv] = chords[Math.floor(bt / 4) % 4], swell = 0.5 + 0.5 * Math.sin((TAU * t) / (beat * 8));
      const pad = iv.reduce((s, r) => s + Math.sin(TAU * root * 4 * r * t) + 0.5 * Math.sin(TAU * root * 4 * r * 1.003 * t), 0) * 0.022 * (0.6 + 0.4 * swell);
      const st = Math.floor(bt * 2) % 8, ph = (bt * 2) % 1;
      const note = st % 2 === 0 || st === 5 ? Math.sin(TAU * root * 8 * iv[arp[st]] * t) * Math.exp(-ph * 5) * 0.09 : 0;
      d[i] = pad + note + (i >= delay ? d[i - delay] * 0.38 : 0);
    }
    for (let i = 0; i < n; i++) d[i] = Math.max(-1, Math.min(1, d[i]));
    return b;
  }

  play(s: Sound, vol = 1) {
    if (!this.a || this.muted) return; const b = this.buf.get(s); if (!b) return;
    const src = this.a.createBufferSource(), g = this.a.createGain(); src.buffer = b; g.gain.value = vol; src.connect(g); g.connect(this.out); src.start();
  }
  musicOn() {
    if (!this.a || this.music || !this.musicBuf) return;
    const s = this.a.createBufferSource(), g = this.a.createGain(); g.gain.value = 0.55; s.buffer = this.musicBuf; s.loop = true; s.connect(g); g.connect(this.out); s.start(); this.music = s;
  }
  engine(on: boolean) { if (this.a && this.engineGain) this.engineGain.gain.setTargetAtTime(on ? 0.35 : 0, this.a.currentTime, 0.05); }
  setMuted(m: boolean) { this.muted = m; this.apply(); }
  private apply() {
    const a = this.a; if (!a) return;
    try { this.out.disconnect(); } catch { /* not connected */ }
    if (this.muted) void a.suspend(); else { this.out.connect(a.destination); void a.resume(); }
  }
  destroy() { if (this.a) void this.a.close(); this.a = null; this.music = null; this.engineGain = null; }
}
