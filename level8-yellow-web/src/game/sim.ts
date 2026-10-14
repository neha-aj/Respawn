/* YELLOW simulation — fighters, Wolverine's AI, combat, Solar Flash, the barrier/Phase Door sequence and game states.
 * A fixed 60 Hz frame-counted simulation, mirroring yellow.py. */
import {
  ACCEL, ARENA_L, ARENA_R, ARENA_R_OPEN, BARRIER_T, BRACE_FRAMES, C, CHARGE_RATE, CRACK_T, DEFEAT_T, DODGE_COOLDOWN, DODGE_FRAMES, DODGE_IFRAMES,
  DODGE_LOCK, DODGE_SPEED, ENEMY_ATTACK_GAP, ENEMY_HP, ENEMY_INVULN, ENEMY_MOVES, ENEMY_POSES, ENEMY_WALK, FLASH_DMG, FLASH_STUN, FRICTION, GRAVITY,
  GROUND, JUMP_V, MAX_PARTICLES, PLAYER_HP, PLAYER_INVULN, PLAYER_MOVES, PLAYER_POSES, PORTAL_HALF, PORTAL_X, REVEAL_T, ROUND_TIME, WALK, WAVE_RANGE,
  WAVE_SPEED, type Move, type Pose, type RGB,
} from './config';

export type State = 'TITLE' | 'RULES' | 'CONTROLS' | 'INTRO' | 'FIGHT' | 'PAUSED' | 'DEFEAT' | 'BARRIER' | 'DOOR_REVEAL' | 'PORTAL' | 'VICTORY' | 'GAME_OVER';
export type Sound = 'jab' | 'sword' | 'hit' | 'heavyhit' | 'dodge' | 'jump' | 'brace' | 'flash' | 'stun' | 'growl' | 'ko' | 'crack' | 'shatter' | 'slide' | 'portal' | 'win' | 'lose' | 'fight' | 'click';
export interface Rect { x: number; y: number; w: number; h: number }
export const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export interface Input { left: boolean; right: boolean; charge: boolean; jump: boolean; light: boolean; heavy: boolean; dodge: boolean; flash: boolean }

export class Rng {
  constructor(private s: number) {}
  seed(n: number) { this.s = n; }
  next() { this.s = (this.s + 0x6d2b79f5) | 0; let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  uni(a: number, b: number) { return a + (b - a) * this.next(); }
}
export const lerpPose = (cur: Pose, tgt: Pose, k: number) => { for (const key of Object.keys(cur) as (keyof Pose)[]) cur[key] += (tgt[key] - cur[key]) * k; };

interface Hooks { sfx(n: Sound, v?: number): void; onSwing(f: Fighter): void; onBrace(): void; launchWave(p: Player): void }

/** Shared side-view body: physics, facing, hurtbox, hit-stun, invulnerability and the attack state machine. */
export class Fighter {
  HW = 22; HT = 116; moves: Record<string, Move> = PLAYER_MOVES; poses: Record<string, Pose> = PLAYER_POSES;
  x = 0; y = GROUND; vx = 0; vy = 0; facing = 1; onGround = true;
  hp = 0; shownHp = 0; trailHp = 0; maxHp = 0;
  state = 'idle'; move: 'light' | 'heavy' | null = null; mt = 0; hitDone = false;
  hitstun = 0; invuln = 0; stun = 0; walkPhase = 0; cur!: Pose; flashT = 0;
  constructor(private sx: number, private sf: number, private shp: number) {}
  reset() {
    this.x = this.sx; this.y = GROUND; this.vx = 0; this.vy = 0; this.facing = this.sf; this.onGround = true;
    this.hp = this.shownHp = this.trailHp = this.maxHp = this.shp;
    this.state = 'idle'; this.move = null; this.mt = 0; this.hitDone = false;
    this.hitstun = this.invuln = this.stun = 0; this.walkPhase = 0; this.cur = { ...this.poses.idle }; this.flashT = 0;
  }
  hurtbox(): Rect { return { x: Math.floor(this.x - this.HW), y: Math.floor(this.y - this.HT), w: this.HW * 2, h: this.HT }; }
  centre(): [number, number] { return [this.x, this.y - this.HT / 2]; }
  attackPhase(): 'startup' | 'active' | 'recovery' | null {
    if (!this.move) return null;
    const m = this.moves[this.move];
    return this.mt < m.startup ? 'startup' : this.mt < m.startup + m.active ? 'active' : 'recovery';
  }
  /** Directional hitbox in front of the fighter, only during the active frames. */
  hitbox(): Rect | null {
    if (this.attackPhase() !== 'active') return null;
    const [x0, x1, y0, y1] = this.moves[this.move!].box;
    return this.facing > 0 ? { x: Math.floor(this.x + x0), y: Math.floor(this.y + y0), w: x1 - x0, h: y1 - y0 } : { x: Math.floor(this.x - x1), y: Math.floor(this.y + y0), w: x1 - x0, h: y1 - y0 };
  }
  beginAttack(name: 'light' | 'heavy') { this.move = name; this.mt = 0; this.hitDone = false; this.state = 'attack'; }
  actionable() { return ['idle', 'walk', 'jump'].includes(this.state) && this.hitstun <= 0 && this.stun <= 0; }
  takeHit(dmg: number, dir: number, kb: number, stunFrames: number, invuln: number, lethal = true) {
    this.hp = Math.max(lethal ? 0 : 1, this.hp - dmg); this.vx = dir * kb; this.invuln = invuln;
    if (this.stun > 0) return;                                   // a stunned fighter stays stunned (the 90 frames are not reset)
    this.hitstun = stunFrames; this.state = 'hurt'; this.move = null;
  }
  physics(lo: number, hi: number) {
    if (!this.onGround) this.vy += GRAVITY;
    this.x += this.vx; this.y += this.vy;
    if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; this.onGround = true; } else this.onGround = false;
    this.x = Math.min(Math.max(this.x, lo + this.HW), hi - this.HW);
  }
  tickTimers() {
    this.invuln = Math.max(0, this.invuln - 1);
    this.shownHp += (this.hp - this.shownHp) * 0.35;
    if (this.trailHp > this.shownHp) this.trailHp = Math.max(this.shownHp, this.trailHp - 0.6);
    this.flashT = Math.max(0, this.flashT - 1);
  }
  attackPose(): Pose { return this.poses[`${this.move}_${this.attackPhase() === 'startup' ? 'start' : 'hit'}`]; }
}

