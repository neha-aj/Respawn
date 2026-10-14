"""Headless checks for VIOLET. Run:  python test_violet.py"""
import colorsys, math, os, re
os.environ.setdefault("SDL_VIDEODRIVER", "dummy"); os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
import pygame as pg
import violet as V

FAIL = []
def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{info}]" if info else "")); (None if cond else FAIL.append(name))

def fly(world, pos, ang, frames=900):
    p = V.Projectile(pos, pg.Vector2(math.cos(ang), math.sin(ang)) * V.BULLET_SPEED)
    for _ in range(frames):
        for ev in p.step(world):
            if ev[0] == "door": return p
        if not p.alive: return None
    return None

# --- 1. trick shot solvable; every solution uses gravity + ricochet + field ---
world = V.World(); world.door.unlocked = True
spots = [(x, 600 - 50) for x in range(60, 760, 50)] + [(x, 470 - 50) for x in range(90, 290, 50)] + [(x, 360 - 50) for x in range(380, 560, 50)]
solved, sols = 0, []
for sx, sy in spots:
    hits = [(a, p) for a in range(0, 3600, 2) if (p := fly(world, (sx, sy), math.radians(a / 10)))]
    solved += bool(hits); sols += [(sx, sy, a, p) for a, p in hits]
check("trick shot solvable from most standing spots", solved >= len(spots) * 0.8, f"{solved}/{len(spots)} spots, {len(sols)} angles")
check("every door hit used a transformation field", all(p.used for *_, p in sols))
check("every door hit used at least one ricochet", all(p.bounces >= 1 for *_, p in sols))

# --- 2. no direct line of sight to the door from anywhere in the open room ---
def los(a, b):
    for k in range(200):
        t = k / 199; x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        if world.solid_at(x, y) and not V.inside(world.door.rect, x, y): return False
    return True
door_pts = [(world.door.rect.centerx, y) for y in range(world.door.rect.top, world.door.rect.bottom, 6)]
open_pts = [(x, y) for x in range(30, 760, 20) for y in range(70, 590, 20) if not world.solid_at(x, y)]
check("door has no line of sight from the room", not any(los(o, d) for o in open_pts for d in door_pts))

# --- 3. physics rules ---
p = V.Projectile((200, 300), (5, 0)); p.step(world)
check("gravity adds 0.2 px/frame² to vy", abs(p.vel.y - 0.2) < 1e-9)
p = V.Projectile((879, 300), (8, 0)); p.step(world)
check("wall ricochet inverts vx (angle in = angle out)", p.vel.x == -8 and p.bounces == 1)
f = V.Field("scale", pg.Rect(0, 0, 1, 1)); v = pg.Vector2(3, -4); f.apply(v)
check("scaling field multiplies velocity by 1.6", v == pg.Vector2(4.8, -6.4))
f = V.Field("reflect", pg.Rect(0, 0, 1, 1)); v = pg.Vector2(3, 5); f.apply(v)
check("reflection field inverts vy", v == pg.Vector2(3, -5))
e = V.Projectile((200, 300), (4, 0), enemy=True); e.step(world)
check("enemy bullets ignore gravity", e.vel.y == 0)

# --- 4. palette is 100% violet ---
src = open(os.path.join(os.path.dirname(__file__), "violet.py"), encoding="utf-8").read()
cols = {tuple(map(int, m)) for m in re.findall(r"\((\d{1,3}), (\d{1,3}), (\d{1,3})\)", src)}
def violet(c):
    if max(c) == 0: return True                                       # pure black = transparent fill
    h, l, s = colorsys.rgb_to_hls(*(x / 255 for x in c))
    return 255 <= h * 360 <= 310 and s > 0.15
bad = [c for c in cols if not violet(c)]
check("every colour literal is a violet hue (255°–310°)", not bad, str(bad))

# --- 5. full playthroughs through the real game loop ---
g = V.Game(); g.action("start")
def run(frames):
    for _ in range(frames):
        g.update(1 / 60)
        if g.state != "play": break
sx, sy, a, _ = next(s for s in sols if s[1] == 550 and 560 <= s[0] <= 720)
for d in g.world.enemies: d.alive = False                              # drones down (scripted)
g.world.door.unlocked = True
g.player.rect.bottomleft = (sx - V.Player.W_ // 2, 600); g.player.pos.update(g.player.rect.topleft); g.player.on_ground = True
g.player.facing = 1 if math.cos(math.radians(a / 10)) >= 0 else -1
sh = g.player.shoulder(); want = math.radians(a / 10)
g.aim_point = (sh.x + math.cos(want) * 200, sh.y + math.sin(want) * 200)
g.update(1 / 60)
# fine-tune: the muzzle moved with the new facing, so search a small window around the aim
for da in [0] + [k * s for k in range(1, 40) for s in (0.1, -0.1)]:
    ang = math.radians(a / 10 + da); m = g.player.shoulder() + pg.Vector2(math.cos(ang), math.sin(ang)) * 36
    if fly(world, m, ang): break
g.aim_point = (g.player.shoulder().x + math.cos(ang) * 200, g.player.shoulder().y + math.sin(ang) * 200)
g.update(1 / 60); g.fire(); run(2000)
check("scripted trick shot wins the level", g.state == "won", g.state)
for _ in range(200): g.update(1 / 60); g.draw()
check("victory screen draws without errors", True)

g.action("restart"); g.aim_point = (450, 650)
for _ in range(5): g.fire(); run(400)
check("running out of bullets ends the game", g.state == "over" and "BULLETS" in g.over_reason, g.over_reason)
g.action("restart"); check("R/restart resets lives, ammo, drones and timer",
      g.lives == 3 and g.ammo == 5 and all(d.alive for d in g.world.enemies) and g.time_left == V.TIME_LIMIT)
g.time_left = 0.05; g.aim_point = (450, 100); run(30)
check("timer expiry ends the game", g.state == "over" and g.over_reason == "TIME EXPIRED", g.over_reason)
for st in ("menu", "rules", "pause", "over"): g.state = st; g.draw()
check("menu, rules, pause and game-over screens draw", True)
pg.quit()
print("\nALL PASSED" if not FAIL else f"\n{len(FAIL)} FAILED: {FAIL}")
raise SystemExit(1 if FAIL else 0)
