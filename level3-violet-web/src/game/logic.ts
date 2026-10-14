/* ============================================================================
   VioletGame — all gameplay state and rules, with no DOM or canvas, so it can
   be tested headlessly. Mirrors the Python Game.update() frame for frame.
   ============================================================================ */
import { AMMO, BULLET_SPEED, C, DRONES, LIVES, TIME_LIMIT } from './config';
import { Enemy, Player, type Input } from './entities';
import { Projectile, type Ev, type V2, World } from './physics';

export type State = 'menu' | 'rules' | 'play' | 'pause' | 'over' | 'won';
export type Sound = 'gun' | 'ping' | 'zap' | 'pew' | 'boom' | 'hurt' | 'door' | 'click' | 'empty';
export interface Particle { p: V2; v: V2; life: number; age: number; size: number; col: string; grav: number }
export interface Ring { p: V2; age: number; life: number }

export class VioletGame {
  state: State = 'menu';
  overReason = '';
  t = 0;
  world!: World; player!: Player; enemies!: Enemy[];
  lives = LIVES; ammo = AMMO; timeLeft = TIME_LIMIT;
  shots: Projectile[] = []; eshots: Projectile[] = []; parts: Particle[] = []; rings: Ring[] = [];
  slow = 0; shake = 0; flash = 0; wonT = 0;
  input: Input = { left: false, right: false, jump: false };
  aimPoint: V2 = { x: 450, y: 300 };

  constructor(private sound: (s: Sound, vol?: number) => void = () => {}, private rnd: () => number = Math.random) { this.reset(); }

  reset() {
    this.world = new World(); this.player = new Player();
    this.enemies = DRONES.map(([b, amp, ph]) => new Enemy({ x: b[0], y: b[1] }, amp, ph, this.rnd));
    this.world.enemies = this.enemies;
    this.lives = LIVES; this.ammo = AMMO; this.timeLeft = TIME_LIMIT;
    this.shots = []; this.eshots = []; this.parts = []; this.rings = [];
    this.slow = 0; this.shake = 0; this.flash = 0; this.wonT = 0; this.overReason = '';
  }
  start() { this.reset(); this.state = 'play'; }

