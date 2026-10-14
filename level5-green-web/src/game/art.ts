/* GREEN art — everything drawn in code, green shades only. Mirrors the drawing functions in green.py. */
import { C, CELL, JUMPSCARE_FRAMES, rgb, type RGB } from './config';
import { ForestMaze, V } from './maze';
import { Rng, type Mood } from './sim';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
export const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const poly = (g: Ctx, pts: { x: number; y: number }[], fill?: string, stroke?: string, lw = 1) => {
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
};
const line = (g: Ctx, a: { x: number; y: number }, b: { x: number; y: number }, col: string, w = 1) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };
const circle = (g: Ctx, x: number, y: number, r: number, fill?: string, stroke?: string, lw = 1) => {
  g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, TAU);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
};
const ellipse = (g: Ctx, x: number, y: number, w: number, h: number, fill: string) => { g.beginPath(); g.ellipse(x + w / 2, y + h / 2, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, TAU); g.fillStyle = fill; g.fill(); };
export { circle, line, poly };

const BRANCHES = [2, 2, 3, 2], LIMBS = [3, 4, 5, 4];
function branch(g: Ctx, r: Rng, p: V, ang: number, length: number, width: number, depth: number) {
  if (depth <= 0 || length < 5) return;
  const pts = [p];
  for (let i = 0; i < 3; i++) { ang += r.uni(-0.25, 0.25); pts.push(pts[pts.length - 1].add(V.ang(ang, length / 3))); }
  g.lineWidth = Math.max(1, width); g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach((q) => g.lineTo(q.x, q.y)); g.stroke();
  const n = r.pick(BRANCHES);
  for (let i = 0; i < n; i++) branch(g, r, pts[3], ang + r.uni(-0.75, 0.75), length * r.uni(0.6, 0.8), width * 0.66, depth - 1);
}

/** Gnarled four-lobed trunk outline: flat sides match the collision cells, root flares cover the corners. */
export function trunkShape(c: V, half: number, wob: number, r: Rng, n = 72) {
  const pts: V[] = [];
  for (let i = 0; i < n; i++) {
    const a = (TAU * i) / n;
    let rr = half / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) ** 0.4 + 32 * Math.max(0, -Math.cos(4 * a)) ** 2;
    rr += wob * Math.sin(a * 7 + 1.3) + r.uni(-wob, wob) * 0.5;
    pts.push(c.add(V.ang(a, rr)));
  }
  return pts;
}