/** Thanos: Gauntlet jab, double-bladed sword, dodge, Solar charge and Solar Flash. */
export class Player extends Fighter {
  energy = 0; dodgeT = 0; dodgeCd = 0; dodgeDir = 1; braceT = 0; afterimages: { x: number; y: number; f: number; p: Pose; t: number }[] = [];
  constructor(x: number, f: number, hp: number) { super(x, f, hp); this.reset(); }
  reset() { super.reset(); this.energy = 0; this.dodgeT = 0; this.dodgeCd = 0; this.dodgeDir = 1; this.braceT = 0; this.afterimages = []; }
  get dodgeInvuln() { const k = DODGE_FRAMES - this.dodgeT; return this.state === 'dodge' && k >= DODGE_IFRAMES[0] && k <= DODGE_IFRAMES[1]; }
  invulnerable() { return this.invuln > 0 || this.dodgeInvuln; }

  update(inp: Input, other: Fighter, lo: number, hi: number, g: Hooks) {
    this.tickTimers(); this.dodgeCd = Math.max(0, this.dodgeCd - 1);
    if (this.hitstun > 0) { this.hitstun--; this.vx *= 0.82; if (this.hitstun === 0) this.state = 'idle'; }
    else if (this.state === 'dodge') {
      this.dodgeT--; this.vx = this.dodgeDir * DODGE_SPEED * (0.4 + (0.6 * this.dodgeT) / DODGE_FRAMES);
      if (this.dodgeT % 2 === 0) this.afterimages.push({ x: this.x, y: this.y, f: this.facing, p: { ...this.cur }, t: 14 });
      if (DODGE_FRAMES - this.dodgeT >= DODGE_LOCK + 2 && (inp.light || inp.heavy)) { this.state = 'idle'; this.vx *= 0.3; }   // late cancel
      else if (this.dodgeT <= 0) { this.state = 'idle'; this.vx *= 0.3; }
    } else if (this.state === 'brace') { this.braceT--; this.vx = 0; if (this.braceT <= 0) { this.state = 'idle'; g.launchWave(this); } }
    else if (this.state === 'attack') {
      this.mt++; const m = this.moves[this.move!];
      if (this.onGround) this.vx *= 0.7;
      if (this.mt === m.startup) g.onSwing(this);
      if (this.mt >= m.startup + m.active + m.recovery) { this.move = null; this.state = 'idle'; }
    } else if (this.state === 'charge') {
      this.vx = 0;
      if (!inp.charge || !this.onGround) this.state = 'idle'; else this.energy = Math.min(100, this.energy + CHARGE_RATE);
    }
    if (this.actionable()) {
      const want = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      if (inp.flash && this.energy >= 100 && this.onGround) { this.energy = 0; this.state = 'brace'; this.braceT = BRACE_FRAMES; g.onBrace(); }
      else if (inp.dodge && this.dodgeCd === 0) { this.state = 'dodge'; this.dodgeT = DODGE_FRAMES; this.dodgeCd = DODGE_COOLDOWN; this.dodgeDir = want || this.facing; g.sfx('dodge', 0.6); }
      else if (inp.light) this.beginAttack('light');
      else if (inp.heavy) this.beginAttack('heavy');
      else if (inp.charge && this.onGround) { this.state = 'charge'; this.vx = 0; }
      else {
        if (inp.jump && this.onGround) { this.vy = JUMP_V; this.onGround = false; g.sfx('jump', 0.4); }
        if (want) this.vx += Math.max(-ACCEL, Math.min(ACCEL, want * WALK - this.vx)); else this.vx *= FRICTION;
        this.state = !this.onGround ? 'jump' : Math.abs(this.vx) > 0.3 ? 'walk' : 'idle';
      }
    }
    if (['idle', 'walk', 'jump', 'charge'].includes(this.state) && this.hitstun <= 0) this.facing = other.x >= this.x ? 1 : -1;
    this.physics(lo, hi);
    this.walkPhase += Math.abs(this.vx) * 0.22;
    this.afterimages = this.afterimages.map((a) => ({ ...a, t: a.t - 1 })).filter((a) => a.t > 0);
  }

