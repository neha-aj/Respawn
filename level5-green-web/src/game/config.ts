/* GREEN — constants, palette and the fixed maze. Same numbers as green.py. */
export const W = 900, H = 650, CELL = 52;
export const TIME_LIMIT = 600;                       // 10:00 — a timeout restarts the level
export const LIVES = 3;
export const WALK = 118, SPRINT = 190;               // px/s — sprint is 1.61× walk
export const PLAYER_R = 12, PHANTOM_R = 15, RUNE_R = 14;
export const PH_WANDER = 78, PH_SEARCH = 96, PH_HUNT = 150;   // faster than walking, slower than sprinting
export const HEAR_RANGE = 480, SENSE_RANGE = 90;
export const RING_COOLDOWN = 0.6, RING_LIFE = 0.9, RING_MAX = 150;
export const SEARCH_TIME = 3.5;
export const LIGHT_RANGE = 330, LIGHT_HALF = (32 * Math.PI) / 180;
export const AMBIENT_R = 105;
export const JUMPSCARE_FRAMES = 60;
export const SPAWN_PROTECT = 1.2;
export const RITUAL_TIME = 3.0, DOOR_PHASE = 1.6;

export type RGB = readonly [number, number, number];
/** Strict green palette — spec primaries first, then intermediate greens. */
export const C = {
  VOID: [2, 10, 3], GROUND: [12, 37, 14], WALL: [26, 74, 30], PLAYER: [133, 255, 133], LIGHT: [57, 255, 20], PHANTOM: [10, 56, 22], PORTAL: [200, 255, 200],
  DEEP: [5, 20, 7], DARKWALL: [9, 28, 11], MOSS: [30, 70, 32], GRASS: [64, 116, 54], GRASS_HI: [88, 146, 74], GRASS_LO: [46, 92, 44], DIRT: [54, 88, 46],
  BARK: [16, 44, 19], BARK_HI: [40, 86, 42], LEAF: [40, 104, 44], LEAF_HI: [72, 150, 70], STONE: [70, 100, 70], STONE_HI: [98, 134, 96],
  TEXT: [160, 232, 160], TEXT_DIM: [88, 150, 90], GLOW: [110, 255, 110], PALE: [170, 240, 170], ARMOR: [38, 110, 46], ARMOR_HI: [96, 180, 84], SKIN_LO: [70, 170, 78],
  GH_D: [24, 90, 60], GH_SKIN: [58, 170, 118], GH_L: [110, 220, 160], GH_XL: [160, 245, 190], GH_EYE: [215, 255, 225], GH_GUM: [110, 190, 50], GH_SOCK: [8, 34, 20],
  MUSH: [120, 190, 116], MOTE: [120, 220, 110], ROOT: [22, 58, 26], EDGE: [24, 96, 40], CRACK: [30, 110, 40], TEETH_D: [40, 100, 30], MOUTH: [6, 26, 12],
} as const satisfies Record<string, RGB>;
export const rgb = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
export const scale = (c: RGB, k: number) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;

export const MAP = [
  '###############################',
  '#1............#.......#......2#',
  '#.#######.#.#.#.#.#.#.#.#.###.#',
  '#...#...#.#....H#...#.#.#...#.#',
  '#.#.#.#.#.#.#.#.#.#.###.#.#.#.#',
  '#.#.#...#.........#...#.#.#...#',
  '#.#.#.#.#.#######.###.#.#.###.#',
  '#.#...#.#.#.........#...#.#...#',
  '#.#####.#.#.........#.###.#####',
  '#.#.................#...#.....#',
  '#.#.###.#.#...TTT...###.#####.#',
  '#.#.......#...TPT...#.#.#.#...#',
  '###.#.#.#.#...TDT...#.#.#.#.###',
  '#.....#.#.#.............#.....#',
  '#.#######.#.........#.###.###.#',
  '#.....#...#.........#.#.....#.#',
  '#.###.#.#######.#####.#.#.###.#',
  '#...#.#.#...............#.#...#',
  '#####.#.#.#.#####.#.#######.#.#',
  '#...#...#.#.......#.#.......#.#',
  '#.#.#####.#.#########.#######.#',
  '#S#.......#...........#......3#',
  '###############################',
];
export const RUNE_NAMES = ['RUNE OF ROOT', 'RUNE OF THORN', 'RUNE OF VEIL'];

export const LEVEL = {
  title: 'GREEN',
  tagline: 'THREE RUNES. ONE HAUNTED FOREST.',
  goal: 'FIND THE RUNES. RETURN TO THE TREE. ENTER THE DOOR.',
  controls: ['WASD / ARROWS — MOVE', 'SHIFT — SPRINT AND MAKE NOISE', 'MOUSE — AIM FLASHLIGHT'],
  over: ['THE FOREST HAS CLAIMED YOU', 'PRESS R TO TRY AGAIN'],
  victory: ['PHASE DOOR UNLOCKED.', 'TRANSITIONING TO LEVEL: YELLOW', 'PRESS R TO REPLAY GREEN'],
};
export const RULES_PLACEHOLDER = {
  isPlaceholder: true,
  lines: [
    'Thanos is lost in a haunted forest. Find the three green runes.',
    'A phantom wanders the maze. It cannot see you — it hunts by sound.',
    'Sprinting (SHIFT) makes noise rings; it hears them from about nine paces.',
    'Walking is silent, but it will sense you if you brush right past it.',
    'Your flashlight reveals the phantom; it never reveals you.',
    'Three lives. Runes you carry stay with you when you fall.',
    'With all three runes, return to the giant tree. Its door will open.',
    'Walk through the door into the portal before the 10:00 timer ends.',
  ],
  controls: 'WASD / arrows move · SHIFT sprint · mouse aims · P / Esc pause · M mute · R restart',
};
