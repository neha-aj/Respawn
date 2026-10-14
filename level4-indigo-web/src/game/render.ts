/* ============================================================================
   "Vector Nebula" renderer: soft nebula clouds (after the reference image) +
   crisp glowing wireframe. Glow strokes go to a layer that is blurred and
   added back (bloom), matching the Python build.
   ============================================================================ */
import { C, GATE_W, GATE_X, GATE_Y, H, LIVES, SAFE_GATE_SPEED, SHOTS, TOP, W } from './config';
import type { IndigoGame, Mood } from './sim';

type C2D = CanvasRenderingContext2D;
export const FONT = '"Exo 2", "Agency FB", Bahnschrift, sans-serif';
const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function line(g: C2D, a: { x: number; y: number }, b: { x: number; y: number }, col: string, lw: number) { g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
function circle(g: C2D, x: number, y: number, r: number, col: string, lw = 0) { g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); if (lw) { g.strokeStyle = col; g.lineWidth = lw; g.stroke(); } else { g.fillStyle = col; g.fill(); } }
function poly(g: C2D, pts: { x: number; y: number }[], col: string, lw = 0) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); if (lw) { g.strokeStyle = col; g.lineWidth = lw; g.stroke(); } else { g.fillStyle = col; g.fill(); } }

/** Soft nebula: a bright violet cloud on the left, deep indigo on the right, stars, and a perspective grid for depth. */
function buildNebula() {
  const rnd = seeded(5), gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  const c = mk(), g = c.getContext('2d')!;
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  g.filter = 'blur(28px)';
  const blobs: [number, number, string, number][] = [[160, 280, C.mid, 240], [360, 380, C.soft, 150], [600, 440, C.deep, 280], [760, 240, C.mid, 160], [240, 560, C.laser, 136], [680, 520, C.ship, 200]];
  for (const [cx, cy, col, r] of blobs) for (let k = 0; k < 14; k++) {
    const rr = r * (0.3 + rnd() * 0.5); g.fillStyle = rgba(col, 0.09);
    g.beginPath(); g.arc(cx + gauss() * r * 0.5, cy + gauss() * r * 0.3, rr, 0, Math.PI * 2); g.fill();
  }
  g.filter = 'none';
  for (let i = 0; i < 260; i++) { g.fillStyle = [C.soft, C.pale, C.lilac, C.deep][Math.floor(rnd() * 4)]; g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 1, 1); }
  const hz = 470; g.strokeStyle = rgba(C.grid, 0.9); g.lineWidth = 1;
  for (let k = -14; k <= 14; k++) { g.beginPath(); g.moveTo(W / 2 + k * 18, hz); g.lineTo(W / 2 + k * 160, H); g.stroke(); }
  for (let k = 1; k < 12; k++) { const y = hz + (H - hz) * (k / 12) ** 2; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  return c;
}

