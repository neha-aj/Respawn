/* The running order of the full game.
 *
 * Each chapter is: [optional colour video] → level. Between chapters the shell plays its
 * transitions (victory hold → iris close → spectrum card → video → colour bloom → iris open).
 *
 * Slots still to come (do not exist yet, add them here when they arrive):
 *   1. INTRO   — VIBGYOR photo with its own tune, before everything else
 *   2. OPENING — the game's mp4 video, after the intro and before BnW
 *  18. ENDING  — the ending sequence, after RED (see `finale` in App.tsx)
 */

export type LevelId = 'bnw' | 'violet' | 'indigo' | 'blue' | 'green' | 'yellow' | 'orange' | 'red';

export interface Chapter {
  id: LevelId;
  name: string;
  /** Page loaded in the level's iframe. */
  src: string;
  /** Accent colour for the transitions into this chapter. */
  color: string;
  /** Index in the spectrum strip (0 = V … 6 = R); null for BnW. */
  band: number | null;
  /** Colour video played before the level, if any. */
  video?: string;
  /** How long to hold on the level's own victory screen before moving on (ms). */
  hold: number;
}

/** The seven spectrum bands, in rainbow order (the strip on the transition cards). */
export const SPECTRUM = [
  { letter: 'V', name: 'VIOLET', color: '#9B30FF' },
  { letter: 'I', name: 'INDIGO', color: '#6A4BFF' },
  { letter: 'B', name: 'BLUE', color: '#1E90FF' },
  { letter: 'G', name: 'GREEN', color: '#39FF14' },
  { letter: 'Y', name: 'YELLOW', color: '#FFD400' },
  { letter: 'O', name: 'ORANGE', color: '#FF7A00' },
  { letter: 'R', name: 'RED', color: '#FF1E2D' },
] as const;

const band = (i: number, id: LevelId, src: string, hold = 5200): Chapter => ({
  id, name: SPECTRUM[i].name, src, color: SPECTRUM[i].color, band: i, video: `videos/${SPECTRUM[i].letter}.mp4`, hold,
});

export const CHAPTERS: Chapter[] = [
  // (1. INTRO and 2. OPENING video go before this, when they arrive)
  { id: 'bnw', name: 'BnW', src: 'bnw.html', color: '#FFFFFF', band: null, hold: 5200 },
  band(0, 'violet', 'levels/violet/index.html'),
  band(1, 'indigo', 'levels/indigo/index.html'),
  band(2, 'blue', 'levels/blue/index.html'),
  band(3, 'green', 'levels/green/index.html'),
  band(4, 'yellow', 'levels/yellow/index.html'),
  band(5, 'orange', 'levels/orange/index.html'),
  // RED types out its own closing cards after the win (~10 s), so it holds longer.
  band(6, 'red', 'levels/red/index.html', 12000),
  // (18. ENDING goes after this, when it arrives)
];

/** `?chapter=green` starts the run at that chapter (handy for testing and demos). */
export function startChapter(): number {
  const id = new URLSearchParams(window.location.search).get('chapter');
  const i = CHAPTERS.findIndex((c) => c.id === id);
  return i < 0 ? 0 : i;
}
