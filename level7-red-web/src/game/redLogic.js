/* RED — pure data and logic (no Phaser import), shared by the scene and the unit tests. */

// ---------------------------------------------------------------- palette (monochromatic red family only)
export const COLORS = {
  bg0: 0x12060a, bg1: 0x3a0a14, bg2: 0x22080e, panel: 0x2c0a12, platform: 0x5a0f1c, edge: 0xff3b4e, hazard: 0xff1744,
  glass: 0x2a0a10, body: 0xff3b4e, coat: 0x8f1830, flash: 0xffc2cc, dim: 0x7a1426, soft: 0xc22a40, pale: 0xff8a98, card: 0x1c070c,
};
export const TEXT = '#FFE1E1', TEXT_DIM = '#C22A40', TEXT_HOT = '#FF3B4E';

// ---------------------------------------------------------------- physics
export const PHYS = { gravity: 1400, speed: 260, jumpV: -620, coyote: 0.08, buffer: 0.1, accel: 2600, airAccel: 1700, playerW: 40, playerH: 56, floorY: 640, killY: 720 };

/**
 * Sine-wave motion: y-offset of item i at time t.
 * Each item gets its own phase (i × 1.7 rad) and a slightly different angular speed (0.6 + 0.07·i),
 * so a row of motes or embers bobs out of step: y = A · sin(ω·t + φ).
 */
export const sineY = (i, t, amp = 6) => amp * Math.sin((0.6 + 0.07 * i) * t + i * 1.7);

/**
 * Reflection at a wall: an elastic bounce keeps the speed and flips the sign of the velocity
 * component perpendicular to the wall. For a vertical wall that is v'x = −vx.
 */
export const reflectVx = (vx) => -vx;

/**
 * Peak jump height for launch speed v0 against gravity g.
 * From v² = v0² − 2·g·h with v = 0 at the apex: h = v0² / (2g).
 * With v0 = 620 px/s and g = 1400 px/s² that is ≈ 137 px.
 */
export const jumpHeight = (v0, g) => (v0 * v0) / (2 * g);

/**
 * Fleeing-door velocity: the door moves directly away from the player along x
 * (sign of doorX − playerX), at full speed — the unit direction times the speed.
 * Kept for compatibility; Room 4 now uses the patience test instead.
 */
export const fleeVx = (doorX, playerX, speed) => (doorX === playerX ? 0 : Math.sign(doorX - playerX) * speed);

/** Horizontal distance covered by a full-speed jump that lands `rise` px higher (negative = lower) than it started. */
export const jumpReach = (rise, v0 = -PHYS.jumpV, g = PHYS.gravity, speed = PHYS.speed) => {
  const disc = v0 * v0 - 2 * g * rise;
  return disc < 0 ? 0 : (speed * (v0 + Math.sqrt(disc))) / g;
};

// ---------------------------------------------------------------- narrator (exact data)
export const NARRATOR = {
  r1_rule: [
    "The rules were right there. Mostly.",
    "You learned one rule. That was adorable.",
    "Congratulations. Reality has updated."
  ],
  r2_physics: [
    "Gravity filed a change request.",
    "Physics is currently under new management.",
    "You may want to rethink that jump."
  ],
  r3_controls: [
    "Left is left. For the next three seconds.",
    "Your fingers are innocent. Your timing isn't.",
    "The controls have changed. Keep up."
  ],
  r4_patience: [
    "The exit is right there. Time is the problem.",
    "Try the ancient technique known as waiting.",
    "Your patience is being evaluated."
  ],
  deaths5: "Death number {deaths}. The thermometer is not impressed.",
  deaths10: "Fine. I will show you.",
  idle20: "Standing still is also a strategy. A bad one."
};
export const PATIENCE_MESSAGE = 'Your patience is appreciated';
export const ENDING_CARDS = ["There's nothing wrong with you.", 'The world just needed someone to turn the colors back on.', 'THE END'];
export const RED_FROM_START = true;

