# INDIGO (web)

The web version of INDIGO. Gameplay, physics and layout are identical to the Python version in `../level4-indigo/indigo.py`. It uses the same stack as BLUE and VIOLET (React + TypeScript + Vite + Tailwind), but lives in its own project so the levels can be merged later.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5175 in a desktop browser.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | 12 tests, including an autopilot that completes the level |
| `npm run build` | Static site in `dist/` |

## Controls

| Key | Action |
|---|---|
| W | Thrust |
| S | Brake |
| A / D | Rotate |
| SPACE | Fire an anchor, or release the tether |
| P / Esc | Pause |
| M | Mute |
| R | Restart |

## Merging into a larger game

The game is one self-contained component:

```tsx
import IndigoLevel from './components/IndigoLevel';

<IndigoLevel onComplete={() => goToBlue()} onExit={() => backToMenu()} />
```

All of its colour tokens are prefixed `ind-` in `tailwind.config.js`, so they can't clash with other levels.

## Project layout

| File | Contents |
|---|---|
| `config.ts` | Palette, layout, constants, rules placeholder |
| `sim.ts` | Pure simulation: ship, wells, tether, laser, walls, gate, zones, lives, timer |
| `render.ts` | Vector Nebula renderer and the helmet-Thanos portrait |
| `audio.ts` | Synthesized sound effects, engine sound and ambient music |
| `engine.ts` | Fixed 60 Hz loop and keyboard input |
| `IndigoLevel.tsx` | Menus and screens |
