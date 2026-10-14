/* YELLOW — constants, palette, frame data and poses. Same numbers as yellow.py (canvas px per frame at 60 Hz). */
export const W = 900, H = 650, SCALE = 2, LW = 450, LH = 325, FIG = 2;
export const GROUND = 262;
export const ARENA_L = 22, ARENA_R = 388, ARENA_R_OPEN = 446;
export const FPS = 60, ROUND_TIME = 99 * 60;
export const MAX_PARTICLES = 240;

export type RGB = readonly [number, number, number];
/** Strict yellow palette — spec primaries first, then yellow/amber/gold/cream shades. */
export const C = {
  BG: [77, 61, 0], FLOOR: [128, 102, 0], PLAYER: [255, 255, 0], MONK: [153, 128, 0], FX: [255, 255, 204], ENERGY: [255, 234, 0], DOOR: [255, 254, 224],
  INK: [20, 16, 0], DEEP: [38, 30, 0], DARK: [56, 45, 0], MUTED: [102, 82, 0], GOLD: [179, 149, 0], GOLD_HI: [217, 181, 0],
  SKIN: [235, 210, 0], SKIN_SH: [190, 165, 0], CREAM: [255, 250, 200], AMBER: [235, 200, 20], OLIVE: [120, 100, 10], TAN: [214, 186, 70],
  PANEL: [66, 52, 0], PANEL_E: [58, 46, 0], THRONE: [64, 51, 0], STEP: [70, 56, 0], FLOOR_HI: [110, 88, 0], FLOOR_LN: [112, 90, 0], RING: [140, 112, 0],
  NEB1: [90, 72, 0], NEB2: [110, 88, 0], NEB3: [70, 56, 0],
} as const satisfies Record<string, RGB>;
export const rgb = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
export const scale = (c: RGB, k: number) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;

export const WALK = 2.7, ACCEL = 0.55, FRICTION = 0.72;
export const JUMP_V = -8.4, GRAVITY = 0.38;          // jump height = v² / 2g ≈ 93 px
export const ENEMY_WALK = 1.9;

export interface Move { startup: number; active: number; recovery: number; dmg: number; kb: number; stun: number; box: [number, number, number, number]; hitstop: number; shake: number }
export const PLAYER_HP = 100, ENEMY_HP = 140;
export const PLAYER_MOVES: Record<'light' | 'heavy', Move> = {
  light: { startup: 5, active: 4, recovery: 9, dmg: 6, kb: 3.0, stun: 14, box: [12, 68, -100, -56], hitstop: 4, shake: 2 },
  heavy: { startup: 16, active: 6, recovery: 24, dmg: 15, kb: 6.0, stun: 22, box: [0, 96, -128, -24], hitstop: 7, shake: 5 },
};
export const ENEMY_MOVES: Record<'light' | 'heavy', Move> = {
  light: { startup: 10, active: 5, recovery: 18, dmg: 7, kb: 3.5, stun: 16, box: [12, 80, -84, -44], hitstop: 4, shake: 2 },
  heavy: { startup: 30, active: 7, recovery: 34, dmg: 16, kb: 7.0, stun: 24, box: [0, 108, -60, -4], hitstop: 7, shake: 5 },
};
export const PLAYER_INVULN = 40, ENEMY_INVULN = 8;
export const DODGE_FRAMES = 16, DODGE_SPEED = 7.0, DODGE_IFRAMES: [number, number] = [1, 12], DODGE_LOCK = 8, DODGE_COOLDOWN = 55;
export const CHARGE_RATE = 0.8;
export const BRACE_FRAMES = 20, WAVE_SPEED = 6.5, WAVE_RANGE = 230;
export const FLASH_STUN = 90, FLASH_DMG = 8;
export const ENEMY_ATTACK_GAP = 40;
export const DEFEAT_T = 90, BARRIER_T = 120, CRACK_T = 60, REVEAL_T = 100, VICTORY_FLASH = 40;
export const PORTAL_X = 421, PORTAL_HALF = 13;
export const INTRO_LINES = ['Claws of metal, little mutant. Mine are made of stone.', 'FIGHT!'];
export const VICTORY_TEXT = 'PHASE DOOR UNLOCKED. TRANSITIONING TO LEVEL: ORANGE';

