import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain-JS module
import * as R from './redLogic.js';

const { LEVEL7_DATA, NARRATOR, PHYS, ControlGlitch, PatienceTimer, Narrator, JumpAssist } = R;
const src = (p: string) => readFileSync(join(__dirname, p), 'utf8');
type Rect = { x: number; y: number; w: number; h: number };

describe('exports and helpers', () => {
  it('the scene file exports LEVEL7_DATA, NARRATOR, RED_FROM_START and the four helpers', () => {
    const scene = src('scenes/Level7RagePlatformer.js');
    expect(scene).toMatch(/export \{ LEVEL7_DATA, NARRATOR, RED_FROM_START, fleeVx, jumpHeight, reflectVx, sineY \} from '\.\.\/redLogic\.js'/);
    expect(scene).toMatch(/export default class Level7RagePlatformer extends LevelBase/);
    expect(R.RED_FROM_START).toBe(true);
  });
  it('sineY, reflectVx, jumpHeight and fleeVx do what their comments say', () => {
    expect(R.sineY(0, 0)).toBeCloseTo(0, 9);
    expect(Math.abs(R.sineY(3, 1.2))).toBeLessThanOrEqual(6);
    expect(R.sineY(1, 0)).not.toBeCloseTo(R.sineY(2, 0), 3);
    expect(R.reflectVx(90)).toBe(-90); expect(R.reflectVx(-70)).toBe(70);
    expect(R.jumpHeight(620, 1400)).toBeCloseTo(137.29, 1);
    expect(R.fleeVx(500, 100, 200)).toBe(200); expect(R.fleeVx(100, 500, 200)).toBe(-200); expect(R.fleeVx(5, 5, 200)).toBe(0);
  });
  it('physics constants match the spec', () => {
    expect(PHYS).toMatchObject({ gravity: 1400, speed: 260, jumpV: -620, coyote: 0.08, buffer: 0.1, playerW: 40, playerH: 56, floorY: 640, killY: 720 });
    expect(LEVEL7_DATA.spawn).toEqual({ x: 80, y: 600 });
    expect([LEVEL7_DATA.width, LEVEL7_DATA.height]).toEqual([1280, 720]);
  });
});

describe('narrator data', () => {
  it('is exactly the specified dialogue', () => {
    expect(NARRATOR).toEqual({
      r1_rule: ['The rules were right there. Mostly.', 'You learned one rule. That was adorable.', 'Congratulations. Reality has updated.'],
      r2_physics: ['Gravity filed a change request.', 'Physics is currently under new management.', 'You may want to rethink that jump.'],
      r3_controls: ['Left is left. For the next three seconds.', "Your fingers are innocent. Your timing isn't.", 'The controls have changed. Keep up.'],
      r4_patience: ['The exit is right there. Time is the problem.', 'Try the ancient technique known as waiting.', 'Your patience is being evaluated.'],
      deaths5: 'Death number {deaths}. The thermometer is not impressed.',
      deaths10: 'Fine. I will show you.',
      idle20: 'Standing still is also a strategy. A bad one.',
    });
  });
  it('picks lines deterministically; milestones at 5 and 10 deaths', () => {
    expect(R.deathLine('r1_rule', 1, 1)).toBe(NARRATOR.r1_rule[0]);
    expect(R.deathLine('r1_rule', 4, 4)).toBe(NARRATOR.r1_rule[0]);
    expect(R.deathLine('r3_controls', 2, 7)).toBe(NARRATOR.r3_controls[1]);
    expect(R.deathLine('r2_physics', 3, 5)).toBe('Death number 5. The thermometer is not impressed.');
    expect(R.deathLine('r2_physics', 3, 10)).toBe('Fine. I will show you.');
  });
  it('transient lines fade after 3.5 s and never overwrite the persistent line', () => {
    const n = new Narrator(3.5);
    n.say('hello'); expect(n.main).toBe('hello');
    n.update(3.4); expect(n.main).toBe('hello'); n.update(0.2); expect(n.main).toBe('');
    n.setPersistent(R.PATIENCE_MESSAGE); n.say('Try the ancient technique known as waiting.');
    expect(n.main).toBe('Your patience is appreciated'); expect(n.sub).toBe('Try the ancient technique known as waiting.');
    n.update(4); expect(n.main).toBe('Your patience is appreciated'); expect(n.sub).toBe('');
  });
});

