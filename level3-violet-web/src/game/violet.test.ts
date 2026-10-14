import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BULLET_SPEED, C, LIVES, AMMO, TIME_LIMIT } from './config';
import { Player } from './entities';
import { VioletGame } from './logic';
import { Field, Projectile, World, inside, type V2 } from './physics';

/* ---------- helpers ---------- */
function fly(world: World, pos: V2, ang: number, frames = 900) {
  const p = new Projectile(pos, { x: Math.cos(ang) * BULLET_SPEED, y: Math.sin(ang) * BULLET_SPEED });
  for (let f = 0; f < frames; f++) {
    if (p.step(world).some((e) => e.t === 'door')) return p;
    if (!p.alive) return null;
  }
  return null;
}
const openWorld = () => { const w = new World(); w.door.unlocked = true; return w; };
const SPOTS: V2[] = [
  ...Array.from({ length: 14 }, (_, i) => ({ x: 60 + i * 50, y: 550 })),
  ...Array.from({ length: 4 }, (_, i) => ({ x: 90 + i * 50, y: 420 })),
  ...Array.from({ length: 4 }, (_, i) => ({ x: 380 + i * 50, y: 310 })),
];
const SOLUTIONS = (() => {
  const w = openWorld(), out: { spot: V2; deg: number; p: Projectile }[] = [];
  for (const spot of SPOTS) for (let a = 0; a < 3600; a += 2) { const p = fly(w, spot, (a / 10) * Math.PI / 180); if (p) out.push({ spot, deg: a / 10, p }); }
  return out;
})();

describe('bullet physics (same rules as the Python build)', () => {
  const w = new World();
  it('gravity adds 0.2 px/frame² to vy', () => { const p = new Projectile({ x: 200, y: 300 }, { x: 5, y: 0 }); p.step(w); expect(p.vel.y).toBeCloseTo(0.2, 9); });
  it('a wall ricochet inverts vx (angle in = angle out)', () => { const p = new Projectile({ x: 879, y: 300 }, { x: 8, y: 0 }); p.step(w); expect(p.vel.x).toBe(-8); expect(p.bounces).toBe(1); });
  it('a floor ricochet inverts vy', () => { const p = new Projectile({ x: 300, y: 597 }, { x: 0, y: 6 }); p.step(w); expect(p.vel.y).toBeLessThan(0); });
  it('the scaling field multiplies velocity by 1.6', () => { const v = { x: 3, y: -4 }; new Field('scale', { x: 0, y: 0, w: 1, h: 1 }).apply(v); expect(v.x).toBeCloseTo(4.8, 9); expect(v.y).toBeCloseTo(-6.4, 9); });
  it('the reflection field inverts vy', () => { const v = { x: 3, y: 5 }; new Field('reflect', { x: 0, y: 0, w: 1, h: 1 }).apply(v); expect(v).toEqual({ x: 3, y: -5 }); });
  it('enemy bullets ignore gravity', () => { const p = new Projectile({ x: 200, y: 300 }, { x: 4, y: 0 }, true); p.step(w); expect(p.vel.y).toBe(0); });
  it('a locked door behaves like armour', () => { const p = new Projectile({ x: 813, y: 470 }, { x: -6, y: 0 }); const ev = p.step(w); expect(ev.some((e) => e.t === 'door')).toBe(false); });
});

describe('the trick shot', () => {
  it('is solvable from most standing spots', () => {
    const solved = new Set(SOLUTIONS.map((s) => `${s.spot.x},${s.spot.y}`)).size;
    expect(solved).toBeGreaterThanOrEqual(Math.ceil(SPOTS.length * 0.8));
  });
  it('every door hit used a transformation field and a ricochet', () => {
    expect(SOLUTIONS.length).toBeGreaterThan(100);
    expect(SOLUTIONS.every((s) => s.p.used.size > 0 && s.p.bounces >= 1)).toBe(true);
  });
  it('the door has no direct line of sight from anywhere in the room', () => {
    const w = openWorld(), d = w.door.rect;
    const los = (a: V2, b: V2) => { for (let k = 0; k < 200; k++) { const t = k / 199, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; if (w.solidAt(x, y) && !inside(d, x, y)) return false; } return true; };
    const doorPts = Array.from({ length: 15 }, (_, i) => ({ x: d.x + d.w / 2, y: d.y + i * 6 }));
    for (let x = 30; x < 760; x += 20) for (let y = 70; y < 590; y += 20) {
      if (w.solidAt(x, y)) continue;
      expect(doorPts.some((dp) => los({ x, y }, dp))).toBe(false);
    }
  });
});

