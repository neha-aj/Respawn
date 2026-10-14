/* ============================================================================
   Pixel art, drawn in code with the blue palette:
   - a 3×5 bitmap font
   - geometric weight icons
   - the walking Thanos sprite (28×46) with expression-driven face pixels
   - a 64×64 shaded portrait (superellipse + Lambert lighting + Bayer dithering)
   Original art inspired by the user's reference image.
   ============================================================================ */
import { PALETTE as P } from './config';
import type { Shape } from './puzzle';

type C2D = CanvasRenderingContext2D;
export const px = (g: C2D, x: number, y: number, c: string, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

/* ---------------- 3×5 bitmap font ---------------- */
const GLYPHS: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  '+': ['...', '.#.', '###', '.#.', '...'], '=': ['...', '###', '...', '###', '...'], '?': ['##.', '..#', '.#.', '...', '.#.'],
  '-': ['...', '...', '###', '...', '...'], '>': ['#..', '.#.', '..#', '.#.', '#..'], '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  ':': ['...', '.#.', '...', '.#.', '...'], '[': ['##.', '#..', '#..', '#..', '##.'], ']': ['.##', '..#', '..#', '..#', '.##'],
  '.': ['...', '...', '...', '...', '.#.'], ' ': ['...', '...', '...', '...', '...'],
};
export const textWidth = (s: string, scale = 1) => (s.length * 4 - 1) * scale;
export function drawText(g: C2D, s: string, x: number, y: number, color: string, scale = 1) {
  g.fillStyle = color;
  let cx = Math.round(x);
  for (const ch of s.toUpperCase()) {
    const gl = GLYPHS[ch] ?? GLYPHS['?'];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (gl[r][c] === '#') g.fillRect(cx + c * scale, Math.round(y) + r * scale, scale, scale);
    cx += 4 * scale;
  }
}

/* ---------------- shape icons (filled by scanline maths) ---------------- */
export function drawShape(g: C2D, shape: Shape, cx: number, bottom: number, size: number, fill: string, edge: string) {
  const s = size, top = Math.round(bottom - s);
  for (let r = 0; r < s; r++) {
    let half: number;
    if (shape === 'SQUARE') half = s / 2;
    else if (shape === 'TRIANGLE') half = ((r + 1) / s) * (s / 2);
    else { // regular-ish pentagon: apex → shoulders at 38 % height → narrower base
      const k = 0.38 * s;
      half = r < k ? ((r + 1) / k) * (s / 2) : s / 2 - ((r - k) / (s - k)) * (s / 2 - 0.31 * s);
    }
    const a = Math.round(cx - half), b = Math.round(cx + half) - 1;
    for (let x = a; x <= b; x++) px(g, x, top + r, x === a || x === b || r === 0 || r === s - 1 ? edge : fill);
  }
}

/* ---------------- expressions ---------------- */
export type Expression =
  | 'determined' | 'examining' | 'thinking' | 'confused' | 'frustrated' | 'focused'
  | 'relieved' | 'urgent' | 'panic' | 'celebrate' | 'disappointed';
type Mouth = 'flat' | 'smile' | 'grin' | 'frown' | 'open' | 'grit';
type Eyes = 'normal' | 'narrow' | 'wide' | 'closed' | 'up' | 'down';
interface Face { brow: number; raise: number; mouth: Mouth; eyes: Eyes; sweat: boolean }

export const FACES: Record<Expression, Face> = {
  determined:   { brow: 1,  raise: 0, mouth: 'flat',  eyes: 'narrow', sweat: false },
  examining:    { brow: 0,  raise: 1, mouth: 'flat',  eyes: 'up',     sweat: false },
  thinking:     { brow: 0,  raise: 1, mouth: 'flat',  eyes: 'up',     sweat: false },
  confused:     { brow: -1, raise: 1, mouth: 'open',  eyes: 'wide',   sweat: false },
  frustrated:   { brow: 1,  raise: 0, mouth: 'grit',  eyes: 'narrow', sweat: false },
  focused:      { brow: 1,  raise: 0, mouth: 'smile', eyes: 'normal', sweat: false },
  relieved:     { brow: -1, raise: 0, mouth: 'smile', eyes: 'closed', sweat: false },
  urgent:       { brow: -1, raise: 0, mouth: 'frown', eyes: 'wide',   sweat: true },
  panic:        { brow: -1, raise: 1, mouth: 'open',  eyes: 'wide',   sweat: true },
  celebrate:    { brow: 0,  raise: 1, mouth: 'grin',  eyes: 'closed', sweat: false },
  disappointed: { brow: -1, raise: 0, mouth: 'frown', eyes: 'down',   sweat: false },
};

