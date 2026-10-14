# YELLOW (web)

The web version of YELLOW. The combat, AI, frame data, art, sound and music match `../level8-yellow/yellow.py`.

It uses the same stack as the other levels (React + TypeScript + Vite + Tailwind), but it is a separate project so the levels can be merged later.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5179 in a desktop browser.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Palette, flow, combat, dodge, charge, the 90-frame stun, AI, loss and restart, the Phase Door sequence, and a bot that wins |
| `npm run build` | Builds a static site in `dist/` |

The controls, the rules page and the controls card (the CONTROLS button, or press C) are the same as in the Python version.

## Merging into a larger game

```tsx
import YellowLevel from './components/YellowLevel';

<YellowLevel onComplete={() => goToBlue()} onExit={() => backToMenu()} />
```

Every screen is drawn on the canvas. Tailwind tokens are prefixed `ylw-`, and the HUD font is Press Start 2P.

| File | Contents |
|---|---|
| `config.ts` | Palette, frame data and poses |
| `sim.ts` | Fighters, Wolverine's AI, combat, Solar Flash, the barrier and door, and the game states |
| `render.ts` | Throne-room arena, Thanos, Wolverine, effects and HUD |
| `audio.ts` | Synthesized sound effects and the battle loop |
| `engine.ts` | Fixed 60 Hz loop and input |
| `YellowLevel.tsx` | The React wrapper |
