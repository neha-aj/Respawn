/* YELLOW renderer — golden throne-room arena on a 450 × 325 canvas (×2), fighters on a half-size layer (×4: chunky pixels),
 * and a pixel-font HUD after the reference beat-'em-up. Mirrors the drawing in yellow.py. */
import {
  C, DODGE_COOLDOWN, ENEMY_POSES, FIG, GROUND, H, INTRO_LINES, LH, LW, PLAYER_POSES, PORTAL_X, RULES, CONTROLS, THANOS_DIMS,
  VICTORY_FLASH, VICTORY_TEXT, W, WOLVERINE_DIMS, rgb, type Pose, type RGB,
} from './config';
import { Door, Enemy, Player, type Fighter, type YellowGame } from './sim';

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
const TAU = Math.PI * 2;
const RIDGES = [0, 2, 4, 2].slice(0, 3), TRI = [0, 1, 2, 1].slice(0, 3);   // index lists (kept out of colour-triple form)
export const FONT = '"Press Start 2P", "Courier New", monospace';
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const seeded = (s: number) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const line = (g: Ctx, a: Pt, b: Pt, c: RGB | string, w: number) => { g.strokeStyle = typeof c === 'string' ? c : rgb(c); g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
const poly = (g: Ctx, pts: Pt[], c: RGB | string, stroke = 0) => {
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
  const s = typeof c === 'string' ? c : rgb(c); if (stroke) { g.strokeStyle = s; g.lineWidth = stroke; g.stroke(); } else { g.fillStyle = s; g.fill(); }
};
const circle = (g: Ctx, x: number, y: number, r: number, c: RGB | string, stroke = 0) => { g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, TAU); const s = typeof c === 'string' ? c : rgb(c); if (stroke) { g.strokeStyle = s; g.lineWidth = stroke; g.stroke(); } else { g.fillStyle = s; g.fill(); } };
const rect = (g: Ctx, x: number, y: number, w: number, h: number, c: RGB | string) => { g.fillStyle = typeof c === 'string' ? c : rgb(c); g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const limb = (g: Ctx, a: Pt, b: Pt, _col: RGB, w: number) => { line(g, a, b, C.INK, w + 2); };
const fillLimb = (g: Ctx, a: Pt, b: Pt, col: RGB, w: number) => line(g, a, b, col, w);

/** Joint positions for a side-view humanoid. Angles are measured from straight down, positive = forward. */
export function rigPoints(x: number, y: number, f: number, p: Pose, dims: readonly number[]) {
  const [TH, SH, TORSO, SHW, UA, FA] = dims, d = (a: number): Pt => [f * Math.sin(a), Math.cos(a)];
  const feet = [[p.fh, p.fk], [p.bh, p.bk]].map(([h, k]) => d(h)[1] * TH + d(h - k)[1] * SH);
  const hipY = y - Math.max(...feet) + p.dy;
  const J: Record<string, Pt> = { hip: [x, hipY], neck: [x + f * Math.sin(p.lean) * TORSO, hipY - Math.cos(p.lean) * TORSO] };
  const A: Record<string, number> = {};
  for (const [s, h, k, off] of [['f', p.fh, p.fk, 3], ['b', p.bh, p.bk, -3]] as const) {
    const hp: Pt = [x + f * off * 0.5, hipY], a = d(h), b = d(h - k), kn: Pt = [hp[0] + a[0] * TH, hp[1] + a[1] * TH];
    J[s + 'hp'] = hp; J[s + 'kn'] = kn; J[s + 'ft'] = [kn[0] + b[0] * SH, kn[1] + b[1] * SH];
  }
  for (const [s, sa, ea, off] of [['f', p.fs, p.fe, SHW * 0.35], ['b', p.bs, p.be, -SHW * 0.35]] as const) {
    const sh: Pt = [J.neck[0] + f * off, J.neck[1] + 3], a = d(sa), b = d(sa + ea), el: Pt = [sh[0] + a[0] * UA, sh[1] + a[1] * UA];
    J[s + 'sh'] = sh; J[s + 'el'] = el; J[s + 'ha'] = [el[0] + b[0] * FA, el[1] + b[1] * FA]; A[s] = sa + ea;
  }
  return { J, A };
}

/** Thanos: bald ridged head, gold-trimmed robe and shoulder armour, the Gauntlet, and a double-bladed sword for heavy swings. */
export function drawThanos(L: Ctx, pl: Fighter, x: number, y: number, t: number, G: Ctx, ghost = false) {
  const p = pl.cur, f = pl.facing, { J, A } = rigPoints(x, y, f, p, THANOS_DIMS);
  let body: RGB = ghost ? C.GOLD : C.PLAYER, skin: RGB = ghost ? C.GOLD : C.SKIN;
  const trim = C.GOLD, dark: RGB = ghost ? C.MUTED : C.DARK;
  if (pl.invuln > 0 && !ghost && Math.floor(pl.invuln / 3) % 2 === 0 && pl.state !== 'dodge') { body = C.CREAM; skin = C.CREAM; }
  for (const [a, b, w] of [[J.bhp, J.bkn, 7], [J.bkn, J.bft, 7]] as [Pt, Pt, number][]) { limb(L, a, b, dark, w); fillLimb(L, a, b, dark, w); }
  rect(L, J.bft[0] - 5, J.bft[1] - 4, 10, 5, trim);
  limb(L, J.bsh, J.bel, dark, 7); limb(L, J.bel, J.bha, dark, 6); fillLimb(L, J.bsh, J.bel, dark, 7); fillLimb(L, J.bel, J.bha, skin, 6);
  const [hx0, hy0] = J.hip, [nx, ny] = J.neck;
  const rob: Pt[] = [[nx - 13, ny + 2], [nx + 13, ny + 2], [hx0 + 11, hy0 + 2], [hx0 + 13, hy0 + 14], [hx0 - 13, hy0 + 14], [hx0 - 11, hy0 + 2]];
  poly(L, rob.map(([px, py]) => [px + (px > hx0 ? 1 : -1), py] as Pt), C.INK); poly(L, rob, body);
  poly(L, [[nx - 7, ny + 4], [nx + 7, ny + 4], [hx0 + 6, hy0 - 1], [hx0 - 6, hy0 - 1]], dark);
  line(L, [nx - 12, ny + 3], [hx0 - 11, hy0 + 13], trim, 2); line(L, [nx + 12, ny + 3], [hx0 + 11, hy0 + 13], trim, 2);
  line(L, [hx0 - 11, hy0], [hx0 + 11, hy0], C.OLIVE, 3);
  limb(L, J.fhp, J.fkn, dark, 8); limb(L, J.fkn, J.fft, dark, 8); fillLimb(L, J.fhp, J.fkn, dark, 8); fillLimb(L, J.fkn, J.fft, dark, 8);
  const ft = J.fft; rect(L, ft[0] - 7, ft[1] - 6, 14, 8, C.INK); rect(L, ft[0] - 6, ft[1] - 5, 12, 6, body); rect(L, ft[0] - 6, ft[1] - 5, 12, 1, trim);
  for (const sh of [J.bsh, J.fsh]) { circle(L, sh[0], sh[1], 8, C.INK); circle(L, sh[0], sh[1], 7, trim); circle(L, sh[0] - 1, sh[1] - 1, 5, body); }
  const hx = nx + f * 2, hy = ny - 1;
  const head: Pt[] = [[-6, -17], [5, -17], [8, -9], [8, -2], [4, 2], [-4, 2], [-7, -6], [-7, -13]].map(([px, py]) => [hx + f * px, hy + py]);
  poly(L, head.map(([px, py]) => [px + ((px - hx) * f > 0 ? 1 : -1), py] as Pt), C.INK); poly(L, head, skin);
  poly(L, [[hx - f * 7, hy - 13], [hx - f * 2, hy - 15], [hx - f * 2, hy + 1], [hx - f * 6, hy - 4]], C.SKIN_SH);
  for (const k of RIDGES) line(L, [hx + f * k, hy - 4], [hx + f * k, hy + 1], ghost ? C.MUTED : C.SKIN_SH, 1);   // chin ridges
  line(L, [hx + f, hy - 11], [hx + f * 7, hy - 10], C.INK, 2);
  rect(L, hx + f * 4 - (f < 0 ? 1 : 0), hy - 9, 2, 2, ghost ? C.GOLD : C.CREAM);
  limb(L, J.fsh, J.fel, dark, 7); limb(L, J.fel, J.fha, dark, 7); fillLimb(L, J.fsh, J.fel, dark, 7); fillLimb(L, J.fel, J.fha, skin, 6);
  const [gx, gy] = J.fha;
  circle(L, gx, gy, 6, C.INK); circle(L, gx, gy, 5, C.GOLD_HI);
  if (!ghost) [C.FX, C.ENERGY, C.CREAM, C.AMBER, C.PLAYER, C.DOOR].forEach((c, i) => { const a = (i / 6) * TAU; rect(L, gx + Math.cos(a) * 2.5, gy + Math.sin(a) * 2.5, 1, 1, c); });
  if (pl.move === 'heavy' && pl.state === 'attack' && !ghost) {                       // the double-bladed sword
    const a = A.f, dx = f * Math.sin(a), dy = Math.cos(a), t1: Pt = [gx + dx * 30, gy + dy * 30], t2: Pt = [gx - dx * 16, gy - dy * 16];
    line(L, t2, t1, C.INK, 6); line(L, t2, t1, C.GOLD_HI, 4); line(L, [gx + dx * 4, gy + dy * 4], t1, C.FX, 1); line(G, t2, t1, [90, 80, 20], 7);
  }
  if (pl.state === 'charge' && !ghost) { const k = 0.5 + 0.5 * Math.sin(t * 0.3); circle(G, x, y - 30, 26 + 6 * k, [Math.round(110 * k + 40), Math.round(100 * k + 36), 0]); }
}

/** Wolverine (after the reference pixel art), in yellows only: finned mask, muscled suit, dark side panels, gloves, three claws per fist. */
export function drawWolverine(L: Ctx, en: Fighter & { telegraph?: () => number }, x: number, y: number, t: number, G: Ctx) {
  const p = en.cur, f = en.facing, { J, A } = rigPoints(x, y, f, p, WOLVERINE_DIMS);
  let suit: RGB = C.MONK, pants: RGB = C.GOLD, hi: RGB = C.GOLD_HI;
  const panel = C.DARK;
  if (en.flashT > 0 || (en.invuln > 0 && en.invuln % 4 < 2)) { suit = C.CREAM; pants = C.CREAM; hi = C.FX; }
  const tg = en.telegraph ? en.telegraph() : 0;
  const claws = (cx: number, cy: number, ang: number, back = false) => {
    const dx = f * Math.sin(ang), dy = Math.cos(ang), nx = -dy, ny = dx;
    for (const k of [-1, 0, 1]) { const a: Pt = [cx + nx * k * 2, cy + ny * k * 2], b: Pt = [a[0] + dx * 13, a[1] + dy * 13]; line(L, a, b, C.INK, 3); line(L, a, b, back ? C.MUTED : C.FX, 1); }
    if (tg > 0 && !back) line(G, [cx, cy], [cx + dx * 14, cy + dy * 14], [Math.round(110 * tg), Math.round(100 * tg), Math.round(40 * tg)], 3);
  };
  for (const [a, b, c, w] of [[J.bhp, J.bkn, pants, 7], [J.bkn, J.bft, panel, 7]] as [Pt, Pt, RGB, number][]) { limb(L, a, b, c, w); fillLimb(L, a, b, c, w); }
  for (const [a, b, c] of [[J.bsh, J.bel, suit], [J.bel, J.bha, C.TAN]] as [Pt, Pt, RGB][]) { limb(L, a, b, c, 6); fillLimb(L, a, b, c, 6); }
  circle(L, J.bha[0], J.bha[1], 4, C.INK); circle(L, J.bha[0], J.bha[1], 3, panel); claws(J.bha[0], J.bha[1], A.b, true);
  const [hx0, hy0] = J.hip, [nx, ny] = J.neck;
  const torso: Pt[] = [[nx - 11, ny], [nx + 11, ny], [hx0 + 8, hy0], [hx0 - 8, hy0]];
  poly(L, torso.map(([px, py]) => [px + (px > hx0 ? 1 : -1), py] as Pt), C.INK); poly(L, torso, suit);
  poly(L, [[nx - f * 11, ny + 1], [nx - f * 4, ny + 6], [hx0 - f * 2, hy0], [hx0 - f * 8, hy0]], panel);
  line(L, [nx - 4, ny + 5], [nx + 6, ny + 5], hi, 1); line(L, [nx + f, ny + 7], [hx0 + f, hy0 - 4], C.OLIVE, 1);
  line(L, [hx0 - 9, hy0 + 1], [hx0 + 9, hy0 + 1], C.INK, 4); line(L, [hx0 - 8, hy0 + 1], [hx0 + 8, hy0 + 1], C.OLIVE, 2); rect(L, hx0 - 2, hy0, 4, 2, C.CREAM);
  for (const [a, b, c, w] of [[J.fhp, J.fkn, pants, 8], [J.fkn, J.fft, panel, 7]] as [Pt, Pt, RGB, number][]) { limb(L, a, b, c, w); fillLimb(L, a, b, c, w); }
  for (const ft of [J.fft, J.bft]) { rect(L, ft[0] - 6, ft[1] - 4, 12, 5, C.INK); rect(L, ft[0] - 5, ft[1] - 3, 10, 3, C.MUTED); }
  for (const kn of [J.fkn, J.bkn]) poly(L, [[kn[0] - 3, kn[1] + 1], [kn[0] + f * 4, kn[1] - 4], [kn[0] + 3, kn[1] + 4]], C.INK);
  const hx = nx + f * 3, hy = ny - 1;
  const head: Pt[] = [[hx - f * 6, hy - 11], [hx + f * 5, hy - 12], [hx + f * 8, hy - 6], [hx + f * 7, hy], [hx - f * 4, hy + 2], [hx - f * 7, hy - 5]];
  poly(L, head.map(([px, py]) => [px + ((px - hx) * f > 0 ? 1 : -1), py] as Pt), C.INK); poly(L, head, suit);
  for (const k of [0, 1]) { const bx = hx - f * (3 + 5 * k); poly(L, [[bx, hy - 9], [bx - f * (4 + 2 * k), hy - 19 - 2 * k], [bx + f * 3, hy - 8]], C.INK); }   // mask fins
  poly(L, [[hx - f * 7, hy - 8], [hx + f * 2, hy - 9], [hx + f * 3, hy - 4], [hx - f * 6, hy - 3]], panel);
  rect(L, hx + f * 2 - (f < 0 ? 3 : 0), hy - 8, 4, 3, (en.stun ?? 0) <= 0 ? C.CREAM : C.GOLD); rect(L, hx + f * 4 - (f < 0 ? 1 : 0), hy - 7, 1, 1, C.INK);
  poly(L, [[hx + f, hy - 2], [hx + f * 7, hy - 1], [hx + f * 5, hy + 2], [hx - f * 2, hy + 2]], C.TAN); rect(L, hx + f * 3 - (f < 0 ? 2 : 0), hy, 3, 1, C.INK);
  for (const [a, b, c] of [[J.fsh, J.fel, suit], [J.fel, J.fha, C.TAN]] as [Pt, Pt, RGB][]) { limb(L, a, b, c, 7); fillLimb(L, a, b, c, 7); }
  const [gx, gy] = J.fha; circle(L, gx, gy, 5, C.INK); circle(L, gx, gy, 4, panel); rect(L, gx - 2, gy - 3, 3, 1, hi);
  claws(gx, gy, en.state === 'attack' ? A.f : A.f - 0.2);
  for (const sh of [J.fsh, J.bsh]) { circle(L, sh[0], sh[1], 6, C.INK); circle(L, sh[0], sh[1], 5, panel); circle(L, sh[0] + f, sh[1] + 1, 3, suit); }
  if ((en.stun ?? 0) > 0) for (let i = 0; i < 3; i++) { const a = t * 0.15 + (i * TAU) / 3, sx = hx + Math.cos(a) * 10, sy = hy - 22 + Math.sin(a) * 3; rect(L, sx - 1, sy, 3, 1, C.FX); rect(L, sx, sy - 1, 1, 3, C.FX); }
}

/** Golden throne room after the reference: cosmic window, throne, curved consoles, pipes and a perspective floor. */
function bakeArena() {
  const cv = mk(LW, LH), g = cv.getContext('2d')!, r = seeded(11), ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1)), pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  rect(g, 0, 0, LW, LH, C.BG);
  for (let y = 0; y < 190; y += 24) for (let x = -12 * ((y / 24) % 2); x < LW; x += 48) { rect(g, x + 1, y + 1, 46, 22, C.PANEL); g.strokeStyle = rgb(C.PANEL_E); g.lineWidth = 1; g.strokeRect(x + 1.5, y + 1.5, 45, 21); }
  rect(g, 170, 0, 110, 120, C.DEEP);
  for (let i = 0; i < 26; i++) circle(g, ri(170, 280), ri(0, 110), ri(6, 18), pick([C.NEB1, C.NEB2, C.NEB3]));
  for (let i = 0; i < 40; i++) rect(g, ri(172, 277), ri(2, 116), 1, 1, pick([C.DOOR, C.FX, C.ENERGY]));
  for (const [sx, sy] of [[200, 30], [250, 70], [214, 92]]) { rect(g, sx - 2, sy, 5, 1, C.DOOR); rect(g, sx, sy - 2, 1, 5, C.DOOR); }
  g.strokeStyle = rgb(C.MUTED); g.lineWidth = 3; g.strokeRect(171.5, 1.5, 107, 117);
  const throne: Pt[] = [[185, 150], [195, 60], [210, 40], [225, 58], [240, 40], [255, 60], [265, 150]];
  poly(g, throne, C.THRONE); poly(g, throne, C.MUTED, 2);
  poly(g, [[205, 150], [210, 90], [225, 78], [240, 90], [245, 150]], C.DARK);
  rect(g, 190, 150, 70, 18, C.STEP); g.strokeRect(191, 151, 68, 16);
  for (const side of [-1, 1]) {
    const cx = 225 + side * 120;
    const pts: Pt[] = [[cx - side * 60, 100], [cx + side * 10, 90], [cx + side * 70, 130], [cx + side * 90, 190], [cx + side * 60, 200], [cx + side * 40, 145], [cx - side * 55, 128]];
    poly(g, pts, C.OLIVE); poly(g, pts, C.GOLD, 2); line(g, [cx - side * 40, 112], [cx + side * 30, 112], C.AMBER, 2);
    for (let k = 0; k < 3; k++) rect(g, cx + side * (10 + 18 * k) - 4, 120 + 6 * k, 8, 3, k === 1 ? C.ENERGY : C.GOLD_HI);
    line(g, [225 + side * 225, 170], [225 + side * 150, 162], C.DARK, 8);
    for (let k = 0; k < 5; k++) rect(g, 225 + side * (220 - k * 16), 167 - k, 3, 2, C.ENERGY);
  }
  poly(g, [[0, 196], [LW, 196], [LW, LH], [0, LH]], C.FLOOR); rect(g, 0, 196, LW, 9, C.FLOOR_HI);
  const vp = [225, 120];
  for (let k = -6; k <= 6; k++) { const xb = 225 + k * 70; line(g, [vp[0] + ((xb - vp[0]) * (196 - vp[1])) / (LH - vp[1]), 196], [xb, LH], C.FLOOR_LN, 1); }
  for (const y of [212, 236, 270, 312]) rect(g, 0, y, LW, 1, C.FLOOR_LN);
  for (const side of [-1, 1]) { const path: Pt[] = [[225 + side * 30, 200], [225 + side * 45, 200], [225 + side * 75, LH], [225 + side * 50, LH]]; poly(g, path, C.GOLD); poly(g, path, C.GOLD_HI, 1); }
  g.strokeStyle = rgb(C.RING); g.lineWidth = 2; g.beginPath(); g.ellipse(225, 199, 95, 13, 0, 0, TAU); g.stroke();
  rect(g, 0, GROUND + 1, LW, 1, C.INK); rect(g, 0, GROUND + 2, LW, 1, C.GOLD_HI);
  for (const x of [0, LW - 14]) { rect(g, x, 0, 14, LH, C.DARK); rect(g, x + (x === 0 ? 10 : 0), 0, 4, LH, C.MUTED); }
  return cv;
}

