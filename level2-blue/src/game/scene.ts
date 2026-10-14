/* ============================================================================
   Scene rendering (pixel art, blue only). The static background is baked once
   with dithered gradients; animated layers (water distortion, light shafts,
   caustics, machines, particles, flood) are drawn every frame.
   Layout echoes the reference: light shafts from above, a stepped ruin on the
   left, a layered coral "tree" on the right, a pale striped sea floor.
   ============================================================================ */
import { PALETTE as P, VIEW_H, VIEW_W } from './config';
import { BALANCE, CONSOLE, DOOR, FLOOR_Y, LEDGE, PLATES, WALL_L, WALL_R } from './layout';
import type { Balance } from './physics';
import { EQUATIONS, SHAPE_OF, WEIGHT_IDS, equationText, type WeightId, type WeightVerdict } from './puzzle';
import { drawShape, drawText, px, textWidth } from './sprites';

type C2D = CanvasRenderingContext2D;
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const hex = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

/** Ordered-dither vertical gradient through a list of colours. */
function ditherGradient(g: C2D, x0: number, y0: number, w: number, h: number, stops: string[]) {
  const img = g.getImageData(x0, y0, w, h), cols = stops.map(hex), n = cols.length - 1;
  for (let y = 0; y < h; y++) {
    const t = (y / (h - 1)) * n;
    for (let x = 0; x < w; x++) {
      const i0 = Math.min(n - 1, Math.floor(t)), frac = t - i0;
      const c = frac > (BAYER4[(y0 + y) & 3][(x0 + x) & 3] + 0.5) / 16 ? cols[i0 + 1] : cols[i0];
      const k = (y * w + x) * 4; img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, x0, y0);
}

export interface Background { ocean: HTMLCanvasElement; facility: HTMLCanvasElement }

export function buildBackground(): Background {
  const R = rng(7);
  /* ---- ocean seen through the observation window ---- */
  const ocean = document.createElement('canvas'); ocean.width = VIEW_W; ocean.height = VIEW_H;
  const o = ocean.getContext('2d')!;
  ditherGradient(o, 0, 0, VIEW_W, 170, [P.deep, P.dark, P.navy, P.abyss]);
  // stepped ruin (left)
  const steps = [[18, 118, 150, 60], [30, 108, 126, 10], [44, 100, 98, 8], [60, 94, 66, 6]];
  steps.forEach(([x, y, w, h]) => { px(o, x, y, P.dark, w, h); px(o, x, y, P.deep, w, 1); });
  for (let i = 0; i < 5; i++) px(o, 34 + i * 26, 130, P.navy, 8, 14);
  px(o, 12, 112, P.navy, 170, 3);
  // layered coral tree (right): slabs widening downward
  for (let k = 0; k < 15; k++) {
    const y = 22 + k * 9, half = 8 + k * 3.4 + (R() - 0.5) * 6, cx = 420 + Math.sin(k * 1.3) * 7;
    const x = Math.round(cx - half), w = Math.round(half * 2);
    px(o, x, y, k % 2 ? P.deep : P.primary, w, 6);
    px(o, x, y, P.cyan, Math.round(w * 0.45), 1);
    px(o, x + 2, y + 6, P.navy, w - 4, 2);
    for (let j = 0; j < 4; j++) px(o, x + Math.floor(R() * w), y + 1 + Math.floor(R() * 4), P.electric, 2, 1);
  }
  px(o, 412, 150, P.dark, 16, 20);
  // floating debris
  for (let i = 0; i < 40; i++) px(o, Math.floor(R() * VIEW_W), 20 + Math.floor(R() * 130), R() > 0.6 ? P.deep : P.dark, 2 + Math.floor(R() * 4), 1 + Math.floor(R() * 2));

  /* ---- research facility frame (drawn over the ocean, not distorted) ---- */
  const facility = document.createElement('canvas'); facility.width = VIEW_W; facility.height = VIEW_H;
  const f = facility.getContext('2d')!;
  // top beam
  px(f, 0, 0, P.navy, VIEW_W, 16); px(f, 0, 15, P.deep, VIEW_W, 1); px(f, 0, 16, P.abyss, VIEW_W, 2);
  for (let x = 24; x < VIEW_W; x += 32) px(f, x, 6, P.dark, 2, 2);
  drawText(f, 'BLUE LAB 02', 200, 5, P.primary);
  // window sill + lower wall
  px(f, 0, 150, P.abyss, VIEW_W, 2); px(f, 0, 152, P.deep, VIEW_W, 2); px(f, 0, 154, P.navy, VIEW_W, 72);
  for (let x = 14; x < VIEW_W; x += 40) px(f, x, 156, P.abyss, 1, 70);
  [170, 204].forEach((y) => { px(f, 0, y, P.dark, VIEW_W, 4); px(f, 0, y, P.deep, VIEW_W, 1); });
  // mullions
  [236].forEach((x) => { px(f, x, 18, P.abyss, 6, 134); px(f, x + 1, 18, P.dark, 4, 134); });
  // walls
  [[0, WALL_L], [WALL_R, VIEW_W - WALL_R]].forEach(([x, w]) => {
    px(f, x, 0, P.dark, w, VIEW_H); px(f, x + (x === 0 ? w - 2 : 0), 0, P.abyss, 2, VIEW_H);
    for (let y = 12; y < FLOOR_Y; y += 20) px(f, x + 4, y, P.deep, 2, 2);
  });
  // floor: striped tiles like the reference's pale sea floor
  px(f, 0, FLOOR_Y, P.cyan, VIEW_W, 1);
  px(f, 0, FLOOR_Y + 1, P.primary, VIEW_W, 3);
  ditherGradient(f, 0, FLOOR_Y + 4, VIEW_W, VIEW_H - FLOOR_Y - 4, [P.deep, P.dark, P.navy]);
  for (let y = FLOOR_Y + 8; y < VIEW_H; y += 9) for (let x = (y * 7) % 23; x < VIEW_W; x += 23 + ((x * 13) % 17)) px(f, x, y, P.primary, 6 + ((x * 3) % 9), 1);
  // driftwood shapes on the floor
  [[60, FLOOR_Y + 30, 34], [300, FLOOR_Y + 36, 46]].forEach(([x, y, w]) => { px(f, x, y, P.deep, w, 3); px(f, x + 4, y - 2, P.deep, 8, 2); px(f, x, y + 3, P.navy, w, 1); });
  return { ocean, facility };
}

/** Ocean with a sine-wave water distortion (2 px strips), then the shimmering light shafts. */
export function drawBackground(g: C2D, bg: Background, t: number, shafts: { x: number; w: number; len: number; ph: number }[]) {
  for (let y = 18; y < 150; y += 2) {
    const dx = Math.round(Math.sin(y * 0.09 + t * 1.6) * 1.2);
    g.drawImage(bg.ocean, 0, y, VIEW_W, 2, dx, y, VIEW_W, 2);
  }
  for (const s of shafts) {
    const a = 0.1 + 0.08 * Math.sin(t * 0.8 + s.ph);
    for (let k = 0; k < s.len; k += 6) {
      g.globalAlpha = a * (1 - k / s.len);
      px(g, s.x + Math.round(Math.sin(t + s.ph) * 1), 18 + k, P.cyan, s.w, 6);
    }
  }
  g.globalAlpha = 1;
  g.drawImage(bg.facility, 0, 0);
  // caustics rippling over the floor edge: sum of two travelling sines
  for (let x = WALL_L; x < WALL_R; x += 2) {
    const v = Math.sin(x * 0.09 + t * 1.3) + Math.sin(x * 0.047 - t * 0.9 + 2);
    if (v > 1.3) px(g, x, FLOOR_Y + 1 + ((x >> 1) % 2), P.pale, 2, 1);
  }
}

/* ---------------- console ---------------- */
export function drawConsole(g: C2D, t: number, near: boolean, solved: boolean, open: boolean) {
  const c = CONSOLE, s = c.screen;
  px(g, c.x, c.y, P.abyss, c.w, c.h); px(g, c.x + 1, c.y + 1, P.dark, c.w - 2, c.h - 2);
  px(g, c.x + 1, c.y + 1, near ? P.electric : P.deep, c.w - 2, 1);
  px(g, s.x, s.y, P.abyss, s.w, s.h);
  for (let y = s.y; y < s.y + s.h; y += 2) px(g, s.x, y, P.navy, s.w, 1); // scanlines
  EQUATIONS.forEach((e, i) => drawText(g, equationText(e).replace(/ /g, ''), s.x + 3, s.y + 3 + i * 8, solved ? P.pale : P.cyan));
  if (!solved && Math.floor(t * 2) % 2 === 0) px(g, s.x + 30, s.y + 19, P.cyan, 3, 5);
  if (solved) drawText(g, 'OK', s.x + 27, s.y + 19, P.ice);
  // keypad
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) px(g, c.x + 8 + k * 8, c.y + 40 + r * 6, open && (Math.floor(t * 8) + r + k) % 5 === 0 ? P.cyan : P.deep, 5, 3);
  if (near && !open) prompt(g, c.x + c.w / 2, c.y - 10, t);
}

