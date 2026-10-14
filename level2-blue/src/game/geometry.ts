/* ============================================================================
   Level 3 — The Overlap Trap: diagram data + triangle verification.
   The SAME segment list is rendered by the SVG diagram, drawn on the in-room
   monitor, and fed to the counters below. The count is computed, never typed.
   ============================================================================ */

export interface Pt { x: number; y: number }
export interface Segment { id: string; a: Pt; b: Pt; kind: 'square' | 'diagonal' }

/**
 * Two overlapping 4×4 squares, S1 = (0,0)–(4,4) and S2 = (2,2)–(6,6),
 * each with both diagonals. S1's main diagonal and S2's main diagonal are
 * collinear and overlap, forming one continuous line from (0,0) to (6,6).
 * Units are abstract grid units (y grows downward when rendered).
 */
export const OVERLAP_DIAGRAM: { segments: readonly Segment[]; size: number } = {
  size: 6,
  segments: [
    { id: 'S1-top', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, kind: 'square' },
    { id: 'S1-right', a: { x: 4, y: 0 }, b: { x: 4, y: 4 }, kind: 'square' },
    { id: 'S1-bottom', a: { x: 4, y: 4 }, b: { x: 0, y: 4 }, kind: 'square' },
    { id: 'S1-left', a: { x: 0, y: 4 }, b: { x: 0, y: 0 }, kind: 'square' },
    { id: 'S2-top', a: { x: 2, y: 2 }, b: { x: 6, y: 2 }, kind: 'square' },
    { id: 'S2-right', a: { x: 6, y: 2 }, b: { x: 6, y: 6 }, kind: 'square' },
    { id: 'S2-bottom', a: { x: 6, y: 6 }, b: { x: 2, y: 6 }, kind: 'square' },
    { id: 'S2-left', a: { x: 2, y: 6 }, b: { x: 2, y: 2 }, kind: 'square' },
    { id: 'S1-diag', a: { x: 0, y: 0 }, b: { x: 4, y: 4 }, kind: 'diagonal' },
    { id: 'S1-anti', a: { x: 4, y: 0 }, b: { x: 0, y: 4 }, kind: 'diagonal' },
    { id: 'S2-diag', a: { x: 2, y: 2 }, b: { x: 6, y: 6 }, kind: 'diagonal' },
    { id: 'S2-anti', a: { x: 6, y: 2 }, b: { x: 2, y: 6 }, kind: 'diagonal' },
  ],
};

const EPS = 1e-9;
const KEY = (p: Pt) => `${Math.round(p.x * 1e6) / 1e6},${Math.round(p.y * 1e6) / 1e6}`;
const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** A maximal drawn straight path: overlapping/touching collinear segments merged into one interval. */
export interface Path { origin: Pt; dir: Pt; lo: number; hi: number; segmentIds: string[] }

function lineKey(s: Segment) {
  // direction normalised so collinear segments share a key: (unit dir, signed distance from origin)
  let dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
  const len = Math.hypot(dx, dy); dx /= len; dy /= len;
  if (dx < -EPS || (Math.abs(dx) < EPS && dy < 0)) { dx = -dx; dy = -dy; }
  const dist = s.a.x * -dy + s.a.y * dx; // perpendicular offset
  return { k: `${dx.toFixed(9)}|${dy.toFixed(9)}|${dist.toFixed(9)}`, dir: { x: dx, y: dy }, dist };
}

export function buildPaths(segments: readonly Segment[]): Path[] {
  const groups = new Map<string, { dir: Pt; dist: number; iv: { lo: number; hi: number; id: string }[] }>();
  for (const s of segments) {
    const { k, dir, dist } = lineKey(s);
    const t1 = s.a.x * dir.x + s.a.y * dir.y, t2 = s.b.x * dir.x + s.b.y * dir.y;
    const g = groups.get(k) ?? { dir, dist, iv: [] };
    g.iv.push({ lo: Math.min(t1, t2), hi: Math.max(t1, t2), id: s.id });
    groups.set(k, g);
  }
  const paths: Path[] = [];
  for (const g of groups.values()) {
    const origin = { x: -g.dir.y * g.dist, y: g.dir.x * g.dist };
    const iv = [...g.iv].sort((a, b) => a.lo - b.lo);
    let cur: Path | null = null;
    for (const i of iv) {
      if (cur && i.lo <= cur.hi + EPS) { cur.hi = Math.max(cur.hi, i.hi); cur.segmentIds.push(i.id); }
      else { cur = { origin, dir: g.dir, lo: i.lo, hi: i.hi, segmentIds: [i.id] }; paths.push(cur); }
    }
  }
  return paths;
}