export const EXPRESSION_LABEL: Record<Expression, string> = {
  determined: 'Determined', examining: 'Examining', thinking: 'Thinking', confused: 'Confused', frustrated: 'Frustrated',
  focused: 'Focused', relieved: 'Relieved', urgent: 'Urgent', panic: 'Panicking', celebrate: 'Triumphant', disappointed: 'Disappointed',
};

/* ---------------- walking sprite ---------------- */
export type Pose = 'idle' | 'walk' | 'jump' | 'interact' | 'think' | 'celebrate' | 'fail';
export const SPRITE_W = 28, SPRITE_H = 46;

/**
 * Draw Thanos with feet at (x + 14, feetY). `facing` mirrors the sprite.
 * Built from row spans (head, torso) so outlines and shading are computed, not hand-placed.
 */
export function drawThanos(g: C2D, x: number, feetY: number, o: { facing: 1 | -1; pose: Pose; t: number; walk: number; expr: Expression; glow: number }) {
  const ox = Math.round(x), oy = Math.round(feetY) - SPRITE_H;
  const f = FACES[o.expr];
  const P_ = (sx: number, sy: number, c: string, w = 1, h = 1) => {
    const rx = o.facing === 1 ? sx : SPRITE_W - sx - w;
    g.fillStyle = c; g.fillRect(ox + rx, oy + sy, w, h);
  };
  const cx = 14;
  const breathe = o.pose === 'idle' || o.pose === 'think' ? (Math.sin(o.t * 2.2) > 0.6 ? 1 : 0) : 0;
  const hop = o.pose === 'celebrate' ? -Math.round(Math.abs(Math.sin(o.t * 7)) * 3) : 0;
  const slump = o.pose === 'fail' ? 2 : 0;
  const up = hop + slump + breathe; // vertical offset for upper body

  // legs (walk cycle: phase-shifted sine)
  const s = Math.sin(o.walk), lift = (v: number) => Math.round(Math.max(0, v) * 2);
  const legs: [number, number][] = o.pose === 'walk' ? [[Math.round(s * 2), lift(s)], [Math.round(-s * 2), lift(-s)]] : o.pose === 'jump' ? [[-1, 2], [1, 1]] : [[0, 0], [0, 0]];
  legs.forEach(([dx, ly], i) => {
    const lx = (i === 0 ? cx - 6 : cx + 1) + dx;
    for (let r = 32; r < 42 - ly; r++) { P_(lx, r + hop, P.dark, 5); P_(lx, r + hop, P.navy); }
    P_(lx - (i === 0 ? 1 : 0), 42 - ly + hop, P.abyss, 6, 4); P_(lx + 1, 42 - ly + hop, P.deep, 3, 1);
  });

  // torso (row spans with computed outline + side shading)
  const torso = [16, 16, 16, 16, 15, 15, 14, 14, 14, 14, 13, 13, 12, 12, 12, 12];
  torso.forEach((w, i) => {
    const r = 16 + i + up, l = cx - Math.floor(w / 2);
    for (let xx = 0; xx < w; xx++) {
      const edge = xx === 0 || xx === w - 1;
      const band = i === 6 || i === 7;
      const belt = i >= 14;
      P_(l + xx, r, edge ? P.abyss : belt ? (xx % 3 === 0 ? P.cyan : P.pale) : band ? P.electric : xx < 3 ? P.navy : P.dark);
    }
  });
  P_(cx - 1, 25 + up, P.navy, 1, 5); P_(cx - 4, 26 + up, P.navy, 3, 1); P_(cx + 1, 26 + up, P.navy, 3, 1); // abs

  // arms
  const skinCol = (k: number) => (k === 0 ? P.deep : k === 1 ? P.primary : P.electric);
  const swing = o.pose === 'walk' ? Math.round(Math.sin(o.walk) * 1.5) : 0;
  // back arm (hanging fist)
  for (let r = 18; r < 30; r++) { P_(cx - 11, r + up + swing, P.abyss); P_(cx - 10, r + up + swing, skinCol(0), 2); P_(cx - 8, r + up + swing, skinCol(1)); }
  P_(cx - 12, 30 + up + swing, P.abyss, 6, 4); P_(cx - 11, 30 + up + swing, skinCol(1), 4, 3);
  // gauntlet arm
  const stones = (gx: number, gy: number) => {
    const shades = [P.ice, P.cyan, P.pale, P.electric, P.ice];
    shades.forEach((c, i) => P_(gx + i, gy, o.glow > 0.5 && (Math.floor(o.t * 6) + i) % 4 === 0 ? P.ice : c));
  };
  if (o.pose === 'idle' || o.pose === 'think' || o.pose === 'celebrate') {
    const raise = o.pose === 'celebrate' ? -3 : 0;
    for (let r = 10 + raise; r < 20; r++) { P_(cx + 10, r + up, P.abyss); P_(cx + 11, r + up, skinCol(1), 2); P_(cx + 13, r + up, P.abyss); }
    P_(cx + 7, 17 + up, skinCol(1), 4, 3);
    P_(cx + 8, 3 + raise + up, P.abyss, 8, 8); P_(cx + 9, 4 + raise + up, P.pale, 6, 6); P_(cx + 9, 9 + raise + up, P.cyan, 6, 1);
    stones(cx + 9, 5 + raise + up); P_(cx + 11, 7 + raise + up, o.glow > 0.3 ? P.ice : P.cyan, 2, 2);
  } else if (o.pose === 'interact') {
    for (let c = cx + 7; c < cx + 16; c++) { P_(c, 19 + up, P.abyss); P_(c, 20 + up, skinCol(1)); P_(c, 21 + up, skinCol(0)); P_(c, 22 + up, P.abyss); }
    P_(cx + 16, 17 + up, P.abyss, 7, 8); P_(cx + 17, 18 + up, P.pale, 5, 6); stones(cx + 17, 19 + up);
  } else {
    for (let r = 18; r < 29; r++) { P_(cx + 10, r + up - swing, P.abyss); P_(cx + 8, r + up - swing, skinCol(1), 2); }
    P_(cx + 7, 28 + up - swing, P.abyss, 7, 7); P_(cx + 8, 29 + up - swing, P.pale, 5, 5); stones(cx + 8, 30 + up - swing);
  }

  // armour: pauldrons + tall collar
  [[cx - 11, 16], [cx + 6, 16]].forEach(([x0, y0]) => { P_(x0, y0 + up, P.abyss, 6, 4); P_(x0 + 1, y0 + up, P.pale, 4, 2); P_(x0 + 1, y0 + 2 + up, P.cyan, 4, 1); });
  [[cx - 7, 12], [cx + 4, 12]].forEach(([x0, y0], i) => {
    for (let r = 0; r < 6; r++) { const w = 3 + (r > 2 ? 1 : 0); const xs = i === 0 ? x0 + (r > 2 ? -1 : 0) : x0; P_(xs, y0 + r + up, r === 0 ? P.abyss : r % 2 ? P.cyan : P.pale, w); }
  });

  // head (row widths → outline, side shading, top highlight)
  const head = [6, 10, 12, 14, 14, 14, 14, 14, 14, 14, 12, 12, 10, 6];
  const hy = 0 + up + (o.pose === 'fail' ? 1 : 0);
  head.forEach((w, r) => {
    const l = cx - Math.floor(w / 2);
    for (let xx = 0; xx < w; xx++) {
      const edge = xx === 0 || xx === w - 1 || r === 0 || r === head.length - 1;
      const rel = xx / (w - 1);
      const c = edge ? P.abyss : rel < 0.22 ? P.deep : rel > 0.72 || (r < 3 && rel > 0.45) ? P.electric : P.primary;
      P_(l + xx, hy + r, c);
    }
  });
  P_(cx - 8, hy + 6, P.abyss, 1, 3); P_(cx + 7, hy + 6, P.abyss, 1, 3); // ears
  [cx - 3, cx - 1, cx + 1].forEach((x0) => P_(x0, hy + 11, P.deep, 1, 2)); // chin ridges

  // face — brows: line between inner and outer endpoints (y interpolated)
  const browRow = hy + 5;
  for (const side of [-1, 1] as const) {
    const raise = side === 1 ? f.raise : 0;
    const inner = browRow + (f.brow > 0 ? 1 : f.brow < 0 ? -1 : 0) - raise;
    const outer = browRow - (f.brow > 0 ? 1 : 0) - raise;
    for (let k = 0; k < 4; k++) {
      const yy = Math.round(inner + ((outer - inner) * k) / 3);
      P_(side === -1 ? cx - 2 - k : cx + 1 + k, yy, P.abyss);
    }
  }
  // eyes
  const eyeRow = hy + 7;
  for (const ex of [cx - 4, cx + 2]) {
    P_(ex - 1, eyeRow, P.dark, 4, 1);
    switch (f.eyes) {
      case 'closed': P_(ex, eyeRow, P.abyss, 2, 1); break;
      case 'narrow': P_(ex, eyeRow, P.cyan, 2, 1); break;
      case 'wide': P_(ex, eyeRow - 1, P.ice, 2, 2); break;
      case 'up': P_(ex + 1, eyeRow - 1, P.ice); P_(ex, eyeRow, P.pale); break;
      case 'down': P_(ex, eyeRow, P.pale); break;
      default: P_(ex, eyeRow, P.ice, 2, 1);
    }
  }
  // mouth
  const mr = hy + 10, ml = cx - 3;
  const mouthRows: Record<Mouth, (k: number) => number> = {
    flat: () => 0, smile: (k) => (k === 0 || k === 5 ? -1 : 0), grin: (k) => (k === 0 || k === 5 ? -1 : 0),
    frown: (k) => (k === 0 || k === 5 ? 1 : 0), open: () => 0, grit: () => 0,
  };
  for (let k = 0; k < 6; k++) P_(ml + k, mr + mouthRows[f.mouth](k), P.abyss);
  if (f.mouth === 'grin' || f.mouth === 'grit') P_(ml + 1, mr + 1, P.ice, 4, 1);
  if (f.mouth === 'open') P_(ml + 2, mr + 1, P.abyss, 2, 1);
  if (f.sweat) P_(cx + 6, hy + 2 + (Math.floor(o.t * 5) % 5), P.cyan, 1, 2);
}