export class Renderer {
  private arena = bakeArena(); private L = mk(LW, LH); private G = mk(LW, LH);
  private F = mk(Math.ceil(LW / FIG) + 1, Math.ceil(LH / FIG) + 1); private FG = mk(Math.ceil(LW / FIG) + 1, Math.ceil(LH / FIG) + 1);
  private ghost = new Player(0, 1, 1); private tp = new Player(140, 1, 1); private te = new Enemy(310, -1, 1);
  buttons: Record<string, { x: number; y: number; w: number; h: number }> = {}; mouse: { x: number; y: number } | null = null; muted = false; private t = 0;
  constructor(private ctx: Ctx) {}

  /** Fighters live in arena space; they are drawn on a half-size layer and doubled, so they are big and chunky. */
  private fighter(who: Fighter, draw: typeof drawThanos | typeof drawWolverine, alpha: number, ghost = false) {
    const L = this.L.getContext('2d')!, G = this.G.getContext('2d')!, f = this.F.getContext('2d')!, fg = this.FG.getContext('2d')!;
    f.clearRect(0, 0, this.F.width, this.F.height); fg.fillStyle = '#000'; fg.fillRect(0, 0, this.FG.width, this.FG.height);
    L.fillStyle = rgb(C.INK); L.beginPath(); L.ellipse(who.x, GROUND, who.HW * 0.8, 3.5, 0, 0, TAU); L.fill();
    if (draw === drawThanos) drawThanos(f, who, who.x / FIG, who.y / FIG, this.t, fg, ghost); else (draw as typeof drawWolverine)(f, who, who.x / FIG, who.y / FIG, this.t, fg);
    L.imageSmoothingEnabled = false; L.globalAlpha = alpha; L.drawImage(this.F, 0, 0, this.F.width * FIG, this.F.height * FIG); L.globalAlpha = 1;
    G.globalCompositeOperation = 'lighter'; G.drawImage(this.FG, 0, 0, this.FG.width * FIG, this.FG.height * FIG); G.globalCompositeOperation = 'source-over';
  }