  animPose(t: number): Pose {
    if (this.state === 'attack') return this.attackPose();
    if (this.state === 'hurt' || this.hitstun > 0) return this.poses.hurt;
    if (['defeat', 'victory', 'dodge', 'charge', 'brace'].includes(this.state)) return this.poses[this.state];
    if (!this.onGround) return this.poses.jump;
    const ph = this.walkPhase, s = Math.sin(ph);
    if (this.state === 'walk') return { ...this.poses.idle, fh: 0.5 * s, bh: -0.5 * s, fk: 0.2 + 0.4 * Math.max(0, -s), bk: 0.2 + 0.4 * Math.max(0, s), fs: 0.5 - 0.35 * s, bs: 0.25 + 0.35 * s };
    return { ...this.poses.idle, dy: Math.sin(t * 0.07) * 0.8 };
  }
}

export type AiState = 'IDLE' | 'APPROACH' | 'RETREAT' | 'JUMP' | 'ATTACK';
/** Wolverine with adamantium claws. Finite-state AI: IDLE, APPROACH, RETREAT, JUMP, ATTACK_*, HURT, STUNNED, DEFEATED. */
export class Enemy extends Fighter {
  ai: AiState = 'IDLE'; aiT = 20; attackCd = 60; jumpCd = 120; rng = new Rng(7); dissolve = 0;
  constructor(x: number, f: number, hp: number) { super(x, f, hp); this.HW = 20; this.HT = 104; this.moves = ENEMY_MOVES; this.poses = ENEMY_POSES; this.reset(); }
  reset() { super.reset(); this.ai = 'IDLE'; this.aiT = 20; this.attackCd = 60; this.jumpCd = 120; this.rng = new Rng(7); this.dissolve = 0; }

  aiState() {
    if (this.state === 'defeat') return 'DEFEATED';
    if (this.stun > 0) return 'STUNNED';
    if (this.hitstun > 0) return 'HURT';
    if (this.state === 'attack') return { startup: 'ATTACK_WINDUP', active: 'ATTACK_ACTIVE', recovery: 'ATTACK_RECOVERY' }[this.attackPhase()!];
    return this.ai;
  }

  /** Pick the next behaviour (called every few frames, never every frame). */
  think(p: Player) {
    const dist = Math.abs(p.x - this.x), r = this.rng.next(), cornered = this.x < ARENA_L + 70 || this.x > ARENA_R - 70;
    const set = (a: AiState, t: number) => { this.ai = a; this.aiT = t; };
    if (p.state === 'charge') dist > 70 ? set('APPROACH', 10) : set('ATTACK', 1);              // punish a charging Thanos
    else if (p.state === 'brace' && dist < WAVE_RANGE) r < 0.35 && this.jumpCd === 0 ? set('JUMP', 6) : set('RETREAT', 24);
    else if (dist > 100) set('APPROACH', 14);
    else if (dist < 50 && r < 0.45) cornered && this.jumpCd === 0 ? set('JUMP', 6) : set('RETREAT', 18);
    else if (this.attackCd === 0 && r < 0.8) set('ATTACK', 1);
    else if (r < 0.12 && this.jumpCd === 0) set('JUMP', 6);
    else r < 0.45 ? set('RETREAT', 16) : set('IDLE', 14);
  }

