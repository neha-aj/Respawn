# RED (web)

A rage platformer in monochromatic red. **Thanos**, in a long coat, works through four rooms that keep breaking their own rules. A sarcastic narrator and a Fever thermometer keep score of his deaths. At the end he walks through a lit doorway.

It is built with Phaser 3.90 (Arcade Physics, 1280×720) inside the same React + Vite shell as the other levels. Every graphic is procedural geometry. The visual style follows the references: glowing red panels in dark architecture, light cones, a soft diamond, and a lit doorway whose light spills across the floor.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5178 in a desktop browser.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | 20 tests: helpers, exact narrator data, room geometry and fairness, the room mechanics, Fever, the palette and the ending order |
| `npm run build` | Builds a static site in `dist/` |

## Controls

| Key | Action |
|---|---|
| Arrows / WASD | Move |
| Space (or Up / W) | Jump |
| R | Restart the current room |
| P / Esc | Pause |
| M | Mute |

## The rooms

| Room | What happens |
|---|---|
| 1 · RULE SHIFT | One platform patrols back and forth (the rule). The next one is shy: it blinks a warning and reverses when you approach. |
| 2 · PHYSICS BETRAYAL | A clearly marked low-gravity column (×0.45) is the only way up. A full jump from the top ledge finds the ceiling spikes, so walk off past the GRAVITY RESTORED line instead. |
| 3 · THE CONTROL GLITCH | Left and right swap every 3 s; jump is never swapped. The screen shows the state, a countdown and `CONTROL SHIFT IN 0.5s`. |
| 4 · THE PATIENCE TEST | A full-height laser corridor switches off at exactly 7.0 s, with the persistent message *Your patience is appreciated*. |

**Every room:**
- Each room has one hidden pop-up spike. It is deterministic and triggered by position.
- After 4 deaths in a room, mercy mode outlines its hidden spike and shows a hint.
- A death plays a 0.6 s shatter, then you respawn **back in Room 1**, whichever room you died in. `R` still restarts only the current room.
- **Fever** = min(100, deaths × 6) fills the thermometer and the red vignette. Above 80 the screen shakes.

**Ending:** freeze, then 0.5 s, then a pale-red flash, then `completeLevel('red')` (exactly once), then the typewriter cards:
1. *There's nothing wrong with you.*
2. *The world just needed someone to turn the colors back on.*
3. *THE END*

## Integration

```tsx
import RedLevel from './components/RedLevel';

<RedLevel onComplete={(id) => markComplete(id)} onExit={() => backToMenu()} />
```

| File | Contents |
|---|---|
| `scenes/Level7RagePlatformer.js` | The level scene. Exports `LEVEL7_DATA`, `NARRATOR`, `RED_FROM_START`, `sineY`, `reflectVx`, `jumpHeight`, `fleeVx`. |
| `scenes/RedTitle.js` | Title screen: START / RULES (placeholder) / EXIT |
| `scenes/index.js` | Scene registration and `createRedGame(parent, hooks)` |
| `LevelBase.js` | Guarded audio, `completeLevel(id)` (once only; emits `level-complete` and calls `hooks.onComplete`), flash, ending cards |
| `redLogic.js` | Pure data and logic, unit-tested without Phaser |
| `art.js` | Procedural drawing, including Thanos |
| `audio.js` | Synthesized, fully guarded audio: `bonk`, `nope`, `tick`, `win`, plus jump, door and a dark ambient loop |
| `utils/math.js` | `clamp`, `lerp`, `approach`, `rectsOverlap` |
