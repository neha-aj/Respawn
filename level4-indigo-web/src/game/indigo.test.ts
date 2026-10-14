import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { C, NODES, SHIP, SPAWN, TIME_LIMIT, WELLS } from './config';
import { GravityWell, IndigoGame, LaserObstacle, TargetGate, V, reflect } from './sim';

const step = (g: IndigoGame, n: number) => { for (let i = 0; i < n && (g.state === 'play' || g.state === 'won'); i++) g.step(1 / 60); };

describe('physics', () => {
  it('gravity is a softened inverse square pointing at the well', () => {
    const w = new GravityWell([0, 0], 300, 20, 60);
    const a1 = w.accel(new V(100, 0)), a2 = w.accel(new V(200, 0));
    expect(a1.len() / a2.len()).toBeCloseTo((200 ** 2 + 196) / (100 ** 2 + 196), 9);
    expect(a1.x).toBeLessThan(0);
    expect(w.accel(new V(0.001, 0)).len()).toBeLessThanOrEqual(300 / 196 + 1e-9);
  });
  it('wall reflection follows v′ = v − 2(v·n)n', () => { const v = reflect(new V(3, -4), new V(0, 1)); expect([v.x, v.y]).toEqual([3, 4]); });
  it('full thrust beats every well at its danger ring (escapable)', () => {
    for (const [p, k, c, r] of WELLS) expect(new GravityWell(p, k, c, r).accel(V.of(p).add(new V(r, 0))).len()).toBeLessThan(SHIP.THRUST);
  });
  it('laser phasing accepts a heading within ±15° in either beam direction', () => {
    const l = new LaserObstacle(), d = (x: number) => (x * Math.PI) / 180;
    expect(l.aligned(l.angle + d(14))).toBe(true);
    expect(l.aligned(l.angle + Math.PI - d(14))).toBe(true);
    expect(l.aligned(l.angle + d(20))).toBe(false);
  });
  it('the breathing gate is always wider than the ship', () => {
    const g = new TargetGate();
    for (let t = 0; t < 30; t += 0.1) { g.t = t; expect(2 * g.half).toBeGreaterThan(2 * SHIP.R + 6); }
  });
  it('momentum persists after thrust stops (Newtonian)', () => {
    const g = new IndigoGame(); g.start(); g.controls.thrust = true; step(g, 20); g.controls.thrust = false;
    const v = g.ship.vel.len(); step(g, 10); expect(g.ship.vel.len()).toBeGreaterThan(v * 0.8);
  });
});

describe('anchors, lives and reset', () => {
  it('an anchor attaches, the tether holds its length, SPACE releases it', () => {
    const g = new IndigoGame(); g.start();
    g.ship.pos = V.of(NODES[0]).add(new V(-80, 60)); g.ship.vel = new V(); g.ship.angle = Math.atan2(-60, 80);
    g.fire(); step(g, 20);
    expect(g.ship.tether).toBe(0);
    const L = g.ship.tlen; g.ship.vel = new V(0, 4); step(g, 60);
    expect(g.ship.pos.dist(V.of(NODES[0]))).toBeLessThanOrEqual(L + 0.5);
    const shots = g.shots; g.fire(); expect(g.ship.tether).toBeNull(); expect(g.shots).toBe(shots);
  });
  it('touching a singularity core costs a life and respawns', () => {
    const g = new IndigoGame(); g.start(); g.ship.pos = V.of(WELLS[1][0]).add(new V(30, 0)); g.ship.inv = 0; step(g, 3);
    expect(g.lives).toBe(2); expect(g.ship.pos.dist(V.of(SPAWN))).toBeLessThan(2);
  });
  it('timer expiry ends the run; restart resets everything', () => {
    const g = new IndigoGame(); g.start(); g.timeLeft = 0.01; step(g, 2);
    expect(g.state).toBe('over'); expect(g.reason).toContain('TIME');
    g.start(); expect([g.state, g.lives, g.shots, g.timeLeft, g.checkpoint]).toEqual(['play', 3, 8, TIME_LIMIT, false]);
  });
});

describe('the level is completable (autopilot flies it end to end)', () => {
  it('reaches the checkpoint and passes through the Indigo Gate', () => {
    const g = new IndigoGame(undefined, () => 0.5); g.start();
    const wrap = (a: number) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    const pilot = (tx: number, ty: number, vmax: number) => {
      const sh = g.ship, to = new V(tx, ty).sub(sh.pos), d = to.len();
      const desired = d > 2 ? to.norm().mul(Math.min(vmax, 0.035 * d + 0.4)) : new V(), err = desired.sub(sh.vel);
      Object.assign(g.controls, { thrust: false, reverse: false, left: false, right: false });
      if (err.len() < 0.12) return d;
      const diff = wrap(Math.atan2(err.y, err.x) - sh.angle);
      if (Math.abs(diff) > 0.05) g.controls[diff > 0 ? 'right' : 'left'] = true;
      if (Math.abs(diff) < 0.4) g.controls.thrust = true;
      return d;
    };
    const go = (tx: number, ty: number, vmax: number, tol: number, frames: number) => { for (let i = 0; i < frames; i++) { if (pilot(tx, ty, vmax) < tol || g.state !== 'play') return; g.step(1 / 60); } };
    for (const [x, y, v] of [[262, 300, 2], [300, 165, 1.8], [430, 160, 2], [500, 320, 2], [545, 350, 1.8]]) go(x, y, v, 14, 1500);
    expect(g.checkpoint).toBe(true);
    for (let i = 0; i < 600; i++) { pilot(545, 350, 2); g.step(1 / 60); if (!g.laser.active && g.laser.phaseLeft > 1.2) break; }
    go(690, 350, 3.5, 14, 400); go(770, 350, 2, 10, 900);
    for (let i = 0; i < 900; i++) { pilot(770, 350, 1); g.step(1 / 60); if (g.gate.half > 58) break; }
    for (let i = 0; i < 900 && g.state === 'play'; i++) { pilot(880, 350, 2.2); g.step(1 / 60); }
    expect(g.state).toBe('won');
  });
});

describe('violet-only palette', () => {
  const isViolet = (hex: string) => {
    const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, gg = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), d = mx - mn; if (d === 0) return false;
    let h = mx === r ? ((gg - b) / d) % 6 : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4; h *= 60; if (h < 0) h += 360;
    return h >= 250 && h <= 300;
  };
  it('every palette colour is indigo/violet', () => { for (const v of Object.values(C)) expect(isViolet(v), v).toBe(true); });
  it('no non-violet colour literal appears in the source', () => {
    const files = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|css)$/.test(f) && !f.endsWith('.test.ts') ? [p] : []; });
    const root = join(__dirname, '..', '..'), bad: string[] = [];
    for (const f of [...files(join(root, 'src')), join(root, 'tailwind.config.js'), join(root, 'index.html')]) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(/#[0-9a-fA-F]{6}\b/g)) if (!isViolet(m[0])) bad.push(`${f}: ${m[0]}`);
      for (const m of s.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) {
        if (+m[1] + +m[2] + +m[3] === 0) continue;
        const hex = '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('');
        if (!isViolet(hex)) bad.push(`${f}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