  update(p: Player, lo: number, hi: number, g: Hooks) {
    this.tickTimers(); this.attackCd = Math.max(0, this.attackCd - 1); this.jumpCd = Math.max(0, this.jumpCd - 1);
    if (this.state === 'defeat') { this.vx *= 0.85; this.physics(lo, hi); return; }
    if (this.stun > 0) {
      this.stun--; this.vx *= 0.8; this.move = null; this.state = this.stun > 0 ? 'stun' : 'idle';
      if (this.stun === 0) { this.ai = 'RETREAT'; this.aiT = 20; }
      this.physics(lo, hi); return;
    }
    if (this.hitstun > 0) {
      this.hitstun--; this.vx *= 0.82;
      if (this.hitstun === 0) { this.state = 'idle'; this.ai = 'IDLE'; this.aiT = 6; }
      this.physics(lo, hi); return;
    }
    if (this.state === 'attack') {
      this.mt++; const m = this.moves[this.move!]; this.vx *= 0.7;
      if (this.mt === m.startup) g.onSwing(this);
      if (this.mt === 1 && this.move === 'heavy') g.sfx('growl', 0.5);
      if (this.mt >= m.startup + m.active + m.recovery) {
        this.move = null; this.state = 'idle'; this.attackCd = ENEMY_ATTACK_GAP;
        if (this.rng.next() < 0.4) { this.ai = 'RETREAT'; this.aiT = 18; } else { this.ai = 'IDLE'; this.aiT = 10; }
      }
      this.physics(lo, hi); return;
    }
    this.facing = p.x >= this.x ? 1 : -1;
    if (--this.aiT <= 0) this.think(p);
    const dist = Math.abs(p.x - this.x);
    if (this.ai === 'APPROACH') this.vx += Math.max(-0.3, Math.min(0.3, this.facing * ENEMY_WALK - this.vx));
    else if (this.ai === 'RETREAT') {
      const away = -this.facing;
      if ((away < 0 && this.x < ARENA_L + 50) || (away > 0 && this.x > ARENA_R - 50)) { this.ai = 'APPROACH'; this.aiT = 12; }   // never stuck on a wall
      this.vx += Math.max(-0.3, Math.min(0.3, away * ENEMY_WALK * 0.9 - this.vx));
    } else if (this.ai === 'JUMP') {
      if (this.onGround && this.jumpCd === 0) {
        this.vy = JUMP_V * 0.95; this.onGround = false; this.jumpCd = 150;
        this.vx = (this.x > ARENA_L + 90 && this.x < ARENA_R - 90 ? -this.facing : this.facing) * 3.0;
      }
      this.ai = 'IDLE';
    } else if (this.ai === 'ATTACK' && this.onGround) {
      if (this.attackCd === 0) {
        const heavy = this.rng.next() < (p.state === 'charge' ? 0.45 : 0.28), reach = ENEMY_MOVES[heavy ? 'heavy' : 'light'].box[1] - 6;
        if (dist <= reach + p.HW) this.beginAttack(heavy ? 'heavy' : 'light'); else { this.ai = 'APPROACH'; this.aiT = 8; }
      } else { this.ai = 'IDLE'; this.aiT = 6; }
    } else this.vx *= FRICTION;
    if (this.state !== 'attack') this.state = !this.onGround ? 'jump' : Math.abs(this.vx) > 0.25 ? 'walk' : 'idle';
    this.walkPhase += Math.abs(this.vx) * 0.25;
    this.physics(lo, hi);
  }

  animPose(): Pose {
    if (this.state === 'defeat') return this.poses.defeat;
    if (this.stun > 0) return { ...this.poses.stun, lean: this.poses.stun.lean + 0.12 * Math.sin(this.stun * 0.25) };
    if (this.hitstun > 0) return this.poses.hurt;
    if (this.state === 'attack') return this.attackPose();
    if (!this.onGround) return this.poses.jump;
    if (this.state === 'walk') { const s = Math.sin(this.walkPhase); return { ...this.poses.idle, fh: 0.3 + 0.45 * s, bh: -0.3 - 0.45 * s, fk: 0.4 + 0.3 * Math.max(0, -s), bk: 0.4 + 0.3 * Math.max(0, s) }; }
    return this.poses.idle;
  }
  /** 0..1 glow while winding up the heavy claw lunge. */
  telegraph() { return this.state === 'attack' && this.move === 'heavy' && this.attackPhase() === 'startup' ? Math.min(1, this.mt / ENEMY_MOVES.heavy.startup) : 0; }
}

export interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; col: RGB; size: number; grav: number }
export interface Slash { x: number; y: number; f: number; big: boolean; age: number; life: number }
export interface Impact { x: number; y: number; big: boolean; age: number; life: number }
export interface Frag { x: number; y: number; vx: number; vy: number; a: number; va: number; age: number; size: number }
export class Effects {
  p: Particle[] = []; slashes: Slash[] = []; flashes: Impact[] = []; frags: Frag[] = [];
  clear() { this.p = []; this.slashes = []; this.flashes = []; this.frags = []; }
  add(x: number, y: number, vx: number, vy: number, life: number, col: RGB, size = 1, grav = 0) { if (this.p.length < MAX_PARTICLES) this.p.push({ x, y, vx, vy, age: 0, life, col, size, grav }); }
  burst(x: number, y: number, n: number, speed: number, cols: readonly RGB[], life: [number, number] = [14, 30], grav = 0.12) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random() * 0.7) * speed; this.add(x, y, Math.cos(a) * v, Math.sin(a) * v, life[0] + Math.floor(Math.random() * (life[1] - life[0] + 1)), cols[i % cols.length], Math.random() < 0.67 ? 1 : 2, grav); }
  }
  slash(x: number, y: number, f: number, big: boolean) { this.slashes.push({ x, y, f, big, age: 0, life: big ? 12 : 8 }); }
  impact(x: number, y: number, big: boolean) { this.flashes.push({ x, y, big, age: 0, life: big ? 10 : 6 }); }
  update() {
    for (const q of this.p) { q.vy += q.grav; q.x += q.vx; q.y += q.vy; q.age++; }
    this.p = this.p.filter((q) => q.age < q.life);
    this.slashes.forEach((e) => e.age++); this.slashes = this.slashes.filter((e) => e.age < e.life);
    this.flashes.forEach((e) => e.age++); this.flashes = this.flashes.filter((e) => e.age < e.life);
    for (const f of this.frags) { f.x += f.vx; f.y += f.vy; f.vy += 0.25; f.a += f.va; f.age++; }
    this.frags = this.frags.filter((f) => f.age < 70);
  }
}

/** Solar Flash shockwave: radius grows each frame; it can hit once, when the ring reaches the target inside the range. */
export class Wave {
  r = 0; hit = false; done = false;
  constructor(public x: number, public y: number) {}
  update() { this.r += WAVE_SPEED; if (this.r > WAVE_RANGE + 30) this.done = true; }
  reaches(cx: number, cy: number) { const d = Math.hypot(cx - this.x, cy - this.y); return !this.hit && d <= WAVE_RANGE && this.r >= d; }
}

/** Barrier → cracks → shatter → two pillars slide apart → Phase Door. */
export class Door {
  static X0 = 396; static X1 = 446; static TOP = 40;
  crack = 0; shattered = false; slide = 0; open = false; portalT = 0; cracks: [number[], number[]][] = [];
  reset() { this.crack = 0; this.shattered = false; this.slide = 0; this.open = false; this.portalT = 0; this.cracks = []; }
  entrance(): Rect { return { x: PORTAL_X - PORTAL_HALF, y: GROUND - 60, w: PORTAL_HALF * 2, h: 60 }; }
  makeCracks() {
    const r = new Rng(4); this.cracks = [];
    for (let i = 0; i < 9; i++) {
      let p = [r.uni(Door.X0 + 6, Door.X1 - 6), r.uni(Door.TOP + 20, GROUND - 20)];
      for (let j = 0; j < 4; j++) { const q = [Math.min(Door.X1 - 2, Math.max(Door.X0 + 2, p[0] + r.uni(-12, 12))), Math.min(GROUND - 2, Math.max(Door.TOP + 2, p[1] + r.uni(-22, 22)))]; this.cracks.push([p, q]); p = q; }
    }
  }
}

export const CONTROLS_FROM: State[] = ['TITLE', 'RULES', 'INTRO', 'FIGHT', 'PAUSED'];
export const INPUT0: Input = { left: false, right: false, charge: false, jump: false, light: false, heavy: false, dodge: false, flash: false };
type Pressed = Pick<Input, 'jump' | 'light' | 'heavy' | 'dodge' | 'flash'>;

export class YellowGame implements Hooks {
  state: State = 'TITLE'; t = 0; ret: State = 'TITLE';
  player = new Player(100, 1, PLAYER_HP); enemy = new Enemy(320, -1, ENEMY_HP); fx = new Effects(); door = new Door();
  waves: Wave[] = []; hitstop = 0; shake = 0; phaseT = 0; roundT = ROUND_TIME; combo = 0; comboT = 0; score = 0; cause = ''; flash = 0;
  introT = 0; vicT = 0;
  held = { left: false, right: false, charge: false };
  pressed: Pressed = { jump: false, light: false, heavy: false, dodge: false, flash: false };
  motes = Array.from({ length: 36 }, () => [Math.random() * 450, Math.random() * 325, 0.1 + Math.random() * 0.25, Math.random() * 6]);
  constructor(public sfxFn: (s: Sound, v?: number) => void = () => {}, public music: (on: boolean) => void = () => {}, public chargeHum: (on: boolean) => void = () => {}) { this.reset(); }

