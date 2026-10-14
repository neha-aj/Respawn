/* ORANGE — constants, palette, words, pixel font and dance poses. Same numbers as orange.py. */
export const W = 900, H = 650, SCALE = 2, LW = 450, LH = 325;   // pixel-art canvas, scaled ×2 with hard pixels
export const CHALLENGE = 60;
export const TARGET_WPM = 40, TARGET_ACC = 88;
export const BPM = 120, BEAT = 60 / BPM;
export const VICTORY_DANCE_T = 2.6, DOOR_T = 2.6, ENTRY_T = 3.2;
export const MAX_PARTICLES = 260;
export const GROUND = 236, DANCER_X = 150;

export type RGB = readonly [number, number, number];
/** Strict orange palette — spec primaries first, then orange-derived shades. */
export const C = {
  STAGE: [58, 19, 0], SPOT: [255, 102, 0], DANCER: [255, 153, 0], HUD: [255, 229, 204], DOOR: [255, 240, 224],
  INK: [20, 6, 0], DEEP: [40, 12, 0], DARK: [90, 32, 0], BURNT: [140, 52, 0], TERRA: [180, 70, 10], MID: [230, 110, 20],
  AMBER: [255, 176, 64], LAMBER: [255, 204, 128], PEACH: [255, 190, 120], SKIN_SH: [214, 112, 0], HI: [255, 196, 110], GLOWC: [255, 140, 30],
  PANEL: [66, 22, 0],
} as const satisfies Record<string, RGB>;
export const rgb = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
export const scale = (c: RGB, k: number) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;

export const SENTENCES = [                             // original lines; dealt from a shuffled deck so none repeats
  'THANOS DANCES ON THE STAGE TONIGHT.',
  'THE GAUNTLET GLOWS WITH EVERY BEAT.',
  'SIX STONES SPARKLE UNDER THE LIGHTS.',
  'THE CROWD WAVES THEIR GLOWSTICKS HIGH.',
  'A TITAN NEVER MISSES A SINGLE STEP.',
  'SPIN AROUND AND SNAP YOUR FINGERS.',
  'THE SPEAKERS SHAKE THE WHOLE CLUB.',
  'BALANCE THE RHYTHM, BALANCE THE WORLD.',
  'THE AVENGERS WATCH IN SILENCE.',
  'EVERY KEY YOU PRESS IS A NEW MOVE.',
  'THE DISCO FLOOR LIGHTS UP IN ORANGE.',
  'KEEP YOUR FINGERS LIGHT AND QUICK.',
  'THE BASS LINE BOUNCES OFF THE WALLS.',
  'IRON MAN CANNOT BELIEVE HIS EYES.',
  'THOR DROPS HIS HAMMER IN SURPRISE.',
  'THE HULK TRIES TO DANCE BUT FALLS.',
  'SPIDER MAN FEELS A STRANGE TINGLE.',
  'CAPTAIN AMERICA SALUTES THE GROOVE.',
  'BLACK WIDOW TAPS HER FOOT TO THE BEAT.',
  'DOCTOR STRANGE SEES ONE WINNING DANCE.',
  'GROOT SWAYS SLOWLY IN THE BACK ROW.',
  'LOKI CLAIMS HE TAUGHT THANOS TO DANCE.',
  'THE PHASE DOOR WAITS BEHIND THE SPEAKERS.',
  'TYPE FAST AND THE TITAN WILL GROOVE.',
  'A PERFECT SPIN EARNS A LOUD CHEER.',
  'THE SPOTLIGHTS SWEEP ACROSS THE CROWD.',
  'ONE MORE SONG BEFORE THE FINAL SNAP.',
  'THE MUSIC NEVER STOPS ON TITAN.',
  'STARS FLICKER ABOVE THE DANCE FLOOR.',
  'THANOS WEARS SUNGLASSES INDOORS.',
  'THE PURPLE GIANT LOVES A GOOD BEAT.',
  'HEROES AND VILLAINS SHARE ONE STAGE.',
  'FOLLOW THE RHYTHM WITH YOUR HANDS.',
  'THE INFINITY STONES HUM IN TUNE.',
  'A COSMIC PARTY NEEDS A COSMIC DJ.',
  'STEP LEFT, STEP RIGHT, NOW JUMP HIGH.',
  'THE GAUNTLET CLICKS ON EVERY SNAP.',
  'NEVER STOP MOVING YOUR FEET.',
  'THE ORANGE GLOW FILLS THE ROOM.',
  'SMOOTH MOVES BEAT SPEED EVERY TIME.',
  'THE CROWD CHANTS THE NAME OF THE TITAN.',
  'HAWKEYE AIMS AN ARROW AT THE DISCO BALL.',
  'ANT MAN DANCES ON THE SPEAKER CONE.',
  'THE GUARDIANS BROUGHT THEIR OWN MIXTAPE.',
  'STAR LORD WANTS A DANCE BATTLE.',
  'ROCKET COUNTS EVERY MISSED STEP.',
  'VISION FLOATS ABOVE THE DANCE FLOOR.',
  'THE BEAT DROPS AND THE ROOM JUMPS.',
  'A SINGLE SNAP CAN END THE SONG.',
  'KEEP CALM AND KEEP TYPING.',
  'THE TITAN BOWS TO A ROARING CROWD.',
  'SHUFFLE YOUR FEET AND SWING YOUR ARMS.',
  'THE NIGHT IS YOUNG AND THE MUSIC IS LOUD.',
  'FIND THE RHYTHM AND HOLD IT TIGHT.',
  'NO HERO CAN STOP THIS GROOVE.',
  'THE DRUMS ROLL LIKE DISTANT THUNDER.',
  'WAKANDA SENDS ITS BEST DRUMMERS.',
  'THE BALCONY SHAKES WITH EVERY BASS HIT.',
  'FALCON GLIDES OVER THE CHEERING FANS.',
  'THE LAST SONG BELONGS TO THANOS.',
];
export const TYPABLE = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ .,');
export const LINE_CHARS = 40;                          // the sentence panel wraps at 40 characters per line
/** Greedy word wrap; returns [start index, line] pairs. Each line keeps its trailing space. */
export function wrap(text: string, width = LINE_CHARS): [number, string][] {
  const lines: [number, string][] = []; let start = 0, cur = '';
  for (const word of text.split(' ')) { if (cur && cur.length + word.length > width) { lines.push([start, cur]); start += cur.length; cur = ''; } cur += word + ' '; }
  lines.push([start, cur.slice(0, -1)]);
  return lines;
}

