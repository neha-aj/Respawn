/* ============================================================================
   Small deterministic 2D physics: an underwater character body with AABB
   collisions, a damped torque balance, and damped springs.
   Units: pixels, seconds. Run with a fixed timestep (see FIXED_DT).
   ============================================================================ */

export const FIXED_DT = 1 / 120;

/** Gravity reduced by buoyancy: g_eff = g · (1 − ρ_water / ρ_body). */
export const G = 900;
export const BUOYANCY_RATIO = 0.35;
export const G_EFF = G * (1 - BUOYANCY_RATIO);

export interface Rect { x: number; y: number; w: number; h: number }
export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export interface Body extends Rect { vx: number; vy: number; onGround: boolean }
export interface MoveInput { dir: -1 | 0 | 1; jump: boolean }

export const MOVE = {
  accel: 900,       // px/s² while walking on the floor
  airAccel: 420,    // reduced control while floating
  maxSpeed: 82,     // px/s
  groundFriction: 14, // exponential damping rate when no input
  waterDrag: 0.9,   // vertical drag rate (water resistance)
  jumpSpeed: 325,   // v₀; water drag trims the ideal v₀²/2g, see jumpHeight()
};

/** Peak jump height, integrated with the same gravity + water drag as stepBody(). */
export function jumpHeight(v0 = MOVE.jumpSpeed, g = G_EFF, dt = FIXED_DT): number {
  let vy = -v0, y = 0, peak = 0;
  while (vy < 0) { vy += g * dt; vy *= Math.exp(-MOVE.waterDrag * dt); y += vy * dt; peak = Math.min(peak, y); }
  return -peak;
}

/** Semi-implicit Euler with separate X / Y collision resolution. Returns true if the body landed this step. */
export function stepBody(b: Body, solids: readonly Rect[], input: MoveInput, dt = FIXED_DT): boolean {
  const accel = b.onGround ? MOVE.accel : MOVE.airAccel;
  if (input.dir !== 0) b.vx += input.dir * accel * dt;
  else if (b.onGround) b.vx *= Math.exp(-MOVE.groundFriction * dt);
  b.vx = Math.max(-MOVE.maxSpeed, Math.min(MOVE.maxSpeed, b.vx));
  if (Math.abs(b.vx) < 0.5 && input.dir === 0) b.vx = 0;

  if (input.jump && b.onGround) { b.vy = -MOVE.jumpSpeed; b.onGround = false; }
  b.vy += G_EFF * dt;
  b.vy *= Math.exp(-MOVE.waterDrag * dt);

  b.x += b.vx * dt;
  for (const s of solids) if (overlaps(b, s)) {
    if (b.vx > 0) b.x = s.x - b.w; else if (b.vx < 0) b.x = s.x + s.w;
    b.vx = 0;
  }
  const wasGround = b.onGround;
  b.onGround = false;
  b.y += b.vy * dt;
  for (const s of solids) if (overlaps(b, s)) {
    if (b.vy > 0) { b.y = s.y - b.h; b.onGround = true; } else if (b.vy < 0) b.y = s.y + s.h;
    b.vy = 0;
  }
  return b.onGround && !wasGround;
}

/**
 * Two-pan beam balance. angle > 0 means the LEFT pan is down.
 * Net torque τ = (m_L − m_R) · g · L · cos θ, moment of inertia I = (m_L + m_R + m_beam) · L².
 * Angular acceleration α = τ / I − c · ω, so equal loads settle to level.
 */
export class Balance {
  angle = 0;
  omega = 0;
  constructor(
    public left: number,
    public right: number,
    readonly arm = 22,
    readonly maxAngle = 0.42,
    readonly beamMass = 1.5,
    readonly damping = 3.2,
    readonly restoring = 6, // small pivot-geometry restoring term so a balanced beam returns to level
  ) {}

  torque(): number {
    return (this.left - this.right) * G * this.arm * Math.cos(this.angle);
  }
  inertia(): number { return (this.left + this.right + this.beamMass) * this.arm * this.arm; }

  /** Apply an angular impulse (e.g. a block landing on a pan). */
  kick(dOmega: number) { this.omega += dOmega; }

  step(dt = FIXED_DT) {
    const alpha = this.torque() / this.inertia() - this.restoring * this.angle * (this.left === this.right ? 1 : 0.2) - this.damping * this.omega;
    this.omega += alpha * dt;
    this.angle += this.omega * dt;
    if (this.angle > this.maxAngle) { this.angle = this.maxAngle; this.omega = -this.omega * 0.3; }
    if (this.angle < -this.maxAngle) { this.angle = -this.maxAngle; this.omega = -this.omega * 0.3; }
  }

  isSettled(eps = 0.01): boolean { return Math.abs(this.omega) < eps; }
  isLevel(eps = 0.02): boolean { return Math.abs(this.angle) < eps && this.isSettled(); }
}

/** Damped spring x'' = −k(x − target) − c·x'. Used for pressure plates and the door. */
export class Spring {
  value: number;
  vel = 0;
  constructor(public target: number, readonly k: number, readonly zeta = 0.5) { this.value = target; }
  step(dt = FIXED_DT) {
    const c = 2 * Math.sqrt(this.k) * this.zeta;
    this.vel += (-this.k * (this.value - this.target) - c * this.vel) * dt;
    this.value += this.vel * dt;
  }
}
