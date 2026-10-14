# BLUE — Levels 1, 2 and 3

On screen the levels are numbered 1, 2 and 3. In the code they keep the ids 2, 3 and 4 (`LEVEL_INFO[id].number` is the number the player sees).

*Balance the impossible. Beat the flood.*

A 2D pixel-art underwater puzzle level. You are Thanos: work out three unknown
weights with algebra, watch a torque-driven balance confirm them, press three
pressure switches from lightest to heaviest, and escape the flooding chamber
before the clock runs out. Everything is drawn in shades of blue.

## Run it

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173) in a desktop browser.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm test` | Automated tests (maths, switch order, physics, timer, palette) |
| `npm run build` | Type-check and build a static site into `dist/` |
| `npm run preview` | Serve the production build locally |

The build in `dist/` is fully static. It needs no backend, and fonts and audio are bundled or synthesized.

## Controls

| Input | Action |
|---|---|
| ← → or A / D | Walk |
| Space (or W / ↑) | Jump (switch A is on a ledge) |
| E | Use the object Thanos is standing next to |
| Mouse click | Use an object (Thanos must be close enough) |
| Enter | Weigh the values typed in the console |
| Esc | Close the console / pause / resume |
| M | Sound on/off |

## The puzzle

```
A + B = 11      B + C = 13      A + C = 10
2(A + B + C) = 34  →  A + B + C = 17
A = 17 − 13 = 4,  B = 17 − 10 = 7,  C = 17 − 11 = 6
```

- Lightest to heaviest: **A → C → B**.
- Mapping shown in the chamber: triangle = A, square = C, pentagon = B.
- Read in the starting-clue order (triangle → square → pentagon), the weights give **467**.

## Levels 2 and 3 (continuation)

After BLUE's balance chamber, the game continues through two more rooms, each with its own hints, rules and Thanos reactions.

## The clock

One **3-minute clock** covers Levels 1, 2 and 3 together (`GAME_TIME_MS` in `src/game/config.ts`).

- **Start:** the clock begins when you press Start Level on Level 1.
- **Between levels:** the remaining time carries over and is never reset. The clock is frozen on the completion and intro screens, and resumes when you press Start Level.
- **Running:** hints and the Intelligence Bag do not stop it; only the pause menu does.
- **Running out:** if it hits zero on any level, Thanos starts again from Level 1 with a fresh 3 minutes. Clues from Levels 1–3 are cleared; the starting clue is kept.
- **Pause → Restart Level:** on Levels 2 and 3 this resets only that level's puzzle, and the clock keeps going. On Level 1 it starts a new run.
- **Main menu:** exiting mid-run keeps the remaining time for **Continue**.

### Level 2: The Overlap Trap

Two overlapping 4×4 squares, S1 = (0,0)–(4,4) and S2 = (2,2)–(6,6), each with both diagonals. The two main diagonals are collinear, so they form one continuous line.

**The answer is 22 distinct triangles:**
- 8 inside square 1.
- 8 inside square 2.
- 6 small triangles where the squares' edges cross the diagonals.

The count is never typed in by hand. `src/game/geometry.ts` computes it from the same segment list the screen draws:

| Method | How it counts |
|---|---|
| Vertex triples | Every non-collinear vertex triple whose three sides are fully drawn (collinear segments are merged first, so long sides through intersections count) |
| Path triples | An independent cross-check: triples of maximal drawn lines whose pairwise crossings lie on all three |

The module refuses to load if the two methods disagree. The tests also check the hand breakdown, a set of small hand-checked diagrams, and that the rendered segments are the verified ones.

**Player tools:**
- Zoom into any quarter of the diagram.
- Hover a line to trace its full length.
- An optional triangle tester: click three corners to see if they form a triangle, and mark the ones you've found. It never reveals the total.

### Level 3: The Remainder Lock

The lock shows a 4×4 grid of tiles 1–16 and three rules: even, remainder 2 when divided by 5, greater than 10. The safe tile (12) is derived from the rules, and every other tile is rejected with the conditions it breaks. Next comes the digit step, 1 + 2 = 3.

Then the escape terminal by the door asks for the final code in four segments. The code is assembled from earned state (`finalSegments()` in `src/game/progress.ts`):

```
467 - 22 - 12 - 3
```

### Progress and clues

`src/game/progress.ts` holds pure, tested reducers:
- **Validation:** every result is validated before it is stored.
- **No overwriting:** a wrong value can never overwrite a right one.
- **Gating:** Level 2 needs Level 1, and the terminal stays locked until the tile and the digit are earned.
- **Retries:** a Level 3 retry clears only Level 3's tile and digit.

The Intelligence Bag shows every earned clue across all levels. Progress lives in memory: the existing project had no save system, so a page reload starts a new game.

## How the physics is used

| System | Model |
|---|---|
| Character | Fixed-timestep (1/120 s) semi-implicit Euler with AABB collisions. Gravity is reduced by buoyancy (g·(1 − ρw/ρb)) and there is water drag. |
| Balance scales | τ = (m_L − m_R)·g·L·cos θ, I = (m_L + m_R + m_beam)·L², with angular damping so the beam settles. The left pan holds the true weight from `solveWeights()`; the right pan holds counterweight blocks for the value you typed. Each block falls under gravity and adds an impulse when it lands. |
| Plates and door | Damped springs: x'' = −k(x − target) − c·x' |
| Bubbles | Buoyant rise with sinusoidal wobble |
| Water | Row-wise sine distortion of the ocean, travelling-sine caustics and a flood surface |

The equations are the only source of truth: the physics reads its masses from
`solveWeights()`, so the balance can never disagree with the maths.

## Project layout

```
src/
  game/
    config.ts      palette, level text, time limit, dev starting-clue data, rules placeholder
    puzzle.ts      equations, solving, validation, switch-order logic   (+ puzzle.test.ts)
    geometry.ts    Level 2 diagram + two independent triangle counters  (+ geometry.test.ts)
    remainder.ts   Level 3 rules, safe tile, digit sum
    progress.ts    cross-level progress, final code, gating, retries     (+ progress.test.ts)
    rooms.ts       pixel-art rooms for Levels 2 and 3
    physics.ts     body movement, Balance (torque), Spring             (+ physics.test.ts)
    timer.ts       elapsed-time countdown with pause                    (tested in physics.test.ts)
    audio.ts       Web Audio ambience, music and effects; hard mute
    sprites.ts     bitmap font, shapes, Thanos sprite + shaded portrait
    scene.ts       background and machine rendering
    layout.ts      room geometry
    engine.ts      game loop, input, state machine
    palette.test.ts  fails if any non-blue colour appears in the source
  components/      React UI: header/timer, console + hints, Intelligence Bag,
                   rules, pause, failure, completion, portrait, messages
