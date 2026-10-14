import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* =============================================================================
   BnW — a two-level chess puzzle game in black and white
   A single self-contained React component. The player IS Thanos (Black).
   Props:
     timeLimit        seconds per attempt (default 120)
     onLevelComplete  (stats) => void   called when a level is solved ({ level, time, timeText })
     onGameComplete   (stats) => void   called when the final level is solved
     onExit           () => void        called by the Exit button (falls back to the menu)
   ============================================================================= */

const FONT = '"IM Fell English SC", Georgia, serif';
const FONT_URL = 'https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=IM+Fell+English:ital@0;1&display=swap';

/* ---------------------------------------------------------------------------
   LEVEL DATA
   Verified with python-chess: Black has exactly one winning move at every
   step (mate in 4), and White's replies are forced (only 3.Kf1 deviates,
   which loses at once to …Qf2#).
   FEN: r5k1/pp3p1p/1q3QpB/8/8/P2n1P2/1P4PP/3R3K b - - 0 1
   Wrong moves are punished at runtime: if White has a mate in one, it is played.
   --------------------------------------------------------------------------- */
export const LEVEL_1 = {
  number: 1,
  title: 'The Corner Trap',
  setup: [
    ['h1', 'w', 'K'], ['f6', 'w', 'Q'], ['h6', 'w', 'B'], ['d1', 'w', 'R'], ['a3', 'w', 'P'], ['b2', 'w', 'P'], ['f3', 'w', 'P'], ['g2', 'w', 'P'], ['h2', 'w', 'P'],
    ['g8', 'b', 'K'], ['b6', 'b', 'Q'], ['d3', 'b', 'N'], ['a8', 'b', 'R'], ['a7', 'b', 'P'], ['b7', 'b', 'P'], ['f7', 'b', 'P'], ['g6', 'b', 'P'], ['h7', 'b', 'P'],
  ],
  openingMove: 'Qf6',
  threatName: 'Qg7#',
  intro: 'White threatens Qg7#, and nothing can defend g7. Strike first. Black to move.',
  threat: ['f6', 'g7'],
  solution: [
    { b: 'd3f2', ann: '!', w: 'h1g1', say: '…Nf2+! The knight checks first, so White never gets time for Qg7#.', reply: ' Forced: Kg1.' },
    { b: 'f2h3', ann: '!', w: 'g1h1', say: '…Nh3++! Double check from knight and queen. Only the king can move.', reply: ' Back to the corner: Kh1.' },
    { b: 'b6g1', ann: '!!', w: 'd1g1', say: '…Qg1+!! The queen is offered on a square the king cannot touch.', reply: ' Forced: Rxg1.' },
    { b: 'h3f2', ann: '', say: '…Nf2#. The king is smothered by its own pieces. Checkmate.' },
  ],
  hints: {
    '0:b6g1': 'Too early. 2. Kxg1 simply takes the queen, because nothing guards g1 yet. Then Qg7# follows.',
    '0:b6d8': '…Qd8 attacks the queen, but White ignores it: 2. Qg7#.',
    '1:f2d1': 'Greedy. …Nxd1+ wins a rook, but the king escapes and Qg7# is still coming.',
    '2:h3f2': '…Nf2+ only repeats the position. Find the move that takes g1 away from the king.',
    '2:b6f2': '…Qf2 threatens mate, but it is not check. White strikes first with Qg7#.',
  },
};

/* Level 2 — verified with python-chess: mate in 3, one winning move at every
   step, every White reply forced.
   FEN: 2R1N1k1/p4ppp/3q4/1r6/5n2/8/PP3PPP/5RK1 b - - 0 1 */
export const LEVEL_2 = {
  number: 2,
  title: 'The Hidden Battery',
  setup: [
    ['g1', 'w', 'K'], ['f1', 'w', 'R'], ['c8', 'w', 'R'], ['e8', 'w', 'N'], ['a2', 'w', 'P'], ['b2', 'w', 'P'], ['f2', 'w', 'P'], ['g2', 'w', 'P'], ['h2', 'w', 'P'],
    ['g8', 'b', 'K'], ['d6', 'b', 'Q'], ['b5', 'b', 'R'], ['f4', 'b', 'N'], ['a7', 'b', 'P'], ['f7', 'b', 'P'], ['g7', 'b', 'P'], ['h7', 'b', 'P'],
  ],
  openingMove: 'Ne8',
  threatName: 'Nf6#',
  intro: 'The white knight hides a rook behind it. If it jumps, it is double check and mate (Nf6#). Strike first. Black to move.',
  threat: ['e8', 'f6'],
  solution: [
    { b: 'f4e2', ann: '!', w: 'g1h1', say: '…Ne2+! The knight checks and seals g1 and g3.', reply: ' Forced: Kh1.' },
    { b: 'd6h2', ann: '!!', w: 'h1h2', say: '…Qxh2+!! The queen throws herself onto h2.', reply: ' Forced: Kxh2.' },
    { b: 'b5h5', ann: '', say: '…Rh5#. The king is caught on the edge of the board. Checkmate.' },
  ],
  hints: {
    '0:b5h5': '…Rh5 eyes h2, but it is not check. White strikes first: 2. Nf6#.',
    '0:f4h3': '…Nh3+ is simply taken: 2. gxh3.',
    '1:b5h5': '…Rh5 threatens mate, but it is not check. White jumps first with Nf6#.',
    '1:e2g3': '…Ng3+ is simply taken, and the attack is gone.',
  },
};

export const LEVELS = [LEVEL_1, LEVEL_2];

const RULES = [
  'You play as BLACK. You are Thanos.',
  'White is threatening checkmate. Find the precise sequence of moves that turns the tables.',
  'Each level starts with a 2-minute countdown. If the timer hits 0:00, Thanos is sent back to the start of the level.',
  'A wrong move shows why it fails and resets the board. The timer keeps running.',
  'Click a black piece to highlight it, then click a highlighted square. You can also drag pieces.',
  'Completing Level 1 unlocks Level 2. Completing Level 2 triggers the victory screen.',
  'Press M to toggle sound.',
];

/* =============================================================================
   MATH HELPERS
   ============================================================================= */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function rng(s) { return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* =============================================================================
   CHESS ENGINE
   ============================================================================= */
const FILES = 'abcdefgh';
const sqi = (n) => (n.charCodeAt(1) - 49) * 8 + (n.charCodeAt(0) - 97);
const sqn = (i) => FILES[i & 7] + ((i >> 3) + 1);
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL = ORTH.concat(DIAG);
const JUMPS = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

function boardFrom(setup, base = 0) { const b = new Array(64).fill(null); setup.forEach(([s, c, t], i) => { b[sqi(s)] = { c, t, id: base + i }; }); return b; }
function pseudo(b, c) {
  const out = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (!p || p.c !== c) continue;
    const f = i & 7, r = i >> 3;
    const add = (ff, rk) => { if (ff < 0 || ff > 7 || rk < 0 || rk > 7) return false; const j = rk * 8 + ff, q = b[j]; if (q && q.c === c) return false; out.push({ from: i, to: j }); return !q; };
    if (p.t === 'P') {
      const d = c === 'w' ? 1 : -1, r1 = r + d;
      if (r1 >= 0 && r1 < 8) {
        if (!b[r1 * 8 + f]) { out.push({ from: i, to: r1 * 8 + f }); const st = c === 'w' ? 1 : 6; if (r === st && !b[(r + 2 * d) * 8 + f]) out.push({ from: i, to: (r + 2 * d) * 8 + f }); }
        for (const df of [-1, 1]) { const ff = f + df; if (ff < 0 || ff > 7) continue; const q = b[r1 * 8 + ff]; if (q && q.c !== c) out.push({ from: i, to: r1 * 8 + ff }); }
      }
    } else if (p.t === 'N') { for (const [a, d] of JUMPS) add(f + a, r + d); }
    else if (p.t === 'K') { for (const [a, d] of ALL) add(f + a, r + d); }
    else { const dirs = p.t === 'R' ? ORTH : p.t === 'B' ? DIAG : ALL; for (const [a, d] of dirs) { let k = 1; while (add(f + a * k, r + d * k)) k++; } }
  }
  return out;
}
function applyB(b, m) { const n = b.slice(); let p = n[m.from]; if (p.t === 'P' && ((m.to >> 3) === 7 || (m.to >> 3) === 0)) p = { ...p, t: 'Q' }; n[m.to] = p; n[m.from] = null; return n; }
function inCheck(b, c) { const k = b.findIndex((p) => p && p.c === c && p.t === 'K'); return k >= 0 && pseudo(b, c === 'w' ? 'b' : 'w').some((m) => m.to === k); }
const legal = (b, c) => pseudo(b, c).filter((m) => !inCheck(applyB(b, m), c));
function san(b, m) {
  const p = b[m.from], cap = !!b[m.to], to = sqn(m.to);
  let s = p.t === 'P' ? (cap ? FILES[m.from & 7] + 'x' + to : to) : p.t + (cap ? 'x' : '') + to;
  const nb = applyB(b, m), opp = p.c === 'w' ? 'b' : 'w';
  if (inCheck(nb, opp)) s += legal(nb, opp).length ? '+' : '#';
  return s;
}
const moveOf = (key) => ({ from: sqi(key.slice(0, 2)), to: sqi(key.slice(2, 4)) });

/* =============================================================================
   AUDIO (fully synthesised, no files)
   ============================================================================= */
