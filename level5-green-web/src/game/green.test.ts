import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { C, CELL, JUMPSCARE_FRAMES, LIGHT_RANGE, PH_HUNT, PLAYER_R, RING_LIFE, RITUAL_TIME, SEARCH_TIME, SPRINT, TIME_LIMIT, WALK } from './config';
import { ForestMaze, sameCell, V } from './maze';
import { CTRL0, Flashlight, GreenGame, Player, Rng } from './sim';

const ctrl = (o: Partial<typeof CTRL0> = {}) => ({ ...CTRL0, ...o });
const run = (g: GreenGame, n: number, each?: (i: number) => void) => { for (let i = 0; i < n; i++) { each?.(i); g.step(1 / 60); } };
const overlapsWall = (m: ForestMaze, p: V, r: number) => {
  const [cx, cy] = ForestMaze.cellOf(p);
  for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
    if (!m.solid([gx, gy])) continue;
    const qx = Math.min(Math.max(p.x, gx * CELL), (gx + 1) * CELL), qy = Math.min(Math.max(p.y, gy * CELL), (gy + 1) * CELL);
    if (Math.hypot(p.x - qx, p.y - qy) < r - 0.01) return true;
  }
  return false;
};
const fresh = () => { const g = new GreenGame(); g.begin(); return g; };
const jumpscareFrames = (g: GreenGame) => { let n = 0; while (g.state === 'JUMPSCARE' && n < 500) { g.step(1 / 60); n++; } return n; };

describe('palette', () => {
  it('every colour in the source is a green shade', () => {
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx|css|js)$/.test(f) && !f.endsWith('.test.ts')) files.push(p); });
    walk(join(__dirname, '..')); files.push(join(__dirname, '..', '..', 'tailwind.config.js'));
    const bad: string[] = [];
    const green = (r: number, g: number, b: number) => {
      if (r === 0 && g === 0 && b === 0) return true;
      if (Math.max(r, g, b) <= 12) return g >= r && g >= b;
      const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, s = mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 2 - mx - mn : mx + mn);
      let h = 0; if (mx !== mn) { const rr = r / 255, bb = b / 255; h = 60 * ((bb - rr) / (mx - mn)) + 120; }
      return g >= r && g >= b && h >= 75 && h <= 165 && s > 0.12;
    };
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\[(\d{1,3}), (\d{1,3}), (\d{1,3})\]/g)) if (!green(+m[1], +m[2], +m[3])) bad.push(`${f}: ${m[0]}`);
      for (const m of src.matchAll(/#([0-9A-Fa-f]{6})\b/g)) { const n = parseInt(m[1], 16); if (!green(n >> 16, (n >> 8) & 255, n & 255)) bad.push(`${f}: ${m[0]}`); }
    }
    expect(bad).toEqual([]);
  });
  it('spec primaries are exact', () => {
    expect([C.VOID, C.GROUND, C.WALL, C.PLAYER, C.LIGHT, C.PHANTOM, C.PORTAL]).toEqual([[2, 10, 3], [12, 37, 14], [26, 74, 30], [133, 255, 133], [57, 255, 20], [10, 56, 22], [200, 255, 200]]);
  });
});

describe('maze', () => {
  const m = new ForestMaze();
  it('is a fixed, validated 31 × 23 grid with three reachable runes', () => {
    expect([m.cols, m.rows]).toEqual([31, 23]);
    expect(m.runes).toHaveLength(3);
    const reach = m.bfs(m.spawn, m.playerOk).dist;
    for (const c of [...m.runes, m.doorFront]) expect(reach.has(c[0] * 100 + c[1])).toBe(true);
    expect(m.runes.every((c) => m.char(c) === '.')).toBe(true);
    expect(m.trunk.every((c) => m.solid(c))).toBe(true);
    expect(m.solid([-1, 4]) && m.solid([m.cols, 4])).toBe(true);
  });
});

