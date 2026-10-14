"""
INDIGO
2D space-flight physics puzzle. Thanos, in an astronaut helmet, pilots a small
ship through gravity wells, laser barriers and ricochet walls to the Indigo Gate.

Standalone: needs only pygame (pip install pygame-ce). All art and sound are
generated in code. Visual style: "Vector Nebula" (soft nebula + glowing wireframe).
Controls: W thrust · S reverse/brake · A/D rotate · SPACE fire anchor / release tether
          P pause · M mute · R restart · ESC quit
"""
import array, math, random, sys
import pygame as pg

V = pg.Vector2
W, H, FPS = 900, 650, 60
TIME_LIMIT = 300.0
LIVES, SHOTS = 3, 8
TOP, BOTTOM, LEFT, RIGHT = 56, 644, 6, 894          # arena bounds (HUD above TOP)

# ---- monochrome indigo / violet palette ----
BG, GRIDC, SHIP, WELL, LASER, STRUCT, PORTAL = (8, 0, 26), (20, 5, 43), (75, 0, 130), (26, 0, 51), (108, 45, 199), (30, 0, 59), (160, 102, 255)
DEEP, MID, SOFT, PALE, LILAC, WHITE = (44, 10, 92), (88, 40, 170), (140, 110, 230), (200, 182, 255), (176, 140, 255), (232, 224, 255)

# ---- level layout (left → right: Drift, Singularity, Polarity Field, Indigo Gate) ----
SPAWN, CHECKPOINT_X, CHECKPOINT_SPAWN = V(80, 300), 482, V(515, 350)
WALLS = [((250, 56), (275, 215)), ((275, 485), (250, 644)),          # Drift | Singularity divider (gap 215–485)
         ((480, 56), (470, 200)), ((470, 500), (480, 644)),          # Singularity | Polarity divider (gap 200–500)
         ((540, 200), (620, 160)), ((540, 500), (620, 540))]         # angled reflectors in the Polarity Field
WELLS = [((150, 505), 140, 16, 55), ((365, 350), 330, 24, 72), ((760, 565), 200, 18, 60)]   # pos, strength, core, ring
NODES = [(365, 118), (365, 590), (560, 92), (690, 612)]
LASER_DEF = ((600, 350), 170)                                        # pivot, half-length
GATE_X, GATE_W, GATE_Y = 810, 40, 350
SAFE_GATE_SPEED = 4.5


def seg_closest(p, a, b):
    ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared(), 1e-9)))
    return a + ab * t

