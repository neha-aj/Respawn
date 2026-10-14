/* Guarded synthesized audio. Every call is a no-op if Web Audio is unavailable or blocked — the game never depends on it.
 * Hooks: bonk (death), nope (a hidden trap springs), tick (control shift), win; plus jump, door, click and a dark ambient loop. */
const SR = 22050, TAU = Math.PI * 2;

export class RedAudio {
  constructor() { this.a = null; this.buf = new Map(); this.music = null; this.muted = false; this.out = null; }

  init() {
    try {
      if (this.a) { if (!this.muted) void this.a.resume(); return; }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const a = (this.a = new Ctx());
      this.out = a.createGain(); this.out.connect(a.destination);
      let seed = 9; const nz = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed / 4294967296) * 2 - 1; };
      const ex = Math.exp, sin = Math.sin;
      const mk = (dur, fn) => { const n = Math.floor(dur * SR), b = a.createBuffer(1, n, SR), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.max(-1, Math.min(1, fn(i / SR))) * 0.9; return b; };
      this.buf.set('bonk', mk(0.7, (t) => (sin(TAU * (160 - 110 * t) * t) * 0.7 + nz() * 0.4 * ex(-t * 20)) * ex(-t * 5)));
      this.buf.set('nope', mk(0.3, (t) => (((t * 140) % 1) * 2 - 1) * 0.35 * ex(-t * 9) + sin(TAU * 70 * t) * 0.3 * ex(-t * 12)));
      this.buf.set('tick', mk(0.08, (t) => sin(TAU * 1500 * t) * ex(-t * 50) * 0.5));
      this.buf.set('win', mk(2.4, (t) => [220, 277.2, 329.6, 440].reduce((s, f, k) => s + sin(TAU * f * t) * (t > k * 0.18 ? ex(-(t - k * 0.18) * 1.2) : 0), 0) * 0.22));
      this.buf.set('jump', mk(0.12, (t) => sin(TAU * (300 + 900 * t) * t) * ex(-t * 30) * 0.25));
      this.buf.set('door', mk(1.0, (t) => (sin(TAU * (110 + 220 * t) * t) * 0.4 + nz() * 0.1) * Math.min(1, t * 8) * ex(-t * 2.5)));
      this.buf.set('click', mk(0.05, (t) => sin(TAU * 1700 * t) * ex(-t * 70) * 0.4));
      this.buf.set('music', mk(16, (t) => {                              // dark ambient pulse: minor drone + slow heartbeat + sparse bell
        const beat = t % 1.0, bar = Math.floor(t / 4) % 4, root = [55, 51.9, 49, 51.9][bar];
        const drone = (sin(TAU * root * t) + 0.6 * sin(TAU * root * 1.498 * t) + 0.4 * sin(TAU * root * 2.01 * t)) * 0.08 * (0.7 + 0.3 * sin(TAU * t / 8));
        const heart = sin(TAU * 48 * beat) * (ex(-beat * 18) + (beat > 0.22 ? ex(-(beat - 0.22) * 18) * 0.6 : 0)) * 0.35;
        const b0 = t % 4, bell = sin(TAU * root * 8 * t) * ex(-b0 * 2.2) * 0.05 * (bar % 2 === 0 ? 1 : 0);
        return drone + heart + bell;
      }));
      this.apply();
    } catch { this.a = null; }
  }
  play(name, vol = 1) {
    try {
      if (!this.a || this.muted) return; const b = this.buf.get(name); if (!b) return;
      const s = this.a.createBufferSource(), g = this.a.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(this.out); s.start();
    } catch { /* audio is optional */ }
  }
  musicOn() {
    try {
      if (!this.a || this.music) return; const b = this.buf.get('music'); if (!b) return;
      const s = this.a.createBufferSource(), g = this.a.createGain(); g.gain.value = 0.5; s.buffer = b; s.loop = true; s.connect(g); g.connect(this.out); s.start(); this.music = s;
    } catch { /* audio is optional */ }
  }
  musicOff() { try { this.music?.stop(); } catch { /* already stopped */ } this.music = null; }
  setMuted(m) { this.muted = m; this.apply(); }
  apply() {
    try {
      if (!this.a) return;
      this.out.disconnect();
      if (this.muted) void this.a.suspend(); else { this.out.connect(this.a.destination); void this.a.resume(); }
    } catch { /* audio is optional */ }
  }
  destroy() { try { this.a?.close(); } catch { /* ignore */ } this.a = null; this.music = null; }
}
