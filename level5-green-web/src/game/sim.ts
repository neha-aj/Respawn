/* GREEN simulation — Player, Phantom, Rune, Flashlight and the game state machine. Mirrors green.py. */
import {
  AMBIENT_R, C, CELL, DOOR_PHASE, HEAR_RANGE, JUMPSCARE_FRAMES, LIGHT_HALF, LIGHT_RANGE, LIVES, PH_HUNT, PH_SEARCH, PH_WANDER, PHANTOM_R,
  PLAYER_R, RING_COOLDOWN, RING_LIFE, RITUAL_TIME, RUNE_NAMES, RUNE_R, SEARCH_TIME, SENSE_RANGE, SPAWN_PROTECT, SPRINT, TIME_LIMIT, WALK, type RGB,
} from './config';
import { ForestMaze, sameCell, V, type Cell } from './maze';

export type State = 'TITLE' | 'RULES' | 'PLAYING' | 'PAUSED' | 'JUMPSCARE' | 'GAME_OVER' | 'VICTORY';
export type Sound = 'step' | 'ring' | 'rune' | 'seal' | 'energy' | 'door' | 'warp' | 'scare' | 'heart' | 'whisper' | 'click' | 'over';
export type Mood = 'calm' | 'wary' | 'strain' | 'fear' | 'smug' | 'resolve' | 'triumph';
export interface Controls { up: boolean; down: boolean; left: boolean; right: boolean; sprint: boolean }

export class Rng {
  constructor(private s: number) {}
  next() { this.s = (this.s + 0x6d2b79f5) | 0; let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  uni(a: number, b: number) { return a + (b - a) * this.next(); }
  pick<T>(xs: readonly T[]) { return xs[Math.floor(this.next() * xs.length)]; }
}

export class Player {
  pos: V; vel = new V(); moving = false; sprinting = false; walkT = 0;
  constructor(p: V, public aim = -Math.PI / 2) { this.pos = p.copy(); }

  update(dt: number, maze: ForestMaze, c: Controls) {
    let dx = +c.right - +c.left, dy = +c.down - +c.up;
    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) { const L = Math.hypot(dx, dy); dx /= L; dy /= L; }        // diagonals are never faster
    this.sprinting = this.moving && c.sprint;
    const sp = this.sprinting ? SPRINT : WALK;
    this.vel = new V(dx * sp, dy * sp);
    const mx = this.vel.x * dt, my = this.vel.y * dt, n = Math.floor(Math.hypot(mx, my) / 4) + 1;   // ≤ 4 px per sub-step
    for (let i = 0; i < n; i++) { this.pos.x += mx / n; this.resolve(maze); this.pos.y += my / n; this.resolve(maze); }
    if (this.moving) this.walkT += dt * (this.sprinting ? 1.6 : 1);
  }

  /** Circle-versus-cell push-out against every solid neighbour, repeated until clear. */
  resolve(maze: ForestMaze) {
    for (let it = 0; it < 4; it++) {
      let hit = false;
      const [cx, cy] = ForestMaze.cellOf(this.pos);
      for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
        if (!maze.solid([gx, gy])) continue;
        const rx = gx * CELL, ry = gy * CELL;
        const qx = Math.min(Math.max(this.pos.x, rx), rx + CELL), qy = Math.min(Math.max(this.pos.y, ry), ry + CELL);
        const ddx = this.pos.x - qx, ddy = this.pos.y - qy, L = Math.hypot(ddx, ddy);
        if (L >= PLAYER_R) continue;
        hit = true;
        if (L > 1e-6) { this.pos.x += (ddx * (PLAYER_R - L)) / L; this.pos.y += (ddy * (PLAYER_R - L)) / L; }
        else {
          const opts: [number, number, number][] = [[this.pos.x - rx, -1, 0], [rx + CELL - this.pos.x, 1, 0], [this.pos.y - ry, 0, -1], [ry + CELL - this.pos.y, 0, 1]];
          const [pen, nx, ny] = opts.reduce((a, b) => (b[0] < a[0] ? b : a));
          this.pos.x += nx * (pen + PLAYER_R); this.pos.y += ny * (pen + PLAYER_R);
        }
      }
      if (!hit) break;
    }
    this.pos.x = Math.min(Math.max(this.pos.x, PLAYER_R), maze.worldW - PLAYER_R);
    this.pos.y = Math.min(Math.max(this.pos.y, PLAYER_R), maze.worldH - PLAYER_R);
  }
}

