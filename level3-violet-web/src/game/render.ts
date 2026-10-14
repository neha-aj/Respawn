/* ============================================================================
   Canvas renderer. Neon lines go to a separate glow layer that is blurred and
   added back ("bloom"), exactly like the Python build's glow surface.
   ============================================================================ */
import { AMMO, BULLET_SPEED, C, H, LIVES, W, type Rect } from './config';
import type { Player } from './entities';
import type { VioletGame } from './logic';
import { predict, type V2 } from './physics';

type C2D = CanvasRenderingContext2D;
export const FONT = 'Orbitron, Bahnschrift, sans-serif';

function seeded(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const rgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const strokeRect = (g: C2D, r: Rect, col: string, lw: number) => { g.strokeStyle = col; g.lineWidth = lw; g.strokeRect(r.x + lw / 2, r.y + lw / 2, r.w - lw, r.h - lw); };
const line = (g: C2D, a: V2, b: V2, col: string, lw: number) => { g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };
const circle = (g: C2D, p: V2, r: number, col: string, lw = 0) => { g.beginPath(); g.arc(p.x, p.y, Math.max(0.5, r), 0, Math.PI * 2); if (lw) { g.strokeStyle = col; g.lineWidth = lw; g.stroke(); } else { g.fillStyle = col; g.fill(); } };
const poly = (g: C2D, pts: number[][], col: string, lw = 0) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); if (lw) { g.strokeStyle = col; g.lineWidth = lw; g.stroke(); } else { g.fillStyle = col; g.fill(); } };

/** Neon city after the reference photo: towers with windows, signs, billboard, crowd with umbrellas. */
function buildCity() {
  const rnd = seeded(3), ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const bg = mk(), glow = mk(), g = bg.getContext('2d')!, gl = glow.getContext('2d')!;
  for (let y = 0; y < H; y++) { const k = 1 - Math.abs(y / H - 0.45) * 2; g.fillStyle = `rgb(${Math.round(18 + 12 * k)},0,${Math.round(36 + 18 * k)})`; g.fillRect(0, y, W, 1); }
  ([[C.deep, 160, 420, C.dim], [C.dim, 120, 330, C.mid]] as const).forEach(([col, hmin, hmax, win], layer) => {
    let x = -20;
    while (x < W) {
      const bw = ri(50, 120), bh = ri(hmin, hmax), top = 600 - bh - layer * 10;
      g.fillStyle = col; g.fillRect(x, top, bw, bh);
      for (let wy = top + 8; wy < 596; wy += 9) for (let wx = x + 5; wx < x + bw - 5; wx += 7) if (rnd() < 0.28) { g.fillStyle = rnd() < 0.8 ? win : C.soft; g.fillRect(wx, wy, 3, 4); }
      if (rnd() < 0.55) {
        const sx = x + ri(4, Math.max(4, bw - 18)), sy = top + ri(10, 60), sh = ri(50, 140), c = [C.reflect, C.soft, C.wall, C.scale][ri(0, 3)];
        strokeRect(gl, { x: sx, y: sy, w: 14, h: sh }, c, 2);
        for (let gy = sy + 6; gy < sy + sh - 6; gy += 10) strokeRect(gl, { x: sx + 4, y: gy, w: 6, h: 6 }, c, 1);
      }
      x += bw + ri(-10, 8);
    }
  });
  strokeRect(gl, { x: 24, y: 70, w: 170, h: 110 }, C.reflect, 3);
  for (let k = 0; k < 6; k++) line(gl, { x: 32, y: 84 + k * 16 }, { x: 32 + ri(60, 150), y: 84 + k * 16 }, C.soft, 3);
  for (let k = 0; k < 5; k++) { const sx = ri(330, 860), sy = ri(380, 470); strokeRect(gl, { x: sx - 40, y: sy, w: 80, h: 18 }, [C.scale, C.reflect, C.soft][ri(0, 2)], 2); }
  for (let k = 0; k < 14; k++) {
    const cx = ri(330, 860), cy = 592;
    g.fillStyle = C.deep; g.fillRect(cx - 3, cy - 18, 6, 18); circle(g, { x: cx, y: cy - 22 }, 4, C.deep);
    if (rnd() < 0.6) { gl.strokeStyle = C.soft; gl.lineWidth = 2; gl.beginPath(); gl.arc(cx, cy - 27, 13, Math.PI, 0); gl.stroke(); }
  }
  g.drawImage(glow, 0, 0);
  g.fillStyle = rgba(C.bg, 0.49); g.fillRect(0, 0, W, H);           // push the city back so gameplay reads first
  return { bg, glow };
}