/** Thanos in an astronaut helmet; the expression follows the game's mood. */
export function drawHelmetThanos(g: C2D, x: number, y: number, r: number, mood: Mood, t: number) {
  const brow = { calm: 0.2, focus: 0.6, alarm: -0.6, hurt: -0.8, smug: 0.1, triumph: 0 }[mood];
  const mouth = { calm: 0, focus: -0.2, alarm: -0.7, hurt: -0.9, smug: 0.6, triumph: 1 }[mood];
  circle(g, x, y, r, C.deep); circle(g, x, y, r, C.soft, Math.max(2, r / 9));
  const fr = r * 0.62;
  g.beginPath(); g.ellipse(x, y + r * 0.05, fr * 0.625, fr * 0.8, 0, 0, Math.PI * 2); g.fillStyle = C.laser; g.fill(); g.strokeStyle = C.portal; g.lineWidth = Math.max(1, r / 20); g.stroke();
  for (const k of [-1, 0, 1]) line(g, { x: x + k * fr * 0.18, y: y + fr * 0.45 }, { x: x + k * fr * 0.22, y: y + fr * 0.7 }, C.mid, Math.max(1, r / 30));
  for (const s of [-1, 1]) {
    line(g, { x: x + s * fr * 0.08, y: y - fr * 0.18 + brow * fr * 0.18 }, { x: x + s * fr * 0.5, y: y - fr * 0.3 - brow * fr * 0.08 }, C.bg, Math.max(2, r / 14));
    const ey = y - fr * 0.06, ew = fr * (mood === 'alarm' ? 0.16 : 0.12), ex = x + s * fr * 0.28;
    if (mood === 'triumph') { g.strokeStyle = C.white; g.lineWidth = Math.max(1, r / 25); g.beginPath(); g.arc(ex, ey, ew, Math.PI + 0.3, 2 * Math.PI - 0.3); g.stroke(); }
    else { g.beginPath(); g.ellipse(ex, ey, ew, ew * (mood === 'alarm' ? 0.8 : 0.55), 0, 0, Math.PI * 2); g.fillStyle = C.white; g.fill(); }
  }
  const mw = fr * 0.36, my = y + fr * 0.3;
  g.beginPath();
  for (let k = 0; k <= 6; k++) { const u = (k / 6) * 2 - 1, px = x + u * mw, py = my - mouth * fr * 0.12 * (1 - u * u); k ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.strokeStyle = C.bg; g.lineWidth = Math.max(2, r / 16); g.stroke();
  if ((mood === 'alarm' || mood === 'hurt') && Math.floor(t * 3) % 2) circle(g, x + fr * 0.55, y - fr * 0.5 + ((t * 20) % (fr * 0.5)), Math.max(1, r / 18), C.pale);
  circle(g, x, y, r * 0.92, rgba(C.lilac, 0.16));                                                     // visor glass
  g.strokeStyle = rgba(C.white, 0.6); g.lineWidth = Math.max(2, r / 10); g.beginPath(); g.arc(x, y, r * 0.75, 3.6, 4.4); g.stroke();
  circle(g, x - r * 0.45, y - r * 0.4, Math.max(1, r / 12), rgba(C.white, 0.7));
}

export class Renderer {
  private glow = mk(); private gl = this.glow.getContext('2d')!;
  private neb = buildNebula();
  private stars: [number, number, number, number][];
  constructor(private g: C2D) {
    const r = seeded(9); this.stars = Array.from({ length: 140 }, () => [r() * W, TOP + r() * (H - TOP), [0.15, 0.35, 0.7][Math.floor(r() * 3)], r() * 6]);
  }
  text(txt: string, size: number, col: string, x: number, y: number, align: CanvasTextAlign = 'center', weight = 700, glowCol?: string) {
    for (const [ctx, c] of [[this.g, col], ...(glowCol ? [[this.gl, glowCol]] : [])] as [C2D, string][]) { ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = c; ctx.fillText(txt, x, y); }
  }

  draw(s: IndigoGame, dt: number) {
    const { g, gl } = this, t = s.t, sh = s.ship;
    gl.clearRect(0, 0, W, H); g.save();
    if (s.shake > 0.6) g.translate((Math.random() * 2 - 1) * s.shake, (Math.random() * 2 - 1) * s.shake);
    g.drawImage(this.neb, 0, 0);
    for (const st of this.stars) {                                                   // parallax star layers
      st[0] = (((st[0] - st[2] * (0.6 + sh.vel.x * 0.08) * dt * 60) % W) + W) % W;
      if (0.5 + 0.5 * Math.sin(t * 2 + st[3]) > 0.3) circle(g, st[0], st[1], st[2] > 0.5 ? 1.6 : 1, st[2] > 0.5 ? C.pale : C.soft);
    }
    for (const w of s.wells) {                                                       // wells: concentric glowing rings
      for (let k = 0; k < 5; k++) circle(gl, w.pos.x, w.pos.y, w.ring * (1 - k * 0.17) + 3 * Math.sin(t * 2 + k), rgba(C.laser, (40 + k * 30) / 255), 1);
      circle(g, w.pos.x, w.pos.y, w.core, C.well); circle(gl, w.pos.x, w.pos.y, w.core, C.portal, 2);
      for (let k = 0; k < 3; k++) { const a = t * (1.5 + k) + k * 2, rr = w.core + 6 + k * 4; gl.strokeStyle = C.lilac; gl.lineWidth = 1; gl.beginPath(); gl.arc(w.pos.x, w.pos.y, rr, a, a + 1.2); gl.stroke(); }
    }
    for (const [a, b] of s.walls) { line(g, a, b, C.struct, 10); line(gl, a, b, C.soft, 2); }
    s.nodes.forEach((n, i) => {                                                      // anchor nodes: rotating diamonds
      const r = 9 + 2 * Math.sin(t * 3 + i * 1.7), pts = [0, 1, 2, 3].map((k) => ({ x: n.x + Math.cos(t + (k * Math.PI) / 2) * r, y: n.y + Math.sin(t + (k * Math.PI) / 2) * r }));
      poly(g, pts, C.deep); poly(gl, pts, sh.tether === i ? C.portal : C.lilac, 2);
    });
    const [la, lb] = s.laser.ends();                                                 // laser: bright when active, dashed when safe
    circle(gl, s.laser.pivot.x, s.laser.pivot.y, 6, C.pale);
    if (s.laser.active) { line(g, la, lb, C.laser, 5); line(gl, la, lb, C.portal, 7); line(gl, la, lb, C.white, 2); }
    else { gl.setLineDash([14, 14]); line(gl, la, lb, rgba(C.soft, 0.5), 2); gl.setLineDash([]); }
    this.text(`${s.laser.active ? 'ACTIVE' : 'SAFE'} ${s.laser.phaseLeft.toFixed(1)}s`, 14, s.laser.active ? C.lilac : C.pale, s.laser.pivot.x, s.laser.pivot.y - s.laser.half - 18);
    const [top, bot] = s.gate.rects();                                               // monoliths + portal
    for (const r of [top, bot]) {
      g.fillStyle = C.struct; g.fillRect(r.x, r.y, r.w, r.h); gl.strokeStyle = C.portal; gl.lineWidth = 2; gl.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      for (let yy = r.y + 10; yy < r.y + r.h - 6; yy += 18) line(gl, { x: r.x + 8, y: yy }, { x: r.x + r.w - 8, y: yy }, rgba(C.laser, 0.47), 1);
    }
    for (let k = 0; k < 4; k++) { gl.strokeStyle = rgba(C.portal, (160 - k * 30) / 255); gl.lineWidth = 2; gl.beginPath(); gl.ellipse(GATE_X + GATE_W + 22, GATE_Y, (20 + k * 10) / 2, Math.max(1, ((bot.y - (top.y + top.h)) * (1 - k * 0.15)) / 2), 0, 0, Math.PI * 2); gl.stroke(); }
    this.text('INDIGO GATE', 14, C.pale, GATE_X + GATE_W / 2, TOP + 14);
    if (s.state === 'play') s.predict().forEach((p, i) => circle(gl, p.x, p.y, 2, rgba(C.laser, Math.max(40, 230 - i * 10) / 255)));
    if (sh.tether !== null) { line(g, s.nodes[sh.tether], sh.pos, C.mid, 1); line(gl, s.nodes[sh.tether], sh.pos, C.portal, 2); }
    for (const p of s.projs) { for (let i = 1; i < p.trail.length; i++) line(gl, p.trail[i - 1], p.trail[i], C.lilac, 2); circle(g, p.pos.x, p.pos.y, 3, C.white); }
    for (const tr of s.trail) { const k = 1 - tr.age / 26; circle(gl, tr.p.x, tr.p.y, Math.max(1, 5 * k), rgba(C.lilac, 0.8 * k)); }
    if ((s.state !== 'won' || s.wonT < 1.2) && !(sh.inv > 0 && Math.floor(t * 12) % 2)) {
      const hd = sh.heading, side = { x: -hd.y, y: hd.x }, P = (a: number, b: number) => ({ x: sh.pos.x + hd.x * a + side.x * b, y: sh.pos.y + hd.y * a + side.y * b });
      const pts = [P(16, 0), P(-11, 10), P(-6, 0), P(-11, -10)];
      poly(g, pts, C.ship); poly(gl, pts, C.pale, 2);
      drawHelmetThanos(g, sh.pos.x + hd.x * 2, sh.pos.y + hd.y * 2, 6, s.currentMood(), t);   // Thanos in the cockpit
    }
    for (const p of s.parts) circle(gl, p.p.x, p.p.y, Math.max(1, 3 * (1 - p.age / p.life)), p.col);
    for (const r of s.rings) if (r.age > 0) { const k = r.age / r.life; circle(gl, r.p.x, r.p.y, 8 + 120 * k, C.pale, Math.max(1, 5 * (1 - k))); }
    g.restore();
    if (s.state !== 'menu' && s.state !== 'rules') this.hud(s);
    g.save(); g.globalCompositeOperation = 'lighter'; g.filter = 'blur(10px)'; g.drawImage(this.glow, 0, 0); g.filter = 'blur(4px)'; g.drawImage(this.glow, 0, 0); g.filter = 'none'; g.restore();
    g.drawImage(this.glow, 0, 0);
    if (s.flash > 0) { g.fillStyle = rgba(C.pale, 0.67 * s.flash); g.fillRect(0, 0, W, H); }
    if (s.slow > 0 && s.state === 'play') this.text('SLOW-MO', 13, C.lilac, W - 12, TOP + 14, 'right');
  }

  private hud(s: IndigoGame) {
    const g = this.g, sh = s.ship;
    g.fillStyle = C.bg; g.fillRect(0, 0, W, TOP - 4); line(this.gl, { x: 0, y: TOP - 5 }, { x: W, y: TOP - 5 }, C.laser, 2);
    this.text('INDIGO', 20, C.pale, 12, 25, 'left');
    this.text('LIVES', 13, C.soft, 205, 15, 'left', 500);
    for (let i = 0; i < LIVES; i++) { const cx = 212 + i * 20; poly(g, [{ x: cx, y: 26 }, { x: cx + 7, y: 40 }, { x: cx - 7, y: 40 }], i < s.lives ? C.portal : C.deep); }
    this.text('ANCHORS', 13, C.soft, 285, 15, 'left', 500);
    for (let i = 0; i < SHOTS; i++) circle(g, 291 + i * 11, 34, 4, i < s.shots ? C.lilac : C.deep);
    const sp = sh.vel.len(), hd = ((((sh.angle * 180) / Math.PI) % 360) + 360) % 360;
    this.text(`SPEED ${sp.toFixed(1)}`, 13, sp <= SAFE_GATE_SPEED ? C.pale : C.lilac, 400, 15, 'left');
    this.text(`HEADING ${hd.toFixed(1)}°`, 13, C.pale, 400, 35, 'left');
    const low = s.timeLeft < 30, tl = Math.max(0, s.timeLeft);
    this.text(`${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`, 26, low && Math.floor(s.t * 4) % 2 ? C.white : C.portal, W / 2 + 145, 26, 'center', 800, low ? C.portal : undefined);
    if (s.danger > 0) { circle(g, W - 150, 26, 7, Math.floor(s.t * 6) % 2 ? C.lilac : C.deep); this.text('GRAVITY', 13, C.lilac, W - 138, 26, 'left'); }
    this.text(`ZONE ${s.zone}`, 13, C.soft, W - 12, 26, 'right');
    this.text(s.objective(), 13, C.soft, W / 2, TOP + 12, 'center', 500);
    this.text('W thrust · S brake · A/D rotate · SPACE anchor/release · P pause · M mute · R restart · Esc menu', 12, C.mid, W / 2, H - 10, 'center', 500);
    const near = Math.hypot(sh.pos.x - 70, sh.pos.y - (H - 88)) < 150;          // fade the portrait when the ship flies behind it
    g.save(); g.globalAlpha = near ? 0.22 : 1;
    circle(g, 70, H - 88, 62, C.bg); drawHelmetThanos(g, 70, H - 88, 54, s.currentMood(), s.t);
    g.restore(); if (!near) circle(this.gl, 70, H - 88, 62, C.laser, 2);
    this.text(s.currentMood().toUpperCase(), 13, C.pale, 70, H - 18);
    if (s.msgT > 0) this.text(s.msg, 24, C.pale, W / 2, 96, 'center', 800);
  }
}