/** Static forest: painterly grass, dirt trails, thickets, stone ruins, dead-branch shadows and the giant tree. */
export function bakeWorld(maze: ForestMaze) {
  const r = new Rng(42), ww = maze.worldW, wh = maze.worldH, cv = mk(ww, wh), g = cv.getContext('2d')!;
  g.fillStyle = rgb(C.GRASS); g.fillRect(0, 0, ww, wh);
  for (let i = 0; i < 520; i++) circle(g, r.uni(0, ww), r.uni(0, wh), r.uni(18, 64), rgb(r.pick([C.GRASS_LO, C.GRASS_HI, C.MOSS, C.DIRT, C.GRASS_HI]), 0.18));
  const trails = mk(ww, wh), tg = trails.getContext('2d')!;
  tg.strokeStyle = rgb(C.DIRT); tg.fillStyle = rgb(C.DIRT); tg.lineWidth = 22; tg.lineCap = 'round';
  for (let y = 0; y < maze.rows; y++) for (let x = 0; x < maze.cols; x++) {
    if (maze.char([x, y]) !== '.') continue;
    const c = ForestMaze.center([x, y]);
    for (const n of [[x + 1, y], [x, y + 1]] as const) if (maze.char(n) === '.') { const d = ForestMaze.center(n); tg.beginPath(); tg.moveTo(c.x, c.y); tg.lineTo(d.x, d.y); tg.stroke(); }
    circle(tg, c.x, c.y, 11, rgb(C.DIRT));
  }
  g.globalAlpha = 0.47; g.drawImage(trails, 0, 0); g.globalAlpha = 1;
  g.lineWidth = 1;
  for (let i = 0; i < 11000; i++) {
    const x = r.uni(0, ww), y = r.uni(0, wh), a = r.uni(-0.6, 0.6) - Math.PI / 2, l = r.uni(3, 7);
    line(g, { x, y }, { x: x + Math.cos(a) * l, y: y + Math.sin(a) * l }, rgb(r.pick([C.GRASS_HI, C.GRASS_LO, C.GRASS_HI, C.MOSS])));
  }
  for (let i = 0; i < 1600; i++) { g.fillStyle = rgb(r.pick([C.DEEP, C.LEAF_HI, C.GRASS_LO])); g.fillRect(Math.floor(r.uni(0, ww)), Math.floor(r.uni(0, wh)), 2, 2); }
  for (let i = 0; i < 260; i++) ellipse(g, r.uni(0, ww), r.uni(0, wh), r.uni(3, 8), r.uni(2, 6), rgb(r.pick([C.STONE, C.STONE_HI, C.DEEP])));
  const tc = maze.treeCenter;
  for (let i = 0; i < 22; i++) {                                         // fairy ring of pale mushrooms
    const a = (TAU * i) / 22 + r.uni(-0.05, 0.05), p = tc.add(new V(Math.cos(a) * 196, Math.sin(a) * 196));
    circle(g, p.x + 1, p.y + 2, 5, rgb(C.MOSS)); circle(g, p.x, p.y, 4, rgb(C.MUSH)); circle(g, p.x - 1, p.y - 1, 1, rgb(C.PALE));
  }
  const walls: [number, number][] = [];
  for (let y = 0; y < maze.rows; y++) for (let x = 0; x < maze.cols; x++) if (maze.char([x, y]) === '#') walls.push([x, y]);
  g.fillStyle = rgb(C.DEEP, 0.59);
  for (const [x, y] of walls) { g.beginPath(); g.roundRect(x * CELL + 6, y * CELL + 9, CELL, CELL, 12); g.fill(); }
  const ruins = new Set(walls.filter(([x, y]) => x > 0 && y > 0 && x < maze.cols - 1 && y < maze.rows - 1 && r.next() < 0.1).map(([x, y]) => x * 100 + y));
  g.fillStyle = rgb(C.DARKWALL);
  for (const [x, y] of walls) { g.beginPath(); g.roundRect(x * CELL - 1, y * CELL - 1, CELL + 2, CELL + 2, 6); g.fill(); }
  for (const [x, y] of walls) {
    const rx = x * CELL, ry = y * CELL;
    if (ruins.has(x * 100 + y)) {                                       // crumbling stone wall
      g.fillStyle = rgb(C.STONE); g.fillRect(rx + 1, ry + 1, CELL - 2, CELL - 2);
      for (let row = 0; row < 4; row++) {
        const yy = ry + 1 + row * 13, off = row % 2 ? 0 : 9;
        line(g, { x: rx, y: yy }, { x: rx + CELL, y: yy }, rgb(C.DEEP), 2);
        for (let xx = rx + off; xx < rx + CELL; xx += 18) line(g, { x: xx, y: yy }, { x: xx, y: yy + 13 }, rgb(C.DEEP), 2);
      }
      for (let i = 0; i < 10; i++) { g.fillStyle = rgb(r.pick([C.STONE_HI, C.MOSS, C.LEAF])); g.fillRect(Math.floor(r.uni(rx, rx + CELL - 4)), Math.floor(r.uni(ry, ry + CELL - 4)), 4, 3); }
      g.strokeStyle = rgb(C.DEEP); g.lineWidth = 2; g.strokeRect(rx + 1, ry + 1, CELL - 2, CELL - 2);
      continue;
    }
    const cx = rx + CELL / 2, cy = ry + CELL / 2;
    for (let i = 0; i < 8; i++) circle(g, cx + r.uni(-14, 14), cy + r.uni(-14, 14), r.uni(9, 16), rgb(r.pick([C.WALL, C.LEAF, C.ROOT, C.WALL])));
    for (let i = 0; i < 5; i++) circle(g, cx + r.uni(-16, 10), cy + r.uni(-16, 10), r.uni(2, 5), rgb(C.LEAF_HI));
    for (let i = 0; i < 5; i++) circle(g, cx + r.uni(-18, 18), cy + r.uni(-18, 18), r.uni(1.5, 3.5), rgb(C.DEEP));
    if (r.next() < 0.22) { circle(g, cx, cy, 11, rgb(C.BARK), rgb(C.BARK_HI), 2); circle(g, cx, cy, 5, rgb(C.DEEP)); }
  }
  g.strokeStyle = rgb(C.BARK);                                           // the ancient tree: roots, trunk, grooves, moss
  for (let i = 0; i < 14; i++) {
    const a = (TAU * i) / 14 + r.uni(-0.15, 0.15);
    if (Math.abs(((a - Math.PI / 2 + Math.PI) % TAU + TAU) % TAU - Math.PI) < 0.35) continue;    // keep the door approach clear
    branch(g, r, tc.add(V.ang(a, 92)), a, r.uni(60, 110), 9, 3);
  }
  const pts = trunkShape(tc, 78, 5, r);
  poly(g, pts.map((p) => p.add(new V(6, 9))), rgb(C.DEEP));
  poly(g, pts, rgb(C.BARK));
  for (const k of [0.84, 0.66, 0.48, 0.3]) poly(g, pts.map((p) => tc.add(p.sub(tc).mul(k))), undefined, rgb(k > 0.5 ? C.BARK_HI : C.ROOT), 2);
  for (let i = 0; i < 36; i++) { const a = (TAU * i) / 36; line(g, tc.add(V.ang(a, r.uni(20, 40))), tc.add(V.ang(a, r.uni(70, 100))), rgb(C.DEEP), 2); }
  for (let i = 0; i < 40; i++) circle(g, tc.x + r.uni(-80, 80), tc.y + r.uni(-80, 80), r.uni(3, 8), rgb(r.pick([C.MOSS, C.LEAF, C.WALL])));
  poly(g, pts, undefined, rgb(C.DEEP), 3);
  const canopy = mk(ww, wh), cg = canopy.getContext('2d')!;              // dead-branch shadows (the reference's black silhouettes)
  cg.strokeStyle = rgb(C.DEEP);
  for (let i = 0; i < 18; i++) {
    const p = ForestMaze.center(r.pick(walls)), n = r.pick(LIMBS);
    for (let k = 0; k < n; k++) branch(cg, r, p, r.uni(0, TAU), r.uni(70, 120), r.uni(5, 8), 5);
  }
  for (let i = 0; i < 9; i++) branch(cg, r, tc, (TAU * i) / 9 + r.uni(-0.2, 0.2), r.uni(150, 210), 16, 6);
  g.globalAlpha = 0.47; g.drawImage(canopy, 0, 0); g.globalAlpha = 1;
  return cv;
}