describe('rooms are fair', () => {
  const rooms = LEVEL7_DATA.rooms;
  const H = R.jumpHeight(-PHYS.jumpV, PHYS.gravity);
  /** A hop from the right edge of `a` to the left edge of `b` must be within 80 % of the jump's reach and 85 % of its height. */
  const hop = (a: Rect, b: Rect, g = PHYS.gravity) => {
    const rise = a.y - b.y, gap = b.x - (a.x + a.w);
    return rise <= 0.85 * R.jumpHeight(-PHYS.jumpV, g) && gap <= 0.8 * R.jumpReach(rise, -PHYS.jumpV, g);
  };
  const plat = (room: { platforms: Rect[] }, i: number) => room.platforms[i];
  const mover = (room: { movers: (Rect & { x0: number; x1: number })[] }, i: number, at: 'x0' | 'x1') => { const m = room.movers[i]; return { x: m[at], y: m.y, w: m.w, h: m.h }; };

  it('every room has a safe start under the spawn and a door standing on a platform', () => {
    for (const room of rooms) {
      const start = room.platforms.find((p: Rect) => p.x <= 80 && p.x + p.w >= 120 && p.y === 640);
      expect(start, room.name).toBeTruthy();
      const pr = { x: 60, y: 572, w: 40, h: 56 };
      expect(room.hazards.some((h: Rect) => pr.x < h.x + h.w && pr.x + pr.w > h.x && pr.y < h.y + h.h && pr.y + pr.h > h.y)).toBe(false);
      const d = R.doorRect(room.exit);
      expect(room.platforms.some((p: Rect) => p.y === room.exit.y && p.x <= d.x && p.x + p.w >= d.x + d.w), room.name).toBe(true);
      expect(Math.abs(room.exit.x - 1170)).toBeLessThanOrEqual(50);
    }
  });
  it('Room 1: start → ledge 150–180 px right and higher → patrol platform → shy platform → exit ledge', () => {
    const r = rooms[0], start = plat(r, 0), ledge = plat(r, 1), end = plat(r, 2);
    expect(ledge.x - (start.x + start.w)).toBeGreaterThanOrEqual(150); expect(ledge.x - (start.x + start.w)).toBeLessThanOrEqual(180); expect(ledge.y).toBeLessThan(640);
    expect(hop(start, ledge)).toBe(true);
    expect(hop({ ...ledge, w: ledge.w - 40 }, mover(r, 0, 'x0'))).toBe(true);           // jumping before the hidden ledge spike
    expect(hop(mover(r, 0, 'x1'), mover(r, 1, 'x0'))).toBe(true);
    expect(hop(mover(r, 1, 'x1'), end)).toBe(true);
    expect(r.movers[1].shy).toBe(true);
  });
  it('Room 2: three raised platforms; the low-gravity jump is the way up and the ceiling punishes a full jump from the top', () => {
    const r = rooms[1], [start, p1, p2, p3, exitP] = r.platforms;
    expect([p1, p2, p3].every((p: Rect) => p.y < 640)).toBe(true);
    expect(hop(start, p1)).toBe(true); expect(hop(p1, p2)).toBe(true);
    expect(hop(p2, p3)).toBe(false);                                                  // impossible at normal gravity...
    const low = PHYS.gravity * r.gravityZone.factor;
    expect(hop(p2, p3, low)).toBe(true);                                               // ...possible in the marked zone
    const ceiling = r.hazards[1];
    expect(p2.y - R.jumpHeight(-PHYS.jumpV, low) - PHYS.playerH).toBeGreaterThan(ceiling.y + ceiling.h);   // from P2: clears the spikes
    expect(p3.y - R.jumpHeight(-PHYS.jumpV, low) - PHYS.playerH).toBeLessThan(ceiling.y + ceiling.h);      // from P3: would hit them
    expect(exitP.y).toBeGreaterThan(p3.y); expect(exitP.x - (p3.x + p3.w)).toBeLessThanOrEqual(110);       // walk off to the exit
    expect(R.gravityAt(r, 650)).toBeCloseTo(630, 6); expect(R.gravityAt(r, 950)).toBe(1400); expect(R.gravityAt(rooms[0], 650)).toBe(1400);
  });
  it('Room 3: observation area, three segments with reachable gaps; the last trap can be cleared with a long jump', () => {
    const r = rooms[2], [start, s1, s2, s3] = r.platforms;
    expect(start.w).toBeGreaterThanOrEqual(260);
    expect(hop(start, s1) && hop(s1, s2) && hop(s2, s3)).toBe(true);
    const trap = r.hidden[0];
    expect(R.jumpReach(s2.y - s3.y)).toBeGreaterThan(trap.x + trap.w + PHYS.playerW / 2 - (s2.x + s2.w - PHYS.playerW / 2));
  });
  it('Room 4: full floor, a laser corridor that cannot be bypassed, exit near x = 1170', () => {
    const r = rooms[3];
    expect(r.platforms[0]).toEqual({ x: 0, y: 640, w: 1280, h: 80 });
    const ceiling = r.platforms[1];
    for (const l of r.lasers) { expect(l.y).toBeLessThanOrEqual(ceiling.y + ceiling.h); expect(l.y + l.h).toBeGreaterThanOrEqual(640); }
    expect(r.patience).toBe(7.0);
  });
  it('hidden traps sit on platforms and start hidden; every room has a mercy hint', () => {
    for (const room of rooms) {
      expect(room.hint.length).toBeGreaterThan(10);
      for (const h of room.hidden) expect(room.platforms.some((p: Rect) => Math.abs(p.y - (h.y + h.h)) < 1 && p.x <= h.x && p.x + p.w >= h.x + h.w)).toBe(true);
    }
    expect(R.MERCY_DEATHS).toBe(4);
    expect(H).toBeGreaterThan(130);
  });
});