export type PhState = 'WANDER' | 'INVESTIGATE' | 'SEARCH';
/** WANDER (random reachable goals) · INVESTIGATE (BFS to the last heard sound) · SEARCH (sweep, then back to WANDER). */
export class Phantom {
  enabled = true;
  pos!: V; state: PhState = 'WANDER'; path: Cell[] = []; target: Cell | null = null;
  searchT = 0; searchC: Cell | null = null; pause = 0; face = new V(0, 1); anim = 0; stuckT = 0; last = new V();
  constructor(private maze: ForestMaze, public rng: Rng) { this.reset(); }

  reset() {
    this.pos = ForestMaze.center(this.maze.phantomHome);
    this.state = 'WANDER'; this.path = []; this.target = null;
    this.searchT = 0; this.searchC = null; this.pause = 0.6;
    this.face = new V(0, 1); this.anim = 0; this.stuckT = 0; this.last = this.pos.copy();
  }
  get cell() { return ForestMaze.cellOf(this.pos); }

  /** A detection event: go where the sound was made (never where the player is now). */
  hear(origin: V) {
    const goal = this.maze.nearest(ForestMaze.cellOf(origin), this.maze.phantomOk);
    if (!goal) return;
    const p = this.maze.path(this.cell, goal, this.maze.phantomOk);
    if (p === null) return;
    this.state = 'INVESTIGATE'; this.target = goal; this.path = p; this.pause = 0;
    if (!p.length) this.arrive();
  }

  private choose() {
    const cur = this.cell;
    let opts: Cell[];
    if (this.state === 'SEARCH') opts = this.maze.bfs(this.searchC!, this.maze.phantomOk, 3).cells.filter((c) => !sameCell(c, cur));
    else {
      this.state = 'WANDER';
      const { dist, cells } = this.maze.bfs(cur, this.maze.phantomOk);
      opts = cells.filter((c) => { const d = dist.get(c[0] * 100 + c[1])!; return d >= 5 && d <= 16; });
      if (!opts.length) opts = cells.filter((c) => !sameCell(c, cur));
    }
    if (!opts.length) { this.state = 'WANDER'; this.pause = 0.5; return; }
    const goal = this.rng.pick(opts);
    const p = this.maze.path(cur, goal, this.maze.phantomOk);
    if (!p || !p.length) { this.pause = 0.3; return; }               // invalid route: pick again shortly
    this.target = goal; this.path = p;
  }
  private arrive() {
    if (this.state === 'INVESTIGATE') { this.state = 'SEARCH'; this.searchT = SEARCH_TIME; this.searchC = this.cell; this.pause = 0.5; }
    else if (this.state === 'WANDER') this.pause = this.rng.uni(0.3, 1.1);
  }

  update(dt: number) {
    this.anim += dt;
    if (!this.enabled) return;
    if (this.state === 'SEARCH') { this.searchT -= dt; if (this.searchT <= 0) { this.state = 'WANDER'; this.path = []; this.pause = 0.4; } }
    if (this.pause > 0) { this.pause -= dt; return; }
    if (!this.path.length) {
      if (this.state === 'INVESTIGATE') { this.arrive(); return; }
      this.choose();
      if (!this.path.length) return;
    }
    const speed = this.state === 'WANDER' ? PH_WANDER : this.state === 'SEARCH' ? PH_SEARCH : PH_HUNT;
    const goal = ForestMaze.center(this.path[0]), d = goal.sub(this.pos), L = d.len(), step = speed * dt;
    if (L <= step) { this.pos = goal; this.path.shift(); if (!this.path.length) this.arrive(); }   // snap: never normalise a zero vector
    else { this.face = d.mul(1 / L); this.pos = this.pos.add(this.face.mul(step)); }
    this.stuckT = this.pos.sub(this.last).len() < 0.5 ? this.stuckT + dt : 0;
    this.last = this.pos.copy();
    if (this.stuckT > 1.5) { this.path = []; this.stuckT = 0; this.state = 'WANDER'; }       // recover: replan
  }
}

export class Rune { pos: V; vis = 0; constructor(public idx: number, public cell: Cell) { this.pos = ForestMaze.center(cell); } }

