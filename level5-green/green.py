"""
GREEN
2D top-down survival horror. Thanos is lost in an ancient forest maze. Find three
runes, slip past the phantom that hunts by sound, return to the giant tree and walk
through the door in its trunk.

Standalone: Python 3 + pygame only (python -m pip install pygame). Every image and
sound is generated in code. Visual style: dark painterly top-down forest with a
shadow-casting flashlight (after the reference picture), green shades only.
Controls: WASD / arrows move · SHIFT sprint (makes noise) · mouse aims the flashlight
          ENTER start · R restart · P pause · M mute · ESC quit
"""
import array, math, random, sys
from collections import deque
import pygame as pg

V = pg.Vector2
W, H, FPS = 900, 650, 60
CELL = 52
TIME_LIMIT = 600.0                      # 10:00 — a timeout restarts the level
LIVES = 3
WALK, SPRINT = 118.0, 190.0             # px/s — sprint is 1.61× walk
PLAYER_R, PHANTOM_R, RUNE_R = 12, 15, 14
PH_WANDER, PH_SEARCH, PH_HUNT = 78.0, 96.0, 150.0     # faster than walking, slower than sprinting
HEAR_RANGE, SENSE_RANGE = 480.0, 90.0
RING_COOLDOWN, RING_LIFE, RING_MAX = 0.6, 0.9, 150.0
SEARCH_TIME = 3.5
LIGHT_RANGE, LIGHT_HALF = 330, math.radians(32)
AMBIENT_R = 105
JUMPSCARE_FRAMES = 60
SPAWN_PROTECT = 1.2
RITUAL_TIME, DOOR_PHASE = 3.0, 1.6      # runes + energy for 1.6 s, then the door slides open until 3.0 s

# ---- strict green palette (spec primaries first, then intermediate greens) ----
VOID, GROUND, WALLC, PLAYER, LIGHT, PHANTOM, PORTAL = (2, 10, 3), (12, 37, 14), (26, 74, 30), (133, 255, 133), (57, 255, 20), (10, 56, 22), (200, 255, 200)
DEEP, DARKWALL, MOSS, GRASS, GRASS_HI, GRASS_LO, DIRT = (5, 20, 7), (9, 28, 11), (30, 70, 32), (64, 116, 54), (88, 146, 74), (46, 92, 44), (54, 88, 46)
BARK, BARK_HI, LEAF, LEAF_HI, STONE, STONE_HI = (16, 44, 19), (40, 86, 42), (40, 104, 44), (72, 150, 70), (70, 100, 70), (98, 134, 96)
TEXT, TEXT_DIM, GLOW, PALE, ARMOR, ARMOR_HI, SKIN_LO = (160, 232, 160), (88, 150, 90), (110, 255, 110), (170, 240, 170), (38, 110, 46), (96, 180, 84), (70, 170, 78)

MAP = [
    "###############################",
    "#1............#.......#......2#",
    "#.#######.#.#.#.#.#.#.#.#.###.#",
    "#...#...#.#....H#...#.#.#...#.#",
    "#.#.#.#.#.#.#.#.#.#.###.#.#.#.#",
    "#.#.#...#.........#...#.#.#...#",
    "#.#.#.#.#.#######.###.#.#.###.#",
    "#.#...#.#.#.........#...#.#...#",
    "#.#####.#.#.........#.###.#####",
    "#.#.................#...#.....#",
    "#.#.###.#.#...TTT...###.#####.#",
    "#.#.......#...TPT...#.#.#.#...#",
    "###.#.#.#.#...TDT...#.#.#.#.###",
    "#.....#.#.#.............#.....#",
    "#.#######.#.........#.###.###.#",
    "#.....#...#.........#.#.....#.#",
    "#.###.#.#######.#####.#.#.###.#",
    "#...#.#.#...............#.#...#",
    "#####.#.#.#.#####.#.#######.#.#",
    "#...#...#.#.......#.#.......#.#",
    "#.#.#####.#.#########.#######.#",
    "#S#.......#...........#......3#",
    "###############################",
]
RUNE_NAMES = ("RUNE OF ROOT", "RUNE OF THORN", "RUNE OF VEIL")


