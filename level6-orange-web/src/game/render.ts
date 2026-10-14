/* ORANGE renderer — chibi pixel art on a 450 × 325 canvas, scaled ×2 with hard pixels, plus a crisp 5×7 pixel-font UI. */
import { BEAT, C, CHALLENGE, FONT, GROUND, H, HEROES, LH, LW, RULES_PLACEHOLDER, TARGET_ACC, TARGET_WPM, W, rgb, wrap, type RGB } from './config';
import type { Expr, OrangeGame } from './sim';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const fill = (g: Ctx, c: RGB | string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = typeof c === 'string' ? c : rgb(c); g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
/** Pixel-exact filled circle. */
const pcircle = (g: Ctx, c: RGB, cx: number, cy: number, r: number) => {
  g.fillStyle = rgb(c); cx = Math.round(cx); cy = Math.round(cy); r = Math.max(1, Math.round(r));
  for (let dy = -r; dy <= r; dy++) { const dx = Math.floor(Math.sqrt(r * r - dy * dy)); g.fillRect(cx - dx, cy + dy, 2 * dx + 1, 1); }
};
/** Pixel-exact thick line (square brush stepped along the segment). */
const pline = (g: Ctx, c: RGB, a: number[], b: number[], w: number) => {
  g.fillStyle = rgb(c); const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2)), hw = w / 2;
  for (let i = 0; i <= n; i++) { const x = a[0] + ((b[0] - a[0]) * i) / n, y = a[1] + ((b[1] - a[1]) * i) / n; g.fillRect(Math.round(x - hw), Math.round(y - hw), Math.round(w), Math.round(w)); }
};
const rrect = (g: Ctx, c: RGB, x: number, y: number, w: number, h: number, r: number) => {
  g.fillStyle = rgb(c);
  for (let j = 0; j < h; j++) { const d = j < r ? r - j : j >= h - r ? j - (h - r - 1) : 0, cut = d > 0 ? Math.round(r - Math.sqrt(Math.max(0, r * r - d * d))) : 0; g.fillRect(x + cut, y + j, w - 2 * cut, 1); }
};
const poly = (g: Ctx, c: RGB | string, pts: number[][], stroke = false, lw = 1) => {
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
  if (stroke) { g.strokeStyle = typeof c === 'string' ? c : rgb(c); g.lineWidth = lw; g.stroke(); } else { g.fillStyle = typeof c === 'string' ? c : rgb(c); g.fill(); }
};

/** Chibi Thanos head (32 × 29 px): bald, square jaw, ridged chin; expression drawn pixel by pixel. */
function makeHead(expr: Expr, shades: boolean, back: boolean) {
  const cv = mk(32, 29), s = cv.getContext('2d')!, f = (c: RGB, x: number, y: number, w = 1, h = 1) => fill(s, c, x, y, w, h);
  rrect(s, C.INK, 0, 0, 32, 29, 7); rrect(s, C.DANCER, 1, 1, 30, 27, 6); rrect(s, C.SKIN_SH, 24, 3, 6, 23, 3);
  f(C.HI, 6, 3, 10, 3); f(C.LAMBER, 8, 3, 4, 1);
  if (back) { rrect(s, C.SKIN_SH, 4, 18, 24, 8, 3); return cv; }
  rrect(s, C.SKIN_SH, 4, 22, 24, 6, 3);                                       // heavy jaw
  for (const x of [10, 13, 16, 19, 22]) f(C.BURNT, x, 21, 1, 7);             // the famous chin ridges
  for (let y = 12; y <= 16; y++) { f(C.SKIN_SH, 1, y, 2, 1); f(C.BURNT, 29, y, 2, 1); }
  const brow = { focus: 0, smug: 1, grin: 0, wince: -1, exhausted: -1, victory: 0 }[expr];
  for (let i = 0; i < 7; i++) { const dy = Math.floor((brow * (i - 3)) / 3); f(C.BURNT, 5 + i, 11 + dy, 1, 2); f(C.BURNT, 26 - i, 11 + dy, 1, 2); }
  if (shades) { for (const x0 of [5, 18]) { rrect(s, C.INK, x0, 12, 9, 5, 1); f(C.TERRA, x0 + 1, 13, 2, 1); } f(C.INK, 14, 13, 4, 1); }
  else if (expr === 'grin' || expr === 'victory') for (const x0 of [7, 20]) { f(C.INK, x0, 15); f(C.INK, x0 + 1, 14, 3, 1); f(C.INK, x0 + 4, 15); }
  else if (expr === 'wince') for (const x0 of [8, 20]) { f(C.INK, x0, 13); f(C.INK, x0 + 1, 14, 2, 1); f(C.INK, x0, 15); }
  else if (expr === 'exhausted') for (const x0 of [7, 20]) { f(C.INK, x0, 15, 5, 1); f(C.INK, x0 + 1, 16, 3, 1); }
  else { const lid = expr === 'smug' ? 1 : 0; for (const x0 of [7, 20]) { f(C.DOOR, x0, 13, 5, 3); f(C.INK, x0 + 2, 13 + lid, 2, 3 - lid); if (lid) f(C.SKIN_SH, x0, 13, 5, 1); } }
  if (expr === 'grin' || expr === 'victory') { f(C.INK, 9, 18, 14, 1); f(C.INK, 10, 19, 12, 3); f(C.DOOR, 11, 19, 10, 1); f(C.INK, 8, 17); f(C.INK, 23, 17); }
  else if (expr === 'smug') { f(C.INK, 11, 19, 9, 1); f(C.INK, 20, 18, 2, 1); }
  else if (expr === 'wince') for (let i = 0; i < 6; i++) f(C.INK, 10 + 2 * i, 19 + (i % 2), 2, 1);
  else if (expr === 'exhausted') { s.fillStyle = rgb(C.INK); s.beginPath(); s.ellipse(16, 20.5, 3, 2.5, 0, 0, TAU); s.fill(); }
  else f(C.INK, 11, 19, 10, 1);
  return cv;
}