export function drawThanos(g: C2D, gl: C2D, p: Player, t: number) {
  const x = Math.round(p.rect.x + p.rect.w / 2), y = p.rect.y + p.rect.h, f = p.facing;
  const col = p.hurt > 0 && Math.floor(t * 20) % 2 ? C.pale : C.player;
  const sw = p.onGround ? Math.sin(p.walk * 2) * 10 : 6;
  for (const [k, s] of [[-1, sw], [1, -sw]]) {
    const hip = { x: x + 5 * k, y: y - 34 }, foot = { x: x + 5 * k + s * 0.8, y: y - 2 };
    line(g, hip, foot, C.mid, 9); line(gl, hip, foot, col, 2);
  }
  const torso = [[x - 15, y - 62], [x + 15, y - 62], [x + 11, y - 32], [x - 11, y - 32]];
  poly(g, torso, C.mid); poly(g, torso, col, 2); poly(gl, torso, col, 2);
  line(gl, { x: x - 11, y: y - 46 }, { x: x + 11, y: y - 46 }, C.soft, 2);
  const collar = [[x - 18, y - 60], [x - 7, y - 70], [x + 7, y - 70], [x + 18, y - 60], [x + 10, y - 56], [x - 10, y - 56]];
  poly(g, collar, C.mid); poly(gl, collar, C.soft, 2);
  const hx = x + 2 * f, hy = y - 82;
  g.beginPath(); g.ellipse(hx, hy, 11, 14, 0, 0, Math.PI * 2); g.fillStyle = C.player; g.fill(); g.strokeStyle = C.soft; g.lineWidth = 2; g.stroke();
  gl.beginPath(); gl.ellipse(hx, hy, 11, 14, 0, 0, Math.PI * 2); gl.strokeStyle = col; gl.lineWidth = 2; gl.stroke();
  for (const k of [-4, 0, 4]) line(gl, { x: hx + k, y: hy + 6 }, { x: hx + k * 1.1, y: hy + 12 }, C.wall, 1);   // chin ridges
  line(gl, { x: hx + 3 * f, y: hy - 3 }, { x: hx + 8 * f, y: hy - 5 }, C.pale, 2);                               // brow
  circle(gl, { x: hx + 5 * f, y: hy - 1 }, 2, C.pale);                                                            // glowing eye
  line(g, { x: x - 12 * f, y: y - 58 }, { x: x - 15 * f, y: y - 34 }, C.player, 7);                               // back arm
  const sh = p.shoulder(), dx = Math.cos(p.aim), dy = Math.sin(p.aim), L = 26 - p.recoil * 6, hand = { x: sh.x + dx * L, y: sh.y + dy * L };
  line(g, sh, hand, C.player, 8); line(gl, sh, hand, col, 2);
  g.fillStyle = C.wall; g.fillRect(hand.x - 7, hand.y - 7, 14, 14); strokeRect(gl, { x: hand.x - 7, y: hand.y - 7, w: 14, h: 14 }, C.scale, 2);
  for (let k = 0; k < 5; k++) { const a = p.aim + (k - 2) * 0.45; circle(gl, { x: hand.x + Math.cos(a) * 6, y: hand.y + Math.sin(a) * 6 }, 1.2, (Math.floor(t * 6) + k) % 5 === 0 ? C.pale : C.soft); }
  line(gl, hand, p.muzzle(), C.proj, 3);                                                                            // barrel
}

export class Renderer {
  private glowCanvas = mk();
  private gl = this.glowCanvas.getContext('2d')!;
  private city = buildCity();
  private scan: CanvasPattern | null = null;
  private rain = Array.from({ length: 160 }, () => [Math.random() * W, Math.random() * H, 7 + Math.random() * 6]);
  constructor(private g: C2D) {
    const s = document.createElement('canvas'); s.width = 4; s.height = 3;
    const sg = s.getContext('2d')!; sg.fillStyle = 'rgba(10,0,20,0.27)'; sg.fillRect(0, 0, 4, 1);
    this.scan = g.createPattern(s, 'repeat');
  }

  text(txt: string, size: number, col: string, x: number, y: number, glowCol?: string, align: CanvasTextAlign = 'center') {
    for (const [ctx, c] of [[this.g, col], ...(glowCol ? [[this.gl, glowCol]] : [])] as [C2D, string][]) {
      ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = c; ctx.fillText(txt, x, y);
    }
  }

