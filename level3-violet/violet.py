"""
VIOLET  (Phase 1 of the colour-spectrum game)

2D third-person neon action-puzzle. You are Thanos: destroy every security drone
with 5 gravity-bound vector bullets, then bend a trick shot (gravity + wall
ricochet + transformation field) into the hidden Phase Door.

Standalone: needs only pygame (pip install pygame-ce). Every visual and sound is
generated in code. 100% violet palette.
Controls: A/D or ←/→ move · W/↑/Space jump · mouse aim · left click fire ·
          Esc pause · M mute · R restart (after win/loss).
"""
import array, math, random, sys
import pygame as pg

W, H, FPS = 900, 650, 60
TIME_LIMIT = 120.0          # seconds of game time per attempt
LIVES, AMMO = 3, 5
BULLET_SPEED, MAX_BOUNCES = 12.0, 6
G = pg.Vector2(0, 0.2)      # gravity on player bullets, px / frame²

# ---- 100 % violet palette (spec colours + in-between violets) ----
BG, PLAYER_C, WALL_C = (18, 0, 36), (143, 0, 255), (160, 32, 240)
PROJ_C, SCALE_C, REFL_C = (220, 198, 255), (224, 176, 255), (218, 112, 214)
DOOR_C, DRONE_C = (240, 220, 255), (74, 14, 78)
DEEP, DIM, MID, SOFT, PALE = (34, 4, 64), (58, 10, 100), (98, 24, 170), (186, 140, 255), (236, 222, 255)
VIOLETS = [BG, DEEP, DIM, DRONE_C, MID, PLAYER_C, WALL_C, SOFT, REFL_C, SCALE_C, PROJ_C, DOOR_C, PALE]

# ---- level layout (verified solvable by test_violet.py) ----
R = pg.Rect
SOLIDS = [R(0, 44, 900, 12), R(0, 600, 900, 50), R(0, 44, 16, 606), R(884, 44, 16, 606),
          R(770, 56, 30, 489),                                     # shield pillar hiding the door
          R(70, 470, 220, 14), R(360, 360, 200, 14), R(150, 250, 150, 12)]
FIELDS = [("reflect", R(770, 545, 30, 55)), ("scale", R(560, 500, 90, 100))]
DOOR_RECT = R(800, 430, 12, 90)
DRONES = [((230, 160), 60, 0.0), ((470, 228), 70, 2.1), ((650, 175), 55, 4.2)]
SPAWN = (40, 600 - 76)


def inside(r, x, y):
    return r.left <= x < r.right and r.top <= y < r.bottom


# =============================================================== physics world
class Obstacle:
    def __init__(s, rect): s.rect = rect

class Field:
    """Transformation zone: a matrix applied to the bullet velocity on entry."""
    def __init__(s, kind, rect): s.kind, s.rect, s.flash = kind, rect, 0.0
    def apply(s, v):
        if s.kind == "scale": v *= 1.6                   # [[1.6,0],[0,1.6]]
        else: v.y = -v.y                                  # [[1,0],[0,-1]]

class Door:
    def __init__(s, rect): s.rect, s.unlocked, s.hit = rect, False, False

class World:
    def __init__(s):
        s.obstacles = [Obstacle(r) for r in SOLIDS]
        s.fields = [Field(k, r) for k, r in FIELDS]
        s.door = Door(DOOR_RECT.copy())
        s.enemies = []
    def solid_at(s, x, y):
        if any(inside(o.rect, x, y) for o in s.obstacles): return True
        return not s.door.unlocked and inside(s.door.rect, x, y)   # a locked door is just armour


class Projectile:
    def __init__(s, pos, vel, enemy=False):
        s.pos, s.vel, s.enemy = pg.Vector2(pos), pg.Vector2(vel), enemy
        s.alive, s.bounces, s.trail, s.age, s.inside, s.used = True, 0, [], 0.0, set(), set()

    def step(s, world, ts=1.0, events=None):
        """One frame scaled by ts: gravity, sub-stepped motion, specular bounces, fields, targets."""
        ev = events if events is not None else []
        if not s.enemy: s.vel += G * ts
        n = max(1, math.ceil(max(abs(s.vel.x), abs(s.vel.y)) * ts / 3))
        for _ in range(n):
            d = s.vel * ts / n
            if world.solid_at(s.pos.x + d.x, s.pos.y):          # vertical surface: reflect vx
                if s.enemy: s.alive = False; ev.append(("spark", s.pos.copy())); return ev
                s.vel.x, s.bounces = -s.vel.x, s.bounces + 1; ev.append(("bounce", s.pos.copy()))
            else: s.pos.x += d.x
            if world.solid_at(s.pos.x, s.pos.y + d.y):          # horizontal surface: reflect vy
                if s.enemy: s.alive = False; ev.append(("spark", s.pos.copy())); return ev
                s.vel.y, s.bounces = -s.vel.y, s.bounces + 1; ev.append(("bounce", s.pos.copy()))
            else: s.pos.y += d.y
            if s.enemy: continue
            for f in world.fields:
                now = inside(f.rect, s.pos.x, s.pos.y)
                if now and f not in s.inside: f.apply(s.vel); s.used.add(f.kind); ev.append(("field", s.pos.copy(), f.kind))
                (s.inside.add if now else s.inside.discard)(f)
            for e in world.enemies:
                if e.alive and s.pos.distance_to(e.pos) < e.radius + 3:
                    s.alive = False; ev.append(("kill", e)); return ev
            if world.door.unlocked and inside(world.door.rect, s.pos.x, s.pos.y):
                s.alive = False; ev.append(("door", s.pos.copy())); return ev
            if s.bounces > MAX_BOUNCES: s.alive = False; ev.append(("fizzle", s.pos.copy())); return ev
        s.age += ts
        if not (-50 < s.pos.x < W + 50 and -50 < s.pos.y < H + 50): s.alive = False
        return ev