/** Parameter of p along a path, or null if p is not on the path's line. */
function along(path: Path, p: Pt): number | null {
  const rx = p.x - path.origin.x, ry = p.y - path.origin.y;
  if (Math.abs(rx * path.dir.y - ry * path.dir.x) > 1e-7) return null;
  return rx * path.dir.x + ry * path.dir.y;
}
export const onPath = (path: Path, p: Pt) => { const t = along(path, p); return t != null && t >= path.lo - 1e-7 && t <= path.hi + 1e-7; };

function lineIntersection(p: Path, q: Path): Pt | null {
  const den = p.dir.x * q.dir.y - p.dir.y * q.dir.x;
  if (Math.abs(den) < EPS) return null;
  const wx = q.origin.x - p.origin.x, wy = q.origin.y - p.origin.y;
  const s = (wx * q.dir.y - wy * q.dir.x) / den;
  return { x: p.origin.x + p.dir.x * s, y: p.origin.y + p.dir.y * s };
}

export interface Graph { points: Pt[]; paths: Path[]; connected: (i: number, j: number) => boolean }

/** Vertices = segment endpoints + every on-segment intersection, duplicates merged. */
export function buildGraph(segments: readonly Segment[]): Graph {
  const paths = buildPaths(segments);
  const map = new Map<string, Pt>();
  const add = (p: Pt) => { const k = KEY(p); if (!map.has(k)) map.set(k, { x: Math.round(p.x * 1e6) / 1e6, y: Math.round(p.y * 1e6) / 1e6 }); };
  for (const s of segments) { add(s.a); add(s.b); }
  for (let i = 0; i < paths.length; i++) for (let j = i + 1; j < paths.length; j++) {
    const q = lineIntersection(paths[i], paths[j]);
    if (q && onPath(paths[i], q) && onPath(paths[j], q)) add(q);
  }
  const points = [...map.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  const connected = (i: number, j: number) => paths.some((pa) => onPath(pa, points[i]) && onPath(pa, points[j]));
  return { points, paths, connected };
}

export type Triangle = [number, number, number]; // sorted vertex indices into graph.points

export function isTriangle(g: Graph, i: number, j: number, k: number): boolean {
  if (new Set([i, j, k]).size < 3) return false;
  if (Math.abs(cross(g.points[i], g.points[j], g.points[k])) < 1e-7) return false;
  return g.connected(i, j) && g.connected(j, k) && g.connected(i, k);
}

/** Method 1 — every non-collinear vertex triple whose three sides are fully drawn. */
export function enumerateTriangles(segments: readonly Segment[]): { graph: Graph; triangles: Triangle[] } {
  const graph = buildGraph(segments);
  const n = graph.points.length, triangles: Triangle[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) if (isTriangle(graph, i, j, k)) triangles.push([i, j, k]);
  return { graph, triangles };
}

/**
 * Method 2 (independent cross-check) — every triangle's sides lie on three
 * distinct maximal paths, so count triples of paths whose pairwise crossings
 * exist, are distinct, and lie inside both paths involved.
 */
export function countTrianglesByPaths(segments: readonly Segment[]): number {
  const paths = buildPaths(segments);
  let count = 0;
  for (let a = 0; a < paths.length; a++) for (let b = a + 1; b < paths.length; b++) for (let c = b + 1; c < paths.length; c++) {
    const P = paths[a], Q = paths[b], R = paths[c];
    const pq = lineIntersection(P, Q), pr = lineIntersection(P, R), qr = lineIntersection(Q, R);
    if (!pq || !pr || !qr) continue;
    if (!onPath(P, pq) || !onPath(Q, pq) || !onPath(P, pr) || !onPath(R, pr) || !onPath(Q, qr) || !onPath(R, qr)) continue;
    if (Math.abs(cross(pq, pr, qr)) < 1e-7) continue; // concurrent lines meet in one point
    count++;
  }
  return count;
}

const VERIFIED = enumerateTriangles(OVERLAP_DIAGRAM.segments);
/** Single source of truth for the Level 3 answer (computed from the rendered geometry). */
export const OVERLAP_GRAPH = VERIFIED.graph;
export const OVERLAP_TRIANGLES = VERIFIED.triangles;
export const TRIANGLE_COUNT = VERIFIED.triangles.length;
if (TRIANGLE_COUNT !== countTrianglesByPaths(OVERLAP_DIAGRAM.segments)) {
  throw new Error('Overlap Trap: triangle counters disagree; the diagram is inconsistent.');
}

export const OVERLAP_HINTS: readonly { title: string; text: string }[] = [
  { title: 'Start systematically', text: 'Do not count only the small triangles. Examine the whole diagram and mark the vertices you have already used.' },
  { title: 'Look for larger shapes', text: 'Several larger triangles are formed by combining smaller regions. Check whether a line continues through multiple intersections to create a longer side.' },
  { title: 'Use a systematic counting method', text: 'Group triangles by orientation and size. Count the smallest triangles first, then the larger triangles whose boundaries span several regions. Avoid counting the same three vertices twice.' },
];

export const triangleKey = (t: readonly number[]) => [...t].sort((a, b) => a - b).join('-');
