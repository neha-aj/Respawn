/* Thanos (player) and the security drones — ports of the Python Player / Enemy. */
import { FPS, SPAWN, type Rect } from './config';
import { Projectile, type V2, type World } from './physics';

export interface Input { left: boolean; right: boolean; jump: boolean }
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Player {
  static W = 26; static H = 76;
  rect!: Rect; pos!: V2; vel!: V2;
  onGround = false; facing: 1 | -1 = 1; walk = 0; hurt = 0; aim = 0; recoil = 0;
  constructor() { this.reset(); }
  reset() {
    this.rect = { x: SPAWN.x, y: SPAWN.y, w: Player.W, h: Player.H }; this.pos = { x: SPAWN.x, y: SPAWN.y };
    this.vel = { x: 0, y: 0 }; this.onGround = false; this.facing = 1; this.walk = 0; this.hurt = 0; this.aim = 0; this.recoil = 0;
  }
  center(): V2 { return { x: this.rect.x + this.rect.w / 2, y: this.rect.y + this.rect.h / 2 }; }
  shoulder(): V2 { return { x: Math.round(this.rect.x + this.rect.w / 2) + 2 * this.facing, y: this.rect.y + 26 }; }
  muzzle(): V2 { const s = this.shoulder(); return { x: s.x + Math.cos(this.aim) * 36, y: s.y + Math.sin(this.aim) * 36 }; }

  update(input: Input, world: World, ts: number) {
    this.vel.x = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 3.8;
    if (input.jump && this.onGround) this.vel.y = -12.6;
    this.vel.y = Math.min(this.vel.y + 0.55 * ts, 14);
    for (const axis of ['x', 'y'] as const) {
      this.pos[axis] += this.vel[axis] * ts;
      this.rect.x = Math.round(this.pos.x); this.rect.y = Math.round(this.pos.y);
      for (const o of world.solids) {
        if (!overlap(this.rect, o)) continue;
        if (axis === 'x') { if (this.vel.x < 0) this.rect.x = o.x + o.w; else if (this.vel.x > 0) this.rect.x = o.x - Player.W; }
        else {
          if (this.vel.y > 0) { this.rect.y = o.y - Player.H; this.onGround = true; } else this.rect.y = o.y + o.h;
          this.vel.y = 0;
        }
        this.pos.x = this.rect.x; this.pos.y = this.rect.y;
      }
      if (axis === 'y' && this.vel.y !== 0) this.onGround = false;
    }
    if (this.onGround) this.walk += Math.abs(this.vel.x) * 0.06 * ts;
    this.hurt = Math.max(0, this.hurt - ts / FPS);
    this.recoil = Math.max(0, this.recoil - 0.15 * ts);
  }
}

/** Security drone on a Lissajous patrol: x = A·sin(ωt+φ), y = B·sin(2ωt+φ). */
export class Enemy {
  readonly radius = 18;
  alive = true; t: number; pos: V2; cool: number;
  constructor(readonly base: V2, readonly amp: number, readonly phase: number, private rnd: () => number = Math.random) {
    this.t = rnd() * 3; this.pos = { ...base }; this.cool = 80 + Math.floor(rnd() * 61);
  }
  /** Returns true when the drone fires. */
  update(ts: number, target: V2, shots: Projectile[]): boolean {
    this.t += ts / FPS;
    this.pos = { x: this.base.x + this.amp * Math.sin(0.9 * this.t + this.phase), y: this.base.y + 22 * Math.sin(1.8 * this.t + this.phase) };
    this.cool -= ts;
    if (this.cool > 0) return false;
    this.cool = 95 + Math.floor(this.rnd() * 56);
    const dx = target.x - this.pos.x, dy = target.y - this.pos.y, l = Math.hypot(dx, dy);
    if (l <= 1) return false;
    const spread = ((this.rnd() * 12 - 6) * Math.PI) / 180, c = Math.cos(spread), s = Math.sin(spread);
    const ux = dx / l, uy = dy / l;
    shots.push(new Projectile(this.pos, { x: (ux * c - uy * s) * 4.4, y: (ux * s + uy * c) * 4.4 }, true));
    return true;
  }
}