```

## Plugging into the full game

- **Starting clue (from the previous game):** `App.tsx` reads `localStorage['zerohour.level1.order']` (a JSON array such as `["TRIANGLE","SQUARE","PENTAGON"]`). If it is missing, it uses `DEV_PREVIOUS_LEVEL` from `config.ts`. You can also render `<BlueLevel previousOrder={…} />` directly.
- **Rules:** `RULES_PLACEHOLDER` in `src/game/config.ts` is clearly marked as placeholder content. Replace its sections with the final rules and set `isPlaceholder: false`.

## Art and replacing the character

Thanos is original pixel art drawn in code, inspired by the supplied reference image rather than copied from it:
- **Walking sprite:** 28×46 px.
- **Portrait:** 64×64 px, shaded with a superellipse surface, Lambert lighting and Bayer dithering.

The underwater room is likewise an original pixel scene modelled on the supplied background reference (light shafts, a stepped ruin on the left, a layered coral tree on the right, a striped sea floor).

To use your own sprite:
1. Put a transparent PNG (about 28×46 px, facing right) in `public/`, e.g. `public/thanos.png`.
2. Set `CHARACTER_SPRITE_URL = '/thanos.png'` in `src/game/config.ts`.

It is recoloured to the blue ramp automatically. If the file can't be loaded, the built-in sprite is used.

## Audio

All sound is synthesized at runtime: ocean ambience, a slow pad that opens up as time runs low, a heartbeat in the last 30 seconds, bubbles, footsteps, clicks, chimes, sonar warnings, the door, failure and victory. It is original, royalty-free and has no files that can go missing. Nothing plays until **Start Level** is pressed. Turning sound off disconnects the output and suspends the audio engine.