  /** Restart the encounter: health, positions, facing, velocity, attacks, AI, energy, dodge, timers, effects, door, results. */
  reset() {
    this.player.reset(); this.enemy.reset(); this.fx.clear(); this.door.reset();
    this.waves = []; this.hitstop = 0; this.shake = 0; this.phaseT = 0; this.roundT = ROUND_TIME;
    this.combo = 0; this.comboT = 0; this.score = 0; this.cause = ''; this.flash = 0; this.introT = 0; this.vicT = 0;
    this.pressed = { jump: false, light: false, heavy: false, dodge: false, flash: false };
    this.chargeHum(false);
  }
  sfx(n: Sound, v = 1) { this.sfxFn(n, v); }
  onSwing(f: Fighter) {
    const heavy = f.move === 'heavy';
    this.sfx(heavy && f === this.player ? 'sword' : 'jab', heavy ? 0.6 : 0.4);
    const hb = f.hitbox(); if (hb) this.fx.slash(hb.x + hb.w / 2, hb.y + hb.h / 2, f.facing, heavy);
  }
  onBrace() { this.sfx('brace', 0.6); this.chargeHum(false); }
  launchWave(p: Player) {
    const [cx, cy] = p.centre(); this.waves.push(new Wave(cx, cy)); this.flash = 0.6; this.shake = Math.max(this.shake, 4); this.sfx('flash', 0.8);
    this.fx.burst(cx, cy, 30, 3.5, [C.FX, C.ENERGY, C.DOOR], [20, 40], 0);
  }

  // --------------------------------------------------- input (edge-triggered presses, held movement/charge)
  start() { this.reset(); this.state = 'INTRO'; this.music(true); }
  /** Controls card: freezes the round (like pause) and returns to wherever it was opened from. */
  openControls() {
    if (!CONTROLS_FROM.includes(this.state)) return;
    this.ret = this.state; this.state = 'CONTROLS';
    this.pressed = { jump: false, light: false, heavy: false, dodge: false, flash: false }; this.chargeHum(false);
  }
  closeControls() { this.state = this.ret; }
  keyDown(key: string) {
    const st = this.state, k = key.toLowerCase();
    if (k === 'c' && CONTROLS_FROM.includes(st)) { this.openControls(); return; }
    if (st === 'CONTROLS') { if (k === 'c' || k === 'escape' || k === 'enter') this.closeControls(); }
    else if (st === 'TITLE') { if (k === 'enter') { this.sfx('click'); this.start(); } else if (k === 'h') this.state = 'RULES'; }
    else if (st === 'RULES') { if (k === 'enter' || k === 'h' || k === 'escape') this.state = 'TITLE'; }
    else if (st === 'FIGHT') {
      if (k === 'escape') { this.state = 'PAUSED'; this.chargeHum(false); return; }
      const map: Record<string, keyof Pressed> = { w: 'jump', arrowup: 'jump', j: 'light', k: 'heavy', shift: 'dodge', i: 'flash' };
      if (k in map) this.pressed[map[k]] = true;
    } else if (st === 'PAUSED') { if (k === 'escape') this.state = 'FIGHT'; else if (k === 'r') this.start(); }
    else if (st === 'PORTAL') { if (k === 'w' || k === 'arrowup') this.pressed.jump = true; }
    else if ((st === 'GAME_OVER' || st === 'VICTORY') && k === 'r') { this.sfx('click'); this.start(); }
  }
  input(): Input { return { ...this.held, ...this.pressed }; }

