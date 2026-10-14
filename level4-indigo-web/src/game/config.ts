/* INDIGO. Constants mirror level4-indigo/indigo.py exactly. */
export const W = 900, H = 650, FPS = 60;
export const TIME_LIMIT = 300;
export const LIVES = 3, SHOTS = 8;
export const TOP = 56, BOTTOM = 644, LEFT = 6, RIGHT = 894;

/** Monochrome indigo / violet palette. */
export const C = {
  bg: '#08001A', grid: '#14052B', ship: '#4B0082', well: '#1A0033', laser: '#6C2DC7', struct: '#1E003B', portal: '#A066FF',
  deep: '#2C0A5C', mid: '#5828AA', soft: '#8C6EE6', pale: '#C8B6FF', lilac: '#B08CFF', white: '#E8E0FF',
} as const;

export type P = [number, number];
export const SPAWN: P = [80, 300], CHECKPOINT_X = 482, CHECKPOINT_SPAWN: P = [515, 350];
export const WALLS: [P, P][] = [
  [[250, 56], [275, 215]], [[275, 485], [250, 644]],        // Drift | Singularity divider (gap 215–485)
  [[480, 56], [470, 200]], [[470, 500], [480, 644]],        // Singularity | Polarity divider (gap 200–500)
  [[540, 200], [620, 160]], [[540, 500], [620, 540]],       // angled reflectors
];
export const WELLS: [P, number, number, number][] = [[[150, 505], 140, 16, 55], [[365, 350], 330, 24, 72], [[760, 565], 200, 18, 60]];
export const NODES: P[] = [[365, 118], [365, 590], [560, 92], [690, 612]];
export const LASER_PIVOT: P = [600, 350], LASER_HALF = 170;
export const GATE_X = 810, GATE_W = 40, GATE_Y = 350, SAFE_GATE_SPEED = 4.5;
export const SHIP = { R: 11, THRUST: 0.11, REVERSE: 0.06, TURN: 0.07, VMAX: 6.5 };

export const LEVEL = { title: 'INDIGO', victory: ['PHASE DOOR UNLOCKED', 'TRANSITIONING TO LEVEL: BLUE'] };

/** PLACEHOLDER — final rules will be supplied later. */
export const RULES_PLACEHOLDER = {
  isPlaceholder: true,
  lines: [
    'Fly through four zones and enter the Indigo Gate between the two monoliths.',
    'W thrusts forward; momentum stays when you let go. S brakes. A/D rotate.',
    'Gravity wells pull with an inverse-square force; touching a core costs a life.',
    'SPACE fires an anchor (8 total). Hit a node to swing on a tether; SPACE releases.',
    'Cross the laser when it is dim (safe), or align your heading with it (±15°).',
    'Walls reflect you (v′ = v − 2(v·n)n). Very hard impacts damage the hull.',
    'Enter the gate at speed 4.5 or less. 3 lives, 5 minutes. A checkpoint follows Zone 2.',
    'Run out of lives or time and the level restarts from the beginning.',
  ],
  controls: 'W thrust · S brake · A/D rotate · SPACE anchor/release · P pause · M mute · R restart · Esc menu',
};