  draw(game: VioletGame, dt: number, showAimGuide: boolean, mouse: V2) {
    const { g, gl } = this, w = game.world, t = game.t;
    gl.clearRect(0, 0, W, H);
    g.save();
    if (game.shake > 0.5) g.translate((Math.random() * 2 - 1) * game.shake, (Math.random() * 2 - 1) * game.shake);
    g.drawImage(this.city.bg, 0, 0);
    if (0.5 + 0.5 * Math.sin(t * 3) > 0.15) { gl.globalAlpha = 0.37; gl.drawImage(this.city.glow, 0, 0); gl.globalAlpha = 1; }   // neon flicker
    g.strokeStyle = C.dim; g.lineWidth = 1;
    for (const r of this.rain) {
      r[1] += r[2] * dt * 60; r[0] -= r[2] * 0.25 * dt * 60;
      if (r[1] > H) { r[0] = Math.random() * (W + 100); r[1] = -10; }
      g.beginPath(); g.moveTo(r[0], r[1]); g.lineTo(r[0] - r[2] * 0.3, r[1] + r[2] * 1.4); g.stroke();
    }
    for (const o of w.solids) {
      g.fillStyle = C.dim; g.fillRect(o.x, o.y, o.w, o.h); strokeRect(g, o, C.wall, 2); strokeRect(gl, o, C.wall, 3);
      line(gl, { x: o.x, y: o.y }, { x: o.x + o.w - 1, y: o.y }, C.pale, 1);
    }
    g.save(); g.globalAlpha = 0.16; g.translate(0, 1204); g.scale(1, -1); g.drawImage(g.canvas, 0, 560, W, 40, 0, 560, W, 40); g.restore();   // wet-floor reflection
    for (const f of w.fields) {
      const c = f.kind === 'scale' ? C.scale : C.reflect, r = f.rect;
      g.fillStyle = rgba(c, (40 + 60 * f.flash) / 255); g.fillRect(r.x, r.y, r.w, r.h); strokeRect(gl, r, c, 2);
      gl.strokeStyle = c; gl.lineWidth = 1;
      for (let yy = r.y + ((t * 30) % 10); yy < r.y + r.h; yy += 10) { gl.beginPath(); gl.moveTo(r.x, yy); gl.lineTo(r.x + r.w - 1, yy); gl.stroke(); }
      this.text(f.kind === 'scale' ? 'x1.6' : '-vy', 13, c, r.x + r.w / 2, r.y - 12);
    }
    const d = w.door, pulse = 0.5 + 0.5 * Math.sin(t * (d.unlocked ? 8 : 3));
    g.fillStyle = d.unlocked ? C.door : C.mid; g.fillRect(d.rect.x, d.rect.y, d.rect.w, d.rect.h);
    const inf = 6 + 8 * pulse; strokeRect(gl, { x: d.rect.x - inf / 2, y: d.rect.y - inf / 2, w: d.rect.w + inf, h: d.rect.h + inf }, C.door, 3);
    circle(gl, { x: d.rect.x + d.rect.w / 2, y: d.rect.y + d.rect.h / 2 }, 10 + 6 * pulse, C.door, 2);
    this.text('CORE', 13, C.door, d.rect.x + d.rect.w / 2 + 36, d.rect.y - 14);
    if (!d.unlocked) for (let yy = d.rect.y + 8; yy < d.rect.y + d.rect.h; yy += 16) line(g, { x: d.rect.x, y: yy }, { x: d.rect.x + d.rect.w, y: yy }, C.deep, 3);
    const pc = game.player.center();
    for (const e of game.enemies) {
      if (!e.alive) continue;
      circle(g, e.pos, e.radius, C.drone); circle(gl, e.pos, e.radius, C.reflect, 2);
      const vx = pc.x - e.pos.x, vy = pc.y - e.pos.y, l = Math.hypot(vx, vy) || 1;
      circle(gl, { x: e.pos.x + (vx / l) * 6, y: e.pos.y + (vy / l) * 6 }, 4, C.pale);
      for (let a = 0; a < 3; a++) { const ang = t * 9 + a * 2.09, cx = Math.cos(ang), sy = Math.sin(ang) * 0.3; line(gl, { x: e.pos.x + cx * 18, y: e.pos.y + sy * 18 }, { x: e.pos.x + cx * 30, y: e.pos.y + sy * 30 }, C.soft, 2); }
    }
    if (showAimGuide) {                                                    // predictive trajectory guide
      const pts = predict(w, game.player.muzzle(), { x: Math.cos(game.player.aim) * BULLET_SPEED, y: Math.sin(game.player.aim) * BULLET_SPEED });
      pts.forEach((p, i) => circle(gl, p, 2, rgba(C.proj, Math.max(40, 220 - i * 5) / 255)));
      circle(gl, mouse, 10, C.proj, 2); line(gl, { x: mouse.x - 16, y: mouse.y }, { x: mouse.x - 6, y: mouse.y }, C.proj, 2); line(gl, { x: mouse.x + 6, y: mouse.y }, { x: mouse.x + 16, y: mouse.y }, C.proj, 2);
    }
    drawThanos(g, gl, game.player, t);
    for (const b of [...game.shots, ...game.eshots]) {
      const c = b.enemy ? C.reflect : C.proj;
      for (let i = 1; i < b.trail.length; i++) line(gl, b.trail[i - 1], b.trail[i], c, Math.max(1, Math.floor(i / 4)));
      circle(g, b.pos, b.enemy ? 3 : 4, C.pale); circle(gl, b.pos, 7, c, 2);
    }
    for (const p of game.parts) circle(gl, p.p, p.size * (1 - p.age / p.life), p.col);
    for (const r of game.rings) { const k = r.age / r.life; circle(gl, r.p, 10 + 110 * k, C.pale, Math.max(1, 6 * (1 - k))); }
    g.restore();
    if (game.state !== 'menu' && game.state !== 'rules') this.hud(game);
    // bloom: blurred glow added twice, then the sharp glow on top
    g.save(); g.globalCompositeOperation = 'lighter'; g.filter = 'blur(10px)'; g.drawImage(this.glowCanvas, 0, 0); g.filter = 'blur(4px)'; g.drawImage(this.glowCanvas, 0, 0); g.filter = 'none'; g.restore();
    g.drawImage(this.glowCanvas, 0, 0);
    if (game.flash > 0) { g.fillStyle = rgba(C.pale, 0.7 * game.flash); g.fillRect(0, 0, W, H); }
    if (game.slow > 0 && game.state === 'play') { g.font = `700 13px ${FONT}`; g.textAlign = 'right'; g.fillStyle = C.scale; g.fillText('SLOW-MO', W - 24, 64); }
    if (this.scan) { g.fillStyle = this.scan; g.fillRect(0, 0, W, H); }
  }