/* ---------------- portrait (64×64, shaded with maths) ---------------- */
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const SKIN_RAMP = [P.navy, P.dark, P.deep, P.primary, P.electric, P.cyan];
const ARMOR_RAMP = [P.dark, P.deep, P.electric, P.cyan, P.pale, P.ice];
const hex = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const; };

/**
 * Lambert-shaded superellipse head: |x/a|ⁿ + |y/b|ⁿ ≤ 1, normal from the implicit
 * surface, brightness = N·L quantised to the ramp with 4×4 ordered dithering.
 */
function shadeInto(img: ImageData, cx: number, cy: number, a: number, b: number, n: number, ramp: readonly string[], jaw = 0) {
  const L = [0.55, -0.6, 0.58], ll = Math.hypot(...L);
  const cols = ramp.map(hex);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const ny = (y - cy) / b;
    const aa = a + (ny > 0 ? jaw * ny : 0);
    const nx = (x - cx) / aa;
    const d = Math.abs(nx) ** n + Math.abs(ny) ** n;
    if (d > 1) continue;
    const z = Math.sqrt(Math.max(0, 1 - d));
    const N = [nx, ny, z * 1.15], nl = Math.hypot(...N) || 1;
    const lam = Math.max(0, (N[0] * L[0] + N[1] * L[1] + N[2] * L[2]) / (nl * ll));
    const v = 0.12 + 0.88 * lam;
    const lvl = Math.max(0, Math.min(cols.length - 1, Math.floor(v * cols.length + BAYER4[y & 3][x & 3] / 16 - 0.5)));
    const i = (y * img.width + x) * 4, c = cols[lvl];
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
  }
}