def segs_cross(p1, p2, q1, q2):
    d = lambda a, b, c: (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    return d(p1, p2, q1) * d(p1, p2, q2) < 0 and d(q1, q2, p1) * d(q1, q2, p2) < 0

def reflect(v, n, e=1.0):
    """v_new = v − (1+e)(v·n)n ; e = 1 is a perfect mirror."""
    return v - n * ((1 + e) * v.dot(n))


# =============================================================== physics objects
class GravityWell:
    def __init__(s, pos, strength, core, ring): s.pos, s.k, s.core, s.ring = V(pos), strength, core, ring
    def accel(s, p, soft=14.0):
        """Softened inverse square: a = k·r̂ / (r² + ε²)  (k = G·m₁·m₂ / m_ship folded together)."""
        d = s.pos - p; r2 = d.length_squared() + soft * soft
        return d.normalize() * (s.k / r2) if d.length_squared() > 1e-9 else V()

class AnchorNode:
    def __init__(s, pos): s.pos, s.pulse = V(pos), random.random() * 6

class Projectile:
    def __init__(s, pos, vel): s.pos, s.vel, s.life, s.trail = V(pos), V(vel), 60, []

class LaserObstacle:
    """Beam that oscillates θ = π/2 + A·sin(ωt) and cycles active / safe phases."""
    PERIOD, ACTIVE = 4.0, 2.6
    def __init__(s, pivot, half): s.pivot, s.half, s.t = V(pivot), half, 0.0
    @property
    def angle(s): return math.pi / 2 + 0.6 * math.sin(0.6 * s.t)
    @property
    def active(s): return (s.t % s.PERIOD) < s.ACTIVE
    @property
    def phase_left(s): return (s.ACTIVE - s.t % s.PERIOD) if s.active else (s.PERIOD - s.t % s.PERIOD)
    def ends(s):
        d = V(math.cos(s.angle), math.sin(s.angle)) * s.half
        return s.pivot - d, s.pivot + d
    def aligned(s, heading, tol=math.radians(15)):
        diff = (heading - s.angle) % math.pi
        return min(diff, math.pi - diff) <= tol

class TargetGate:
    """Two monoliths whose opening breathes: half-gap h(t) = 45 + 25·sin(0.5t)."""
    def __init__(s): s.t = 0.0
    @property
    def half(s): return 45 + 25 * math.sin(0.5 * s.t)
    def rects(s):
        h = s.half
        return pg.Rect(GATE_X, TOP, GATE_W, GATE_Y - h - TOP), pg.Rect(GATE_X, GATE_Y + h, GATE_W, BOTTOM - GATE_Y - h)
    def walls(s):
        out = []
        for r in s.rects():
            c = [V(r.topleft), V(r.topright), V(r.bottomright), V(r.bottomleft)]
            out += [(c[i], c[(i + 1) % 4]) for i in range(4)]
        return out

class Spaceship:
    R, THRUST, REVERSE, TURN, VMAX = 11, 0.11, 0.06, 0.07, 6.5
    def __init__(s, pos): s.reset(pos)
    def reset(s, pos):
        s.pos, s.vel, s.angle, s.tether, s.tlen, s.inv, s.thrusting = V(pos), V(), 0.0, None, 0.0, 2.0, 0
    @property
    def heading(s): return V(math.cos(s.angle), math.sin(s.angle))
    def nose(s): return s.pos + s.heading * 16


# =============================================================== audio
class Synth:
    SR = 22050
    def __init__(s):
        s.ok, s.muted, s.snd = False, False, {}
        try: pg.mixer.quit(); pg.mixer.init(s.SR, -16, 1, 512); s.ok = pg.mixer.get_init() == (s.SR, -16, 1)   # pg.init() opened 44.1 kHz stereo
        except pg.error: s.ok = False
        if not s.ok: return
        rnd = random.Random(11); nz = lambda: rnd.uniform(-1, 1); ex, sin, tau = math.exp, math.sin, 2 * math.pi
        def mk(dur, fn):
            a = array.array("h", (int(max(-1, min(1, fn(i / s.SR))) * 30000) for i in range(int(dur * s.SR))))
            return pg.mixer.Sound(buffer=a.tobytes())
        s.snd["gun"] = mk(0.3, lambda t: (nz() * ex(-t * 30) * 0.7 + sin(tau * (180 - 120 * t) * t) * ex(-t * 12)) * 0.8)
        s.snd["strike"] = mk(0.5, lambda t: sum(sin(tau * f * t) for f in (620, 931, 1312)) / 3 * ex(-t * 7) * 0.6)
        s.snd["ricochet"] = mk(0.35, lambda t: sin(tau * (2600 - 2000 * t) * t) * ex(-t * 11) * 0.45)
        s.snd["zap"] = mk(0.4, lambda t: (((t * (240 + 1800 * t)) % 1) * 2 - 1) * ex(-t * 7) * 0.5)
        s.snd["boom"] = mk(1.4, lambda t: (nz() * ex(-t * 3.2) * 0.85 + sin(tau * 42 * t) * ex(-t * 2.4)) * 0.95)
        s.snd["alarm"] = mk(0.25, lambda t: sin(tau * 880 * t) * (1 if (t * 16) % 2 < 1 else 0) * ex(-t * 4) * 0.25)
        s.snd["chime"] = mk(1.2, lambda t: sum(sin(tau * f * t) * ex(-t * (3 + k)) for k, f in enumerate((523.3, 659.3, 784.0, 1046.5))) / 3)
        s.snd["warp"] = mk(2.4, lambda t: (sin(tau * (120 + 500 * t * t) * t) * 0.5 + nz() * 0.15) * min(1, t * 2) * ex(-t * 0.9))
        s.snd["click"] = mk(0.06, lambda t: sin(tau * 1700 * t) * ex(-t * 70) * 0.4)
        s.snd["empty"] = mk(0.12, lambda t: sin(tau * 200 * t) * ex(-t * 30) * 0.5)
        s.engine = mk(1.0, lambda t: (nz() * 0.6 + sin(tau * 55 * t) * 0.4) * 0.35)
        s.music = s.make_music(rnd)
        s.mchan, s.echan = pg.mixer.Channel(0), pg.mixer.Channel(1)

    def make_music(s, rnd):
        """Ambient space loop, 80 BPM: minor-9 pad with slow swells + sparse cyber arpeggio with echo."""
        bpm = 80; beat = 60 / bpm; n = int(16 * beat * s.SR); tau = 2 * math.pi
        chords = [(55.0, (1, 1.189, 1.498, 1.782, 2.245)), (43.65, (1, 1.189, 1.498, 1.782, 2.245)), (49.0, (1, 1.26, 1.498, 1.888, 2.245)), (41.2, (1, 1.189, 1.498, 2, 2.378))]
        arp = [2, 3, 4, 3, 2, 4, 3, 1]; buf = [0.0] * n; delay = int(beat * 0.75 * s.SR)
        for i in range(n):
            t = i / s.SR; b = t / beat; root, iv = chords[int(b // 4) % 4]
            swell = 0.5 + 0.5 * math.sin(tau * t / (beat * 8))
            pad = sum(math.sin(tau * root * 4 * r * t) + 0.5 * math.sin(tau * root * 4 * r * 1.003 * t) for r in iv) * 0.022 * (0.6 + 0.4 * swell)
            step = int(b * 2) % 8; ph = (b * 2) % 1
            note = math.sin(tau * root * 8 * iv[arp[step]] * t) * math.exp(-ph * 5) * 0.09 if step % 2 == 0 or step == 5 else 0
            buf[i] = pad + note + (buf[i - delay] * 0.38 if i >= delay else 0)
        return pg.mixer.Sound(buffer=array.array("h", (int(max(-1, min(1, x)) * 30000) for x in buf)).tobytes())

    def play(s, name, vol=1.0):
        if s.ok and not s.muted and name in s.snd: s.snd[name].set_volume(vol); s.snd[name].play()
    def music_on(s):
        if s.ok and not s.muted and not s.mchan.get_busy(): s.mchan.play(s.music, loops=-1); s.mchan.set_volume(0.55)
    def engine_vol(s, v):
        if not s.ok or s.muted: return
        if not s.echan.get_busy(): s.echan.play(s.engine, loops=-1)
        s.echan.set_volume(v)
    def toggle(s):
        s.muted = not s.muted
        if not s.ok: return
        if s.muted: pg.mixer.pause(); s.mchan.stop(); s.echan.stop()
        else: pg.mixer.unpause(); s.music_on()


# =============================================================== art
def build_nebula():
    """Soft nebula after the reference (bright violet cloud left, deep indigo right) + stars."""
    rnd = random.Random(5)
    small = pg.Surface((W // 4, H // 4), pg.SRCALPHA); small.fill((*BG, 255))
    blobs = [((40, 70), MID, 60), ((90, 95), SOFT, 38), ((150, 110), DEEP, 70), ((190, 60), MID, 40), ((60, 140), LASER, 34), ((170, 130), SHIP, 50)]
    for (cx, cy), col, r in blobs:
        for k in range(14):
            x, y = cx + rnd.gauss(0, r * 0.5), cy + rnd.gauss(0, r * 0.3)
            rr = rnd.uniform(r * 0.3, r * 0.8)
            s = pg.Surface((int(rr * 2), int(rr * 2)), pg.SRCALPHA); pg.draw.circle(s, (*col, 22), (rr, rr), rr)
            small.blit(s, (x - rr, y - rr))
    neb = pg.transform.smoothscale(pg.transform.smoothscale(small, (W // 8, H // 8)), (W, H))
    for _ in range(260):
        neb.set_at((rnd.randrange(W), rnd.randrange(H)), rnd.choice([SOFT, PALE, LILAC, DEEP]))
    grid = pg.Surface((W, H), pg.SRCALPHA)                               # perspective floor grid for depth
    hz = 470
    for k in range(-14, 15): pg.draw.line(grid, (*GRIDC, 140), (W / 2 + k * 18, hz), (W / 2 + k * 160, H), 1)
    for k in range(1, 12):
        y = hz + (H - hz) * (k / 12) ** 2; pg.draw.line(grid, (*GRIDC, 150), (0, y), (W, y), 1)
    neb.blit(grid, (0, 0))
    return neb

def draw_helmet_thanos(surf, c, r, mood, t):
    """Thanos in an astronaut helmet; mood ∈ calm, focus, alarm, hurt, smug, triumph."""
    x, y = c
    brow = {"calm": 0.2, "focus": 0.6, "alarm": -0.6, "hurt": -0.8, "smug": 0.1, "triumph": 0.0}[mood]
    mouth = {"calm": 0.0, "focus": -0.2, "alarm": -0.7, "hurt": -0.9, "smug": 0.6, "triumph": 1.0}[mood]
    pg.draw.circle(surf, DEEP, c, r)                                                     # helmet shell
    pg.draw.circle(surf, SOFT, c, r, max(2, r // 9))
    fr = r * 0.62; head = pg.Rect(0, 0, fr * 1.25, fr * 1.6); head.center = (x, y + r * 0.05)
    pg.draw.ellipse(surf, LASER, head); pg.draw.ellipse(surf, PORTAL, head, max(1, r // 20))
    for k in (-1, 0, 1): pg.draw.line(surf, MID, (x + k * fr * 0.18, y + fr * 0.45), (x + k * fr * 0.22, y + fr * 0.7), max(1, r // 30))
    bw = fr * 0.38
    for sgn in (-1, 1):
        inner = (x + sgn * fr * 0.08, y - fr * 0.18 + brow * fr * 0.18); outer = (x + sgn * fr * 0.5, y - fr * 0.3 - brow * fr * 0.08)
        pg.draw.line(surf, BG, inner, outer, max(2, r // 14))
        ey = y - fr * 0.06; ew = fr * (0.16 if mood == "alarm" else 0.12)
        if mood == "triumph": pg.draw.arc(surf, WHITE, (x + sgn * fr * 0.28 - ew, ey - ew, ew * 2, ew * 2), 0.3, 2.8, max(1, r // 25))
        else: pg.draw.ellipse(surf, WHITE, (x + sgn * fr * 0.28 - ew, ey - ew * 0.6, ew * 2, ew * (1.6 if mood == "alarm" else 1.1)))
    mw, my = fr * 0.36, y + fr * 0.3
    pts = [(x + k / 6 * mw * 2 - mw, my - mouth * fr * 0.12 * (1 - ((k / 6) * 2 - 1) ** 2)) for k in range(7)]
    pg.draw.lines(surf, BG, False, pts, max(2, r // 16))
    if mood in ("alarm", "hurt") and int(t * 3) % 2: pg.draw.circle(surf, PALE, (x + fr * 0.55, y - fr * 0.5 + (t * 20) % (fr * 0.5)), max(1, r // 18))
    glass = pg.Surface((r * 2, r * 2), pg.SRCALPHA)                                     # visor glass + glints
    pg.draw.circle(glass, (*LILAC, 40), (r, r), int(r * 0.92))
    pg.draw.arc(glass, (*WHITE, 150), (r * 0.25, r * 0.25, r * 1.5, r * 1.5), 1.9, 2.7, max(2, r // 10))
    pg.draw.circle(glass, (*WHITE, 170), (int(r * 0.55), int(r * 0.6)), max(1, r // 12))
    surf.blit(glass, (x - r, y - r))


# =============================================================== HUD
class HUD:
    def __init__(s, fonts): s.f_big, s.f_mid, s.f_sm = fonts
    def text(s, surf, txt, font, col, pos, anchor="center"):
        img = font.render(txt, True, col); r = img.get_rect(**{anchor: pos}); surf.blit(img, r); return r
    def draw(s, surf, glow, g):
        pg.draw.rect(surf, BG, (0, 0, W, TOP - 4)); pg.draw.line(glow, LASER, (0, TOP - 5), (W, TOP - 5), 2)
        s.text(surf, "INDIGO", s.f_mid, PALE, (12, 24), "midleft")
        s.text(surf, "LIVES", s.f_sm, SOFT, (205, 14), "midleft")
        for i in range(LIVES):
            c = PORTAL if i < g.lives else DEEP; cx = 212 + i * 20
            pg.draw.polygon(surf, c, [(cx, 26), (cx + 7, 40), (cx - 7, 40)])
        s.text(surf, "ANCHORS", s.f_sm, SOFT, (285, 14), "midleft")
        for i in range(SHOTS): pg.draw.circle(surf, LILAC if i < g.shots else DEEP, (291 + i * 11, 34), 4)
        sp = g.ship.vel.length(); hd = math.degrees(g.ship.angle) % 360
        s.text(surf, f"SPEED {sp:4.1f}", s.f_sm, PALE if sp <= SAFE_GATE_SPEED else LILAC, (400, 14), "midleft")
        s.text(surf, f"HEADING {hd:5.1f}°", s.f_sm, PALE, (400, 34), "midleft")
        low = g.time_left < 30
        s.text(surf, f"{int(g.time_left // 60)}:{int(g.time_left % 60):02d}", s.f_big if False else s.f_mid, WHITE if low and int(g.t * 4) % 2 else PORTAL, (W // 2 + 145, 26))
        if g.danger > 0:
            pg.draw.circle(surf, LILAC if int(g.t * 6) % 2 else DEEP, (W - 150, 26), 7)
            s.text(surf, "GRAVITY", s.f_sm, LILAC, (W - 138, 26), "midleft")
        s.text(surf, f"ZONE {g.zone}", s.f_sm, SOFT, (W - 12, 26), "midright")
        s.text(surf, g.objective(), s.f_sm, SOFT, (W // 2, TOP + 12))
        s.text(surf, "W thrust · S brake · A/D rotate · SPACE anchor/release · P pause · M mute · R restart · ESC quit", s.f_sm, DEEP if False else MID, (W // 2, H - 10))


# =============================================================== game
class Game:
    def __init__(s, headless=False):
        pg.init()
        s.screen = pg.display.set_mode((W, H)); pg.display.set_caption("INDIGO")
        s.clock = pg.time.Clock()
        name = next((n for n in ("agencyfb", "eurostile", "bahnschrift", "segoeui", "consolas") if pg.font.match_font(n)), None)
        s.f_big, s.f_mid, s.f_sm = pg.font.SysFont(name, 60, bold=True), pg.font.SysFont(name, 28, bold=True), pg.font.SysFont(name, 17)
        s.hud = HUD((s.f_big, s.f_mid, s.f_sm))
        s.bg = build_nebula()
        s.glow = pg.Surface((W, H), pg.SRCALPHA)
        s.portrait = pg.Surface((120, 120), pg.SRCALPHA)
        s.audio = Synth() if not headless else type("Mute", (), {"play": lambda *a, **k: None, "music_on": lambda *a: None, "engine_vol": lambda *a: None, "toggle": lambda *a: None})()
        rnd = random.Random(9)
        s.stars = [[rnd.uniform(0, W), rnd.uniform(TOP, H), rnd.choice((0.15, 0.35, 0.7)), rnd.random() * 6] for _ in range(140)]
        s.state, s.t, s.buttons = "menu", 0.0, {}
        s.controls = {"thrust": False, "reverse": False, "left": False, "right": False}   # tests can drive these
        s.reset()

    def reset(s):
        s.ship = Spaceship(SPAWN)
        s.wells = [GravityWell(*w) for w in WELLS]
        s.nodes = [AnchorNode(n) for n in NODES]
        s.laser, s.gate = LaserObstacle(*LASER_DEF), TargetGate()
        s.walls = [(V(a), V(b)) for a, b in WALLS]
        s.lives, s.shots, s.time_left = LIVES, SHOTS, TIME_LIMIT
        s.projs, s.parts, s.rings, s.trail = [], [], [], []
        s.checkpoint, s.respawn = False, V(SPAWN)
        s.slow, s.shake, s.flash, s.msg, s.msg_t, s.won_t, s.reason = 0.0, 0.0, 0.0, "", 0.0, 0.0, ""
        s.danger, s.mood_t, s.mood_hold, s.zone, s.laser_cd, s.alarm_cd = 0.0, 0.0, "calm", 1, 0.0, 0.0
        s.seen = set()

    # ---------------- helpers
    def say(s, m):
        if m != s.msg or s.msg_t <= 0: s.msg, s.msg_t = m, 2.6
    def mood(s, m, secs=1.4): s.mood_hold, s.mood_t = m, secs
    def burst(s, pos, n, speed, col, life=(20, 50), grav=0.0):
        for _ in range(n):
            a, v = random.uniform(0, math.tau), random.uniform(0.25, 1) * speed
            s.parts.append([V(pos), V(math.cos(a), math.sin(a)) * v, random.uniform(*life), 0.0, col, grav])
    def objective(s):
        return {1: "ZONE 1 · THE DRIFT — learn thrust and inertia, then slip through the gap",
                2: "ZONE 2 · THE SINGULARITY — curve around the well; anchors help you swing",
                3: "ZONE 3 · THE POLARITY FIELD — cross the beam when it is dim, or align your heading with it",
                4: "ZONE 4 · THE INDIGO GATE — slow down (speed ≤ 4.5) and thread the monoliths"}[s.zone]
    def gravity(s, p): return sum((w.accel(p) for w in s.wells), V())
    def all_walls(s): return s.walls + s.gate.walls() + [(V(LEFT, TOP), V(RIGHT, TOP)), (V(RIGHT, TOP), V(RIGHT, BOTTOM)), (V(RIGHT, BOTTOM), V(LEFT, BOTTOM)), (V(LEFT, BOTTOM), V(LEFT, TOP))]

    def predict(s, frames=60):
        """Ballistic preview: current velocity + well gravity (no future input)."""
        p, v, pts = V(s.ship.pos), V(s.ship.vel), []
        for f in range(frames):
            v += s.gravity(p); p += v
            if f % 3 == 0: pts.append(V(p))
        return pts

    def lose_life(s, cause, respawn):
        s.lives -= 1; s.shake, s.flash, s.slow = 16, 0.6, 1.0
        s.burst(s.ship.pos, 80, 7, PALE); s.burst(s.ship.pos, 40, 3, PORTAL); s.rings.append([V(s.ship.pos), 0.0, 50])
        s.audio.play("boom"); s.mood("hurt", 2.0)
        if s.lives <= 0: s.state, s.reason = "over", cause; return
        s.say(f"{cause} · {s.lives} LIVES LEFT")
        if respawn: s.ship.reset(s.respawn); s.ship.angle = 0.0
        else: s.ship.inv = 1.5

    # ---------------- actions
    def fire(s):
        sh = s.ship
        if sh.tether is not None:
            sh.tether = None; s.say("TETHER RELEASED"); s.audio.play("click"); return
        if s.shots <= 0: s.audio.play("empty"); s.say("NO ANCHORS LEFT"); return
        s.shots -= 1
        s.projs.append(Projectile(sh.nose(), sh.heading * 9 + sh.vel * 0.5))
        s.burst(sh.nose(), 12, 3, LILAC, (6, 14)); s.shake = max(s.shake, 3); s.audio.play("gun")

    # ---------------- simulation (fixed 60 Hz step)
    def step(s, dt):
        s.t += dt
        for st in s.stars: st[0] = (st[0] - st[2] * (0.6 + s.ship.vel.x * 0.08)) % W
        if s.state not in ("play", "won"): return
        ts = 0.3 if s.slow > 0 else 1.0
        s.slow = max(0, s.slow - dt); s.shake *= 0.86; s.flash = max(0, s.flash - dt * 1.4); s.msg_t -= dt; s.mood_t -= dt
        for p in s.parts: p[1].y += p[5] * ts; p[0] += p[1] * ts; p[1] *= 0.97 ** ts; p[3] += ts
        s.parts = [p for p in s.parts if p[3] < p[2]]
        for r in s.rings: r[1] += ts
        s.rings = [r for r in s.rings if r[1] < r[2]]
        if s.state == "won":
            s.won_t += dt; s.ship.pos += (V(GATE_X + 60, GATE_Y) - s.ship.pos) * 0.04
            if random.random() < 0.6: s.burst(V(GATE_X + 60, GATE_Y), 4, 4, random.choice([PORTAL, PALE, LILAC]))
            return
        s.time_left -= dt * ts
        if s.time_left <= 0: s.time_left = 0; s.state, s.reason = "over", "TIME EXPIRED — THE ANOMALY COLLAPSED"; s.audio.play("boom"); return
        sh, c = s.ship, s.controls
        s.laser.t += dt * ts; s.gate.t += dt * ts; s.laser_cd = max(0, s.laser_cd - dt); s.alarm_cd = max(0, s.alarm_cd - dt)
        sh.inv = max(0, sh.inv - dt)
        # rotation + thrust (Newtonian: velocity persists)
        sh.angle += (c["right"] - c["left"]) * Spaceship.TURN * ts
        acc = s.gravity(sh.pos)
        if c["thrust"]: acc += sh.heading * Spaceship.THRUST
        if c["reverse"]: acc -= sh.heading * Spaceship.REVERSE
        sh.thrusting = c["thrust"]
        sh.vel += acc * ts
        if sh.vel.length() > Spaceship.VMAX: sh.vel.scale_to_length(Spaceship.VMAX)
        prev = V(sh.pos); sh.pos += sh.vel * ts
        if sh.tether is not None:                                     # inextensible tether: swing around the node
            n = s.nodes[sh.tether]; d = sh.pos - n.pos
            if d.length() > sh.tlen:
                u = d.normalize(); sh.pos = n.pos + u * sh.tlen
                vr = sh.vel.dot(u)
                if vr > 0: sh.vel -= u * vr                              # keep only tangential momentum
        if c["thrust"] and random.random() < 0.9:
            s.trail.append([sh.pos - sh.heading * 12, -sh.heading * 2.5 + V(random.uniform(-.6, .6), random.uniform(-.6, .6)), 0.0])
        for tr in s.trail: tr[0] += tr[1] * ts; tr[2] += ts
        s.trail = [tr for tr in s.trail if tr[2] < 26]
        s.audio.engine_vol(0.35 if c["thrust"] else 0.0)
        # wells
        s.danger = 0.0
        for w in s.wells:
            dist = sh.pos.distance_to(w.pos)
            if dist < w.ring: s.danger = max(s.danger, 1 - dist / w.ring)
            if dist < w.core + Spaceship.R and sh.inv <= 0:
                s.lose_life("CONSUMED BY THE SINGULARITY", True); return
        if s.danger > 0:
            if "well" not in s.seen or s.alarm_cd <= 0: s.say("GRAVITY WELL DETECTED")
            s.seen.add("well")
            if s.alarm_cd <= 0: s.audio.play("alarm", 0.5); s.alarm_cd = 1.6
        # walls: v_new = v − 2(v·n)n with slight energy loss
        for a, b in s.all_walls():
            q = seg_closest(sh.pos, a, b); d = sh.pos - q; dist = d.length()
            if dist < Spaceship.R + 3 and dist > 1e-6:
                n = d / dist; vn = sh.vel.dot(n)
                if vn < 0:
                    impact = -vn; sh.vel = reflect(sh.vel, n, 0.85); sh.pos = q + n * (Spaceship.R + 3)
                    s.burst(q, 10, 3, PALE, (8, 18)); s.audio.play("ricochet", min(1, impact / 4)); s.shake = max(s.shake, impact)
                    if impact > 5.2 and sh.inv <= 0: s.lose_life("HULL BREACH", False); return
        # laser: crossing an active beam needs a heading within ±15°
        a, b = s.laser.ends()
        if segs_cross(prev, sh.pos, a, b) and s.laser.active and s.laser_cd <= 0:
            if s.laser.aligned(sh.angle): s.say("POLARITY ALIGNED — PHASED THROUGH"); s.audio.play("chime", 0.4); s.laser_cd = 0.5
            else:
                bn = V(-math.sin(s.laser.angle), math.cos(s.laser.angle))
                sh.vel = reflect(sh.vel, bn, 0.9); sh.pos = prev; s.laser_cd = 1.5; s.audio.play("zap")
                s.burst(sh.pos, 30, 5, LASER)
                if sh.inv <= 0: s.lose_life("POLARITY BURN", False)
                if s.state != "play": return
        if not s.laser.active and 520 < sh.pos.x < 700 and s.zone == 3: s.say("POLARITY WINDOW OPEN")
        # gate: through the opening slowly → victory
        top, bot = s.gate.rects()
        if prev.x <= GATE_X + GATE_W < sh.pos.x or (sh.pos.x > GATE_X + GATE_W and prev.x <= GATE_X + GATE_W):
            if top.bottom < sh.pos.y < bot.top:
                if sh.vel.length() <= SAFE_GATE_SPEED: s.win(); return
                sh.vel = reflect(sh.vel, V(-1, 0), 0.6); sh.pos.x = GATE_X - Spaceship.R - 4; s.say("APPROACH TOO FAST — BRAKE WITH S")
                s.audio.play("ricochet")
        # projectiles → nodes
        for p in s.projs:
            p.vel += s.gravity(p.pos) * ts; p.pos += p.vel * ts; p.life -= ts
            p.trail.append(V(p.pos)); p.trail = p.trail[-10:]
            for i, n in enumerate(s.nodes):
                if p.pos.distance_to(n.pos) < 16:
                    sh.tether, sh.tlen, p.life = i, max(40.0, sh.pos.distance_to(n.pos)), 0
                    s.say("ANCHOR ATTACHED — SPACE TO RELEASE"); s.audio.play("strike"); s.slow = max(s.slow, 0.25)
                    s.burst(n.pos, 24, 4, PORTAL); s.rings.append([V(n.pos), 0.0, 24]); s.mood("smug")
                    break
            if any(seg_closest(p.pos, a_, b_).distance_to(p.pos) < 4 for a_, b_ in s.walls): p.life = 0; s.burst(p.pos, 8, 2, SOFT)
        s.projs = [p for p in s.projs if p.life > 0]
        # zones, checkpoint
        x = sh.pos.x
        s.zone = 1 if x < 262 else 2 if x < CHECKPOINT_X else 3 if x < 730 else 4
        if not s.checkpoint and x > CHECKPOINT_X + 8:
            s.checkpoint, s.respawn = True, V(CHECKPOINT_SPAWN); s.shots = max(s.shots, 4)
            s.say("CHECKPOINT REACHED"); s.audio.play("chime"); s.rings.append([V(sh.pos), 0.0, 30]); s.mood("smug")
        if s.zone == 4 and "gate" not in s.seen: s.seen.add("gate"); s.say("INDIGO GATE APPROACHING")
        if not (LEFT - 60 < sh.pos.x < RIGHT + 60 and TOP - 60 < sh.pos.y < BOTTOM + 60): s.state, s.reason = "over", "LOST IN THE VOID"

    def win(s):
        s.state, s.won_t, s.slow, s.flash, s.shake = "won", 0.0, 1.8, 1.0, 10
        s.ship.tether = None; s.audio.play("warp"); s.audio.engine_vol(0)
        s.burst(V(GATE_X + 50, GATE_Y), 140, 9, PORTAL); s.rings += [[V(GATE_X + 50, GATE_Y), 0.0, 70], [V(GATE_X + 50, GATE_Y), -12.0, 70]]
        s.mood("triumph", 99)

    def current_mood(s):
        if s.state == "won": return "triumph"
        if s.state == "over": return "hurt"
        if s.mood_t > 0: return s.mood_hold
        if s.danger > 0.25: return "alarm"
        if s.controls["thrust"]: return "focus"
        return "calm"

    # ---------------- drawing
    def draw(s):
        sc, g = s.screen, s.glow
        s.buttons = {}; g.fill((0, 0, 0, 0))
        sc.blit(s.bg, (0, 0))
        for x, y, sp, ph in s.stars:
            k = 0.5 + 0.5 * math.sin(s.t * 2 + ph)
            pg.draw.circle(sc, PALE if sp > 0.5 else SOFT, (int(x), int(y)), 1 if sp < 0.5 else 2) if k > 0.3 else None
        for w in s.wells:                                             # gravity wells: concentric glowing rings
            for k in range(5):
                rr = w.ring * (1 - k * 0.17) + 3 * math.sin(s.t * 2 + k)
                pg.draw.circle(g, (*LASER, 40 + k * 30), w.pos, int(rr), 1)
            pg.draw.circle(sc, WELL, w.pos, w.core); pg.draw.circle(g, PORTAL, w.pos, w.core, 2)
            for k in range(3):
                ang = s.t * (1.5 + k) + k * 2; pg.draw.arc(g, LILAC, (w.pos.x - w.core - 6 - k * 4, w.pos.y - w.core - 6 - k * 4, (w.core + 6 + k * 4) * 2, (w.core + 6 + k * 4) * 2), ang, ang + 1.2, 1)
        for a, b in s.walls: pg.draw.line(sc, STRUCT, a, b, 10); pg.draw.line(g, SOFT, a, b, 2)
        for i, n in enumerate(s.nodes):                               # anchor nodes: rotating diamonds
            r = 9 + 2 * math.sin(s.t * 3 + n.pulse); pts = [n.pos + V(r, 0).rotate_rad(s.t + k * math.pi / 2) for k in range(4)]
            pg.draw.polygon(sc, DEEP, pts); pg.draw.polygon(g, PORTAL if s.ship.tether == i else LILAC, pts, 2)
        a, b = s.laser.ends()                                         # laser: bright when active, dashed when safe
        pg.draw.circle(g, PALE, s.laser.pivot, 6)
        if s.laser.active:
            pg.draw.line(sc, LASER, a, b, 5); pg.draw.line(g, WHITE, a, b, 2); pg.draw.line(g, PORTAL, a, b, 7)
        else:
            d = (b - a); n_ = int(d.length() // 14)
            for k in range(0, n_, 2): pg.draw.line(g, (*SOFT, 120), a + d * (k / n_), a + d * ((k + 1) / n_), 2)
        s.hud.text(sc, f"{'ACTIVE' if s.laser.active else 'SAFE'} {s.laser.phase_left:3.1f}s", s.f_sm, PALE if not s.laser.active else LILAC, (s.laser.pivot.x, s.laser.pivot.y - s.laser.half - 18))
        for r in s.gate.rects():                                      # monoliths + portal
            pg.draw.rect(sc, STRUCT, r); pg.draw.rect(g, PORTAL, r, 2)
            for yy in range(r.top + 10, r.bottom - 6, 18): pg.draw.line(g, (*LASER, 120), (r.left + 8, yy), (r.right - 8, yy), 1)
        top, bot = s.gate.rects()
        for k in range(4):
            rr = pg.Rect(0, 0, 20 + k * 10, (bot.top - top.bottom) * (1 - k * 0.15)); rr.center = (GATE_X + GATE_W + 22, GATE_Y)
            pg.draw.ellipse(g, (*PORTAL, 160 - k * 30), rr, 2)
        s.hud.text(sc, "INDIGO GATE", s.f_sm, PALE, (GATE_X + GATE_W // 2, TOP + 14))
        if s.state == "play":
            for i, p in enumerate(s.predict()): pg.draw.circle(g, (*LASER, max(40, 230 - i * 10)), p, 2)
        sh = s.ship
        if sh.tether is not None: pg.draw.line(g, PORTAL, s.nodes[sh.tether].pos, sh.pos, 2); pg.draw.line(sc, MID, s.nodes[sh.tether].pos, sh.pos, 1)
        for p in s.projs:
            for i in range(1, len(p.trail)): pg.draw.line(g, LILAC, p.trail[i - 1], p.trail[i], 2)
            pg.draw.circle(sc, WHITE, p.pos, 3)
        for tr in s.trail: k = 1 - tr[2] / 26; pg.draw.circle(g, (*LILAC, int(200 * k)), tr[0], max(1, int(5 * k)))
        if s.state != "won" or s.won_t < 1.2:
            if not (sh.inv > 0 and int(s.t * 12) % 2):
                hd = sh.heading; side = V(-hd.y, hd.x)
                pts = [sh.pos + hd * 16, sh.pos - hd * 11 + side * 10, sh.pos - hd * 6, sh.pos - hd * 11 - side * 10]
                pg.draw.polygon(sc, SHIP, pts); pg.draw.polygon(g, PALE, pts, 2)
                draw_helmet_thanos(sc, (int(sh.pos.x + hd.x * 2), int(sh.pos.y + hd.y * 2)), 6, s.current_mood(), s.t)
        for p in s.parts: k = 1 - p[3] / p[2]; pg.draw.circle(g, p[4], p[0], max(1, 3 * k))
        for r in s.rings:
            if r[1] > 0: k = r[1] / r[2]; pg.draw.circle(g, PALE, r[0], int(8 + 120 * k), max(1, int(5 * (1 - k))))
        if s.state not in ("menu", "rules"):
            s.hud.draw(sc, g, s)
            s.portrait.fill((0, 0, 0, 0)); pg.draw.circle(s.portrait, BG, (60, 60), 60)
            draw_helmet_thanos(s.portrait, (60, 60), 54, s.current_mood(), s.t)
            near = s.ship.pos.distance_to((70, H - 88)) < 150                     # fade the portrait when the ship flies behind it
            s.portrait.set_alpha(56 if near else 255); sc.blit(s.portrait, (10, H - 148))
            if not near: pg.draw.circle(g, LASER, (70, H - 88), 62, 2)
            s.hud.text(sc, s.current_mood().upper(), s.f_sm, PALE, (70, H - 18))
            if s.msg_t > 0: s.hud.text(sc, s.msg, s.f_mid, PALE, (W // 2, 96))
        # menus / end screens
        def overlay(a=170): o = pg.Surface((W, H), pg.SRCALPHA); o.fill((*BG, a)); sc.blit(o, (0, 0))
        def button(key, label, cy, w_=260):
            r = pg.Rect(0, 0, w_, 48); r.center = (W // 2, cy); hov = r.collidepoint(pg.mouse.get_pos())
            pg.draw.rect(sc, MID if hov else DEEP, r, border_radius=24); pg.draw.rect(g, PALE if hov else PORTAL, r, 2, border_radius=24)
            s.hud.text(sc, label, s.f_mid, WHITE if hov else PALE, r.center); s.buttons[key] = r
        if s.state == "menu":
            overlay(120)
            s.hud.text(sc, "INDIGO", s.f_big, WHITE, (W // 2, 180))
            s.hud.text(g, "INDIGO", s.f_big, PORTAL, (W // 2, 180))
            s.hud.text(sc, "Thanos must pilot through the Indigo Dimension to the gate.", s.f_sm, PALE, (W // 2, 268))
            button("start", "START  (ENTER / SPACE)", 340, 320); button("rules", "RULES", 400); button("exit", "EXIT", 460)
            draw_helmet_thanos(sc, (W // 2 + 270, 190), 60, "focus", s.t)
        elif s.state == "rules":
            overlay(200)
            s.hud.text(sc, "RULES", s.f_big, WHITE, (W // 2, 80)); s.hud.text(sc, "PLACEHOLDER — FINAL RULES TO BE ATTACHED", s.f_sm, LILAC, (W // 2, 122))
            lines = ["Fly through four zones and enter the Indigo Gate between the two monoliths.",
                     "W thrusts forward; momentum stays when you let go. S brakes. A/D rotate.",
                     "Gravity wells pull with an inverse-square force; touching a core costs a life.",
                     "SPACE fires an anchor (8 total). Hit a node to swing on a tether; SPACE releases.",
                     "Cross the laser when it is dim (safe), or align your heading with it (±15°).",
                     "Walls reflect you (v' = v − 2(v·n)n). Very hard impacts damage the hull.",
                     "Enter the gate at speed 4.5 or less. 3 lives, 5 minutes. A checkpoint follows Zone 2.",
                     "Run out of lives or time and the level restarts from the beginning."]
            for i, l in enumerate(lines): s.hud.text(sc, l, s.f_sm, PALE, (W // 2, 175 + i * 34))
            button("back", "BACK", 470 + 120)
        elif s.state == "pause":
            overlay(); s.hud.text(sc, "PAUSED", s.f_big, WHITE, (W // 2, 220)); button("resume", "RESUME", 320); button("menu", "MAIN MENU", 380); button("exit", "EXIT", 440)
        elif s.state == "over":
            overlay(215); s.hud.text(sc, "SIGNAL LOST", s.f_big, WHITE, (W // 2, 220)); s.hud.text(g, "SIGNAL LOST", s.f_big, LASER, (W // 2, 220))
            s.hud.text(sc, s.reason, s.f_mid, LILAC, (W // 2, 285)); s.hud.text(sc, "PRESS R TO RETRY", s.f_mid, PALE, (W // 2, 340))
            button("restart", "RETRY (R)", 410); button("menu", "MAIN MENU", 470)
        elif s.state == "won" and s.won_t > 1.4:
            overlay(150)
            s.hud.text(sc, "PHASE DOOR UNLOCKED", s.f_big, WHITE, (W // 2, 210)); s.hud.text(g, "PHASE DOOR UNLOCKED", s.f_big, PORTAL, (W // 2, 210))
            s.hud.text(sc, "TRANSITIONING TO LEVEL: BLUE", s.f_mid, LILAC, (W // 2, 275))
            s.hud.text(sc, f"Lives {s.lives} · Anchors {s.shots} · Time {int(s.time_left // 60)}:{int(s.time_left % 60):02d}", s.f_sm, PALE, (W // 2, 318))
            s.hud.text(sc, "PRESS R TO REPLAY INDIGO", s.f_mid, PALE, (W // 2, 360))
            button("restart", "REPLAY (R)", 430); button("menu", "MAIN MENU", 490)
        # bloom + flash + shake
        small = pg.transform.smoothscale(pg.transform.smoothscale(g, (W // 6, H // 6)), (W // 12, H // 12))
        big = pg.transform.smoothscale(small, (W, H))
        sc.blit(big, (0, 0), special_flags=pg.BLEND_RGB_ADD); sc.blit(big, (0, 0), special_flags=pg.BLEND_RGB_ADD); sc.blit(g, (0, 0))
        if s.flash > 0: o = pg.Surface((W, H)); o.fill(PALE); o.set_alpha(int(170 * s.flash)); sc.blit(o, (0, 0))
        if s.slow > 0 and s.state == "play": s.hud.text(sc, "SLOW-MO", s.f_sm, LILAC, (W - 12, TOP + 14), "midright")
        if s.shake > 0.6: sc.scroll(int(random.uniform(-1, 1) * s.shake), int(random.uniform(-1, 1) * s.shake))
        pg.display.flip()

    # ---------------- loop
    def action(s, k):
        s.audio.play("click")
        if k in ("start", "restart"): s.reset(); s.state = "play"; s.audio.music_on(); s.say("GRAVITY WELLS AHEAD · FIND THE INDIGO GATE")
        elif k == "rules": s.state = "rules"
        elif k == "back": s.state = "menu"
        elif k == "resume": s.state = "play"
        elif k == "menu": s.reset(); s.state = "menu"; s.audio.engine_vol(0)
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
                    elif e.key == pg.K_r and s.state in ("play", "over", "won", "pause"): s.action("restart")
                    elif e.key == pg.K_p and s.state in ("play", "pause"): s.state = "pause" if s.state == "play" else "play"
                    elif e.key in (pg.K_RETURN, pg.K_SPACE) and s.state == "menu": s.action("start")
                    elif e.key == pg.K_SPACE and s.state == "play": s.fire()
                elif e.type == pg.MOUSEBUTTONDOWN and e.button == 1:
                    for k, r in list(s.buttons.items()):
                        if r.collidepoint(e.pos): s.action(k); break
            keys = pg.key.get_pressed()
            s.controls.update(thrust=keys[pg.K_w] or keys[pg.K_UP], reverse=keys[pg.K_s] or keys[pg.K_DOWN],
                              left=keys[pg.K_a] or keys[pg.K_LEFT], right=keys[pg.K_d] or keys[pg.K_RIGHT])
            while acc >= 1 / FPS:
                if s.state != "pause": s.step(1 / FPS)
                acc -= 1 / FPS
            s.draw()
        pg.quit()


if __name__ == "__main__":
    Game().run()
    sys.exit()
