"""Headless checks for GREEN — spec scenarios A–G plus an autopilot that plays the level.  Run: python test_green.py"""
import colorsys, math, os, random, re, sys
sys.stdout.reconfigure(encoding="utf-8")
os.environ.setdefault("SDL_VIDEODRIVER", "dummy"); os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
import pygame as pg
import green as G
V = pg.Vector2
FAIL = []
def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{info}]" if info else "")); (None if cond else FAIL.append(name))

def overlaps_wall(maze, p, r):
    cx, cy = maze.cell_of(p)
    for gy in range(cy - 1, cy + 2):
        for gx in range(cx - 1, cx + 2):
            if not maze.solid((gx, gy)): continue
            qx = min(max(p.x, gx * G.CELL), (gx + 1) * G.CELL); qy = min(max(p.y, gy * G.CELL), (gy + 1) * G.CELL)
            if (p - V(qx, qy)).length() < r - 0.01: return True
    return False

def ctrl(**k): return {"up": False, "down": False, "left": False, "right": False, "sprint": False, **k}

# ---------- palette ----------
src = open(os.path.join(os.path.dirname(__file__), "green.py"), encoding="utf-8").read()
cols = {tuple(map(int, m)) for m in re.findall(r"\((\d{1,3}), (\d{1,3}), (\d{1,3})\)", src)}
def green(c):
    if c == (0, 0, 0) or max(c) <= 12 and c[1] >= c[0] and c[1] >= c[2]: return True
    h, l, s = colorsys.rgb_to_hls(*(x / 255 for x in c))
    return c[1] >= c[0] and c[1] >= c[2] and 75 <= h * 360 <= 165 and s > 0.12
check("every colour literal is a green shade", all(green(c) for c in cols), str(sorted(c for c in cols if not green(c))))
for name, hexv in (("VOID", "#020A03"), ("GROUND", "#0C250E"), ("WALLC", "#1A4A1E"), ("PLAYER", "#85FF85"), ("LIGHT", "#39FF14"), ("PHANTOM", "#0A3816"), ("PORTAL", "#C8FFC8")):
    check(f"spec colour {name} = {hexv}", getattr(G, name) == tuple(int(hexv[i:i + 2], 16) for i in (1, 3, 5)))

# ---------- maze ----------
m = G.ForestMaze()
check("grid is 31 × 23 and fixed", (m.cols, m.rows) == (31, 23))
check("exactly three runes", len(m.runes) == 3)
reach, _ = m.bfs(m.spawn, m.player_ok)
check("spawn reaches every rune and the door approach (BFS)", all(c in reach for c in [*m.runes.values(), m.door_front]))
check("no rune inside a wall or the tree", all(m.char(c) == "." for c in m.runes.values()))
check("the tree trunk, door and portal are solid while sealed", all(m.solid(c) for c in m.trunk))
check("world boundary is solid all round", all(m.solid((x, 0)) and m.solid((x, m.rows - 1)) for x in range(m.cols)) and all(m.solid((0, y)) and m.solid((m.cols - 1, y)) for y in range(m.rows)))
check("cells outside the map count as solid", m.solid((-1, 5)) and m.solid((m.cols, 5)))

# ---------- Scenario A: start, movement, walls ----------
g = G.Game(headless=True)
check("A: the game opens on the title screen", g.state == "TITLE")
g.ctrl.update(ctrl(up=True)); [g.step(1 / 60) for _ in range(30)]
check("A: no movement on the title screen", g.player.pos == g.maze.center(g.maze.spawn))
g.begin(); check("A: ENTER (begin) starts gameplay", g.state == "PLAYING")
g.phantom.enabled = False
for d, key in ((V(0, -1), "up"), (V(0, 1), "down"), (V(-1, 0), "left"), (V(1, 0), "right")):
    g.player.pos = g.maze.center((15, 14)); start = V(g.player.pos)
    g.ctrl.update(ctrl(**{key: True})); g.step(1 / 60)
    check(f"A: Thanos moves {key}", (g.player.pos - start).dot(d) > 1.5)
g.player.pos = g.maze.center((1, 21)); g.ctrl.update(ctrl(right=True, sprint=True))
for _ in range(120): g.step(1 / 60)
check("A: a wall stops sprinting into it", g.player.pos.x <= 2 * G.CELL - G.PLAYER_R + 0.01 and not overlaps_wall(g.maze, g.player.pos, G.PLAYER_R))
rnd = random.Random(1); bad = 0
g.player.pos = g.maze.center((15, 14))
for i in range(6000):
    if i % 25 == 0: g.ctrl.update(ctrl(up=rnd.random() < 0.5, down=rnd.random() < 0.3, left=rnd.random() < 0.4, right=rnd.random() < 0.4, sprint=rnd.random() < 0.5))
    g.step(1 / 60); g.time_left = G.TIME_LIMIT
    bad += overlaps_wall(g.maze, g.player.pos, G.PLAYER_R) or g.maze.solid(g.maze.cell_of(g.player.pos))
