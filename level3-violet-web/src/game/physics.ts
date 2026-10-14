/* ============================================================================
   Bullet physics — a direct port of the Python Projectile.step():
   gravity, sub-stepped motion, specular ricochets (invert vx on vertical
   surfaces, vy on horizontal ones), transformation fields, targets, door.
   ============================================================================ */
import { DOOR_RECT, FIELDS, GRAVITY, MAX_BOUNCES, SOLIDS, H, W, type Rect } from './config';

export interface V2 { x: number; y: number }
export const inside = (r: Rect, x: number, y: number) => r.x <= x && x < r.x + r.w && r.y <= y && y < r.y + r.h;
export const dist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.y - b.y);

/** Transformation zone applied to the velocity vector on entry. */
export class Field {
  flash = 0;
  constructor(readonly kind: 'scale' | 'reflect', readonly rect: Rect) {}
  apply(v: V2) {
    if (this.kind === 'scale') { v.x *= 1.6; v.y *= 1.6; }   // [[1.6,0],[0,1.6]]
    else v.y = -v.y;                                          // [[1,0],[0,-1]]
  }
}

export class Door { unlocked = false; hit = false; constructor(readonly rect: Rect) {} }
export interface Target { alive: boolean; pos: V2; radius: number }

export class World {
  solids: Rect[] = SOLIDS.map((r) => ({ ...r }));
  fields = FIELDS.map((f) => new Field(f.kind, { ...f.rect }));
  door = new Door({ ...DOOR_RECT });
  enemies: Target[] = [];
  solidAt(x: number, y: number) {
    if (this.solids.some((r) => inside(r, x, y))) return true;
    return !this.door.unlocked && inside(this.door.rect, x, y);   // a locked door is armour
  }
}

export type Ev =
  | { t: 'bounce'; p: V2 } | { t: 'spark'; p: V2 } | { t: 'field'; p: V2; kind: 'scale' | 'reflect' }
  | { t: 'kill'; e: Target } | { t: 'door'; p: V2 } | { t: 'fizzle'; p: V2 };

export class Projectile {
  pos: V2; vel: V2; alive = true; bounces = 0; age = 0;
  trail: V2[] = [];
  inside = new Set<Field>();
  used = new Set<'scale' | 'reflect'>();
  constructor(pos: V2, vel: V2, readonly enemy = false) { this.pos = { ...pos }; this.vel = { ...vel }; }

  /** Advance one frame scaled by ts (slow-motion uses ts < 1). */
  step(world: World, ts = 1): Ev[] {
    const ev: Ev[] = [];
    if (!this.enemy) this.vel.y += GRAVITY * ts;
    const n = Math.max(1, Math.ceil((Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y)) * ts) / 3));
    for (let k = 0; k < n; k++) {
      const dx = (this.vel.x * ts) / n, dy = (this.vel.y * ts) / n;
      if (world.solidAt(this.pos.x + dx, this.pos.y)) {
        if (this.enemy) { this.alive = false; ev.push({ t: 'spark', p: { ...this.pos } }); return ev; }
        this.vel.x = -this.vel.x; this.bounces++; ev.push({ t: 'bounce', p: { ...this.pos } });
      } else this.pos.x += dx;
      if (world.solidAt(this.pos.x, this.pos.y + dy)) {
        if (this.enemy) { this.alive = false; ev.push({ t: 'spark', p: { ...this.pos } }); return ev; }
        this.vel.y = -this.vel.y; this.bounces++; ev.push({ t: 'bounce', p: { ...this.pos } });
      } else this.pos.y += dy;
      if (this.enemy) continue;
      for (const f of world.fields) {
        const now = inside(f.rect, this.pos.x, this.pos.y);
        if (now && !this.inside.has(f)) { f.apply(this.vel); this.used.add(f.kind); ev.push({ t: 'field', p: { ...this.pos }, kind: f.kind }); }
        if (now) this.inside.add(f); else this.inside.delete(f);
      }
      for (const e of world.enemies) {
        if (e.alive && dist(this.pos, e.pos) < e.radius + 3) { this.alive = false; ev.push({ t: 'kill', e }); return ev; }
      }
      if (world.door.unlocked && inside(world.door.rect, this.pos.x, this.pos.y)) { this.alive = false; ev.push({ t: 'door', p: { ...this.pos } }); return ev; }
      if (this.bounces > MAX_BOUNCES) { this.alive = false; ev.push({ t: 'fizzle', p: { ...this.pos } }); return ev; }
    }
    this.age += ts;
    if (!(this.pos.x > -50 && this.pos.x < W + 50 && this.pos.y > -50 && this.pos.y < H + 50)) this.alive = false;
    return ev;
  }
}

/** Dotted aiming guide: the gravity arc up to the first surface or field contact. */
export function predict(world: World, pos: V2, vel: V2, frames = 90): V2[] {
  const p = new Projectile(pos, vel), pts: V2[] = [];
  for (let f = 0; f < frames; f++) {
    const ev = p.step(world);
    if (f % 2 === 0) pts.push({ ...p.pos });
    if (ev.length || !p.alive) break;
  }
  return pts;
}