export function drawPortrait(g: C2D, expr: Expression, t: number, glow: number) {
  const W = 64, H = 64;
  g.clearRect(0, 0, W, H);
  const img = g.createImageData(W, H);
  const bob = Math.round(Math.sin(t * 2) * 0.6);
  const cy = 26 + bob, cx = 32;
  shadeInto(img, 32, 66, 30, 16, 2.2, ARMOR_RAMP);          // collar armour
  shadeInto(img, 32, 70, 22, 12, 2, [P.abyss, P.navy, P.dark, P.deep]); // suit
  shadeInto(img, cx, cy, 15, 21, 2.5, SKIN_RAMP, 3);        // head with a wide jaw
  // outline: any filled pixel with an empty 4-neighbour
  const d = img.data, filled = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
  const edges: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (filled(x, y) && (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1))) edges.push(y * W + x);
  const ab = hex(P.abyss);
  for (const e of edges) { d[e * 4] = ab[0]; d[e * 4 + 1] = ab[1]; d[e * 4 + 2] = ab[2]; }
  g.putImageData(img, 0, 0);

  const f = FACES[expr];
  // chin ridges + cheek folds
  for (let k = -2; k <= 2; k++) px(g, cx + k * 3, cy + 13, P.dark, 1, 6);
  px(g, cx - 9, cy + 2, P.dark, 1, 6); px(g, cx + 9, cy + 2, P.dark, 1, 6);
  // nose
  px(g, cx - 1, cy - 2, P.dark, 1, 6); px(g, cx - 2, cy + 4, P.dark, 4, 1);
  // brows (thick, tilted by expression)
  for (const side of [-1, 1] as const) {
    const raise = side === 1 ? f.raise * 2 : 0;
    const inner = cy - 8 + f.brow * 2 - raise, outer = cy - 9 - (f.brow > 0 ? 2 : 0) - raise;
    for (let k = 0; k < 9; k++) {
      const yy = Math.round(inner + ((outer - inner) * k) / 8);
      px(g, side === -1 ? cx - 2 - k : cx + 1 + k, yy, P.abyss, 1, 2);
    }
  }
  // eyes (glowing)
  for (const ex of [cx - 7, cx + 4]) {
    px(g, ex - 1, cy - 6, P.navy, 6, 3);
    const e = f.eyes;
    if (e === 'closed') px(g, ex, cy - 5, P.abyss, 4, 1);
    else if (e === 'narrow') px(g, ex, cy - 5, P.cyan, 4, 1);
    else if (e === 'wide') { px(g, ex, cy - 7, P.ice, 4, 3); px(g, ex + 1, cy - 6, P.electric, 2, 1); }
    else if (e === 'up') { px(g, ex, cy - 6, P.pale, 4, 2); px(g, ex + 2, cy - 6, P.ice, 2, 1); }
    else if (e === 'down') px(g, ex, cy - 4, P.pale, 4, 1);
    else { px(g, ex, cy - 6, P.ice, 4, 2); }
  }
  // mouth: parabola y = y0 + c·(1 − (x/w)²)
  const w = 6, y0 = cy + 9;
  const curve = f.mouth === 'smile' || f.mouth === 'grin' ? 2 : f.mouth === 'frown' ? -2 : 0;
  for (let x = -w; x <= w; x++) {
    const yy = Math.round(y0 + curve * (1 - (x / w) ** 2) - curve);
    px(g, cx + x, yy, P.abyss);
    if (f.mouth === 'open' && Math.abs(x) < 4) px(g, cx + x, yy + 1, P.abyss, 1, 3);
    if ((f.mouth === 'grin' || f.mouth === 'grit') && Math.abs(x) < 5) px(g, cx + x, yy + 1, P.ice, 1, 2);
  }
  if (f.mouth === 'grit') { for (let x = -4; x <= 4; x++) px(g, cx + x, y0 + 3, P.abyss); }
  // sweat drop sliding down the temple
  if (f.sweat) { const sy = cy - 12 + ((t * 14) % 14); px(g, cx + 13, sy, P.cyan, 2, 3); px(g, cx + 13, sy + 3, P.ice, 1, 1); }
  // gauntlet stones in the corner
  const stoneCols = [P.ice, P.cyan, P.pale, P.electric, P.cyan, P.ice];
  stoneCols.forEach((c, i) => {
    const on = glow > 0.4 && (Math.floor(t * 5) + i) % 3 === 0;
    px(g, 52 + (i % 3) * 3, 48 + Math.floor(i / 3) * 3, on ? P.ice : c, 2, 2);
  });
}

/* ---------------- optional external sprite, recoloured to the blue ramp ---------------- */
export function recolourToBlue(src: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d')!; g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), ramp = [P.abyss, P.navy, P.dark, P.deep, P.primary, P.electric, P.cyan, P.pale, P.ice].map(hex);
  for (let i = 0; i < img.data.length; i += 4) {
    const lum = (0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]) / 255;
    const col = ramp[Math.min(ramp.length - 1, Math.floor(lum * ramp.length))];
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2];
  }
  g.putImageData(img, 0, 0);
  return c;
}