class SoundEngine {
  constructor() { this.a = null; this.muted = false; this.bellT = 0; }
  ensure() {
    if (!this.a) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const a = (this.a = new C());
      this.out = a.createGain(); this.out.gain.value = this.muted ? 0 : 1; this.out.connect(a.destination);
      this.sfx = a.createGain(); this.sfx.gain.value = 0.85; this.sfx.connect(this.out);
      this.mus = a.createGain(); this.mus.gain.value = 0; this.mus.connect(this.out);
      this.rev = a.createConvolver(); this.rev.buffer = this.ir(3.8);
      const rv = a.createGain(); rv.gain.value = 0.5; this.rev.connect(rv); rv.connect(this.out);
      const nb = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.nb = nb;
      this.music();
      this.apply();
    } else if (!this.muted && this.a.state === 'suspended') this.a.resume();
  }
  // Mute is absolute: gain to zero, output unplugged from the speakers, and the
  // whole audio clock suspended, so nothing (music, ticks, effects) can sound.
  apply() {
    const a = this.a; if (!a) return;
    const t = a.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.muted ? 0 : 1, t);
    try { this.out.disconnect(); } catch (_) { /* not connected */ }
    if (this.muted) a.suspend();
    else { this.out.connect(a.destination); a.resume(); }
  }
  setMuted(m) { this.muted = m; this.apply(); }
  get live() { return !!this.a && !this.muted; }
  destroy() { clearTimeout(this.bellT); if (this.a) this.a.close(); this.a = null; }
  ir(sec) { const a = this.a, len = a.sampleRate * sec, b = a.createBuffer(2, len, a.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); } return b; }
  noise() { const s = this.a.createBufferSource(); s.buffer = this.nb; s.loop = true; return s; }
  env(g, t, peak, att, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec); }
  music() {
    const a = this.a, t = a.currentTime;
    this.lp = a.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 260; this.lp.Q.value = 2;
    const dg = a.createGain(); dg.gain.value = 0.14; this.lp.connect(dg); dg.connect(this.mus);
    [[55, 'sawtooth', 0.5], [55.4, 'sawtooth', 0.5], [82.41, 'triangle', 0.6], [110.3, 'sine', 0.3]].forEach(([f, ty, v]) => {
      const o = a.createOscillator(); o.type = ty; o.frequency.value = f; const g = a.createGain(); g.gain.value = v; o.connect(g); g.connect(this.lp); o.start();
    });
    const lfo = a.createOscillator(); lfo.frequency.value = 0.06; const lg = a.createGain(); lg.gain.value = 110; lfo.connect(lg); lg.connect(this.lp.frequency); lfo.start();
    const n = this.noise(), bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.7;
    const wg = a.createGain(); wg.gain.value = 0.08; n.connect(bp); bp.connect(wg); wg.connect(this.mus); n.start();
    const l2 = a.createOscillator(); l2.frequency.value = 0.09; const l2g = a.createGain(); l2g.gain.value = 260; l2.connect(l2g); l2g.connect(bp.frequency); l2.start();
    this.mus.gain.setValueAtTime(0, t); this.mus.gain.linearRampToValueAtTime(0.55, t + 5);
    const notes = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
    const loop = () => { if (!this.a) return; if (this.live) this.bell(notes[Math.floor(Math.random() * notes.length)] * (Math.random() < 0.3 ? 0.5 : 1), 0.045, this.mus); this.bellT = setTimeout(loop, 3500 + Math.random() * 5500); };
    this.bellT = setTimeout(loop, 2500);
  }
  bell(f, vol, dest, when) {
    if (!this.live) return; const a = this.a, t = when || a.currentTime;
    [[1, 1], [2.01, 0.35], [3.03, 0.12]].forEach(([m, v]) => { const o = a.createOscillator(); o.frequency.value = f * m; const g = a.createGain(); this.env(g, t, vol * v, 0.01, 3.2 / m); o.connect(g); g.connect(dest || this.sfx); g.connect(this.rev); o.start(t); o.stop(t + 3.6); });
  }
  place(heavy) {
    if (!this.live) return; const a = this.a, t = a.currentTime, p = 1 + (Math.random() - 0.5) * 0.14;
    const n = this.noise(), bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600 * p; bp.Q.value = 1.2;
    const g = a.createGain(); this.env(g, t, 0.5, 0.002, 0.045); n.connect(bp); bp.connect(g); g.connect(this.sfx); n.start(t, Math.random()); n.stop(t + 0.1);
    const o = a.createOscillator(); o.frequency.setValueAtTime(240 * p, t); o.frequency.exponentialRampToValueAtTime(95 * p, t + 0.09);
    const og = a.createGain(); this.env(og, t, heavy ? 0.8 : 0.5, 0.003, 0.13); o.connect(og); og.connect(this.sfx); o.start(t); o.stop(t + 0.2);
    const sg = a.createGain(); sg.gain.value = 0.12; og.connect(sg); sg.connect(this.rev);
    const o2 = a.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 1250 * p; const g2 = a.createGain(); this.env(g2, t, 0.15, 0.001, 0.035); o2.connect(g2); g2.connect(this.sfx); o2.start(t); o2.stop(t + 0.06);
  }
  lift() {
    if (!this.live) return; const a = this.a, t = a.currentTime;
    const n = this.noise(), hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
    const g = a.createGain(); this.env(g, t, 0.07, 0.004, 0.06); n.connect(hp); hp.connect(g); g.connect(this.sfx); n.start(t, Math.random()); n.stop(t + 0.1);
    const o = a.createOscillator(); o.type = 'triangle'; o.frequency.value = 1800; const g2 = a.createGain(); this.env(g2, t, 0.05, 0.001, 0.02); o.connect(g2); g2.connect(this.sfx); o.start(t); o.stop(t + 0.04);
  }
  capture() { this.place(true); setTimeout(() => this.place(false), 70); } // place() re-checks mute
  wrong() {
    if (!this.live) return; const a = this.a, t = a.currentTime, lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = a.createGain(); this.env(g, t, 0.3, 0.02, 0.9); lp.connect(g); g.connect(this.sfx); g.connect(this.rev);
    [73.4, 77.8].forEach((f) => { const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + 1); });
  }
  good(k) { if (!this.live) return; const f = [329.63, 392, 440][k] || 440; this.bell(f, 0.12); this.bell(f * 1.5, 0.06, null, this.a.currentTime + 0.09); }
  win() { if (!this.live) return; [440, 523.25, 659.25, 880, 1046.5].forEach((f, i) => this.bell(f, 0.12, null, this.a.currentTime + i * 0.16)); }
  tick(hi) { if (!this.live) return; const a = this.a, t = a.currentTime, o = a.createOscillator(); o.frequency.value = hi ? 2100 : 1650; const g = a.createGain(); this.env(g, t, 0.11, 0.001, 0.03); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.05); }
  whoosh(dur = 0.55) {
    if (!this.live) return; const a = this.a, t = a.currentTime, n = this.noise(), bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2600, t + dur);
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    n.connect(bp); bp.connect(g); g.connect(this.sfx); n.start(t, Math.random()); n.stop(t + dur + 0.1);
  }
  crumble() {
    if (!this.live) return; const a = this.a, t = a.currentTime;
    const o = a.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.8); const og = a.createGain(); this.env(og, t, 0.8, 0.005, 0.9); o.connect(og); og.connect(this.sfx); o.start(t); o.stop(t + 1);
    const n = this.noise(), lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; const g = a.createGain(); this.env(g, t, 0.3, 0.05, 1.8); n.connect(lp); lp.connect(g); g.connect(this.sfx); g.connect(this.rev); n.start(t, Math.random()); n.stop(t + 2);
  }
  tension(v) { if (this.lp) this.lp.frequency.setTargetAtTime(260 + v * 420, this.a.currentTime, 1); }
}

/* =============================================================================
   SCENE GEOMETRY (virtual canvas 1440 × 760, letterboxed)
   ============================================================================= */
const W = 1440, H = 760, M = 50;
const SQ = 64, BS = SQ * 8, BX = 700, BY = 56, FR = 24;
const PX = 1262, PW = 158;                       // side panel (moves + progress)
const TH_X = 0, TH_Y = 240, TH_W = 700, TH_H = 560, CHIN = { x: 290, y: 280 }, TS = 0.85;
const hillY = (x) => 714 - 46 * Math.exp(-(((x - 1330) / 220) ** 2)) - 18 * Math.exp(-(((x - 230) / 220) ** 2)) + 5 * Math.sin(x * 0.011);
const sqXY = (i) => ({ x: BX + (7 - (i & 7)) * SQ + SQ / 2, y: BY + (i >> 3) * SQ + SQ / 2 });  // Black's view: rank 8 at the bottom
const isLight = (i) => ((i & 7) + (i >> 3)) % 2 === 1;
const BR = { p0: { x: 110, y: 220 }, p1: { x: 380, y: 40 }, p2: { x: 720, y: 20 } };
const bez = (b, t) => ({ x: (1 - t) ** 2 * b.p0.x + 2 * (1 - t) * t * b.p1.x + t * t * b.p2.x, y: (1 - t) ** 2 * b.p0.y + 2 * (1 - t) * t * b.p1.y + t * t * b.p2.y });

/* ---------- pre-rendered layers (built once, shared) ---------- */
let ASSETS = null;
function getAssets() {
  if (ASSETS) return ASSETS;
  const R = rng(1337);
  const layer = () => mk(W + 2 * M, H + 2 * M);

  const bgFar = layer();
  {
    const g = bgFar.getContext('2d'); g.translate(M, M);
    g.fillStyle = '#242424'; g.fillRect(-M, -M, W + 2 * M, H + 2 * M);
    let rg = g.createRadialGradient(1010, 300, 0, 1010, 300, 780);
    rg.addColorStop(0, '#dedede'); rg.addColorStop(0.3, '#a4a4a4'); rg.addColorStop(0.75, 'rgba(60,60,60,.4)'); rg.addColorStop(1, 'rgba(36,36,36,0)');
    g.fillStyle = rg; g.fillRect(-M, -M, W + 2 * M, H + 2 * M);
    rg = g.createRadialGradient(400, 360, 0, 400, 360, 380); rg.addColorStop(0, 'rgba(215,215,215,.85)'); rg.addColorStop(1, 'rgba(215,215,215,0)');
    g.fillStyle = rg; g.fillRect(-M, -M, W + 2 * M, H + 2 * M);
    const tree = (x, w, lean, col, blur) => {
      g.filter = `blur(${blur}px)`; g.fillStyle = col; g.beginPath();
      g.moveTo(x - w / 2, H + M); g.quadraticCurveTo(x - w * 0.4 + lean * 0.5, H * 0.5, x - w * 0.3 + lean, -M);
      g.lineTo(x + w * 0.3 + lean, -M); g.quadraticCurveTo(x + w * 0.4 + lean * 0.5, H * 0.5, x + w / 2, H + M); g.fill();
    };
    for (let i = 0; i < 14; i++) tree(R() * W, 30 + R() * 70, (R() - 0.5) * 80, `rgba(150,150,150,${0.35 + R() * 0.3})`, 14);
    for (let i = 0; i < 8; i++) tree(R() * W, 20 + R() * 45, (R() - 0.5) * 60, `rgba(90,90,90,${0.5 + R() * 0.3})`, 6);
    g.filter = 'none';
    const lg = g.createLinearGradient(0, -M, 0, 240); lg.addColorStop(0, 'rgba(0,0,0,.6)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lg; g.fillRect(-M, -M, W + 2 * M, 300);
  }

  const taper = (g, b, w0, w1) => {
    const n = 40, L = [], Rt = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = bez(b, t), q = bez(b, Math.min(1, t + 0.01)), p0 = bez(b, Math.max(0, t - 0.01));
      const dx = q.x - p0.x, dy = q.y - p0.y, l = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, t) / 2;
      L.push([p.x - (dy / l) * w, p.y + (dx / l) * w]); Rt.push([p.x + (dy / l) * w, p.y - (dx / l) * w]);
    }
    g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    for (let i = Rt.length - 1; i >= 0; i--) g.lineTo(Rt[i][0], Rt[i][1]);
    g.closePath(); g.fill();
  };
  const treeL = layer();
  {
    const g = treeL.getContext('2d'); g.translate(M, M); g.filter = 'blur(1.2px)'; g.fillStyle = '#141414';
    g.beginPath(); g.moveTo(-M, H + M); g.bezierCurveTo(-10, 600, 15, 380, 30, 180); g.bezierCurveTo(40, 90, 25, 0, 15, -M);
    g.lineTo(200, -M); g.bezierCurveTo(175, 60, 160, 160, 170, 270); g.bezierCurveTo(180, 460, 150, 660, 200, H + M); g.closePath(); g.fill();
    taper(g, BR, 54, 8);
    taper(g, { p0: { x: 140, y: 340 }, p1: { x: 60, y: 270 }, p2: { x: -40, y: 300 } }, 38, 10);
    g.strokeStyle = '#141414'; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const p = bez(BR, 0.15 + i * 0.09), len = 30 + R() * 55, a = -Math.PI / 2 + (R() - 0.5) * 1.4;
      g.lineWidth = 6 - i * 0.4; g.beginPath(); g.moveTo(p.x, p.y);
      g.quadraticCurveTo(p.x + Math.cos(a) * len * 0.5 + 10, p.y + Math.sin(a) * len * 0.5, p.x + Math.cos(a) * len, p.y + Math.sin(a) * len); g.stroke();
    }
    g.strokeStyle = '#121212';
    for (let i = 0; i < 24; i++) {
      const p = bez(BR, R() * 0.9), len = 20 + R() * 80; g.lineWidth = 1 + R() * 2.5;
      g.beginPath(); g.moveTo(p.x, p.y); let x = p.x, y = p.y;
      for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 8; y += len / 6; g.lineTo(x, y); }
      g.stroke();
    }
    g.filter = 'none';
  }

  // tileable fractal value noise → fog
  const makeFog = (w, h, seed) => {
    const r = rng(seed), c = mk(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    const oct = [[4, 0.5], [8, 0.28], [16, 0.14], [32, 0.08]].map(([p, a]) => {
      const gw = p, gh = Math.max(2, Math.round((p * h) / w)), v = new Float32Array(gw * gh);
      for (let i = 0; i < v.length; i++) v[i] = r();
      return { gw, gh, v, a };
    });
    const sm = (t) => t * t * (3 - 2 * t);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let n = 0;
      for (const o of oct) {
        const fx = (x / w) * o.gw, fy = (y / h) * o.gh, x0 = Math.floor(fx), y0 = Math.floor(fy) % o.gh;
        const tx = sm(fx - Math.floor(fx)), ty = sm(fy - Math.floor(fy)), x1 = (x0 + 1) % o.gw, y1 = (y0 + 1) % o.gh;
        n += lerp(lerp(o.v[y0 * o.gw + x0], o.v[y0 * o.gw + x1], tx), lerp(o.v[y1 * o.gw + x0], o.v[y1 * o.gw + x1], tx), ty) * o.a;
      }
      const al = clamp((n - 0.38) / 0.4, 0, 1) * Math.sin((Math.PI * y) / h), i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 232; d[i + 3] = al * 255;
    }
    g.putImageData(img, 0, 0); return c;
  };
  const fogA = makeFog(512, 192, 7), fogB = makeFog(512, 160, 21);

  const grains = [0, 1, 2].map(() => {
    const c = mk(220, 220), g = c.getContext('2d'), im = g.createImageData(220, 220);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = Math.random() * 60; }
    g.putImageData(im, 0, 0); return c;
  });

  const vig = mk(W, H);
  {
    const g = vig.getContext('2d'), rg = g.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H * 0.5, H * 1.05);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.7, 'rgba(0,0,0,.42)'); rg.addColorStop(1, 'rgba(0,0,0,.9)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }

  // flat board seen from Black's side, ranks/files labelled on the frame
  const boardC = mk(BS + 2 * FR, BS + 2 * FR);
  const paintBoard = () => {
    const g = boardC.getContext('2d');
    g.fillStyle = '#080808'; g.fillRect(0, 0, BS + 2 * FR, BS + 2 * FR);
    g.strokeStyle = 'rgba(230,230,230,.45)'; g.lineWidth = 1; g.strokeRect(FR - 4.5, FR - 4.5, BS + 9, BS + 9);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const file = 7 - c, light = (file + r) % 2 === 1, x = FR + c * SQ, y = FR + r * SQ;
      g.fillStyle = light ? '#cbcbcb' : '#4c4c4c'; g.fillRect(x, y, SQ, SQ);
      g.save(); g.beginPath(); g.rect(x, y, SQ, SQ); g.clip();
      g.strokeStyle = light ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.04)';
      for (let k = 0; k < 17; k++) { g.beginPath(); for (let xx = 0; xx <= SQ; xx += 4) { const yy = y + k * 4 + Math.sin((x + xx) * 0.05 + k * 0.7 + r) * 1.6; xx ? g.lineTo(x + xx, yy) : g.moveTo(x, yy); } g.stroke(); }
      g.restore();
    }
    g.font = `16px ${FONT}`; g.fillStyle = '#d0d0d0'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let c = 0; c < 8; c++) { const x = FR + c * SQ + SQ / 2, f = FILES[7 - c]; g.fillText(f, x, FR / 2); g.fillText(f, x, FR + BS + FR / 2); }
    for (let r = 0; r < 8; r++) { const y = FR + r * SQ + SQ / 2; g.fillText(String(r + 1), FR / 2, y); g.fillText(String(r + 1), FR + BS + FR / 2, y); }
  };
  paintBoard();

  ASSETS = { bgFar, treeL, fogA, fogB, grains, vig, boardC, paintBoard };
  return ASSETS;
}