/** 5×7 pixel font: glyph + seven hex rows (5 bits each). */
const FONT_SRC = 'A0e11111f111111|B1e11111e11111e|C0e11101010110e|D1e11111111111e|E1f10101e10101f|F1f10101e101010|G0e11101711110f|' +
  'H1111111f111111|I0e04040404040e|J0702020202120c|K11121418141211|L1010101010101f|M111b1515111111|N11111915131111|' +
  'O0e11111111110e|P1e11111e101010|Q0e11111115120d|R1e11111e141211|S0f10100e01011e|T1f040404040404|U1111111111110e|' +
  'V111111111 10a04|W1111111515150a|X11110a040a1111|Y11110a04040404|Z1f01020408101f|00e11131519110e|1040c040404040e|' +
  '20e11010204081f|31f02040201110e|402060a121f0202|51f101e0101110e|60608101e11110e|71f010204080808|80e11110e11110e|' +
  '90e11110f01020c|.000000000 00c0c|,000000000c0408|:000c0c000c0c00|%181902040813 03|/00010204081000|-0000001f000000|' +
  '!04040404040004|?0e110102040004|\'04040800000000|(02040808080402|)08040202020408|+0004041f040400|=00001f001f0000|' +
  '>08040201020408|<02040810080402|*00000004000000|#0a0a1f0a1f0a0a';
export const FONT: Record<string, number[]> = { ' ': [0, 0, 0, 0, 0, 0, 0] };
for (const raw of FONT_SRC.split('|')) { const g = raw.replace(/ /g, ''); FONT[g[0]] = Array.from({ length: 7 }, (_, i) => parseInt(g.slice(1 + 2 * i, 3 + 2 * i), 16)); }
FONT['·'] = FONT['*'];

export interface Pose { lean: number; ls: number; le: number; rs: number; re: number; lh: number; lk: number; rh: number; rk: number; dx: number; dy: number; twist: number }
const P = (lean: number, ls: number, le: number, rs: number, re: number, lh: number, lk: number, rh: number, rk: number, dx: number, dy: number, twist: number): Pose => ({ lean, ls, le, rs, re, lh, lk, rh, rk, dx, dy, twist });
export const POSES: Record<string, Pose> = {
  idle: P(0, .25, .4, .25, .4, .08, 0, .08, 0, 0, 0, 1),
  swingL: P(-.12, 1.9, .5, .3, 1.2, .12, 0, .05, .2, -2, 0, 1),
  swingR: P(.12, .3, 1.2, 1.9, .5, .05, .2, .12, 0, 2, 0, 1),
  up: P(0, 2.75, .2, 2.75, .2, .1, 0, .1, 0, 0, -3, 1),
  stepL: P(-.1, 1.2, .9, .6, .3, .5, .3, .04, 0, -9, 0, 1),
  stepR: P(.1, .6, .3, 1.2, .9, .04, 0, .5, .3, 9, 0, 1),
  twist: P(.06, 1.4, 1.6, .25, -.6, .2, .4, .05, 0, 0, 1, .45),
  dip: P(0, 1.45, .1, 1.45, .1, .65, -1.1, .65, -1.1, 0, 0, 1),
  point: P(.08, .7, -1.9, 2.8, 0, .06, 0, .45, .6, 0, 0, 1),
  jump: P(0, 2.5, .4, 2.5, .4, .35, 1.0, .35, 1.0, 0, -14, 1),
  stumble: P(.35, 1.2, 1.5, .1, 0, .1, 0, .45, .3, 4, 1, .8),
  victory: P(-.06, .75, -1.9, 2.85, -.1, .05, 0, .5, .7, 0, -2, 1),
  collapse: P(.85, .2, .1, .35, .2, .95, -1.75, .9, -1.75, 0, 3, .9),
};
export const CHOREO = ['swingL', 'swingR', 'stepL', 'point', 'stepR', 'twist', 'up', 'dip'];
export const TORSO = 20, SHW = 10, HIPW = 5, UA = 10, FA = 9, TH = 10, SH = 10;
export const HEROES = ['ironman', 'cap', 'thor', 'hulk', 'spidey', 'widow', 'panther', 'strange'] as const;
export const RULES_PLACEHOLDER = {
  isPlaceholder: true,
  lines: ['TYPE THE SENTENCE ON SCREEN, SPACES AND ALL.', 'EVERY CORRECT KEY IS A DANCE MOVE FOR THANOS.', 'WRONG KEYS ARE ERRORS - BACKSPACE CANNOT ERASE THEM.',
    'BACKSPACE ONLY FIXES THE CURRENT SENTENCE.', 'HOLD 40 WPM WITH 88% ACCURACY FOR 60 SECONDS.', 'WPM = CORRECT CHARACTERS / 5 PER MINUTE.', 'ESC PAUSES. WIN AND THE PHASE DOOR OPENS.'],
};