  // --------------------------------------------------- update (fixed 60 Hz step)
  step() {
    this.t++;
    for (const m of this.motes) { m[1] -= m[2]; m[0] += Math.sin(this.t * 0.01 + m[3]) * 0.15; m[1] = ((m[1] % 325) + 325) % 325; }
    this.shake *= 0.85; this.flash = Math.max(0, this.flash - 0.03);
    const st = this.state, pl = this.player, en = this.enemy;
    if (st === 'TITLE' || st === 'RULES' || st === 'PAUSED' || st === 'CONTROLS') return;
    this.fx.update();
    if (st === 'INTRO') { this.introT++; if (this.introT === 150) this.sfx('fight', 0.7); if (this.introT >= 190) this.state = 'FIGHT'; return; }
    if (st === 'FIGHT') this.updateFight();
    else if (st === 'DEFEAT') {
      this.phaseT++; en.update(pl, ARENA_L, ARENA_R, this); lerpPose(en.cur, en.animPose(), 0.1); lerpPose(pl.cur, pl.animPose(this.t), 0.2);
      if (this.phaseT > 40) {
        en.dissolve = Math.min(1, (this.phaseT - 40) / 45);
        if (this.phaseT % 2 === 0) this.fx.add(en.x + (Math.random() * 28 - 14), en.y - Math.random() * 80, Math.random() * 0.6 - 0.3, -0.4 - Math.random() * 0.8, 40, [C.MONK, C.GOLD, C.AMBER][Math.floor(Math.random() * 3)], 1, 0);
      }
      if (this.phaseT >= DEFEAT_T) { this.state = 'BARRIER'; this.phaseT = 0; this.door.makeCracks(); }
    }
    if (st === 'BARRIER' || st === 'DOOR_REVEAL' || st === 'PORTAL' || st === 'VICTORY') en.tickTimers();      // health bar keeps easing to empty
    if (st === 'BARRIER') {
      this.phaseT++; const d = this.door; d.crack = Math.min(1, this.phaseT / CRACK_T);
      if (this.phaseT % 12 === 1 && this.phaseT < CRACK_T) this.sfx('crack', 0.5);
      if (this.phaseT === CRACK_T) {                              // shatter into fragments
        d.shattered = true; this.shake = 5; this.sfx('shatter', 0.7);
        const r = new Rng(8);
        for (let i = 0; i < 22; i++) this.fx.frags.push({ x: r.uni(Door.X0, Door.X1), y: r.uni(Door.TOP, GROUND), vx: r.uni(-2.5, 1), vy: r.uni(-3, 0), a: 0, va: r.uni(-0.2, 0.2), age: 0, size: 4 + Math.floor(r.next() * 6) });
        this.fx.burst(421, 150, 40, 3, [C.FX, C.CREAM, C.ENERGY], [20, 45], 0.15);
      }
      if (this.phaseT >= BARRIER_T) { this.state = 'DOOR_REVEAL'; this.phaseT = 0; this.sfx('slide', 0.7); }
    } else if (st === 'DOOR_REVEAL') {
      this.phaseT++; const k = Math.min(1, this.phaseT / 80); this.door.slide = k * k * (3 - 2 * k);
      if (this.phaseT === 70) this.sfx('portal', 0.6);
      if (this.phaseT >= REVEAL_T) { this.state = 'PORTAL'; this.phaseT = 0; this.door.open = true; }
    } else if (st === 'PORTAL') {
      this.door.portalT++;
      const inp = { ...this.input(), light: false, heavy: false, dodge: false, flash: false, charge: false };
      pl.update(inp, en, ARENA_L, ARENA_R_OPEN, this); pl.facing = inp.right || !inp.left ? 1 : -1;
      lerpPose(pl.cur, pl.animPose(this.t), 0.3);
      if (Math.random() < 0.5) { const a = Math.random() * Math.PI * 2, sx = PORTAL_X + Math.cos(a) * 40, sy = 150 + Math.sin(a) * 70; this.fx.add(sx, sy, (PORTAL_X - sx) * 0.05, (150 - sy) * 0.05, 20, [C.DOOR, C.FX, C.ENERGY][Math.floor(Math.random() * 3)], 1, 0); }
      if (overlap(pl.hurtbox(), this.door.entrance())) {          // physically walked into the portal
        this.state = 'VICTORY'; this.vicT = 0; pl.state = 'victory'; this.sfx('win', 0.8); this.music(false);
        this.fx.burst(PORTAL_X, 160, 50, 3.5, [C.DOOR, C.FX, C.ENERGY], [30, 60], 0);
      }
    } else if (st === 'VICTORY') { this.vicT++; lerpPose(pl.cur, pl.animPose(this.t), 0.2); }
    else if (st === 'GAME_OVER') { this.phaseT++; lerpPose(pl.cur, pl.animPose(this.t), 0.1); lerpPose(en.cur, en.animPose(), 0.2); }
    this.pressed = { jump: false, light: false, heavy: false, dodge: false, flash: false };
  }

