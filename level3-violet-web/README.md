# VIOLET (web)

The web version of VIOLET: a 2D third-person neon trick-shot shooter in shades of violet. You play as Thanos.

It's a separate project from BLUE, built on the same stack (React + TypeScript + Vite + Tailwind + Framer Motion + Lucide) so the levels can be merged later. Gameplay, physics and layout are identical to the Python version in `../level3-violet/violet.py`.

## Run

Needs Node.js 18 or newer.

```bash
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5174) in a desktop browser.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | 17 automated tests |
| `npm run build` | Static site in `dist/` (no backend needed) |

## Controls

| Input | Action |
|---|---|
| A / D or ← / → | Move |
| W / ↑ / Space | Jump |
| Mouse | Aim |
| Left click | Fire |
| Esc | Pause |
| M | Mute |
| R | Restart after a win or loss |

## Rules

- **Lives:** you have 3. Each hit from a drone bullet costs one.
- **Bullets:** you have 5 per attempt.
- **Time:** you have 2 minutes.
- **You win by:**
  1. destroying all 3 drones, which unlocks the Phase Door;
  2. bending a shot into the door's core: gravity, then a wall ricochet, then a transformation field.
- **You lose if:**
  - your lives run out;
  - you run out of bullets;
  - the timer reaches zero.
- **On a loss:** the level restarts from scratch.

The in-game Rules screen is a placeholder until the final rules are supplied.

## Physics

| Element | Behaviour |
|---|---|
| Gravity | g = ⟨0, 0.2⟩ px/frame² on your bullets. Drone bullets fly straight. |
| Ricochet | Angle of incidence = angle of reflection. Vertical surfaces invert vx; horizontal surfaces invert vy. |
| Scaling field | Multiplies the velocity by 1.6 on entry. |
| Reflection field | Flips vertical velocity (vy → −vy) on entry. |
| Drones | Patrol on Lissajous curves. |
| Timestep | The simulation runs at a fixed 60 Hz, so it plays the same on any monitor. |

## Merging into a larger game

The game is one self-contained component:

```tsx
import VioletLevel from './components/VioletLevel';

<VioletLevel onComplete={() => goToIndigo()} onExit={() => backToMenu()} />
```

All of its colour tokens are prefixed `vio-` in `tailwind.config.js`, so they can't clash with other levels.

## Project layout

```
src/game/config.ts    palette, layout, constants, rules placeholder
src/game/physics.ts   bullet physics, fields, door, aiming guide
src/game/entities.ts  Thanos and the drones
src/game/logic.ts     game rules and state (no DOM; tested headlessly)
src/game/render.ts    neon canvas renderer with bloom
src/game/audio.ts     synthesized sound effects and music
src/game/engine.ts    60 Hz loop and input
src/components/VioletLevel.tsx   menus and screens
```
