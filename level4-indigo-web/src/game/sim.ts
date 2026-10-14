/* ============================================================================
   Pure simulation (no DOM): ship, gravity wells, anchors + tether, laser,
   reflective walls, breathing gate, zones, checkpoint, lives, timer.
   A line-for-line port of the Python Game.step().
   ============================================================================ */
import {
  BOTTOM, C, CHECKPOINT_SPAWN, CHECKPOINT_X, GATE_W, GATE_X, GATE_Y, LASER_HALF, LASER_PIVOT, LEFT, LIVES, NODES, RIGHT,
  SAFE_GATE_SPEED, SHIP, SHOTS, SPAWN, TIME_LIMIT, TOP, WALLS, WELLS, type P,
} from './config';

/* ---------- 2D vector maths ---------- */
export class V {
  constructor(public x = 0, public y = 0) {}
  static of(p: P) { return new V(p[0], p[1]); }
  c() { return new V(this.x, this.y); }
  add(o: V) { return new V(this.x + o.x, this.y + o.y); }
  sub(o: V) { return new V(this.x - o.x, this.y - o.y); }
  mul(k: number) { return new V(this.x * k, this.y * k); }
  dot(o: V) { return this.x * o.x + this.y * o.y; }
  len() { return Math.hypot(this.x, this.y); }
  len2() { return this.x * this.x + this.y * this.y; }
  norm() { const l = this.len(); return l > 1e-12 ? this.mul(1 / l) : new V(); }
  dist(o: V) { return Math.hypot(this.x - o.x, this.y - o.y); }
}
export const segClosest = (p: V, a: V, b: V) => { const ab = b.sub(a); const t = Math.max(0, Math.min(1, p.sub(a).dot(ab) / Math.max(ab.len2(), 1e-9))); return a.add(ab.mul(t)); };
const orient = (a: V, b: V, c: V) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export const segsCross = (p1: V, p2: V, q1: V, q2: V) => orient(p1, p2, q1) * orient(p1, p2, q2) < 0 && orient(q1, q2, p1) * orient(q1, q2, p2) < 0;
/** v′ = v − (1+e)(v·n)n — e = 1 is a perfect mirror. */
export const reflect = (v: V, n: V, e = 1) => v.sub(n.mul((1 + e) * v.dot(n)));

/* ---------- world objects ---------- */
export class GravityWell {
  readonly pos: V;
  constructor(pos: P, readonly k: number, readonly core: number, readonly ring: number) { this.pos = V.of(pos); }
  /** Softened inverse square: a = k·r̂ / (r² + ε²). */
  accel(p: V, soft = 14) { const d = this.pos.sub(p); return d.len2() > 1e-9 ? d.norm().mul(this.k / (d.len2() + soft * soft)) : new V(); }
}
export class LaserObstacle {
  static PERIOD = 4; static ACTIVE = 2.6;
  t = 0; readonly pivot = V.of(LASER_PIVOT); readonly half = LASER_HALF;
  get angle() { return Math.PI / 2 + 0.6 * Math.sin(0.6 * this.t); }
  get active() { return this.t % LaserObstacle.PERIOD < LaserObstacle.ACTIVE; }
  get phaseLeft() { const m = this.t % LaserObstacle.PERIOD; return this.active ? LaserObstacle.ACTIVE - m : LaserObstacle.PERIOD - m; }
  ends(): [V, V] { const d = new V(Math.cos(this.angle), Math.sin(this.angle)).mul(this.half); return [this.pivot.sub(d), this.pivot.add(d)]; }
  aligned(heading: number, tol = (15 * Math.PI) / 180) { const diff = (((heading - this.angle) % Math.PI) + Math.PI) % Math.PI; return Math.min(diff, Math.PI - diff) <= tol; }
}
export interface Rect { x: number; y: number; w: number; h: number }
export class TargetGate {
  t = 0;
  get half() { return 45 + 25 * Math.sin(0.5 * this.t); }
  rects(): [Rect, Rect] { const h = this.half; return [{ x: GATE_X, y: TOP, w: GATE_W, h: GATE_Y - h - TOP }, { x: GATE_X, y: GATE_Y + h, w: GATE_W, h: BOTTOM - GATE_Y - h }]; }
  walls(): [V, V][] {
    return this.rects().flatMap((r) => { const c = [new V(r.x, r.y), new V(r.x + r.w, r.y), new V(r.x + r.w, r.y + r.h), new V(r.x, r.y + r.h)]; return c.map((p, i) => [p, c[(i + 1) % 4]] as [V, V]); });
  }
}
export class Spaceship {
  pos = V.of(SPAWN); vel = new V(); angle = 0; tether: number | null = null; tlen = 0; inv = 2; thrusting = false;
  reset(p: V) { this.pos = p.c(); this.vel = new V(); this.angle = 0; this.tether = null; this.tlen = 0; this.inv = 2; this.thrusting = false; }
  get heading() { return new V(Math.cos(this.angle), Math.sin(this.angle)); }
  nose() { return this.pos.add(this.heading.mul(16)); }
}