  updateFight() {
    const pl = this.player, en = this.enemy;
    this.roundT--; this.comboT = Math.max(0, this.comboT - 1); if (this.comboT === 0) this.combo = 0;
    if (this.roundT <= 0) { this.roundT = 0; this.lose('TIME UP'); return; }
    if (this.hitstop > 0) {                                      // the stun keeps counting during hit-stop: exactly 90 frames
      this.hitstop--;
      if (en.stun > 0) { en.stun--; if (en.stun === 0) en.state = 'idle'; }
      return;
    }
    const inp = this.input(), wasCharging = pl.state === 'charge';
    pl.update(inp, en, ARENA_L, ARENA_R, this);
    en.update(pl, ARENA_L, ARENA_R, this);
    if (pl.state === 'charge' && !wasCharging) this.chargeHum(true);
    if (pl.state !== 'charge' && wasCharging) this.chargeHum(false);
    if (pl.state === 'charge' && this.t % 2 === 0) {               // particles converge while charging
      const a = Math.random() * Math.PI * 2, sx = pl.x + Math.cos(a) * 46, sy = pl.y - 30 + Math.sin(a) * 40;
      this.fx.add(sx, sy, (pl.x - sx) / 16, (pl.y - 30 - sy) / 16, 16, [C.ENERGY, C.FX, C.PLAYER][Math.floor(Math.random() * 3)], 1, 0);
    }
    this.separate(); this.resolveHits();
    for (const w of this.waves) {
      w.update();
      const [cx, cy] = en.centre();
      if (en.state !== 'defeat' && w.reaches(cx, cy)) {           // each wave hits at most once
        w.hit = true;
        en.takeHit(FLASH_DMG, en.x > w.x ? 1 : -1, 2, 0, ENEMY_INVULN, false);
        en.stun = FLASH_STUN; en.state = 'stun'; en.move = null; en.hitstun = 0;
        this.sfx('stun', 0.7); this.fx.impact(cx, cy, true); this.fx.burst(cx, cy, 16, 2.5, [C.FX, C.ENERGY], [14, 28], 0.05);
      }
      if (this.t % 2 === 0 && !w.done) for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2; this.fx.add(w.x + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r * 0.6, 0, 0, 10, Math.random() < 0.5 ? C.FX : C.ENERGY, 1, 0); }
    }
    this.waves = this.waves.filter((w) => !w.done);
    lerpPose(pl.cur, pl.animPose(this.t), 0.35); lerpPose(en.cur, en.animPose(), 0.3);
    if (en.hp <= 0 && en.state !== 'defeat') {
      en.state = 'defeat'; en.move = null; en.stun = 0; en.hitstun = 0; en.vx = en.facing * -2;
      this.state = 'DEFEAT'; this.phaseT = 0; pl.state = 'idle'; pl.move = null; this.chargeHum(false); this.sfx('ko', 0.8); this.shake = 4;
    } else if (pl.hp <= 0) this.lose('THANOS HAS FALLEN');
  }
  lose(cause: string) {
    this.state = 'GAME_OVER'; this.cause = cause; this.phaseT = 0; this.player.state = 'defeat'; this.player.move = null;
    this.chargeHum(false); this.music(false); this.sfx('lose', 0.8);
  }
  /** Fighters cannot overlap: push both apart horizontally by half the overlap. */
  separate() {
    const pl = this.player, en = this.enemy;
    if (en.state === 'defeat') return;
    const over = pl.HW + en.HW - Math.abs(pl.x - en.x);
    if (over > 0 && pl.y > en.y - en.HT + 10 && en.y > pl.y - pl.HT + 10) {
      const d = pl.x < en.x ? 1 : -1; pl.x -= (d * over) / 2; en.x += (d * over) / 2;
      for (const f of [pl, en]) f.x = Math.min(Math.max(f.x, ARENA_L + f.HW), ARENA_R - f.HW);
    }
  }
  /** Hitbox vs hurtbox. Each attack lands once; dodge and post-hit invulnerability are respected. */
  resolveHits() {
    const pl = this.player, en = this.enemy;
    for (const [atk, vic] of [[pl, en], [en, pl]] as [Fighter, Fighter][]) {
      const hb = atk.hitbox();
      if (!hb || atk.hitDone || vic.state === 'defeat' || !overlap(hb, vic.hurtbox())) continue;
      atk.hitDone = true;
      if ((vic === pl && pl.invulnerable()) || (vic === en && en.invuln > 0)) continue;
      const m = atk.moves[atk.move!], heavy = atk.move === 'heavy';
      vic.takeHit(m.dmg, atk.facing, m.kb, m.stun, vic === pl ? PLAYER_INVULN : ENEMY_INVULN);
      vic.flashT = 6; this.hitstop = m.hitstop; this.shake = Math.max(this.shake, m.shake);
      const cx = (hb.x + hb.w / 2 + vic.x) / 2, cy = hb.y + hb.h / 2;
      this.fx.impact(cx, cy, heavy); this.fx.burst(cx, cy, heavy ? 10 : 5, heavy ? 2.6 : 1.8, [C.FX, C.ENERGY, C.CREAM]);
      this.sfx(heavy ? 'heavyhit' : 'hit', 0.7);
      if (atk === pl) { this.combo++; this.comboT = 70; this.score += m.dmg * 10 * (1 + Math.floor((this.combo - 1) / 3)); }
      else this.chargeHum(false);
    }
  }
}