  /* ---------------- effects ---------------- */
  burst(p: V2, n: number, speed: number, col: string, grav = 0.12, life: [number, number] = [25, 60], size: [number, number] = [2, 4]) {
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2, v = (0.3 + this.rnd() * 0.7) * speed;
      this.parts.push({ p: { ...p }, v: { x: Math.cos(a) * v, y: Math.sin(a) * v }, life: life[0] + this.rnd() * (life[1] - life[0]), age: 0, size: size[0] + this.rnd() * (size[1] - size[0]), col, grav });
    }
  }
  explode(p: V2, big = false) {
    this.burst(p, big ? 90 : 55, big ? 9 : 7, C.soft); this.burst(p, 40, 4, C.pale, 0.05);
    this.burst(p, 25, 13, C.proj, 0.02, [10, 22], [1, 2]);                   // fast streaks
    this.rings.push({ p: { ...p }, age: 0, life: big ? 60 : 42 });
    this.shake = 14; this.slow = 0.9; this.flash = Math.max(this.flash, big ? 0.6 : 0.3);
    this.sound('boom');
  }

  /* ---------------- actions ---------------- */
  fire() {
    if (this.state !== 'play') return;
    if (this.ammo <= 0) { this.sound('empty'); return; }
    this.ammo--;
    const m = this.player.muzzle(), a = this.player.aim;
    this.shots.push(new Projectile(m, { x: Math.cos(a) * BULLET_SPEED, y: Math.sin(a) * BULLET_SPEED }));
    this.player.recoil = 1; this.shake = Math.max(this.shake, 4); this.burst(m, 14, 4, C.proj, 0, [6, 14]);
    this.sound('gun');
  }
  lose(reason: string) { this.state = 'over'; this.overReason = reason; this.sound('boom', 0.6); }

  private handle(ev: Ev[]) {
    for (const e of ev) {
      if (e.t === 'bounce') { this.burst(e.p, 10, 3, C.proj, 0.05, [8, 18]); this.sound('ping', 0.6); }
      else if (e.t === 'field') {
        for (const f of this.world.fields) if (f.kind === e.kind) f.flash = 1;
        this.burst(e.p, 18, 4, e.kind === 'scale' ? C.scale : C.reflect, 0, [10, 24]); this.sound('zap');
      } else if (e.t === 'kill') {
        e.e.alive = false; this.explode(e.e.pos);
        if (!this.enemies.some((d) => d.alive)) { this.world.door.unlocked = true; this.sound('door', 0.7); }
      } else if (e.t === 'door') {
        this.world.door.hit = true; this.explode(e.p, true); this.flash = 1; this.slow = 2;
        this.sound('door'); this.state = 'won'; this.wonT = 0;
      } else if (e.t === 'fizzle') this.burst(e.p, 12, 2, C.dim, 0.02);
    }
  }

  /** One 60 Hz step. dt is real seconds (1/60); ts is the slow-motion time scale. */
  update(dt: number) {
    this.t += dt;
    if (this.state !== 'play' && this.state !== 'won') return;
    const ts = this.slow > 0 ? 0.25 : 1;
    this.slow = Math.max(0, this.slow - dt); this.shake *= 0.86; this.flash = Math.max(0, this.flash - dt * 1.5);
    for (const f of this.world.fields) f.flash = Math.max(0, f.flash - dt * 2);
    for (const p of this.parts) { p.v.y += p.grav * ts; p.p.x += p.v.x * ts; p.p.y += p.v.y * ts; const k = Math.pow(0.985, ts); p.v.x *= k; p.v.y *= k; p.age += ts; }
    this.parts = this.parts.filter((p) => p.age < p.life);
    for (const r of this.rings) r.age += ts;
    this.rings = this.rings.filter((r) => r.age < r.life);
    if (this.state === 'won') { this.wonT += dt; return; }

    this.timeLeft -= dt * ts;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.lose('TIME EXPIRED'); return; }
    const pl = this.player;
    this.refreshAim();
    pl.update(this.input, this.world, ts);
    for (const e of this.enemies) if (e.alive && e.update(ts, pl.center(), this.eshots)) this.sound('pew', 0.5);
    for (const b of this.shots) {
      b.trail.push({ ...b.pos }); if (b.trail.length > 16) b.trail.shift();
      this.handle(b.step(this.world, ts));
      if (this.state !== 'play') return;
    }
    this.shots = this.shots.filter((b) => b.alive);
    const r = pl.rect;
    for (const b of this.eshots) {
      b.trail.push({ ...b.pos }); if (b.trail.length > 8) b.trail.shift();
      for (const e of b.step(this.world, ts)) if ('p' in e) this.burst(e.p, 6, 2, C.drone, 0.05, [6, 14]);
      if (b.alive && pl.hurt <= 0 && b.pos.x >= r.x && b.pos.x < r.x + r.w && b.pos.y >= r.y && b.pos.y < r.y + r.h) {
        b.alive = false; this.lives--; pl.hurt = 1.5; this.shake = 10; this.flash = 0.4;
        this.burst(b.pos, 30, 5, C.pale); this.sound('hurt');
        if (this.lives <= 0) { this.lose('LIVES DEPLETED'); return; }
      }
    }
    this.eshots = this.eshots.filter((b) => b.alive);
    if (this.ammo === 0 && this.shots.length === 0) this.lose('OUT OF VECTOR BULLETS');
  }

  /** Point Thanos's gauntlet at the aim point. */
  refreshAim() {
    const pl = this.player, sh = pl.shoulder();
    pl.aim = Math.atan2(this.aimPoint.y - sh.y, this.aimPoint.x - sh.x);
    pl.facing = this.aimPoint.x >= pl.rect.x + pl.rect.w / 2 ? 1 : -1;
  }

  get dronesLeft() { return this.enemies.filter((e) => e.alive).length; }
}