export type State = 'menu' | 'rules' | 'play' | 'pause' | 'over' | 'won';
export type Mood = 'calm' | 'focus' | 'alarm' | 'hurt' | 'smug' | 'triumph';
export type Sound = 'gun' | 'strike' | 'ricochet' | 'zap' | 'boom' | 'alarm' | 'chime' | 'warp' | 'click' | 'empty';
export interface Particle { p: V; v: V; life: number; age: number; col: string; grav: number }
export interface Controls { thrust: boolean; reverse: boolean; left: boolean; right: boolean }

export class IndigoGame {
  state: State = 'menu'; t = 0; reason = '';
  ship = new Spaceship(); wells: GravityWell[] = []; nodes: V[] = []; laser = new LaserObstacle(); gate = new TargetGate(); walls: [V, V][] = [];
  lives = LIVES; shots = SHOTS; timeLeft = TIME_LIMIT;
  projs: { pos: V; vel: V; life: number; trail: V[] }[] = []; parts: Particle[] = []; rings: { p: V; age: number; life: number }[] = []; trail: { p: V; v: V; age: number }[] = [];
  checkpoint = false; respawn = V.of(SPAWN);
  slow = 0; shake = 0; flash = 0; msg = ''; msgT = 0; wonT = 0;
  danger = 0; moodT = 0; moodHold: Mood = 'calm'; zone = 1; laserCd = 0; alarmCd = 0; seen = new Set<string>();
  controls: Controls = { thrust: false, reverse: false, left: false, right: false };

  constructor(private sound: (s: Sound, vol?: number) => void = () => {}, private rnd: () => number = Math.random) { this.reset(); }

  reset() {
    this.ship = new Spaceship(); this.ship.reset(V.of(SPAWN));
    this.wells = WELLS.map(([p, k, c, r]) => new GravityWell(p, k, c, r));
    this.nodes = NODES.map(V.of); this.laser = new LaserObstacle(); this.gate = new TargetGate();
    this.walls = WALLS.map(([a, b]) => [V.of(a), V.of(b)] as [V, V]);
    this.lives = LIVES; this.shots = SHOTS; this.timeLeft = TIME_LIMIT;
    this.projs = []; this.parts = []; this.rings = []; this.trail = [];
    this.checkpoint = false; this.respawn = V.of(SPAWN);
    this.slow = this.shake = this.flash = this.msgT = this.wonT = 0; this.msg = ''; this.reason = '';
    this.danger = 0; this.moodT = 0; this.moodHold = 'calm'; this.zone = 1; this.laserCd = 0; this.alarmCd = 0; this.seen = new Set();
  }
  start() { this.reset(); this.state = 'play'; this.say('GRAVITY WELLS AHEAD · FIND THE INDIGO GATE'); }