/* ---------- vector chess pieces (unit space) ---------- */
function drawPiece(g, t, c, x, y, ang, u, sx = 1, sy = 1) {
  g.save(); g.translate(x, y); g.rotate(ang || 0); g.scale(u * sx, u * sy);
  const F = () => { g.fill(); g.stroke(); };
  g.fillStyle = c === 'w' ? '#f4f4f4' : '#0e0e0e'; g.strokeStyle = c === 'w' ? '#0b0b0b' : '#d6d6d6';
  g.lineWidth = 2.4 / u; g.lineJoin = 'round'; g.lineCap = 'round';
  rr(g, -0.3, 0.27, 0.6, 0.11, 0.03); F();
  if (t === 'P') {
    g.beginPath(); g.moveTo(-0.2, 0.27); g.quadraticCurveTo(-0.11, 0.02, -0.08, -0.04); g.lineTo(0.08, -0.04); g.quadraticCurveTo(0.11, 0.02, 0.2, 0.27); g.closePath(); F();
    g.beginPath(); g.ellipse(0, -0.05, 0.14, 0.04, 0, 0, TAU); F();
    g.beginPath(); g.arc(0, -0.18, 0.115, 0, TAU); F();
  } else if (t === 'R') {
    g.beginPath(); g.moveTo(-0.21, 0.27); g.lineTo(-0.17, -0.1); g.lineTo(0.17, -0.1); g.lineTo(0.21, 0.27); g.closePath(); F();
    g.beginPath(); g.moveTo(-0.24, -0.1); g.lineTo(-0.24, -0.33); g.lineTo(-0.145, -0.33); g.lineTo(-0.145, -0.25); g.lineTo(-0.05, -0.25); g.lineTo(-0.05, -0.33);
    g.lineTo(0.05, -0.33); g.lineTo(0.05, -0.25); g.lineTo(0.145, -0.25); g.lineTo(0.145, -0.33); g.lineTo(0.24, -0.33); g.lineTo(0.24, -0.1); g.closePath(); F();
  } else if (t === 'B') {
    g.beginPath(); g.moveTo(-0.17, 0.27); g.quadraticCurveTo(-0.08, 0.1, -0.07, 0); g.lineTo(0.07, 0); g.quadraticCurveTo(0.08, 0.1, 0.17, 0.27); g.closePath(); F();
    g.beginPath(); g.ellipse(0, 0, 0.15, 0.045, 0, 0, TAU); F();
    g.beginPath(); g.moveTo(0, -0.36); g.bezierCurveTo(0.2, -0.22, 0.16, -0.04, 0, -0.035); g.bezierCurveTo(-0.16, -0.04, -0.2, -0.22, 0, -0.36); F();
    g.beginPath(); g.arc(0, -0.39, 0.045, 0, TAU); F();
    g.beginPath(); g.moveTo(0.015, -0.25); g.lineTo(0.085, -0.15); g.stroke();
  } else if (t === 'Q' || t === 'K') {
    g.beginPath(); g.moveTo(-0.19, 0.27); g.quadraticCurveTo(-0.1, 0.08, -0.09, -0.03); g.lineTo(0.09, -0.03); g.quadraticCurveTo(0.1, 0.08, 0.19, 0.27); g.closePath(); F();
    g.beginPath(); g.ellipse(0, -0.03, 0.16, 0.045, 0, 0, TAU); F();
    if (t === 'Q') {
      g.beginPath(); g.moveTo(-0.15, -0.06); g.lineTo(-0.25, -0.29); g.lineTo(-0.1, -0.15); g.lineTo(0, -0.33); g.lineTo(0.1, -0.15); g.lineTo(0.25, -0.29); g.lineTo(0.15, -0.06); g.closePath(); F();
      [[-0.25, -0.31], [0, -0.355], [0.25, -0.31]].forEach(([a, b]) => { g.beginPath(); g.arc(a, b, 0.04, 0, TAU); F(); });
    } else {
      g.beginPath(); g.moveTo(-0.15, -0.06); g.lineTo(-0.21, -0.22); g.quadraticCurveTo(0, -0.31, 0.21, -0.22); g.lineTo(0.15, -0.06); g.closePath(); F();
      g.beginPath(); g.rect(-0.028, -0.44, 0.056, 0.17); F();
      g.beginPath(); g.rect(-0.085, -0.39, 0.17, 0.055); F();
    }
  } else if (t === 'N') {
    g.beginPath(); g.moveTo(-0.2, 0.27); g.lineTo(-0.16, 0.02); g.bezierCurveTo(-0.2, -0.1, -0.1, -0.3, 0.02, -0.34); g.lineTo(0.06, -0.4); g.lineTo(0.1, -0.32);
    g.bezierCurveTo(0.22, -0.26, 0.3, -0.08, 0.3, 0.02); g.lineTo(0.24, 0.06); g.lineTo(0.1, -0.02); g.bezierCurveTo(0.08, 0.08, 0.18, 0.16, 0.2, 0.27); g.closePath(); F();
  }
  g.restore();
}