export function prompt(g: C2D, cx: number, y: number, t: number, label = '[E]') {
  const w = textWidth(label) + 4, bob = Math.round(Math.sin(t * 4));
  px(g, Math.round(cx - w / 2), y + bob, P.abyss, w, 9); px(g, Math.round(cx - w / 2), y + bob, P.electric, w, 1);
  drawText(g, label, Math.round(cx - w / 2) + 2, y + 2 + bob, P.ice);
}

/* ---------------- balance apparatus ---------------- */
export interface ScaleView {
  balance: Balance; verdict: WeightVerdict | 'unknown'; blocksLanded: number; falling: { y: number }[];
  glow: number;
}
const panPos = (cx: number, b: Balance, side: -1 | 1) => {
  const a = b.angle; // > 0 → left pan down
  const ex = cx + side * BALANCE.arm * Math.cos(a), ey = BALANCE.pivotY - side * BALANCE.arm * Math.sin(a);
  return { x: ex, y: ey + BALANCE.chain };
};
export const counterPanTop = (cx: number, b: Balance, landed: number) => panPos(cx, b, 1).y - 1 - Math.ceil(landed / 2) * 3;

export function drawBalance(g: C2D, t: number, scales: Record<WeightId, ScaleView>, near: boolean, verified: boolean) {
  const B = BALANCE;
  // frame + mapping placard
  px(g, B.x, B.barY, P.abyss, B.w, 6); px(g, B.x + 1, B.barY + 1, verified ? P.primary : P.deep, B.w - 2, 4); px(g, B.x + 1, B.barY + 1, P.electric, B.w - 2, 1);
  [B.x + 2, B.x + B.w - 7].forEach((x) => { px(g, x, B.barY + 6, P.abyss, 5, FLOOR_Y - B.barY - 6); px(g, x + 1, B.barY + 6, P.deep, 3, FLOOR_Y - B.barY - 6); });
  const plaqueX = B.x + 40, plaqueY = B.barY - 16;
  px(g, plaqueX, plaqueY, P.abyss, 102, 14); px(g, plaqueX + 1, plaqueY + 1, P.navy, 100, 12);
  WEIGHT_IDS.forEach((id, i) => {
    const x = plaqueX + 8 + i * 34;
    drawShape(g, SHAPE_OF[id], x + 4, plaqueY + 11, 8, P.primary, P.cyan);
    drawText(g, `=${id}`, x + 10, plaqueY + 4, P.pale);
  });
  for (const id of WEIGHT_IDS) {
    const cx = B.scales[id], s = scales[id], b = s.balance;
    // hanger + pivot lamp
    px(g, cx, B.barY + 6, P.deep, 1, B.pivotY - B.barY - 6);
    const lamp = s.verdict === 'correct' ? (Math.sin(t * 6) > 0 ? P.ice : P.cyan) : s.verdict === 'low' || s.verdict === 'high' ? (Math.floor(t * 8) % 2 ? P.electric : P.abyss) : P.dark;
    px(g, cx - 2, B.pivotY - 2, P.abyss, 5, 5); px(g, cx - 1, B.pivotY - 1, lamp, 3, 3);
    // beam: rasterised rotated line
    const L = B.arm;
    for (let k = -L; k <= L; k++) {
      const x = cx + k * Math.cos(b.angle), y = B.pivotY - k * Math.sin(b.angle);
      px(g, Math.round(x), Math.round(y), s.glow > 0.05 ? P.pale : P.electric, 1, 2);
    }
    // pans + chains
    ([-1, 1] as const).forEach((side) => {
      const p = panPos(cx, b, side);
      const ex = Math.round(cx + side * L * Math.cos(b.angle)), ey = Math.round(B.pivotY - side * L * Math.sin(b.angle));
      for (let y = ey + 1; y < p.y; y += 2) { px(g, ex - 5, y, P.deep); px(g, ex + 5, y, P.deep); }
      px(g, Math.round(p.x) - 8, Math.round(p.y), P.abyss, 17, 3); px(g, Math.round(p.x) - 7, Math.round(p.y), P.primary, 15, 1);
    });
    // unknown weight on the left pan
    const lp = panPos(cx, b, -1);
    drawShape(g, SHAPE_OF[id], Math.round(lp.x) + 0.5, Math.round(lp.y), 12, s.glow > 0.05 ? P.cyan : P.primary, P.ice);
    drawText(g, id, Math.round(lp.x) - 1, Math.round(lp.y) - 9, P.abyss);
    // counterweight blocks on the right pan (2 columns)
    const rp = panPos(cx, b, 1);
    for (let k = 0; k < s.blocksLanded; k++) {
      const col = k % 2, row = Math.floor(k / 2);
      const bx = Math.round(rp.x) - 5 + col * 5, by = Math.round(rp.y) - 3 - row * 3;
      px(g, bx, by, P.abyss, 5, 3); px(g, bx + 1, by, P.pale, 3, 2);
    }
    for (const fb of s.falling) { px(g, Math.round(rp.x) - 3, Math.round(fb.y), P.abyss, 5, 3); px(g, Math.round(rp.x) - 2, Math.round(fb.y), P.ice, 3, 2); }
    // verdict marker under the scale
    const mx = cx - 3, my = B.pivotY + 46;
    if (s.verdict === 'correct') { drawText(g, 'OK', cx - 3, my, P.ice); }
    else if (s.verdict === 'low' || s.verdict === 'high') { drawText(g, s.verdict === 'low' ? '>' : '<', mx + 2, my, Math.floor(t * 6) % 2 ? P.ice : P.electric); }
    else drawText(g, '?', mx + 2, my, P.deep);
  }
  if (near) prompt(g, B.x + B.w / 2, B.pivotY + 58, t, '[E] INSPECT');
}

