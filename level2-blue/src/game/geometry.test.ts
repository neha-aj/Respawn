import { describe, expect, it } from 'vitest';
import {
  OVERLAP_DIAGRAM, OVERLAP_GRAPH, OVERLAP_TRIANGLES, TRIANGLE_COUNT, buildGraph, countTrianglesByPaths, enumerateTriangles,
  isTriangle, triangleKey, type Segment,
} from './geometry';
import { DIAGRAM_RENDER_SEGMENTS } from './geometryRender';

const seg = (id: string, ax: number, ay: number, bx: number, by: number): Segment => ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, kind: 'square' });
const count = (s: Segment[]) => enumerateTriangles(s).triangles.length;
const tri = [seg('a', 0, 0, 4, 0), seg('b', 4, 0, 2, 3), seg('c', 2, 3, 0, 0)];

describe('triangle counter — small hand-checkable diagrams', () => {
  it('a single triangle is 1', () => { expect(count(tri)).toBe(1); });
  it('a triangle with one cevian is 3 (two halves + the whole)', () => { expect(count([...tri, seg('m', 2, 3, 2, 0)])).toBe(3); });
  it('a triangle with two cevians from one vertex is 6', () => { expect(count([...tri, seg('m', 2, 3, 1, 0), seg('n', 2, 3, 3, 0)])).toBe(6); });
  it('a missing side is rejected', () => { expect(count([seg('a', 0, 0, 4, 0), seg('b', 4, 0, 2, 3)])).toBe(0); });
  it('three collinear points never form a triangle', () => { expect(count([seg('a', 0, 0, 2, 0), seg('b', 2, 0, 4, 0)])).toBe(0); });
  it('duplicate / overlapping segments do not double count', () => {
    expect(count([...tri, seg('dup', 0, 0, 4, 0)])).toBe(1);
    expect(count([seg('a1', 0, 0, 3, 0), seg('a2', 2, 0, 4, 0), seg('b', 4, 0, 2, 3), seg('c', 2, 3, 0, 0)])).toBe(1);
  });
  it('a side may be made of contiguous collinear pieces (long side through an intersection)', () => {
    // base drawn in two touching pieces; the full triangle must still count
    expect(count([seg('a1', 0, 0, 2, 0), seg('a2', 2, 0, 4, 0), seg('b', 4, 0, 2, 3), seg('c', 2, 3, 0, 0)])).toBe(1);
  });
  it('a square with both diagonals has 8 triangles', () => {
    const sq = [seg('t', 0, 0, 4, 0), seg('r', 4, 0, 4, 4), seg('b', 4, 4, 0, 4), seg('l', 0, 4, 0, 0), seg('d', 0, 0, 4, 4), seg('e', 4, 0, 0, 4)];
    expect(count(sq)).toBe(8);
    expect(countTrianglesByPaths(sq)).toBe(8);
  });
  it('merges vertices that coincide (diagonal crossing at a square corner)', () => {
    const g = buildGraph(OVERLAP_DIAGRAM.segments);
    const keys = new Set(g.points.map((p) => `${p.x},${p.y}`));
    expect(keys.size).toBe(g.points.length);
  });
});

describe('The Overlap Trap diagram', () => {
  it('has two overlapping squares and four diagonals', () => {
    expect(OVERLAP_DIAGRAM.segments.filter((s) => s.kind === 'square')).toHaveLength(8);
    expect(OVERLAP_DIAGRAM.segments.filter((s) => s.kind === 'diagonal')).toHaveLength(4);
  });
  it('has exactly the expected 10 vertices (8 corners + 2 edge crossings)', () => {
    const pts = OVERLAP_GRAPH.points.map((p) => `${p.x},${p.y}`).sort();
    expect(pts).toEqual(['0,0', '0,4', '2,2', '2,4', '2,6', '4,0', '4,2', '4,4', '6,2', '6,6'].sort());
  });
  it('both independent counting methods agree', () => {
    expect(TRIANGLE_COUNT).toBe(countTrianglesByPaths(OVERLAP_DIAGRAM.segments));
  });
  it('matches the hand breakdown: 8 in square 1 + 8 in square 2 + 6 overlap triangles = 22', () => {
    const P = OVERLAP_GRAPH.points;
    const inside = (t: number[], lo: number, hi: number) => t.every((i) => P[i].x >= lo && P[i].x <= hi && P[i].y >= lo && P[i].y <= hi);
    const s1 = OVERLAP_TRIANGLES.filter((t) => inside(t, 0, 4) && t.every((i) => [0, 4].includes(P[i].x) || [0, 4].includes(P[i].y) || (P[i].x === 2 && P[i].y === 2)) && t.every((i) => !(P[i].x === 2 && P[i].y === 4) && !(P[i].x === 4 && P[i].y === 2)));
    const s2 = OVERLAP_TRIANGLES.filter((t) => inside(t, 2, 6) && t.every((i) => [2, 6].includes(P[i].x) || [2, 6].includes(P[i].y) || (P[i].x === 4 && P[i].y === 4)) && t.every((i) => !(P[i].x === 2 && P[i].y === 4) && !(P[i].x === 4 && P[i].y === 2)));
    const crossing = OVERLAP_TRIANGLES.filter((t) => t.some((i) => (P[i].x === 2 && P[i].y === 4) || (P[i].x === 4 && P[i].y === 2)));
    expect(s1).toHaveLength(8);
    expect(s2).toHaveLength(8);
    expect(crossing).toHaveLength(6);
    expect(TRIANGLE_COUNT).toBe(22);
  });
  it('includes large triangles whose sides span several regions', () => {
    const P = OVERLAP_GRAPH.points;
    const area = (t: number[]) => Math.abs((P[t[1]].x - P[t[0]].x) * (P[t[2]].y - P[t[0]].y) - (P[t[1]].y - P[t[0]].y) * (P[t[2]].x - P[t[0]].x)) / 2;
    expect(OVERLAP_TRIANGLES.filter((t) => area(t) === 8).length).toBe(8);
    expect(new Set(OVERLAP_TRIANGLES.map(area))).toEqual(new Set([2, 4, 8]));
  });
  it('counts each triangle once (canonical keys are unique)', () => {
    expect(new Set(OVERLAP_TRIANGLES.map(triangleKey)).size).toBe(OVERLAP_TRIANGLES.length);
  });
  it('is deterministic', () => {
    expect(enumerateTriangles(OVERLAP_DIAGRAM.segments).triangles.length).toBe(TRIANGLE_COUNT);
  });
  it('the rendered diagram uses exactly the verified segments', () => {
    expect(DIAGRAM_RENDER_SEGMENTS).toBe(OVERLAP_DIAGRAM.segments);
  });
  it('rejects a near-triangle whose third side is not drawn', () => {
    const P = OVERLAP_GRAPH.points, idx = (x: number, y: number) => P.findIndex((p) => p.x === x && p.y === y);
    // (0,0)–(2,2) and (2,2)–(2,6) are drawn, but (0,0)–(2,6) is not
    expect(isTriangle(OVERLAP_GRAPH, idx(0, 0), idx(2, 2), idx(2, 6))).toBe(false);
    expect(isTriangle(OVERLAP_GRAPH, idx(0, 0), idx(4, 0), idx(4, 4))).toBe(true);
  });
});