/* ---------- Thanos (the player) ---------- */
const EXPR = {
  focus:    { ba: 0.26, br: 0,    bs: 0,   mc: -0.1,  mo: 0,    eo: 0.8,  tilt: 0,     laugh: 0,   strain: 0 },
  watch:    { ba: 0.34, br: 0,    bs: 0.2, mc: -0.2,  mo: 0,    eo: 0.95, tilt: 0.03,  laugh: 0,   strain: 0 },
  smug:     { ba: 0.05, br: 0.1,  bs: 1,   mc: 0.75,  mo: 0.25, eo: 0.55, tilt: -0.05, laugh: 0.6, strain: 0 },
  angry:    { ba: 0.6,  br: 0,    bs: 0,   mc: -0.7,  mo: 0.45, eo: 0.7,  tilt: 0.02,  laugh: 0,   strain: 0 },
  strain:   { ba: -0.22,br: 0.4,  bs: 0,   mc: -0.4,  mo: 0.08, eo: 1,    tilt: 0.03,  laugh: 0,   strain: 1 },
  triumph:  { ba: 0.1,  br: 0.25, bs: 0.6, mc: 0.9,   mo: 0.22, eo: 0.6,  tilt: -0.08, laugh: 0.4, strain: 0 },
  defeated: { ba: -0.38,br: 0.2,  bs: 0,   mc: -0.5,  mo: 0.1,  eo: 0.35, tilt: 0.14,  laugh: 0,   strain: 0 },
};
const STONE_SH = ['#cfcfcf', '#9a9a9a', '#e6e6e6', '#7c7c7c', '#b5b5b5', '#8e8e8e'];
const metal = (g, y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#ededed'); gr.addColorStop(0.45, '#a9a9a9'); gr.addColorStop(1, '#5c5c5c'); return gr; };
const skin = (g, x0, x1) => { const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, '#3c3c3c'); gr.addColorStop(0.6, '#787878'); gr.addColorStop(1, '#a6a6a6'); return gr; };
const ink = (g, w) => { g.lineWidth = w || 4; g.strokeStyle = '#000'; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
function headPath(g) {
  g.beginPath(); g.moveTo(0, -262);
  g.bezierCurveTo(70, -262, 92, -220, 92, -160); g.lineTo(96, -110);
  g.bezierCurveTo(98, -60, 80, -20, 50, -2); g.bezierCurveTo(30, 8, -30, 8, -50, -2);
  g.bezierCurveTo(-80, -20, -98, -60, -96, -110); g.lineTo(-92, -160);
  g.bezierCurveTo(-92, -220, -70, -262, 0, -262); g.closePath();
}
function drawGauntlet(g, x, y, t, E) {
  g.fillStyle = metal(g, y + 50, y + 110); rr(g, x - 50, y + 52, 100, 48, 10); g.fill(); ink(g);
  g.fillStyle = metal(g, y - 45, y + 65); rr(g, x - 56, y - 42, 112, 104, 22); g.fill(); ink(g);
  g.save(); g.translate(x - 58, y + 8); g.rotate(-0.5); g.fillStyle = metal(g, -40, 30); rr(g, -16, -38, 32, 70, 14); g.fill(); ink(g); g.restore();
  for (let i = 0; i < 4; i++) {
    const fx = x - 52 + i * 26, fy = y - 84 + (i === 0 || i === 3 ? 6 : 0);
    g.fillStyle = metal(g, fy, fy + 54); rr(g, fx, fy, 25, 54, 11); g.fill(); ink(g, 3.5);
    g.beginPath(); g.moveTo(fx + 4, fy + 32); g.lineTo(fx + 21, fy + 32); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.stroke();
  }
  // six stones; each correct move ignites two of them (progress lives on the gauntlet)
  const stones = [[x - 39.5, y - 64, 6], [x - 13.5, y - 70, 6], [x + 12.5, y - 70, 6], [x + 38.5, y - 64, 6], [x - 74, y - 16, 6], [x, y + 10, 14]];
  stones.forEach(([sx, sy, r], i) => {
    const li = clamp(E.lit - i, 0, 1), p = 0.6 + 0.4 * Math.sin(t * 2.2 + i * 1.3);
    g.fillStyle = '#3a3a3a'; g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
    if (li > 0.01) {
      g.save(); g.globalAlpha = li; g.shadowColor = '#fff'; g.shadowBlur = 8 + 24 * p;
      const rg = g.createRadialGradient(sx - r * 0.3, sy - r * 0.3, 0, sx, sy, r); rg.addColorStop(0, '#fff'); rg.addColorStop(1, STONE_SH[i]);
      g.fillStyle = rg; g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill(); g.restore();
    }
    g.beginPath(); g.arc(sx, sy, r, 0, TAU); ink(g, 2.5);
  });
}
function drawThanos(g, t, E, TH) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, TH_W, TH_H);
  g.save(); g.translate(CHIN.x, CHIN.y + Math.sin(t * 1.7) * 3); g.scale(TS, TS);

  g.fillStyle = skin(g, -320, -150);
  g.beginPath(); g.ellipse(-210, 150, 64, 125, 0.28, 0, TAU); g.fill(); ink(g);
  g.beginPath(); g.ellipse(-250, 262, 60, 64, 0, 0, TAU); g.fill(); ink(g);

  g.fillStyle = '#101010';
  g.beginPath(); g.moveTo(-195, 25); g.bezierCurveTo(-215, 140, -180, 240, -160, 330); g.lineTo(160, 330);
  g.bezierCurveTo(180, 240, 215, 140, 195, 25); g.quadraticCurveTo(0, -5, -195, 25); g.closePath(); g.fill(); ink(g);
  g.save(); g.clip();
  g.fillStyle = '#4b4b4b'; g.beginPath(); g.moveTo(-260, 118); g.quadraticCurveTo(0, 150, 260, 118); g.lineTo(260, 142); g.quadraticCurveTo(0, 174, -260, 142); g.closePath(); g.fill();
  g.strokeStyle = '#2e2e2e'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 165); g.lineTo(0, 330);
  for (let k = 0; k < 3; k++) { const y = 192 + k * 42; g.moveTo(-62, y); g.quadraticCurveTo(-30, y + 9, 0, y); g.moveTo(62, y); g.quadraticCurveTo(30, y + 9, 0, y); }
  g.moveTo(-150, 95); g.quadraticCurveTo(-80, 118, -10, 92); g.moveTo(150, 95); g.quadraticCurveTo(80, 118, 10, 92); g.stroke();
  g.restore();

  const up = -E.lit * 3; // the arm lifts a little higher with every stone
  g.fillStyle = skin(g, 160, 360);
  g.beginPath(); g.moveTo(160, 30); g.quadraticCurveTo(280, -5, 345, 70); g.quadraticCurveTo(350, 125, 300, 140); g.quadraticCurveTo(230, 120, 170, 125); g.closePath(); g.fill(); ink(g);
  g.beginPath(); g.moveTo(282, 120); g.quadraticCurveTo(262, 10, 272, -110 + up); g.lineTo(352, -110 + up); g.quadraticCurveTo(362, 20, 350, 115); g.closePath(); g.fill(); ink(g);
  drawGauntlet(g, 312, -175 + up, t, E);

  g.fillStyle = skin(g, -60, 60); g.beginPath(); g.rect(-52, -50, 104, 90); g.fill(); ink(g);
  for (const s of [-1, 1]) {
    g.fillStyle = metal(g, -40, 110);
    g.beginPath(); g.moveTo(s * 48, -34); g.lineTo(s * 70, 40); g.lineTo(s * 36, 100); g.lineTo(s * 120, 100); g.lineTo(s * 215, 62); g.lineTo(s * 160, 10); g.lineTo(s * 96, -6); g.closePath(); g.fill(); ink(g);
    g.beginPath(); g.moveTo(s * 60, -20); g.lineTo(s * 78, 36); g.moveTo(s * 110, 6); g.lineTo(s * 175, 40); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = metal(g, 20, 110); g.beginPath(); g.ellipse(s * 192, 66, 50, 28, s * 0.35, 0, TAU); g.fill(); ink(g);
  }

  g.save();
  g.translate(0, -10 + Math.sin(t * 20) * 3 * E.laugh); g.rotate(E.tilt); g.translate(0, 10);
  g.fillStyle = skin(g, -100, 100);
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 95, -118, 12, 22, 0, 0, TAU); g.fill(); ink(g, 3.5); }
  headPath(g); g.fill(); ink(g, 5);
  g.save(); headPath(g); g.clip();
  const hl = g.createRadialGradient(42, -212, 6, 42, -212, 140); hl.addColorStop(0, 'rgba(255,255,255,.35)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl; g.fillRect(-100, -270, 200, 280); g.restore();

  const by = -150 - E.br * 8;
  const crease = Math.abs(E.ba) > 0.25 ? (Math.abs(E.ba) - 0.25) * 3 : 0;
  if (crease > 0) {
    g.strokeStyle = `rgba(20,20,20,${Math.min(0.8, crease)})`; g.lineWidth = 2.5; g.beginPath();
    for (let k = 0; k < 3; k++) { const y = by - 30 - k * 12, bend = E.ba > 0 ? 5 : -5; g.moveTo(-34 + k * 4, y); g.quadraticCurveTo(0, y + bend, 34 - k * 4, y); }
    g.stroke();
  }
  g.strokeStyle = '#2a2a2a'; g.lineWidth = 3; g.beginPath();
  for (const s of [-1, 1]) { g.moveTo(s * 30, -108); g.quadraticCurveTo(s * 48, -80, s * 42, -58); }
  g.moveTo(-3, -128); g.lineTo(-8, -92); g.quadraticCurveTo(0, -85, 9, -92);
  for (let k = -2; k <= 2; k++) { const x = k * 13; g.moveTo(x, -38); g.quadraticCurveTo(x * 1.08, -20, x * 1.15, -3); }
  g.stroke();

  const blink = TH.blink > 0 ? 1 - Math.sin(Math.PI * (1 - TH.blink / 0.16)) : 1;
  for (const s of [-1, 1]) {
    g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.ellipse(s * 40, -132, 27, 13, 0, 0, TAU); g.fill();
    g.save(); g.shadowColor = '#fff'; g.shadowBlur = 16; g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(s * 40 + TH.look.x, -131 + TH.look.y, 10, Math.max(0.6, 5.5 * E.eo * blink), 0, 0, TAU); g.fill(); g.restore();
  }
  for (const s of [-1, 1]) {
    const asym = s > 0 ? E.bs * 10 : 0, iy = by + E.ba * 24 - asym, oy = by - E.ba * 10 - asym * 1.3;
    g.fillStyle = '#0b0b0b'; g.beginPath();
    g.moveTo(s * 12, iy - 8); g.quadraticCurveTo(s * 48, (iy + oy) / 2 - 12, s * 84, oy - 5);
    g.lineTo(s * 84, oy + 4); g.quadraticCurveTo(s * 48, (iy + oy) / 2 + 2, s * 12, iy + 8); g.closePath(); g.fill();
  }
  // sweat drop under time pressure: falls under gravity, then respawns
  if (E.strain > 0.3 && TH.sweat.y > -200) {
    g.save(); g.globalAlpha = E.strain; g.fillStyle = '#f2f2f2'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); const sx = 70, sy = TH.sweat.y; g.moveTo(sx, sy - 9); g.quadraticCurveTo(sx + 6, sy, sx, sy + 5); g.quadraticCurveTo(sx - 6, sy, sx, sy - 9); g.fill(); g.stroke(); g.restore();
  }
  // mouth: y(x) parabola shaped by curvature, openness and asymmetry
  const my = -54, MW = 36, c = E.mc, op = E.mo;
  const yU = (x) => { const u = x / MW; return my + c * 10 * (1 - u * u) - c * 4 - (u > 0 ? E.bs * u * 7 : 0); };
  const yL = (x) => yU(x) + op * 18 * (1 - (x / MW) ** 2);
  if (op > 0.04) {
    g.beginPath(); for (let x = -MW; x <= MW; x += 4) (x === -MW ? g.moveTo(x, yU(x)) : g.lineTo(x, yU(x)));
    for (let x = MW; x >= -MW; x -= 4) g.lineTo(x, yL(x)); g.closePath(); g.fillStyle = '#050505'; g.fill();
    if (op > 0.15) {
      g.save(); g.clip(); g.fillStyle = '#d8d8d8'; g.beginPath();
      for (let x = -MW; x <= MW; x += 4) (x === -MW ? g.moveTo(x, yU(x) - 2) : g.lineTo(x, yU(x) - 2));
      for (let x = MW; x >= -MW; x -= 4) g.lineTo(x, yU(x) + 5); g.closePath(); g.fill(); g.restore();
    }
  }
  g.beginPath(); for (let x = -MW; x <= MW; x += 3) (x === -MW ? g.moveTo(x, yU(x)) : g.lineTo(x, yU(x))); ink(g, 4);
  g.restore();
  g.restore();
}

/* =============================================================================
   ENGINE — owns the canvas, physics, animation and game rules.
   Talks to React only through the `cb` callbacks.
   ============================================================================= */
