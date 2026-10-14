/* ForestMaze — fixed grid, BFS, validation and grid-DDA line of sight. Mirrors green.py. */
import { CELL, MAP } from './config';

export class V {
  constructor(public x = 0, public y = 0) {}
  add(o: V) { return new V(this.x + o.x, this.y + o.y); }
  sub(o: V) { return new V(this.x - o.x, this.y - o.y); }
  mul(k: number) { return new V(this.x * k, this.y * k); }
  len() { return Math.hypot(this.x, this.y); }
  copy() { return new V(this.x, this.y); }
  eq(o: V) { return this.x === o.x && this.y === o.y; }
  static ang(a: number, r = 1) { return new V(Math.cos(a) * r, Math.sin(a) * r); }
}
export type Cell = readonly [number, number];
export const key = (c: Cell) => c[0] * 100 + c[1];
const unkey = (k: number): Cell => [Math.floor(k / 100), k % 100];
export const sameCell = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

export class ForestMaze {
  readonly cols = MAP[0].length; readonly rows = MAP.length;
  readonly grid: string[][] = [];
  readonly runes: Cell[] = [];
  spawn!: Cell; phantomHome!: Cell; door!: Cell; portal!: Cell;
  readonly trunk: Cell[] = [];
  readonly doorFront: Cell; readonly treeCenter: V;
  readonly worldW: number; readonly worldH: number;
  doorOpen = false;

  constructor() {
    if (!MAP.every((r) => r.length === this.cols)) throw new Error('map rows must be equal length');
    const runes: Record<number, Cell> = {};
    MAP.forEach((row, y) => {
      this.grid.push([...row].map((ch, x) => {
        if (ch === 'S') { this.spawn = [x, y]; return '.'; }
        if (ch === 'H') { this.phantomHome = [x, y]; return '.'; }
        if ('123'.includes(ch)) { runes[+ch - 1] = [x, y]; return '.'; }
        if (ch === 'D') this.door = [x, y];
        if (ch === 'P') this.portal = [x, y];
        if ('TDP'.includes(ch)) this.trunk.push([x, y]);
        return ch;
      }));
    });
    for (let i = 0; i < 3; i++) if (runes[i]) this.runes.push(runes[i]);
    this.doorFront = [this.door[0], this.door[1] + 1];
    const n = this.trunk.length;
    this.treeCenter = new V((this.trunk.reduce((s, c) => s + c[0], 0) / n + 0.5) * CELL, (this.trunk.reduce((s, c) => s + c[1], 0) / n + 0.5) * CELL);
    this.worldW = this.cols * CELL; this.worldH = this.rows * CELL;
    this.validate();
  }

  char(c: Cell) { const [x, y] = c; return x >= 0 && x < this.cols && y >= 0 && y < this.rows ? this.grid[y][x] : '#'; }
  solid(c: Cell) { const ch = this.char(c); return ch === '#' || ch === 'T' || ((ch === 'D' || ch === 'P') && !this.doorOpen); }
  playerOk = (c: Cell) => !this.solid(c);
  phantomOk = (c: Cell) => this.char(c) === '.';               // the phantom never enters the tree
  static cellOf(p: { x: number; y: number }): Cell { return [Math.floor(p.x / CELL), Math.floor(p.y / CELL)]; }
  static center(c: Cell) { return new V((c[0] + 0.5) * CELL, (c[1] + 0.5) * CELL); }

  bfs(start: Cell, ok: (c: Cell) => boolean, maxd?: number) {
    const dist = new Map<number, number>([[key(start), 0]]), prev = new Map<number, number>(), q = [start];
    for (let i = 0; i < q.length; i++) {
      const c = q[i], d = dist.get(key(c))!;
      if (maxd !== undefined && d >= maxd) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n: Cell = [c[0] + dx, c[1] + dy], k = key(n);
        if (!dist.has(k) && ok(n)) { dist.set(k, d + 1); prev.set(k, key(c)); q.push(n); }
      }
    }
    return { dist, prev, cells: q };
  }

  /** Cells from a (exclusive) to b (inclusive); [] when a == b; null when unreachable. */
  path(a: Cell, b: Cell, ok: (c: Cell) => boolean): Cell[] | null {
    if (sameCell(a, b)) return [];
    const { dist, prev } = this.bfs(a, ok);
    if (!dist.has(key(b))) return null;
    const out = [key(b)];
    while (prev.get(out[out.length - 1]) !== key(a)) out.push(prev.get(out[out.length - 1])!);
    return out.reverse().map(unkey);
  }

  nearest(c: Cell, ok: (c: Cell) => boolean): Cell | null {
    if (ok(c)) return c;
    const { cells } = this.bfs(c, (n) => this.char(n) !== '#');
    return cells.find(ok) ?? null;
  }

  /** Refuse an unwinnable layout: spawn → every rune and the door front; door → portal once opened. */
  validate() {
    const reach = this.bfs(this.spawn, this.playerOk).dist;
    const missing = [...this.runes, this.doorFront, this.phantomHome].filter((c) => !reach.has(key(c)));
    const was = this.doorOpen; this.doorOpen = true;
    const open = this.bfs(this.spawn, this.playerOk).dist; this.doorOpen = was;
    if (missing.length || this.runes.length !== 3 || this.runes.some((c) => this.char(c) !== '.') || !open.has(key(this.portal)))
      throw new Error(`GREEN layout failed validation: ${JSON.stringify(missing)}`);
  }

  /** Grid DDA ray; distance to the first solid cell (or maxd). Adds visited cells to `seen`. */
  cast(o: { x: number; y: number }, ang: number, maxd: number, seen?: Set<number>) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let cx = Math.floor(o.x / CELL), cy = Math.floor(o.y / CELL);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = Math.abs(dx) > 1e-9 ? Math.abs(CELL / dx) : 1e18, tdy = Math.abs(dy) > 1e-9 ? Math.abs(CELL / dy) : 1e18;
    let tx = Math.abs(dx) > 1e-9 ? (dx > 0 ? ((cx + 1) * CELL - o.x) / dx : (cx * CELL - o.x) / dx) : 1e18;
    let ty = Math.abs(dy) > 1e-9 ? (dy > 0 ? ((cy + 1) * CELL - o.y) / dy : (cy * CELL - o.y) / dy) : 1e18;
    for (;;) {
      seen?.add(cx * 100 + cy);
      let t: number;
      if (tx < ty) { t = tx; tx += tdx; cx += sx; } else { t = ty; ty += tdy; cy += sy; }
      if (t >= maxd) return maxd;
      if (this.solid([cx, cy])) { seen?.add(cx * 100 + cy); return t; }
    }
  }

  los(a: V, b: V) { const d = b.sub(a), L = d.len(); return L < 1 || this.cast(a, Math.atan2(d.y, d.x), L) >= L - 0.5; }
}