export function drawGlyph(g: Ctx, idx: number, x: number, y: number, r: number, col: string, w = 2) {
  g.strokeStyle = col; g.lineWidth = w; g.beginPath();
  if (idx === 0) { g.moveTo(x, y - r); g.lineTo(x + r * 0.87, y + r * 0.5); g.lineTo(x - r * 0.87, y + r * 0.5); g.closePath(); g.moveTo(x + r * 0.22, y + r * 0.08); g.arc(x, y + r * 0.08, r * 0.22, 0, TAU); }
  else if (idx === 1) { g.moveTo(x, y + r); g.lineTo(x, y - r); g.moveTo(x - r * 0.7, y - r * 0.8); g.lineTo(x, y - r * 0.1); g.lineTo(x + r * 0.7, y - r * 0.8); g.moveTo(x - r * 0.4, y + r * 0.5); g.lineTo(x + r * 0.4, y + r * 0.5); }
  else { g.moveTo(x, y - r); g.lineTo(x + r * 0.7, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.7, y); g.closePath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r * 0.45); g.lineTo(x, y + r * 0.45); }
  g.stroke();
}

/** Thanos portrait, green-shifted, with changing expressions. */
export function drawThanosFace(g: Ctx, x: number, y: number, r: number, mood: Mood, t: number) {
  const brow = { calm: 0.2, wary: 0.7, strain: 0.9, fear: -0.7, smug: 0.1, resolve: 0.6, triumph: 0 }[mood];
  const mouth = { calm: -0.1, wary: -0.35, strain: -0.6, fear: -0.95, smug: 0.55, resolve: -0.05, triumph: 0.9 }[mood];
  ellipse(g, x - r, y + r * 0.55, r * 2, r * 0.9, rgb(C.ARMOR));
  g.strokeStyle = rgb(C.ARMOR_HI); g.lineWidth = Math.max(1, r / 14); g.beginPath(); g.ellipse(x, y + r, r, r * 0.45, 0, 0, TAU); g.stroke();
  const head = [[-0.62, -0.55], [-0.7, 0.05], [-0.55, 0.55], [-0.25, 0.82], [0.25, 0.82], [0.55, 0.55], [0.7, 0.05], [0.62, -0.55]].map(([a, b]) => ({ x: x + a * r, y: y + b * r }));
  ellipse(g, x - r * 0.64, y - r * 0.95, r * 1.28, r * 1.0, rgb(C.SKIN_LO));
  poly(g, head, rgb(C.SKIN_LO));
  ellipse(g, x - r * 0.5, y - r * 0.9, r * 0.9, r * 0.6, rgb(C.ARMOR_HI));
  for (const k of [-1.5, -0.5, 0.5, 1.5]) line(g, { x: x + k * r * 0.13, y: y + r * 0.5 }, { x: x + k * r * 0.15, y: y + r * 0.8 }, rgb(C.ARMOR), Math.max(1, r / 18));   // chin ridges
  for (const s of [-1, 1]) {
    line(g, { x: x + s * r * 0.08, y: y - r * 0.2 + brow * r * 0.1 }, { x: x + s * r * 0.5, y: y - r * 0.3 - brow * r * 0.06 }, rgb(C.DEEP), Math.max(2, r / 9));
    const ew = r * (mood === 'fear' ? 0.13 : 0.1);
    if (mood === 'triumph') { g.strokeStyle = rgb(C.PORTAL); g.lineWidth = Math.max(1, r / 18); g.beginPath(); g.arc(x + s * r * 0.28, y - r * 0.12, ew, Math.PI + 0.3, TAU - 0.3); g.stroke(); }
    else { ellipse(g, x + s * r * 0.28 - ew, y - r * 0.12 - ew * 0.5, ew * 2, ew * (mood === 'fear' ? 1.5 : 1), rgb(C.PORTAL)); circle(g, x + s * r * 0.28, y - r * 0.1, Math.max(1, ew * 0.45), rgb(C.DEEP)); }
  }
  const mw = r * 0.3, my = y + r * 0.33;
  g.strokeStyle = rgb(C.DEEP); g.lineWidth = Math.max(2, r / 12); g.beginPath();
  for (let k = 0; k <= 6; k++) { const u = (k / 6) * 2 - 1, px = x + (k / 6) * mw * 2 - mw, py = my - mouth * r * 0.1 * (1 - u * u); if (k) g.lineTo(px, py); else g.moveTo(px, py); }
  g.stroke();
  if ((mood === 'fear' || mood === 'strain') && Math.floor(t * 3) % 2) circle(g, x + r * 0.58, y - r * 0.3 + ((t * 14) % (r * 0.4)), Math.max(1, r / 14), rgb(C.PALE));
  poly(g, head, undefined, rgb(C.DEEP), Math.max(1, r / 16));
}