/* ---------------- ledge, plates, door ---------------- */
export function drawLedge(g: C2D) {
  const l = LEDGE;
  px(g, l.x, l.y, P.abyss, l.w, l.h); px(g, l.x + 1, l.y, P.primary, l.w - 2, 2); px(g, l.x, l.y, P.cyan, l.w, 1);
  [l.x + 4, l.x + l.w - 8].forEach((x) => { px(g, x, l.y + l.h, P.abyss, 4, FLOOR_Y - l.y - l.h); px(g, x + 1, l.y + l.h, P.dark, 2, FLOOR_Y - l.y - l.h); });
}

export interface PlateView { offset: number; lit: boolean; active: boolean; flash: number; near: boolean }
export function drawPlates(g: C2D, t: number, plates: Record<WeightId, PlateView>) {
  for (const id of WEIGHT_IDS) {
    const p = PLATES[id], v = plates[id], x = p.x, y = p.y;
    // sign post with letter + shape
    px(g, x + p.w / 2, y - 26, P.deep, 1, 22);
    px(g, x + 1, y - 34, P.abyss, p.w - 2, 11);
    px(g, x + 2, y - 33, v.lit ? P.primary : P.navy, p.w - 4, 9);
    drawText(g, id, x + 4, y - 31, v.active ? P.ice : P.deep);
    drawShape(g, SHAPE_OF[id], x + 14, y - 25, 6, v.active ? P.cyan : P.dark, v.active ? P.pale : P.deep);
    // socket + plate (spring offset pushes it down)
    px(g, x - 1, y - 2, P.abyss, p.w + 2, 2);
    const off = Math.round(v.offset);
    const glow = v.lit ? P.ice : v.active ? (Math.sin(t * 5 + x) > 0 ? P.cyan : P.electric) : P.deep;
    px(g, x, y - 4 + off, P.abyss, p.w, 3); px(g, x + 1, y - 4 + off, glow, p.w - 2, 2);
    if (v.flash > 0) { g.globalAlpha = Math.min(1, v.flash); px(g, x - 3, y - 8, P.electric, p.w + 6, 2); g.globalAlpha = 1; }
    if (v.near && v.active && !v.lit) prompt(g, x + p.w / 2, y - 48, t);
  }
}