describe('A — start and movement', () => {
  it('no movement on the title, then moves in four directions', () => {
    const g = new GreenGame(); g.ctrl = ctrl({ up: true }); run(g, 30);
    expect(g.player.pos).toEqual(ForestMaze.center(g.maze.spawn));
    g.begin(); g.phantom.enabled = false;
    for (const [k, d] of [['up', new V(0, -1)], ['down', new V(0, 1)], ['left', new V(-1, 0)], ['right', new V(1, 0)]] as const) {
      g.player.pos = ForestMaze.center([15, 14]); const s = g.player.pos.copy(); g.ctrl = ctrl({ [k]: true }); g.step(1 / 60);
      expect(g.player.pos.sub(s).x * d.x + g.player.pos.sub(s).y * d.y).toBeGreaterThan(1.5);
    }
  });
  it('walls and the trunk are never overlapped, even when sprinting at random', () => {
    const g = fresh(); g.phantom.enabled = false; g.player.pos = ForestMaze.center([1, 21]); g.ctrl = ctrl({ right: true, sprint: true }); run(g, 120);
    expect(g.player.pos.x).toBeLessThanOrEqual(2 * CELL - PLAYER_R + 0.01);
    const r = new Rng(1); let bad = 0; g.player.pos = ForestMaze.center([15, 14]);
    run(g, 6000, (i) => {
      if (i % 25 === 0) g.ctrl = ctrl({ up: r.next() < 0.5, down: r.next() < 0.3, left: r.next() < 0.4, right: r.next() < 0.4, sprint: r.next() < 0.5 });
      g.timeLeft = TIME_LIMIT; if (overlapsWall(g.maze, g.player.pos, PLAYER_R)) bad++;
    });
    expect(bad).toBe(0);
  });
  it('diagonals are not faster; sprint is 1.5–1.7×', () => {
    const m = new ForestMaze(), p = new Player(ForestMaze.center([15, 14]));
    p.update(0.25, m, ctrl({ up: true, right: true }));
    expect(p.pos.sub(ForestMaze.center([15, 14])).len() * 4).toBeCloseTo(WALK, 0);
    expect(SPRINT / WALK).toBeGreaterThanOrEqual(1.5); expect(SPRINT / WALK).toBeLessThanOrEqual(1.7);
  });
});

describe('B — stealth', () => {
  it('walking is silent; sprinting rings at a cooldown', () => {
    const g = fresh(); g.phantom.pause = 1e9; g.player.pos = ForestMaze.center([15, 14]);
    run(g, 180, (i) => { g.ctrl = ctrl({ left: i % 2 === 0, right: i % 2 === 1 }); });
    expect(g.rings).toHaveLength(0);
    let made = 0, before = 0;
    for (let i = 0; i < 180; i++) { g.ctrl = ctrl({ left: i % 60 < 30, right: i % 60 >= 30, sprint: true }); before = g.rings.length; g.step(1 / 60); if (g.rings.length > before) made++; }
    expect(made).toBeGreaterThanOrEqual(4); expect(made).toBeLessThanOrEqual(6);
    expect(g.rings.every((r) => r.age < RING_LIFE)).toBe(true);
  });
  it('investigates the sound origin, searches, then wanders', () => {
    const g = fresh(), ph = g.phantom;
    g.player.pos = ForestMaze.center([5, 13]); ph.pos = ForestMaze.center([5, 17]); ph.path = []; ph.pause = 0;
    const before = ph.pos.copy();
    g.ctrl = ctrl({ right: true, sprint: true }); g.step(1 / 60);
    const origin = g.rings[g.rings.length - 1].pos.copy();
    expect(ph.state).toBe('INVESTIGATE'); expect(sameCell(ph.target!, ForestMaze.cellOf(origin))).toBe(true);
    expect(ph.pos.sub(before).len()).toBeLessThan(5);
    g.ctrl = ctrl({ up: true }); run(g, 60);
    expect(sameCell(ph.target!, ForestMaze.cellOf(origin))).toBe(true);
    g.player.pos = ForestMaze.center([1, 1]); g.ctrl = ctrl();
    for (let i = 0; i < 600 && ph.state !== 'SEARCH'; i++) g.step(1 / 60);
    expect(ph.state).toBe('SEARCH');
    run(g, Math.round(SEARCH_TIME * 60) + 30);
    expect(ph.state).toBe('WANDER');
  });
  it('never enters a wall or the tree over 20000 frames; all states occur', () => {
    const g = fresh(); g.player.pos = ForestMaze.center([1, 21]);
    const cells = g.maze.bfs(g.maze.spawn, g.maze.phantomOk).cells, states = new Set<string>(); let bad = 0;
    run(g, 20000, (i) => {
      g.timeLeft = TIME_LIMIT;
      if (i % 700 === 0) g.phantom.hear(ForestMaze.center(cells[(i * 7919) % cells.length]));
      states.add(g.phantom.state); if (!g.maze.phantomOk(ForestMaze.cellOf(g.phantom.pos))) bad++;
    });
    expect(bad).toBe(0); expect([...states].sort()).toEqual(['INVESTIGATE', 'SEARCH', 'WANDER']);
    expect(WALK < PH_HUNT && PH_HUNT < SPRINT).toBe(true);
  });
});