  private hud(game: VioletGame) {
    const g = this.g;
    g.fillStyle = C.bg; g.fillRect(0, 0, W, 44); line(this.gl, { x: 0, y: 43 }, { x: W, y: 43 }, C.wall, 2);
    this.text('VIOLET', 13, C.soft, 16, 22, undefined, 'left');
    this.text('LIVES', 13, C.soft, 152, 22);
    for (let i = 0; i < LIVES; i++) { const cx = 200 + i * 22, pts = [[cx, 14], [cx + 9, 22], [cx, 30], [cx - 9, 22]]; poly(g, pts, i < game.lives ? C.player : C.deep); poly(this.gl, pts, C.soft, 1); }
    this.text('AMMO', 13, C.soft, 285, 22);
    for (let i = 0; i < AMMO; i++) { g.fillStyle = i < game.ammo ? C.proj : C.deep; g.beginPath(); g.roundRect(318 + i * 14, 12, 8, 20, 3); g.fill(); if (i < game.ammo) { this.gl.strokeStyle = C.proj; this.gl.lineWidth = 1; this.gl.beginPath(); this.gl.roundRect(318 + i * 14, 12, 8, 20, 3); this.gl.stroke(); } }
    const alive = game.dronesLeft;
    this.text(`DRONES ${alive}`, 13, alive ? C.pale : C.soft, 450, 22);
    const low = game.timeLeft < 20, s = Math.max(0, game.timeLeft);
    this.text(`${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`, 22, low && Math.floor(game.t * 4) % 2 ? C.pale : C.scale, W / 2 + 170, 23, low ? C.door : undefined);
    this.text(`DOOR ${game.world.door.unlocked ? 'OPEN' : 'LOCKED'}`, 13, game.world.door.unlocked ? C.door : C.mid, W - 16, 22, undefined, 'right');
  }
}