def predict(world, pos, vel, frames=90):
    """Dotted guide: gravity arc until the first surface or field contact."""
    p, pts = Projectile(pos, vel), []
    for f in range(frames):
        ev = p.step(world)
        if f % 2 == 0: pts.append(p.pos.copy())
        if ev or not p.alive: break
    return pts


# =============================================================== actors
class Player:
    W_, H_ = 26, 76
    def __init__(s): s.reset()
    def reset(s):
        s.rect = pg.Rect(SPAWN[0], SPAWN[1], s.W_, s.H_); s.pos = pg.Vector2(s.rect.topleft)
        s.vel, s.on_ground, s.facing, s.walk, s.hurt, s.aim, s.recoil = pg.Vector2(), False, 1, 0.0, 0.0, 0.0, 0.0
    def shoulder(s): return pg.Vector2(s.rect.centerx + 2 * s.facing, s.rect.top + 26)
    def muzzle(s): return s.shoulder() + pg.Vector2(math.cos(s.aim), math.sin(s.aim)) * 36
    def update(s, keys, world, ts):
        dx = (keys[pg.K_d] or keys[pg.K_RIGHT]) - (keys[pg.K_a] or keys[pg.K_LEFT])
        s.vel.x = dx * 3.8
        if (keys[pg.K_w] or keys[pg.K_UP] or keys[pg.K_SPACE]) and s.on_ground: s.vel.y = -12.6
        s.vel.y = min(s.vel.y + 0.55 * ts, 14)
        for axis in (0, 1):
            s.pos[axis] += s.vel[axis] * ts
            s.rect.topleft = (round(s.pos.x), round(s.pos.y))
            for o in world.obstacles:
                if s.rect.colliderect(o.rect):
                    if axis == 0: s.rect.left = o.rect.right if s.vel.x < 0 else o.rect.left - s.W_ if s.vel.x > 0 else s.rect.left
                    else:
                        if s.vel.y > 0: s.rect.bottom = o.rect.top; s.on_ground = True
                        else: s.rect.top = o.rect.bottom
                        s.vel.y = 0
                    s.pos.update(s.rect.topleft)
            if axis == 1 and s.vel.y != 0: s.on_ground = False
        if world.door.rect.colliderect(s.rect): pass
        s.walk += abs(s.vel.x) * 0.06 * ts if s.on_ground else 0
        s.hurt, s.recoil = max(0, s.hurt - ts / FPS), max(0, s.recoil - 0.15 * ts)


class Enemy:
    """Security drone on a Lissajous patrol: x = A·sin(ωt+φ), y = B·sin(2ωt+φ)."""
    radius = 18
    def __init__(s, base, amp, phase):
        s.base, s.amp, s.phase, s.alive, s.t = pg.Vector2(base), amp, phase, True, random.random() * 3
        s.pos, s.cool = s.base.copy(), random.randint(80, 140)
    def update(s, ts, target, shots):
        s.t += ts / FPS
        s.pos.update(s.base.x + s.amp * math.sin(0.9 * s.t + s.phase), s.base.y + 22 * math.sin(1.8 * s.t + s.phase))
        s.cool -= ts
        if s.cool <= 0:
            s.cool = random.randint(95, 150)
            d = (target - s.pos)
            if d.length() > 1:
                shots.append(Projectile(s.pos, d.normalize().rotate(random.uniform(-6, 6)) * 4.4, enemy=True)); return True
        return False