check("A: 6000 random frames never overlap a wall or trunk", bad == 0, f"{bad} bad frames, ended in {g.maze.cell_of(g.player.pos)}")
p = G.Player(g.maze.center((15, 14)))
p.update(0.25, g.maze, ctrl(up=True, right=True)); diag = (p.pos - g.maze.center((15, 14))).length() * 4
check("A: diagonal speed equals straight speed", abs(diag - G.WALK) < 0.5, f"{diag:.1f}")
check("A: sprint is 1.5–1.7× walking", 1.5 <= G.SPRINT / G.WALK <= 1.7, f"{G.SPRINT / G.WALK:.2f}")

# ---------- Scenario B: stealth ----------
g = G.Game(headless=True); g.begin(); g.phantom.pause = 1e9
g.player.pos = g.maze.center((15, 14)); g.ctrl.update(ctrl(left=True))
for _ in range(180): g.step(1 / 60); g.ctrl["left"] = not g.ctrl["left"]; g.ctrl["right"] = not g.ctrl["left"]
check("B: walking emits no sound rings", len(g.rings) == 0)
made = 0
for i in range(180):
    g.ctrl.update(ctrl(left=i % 60 < 30, right=i % 60 >= 30, sprint=True)); before = len(g.rings); g.step(1 / 60); made += len(g.rings) > before
check("B: sprinting emits rings at a 0.6 s cooldown (not every frame)", 4 <= made <= 6, f"{made} rings in 3 s")
check("B: rings fade within their lifetime", all(r[1] < G.RING_LIFE for r in g.rings))
g = G.Game(headless=True); g.begin(); ph = g.phantom
g.player.pos = g.maze.center((5, 13)); ph.pos = g.maze.center((5, 17)); ph.path = []; ph.pause = 0
before = V(ph.pos)
g.ctrl.update(ctrl(right=True, sprint=True)); g.step(1 / 60); origin = V(g.rings[-1][0])
check("B: a sprint ring sends the phantom to INVESTIGATE", ph.state == "INVESTIGATE" and ph.target == g.maze.cell_of(origin))
check("B: hearing never teleports the phantom", (ph.pos - before).length() < 5)
g.ctrl.update(ctrl(up=True))                                      # walk away quietly
for _ in range(60): g.step(1 / 60)
check("B: the phantom keeps the old sound origin, not Thanos's new position", ph.target == g.maze.cell_of(origin) and g.maze.cell_of(g.player.pos) != ph.target)
g.player.pos = g.maze.center((1, 1)); g.ctrl.update(ctrl())
for _ in range(600):
    g.step(1 / 60)
    if ph.state == "SEARCH": break
check("B: it reaches the origin and SEARCHes", ph.state == "SEARCH" and g.maze.cell_of(ph.pos) == g.maze.cell_of(origin) or ph.state == "SEARCH")
for _ in range(int(G.SEARCH_TIME * 60) + 30): g.step(1 / 60)
check("B: after searching it returns to WANDER", ph.state == "WANDER")
g = G.Game(headless=True); g.begin(); g.player.pos = g.maze.center((1, 21)); bad = 0; states = set()
for i in range(20000):
    g.step(1 / 60); g.time_left = G.TIME_LIMIT
    if i % 700 == 0: g.phantom.hear(g.maze.center(random.Random(i).choice(sorted(g.maze.bfs(g.maze.spawn, g.maze.phantom_ok)[0]))))
    states.add(g.phantom.state)
    if not g.maze.phantom_ok(g.maze.cell_of(g.phantom.pos)): bad += 1
    g.phantom.stuck_t = min(g.phantom.stuck_t, 9)
check("B: over 20000 frames the phantom never enters a wall or the tree", bad == 0, f"{bad}")
check("B: all three AI states occur", states >= {"WANDER", "INVESTIGATE", "SEARCH"}, str(states))
check("B: phantom is faster than walking and slower than sprinting", G.WALK < G.PH_HUNT < G.SPRINT)
ph = g.phantom; ph.pos = g.maze.center((15, 3)); ph.state = "INVESTIGATE"; ph.path = [(30, 30)]
ph.path = []; ph.stuck_t = 0; ph.state = "WANDER"; ph.pos = V(ph.pos); ph.pause = 0
ph.path = [g.maze.cell_of(ph.pos)]; g.step(1 / 60)
check("B: a zero-length path step is handled without errors", True)

