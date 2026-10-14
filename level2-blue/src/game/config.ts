/* ============================================================================
   BLUE — configuration and design tokens.
   Every colour in the game comes from this blue-only palette.
   ============================================================================ */

export const PALETTE = {
  abyss: '#020817',
  navy: '#06152D',
  dark: '#0A2450',
  deep: '#103D78',
  primary: '#1769C2',
  electric: '#258BFF',
  cyan: '#52C7FF',
  pale: '#A5E2FF',
  ice: '#E4F5FF',
} as const;

/** Darkest → brightest. */
export const RAMP = [
  PALETTE.abyss, PALETTE.navy, PALETTE.dark, PALETTE.deep, PALETTE.primary,
  PALETTE.electric, PALETTE.cyan, PALETTE.pale, PALETTE.ice,
] as const;

/** Internal pixel resolution of the game canvas (scaled up with crisp pixels). */
export const VIEW_W = 480;
export const VIEW_H = 270;

/** One shared clock for Levels 1, 2 and 3 together. It starts at Level 1, never resets between
 *  levels (it is frozen on the between-level screens), and running out restarts the run at Level 1.
 *  (Internally the levels keep the ids 2, 3 and 4; LEVEL_INFO[n].number is what the player sees.) */
export const GAME_TIME_MS = 180_000;
/** @deprecated kept for older imports; equals GAME_TIME_MS */
export const LEVEL_TIME_MS = GAME_TIME_MS;

export const LEVEL = {
  number: 1,
  name: 'BLUE',
  title: 'Blue',
  tagline: 'Balance the impossible. Beat the flood.',
  story:
    'Deep beneath the surface, Thanos breaks into a sealed research chamber. Three unknown weights hang ' +
    'from an unstable balance, and three pressure switches guard the only door. Weigh the truth, ' +
    'press the switches from lightest to heaviest, and get out before the water takes the room.',
};

/** Continuation levels (same 90-second clock each). */
export const LEVEL_INFO = {
  2: { number: 1, name: 'UNSTABLE BALANCE', title: 'Unstable Balance', subtitle: LEVEL.tagline, story: LEVEL.story,
       failText: 'The balance was not solved in time.' },
  3: { number: 2, name: 'THE OVERLAP TRAP', title: 'The Overlap Trap', subtitle: 'Every intersection hides another possibility.',
       story: 'Beyond the balance chamber, a sealed geometric security panel blocks the passage. Overlapping squares and crossing diagonals hide triangles inside triangles. The panel opens only for the exact total.',
       failText: 'The geometric count was not submitted in time.' },
  4: { number: 3, name: 'THE REMAINDER LOCK', title: 'The Remainder Lock', subtitle: 'Every condition matters.',
       story: 'The final security chamber. Sixteen numbered tiles guard a digital lock, and only one of them is safe. Find it, reduce it to a single digit, then assemble every clue into the escape code.',
       failText: 'The remainder puzzle or the escape protocol was not completed in time.' },
} as const;

/**
 * Information carried over from the previous game (the starting clue).
 * The larger game can pass its own state into <BlueLevel previousLevel={…} />;
 * this development value is used for standalone testing.
 */
export const DEV_PREVIOUS_LEVEL = {
  geometricOrder: ['TRIANGLE', 'SQUARE', 'PENTAGON'] as const,
};

/**
 * Optional character override. Put a PNG sprite (transparent background,
 * roughly 28×46 px, facing right) in /public and set its path here,
 * e.g. '/thanos.png'. It is recoloured to the blue palette automatically.
 * Leave null to use the built-in pixel-art Thanos.
 */
export const CHARACTER_SPRITE_URL: string | null = null;

/** PLACEHOLDER rules — the official rules will be supplied later. Edit freely. */
export const RULES_PLACEHOLDER = {
  isPlaceholder: true,
  sections: [
    { title: 'Objective', body: 'Work out the three unknown weights, then press the pressure switches from lightest to heaviest to open the exit.' },
    { title: 'Timer', body: 'One 3-minute clock covers Levels 1, 2 and 3 together. It starts when you press Start Level and carries over between levels (it is frozen on the screens between levels). It keeps running while the Intelligence Bag or hints are open; only the pause menu (Esc) stops it.' },
    { title: 'Moving and interacting', body: 'Move with ← → or A / D. Jump with Space (or W / ↑). Press E, or click an object, when Thanos is standing next to it.' },
    { title: 'Entering answers', body: 'Use the console on the left. Type a value for A, B and C, then press Enter or Weigh. The balance shows whether each value is right.' },
    { title: 'Switches', body: 'Once all three weights are verified, the switches unlock. Stand on a switch and press E (or click it). A wrong order resets the sequence, with no penalty.' },
    { title: 'When time runs out', body: 'The chamber floods and Thanos starts again from Level 1 with a fresh 3 minutes. Clues from Levels 1–3 are cleared; the starting clue is kept.' },
  ],
};

/** Rules for the continuation levels (Levels 2 and 3 on screen). */
export const RULES_CONTINUATION = {
  3: [
    { title: 'Objective', body: 'Count every distinct triangle in the displayed diagram and enter the total.' },
    { title: 'What counts', body: 'Larger triangles count separately from the smaller triangles inside them. A valid triangle needs three complete straight sides. Never count the same triangle twice.' },
    { title: 'Tools', body: 'Inspect the diagram, zoom into any quarter, hover a line to trace it, and click three corners to test whether they form a triangle.' },
    { title: 'Answers', body: 'Type a number and submit. A wrong answer does not fail the level; try again while the clock runs.' },
    { title: 'Timer', body: 'The shared 3-minute clock carries on from Level 1. If it runs out here, Thanos starts again from Level 1. The correct total is saved to the Intelligence Bag.' },
  ],
  4: [
    { title: 'The grid', body: 'Sixteen tiles numbered 1 to 16. The safe tile must satisfy all three conditions shown on the lock.' },
    { title: 'Steps', body: 'Select the safe tile, then calculate its digit sum. Right-click (or press X) to cross out a tile while you reason.' },
    { title: 'Escape code', body: 'Both results join your earlier clues. The final terminal by the door needs all four parts, in order. The Intelligence Bag holds everything you have earned.' },
    { title: 'Timer', body: 'Whatever is left of the shared 3-minute clock. If it runs out here, Thanos starts again from Level 1.' },
  ],
} as const;
