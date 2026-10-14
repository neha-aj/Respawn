/* ============================================================================
   Synthesised audio — the same formulas as the Python build, rendered into
   Web Audio buffers. Nothing plays before init() (called from Start); mute
   is absolute (output disconnected + context suspended).
   ============================================================================ */
import type { Sound } from './logic';

const SR = 22050;
const TAU = Math.PI * 2;

function seeded(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

export class VioletAudio {
  private a: AudioContext | null = null;
  private out!: GainNode;
  private buf = new Map<Sound, AudioBuffer>();
  private music: AudioBufferSourceNode | null = null;
  private musicGain!: GainNode;
  muted = false;

  init() {
    if (this.a) { if (!this.muted) void this.a.resume(); return; }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    try {
      const a = (this.a = new Ctx());
      this.out = a.createGain(); this.out.connect(a.destination);
      this.musicGain = a.createGain(); this.musicGain.gain.value = 0.55; this.musicGain.connect(this.out);
      const rnd = seeded(7), nz = () => rnd() * 2 - 1, ex = Math.exp, sin = Math.sin;
      const mk = (dur: number, fn: (t: number) => number) => {
        const n = Math.floor(dur * SR), b = a.createBuffer(1, n, SR), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.max(-1, Math.min(1, fn(i / SR))) * 0.98;
        return b;
      };
      this.buf.set('gun', mk(0.35, (t) => (nz() * ex(-t * 28) * 0.9 + sin(TAU * (90 - 60 * t) * t) * ex(-t * 14)) * 0.9));
      this.buf.set('ping', mk(0.3, (t) => sin(TAU * (2400 - 1500 * t) * t) * ex(-t * 16) * 0.5));
      this.buf.set('zap', mk(0.3, (t) => (((t * (300 + 2400 * t)) % 1) * 2 - 1) * ex(-t * 9) * 0.45));
      this.buf.set('pew', mk(0.22, (t) => sin(TAU * (1500 - 3600 * t) * t) * ex(-t * 12) * 0.35));
      this.buf.set('boom', mk(1.1, (t) => (nz() * ex(-t * 4.5) * 0.8 + sin(TAU * 48 * t) * ex(-t * 3)) * 0.95));
      this.buf.set('hurt', mk(0.4, (t) => (sin(TAU * 110 * t) > 0 ? 1 : -1) * ex(-t * 7) * 0.4));
      this.buf.set('door', mk(1.6, (t) => ([220, 277.2, 329.6, 440].reduce((s, f) => s + sin(TAU * f * t), 0) / 4) * Math.min(1, t * 8) * ex(-t * 1.6)));
      this.buf.set('click', mk(0.06, (t) => sin(TAU * 1800 * t) * ex(-t * 70) * 0.4));
      this.buf.set('empty', mk(0.12, (t) => sin(TAU * 220 * t) * ex(-t * 30) * 0.5));
      this.musicBuffer = this.makeMusic(rnd);
      this.apply();
    } catch { this.a = null; }
  }
  private musicBuffer: AudioBuffer | null = null;

  /** 4-bar ambient cyberpunk loop at 100 BPM: detuned pad, gated bass arpeggio, soft hats. */
  private makeMusic(rnd: () => number): AudioBuffer {
    const a = this.a!, beat = 60 / 100, n = Math.floor(4 * 4 * beat * SR), b = a.createBuffer(1, n, SR), d = b.getChannelData(0);
    const roots = [55, 43.65, 49, 41.2], arp = [1, 1.5, 2, 1.5, 1.2, 1.5, 2, 3];
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, bt = t / beat, r = roots[Math.floor(bt / 4) % 4];
      const pad = ([[4, 0], [4, 0.004], [6, 0], [5, -0.003]] as const).reduce((s, [k, dd]) => s + Math.sin(TAU * r * k * (1 + dd) * t), 0) * 0.06;
      const step = Math.floor(bt * 2) % 8, ph = (bt * 2) % 1, f = r * 2 * arp[step], saw = ((f * t) % 1) * 2 - 1;
      lp += (saw - lp) * 0.08;
      const bass = lp * 0.32 * Math.exp(-ph * 3.5);
      const hat = Math.floor(bt * 4) % 2 ? (rnd() * 2 - 1) * 0.05 * Math.exp(-((bt * 4) % 1) * 22) : 0;
      d[i] = Math.max(-1, Math.min(1, pad + bass + hat)) * 0.92;
    }
    return b;
  }

  play(name: Sound, vol = 1) {
    if (!this.a || this.muted) return;
    const b = this.buf.get(name); if (!b) return;
    const s = this.a.createBufferSource(), g = this.a.createGain();
    s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(this.out); s.start();
  }
  musicOn() {
    if (!this.a || this.music || !this.musicBuffer) return;
    const s = this.a.createBufferSource(); s.buffer = this.musicBuffer; s.loop = true; s.connect(this.musicGain); s.start();
    this.music = s;
  }
  setMuted(m: boolean) { this.muted = m; this.apply(); }
  private apply() {
    const a = this.a; if (!a) return;
    try { this.out.disconnect(); } catch { /* not connected */ }
    if (this.muted) void a.suspend();
    else { this.out.connect(a.destination); void a.resume(); }
  }
  destroy() { try { this.music?.stop(); } catch { /* already stopped */ } this.music = null; if (this.a) void this.a.close(); this.a = null; }
}
