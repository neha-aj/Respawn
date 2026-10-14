import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARENA_L, BARRIER_T, C, CONTROLS, DEFEAT_T, DODGE_FRAMES, ENEMY_ATTACK_GAP, ENEMY_MOVES, FLASH_DMG, GROUND, PLAYER_MOVES, REVEAL_T, ROUND_TIME, RULES, VICTORY_TEXT, WALK } from './config';
import { YellowGame } from './sim';

const fight = () => { const g = new YellowGame(); g.keyDown('enter'); for (let i = 0; i < 200; i++) g.step(); return g; };
const press = (g: YellowGame, ...k: ('jump' | 'light' | 'heavy' | 'dodge' | 'flash')[]) => k.forEach((n) => (g.pressed[n] = true));
const hold = (g: YellowGame, k: Partial<YellowGame['held']> = {}) => Object.assign(g.held, { left: false, right: false, charge: false }, k);
const freeze = (g: YellowGame) => { g.enemy.ai = 'IDLE'; g.enemy.aiT = 1e9; g.enemy.attackCd = 1e9; };
const run = (g: YellowGame, n: number) => { for (let i = 0; i < n; i++) g.step(); };

describe('identity and palette', () => {
  it('every colour is a yellow/amber/gold/cream shade; spec primaries are exact', () => {
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx|css)$/.test(f) && !f.endsWith('.test.ts') && !f.endsWith('audio.ts')) files.push(p); });
    walk(join(__dirname, '..')); files.push(join(__dirname, '..', '..', 'tailwind.config.js'));
    const yellow = (r: number, g: number, b: number) => {
      if (Math.max(r, g, b) <= 60) return r >= b && g >= b && Math.abs(r - g) <= Math.max(6, Math.max(r, g) * 0.3);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d === 0) return false;
      let h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); if (h < 0) h += 360;
      return h >= 44 && h <= 62 && b <= Math.max(r, g);
    };
    const bad: string[] = [];
    for (const f of files) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(/\[(\d{1,3}), (\d{1,3}), (\d{1,3})\]/g)) if (!yellow(+m[1], +m[2], +m[3])) bad.push(`${f}: ${m[0]}`);
      for (const m of s.matchAll(/#([0-9A-Fa-f]{6})\b/g)) { const n = parseInt(m[1], 16); if (!yellow(n >> 16, (n >> 8) & 255, n & 255)) bad.push(`${f}: ${m[0]}`); }
      for (const m of s.matchAll(/rgb\((\d+),(\d+),(\d+)\)/g)) if (!yellow(+m[1], +m[2], +m[3])) bad.push(`${f}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
    expect([C.BG, C.FLOOR, C.PLAYER, C.MONK, C.FX, C.ENERGY, C.DOOR]).toEqual([[77, 61, 0], [128, 102, 0], [255, 255, 0], [153, 128, 0], [255, 255, 204], [255, 234, 0], [255, 254, 224]]);
    expect(VICTORY_TEXT).toBe('PHASE DOOR UNLOCKED. TRANSITIONING TO LEVEL: ORANGE');
    expect(readFileSync(join(__dirname, 'render.ts'), 'utf8')).toContain("this.text('YELLOW', 72");
  });
});

describe('flow, movement and attacks', () => {
  it('title → intro → fight; no input or AI before the fight', () => {
    const g = new YellowGame(); press(g, 'light'); hold(g, { right: true }); run(g, 30);
    expect([g.state, g.player.x]).toEqual(['TITLE', 100]);
    g.keyDown('enter'); const ex = g.enemy.x; run(g, 100); expect([g.state, g.enemy.x]).toEqual(['INTRO', ex]);
    run(g, 100); expect(g.state).toBe('FIGHT');
  });
  it('moves, stays in bounds, single jump, lands, faces the foe, no overlap', () => {
    const g = fight(); freeze(g); const pl = g.player, en = g.enemy;
    hold(g, { left: true }); run(g, 300); expect(pl.x).toBeCloseTo(ARENA_L + pl.HW, 6);
    hold(g); press(g, 'jump'); g.step(); const vy0 = pl.vy; run(g, 6); const vy1 = pl.vy; press(g, 'jump'); g.step();
    expect(vy0).toBeLessThan(0); expect(pl.vy).toBeGreaterThan(vy1);
    run(g, 80); expect([pl.onGround, pl.y]).toEqual([true, GROUND]);
    expect([pl.facing, en.facing]).toEqual([1, -1]);
    hold(g, { right: true }); run(g, 400); expect(Math.abs(en.x - pl.x)).toBeGreaterThanOrEqual(pl.HW + en.HW - WALK - 0.5);
  });
  it('light is fast and weak, heavy slow and strong; each lands once; spam cannot skip recovery', () => {
    const L = PLAYER_MOVES.light, Hv = PLAYER_MOVES.heavy;
    expect(L.startup < Hv.startup && L.recovery < Hv.recovery && L.dmg < Hv.dmg).toBe(true);
    let g = fight(); freeze(g); g.enemy.x = g.player.x + 50; press(g, 'light'); run(g, 40);
    expect(g.enemy.maxHp - g.enemy.hp).toBe(L.dmg);
    g = fight(); freeze(g); g.enemy.x = g.player.x + 70; press(g, 'heavy');
    for (let i = 0; i < 10; i++) { g.step(); press(g, 'heavy'); }
    expect(g.player.move).toBe('heavy');
    run(g, 60); expect(g.enemy.maxHp - g.enemy.hp).toBe(Hv.dmg);
  });
});

describe('dodge, charge and Solar Flash', () => {
  it('dodge: brief invulnerability, fast dash, cooldown; enemy cannot hit through it', () => {
    let g = fight(); freeze(g); const pl = g.player;
    press(g, 'dodge'); g.step(); const x0 = pl.x; expect(pl.state).toBe('dodge');
    const inv: boolean[] = []; for (let i = 0; i < DODGE_FRAMES + 2; i++) { inv.push(pl.invulnerable()); press(g, 'dodge'); g.step(); }
    const n = inv.filter(Boolean).length; expect(n).toBeGreaterThanOrEqual(6); expect(n).toBeLessThanOrEqual(14); expect(inv.at(-1)).toBe(false);
    expect(pl.x - x0).toBeGreaterThan(40);
    press(g, 'dodge'); g.step(); expect(pl.state).not.toBe('dodge');
    g = fight(); freeze(g); g.enemy.x = g.player.x + 60; g.enemy.beginAttack('light'); press(g, 'dodge');
    run(g, ENEMY_MOVES.light.startup + 3); expect(g.player.hp).toBe(100);
  });
  it('charging fills the meter, blocks movement, and is interrupted by a hit', () => {
    const g = fight(); freeze(g); const pl = g.player;
    hold(g, { charge: true }); run(g, 60); expect(pl.state).toBe('charge'); expect(pl.energy).toBeGreaterThan(40);
    const x0 = pl.x; hold(g, { charge: true, right: true }); g.step(); expect(pl.x).toBe(x0);
    g.enemy.x = pl.x + 60; g.enemy.beginAttack('light'); run(g, 20);
    expect(pl.state).not.toBe('charge'); expect(pl.hp).toBeLessThan(100);
  });
  it('Solar Flash: consumes the meter, shockwave, exactly 90 frames of stun, one hit, never lethal', () => {
    let g = fight(); freeze(g); const pl = g.player, en = g.enemy;
    pl.energy = 100; en.x = pl.x + 120; press(g, 'flash'); g.step();
    expect([pl.state, pl.energy]).toEqual(['brace', 0]);
    let stun = 0, wave = false; const hp0 = en.hp;
    for (let i = 0; i < 300; i++) { g.step(); wave ||= g.waves.length > 0; if (en.stun > 0) stun++; }
    expect(wave).toBe(true); expect(stun).toBe(90); expect(hp0 - en.hp).toBe(FLASH_DMG);
    g = fight(); freeze(g); g.player.energy = 100; g.enemy.x = g.player.x + 120; g.enemy.hp = 3; press(g, 'flash'); run(g, 120);
    expect(g.enemy.hp).toBeGreaterThanOrEqual(1); expect(g.enemy.state).not.toBe('defeat');
  });
});

describe('AI, loss and the Phase Door', () => {
  it('Wolverine approaches, winds up, strikes, recovers, repositions, and never attacks back-to-back', () => {
    const g = fight(), en = g.enemy, states = new Set<string>(), gaps: number[] = []; let lastEnd: number | null = null;
    for (let i = 0; i < 1500; i++) {
      const prev = en.state; g.step(); states.add(en.aiState());
      if (prev !== 'attack' && en.state === 'attack') gaps.push(lastEnd === null ? 999 : i - lastEnd);
      if (prev === 'attack' && en.state !== 'attack' && en.hitstun === 0) lastEnd = i;
      g.player.hp = 100; g.player.invuln = 0;
    }
    for (const s of ['APPROACH', 'ATTACK_WINDUP', 'ATTACK_ACTIVE', 'ATTACK_RECOVERY']) expect(states).toContain(s);
    expect(states.has('RETREAT') || states.has('JUMP')).toBe(true);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(ENEMY_ATTACK_GAP);
  });
  it('loss → GAME OVER; R restarts everything; time-up is a loss', () => {
    const g = fight(); g.player.hp = 1; g.enemy.x = g.player.x + 60; g.enemy.facing = -1; g.enemy.beginAttack('light'); run(g, 80);
    expect(g.state).toBe('GAME_OVER');
    g.keyDown('j'); g.keyDown('r');
    expect([g.state, g.player.hp, g.enemy.hp, g.player.x, g.enemy.x, g.player.energy, g.player.dodgeCd, g.waves.length, g.door.slide, g.roundT, g.enemy.ai]).toEqual(['INTRO', 100, 140, 100, 320, 0, 0, 0, 0, ROUND_TIME, 'IDLE']);
    const t = fight(); t.roundT = 2; run(t, 5); expect([t.state, t.cause]).toEqual(['GAME_OVER', 'TIME UP']);
  });
  it('KO → barrier shatters → pillars part → Thanos must walk in → victory → R restarts', () => {
    const g = fight(); freeze(g); g.enemy.hp = 1; g.enemy.x = g.player.x + 50; press(g, 'light'); run(g, 30);
    expect(g.state).toBe('DEFEAT');
    for (let i = 0; i < 20; i++) { press(g, 'light'); g.keyDown('enter'); g.keyDown('r'); g.step(); }
    expect(g.state).toBe('DEFEAT');
    run(g, DEFEAT_T + BARRIER_T + REVEAL_T + 5);
    expect(g.door.shattered).toBe(true); expect(g.state).toBe('PORTAL'); expect(g.door.slide).toBeGreaterThan(0.99);
    run(g, 120); expect(g.state).toBe('PORTAL');
    hold(g, { right: true }); for (let i = 0; i < 600 && g.state !== 'VICTORY'; i++) g.step();
    expect(g.state).toBe('VICTORY');
    g.keyDown('r'); expect([g.state, g.enemy.hp, g.door.open]).toEqual(['INTRO', 140, false]);
  });
  it('a simple bot beats Wolverine; a player who stands still gets hurt', () => {
    let wins = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = fight(), pl = g.player, en = g.enemy; en.rng.seed(seed);
      for (let i = 0; i < ROUND_TIME + 10 && g.state === 'FIGHT'; i++) {
        const d = en.x - pl.x, dist = Math.abs(d); hold(g);
        const danger = en.state === 'attack' && en.attackPhase() === 'startup' && dist < 150;
        if (danger && pl.dodgeCd === 0 && pl.actionable()) { press(g, 'dodge'); hold(g, { left: d > 0, right: d < 0 }); }
        else if (danger) hold(g, { left: d > 0, right: d < 0 });
        else if (pl.energy >= 100 && dist < 180 && en.stun === 0) press(g, 'flash');
        else if (en.stun > 0 && dist > 70) hold(g, { right: d > 0, left: d < 0 });
        else if (en.stun > 0) press(g, 'heavy');
        else if (dist > 72) hold(g, { right: d > 0, left: d < 0 });
        else if (en.state !== 'attack') press(g, 'light');
        g.step();
      }
      if (g.state === 'DEFEAT') wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(3);
    const idle = fight(); run(idle, 900); expect(idle.player.hp).toBeLessThan(70);
  });
});

describe('rules page + controls card', () => {
  it('has final rules and a controls card listing every key', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(RULES)).not.toMatch(/PLACEHOLDER/);
    const keys = CONTROLS.map(([k]) => k).join(' ');
    for (const k of ['A / D', 'W', 'J', 'K', 'SHIFT', 'hold L', 'I', 'ESC', 'C', 'M', 'R']) expect(keys).toContain(k);
  });
  it('opens from the rules page and returns to it', () => {
    const g = new YellowGame(); g.keyDown('h'); expect(g.state).toBe('RULES');
    g.openControls(); expect(g.state).toBe('CONTROLS');
    g.closeControls(); expect(g.state).toBe('RULES');
  });
  it('freezes the fight while open, and C / Esc close it', () => {
    const g = fight(), t0 = g.roundT, x0 = g.enemy.x;
    g.openControls(); run(g, 120); expect([g.state, g.roundT, g.enemy.x]).toEqual(['CONTROLS', t0, x0]);
    g.keyDown('c'); expect(g.state).toBe('FIGHT');
    g.keyDown('c'); g.keyDown('escape'); expect(g.state).toBe('FIGHT');
    g.keyDown('escape'); g.keyDown('c'); g.keyDown('c'); expect(g.state).toBe('PAUSED');
  });
});
