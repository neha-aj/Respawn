# VIOLET

A 2D third-person neon action-puzzle shooter, drawn entirely in shades of violet. You play as Thanos. Destroy three security drones with five gravity-bound bullets, then bend a trick shot into the hidden Phase Door.

## Run

```bash
pip install pygame-ce
python violet.py
```

Everything (graphics, sound effects, music) is generated in code. There are no asset files.

## Controls

| Input | Action |
|---|---|
| A / D or ← / → | Move |
| W / ↑ / Space | Jump |
| Mouse | Aim (360°) |
| Left click | Fire |
| Esc | Pause |
| M | Mute |
| R | Restart after a win or loss |

## Rules

- **Lives:** you have 3. Each hit from a drone bullet costs one.
- **Bullets:** you have 5 per attempt.
- **Time:** you have 2 minutes.
- **You lose if:**
  - your lives run out;
  - you run out of bullets before winning;
  - the timer reaches zero.
- **On a loss:** the level restarts from scratch.
- **You win by:**
  1. destroying every drone, which unlocks the door;
  2. landing a bullet on the door's core lock.

The Rules screen in the game is a placeholder until the final rules are supplied.

## Physics

| Element | Behaviour |
|---|---|
| Gravity | Your bullets accelerate downward by g = ⟨0, 0.2⟩ px/frame² and fly in parabolic arcs. Drone bullets fly straight. |
| Ricochet | Walls and platforms reflect bullets: angle of incidence = angle of reflection. Vertical surfaces invert vx; horizontal surfaces invert vy. |
| Scaling field (×1.6) | Multiplies the velocity vector by 1.6 when a bullet enters it. |
| Reflection field (−vy) | Flips vertical velocity (vy → −vy) when a bullet enters it. |
| Drones | Patrol on Lissajous curves: x = A·sin(ωt + φ), y = B·sin(2ωt + φ). |
| Trajectory guide | The dotted arc follows the bullet's path under gravity up to its first contact with a surface or field. |

## The trick shot

The Phase Door sits on the inner face of a pillar that reaches down from the ceiling. The only way into that pocket is a low slot under the pillar, and the slot is filled by the reflection field. A bullet that gets in is moving right, but the door faces left, so the bullet must ricochet off the far wall before it can hit the door. That means every winning shot uses gravity, a ricochet and a field.

`python test_violet.py` checks this headlessly:
- **Solvable:** shots are swept from 22 standing positions, and all 22 have winning angles.
- **Every winning shot** uses a field and a ricochet.
- **No direct shot:** there is no line of sight to the door from anywhere in the room.
- **Physics:** each rule above behaves as described.
- **Colours:** every colour in the code is a violet hue.
- **Full playthroughs:** a win, running out of bullets, and a timeout.