describe('room mechanics', () => {
  it('Room 1 movers reflect at their bounds; the shy one reverses once when approached', () => {
    let m = R.moverStart(LEVEL7_DATA.rooms[0].movers[0]);
    for (let i = 0; i < 200; i++) m = R.stepMover(m, 1 / 60, -9999);
    expect(m.x).toBeGreaterThanOrEqual(600); expect(m.x).toBeLessThanOrEqual(740);
    let s = R.moverStart(LEVEL7_DATA.rooms[0].movers[1]);
    s = { ...s, x: 950, vx: -70 };                                                   // moving toward the player
    s = R.stepMover(s, 1 / 60, 870);
    expect(s.vx).toBeGreaterThan(0); expect(s.shyUsed).toBe(true);
    const before = s.vx; s = R.stepMover({ ...s, vx: -70 }, 1 / 60, 870);
    expect(s.vx).toBe(-70); expect(before).toBe(70);                                  // only once per approach
    s = R.stepMover(s, 1 / 60, 200); expect(s.shyUsed).toBe(false);                   // re-arms when the player leaves
  });
  it('Room 3 controls: normal 3 s, mirrored 3 s, alternating; warning in the last 0.5 s', () => {
    const c = new ControlGlitch(3);
    c.update(2.4); expect([c.mirrored, c.warning]).toEqual([false, false]);
    c.update(0.2); expect(c.warning).toBe(true); expect(c.timeToShift).toBeCloseTo(0.4, 6);
    c.update(0.5); expect(c.mirrored).toBe(true);
    c.update(3); expect(c.mirrored).toBe(false);
    c.reset(); expect([c.t, c.mirrored]).toEqual([0, false]);
  });
  it('Room 4: lasers switch off at exactly 7.0 s (one transition), stay off, and reset on death', () => {
    const p = new PatienceTimer(7.0); let flips = 0;
    for (let i = 0; i < 419; i++) flips += +p.update(1 / 60);
    expect(p.lasersOn).toBe(true); expect(p.t).toBeCloseTo(6.983, 2);
    flips += +p.update(1 / 60); expect(p.lasersOn).toBe(false); expect(p.t).toBe(7);
    for (let i = 0; i < 100; i++) flips += +p.update(1 / 60);
    expect(flips).toBe(1); expect(p.lasersOn).toBe(false);
    p.reset(); expect([p.lasersOn, p.t]).toEqual([true, 0]);
  });
  it('Fever = min(100, deaths × 6); vignette alpha = 0.55 · F / 100', () => {
    expect([0, 3, 16, 17, 40].map(R.feverOf)).toEqual([0, 18, 96, 100, 100]);
    expect(R.vignetteAlpha(100)).toBeCloseTo(0.55, 9); expect(R.vignetteAlpha(50)).toBeCloseTo(0.275, 9);
  });
  it('coyote time 0.08 s and jump buffer 0.1 s', () => {
    const j = new JumpAssist();
    j.update(1 / 60, true); j.update(0.07, false); j.press(); expect(j.consume()).toBe(true);
    const k = new JumpAssist(); k.update(1 / 60, true); k.update(0.09, false); k.press(); expect(k.consume()).toBe(false);
    const b = new JumpAssist(); b.update(1 / 60, false); b.press(); b.update(0.09, true); expect(b.consume()).toBe(true);
    const c = new JumpAssist(); c.update(1 / 60, false); c.press(); c.update(0.12, true); expect(c.consume()).toBe(false);
  });
});

