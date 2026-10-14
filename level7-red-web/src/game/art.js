/* RED art — procedural geometry only, monochromatic red family. Style after the references:
 * glowing red "window" panels inside dark architecture, light cones, a big soft diamond, and a lit doorway. */
import { COLORS, DOOR, doorRect } from './redLogic.js';

/** Static backdrop for a room: dark mass, lit panels with frames, cones of light and (optionally) the glowing diamond. */
export function drawBackdrop(g, room, variant = 0) {
  g.fillStyle(COLORS.bg0, 1).fillRect(0, 0, 1280, 720);
  const panels = [[40, 40, 400, 640], [460, 40, 300, 640], [780, 40, 260, 640], [1060, 40, 200, 640]];
  panels.forEach(([x, y, w, h], i) => {
    g.fillStyle(COLORS.bg1, 1).fillRect(x, y, w, h);
    for (let k = 1; k <= 5; k++) g.fillStyle(COLORS.dim, 0.05).fillRect(x + w * 0.1 * k, y + h * 0.06 * k, w * (1 - 0.2 * k), h * (1 - 0.12 * k));   // soft inner glow
    const cx = x + w / 2 + ((i * 37 + variant * 53) % 60) - 30;                                                      // light cone from the ceiling
    g.fillStyle(COLORS.soft, 0.07).fillTriangle(cx - 6, y, cx + 6, y, cx + w * 0.38, y + h * 0.9);
    g.fillStyle(COLORS.soft, 0.07).fillTriangle(cx - 6, y, cx + 6, y, cx - w * 0.38, y + h * 0.9);
    g.fillStyle(COLORS.pale, 0.05).fillTriangle(cx - 3, y, cx + 3, y, cx, y + h * 0.75);
  });
  g.fillStyle(COLORS.bg0, 1);                                                    // window frames / beams
  [[440, 0, 20, 720], [760, 0, 20, 720], [1040, 0, 20, 720]].forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
  g.fillStyle(COLORS.bg2, 1).fillRect(460, 330 + variant * 20, 300, 10);
  g.lineStyle(10, COLORS.bg0, 1).lineBetween(470, 60, 750, 300 + variant * 30);
  if (variant % 2 === 0) {                                                       // the big soft diamond
    const cx = 910, cy = 170;
    [[130, 0.08], [100, 0.12], [70, 0.2], [40, 0.35]].forEach(([r, a]) => { g.fillStyle(COLORS.flash, a).fillPoints([{ x: cx, y: cy - r }, { x: cx + r, y: cy }, { x: cx, y: cy + r }, { x: cx - r, y: cy }], true); });
  }
  g.fillStyle(COLORS.bg0, 0.55).fillRect(0, 0, 1280, 26).fillRect(0, 694, 1280, 26);
}

export function drawPlatform(g, p) {
  g.fillStyle(COLORS.bg0, 0.6).fillRect(p.x + 6, p.y + 8, p.w, p.h);             // drop shadow
  g.fillStyle(COLORS.platform, 1).fillRect(p.x, p.y, p.w, p.h);
  g.fillStyle(COLORS.bg2, 1).fillRect(p.x, p.y + Math.min(8, p.h), p.w, Math.max(0, p.h - 8));
  g.lineStyle(6, COLORS.edge, 0.12).lineBetween(p.x, p.y + 1, p.x + p.w, p.y + 1);   // edge glow
  g.lineStyle(2, COLORS.edge, 1).lineBetween(p.x, p.y + 1, p.x + p.w, p.y + 1);
}

/** Row of triangular spikes filling rect r, pointing up or down, with a soft glow. `k` (0..1) scales their height (pop-up). */
export function drawSpikes(g, r, dir = 'up', k = 1, alpha = 1) {
  const n = Math.max(1, Math.round(r.w / 20)), w = r.w / n, h = r.h * k;
  for (let i = 0; i < n; i++) {
    const x = r.x + i * w;
    const pts = dir === 'up'
      ? [{ x, y: r.y + r.h }, { x: x + w / 2, y: r.y + r.h - h }, { x: x + w, y: r.y + r.h }]
      : [{ x, y: r.y }, { x: x + w / 2, y: r.y + h }, { x: x + w, y: r.y }];
    g.fillStyle(COLORS.hazard, 0.22 * alpha).fillTriangle(pts[0].x - 4, pts[0].y, pts[1].x, pts[1].y + (dir === 'up' ? -6 : 6), pts[2].x + 4, pts[2].y);
    g.fillStyle(COLORS.hazard, alpha).fillTriangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    g.fillStyle(COLORS.flash, 0.5 * alpha).fillTriangle(pts[0].x + w * 0.35, pts[0].y, pts[1].x, pts[1].y + (dir === 'up' ? 3 : -3), pts[1].x, pts[0].y);
  }
}