function createEngine(canvas, cb, opts) {
  let LV = opts.levels[0];
  const TIME = opts.timeLimit;
  const A = getAssets();
  const ctx = canvas.getContext('2d');
  const sound = new SoundEngine();
  const grains = A.grains.map((c) => ctx.createPattern(c, 'repeat'));
  const thC = mk(TH_W, TH_H), thG = thC.getContext('2d', { willReadFrequently: true });
  const R = rng(99);

  let scale = 1, offX = 0, offY = 0, dpr = 1, alive = true, raf = 0;
  const mouse = { x: W / 2, y: H / 2, px: W / 2, vx: 0 };

  /* ----- world physics state ----- */
  const crate = { th: 0.1, om: 0, L: 150, px: 470, py: -10 };
  const vines = [0.25, 0.42, 0.58].map((tt, k) => {
    const a = bez(BR, tt), n = 9 + k * 2, pts = [];
    for (let i = 0; i < n; i++) pts.push({ x: a.x, y: a.y + i * 12, px: a.x, py: a.y + i * 12 });
    return { a, pts, seg: 12, k };
  });
  let vineOff = { x: 0, y: 0 };
  const blades = [];
  for (let i = 0; i < 200; i++) { const x = R() * W, tall = R() < 0.16; blades.push({ x, y: hillY(x) + 3, h: tall ? 50 + R() * 40 : 10 + R() * 24, tall, rest: (R() - 0.5) * 0.35, a: 0, av: 0, k: 50 + R() * 50, c: 5 + R() * 3 }); }
  const motes = []; for (let i = 0; i < 60; i++) motes.push({ x: R() * W, y: R() * H, vx: 0, vy: 0, r: 0.8 + R() * 1.8, ph: R() * TAU });
  const RAYS = []; for (let i = 0; i < 6; i++) RAYS.push({ x: 640 + R() * 760, dx: -120 - R() * 160, w: 40 + R() * 80, a: 0.05 + R() * 0.05, f: 0.3 + R() * 0.4, p: R() * TAU });

  /* ----- Thanos state ----- */
  const E = { ...EXPR.focus, lit: 0 };
  const TH = { over: null, overT: 0, final: null, blinkT: 3, blink: 0, look: { x: 0, y: 0 }, sweat: { y: -260, v: 0, wait: 1 }, alpha: 1, rise: 0, rising: false };
  const say = (k, d) => { TH.over = k; TH.overT = d; };

  /* ----- game state ----- */
  let mode = 'menu', board = boardFrom(LV.setup, LV.number * 100), legalB = legal(board, 'b'), step = 0, locked = true;
  let timeLeft = TIME, lastSec = TIME, selected = -1, lastMove = null, tasks = [];
  let moves = [], msg = { text: '', kind: 'info', t0: 0, keep: 0 }, T = 0, flash = 0, invertT = 0, shakeT = 9, shakeA = 0;
  let dragS = null, dragFrom = -1, downPos = null, sprites = [], parts = [], rings = [], thDust = null;

  const later = (s, f) => tasks.push({ t: s, f });
  // message under the board (typewriter); `append` continues the current line
  const setMsg = (kind, text, append) => {
    msg = append ? { text: msg.text + text, kind: msg.kind, t0: T, keep: msg.text.length } : { text, kind, t0: T, keep: 0 };
  };
  const setStep = (s) => { step = s; };
  const shake = (a) => { shakeT = 0; shakeA = a; };

  /* ----- sprites ----- */
  function syncSprites(instant) {
    for (let i = 0; i < 64; i++) {
      const p = board[i]; if (!p) continue;
      let s = sprites.find((q) => q.id === p.id); const c = sqXY(i);
      if (!s || s.flying) {
        if (s) sprites.splice(sprites.indexOf(s), 1);
        s = { id: p.id, c: p.c, x: instant ? c.x : c.x + (Math.random() - 0.5) * 240, y: instant ? c.y : H + 80, vx: 0, vy: instant ? 0 : -300, ang: instant ? 0 : (Math.random() - 0.5) * 2, lift: 0, sqT: 9 };
        sprites.push(s);
      }
      s.t = p.t; s.tx = c.x; s.ty = c.y; s.hop = null; s.drag = false;
    }
    sprites = sprites.filter((s) => s.flying || board.some((p) => p && p.id === s.id));
  }
  syncSprites(true);

  const targets = (from) => {
    const list = legalB.filter((m) => m.from === from).map((m) => m.to);
    const sol = LV.solution[step];
    if (sol && mode === 'play') { const sm = moveOf(sol.b); if (sm.from === from && !list.includes(sm.to)) list.push(sm.to); }
    return list;
  };

  function launch(s, dir) { s.flying = true; s.hop = null; s.drag = false; s.vx = (dir >= 0 ? 1 : -1) * (220 + Math.random() * 220); s.vy = -650 - Math.random() * 300; s.av = (Math.random() - 0.5) * 12; s.life = 2.6; }
  function puff(x, y) { for (let i = 0; i < 9; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 60, grav: 160, drag: 0.96, life: 0.5, max: 0.5, col: '#e8e8e8', size: 2 + Math.random() * 2, a: 0.5 }); }

  function doMove(m, dragged) {
    const p = board[m.from], cap = board[m.to], from = sqXY(m.from), to = sqXY(m.to);
    board = applyB(board, m); lastMove = m; legalB = legal(board, 'b');
    const s = sprites.find((x) => x.id === p.id), capS = cap && sprites.find((x) => x.id === cap.id);
    s.t = board[m.to].t;
    const land = () => { if (capS) launch(capS, to.x - from.x || 1); capS ? sound.capture() : sound.place(); puff(to.x, to.y + SQ * 0.32); s.sqT = 0; crate.om += (Math.random() - 0.5) * 0.06; };
    s.tx = to.x; s.ty = to.y;
    if (dragged) { s.drag = false; land(); }
    else { const d = Math.hypot(to.x - s.x, to.y - s.y) / SQ; s.hop = { x0: s.x, y0: s.y, x1: to.x, y1: to.y, t: 0, dur: 0.3 + 0.06 * d, h: 24 + 9 * d, cb: land }; sound.lift(); }
  }

  /* ----- rules ----- */
  const VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
  // White's punishment for a wrong move: mate in one if it exists, otherwise
  // escape a check, otherwise the most valuable capture, otherwise any move.
  function punishment() {
    const wl = legal(board, 'w'); if (!wl.length) return null;
    for (const m of wl) { const nb = applyB(board, m); if (inCheck(nb, 'b') && legal(nb, 'b').length === 0) return { m, mate: true }; }
    if (inCheck(board, 'w')) return { m: wl.find((x) => board[x.from].t === 'K') || wl[0], escape: true };
    let best = null, bv = -1;
    for (const m of wl) { const v = board[m.to] ? VAL[board[m.to].t] : -1; if (v > bv) { bv = v; best = m; } }
    return { m: best || wl[0] };
  }

  function playerMove(from, to, dragged) {
    if (!targets(from).includes(to)) return;
    const m = { from, to }, key = sqn(from) + sqn(to), s = san(board, m), no = step + 1;
    selected = -1; locked = true;
    doMove(m, dragged);
    const sol = LV.solution[step];
    if (key === sol.b) {
      moves.push({ n: no + '…', s: s + sol.ann, c: 'b' });
      setMsg('good', sol.say);
      rings.push({ ...sqXY(m.to), t: 0 }); sound.good(Math.min(step, 2)); say('smug', 1.8);
      setStep(step + 1);
      if (step === LV.solution.length) { win(); return; }
      later(1.0, () => {
        const wm = moveOf(sol.w), ws = san(board, wm);
        moves.push({ n: (no + 1) + '.', s: ws, c: 'w' });
        doMove(wm, false); setMsg('good', sol.reply, true);
        later(0.5, () => { locked = false; });
      });
    } else wrongMove(key, s, no);
  }

  function wrongMove(key, s, no) {
    moves.push({ n: no + '…', s: s + '?', c: 'b', bad: true });
    const p = punishment(), ws = p ? san(board, p.m) : '';
    const hint = LV.hints[step + ':' + key];
    const text = hint
      || (p && p.mate ? `That does not stop the threat. White plays ${ws}.`
        : p && p.escape ? `White escapes the check with ${ws}, and ${LV.threatName} is still coming.`
          : p ? `Too slow. White plays ${ws} and the attack goes on.` : 'That is not the line. The position resets.');
    setMsg('bad', text);
    sound.wrong(); shake(14); invertT = 0.14; say('angry', 2.6); crate.om += 0.3;
    if (p) later(0.75, () => { moves.push({ n: (no + 1) + '.', s: ws, c: 'w' }); doMove(p.m, false); });
    later(2.6, () => { resetBoard(); setMsg('info', 'Position reset. The clock keeps running.'); locked = false; });
  }

  function resetBoard() {
    board = boardFrom(LV.setup, LV.number * 100); legalB = legal(board, 'b'); setStep(0); selected = -1; lastMove = null;
    moves = [{ n: '1.', s: LV.openingMove, c: 'w' }]; syncSprites(false); shake(6); sound.whoosh(0.35);
  }

  function win() {
    mode = 'over'; locked = true; const used = TIME - timeLeft;
    TH.final = 'triumph';
    later(0.3, () => { sound.win(); flash = 0.35; });
    later(1.4, () => { TH.rising = true; sound.whoosh(1.4); });
    later(3.6, () => cb.phase('won', { level: LV.number, time: used, timeText: fmt(used) }));
  }

  function timeUp() {
    mode = 'over'; locked = true; tasks = []; selected = -1;
    if (dragS) { dragS.drag = false; dragS = null; }
    TH.final = 'defeated'; setMsg('bad', 'Time is up. Thanos is sent back to the start of the level.');
    later(0.7, () => { startDust(); sound.crumble(); flash = 0.4; shake(16); });
    later(3.0, () => cb.phase('lost', null));
  }

  // Thanos → dust. Each grain follows an analytic path p(τ) = p0 + v·τ + wobble(τ),
  // so the same function can be played backwards to re-form him on retry.
  function startDust() {
    drawThanos(thG, T, E, TH);
    const im = thG.getImageData(0, 0, TH_W, TH_H).data, buckets = Array.from({ length: 16 }, () => []);
    for (let y = 0; y < TH_H; y += 4) for (let x = 0; x < TH_W; x += 4) {
      const i = (y * TH_W + x) * 4; if (im[i + 3] < 80) continue;
      const seed = Math.random() * 10;
      buckets[im[i] >> 4].push({ ox: x, oy: y, d: (TH_W - x) * 0.0016 + (TH_H - y) * 0.0004 + Math.random() * 0.5, seed, vx: 50 + 70 * Math.sin(seed) ** 2, vy: -25 - 40 * Math.cos(seed) ** 2 });
    }
    thDust = { buckets, t: 0, dir: 1 };
  }
  const dustPos = (p, t) => { const tau = Math.max(0, t - p.d); return [p.ox + p.vx * tau + 14 * Math.sin(tau * 2 + p.seed) * Math.min(1, tau), p.oy + p.vy * tau + 9 * Math.cos(tau * 1.7 + p.seed) * Math.min(1, tau)]; };

  /* ----- public flow ----- */
  function resetLevel() {
    tasks = []; parts = []; rings = []; flash = 0; TH.final = null; TH.overT = 0;
    if (TH.rising || TH.rise) { TH.rising = false; TH.rise = 0; TH.alpha = 0; }
    if (thDust) { thDust.dir = -1; thDust.t = Math.min(thDust.t, 3.2); }
    board = boardFrom(LV.setup, LV.number * 100); legalB = legal(board, 'b'); setStep(0); selected = -1; lastMove = null; dragS = null;
    timeLeft = TIME; lastSec = TIME; cb.time(TIME);
    moves = [{ n: '1.', s: LV.openingMove, c: 'w' }];
    setMsg('info', LV.intro);
    syncSprites(false);
    locked = true; later(thDust ? 1.8 : 0.8, () => { locked = false; });
  }
  function start(i) { sound.ensure(); LV = opts.levels[i] || opts.levels[0]; mode = 'play'; resetLevel(); cb.phase('play', null); }
  function resetPosition() {
    if (mode !== 'play') return;
    tasks = []; locked = true;
    if (dragS) { dragS.drag = false; dragS = null; }
    resetBoard(); setMsg('info', 'Position reset. The clock keeps running.');
    later(0.4, () => { locked = false; });
  }
  function toMenu() {
    mode = 'menu'; LV = opts.levels[0]; tasks = []; parts = []; TH.final = null;
    if (thDust) { thDust.dir = -1; thDust.t = Math.min(thDust.t, 3.2); }
    if (TH.rising || TH.rise) { TH.rising = false; TH.rise = 0; TH.alpha = 0; }
    board = boardFrom(LV.setup, LV.number * 100); legalB = legal(board, 'b'); setStep(0); lastMove = null; selected = -1;
    timeLeft = TIME; cb.time(TIME); moves = []; msg = { text: '', kind: 'info', t0: 0, keep: 0 }; syncSprites(false);
    cb.phase('menu', null);
  }

  /* ----- input ----- */
  const toV = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left - offX) / scale, y: (e.clientY - r.top - offY) / scale }; };
  const sqAt = (x, y) => { const c = Math.floor((x - BX) / SQ), r = Math.floor((y - BY) / SQ); return c < 0 || c > 7 || r < 0 || r > 7 ? -1 : r * 8 + (7 - c); };
  const onDown = (e) => {
    if (e.button !== 0) return;
    sound.ensure();
    const v = toV(e); mouse.x = v.x; mouse.y = v.y;
    if (mode !== 'play' || locked) return;
    const i = sqAt(v.x, v.y); if (i < 0) { selected = -1; return; }
    if (selected >= 0 && i !== selected && targets(selected).includes(i)) { playerMove(selected, i, false); return; }
    const p = board[i];
    if (p && p.c === 'b') { selected = i; dragFrom = i; dragS = sprites.find((s) => s.id === p.id); downPos = v; sound.lift(); try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* synthetic events */ } }
    else selected = -1;
  };
  const onMove = (e) => {
    const v = toV(e); mouse.x = v.x; mouse.y = v.y;
    if (dragS && !dragS.drag && Math.hypot(v.x - downPos.x, v.y - downPos.y) > 5) dragS.drag = true;
    let cur = 'default';
    if (mode === 'play' && !locked) {
      const i = sqAt(v.x, v.y);
      if (dragS && dragS.drag) cur = 'grabbing';
      else if (i >= 0 && board[i] && board[i].c === 'b') cur = 'grab';
      else if (i >= 0 && selected >= 0 && targets(selected).includes(i)) cur = 'pointer';
    }
    canvas.style.cursor = cur;
  };
  const onUp = () => {
    if (!dragS) return;
    const s = dragS; dragS = null;
    if (s.drag) {
      s.drag = false;
      const i = sqAt(mouse.x, mouse.y);
      if (mode === 'play' && !locked && i >= 0 && targets(dragFrom).includes(i)) playerMove(dragFrom, i, true);
    }
  };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  /* ----- update ----- */
  function update(dt) {
    T += dt;
    for (let i = tasks.length - 1; i >= 0; i--) { const k = tasks[i]; k.t -= dt; if (k.t <= 0) { tasks.splice(i, 1); k.f(); } }
    mouse.vx = lerp(mouse.vx, (mouse.x - mouse.px) / Math.max(dt, 1e-3), 0.3); mouse.px = mouse.x;

    if (mode === 'play') {
      timeLeft -= dt;
      const sec = Math.max(0, Math.ceil(timeLeft));
      if (sec !== lastSec) { lastSec = sec; cb.time(sec); if (sec <= 10 && sec > 0) sound.tick(sec <= 3); }
      sound.tension(timeLeft < 30 ? 1 : 0);
      if (timeLeft <= 0) { timeLeft = 0; timeUp(); }
    }

    // expression target → exponential smoothing
    let k = 'focus';
    if (TH.overT > 0) { TH.overT -= dt; k = TH.over; }
    else if (mode === 'over' && TH.final) k = TH.final;
    else if (mode === 'play') { if (timeLeft < 30) k = 'strain'; else if (dragS && dragS.drag) k = 'watch'; }
    const tgt = EXPR[k], f = 1 - Math.exp(-dt * 7);
    for (const key in tgt) E[key] += (tgt[key] - E[key]) * f;
    E.lit += ((mode === 'over' && TH.final === 'triumph' ? 6 : (step * 6) / LV.solution.length) - E.lit) * (1 - Math.exp(-dt * 4));
    TH.blinkT -= dt; if (TH.blinkT < 0) { TH.blink = 0.16; TH.blinkT = 2 + Math.random() * 4; }
    if (TH.blink > 0) TH.blink = Math.max(0, TH.blink - dt);
    const ex = mouse.x - CHIN.x, ey = mouse.y - (TH_Y + CHIN.y - 131 * TS), el = Math.hypot(ex, ey) || 1, mm = Math.min(1, el / 300) * 3.5;
    TH.look.x = lerp(TH.look.x, (ex / el) * mm, f); TH.look.y = lerp(TH.look.y, (ey / el) * mm * 0.6, f);
    const sw = TH.sweat;
    if (sw.wait > 0) sw.wait -= dt; else { sw.v += 260 * dt; sw.y += sw.v * dt; if (sw.y > -95) { sw.y = -205; sw.v = 0; sw.wait = 0.6 + Math.random(); } }
    if (TH.rising) TH.rise += dt;
    if (!TH.rising && TH.alpha < 1) TH.alpha = Math.min(1, TH.alpha + dt * 1.2);

    // pieces: springs, projectile hops, ballistic captures
    for (const s of sprites) {
      if (s.flying) {
        s.vy += 1800 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.ang += s.av * dt;
        const gy = hillY(s.x) - 14;
        if (s.y > gy && s.vy > 0) { s.y = gy; s.vy *= -0.38; s.vx *= 0.7; s.av *= 0.6; if (Math.abs(s.vy) < 60) s.vy = 0; }
        s.life -= dt; continue;
      }
      s.sqT += dt;
      if (s.hop) {
        const h = s.hop; h.t = Math.min(1, h.t + dt / h.dur);
        const e = h.t < 0.5 ? 2 * h.t * h.t : 1 - (-2 * h.t + 2) ** 2 / 2;
        s.x = lerp(h.x0, h.x1, e); s.y = lerp(h.y0, h.y1, e);
        s.lift = h.h * 4 * h.t * (1 - h.t);
        s.ang = Math.sin(h.t * Math.PI) * 0.15 * Math.sign(h.x1 - h.x0); s.vx = s.vy = 0;
        if (h.t >= 1) { s.lift = 0; s.ang = 0; s.hop = null; h.cb && h.cb(); }
        continue;
      }
      const kS = s.drag ? 900 : 170, zeta = s.drag ? 0.6 : 0.42, c = 2 * Math.sqrt(kS) * zeta;
      const tx = s.drag ? mouse.x : s.tx, ty = s.drag ? mouse.y : s.ty;
      s.vx += (-kS * (s.x - tx) - c * s.vx) * dt; s.vy += (-kS * (s.y - ty) - c * s.vy) * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.lift = lerp(s.lift, s.drag ? 14 : 0, 1 - Math.exp(-dt * 14));
      s.ang = lerp(s.ang, clamp(s.vx * 0.0005, -0.45, 0.45), Math.min(1, dt * 12));
    }
    sprites = sprites.filter((s) => !s.flying || s.life > 0);

    // pendulum crate: θ'' = −(g/L)·sinθ − bθ' + wind
    for (let i = 0; i < 4; i++) { const h = dt / 4, wind = 0.25 * Math.sin(T * 0.7) + 0.15 * Math.sin(T * 1.9 + 1); crate.om += (-(980 / crate.L) * Math.sin(crate.th) - 0.35 * crate.om + wind * 0.6) * h; crate.th += crate.om * h; }

    // verlet vines
    const lm = { x: mouse.x - vineOff.x, y: mouse.y - vineOff.y };
    for (const v of vines) {
      const wind = 120 * Math.sin(T * 0.8 + v.k) + 60 * Math.sin(T * 2.1 + v.k * 3);
      for (let i = 1; i < v.pts.length; i++) {
        const p = v.pts[i], vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
        p.px = p.x; p.py = p.y; p.x += vx + wind * dt * dt; p.y += vy + 900 * dt * dt;
        const dx = p.x - lm.x, dy = p.y - lm.y, d = Math.hypot(dx, dy);
        if (d < 60 && d > 0.1) { p.x += (dx / d) * (60 - d) * 0.25; p.y += (dy / d) * (60 - d) * 0.25; }
      }
      for (let it = 0; it < 6; it++) {
        v.pts[0].x = v.a.x; v.pts[0].y = v.a.y;
        for (let i = 0; i < v.pts.length - 1; i++) {
          const a = v.pts[i], b = v.pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, diff = (d - v.seg) / d;
          if (i === 0) { b.x -= dx * diff; b.y -= dy * diff; }
          else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
        }
      }
    }
    // grass: damped springs driven by wind + cursor
    for (const b of blades) {
      const wind = 0.1 * Math.sin(T * 1.2 + b.x * 0.006) + 0.05 * Math.sin(T * 2.7 + b.x * 0.031);
      let push = 0; const dx = b.x - mouse.x, dy = b.y - b.h * 0.5 - mouse.y, d = Math.hypot(dx, dy);
      if (d < 90) push = Math.sign(dx) * (1 - d / 90) * (0.25 + Math.min(1, Math.abs(mouse.vx) / 900) * 0.9);
      b.av += (-b.k * (b.a - (b.rest + wind + push)) - b.c * b.av) * dt; b.a += b.av * dt;
    }
    for (const m2 of motes) {
      m2.vx += (Math.random() - 0.5) * 40 * dt; m2.vy += (Math.random() - 0.5) * 40 * dt - 2 * dt;
      m2.vx *= 0.99; m2.vy *= 0.99; m2.x += m2.vx * dt; m2.y += m2.vy * dt;
      if (m2.x < 0) m2.x += W; if (m2.x > W) m2.x -= W; if (m2.y < 0) m2.y += H; if (m2.y > H) m2.y -= H;
    }
    for (const p of parts) { p.vy += p.grav * dt; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    parts = parts.filter((p) => p.life > 0);
    for (const r of rings) r.t += dt;
    while (rings.length && rings[0].t > 0.9) rings.shift();
    if (thDust) { thDust.t += dt * thDust.dir * (thDust.dir < 0 ? 2 : 1); if (thDust.dir < 0 && thDust.t <= 0) thDust = null; }
    shakeT += dt; flash *= Math.exp(-dt * 2.5); invertT = Math.max(0, invertT - dt);
  }

  /* ----- render ----- */
  function drawFog(tex, off, y, h, alpha, px) {
    const tw = W, x0 = -(((off % tw) + tw) % tw) + px;
    ctx.globalAlpha = alpha; for (let x = x0 - tw; x < W; x += tw) ctx.drawImage(tex, x, y, tw, h); ctx.globalAlpha = 1;
  }
  function drawBoard() {
    const st = shakeT, sx = shakeA * Math.exp(-7 * st) * Math.sin(45 * st), sy = shakeA * 0.4 * Math.exp(-7 * st) * Math.cos(38 * st);
    ctx.save(); ctx.translate(sx, sy);
    ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
    ctx.drawImage(A.boardC, BX - FR, BY - FR);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    if (lastMove) for (const i of [lastMove.from, lastMove.to]) { const c = sqXY(i); ctx.fillStyle = isLight(i) ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.14)'; ctx.fillRect(c.x - SQ / 2, c.y - SQ / 2, SQ, SQ); }
    for (const col of ['w', 'b']) if (inCheck(board, col)) {
      const k = sqXY(board.findIndex((p) => p && p.c === col && p.t === 'K'));
      const rg = ctx.createRadialGradient(k.x, k.y, 4, k.x, k.y, SQ * 0.7); rg.addColorStop(0, 'rgba(255,255,255,.9)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(k.x - SQ / 2, k.y - SQ / 2, SQ, SQ);
    }
    if (mode === 'play' && step === 0 && !locked && LV.threat) {
      const a = sqXY(sqi(LV.threat[0])), b = sqXY(sqi(LV.threat[1])), al = 0.35 + 0.25 * Math.sin(T * 3);
      ctx.save(); ctx.setLineDash([7, 7]); ctx.lineDashOffset = -T * 30; ctx.lineWidth = 3; ctx.strokeStyle = `rgba(10,10,10,${al})`;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(b.x, b.y, SQ * 0.38, 0, TAU); ctx.stroke(); ctx.restore();
    }
    const from = dragS && dragS.drag ? dragFrom : selected;
    if (from >= 0 && mode === 'play') {
      const c = sqXY(from); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(c.x - SQ / 2, c.y - SQ / 2, SQ, SQ);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(c.x - SQ / 2 + 2.5, c.y - SQ / 2 + 2.5, SQ - 5, SQ - 5);
      const hov = sqAt(mouse.x, mouse.y);
      for (const to of targets(from)) {
        const t = sqXY(to), lt = isLight(to);
        if (to === hov) { ctx.fillStyle = lt ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.18)'; ctx.fillRect(t.x - SQ / 2, t.y - SQ / 2, SQ, SQ); }
        if (board[to]) { ctx.strokeStyle = lt ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(t.x, t.y, SQ * 0.44, 0, TAU); ctx.stroke(); }
        else { ctx.fillStyle = lt ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.42)'; ctx.beginPath(); ctx.arc(t.x, t.y, 8 + Math.sin(T * 4 + to) * 1.2, 0, TAU); ctx.fill(); }
      }
    }
    for (const r of rings) { const p = r.t / 0.9; ctx.strokeStyle = `rgba(255,255,255,${(1 - p) * 0.9})`; ctx.lineWidth = 3 * (1 - p) + 0.5; ctx.beginPath(); ctx.arc(r.x, r.y, 10 + p * 110, 0, TAU); ctx.stroke(); }
    const u = SQ * 0.92, list = sprites.filter((s) => !s.flying).sort((a, b) => (a.drag || a.hop ? 1 : 0) - (b.drag || b.hop ? 1 : 0));
    for (const s of list) { const k = clamp(1 - s.lift / 120, 0.3, 1); ctx.fillStyle = `rgba(0,0,0,${0.35 * k})`; ctx.beginPath(); ctx.ellipse(s.x + s.lift * 0.25, s.y + u * 0.36, u * 0.28 * k, u * 0.07 * k, 0, 0, TAU); ctx.fill(); }
    for (const s of list) {
      const sq = s.sqT < 1 ? Math.exp(-8 * s.sqT) * Math.cos(28 * s.sqT) * 0.14 : 0;   // damped squash on landing
      drawPiece(ctx, s.t, s.c, s.x, s.y - s.lift + u * 0.38 * sq, s.ang, u, 1 + sq * 0.6, 1 - sq);
    }
    if (invertT > 0) { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(BX, BY, BS, BS); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
  }
  function drawThanosLayer() {
    if (thDust) {
      const t = thDust.t;
      thDust.buckets.forEach((bk, i) => {
        const v = i * 17; ctx.fillStyle = `rgb(${v},${v},${v})`;
        for (const p of bk) {
          const a = t < p.d ? 1 : Math.max(0, 1 - (t - p.d) / 2.2); if (a <= 0) continue;
          const [x, y] = dustPos(p, t); ctx.globalAlpha = a; const sz = t < p.d ? 4 : 2.5; ctx.fillRect(TH_X + x, TH_Y + y, sz, sz);
        }
      });
      ctx.globalAlpha = 1; return;
    }
    // ascension: eased rise y = −520·e³ with a beam of light
    const e = Math.min(1, TH.rise / 2.2), lift = 520 * e * e * e, al = TH.alpha * (1 - e);
    if (TH.rising) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const bw = 220 * Math.sin(Math.PI * Math.min(1, TH.rise / 2.4)), gr = ctx.createLinearGradient(CHIN.x - bw, 0, CHIN.x + bw, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(CHIN.x - bw, 0, bw * 2, H); ctx.restore();
    }
    if (al <= 0.01) return;
    drawThanos(thG, T, E, TH);
    ctx.globalAlpha = al; ctx.drawImage(thC, TH_X, TH_Y - lift); ctx.globalAlpha = 1;
    const gx = CHIN.x + 312 * TS, gy = TH_Y + CHIN.y - (175 + E.lit * 3) * TS - lift, gl = (0.2 + E.lit / 6) * (0.6 + 0.4 * Math.sin(T * 2.2));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(gx, gy - 20, 0, gx, gy - 20, 130); rg.addColorStop(0, `rgba(255,255,255,${0.16 * gl * al})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(gx - 130, gy - 150, 260, 260); ctx.restore();
  }
  function drawGround() {
    ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 10; x += 10) ctx.lineTo(x, hillY(x)); ctx.lineTo(W + 10, H + 10); ctx.fill();
    ctx.beginPath();
    for (const b of blades) {
      const tx = b.x + Math.sin(b.a) * b.h, ty = b.y - Math.cos(b.a) * b.h, cx = b.x + Math.sin(b.a * 0.5) * b.h * 0.5, cy = b.y - b.h * 0.55, w = b.tall ? 1.2 : 1.8;
      ctx.moveTo(b.x - w, b.y); ctx.quadraticCurveTo(cx, cy, tx, ty); ctx.quadraticCurveTo(cx + w, cy, b.x + w, b.y);
    }
    ctx.fill();
    for (const b of blades) if (b.tall) { ctx.beginPath(); ctx.ellipse(b.x + Math.sin(b.a) * b.h, b.y - Math.cos(b.a) * b.h, 2.5, 9, b.a, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#070707'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const l0 = hillY(1370), r0 = hillY(1418);
    ctx.beginPath(); ctx.moveTo(1370, l0 + 10); ctx.lineTo(1380, 540); ctx.moveTo(1418, r0 + 10); ctx.lineTo(1426, 540);
    for (let y = 566; y < Math.min(l0, r0); y += 30) { const k = (y - 540) / (l0 - 540); ctx.moveTo(lerp(1380, 1370, k) - 3, y); ctx.lineTo(lerp(1426, 1418, k) + 3, y + 2); }
    ctx.stroke();
  }
  // side panel: progress + move list (first-version style)
  function drawPanel() {
    if (mode === 'menu') return;
    const n = LV.solution.length, cx = PX + PW / 2;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 10;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `15px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.88)';
    ctx.fillText(`MOVE ${Math.min(step + 1, n)} OF ${n}`, cx, BY + 6);
    for (let i = 0; i < n; i++) {
      const x = cx - ((n - 1) * 20) / 2 + i * 20; ctx.beginPath(); ctx.arc(x, BY + 22, 4.5, 0, TAU);
      if (i < step) ctx.fill(); else { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    ctx.restore();
    const py = BY + 44, ph = 40 + Math.max(4, moves.length) * 30;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(PX, py, PW, ph);
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.strokeRect(PX + 0.5, py + 0.5, PW - 1, ph - 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `13px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText('MOVES', PX + 16, py + 24);
    ctx.font = `19px ${FONT}`;
    moves.forEach((l, i) => {
      const y = py + 54 + i * 30; ctx.fillStyle = l.c === 'b' ? '#ffffff' : 'rgba(255,255,255,.55)';
      ctx.fillText(l.n, PX + 16, y); ctx.fillText(l.s, PX + 62, y);
      if (l.bad) { const w = ctx.measureText(l.s).width; ctx.fillRect(PX + 62, y - 6, w, 1.5); }
    });
  }
  function wrapText(text, maxW) {
    const words = text.split(' '), lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line); return lines;
  }
  // feedback under the board, revealed with a typewriter
  function drawMsg() {
    if (!msg.text || mode === 'menu') return;
    ctx.save(); ctx.font = `21px ${FONT}`;
    const lines = wrapText(msg.text, 540), lh = 27, top = 628, cx = BX + BS / 2;
    let n = Math.min(msg.text.length, msg.keep + Math.floor((T - msg.t0) * 60));
    if (msg.kind === 'bad') {
      ctx.fillStyle = '#efefef'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 20;
      ctx.fillRect(cx - 290, top - 25, 580, lines.length * lh + 20); ctx.shadowBlur = 0; ctx.fillStyle = '#0a0a0a';
    } else { ctx.fillStyle = msg.kind === 'good' ? '#ffffff' : 'rgba(240,240,240,.85)'; ctx.shadowColor = 'rgba(0,0,0,.95)'; ctx.shadowBlur = 12; }
    ctx.textAlign = 'left';
    lines.forEach((ln, i) => {
      const shown = ln.slice(0, Math.max(0, n)); n -= ln.length + 1; if (!shown) return;
      ctx.fillText(shown, cx - ctx.measureText(ln).width / 2, top + i * lh);
    });
    ctx.restore();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offX * dpr, offY * dpr);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    const px = (mouse.x - W / 2) / W, py = (mouse.y - H / 2) / H;
    ctx.drawImage(A.bgFar, -M - px * 18, -M - py * 10);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const r of RAYS) {
      const a = r.a * (0.6 + 0.4 * Math.sin(T * r.f + r.p)) * (0.85 + 0.15 * Math.sin(T * 3.1 + r.p * 2));
      const gr = ctx.createLinearGradient(r.x, 0, r.x + r.dx, H); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(r.x - r.w * 0.3, -10); ctx.lineTo(r.x + r.w * 0.3, -10); ctx.lineTo(r.x + r.dx + r.w, H); ctx.lineTo(r.x + r.dx - r.w, H); ctx.fill();
    }
    ctx.restore();
    drawFog(A.fogA, T * 10, 200, 520, 0.32, -px * 30);
    const tox = -px * 36, toy = -py * 16;
    ctx.drawImage(A.treeL, -M + tox, -M + toy);
    vineOff = { x: tox, y: toy };
    ctx.save(); ctx.translate(tox, toy); ctx.strokeStyle = '#111'; ctx.fillStyle = '#111'; ctx.lineCap = 'round';
    for (const v of vines) {
      for (let i = 0; i < v.pts.length - 1; i++) { ctx.lineWidth = 4 - i * 0.22; ctx.beginPath(); ctx.moveTo(v.pts[i].x, v.pts[i].y); ctx.lineTo(v.pts[i + 1].x, v.pts[i + 1].y); ctx.stroke(); }
      const e = v.pts[v.pts.length - 1]; ctx.beginPath(); ctx.ellipse(e.x, e.y + 6, 5, 11, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.save(); ctx.translate(crate.px + tox, crate.py); ctx.rotate(crate.th);
    ctx.strokeStyle = '#121212'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, crate.L - 14); ctx.lineTo(-26, crate.L + 4); ctx.moveTo(0, crate.L - 14); ctx.lineTo(26, crate.L + 4); ctx.stroke();
    ctx.translate(0, crate.L); ctx.lineWidth = 8; ctx.strokeRect(-28, 4, 56, 56);
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-10, 8); ctx.lineTo(-10, 56); ctx.moveTo(12, 8); ctx.lineTo(12, 56); ctx.moveTo(-3, 56); ctx.lineTo(9, 10); ctx.stroke();
    ctx.restore();
    drawBoard();
    drawThanosLayer();
    drawGround();
    const u = SQ * 0.92;
    for (const s of sprites) if (s.flying) { ctx.globalAlpha = clamp(s.life / 0.6, 0, 1); drawPiece(ctx, s.t, s.c, s.x, s.y, s.ang, u); }
    ctx.globalAlpha = 1;
    drawFog(A.fogB, T * 22, 560, 220, 0.2, 0);
    for (const p of parts) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * p.a; ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.size, p.size); }
    ctx.fillStyle = '#fff';
    for (const m2 of motes) { ctx.globalAlpha = 0.1 + 0.12 * Math.sin(T * 1.3 + m2.ph); ctx.beginPath(); ctx.arc(m2.x, m2.y, m2.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    drawPanel();
    drawMsg();
    ctx.drawImage(A.vig, 0, 0);
    ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = grains[Math.floor(T * 60) % 3];
    ctx.translate(Math.random() * 220, Math.random() * 220); ctx.fillRect(-220, -220, W + 440, H + 440); ctx.restore();
    ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.03})`; ctx.fillRect(0, 0, W, H);
    if (flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  let last = performance.now();
  const frame = (now) => { if (!alive) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); render(); raf = requestAnimationFrame(frame); };
  raf = requestAnimationFrame(frame);

  return {
    sound,
    start, resetPosition, toMenu,
    resize(w, h) {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
      scale = Math.min(w / W, h / H); offX = (w - W * scale) / 2; offY = (h - H * scale) / 2;
    },
    destroy() {
      alive = false; cancelAnimationFrame(raf); sound.destroy();
      canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
    },
  };
}

/* =============================================================================
   STYLES (scoped with the bnw- prefix)
   ============================================================================= */
const CSS = `
.bnw-root{--ink:#f1f1f1;--dim:rgba(241,241,241,.55);--line:rgba(255,255,255,.18);--red:#ff2424;
  position:relative;width:100%;height:100vh;min-height:560px;background:#000;color:var(--ink);font-family:'IM Fell English',Georgia,serif;
  display:grid;grid-template-rows:auto 1fr;overflow:hidden;-webkit-user-select:none;user-select:none}
.bnw-root *{box-sizing:border-box}
.bnw-top{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;min-height:72px;padding:8px 20px;border-bottom:1px solid var(--line);background:#050505;z-index:2}
.bnw-brand{display:flex;align-items:baseline;gap:14px;font-family:${FONT};white-space:nowrap;overflow:hidden}
.bnw-logo{font-size:34px;letter-spacing:.04em}.bnw-logo small,.bnw-big .n{font-family:'IM Fell English',Georgia,serif}.bnw-logo .w{color:transparent;-webkit-text-stroke:1px var(--ink)}
.bnw-lv{font-size:14px;letter-spacing:.3em;color:var(--dim)}
.bnw-timer{display:flex;flex-direction:column;align-items:center;min-width:220px}
.bnw-clock{font-family:${FONT};font-size:44px;line-height:1;letter-spacing:.06em;font-variant-numeric:tabular-nums;transition:color .3s}
.bnw-bar{width:200px;height:3px;background:var(--line);margin-top:6px;overflow:hidden}
.bnw-bar>i{display:block;height:100%;background:var(--ink);transition:width 1s linear,background .3s}
.bnw-timer.low .bnw-clock{color:var(--red);text-shadow:0 0 18px rgba(255,36,36,.85);animation:bnw-flash .5s steps(1) infinite}
.bnw-timer.low .bnw-bar>i{background:var(--red)}
@keyframes bnw-flash{50%{opacity:.25}}
.bnw-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:nowrap}
.bnw-hb{white-space:nowrap;font-family:${FONT};font-size:13px;letter-spacing:.22em;padding:8px 13px;color:#ddd;background:transparent;border:1px solid rgba(255,255,255,.35);cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:background .2s,color .2s}
.bnw-hb:hover:not(:disabled),.bnw-hb:focus-visible{background:#eee;color:#000;outline:none}
.bnw-hb:disabled{opacity:.35;cursor:default}
.bnw-hb[aria-pressed="true"]{border-style:dashed}
.bnw-body{display:grid;grid-template-columns:1fr;min-height:0}
.bnw-stage{position:relative;min-width:0;min-height:0}
.bnw-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.bnw-ov{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:16px;
  background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,.25),rgba(0,0,0,.9) 72%);font-family:${FONT}}
.bnw-big{font-size:clamp(84px,13vw,190px);line-height:.85;letter-spacing:.04em;text-shadow:0 0 50px rgba(255,255,255,.25)}
.bnw-big .n{font-size:.42em;vertical-align:.4em;margin:0 .04em;opacity:.8}.bnw-big .w{color:transparent;-webkit-text-stroke:2px var(--ink)}
.bnw-h2{font-size:clamp(44px,6vw,84px);letter-spacing:.1em;line-height:1}
.bnw-sub{font-size:20px;letter-spacing:.45em;color:var(--dim)}
.bnw-line{font-family:'IM Fell English',Georgia,serif;font-style:italic;font-size:20px;max-width:620px;line-height:1.45;color:#d8d8d8}
.bnw-btn{position:relative;isolation:isolate;overflow:hidden;width:270px;padding:13px 0;font-family:${FONT};font-size:20px;letter-spacing:.35em;text-indent:.35em;color:#eee;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.55);cursor:pointer;transition:color .35s}
.bnw-btn::before{content:"";position:absolute;inset:0;z-index:-1;background:#f2f2f2;transform:scaleX(0);transform-origin:left;transition:transform .4s cubic-bezier(.7,0,.2,1)}
.bnw-btn:hover:not(:disabled),.bnw-btn:focus-visible{color:#000;outline:none}
.bnw-btn:hover:not(:disabled)::before,.bnw-btn:focus-visible::before{transform:scaleX(1)}
.bnw-btn:disabled{opacity:.35;cursor:default}
.bnw-panel{max-width:660px;width:100%;padding:34px 42px;background:rgba(0,0,0,.88);border:1px solid rgba(255,255,255,.35);text-align:left;font-family:'IM Fell English',Georgia,serif}
.bnw-panel h2{font-family:${FONT};font-weight:400;font-size:34px;letter-spacing:.2em;margin:0 0 20px;text-align:center}
.bnw-panel ol{padding-left:24px;font-size:18px;line-height:1.5;margin:0}.bnw-panel li{margin-bottom:8px}
.bnw-panel .row{display:flex;justify-content:center;margin-top:22px}
.bnw-block{position:absolute;inset:0;z-index:50;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:24px;font-family:${FONT}}
@media (max-width:1280px){.bnw-lv{display:none}}
@media (max-width:1050px){.bnw-top{gap:10px;padding:8px 12px}.bnw-hb{font-size:11px;letter-spacing:.1em;padding:6px 8px;gap:5px}.bnw-clock{font-size:36px}.bnw-timer{min-width:150px}.bnw-bar{width:140px}.bnw-logo{font-size:28px}}
`;

/* =============================================================================
   ICONS (inline, monochrome)
   ============================================================================= */
const SpeakerIcon = ({ muted }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
    {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19.5 5.5a9 9 0 0 1 0 13" /></>}
  </svg>
);

/* =============================================================================
   COMPONENT
   ============================================================================= */

export default function BnWGame({ timeLimit = 120, onLevelComplete, onGameComplete, onExit }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const mutedRef = useRef(false);
  const cbRef = useRef({});
  cbRef.current = { onLevelComplete, onGameComplete };

  const [phase, setPhase] = useState('menu');      // menu | play | won | victory | lost | bye
  const [levelIdx, setLevelIdx] = useState(0);
  // Progress lives only for this run: a fresh game always begins at Level 1, and once Level 1 is solved it stays solved.
  const [unlocked, setUnlocked] = useState(1);
  const timesRef = useRef([]);
  const [time, setTime] = useState(timeLimit);
  const [muted, setMuted] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [stats, setStats] = useState(null);

  const desktop = useMemo(() => typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(any-pointer: fine)').matches, []);

  // font + styles
  useEffect(() => {
    if (!document.getElementById('bnw-font')) {
      const l = document.createElement('link'); l.id = 'bnw-font'; l.rel = 'stylesheet'; l.href = FONT_URL; document.head.appendChild(l);
    }
    if (document.fonts) document.fonts.load(`16px ${FONT}`).then(() => getAssets().paintBoard()).catch(() => {});
  }, []);

  // engine lifecycle
  useEffect(() => {
    const eng = createEngine(canvasRef.current, {
      time: setTime,
      phase: (p, st) => {
        if (st) setStats(st);
        if (p === 'won') {
          const idx = st.level - 1;
          timesRef.current[idx] = st.time;
          if (cbRef.current.onLevelComplete) cbRef.current.onLevelComplete(st);
          if (idx + 1 < LEVELS.length) {
            setUnlocked((u) => Math.max(u, idx + 2));
          } else {
            p = 'victory';
            if (cbRef.current.onGameComplete) cbRef.current.onGameComplete({ times: timesRef.current.slice() });
          }
        }
        setPhase(p);
      },
    }, { timeLimit, levels: LEVELS });
    eng.sound.setMuted(mutedRef.current);
    engineRef.current = eng;
    const el = stageRef.current;
    const fit = () => { const r = el.getBoundingClientRect(); eng.resize(r.width, r.height); };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => { ro.disconnect(); eng.destroy(); engineRef.current = null; };
  }, [timeLimit]);

  const toggleSound = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    const eng = engineRef.current;
    if (eng) { eng.sound.setMuted(next); if (!next) eng.sound.ensure(); }
    setMuted(next);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.key === 'm' || e.key === 'M') toggleSound();
      if (e.key === 'Escape') setRulesOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSound]);

  const start = (idx) => {
    if (idx === 0) timesRef.current = [];
    setRulesOpen(false); setStats(null); setLevelIdx(idx);
    engineRef.current && engineRef.current.start(idx);
  };
  const newRun = () => { setUnlocked(1); start(0); };
  const resetLevel = () => engineRef.current && engineRef.current.resetPosition();
  const exit = () => {
    setRulesOpen(false);
    if (phase === 'play' || phase === 'won' || phase === 'victory' || phase === 'lost') { engineRef.current && engineRef.current.toMenu(); return; }
    if (onExit) { onExit(); return; }
    try { window.close(); } catch (_) { /* ignored */ }
    setTimeout(() => setPhase('bye'), 150);
  };

  const LV = LEVELS[levelIdx];
  const low = phase === 'play' && time < 30;
  const pct = Math.max(0, Math.min(100, (time / timeLimit) * 100));

  return (
    <div className="bnw-root">
      <style>{CSS}</style>

      <header className="bnw-top">
        <div className="bnw-brand">
          <span className="bnw-logo">B<small>n</small><span className="w">W</span></span>
          <span className="bnw-lv">LEVEL {LV.number} · {LV.title.toUpperCase()} · BLACK TO MOVE</span>
        </div>
        <div className={`bnw-timer${low ? ' low' : ''}`} role="timer" aria-live="off" aria-label={`Time left ${fmt(time)}`}>
          <div className="bnw-clock">{fmt(time)}</div>
          <div className="bnw-bar"><i style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="bnw-actions">
          <button className="bnw-hb" onClick={resetLevel} disabled={phase !== 'play'}>Reset Level</button>
          <button className="bnw-hb" onClick={() => setRulesOpen(true)}>Rules</button>
          <button className="bnw-hb" onClick={toggleSound} aria-pressed={muted} title="Toggle sound (M)">
            <SpeakerIcon muted={muted} />{muted ? 'Sound Off' : 'Sound On'}
          </button>
          <button className="bnw-hb" onClick={exit}>Exit</button>
        </div>
      </header>

      <div className="bnw-body">
        <div className="bnw-stage" ref={stageRef}>
          <canvas ref={canvasRef} aria-label="Chessboard seen from Black's side, with Thanos at the bottom left and the move list on the right" />

          {phase === 'menu' && (
            <div className="bnw-ov">
              <div className="bnw-big">B<span className="n">n</span><span className="w">W</span></div>
              <div className="bnw-sub">{LEVELS.length} LEVELS</div>
              <div className="bnw-line">You are Thanos. Escape the mate. Two minutes per board.</div>
              {unlocked >= 2
                ? <button className="bnw-btn" onClick={() => start(1)}>Continue · Level 2</button>
                : <button className="bnw-btn" onClick={() => start(0)}>Start</button>}
              <button className="bnw-btn" onClick={() => setRulesOpen(true)}>Rules</button>
              <button className="bnw-btn" onClick={exit}>Exit</button>
            </div>
          )}

          {phase === 'won' && (
            <div className="bnw-ov">
              <div className="bnw-h2">LEVEL {LV.number} COMPLETE</div>
              <div className="bnw-line">Checkmate. The stones answer. Thanos advances to Level {LV.number + 1}.</div>
              <div className="bnw-sub" style={{ fontSize: 15 }}>SOLVED IN {stats ? stats.timeText : ''} · LEVEL {LV.number + 1} UNLOCKED</div>
              <button className="bnw-btn" onClick={() => start(levelIdx + 1)} autoFocus>Level {LV.number + 1} →</button>
              <button className="bnw-btn" onClick={() => start(levelIdx)}>Replay</button>
              <button className="bnw-btn" onClick={exit}>Menu</button>
            </div>
          )}

          {phase === 'victory' && (
            <div className="bnw-ov">
              <div className="bnw-big" style={{ fontSize: 'clamp(64px,10vw,150px)' }}>VICTORY</div>
              <div className="bnw-line">Every board has fallen. The gauntlet is complete. Thanos is inevitable.</div>
              <div className="bnw-sub" style={{ fontSize: 15 }}>
                {LEVELS.map((l, i) => (timesRef.current[i] != null ? `LEVEL ${l.number} · ${fmt(timesRef.current[i])}` : null)).filter(Boolean).join('   ·   ')}
              </div>
              <button className="bnw-btn" onClick={newRun} autoFocus>Play Again</button>
              <button className="bnw-btn" onClick={exit}>Menu</button>
            </div>
          )}

          {phase === 'lost' && (
            <div className="bnw-ov">
              <div className="bnw-h2">TIME’S UP</div>
              <div className="bnw-line">Thanos crumbles to dust and is sent back to the start of Level {LV.number}.</div>
              <button className="bnw-btn" onClick={() => start(levelIdx)} autoFocus>Retry</button>
              <button className="bnw-btn" onClick={exit}>Menu</button>
            </div>
          )}

          {phase === 'bye' && (
            <div className="bnw-ov">
              <div className="bnw-h2">BnW</div>
              <div className="bnw-line">The board rests. You can close this tab now.</div>
              <button className="bnw-btn" onClick={() => setPhase('menu')}>Back</button>
            </div>
          )}

          {rulesOpen && (
            <div className="bnw-ov" style={{ zIndex: 20 }} onClick={(e) => e.target === e.currentTarget && setRulesOpen(false)}>
              <div className="bnw-panel" role="dialog" aria-modal="true" aria-label="Rules">
                <h2>RULES</h2>
                <ol>{RULES.map((r) => <li key={r}>{r}</li>)}</ol>
                {phase === 'play' && <p className="bnw-p" style={{ textAlign: 'center', color: '#999' }}>The clock keeps running while this is open.</p>}
                <div className="row"><button className="bnw-btn" onClick={() => setRulesOpen(false)} autoFocus>Close</button></div>
              </div>
            </div>
          )}
        </div>

      </div>

      {!desktop && (
        <div className="bnw-block">
          <div className="bnw-h2">BnW</div>
          <div className="bnw-line">This game is made for computers only. Please open it on a desktop or laptop with a mouse.</div>
        </div>
      )}
    </div>
  );
}