describe('C — flashlight', () => {
  it('cone, range and walls', () => {
    const m = new ForestMaze(), lt = new Flashlight(), o = ForestMaze.center([15, 14]);
    expect(lt.illuminates(m, o, 0, o.add(new V(150, 0)))).toBe(true);
    expect(lt.illuminates(m, o, Math.PI, o.add(new V(150, 0)))).toBe(false);
    expect(lt.illuminates(m, o, 0, o.add(new V(LIGHT_RANGE + 20, 0)))).toBe(false);
    expect(lt.illuminates(m, ForestMaze.center([1, 21]), 0, ForestMaze.center([3, 21]))).toBe(false);
  });
  it('phantom is only visible inside the beam, never permanently', () => {
    const g = fresh(), o = ForestMaze.center([15, 14]); g.player.pos = o; g.phantom.pos = o.add(new V(-150, 0)); g.phantom.pause = 1e9;
    g.updateLight(o, 0); expect(g.phantomVisible(o, 0)).toBe(false);
    g.updateLight(o, Math.PI); expect(g.phantomVisible(o, Math.PI)).toBe(true);
    g.updateLight(o, 0); expect(g.phantomVisible(o, 0)).toBe(false);
    expect(g.light.amb).toHaveLength(Flashlight.AMB_RAYS);
    expect(g.explored.size).toBeGreaterThan(5);                       // fog of war memory
  });
});

describe('D — runes', () => {
  it('collected once, kept after death, cleared by restart', () => {
    const g = fresh(); g.phantom.enabled = false;
    g.player.pos = g.runes[0].pos.copy(); run(g, 3);
    expect([...g.collected]).toEqual([0]);
    g.phantom.enabled = true; g.phantom.pos = g.player.pos.copy(); g.step(1 / 60); jumpscareFrames(g);
    expect([...g.collected]).toEqual([0]); expect(g.state).toBe('PLAYING');
    g.restart(); expect(g.collected.size).toBe(0); expect(g.state).toBe('TITLE');
  });
});

describe('E — death and the jumpscare', () => {
  it('one life per catch, exactly 60 frames, respawn with protection, then game over', () => {
    const g = fresh(); g.phantom.pos = g.player.pos.add(new V(5, 0)); g.phantom.pause = 1e9; g.step(1 / 60);
    expect(g.state).toBe('JUMPSCARE'); expect(g.lives).toBe(2);
    g.ctrl = ctrl({ right: true });
    expect(jumpscareFrames(g)).toBe(JUMPSCARE_FRAMES);
    expect(g.lives).toBe(2); expect(g.state).toBe('PLAYING');
    expect(g.player.pos).toEqual(ForestMaze.center(g.maze.spawn));
    expect(g.phantom.pos.sub(g.player.pos).len()).toBeGreaterThan(600); expect(g.rings).toHaveLength(0);
    expect(g.protect).toBeGreaterThanOrEqual(0.9);
    g.ctrl = ctrl(); g.phantom.pos = g.player.pos.copy(); g.step(1 / 60);
    expect(g.state).toBe('PLAYING');
    for (let i = 0; i < 2; i++) { g.protect = 0; g.phantom.pos = g.player.pos.copy(); g.phantom.pause = 1e9; g.step(1 / 60); jumpscareFrames(g); }
    expect(g.state).toBe('GAME_OVER'); expect(g.lives).toBe(0);
    run(g, 60); expect(g.lives).toBe(0);
  });
});