/** Dashed outline (mercy mode) of a hazard that is still hidden. */
export function drawDashedRect(g, r, color = COLORS.pale) {
  g.lineStyle(2, color, 0.9);
  const dash = 6, gap = 5;
  const edge = (x0, y0, x1, y1) => { const len = Math.hypot(x1 - x0, y1 - y0); for (let d = 0; d < len; d += dash + gap) { const a = d / len, b = Math.min(1, (d + dash) / len); g.lineBetween(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b); } };
  edge(r.x, r.y, r.x + r.w, r.y); edge(r.x + r.w, r.y, r.x + r.w, r.y + r.h); edge(r.x + r.w, r.y + r.h, r.x, r.y + r.h); edge(r.x, r.y + r.h, r.x, r.y);
}

/** The exit: a lit doorway whose light spills across the floor (after the second reference). `lit` 0..1. */
export function drawDoor(g, exit, lit = 1, t = 0) {
  const r = doorRect(exit), pulse = 0.85 + 0.15 * Math.sin(t * 2.2);
  for (let i = 4; i >= 1; i--) g.fillStyle(COLORS.edge, 0.05 * lit * pulse).fillRect(r.x - i * 10, r.y - i * 10, r.w + i * 20, r.h + i * 10);
  g.fillStyle(COLORS.flash, 0.1 * lit).fillPoints([{ x: r.x, y: exit.y }, { x: r.x + r.w, y: exit.y }, { x: r.x + r.w + 70, y: exit.y + 26 }, { x: r.x - 70, y: exit.y + 26 }], true);
  g.fillStyle(COLORS.dim, 1).fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle(COLORS.edge, 0.35 + 0.65 * lit).fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 3);
  g.fillStyle(COLORS.pale, 0.6 * lit).fillRect(r.x + r.w * 0.55, r.y + r.h * 0.3, r.w * 0.38, r.h * 0.7);   // inner doorway (depth)
  g.fillStyle(COLORS.flash, 0.35 * lit * pulse).fillRect(r.x + 10, r.y + 12, r.w - 20, r.h - 16);
}

/**
 * Thanos, in a long coat (40 × 56 hitbox centred on x, y). facing ±1, phase = walk cycle, air = airborne.
 * Square chunky head with the ridged chin, glowing eye, armoured collar, coat, and the Gauntlet.
 */
export function drawThanos(g, x, y, facing = 1, phase = 0, air = false, alpha = 1) {
  const f = facing, stride = air ? 4 : Math.sin(phase) * 6;
  g.fillStyle(COLORS.bg0, 0.45 * alpha).fillEllipse(x, y + 30, 40, 7);
  g.fillStyle(COLORS.coat, alpha);                                               // legs
  g.fillRect(x - 9 + stride * 0.5, y + 12, 7, 16); g.fillRect(x + 2 - stride * 0.5, y + 12, 7, 16);
  g.fillStyle(COLORS.body, alpha).fillRect(x - 10 + stride * 0.5, y + 25, 9, 4).fillRect(x + 1 - stride * 0.5, y + 25, 9, 4);
  const sway = air ? -3 : Math.sin(phase) * 2;                                   // the long coat
  g.fillStyle(COLORS.coat, alpha).fillPoints([{ x: x - 13, y: y - 10 }, { x: x + 13, y: y - 10 }, { x: x + 15 - sway * f, y: y + 18 }, { x: x - 15 - sway * f, y: y + 18 }], true);
  g.lineStyle(2, COLORS.bg2, alpha).lineBetween(x + 2 * f, y - 8, x + 2 * f, y + 17);
  g.fillStyle(COLORS.body, alpha).fillRect(x - 14, y - 12, 28, 6);               // gold-armour collar, in red
  g.fillStyle(COLORS.flash, 0.35 * alpha).fillRect(x - 12, y - 12, 10, 2);
  const hx = x + f * 13, hy = y + 2 + (air ? -8 : Math.cos(phase) * 2);          // arm + Gauntlet
  g.lineStyle(6, COLORS.coat, alpha).lineBetween(x + f * 9, y - 7, hx, hy);
  g.fillStyle(COLORS.body, alpha).fillCircle(hx, hy, 5);
  g.fillStyle(COLORS.flash, alpha).fillCircle(hx - 2, hy - 1, 1.2).fillCircle(hx + 1, hy - 2, 1.2).fillCircle(hx + 2, hy + 1, 1.2);
  g.fillStyle(COLORS.body, alpha).fillRoundedRect(x - 11, y - 33, 22, 22, 5);   // bald, square head
  g.fillStyle(COLORS.soft, alpha).fillRect(x - 11 + (f > 0 ? 0 : 16), y - 31, 6, 18);
  g.fillStyle(COLORS.flash, 0.5 * alpha).fillRect(x - 6, y - 32, 8, 2);
  g.lineStyle(1.5, COLORS.coat, alpha);
  for (const k of [-4, -1, 2, 5]) g.lineBetween(x + k + f * 2, y - 18, x + k + f * 2, y - 12);   // chin ridges
  g.lineBetween(x - 2 + f * 3, y - 25, x + 7 * f + f * 2, y - 26);              // heavy brow
  g.fillStyle(0xffe1e1, alpha).fillRect(x + f * 5 - 1.5, y - 24, 3, 2);         // glowing eye
}