/** Thanos from above: bald ridged head, armoured shoulders, the Gauntlet holding the flashlight. */
export function drawThanosTopdown(g: Ctx, p: V, aim: number, t: number, moving: boolean, sprint: boolean, ghost = false) {
  const f = V.ang(aim), rt = new V(-f.y, f.x), sway = Math.sin(t * (sprint ? 14 : 9)) * (moving ? 2.2 : 0);
  circle(g, p.x + 3, p.y + 5, 15, rgb(C.DEEP));
  poly(g, [p.add(rt.mul(15)).sub(f.mul(2)), p.add(rt.mul(12)).sub(f.mul(9)), p.sub(rt.mul(12)).sub(f.mul(9)), p.sub(rt.mul(15)).sub(f.mul(2)), p.sub(rt.mul(10)).add(f.mul(6)), p.add(rt.mul(10)).add(f.mul(6))], rgb(C.ARMOR), rgb(C.DEEP));
  for (const s of [1, -1]) { const q = p.add(rt.mul(s * 12)).add(f.mul(sway * s * 0.5)); circle(g, q.x, q.y, 6, rgb(C.ARMOR_HI), rgb(C.DEEP)); }
  const hand = p.add(rt.mul(6)).add(f.mul(20));
  line(g, p.add(rt.mul(11)), hand.sub(f.mul(3)), rgb(C.SKIN_LO), 6);
  circle(g, hand.x, hand.y, 6, rgb(C.ARMOR_HI));                          // the Infinity Gauntlet
  [C.PORTAL, C.GLOW, C.LIGHT, C.PALE, C.LEAF_HI, C.MOTE].forEach((c, k) => { const q = hand.add(V.ang(k * 1.05, 3.5)); circle(g, q.x, q.y, 1, rgb(c)); });
  const tip = hand.add(f.mul(6)); g.fillStyle = rgb(C.DEEP); g.fillRect(tip.x - 3, tip.y - 3, 6, 6);
  const lens = hand.add(f.mul(8)); circle(g, lens.x, lens.y, 2, rgb(C.LIGHT));
  line(g, p.sub(rt.mul(11)), p.sub(rt.mul(7)).add(f.mul(9 - sway)), rgb(C.SKIN_LO), 5);
  const h = p.add(f.mul(2)); circle(g, h.x, h.y, 8, rgb(C.PLAYER), rgb(C.SKIN_LO));   // bald head
  for (const k of [-1, 0, 1]) line(g, p.add(f.mul(6)).add(rt.mul(k * 2.6)), p.add(f.mul(9.5)).add(rt.mul(k * 2.6)), rgb(C.ARMOR));
  const e = p.sub(f).sub(rt.mul(2)); circle(g, e.x, e.y, 2, rgb(C.PORTAL));
  if (ghost) circle(g, p.x, p.y, 18, undefined, rgb(C.GLOW));
}