  draw(game: YellowGame) {
    const L = this.L.getContext('2d')!, G = this.G.getContext('2d')!, st = game.state === 'CONTROLS' ? game.ret : game.state, pl = game.player, en = game.enemy, t = game.t;
    this.t = t;
    G.fillStyle = '#000'; G.fillRect(0, 0, LW, LH);
    L.drawImage(this.arena, 0, 0);
    for (const m of game.motes) { rect(L, m[0], m[1], 1, 1, Math.floor(m[3] * 10) % 3 ? C.ENERGY : C.FX); circle(G, m[0], m[1], 2, [40, 36, 0]); }
    G.fillStyle = 'rgb(12,10,0)'; G.beginPath(); G.ellipse(225, 210, 165, 60, 0, 0, TAU); G.fill();
    this.door(L, G, game);
    for (const fr of game.fx.frags) {
      const k = 1 - fr.age / 70, pts: Pt[] = TRI.map((q) => [fr.x + Math.cos(fr.a + q * 2.1) * fr.size, fr.y + Math.sin(fr.a + q * 2.1) * fr.size]);
      poly(L, pts, k > 0.4 ? C.OLIVE : C.MUTED); poly(L, pts, C.GOLD, 1);
    }
    if (st !== 'TITLE' && st !== 'RULES') {
      for (const a of pl.afterimages) { Object.assign(this.ghost, { x: a.x, y: a.y, facing: a.f, cur: a.p, state: 'dodge', invuln: 0, move: null }); this.fighter(this.ghost, drawThanos, (0.43 * a.t) / 14, true); }
      if (en.dissolve < 1) this.fighter(en, drawWolverine, 1 - en.dissolve);
      if (st !== 'VICTORY') this.fighter(pl, drawThanos, 1);
      else if (game.vicT < 20) this.fighter(pl, drawThanos, Math.max(0, 1 - game.vicT / 20));
    } else {
      this.tp.cur = { ...PLAYER_POSES.idle, dy: Math.sin(t * 0.05) }; this.te.cur = { ...ENEMY_POSES.idle, dy: 3 + Math.sin(t * 0.06 + 1) };
      this.fighter(this.te, drawWolverine, 1); this.fighter(this.tp, drawThanos, 1);
    }
    for (const s of game.fx.slashes) {
      const k = 1 - s.age / s.life, r = s.big ? 22 : 14, [a0, a1] = s.f > 0 ? [-1.2, 1.0] : [Math.PI - 1.0, Math.PI + 1.2];
      L.strokeStyle = rgb(C.FX); L.lineWidth = s.big ? 3 : 2; L.beginPath(); L.arc(s.x, s.y, r, a0, a1); L.stroke();
      G.strokeStyle = `rgb(${Math.round(120 * k)},${Math.round(115 * k)},${Math.round(60 * k)})`; G.lineWidth = 5; G.beginPath(); G.arc(s.x, s.y, r + 3, a0, a1); G.stroke();
    }
    for (const e of game.fx.flashes) {
      const k = 1 - e.age / e.life, r = (e.big ? 12 : 7) * (0.6 + (0.6 * e.age) / e.life);
      poly(L, Array.from({ length: 8 }, (_, i) => { const rr = i % 2 ? r * 0.4 : r; return [e.x + Math.cos((i * Math.PI) / 4) * rr, e.y + Math.sin((i * Math.PI) / 4) * rr] as Pt; }), C.FX);
      circle(G, e.x, e.y, r + 6, [Math.round(140 * k), Math.round(135 * k), Math.round(70 * k)]);
    }
    for (const w of game.waves) {
      for (const [dr, c, wd] of [[0, C.FX, 3], [-6, C.ENERGY, 2], [-12, C.GOLD_HI, 1]] as [number, RGB, number][]) {
        const rr = w.r + dr; if (rr > 2) { L.strokeStyle = rgb(c); L.lineWidth = wd; L.beginPath(); L.ellipse(w.x, w.y, rr, rr * 0.6, 0, 0, TAU); L.stroke(); }
      }
      if (w.r > 2) { G.strokeStyle = 'rgb(90,86,40)'; G.lineWidth = 6; G.beginPath(); G.ellipse(w.x, w.y, w.r + 4, w.r * 0.6 + 4, 0, 0, TAU); G.stroke(); }
    }
    for (const q of game.fx.p) rect(L, q.x, q.y, q.size, q.size, q.col);
    L.globalCompositeOperation = 'lighter'; L.filter = 'blur(4px)'; L.drawImage(this.G, 0, 0); L.filter = 'none'; L.drawImage(this.G, 0, 0); L.globalCompositeOperation = 'source-over';
    const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = rgb(C.INK); c.fillRect(0, 0, W, H);
    const sh = game.shake > 0.4 ? game.shake * 2 : 0;
    c.imageSmoothingEnabled = false; c.drawImage(this.L, sh ? (Math.random() * 2 - 1) * sh : 0, sh ? (Math.random() * 2 - 1) * sh : 0, W, H);
    if (game.flash > 0) { c.fillStyle = rgb(C.FX, 0.59 * game.flash); c.fillRect(0, 0, W, H); }
    this.buttons = {};
    this.ui(game);
  }

