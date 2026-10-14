"""Headless checks for INDIGO, including an autopilot that flies the whole level.  Run: python test_indigo.py"""
import colorsys, math, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
os.environ.setdefault("SDL_VIDEODRIVER", "dummy"); os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
import pygame as pg
import indigo as I
V = pg.Vector2
FAIL = []
def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{info}]" if info else "")); (None if cond else FAIL.append(name))

# ---------- physics ----------
w = I.GravityWell((0, 0), 300, 20, 60)
a1, a2 = w.accel(V(100, 0)).length(), w.accel(V(200, 0)).length()
check("gravity follows an inverse-square law (softened)", abs(a1 / a2 - (200**2 + 196) / (100**2 + 196)) < 1e-9, f"ratio {a1/a2:.3f}")
check("gravity points toward the well", w.accel(V(100, 0)).x < 0)
check("softening keeps the force finite at the centre", w.accel(V(0.001, 0)).length() < 300 / 14**2 + 1e-6)
v = I.reflect(V(3, -4), V(0, 1))
check("wall reflection: v' = v − 2(v·n)n", v == V(3, 4))
for (pos, k, core, ring) in I.WELLS:
    g = I.GravityWell(pos, k, core, ring).accel(V(pos) + V(ring, 0)).length()
    check(f"thrust ({I.Spaceship.THRUST}) beats gravity at the danger ring of well {pos}", g < I.Spaceship.THRUST, f"{g:.3f}")
las = I.LaserObstacle((0, 0), 100)
check("laser alignment within ±15° (either beam direction)", las.aligned(las.angle + math.radians(14)) and las.aligned(las.angle + math.pi - math.radians(14)) and not las.aligned(las.angle + math.radians(20)))
gate = I.TargetGate()
check("gate opening is always wider than the ship", min(2 * (45 + 25 * math.sin(t / 10)) for t in range(0, 200)) > 2 * I.Spaceship.R + 6)

# ---------- palette ----------
src = open(os.path.join(os.path.dirname(__file__), "indigo.py"), encoding="utf-8").read()
cols = {tuple(map(int, m)) for m in re.findall(r"\((\d{1,3}), (\d{1,3}), (\d{1,3})\)", src)}
def violet(c):
    if max(c) == 0: return True
    h, l, s = colorsys.rgb_to_hls(*(x / 255 for x in c))
    return 250 <= h * 360 <= 300 and s > 0.15
check("every colour literal is an indigo/violet hue", all(violet(c) for c in cols), str([c for c in cols if not violet(c)]))

# ---------- game: tether, restart, autopilot ----------
G = I.Game(headless=True); G.action("start")
def run(n, ctrl=None):
    for _ in range(n):
        if ctrl: ctrl()
        G.step(1 / 60)
        if G.state != "play": return

# tether: place the ship near a node, attach, swing — length is kept
G.ship.pos, G.ship.vel, G.ship.angle = V(I.NODES[0]) + V(-80, 60), V(0, 0), math.atan2(-60, 80)
G.fire(); run(20)
check("anchor attaches to a node", G.ship.tether == 0, f"tether={G.ship.tether}")
L = G.ship.tlen; G.ship.vel = V(0, 4); run(60)
dist = G.ship.pos.distance_to(V(I.NODES[0]))
check("tether constrains the ship to the tether length", dist <= L + 0.5, f"{dist:.1f} ≤ {L:.1f}")
G.fire(); check("SPACE releases the tether without using an anchor", G.ship.tether is None)

G.action("restart")
check("restart resets lives, anchors, timer, ship and checkpoint",
      (G.lives, G.shots, G.time_left, G.checkpoint, G.ship.pos, G.ship.vel) == (3, 8, I.TIME_LIMIT, False, V(I.SPAWN), V()))

def wrap(a): return (a + math.pi) % (2 * math.pi) - math.pi
def pilot(target, vmax):
    sh = G.ship; to = V(target) - sh.pos; d = to.length()
    desired = to.normalize() * min(vmax, 0.035 * d + 0.4) if d > 2 else V()
    err = desired - sh.vel
    c = G.controls; c.update(thrust=False, reverse=False, left=False, right=False)
    if err.length() < 0.12: return d
    diff = wrap(math.atan2(err.y, err.x) - sh.angle)
    if abs(diff) > 0.05: c["right" if diff > 0 else "left"] = True
    if abs(diff) < 0.4: c["thrust"] = True
    return d

route = [((262, 300), 2.0), ((300, 165), 1.8), ((430, 160), 2.0), ((500, 320), 2.0), ((545, 350), 1.8)]
ok = True
for target, vmax in route:
    for _ in range(1500):
        if pilot(target, vmax) < 14 or G.state != "play": break
        G.step(1 / 60)
check("autopilot reaches the Polarity Field (checkpoint)", G.checkpoint and G.state == "play", f"pos {G.ship.pos}, lives {G.lives}")
# wait for a fresh safe window, then cross the beam
for _ in range(600):
    pilot((545, 350), 2.0); G.step(1 / 60)
    if not G.laser.active and G.laser.phase_left > 1.2: break
for _ in range(400):
    if pilot((690, 350), 3.5) < 14: break
    G.step(1 / 60)
for _ in range(900):
    if pilot((770, 350), 2.0) < 10: break
    G.step(1 / 60)
for _ in range(900):                                              # wait until the opening is wide
    pilot((770, 350), 1.0); G.step(1 / 60)
    if G.gate.half > 58: break
for _ in range(900):
    pilot((880, 350), 2.2); G.step(1 / 60)
    if G.state != "play": break
check("autopilot completes the level → victory", G.state == "won", f"state {G.state}, lives {G.lives}, time left {G.time_left:.0f}s")
for _ in range(120): G.step(1 / 60); G.draw()
check("victory screen draws", True)

G.action("restart"); G.ship.pos = V(I.WELLS[1][0]) + V(30, 0); G.ship.inv = 0; run(5)
check("touching a singularity core costs a life and respawns", G.lives == 2 and G.ship.pos.distance_to(V(I.SPAWN)) < 2)
G.time_left = 0.02; run(5)
check("timer expiry ends the run", G.state == "over" and "TIME" in G.reason, G.reason)
for st in ("menu", "rules", "pause", "over"): G.state = st; G.draw()
check("menu, rules, pause and SIGNAL LOST screens draw", True)
pg.quit()
print("\nALL PASSED" if not FAIL else f"\n{len(FAIL)} FAILED: {FAIL}")
raise SystemExit(1 if FAIL else 0)
