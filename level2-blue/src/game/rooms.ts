/* ============================================================================
   Pixel-art rooms for Level 3 (The Overlap Trap) and Level 4 (The Remainder
   Lock). Same palette, font and style as the balance chamber in scene.ts.
   ============================================================================ */
import { PALETTE as P } from './config';
import { OVERLAP_GRAPH, OVERLAP_TRIANGLES } from './geometry';
import { DIAGRAM_RENDER_SEGMENTS, DIAGRAM_SIZE } from './geometryRender';
import { FLOOR_Y, LOCK_PANEL, MONITOR, TERMINAL } from './layout';
import { GRID_NUMBERS } from './remainder';
import { prompt } from './scene';
import { drawText, px, textWidth } from './sprites';

type C2D = CanvasRenderingContext2D;

/** Bresenham line on the pixel grid. */
function line(g: C2D, x0: number, y0: number, x1: number, y1: number, c: string) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(g, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Animated circuit traces along the lower wall: pulses travel at constant speed. */
export function drawCircuitry(g: C2D, t: number, power: number) {
  const rows = [164, 186, 212];
  rows.forEach((y, r) => {
    px(g, 14, y, P.dark, 452, 1);
    for (let k = 0; k < 4; k++) {
      const x = 14 + ((t * (40 + r * 12) + k * 113 + r * 37) % 452);
      g.globalAlpha = power; px(g, Math.round(x), y, P.cyan, 6, 1); g.globalAlpha = 1;
    }
    for (let x = 40 + r * 23; x < 466; x += 71) { px(g, x, y - 3, P.dark, 1, 3); px(g, x - 1, y - 4, P.deep, 3, 1); }
  });
}

/* ---------------- Level 3 ---------------- */
export function drawDiagramMonitor(g: C2D, t: number, near: boolean, solved: boolean, solvedT: number, power: number) {
  const M = MONITOR;
  // stand + frame
  px(g, M.x + M.w / 2 - M.standW / 2, M.y + M.h, P.abyss, M.standW, FLOOR_Y - M.y - M.h);
  px(g, M.x + M.w / 2 - M.standW / 2 + 2, M.y + M.h, P.dark, M.standW - 4, FLOOR_Y - M.y - M.h);
  px(g, M.x - 3, M.y - 3, P.abyss, M.w + 6, M.h + 6);
  px(g, M.x - 2, M.y - 2, near ? P.electric : P.deep, M.w + 4, 1);
  px(g, M.x, M.y, P.navy, M.w, M.h);
  for (let y = M.y; y < M.y + M.h; y += 3) px(g, M.x, y, P.abyss, M.w, 1); // scanlines
  drawText(g, 'SECURITY: COUNT THE TRIANGLES', M.x + 6, M.y + 4, P.primary);
  // the verified diagram, scaled to fit
  const s = 17, ox = M.x + (M.w - DIAGRAM_SIZE * s) / 2, oy = M.y + 14;
  const map = (p: { x: number; y: number }) => ({ x: ox + p.x * s, y: oy + p.y * s });
  if (solved) { // sweep a glow through every verified triangle, one after another
    const tri = OVERLAP_TRIANGLES[Math.floor(solvedT * 6) % OVERLAP_TRIANGLES.length];
    const v = tri.map((i) => map(OVERLAP_GRAPH.points[i]));
    for (let k = 0; k < 3; k++) { const a = v[k], b = v[(k + 1) % 3]; line(g, a.x, a.y, b.x, b.y, P.ice); line(g, a.x + 1, a.y, b.x + 1, b.y, P.cyan); }
  }
  g.globalAlpha = 0.6 + 0.4 * power;
  for (const sg of DIAGRAM_RENDER_SEGMENTS) {
    const a = map(sg.a), b = map(sg.b);
    line(g, a.x, a.y, b.x, b.y, sg.kind === 'diagonal' ? P.cyan : P.electric);
  }
  g.globalAlpha = 1;
  OVERLAP_GRAPH.points.forEach((p, i) => {
    const q = map(p), on = Math.sin(t * 3 + i) > 0.3;
    px(g, Math.round(q.x) - 1, Math.round(q.y) - 1, on ? P.ice : P.pale, 3, 3);
  });
  if (solved) drawText(g, 'ACCEPTED', M.x + M.w - textWidth('ACCEPTED') - 6, M.y + M.h - 9, P.ice);
  if (near && !solved) prompt(g, M.x + M.w / 2, M.y + M.h + 6, t, '[E] INSPECT');
}

/* ---------------- Level 4 ---------------- */
export interface LockView { selected: number | null; eliminated: ReadonlySet<number>; solvedTile: number | null; digitDone: boolean; errorT: number }
export function drawLockPanel(g: C2D, t: number, near: boolean, v: LockView) {
  const L = LOCK_PANEL;
  px(g, L.x + L.w / 2 - 6, L.y + L.h, P.abyss, 12, FLOOR_Y - L.y - L.h);
  px(g, L.x - 3, L.y - 3, P.abyss, L.w + 6, L.h + 6);
  px(g, L.x - 2, L.y - 2, near ? P.electric : P.deep, L.w + 4, 1);
  px(g, L.x, L.y, P.navy, L.w, L.h);
  const shake = v.errorT > 0 ? Math.round(Math.sin(t * 60) * 2 * v.errorT) : 0;
  const grid = 4 * L.tile + 3 * L.gap, gx = L.x + (L.w - grid) / 2 + shake, gy = L.y + 8;
  GRID_NUMBERS.forEach((n, i) => {
    const x = gx + (i % 4) * (L.tile + L.gap), y = gy + Math.floor(i / 4) * (L.tile + L.gap);
    const safe = v.solvedTile === n, elim = v.eliminated.has(n), sel = v.selected === n;
    const pulse = safe ? (Math.sin(t * 6) > 0 ? P.ice : P.cyan) : sel ? P.electric : elim ? P.navy : P.deep;
    px(g, x, y, P.abyss, L.tile, L.tile);
    px(g, x + 1, y + 1, pulse, L.tile - 2, L.tile - 2);
    px(g, x + 1, y + 1, safe ? P.ice : elim ? P.dark : P.primary, L.tile - 2, 1);
    const s = String(n), col = safe ? P.abyss : elim ? P.deep : P.pale;
    drawText(g, s, x + (L.tile - textWidth(s, 2)) / 2, y + (L.tile - 10) / 2, col, 2);
    if (elim && !safe) for (let k = 3; k < L.tile - 3; k++) px(g, x + k, y + k, P.dark);
  });
  // lock status lamps: tile, digit
  const lamp = (x: number, on: boolean) => { px(g, x, L.y + L.h - 10, P.abyss, 8, 6); px(g, x + 1, L.y + L.h - 9, on ? P.ice : P.dark, 6, 4); };
  lamp(L.x + 8, v.solvedTile != null); lamp(L.x + 20, v.digitDone);
  drawText(g, 'LOCK', L.x + L.w - 22, L.y + L.h - 9, v.digitDone ? P.ice : P.primary);
  if (near && !v.digitDone) prompt(g, L.x + L.w / 2, L.y + L.h + 6, t, '[E] USE LOCK');
}

export function drawTerminal(g: C2D, t: number, near: boolean, active: boolean, done: boolean) {
  const c = TERMINAL;
  px(g, c.x, c.y, P.abyss, c.w, c.h); px(g, c.x + 1, c.y + 1, P.dark, c.w - 2, c.h - 2);
  px(g, c.x + 1, c.y + 1, near && active ? P.electric : P.deep, c.w - 2, 1);
  px(g, c.x + 4, c.y + 6, P.abyss, c.w - 8, 26);
  const label = done ? 'OPEN' : active ? 'CODE' : 'LOCK';
  drawText(g, label, c.x + (c.w - textWidth(label)) / 2, c.y + 10, done ? P.ice : active ? P.cyan : P.deep);
  for (let k = 0; k < 4; k++) px(g, c.x + 7 + k * 8, c.y + 20, active && (Math.floor(t * 4) + k) % 4 === 0 ? P.ice : active ? P.primary : P.dark, 5, 5);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) px(g, c.x + 7 + k * 8, c.y + 38 + r * 7, P.deep, 5, 4);
  if (near && active && !done) prompt(g, c.x + c.w / 2, c.y - 12, t);
}

/** Facility powering down after the escape: lights fade in steps (no flashing). */
export function drawPowerDown(g: C2D, k: number) {
  if (k <= 0) return;
  g.globalAlpha = Math.min(0.55, Math.floor(k * 6) / 6 * 0.55);
  px(g, 0, 0, P.abyss, 480, 270);
  g.globalAlpha = 1;
}