// ---------------------------------------------------------------- the four rooms (y is the TOP of a platform)
export const LEVEL7_DATA = {
  width: 1280, height: 720, spawn: { x: 80, y: 600 },
  rooms: [
    {
      id: 1, name: 'RULE SHIFT', key: 'r1_rule',
      platforms: [{ x: 0, y: 640, w: 260, h: 80 }, { x: 420, y: 600, w: 140, h: 24 }, { x: 1120, y: 560, w: 160, h: 160 }],
      movers: [
        { x0: 600, x1: 740, y: 600, w: 130, h: 20, speed: 90 },                   // the rule: patrols back and forth
        { x0: 880, x1: 980, y: 580, w: 120, h: 20, speed: 70, shy: true },        // the shift: reverses when approached
      ],
      hazards: [{ x: 260, y: 696, w: 860, h: 24, dir: 'up' }],
      hidden: [{ x: 520, y: 584, w: 40, h: 16, trigger: { x: 470, y: 480, w: 90, h: 124 } }],
      exit: { x: 1190, y: 560 },
      signs: [{ x: 205, y: 470, text: 'RULE: PLATFORMS PATROL\nBACK AND FORTH.' }, { x: 930, y: 450, text: '...MOST OF THEM.' }],
      hint: 'that first ledge has teeth on its far end. Jump early.',
    },
    {
      id: 2, name: 'PHYSICS BETRAYAL', key: 'r2_physics',
      platforms: [{ x: 0, y: 640, w: 240, h: 80 }, { x: 330, y: 580, w: 120, h: 24 }, { x: 560, y: 500, w: 120, h: 24 }, { x: 740, y: 300, w: 120, h: 24 },
        { x: 960, y: 420, w: 320, h: 300 }, { x: 600, y: 0, w: 300, h: 40 }],
      movers: [],
      hazards: [{ x: 240, y: 696, w: 720, h: 24, dir: 'up' }, { x: 600, y: 40, w: 300, h: 24, dir: 'down' }],
      gravityZone: { x0: 600, x1: 900, factor: 0.45 },
      hidden: [{ x: 1060, y: 404, w: 40, h: 16, trigger: { x: 960, y: 300, w: 100, h: 120 } }],
      exit: { x: 1190, y: 420 },
      signs: [{ x: 430, y: 380, text: 'WARNING:\nLOW GRAVITY AHEAD' }, { x: 900, y: 250, text: 'GRAVITY\nRESTORED >' }],
      hint: 'in low gravity a full jump finds the ceiling. Walk off the high ledge instead.',
    },
    {
      id: 3, name: 'THE CONTROL GLITCH', key: 'r3_controls',
      platforms: [{ x: 0, y: 640, w: 300, h: 80 }, { x: 420, y: 600, w: 200, h: 24 }, { x: 760, y: 560, w: 200, h: 24 }, { x: 1080, y: 600, w: 200, h: 120 }],
      movers: [],
      hazards: [{ x: 300, y: 696, w: 780, h: 24, dir: 'up' }, { x: 840, y: 542, w: 40, h: 18, dir: 'up' }],
      controlGlitch: true,
      hidden: [{ x: 1100, y: 584, w: 30, h: 16, trigger: { x: 1000, y: 380, w: 90, h: 220 } }],
      exit: { x: 1215, y: 600 },
      signs: [{ x: 205, y: 520, text: 'OBSERVE FIRST.\nCONTROLS MAY VARY.' }],
      hint: 'the last landing bites. Jump long, on a NORMAL beat.',
    },
    {
      id: 4, name: 'THE PATIENCE TEST', key: 'r4_patience',
      platforms: [{ x: 0, y: 640, w: 1280, h: 80 }, { x: 0, y: 0, w: 1280, h: 80 }],
      movers: [],
      hazards: [],
      lasers: [540, 600, 660, 720].map((x) => ({ x: x - 5, y: 80, w: 10, h: 560 })),
      patience: 7.0,
      hidden: [{ x: 940, y: 624, w: 40, h: 16, trigger: { x: 860, y: 500, w: 80, h: 140 } }],
      exit: { x: 1170, y: 640 },
      signs: [{ x: 300, y: 560, text: 'EXIT: THAT WAY.\nADMISSION: TIME.' }],
      hint: 'the lasers switch off by themselves. Just wait.',
    },
  ],
};
export const DOOR = { w: 56, h: 96 };
export const doorRect = (exit) => ({ x: exit.x - DOOR.w / 2, y: exit.y - DOOR.h, w: DOOR.w, h: DOOR.h });

// ---------------------------------------------------------------- Fever
export const feverOf = (totalDeaths) => Math.min(100, totalDeaths * 6);
export const vignetteAlpha = (F) => (0.55 * F) / 100;
export const MERCY_DEATHS = 4;

// ---------------------------------------------------------------- room mechanics (pure state machines)
/** Room 3: normal for 3 s, mirrored for 3 s, alternating. Jump is never inverted. */
export class ControlGlitch {
  constructor(period = 3) { this.period = period; this.t = 0; }
  reset() { this.t = 0; }
  update(dt) { this.t += dt; }
  get mirrored() { return Math.floor(this.t / this.period) % 2 === 1; }
  get timeToShift() { return this.period - (this.t % this.period); }
  get warning() { return this.timeToShift <= 0.5; }
}

