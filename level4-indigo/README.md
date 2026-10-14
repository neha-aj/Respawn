# INDIGO (Python)

A 2D space-flight physics puzzle in indigo and violet. Thanos, wearing an astronaut helmet, pilots a small ship through four zones to the Indigo Gate. The style is **Vector Nebula**: soft painted nebula clouds with glowing wireframe geometry.

## Run

```bash
pip install pygame-ce
python indigo.py
```

There are no asset files. All graphics, sound effects and music are generated in code.

## Controls

| Key | Action |
|---|---|
| W | Thrust forward (momentum persists when you let go) |
| S | Reverse thrust / brake |
| A / D | Rotate |
| SPACE | Fire an anchor, or release the tether |
| P | Pause |
| M | Mute |
| R | Restart the level |
| ESC | Quit |

## Rules

- **Lives:** you have 3.
- **Anchors:** you have 8.
- **Time:** you have 5 minutes.
- **Checkpoint:** after Zone 2. It refills your anchors to at least 4.
- **To win:** pass between the two monoliths at speed 4.5 or less.
- **On a loss:** if your lives or time run out, the level restarts from the beginning.

The Rules screen in the game is a placeholder until the final rules are supplied.

## Physics

| Element | Model |
|---|---|
| Ship | Newtonian thrust and inertia, with a speed cap |
| Gravity wells | Softened inverse square: a = k·r̂ / (r² + ε²) |
| Anchor tether | An inextensible rope. Outward radial velocity is removed, so the ship swings around the node. |
| Walls | Reflect the ship: v′ = v − 2(v·n)n, with slight energy loss. Very hard impacts damage the hull. |
| Laser | Oscillates as θ = π/2 + 0.6·sin(0.6t), with active and safe phases. You can cross an active beam if your heading is within ±15° of it. |
| Gate | The opening breathes: half-gap = 45 + 25·sin(0.5t) |
| Trajectory guide | Predicts 60 frames ahead using velocity plus gravity |

## Tests

```bash
python test_indigo.py
```

This checks the physics rules, the violet-only palette, the tether, the restart, and an **autopilot that flies the whole level from start to victory**.