/** The phantom from above: a ragged, jagged shroud with the bald ghost's head. */
export function drawPhantomBody(g: Ctx, p: V, face: V, t: number) {
  const pts: V[] = [];
  for (let i = 0; i < 22; i++) pts.push(p.add(V.ang((TAU * i) / 22, 15 + (i % 2 ? 9 : 0) + 3 * Math.sin(t * 7 + i * 1.7))));
  const back = face.mul(-1), side = new V(-back.y, back.x);
  g.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const sd = side.mul((k - 2) * 5), a = p.add(sd), b = p.add(sd).add(back.mul(18)).add(side.mul(Math.sin(t * 9 + k) * 5)), c = p.add(sd.mul(1.4)).add(back.mul(34));
    g.strokeStyle = rgb(C.PHANTOM); g.lineWidth = 3; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.stroke();
  }
  poly(g, pts, rgb(C.PHANTOM));
  poly(g, pts.map((q) => p.add(q.sub(p).mul(0.62))), rgb(C.DEEP));
  poly(g, pts, undefined, rgb(C.EDGE), 2);
  for (const s of [1, -1]) { const q = p.add(side.mul(s * 9)).sub(face.mul(2)); circle(g, q.x, q.y, 5, rgb(C.GH_D)); }
  const hc = p.add(face.mul(3)); circle(g, hc.x, hc.y, 8, rgb(C.GH_SKIN)); const hl = hc.sub(face.mul(2)); circle(g, hl.x, hl.y, 5, rgb(C.GH_L)); circle(g, hc.x, hc.y, 8, undefined, rgb(C.GH_D));
  for (const s of [1, -1]) line(g, hc.add(face.mul(5)).add(side.mul(s * 3)), hc.add(face.mul(2)).add(side.mul(s * 3)), rgb(C.VOID), 2);
}

export const GHOST_LO = [300, 216] as const;
/** The jumpscare ghost (after the reference picture): bald pale figure, glowing eyes, black tears, an impossibly wide grin.
 *  Painted at 1/3 resolution, then scaled up with hard pixels. Animated over the 60 frames: lunge, twitch, grin splits, tears run, eyes dart. */
