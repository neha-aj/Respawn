/* ============================================================================
   VIOLET. Constants mirror the Python version
   (level3-violet/violet.py) exactly so both builds play identically.
   ============================================================================ */

export const W = 900, H = 650, FPS = 60;
export const TIME_LIMIT = 120;          // seconds of game time per attempt
export const LIVES = 3, AMMO = 5;
export const BULLET_SPEED = 12, MAX_BOUNCES = 6;
export const GRAVITY = 0.2;             // px / frame² on Thanos's bullets

/** 100 % violet palette: the spec colours plus in-between violets. */
export const C = {
  bg: '#120024', player: '#8F00FF', wall: '#A020F0', proj: '#DCC6FF', scale: '#E0B0FF',
  reflect: '#DA70D6', door: '#F0DCFF', drone: '#4A0E4E',
  deep: '#220440', dim: '#3A0A64', mid: '#6218AA', soft: '#BA8CFF', pale: '#ECDEFF',
} as const;

export interface Rect { x: number; y: number; w: number; h: number }
const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/** Level layout (verified solvable by level.test.ts). */
export const SOLIDS: readonly Rect[] = [
  R(0, 44, 900, 12), R(0, 600, 900, 50), R(0, 44, 16, 606), R(884, 44, 16, 606),
  R(770, 56, 30, 489),                                         // shield pillar hiding the door
  R(70, 470, 220, 14), R(360, 360, 200, 14), R(150, 250, 150, 12),
];
export const FIELDS: readonly { kind: 'reflect' | 'scale'; rect: Rect }[] = [
  { kind: 'reflect', rect: R(770, 545, 30, 55) },               // fills the only slot into the door pocket
  { kind: 'scale', rect: R(560, 500, 90, 100) },
];
export const DOOR_RECT: Rect = R(800, 430, 12, 90);
export const DRONES: readonly [[number, number], number, number][] = [[[230, 160], 60, 0.0], [[470, 228], 70, 2.1], [[650, 175], 55, 4.2]];
export const SPAWN = { x: 40, y: 600 - 76 };

export const LEVEL = {
  name: 'VIOLET',
  title: 'VIOLET',
  tagline: 'You are Thanos. Five bullets. Three drones. One impossible door.',
  victory: 'PHASE DOOR UNLOCKED. TRANSITIONING TO LEVEL: INDIGO',
};

/** PLACEHOLDER — the final rules will be supplied later. */
export const RULES_PLACEHOLDER = {
  isPlaceholder: true,
  lines: [
    'Destroy all 3 security drones, then strike the Phase Door’s core lock.',
    'You have 3 lives, 5 vector bullets and 2:00. Enemy fire costs a life.',
    'Your bullets fall under gravity and ricochet off walls (angle in = angle out).',
    'The scaling field multiplies bullet velocity by 1.6. The reflection field flips it upward.',
    'The door hides behind a pillar: bend a shot through a field and off a wall.',
    'Out of lives, out of bullets or out of time: the level restarts from scratch.',
  ],
  controls: 'A/D or ←/→ move · W/↑/Space jump · mouse aim · click fire · Esc pause · M mute · R restart',
};
