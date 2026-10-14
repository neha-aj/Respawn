# ORANGE (web)

The web version of ORANGE. The gameplay, scoring, choreography, artwork, sound and music match `../level6-orange/orange.py`.

It uses the same stack as the other levels (React + TypeScript + Vite + Tailwind), but it is a separate project so the levels can be merged later.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5177 in a desktop browser.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Checks the palette, the scoring, the states and typing bots that win and lose |
| `npm run build` | Builds a static site in `dist/` |

## Controls

| Key | Action |
|---|---|
| Letters, space, `.` `,` | Type the sentence |
| BACKSPACE | Fix the current sentence |
| ENTER | Start |
| ESC | Pause / resume |
| R | Restart after a result |
| M | Mute (outside the challenge) |

The mouse also works on every button.

## Merging into a larger game

```tsx
import OrangeLevel from './components/OrangeLevel';

<OrangeLevel onComplete={() => goToRed()} onExit={() => backToMenu()} />
```

All screens are drawn on the canvas with the 5×7 pixel font. Tailwind tokens are prefixed `org-`, and the React screens use the Press Start 2P font.

## Project layout

| File | Contents |
|---|---|
| `config.ts` | Palette, the 60 sentences and word wrap, pixel font and dance poses |
| `sim.ts` | Typing and scoring, the procedural dancer, particles and the state machine |
| `render.ts` | Pixel-art stage, Avengers, crowd, dancer, Phase Door and HUD |
| `audio.ts` | Synthesized sound effects and the original disco loop |
| `engine.ts` | Fixed 60 Hz loop, keyboard and mouse |
| `OrangeLevel.tsx` | The React wrapper |