/** Chibi Marvel hero (16 px head) on a small canvas. mood ∈ sad, cheer; `dust` erodes the right side away. */
function drawHeroSmall(g: Ctx, kind: string, x: number, y: number, mood: 'sad' | 'cheer', t: number, idx: number, dust: number) {
  const big = kind === 'hulk', bw = big ? 16 : 12;
  if (mood === 'cheer') y -= Math.floor(Math.abs(Math.sin((t * Math.PI) / BEAT + idx)) * 2);
  const suit: RGB = ({ ironman: C.TERRA, cap: C.BURNT, thor: C.DARK, hulk: C.DARK, spidey: C.MID, widow: C.DEEP, panther: C.DARK, strange: C.BURNT } as Record<string, RGB>)[kind];
  const skin = kind === 'hulk' ? C.SKIN_SH : C.PEACH;
  const parts: [number[], RGB][] = [];
  if (kind === 'thor' || kind === 'strange') parts.push([[x - 8, y - 16, 16, 14], kind === 'strange' ? C.TERRA : C.BURNT]);
  parts.push([[x - 4, y - 5, 3, 5], suit], [[x + 1, y - 5, 3, 5], suit], [[x - bw / 2, y - 14, bw, 9], suit]);
  if (mood === 'cheer') parts.push([[x - bw / 2 - 2, y - 22, 2, 9], suit], [[x + bw / 2, y - 22, 2, 9], suit]);
  else parts.push([[x - bw / 2 - 2, y - 14, 2, 7], suit], [[x + bw / 2, y - 14, 2, 7], suit]);
  parts.push([[x - 8, y - 28, 16, 14], skin]);
  for (const [r] of parts) fill(g, C.INK, r[0] - 1, r[1] - 1, r[2] + 2, r[3] + 2);
  for (const [r, c] of parts) fill(g, c, r[0], r[1], r[2], r[3]);
  const hx = x - 8, hy = y - 28, f = (c: RGB, rx: number, ry: number, rw = 1, rh = 1) => fill(g, c, hx + rx, hy + ry, rw, rh);
  if (kind === 'ironman') { f(C.TERRA, 0, 0, 16, 14); f(C.LAMBER, 3, 4, 10, 9); f(C.TERRA, 3, 4, 1, 3); f(C.TERRA, 12, 4, 1, 3); f(C.DOOR, 4, 7, 3); f(C.DOOR, 9, 7, 3); fill(g, C.DOOR, x - 1, y - 11, 2, 2); }
  else if (kind === 'cap') {
    f(C.BURNT, 0, 0, 16, 6); f(C.DOOR, 7, 1, 2, 1); f(C.DOOR, 6, 2, 1, 3); f(C.DOOR, 9, 2, 1, 3); f(C.DOOR, 7, 3, 2, 1); f(C.LAMBER, 0, 3, 2, 2); f(C.LAMBER, 14, 3, 2, 2); fill(g, C.DOOR, x - 1, y - 11, 2, 2);
    const sx = x + bw / 2 + 4; pcircle(g, C.INK, sx, y - 9, 6); pcircle(g, C.TERRA, sx, y - 9, 5); pcircle(g, C.LAMBER, sx, y - 9, 3); pcircle(g, C.TERRA, sx, y - 9, 2); fill(g, C.DOOR, sx, y - 9);
  } else if (kind === 'thor') {
    f(C.LAMBER, 0, 0, 16, 3); f(C.LAMBER, 0, 0, 3, 16); f(C.LAMBER, 13, 0, 3, 16); f(C.AMBER, 4, 10, 8, 4);
    const m = x + bw / 2 + 3; fill(g, C.INK, m - 1, y - 13, 7, 5); fill(g, C.TERRA, m, y - 12, 5, 3); fill(g, C.BURNT, m + 2, y - 9, 1, 5);
  } else if (kind === 'hulk') { f(C.INK, 0, 0, 16, 3); f(C.DEEP, 1, 1, 14, 1); fill(g, C.BURNT, x - 7, y - 6, 14, 2); }
  else if (kind === 'spidey') { f(C.MID, 0, 0, 16, 14); for (let i = 0; i < 16; i += 4) f(C.TERRA, i, 0, 1, 14); for (let j = 2; j < 14; j += 4) f(C.TERRA, 0, j, 16, 1); fill(g, C.INK, x - 1, y - 12, 2, 4); fill(g, C.INK, x - 3, y - 11, 6, 1); }
  else if (kind === 'widow') { f(C.SPOT, 0, 0, 16, 4); f(C.SPOT, 0, 0, 3, 18); f(C.SPOT, 13, 0, 3, 18); fill(g, C.AMBER, x - 6, y - 7, 12, 1); }
  else if (kind === 'panther') { f(C.DARK, 0, 0, 16, 14); f(C.INK, 1, -2, 2, 2); f(C.INK, 13, -2, 2, 2); f(C.BURNT, 3, 4, 10, 1); for (let i = 0; i < 5; i++) fill(g, C.LAMBER, x - 4 + i * 2, y - 13); }
  else if (kind === 'strange') { f(C.DARK, 0, 0, 16, 4); f(C.DARK, 0, 0, 2, 8); f(C.DARK, 14, 0, 2, 8); f(C.DARK, 6, 11, 4, 3); fill(g, C.AMBER, x - 1, y - 12, 3, 3); }
  const masked = kind === 'ironman' || kind === 'spidey' || kind === 'panther';
  if (mood === 'sad') {
    if (kind === 'spidey') { f(C.DOOR, 3, 5, 4, 3); f(C.DOOR, 9, 5, 4, 3); f(C.MID, 3, 5); f(C.MID, 12, 5); }
    else if (!masked) { f(C.INK, 4, 7, 2, 1); f(C.INK, 10, 7, 2, 1); f(C.INK, 3, 5, 2, 1); f(C.INK, 11, 5, 2, 1); f(C.INK, 6, 11, 4, 1); f(C.INK, 5, 12); f(C.INK, 10, 12); }
    f(C.DOOR, 4, 8 + Math.floor(Math.floor((t * 6 + idx * 3) % 6) / 2));
  } else if (kind === 'spidey') { f(C.DOOR, 3, 5, 4, 2); f(C.DOOR, 9, 5, 4, 2); }
  else if (!masked) { f(C.INK, 3, 7); f(C.INK, 4, 6, 2, 1); f(C.INK, 6, 7); f(C.INK, 9, 7); f(C.INK, 10, 6, 2, 1); f(C.INK, 12, 7); f(C.INK, 5, 10, 6, 1); f(C.INK, 6, 11, 4, 2); f(C.DOOR, 7, 11, 2, 1); }
  if (dust > 0) {                                                               // turning to dust, right side first
    let seed = idx * 31 + Math.floor(t * 20);
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const cut = x + bw / 2 + 3 - Math.floor((bw + 10) * dust);
    for (let yy = y - 30; yy <= y; yy++) for (let xx = cut; xx < x + bw / 2 + 4; xx++) if (rnd() < 0.85) g.clearRect(xx, yy, 1, 1);
  }
}