  say(m: string) { if (m !== this.msg || this.msgT <= 0) { this.msg = m; this.msgT = 2.6; } }
  mood(m: Mood, secs = 1.4) { this.moodHold = m; this.moodT = secs; }
  burst(p: V, n: number, speed: number, col: string, life: [number, number] = [20, 50], grav = 0) {
    for (let i = 0; i < n; i++) { const a = this.rnd() * Math.PI * 2, v = (0.25 + this.rnd() * 0.75) * speed; this.parts.push({ p: p.c(), v: new V(Math.cos(a) * v, Math.sin(a) * v), life: life[0] + this.rnd() * (life[1] - life[0]), age: 0, col, grav }); }
  }
  objective() {
    return ({ 1: 'ZONE 1 · THE DRIFT — learn thrust and inertia, then slip through the gap',
      2: 'ZONE 2 · THE SINGULARITY — curve around the well; anchors help you swing',
      3: 'ZONE 3 · THE POLARITY FIELD — cross the beam when it is dim, or align your heading with it',
      4: 'ZONE 4 · THE INDIGO GATE — slow down (speed ≤ 4.5) and thread the monoliths' } as Record<number, string>)[this.zone];
  }
  gravity(p: V) { return this.wells.reduce((a, w) => a.add(w.accel(p)), new V()); }
  allWalls(): [V, V][] {
    const b: [V, V][] = [[new V(LEFT, TOP), new V(RIGHT, TOP)], [new V(RIGHT, TOP), new V(RIGHT, BOTTOM)], [new V(RIGHT, BOTTOM), new V(LEFT, BOTTOM)], [new V(LEFT, BOTTOM), new V(LEFT, TOP)]];
    return [...this.walls, ...this.gate.walls(), ...b];
  }
  /** Ballistic preview: current velocity + well gravity (no future input). */
  predict(frames = 60) {
    let p = this.ship.pos.c(), v = this.ship.vel.c(); const pts: V[] = [];
    for (let f = 0; f < frames; f++) { v = v.add(this.gravity(p)); p = p.add(v); if (f % 3 === 0) pts.push(p); }
    return pts;
  }
  currentMood(): Mood {
    if (this.state === 'won') return 'triumph';
    if (this.state === 'over') return 'hurt';
    if (this.moodT > 0) return this.moodHold;
    if (this.danger > 0.25) return 'alarm';
    return this.controls.thrust ? 'focus' : 'calm';
  }

  loseLife(cause: string, respawn: boolean) {
    this.lives--; this.shake = 16; this.flash = 0.6; this.slow = 1;
    this.burst(this.ship.pos, 80, 7, C.pale); this.burst(this.ship.pos, 40, 3, C.portal); this.rings.push({ p: this.ship.pos.c(), age: 0, life: 50 });
    this.sound('boom'); this.mood('hurt', 2);
    if (this.lives <= 0) { this.state = 'over'; this.reason = cause; return; }
    this.say(`${cause} · ${this.lives} LIVES LEFT`);
    if (respawn) this.ship.reset(this.respawn); else this.ship.inv = 1.5;
  }

  fire() {
    if (this.state !== 'play') return;
    const sh = this.ship;
    if (sh.tether !== null) { sh.tether = null; this.say('TETHER RELEASED'); this.sound('click'); return; }
    if (this.shots <= 0) { this.sound('empty'); this.say('NO ANCHORS LEFT'); return; }
    this.shots--;
    this.projs.push({ pos: sh.nose(), vel: sh.heading.mul(9).add(sh.vel.mul(0.5)), life: 60, trail: [] });
    this.burst(sh.nose(), 12, 3, C.lilac, [6, 14]); this.shake = Math.max(this.shake, 3); this.sound('gun');
  }

  win() {
    this.state = 'won'; this.wonT = 0; this.slow = 1.8; this.flash = 1; this.shake = 10; this.ship.tether = null;
    this.sound('warp'); const g = new V(GATE_X + 50, GATE_Y);
    this.burst(g, 140, 9, C.portal); this.rings.push({ p: g.c(), age: 0, life: 70 }, { p: g.c(), age: -12, life: 70 }); this.mood('triumph', 99);
  }