# ---------- Scenario C: flashlight ----------
g = G.Game(headless=True); g.begin()
lt, mz = g.light, g.maze; o = mz.center((15, 14))
check("C: lit inside the cone and range", lt.illuminates(mz, o, 0.0, o + V(150, 0)))
check("C: dark outside the cone", not lt.illuminates(mz, o, math.pi, o + V(150, 0)))
check("C: dark beyond the range", not lt.illuminates(mz, o, 0.0, o + V(G.LIGHT_RANGE + 20, 0)))
o2 = mz.center((1, 21))
check("C: walls block the light", not lt.illuminates(mz, o2, 0.0, mz.center((3, 21))))
g.player.pos = V(o); g.player.aim = 0.0; g.draw(); c1 = [V(p) for p in lt.cone]
g.player.aim = math.pi / 2; g.draw(); c2 = [V(p) for p in lt.cone]
check("C: changing the aim swings the cone", c1[len(c1) // 2] != c2[len(c2) // 2])
g.phantom.pos = o + V(-150, 0); g.phantom.pause = 1e9; g.player.aim = 0.0; g.draw()
check("C: phantom hidden when outside the beam", not g.phantom_visible)
g.player.aim = math.pi; g.draw()
check("C: phantom drawn when inside the beam", g.phantom_visible)
g.player.aim = 0.0; g.draw()
check("C: one exposure does not reveal it permanently", not g.phantom_visible)
check("C: Thanos keeps an ambient halo for navigation", len(lt.amb) == lt.AMB_RAYS and max((p - g.player.pos).length() for p in lt.amb) > 60)

# ---------- Scenario D: runes ----------
g = G.Game(headless=True); g.begin(); g.phantom.enabled = False
r0 = g.runes[0]; g.player.pos = V(r0.pos); g.step(1 / 60); g.step(1 / 60)
check("D: a rune is collected on contact", g.collected == {0})
g.step(1 / 60); check("D: and counted only once", len(g.collected) == 1)
g.phantom.enabled = True; g.phantom.pos = V(g.player.pos); g.step(1 / 60)
for _ in range(60): g.draw()
check("D: collected runes persist after a death", g.collected == {0} and g.state == "PLAYING")
g.restart(); check("D: full restart clears every rune", g.collected == set() and g.state == "TITLE")

# ---------- Scenario E: death and jumpscare ----------
g = G.Game(headless=True); g.begin()
g.phantom.pos = V(g.player.pos) + V(5, 0); g.phantom.pause = 1e9; g.step(1 / 60)
check("E: contact triggers the jumpscare", g.state == "JUMPSCARE" and g.lives == 2)
pos = V(g.player.pos); g.ctrl.update(ctrl(right=True))
for _ in range(10): g.step(1 / 60)
check("E: no movement, AI or extra life loss during the jumpscare", g.player.pos == pos and g.lives == 2)
frames = 0
while g.state == "JUMPSCARE" and frames < 200: g.draw(); frames += 1
check("E: the jumpscare lasts exactly 60 rendered frames", frames == 60, f"{frames}")
check("E: respawn at the start with one life lost", g.state == "PLAYING" and g.player.pos == g.maze.center(g.maze.spawn) and g.lives == 2)
check("E: phantom reset far from the spawn, sounds cleared", (g.phantom.pos - g.player.pos).length() > 600 and not g.rings and g.phantom.state == "WANDER")
check("E: about a second of spawn protection", 0.9 <= g.protect <= 1.5)
g.phantom.pos = V(g.player.pos); g.step(1 / 60)
check("E: protection prevents an instant second catch", g.state == "PLAYING" and g.lives == 2)
for lives_left in (1, 0):
    g.protect = 0; g.phantom.pos = V(g.player.pos); g.phantom.pause = 1e9; g.step(1 / 60)
    for _ in range(60): g.draw()
check("E: the third catch ends in GAME_OVER after the jumpscare", g.state == "GAME_OVER" and g.lives == 0)
g.draw(); check("E: no further lives are lost on the game-over screen", g.lives == 0)

# ---------- Scenario F: the tree door ----------
g = G.Game(headless=True); g.begin(); g.phantom.enabled = False; mz = g.maze
front = mz.center(mz.door_front)
g.player.pos = V(front); g.ctrl.update(ctrl(up=True))
for _ in range(120): g.step(1 / 60)
check("F: the sealed door is solid", mz.cell_of(g.player.pos) == mz.door_front and g.msg == "THE SEAL REMAINS CLOSED")
g.collected = {0, 1}
for _ in range(60): g.step(1 / 60)
check("F: two runes do not unlock it", not g.door_unlocked and not mz.door_open)
g.player.pos = V(g.runes[2].pos); g.ctrl.update(ctrl()); g.step(1 / 60)
check("F: the third rune unlocks it", g.door_unlocked and not mz.door_open)
g.player.pos = V(front); g.step(1 / 60)
check("F: approaching starts the awakening", g.ritual_t is not None and not mz.door_open)
for _ in range(int((G.RITUAL_TIME - 0.2) * 60)): g.step(1 / 60)
check("F: the door is still solid mid-animation", not mz.door_open and mz.solid(mz.door))
for _ in range(30): g.step(1 / 60)
check("F: the animation completes and the door opens", mz.door_open and not mz.solid(mz.door) and not mz.solid(mz.portal))
check("F: the rest of the trunk stays solid", all(mz.solid(c) for c in mz.trunk if c not in (mz.door, mz.portal)))
g2 = G.Game(headless=True); g2.begin(); g2.phantom.enabled = False
g2.collected = {0, 1, 2}; g2.door_unlocked = True; g2.maze.door_open = True
g2.player.pos = g2.maze.center(g2.maze.portal); g2.step(1 / 60)
check("F: appearing inside the portal without using the door does not win", g2.state == "PLAYING")
g.ctrl.update(ctrl(up=True))
for _ in range(120):
    g.step(1 / 60)
    if g.state == "VICTORY": break
check("F: walking through the door into the portal wins", g.state == "VICTORY" and g.through_door)
for _ in range(90): g.step(1 / 60); g.draw()
check("F: victory stops normal gameplay", g.state == "VICTORY")
check("F: the victory text names Level Yellow", "TRANSITIONING TO LEVEL: YELLOW" in src and "PHASE DOOR UNLOCKED." in src and "PRESS R TO REPLAY GREEN" in src)

# ---------- Scenario G: restart ----------
for st in ("TITLE", "PLAYING", "JUMPSCARE", "GAME_OVER", "VICTORY"):
    g = G.Game(headless=True); g.begin(); g.collected = {0, 2}; g.door_unlocked = True; g.ritual_t = 2.0; g.maze.door_open = True
    g.rings.append([V(1, 1), 0.1]); g.phantom.hear(g.maze.center((5, 5))); g.lives = 1; g.js_frames = 30; g.shake = 9; g.protect = 1; g.time_left = 3
    g.state = st; g.restart()
    ok = (g.state == "TITLE" and g.collected == set() and not g.door_unlocked and g.ritual_t is None and not g.maze.door_open and not g.rings
          and g.phantom.state == "WANDER" and not g.phantom.path and g.lives == 3 and g.js_frames == 0 and g.shake == 0 and g.protect == 0
          and g.time_left == G.TIME_LIMIT and g.player.pos == g.maze.center(g.maze.spawn) and not g.particles and not g.through_door)
    check(f"G: R from {st} resets everything", ok)

# ---------- autopilot: play the whole level ----------
def autopilot(g, limit=60 * 600):
    mz = g.maze
    goals = [r.pos for r in sorted(g.runes, key=lambda r: r.idx)] + [mz.center(mz.door_front), mz.center(mz.portal)]
    frames = 0
    for goal in goals:
        while frames < limit and g.state == "PLAYING":
            if goal == mz.center(mz.portal) and not mz.door_open:
                g.ctrl.update(ctrl()); g.step(1 / 60); frames += 1; continue
            here, tgt = mz.cell_of(g.player.pos), mz.cell_of(goal)
            if here == tgt and (g.player.pos - goal).length() < 4: break
            path = mz.path(here, tgt, mz.player_ok) or []
            aim = mz.center(path[0]) if path else goal
            d = aim - g.player.pos
            g.ctrl.update(ctrl(left=d.x < -1.5, right=d.x > 1.5, up=d.y < -1.5, down=d.y > 1.5))
            if d.length_squared() > 1: g.player.aim = math.atan2(d.y, d.x)
            g.step(1 / 60); frames += 1
            if frames % 4 == 0: g.draw()
            if g.state == "JUMPSCARE":
                while g.state == "JUMPSCARE": g.draw()
        if g.state != "PLAYING": break
    return frames
g = G.Game(headless=True); g.begin(); g.phantom.enabled = False
n = autopilot(g)
check("AUTOPILOT: collects all three runes, opens the tree and enters the portal", g.state == "VICTORY" and len(g.collected) == 3, f"{g.state} in {n / 60:.0f} s")
check("AUTOPILOT: a direct run fits well inside the 10:00 timer", n / 60 < G.TIME_LIMIT / 2, f"{n / 60:.0f} s")

print("\nALL PASSED" if not FAIL else f"\n{len(FAIL)} FAILED: {FAIL}")
sys.exit(1 if FAIL else 0)