export class Renderer {
  private lo = mk(LW, LH); private glow = mk(LW, LH); private bg = mk(LW, LH); private heroCv = mk(44, 40);
  private heads = new Map<string, HTMLCanvasElement>(); private textCache = new Map<string, HTMLCanvasElement>();
  buttons: Record<string, { x: number; y: number; w: number; h: number }> = {};
  mouse: { x: number; y: number } | null = null; muted = false;
  constructor(private ctx: Ctx) { this.bakeBg(); }

  private bakeBg() {
    const g = this.bg.getContext('2d')!;
    fill(g, C.STAGE, 0, 0, LW, LH);
    let seed = 4; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let y = 37; y < 176; y += 8) { const off = Math.floor(y / 8) % 2 ? 0 : 16; for (let x = -off; x < LW; x += 32) fill(g, C.PANEL, x + 1, y + 1, 30, 6); }
    for (let i = 0; i < 120; i++) fill(g, C.DEEP, Math.floor(rnd() * LW), 37 + Math.floor(rnd() * 139));
    for (const x0 of [0, LW - 22]) {
      fill(g, C.BURNT, x0, 37, 22, 200);
      for (let i = 0; i < 22; i += 5) { fill(g, C.TERRA, x0 + i, 37, 2, 200); fill(g, C.DARK, x0 + i + 3, 37, 1, 200); }
      fill(g, C.MID, x0, 37, 22, 6); fill(g, C.INK, x0, 43, 22, 1);
    }
    fill(g, C.DARK, 22, 160, LW - 44, 16); fill(g, C.BURNT, 22, 160, LW - 44, 2);
    fill(g, C.INK, 0, 37, LW, 9); fill(g, C.DARK, 0, 39, LW, 5);
    for (let x = 4; x < LW; x += 12) { pline(g, C.BURNT, [x, 39], [x + 6, 44], 1); pline(g, C.BURNT, [x + 6, 39], [x, 44], 1); }
  }

  private head(expr: Expr, shades: boolean, back: boolean) {
    const k = `${expr}|${shades}|${back}`;
    let c = this.heads.get(k); if (!c) { c = makeHead(expr, shades, back); this.heads.set(k, c); }
    return c;
  }

  // ---------------------------------------------------------------- pixel font
  textImg(text: string, px: number, col: RGB) {
    const k = `${text}|${px}|${col}`;
    let c = this.textCache.get(k);
    if (!c) {
      c = mk(Math.max(1, (text.length * 6 - 1) * px), 7 * px); const g = c.getContext('2d')!; g.fillStyle = rgb(col);
      [...text].forEach((ch, i) => (FONT[ch] ?? FONT['?']).forEach((bits, r) => { for (let b = 0; b < 5; b++) if (bits & (16 >> b)) g.fillRect(i * 6 * px + b * px, r * px, px, px); }));
      if (this.textCache.size > 500) this.textCache.clear();
      this.textCache.set(k, c);
    }
    return c;
  }
  text(text: string, px: number, col: RGB, x: number, y: number, align: 'center' | 'left' | 'right' = 'center', shadow: RGB | null = C.INK, vAlign: 'mid' | 'top' = 'mid') {
    const img = this.textImg(text, px, col), w = img.width, h = img.height;
    const X = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x), Y = Math.round(vAlign === 'mid' ? y - h / 2 : y);
    if (shadow) this.ctx.drawImage(this.textImg(text, px, shadow), X + px, Y + px);
    this.ctx.drawImage(img, X, Y);
    return { x: X, y: Y, w, h };
  }

  // ---------------------------------------------------------------- frame
  draw(game: OrangeGame) {
    const g = this.lo.getContext('2d')!, gl = this.glow.getContext('2d')!, st = game.state, alive = st !== 'GAME_OVER', t = game.t;
    gl.fillStyle = '#000'; gl.fillRect(0, 0, LW, LH);
    this.stage(g, gl, game, alive);
    if (!(game.dust >= 1 || st === 'DOOR_OPENING' || st === 'PORTAL_ENTRY' || st === 'TRANSITION_SCREEN')) {
      const hc = this.heroCv.getContext('2d')!;
      HEROES.forEach((kind, i) => {
        hc.clearRect(0, 0, 44, 40);
        drawHeroSmall(hc, kind, 22, 37, st === 'GAME_OVER' ? 'cheer' : 'sad', t, i, game.dust * (0.6 + (0.4 * ((i * 37) % 7)) / 7));
        g.imageSmoothingEnabled = false; g.drawImage(this.heroCv, 38 + i * 35 - 33, 161 - 55, 66, 60);
      });
    }
    if (st === 'DOOR_OPENING' || st === 'PORTAL_ENTRY' || st === 'TRANSITION_SCREEN') this.portal(g, gl, game);
    if (alive && st !== 'PAUSED') this.spots(g, t);
    if (st !== 'TRANSITION_SCREEN' && game.dancer.scaleK > 0.02) this.dancer(g, game, st === 'GAME_OVER');
    this.speakers(g, gl, game, alive && st !== 'PAUSED');
    for (const q of game.fx.p) {
      const k = 1 - q.age / q.life;
      if (q.spark && k > 0.3) { fill(g, q.col, q.x - 1, q.y, 3, 1); fill(g, q.col, q.x, q.y - 1, 1, 3); } else fill(g, q.col, q.x, q.y, q.size, q.size);
    }
    const audienceEnergy = st === 'PLAYING' ? game.energy : ['VICTORY_DANCE', 'DOOR_OPENING', 'PORTAL_ENTRY', 'TRANSITION_SCREEN'].includes(st) ? 1 : 0.3;
    this.audience(g, t, audienceEnergy, alive, game.hype);
    if (!alive) { g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(150,140,128)'; g.fillRect(0, 0, LW, LH); g.globalCompositeOperation = 'source-over'; }
    g.globalCompositeOperation = 'lighter'; g.filter = 'blur(3px)'; g.drawImage(this.glow, 0, 0); g.filter = 'none'; g.drawImage(this.glow, 0, 0); g.globalCompositeOperation = 'source-over';
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = rgb(C.INK); c.fillRect(0, 0, W, H);
    const sh = game.shake > 0.1 ? game.shake * 2 : 0;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.lo, sh ? (Math.random() * 2 - 1) * sh : 0, sh ? (Math.random() * 2 - 1) * sh : 0, W, H);
    this.buttons = {};
    this.ui(game);
    if (game.flash > 0) { c.fillStyle = rgb(C.DOOR, Math.min(1, game.flash * 2)); c.fillRect(0, 0, W, H); }
  }

  private stage(g: Ctx, gl: Ctx, game: OrangeGame, alive: boolean) {
    const t = game.t, b = (t / BEAT) % 1;
    g.drawImage(this.bg, 0, 0);
    const cx = 225, cy = 78, fl = alive ? 0.65 + 0.35 * (1 - b) ** 2 : 1;           // neon Infinity Gauntlet sign
    const col: RGB = [Math.round(C.SPOT[0] * fl), Math.round(C.SPOT[1] * fl), 0];
    const pts = [[-14, 22], [-14, -2], [-10, -2], [-10, -16], [-6, -16], [-6, -4], [-3, -4], [-3, -20], [1, -20], [1, -4], [4, -4], [4, -18], [8, -18], [8, -2], [12, -2], [12, -12], [16, -12], [16, 8], [8, 22]].map(([x, y]) => [cx + x + 0.5, cy + y + 0.5]);
    poly(g, col, pts, true, 1); poly(gl, [Math.round(col[0] / 2), Math.round(col[1] / 2), 0], pts, true, 3);
    [C.DOOR, C.LAMBER, C.AMBER, C.MID, C.HI, C.GLOWC].forEach((c, i) => { const q = i < 5 ? [cx - 8 + i * 4, cy + 6] : [cx, cy + 14]; fill(g, c, q[0], q[1], 2, 2); pcircle(gl, [Math.round(c[0] * 0.35 * fl), Math.round(c[1] * 0.35 * fl), Math.round(c[2] * 0.35 * fl)], q[0], q[1], 4); });
    for (let i = 0, x = 10; x < LW; i++, x += 20) {                                 // ceiling bulbs blink on the beat
      const on = alive && ((i + Math.floor(t / BEAT)) % 3 === 0 || game.energy > 0.8);
      fill(g, C.INK, x - 2, 44, 5, 4); fill(g, on ? C.HUD : C.TERRA, x - 1, 45, 3, 2); if (on) pcircle(gl, [90, 40, 10], x, 46, 5);
    }
    poly(g, C.DEEP, [[20, 176], [430, 176], [490, 262], [-40, 262]]);
    const vp = [225, 40], rows = [176, 186, 198, 213, 234, 262];
    const xat = (c: number, y: number) => vp[0] + (-40 + (c * 530) / 8 - vp[0]) * (y - vp[1]) / (262 - vp[1]);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) {
      const v = game.tiles[r][c]; if (v <= 0.02) continue;
      const y0 = rows[r], y1 = rows[r + 1];
      poly(g, [Math.round(C.DARK[0] + (C.MID[0] - C.DARK[0]) * v), Math.round(C.DARK[1] + (C.MID[1] - C.DARK[1]) * v), Math.round(C.DARK[2] + (C.MID[2] - C.DARK[2]) * v)], [[xat(c, y0), y0], [xat(c + 1, y0), y0], [xat(c + 1, y1), y1], [xat(c, y1), y1]]);
    }
    const lc = alive ? C.SPOT : C.BURNT;
    for (let c = 0; c <= 8; c++) pline(g, lc, [xat(c, 176), 176], [-40 + (c * 530) / 8, 262], 1);
    for (const y of rows) { fill(g, lc, xat(0, y), y, xat(8, y) - xat(0, y), 1); if (alive) fill(gl, [60, 22, 0], 0, y, LW, 1); }
    fill(g, C.BURNT, 0, 262, LW, 4); fill(g, C.INK, 0, 266, LW, 2);
  }

  private spots(g: Ctx, t: number) {
    [[60, 0], [170, 1.7], [280, 3.1], [390, 4.4]].forEach(([x0, ph]) => {
      const a = Math.sin(t * 0.7 + ph) * 0.55, tx = x0 + Math.sin(a) * 210;
      poly(g, rgb(C.SPOT, 0.15), [[x0 - 3, 46], [x0 + 3, 46], [tx + 26, 250], [tx - 26, 250]]);
      g.fillStyle = rgb(C.AMBER, 0.16); g.beginPath(); g.ellipse(tx, 250, 28, 6, 0, 0, TAU); g.fill();
    });
  }

  /** Phase Door behind the speakers: tall frame, layered glow, rotating geometry. */
  private portal(g: Ctx, gl: Ctx, game: OrangeGame) {
    const cx = 380, top = 96, bot = 248, k = Math.min(1, game.portalT / 0.8), w = 34, t = game.t;
    for (let i = 4; i > 0; i--) rrect(gl, [Math.round(C.DOOR[0] * 0.18 * k * i / 4), Math.round(C.DOOR[1] * 0.18 * k * i / 4), Math.round(C.DOOR[2] * 0.18 * k * i / 4)], cx - w - i * 4, top - i * 4, 2 * w + i * 8, bot - top + i * 8, 6);
    rrect(g, C.INK, cx - w - 4, top - 4, 2 * w + 8, bot - top + 8, 4); rrect(g, C.LAMBER, cx - w - 3, top - 3, 2 * w + 6, bot - top + 6, 4);
    fill(g, k > 0 ? C.AMBER : C.BURNT, cx - w, top, 2 * w, bot - top);
    for (let r = 0; r < 6; r++) { const rr = (r + 1) * 9 + 4 * Math.sin(t * 3 + r); g.strokeStyle = rgb([C.HI, C.LAMBER, C.DOOR][r % 3]); g.lineWidth = 1; g.strokeRect(Math.round(cx - rr * 0.55) + 0.5, Math.round((top + bot) / 2 - rr) + 0.5, Math.round(rr * 1.1), Math.round(rr * 2)); }
    for (let j = 0; j < 3; j++) { const a = t * (1.5 + j * 0.6) + j; poly(g, C.DOOR, Array.from({ length: 3 }, (_, q) => [cx + Math.cos(a + (q * TAU) / 3) * (14 + j * 8), (top + bot) / 2 + Math.sin(a + (q * TAU) / 3) * (22 + j * 12)]), true, 1); }
    fill(g, C.DOOR, cx - 3, top + 8, 6, bot - top - 16);
    fill(gl, [Math.round(C.DOOR[0] * 0.5 * k), Math.round(C.DOOR[1] * 0.5 * k), Math.round(C.DOOR[2] * 0.5 * k)], cx - w + 10, top + 5, 2 * w - 20, bot - top - 10);
  }

  private speakers(g: Ctx, gl: Ctx, game: OrangeGame, alive: boolean) {
    [[318, 378], [382, 442]].forEach(([x0, x1], i) => {
      const dx = i === 0 ? -game.spkOpen * 74 : game.spkOpen * 74;
      [[92, 150], [150, 200], [200, 250]].forEach(([y0, y1], j) => {
        const x = Math.round(x0 + dx), w = x1 - x0, h = y1 - y0;
        fill(g, C.INK, x, y0, w, h); fill(g, C.DARK, x + 1, y0 + 1, w - 2, h - 2); g.strokeStyle = rgb(C.BURNT); g.lineWidth = 1; g.strokeRect(x + 1.5, y0 + 1.5, w - 3, h - 3);
        const cx = x + w / 2, cy = y0 + h / 2 + 2, pulse = alive ? (1 - ((game.t / BEAT) % 1)) ** 3 * 0.5 + game.pulse : 0, rad = j ? 16 : 12;
        pcircle(g, C.INK, cx, cy, rad + 2); pcircle(g, C.TERRA, cx, cy, rad + Math.floor(pulse * 2)); pcircle(g, C.DARK, cx, cy, Math.floor(rad * 0.62 + pulse * 2)); pcircle(g, alive ? C.SPOT : C.BURNT, cx, cy, 3);
        if (alive && pulse > 0.25) pcircle(gl, [Math.round(70 * pulse), Math.round(25 * pulse), 0], cx, cy, rad + 4);
        pcircle(g, C.INK, x + 6, y0 + 5, 3); pcircle(g, C.AMBER, x + 6, y0 + 5, 2);
      });
    });
  }

  private dancer(g: Ctx, game: OrangeGame, collapse: boolean) {
    const d = game.dancer, { J, sx } = d.joints(), k = d.scaleK, t = game.t;
    const w = (n: number) => Math.max(1, Math.round(n * k));
    g.fillStyle = rgb(C.DEEP); g.beginPath(); g.ellipse(J.hip[0], GROUND, 16 * k, 3 * k, 0, 0, TAU); g.fill();
    const limbs = (segs: number[][][], col: RGB, width: number) => {
      for (const [a, b] of segs) { pline(g, C.INK, a, b, w(width + 2)); }
      for (const [a, b] of segs) pline(g, col, a, b, w(width));
    };
    limbs([[J.lhp, J.lkn], [J.lkn, J.lft], [J.rhp, J.rkn], [J.rkn, J.rft]], C.BURNT, 6);
    for (const f of [J.lft, J.rft]) { fill(g, C.INK, f[0] - w(9) / 2 - 1, f[1] - w(1) - w(5) / 2 - 1, w(9) + 2, w(5) + 2); fill(g, C.AMBER, f[0] - w(9) / 2, f[1] - w(1) - w(5) / 2, w(9), w(5)); }
    const hip = J.hip, neck = J.neck, midY = (hip[1] + neck[1]) / 2;
    const torso = [J.lsh, J.rsh, [hip[0] + (J.rhp[0] - hip[0]) * 1.3, hip[1]], [hip[0] + (J.lhp[0] - hip[0]) * 1.3, hip[1]]];
    poly(g, C.INK, torso.map(([x, y]) => [x + (x < hip[0] ? -1 : 1), y]));
    const inner = torso.map(([x, y]) => [(x - hip[0]) * 0.86 + hip[0], (y - midY) * 0.9 + midY]);
    poly(g, C.BURNT, inner);
    const top = [inner[0], inner[1], [(inner[1][0] + inner[2][0]) / 2, (inner[1][1] + inner[2][1]) / 2], [(inner[0][0] + inner[3][0]) / 2, (inner[0][1] + inner[3][1]) / 2]];
    poly(g, C.AMBER, top); poly(g, C.TERRA, top, true, 1);                            // golden chest armour
    pline(g, C.DEEP, [(inner[2][0] + inner[1][0] * 2) / 3, inner[2][1] - w(3)], [(inner[3][0] + inner[0][0] * 2) / 3, inner[3][1] - w(3)], w(2));
    const arm = (n: 'l' | 'r') => {
      limbs([[J[n + 'sh'], J[n + 'el']], [J[n + 'el'], J[n + 'ha']]], C.BURNT, 6);
      const s = J[n + 'sh']; pcircle(g, C.INK, s[0], s[1], w(5)); pcircle(g, C.AMBER, s[0], s[1], w(4)); fill(g, C.HI, s[0] - 1, s[1] - 3, 2, 1);
      if (n === 'r') { pcircle(g, C.INK, J.rha[0], J.rha[1], w(4)); pcircle(g, C.DANCER, J.rha[0], J.rha[1], w(3)); }
      else {                                                                         // the Infinity Gauntlet
        const [gx, gy] = J.lha; pcircle(g, C.INK, gx, gy, w(5)); pcircle(g, C.AMBER, gx, gy, w(4));
        [C.DOOR, C.SPOT, C.LAMBER, C.MID, C.HI, C.GLOWC].forEach((c, i) => { const a = (i / 6) * TAU + t * 2; fill(g, c, gx + Math.cos(a) * 2.4 * k, gy + Math.sin(a) * 2.4 * k); });
      }
    };
    const raised = (['l', 'r'] as const).filter((n) => d.cur[`${n}s`] > 1.6);          // raised arms go in front of the big head
    for (const n of ['l', 'r'] as const) if (!raised.includes(n)) arm(n);
    const expr: Expr = d.exprT > 0 ? d.expr : collapse ? 'exhausted' : d.baseExpr;
    const back = d.spinV !== 0 && Math.abs(d.spin - Math.PI) < Math.PI / 2;
    const img = this.head(expr, d.shades && !collapse, back), hw = Math.max(2, Math.round(32 * k * Math.max(0.25, Math.abs(sx)))), hh = Math.round(29 * k);
    g.imageSmoothingEnabled = false;
    g.drawImage(img, Math.round(neck[0] + Math.sin(d.cur.lean) * 4 - hw / 2), Math.round(neck[1] + 4 * k - hh), hw, hh);
    for (const n of raised) arm(n);
  }

  /** Marvel fans from behind (the reference crowd): heads, helmets, horns and waving glowsticks. */
  private audience(g: Ctx, t: number, energy: number, alive: boolean, hype: number) {
    const kinds = ['loki', 'cap', 'hair', 'panther', 'spiky', 'pony', 'ironman', 'hair', 'loki', 'groot', 'spiky', 'cap', 'pony'];
    kinds.forEach((kd, i) => {
      const x = 14 + i * 35, bob = alive ? Math.abs(Math.sin((t * Math.PI) / BEAT + i * 0.9)) * (2 + 3 * energy) : 0, y = Math.round(LH + 4 - 34 - bob - (i % 2) * 6);
      const col = [C.DARK, C.BURNT, C.DEEP][i % 3];
      for (const sgn of [-1, 1]) {
        if (!((i + (sgn > 0 ? 1 : 0)) % 2) || !alive) continue;
        const ang = -Math.PI / 2 + sgn * (0.35 + 0.25 * Math.sin(((t * Math.PI) / BEAT) * 2 + i)) - hype * sgn * 0.2;
        const hx = x + sgn * 10, hy = y + 12, ex = hx + Math.cos(ang) * 14, ey = hy + Math.sin(ang) * 14;
        pline(g, C.INK, [hx, hy], [ex, ey], 4); pline(g, col, [hx, hy], [ex, ey], 2);
        pline(g, [C.HI, C.SPOT, C.LAMBER][i % 3], [ex, ey], [ex + Math.cos(ang - sgn * 0.4) * 8, ey + Math.sin(ang - sgn * 0.4) * 8], 2);
      }
      g.fillStyle = rgb(C.INK); g.beginPath(); g.ellipse(x, y + 29, 16, 15, 0, 0, TAU); g.fill();
      g.fillStyle = rgb(col); g.beginPath(); g.ellipse(x, y + 29, 15, 14, 0, 0, TAU); g.fill();
      rrect(g, C.INK, x - 11, y - 1, 22, 20, 6); rrect(g, col, x - 10, y, 20, 18, 5);
      if (kd === 'loki') { poly(g, C.AMBER, [[x - 8, y + 2], [x - 14, y - 12], [x - 5, y]]); poly(g, C.AMBER, [[x + 8, y + 2], [x + 14, y - 12], [x + 5, y]]); }
      else if (kd === 'cap') { fill(g, C.LAMBER, x - 12, y + 4, 3, 4); fill(g, C.LAMBER, x + 9, y + 4, 3, 4); }
      else if (kd === 'panther') { fill(g, C.INK, x - 9, y - 3, 3, 4); fill(g, C.INK, x + 6, y - 3, 3, 4); }
      else if (kd === 'spiky') for (let j = 0; j < 4; j++) poly(g, col, [[x - 9 + j * 6, y + 2], [x - 6 + j * 6, y - 6], [x - 3 + j * 6, y + 2]]);
      else if (kd === 'pony') fill(g, C.TERRA, x - 3, y + 12, 6, 12);
      else if (kd === 'ironman') fill(g, C.TERRA, x - 10, y, 20, 6);
      else if (kd === 'groot') for (let j = 0; j < 3; j++) fill(g, C.TERRA, x - 6 + j * 6, y - 5, 2, 6);
      else rrect(g, C.DEEP, x - 10, y, 20, 6, 3);
    });
  }

  // ---------------------------------------------------------------- UI (full resolution, pixel font)
  private panel(x: number, y: number, w: number, h: number, alpha = 0.8, border: RGB = C.SPOT) {
    const c = this.ctx;
    c.fillStyle = rgb(C.INK, alpha); c.fillRect(x, y, w, h);
    c.strokeStyle = rgb(C.INK); c.lineWidth = 2; c.strokeRect(x - 2, y - 2, w + 4, h + 4);
    c.strokeStyle = rgb(border); c.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  private button(key: string, label: string, cx: number, cy: number) {
    const x = cx - 125, y = cy - 23, m = this.mouse, hover = !!m && m.x >= x && m.x <= x + 250 && m.y >= y && m.y <= y + 46;
    this.panel(x, y, 250, 46, 0.9, hover ? C.AMBER : C.SPOT);
    this.text(label, 3, hover ? C.DOOR : C.HUD, cx, cy);
    this.buttons[key] = { x, y, w: 250, h: 46 };
  }

  private ui(game: OrangeGame) {
    const st = game.state, tp = game.typing, t = game.t;
    if (st === 'TITLE') {
      this.panel(150, 110, 600, 420, 0.69);
      this.text('ORANGE', 14, C.SPOT, W / 2, 205);
      this.button('start', 'START', W / 2, 330); this.button('rules', 'RULES', W / 2, 392); this.button('exit', 'EXIT', W / 2, 454);
      this.text('ENTER START  ·  H RULES  ·  M MUTE', 2, C.HUD, W / 2, 505);
      this.soundButton(); return;
    }
    if (st === 'RULES') {
      this.panel(110, 90, 680, 470, 0.88);
      this.text('RULES', 7, C.SPOT, W / 2, 140);
      if (RULES_PLACEHOLDER.isPlaceholder) this.text('PLACEHOLDER - FINAL RULES TO BE ATTACHED', 2, C.AMBER, W / 2, 180);
      RULES_PLACEHOLDER.lines.forEach((l, i) => this.text(l, 2, C.HUD, W / 2, 228 + i * 34));
      this.button('back', 'BACK', W / 2, 505); this.soundButton(); return;
    }
    this.panel(8, 6, W - 16, 64, 0.84);
    const left = Math.max(0, CHALLENGE - game.elapsed), done = game.won !== null;
    const wpm = done ? game.finalWpm : game.liveWpm(), acc = done ? game.finalAcc : tp.accuracy();
    this.text('TIME', 2, C.AMBER, 24, 16, 'left', C.INK, 'top');
    this.text(left < 10 ? left.toFixed(1) : String(Math.ceil(left)), 5, left < 10 && st === 'PLAYING' && Math.floor(t * 4) % 2 ? C.SPOT : C.HUD, 24, 34, 'left', C.INK, 'top');
    const meter = (x: number, label: string, val: number, target: number, cap: number, txt: string) => {
      const ok = val >= target, c = this.ctx;
      this.text(label, 2, C.AMBER, x, 16, 'left', C.INK, 'top');
      this.text(txt, 5, ok ? C.DOOR : C.HUD, x, 34, 'left', C.INK, 'top');
      const bx = x + 110, by = 38, bw = 120, bh = 12;
      c.fillStyle = rgb(C.INK); c.fillRect(bx - 2, by - 2, bw + 4, bh + 4); c.fillStyle = rgb(C.DARK); c.fillRect(bx, by, bw, bh);
      c.fillStyle = rgb(ok ? C.AMBER : C.MID); c.fillRect(bx, by, Math.round(bw * Math.min(1, val / cap)), bh);
      c.fillStyle = rgb(C.DOOR); c.fillRect(bx + Math.round((bw * target) / cap) - 1, by - 4, 2, bh + 8);
      this.text(st === 'PLAYING' ? (ok ? 'OK' : 'LOW') : String(target), 2, ok ? C.DOOR : C.SPOT, bx + bw + 8, 44, 'left', null);
    };
    meter(140, 'WPM / 40', wpm, TARGET_WPM, 90, String(Math.round(wpm)).padStart(3, ' '));
    meter(420, 'ACCURACY / 88%', acc, TARGET_ACC, 100, `${String(Math.round(acc)).padStart(3, ' ')}%`);
    this.text(`CORRECT ${tp.correct}`, 2, C.HUD, W - 22, 20, 'right', null);
    this.text(`ERRORS  ${tp.wrong}`, 2, game.errT > 0 ? C.SPOT : C.HUD, W - 22, 36, 'right', null);
    this.text(`WORDS   ${tp.words}`, 2, C.HUD, W - 22, 52, 'right', null);
    if (st === 'READY' || st === 'PLAYING' || st === 'PAUSED') {           // the active sentence, wrapped onto up to two lines
      this.panel(70, 474, 760, 88, 0.82, game.errT > 0 ? C.AMBER : C.SPOT);
      const text = tp.text, px = 3, lines = wrap(text), c = this.ctx;
      lines.forEach(([start, line], li) => {
        const x0 = Math.round(W / 2 - ((line.trimEnd().length * 6 - 1) * px) / 2), y0 = 474 + 14 + li * 32 + (lines.length === 1 ? 16 : 0);
        [...line].forEach((ch, j) => {
          const i = start + j, typed = i < tp.pos, X = x0 + j * 6 * px + (game.errT > 0 && i === tp.pos ? Math.round(Math.random() * 6 - 3) : 0);
          if (ch !== ' ') { c.drawImage(this.textImg(ch, px, C.INK), X + px, y0 + px); c.drawImage(this.textImg(ch, px, typed ? C.SPOT : C.HUD), X, y0); }
          if (typed) { c.fillStyle = rgb(C.AMBER); c.fillRect(X, y0 + 7 * px + 3, 5 * px, 2); }
          if (i === tp.pos && st === 'PLAYING' && Math.floor(t * 3) % 2 === 0) { c.fillStyle = rgb(C.DOOR); c.fillRect(X, y0 + 7 * px + 3, 5 * px, 3); }
        });
      });
      c.fillStyle = rgb(C.DARK); c.fillRect(80, 554, 740, 3); c.fillStyle = rgb(C.AMBER); c.fillRect(80, 554, Math.round((740 * tp.pos) / text.length), 3);
      if (game.wordPop?.word) { const k = game.wordPop.t / 0.6; c.globalAlpha = 1 - k; this.text(game.wordPop.word, 2, C.LAMBER, W / 2, 460 - 40 * k, 'center', null); c.globalAlpha = 1; }
    }
    game.toasts.slice(-2).forEach((x, i) => this.text(x.text, 4, C.DOOR, W / 2, 440 - i * 34));
    if (st === 'PLAYING' && game.elapsed > 6) { const ok = game.liveWpm() >= TARGET_WPM; this.text(ok ? 'ON PACE' : 'BELOW PACE - FASTER!', 2, ok ? C.DOOR : C.SPOT, W / 2, 578); }
    if (st === 'READY') {
      this.panel(140, 110, 620, 330, 0.88);
      this.text('READY?', 8, C.SPOT, W / 2, 160);
      ['TYPE EACH SENTENCE TO MAKE THANOS DANCE.', 'REACH AT LEAST 40 WPM', 'WITH AT LEAST 88% ACCURACY', 'OVER THE FULL 60 SECONDS.'].forEach((l, i) => this.text(l, i === 1 || i === 2 ? 3 : 2, i === 1 || i === 2 ? C.DOOR : C.HUD, W / 2, 222 + i * 38));
      this.text('PRESS ENTER TO START', 4, Math.floor(t * 2) % 2 ? C.SPOT : C.AMBER, W / 2, 400);
    } else if (st === 'PAUSED') {
      this.panel(250, 140, 400, 300, 0.9);
      this.text('PAUSED', 8, C.SPOT, W / 2, 190); this.text('ESC TO RESUME', 2, C.HUD, W / 2, 240);
      this.button('resume', 'RESUME', W / 2, 296); this.button('restart', 'RESTART', W / 2, 352); this.button('exit', 'EXIT', W / 2, 408);
    } else if (st === 'GAME_OVER' && game.phaseT > 0.8) {
      this.panel(160, 130, 580, 330, 0.9);
      this.text('CHALLENGE FAILED', 5, C.SPOT, W / 2, 180);
      this.text(`FINAL WPM ${game.finalWpm.toFixed(1)}`, 3, C.HUD, W / 2, 240);
      this.text(`ACCURACY ${game.finalAcc.toFixed(1)}%`, 3, C.HUD, W / 2, 278);
      const missed: string[] = [];
      if (tp.attempts === 0) missed.push('NO LETTERS TYPED');
      else { if (game.finalWpm < TARGET_WPM) missed.push(`SPEED MISSED: ${game.finalWpm.toFixed(1)} / 40 WPM`); if (game.finalAcc < TARGET_ACC) missed.push(`ACCURACY MISSED: ${game.finalAcc.toFixed(1)} / 88%`); }
      missed.forEach((m, i) => this.text(m, 2, C.AMBER, W / 2, 322 + i * 26));
      this.text('PRESS R TO RETRY', 4, Math.floor(t * 2) % 2 ? C.DOOR : C.SPOT, W / 2, 420);
    } else if (st === 'VICTORY_DANCE' || st === 'DOOR_OPENING' || st === 'PORTAL_ENTRY') {
      this.text(`${game.finalWpm.toFixed(0)} WPM  ·  ${game.finalAcc.toFixed(1)}%`, 4, C.DOOR, W / 2, 506);
      this.text(st === 'VICTORY_DANCE' ? 'CHALLENGE COMPLETE!' : 'THE PHASE DOOR OPENS...', 3, C.AMBER, W / 2, 548);
    } else if (st === 'TRANSITION_SCREEN') {
      const c = this.ctx; c.fillStyle = rgb(C.STAGE, Math.min(0.73, game.phaseT * 1.2)); c.fillRect(0, 0, W, H);
      this.text('PHASE DOOR UNLOCKED.', 6, C.DOOR, W / 2, 250);
      this.text('TRANSITIONING TO LEVEL: RED', 4, C.SPOT, W / 2, 310);
      this.text(`${game.finalWpm.toFixed(1)} WPM  ·  ${game.finalAcc.toFixed(1)}% ACCURACY`, 2, C.HUD, W / 2, 360);
      this.text('PRESS R TO RESTART', 3, Math.floor(t * 2) % 2 ? C.AMBER : C.HUD, W / 2, 420);
    }
    this.soundButton();
  }
  private soundButton() {
    this.panel(W - 120, H - 34, 110, 26, 0.78);
    this.text(this.muted ? 'MUTED' : 'SOUND', 2, C.HUD, W - 65, H - 21, 'center', null);
    this.buttons.mute = { x: W - 120, y: H - 34, w: 110, h: 26 };
  }
}
