# GREEN (Python)

A 2D top-down survival-horror maze, drawn only in shades of green. You play **Thanos**, lost in an ancient forest at night. Your only light is a flashlight, aimed with the mouse.

To win, collect the three runes, evade the phantom that hunts by sound, return to the giant tree and walk through the door in its trunk.

The visual style is a dark, painterly top-down forest after the reference picture: a shadow-casting flashlight cone, dead-branch silhouettes, grain and a vignette. The HUD shows a Thanos portrait whose expression changes, along with lives, runes, a noise bar and the current objective.

## Run

```bash
python -m pip install pygame
python green.py
```

There are no asset files. Every image, sound effect and piece of music is generated in code.

## Controls

| Key | Action |
|---|---|
| WASD / arrow keys | Move |
| SHIFT | Sprint (1.6× speed, makes noise rings) |
| Mouse | Aim the flashlight |
| ENTER | Start from the title screen |
| R | Full restart, from any screen |
| P | Pause |
| M | Mute |
| ESC | Quit |

## How it plays

- **Maze:** a fixed 31 × 23 grid, checked by BFS at startup. Three runes sit in the far corners and the tree stands at the centre.
- **Phantom AI:** it has three states.
  - **WANDER:** picks random reachable cells.
  - **INVESTIGATE:** follows a BFS path to the last place it heard a sound.
  - **SEARCH:** sweeps nearby cells for 3.5 s, then goes back to wandering.
- **What the phantom notices:**
  - It hears sprint rings within about nine cells.
  - It senses Thanos only within about two paces, and only with line of sight.
  - It never tracks your real position, only where it last heard you.
- **Flashlight:**
  - Range 330 px, cone 64°, cast with grid rays so walls throw shadows.
  - A small halo around Thanos keeps nearby ground visible.
  - Explored areas stay faintly remembered (fog of war).
  - The phantom is drawn only while it is inside the beam and not hidden behind a wall.
- **Lives:** you have 3.
  - **Being caught:** costs one life and triggers the jumpscare, which lasts exactly 60 rendered frames. The ghost from the reference picture lunges at you, its head twitching, its grin splitting wider and its tears running down, with glitch effects.
  - **Respawning:** you keep the runes you have collected and get 1.2 s of protection.
- **Timer:** 10:00. If it runs out, the forest closes in.
- **The tree:** with all three runes, walk up to it and it awakens.
  - The runes circle the trunk and energy flows into it.
  - The door slides open. Only then does the doorway stop blocking you.
  - Walk through the door into the portal inside the trunk.
  - The victory screen says: *PHASE DOOR UNLOCKED. / TRANSITIONING TO LEVEL: YELLOW*.

The Rules screen is a placeholder until the final rules are supplied.

## Tests

```bash
python test_green.py
```

The tests cover:
- Every scenario from the spec (A–G).
- The green-only palette.
- Collision sweeps.
- Phantom AI over 20,000 frames.
- An autopilot that collects all three runes, opens the tree and walks into the portal.