describe('F — the tree door', () => {
  it('sealed, unlocked by three runes, opens after its animation, entered only through the door', () => {
    const g = fresh(); g.phantom.enabled = false; const mz = g.maze, front = ForestMaze.center(mz.doorFront);
    g.player.pos = front.copy(); g.ctrl = ctrl({ up: true }); run(g, 120);
    expect(sameCell(ForestMaze.cellOf(g.player.pos), mz.doorFront)).toBe(true); expect(g.msg).toBe('THE SEAL REMAINS CLOSED');
    g.collected = new Set([0, 1]); run(g, 60); expect(g.doorUnlocked).toBe(false);
    g.player.pos = g.runes[2].pos.copy(); g.ctrl = ctrl(); g.step(1 / 60);
    expect(g.doorUnlocked).toBe(true); expect(mz.doorOpen).toBe(false);
    g.player.pos = front.copy(); g.step(1 / 60); expect(g.ritualT).not.toBeNull();
    run(g, Math.round((RITUAL_TIME - 0.2) * 60)); expect(mz.doorOpen).toBe(false); expect(mz.solid(mz.door)).toBe(true);
    run(g, 30); expect(mz.doorOpen).toBe(true); expect(mz.solid(mz.door) || mz.solid(mz.portal)).toBe(false);
    expect(mz.trunk.filter((c) => !sameCell(c, mz.door) && !sameCell(c, mz.portal)).every((c) => mz.solid(c))).toBe(true);
    const g2 = fresh(); g2.phantom.enabled = false; g2.collected = new Set([0, 1, 2]); g2.doorUnlocked = true; g2.maze.doorOpen = true;
    g2.player.pos = ForestMaze.center(g2.maze.portal); g2.step(1 / 60); expect(g2.state).toBe('PLAYING');
    g.ctrl = ctrl({ up: true });
    for (let i = 0; i < 120 && g.state !== 'VICTORY'; i++) g.step(1 / 60);
    expect(g.state).toBe('VICTORY'); expect(g.throughDoor).toBe(true);
    run(g, 90); expect(g.state).toBe('VICTORY');
  });
});

describe('G — restart', () => {
  it.each(['TITLE', 'PLAYING', 'JUMPSCARE', 'GAME_OVER', 'VICTORY'] as const)('R from %s resets everything', (st) => {
    const g = fresh(); g.collected = new Set([0, 2]); g.doorUnlocked = true; g.ritualT = 2; g.maze.doorOpen = true;
    g.rings.push({ pos: new V(1, 1), age: 0.1 }); g.phantom.hear(ForestMaze.center([5, 5])); g.lives = 1; g.jsFrames = 30; g.shake = 9; g.protect = 1; g.timeLeft = 3;
    g.state = st; g.restart();
    expect(g.state).toBe('TITLE'); expect(g.collected.size).toBe(0); expect(g.doorUnlocked).toBe(false); expect(g.ritualT).toBeNull();
    expect(g.maze.doorOpen).toBe(false); expect(g.rings).toHaveLength(0); expect(g.phantom.state).toBe('WANDER'); expect(g.phantom.path).toHaveLength(0);
    expect([g.lives, g.jsFrames, g.shake, g.protect, g.timeLeft]).toEqual([3, 0, 0, 0, TIME_LIMIT]);
    expect(g.player.pos).toEqual(ForestMaze.center(g.maze.spawn)); expect(g.particles).toHaveLength(0); expect(g.throughDoor).toBe(false);
  });
});

/** Walks the BFS route: every rune, then the door, then the portal. */
function autopilot(g: GreenGame, limit = 60 * 600) {
  const mz = g.maze, portal = ForestMaze.center(mz.portal);
  const goals = [...g.runes.map((r) => r.pos), ForestMaze.center(mz.doorFront), portal];
  let frames = 0;
  for (const goal of goals) {
    while (frames < limit && (g.state === 'PLAYING' || g.state === 'JUMPSCARE')) {
      if (g.state === 'JUMPSCARE') { g.step(1 / 60); frames++; continue; }
      if (goal === portal && !mz.doorOpen) { g.ctrl = ctrl(); g.step(1 / 60); frames++; continue; }
      const here = ForestMaze.cellOf(g.player.pos), tgt = ForestMaze.cellOf(goal);
      if (sameCell(here, tgt) && g.player.pos.sub(goal).len() < 4) break;
      const path = mz.path(here, tgt, mz.playerOk) ?? [], aim = path.length ? ForestMaze.center(path[0]) : goal, d = aim.sub(g.player.pos);
      g.ctrl = ctrl({ left: d.x < -1.5, right: d.x > 1.5, up: d.y < -1.5, down: d.y > 1.5 });
      if (d.len() > 1) g.player.aim = Math.atan2(d.y, d.x);
      g.step(1 / 60); frames++;
    }
    if (g.state !== 'PLAYING') break;
  }
  return frames;
}

describe('autopilot', () => {
  it('collects all three runes, opens the tree and walks into the portal', () => {
    const g = fresh(); g.phantom.enabled = false;
    const n = autopilot(g);
    expect(g.state).toBe('VICTORY'); expect(g.collected.size).toBe(3);
    expect(n / 60).toBeLessThan(TIME_LIMIT / 2);
  });
  it('also wins with the phantom hunting (a blind route that ignores it)', () => {
    const g = fresh(); autopilot(g);
    expect(g.state).toBe('VICTORY');
  });
});