  /** One fixed 60 Hz step. */
  step(dt: number) {
    this.t += dt;
    if (this.state !== 'play' && this.state !== 'won') return;
    const ts = this.slow > 0 ? 0.3 : 1;
    this.slow = Math.max(0, this.slow - dt); this.shake *= 0.86; this.flash = Math.max(0, this.flash - dt * 1.4); this.msgT -= dt; this.moodT -= dt;
    for (const p of this.parts) { p.v.y += p.grav * ts; p.p = p.p.add(p.v.mul(ts)); p.v = p.v.mul(Math.pow(0.97, ts)); p.age += ts; }
    this.parts = this.parts.filter((p) => p.age < p.life);
    for (const r of this.rings) r.age += ts;
    this.rings = this.rings.filter((r) => r.age < r.life);
    if (this.state === 'won') {
      this.wonT += dt; this.ship.pos = this.ship.pos.add(new V(GATE_X + 60, GATE_Y).sub(this.ship.pos).mul(0.04));
      if (this.rnd() < 0.6) this.burst(new V(GATE_X + 60, GATE_Y), 4, 4, [C.portal, C.pale, C.lilac][Math.floor(this.rnd() * 3)]);
      return;
    }
    this.timeLeft -= dt * ts;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.state = 'over'; this.reason = 'TIME EXPIRED — THE ANOMALY COLLAPSED'; this.sound('boom'); return; }
    const sh = this.ship, c = this.controls;
    this.laser.t += dt * ts; this.gate.t += dt * ts; this.laserCd = Math.max(0, this.laserCd - dt); this.alarmCd = Math.max(0, this.alarmCd - dt);
    sh.inv = Math.max(0, sh.inv - dt);
    // rotation + thrust (Newtonian: velocity persists when thrust stops)
    sh.angle += ((c.right ? 1 : 0) - (c.left ? 1 : 0)) * SHIP.TURN * ts;
    let acc = this.gravity(sh.pos);
    if (c.thrust) acc = acc.add(sh.heading.mul(SHIP.THRUST));
    if (c.reverse) acc = acc.sub(sh.heading.mul(SHIP.REVERSE));
    sh.thrusting = c.thrust;
    sh.vel = sh.vel.add(acc.mul(ts));
    if (sh.vel.len() > SHIP.VMAX) sh.vel = sh.vel.norm().mul(SHIP.VMAX);
    const prev = sh.pos.c(); sh.pos = sh.pos.add(sh.vel.mul(ts));
    if (sh.tether !== null) {                                   // inextensible tether: swing around the node
      const n = this.nodes[sh.tether], d = sh.pos.sub(n);
      if (d.len() > sh.tlen) { const u = d.norm(); sh.pos = n.add(u.mul(sh.tlen)); const vr = sh.vel.dot(u); if (vr > 0) sh.vel = sh.vel.sub(u.mul(vr)); }
    }
    if (c.thrust && this.rnd() < 0.9) this.trail.push({ p: sh.pos.sub(sh.heading.mul(12)), v: sh.heading.mul(-2.5).add(new V(this.rnd() * 1.2 - 0.6, this.rnd() * 1.2 - 0.6)), age: 0 });
    for (const tr of this.trail) { tr.p = tr.p.add(tr.v.mul(ts)); tr.age += ts; }
    this.trail = this.trail.filter((tr) => tr.age < 26);
    // wells
    this.danger = 0;
    for (const w of this.wells) {
      const dist = sh.pos.dist(w.pos);
      if (dist < w.ring) this.danger = Math.max(this.danger, 1 - dist / w.ring);
      if (dist < w.core + SHIP.R && sh.inv <= 0) { this.loseLife('CONSUMED BY THE SINGULARITY', true); return; }
    }
    if (this.danger > 0) {
      if (!this.seen.has('well') || this.alarmCd <= 0) this.say('GRAVITY WELL DETECTED');
      this.seen.add('well');
      if (this.alarmCd <= 0) { this.sound('alarm', 0.5); this.alarmCd = 1.6; }
    }
    // walls: v′ = v − 2(v·n)n with slight energy loss
    for (const [a, b] of this.allWalls()) {
      const q = segClosest(sh.pos, a, b), d = sh.pos.sub(q), dist = d.len();
      if (dist < SHIP.R + 3 && dist > 1e-6) {
        const n = d.mul(1 / dist), vn = sh.vel.dot(n);
        if (vn < 0) {
          const impact = -vn; sh.vel = reflect(sh.vel, n, 0.85); sh.pos = q.add(n.mul(SHIP.R + 3));
          this.burst(q, 10, 3, C.pale, [8, 18]); this.sound('ricochet', Math.min(1, impact / 4)); this.shake = Math.max(this.shake, impact);
          if (impact > 5.2 && sh.inv <= 0) { this.loseLife('HULL BREACH', false); return; }
        }
      }
    }
    // laser: crossing an active beam needs a heading within ±15°
    const [la, lb] = this.laser.ends();
    if (segsCross(prev, sh.pos, la, lb) && this.laser.active && this.laserCd <= 0) {
      if (this.laser.aligned(sh.angle)) { this.say('POLARITY ALIGNED — PHASED THROUGH'); this.sound('chime', 0.4); this.laserCd = 0.5; }
      else {
        const bn = new V(-Math.sin(this.laser.angle), Math.cos(this.laser.angle));
        sh.vel = reflect(sh.vel, bn, 0.9); sh.pos = prev; this.laserCd = 1.5; this.sound('zap'); this.burst(sh.pos, 30, 5, C.laser);
        if (sh.inv <= 0) this.loseLife('POLARITY BURN', false);
        if (this.state !== 'play') return;
      }
    }
    if (!this.laser.active && sh.pos.x > 520 && sh.pos.x < 700 && this.zone === 3) this.say('POLARITY WINDOW OPEN');
    // gate: through the opening slowly → victory
    const [top, bot] = this.gate.rects();
    if (prev.x <= GATE_X + GATE_W && sh.pos.x > GATE_X + GATE_W) {
      if (sh.pos.y > top.y + top.h && sh.pos.y < bot.y) {
        if (sh.vel.len() <= SAFE_GATE_SPEED) { this.win(); return; }
        sh.vel = reflect(sh.vel, new V(-1, 0), 0.6); sh.pos.x = GATE_X - SHIP.R - 4; this.say('APPROACH TOO FAST — BRAKE WITH S'); this.sound('ricochet');
      }
    }
    // anchor projectiles
    for (const p of this.projs) {
      p.vel = p.vel.add(this.gravity(p.pos).mul(ts)); p.pos = p.pos.add(p.vel.mul(ts)); p.life -= ts;
      p.trail.push(p.pos.c()); if (p.trail.length > 10) p.trail.shift();
      const i = this.nodes.findIndex((n) => p.pos.dist(n) < 16);
      if (i >= 0) {
        sh.tether = i; sh.tlen = Math.max(40, sh.pos.dist(this.nodes[i])); p.life = 0;
        this.say('ANCHOR ATTACHED — SPACE TO RELEASE'); this.sound('strike'); this.slow = Math.max(this.slow, 0.25);
        this.burst(this.nodes[i], 24, 4, C.portal); this.rings.push({ p: this.nodes[i].c(), age: 0, life: 24 }); this.mood('smug');
      } else if (this.walls.some(([a, b]) => segClosest(p.pos, a, b).dist(p.pos) < 4)) { p.life = 0; this.burst(p.pos, 8, 2, C.soft); }
    }
    this.projs = this.projs.filter((p) => p.life > 0);
    // zones + checkpoint
    const x = sh.pos.x;
    this.zone = x < 262 ? 1 : x < CHECKPOINT_X ? 2 : x < 730 ? 3 : 4;
    if (!this.checkpoint && x > CHECKPOINT_X + 8) {
      this.checkpoint = true; this.respawn = V.of(CHECKPOINT_SPAWN); this.shots = Math.max(this.shots, 4);
      this.say('CHECKPOINT REACHED'); this.sound('chime'); this.rings.push({ p: sh.pos.c(), age: 0, life: 30 }); this.mood('smug');
    }
    if (this.zone === 4 && !this.seen.has('gate')) { this.seen.add('gate'); this.say('INDIGO GATE APPROACHING'); }
    if (!(x > LEFT - 60 && x < RIGHT + 60 && sh.pos.y > TOP - 60 && sh.pos.y < BOTTOM + 60)) { this.state = 'over'; this.reason = 'LOST IN THE VOID'; }
  }
}