export function drawDoor(g: C2D, t: number, offset: number, unlocked: boolean, near: boolean) {
  const d = DOOR;
  px(g, d.x - 2, d.y - 3, P.abyss, d.w + 2, 3);
  px(g, d.x, d.y, P.abyss, d.w, d.h); // opening (dark beyond)
  g.save(); g.beginPath(); g.rect(d.x, d.y, d.w, d.h); g.clip();
  const y = d.y + Math.round(offset);
  px(g, d.x, y, P.deep, d.w, d.h); px(g, d.x, y, P.primary, 2, d.h);
  for (let k = 8; k < d.h; k += 12) px(g, d.x, y + k, P.dark, d.w, 2);
  const lamp = unlocked ? P.ice : Math.floor(t * 2) % 2 ? P.electric : P.dark;
  px(g, d.x + 4, y + d.h / 2 - 4, P.abyss, 6, 8); px(g, d.x + 5, y + d.h / 2 - 3, lamp, 4, 6);
  g.restore();
  drawText(g, 'EXIT', d.x - 18, d.y - 12, unlocked ? P.ice : P.deep);
  if (near && unlocked) prompt(g, d.x - 10, d.y - 24, t, 'GO >');
}

/* ---------------- particles + overlays ---------------- */
export interface Bubble { x: number; y: number; r: number; vy: number; ph: number; life: number }
export function drawBubbles(g: C2D, bubbles: Bubble[]) {
  for (const b of bubbles) {
    const x = Math.round(b.x), y = Math.round(b.y);
    if (b.r <= 1) px(g, x, y, P.pale);
    else { px(g, x - 1, y, P.cyan, 3, 1); px(g, x, y - 1, P.cyan, 1, 3); px(g, x - 1, y - 1, P.ice); }
  }
}