  private door(L: Ctx, G: Ctx, game: YellowGame) {
    const d = game.door, t = game.t, cx = PORTAL_X, top = Door.TOP;
    if (d.slide > 0 || d.shattered) {
      const k = Math.min(1, d.slide), cy = (top + GROUND) / 2;
      for (let i = 4; i > 0; i--) rect(G, cx - 14 - i * 5, top + 10 - i * 5, 28 + i * 10, GROUND - top - 10 + i * 5, [Math.round((60 * k * i) / 4), Math.round((58 * k * i) / 4), Math.round((40 * k * i) / 4)]);
      rect(L, cx - 15, top + 8, 30, GROUND - top - 8, C.INK); rect(L, cx - 13, top + 10, 26, GROUND - top - 10, k > 0.2 ? C.DOOR : C.GOLD);
      for (let r = 0; r < 5; r++) { const rr = 4 + r * 9 + 3 * Math.sin(t * 0.1 + r); poly(L, [[cx, cy - rr * 1.6], [cx + rr * 0.45, cy], [cx, cy + rr * 1.6], [cx - rr * 0.45, cy]], [C.GOLD_HI, C.ENERGY, C.AMBER][r % 3], 1); }
      for (let q = 0; q < 3; q++) { const a = t * 0.04 + q * 2.09; line(L, [cx + Math.cos(a) * 9, cy + Math.sin(a) * 9], [cx, cy], C.ENERGY, 1); }
      for (let i = 0; i < 2; i++) {
        const px = cx + (i * 2 - 1) * (7 + 22 * d.slide) - 7;
        rect(L, px - 1, top - 6, 16, GROUND - top + 6, C.INK); rect(L, px, top - 5, 14, GROUND - top + 5, C.PLAYER); rect(L, px + 10, top - 5, 4, GROUND - top + 5, C.GOLD);
        for (let y = top + 6; y < GROUND; y += 22) rect(L, px, y, 13, 1, C.GOLD);
        rect(L, px - 2, top - 9, 18, 5, C.GOLD_HI);
      }
      return;
    }
    const x0 = Door.X0, w = Door.X1 - Door.X0, h = GROUND - top;
    rect(L, x0 - 1, top - 1, w + 2, h + 2, C.INK); rect(L, x0, top, w, h, C.OLIVE);
    L.strokeStyle = rgb(C.MUTED); L.lineWidth = 1;
    for (let y = top + 4; y < GROUND; y += 14) { const off = Math.floor(y / 14) % 2 ? 0 : 8; for (let x = x0 - off; x < x0 + w; x += 16) { const bx = Math.max(x0, x); L.strokeRect(bx + 1.5, y + 0.5, Math.min(15, x0 + w - bx - 1) - 1, 11); } }
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.05);
    line(L, [x0 + 4, top + 10], [x0 + 4, GROUND - 4], [Math.round(200 + 55 * pulse), Math.round(170 + 50 * pulse), 0], 2);
    L.strokeStyle = rgb(C.GOLD); L.lineWidth = 2; L.strokeRect(x0 + 1, top + 1, w - 2, h - 2);
    const n = Math.floor(d.cracks.length * Math.min(1, d.crack));
    for (const [a, b] of d.cracks.slice(0, n)) { line(L, a as Pt, b as Pt, C.FX, 1); line(G, a as Pt, b as Pt, [90, 88, 50], 3); }
  }

  // ---------------------------------------------------------------- HUD (full resolution)
  private text(txt: string, size: number, col: RGB, x: number, y: number, align: CanvasTextAlign = 'center', shadow: RGB | null = C.INK, base: CanvasTextBaseline = 'middle') {
    const c = this.ctx; c.font = `${size}px ${FONT}`; c.textAlign = align; c.textBaseline = base;
    if (shadow) { c.fillStyle = rgb(shadow); c.fillText(txt, x + 2, y + 2); }
    c.fillStyle = rgb(col); c.fillText(txt, x, y);
  }
  private panel(x: number, y: number, w: number, h: number, alpha = 0.8, border: RGB = C.GOLD) {
    const c = this.ctx; c.fillStyle = rgb(C.DEEP, alpha); c.fillRect(x, y, w, h);
    c.strokeStyle = rgb(C.INK); c.lineWidth = 2; c.strokeRect(x - 2, y - 2, w + 4, h + 4); c.strokeStyle = rgb(border); c.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  private button(key: string, label: string, cx: number, cy: number) {
    const x = cx - 120, y = cy - 22, m = this.mouse, hover = !!m && m.x >= x && m.x <= x + 240 && m.y >= y && m.y <= y + 44;
    this.panel(x, y, 240, 44, 0.9, hover ? C.ENERGY : C.GOLD); this.text(label, 14, hover ? C.FX : C.CREAM, cx, cy + 1); this.buttons[key] = { x, y, w: 240, h: 44 };
  }
  private bar(x: number, y: number, w: number, h: number, frac: number, trail: number, col: RGB, right = false) {
    const c = this.ctx;
    c.fillStyle = rgb(C.INK); c.beginPath(); c.moveTo(x - 4, y - 4); c.lineTo(x + w + 8, y - 4); c.lineTo(x + w + 4, y + h + 4); c.lineTo(x - 8, y + h + 4); c.closePath(); c.fill();
    rect(c, x, y, w, h, C.DARK);
    const tw = Math.round(w * Math.max(0, trail)), fw = Math.round(w * Math.max(0, frac));
    if (right) { rect(c, x + w - tw, y, tw, h, C.CREAM); rect(c, x + w - fw, y, fw, h, col); } else { rect(c, x, y, tw, h, C.CREAM); rect(c, x, y, fw, h, col); }
    c.strokeStyle = rgb(C.GOLD); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  private portrait(x: number, y: number, w: number, h: number, who: 'thanos' | 'wolverine', t: number) {
    this.panel(x, y, w, h, 0.95);
    const cv = mk(32, 30), g = cv.getContext('2d')!, fake: Fighter = who === 'thanos' ? new Player(16, 1, 1) : new Enemy(14, 1, 1);
    fake.cur = { ...(who === 'thanos' ? PLAYER_POSES.idle : ENEMY_POSES.idle) };
    const { J } = rigPoints(fake.x, 72, 1, fake.cur, who === 'thanos' ? THANOS_DIMS : WOLVERINE_DIMS), y0 = 72 + 26 - J.neck[1];
    const glow = mk(32, 30).getContext('2d')!;
    if (who === 'thanos') drawThanos(g, fake, fake.x, y0, t, glow); else drawWolverine(g, fake, fake.x, y0, t, glow);
    this.ctx.imageSmoothingEnabled = false; this.ctx.drawImage(cv, x + 2, y + 2, w - 4, h - 4);
  }

  private ui(game: YellowGame) {
    if (game.state === 'CONTROLS') { this.screen(game, game.ret); this.buttons = {}; this.controlsCard(); }   // the card sits on top; only its own button is live
    else this.screen(game, game.state);
  }
  private controlsCard() {
    const c = this.ctx;
    c.fillStyle = rgb(C.INK, 0.67); c.fillRect(0, 0, W, H);
    this.panel(130, 60, 640, 550, 0.96, C.ENERGY);
    this.text('CONTROLS', 28, C.ENERGY, W / 2, 102, 'center', C.MUTED);
    this.text('The game is paused while this card is open', 8, C.GOLD_HI, W / 2, 140);
    c.font = `8px ${FONT}`;
    CONTROLS.forEach(([keys, what], i) => {
      const y = 180 + i * 31, w = c.measureText(keys).width + 16, x = W / 2 - 46 - w;
      rect(c, x, y - 10, w, 22, C.INK); rect(c, x, y - 13, w, 22, C.DARK); c.strokeStyle = rgb(C.GOLD); c.lineWidth = 1; c.strokeRect(x + 0.5, y - 12.5, w - 1, 21);
      this.text(keys, 8, C.FX, x + w / 2, y - 1, 'center', null);
      this.text(what, 8, C.CREAM, W / 2 - 24, y - 1, 'left');
    });
    this.button('close', 'CLOSE', W / 2, 545);
    this.text('C / ESC / ENTER  close', 8, C.GOLD_HI, W / 2, 590);
  }
  private screen(game: YellowGame, st: YellowGame['state']) {
    const c = this.ctx, pl = game.player, en = game.enemy, t = game.t;
    if (st === 'TITLE') {
      c.fillStyle = rgb(C.INK, 0.47); c.fillRect(0, 0, W, H);
      this.text('YELLOW', 72, C.ENERGY, W / 2, 120, 'center', C.MUTED);
      this.text('PRESS ENTER TO START', 14, Math.floor(t / 30) % 2 ? C.FX : C.ENERGY, W / 2, 205);
      this.button('start', 'START', W / 2, 262); this.button('rules', 'RULES', W / 2, 314);
      this.button('controls', 'CONTROLS', W / 2, 366); this.button('exit', 'EXIT', W / 2, 418);
      this.panel(140, 458, 620, 124, 0.78);
      ['A/D or ARROWS move   W/UP jump', 'J Gauntlet jab   K double-bladed sword', 'SHIFT dodge   hold L charge   I Solar Flash', 'ESC pause   M mute   H rules'].forEach((l, i) => this.text(l, 10, C.CREAM, W / 2, 482 + i * 26));
      this.text('Forgot a key mid-fight? Press C or click CONTROLS (bottom left).', 8, C.GOLD_HI, W / 2, 606);
      this.soundButton(); return;
    }
    if (st === 'RULES') {
      c.fillStyle = rgb(C.INK, 0.59); c.fillRect(0, 0, W, H);
      this.panel(60, 36, 780, 570, 0.94);
      this.text('RULES', 28, C.ENERGY, W / 2, 80, 'center', C.MUTED);
      let y = 128;
      for (const [head, lines] of RULES) {
        this.text(head, 12, C.ENERGY, 96, y, 'left'); y += 30;
        for (const l of lines) { this.text(l, 8, C.CREAM, 112, y, 'left'); y += 24; }
        y += 10;
      }
      this.button('controls', 'CONTROLS', W / 2 - 130, 562); this.button('back', 'BACK', W / 2 + 130, 562);
      this.text('ENTER / H  back      C  controls', 8, C.GOLD_HI, W / 2, 628);
      return;
    }
    this.portrait(18, 14, 60, 56, 'thanos', t);
    this.text('THANOS', 10, C.CREAM, 90, 22, 'left');
    this.bar(90, 36, 280, 14, pl.shownHp / pl.maxHp, pl.trailHp / pl.maxHp, C.PLAYER);
    const ready = pl.energy >= 100;
    this.bar(90, 56, 200, 8, pl.energy / 100, pl.energy / 100, ready && Math.floor(t / 8) % 2 === 0 ? C.FX : C.ENERGY);
    this.text(ready ? 'SOLAR FLASH READY - PRESS I' : `SOLAR ${Math.floor(pl.energy)}%`, 8, ready ? C.FX : C.GOLD_HI, 298, 61, 'left');
    const cd = pl.dodgeCd / DODGE_COOLDOWN;                                          // dodge cooldown icon
    circle(c, 40, 92, 13, C.INK); circle(c, 40, 92, 11, C.DARK);
    if (cd > 0) { c.strokeStyle = rgb(C.GOLD); c.lineWidth = 3; c.beginPath(); c.arc(40, 92, 11, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - cd)); c.stroke(); } else circle(c, 40, 92, 11, C.ENERGY, 2);
    this.text('>>', 8, cd === 0 ? C.CREAM : C.MUTED, 41, 93, 'center', null);
    this.text(String(game.score).padStart(6, '0'), 14, C.ENERGY, 60, 110, 'left');
    if (game.combo >= 2) this.text(`x${game.combo}`, 28, C.ENERGY, 190, 112, 'left', C.MUTED);
    this.portrait(W - 78, 14, 60, 56, 'wolverine', t);
    this.text('WOLVERINE', 10, C.CREAM, W - 90, 22, 'right');
    this.bar(W - 370, 36, 280, 14, en.shownHp / en.maxHp, en.trailHp / en.maxHp, C.AMBER, true);
    if (en.stun > 0) this.text(`STUNNED ${en.stun}`, 8, C.FX, W - 90, 70, 'right');
    const secs = Math.ceil(game.roundT / 60);
    this.panel(W / 2 - 36, 12, 72, 46, 0.86);
    this.text(String(secs).padStart(2, '0'), 24, secs <= 10 && Math.floor(t / 15) % 2 ? C.FX : C.ENERGY, W / 2, 37);
    if (st === 'INTRO') {
      if (game.introT < 150) {
        this.panel(110, H - 76, 680, 46, 0.82); this.portrait(118, H - 72, 38, 38, 'thanos', t);
        this.text(INTRO_LINES[0].slice(0, Math.max(0, Math.floor(game.introT / 2))), 10, C.CREAM, 168, H - 52, 'left');
      } else this.text('FIGHT!', 72, C.ENERGY, W / 2, H / 2 - 20, 'center', C.MUTED);
    } else if (st === 'FIGHT') {
      const hint = en.stun > 0 ? 'Wolverine is stunned - strike now!' : en.telegraph() > 0.3 ? 'His claws glow: DODGE (SHIFT) or JUMP!' : '';
      if (hint) this.text(hint, 12, C.FX, W / 2, H - 40);
    } else if (st === 'PAUSED') {
      c.fillStyle = rgb(C.INK, 0.59); c.fillRect(0, 0, W, H);
      this.text('PAUSED', 64, C.ENERGY, W / 2, 190, 'center', C.MUTED);
      this.text('ESC resume  ·  R restart  ·  M mute', 12, C.CREAM, W / 2, 280);
      ['A/D move · W jump · J jab · K sword', 'SHIFT dodge · hold L charge · I Solar Flash'].forEach((l, i) => this.text(l, 10, C.GOLD_HI, W / 2, 330 + i * 26));
      this.button('controls', 'CONTROLS', W / 2, 420); this.button('exit', 'EXIT', W / 2, 474);
    } else if (st === 'DEFEAT' || st === 'BARRIER' || st === 'DOOR_REVEAL') {
      this.text(st === 'DEFEAT' ? 'K.O.!' : st === 'BARRIER' ? 'THE BARRIER CRACKS...' : 'THE PHASE DOOR OPENS', 24, C.ENERGY, W / 2, 160, 'center', C.MUTED);
    } else if (st === 'PORTAL') this.text('WALK INTO THE PHASE DOOR  >>', 14, Math.floor(t / 20) % 2 ? C.FX : C.ENERGY, W / 2, 160);
    else if (st === 'GAME_OVER' && game.phaseT > 30) {
      c.fillStyle = rgb(C.DEEP, 0.75); c.fillRect(0, 0, W, H);
      this.text('GAME OVER', 56, C.ENERGY, W / 2, 250, 'center', C.MUTED);
      this.text(game.cause, 14, C.CREAM, W / 2, 330);
      this.text('PRESS R TO RESTART', 14, Math.floor(t / 30) % 2 ? C.FX : C.ENERGY, W / 2, 390);
    } else if (st === 'VICTORY') {
      const k = Math.min(1, game.vicT / VICTORY_FLASH);
      if (game.vicT < 40) { c.fillStyle = rgb(C.DOOR, Math.max(0, 1 - Math.abs(game.vicT - 20) / 20)); c.fillRect(0, 0, W, H); }
      else {
        c.fillStyle = rgb(C.DEEP, 0.78 * k); c.fillRect(0, 0, W, H);
        this.text(VICTORY_TEXT, 12, C.DOOR, W / 2, 290, 'center', C.MUTED);
        this.text(`SCORE ${String(game.score).padStart(6, '0')}  ·  TIME LEFT ${Math.ceil(game.roundT / 60)}s`, 9, C.GOLD_HI, W / 2, 330);
        this.text('PRESS R TO RESTART', 14, Math.floor(t / 30) % 2 ? C.FX : C.ENERGY, W / 2, 380);
      }
    }
    if (st === 'INTRO' || st === 'FIGHT') {                                                 // always-visible reminder button
      const m = this.mouse, b = { x: 14, y: H - 34, w: 150, h: 24 }, hover = !!m && m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;
      this.panel(b.x, b.y, b.w, b.h, 0.78, hover ? C.ENERGY : C.GOLD);
      this.text('CONTROLS (C)', 9, hover ? C.FX : C.CREAM, b.x + b.w / 2, H - 21, 'center', null);
      this.buttons.controls = b;
    }
    this.soundButton();
  }
  private soundButton() {
    this.panel(W - 110, H - 34, 96, 24, 0.78);
    this.text(this.muted ? 'MUTED' : 'SOUND', 9, C.CREAM, W - 62, H - 21, 'center', null);
    this.buttons.mute = { x: W - 110, y: H - 34, w: 96, h: 24 };
  }
}