/** Room 4: lasers on for exactly `duration` seconds of active time, then off for the rest of the attempt. */
export class PatienceTimer {
  constructor(duration = 7.0) { this.duration = duration; this.t = 0; this.off = false; }
  reset() { this.t = 0; this.off = false; }
  /** Advances the timer; returns true on the single update in which the lasers switch off. */
  update(dt) {
    if (this.off) return false;
    this.t = Math.min(this.duration, this.t + dt);
    if (this.t >= this.duration - 1e-9) { this.t = this.duration; this.off = true; return true; }   // tolerance for float sums of dt
    return false;
  }
  get remaining() { return Math.max(0, this.duration - this.t); }
  get lasersOn() { return !this.off; }
}

/** Ping-pong moving platform. A `shy` mover reverses (once per approach) when the player comes near it. */
export function stepMover(m, dt, playerX) {
  const s = { ...m };
  if (s.shy) {
    const cx = s.x + s.w / 2, d = Math.abs(playerX - cx), toward = Math.sign(playerX - cx) === Math.sign(s.vx);
    s.warn = d < 320 && !s.shyUsed;
    if (!s.shyUsed && d < 220 && toward) { s.vx = reflectVx(s.vx); s.shyUsed = true; s.flash = 0.4; }
    else if (d > 340) s.shyUsed = false;
  }
  s.x += s.vx * dt;
  if (s.x < s.x0) { s.x = s.x0; s.vx = Math.abs(s.vx); }                       // reflect off the left bound
  else if (s.x > s.x1) { s.x = s.x1; s.vx = -Math.abs(s.vx); }                 // reflect off the right bound
  s.flash = Math.max(0, (s.flash ?? 0) - dt);
  return s;
}
export const moverStart = (m) => ({ ...m, x: m.x0, vx: m.speed, shyUsed: false, warn: false, flash: 0 });

/** Room 2: gravity is scaled inside the marked zone; leaving it restores full gravity. */
export const gravityAt = (room, x) => (room.gravityZone && x >= room.gravityZone.x0 && x < room.gravityZone.x1 ? PHYS.gravity * room.gravityZone.factor : PHYS.gravity);

// ---------------------------------------------------------------- narrator
/** Deterministic line choice for a death in a room; milestones at 5 and 10 total deaths win. */
export function deathLine(roomKey, roomDeaths, totalDeaths) {
  if (totalDeaths === 5) return NARRATOR.deaths5.replace('{deaths}', String(totalDeaths));
  if (totalDeaths === 10) return NARRATOR.deaths10;
  const lines = NARRATOR[roomKey];
  return lines[(Math.max(1, roomDeaths) - 1) % lines.length];
}

/** One transient line at a time (fades after 3.5 s); an optional persistent line can never be overwritten by it. */
export class Narrator {
  constructor(ttl = 3.5) { this.ttl = ttl; this.text = ''; this.t = 0; this.persistent = null; }
  say(text) { this.text = text; this.t = this.ttl; }
  setPersistent(text) { this.persistent = text; }
  clearPersistent() { this.persistent = null; }
  clear() { this.text = ''; this.t = 0; }
  update(dt) { if (this.t > 0) { this.t = Math.max(0, this.t - dt); if (this.t === 0) this.text = ''; } }
  get alpha() { return this.t <= 0 ? 0 : Math.min(1, this.t / 0.5, (this.ttl - this.t) / 0.15 + 0.2); }
  /** What the main bubble shows: the persistent line wins; transient lines then go to the small sub-bubble. */
  get main() { return this.persistent ?? (this.t > 0 ? this.text : ''); }
  get sub() { return this.persistent && this.t > 0 ? this.text : ''; }
}

/** Coyote time + jump buffer bookkeeping. */
export class JumpAssist {
  constructor() { this.sinceGround = 99; this.sinceJumpPress = 99; }
  update(dt, grounded) { this.sinceGround = grounded ? 0 : this.sinceGround + dt; this.sinceJumpPress += dt; }
  press() { this.sinceJumpPress = 0; }
  /** Returns true (and consumes both windows) when a jump should start now. */
  consume() {
    if (this.sinceJumpPress <= PHYS.buffer && this.sinceGround <= PHYS.coyote) { this.sinceJumpPress = 99; this.sinceGround = 99; return true; }
    return false;
  }
}