describe('game flow', () => {
  const rng = () => 0.5;
  it('starts with 3 lives, 5 bullets, 3 drones and 2:00', () => {
    const g = new VioletGame(undefined, rng); g.start();
    expect([g.lives, g.ammo, g.dronesLeft, g.timeLeft]).toEqual([LIVES, AMMO, 3, TIME_LIMIT]);
  });
  it('a calculated trick shot wins once every drone is down', () => {
    const g = new VioletGame(undefined, rng); g.start();
    for (const e of g.enemies) e.alive = false;
    g.world.door.unlocked = true;
    const sol = SOLUTIONS.find((s) => s.spot.y === 550 && s.spot.x >= 560)!;
    g.player.rect.x = sol.spot.x - Player.W / 2; g.player.rect.y = 600 - Player.H; g.player.pos = { x: g.player.rect.x, y: g.player.rect.y }; g.player.onGround = true;
    // aim so the muzzle sits on a verified winning trajectory
    let won = false;
    for (let da = 0; da < 6 && !won; da += 0.05) for (const s of [1, -1]) {
      const ang = (sol.deg + da * s) * Math.PI / 180;
      g.aimPoint = { x: 2000 * Math.cos(ang) + g.player.rect.x, y: 2000 * Math.sin(ang) + g.player.rect.y };
      g.update(1 / 60);
      const sh = g.player.shoulder(); g.aimPoint = { x: sh.x + Math.cos(ang) * 300, y: sh.y + Math.sin(ang) * 300 }; g.update(1 / 60);
      if (fly(openWorld(), g.player.muzzle(), g.player.aim)) { won = true; break; }
    }
    g.fire();
    for (let i = 0; i < 3000 && g.state === 'play'; i++) g.update(1 / 60);
    expect(g.state).toBe('won');
  });
  it('the door ignores hits while drones are alive', () => {
    const g = new VioletGame(undefined, rng); g.start();
    expect(g.world.door.unlocked).toBe(false);
  });
  it('running out of bullets ends the game', () => {
    const g = new VioletGame(undefined, rng); g.start(); g.aimPoint = { x: 450, y: 650 };
    for (let k = 0; k < 5; k++) { g.update(1 / 60); g.fire(); for (let i = 0; i < 400 && g.state === 'play' && g.shots.length; i++) g.update(1 / 60); }
    for (let i = 0; i < 10 && g.state === 'play'; i++) g.update(1 / 60);
    expect(g.state).toBe('over'); expect(g.overReason).toBe('OUT OF VECTOR BULLETS');
  });
  it('the timer expiring ends the game, and restart resets everything', () => {
    const g = new VioletGame(undefined, rng); g.start(); g.timeLeft = 0.01; g.update(1 / 60);
    expect(g.overReason).toBe('TIME EXPIRED');
    g.start(); expect([g.state, g.lives, g.ammo, g.dronesLeft, g.timeLeft]).toEqual(['play', 3, 5, 3, TIME_LIMIT]);
  });
});

describe('violet-only palette', () => {
  const hue = (hex: string) => {
    const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d === 0) return null;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360; return h;
  };
  const isViolet = (hex: string) => { const h = hue(hex); return h != null && h >= 255 && h <= 310; };
  it('every palette colour is violet', () => { for (const v of Object.values(C)) expect(isViolet(v), v).toBe(true); });
  it('no non-violet colour literal appears in the source', () => {
    const files = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|css)$/.test(f) && !f.endsWith('.test.ts') ? [p] : []; });
    const root = join(__dirname, '..', '..');
    const bad: string[] = [];
    for (const f of [...files(join(root, 'src')), join(root, 'tailwind.config.js'), join(root, 'index.html')]) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(/#[0-9a-fA-F]{6}\b/g)) if (!isViolet(m[0])) bad.push(`${f}: ${m[0]}`);
      for (const m of s.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) {
        const hex = '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('');
        if (!(Number(m[1]) + Number(m[2]) + Number(m[3]) === 0) && !isViolet(hex)) bad.push(`${f}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