# =============================================================== audio (synthesised)
class Synth:
    SR = 22050
    def __init__(s):
        s.ok, s.muted, s.snd = False, False, {}
        try:
            pg.mixer.quit(); pg.mixer.init(s.SR, -16, 1, 512)        # pg.init() already opened a 44.1 kHz stereo mixer
            s.ok = pg.mixer.get_init() is not None
        except pg.error: s.ok = False
        if not s.ok: return
        rnd = random.Random(7)
        def mk(dur, fn):
            a = array.array("h", (int(max(-1, min(1, fn(i / s.SR, i))) * 32000) for i in range(int(dur * s.SR))))
            return pg.mixer.Sound(buffer=a.tobytes())
        ex = math.exp; sin = math.sin; tau = 2 * math.pi; nz = lambda: rnd.uniform(-1, 1)
        s.snd["gun"] = mk(0.35, lambda t, i: (nz() * ex(-t * 28) * 0.9 + sin(tau * (90 - 60 * t) * t) * ex(-t * 14)) * 0.9)
        s.snd["ping"] = mk(0.3, lambda t, i: sin(tau * (2400 - 1500 * t) * t) * ex(-t * 16) * 0.5)
        s.snd["zap"] = mk(0.3, lambda t, i: ((t * (300 + 2400 * t)) % 1 * 2 - 1) * ex(-t * 9) * 0.45)
        s.snd["pew"] = mk(0.22, lambda t, i: sin(tau * (1500 - 3600 * t) * t) * ex(-t * 12) * 0.35)
        s.snd["boom"] = mk(1.1, lambda t, i: (nz() * ex(-t * 4.5) * 0.8 + sin(tau * 48 * t) * ex(-t * 3)) * 0.95)
        s.snd["hurt"] = mk(0.4, lambda t, i: (1 if sin(tau * 110 * t) > 0 else -1) * ex(-t * 7) * 0.4)
        s.snd["door"] = mk(1.6, lambda t, i: sum(sin(tau * f * t) for f in (220, 277.2, 329.6, 440)) / 4 * min(1, t * 8) * ex(-t * 1.6))
        s.snd["click"] = mk(0.06, lambda t, i: sin(tau * 1800 * t) * ex(-t * 70) * 0.4)
        s.snd["empty"] = mk(0.12, lambda t, i: sin(tau * 220 * t) * ex(-t * 30) * 0.5)
        s.music = s.make_music(rnd)
        s.chan = pg.mixer.Channel(0)

    def make_music(s, rnd):
        """8-bar ambient cyberpunk loop: detuned pad, gated bass arpeggio, soft hats (100 BPM)."""
        bpm, bars = 100, 4; beat = 60 / bpm; n = int(bars * 4 * beat * s.SR)
        roots = [55.0, 43.65, 49.0, 41.2]; arp = [1, 1.5, 2, 1.5, 1.2, 1.5, 2, 3]
        out = array.array("h"); lp = 0.0; tau = 2 * math.pi
        for i in range(n):
            t = i / s.SR; b = t / beat; bar = int(b // 4) % 4; r = roots[bar]
            pad = sum(math.sin(tau * r * k * (1 + d) * t) for k, d in ((4, 0), (4, 0.004), (6, 0), (5, -0.003))) * 0.06
            step = int(b * 2) % 8; ph = (b * 2) % 1
            f = r * 2 * arp[step]; saw = ((f * t) % 1) * 2 - 1
            lp += (saw - lp) * 0.08
            bass = lp * 0.32 * math.exp(-ph * 3.5)
            hat = rnd.uniform(-1, 1) * 0.05 * math.exp(-((b * 4) % 1) * 22) if int(b * 4) % 2 else 0
            out.append(int(max(-1, min(1, pad + bass + hat)) * 30000))
        return pg.mixer.Sound(buffer=out.tobytes())

    def play(s, name, vol=1.0):
        if s.ok and not s.muted and name in s.snd: s.snd[name].set_volume(vol); s.snd[name].play()
    def music_on(s):
        if s.ok and not s.muted and not s.chan.get_busy(): s.chan.play(s.music, loops=-1); s.chan.set_volume(0.55)
    def toggle(s):
        s.muted = not s.muted
        if not s.ok: return
        if s.muted: pg.mixer.pause(); s.chan.stop()
        else: pg.mixer.unpause(); s.music_on()


# =============================================================== rendering helpers
def build_city():
    """Neon city backdrop after the reference: towers, signs, billboard, crowd with umbrellas."""
    rnd = random.Random(3)
    bg = pg.Surface((W, H)); glow = pg.Surface((W, H), pg.SRCALPHA)
    for y in range(H):
        k = y / H; bg.fill((int(18 + 20 * (1 - abs(k - 0.45) * 2) * 0.6), 0, int(36 + 30 * (1 - abs(k - 0.45) * 2) * 0.6)), (0, y, W, 1))
    for layer, (col, hmin, hmax, win) in enumerate([(DEEP, 160, 420, DIM), (DIM, 120, 330, MID)]):
        x = -20
        while x < W:
            bw = rnd.randint(50, 120); bh = rnd.randint(hmin, hmax); top = 600 - bh - layer * 10
            pg.draw.rect(bg, col, (x, top, bw, bh))
            for wy in range(top + 8, 596, 9):
                for wx in range(x + 5, x + bw - 5, 7):
                    if rnd.random() < 0.28: bg.fill(win if rnd.random() < 0.8 else SOFT, (wx, wy, 3, 4))
            if rnd.random() < 0.55:          # vertical neon sign
                sx, sy, sh = x + rnd.randint(4, bw - 18), top + rnd.randint(10, 60), rnd.randint(50, 140)
                c = rnd.choice([REFL_C, SOFT, WALL_C, SCALE_C])
                pg.draw.rect(glow, c, (sx, sy, 14, sh), 2)
                for gy in range(sy + 6, sy + sh - 6, 10): pg.draw.rect(glow, c, (sx + 4, gy, 6, 6), 1)
            x += bw + rnd.randint(-10, 8)
    pg.draw.rect(glow, REFL_C, (24, 70, 170, 110), 3)                 # big billboard (top-left in the reference)
    for k in range(6): pg.draw.line(glow, SOFT, (32, 84 + k * 16), (32 + rnd.randint(60, 150), 84 + k * 16), 3)
    for k in range(5):                                                 # horizontal shop signs
        sx, sy = rnd.randint(330, 860), rnd.randint(380, 470)
        pg.draw.rect(glow, rnd.choice([SCALE_C, REFL_C, SOFT]), (sx - 40, sy, 80, 18), 2)
    for k in range(14):                                                # crowd with umbrellas
        cx = rnd.randint(330, 860); cy = 592
        pg.draw.rect(bg, DEEP, (cx - 3, cy - 18, 6, 18)); pg.draw.circle(bg, DEEP, (cx, cy - 22), 4)
        if rnd.random() < 0.6: pg.draw.arc(glow, SOFT, (cx - 13, cy - 38, 26, 22), 0, math.pi, 2)
    bg.blit(glow, (0, 0))
    veil = pg.Surface((W, H), pg.SRCALPHA); veil.fill((*BG, 125)); bg.blit(veil, (0, 0))   # push the city back
    glow.fill((95, 95, 95, 255), special_flags=pg.BLEND_RGBA_MULT)                          # neon at ~40 % for bloom
    return bg, glow

def bloom(src, strength=2):
    small = pg.transform.smoothscale(src, (W // 6, H // 6))
    small = pg.transform.smoothscale(small, (W // 12, H // 12))
    big = pg.transform.smoothscale(small, (W, H))
    for _ in range(strength): yield big


def draw_thanos(surf, glow, p, t):
    """Third-person Thanos in neon violet; the gauntlet arm tracks the aim."""
    x, y, f = p.rect.centerx, p.rect.bottom, p.facing
    col = PALE if p.hurt > 0 and int(t * 20) % 2 else PLAYER_C
    sw = math.sin(p.walk * 2) * 10 if p.on_ground else 6
    for k, s_ in ((-1, sw), (1, -sw)):                                    # legs
        hip = (x + 5 * k, y - 34); foot = (x + 5 * k + s_ * 0.8, y - 2)
        pg.draw.line(surf, MID, hip, foot, 9); pg.draw.line(glow, col, hip, foot, 2)
    torso = [(x - 15, y - 62), (x + 15, y - 62), (x + 11, y - 32), (x - 11, y - 32)]
    pg.draw.polygon(surf, MID, torso); pg.draw.polygon(surf, col, torso, 2); pg.draw.polygon(glow, col, torso, 2)
    pg.draw.line(glow, SOFT, (x - 11, y - 46), (x + 11, y - 46), 2)        # chest band
    collar = [(x - 18, y - 60), (x - 7, y - 70), (x + 7, y - 70), (x + 18, y - 60), (x + 10, y - 56), (x - 10, y - 56)]
    pg.draw.polygon(surf, MID, collar); pg.draw.polygon(glow, SOFT, collar, 2)
    hx, hy = x + 2 * f, y - 82                                           # head with heavy jaw
    head = pg.Rect(hx - 11, hy - 14, 22, 28)
    pg.draw.ellipse(surf, PLAYER_C, head); pg.draw.ellipse(surf, SOFT, head, 2); pg.draw.ellipse(glow, col, head, 2)
    for k in (-4, 0, 4): pg.draw.line(glow, WALL_C, (hx + k, hy + 6), (hx + k * 1.1, hy + 12), 1)   # chin ridges
    pg.draw.line(glow, PALE, (hx + 3 * f, hy - 3), (hx + 8 * f, hy - 5), 2)                    # brow
    pg.draw.circle(glow, PALE, (hx + 5 * f, hy - 1), 2)                                          # glowing eye
    back = (x - 12 * f, y - 58); pg.draw.line(surf, PLAYER_C, back, (x - 15 * f, y - 34), 7)      # back arm
    sh = p.shoulder(); d = pg.Vector2(math.cos(p.aim), math.sin(p.aim)); hand = sh + d * (26 - p.recoil * 6)
    pg.draw.line(surf, PLAYER_C, sh, hand, 8); pg.draw.line(glow, col, sh, hand, 2)
    g_ = pg.Rect(0, 0, 14, 14); g_.center = hand
    pg.draw.rect(surf, WALL_C, g_, border_radius=3); pg.draw.rect(glow, SCALE_C, g_, 2, border_radius=3)
    for k in range(5):                                                   # infinity stones as violet sparks
        a = p.aim + (k - 2) * 0.45; pt = hand + pg.Vector2(math.cos(a), math.sin(a)) * 6
        pg.draw.circle(glow, PALE if (int(t * 6) + k) % 5 == 0 else SOFT, pt, 1)
    pg.draw.line(glow, PROJ_C, hand, p.muzzle(), 3)                      # barrel


# =============================================================== game
class Game:
    def __init__(s):
        pg.init()
        s.screen = pg.display.set_mode((W, H)); pg.display.set_caption("VIOLET")
        s.clock = pg.time.Clock()
        name = next((n for n in ("bahnschrift", "orbitron", "agencyfb", "eurostile", "consolas") if pg.font.match_font(n)), None)
        s.f_big, s.f_mid, s.f_sm = pg.font.SysFont(name, 64, bold=True), pg.font.SysFont(name, 26, bold=True), pg.font.SysFont(name, 18)
        s.city, s.city_glow = build_city()
        s.glow = pg.Surface((W, H), pg.SRCALPHA)
        s.scan = pg.Surface((W, H), pg.SRCALPHA)
        for y in range(0, H, 3): s.scan.fill((10, 0, 20, 70), (0, y, W, 1))
        s.audio = Synth()
        s.rain = [[random.uniform(0, W), random.uniform(0, H), random.uniform(7, 13)] for _ in range(160)]
        s.state, s.t, s.over_reason, s.aim_point = "menu", 0.0, "", None   # aim_point: test hook
        s.buttons = {}
        s.reset()

    def reset(s):
        s.world, s.player = World(), Player()
        s.world.enemies = [Enemy(*d) for d in DRONES]
        s.lives, s.ammo, s.time_left = LIVES, AMMO, TIME_LIMIT
        s.shots, s.eshots, s.parts, s.rings = [], [], [], []
        s.slow, s.shake, s.flash, s.won_t = 0.0, 0.0, 0.0, 0.0

    # ---------------- effects
    def burst(s, pos, n, speed, col, grav=0.12, life=(25, 60), size=(2, 4)):
        for _ in range(n):
            a, v = random.uniform(0, 2 * math.pi), random.uniform(0.3, 1) * speed
            s.parts.append([pg.Vector2(pos), pg.Vector2(math.cos(a), math.sin(a)) * v, random.uniform(*life), 0, random.uniform(*size), col, grav])
    def explode(s, pos, big=False):
        s.burst(pos, 90 if big else 55, 9 if big else 7, SOFT); s.burst(pos, 40, 4, PALE, 0.05)
        s.rings.append([pg.Vector2(pos), 0.0, 60 if big else 42]); s.shake, s.slow = 14, 0.9
        s.flash = max(s.flash, 0.6 if big else 0.3); s.burst(pos, 25, 13, PROJ_C, 0.02, (10, 22), (1, 2))   # flash + fast streaks
        s.audio.play("boom")

    # ---------------- flow
    def fire(s):
        if s.ammo <= 0: s.audio.play("empty"); return
        s.ammo -= 1; m = s.player.muzzle()
        s.shots.append(Projectile(m, pg.Vector2(math.cos(s.player.aim), math.sin(s.player.aim)) * BULLET_SPEED))
        s.player.recoil = 1.0; s.shake = max(s.shake, 4); s.burst(m, 14, 4, PROJ_C, 0, (6, 14))
        s.audio.play("gun")

    def lose(s, reason): s.state, s.over_reason = "over", reason; s.audio.play("boom", 0.6)

    def handle_events(s, ev, world):
        for e in ev:
            if e[0] == "bounce": s.burst(e[1], 10, 3, PROJ_C, 0.05, (8, 18)); s.audio.play("ping", 0.6)
            elif e[0] == "field":
                for f in world.fields:
                    if f.kind == e[2]: f.flash = 1.0
                s.burst(e[1], 18, 4, SCALE_C if e[2] == "scale" else REFL_C, 0, (10, 24)); s.audio.play("zap")
            elif e[0] == "kill":
                e[1].alive = False; s.explode(e[1].pos)
                if not any(d.alive for d in world.enemies):
                    world.door.unlocked = True; s.audio.play("door", 0.7)
            elif e[0] == "door":
                world.door.hit = True; s.explode(e[1], big=True); s.flash = 1.0; s.slow = 2.0
                s.audio.play("door"); s.state, s.won_t = "won", 0.0
            elif e[0] == "fizzle": s.burst(e[1], 12, 2, DIM, 0.02)

    def update(s, dt):
        s.t += dt
        for r in s.rain:
            r[1] += r[2] * dt * 60; r[0] -= r[2] * 0.25 * dt * 60
            if r[1] > H: r[0], r[1] = random.uniform(0, W + 100), -10
        if s.state not in ("play", "won"): return
        ts = 0.25 if s.slow > 0 else 1.0                                   # slow-motion time scale
        s.slow = max(0, s.slow - dt); s.shake *= 0.86; s.flash = max(0, s.flash - dt * 1.5)
        w = s.world
        for f in w.fields: f.flash = max(0, f.flash - dt * 2)
        for p_ in s.parts:
            p_[1].y += p_[6] * ts; p_[0] += p_[1] * ts; p_[1] *= 0.985 ** ts; p_[3] += ts
        s.parts = [p_ for p_ in s.parts if p_[3] < p_[2]]
        for r in s.rings: r[1] += ts
        s.rings = [r for r in s.rings if r[1] < r[2]]
        if s.state == "won": s.won_t += dt; return
        s.time_left -= dt * ts
        if s.time_left <= 0: s.time_left = 0; s.lose("TIME EXPIRED"); return
        keys = pg.key.get_pressed(); pl = s.player
        mx, my = s.aim_point or pg.mouse.get_pos(); sh = pl.shoulder()
        pl.aim = math.atan2(my - sh.y, mx - sh.x); pl.facing = 1 if mx >= pl.rect.centerx else -1
        pl.update(keys, w, ts)
        for e in w.enemies:
            if e.alive and e.update(ts, pg.Vector2(pl.rect.center), s.eshots): s.audio.play("pew", 0.5)
        for b in s.shots:
            b.trail.append(b.pos.copy()); b.trail = b.trail[-16:]
            s.handle_events(b.step(w, ts), w)
            if s.state != "play": return
        s.shots = [b for b in s.shots if b.alive]
        for b in s.eshots:
            b.trail.append(b.pos.copy()); b.trail = b.trail[-8:]
            for ev in b.step(w, ts): s.burst(ev[1], 6, 2, DRONE_C, 0.05, (6, 14))
            if b.alive and pl.rect.collidepoint(b.pos) and pl.hurt <= 0:
                b.alive = False; s.lives -= 1; pl.hurt = 1.5; s.shake = 10; s.flash = 0.4
                s.burst(b.pos, 30, 5, PALE); s.audio.play("hurt")
                if s.lives <= 0: s.lose("LIVES DEPLETED"); return
        s.eshots = [b for b in s.eshots if b.alive]
        if s.ammo == 0 and not s.shots: s.lose("OUT OF VECTOR BULLETS")

    # ---------------- drawing
    def text(s, txt, font, col, center, glow_col=None):
        img = font.render(txt, True, col); r = img.get_rect(center=center)
        if glow_col: s.glow.blit(font.render(txt, True, glow_col), r)
        s.screen.blit(img, r); return r

    def button(s, key, label, center, w_=240):
        r = pg.Rect(0, 0, w_, 50); r.center = center
        hover = r.collidepoint(pg.mouse.get_pos())
        pg.draw.rect(s.screen, MID if hover else DEEP, r, border_radius=6)
        pg.draw.rect(s.glow, PALE if hover else WALL_C, r, 3, border_radius=6)
        s.text(label, s.f_mid, PALE if hover else SOFT, r.center)
        s.buttons[key] = r

    def draw_world(s):
        w, g, sc = s.world, s.glow, s.screen
        sc.blit(s.city, (0, 0))
        k = 0.5 + 0.5 * math.sin(s.t * 3)
        g.blit(s.city_glow, (0, 0), special_flags=0) if k > 0.15 else None   # neon flicker
        for r in s.rain: pg.draw.line(sc, DIM, (r[0], r[1]), (r[0] - r[2] * 0.3, r[1] + r[2] * 1.4), 1)
        for o in w.obstacles:
            pg.draw.rect(sc, DIM, o.rect); pg.draw.rect(sc, WALL_C, o.rect, 2); pg.draw.rect(g, WALL_C, o.rect, 3)
            pg.draw.line(g, PALE, o.rect.topleft, (o.rect.right - 1, o.rect.top), 1)
        refl = s.screen.subsurface((0, 560, W, 40)).copy(); refl = pg.transform.flip(refl, False, True); refl.set_alpha(40)
        sc.blit(refl, (0, 604))                                            # wet-floor reflection
        for f in w.fields:
            c = SCALE_C if f.kind == "scale" else REFL_C
            surf = pg.Surface(f.rect.size, pg.SRCALPHA); surf.fill((*c, int(40 + 60 * f.flash)))
            sc.blit(surf, f.rect); pg.draw.rect(g, c, f.rect, 2)
            for yy in range(f.rect.top + int((s.t * 30) % 10), f.rect.bottom, 10): pg.draw.line(g, c, (f.rect.left, yy), (f.rect.right - 1, yy), 1)
            lbl = "x1.6" if f.kind == "scale" else "-vy"
            s.text(lbl, s.f_sm, c, (f.rect.centerx, f.rect.top - 12))
        d = w.door; pulse = 0.5 + 0.5 * math.sin(s.t * (8 if d.unlocked else 3))
        pg.draw.rect(sc, DOOR_C if d.unlocked else MID, d.rect)
        pg.draw.rect(g, DOOR_C, d.rect.inflate(int(6 + 8 * pulse), int(6 + 8 * pulse)), 3)
        pg.draw.circle(g, DOOR_C, d.rect.center, int(10 + 6 * pulse), 2)                               # core lock
        s.text("CORE", s.f_sm, DOOR_C, (d.rect.centerx + 36, d.rect.top - 14))
        if not d.unlocked:
            for yy in range(d.rect.top + 8, d.rect.bottom, 16): pg.draw.line(sc, DEEP, (d.rect.left, yy), (d.rect.right, yy), 3)
        for e in w.enemies:
            if not e.alive: continue
            pg.draw.circle(sc, DRONE_C, e.pos, e.radius); pg.draw.circle(g, REFL_C, e.pos, e.radius, 2)
            eye = e.pos + (pg.Vector2(s.player.rect.center) - e.pos).normalize() * 6 if e.pos != pg.Vector2(s.player.rect.center) else e.pos
            pg.draw.circle(g, PALE, eye, 4)
            for a in range(3):
                ang = s.t * 9 + a * 2.09; pg.draw.line(g, SOFT, e.pos + pg.Vector2(math.cos(ang), math.sin(ang) * 0.3) * 18, e.pos + pg.Vector2(math.cos(ang), math.sin(ang) * 0.3) * 30, 2)
        if s.state == "play":                                             # predictive trajectory guide
            pts = predict(w, s.player.muzzle(), pg.Vector2(math.cos(s.player.aim), math.sin(s.player.aim)) * BULLET_SPEED)
            for i, p_ in enumerate(pts): pg.draw.circle(g, (*PROJ_C, max(40, 220 - i * 5)), p_, 2)
            mx, my = pg.mouse.get_pos()
            pg.draw.circle(g, PROJ_C, (mx, my), 10, 2); pg.draw.line(g, PROJ_C, (mx - 16, my), (mx - 6, my), 2); pg.draw.line(g, PROJ_C, (mx + 6, my), (mx + 16, my), 2)
        draw_thanos(sc, g, s.player, s.t)
        for b in s.shots + s.eshots:
            c = PROJ_C if not b.enemy else REFL_C
            for i in range(1, len(b.trail)): pg.draw.line(g, c, b.trail[i - 1], b.trail[i], max(1, i // 4))
            pg.draw.circle(sc, PALE, b.pos, 4 if not b.enemy else 3); pg.draw.circle(g, c, b.pos, 7, 2)
        for p_ in s.parts:
            k = 1 - p_[3] / p_[2]; pg.draw.circle(g, p_[5], p_[0], max(1, p_[4] * k))
        for r in s.rings:
            k = r[1] / r[2]; pg.draw.circle(g, PALE, r[0], int(10 + 110 * k), max(1, int(6 * (1 - k))))

    def draw_hud(s):
        sc = s.screen; pg.draw.rect(sc, BG, (0, 0, W, 44)); pg.draw.line(s.glow, WALL_C, (0, 43), (W, 43), 2)
        s.text("VIOLET", s.f_sm, SOFT, (50, 22))
        s.text("LIVES", s.f_sm, SOFT, (165, 22))
        for i in range(LIVES):
            c = PLAYER_C if i < s.lives else DEEP; pts = [(200 + i * 22, 14), (209 + i * 22, 22), (200 + i * 22, 30), (191 + i * 22, 22)]
            pg.draw.polygon(sc, c, pts); pg.draw.polygon(s.glow, SOFT, pts, 1)
        s.text("AMMO", s.f_sm, SOFT, (290, 22))
        for i in range(AMMO):
            r = pg.Rect(318 + i * 14, 12, 8, 20); pg.draw.rect(sc, PROJ_C if i < s.ammo else DEEP, r, border_radius=3)
            if i < s.ammo: pg.draw.rect(s.glow, PROJ_C, r, 1, border_radius=3)
        alive = sum(e.alive for e in s.world.enemies)
        s.text(f"DRONES {alive}", s.f_sm, PALE if alive else SOFT, (440, 22))
        low = s.time_left < 20
        col = PALE if low and int(s.t * 4) % 2 else SCALE_C
        s.text(f"{int(s.time_left // 60)}:{int(s.time_left % 60):02d}", s.f_mid, col, (W // 2 + 170, 22), DOOR_C if low else None)
        s.text("DOOR " + ("OPEN" if s.world.door.unlocked else "LOCKED"), s.f_sm, DOOR_C if s.world.door.unlocked else MID, (W - 90, 22))

    def overlay(s, alpha=170):
        o = pg.Surface((W, H), pg.SRCALPHA); o.fill((*BG, alpha)); s.screen.blit(o, (0, 0))

    def draw(s):
        s.buttons = {}
        s.glow.fill((0, 0, 0, 0))
        off = pg.Vector2(random.uniform(-1, 1), random.uniform(-1, 1)) * s.shake
        s.draw_world()
        if s.state in ("menu", "rules"):
            s.overlay(150)
            if s.state == "menu":
                s.text("VIOLET", s.f_big, PALE, (W // 2, 170), PLAYER_C)
                s.text("You are Thanos. Five bullets. Three drones. One impossible door.", s.f_sm, SCALE_C, (W // 2, 270))
                s.button("start", "START", (W // 2, 340)); s.button("rules", "RULES", (W // 2, 405)); s.button("exit", "EXIT", (W // 2, 470))
            else:
                s.text("RULES", s.f_big, PALE, (W // 2, 90), PLAYER_C)
                s.text("PLACEHOLDER — FINAL RULES TO BE ATTACHED", s.f_sm, REFL_C, (W // 2, 140))
                lines = ["Destroy all 3 security drones, then strike the Phase Door's core lock.",
                         "You have 3 lives, 5 vector bullets and 2:00. Enemy fire costs a life.",
                         "Your bullets fall under gravity and ricochet off walls (angle in = angle out).",
                         "Scaling field multiplies bullet velocity by 1.6. Reflection field flips it upward.",
                         "The door hides behind a pillar: bend a shot through a field and off a wall.",
                         "Out of lives, out of bullets or out of time: the level restarts from scratch.",
                         "A/D or arrows move · W/Space jump · mouse aim · click fire · Esc pause · M mute"]
                for i, l in enumerate(lines): s.text(l, s.f_sm, SOFT, (W // 2, 200 + i * 34))
                s.button("back", "BACK", (W // 2, 560))
        else:
            s.draw_hud()
        if s.state == "pause":
            s.overlay(); s.text("PAUSED", s.f_big, PALE, (W // 2, 200), PLAYER_C)
            s.button("resume", "RESUME", (W // 2, 320)); s.button("menu", "MAIN MENU", (W // 2, 385)); s.button("exit", "EXIT", (W // 2, 450))
        if s.state == "over":
            s.overlay(); s.text("GAME OVER", s.f_big, PALE, (W // 2, 210), PLAYER_C)
            s.text(s.over_reason, s.f_mid, REFL_C, (W // 2, 280))
            s.text("Press R to restart the level", s.f_mid, SOFT, (W // 2, 340))
            s.button("restart", "RESTART (R)", (W // 2, 420), 280); s.button("menu", "MAIN MENU", (W // 2, 485), 280)
        if s.state == "won" and s.won_t > 1.2:
            s.overlay(140)
            s.text("PHASE DOOR UNLOCKED.", s.f_big, PALE, (W // 2, 230), DOOR_C)
            s.text("TRANSITIONING TO LEVEL: INDIGO", s.f_mid, SCALE_C, (W // 2, 300), PLAYER_C)
            s.text(f"Bullets left {s.ammo} · Lives {s.lives} · Time {int(s.time_left // 60)}:{int(s.time_left % 60):02d}", s.f_sm, SOFT, (W // 2, 350))
            s.button("restart", "RESTART (R)", (W // 2, 430), 280); s.button("menu", "MAIN MENU", (W // 2, 495), 280)
        for b in bloom(s.glow): s.screen.blit(b, (0, 0), special_flags=pg.BLEND_RGB_ADD)
        s.screen.blit(s.glow, (0, 0))
        if s.flash > 0:
            o = pg.Surface((W, H)); o.fill(PALE); o.set_alpha(int(180 * s.flash)); s.screen.blit(o, (0, 0))
        if s.slow > 0 and s.state == "play":
            s.text("SLOW-MO", s.f_sm, SCALE_C, (W - 60, 62))
        s.screen.blit(s.scan, (0, 0))                                                   # scanlines
        if off.length() > 0.5: s.screen.scroll(int(off.x), int(off.y))
        pg.display.flip()

    # ---------------- loop
    def click(s, pos):
        for k, r in s.buttons.items():
            if r.collidepoint(pos):
                s.audio.play("click"); s.action(k); return True
        return False

    def action(s, k):
        if k == "start": s.reset(); s.state = "play"; s.audio.music_on()
        elif k == "rules": s.state = "rules"
        elif k == "back": s.state = "menu"
        elif k == "exit": s.running = False
        elif k == "resume": s.state = "play"
        elif k == "menu": s.reset(); s.state = "menu"
        elif k == "restart": s.reset(); s.state = "play"; s.audio.music_on()

    def run(s, max_frames=None, script=None):
        s.running, frame = True, 0
        while s.running:
            dt = s.clock.tick(FPS) / 1000
            events = pg.event.get() + (script(s, frame) if script else [])
            for e in events:
                if e.type == pg.QUIT: s.running = False
                elif e.type == pg.KEYDOWN:
                    if e.key == pg.K_m: s.audio.toggle()
                    elif e.key == pg.K_ESCAPE: s.state = {"play": "pause", "pause": "play", "rules": "menu"}.get(s.state, s.state)
                    elif e.key == pg.K_r and s.state in ("over", "won"): s.action("restart")
                    elif e.key == pg.K_RETURN and s.state == "menu": s.action("start")
                elif e.type == pg.MOUSEBUTTONDOWN and e.button == 1:
                    if not s.click(e.pos) and s.state == "play": s.fire()
            s.update(dt); s.draw()
            frame += 1
            if max_frames and frame >= max_frames: break
        pg.quit()


if __name__ == "__main__":
    Game().run()
    sys.exit()