export interface Pose { lean: number; fs: number; fe: number; bs: number; be: number; fh: number; fk: number; bh: number; bk: number; dy: number }
const P0: Pose = { lean: 0.05, fs: 0.5, fe: 0.9, bs: 0.25, be: 0.7, fh: 0.22, fk: 0.15, bh: -0.22, bk: 0.25, dy: 0 };
const pose = (k: Partial<Pose> = {}): Pose => ({ ...P0, ...k });
export const PLAYER_POSES: Record<string, Pose> = {
  idle: pose(),
  jump: pose({ lean: 0.1, fs: 1.1, fe: 1.2, bs: 0.9, be: 1.0, fh: 0.8, fk: 1.3, bh: 0.2, bk: 1.1 }),
  light_start: pose({ lean: -0.05, fs: 1.0, fe: 1.9, bs: 0.4, be: 1.0 }),
  light_hit: pose({ lean: 0.18, fs: 1.57, fe: 0.0, bs: 0.1, be: 0.8, fh: 0.45, fk: 0.3 }),
  heavy_start: pose({ lean: -0.18, fs: 2.9, fe: 0.3, bs: 2.4, be: 0.6, fh: 0.3, bh: -0.4, dy: 1 }),
  heavy_hit: pose({ lean: 0.3, fs: 1.25, fe: 0.05, bs: 1.0, be: 0.3, fh: 0.6, fk: 0.5, bh: -0.5, dy: 3 }),
  dodge: pose({ lean: 0.55, fs: -0.5, fe: 0.6, bs: -0.6, be: 0.6, fh: 0.6, fk: 0.8, bh: -0.7, bk: 0.4, dy: 3 }),
  charge: pose({ lean: 0.0, fs: 0.9, fe: 1.5, bs: 0.9, be: 1.5, fh: 0.45, fk: 0.6, bh: -0.45, bk: 0.6, dy: 4 }),
  brace: pose({ lean: -0.1, fs: 2.0, fe: 0.0, bs: 2.0, be: 0.0, fh: 0.45, fk: 0.4, bh: -0.45, bk: 0.4, dy: 2 }),
  hurt: pose({ lean: -0.35, fs: 0.3, fe: 0.3, bs: 0.2, be: 0.3, fh: -0.1, bh: -0.4 }),
  defeat: pose({ lean: -1.25, fs: 0.1, fe: 0.1, bs: 0.0, be: 0.1, fh: 1.2, fk: 1.9, bh: 1.0, bk: 1.9, dy: 16 }),
  victory: pose({ lean: -0.05, fs: 2.7, fe: 0.2, bs: 0.6, be: 1.4 }),
};
export const ENEMY_POSES: Record<string, Pose> = {             // Wolverine: low, wide, claws-out crouch
  idle: pose({ lean: 0.3, fs: 1.25, fe: 0.45, bs: 1.0, be: 0.6, fh: 0.7, fk: 0.7, bh: -0.65, bk: 0.35, dy: 5 }),
  jump: pose({ lean: 0.2, fs: 1.4, fe: 0.8, bs: 1.0, be: 1.0, fh: 0.9, fk: 1.4, bh: 0.3, bk: 1.2 }),
  light_start: pose({ lean: 0.1, fs: 0.6, fe: 1.6, bs: 0.4, be: 1.4, fh: 0.2, bh: -0.4, dy: 3 }),
  light_hit: pose({ lean: 0.35, fs: 1.57, fe: 0.0, bs: 1.3, be: 0.2, fh: 0.6, fk: 0.4, bh: -0.5, dy: 4 }),
  heavy_start: pose({ lean: -0.3, fs: 2.6, fe: 0.4, bs: 2.2, be: 0.5, fh: 0.2, fk: 0.6, bh: -0.5, bk: 0.6, dy: 6 }),
  heavy_hit: pose({ lean: 0.55, fs: 0.9, fe: 0.0, bs: 0.7, be: 0.2, fh: 0.9, fk: 1.1, bh: -0.7, bk: 0.3, dy: 10 }),
  hurt: pose({ lean: -0.4, fs: 0.4, fe: 0.4, bs: 0.2, be: 0.4, fh: -0.1, bh: -0.4, dy: 2 }),
  stun: pose({ lean: 0.6, fs: 0.1, fe: 0.2, bs: 0.05, be: 0.2, fh: 0.3, fk: 0.7, bh: -0.2, bk: 0.7, dy: 7 }),
  defeat: pose({ lean: 1.35, fs: 0.1, fe: 0.0, bs: 0.0, be: 0.0, fh: 1.3, fk: 1.9, bh: 1.1, bk: 1.9, dy: 18 }),
};
export const THANOS_DIMS = [11, 11, 22, 30, 11, 11] as const;   // thigh, shin, torso, shoulder width, upper arm, forearm
export const WOLVERINE_DIMS = [10, 10, 18, 24, 10, 10] as const;
/** Rules page and controls card — same wording as yellow.py. */
export const RULES: [string, string[]][] = [
  ['GOAL', ['You are THANOS. Knock out WOLVERINE before the 99-second clock hits 0.']],
  ['WIN / LOSE', ['Empty his health bar (top right) to win.', 'You lose if your health bar (top left) empties or time runs out.']],
  ['FIGHTING', ['J is a fast jab. K is a slow sword swing that hits much harder.', 'His claws GLOW before a big lunge - DODGE (SHIFT) or JUMP to avoid it.']],
  ['SOLAR FLASH', ["Hold L to fill the SOLAR meter. You can't move, and any hit cancels it.", 'At 100% press I: a shockwave that stuns him for 1.5 s. Punish him!']],
  ['THE EXIT', ['After the K.O. the barrier shatters. Walk right into the Phase Door.']],
];
export const CONTROLS: [string, string][] = [
  ['A / D  or  LEFT / RIGHT', 'Move'],
  ['W  or  UP', 'Jump'],
  ['J', 'Light attack - Gauntlet jab'],
  ['K', 'Heavy attack - sword swing'],
  ['SHIFT', 'Dodge (short cooldown)'],
  ['hold L', 'Charge the Solar meter'],
  ['I', 'Solar Flash (meter at 100%)'],
  ['ESC', 'Pause'],
  ['C', 'Show / hide this controls card'],
  ['M', 'Mute'],
  ['R', 'Restart (paused or after a round)'],
];