# =============================================================== world
class ForestMaze:
    """Fixed grid. '#' thicket · 'T' tree trunk · 'D' door in the trunk · 'P' portal hollow inside the trunk."""
    def __init__(s):
        s.cols, s.rows = len(MAP[0]), len(MAP)
        assert all(len(r) == s.cols for r in MAP), "map rows must be equal length"
        s.grid, s.runes = [], {}
        for y, row in enumerate(MAP):
            line = []
            for x, ch in enumerate(row):
                if ch == "S": s.spawn = (x, y); ch = "."
                elif ch == "H": s.phantom_home = (x, y); ch = "."
                elif ch in "123": s.runes[int(ch) - 1] = (x, y); ch = "."
                elif ch == "D": s.door = (x, y)
                elif ch == "P": s.portal = (x, y)
                line.append(ch)
            s.grid.append(line)
        s.trunk = [(x, y) for y, r in enumerate(s.grid) for x, c in enumerate(r) if c in "TDP"]
        s.door_front = (s.door[0], s.door[1] + 1)
        s.tree_center = V(sum(c[0] for c in s.trunk) / len(s.trunk) + 0.5, sum(c[1] for c in s.trunk) / len(s.trunk) + 0.5) * CELL
        s.world_w, s.world_h = s.cols * CELL, s.rows * CELL
        s.door_open = False
        s.validate()

    def char(s, c):
        x, y = c
        return s.grid[y][x] if 0 <= x < s.cols and 0 <= y < s.rows else "#"
    def solid(s, c):
        ch = s.char(c)
        return ch in "#T" or (ch in "DP" and not s.door_open)
    def player_ok(s, c): return not s.solid(c)
    def phantom_ok(s, c): return s.char(c) == "."            # the phantom never enters the tree
    @staticmethod
    def cell_of(p): return int(p[0] // CELL), int(p[1] // CELL)
    @staticmethod
    def center(c): return V((c[0] + 0.5) * CELL, (c[1] + 0.5) * CELL)

    def bfs(s, start, ok, maxd=None):
        dist, prev, q = {start: 0}, {start: None}, deque([start])
        while q:
            c = q.popleft()
            if maxd is not None and dist[c] >= maxd: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (c[0] + dx, c[1] + dy)
                if n not in dist and ok(n): dist[n], prev[n] = dist[c] + 1, c; q.append(n)
        return dist, prev

    def path(s, a, b, ok):
        """Cells from a (exclusive) to b (inclusive); [] when a == b; None when unreachable."""
        if a == b: return []
        dist, prev = s.bfs(a, ok)
        if b not in dist: return None
        out = [b]
        while prev[out[-1]] != a: out.append(prev[out[-1]])
        return out[::-1]

    def nearest(s, c, ok):
        """Closest cell (grid distance) satisfying ok, searching through every non-thicket cell."""
        if ok(c): return c
        dist, _ = s.bfs(c, lambda n: s.char(n) != "#")
        best = [n for n in sorted(dist, key=dist.get) if ok(n)]
        return best[0] if best else None

    def validate(s):
        """Refuse to run an unwinnable layout: spawn → every rune and the door front; door → portal once opened."""
        reach, _ = s.bfs(s.spawn, s.player_ok)
        need = [*s.runes.values(), s.door_front, s.phantom_home]
        missing = [c for c in need if c not in reach]
        bad = [c for c in s.runes.values() if s.char(c) != "."]
        was = s.door_open; s.door_open = True
        open_reach, _ = s.bfs(s.spawn, s.player_ok); s.door_open = was
        if missing or bad or s.portal not in open_reach or s.door not in open_reach:
            raise SystemExit(f"GREEN layout failed validation: unreachable {missing} blocked {bad}")
        if len(s.runes) != 3: raise SystemExit("GREEN layout needs exactly three runes")

    def cast(s, o, ang, maxd, seen=None):
        """Grid DDA ray; distance to the first solid cell (or maxd). Adds visited cells to `seen`."""
        dx, dy = math.cos(ang), math.sin(ang)
        cx, cy = int(o[0] // CELL), int(o[1] // CELL)
        sx, sy = (1 if dx > 0 else -1), (1 if dy > 0 else -1)
        tdx = abs(CELL / dx) if abs(dx) > 1e-9 else 1e18
        tdy = abs(CELL / dy) if abs(dy) > 1e-9 else 1e18
        tx = (((cx + 1) * CELL - o[0]) / dx if dx > 0 else (cx * CELL - o[0]) / dx) if abs(dx) > 1e-9 else 1e18
        ty = (((cy + 1) * CELL - o[1]) / dy if dy > 0 else (cy * CELL - o[1]) / dy) if abs(dy) > 1e-9 else 1e18
        while True:
            if seen is not None: seen.add((cx, cy))
            if tx < ty: t, tx, cx = tx, tx + tdx, cx + sx
            else: t, ty, cy = ty, ty + tdy, cy + sy
            if t >= maxd: return maxd
            if s.solid((cx, cy)):
                if seen is not None: seen.add((cx, cy))
                return t

    def los(s, a, b):
        d = V(b) - V(a); L = d.length()
        return L < 1 or s.cast(a, math.atan2(d.y, d.x), L) >= L - 0.5


# =============================================================== actors
class Player:
    def __init__(s, pos, aim=-math.pi / 2):
        s.pos, s.vel, s.aim = V(pos), V(), aim
        s.moving = s.sprinting = False
        s.walk_t = 0.0

    def update(s, dt, maze, ctrl):
        d = V(ctrl["right"] - ctrl["left"], ctrl["down"] - ctrl["up"])
        s.moving = d.length_squared() > 0
        if s.moving: d = d.normalize()                          # diagonals are never faster
        s.sprinting = s.moving and bool(ctrl["sprint"])
        s.vel = d * (SPRINT if s.sprinting else WALK)
        move = s.vel * dt
        n = int(move.length() // 4) + 1                          # sub-steps: never more than 4 px per test
        for _ in range(n):
            s.pos.x += move.x / n; s.resolve(maze)
            s.pos.y += move.y / n; s.resolve(maze)
        if s.moving: s.walk_t += dt * (1.6 if s.sprinting else 1.0)

    def resolve(s, maze):
        """Circle-versus-cell push-out against every solid neighbour, repeated until clear."""
        for _ in range(4):
            hit = False
            cx, cy = maze.cell_of(s.pos)
            for gy in range(cy - 1, cy + 2):
                for gx in range(cx - 1, cx + 2):
                    if not maze.solid((gx, gy)): continue
                    rx, ry = gx * CELL, gy * CELL
                    qx, qy = min(max(s.pos.x, rx), rx + CELL), min(max(s.pos.y, ry), ry + CELL)
                    d = V(s.pos.x - qx, s.pos.y - qy); L = d.length()
                    if L >= PLAYER_R: continue
                    hit = True
                    if L > 1e-6: s.pos += d * ((PLAYER_R - L) / L)
                    else:                                                 # centre inside the cell: shortest exit
                        opts = [(s.pos.x - rx, V(-1, 0)), (rx + CELL - s.pos.x, V(1, 0)), (s.pos.y - ry, V(0, -1)), (ry + CELL - s.pos.y, V(0, 1))]
                        pen, n = min(opts, key=lambda o: o[0]); s.pos += n * (pen + PLAYER_R)
            if not hit: break
        s.pos.x = min(max(s.pos.x, PLAYER_R), maze.world_w - PLAYER_R)
        s.pos.y = min(max(s.pos.y, PLAYER_R), maze.world_h - PLAYER_R)


class Phantom:
    """States: WANDER (random reachable goals) · INVESTIGATE (BFS to the last heard sound) · SEARCH (sweep, then return to WANDER)."""
    def __init__(s, maze, rng):
        s.maze, s.rng, s.enabled = maze, rng, True
        s.reset()

    def reset(s):
        s.pos = s.maze.center(s.maze.phantom_home)
        s.state, s.path, s.target = "WANDER", [], None
        s.search_t, s.search_c, s.pause = 0.0, None, 0.6
        s.face, s.anim, s.stuck_t, s.last = V(0, 1), 0.0, 0.0, V(s.pos)

    @property
    def cell(s): return s.maze.cell_of(s.pos)

    def hear(s, origin):
        """A detection event: go to where the sound was made (never where the player is now)."""
        goal = s.maze.nearest(s.maze.cell_of(origin), s.maze.phantom_ok)
        if goal is None: return
        p = s.maze.path(s.cell, goal, s.maze.phantom_ok)
        if p is None: return                                       # unreachable: ignore, keep current plan
        s.state, s.target, s.path, s.pause = "INVESTIGATE", goal, p, 0.0
        if not p: s.arrive()

    def choose(s):
        cur = s.cell
        if s.state == "SEARCH":
            dist, _ = s.maze.bfs(s.search_c, s.maze.phantom_ok, maxd=3)
            opts = [c for c in dist if c != cur]
        else:
            s.state = "WANDER"
            dist, _ = s.maze.bfs(cur, s.maze.phantom_ok)
            opts = [c for c, d in dist.items() if 5 <= d <= 16] or [c for c in dist if c != cur]
        if not opts: s.state, s.pause = "WANDER", 0.5; return
        goal = s.rng.choice(sorted(opts))
        p = s.maze.path(cur, goal, s.maze.phantom_ok)
        if not p: s.pause = 0.3; return                             # invalid route: pick again next frame
        s.target, s.path = goal, p

    def arrive(s):
        if s.state == "INVESTIGATE": s.state, s.search_t, s.search_c, s.pause = "SEARCH", SEARCH_TIME, s.cell, 0.5
        elif s.state == "WANDER": s.pause = s.rng.uniform(0.3, 1.1)

    def update(s, dt):
        s.anim += dt
        if not s.enabled: return
        if s.state == "SEARCH":
            s.search_t -= dt
            if s.search_t <= 0: s.state, s.path, s.pause = "WANDER", [], 0.4
        if s.pause > 0: s.pause -= dt; return
        if not s.path:
            if s.state == "INVESTIGATE": s.arrive(); return
            s.choose()
            if not s.path: return
        speed = {"WANDER": PH_WANDER, "SEARCH": PH_SEARCH, "INVESTIGATE": PH_HUNT}[s.state]
        goal = s.maze.center(s.path[0]); d = goal - s.pos; L = d.length(); step = speed * dt
        if L <= step:                                               # snap: never normalise a zero vector
            s.pos = goal; s.path.pop(0)
            if not s.path: s.arrive()
        else:
            s.face = d / L; s.pos += s.face * step
        s.stuck_t = s.stuck_t + dt if (s.pos - s.last).length() < 0.5 else 0.0
        s.last = V(s.pos)
        if s.stuck_t > 1.5: s.path, s.stuck_t, s.state = [], 0.0, "WANDER"      # recover: replan


class Rune:
    def __init__(s, idx, cell):
        s.idx, s.cell, s.pos = idx, cell, ForestMaze.center(cell)
        s.vis = 0.0


class Flashlight:
    """Mouse-aimed cone + small ambient halo, both occluded by the grid. One visibility rule for art and logic."""
    RAYS, AMB_RAYS = 72, 48
    def __init__(s):
        s.cone, s.amb, s.flicker = [], [], 1.0

    def illuminates(s, maze, origin, aim, p):
        d = V(p) - origin; L = d.length()
        if L > LIGHT_RANGE: return False
        if L > 1e-6:
            diff = (math.atan2(d.y, d.x) - aim + math.pi) % math.tau - math.pi
            if abs(diff) > LIGHT_HALF: return False
        return maze.los(origin, p)

    def near(s, maze, origin, p):
        return (V(p) - origin).length() <= AMBIENT_R + 18 and maze.los(origin, p)

    def compute(s, maze, origin, aim, seen):
        s.cone = [V(origin)]
        for i in range(s.RAYS + 1):
            a = aim - LIGHT_HALF + 2 * LIGHT_HALF * i / s.RAYS
            d = maze.cast(origin, a, LIGHT_RANGE, seen)
            d = min(LIGHT_RANGE, d + (12 if d < LIGHT_RANGE else 0))   # let the light lick the wall face
            s.cone.append(origin + V(math.cos(a), math.sin(a)) * d)
        s.amb = []
        for i in range(s.AMB_RAYS):
            a = math.tau * i / s.AMB_RAYS
            d = maze.cast(origin, a, AMBIENT_R, seen)
            s.amb.append(origin + V(math.cos(a), math.sin(a)) * min(AMBIENT_R, d + 10))


# =============================================================== sound
class Synth:
    SR = 22050
    def __init__(s):
        s.ok, s.muted, s.snd = False, False, {}
        try: pg.mixer.quit(); pg.mixer.init(s.SR, -16, 1, 512); s.ok = pg.mixer.get_init() == (s.SR, -16, 1)   # pg.init() opened 44.1 kHz stereo
        except pg.error: s.ok = False
        if not s.ok: return
        rnd = random.Random(5); nz = lambda: rnd.uniform(-1, 1); ex, sin, tau = math.exp, math.sin, math.tau
        def mk(dur, fn):
            return pg.mixer.Sound(buffer=array.array("h", (int(max(-1, min(1, fn(i / s.SR))) * 30000) for i in range(int(dur * s.SR)))).tobytes())
        lp = [0.0]
        def soft(x, k=0.12): lp[0] += (x - lp[0]) * k; return lp[0]
        s.snd["step"] = mk(0.09, lambda t: soft(nz(), 0.25) * ex(-t * 45) * 1.6)
        s.snd["ring"] = mk(0.5, lambda t: sin(tau * (95 - 60 * t) * t) * ex(-t * 7) * 0.8)
        s.snd["rune"] = mk(1.6, lambda t: sum(sin(tau * f * t) * ex(-t * (2 + k)) for k, f in enumerate((440.0, 523.3, 659.3, 880.0))) / 2.6)
        s.snd["seal"] = mk(0.7, lambda t: (sin(tau * 98 * t) + sin(tau * 103.8 * t)) * ex(-t * 5) * 0.45)
        s.snd["energy"] = mk(1.6, lambda t: (sin(tau * (200 + 500 * t) * t) * 0.4 + sin(tau * (300 + 760 * t) * t) * 0.3) * min(1, t * 3) * ex(-t * 0.6))
        s.snd["door"] = mk(1.5, lambda t: ((((t * (90 + 30 * sin(tau * 3 * t))) % 1) * 2 - 1) * 0.35 + soft(nz(), 0.05) * 1.2) * min(1, t * 6) * ex(-t * 1.4))
        s.snd["warp"] = mk(2.4, lambda t: (sin(tau * (120 + 500 * t * t) * t) * 0.5 + nz() * 0.12) * min(1, t * 2) * ex(-t * 0.9))
        s.snd["scare"] = mk(1.1, lambda t: (nz() * 0.55 + ((t * (1240 + 300 * sin(tau * 40 * t))) % 1 - 0.5) * 0.9 + ((t * 1311) % 1 - 0.5) * 0.7) * (0.6 + 0.4 * sin(tau * 23 * t)) * ex(-t * 1.6))
        s.snd["heart"] = mk(0.55, lambda t: sin(tau * 52 * t) * (ex(-t * 26) + (ex(-(t - 0.22) * 22) * 0.75 if t > 0.22 else 0)) * 1.1)
        s.snd["whisper"] = mk(1.3, lambda t: soft(nz(), 0.4) * (0.5 + 0.5 * sin(tau * 7 * t)) * sin(math.pi * t / 1.3) * 0.9)
        s.snd["click"] = mk(0.06, lambda t: sin(tau * 1500 * t) * ex(-t * 70) * 0.4)
        s.snd["over"] = mk(2.2, lambda t: (sin(tau * (110 - 40 * t) * t) + 0.6 * sin(tau * (116 - 44 * t) * t)) * ex(-t * 1.2) * 0.5)
        s.music = s.make_music(rnd)
        s.mchan = pg.mixer.Channel(0)

    def make_music(s, rnd):
        """12 s horror bed: detuned drone with slow swell, filtered wind, sparse bell tones with long decay."""
        n, tau = int(12 * s.SR), math.tau
        bells = [(rnd.uniform(0, 11), rnd.choice((220.0, 261.6, 311.1, 329.6, 207.7))) for _ in range(5)]
        buf, lp, wind = [0.0] * n, 0.0, 0.0
        for i in range(n):
            t = i / s.SR
            swell = 0.55 + 0.45 * math.sin(tau * t / 12)
            drone = (math.sin(tau * 55 * t) + 0.8 * math.sin(tau * 55.35 * t) + 0.35 * math.sin(tau * 82.4 * t)) * 0.09 * swell
            lp += (rnd.uniform(-1, 1) - lp) * (0.02 + 0.015 * math.sin(tau * t / 4))
            wind = lp * 0.5 * (0.6 + 0.4 * math.sin(tau * t / 6 + 1))
            bell = sum(math.sin(tau * f * (t - b0)) * math.exp(-(t - b0) * 1.5) * 0.06 for b0, f in bells if 0 <= t - b0 < 3)
            buf[i] = drone + wind + bell
        k = int(0.3 * s.SR)                                             # crossfade the seam
        for i in range(k): buf[i] = buf[i] * (i / k) + buf[n - k + i] * (1 - i / k)
        return pg.mixer.Sound(buffer=array.array("h", (int(max(-1, min(1, x)) * 30000) for x in buf[: n - k])).tobytes())

    def play(s, name, vol=1.0):
        if s.ok and not s.muted and name in s.snd: s.snd[name].set_volume(vol); s.snd[name].play()
    def music_on(s):
        if s.ok and not s.muted and not s.mchan.get_busy(): s.mchan.play(s.music, loops=-1); s.mchan.set_volume(0.7)
    def toggle(s):
        s.muted = not s.muted
        if not s.ok: return
        if s.muted: pg.mixer.pause(); s.mchan.stop()
        else: pg.mixer.unpause(); s.music_on()


class Mute:
    muted = False
    def play(s, *a, **k): pass
    def music_on(s): pass
    def toggle(s): pass


# =============================================================== art
def radial(size, peak, power=1.3):
    """Square RGB sprite: radial gradient from `peak` at the centre to black at the rim."""
    surf = pg.Surface((size, size)); surf.fill((0, 0, 0)); r0 = size // 2
    for r in range(r0, 0, -1):
        v = (1 - r / r0) ** power
        pg.draw.circle(surf, (int(peak[0] * v), int(peak[1] * v), int(peak[2] * v)), (r0, r0), r)
    return surf


def branch(surf, rnd, p, ang, length, width, depth, col):
    if depth <= 0 or length < 5: return
    pts = [V(p)]
    for _ in range(3):
        ang += rnd.uniform(-0.25, 0.25); pts.append(pts[-1] + V(math.cos(ang), math.sin(ang)) * length / 3)
    for a, b in zip(pts, pts[1:]): pg.draw.line(surf, col, a, b, max(1, int(width)))
    for _ in range(rnd.choice([2, 2, 3])):
        branch(surf, rnd, pts[-1], ang + rnd.uniform(-0.75, 0.75), length * rnd.uniform(0.6, 0.8), width * 0.66, depth - 1, col)


def trunk_shape(c, half, wob, rnd, n=72):
    """Gnarled four-lobed trunk outline: flat sides match the collision cells, root flares cover the corners."""
    pts = []
    for i in range(n):
        a = math.tau * i / n
        r = half / max(abs(math.cos(a)), abs(math.sin(a))) ** 0.4 + 32 * max(0.0, -math.cos(4 * a)) ** 2   # root flares cover the corners
        r += wob * math.sin(a * 7 + 1.3) + rnd.uniform(-wob, wob) * 0.5
        pts.append(c + V(math.cos(a), math.sin(a)) * r)
    return pts


def bake_world(maze):
    """Static forest: painterly grass, dirt trails, thickets, stone ruins, dead-branch shadows and the giant tree."""
    rnd = random.Random(42)
    ww, wh = maze.world_w, maze.world_h
    surf = pg.Surface((ww, wh)); surf.fill(GRASS)
    layer = pg.Surface((ww, wh), pg.SRCALPHA)
    for _ in range(520):                                                   # soft patches
        c = rnd.choice((GRASS_LO, GRASS_HI, MOSS, DIRT, (74, 128, 62)))
        pg.draw.circle(layer, (*c, 46), (rnd.uniform(0, ww), rnd.uniform(0, wh)), rnd.uniform(18, 64))
    surf.blit(layer, (0, 0))
    floor = [(x, y) for y in range(maze.rows) for x in range(maze.cols) if maze.char((x, y)) == "."]
    layer.fill((0, 0, 0, 0))
    for x, y in floor:                                                     # worn dirt trails along corridors
        c = maze.center((x, y))
        for n in ((x + 1, y), (x, y + 1)):
            if maze.char(n) == ".": pg.draw.line(layer, (*DIRT, 120), c, maze.center(n), 22)
        pg.draw.circle(layer, (*DIRT, 120), c, 11)
    surf.blit(layer, (0, 0))
    for _ in range(11000):                                                 # grass blades
        x, y, a = rnd.uniform(0, ww), rnd.uniform(0, wh), rnd.uniform(-0.6, 0.6) - math.pi / 2
        l = rnd.uniform(3, 7)
        pg.draw.line(surf, rnd.choice((GRASS_HI, GRASS_LO, (76, 132, 64), MOSS)), (x, y), (x + math.cos(a) * l, y + math.sin(a) * l))
    for _ in range(1600): surf.fill(rnd.choice((DEEP, (66, 120, 60), GRASS_LO)), (rnd.randrange(ww), rnd.randrange(wh), 2, 2))
    for _ in range(260):
        r = pg.Rect(0, 0, rnd.uniform(3, 8), rnd.uniform(2, 6)); r.center = (rnd.uniform(0, ww), rnd.uniform(0, wh))
        pg.draw.ellipse(surf, rnd.choice((STONE, STONE_HI, DEEP)), r)
    # fairy ring of pale mushrooms around the clearing
    tc = maze.tree_center
    for i in range(22):
        a = math.tau * i / 22 + rnd.uniform(-0.05, 0.05); p = tc + V(math.cos(a) * 196, math.sin(a) * 196)
        pg.draw.circle(surf, MOSS, p + V(1, 2), 5); pg.draw.circle(surf, (120, 190, 116), p, 4); pg.draw.circle(surf, PALE, p - V(1, 1), 1)
    # drop shadows under walls, then thickets / ruins
    shade = pg.Surface((ww, wh), pg.SRCALPHA)
    walls = [(x, y) for y in range(maze.rows) for x in range(maze.cols) if maze.char((x, y)) == "#"]
    for x, y in walls: pg.draw.rect(shade, (*DEEP, 150), (x * CELL + 6, y * CELL + 9, CELL, CELL), border_radius=12)
    surf.blit(shade, (0, 0))
    ruins = {c for c in walls if 0 < c[0] < maze.cols - 1 and 0 < c[1] < maze.rows - 1 and rnd.random() < 0.1}
    for x, y in walls:
        r = pg.Rect(x * CELL, y * CELL, CELL, CELL)
        pg.draw.rect(surf, DARKWALL, r.inflate(2, 2), border_radius=6)
    for x, y in walls:
        r = pg.Rect(x * CELL, y * CELL, CELL, CELL)
        if (x, y) in ruins:                                                # crumbling stone wall
            pg.draw.rect(surf, STONE, r.inflate(-2, -2))
            for row in range(4):
                yy = r.y + 1 + row * 13; off = 0 if row % 2 else 9
                pg.draw.line(surf, DEEP, (r.x, yy), (r.right, yy), 2)
                for xx in range(r.x + off, r.right, 18): pg.draw.line(surf, DEEP, (xx, yy), (xx, yy + 13), 2)
            for _ in range(10): surf.fill(rnd.choice((STONE_HI, MOSS, LEAF)), (rnd.randrange(r.x, r.right - 4), rnd.randrange(r.y, r.bottom - 4), 4, 3))
            pg.draw.rect(surf, DEEP, r, 2)
            continue
        c = V(r.center)
        for _ in range(8):
            p = c + V(rnd.uniform(-14, 14), rnd.uniform(-14, 14))
            pg.draw.circle(surf, rnd.choice((WALLC, LEAF, (20, 60, 24), (16, 50, 20))), p, rnd.uniform(9, 16))
        for _ in range(5): pg.draw.circle(surf, LEAF_HI, c + V(rnd.uniform(-16, 10), rnd.uniform(-16, 10)), rnd.uniform(2, 5))
        for _ in range(5): pg.draw.circle(surf, DEEP, c + V(rnd.uniform(-18, 18), rnd.uniform(-18, 18)), rnd.uniform(1.5, 3.5))
        if rnd.random() < 0.22:                                            # a dead trunk inside the thicket
            pg.draw.circle(surf, BARK, c, 11); pg.draw.circle(surf, BARK_HI, c, 11, 2); pg.draw.circle(surf, DEEP, c, 5)
    # the ancient tree: roots, gnarled trunk, bark grooves, moss
    for i in range(14):
        a = math.tau * i / 14 + rnd.uniform(-0.15, 0.15)
        if abs((a - math.pi / 2 + math.pi) % math.tau - math.pi) < 0.35: continue    # keep the door approach clear
        branch(surf, rnd, tc + V(math.cos(a), math.sin(a)) * 92, a, rnd.uniform(60, 110), 9, 3, BARK)
    pts = trunk_shape(tc, 78, 5, rnd)
    pg.draw.polygon(surf, DEEP, [p + V(6, 9) for p in pts])
    pg.draw.polygon(surf, BARK, pts)
    for k in (0.84, 0.66, 0.48, 0.3):
        pg.draw.polygon(surf, BARK_HI if k > 0.5 else (22, 58, 26), [tc + (p - tc) * k for p in pts], 2)
    for i in range(36):
        a = math.tau * i / 36; p0 = tc + V(math.cos(a), math.sin(a)) * rnd.uniform(20, 40)
        pg.draw.line(surf, DEEP, p0, tc + V(math.cos(a), math.sin(a)) * rnd.uniform(70, 100), 2)
    for _ in range(40): pg.draw.circle(surf, rnd.choice((MOSS, LEAF, WALLC)), tc + V(rnd.uniform(-80, 80), rnd.uniform(-80, 80)), rnd.uniform(3, 8))
    pg.draw.polygon(surf, DEEP, pts, 3)
    # dead-branch shadows over everything (the reference's black silhouettes)
    canopy = pg.Surface((ww, wh), pg.SRCALPHA)
    for _ in range(18):
        cx, cy = rnd.choice(walls); p = maze.center((cx, cy))
        for k in range(rnd.choice([3, 4, 5])):
            branch(canopy, rnd, p, rnd.uniform(0, math.tau), rnd.uniform(70, 120), rnd.uniform(5, 8), 5, (*DEEP, 255))
    for i in range(9):                                                     # the giant tree's own crown, thick near the trunk
        branch(canopy, rnd, tc, math.tau * i / 9 + rnd.uniform(-0.2, 0.2), rnd.uniform(150, 210), 16, 6, (*DEEP, 255))
    canopy.set_alpha(120)
    surf.blit(canopy, (0, 0))
    return surf


def draw_glyph(surf, idx, c, r, col, w=2):
    x, y = c
    if idx == 0:                                                           # root: triangle with an eye
        pg.draw.polygon(surf, col, [(x, y - r), (x + r * 0.87, y + r * 0.5), (x - r * 0.87, y + r * 0.5)], w)
        pg.draw.circle(surf, col, (x, y + r * 0.08), max(2, r * 0.22), w)
    elif idx == 1:                                                         # thorn: algiz
        pg.draw.line(surf, col, (x, y + r), (x, y - r), w)
        pg.draw.line(surf, col, (x, y - r * 0.1), (x - r * 0.7, y - r * 0.8), w); pg.draw.line(surf, col, (x, y - r * 0.1), (x + r * 0.7, y - r * 0.8), w)
        pg.draw.line(surf, col, (x - r * 0.4, y + r * 0.5), (x + r * 0.4, y + r * 0.5), w)
    else:                                                                  # veil: diamond with a cross
        pg.draw.polygon(surf, col, [(x, y - r), (x + r * 0.7, y), (x, y + r), (x - r * 0.7, y)], w)
        pg.draw.line(surf, col, (x - r, y), (x + r, y), w); pg.draw.line(surf, col, (x, y - r * 0.45), (x, y + r * 0.45), w)


def draw_thanos_face(surf, c, r, mood, t):
    """Thanos portrait, green-shifted. mood ∈ calm, wary, strain, fear, smug, resolve, triumph."""
    x, y = c
    brow = {"calm": 0.2, "wary": 0.7, "strain": 0.9, "fear": -0.7, "smug": 0.1, "resolve": 0.6, "triumph": 0.0}[mood]
    mouth = {"calm": -0.1, "wary": -0.35, "strain": -0.6, "fear": -0.95, "smug": 0.55, "resolve": -0.05, "triumph": 0.9}[mood]
    pg.draw.ellipse(surf, ARMOR, (x - r * 1.0, y + r * 0.55, r * 2.0, r * 0.9))                      # gold-armour collar (in green)
    pg.draw.ellipse(surf, ARMOR_HI, (x - r * 1.0, y + r * 0.55, r * 2.0, r * 0.9), max(1, r // 14))
    head = [(x - r * 0.62, y - r * 0.55), (x - r * 0.7, y + r * 0.05), (x - r * 0.55, y + r * 0.55), (x - r * 0.25, y + r * 0.82),
            (x + r * 0.25, y + r * 0.82), (x + r * 0.55, y + r * 0.55), (x + r * 0.7, y + r * 0.05), (x + r * 0.62, y - r * 0.55)]
    pg.draw.ellipse(surf, SKIN_LO, (x - r * 0.64, y - r * 0.95, r * 1.28, r * 1.0))                  # bald crown
    pg.draw.polygon(surf, SKIN_LO, head)
    pg.draw.ellipse(surf, (96, 205, 100), (x - r * 0.5, y - r * 0.9, r * 0.9, r * 0.6))              # skull highlight
    for k in (-1.5, -0.5, 0.5, 1.5):                                                                    # the famous chin ridges
        pg.draw.line(surf, ARMOR, (x + k * r * 0.13, y + r * 0.5), (x + k * r * 0.15, y + r * 0.8), max(1, r // 18))
    for sgn in (-1, 1):
        inner = (x + sgn * r * 0.08, y - r * 0.2 + brow * r * 0.1); outer = (x + sgn * r * 0.5, y - r * 0.3 - brow * r * 0.06)
        pg.draw.line(surf, DEEP, inner, outer, max(2, r // 9))
        ew = r * (0.13 if mood == "fear" else 0.1)
        if mood == "triumph": pg.draw.arc(surf, PORTAL, (x + sgn * r * 0.28 - ew, y - r * 0.12 - ew, ew * 2, ew * 2), 0.3, 2.8, max(1, r // 18))
        else:
            pg.draw.ellipse(surf, PORTAL, (x + sgn * r * 0.28 - ew, y - r * 0.12 - ew * 0.5, ew * 2, ew * (1.5 if mood == "fear" else 1.0)))
            pg.draw.circle(surf, DEEP, (x + sgn * r * 0.28, y - r * 0.1), max(1, ew * 0.45))
    mw, my = r * 0.3, y + r * 0.33
    pts = [(x + k / 6 * mw * 2 - mw, my - mouth * r * 0.1 * (1 - ((k / 6) * 2 - 1) ** 2)) for k in range(7)]
    pg.draw.lines(surf, DEEP, False, pts, max(2, r // 12))
    if mood in ("fear", "strain") and int(t * 3) % 2: pg.draw.circle(surf, PALE, (x + r * 0.58, y - r * 0.3 + (t * 14) % (r * 0.4)), max(1, r // 14))
    pg.draw.polygon(surf, DEEP, head, max(1, r // 16))


def draw_thanos_topdown(surf, p, aim, t, moving, sprint, ghost=False):
    """Thanos seen from above: bald ridged head, armoured shoulders, the Gauntlet holding the flashlight."""
    f = V(math.cos(aim), math.sin(aim)); rt = V(-f.y, f.x)
    sway = math.sin(t * (14 if sprint else 9)) * (2.2 if moving else 0)
    pg.draw.circle(surf, DEEP, p + V(3, 5), 15)
    body = [p + rt * 15 - f * 2, p + rt * 12 - f * 9, p - rt * 12 - f * 9, p - rt * 15 - f * 2, p - rt * 10 + f * 6, p + rt * 10 + f * 6]
    pg.draw.polygon(surf, ARMOR, body); pg.draw.polygon(surf, DEEP, body, 1)
    for sgn in (1, -1):                                                    # pauldrons swing with the stride
        pg.draw.circle(surf, ARMOR_HI, p + rt * sgn * 12 + f * (sway * sgn * 0.5), 6); pg.draw.circle(surf, DEEP, p + rt * sgn * 12 + f * (sway * sgn * 0.5), 6, 1)
    hand = p + rt * 6 + f * 20
    pg.draw.line(surf, SKIN_LO, p + rt * 11, hand - f * 3, 6)
    pg.draw.circle(surf, ARMOR_HI, hand, 6)                                  # the Infinity Gauntlet
    for k in range(6): pg.draw.circle(surf, (PORTAL, GLOW, LIGHT, PALE, LEAF_HI, (150, 255, 120))[k], hand + V(math.cos(k * 1.05), math.sin(k * 1.05)) * 3.5, 1)
    pg.draw.rect(surf, DEEP, (*(hand + f * 6 - V(3, 3)), 6, 6))
    pg.draw.circle(surf, LIGHT, hand + f * 8, 2)
    pg.draw.line(surf, SKIN_LO, p - rt * 11, p - rt * 7 + f * 9 + rt * 0 + f * (-sway), 5)
    pg.draw.circle(surf, PLAYER, p + f * 2, 8)                              # bald head
    pg.draw.circle(surf, SKIN_LO, p + f * 2, 8, 1)
    for k in (-1, 0, 1): pg.draw.line(surf, ARMOR, p + f * 6 + rt * k * 2.6, p + f * 9.5 + rt * k * 2.6, 1)
    pg.draw.circle(surf, PORTAL, p - f * 1 - rt * 2, 2)
    if ghost: pg.draw.circle(surf, GLOW, p, 18, 1)


GH_D, GH_SKIN, GH_L, GH_XL, GH_EYE, GH_GUM = (24, 90, 60), (58, 170, 118), (110, 220, 160), (160, 245, 190), (215, 255, 225), (110, 190, 50)
GHOST_LO = (W // 3, H // 3)                       # the ghost is painted at 1/3 resolution, then scaled up with hard pixels


def draw_phantom_body(surf, p, face, t):
    """The phantom from above: a ragged, jagged shroud with the bald ghost's head and glowing eyes."""
    pts = []
    for i in range(22):
        a = math.tau * i / 22
        rr = 15 + (9 if i % 2 else 0) + 3 * math.sin(t * 7 + i * 1.7)
        pts.append(p + V(math.cos(a), math.sin(a)) * rr)
    back = -face; side = V(-back.y, back.x)
    for k in range(5):                                                   # trailing tatters
        sd = side * (k - 2) * 5
        pg.draw.lines(surf, PHANTOM, False, [p + sd, p + sd + back * 18 + side * math.sin(t * 9 + k) * 5, p + sd * 1.4 + back * 34], 3)
    pg.draw.polygon(surf, PHANTOM, pts)
    pg.draw.polygon(surf, DEEP, [p + (q - p) * 0.62 for q in pts])
    pg.draw.polygon(surf, (24, 96, 40), pts, 2)
    for sgn in (1, -1):                                                  # thin shoulders
        pg.draw.circle(surf, GH_D, p + side * sgn * 9 - face * 2, 5)
    hc = p + face * 3
    pg.draw.circle(surf, GH_SKIN, hc, 8); pg.draw.circle(surf, GH_L, hc - face * 2, 5); pg.draw.circle(surf, GH_D, hc, 8, 1)
    for sgn in (1, -1): pg.draw.line(surf, VOID, hc + face * 5 + side * sgn * 3, hc + face * 2 + side * sgn * 3, 2)   # tear streaks


def _shaded(surf, rect, dark, light, steps=7, lift=0.35):
    """Ellipse lit from the top-front: concentric ellipses shrinking upward and brightening."""
    r = pg.Rect(rect)
    for i in range(steps):
        k = i / (steps - 1)
        c = tuple(int(dark[j] + (light[j] - dark[j]) * k) for j in range(3))
        rr = r.inflate(-r.w * 0.55 * k, -r.h * 0.6 * k); rr.centery = r.centery - int(r.h * lift * k * 0.5)
        if rr.w > 0 and rr.h > 0: pg.draw.ellipse(surf, c, rr)


def draw_ghost(lo, k, t):
    """The jumpscare ghost (after the reference picture): a bald pale figure with glowing eyes, black tears and an
    impossibly wide grin. Animated over the 60 frames: it lunges, twitches, the grin splits wider, tears run, eyes dart."""
    lo.fill(VOID)
    rnd = random.Random(k * 7 + 1)
    lw, lh = lo.get_size()
    lunge = min(1.0, k / 5)                                              # snaps out of the dark in five frames
    u = (34 + 14 * lunge + 30 * (k / JUMPSCARE_FRAMES) ** 1.6) * (1 + (0.06 if k % 9 == 0 else 0))
    cx = lw / 2 + rnd.uniform(-1.5, 1.5) + (rnd.choice([-5, 5]) if k % 11 == 7 else 0)
    cy = lh * 0.46 + rnd.uniform(-1, 1)
    bright = min(1.0, 0.25 + k / 5)
    head = pg.Surface((lw, lh), pg.SRCALPHA)
    R = lambda x, y, w, h: pg.Rect(int(cx + x * u), int(cy + y * u), max(1, int(w * u)), max(1, int(h * u)))
    def lit(pts, focus, dark, light, steps=14, shrink=0.8):
        """Fill a silhouette, then shrink it toward the light focus in bright steps: one smooth, unified form."""
        for i in range(steps):
            k = i / (steps - 1)
            c = tuple(int(dark[j] + (light[j] - dark[j]) * k ** 0.8) for j in range(3))
            pg.draw.polygon(head, c, [focus + (V(q) - focus) * (1 - shrink * k) for q in pts])
    sh = [(cx + x * u, cy + (1.02 + 0.55 * (1 - (x / 1.75) ** 2) ** 0.5 * -1 + 0.62) * u) for x in [i / 12 * 3.5 - 1.75 for i in range(13)]]
    lit(sh + [(cx + 1.9 * u, lh + 5), (cx - 1.9 * u, lh + 5)], V(cx, cy + 1.25 * u), DEEP, GH_SKIN, 10, 0.75)      # shoulders
    neck = [(cx - 0.3 * u, cy + 0.45 * u), (cx + 0.3 * u, cy + 0.45 * u), (cx + 0.36 * u, cy + 1.05 * u), (cx + 0.5 * u, cy + 1.3 * u), (cx - 0.5 * u, cy + 1.3 * u), (cx - 0.36 * u, cy + 1.05 * u)]
    lit(neck, V(cx, cy + 0.9 * u), GH_D, GH_SKIN, 8, 0.7)
    for sgn in (-1, 1): pg.draw.line(head, GH_D, (cx + sgn * 0.12 * u, cy + 0.7 * u), (cx + sgn * 0.24 * u, cy + 1.25 * u), max(1, int(0.03 * u)))   # tendons
    for sgn in (-1, 1): pg.draw.ellipse(head, GH_D, R(sgn * 0.72 - 0.09, -0.42, 0.18, 0.36))          # ears
    egg = []
    for i in range(48):
        ang = math.tau * i / 48; sn = math.sin(ang)
        egg.append((cx + 0.74 * u * math.cos(ang) * (1 - 0.36 * max(0.0, sn) ** 2), cy - 0.27 * u + sn * (1.12 if sn < 0 else 1.1) * u))
    lit(egg, V(cx, cy - 0.85 * u), GH_D, GH_XL, 16, 0.85)                              # one bald head, lit from above
    shade = pg.Surface((lw, lh), pg.SRCALPHA)
    for sgn in (-1, 1):
        pg.draw.ellipse(shade, (*GH_D, 110), R(sgn * 0.42 - 0.17, 0.0, 0.34, 0.5))      # hollow cheeks
        pg.draw.ellipse(shade, (*GH_XL, 70), R(sgn * 0.42 - 0.13, -0.12, 0.26, 0.12))   # cheekbones
    pg.draw.ellipse(shade, (*GH_D, 90), R(-0.5, -0.5, 1.0, 0.16))                        # brow shadow
    head.blit(shade, (0, 0))
    srnd = random.Random(99)                                                           # mottled skin, fixed to the face
    for _ in range(140):
        x, y = srnd.uniform(-0.7, 0.7), srnd.uniform(-1.3, 0.8)
        if (x / 0.66) ** 2 + ((y + 0.27) / 1.05) ** 2 < 1: head.fill((*GH_D, 140), (int(cx + x * u), int(cy + y * u), 1, 1))
    for x0 in (-0.1, 0.04, 0.12):                                                      # forehead cracks
        pg.draw.line(head, GH_D, (cx + x0 * u, cy - 0.7 * u), (cx + (x0 + srnd.uniform(-0.05, 0.05)) * u, cy - 0.45 * u))
    # eyes: dark sockets, glowing whites, darting pinpricks
    flick = 0.55 if k % 7 in (3, 4) else 1.0
    dart = (rnd.uniform(-0.03, 0.03) * u, rnd.uniform(-0.02, 0.02) * u)
    for sgn in (-1, 1):
        ex, ey = cx + sgn * 0.29 * u, cy - 0.24 * u
        pg.draw.ellipse(head, (8, 34, 20), (ex - 0.22 * u, ey - 0.14 * u, 0.44 * u, 0.3 * u))
        pg.draw.ellipse(head, VOID, (ex - 0.15 * u, ey - 0.09 * u, 0.3 * u, 0.19 * u))
        e = (ex + dart[0], ey + dart[1])
        pg.draw.circle(head, tuple(int(c * flick * 0.6) for c in GH_L), e, max(1, 0.11 * u))
        pg.draw.circle(head, tuple(int(c * flick) for c in GH_XL), e, max(1, 0.08 * u))
        pg.draw.circle(head, GH_EYE, e, max(1, 0.045 * u))
        run = min(1.0, 0.25 + k / 40)                                                   # tears keep running
        for j, ox in enumerate((-0.11, -0.04, 0.04, 0.1)):
            L = (0.25 + 0.45 * ((j * 37 + (sgn > 0) * 13) % 10) / 10) * run * u
            x0 = ex + ox * u
            pg.draw.line(head, VOID, (x0, ey + 0.07 * u), (x0 + sgn * 0.02 * u, ey + 0.07 * u + L), max(1, int(0.03 * u)))
            pg.draw.circle(head, VOID, (x0 + sgn * 0.02 * u, ey + 0.07 * u + L), max(1, 0.025 * u))
    # nose
    pg.draw.polygon(head, GH_SKIN, [(cx - 0.04 * u, cy - 0.2 * u), (cx + 0.04 * u, cy - 0.2 * u), (cx + 0.13 * u, cy + 0.12 * u), (cx - 0.13 * u, cy + 0.12 * u)])
    pg.draw.line(head, GH_XL, (cx, cy - 0.18 * u), (cx, cy + 0.06 * u), max(1, int(0.04 * u)))                  # nose ridge highlight
    pg.draw.ellipse(head, GH_L, (cx - 0.07 * u, cy + 0.02 * u, 0.14 * u, 0.1 * u))
    for sgn in (-1, 1): pg.draw.ellipse(head, (8, 34, 20), (cx + sgn * 0.075 * u - 0.04 * u, cy + 0.1 * u, 0.08 * u, 0.05 * u))
    # the grin: splits wider and drops open as the scare runs
    grin = 0.55 + 0.4 * min(1.0, k / 30) + 0.03 * math.sin(t * 50)
    opn = 0.12 + 0.28 * min(1.0, max(0.0, (k - 20) / 25))
    hw, my = 0.5 * u * (0.85 + 0.25 * grin), cy + 0.4 * u
    top = [(cx + x * hw, my - 0.24 * u * x * x) for x in [i / 10 - 1 for i in range(21)]]
    bot = [(cx + x * hw, my - 0.24 * u * x * x + opn * u * (1 - x * x)) for x in [1 - i / 10 for i in range(21)]]
    for sgn in (-1, 1):                                                                  # cheek creases / stretch lines
        pg.draw.line(head, GH_D, (cx + sgn * hw, my - 0.24 * u), (cx + sgn * 0.62 * u, cy - 0.05 * u), max(1, int(0.03 * u)))
        pg.draw.line(head, GH_D, (cx + sgn * hw, my - 0.2 * u), (cx + sgn * 0.6 * u, cy + 0.55 * u), max(1, int(0.02 * u)))
    pg.draw.polygon(head, (6, 26, 12), top + bot)
    gum = [(x, y + 0.04 * u) for x, y in top[3:-3]] + [(x, y + 0.13 * u) for x, y in top[3:-3]][::-1]
    if len(gum) > 2: pg.draw.polygon(head, GH_GUM, gum)
    for x, y in top[4:-4:2]: pg.draw.line(head, (40, 100, 30), (x, y + 0.05 * u), (x, y + 0.12 * u))
    pg.draw.lines(head, GH_D, False, top, max(1, int(0.03 * u)))
    pg.draw.lines(head, GH_D, False, bot, max(1, int(0.04 * u)))
    for j in range(6):                                                                   # drips from the chin
        x0 = cx + (j - 2.5) * 0.12 * u
        pg.draw.line(head, VOID, (x0, my + (opn + 0.12) * u), (x0, my + (opn + 0.12 + 0.1 * ((j * 7) % 5)) * u * min(1.0, 0.3 + k / 30)), 1)
    if bright < 1: head.set_alpha(int(255 * bright))
    tilt = math.sin(k * 0.45) * 4 + (rnd.uniform(-9, 9) if k % 13 in (5, 6) else 0)       # creeping tilt + sudden twitches
    rot = pg.transform.rotate(head, tilt)
    lo.blit(rot, rot.get_rect(center=(lw / 2, lh / 2)))


# =============================================================== HUD
class HUD:
    def __init__(s, fonts):
        s.f_title, s.f_big, s.f_mid, s.f_sm, s.f_xs = fonts
        s.cache = {}

    def text(s, surf, txt, font, col, pos, anchor="center", distress=False):
        key = (txt, id(font), col, distress)
        img = s.cache.get(key)
        if img is None:
            img = font.render(txt, True, col).convert_alpha()
            if distress:                                                   # worn, typewritten erosion
                rnd = random.Random(hash(txt) & 0xFFFF)
                w, h = img.get_size()
                for _ in range(w * h // 45): img.fill((0, 0, 0, 0), (rnd.randrange(w), rnd.randrange(h), rnd.choice((1, 2, 2, 3)), 1))
            if len(s.cache) > 400: s.cache.clear()
            s.cache[key] = img
        r = img.get_rect(**{anchor: pos}); surf.blit(img, r); return r

    def frame(s, surf, rect):
        pg.draw.rect(surf, VOID, rect); pg.draw.rect(surf, MOSS, rect, 2)
        pg.draw.line(surf, TEXT_DIM, rect.topleft, (rect.x + 10, rect.y), 2); pg.draw.line(surf, TEXT_DIM, rect.bottomright, (rect.right - 10, rect.bottom - 1), 2)

    def draw(s, surf, g):
        port = pg.Rect(12, 12, 66, 66); s.frame(surf, port)
        draw_thanos_face(surf, port.center, 28, g.mood(), g.t)
        s.text(surf, "THANOS", s.f_xs, TEXT_DIM, (port.centerx, port.bottom + 9))
        x0 = port.right + 12
        s.text(surf, "LIVES", s.f_xs, TEXT_DIM, (x0, 20), "midleft")
        for i in range(LIVES):                                             # three segments, like the reference's health bar
            r = pg.Rect(x0 + i * 46, 30, 42, 8)
            pg.draw.rect(surf, GLOW if i < g.lives else DEEP, r); pg.draw.rect(surf, MOSS, r, 1)
        s.text(surf, f"RUNES: {len(g.collected)}/3", s.f_sm, TEXT, (x0, 55), "midleft")
        for i in range(3):
            c = (x0 + 122 + i * 26, 55)
            pg.draw.rect(surf, VOID, (c[0] - 11, c[1] - 11, 22, 22)); pg.draw.rect(surf, MOSS, (c[0] - 11, c[1] - 11, 22, 22), 1)
            draw_glyph(surf, i, c, 7, GLOW if i in g.collected else MOSS, 2 if i in g.collected else 1)
        s.text(surf, "GREEN", s.f_sm, TEXT, (W - 14, 28), "midright")
        tl = max(0, g.time_left); low = tl < 60
        s.text(surf, f"{int(tl // 60)}:{int(tl % 60):02d}", s.f_mid, PORTAL if low and int(g.t * 4) % 2 else TEXT, (W - 14, 62), "midright")
        # bottom: noise meter (the reference's bottom bar) + objective
        bar = pg.Rect(W // 2 - 130, H - 44, 260, 6)
        pg.draw.rect(surf, VOID, bar.inflate(4, 4)); pg.draw.rect(surf, MOSS, bar.inflate(4, 4), 1)
        for i in range(13):
            on = g.noise * 13 > i
            pg.draw.rect(surf, (LIGHT if on else DEEP), (bar.x + i * 20 + 1, bar.y, 18, bar.h))
        if g.noise > 0.05: s.text(surf, "NOISE", s.f_xs, LIGHT, (bar.x - 8, bar.centery), "midright")
        s.text(surf, g.objective(), s.f_sm, TEXT, (W // 2, H - 22), distress=True)
        if g.msg_t > 0 and g.msg:
            s.text(surf, g.msg, s.f_mid, PALE, (W // 2, H - 78), distress=True)


# =============================================================== game
class Game:
    STATES = ("TITLE", "RULES", "PLAYING", "PAUSED", "JUMPSCARE", "GAME_OVER", "VICTORY")

    def __init__(s, headless=False):
        pg.init()
        s.display = pg.display.set_mode((W, H)); pg.display.set_caption("GREEN")
        s.clock = pg.time.Clock()
        mono = next((n for n in ("specialelite", "couriernew", "lucidaconsole", "consolas") if pg.font.match_font(n)), None)
        serif = next((n for n in ("palatinolinotype", "bookantiqua", "georgia", "timesnewroman") if pg.font.match_font(n)), None)
        s.fonts = (pg.font.SysFont(serif, 66, bold=True), pg.font.SysFont(serif, 42, bold=True), pg.font.SysFont(mono, 22, bold=True),
                   pg.font.SysFont(mono, 16, bold=True), pg.font.SysFont(mono, 13, bold=True))
        s.hud = HUD(s.fonts)
        s.audio = Mute() if headless else Synth()
        s.frame = pg.Surface((W, H))
        s.ghost_lo = pg.Surface(GHOST_LO)
        s.mask, s.add = pg.Surface((W, H)), pg.Surface((W, H))
        s.half, s.half2 = pg.Surface((LIGHT_RANGE, LIGHT_RANGE)), pg.Surface((LIGHT_RANGE, LIGHT_RANGE))
        s.cone_fall = radial(LIGHT_RANGE, (225, 255, 205), 0.85)
        s.amb_fall = pg.Surface((LIGHT_RANGE, LIGHT_RANGE)); s.amb_fall.fill((0, 0, 0))
        a = radial(AMBIENT_R, (96, 150, 88), 0.9); s.amb_fall.blit(a, a.get_rect(center=(LIGHT_RANGE // 2, LIGHT_RANGE // 2)))
        s.tree_lights = [radial(420, (60, 110, 54), 1.6), radial(440, (96, 170, 86), 1.4), radial(480, (150, 240, 140), 1.2)]
        s.blob = radial(CELL * 2 + 8, (40, 62, 36), 0.7)
        s.glow_sprite = radial(60, (60, 200, 50), 1.5)
        rnd = random.Random(3)
        s.grain = []
        for _ in range(3):
            gs = pg.Surface((W, H), pg.SRCALPHA)
            for _ in range(5200): gs.fill(rnd.choice(((*DEEP, 90), (*GRASS_LO, 50), (*VOID, 120))), (rnd.randrange(W), rnd.randrange(H), 2, 2))
            s.grain.append(gs)
        s.vignette = pg.Surface((W, H), pg.SRCALPHA)
        for i in range(60):
            k = i / 60; pg.draw.rect(s.vignette, (*VOID, int(200 * (1 - k) ** 2.2)), (i * 4, i * 3, W - i * 8, H - i * 6), 4 if i < 59 else 0, border_radius=40)
        s.vignette.fill((0, 0, 0, 0), (60 * 4, 60 * 3, W - 480, H - 360))
        s.spores = [[rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(0.6, 1.6), rnd.uniform(0, 6)] for _ in range(70)]
        s.world = None
        s.state, s.t, s.buttons = "TITLE", 0.0, {}
        s.ctrl = {"up": False, "down": False, "left": False, "right": False, "sprint": False}
        s.reset()

    # ------------------------------------------------------------ run state
    def reset(s):
        """Full restart: every per-run object is recreated, nothing survives from the previous attempt."""
        s.maze = ForestMaze()
        if s.world is None: s.world = bake_world(s.maze)              # static art never changes, so it is baked once
        s.player = Player(s.maze.center(s.maze.spawn))
        s.phantom = Phantom(s.maze, random.Random(2024))
        s.runes = [Rune(i, c) for i, c in sorted(s.maze.runes.items())]
        s.collected = set()                                           # the single authoritative rune record
        s.light = Flashlight()
        s.lives, s.time_left = LIVES, TIME_LIMIT
        s.rings, s.ring_cd, s.noise, s.sense_cd = [], 0.0, 0.0, 0.0
        s.particles = []
        s.door_unlocked, s.ritual_t, s.through_door = False, None, False
        s.js_frames, s.shake, s.protect = 0, 0.0, 0.0
        s.victory_t, s.cause = 0.0, ""
        s.msg, s.msg_t, s.mood_hold, s.mood_t = "", 0.0, "calm", 0.0
        s.heart_cd, s.step_cd, s.seal_shown, s.danger = 0.0, 0.0, False, 0.0
        s.explored = set()
        s.memory = pg.Surface((s.maze.world_w, s.maze.world_h)); s.memory.fill((0, 0, 0))
        s.cam = s.cam_target()
        s.phantom_visible = False

    def say(s, m, secs=2.6): s.msg, s.msg_t = m, secs
    def hold(s, m, secs=1.5): s.mood_hold, s.mood_t = m, secs
    def mood(s):
        if s.state == "VICTORY": return "triumph"
        if s.state in ("JUMPSCARE", "GAME_OVER"): return "fear"
        if s.mood_t > 0: return s.mood_hold
        if s.danger > 0.25: return "wary"
        if s.player.sprinting: return "strain"
        return "resolve" if s.door_unlocked else "calm"
    def objective(s):
        if s.maze.door_open: return "ENTER THE TREE PORTAL"
        if s.ritual_t is not None: return "THE TREE AWAKENS..."
        if s.door_unlocked: return "RETURN TO THE ANCIENT TREE"
        return "FIND 3 RUNES TO AWAKEN THE TREE"
    def burst(s, pos, n, speed, cols, life=(0.4, 1.0)):
        for _ in range(n):
            a, v = random.uniform(0, math.tau), random.uniform(0.2, 1) * speed
            s.particles.append([V(pos), V(math.cos(a), math.sin(a)) * v, 0.0, random.uniform(*life), random.choice(cols)])

    def begin(s):
        s.reset(); s.state = "PLAYING"; s.audio.music_on(); s.say("FIND THE THREE RUNES · STAY QUIET")
    def restart(s):
        s.reset(); s.state = "TITLE"

    # ------------------------------------------------------------ simulation
    def step(s, dt):
        s.t += dt
        for p in s.particles: p[0] += p[1] * dt; p[1] *= 0.95; p[2] += dt
        s.particles = [p for p in s.particles if p[2] < p[3]]
        for r in s.rings: r[1] += dt
        s.rings = [r for r in s.rings if r[1] < RING_LIFE]
        s.shake *= 0.86
        if s.state == "VICTORY": s.victory_t += dt; return
        if s.state != "PLAYING": return                                 # only PLAYING simulates the world
        s.msg_t -= dt; s.mood_t -= dt; s.protect = max(0.0, s.protect - dt)
        s.time_left -= dt
        if s.time_left <= 0:
            s.time_left, s.cause, s.state = 0.0, "TIME RAN OUT — THE FOREST CLOSED IN", "GAME_OVER"; s.audio.play("over"); return
        pl, ph, mz = s.player, s.phantom, s.maze
        pl.update(dt, mz, s.ctrl)
        # footsteps + sprint noise
        s.step_cd -= dt
        if pl.moving and s.step_cd <= 0:
            s.step_cd = 0.26 if pl.sprinting else 0.42; s.audio.play("step", 0.55 if pl.sprinting else 0.16)
        s.ring_cd = max(0.0, s.ring_cd - dt); s.noise = max(0.0, s.noise - dt * 0.9)
        if pl.sprinting and s.ring_cd <= 0:
            s.rings.append([V(pl.pos), 0.0]); s.ring_cd = RING_COOLDOWN; s.noise = 1.0
            s.audio.play("ring", 0.35)
            if (ph.pos - pl.pos).length() <= HEAR_RANGE and ph.enabled:
                was = ph.state; ph.hear(pl.pos)
                if was != "INVESTIGATE" and ph.state == "INVESTIGATE": s.audio.play("whisper", 0.5)
        # close-range sense (breath / heartbeat within a couple of paces, line of sight only)
        s.sense_cd -= dt
        d_ph = (ph.pos - pl.pos).length()
        if ph.enabled and s.protect <= 0 and d_ph < SENSE_RANGE and s.sense_cd <= 0 and mz.los(ph.pos, pl.pos):
            ph.hear(pl.pos); s.sense_cd = 0.8
        ph.update(dt)
        d_ph = (ph.pos - pl.pos).length()
        s.danger = max(0.0, 1 - d_ph / 260) if ph.enabled else 0.0
        s.heart_cd -= dt
        if s.danger > 0 and s.heart_cd <= 0: s.audio.play("heart", 0.3 + 0.6 * s.danger); s.heart_cd = 1.25 - 0.8 * s.danger
        f = 1.0
        if s.danger > 0.2 and random.random() < 0.18 * s.danger: f = random.uniform(0.35, 0.8)
        elif random.random() < 0.004: f = random.uniform(0.6, 0.9)
        s.light.flicker = f
        # runes
        for r in s.runes:
            if r.idx not in s.collected and (r.pos - pl.pos).length() < PLAYER_R + RUNE_R:
                s.collected.add(r.idx)
                s.burst(r.pos, 46, 160, (GLOW, PALE, LIGHT)); s.audio.play("rune"); s.hold("smug")
                s.say(f"{RUNE_NAMES[r.idx]} TAKEN · RUNES {len(s.collected)}/3")
                if len(s.collected) == 3:
                    s.door_unlocked = True; s.say("ALL RUNES FOUND · RETURN TO THE ANCIENT TREE", 3.5); s.hold("resolve", 2.5)
        # the tree door
        front = mz.center(mz.door_front); near = (pl.pos - front).length()
        if not s.door_unlocked:
            if near < 70:
                if not s.seal_shown: s.audio.play("seal"); s.seal_shown = True
                s.say("THE SEAL REMAINS CLOSED", 0.3)
            elif near > 110: s.seal_shown = False
        elif s.ritual_t is None and near < 150:
            s.ritual_t = 0.0; s.audio.play("energy"); s.say("THE TREE AWAKENS", 2.0)
        if s.ritual_t is not None and not mz.door_open:
            prev = s.ritual_t; s.ritual_t += dt
            if prev < DOOR_PHASE <= s.ritual_t: s.audio.play("door"); s.shake = max(s.shake, 6)
            if s.ritual_t >= RITUAL_TIME:
                mz.door_open = True                                       # collision geometry changes only here
                s.burst(mz.center(mz.portal), 60, 120, (PORTAL, GLOW, PALE)); s.say("THE DOOR STANDS OPEN", 3.0)
        if s.ritual_t is not None and random.random() < 0.5:
            for i in range(3):                                            # energy streaming from the runes into the trunk
                src = s.rune_orbit(i)
                s.particles.append([V(src), (mz.tree_center - src) * 1.4, 0.0, 0.7, random.choice((GLOW, LIGHT, PALE))])
        # victory: only by walking through the open door into the portal hollow
        if mz.door_open:
            if mz.cell_of(pl.pos) == mz.door: s.through_door = True
            if s.through_door and len(s.collected) == 3 and (pl.pos - mz.center(mz.portal)).length() < 20:
                s.state, s.victory_t = "VICTORY", 0.0; s.audio.play("warp"); s.burst(pl.pos, 90, 200, (PORTAL, GLOW, PALE, LIGHT))
                return
        # one centralised catch handler
        if ph.enabled and s.protect <= 0 and d_ph < PLAYER_R + PHANTOM_R: s.caught()

    def rune_orbit(s, i):
        a = s.t * 0.8 + math.tau * i / 3
        return s.maze.tree_center + V(math.cos(a) * 128, math.sin(a) * 118)

    def caught(s):
        if s.state != "PLAYING": return
        s.lives -= 1; s.cause = "THE PHANTOM CAUGHT YOU"
        s.state, s.js_frames, s.shake = "JUMPSCARE", JUMPSCARE_FRAMES, 30.0
        s.audio.play("scare")

    def end_jumpscare(s):
        if s.lives <= 0:
            s.state = "GAME_OVER"; s.audio.play("over"); return
        s.player = Player(s.maze.center(s.maze.spawn), s.player.aim)      # runes stay collected
        s.phantom.reset()
        s.rings.clear(); s.ring_cd, s.noise, s.sense_cd, s.through_door = 0.0, 0.0, 0.0, False
        s.protect, s.shake = SPAWN_PROTECT, 0.0
        s.state = "PLAYING"; s.hold("fear", 1.6)
        s.say(f"THANOS WAKES AT THE FOREST EDGE · {s.lives} {'LIFE' if s.lives == 1 else 'LIVES'} LEFT", 3.0)

    # ------------------------------------------------------------ drawing
    def cam_target(s, origin=None, aim=None):
        o = origin if origin is not None else s.player.pos
        a = s.player.aim if aim is None else aim
        c = o + V(math.cos(a), math.sin(a)) * 55 - V(W / 2, H / 2)
        return V(min(max(c.x, 0), s.maze.world_w - W), min(max(c.y, 0), s.maze.world_h - H))

    def light_pass(s, f, cam, origin, aim):
        lt, mz = s.light, s.maze
        seen = set()
        lt.compute(mz, origin, aim, seen)
        for c in seen - s.explored:                                       # fog of war remembers what Thanos has seen
            s.explored.add(c)
            s.memory.blit(s.blob, s.blob.get_rect(center=mz.center(c)), special_flags=pg.BLEND_RGB_MAX)
        m = s.mask; m.fill((0, 0, 0))
        m.blit(s.memory, (0, 0), area=pg.Rect(int(cam.x), int(cam.y), W, H))
        tl = s.tree_lights[2 if mz.door_open else 1 if s.door_unlocked else 0]
        m.blit(tl, tl.get_rect(center=mz.tree_center - cam), special_flags=pg.BLEND_RGB_MAX)
        half, half2, R2 = s.half, s.half2, LIGHT_RANGE / 2
        loc = lambda p: (p - origin) / 2 + V(R2, R2)
        half.fill((0, 0, 0)); v = int(255 * lt.flicker)
        pg.draw.polygon(half, (v, v, v), [loc(p) for p in lt.cone])
        half.blit(s.cone_fall, (0, 0), special_flags=pg.BLEND_RGB_MULT)
        half2.fill((0, 0, 0)); pg.draw.polygon(half2, PORTAL, [loc(p) for p in lt.amb])
        half2.blit(s.amb_fall, (0, 0), special_flags=pg.BLEND_RGB_MULT)
        half.blit(half2, (0, 0), special_flags=pg.BLEND_RGB_MAX)
        big = pg.transform.smoothscale(half, (LIGHT_RANGE * 2, LIGHT_RANGE * 2))     # half-res + upscale = soft shadow edges
        at = origin - cam - V(LIGHT_RANGE, LIGHT_RANGE)
        m.blit(big, at, special_flags=pg.BLEND_RGB_MAX)
        f.blit(m, (0, 0), special_flags=pg.BLEND_RGB_MULT)
        f.fill(VOID, special_flags=pg.BLEND_RGB_MAX)
        big.fill((7, 26, 3), special_flags=pg.BLEND_RGB_MULT)          # faint neon haze of the beam itself
        f.blit(big, at, special_flags=pg.BLEND_RGB_ADD)

    def draw_tree_dynamic(s, f, cam, add):
        """Door slabs / hollow under the light; portal and glow on the additive layer."""
        mz = s.maze
        dr = pg.Rect(0, 0, 44, 0); dr.centerx = int(mz.center(mz.door).x - cam.x)
        top_portal, bottom = int(mz.portal[1] * CELL + 4 - cam.y), int((mz.door[1] + 1) * CELL + 6 - cam.y)
        door_top = int(mz.door[1] * CELL + 4 - cam.y)
        p = 0.0 if s.ritual_t is None else min(1.0, max(0.0, (s.ritual_t - DOOR_PHASE) / (RITUAL_TIME - DOOR_PHASE)))
        if mz.door_open: p = 1.0
        if p > 0:                                                          # hollow channel through the trunk
            pg.draw.rect(f, VOID, (dr.x, top_portal, 44, bottom - top_portal), border_top_left_radius=20, border_top_right_radius=20)
        sw = int(22 * (1 - p))
        for x0 in (dr.x, dr.x + 44 - sw):
            if sw > 0:
                pg.draw.rect(f, BARK_HI, (x0, door_top, sw, bottom - door_top))
                for yy in range(door_top + 6, bottom, 9): pg.draw.line(f, BARK, (x0, yy), (x0 + sw - 1, yy), 2)
                pg.draw.rect(f, DEEP, (x0, door_top, sw, bottom - door_top), 2)
        if p == 0:                                                          # the seal: one notch per rune
            sc = (dr.centerx, (door_top + bottom) // 2)
            pg.draw.circle(f, DEEP, sc, 13); pg.draw.circle(f, MOSS, sc, 13, 2)
            for i in range(3):
                a = -math.pi / 2 + math.tau * i / 3; q = (sc[0] + math.cos(a) * 9, sc[1] + math.sin(a) * 9)
                pg.draw.circle(f, GLOW if i in s.collected else MOSS, q, 3)
                if i in s.collected: pg.draw.circle(add, (20, 90, 16), q, 7)
        # additive glow
        tc = mz.tree_center - cam
        if s.door_unlocked:
            g = 0.5 + 0.5 * math.sin(s.t * 2.4)
            rnd = random.Random(7)                                         # pulsing veins of light in the bark
            for i in range(14):
                ang = math.tau * i / 14 + rnd.uniform(-0.1, 0.1)
                if abs((ang - math.pi / 2 + math.pi) % math.tau - math.pi) < 0.3: continue
                pts = [tc + V(math.cos(ang), math.sin(ang)) * 26]
                for _ in range(4):
                    ang += rnd.uniform(-0.3, 0.3); pts.append(pts[-1] + V(math.cos(ang), math.sin(ang)) * rnd.uniform(16, 22))
                ph = 0.5 + 0.5 * math.sin(s.t * 3 - i * 0.7)
                pg.draw.lines(add, (int(14 * g * ph + 6), int(110 * g * ph + 30), int(10 * g * ph + 4)), False, pts, 2)
        if p > 0:
            pc = V(dr.centerx, (top_portal + door_top) / 2 + 6)
            for k in range(6, 0, -1):
                rr = 4 + k * 4 * p + 2 * math.sin(s.t * 5 + k)
                pg.draw.circle(add, (int(PORTAL[0] * 0.16 * k / 6 * p), int(PORTAL[1] * 0.22 * p), int(PORTAL[2] * 0.16 * k / 6 * p)), pc, rr)
            for k in range(3):
                a = s.t * 3 + k * 2.1
                pg.draw.arc(add, (60, 200, 60), (pc.x - 14, pc.y - 14, 28, 28), a, a + 1.6, 2)

    def draw_scene(s, attract=False):
        f, add, mz = s.frame, s.add, s.maze
        if attract:
            origin = mz.center(mz.door_front) + V(0, 70)
            aim = -math.pi / 2 + math.sin(s.t * 0.45) * 0.9
        else:
            origin, aim = s.player.pos, s.player.aim
        tgt = s.cam_target(origin, aim); s.cam += (tgt - s.cam) * 0.12; cam = V(round(s.cam.x), round(s.cam.y))
        f.blit(s.world, (0, 0), area=pg.Rect(cam.x, cam.y, W, H))
        add.fill((0, 0, 0))
        for sp in s.spores:                                                 # drifting motes, visible only where lit
            sp[0] = (sp[0] + math.sin(s.t * 0.7 + sp[3]) * 0.3) % W; sp[1] = (sp[1] - sp[2] * 0.25) % H
            pg.draw.circle(f, (120, 220, 110), (sp[0], sp[1]), 1)
        s.draw_tree_dynamic(f, cam, add)
        lt = s.light
        for r in s.runes:
            if r.idx in s.collected: continue
            seen_now = lt.illuminates(mz, origin, aim, r.pos) or lt.near(mz, origin, r.pos)
            r.vis = min(1.0, r.vis + 0.08) if seen_now and not attract else max(0.0, r.vis - 0.05)
            p = r.pos - cam + V(0, math.sin(s.t * 2 + r.idx) * 2)
            pg.draw.circle(f, STONE, p, 13); pg.draw.circle(f, DEEP, p, 13, 2)
            draw_glyph(f, r.idx, p, 8, GLOW if r.vis > 0 else MOSS)
            if r.vis > 0:
                k = r.vis * (0.7 + 0.3 * math.sin(s.t * 4))
                spr = s.glow_sprite.copy(); spr.fill((int(255 * k),) * 3, special_flags=pg.BLEND_RGB_MULT)
                add.blit(spr, spr.get_rect(center=p), special_flags=pg.BLEND_RGB_ADD)
                draw_glyph(add, r.idx, p, 8, (int(60 * k), int(255 * k), int(40 * k)))
        ph = s.phantom
        s.phantom_visible = False
        if not attract and ph.enabled:
            samples = [ph.pos] + [ph.pos + V(math.cos(a), math.sin(a)) * 11 for a in (0, math.pi / 2, math.pi, 3 * math.pi / 2)]
            s.phantom_visible = any(lt.illuminates(mz, origin, aim, q) for q in samples)
            if s.phantom_visible:
                draw_phantom_body(f, ph.pos - cam, ph.face, ph.anim)
        s.light_pass(f, cam, origin, aim)
        if s.phantom_visible:
            pp = ph.pos - cam
            for sgn in (-1, 1):
                e = pp + ph.face * 6 + V(-ph.face.y, ph.face.x) * 5 * sgn
                pg.draw.circle(add, (30, 120, 30), e, 6); pg.draw.circle(add, PORTAL, e, 2)
        for pos, age in s.rings:                                            # sprint sound rings
            k = 1 - age / RING_LIFE
            pg.draw.circle(add, (int(LIGHT[0] * k * 0.8), int(LIGHT[1] * k * 0.8), int(LIGHT[2] * k * 0.8)), pos - cam, 10 + RING_MAX * age / RING_LIFE, 2)
        for p in s.particles:
            k = 1 - p[2] / p[3]; c = p[4]
            pg.draw.circle(add, (int(c[0] * k), int(c[1] * k), int(c[2] * k)), p[0] - cam, 1 + 2 * k)
        if s.ritual_t is not None and not attract:
            for i in range(3):
                q = s.rune_orbit(i) - cam
                add.blit(s.glow_sprite, s.glow_sprite.get_rect(center=q), special_flags=pg.BLEND_RGB_ADD)
                pg.draw.circle(f, STONE, q, 12); draw_glyph(f, i, q, 8, GLOW)
                draw_glyph(add, i, q, 8, LIGHT)
        small = pg.transform.smoothscale(add, (W // 6, H // 6))
        f.blit(pg.transform.smoothscale(small, (W, H)), (0, 0), special_flags=pg.BLEND_RGB_ADD)
        f.blit(add, (0, 0), special_flags=pg.BLEND_RGB_ADD)
        if not attract and s.state != "VICTORY":
            pl = s.player
            draw_thanos_topdown(f, pl.pos - cam, pl.aim, s.t, pl.moving, pl.sprinting, s.protect > 0 and int(s.t * 10) % 2 == 0)
        elif s.state == "VICTORY":
            k = max(0.0, 1 - s.victory_t / 1.2)
            if k > 0:
                pc = mz.center(mz.portal) - cam
                spr = pg.Surface((60, 60), pg.SRCALPHA); draw_thanos_topdown(spr, V(30, 30), -math.pi / 2, s.t, False, False)
                spr = pg.transform.rotozoom(spr, s.victory_t * 400, k); f.blit(spr, spr.get_rect(center=pc))
        if s.danger > 0.15 and s.state == "PLAYING":                      # pulse at the edges; never says where
            v = int(90 * s.danger * (0.5 + 0.5 * math.sin(s.t * 7)))
            edge = s.vignette.copy(); edge.set_alpha(v)
            f.blit(edge, (0, 0))
        f.blit(s.grain[int(s.t * 24) % 3], (0, 0))
        f.blit(s.vignette, (0, 0))

    def overlay(s, alpha):
        o = pg.Surface((W, H), pg.SRCALPHA); o.fill((*VOID, alpha)); s.frame.blit(o, (0, 0))

    def button(s, key, label, y):
        f = s.frame; font = s.fonts[2]
        r = pg.Rect(0, 0, 260, 40); r.center = (W // 2, y)
        hover = r.collidepoint(pg.mouse.get_pos()) if pg.mouse.get_focused() else False
        pg.draw.rect(f, MOSS if hover else VOID, r); pg.draw.rect(f, GLOW if hover else TEXT_DIM, r, 2)
        s.hud.text(f, label, font, PORTAL if hover else TEXT, r.center); s.buttons[key] = r

    def draw(s):
        """One rendered frame. The jumpscare counter is decremented exactly once here per frame."""
        f, hud, (ft, fb, fm, fs, fx) = s.frame, s.hud, s.fonts
        s.buttons = {}
        if s.state in ("TITLE", "RULES"):
            s.draw_scene(attract=True); s.overlay(150 if s.state == "TITLE" else 215)
            if s.state == "TITLE":
                hud.text(f, "GREEN", ft, TEXT, (W // 2, 110), distress=True)
                hud.text(f, "THREE RUNES. ONE HAUNTED FOREST.", fm, PALE, (W // 2, 196), distress=True)
                hud.text(f, "FIND THE RUNES. RETURN TO THE TREE. ENTER THE DOOR.", fs, TEXT, (W // 2, 226))
                port = pg.Rect(0, 0, 92, 92); port.center = (W // 2 - 250, 300); hud.frame(f, port)
                draw_thanos_face(f, port.center, 40, "wary", s.t); hud.text(f, "YOU ARE THANOS", fx, TEXT_DIM, (port.centerx, port.bottom + 12))
                for i, line in enumerate(("WASD / ARROWS — MOVE", "SHIFT — SPRINT AND MAKE NOISE", "MOUSE — AIM FLASHLIGHT")):
                    hud.text(f, line, fs, TEXT, (W // 2 + 30, 272 + i * 26))
                hud.text(f, "PRESS ENTER TO BEGIN", fm, PORTAL if int(s.t * 2) % 2 else GLOW, (W // 2, 378), distress=True)
                s.button("start", "BEGIN", 438); s.button("rules", "RULES", 486); s.button("exit", "EXIT", 534)
                hud.text(f, "R RESTART · P PAUSE · M MUTE · ESC QUIT", fx, TEXT_DIM, (W // 2, H - 22))
            else:
                hud.text(f, "RULES", fb, TEXT, (W // 2, 90), distress=True)
                hud.text(f, "PLACEHOLDER — FINAL RULES TO BE ATTACHED", fx, LIGHT, (W // 2, 124))
                lines = ("Thanos is lost in a haunted forest. Find the three green runes.",
                         "A phantom wanders the maze. It cannot see you — it hunts by sound.",
                         "Sprinting (SHIFT) makes noise rings; it hears them from about nine paces.",
                         "Walking is silent, but it will sense you if you brush right past it.",
                         "Your flashlight reveals the phantom; it never reveals you.",
                         "Three lives. Runes you carry stay with you when you fall.",
                         "With all three runes, return to the giant tree. Its door will open.",
                         "Walk through the door into the portal before the 10:00 timer ends.")
                for i, l in enumerate(lines): hud.text(f, "~ " + l, fs, PALE, (W // 2, 170 + i * 30))
                s.button("back", "BACK", 450)
                hud.text(f, "ENTER OR H — BACK", fx, TEXT_DIM, (W // 2, 500))
        else:
            s.draw_scene()
            if s.state != "JUMPSCARE": hud.draw(f, s)
            if s.state == "PAUSED":
                s.overlay(170); hud.text(f, "PAUSED", fb, TEXT, (W // 2, 230), distress=True)
                s.button("resume", "RESUME (P)", 320); s.button("restart", "RESTART (R)", 370); s.button("exit", "EXIT", 420)
            elif s.state == "GAME_OVER":
                s.overlay(205)
                hud.text(f, "THE FOREST HAS CLAIMED YOU", fb, TEXT, (W // 2, 230), distress=True)
                hud.text(f, s.cause, fs, TEXT_DIM, (W // 2, 285))
                hud.text(f, "PRESS R TO TRY AGAIN", fm, PALE, (W // 2, 340), distress=True)
                s.button("restart", "TRY AGAIN (R)", 410)
            elif s.state == "VICTORY":
                k = min(1.0, s.victory_t / 1.0)
                o = pg.Surface((W, H), pg.SRCALPHA); o.fill((*PORTAL, int(150 * max(0.0, 1 - abs(s.victory_t - 0.6) * 2)))); f.blit(o, (0, 0))
                if s.victory_t > 1.2:
                    s.overlay(int(170 * k))
                    hud.text(f, "PHASE DOOR UNLOCKED.", fb, PORTAL, (W // 2, 220), distress=True)
                    hud.text(f, "TRANSITIONING TO LEVEL: YELLOW", fm, GLOW, (W // 2, 278))
                    tl = s.time_left
                    hud.text(f, f"LIVES {s.lives} · RUNES 3/3 · TIME LEFT {int(tl // 60)}:{int(tl % 60):02d}", fs, TEXT_DIM, (W // 2, 318))
                    hud.text(f, "PRESS R TO REPLAY GREEN", fm, PALE, (W // 2, 362), distress=True)
                    s.button("restart", "REPLAY (R)", 430)
            elif s.state == "JUMPSCARE":
                k = JUMPSCARE_FRAMES - s.js_frames                           # 0 … 59
                draw_ghost(s.ghost_lo, k, s.t)
                pg.transform.scale(s.ghost_lo, (W, H), f)                     # hard pixels, like the reference
                rnd = random.Random(k)
                if k % 6 in (2, 3):                                             # glitch: torn horizontal bands
                    for _ in range(4):
                        y0, hh = rnd.randrange(0, H - 40), rnd.randrange(8, 40)
                        band = f.subsurface((0, y0, W, hh)).copy(); f.blit(band, (rnd.randint(-40, 40), y0))
                if k % 10 == 0: o = pg.Surface((W, H), pg.SRCALPHA); o.fill((*LIGHT, 55)); f.blit(o, (0, 0))
                for y in range(0, H, 3): pg.draw.line(f, VOID, (0, y), (W, y))
                f.blit(s.vignette, (0, 0))
                s.shake = 34 * (1 - k / JUMPSCARE_FRAMES) + 8
                s.js_frames -= 1
                if s.js_frames <= 0: s.end_jumpscare()
        # screen shake moves the whole image
        s.display.fill(VOID)
        off = (random.uniform(-1, 1) * s.shake, random.uniform(-1, 1) * s.shake) if s.shake > 0.5 else (0, 0)
        s.display.blit(f, off)
        pg.display.flip()

    # ------------------------------------------------------------ input + loop
    def action(s, k):
        s.audio.play("click")
        if k == "start": s.begin()
        elif k == "rules": s.state = "RULES"
        elif k == "back": s.state = "TITLE"
        elif k == "resume": s.state = "PLAYING"
        elif k == "restart": s.restart()
        elif k == "exit": s.running = False

    def run(s):
        s.running, acc = True, 0.0
        while s.running:
            acc += min(0.25, s.clock.tick(FPS) / 1000)
            for e in pg.event.get():
                if e.type == pg.QUIT: s.running = False
                elif e.type == pg.KEYDOWN:
                    if e.key == pg.K_ESCAPE: s.running = False
                    elif e.key == pg.K_m: s.audio.toggle()
                    elif e.key == pg.K_r: s.restart()
                    elif e.key == pg.K_p and s.state in ("PLAYING", "PAUSED"): s.state = "PAUSED" if s.state == "PLAYING" else "PLAYING"
                    elif e.key in (pg.K_RETURN, pg.K_KP_ENTER) and s.state == "TITLE": s.action("start")
                    elif e.key in (pg.K_RETURN, pg.K_KP_ENTER, pg.K_h, pg.K_BACKSPACE) and s.state == "RULES": s.state = "TITLE"
                    elif e.key == pg.K_h and s.state == "TITLE": s.state = "RULES"
                elif e.type == pg.MOUSEBUTTONDOWN and e.button == 1:
                    for k, r in list(s.buttons.items()):
                        if r.collidepoint(e.pos): s.action(k); break
            keys = pg.key.get_pressed()
            s.ctrl.update(up=keys[pg.K_w] or keys[pg.K_UP], down=keys[pg.K_s] or keys[pg.K_DOWN],
                          left=keys[pg.K_a] or keys[pg.K_LEFT], right=keys[pg.K_d] or keys[pg.K_RIGHT],
                          sprint=keys[pg.K_LSHIFT] or keys[pg.K_RSHIFT])
            if s.state == "PLAYING":
                m = V(pg.mouse.get_pos()) + s.cam - s.player.pos
                if m.length_squared() > 4: s.player.aim = math.atan2(m.y, m.x)
            while acc >= 1 / FPS:
                s.step(1 / FPS); acc -= 1 / FPS
            s.draw()
        pg.quit()


if __name__ == "__main__":
    Game().run()
    sys.exit()