/** Mouse-aimed cone + small ambient halo, both occluded by the grid. One visibility rule for art and logic. */
export class Flashlight {
  static RAYS = 72; static AMB_RAYS = 48;
  cone: V[] = []; amb: V[] = []; flicker = 1;
  illuminates(maze: ForestMaze, o: V, aim: number, p: V) {
    const d = p.sub(o), L = d.len();
    if (L > LIGHT_RANGE) return false;
    if (L > 1e-6) { const diff = ((Math.atan2(d.y, d.x) - aim + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; if (Math.abs(diff) > LIGHT_HALF) return false; }
    return maze.los(o, p);
  }
  near(maze: ForestMaze, o: V, p: V) { return p.sub(o).len() <= AMBIENT_R + 18 && maze.los(o, p); }
  compute(maze: ForestMaze, o: V, aim: number, seen: Set<number>) {
    this.cone = [o.copy()];
    for (let i = 0; i <= Flashlight.RAYS; i++) {
      const a = aim - LIGHT_HALF + (2 * LIGHT_HALF * i) / Flashlight.RAYS;
      let d = maze.cast(o, a, LIGHT_RANGE, seen); d = Math.min(LIGHT_RANGE, d + (d < LIGHT_RANGE ? 12 : 0));   // light licks the wall face
      this.cone.push(o.add(V.ang(a, d)));
    }
    this.amb = [];
    for (let i = 0; i < Flashlight.AMB_RAYS; i++) {
      const a = (2 * Math.PI * i) / Flashlight.AMB_RAYS, d = maze.cast(o, a, AMBIENT_R, seen);
      this.amb.push(o.add(V.ang(a, Math.min(AMBIENT_R, d + 10))));
    }
  }
}

export interface Particle { pos: V; vel: V; age: number; life: number; col: RGB }
export interface Ring { pos: V; age: number }
export const CTRL0: Controls = { up: false, down: false, left: false, right: false, sprint: false };

export class GreenGame {
  state: State = 'TITLE'; t = 0;
  ctrl: Controls = { ...CTRL0 };
  maze!: ForestMaze; player!: Player; phantom!: Phantom; runes!: Rune[]; collected!: Set<number>; light!: Flashlight;
  lives = LIVES; timeLeft = TIME_LIMIT;
  rings: Ring[] = []; ringCd = 0; noise = 0; senseCd = 0; particles: Particle[] = [];
  doorUnlocked = false; ritualT: number | null = null; throughDoor = false;
  jsFrames = 0; shake = 0; protect = 0; victoryT = 0; cause = '';
  msg = ''; msgT = 0; moodHold: Mood = 'calm'; moodT = 0;
  heartCd = 0; stepCd = 0; sealShown = false; danger = 0;
  explored = new Set<number>(); newlyExplored: number[] = []; resetCount = 0;
  constructor(private sfx: (s: Sound, vol?: number) => void = () => {}) { this.reset(); }

  /** Full restart: every per-run object is recreated, nothing survives from the previous attempt. */
  reset() {
    this.maze = new ForestMaze();
    this.player = new Player(ForestMaze.center(this.maze.spawn));
    this.phantom = new Phantom(this.maze, new Rng(2024));
    this.runes = this.maze.runes.map((c, i) => new Rune(i, c));
    this.collected = new Set();                                     // the single authoritative rune record
    this.light = new Flashlight();
    this.lives = LIVES; this.timeLeft = TIME_LIMIT;
    this.rings = []; this.ringCd = 0; this.noise = 0; this.senseCd = 0; this.particles = [];
    this.doorUnlocked = false; this.ritualT = null; this.throughDoor = false;
    this.jsFrames = 0; this.shake = 0; this.protect = 0; this.victoryT = 0; this.cause = '';
    this.msg = ''; this.msgT = 0; this.moodHold = 'calm'; this.moodT = 0;
    this.heartCd = 0; this.stepCd = 0; this.sealShown = false; this.danger = 0;
    this.explored = new Set(); this.newlyExplored = []; this.resetCount++;
  }
  begin() { this.reset(); this.state = 'PLAYING'; this.say('FIND THE THREE RUNES · STAY QUIET'); }
  restart() { this.reset(); this.state = 'TITLE'; }

  say(m: string, secs = 2.6) { this.msg = m; this.msgT = secs; }
  hold(m: Mood, secs = 1.5) { this.moodHold = m; this.moodT = secs; }
  mood(): Mood {
    if (this.state === 'VICTORY') return 'triumph';
    if (this.state === 'JUMPSCARE' || this.state === 'GAME_OVER') return 'fear';
    if (this.moodT > 0) return this.moodHold;
    if (this.danger > 0.25) return 'wary';
    if (this.player.sprinting) return 'strain';
    return this.doorUnlocked ? 'resolve' : 'calm';
  }
  objective() {
    if (this.maze.doorOpen) return 'ENTER THE TREE PORTAL';
    if (this.ritualT !== null) return 'THE TREE AWAKENS...';
    if (this.doorUnlocked) return 'RETURN TO THE ANCIENT TREE';
    return 'FIND 3 RUNES TO AWAKEN THE TREE';
  }
  burst(pos: V, n: number, speed: number, cols: readonly RGB[], life: [number, number] = [0.4, 1.0]) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.2 + Math.random() * 0.8) * speed;
      this.particles.push({ pos: pos.copy(), vel: V.ang(a, v), age: 0, life: life[0] + Math.random() * (life[1] - life[0]), col: cols[i % cols.length] });
    }
  }
  runeOrbit(i: number) { const a = this.t * 0.8 + (2 * Math.PI * i) / 3; return this.maze.treeCenter.add(new V(Math.cos(a) * 128, Math.sin(a) * 118)); }

  /** Fixed 60 Hz step. Only PLAYING simulates the world; JUMPSCARE counts down its 60 frames here. */
  step(dt: number) {
    this.t += dt;
    for (const p of this.particles) { p.pos = p.pos.add(p.vel.mul(dt)); p.vel = p.vel.mul(0.95); p.age += dt; }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < RING_LIFE);
    this.shake *= 0.86;
    if (this.state === 'VICTORY') { this.victoryT += dt; return; }
    if (this.state === 'JUMPSCARE') {
      this.shake = 34 * (1 - (JUMPSCARE_FRAMES - this.jsFrames) / JUMPSCARE_FRAMES) + 8;
      this.jsFrames--;
      if (this.jsFrames <= 0) this.endJumpscare();
      return;
    }
    if (this.state !== 'PLAYING') return;
    this.msgT -= dt; this.moodT -= dt; this.protect = Math.max(0, this.protect - dt);
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.cause = 'TIME RAN OUT — THE FOREST CLOSED IN'; this.state = 'GAME_OVER'; this.sfx('over'); return; }
    const pl = this.player, ph = this.phantom, mz = this.maze;
    pl.update(dt, mz, this.ctrl);
    this.stepCd -= dt;
    if (pl.moving && this.stepCd <= 0) { this.stepCd = pl.sprinting ? 0.26 : 0.42; this.sfx('step', pl.sprinting ? 0.55 : 0.16); }
    this.ringCd = Math.max(0, this.ringCd - dt); this.noise = Math.max(0, this.noise - dt * 0.9);
    if (pl.sprinting && this.ringCd <= 0) {
      this.rings.push({ pos: pl.pos.copy(), age: 0 }); this.ringCd = RING_COOLDOWN; this.noise = 1;
      this.sfx('ring', 0.35);
      if (ph.enabled && ph.pos.sub(pl.pos).len() <= HEAR_RANGE) {
        const was = ph.state; ph.hear(pl.pos);
        if (was !== 'INVESTIGATE' && ph.state === 'INVESTIGATE') this.sfx('whisper', 0.5);
      }
    }
    this.senseCd -= dt;                                            // close-range sense, line of sight only
    let dPh = ph.pos.sub(pl.pos).len();
    if (ph.enabled && this.protect <= 0 && dPh < SENSE_RANGE && this.senseCd <= 0 && mz.los(ph.pos, pl.pos)) { ph.hear(pl.pos); this.senseCd = 0.8; }
    ph.update(dt);
    dPh = ph.pos.sub(pl.pos).len();
    this.danger = ph.enabled ? Math.max(0, 1 - dPh / 260) : 0;
    this.heartCd -= dt;
    if (this.danger > 0 && this.heartCd <= 0) { this.sfx('heart', 0.3 + 0.6 * this.danger); this.heartCd = 1.25 - 0.8 * this.danger; }
    let f = 1;
    if (this.danger > 0.2 && Math.random() < 0.18 * this.danger) f = 0.35 + Math.random() * 0.45;
    else if (Math.random() < 0.004) f = 0.6 + Math.random() * 0.3;
    this.light.flicker = f;
    for (const r of this.runes) {
      if (!this.collected.has(r.idx) && r.pos.sub(pl.pos).len() < PLAYER_R + RUNE_R) {
        this.collected.add(r.idx);
        this.burst(r.pos, 46, 160, [C.GLOW, C.PALE, C.LIGHT]); this.sfx('rune'); this.hold('smug');
        this.say(`${RUNE_NAMES[r.idx]} TAKEN · RUNES ${this.collected.size}/3`);
        if (this.collected.size === 3) { this.doorUnlocked = true; this.say('ALL RUNES FOUND · RETURN TO THE ANCIENT TREE', 3.5); this.hold('resolve', 2.5); }
      }
    }
    const near = pl.pos.sub(ForestMaze.center(mz.doorFront)).len();
    if (!this.doorUnlocked) {
      if (near < 70) { if (!this.sealShown) { this.sfx('seal'); this.sealShown = true; } this.say('THE SEAL REMAINS CLOSED', 0.3); }
      else if (near > 110) this.sealShown = false;
    } else if (this.ritualT === null && near < 150) { this.ritualT = 0; this.sfx('energy'); this.say('THE TREE AWAKENS', 2); }
    if (this.ritualT !== null && !mz.doorOpen) {
      const prev = this.ritualT; this.ritualT += dt;
      if (prev < DOOR_PHASE && this.ritualT >= DOOR_PHASE) { this.sfx('door'); this.shake = Math.max(this.shake, 6); }
      if (this.ritualT >= RITUAL_TIME) {
        mz.doorOpen = true;                                         // collision geometry changes only here
        this.burst(ForestMaze.center(mz.portal), 60, 120, [C.PORTAL, C.GLOW, C.PALE]); this.say('THE DOOR STANDS OPEN', 3);
      }
    }
    if (this.ritualT !== null && Math.random() < 0.5)
      for (let i = 0; i < 3; i++) { const src = this.runeOrbit(i); this.particles.push({ pos: src, vel: mz.treeCenter.sub(src).mul(1.4), age: 0, life: 0.7, col: [C.GLOW, C.LIGHT, C.PALE][i] }); }
    if (mz.doorOpen) {                                              // victory only by walking through the open door into the hollow
      if (sameCell(ForestMaze.cellOf(pl.pos), mz.door)) this.throughDoor = true;
      if (this.throughDoor && this.collected.size === 3 && pl.pos.sub(ForestMaze.center(mz.portal)).len() < 20) {
        this.state = 'VICTORY'; this.victoryT = 0; this.sfx('warp'); this.burst(pl.pos, 90, 200, [C.PORTAL, C.GLOW, C.PALE, C.LIGHT]); return;
      }
    }
    if (ph.enabled && this.protect <= 0 && dPh < PLAYER_R + PHANTOM_R) this.caught();   // one centralised catch handler
  }

  caught() {
    if (this.state !== 'PLAYING') return;
    this.lives--; this.cause = 'THE PHANTOM CAUGHT YOU';
    this.state = 'JUMPSCARE'; this.jsFrames = JUMPSCARE_FRAMES; this.shake = 30;
    this.sfx('scare');
  }
  endJumpscare() {
    if (this.lives <= 0) { this.state = 'GAME_OVER'; this.sfx('over'); return; }
    this.player = new Player(ForestMaze.center(this.maze.spawn), this.player.aim);   // runes stay collected
    this.phantom.reset();
    this.rings = []; this.ringCd = 0; this.noise = 0; this.senseCd = 0; this.throughDoor = false;
    this.protect = SPAWN_PROTECT; this.shake = 0;
    this.state = 'PLAYING'; this.hold('fear', 1.6);
    this.say(`THANOS WAKES AT THE FOREST EDGE · ${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`, 3);
  }

  /** Recompute the light (called by the renderer each frame) and record newly seen cells for the fog-of-war memory. */
  updateLight(origin: V, aim: number) {
    const seen = new Set<number>();
    this.light.compute(this.maze, origin, aim, seen);
    for (const k of seen) if (!this.explored.has(k)) { this.explored.add(k); this.newlyExplored.push(k); }
  }
  phantomVisible(origin: V, aim: number) {
    const p = this.phantom.pos, pts = [p, ...[0, 1, 2, 3].map((i) => p.add(V.ang((i * Math.PI) / 2, 11)))];
    return this.phantom.enabled && pts.some((q) => this.light.illuminates(this.maze, origin, aim, q));
  }
}
