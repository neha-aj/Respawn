# RESPAWN: the full game

Every level, back to back, as one continuous run:

| # | Piece | Status |
|---|-------|--------|
| 1 | Intro: VIBGYOR photo + tune | slot reserved, not built yet |
| 2 | Opening video | slot reserved, not built yet |
| 3 | BnW | ✓ |
| 4–5 | V video → VIOLET | ✓ |
| 6–7 | I video → INDIGO | ✓ |
| 8–9 | B video → BLUE | ✓ |
| 10–11 | G video → GREEN | ✓ |
| 12–13 | Y video → YELLOW | ✓ |
| 14–15 | O video → ORANGE | ✓ |
| 16–17 | R video → RED | ✓ |
| 18 | Ending sequence | slot reserved, not built yet |

## Play

Double-click **`PLAY.bat`**. The first time, it installs and builds everything (a few
minutes), then opens the game in your browser at http://localhost:4180.

Or from a terminal in `respawn-game/`:

```bash
npm install
npm run build:all
npm run preview
```

The built game is in `dist/`. It must be served over http (as `npm run preview` does);
opening `dist/index.html` straight from disk won't work.

### Jump to a chapter

Add `?chapter=<id>` to the URL to start there (handy for testing and demos):
`bnw`, `violet`, `indigo`, `blue`, `green`, `yellow`, `orange`, `red`.
For example: http://localhost:4180/?chapter=green

## Transitions

Between two levels the run never cuts. It goes:

1. **Victory hold**: the level's own win screen stays up with a small *CONTINUE [ENTER]*
   prompt and a bar that runs out (about 5 s; 12 s on RED so its closing cards can play).
   ENTER, SPACE or a click moves on sooner. The level's own replay buttons are blocked here.
2. **Iris out**: a circle closes in on the centre, pauses on a pinhole rimmed in the
   level's colour, then shuts (a soft "whoomp").
3. **Spectrum card**: the V-I-B-G-Y-O-R strip. Colours already won stay lit, the next one
   flares up and its name settles in. Each colour rings one note of a rising scale, so
   the run climbs V → R as you play.
4. **Colour video**: fades in. *Hold SPACE* (or hold the mouse) to skip. The next level
   loads quietly behind it.
5. **Bloom and iris in**: a wash of the new colour blooms from the centre as the circle
   opens onto the next level, which gets keyboard focus straight away.

After RED, the whole strip lights up band by band and rings out. That's where the ending
sequence will take over.

## How it fits together

- `src/sequence.ts` is the running order (and the colours). New pieces slot in here.
- `src/App.tsx` runs the sequence. Each level runs in an iframe and posts
  `{ type: 'respawn:complete' }` to the shell when won (see each level's `main.tsx`;
  BnW's entry is `src/bnw/main.jsx`, built straight from `../BnWGame.jsx`).
- `src/Transitions.tsx` + `src/styles.css` are the spectrum card, video player,
  continue prompt and bloom; `src/sfx.ts` synthesises the transition sounds.
- `scripts/build-levels.mjs` (`npm run levels`) builds every level folder and copies it
  into `public/levels/`. Run it again after changing any level. `--skip-build` only re-copies.
- `public/videos/` holds V, I, B, G, Y, O, R `.mp4` (from *respawn infodeets*).

### Adding the pending pieces

- **Intro (photo + tune)** and **opening video**: play them in `App.tsx` where the comment
  `(1. INTRO and 2. OPENING video will play here…)` sits, before the chapter loop.
  The opening video can reuse `<VideoPlayer>`. The intro needs a click to start: browsers
  only allow sound after the player has interacted, so a "press to start" moment there
  also unlocks sound for everything after it.
- **Ending**: play it in `App.tsx` after the finale strip, at `(18. ENDING will play from here)`.