describe('palette, ending and integration', () => {
  it('every colour in the source is a red-family shade', () => {
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|ts|tsx|css)$/.test(f) && !f.endsWith('.test.ts')) files.push(p); });
    walk(join(__dirname, '..')); files.push(join(__dirname, '..', '..', 'tailwind.config.js'), join(__dirname, '..', '..', 'index.html'));
    const red = (r: number, g: number, b: number) => {
      if (Math.max(r, g, b) <= 30) return r >= g && r >= b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (r !== mx || d === 0) return false;
      let h = 60 * (((g - b) / d) % 6); if (h < 0) h += 360;
      return (h >= 330 || h <= 10) && d / mx > 0.1;
    };
    const bad: string[] = [];
    for (const f of files) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(/(?:#|0x)([0-9A-Fa-f]{6})\b/g)) { const n = parseInt(m[1], 16); if (!red(n >> 16, (n >> 8) & 255, n & 255)) bad.push(`${f}: ${m[0]}`); }
      for (const m of s.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) if (!red(+m[1], +m[2], +m[3])) bad.push(`${f}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
    expect(R.COLORS).toMatchObject({ platform: 0x5a0f1c, edge: 0xff3b4e, hazard: 0xff1744, glass: 0x2a0a10, body: 0xff3b4e, coat: 0x8f1830, flash: 0xffc2cc });
    expect(R.TEXT).toBe('#FFE1E1');
  });
  it('ending: freeze → 0.5 s → flash → completeLevel("red") once → cards in order', () => {
    expect(R.ENDING_CARDS).toEqual(["There's nothing wrong with you.", 'The world just needed someone to turn the colors back on.', 'THE END']);
    const scene = src('scenes/Level7RagePlatformer.js'), end = scene.slice(scene.indexOf('beginEnding() {'));
    const order = ['this.ending = true', 'this.physics.world.pause()', 'delayedCall(500', 'this.flash(COLORS.flash', "this.completeLevel('red')", 'this.showEndingCards(ENDING_CARDS)'].map((s) => end.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true); expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(src('LevelBase.js')).toMatch(/if \(this\._completed\) return false;\s+this\._completed = true;/);
    expect(scene).toMatch(/if \(this\.ending \|\| this\.paused\) return;/);
  });
  it('lasers stop killing in the same update they switch off; deaths are counted once', () => {
    const scene = src('scenes/Level7RagePlatformer.js');
    expect(scene.indexOf('this.patience.update(dt)')).toBeLessThan(scene.indexOf('room.lasers && this.patience.lasersOn'));
    expect(scene).toMatch(/if \(this\.dying > 0 \|\| this\.ending \|\| this\.transitioning\) return;/);
  });
});