/** Flood: water rises with a surface built from two travelling sine waves. */
export function drawFlood(g: C2D, t: number, level: number) {
  if (level <= 0) return;
  const top = VIEW_H - level;
  for (let x = 0; x < VIEW_W; x += 2) {
    const y = Math.round(top + 2 * Math.sin(x * 0.08 + t * 4) + Math.sin(x * 0.21 - t * 3));
    g.globalAlpha = 0.55; px(g, x, y, P.electric, 2, VIEW_H - y);
    g.globalAlpha = 1; px(g, x, y, P.pale, 2, 1);
  }
  g.globalAlpha = 1;
}

/** Danger border: pulses faster as time runs out (blue only, no strobing). */
export function drawWarning(g: C2D, t: number, remainingMs: number) {
  if (remainingMs > 30_000) return;
  const urgent = remainingMs < 10_000;
  const a = (urgent ? 0.5 : 0.25) * (0.5 + 0.5 * Math.sin(t * (urgent ? 7 : 3.5)));
  g.globalAlpha = a;
  const th = urgent ? 4 : 2;
  px(g, 0, 0, P.electric, VIEW_W, th); px(g, 0, VIEW_H - th, P.electric, VIEW_W, th);
  px(g, 0, 0, P.electric, th, VIEW_H); px(g, VIEW_W - th, 0, P.electric, th, VIEW_H);
  g.globalAlpha = 1;
}