export function drawGhost(lo: HTMLCanvasElement, headCv: HTMLCanvasElement, k: number, t: number) {
  const g = lo.getContext('2d')!, h = headCv.getContext('2d')!, [lw, lh] = GHOST_LO;
  g.fillStyle = rgb(C.VOID); g.fillRect(0, 0, lw, lh);
  h.clearRect(0, 0, lw, lh);
  const rnd = new Rng(k * 7 + 1);
  const lunge = Math.min(1, k / 5);
  const u = (34 + 14 * lunge + 30 * (k / JUMPSCARE_FRAMES) ** 1.6) * (k % 9 === 0 ? 1.06 : 1);
  const cx = lw / 2 + rnd.uni(-1.5, 1.5) + (k % 11 === 7 ? rnd.pick([-5, 5]) : 0), cy = lh * 0.46 + rnd.uni(-1, 1);
  const P = (x: number, y: number) => new V(cx + x * u, cy + y * u);
  const lerp = (a: RGB, b: RGB, q: number) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * q)},${Math.round(a[1] + (b[1] - a[1]) * q)},${Math.round(a[2] + (b[2] - a[2]) * q)})`;
  /** Fill a silhouette, then shrink it toward the light focus in brightening steps: one smooth, unified form. */
  const lit = (pts: V[], focus: V, dark: RGB, light: RGB, steps: number, shrink: number) => {
    for (let i = 0; i < steps; i++) { const q = i / (steps - 1); poly(h, pts.map((p) => focus.add(p.sub(focus).mul(1 - shrink * q))), lerp(dark, light, q ** 0.8)); }
  };
  const sh: V[] = [];
  for (let i = 0; i <= 12; i++) { const x = (i / 12) * 3.5 - 1.75; sh.push(P(x, 1.64 - 0.55 * Math.sqrt(1 - (x / 1.75) ** 2))); }
  lit([...sh, new V(cx + 1.9 * u, lh + 5), new V(cx - 1.9 * u, lh + 5)], P(0, 1.25), C.DEEP, C.GH_SKIN, 10, 0.75);       // shoulders
  lit([P(-0.3, 0.45), P(0.3, 0.45), P(0.36, 1.05), P(0.5, 1.3), P(-0.5, 1.3), P(-0.36, 1.05)], P(0, 0.9), C.GH_D, C.GH_SKIN, 8, 0.7);   // neck
  for (const s of [-1, 1]) line(h, P(s * 0.12, 0.7), P(s * 0.24, 1.25), rgb(C.GH_D), Math.max(1, 0.03 * u));
  for (const s of [-1, 1]) ellipse(h, cx + (s * 0.72 - 0.09) * u, cy - 0.42 * u, 0.18 * u, 0.36 * u, rgb(C.GH_D));        // ears
  const egg: V[] = [];
  for (let i = 0; i < 48; i++) { const a = (TAU * i) / 48, sn = Math.sin(a); egg.push(new V(cx + 0.74 * u * Math.cos(a) * (1 - 0.36 * Math.max(0, sn) ** 2), cy - 0.27 * u + sn * (sn < 0 ? 1.12 : 1.1) * u)); }
  lit(egg, P(0, -0.85), C.GH_D, C.GH_XL, 16, 0.85);                                   // one bald head, lit from above
  for (const s of [-1, 1]) { ellipse(h, cx + (s * 0.42 - 0.17) * u, cy, 0.34 * u, 0.5 * u, rgb(C.GH_D, 0.43)); ellipse(h, cx + (s * 0.42 - 0.13) * u, cy - 0.12 * u, 0.26 * u, 0.12 * u, rgb(C.GH_XL, 0.27)); }
  ellipse(h, cx - 0.5 * u, cy - 0.5 * u, u, 0.16 * u, rgb(C.GH_D, 0.35));
  const sr = new Rng(99);                                                              // mottled skin, fixed to the face
  h.fillStyle = rgb(C.GH_D, 0.55);
  for (let i = 0; i < 140; i++) { const x = sr.uni(-0.7, 0.7), y = sr.uni(-1.3, 0.8); if ((x / 0.66) ** 2 + ((y + 0.27) / 1.05) ** 2 < 1) h.fillRect(Math.floor(cx + x * u), Math.floor(cy + y * u), 1, 1); }
  for (const x0 of [-0.1, 0.04, 0.12]) line(h, P(x0, -0.7), P(x0 + sr.uni(-0.05, 0.05), -0.45), rgb(C.GH_D));
  const flick = k % 7 === 3 || k % 7 === 4 ? 0.55 : 1, dart = new V(rnd.uni(-0.03, 0.03) * u, rnd.uni(-0.02, 0.02) * u);
  for (const s of [-1, 1]) {                                                          // eyes: dark sockets, glowing whites, darting pinpricks
    const ex = cx + s * 0.29 * u, ey = cy - 0.24 * u;
    ellipse(h, ex - 0.22 * u, ey - 0.14 * u, 0.44 * u, 0.3 * u, rgb(C.GH_SOCK));
    ellipse(h, ex - 0.15 * u, ey - 0.09 * u, 0.3 * u, 0.19 * u, rgb(C.VOID));
    const e = new V(ex + dart.x, ey + dart.y);
    circle(h, e.x, e.y, Math.max(1, 0.11 * u), lerp(C.VOID, C.GH_L, 0.6 * flick));
    circle(h, e.x, e.y, Math.max(1, 0.08 * u), lerp(C.VOID, C.GH_XL, flick));
    circle(h, e.x, e.y, Math.max(1, 0.045 * u), rgb(C.GH_EYE));
    const run = Math.min(1, 0.25 + k / 40);                                           // tears keep running
    [-0.11, -0.04, 0.04, 0.1].forEach((ox, j) => {
      const L = (0.25 + (0.45 * ((j * 37 + (s > 0 ? 13 : 0)) % 10)) / 10) * run * u, x0 = ex + ox * u;
      line(h, { x: x0, y: ey + 0.07 * u }, { x: x0 + s * 0.02 * u, y: ey + 0.07 * u + L }, rgb(C.VOID), Math.max(1, 0.03 * u));
      circle(h, x0 + s * 0.02 * u, ey + 0.07 * u + L, Math.max(1, 0.025 * u), rgb(C.VOID));
    });
  }
  poly(h, [P(-0.04, -0.2), P(0.04, -0.2), P(0.13, 0.12), P(-0.13, 0.12)], rgb(C.GH_SKIN));     // nose
  line(h, P(0, -0.18), P(0, 0.06), rgb(C.GH_XL), Math.max(1, 0.04 * u));
  ellipse(h, cx - 0.07 * u, cy + 0.02 * u, 0.14 * u, 0.1 * u, rgb(C.GH_L));
  for (const s of [-1, 1]) ellipse(h, cx + (s * 0.075 - 0.04) * u, cy + 0.1 * u, 0.08 * u, 0.05 * u, rgb(C.GH_SOCK));
  const grin = 0.55 + 0.4 * Math.min(1, k / 30) + 0.03 * Math.sin(t * 50);               // the grin splits wider and drops open
  const opn = 0.12 + 0.28 * Math.min(1, Math.max(0, (k - 20) / 25));
  const hw = 0.5 * u * (0.85 + 0.25 * grin), my = cy + 0.4 * u;
  const top: V[] = [], bot: V[] = [];
  for (let i = 0; i <= 20; i++) { const x = i / 10 - 1; top.push(new V(cx + x * hw, my - 0.24 * u * x * x)); }
  for (let i = 0; i <= 20; i++) { const x = 1 - i / 10; bot.push(new V(cx + x * hw, my - 0.24 * u * x * x + opn * u * (1 - x * x))); }
  for (const s of [-1, 1]) {
    line(h, { x: cx + s * hw, y: my - 0.24 * u }, P(s * 0.62, -0.05), rgb(C.GH_D), Math.max(1, 0.03 * u));
    line(h, { x: cx + s * hw, y: my - 0.2 * u }, P(s * 0.6, 0.55), rgb(C.GH_D), Math.max(1, 0.02 * u));
  }
  poly(h, [...top, ...bot], rgb(C.MOUTH));
  const tt = top.slice(3, -3);
  poly(h, [...tt.map((p) => new V(p.x, p.y + 0.04 * u)), ...tt.map((p) => new V(p.x, p.y + 0.13 * u)).reverse()], rgb(C.GH_GUM));
  for (let i = 4; i < top.length - 4; i += 2) line(h, { x: top[i].x, y: top[i].y + 0.05 * u }, { x: top[i].x, y: top[i].y + 0.12 * u }, rgb(C.TEETH_D));
  const strokePath = (pts: V[], w: number) => { h.strokeStyle = rgb(C.GH_D); h.lineWidth = w; h.beginPath(); pts.forEach((p, i) => (i ? h.lineTo(p.x, p.y) : h.moveTo(p.x, p.y))); h.stroke(); };
  strokePath(top, Math.max(1, 0.03 * u)); strokePath(bot, Math.max(1, 0.04 * u));
  for (let j = 0; j < 6; j++) { const x0 = cx + (j - 2.5) * 0.12 * u; line(h, { x: x0, y: my + (opn + 0.12) * u }, { x: x0, y: my + (opn + 0.12 + 0.1 * ((j * 7) % 5)) * u * Math.min(1, 0.3 + k / 30) }, rgb(C.VOID)); }
  const tilt = Math.sin(k * 0.45) * 4 + (k % 13 === 5 || k % 13 === 6 ? rnd.uni(-9, 9) : 0);     // creeping tilt + sudden twitches
  g.save(); g.globalAlpha = Math.min(1, 0.25 + k / 5); g.translate(lw / 2, lh / 2); g.rotate((-tilt * Math.PI) / 180); g.drawImage(headCv, -lw / 2, -lh / 2); g.restore();
}
