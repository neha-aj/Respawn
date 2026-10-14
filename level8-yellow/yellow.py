"""
YELLOW
A 2D side-view fighting game in yellow pixel art. Thanos fights Wolverine (claws out) in a
golden throne room. Beat it, smash the barrier, and walk through the Phase Door.

Standalone: Python 3 + pygame only (python -m pip install pygame). Every pixel, sound and the music are
generated in code. Yellow shades only.
Controls: A/D or LEFT/RIGHT move · W/UP jump · J light (Gauntlet) · K heavy (double-bladed sword)
          SHIFT dodge · hold L Solar charge · I Solar Flash · ESC pause · R restart · M mute · C controls card
"""
import array, math, random, sys, threading
import pygame as pg

# ------------------------------------------------------------------ screen + timing
W, H, FPS, SCALE = 900, 650, 60, 2
LW, LH = W // SCALE, H // SCALE                  # 450 × 325 pixel-art canvas, scaled ×2 with hard pixels
GROUND = 262                                     # feet line on the canvas
ARENA_L, ARENA_R, ARENA_R_OPEN = 22, 388, 446
ROUND_TIME = 99 * FPS                            # classic round timer (frames); running out is a loss
MAX_PARTICLES = 240
FIG = 2                                          # fighters are drawn on a half-resolution layer and doubled: chunky pixel art

# ------------------------------------------------------------------ strict yellow palette
BG, FLOOR, PLAYER, MONK, FX, ENERGY, DOOR = (77, 61, 0), (128, 102, 0), (255, 255, 0), (153, 128, 0), (255, 255, 204), (255, 234, 0), (255, 254, 224)
INK, DEEP, DARK, MUTED, GOLD, GOLD_HI = (20, 16, 0), (38, 30, 0), (56, 45, 0), (102, 82, 0), (179, 149, 0), (217, 181, 0)
SKIN, SKIN_SH, CREAM, AMBER, OLIVE, TAN = (235, 210, 0), (190, 165, 0), (255, 250, 200), (235, 200, 20), (120, 100, 10), (214, 186, 70)

# ------------------------------------------------------------------ movement (canvas px per frame at 60 Hz)
WALK, ACCEL, FRICTION = 2.7, 0.55, 0.72
JUMP_V, GRAVITY = -8.4, 0.38                    # jump height = v² / 2g ≈ 93 px (186 on screen)
ENEMY_WALK = 1.9

# ------------------------------------------------------------------ combat frame data (frames, damage, knockback px/frame)
PLAYER_HP, ENEMY_HP = 100, 140
PLAYER_MOVES = {
    "light": dict(startup=5, active=4, recovery=9, dmg=6, kb=3.0, stun=14, box=(12, 68, -100, -56), hitstop=4, shake=2),
    "heavy": dict(startup=16, active=6, recovery=24, dmg=15, kb=6.0, stun=22, box=(0, 96, -128, -24), hitstop=7, shake=5),
}
ENEMY_MOVES = {
    "light": dict(startup=10, active=5, recovery=18, dmg=7, kb=3.5, stun=16, box=(12, 80, -84, -44), hitstop=4, shake=2),
    "heavy": dict(startup=30, active=7, recovery=34, dmg=16, kb=7.0, stun=24, box=(0, 108, -60, -4), hitstop=7, shake=5),
}
PLAYER_INVULN, ENEMY_INVULN = 40, 8              # frames of damage immunity after being hit
DODGE_FRAMES, DODGE_SPEED, DODGE_IFRAMES, DODGE_LOCK, DODGE_COOLDOWN = 16, 7.0, (1, 12), 8, 55
CHARGE_RATE = 0.8                                # energy per frame while holding L (≈ 2.1 s to full)
BRACE_FRAMES, WAVE_SPEED, WAVE_RANGE = 20, 6.5, 230
FLASH_STUN, FLASH_DMG = 90, 8                    # exactly 90 frames of stun; never lethal
ENEMY_ATTACK_GAP = 40                            # minimum frames between enemy attacks

# ------------------------------------------------------------------ ending timings (frames)
DEFEAT_T, BARRIER_T, CRACK_T, REVEAL_T, VICTORY_FLASH = 90, 120, 60, 100, 40
PORTAL_X, PORTAL_HALF = 421, 13

INTRO_LINES = ["Claws of metal, little mutant. Mine are made of stone.", "FIGHT!"]

# ------------------------------------------------------------------ rules page + controls card (shared wording with the web build)
RULES = [
    ("GOAL", ["You are THANOS. Knock out WOLVERINE before the 99-second clock hits 0."]),
    ("WIN / LOSE", ["Empty his health bar (top right) to win.",
                    "You lose if your health bar (top left) empties or time runs out."]),
    ("FIGHTING", ["J is a fast jab. K is a slow sword swing that hits much harder.",
                  "His claws GLOW before a big lunge - DODGE (SHIFT) or JUMP to avoid it."]),
    ("SOLAR FLASH", ["Hold L to fill the SOLAR meter. You can't move, and any hit cancels it.",
                     "At 100% press I: a shockwave that stuns him for 1.5 s. Punish him!"]),
    ("THE EXIT", ["After the K.O. the barrier shatters. Walk right into the Phase Door."]),
]
CONTROLS = [
    ("A / D  or  LEFT / RIGHT", "Move"),
    ("W  or  UP", "Jump"),
    ("J", "Light attack - Gauntlet jab"),
    ("K", "Heavy attack - sword swing"),
    ("SHIFT", "Dodge (short cooldown)"),
    ("hold L", "Charge the Solar meter"),
    ("I", "Solar Flash (meter at 100%)"),
    ("ESC", "Pause"),
    ("C", "Show / hide this controls card"),
    ("M", "Mute"),
    ("R", "Restart (paused or after a round)"),
]


# =================================================================== pose rig
P0 = dict(lean=0.05, fs=0.5, fe=0.9, bs=0.25, be=0.7, fh=0.22, fk=0.15, bh=-0.22, bk=0.25, dy=0.0)


def pose(**k):
    p = dict(P0); p.update(k); return p


PLAYER_POSES = {
    "idle": pose(),
    "jump": pose(lean=0.1, fs=1.1, fe=1.2, bs=0.9, be=1.0, fh=0.8, fk=1.3, bh=0.2, bk=1.1),
    "light_start": pose(lean=-0.05, fs=1.0, fe=1.9, bs=0.4, be=1.0),
    "light_hit": pose(lean=0.18, fs=1.57, fe=0.0, bs=0.1, be=0.8, fh=0.45, fk=0.3),
    "heavy_start": pose(lean=-0.18, fs=2.9, fe=0.3, bs=2.4, be=0.6, fh=0.3, bh=-0.4, dy=1),
    "heavy_hit": pose(lean=0.3, fs=1.25, fe=0.05, bs=1.0, be=0.3, fh=0.6, fk=0.5, bh=-0.5, dy=3),
    "dodge": pose(lean=0.55, fs=-0.5, fe=0.6, bs=-0.6, be=0.6, fh=0.6, fk=0.8, bh=-0.7, bk=0.4, dy=3),
    "charge": pose(lean=0.0, fs=0.9, fe=1.5, bs=0.9, be=1.5, fh=0.45, fk=0.6, bh=-0.45, bk=0.6, dy=4),
    "brace": pose(lean=-0.1, fs=2.0, fe=0.0, bs=2.0, be=0.0, fh=0.45, fk=0.4, bh=-0.45, bk=0.4, dy=2),
    "hurt": pose(lean=-0.35, fs=0.3, fe=0.3, bs=0.2, be=0.3, fh=-0.1, bh=-0.4),
    "defeat": pose(lean=-1.25, fs=0.1, fe=0.1, bs=0.0, be=0.1, fh=1.2, fk=1.9, bh=1.0, bk=1.9, dy=16),
    "victory": pose(lean=-0.05, fs=2.7, fe=0.2, bs=0.6, be=1.4),
}
ENEMY_POSES = {                                   # Wolverine: low, wide, claws-out crouch (after the reference)
    "idle": pose(lean=0.3, fs=1.25, fe=0.45, bs=1.0, be=0.6, fh=0.7, fk=0.7, bh=-0.65, bk=0.35, dy=5),
    "jump": pose(lean=0.2, fs=1.4, fe=0.8, bs=1.0, be=1.0, fh=0.9, fk=1.4, bh=0.3, bk=1.2),
    "light_start": pose(lean=0.1, fs=0.6, fe=1.6, bs=0.4, be=1.4, fh=0.2, bh=-0.4, dy=3),
    "light_hit": pose(lean=0.35, fs=1.57, fe=0.0, bs=1.3, be=0.2, fh=0.6, fk=0.4, bh=-0.5, dy=4),
    "heavy_start": pose(lean=-0.3, fs=2.6, fe=0.4, bs=2.2, be=0.5, fh=0.2, fk=0.6, bh=-0.5, bk=0.6, dy=6),
    "heavy_hit": pose(lean=0.55, fs=0.9, fe=0.0, bs=0.7, be=0.2, fh=0.9, fk=1.1, bh=-0.7, bk=0.3, dy=10),
    "hurt": pose(lean=-0.4, fs=0.4, fe=0.4, bs=0.2, be=0.4, fh=-0.1, bh=-0.4, dy=2),
    "stun": pose(lean=0.6, fs=0.1, fe=0.2, bs=0.05, be=0.2, fh=0.3, fk=0.7, bh=-0.2, bk=0.7, dy=7),
    "defeat": pose(lean=1.35, fs=0.1, fe=0.0, bs=0.0, be=0.0, fh=1.3, fk=1.9, bh=1.1, bk=1.9, dy=18),
}


def lerp_pose(cur, tgt, k):
    for key in cur: cur[key] += (tgt[key] - cur[key]) * k


# =================================================================== fighters
class Fighter:
    """Shared side-view body: physics, facing, hurtbox, hit-stun, invulnerability and the attack state machine."""
    HW, HT = 22, 116
    MOVES = PLAYER_MOVES

    def __init__(s, x, facing, hp):
        s.start = (x, facing, hp); s.reset()

    def reset(s):
        x, facing, hp = s.start
        s.x, s.y, s.vx, s.vy, s.facing, s.on_ground = float(x), float(GROUND), 0.0, 0.0, facing, True
        s.hp = s.shown_hp = s.trail_hp = float(hp); s.max_hp = hp
        s.state, s.move, s.mt, s.hit_done = "idle", None, 0, False
        s.hitstun = s.invuln = s.stun = 0
        s.walk_phase = 0.0
        s.cur = dict(s.poses["idle"]); s.anim = "idle"
        s.flash_t = 0

    # --- geometry
    def hurtbox(s): return pg.Rect(int(s.x - s.HW), int(s.y - s.HT), s.HW * 2, s.HT)
    def centre(s): return (s.x, s.y - s.HT / 2)
    def attack_phase(s):
        if not s.move: return None
        m = s.MOVES[s.move]
        if s.mt < m["startup"]: return "startup"
        if s.mt < m["startup"] + m["active"]: return "active"
        return "recovery"
    def hitbox(s):
        """Directional hitbox in front of the fighter, only during the active frames."""
        if s.attack_phase() != "active": return None
        x0, x1, y0, y1 = s.MOVES[s.move]["box"]
        if s.facing > 0: return pg.Rect(int(s.x + x0), int(s.y + y0), x1 - x0, y1 - y0)
        return pg.Rect(int(s.x - x1), int(s.y + y0), x1 - x0, y1 - y0)

    def begin_attack(s, name):
        s.move, s.mt, s.hit_done, s.state = name, 0, False, "attack"
    def actionable(s):
        return s.state in ("idle", "walk", "jump") and s.hitstun <= 0 and s.stun <= 0

    def take_hit(s, dmg, kb_dir, kb, stun_frames, invuln, lethal=True):
        s.hp = max(0.0 if lethal else 1.0, s.hp - dmg)
        s.vx, s.invuln = kb_dir * kb, invuln
        if s.stun > 0: return                      # a stunned fighter stays stunned (the 90 frames are not reset)
        s.hitstun, s.state, s.move = stun_frames, "hurt", None

    def physics(s, lo, hi):
        if not s.on_ground: s.vy += GRAVITY
        s.x += s.vx; s.y += s.vy
        if s.y >= GROUND: s.y, s.vy, s.on_ground = float(GROUND), 0.0, True
        else: s.on_ground = False
        s.x = min(max(s.x, lo + s.HW), hi - s.HW)

    def tick_timers(s):
        s.invuln = max(0, s.invuln - 1)
        s.shown_hp += (s.hp - s.shown_hp) * 0.35
        if s.trail_hp > s.shown_hp: s.trail_hp = max(s.shown_hp, s.trail_hp - 0.6)
        s.flash_t = max(0, s.flash_t - 1)


class Player(Fighter):
    """Thanos: Gauntlet jab, double-bladed sword, dodge, Solar charge and Solar Flash."""
    HW, HT = 22, 116
    MOVES = PLAYER_MOVES
    poses = PLAYER_POSES

    def reset(s):
        super().reset()
        s.energy, s.dodge_t, s.dodge_cd, s.dodge_dir, s.brace_t = 0.0, 0, 0, 1, 0
        s.afterimages = []

    @property
    def dodge_invuln(s):
        return s.state == "dodge" and DODGE_IFRAMES[0] <= DODGE_FRAMES - s.dodge_t <= DODGE_IFRAMES[1]
    def invulnerable(s): return s.invuln > 0 or s.dodge_invuln

    def update(s, inp, other, bounds, game):
        """inp: dict of held (left, right, charge) and pressed (jump, light, heavy, dodge, flash) for this frame."""
        s.tick_timers(); s.dodge_cd = max(0, s.dodge_cd - 1)
        if s.hitstun > 0:
            s.hitstun -= 1; s.vx *= 0.82
            if s.hitstun == 0: s.state = "idle"
        elif s.state == "dodge":
            s.dodge_t -= 1
            s.vx = s.dodge_dir * DODGE_SPEED * (0.4 + 0.6 * s.dodge_t / DODGE_FRAMES)
            if s.dodge_t % 2 == 0: s.afterimages.append([s.x, s.y, s.facing, dict(s.cur), 14])
            if DODGE_FRAMES - s.dodge_t >= DODGE_LOCK + 2 and (inp["light"] or inp["heavy"]):   # cancel late in the dodge
                s.state = "idle"; s.vx *= 0.3
            elif s.dodge_t <= 0: s.state = "idle"; s.vx *= 0.3
        elif s.state == "brace":
            s.brace_t -= 1; s.vx = 0
            if s.brace_t <= 0: s.state = "idle"; game.launch_wave(s)
        elif s.state == "attack":
            s.mt += 1; m = s.MOVES[s.move]
            if s.on_ground: s.vx *= 0.7
            if s.mt == m["startup"]: game.on_swing(s)
            if s.mt >= m["startup"] + m["active"] + m["recovery"]: s.move, s.state = None, "idle"
        elif s.state == "charge":
            s.vx = 0
            if not inp["charge"] or not s.on_ground: s.state = "idle"
            else: s.energy = min(100.0, s.energy + CHARGE_RATE)
        if s.actionable():
            want = (1 if inp["right"] else 0) - (1 if inp["left"] else 0)
            if inp["flash"] and s.energy >= 100 and s.on_ground:
                s.energy, s.state, s.brace_t = 0.0, "brace", BRACE_FRAMES; game.on_brace(s)
            elif inp["dodge"] and s.dodge_cd == 0:
                s.state, s.dodge_t, s.dodge_cd = "dodge", DODGE_FRAMES, DODGE_COOLDOWN
                s.dodge_dir = want if want else s.facing; game.sfx("dodge", 0.6)
            elif inp["light"]: s.begin_attack("light")
            elif inp["heavy"]: s.begin_attack("heavy")
            elif inp["charge"] and s.on_ground: s.state = "charge"; s.vx = 0
            else:
                if inp["jump"] and s.on_ground: s.vy, s.on_ground = JUMP_V, False; game.sfx("jump", 0.4)
                target = want * WALK
                s.vx += max(-ACCEL, min(ACCEL, target - s.vx)) if want else (s.vx * FRICTION - s.vx)
                s.state = "jump" if not s.on_ground else ("walk" if abs(s.vx) > 0.3 else "idle")
        if s.state in ("idle", "walk", "jump", "charge") and s.hitstun <= 0: s.facing = 1 if other.x >= s.x else -1
        s.physics(*bounds)
        s.walk_phase += abs(s.vx) * 0.22
        s.afterimages = [[x, y, f, p, t - 1] for x, y, f, p, t in s.afterimages if t > 1]

    def anim_pose(s):
        if s.state == "attack":
            ph = s.attack_phase(); return s.poses[f"{s.move}_start" if ph == "startup" else f"{s.move}_hit"]
        if s.state in ("hurt",) or s.hitstun > 0: return s.poses["hurt"]
        if s.state == "defeat": return s.poses["defeat"]
        if s.state == "victory": return s.poses["victory"]
        if s.state in ("dodge", "charge", "brace"): return s.poses[s.state]
        if not s.on_ground: return s.poses["jump"]
        if s.state == "walk":
            p = dict(s.poses["idle"]); ph = s.walk_phase
            p.update(fh=0.5 * math.sin(ph), bh=-0.5 * math.sin(ph), fk=0.2 + 0.4 * max(0, -math.sin(ph)), bk=0.2 + 0.4 * max(0, math.sin(ph)),
                     fs=0.5 - 0.35 * math.sin(ph), bs=0.25 + 0.35 * math.sin(ph))
            return p
        p = dict(s.poses["idle"]); p["dy"] = math.sin(pg.time.get_ticks() * 0.004) * 0.8 if pg.get_init() else 0.0
        return p


class Enemy(Fighter):
    """Wolverine with adamantium claws. Finite-state AI: IDLE, APPROACH, RETREAT, JUMP, ATTACK_* , HURT, STUNNED, DEFEATED."""
    HW, HT = 20, 104
    MOVES = ENEMY_MOVES
    poses = ENEMY_POSES

    def reset(s):
        super().reset()
        s.ai, s.ai_t, s.attack_cd, s.jump_cd, s.rng = "IDLE", 20, 60, 120, random.Random(7)
        s.dissolve = 0.0

    def ai_state(s):
        if s.state == "defeat": return "DEFEATED"
        if s.stun > 0: return "STUNNED"
        if s.hitstun > 0: return "HURT"
        if s.state == "attack": return {"startup": "ATTACK_WINDUP", "active": "ATTACK_ACTIVE", "recovery": "ATTACK_RECOVERY"}[s.attack_phase()]
        return s.ai

    def think(s, player):
        """Pick the next behaviour (called every few frames, never every frame)."""
        dist = abs(player.x - s.x); r = s.rng.random()
        cornered = s.x < ARENA_L + 70 or s.x > ARENA_R - 70
        if player.state == "charge":                       # punish a charging Thanos
            s.ai, s.ai_t = ("APPROACH", 10) if dist > 70 else ("ATTACK", 1)
        elif player.state == "brace" and dist < WAVE_RANGE:  # sees the Solar Flash coming: back off or hop
            s.ai, s.ai_t = ("JUMP", 6) if r < 0.35 and s.jump_cd == 0 else ("RETREAT", 24)
        elif dist > 100: s.ai, s.ai_t = "APPROACH", 14
        elif dist < 50 and r < 0.45: s.ai, s.ai_t = ("JUMP", 6) if cornered and s.jump_cd == 0 else ("RETREAT", 18)
        elif s.attack_cd == 0 and r < 0.8: s.ai, s.ai_t = "ATTACK", 1
        elif r < 0.12 and s.jump_cd == 0: s.ai, s.ai_t = "JUMP", 6
        else: s.ai, s.ai_t = ("RETREAT", 16) if r < 0.45 else ("IDLE", 14)

    def update(s, player, bounds, game):
        s.tick_timers(); s.attack_cd = max(0, s.attack_cd - 1); s.jump_cd = max(0, s.jump_cd - 1)
        if s.state == "defeat":
            s.vx *= 0.85; s.physics(*bounds); return
        if s.stun > 0:
            s.stun -= 1; s.vx *= 0.8; s.move = None; s.state = "stun" if s.stun > 0 else "idle"
            if s.stun == 0: s.ai, s.ai_t = "RETREAT", 20
            s.physics(*bounds); return
        if s.hitstun > 0:
            s.hitstun -= 1; s.vx *= 0.82
            if s.hitstun == 0: s.state, s.ai, s.ai_t = "idle", "IDLE", 6
            s.physics(*bounds); return
        if s.state == "attack":
            s.mt += 1; m = s.MOVES[s.move]; s.vx *= 0.7
            if s.mt == m["startup"]: game.on_swing(s)
            if s.mt == 1 and s.move == "heavy": game.sfx("growl", 0.5)
            if s.mt >= m["startup"] + m["active"] + m["recovery"]:
                s.move, s.state, s.attack_cd = None, "idle", ENEMY_ATTACK_GAP
                s.ai, s.ai_t = ("RETREAT", 18) if s.rng.random() < 0.4 else ("IDLE", 10)
            s.physics(*bounds); return
        s.facing = 1 if player.x >= s.x else -1
        s.ai_t -= 1
        if s.ai_t <= 0: s.think(player)
        dist = abs(player.x - s.x)
        if s.ai == "APPROACH": s.vx += max(-0.3, min(0.3, s.facing * ENEMY_WALK - s.vx))
        elif s.ai == "RETREAT":
            away = -s.facing
            if (away < 0 and s.x < ARENA_L + 50) or (away > 0 and s.x > ARENA_R - 50): s.ai, s.ai_t = "APPROACH", 12   # never stuck on a wall
            s.vx += max(-0.3, min(0.3, away * ENEMY_WALK * 0.9 - s.vx))
        elif s.ai == "JUMP":
            if s.on_ground and s.jump_cd == 0:
                s.vy, s.on_ground, s.jump_cd = JUMP_V * 0.95, False, 150
                s.vx = (-s.facing if s.x > ARENA_L + 90 and s.x < ARENA_R - 90 else s.facing) * 3.0
            s.ai = "IDLE"
        elif s.ai == "ATTACK" and s.on_ground:
            if s.attack_cd == 0:
                heavy = s.rng.random() < (0.45 if player.state == "charge" else 0.28)
                rng = (ENEMY_MOVES["heavy"]["box"][1] if heavy else ENEMY_MOVES["light"]["box"][1]) - 6
                if dist <= rng + player.HW: s.begin_attack("heavy" if heavy else "light")
                else: s.ai, s.ai_t = "APPROACH", 8
            else: s.ai, s.ai_t = "IDLE", 6
        else: s.vx *= FRICTION
        s.state = "attack" if s.state == "attack" else ("jump" if not s.on_ground else ("walk" if abs(s.vx) > 0.25 else "idle"))
        s.walk_phase += abs(s.vx) * 0.25
        s.physics(*bounds)

    def anim_pose(s):
        if s.state == "defeat": return s.poses["defeat"]
        if s.stun > 0:
            p = dict(s.poses["stun"]); p["lean"] += 0.12 * math.sin(s.stun * 0.25); return p
        if s.hitstun > 0: return s.poses["hurt"]
        if s.state == "attack":
            ph = s.attack_phase(); return s.poses[f"{s.move}_start" if ph == "startup" else f"{s.move}_hit"]
        if not s.on_ground: return s.poses["jump"]
        if s.state == "walk":
            p = dict(s.poses["idle"]); ph = s.walk_phase
            p.update(fh=0.3 + 0.45 * math.sin(ph), bh=-0.3 - 0.45 * math.sin(ph), fk=0.4 + 0.3 * max(0, -math.sin(ph)), bk=0.4 + 0.3 * max(0, math.sin(ph)))
            return p
        return s.poses["idle"]

    def telegraph(s):
        """0..1 glow while winding up the heavy staff sweep."""
        if s.state == "attack" and s.move == "heavy" and s.attack_phase() == "startup": return min(1.0, s.mt / ENEMY_MOVES["heavy"]["startup"])
        return 0.0


# =================================================================== particles + effects
class Effects:
    def __init__(s): s.clear()
    def clear(s):
        s.p, s.slashes, s.flashes, s.waves, s.frags = [], [], [], [], []
    def add(s, x, y, vx, vy, life, col, size=1, grav=0.0, kind="sq"):
        if len(s.p) < MAX_PARTICLES: s.p.append([x, y, vx, vy, 0, life, col, size, grav, kind])
    def burst(s, x, y, n, speed, cols, life=(14, 30), grav=0.12, kind="sq"):
        for i in range(n):
            a = random.uniform(0, math.tau); v = random.uniform(0.3, 1.0) * speed
            s.add(x, y, math.cos(a) * v, math.sin(a) * v, random.randint(*life), cols[i % len(cols)], random.choice((1, 1, 2)), grav, kind)
    def slash(s, x, y, facing, big): s.slashes.append([x, y, facing, big, 0, 12 if big else 8])
    def impact(s, x, y, big): s.flashes.append([x, y, big, 0, 10 if big else 6])
    def update(s):
        for q in s.p: q[3] += q[8]; q[0] += q[2]; q[1] += q[3]; q[4] += 1
        s.p = [q for q in s.p if q[4] < q[5]]
        for a in (s.slashes, s.flashes): [e.__setitem__(4 if a is s.slashes else 3, e[4 if a is s.slashes else 3] + 1) for e in a]
        s.slashes = [e for e in s.slashes if e[4] < e[5]]
        s.flashes = [e for e in s.flashes if e[3] < e[4]]
        for f in s.frags: f[0] += f[2]; f[1] += f[3]; f[3] += 0.25; f[4] += f[5]; f[6] += 1
        s.frags = [f for f in s.frags if f[6] < 70]


class Wave:
    """Solar Flash shockwave: radius grows each frame; it can hit the target once, when the ring reaches it inside the range."""
    def __init__(s, x, y): s.x, s.y, s.r, s.hit, s.done = x, y, 0.0, False, False
    def update(s):
        s.r += WAVE_SPEED
        if s.r > WAVE_RANGE + 30: s.done = True
    def reaches(s, cx, cy):
        d = math.hypot(cx - s.x, cy - s.y)
        return not s.hit and d <= WAVE_RANGE and s.r >= d


# =================================================================== sound
class Synth:
    SR = 22050
    def __init__(s):
        s.ok, s.muted, s.snd, s.music = False, False, {}, None
        try:
            pg.mixer.quit(); pg.mixer.init(s.SR, -16, 1, 512)          # pg.init() opened 44.1 kHz stereo; re-open as 22.05 kHz mono
            s.ok = pg.mixer.get_init() == (s.SR, -16, 1)
        except pg.error: s.ok = False
        if not s.ok: return
        pg.mixer.set_num_channels(20)
        rnd = random.Random(5); nz = lambda: rnd.uniform(-1, 1); ex, sin, tau = math.exp, math.sin, math.tau
        def mk(dur, fn): return pg.mixer.Sound(buffer=array.array("h", (int(max(-1, min(1, fn(i / s.SR))) * 30000) for i in range(int(dur * s.SR)))).tobytes())
        lp = [0.0]
        def soft(x, k): lp[0] += (x - lp[0]) * k; return lp[0]
        s.snd["jab"] = mk(0.14, lambda t: soft(nz(), 0.3) * ex(-t * 30) * 1.2)
        s.snd["sword"] = mk(0.35, lambda t: soft(nz(), 0.15 + 0.5 * t) * min(1, t * 20) * ex(-t * 9) * 1.3)
        s.snd["hit"] = mk(0.2, lambda t: (sin(tau * (180 - 300 * t) * t) * 0.8 + nz() * 0.5 * ex(-t * 40)) * ex(-t * 16))
        s.snd["heavyhit"] = mk(0.45, lambda t: (sin(tau * (120 - 120 * t) * t) + nz() * 0.6 * ex(-t * 25) + sin(tau * 940 * t) * 0.2 * ex(-t * 12)) * ex(-t * 7) * 0.9)
        s.snd["dodge"] = mk(0.25, lambda t: soft(nz(), 0.05 + 0.6 * t) * sin(math.pi * t / 0.25) * 1.5)
        s.snd["jump"] = mk(0.12, lambda t: sin(tau * (220 + 500 * t) * t) * ex(-t * 25) * 0.3)
        s.snd["charge"] = mk(1.0, lambda t: (sin(tau * 110 * t) * 0.3 + sin(tau * 220 * t * (1 + 0.003 * sin(tau * 6 * t))) * 0.25 + nz() * 0.05))
        s.snd["brace"] = mk(0.4, lambda t: sin(tau * (300 + 900 * t) * t) * min(1, t * 10) * 0.4)
        s.snd["flash"] = mk(1.4, lambda t: (sin(tau * (60 + 40 * ex(-t * 5)) * t) * 0.8 + nz() * 0.6 * ex(-t * 6) + sin(tau * 1320 * t) * 0.15 * ex(-t * 3)) * ex(-t * 2))
        s.snd["stun"] = mk(0.6, lambda t: sin(tau * (600 + 120 * sin(tau * 10 * t)) * t) * 0.3 * ex(-t * 3))
        s.snd["growl"] = mk(0.5, lambda t: (((t * (70 + 20 * sin(tau * 8 * t))) % 1) * 2 - 1) * 0.35 * min(1, t * 8) * ex(-t * 2))
        s.snd["ko"] = mk(1.2, lambda t: (sin(tau * (200 - 140 * t) * t) * 0.6 + nz() * 0.3 * ex(-t * 4)) * ex(-t * 2.2))
        s.snd["crack"] = mk(0.3, lambda t: nz() * ex(-t * 30) * 0.9 + sin(tau * 1800 * t) * ex(-t * 40) * 0.2)
        s.snd["shatter"] = mk(1.3, lambda t: (nz() * 0.7 + sum(sin(tau * f * t) for f in (1200, 1700, 2300)) * 0.12) * ex(-t * 3))
        s.snd["slide"] = mk(1.6, lambda t: (soft(nz(), 0.04) * 1.5 + sin(tau * 45 * t) * 0.3) * min(1, t * 4) * ex(-t * 0.9))
        s.snd["portal"] = mk(1.6, lambda t: (sin(tau * (180 + 400 * t) * t) * 0.35 + sin(tau * 270 * t) * 0.2) * min(1, t * 3) * ex(-t * 1.2))
        s.snd["win"] = mk(2.2, lambda t: sum(((t * f) % 1 * 2 - 1) * (t >= d) * ex(-max(0, t - d) * 1.6) for f, d in ((261.6, 0), (329.6, 0.14), (392, 0.28), (523.3, 0.42))) * 0.16)
        s.snd["lose"] = mk(1.8, lambda t: sum(((t * f) % 1 * 2 - 1) for f in (196, 185)) * 0.15 * ex(-t * 1.3))
        s.snd["fight"] = mk(0.6, lambda t: (((t * 220) % 1) * 2 - 1 + ((t * 330) % 1) * 2 - 1) * 0.2 * ex(-t * 4))
        s.snd["click"] = mk(0.05, lambda t: sin(tau * 1700 * t) * ex(-t * 70) * 0.4)
        s.cchan, s.mchan = pg.mixer.Channel(1), pg.mixer.Channel(0)
        threading.Thread(target=s.build_music, daemon=True).start()

    def build_music(s):
        """Original 140 BPM battle loop (8 bars, D minor): driving toms and kick, an ostinato bass and brass-like stabs."""
        sr, tau = s.SR, math.tau; beat = 60 / 140; n = int(32 * beat * sr); buf = [0.0] * n; rnd = random.Random(2)
        mf = lambda m: 440 * 2 ** ((m - 69) / 12)
        def add(start, dur, fn):
            a = int(start * sr)
            for i in range(a, min(n, a + int(dur * sr))): buf[i] += fn((i - a) / sr)
        roots = [38, 38, 34, 36, 38, 38, 41, 40]                              # D D Bb C D D F E
        for b in range(32):
            t0 = b * beat
            add(t0, 0.25, lambda t: math.sin(tau * (50 + 70 * math.exp(-t * 28)) * t) * math.exp(-t * 10) * 0.5)
            if b % 2: add(t0, 0.15, lambda t: rnd.uniform(-1, 1) * math.exp(-t * 25) * 0.22)
            for k in (0.5, 0.75): add(t0 + beat * k, 0.18, lambda t: math.sin(tau * (140 - 60 * t) * t) * math.exp(-t * 14) * 0.18)   # toms
        for bar, r in enumerate(roots):
            for e in range(8):                                                # galloping ostinato
                f = mf(r + (7 if e in (3, 6) else 0))
                add(bar * 4 * beat + e * beat / 2, 0.2, lambda t, f=f: (((t * f) % 1) * 2 - 1) * 0.16 * math.exp(-t * 9))
            for k, m in enumerate((r + 24, r + 27, r + 31)):                  # brass-like stab chord on beats 1 and 3½
                f = mf(m)
                for st in (0, 2.5):
                    add(bar * 4 * beat + st * beat, 0.35, lambda t, f=f: (((t * f) % 1) * 2 - 1 + ((t * f * 1.004) % 1) * 2 - 1) * 0.035 * min(1, t * 60) * math.exp(-t * 5))
        lead = [(0, 1.5, 74), (1.5, .5, 72), (2, 2, 69), (4, 1, 70), (5, 1, 72), (6, 2, 74), (8, 1.5, 77), (9.5, .5, 76), (10, 2, 74), (12, 4, 72),
                (16, 1.5, 74), (17.5, .5, 72), (18, 2, 69), (20, 1, 70), (21, 1, 72), (22, 2, 74), (24, 1, 77), (25, 1, 79), (26, 2, 81), (28, 4, 76)]
        for b0, d, m in lead:
            f, dd = mf(m), d * beat
            add(b0 * beat, dd, lambda t, f=f, dd=dd: (((t * f) % 1) * 2 - 1) * 0.06 * min(1, t * 30) * min(1, (dd - t) * 20) * (0.8 + 0.2 * math.sin(tau * 5 * t)))
        lp, peak = 0.0, 1e-6
        for i in range(n): lp += (buf[i] - lp) * 0.5; buf[i] = lp; peak = max(peak, abs(lp))
        s.music = pg.mixer.Sound(buffer=array.array("h", (int(x / peak * 0.9 * 30000) for x in buf)).tobytes())

    def play(s, name, vol=1.0):
        if s.ok and not s.muted and name in s.snd: s.snd[name].set_volume(vol); s.snd[name].play()
    def charge(s, on):
        if not s.ok: return
        if on and not s.muted and not s.cchan.get_busy(): s.cchan.play(s.snd["charge"], loops=-1); s.cchan.set_volume(0.35)
        elif not on and s.cchan.get_busy(): s.cchan.stop()
    def music_on(s):
        if s.ok and not s.muted and s.music is not None and not s.mchan.get_busy(): s.mchan.play(s.music, loops=-1); s.mchan.set_volume(0.45)
    def music_off(s):
        if s.ok: s.mchan.stop()
    def toggle(s):
        s.muted = not s.muted
        if s.ok: (pg.mixer.pause() if s.muted else pg.mixer.unpause())


class Mute:
    muted = False
    def play(s, *a, **k): pass
    def charge(s, on): pass
    def music_on(s): pass
    def music_off(s): pass
    def toggle(s): pass


# =================================================================== art
def limb(L, a, b, col, w, out=INK):
    pg.draw.line(L, out, a, b, w + 2); pg.draw.circle(L, out, a, (w + 2) // 2); pg.draw.circle(L, out, b, (w + 2) // 2)
def limb_fill(L, a, b, col, w):
    pg.draw.line(L, col, a, b, w); pg.draw.circle(L, col, a, w // 2); pg.draw.circle(L, col, b, w // 2)


def rig_points(x, y, f, p, dims):
    """Joint positions for a side-view humanoid. Angles are measured from straight down, positive = forward."""
    TH, SH, TORSO, SHW, UA, FA = dims
    d = lambda a: (f * math.sin(a), math.cos(a))
    feet = []
    for h, k, off in ((p["fh"], p["fk"], 3), (p["bh"], p["bk"], -3)):
        a, b = d(h), d(h - k)
        feet.append(a[1] * TH + b[1] * SH)
    hip_y = y - max(feet) + p["dy"]
    J = {"hip": (x, hip_y)}
    J["neck"] = (x + f * math.sin(p["lean"]) * TORSO, hip_y - math.cos(p["lean"]) * TORSO)
    for side, h, k, off in (("f", p["fh"], p["fk"], 3), ("b", p["bh"], p["bk"], -3)):
        hp = (x + f * off * 0.5, hip_y); a, b = d(h), d(h - k)
        kn = (hp[0] + a[0] * TH, hp[1] + a[1] * TH); ft = (kn[0] + b[0] * SH, kn[1] + b[1] * SH)
        J[side + "hp"], J[side + "kn"], J[side + "ft"] = hp, kn, ft
    for side, s_, e_, off in (("f", p["fs"], p["fe"], SHW * 0.35), ("b", p["bs"], p["be"], -SHW * 0.35)):
        sh = (J["neck"][0] + f * off, J["neck"][1] + 3)
        a, b = d(s_), d(s_ + e_)
        el = (sh[0] + a[0] * UA, sh[1] + a[1] * UA); ha = (el[0] + b[0] * FA, el[1] + b[1] * FA)
        J[side + "sh"], J[side + "el"], J[side + "ha"] = sh, el, ha
        J[side + "ang"] = s_ + e_
    return J


THANOS_DIMS = (11, 11, 22, 30, 11, 11)
MINION_DIMS = (10, 10, 18, 24, 10, 10)


def draw_thanos(L, pl, t, glow_layer, alpha_ghost=None):
    """Thanos: bald ridged head, gold-trimmed robe and shoulder armour, the Gauntlet, and a double-bladed sword for heavy swings."""
    p, f = pl.cur, pl.facing
    J = rig_points(pl.x, pl.y, f, p, THANOS_DIMS)
    ghost = alpha_ghost is not None
    body_c, trim, dark, skin = (GOLD, GOLD, MUTED, GOLD) if ghost else (PLAYER, GOLD, DARK, SKIN)
    if pl.invuln > 0 and not ghost and (pl.invuln // 3) % 2 == 0 and pl.state != "dodge": body_c, skin = CREAM, CREAM
    limb(L, J["bhp"], J["bkn"], dark, 7); limb(L, J["bkn"], J["bft"], dark, 7)                 # back leg
    limb_fill(L, J["bhp"], J["bkn"], dark, 7); limb_fill(L, J["bkn"], J["bft"], dark, 7)
    pg.draw.rect(L, trim, (J["bft"][0] - 5, J["bft"][1] - 4, 10, 5))
    limb(L, J["bsh"], J["bel"], dark, 7); limb(L, J["bel"], J["bha"], dark, 6)                 # back arm
    limb_fill(L, J["bsh"], J["bel"], dark, 7); limb_fill(L, J["bel"], J["bha"], skin, 6)
    hip, neck = J["hip"], J["neck"]                                                              # torso: robe + chest
    rob = [(neck[0] - 13, neck[1] + 2), (neck[0] + 13, neck[1] + 2), (hip[0] + 11, hip[1] + 2), (hip[0] + 13, hip[1] + 14), (hip[0] - 13, hip[1] + 14), (hip[0] - 11, hip[1] + 2)]
    pg.draw.polygon(L, INK, [(x + (1 if x > hip[0] else -1), y) for x, y in rob]); pg.draw.polygon(L, body_c, rob)
    pg.draw.polygon(L, dark, [(neck[0] - 7, neck[1] + 4), (neck[0] + 7, neck[1] + 4), (hip[0] + 6, hip[1] - 1), (hip[0] - 6, hip[1] - 1)])
    pg.draw.line(L, trim, (neck[0] - 12, neck[1] + 3), (hip[0] - 11, hip[1] + 13), 2); pg.draw.line(L, trim, (neck[0] + 12, neck[1] + 3), (hip[0] + 11, hip[1] + 13), 2)
    pg.draw.line(L, OLIVE, (hip[0] - 11, hip[1]), (hip[0] + 11, hip[1]), 3)                       # belt
    limb(L, J["fhp"], J["fkn"], dark, 8); limb(L, J["fkn"], J["fft"], dark, 8)                   # front leg + boots
    limb_fill(L, J["fhp"], J["fkn"], dark, 8); limb_fill(L, J["fkn"], J["fft"], dark, 8)
    for ft in (J["fft"],):
        pg.draw.rect(L, INK, (ft[0] - 7, ft[1] - 6, 14, 8)); pg.draw.rect(L, body_c, (ft[0] - 6, ft[1] - 5, 12, 6)); pg.draw.line(L, trim, (ft[0] - 6, ft[1] - 5), (ft[0] + 6, ft[1] - 5))
    for sh in (J["bsh"], J["fsh"]):                                                              # shoulder armour
        pg.draw.circle(L, INK, sh, 8); pg.draw.circle(L, trim, sh, 7); pg.draw.circle(L, body_c, (sh[0] - 1, sh[1] - 1), 5)
    hx, hy = neck[0] + f * 2, neck[1] - 1                                                        # head
    pts = [(-6, -17), (5, -17), (8, -9), (8, -2), (4, 2), (-4, 2), (-7, -6), (-7, -13)]
    head = [(hx + f * px, hy + py) for px, py in pts]
    pg.draw.polygon(L, INK, [(x + (1 if (x - hx) * f > 0 else -1), y) for x, y in head]); pg.draw.polygon(L, skin, head)
    pg.draw.polygon(L, SKIN_SH, [(hx - f * 7, hy - 13), (hx - f * 2, hy - 15), (hx - f * 2, hy + 1), (hx - f * 6, hy - 4)])
    for k in (0, 2, 4): pg.draw.line(L, SKIN_SH if not ghost else MUTED, (hx + f * k, hy - 4), (hx + f * k, hy + 1))   # chin ridges
    pg.draw.line(L, INK, (hx + f * 1, hy - 11), (hx + f * 7, hy - 10), 2)                        # brow
    L.fill(CREAM if not ghost else GOLD, (int(hx + f * 4) - (1 if f < 0 else 0), int(hy - 9), 2, 2))
    if pl.state == "victory": L.fill(INK, (int(hx + f * 1), int(hy - 3), 4, 1))
    limb(L, J["fsh"], J["fel"], dark, 7); limb(L, J["fel"], J["fha"], dark, 7)                  # front arm + Gauntlet
    limb_fill(L, J["fsh"], J["fel"], dark, 7); limb_fill(L, J["fel"], J["fha"], skin, 6)
    gx, gy = J["fha"]
    pg.draw.circle(L, INK, (gx, gy), 6); pg.draw.circle(L, GOLD_HI, (gx, gy), 5)
    if not ghost:
        for i, c in enumerate((FX, ENERGY, CREAM, AMBER, PLAYER, DOOR)):
            a = i / 6 * math.tau; L.fill(c, (gx + math.cos(a) * 2.5, gy + math.sin(a) * 2.5, 1, 1))
    if pl.move == "heavy" and pl.state == "attack" and not ghost:                               # the double-bladed sword
        a = J["fang"]; dx, dy = f * math.sin(a), math.cos(a)
        tip1, tip2 = (gx + dx * 30, gy + dy * 30), (gx - dx * 16, gy - dy * 16)
        pg.draw.line(L, INK, tip2, tip1, 6); pg.draw.line(L, GOLD_HI, tip2, tip1, 4); pg.draw.line(L, FX, (gx + dx * 4, gy + dy * 4), tip1, 1)
        pg.draw.line(glow_layer, (90, 80, 20), tip2, tip1, 7)
    if pl.state == "charge" and not ghost:
        k = 0.5 + 0.5 * math.sin(t * 0.3)
        pg.draw.circle(glow_layer, (int(110 * k + 40), int(100 * k + 36), 0), (int(pl.x), int(pl.y - 30)), int(26 + 6 * k))


def draw_minion(L, en, t, glow_layer):
    """Wolverine (after the reference pixel art), in yellows only: finned mask, muscled suit with dark side panels,
    belt, gloves and three adamantium claws on each fist. The claws glow before his heavy lunge."""
    p, f = en.cur, en.facing
    J = rig_points(en.x, en.y, f, p, MINION_DIMS)
    suit, pants, panel, hi = MONK, GOLD, DARK, GOLD_HI
    if en.flash_t > 0 or (en.invuln > 0 and en.invuln % 4 < 2): suit, pants, hi = CREAM, CREAM, FX
    tg = en.telegraph()

    def claws(hx, hy, ang, back=False):
        dx, dy = f * math.sin(ang), math.cos(ang); nx, ny = -dy, dx
        for k in (-1, 0, 1):
            a = (hx + nx * k * 2, hy + ny * k * 2); b2 = (a[0] + dx * 13, a[1] + dy * 13)
            pg.draw.line(L, INK, a, b2, 3); pg.draw.line(L, MUTED if back else FX, a, b2, 1)
        if tg > 0 and not back: pg.draw.line(glow_layer, (int(110 * tg), int(100 * tg), int(40 * tg)), (hx, hy), (hx + dx * 14, hy + dy * 14), 3)

    for seg, col, wd in (((J["bhp"], J["bkn"]), pants, 7), ((J["bkn"], J["bft"]), panel, 7)):        # back leg (boot dark)
        limb(L, *seg, col, wd); limb_fill(L, *seg, col, wd)
    for seg, col in (((J["bsh"], J["bel"]), suit), ((J["bel"], J["bha"]), TAN)):                     # back arm
        limb(L, *seg, col, 6); limb_fill(L, *seg, col, 6)
    pg.draw.circle(L, INK, J["bha"], 4); pg.draw.circle(L, panel, J["bha"], 3); claws(*J["bha"], J["bang"], back=True)
    hip, neck = J["hip"], J["neck"]
    torso = [(neck[0] - 11, neck[1]), (neck[0] + 11, neck[1]), (hip[0] + 8, hip[1]), (hip[0] - 8, hip[1])]
    pg.draw.polygon(L, INK, [(x + (1 if x > hip[0] else -1), y) for x, y in torso]); pg.draw.polygon(L, suit, torso)
    pg.draw.polygon(L, panel, [(neck[0] - f * 11, neck[1] + 1), (neck[0] - f * 4, neck[1] + 6), (hip[0] - f * 2, hip[1]), (hip[0] - f * 8, hip[1])])   # dark side panel
    pg.draw.line(L, hi, (neck[0] - 4, neck[1] + 5), (neck[0] + 6, neck[1] + 5)); pg.draw.line(L, OLIVE, (neck[0] + f * 1, neck[1] + 7), (hip[0] + f * 1, hip[1] - 4))   # chest + abs
    pg.draw.line(L, INK, (hip[0] - 9, hip[1] + 1), (hip[0] + 9, hip[1] + 1), 4); pg.draw.line(L, OLIVE, (hip[0] - 8, hip[1] + 1), (hip[0] + 8, hip[1] + 1), 2)   # belt
    L.fill(CREAM, (int(hip[0]) - 2, int(hip[1]), 4, 2))
    for seg, col, wd in (((J["fhp"], J["fkn"]), pants, 8), ((J["fkn"], J["fft"]), panel, 7)):        # front leg
        limb(L, *seg, col, wd); limb_fill(L, *seg, col, wd)
    for ft in (J["fft"], J["bft"]):                                                                  # boots with points
        pg.draw.rect(L, INK, (ft[0] - 6, ft[1] - 4, 12, 5)); pg.draw.rect(L, MUTED, (ft[0] - 5, ft[1] - 3, 10, 3))
    for kn in (J["fkn"], J["bkn"]): pg.draw.polygon(L, INK, [(kn[0] - 3, kn[1] + 1), (kn[0] + f * 4, kn[1] - 4), (kn[0] + 3, kn[1] + 4)])
    hx, hy = neck[0] + f * 3, neck[1] - 1                                                           # masked head
    head = [(hx - f * 6, hy - 11), (hx + f * 5, hy - 12), (hx + f * 8, hy - 6), (hx + f * 7, hy), (hx - f * 4, hy + 2), (hx - f * 7, hy - 5)]
    pg.draw.polygon(L, INK, [(x + (1 if (x - hx) * f > 0 else -1), y) for x, y in head]); pg.draw.polygon(L, suit, head)
    for k in (0, 1):                                                                                # the two black fins of the mask
        bx = hx - f * (3 + 5 * k)
        pg.draw.polygon(L, INK, [(bx, hy - 9), (bx - f * (4 + 2 * k), hy - 19 - 2 * k), (bx + f * 3, hy - 8)])
    pg.draw.polygon(L, panel, [(hx - f * 7, hy - 8), (hx + f * 2, hy - 9), (hx + f * 3, hy - 4), (hx - f * 6, hy - 3)])   # dark eye band
    eye = CREAM if en.stun <= 0 else GOLD
    L.fill(eye, (int(hx + f * 2) - (3 if f < 0 else 0), int(hy - 8), 4, 3)); L.fill(INK, (int(hx + f * 4) - (1 if f < 0 else 0), int(hy - 7), 1, 1))
    pg.draw.polygon(L, TAN, [(hx + f * 1, hy - 2), (hx + f * 7, hy - 1), (hx + f * 5, hy + 2), (hx - f * 2, hy + 2)])   # jaw
    L.fill(INK, (int(hx + f * 3) - (2 if f < 0 else 0), int(hy), 3, 1))
    for seg, col in (((J["fsh"], J["fel"]), suit), ((J["fel"], J["fha"]), TAN)):                     # front arm, glove, claws
        limb(L, *seg, col, 7); limb_fill(L, *seg, col, 7)
    gx, gy = J["fha"]
    pg.draw.circle(L, INK, (gx, gy), 5); pg.draw.circle(L, panel, (gx, gy), 4); L.fill(hi, (gx - 2, gy - 3, 3, 1))
    claws(gx, gy, J["fang"] if en.state == "attack" else J["fang"] - 0.2)
    for sh in (J["fsh"], J["bsh"]): pg.draw.circle(L, INK, sh, 6); pg.draw.circle(L, panel, sh, 5); pg.draw.circle(L, suit, (sh[0] + f, sh[1] + 1), 3)
    if en.stun > 0:                                                                                 # dizzy stars
        for i in range(3):
            a = t * 0.15 + i * math.tau / 3; sx, sy = hx + math.cos(a) * 10, hy - 22 + math.sin(a) * 3
            L.fill(FX, (sx - 1, sy, 3, 1)); L.fill(FX, (sx, sy - 1, 1, 3))


def bake_arena():
    """Golden throne room after the reference: cosmic window, throne, curved consoles, pipes and a perspective floor."""
    L = pg.Surface((LW, LH)); L.fill(BG); rnd = random.Random(11)
    for y in range(0, 190, 24):                                                                  # wall panels
        for x in range(-12 * (y // 24 % 2), LW, 48): pg.draw.rect(L, (66, 52, 0), (x + 1, y + 1, 46, 22)); pg.draw.rect(L, (58, 46, 0), (x + 1, y + 1, 46, 22), 1)
    win = pg.Rect(170, 0, 110, 120)                                                              # cosmic window
    pg.draw.rect(L, DEEP, win)
    for _ in range(26): pg.draw.circle(L, rnd.choice(((90, 72, 0), (110, 88, 0), (70, 56, 0))), (rnd.randint(win.x, win.right), rnd.randint(0, 110)), rnd.randint(6, 18))
    for _ in range(40): L.fill(rnd.choice((DOOR, FX, ENERGY)), (rnd.randint(win.x + 2, win.right - 3), rnd.randint(2, 116), 1, 1))
    for (sx, sy) in ((200, 30), (250, 70), (214, 92)): L.fill(DOOR, (sx - 2, sy, 5, 1)); L.fill(DOOR, (sx, sy - 2, 1, 5))
    pg.draw.rect(L, MUTED, win, 3)
    throne = [(185, 150), (195, 60), (210, 40), (225, 58), (240, 40), (255, 60), (265, 150)]     # throne silhouette
    pg.draw.polygon(L, (64, 51, 0), throne); pg.draw.polygon(L, MUTED, throne, 2)
    pg.draw.polygon(L, DARK, [(205, 150), (210, 90), (225, 78), (240, 90), (245, 150)])
    pg.draw.rect(L, (70, 56, 0), (190, 150, 70, 18)); pg.draw.rect(L, MUTED, (190, 150, 70, 18), 2)
    for side in (-1, 1):                                                                         # curved consoles
        cx = 225 + side * 120
        pts = [(cx - side * 60, 100), (cx + side * 10, 90), (cx + side * 70, 130), (cx + side * 90, 190), (cx + side * 60, 200), (cx + side * 40, 145), (cx - side * 55, 128)]
        pg.draw.polygon(L, OLIVE, pts); pg.draw.polygon(L, GOLD, pts, 2)
        pg.draw.line(L, AMBER, (cx - side * 40, 112), (cx + side * 30, 112), 2)
        for k in range(3): pg.draw.rect(L, ENERGY if k == 1 else GOLD_HI, (cx + side * (10 + 18 * k) - 4, 120 + 6 * k, 8, 3))
    for side in (-1, 1):                                                                         # pipes with lights
        y0 = 170
        pg.draw.line(L, DARK, (225 + side * 225, y0), (225 + side * 150, y0 - 8), 8)
        for k in range(5): L.fill(ENERGY, (int(225 + side * (220 - k * 16)), y0 - 3 - k, 3, 2))
    # floor in perspective with gold "paths" (the reference's red floor trims)
    pg.draw.polygon(L, FLOOR, [(0, 196), (LW, 196), (LW, LH), (0, LH)])
    pg.draw.polygon(L, (110, 88, 0), [(0, 196), (LW, 196), (LW, 205), (0, 205)])
    vp = (225, 120)
    for k in range(-6, 7):
        xb = 225 + k * 70; x0 = vp[0] + (xb - vp[0]) * (196 - vp[1]) / (LH - vp[1])
        pg.draw.line(L, (112, 90, 0), (x0, 196), (xb, LH))
    for y in (212, 236, 270, 312): pg.draw.line(L, (112, 90, 0), (0, y), (LW, y))
    for side in (-1, 1):
        path = [(225 + side * 30, 200), (225 + side * 45, 200), (225 + side * 75, LH), (225 + side * 50, LH)]
        pg.draw.polygon(L, GOLD, path); pg.draw.polygon(L, GOLD_HI, path, 1)
    pg.draw.ellipse(L, (140, 112, 0), (130, 186, 190, 26), 2)
    pg.draw.line(L, INK, (0, GROUND + 1), (LW, GROUND + 1)); pg.draw.line(L, GOLD_HI, (0, GROUND + 2), (LW, GROUND + 2))
    for side in (0, 1):                                                                          # foreground pillars at the edges
        x = 0 if side == 0 else LW - 14
        pg.draw.rect(L, DARK, (x, 0, 14, LH)); pg.draw.rect(L, MUTED, (x + (10 if side == 0 else 0), 0, 4, LH))
    return L


class Door:
    """Barrier → cracks → shatter → two pillars slide apart → glowing Phase Door."""
    X0, X1, TOP = 396, 446, 40
    def __init__(s): s.reset()
    def reset(s):
        s.crack, s.shattered, s.slide, s.open, s.portal_t = 0.0, False, 0.0, False, 0
        s.cracks = []
    def entrance(s): return pg.Rect(PORTAL_X - PORTAL_HALF, GROUND - 60, PORTAL_HALF * 2, 60)

    def draw(s, L, glow, t):
        cx = PORTAL_X
        if s.slide > 0 or s.shattered:                                                          # portal behind the pillars
            k = min(1.0, s.slide)
            for i in range(4, 0, -1): pg.draw.rect(glow, (int(60 * k * i / 4), int(58 * k * i / 4), int(40 * k * i / 4)), (cx - 14 - i * 5, s.TOP + 10 - i * 5, 28 + i * 10, GROUND - s.TOP - 10 + i * 5))
            pg.draw.rect(L, INK, (cx - 15, s.TOP + 8, 30, GROUND - s.TOP - 8))
            pg.draw.rect(L, DOOR if k > 0.2 else GOLD, (cx - 13, s.TOP + 10, 26, GROUND - s.TOP - 10))
            for r in range(5):
                rr = 4 + r * 9 + 3 * math.sin(t * 0.1 + r)
                cy = (s.TOP + GROUND) / 2
                pts = [(cx, cy - rr * 1.6), (cx + rr * 0.45, cy), (cx, cy + rr * 1.6), (cx - rr * 0.45, cy)]
                pg.draw.polygon(L, (GOLD_HI, ENERGY, AMBER)[r % 3], pts, 1)
            a = t * 0.04
            for q in range(3):
                pg.draw.line(L, ENERGY, (cx + math.cos(a + q * 2.09) * 9, (s.TOP + GROUND) / 2 + math.sin(a + q * 2.09) * 9), (cx, (s.TOP + GROUND) / 2))
            for i in range(2):                                                                  # the two sliding pillars
                off = (i * 2 - 1) * (7 + 22 * s.slide)
                px = cx + off - 7
                pg.draw.rect(L, INK, (px - 1, s.TOP - 6, 16, GROUND - s.TOP + 6))
                pg.draw.rect(L, PLAYER, (px, s.TOP - 5, 14, GROUND - s.TOP + 5)); pg.draw.rect(L, GOLD, (px + 10, s.TOP - 5, 4, GROUND - s.TOP + 5))
                for y in range(s.TOP + 6, GROUND, 22): pg.draw.line(L, GOLD, (px, y), (px + 13, y))
                pg.draw.rect(L, GOLD_HI, (px - 2, s.TOP - 9, 18, 5))
            return
        r = pg.Rect(s.X0, s.TOP, s.X1 - s.X0, GROUND - s.TOP)                                  # the sealed barrier
        pg.draw.rect(L, INK, r.inflate(2, 2)); pg.draw.rect(L, OLIVE, r)
        for y in range(r.y + 4, r.bottom, 14):
            off = 0 if (y // 14) % 2 else 8
            for x in range(r.x - off, r.right, 16): pg.draw.rect(L, MUTED, (max(r.x, x) + 1, y, min(15, r.right - max(r.x, x) - 1), 12), 1)
        pulse = 0.5 + 0.5 * math.sin(t * 0.05)
        pg.draw.line(L, (int(200 + 55 * pulse), int(170 + 50 * pulse), 0), (r.x + 4, r.y + 10), (r.x + 4, r.bottom - 4), 2)
        pg.draw.rect(L, GOLD, r, 2)
        for (a, b) in s.cracks[: int(len(s.cracks) * min(1.0, s.crack))]:
            pg.draw.line(L, FX, a, b, 1); pg.draw.line(glow, (90, 88, 50), a, b, 3)

    def make_cracks(s):
        rnd = random.Random(4); s.cracks = []
        for _ in range(9):
            p = (rnd.uniform(s.X0 + 6, s.X1 - 6), rnd.uniform(s.TOP + 20, GROUND - 20))
            for _ in range(4):
                q = (min(s.X1 - 2, max(s.X0 + 2, p[0] + rnd.uniform(-12, 12))), min(GROUND - 2, max(s.TOP + 2, p[1] + rnd.uniform(-22, 22))))
                s.cracks.append((p, q)); p = q


# =================================================================== game
class Game:
    STATES = ("TITLE", "RULES", "CONTROLS", "INTRO", "FIGHT", "PAUSED", "DEFEAT", "BARRIER", "DOOR_REVEAL", "PORTAL", "VICTORY", "GAME_OVER")

    def __init__(s, headless=False):
        pg.init()
        s.display = pg.display.set_mode((W, H)); pg.display.set_caption("YELLOW")
        s.clock = pg.time.Clock()
        s.L, s.glow = pg.Surface((LW, LH)), pg.Surface((LW, LH))
        s.arena = bake_arena()
        s.f_title, s.f_big, s.f_mid, s.f_sm = pg.font.Font(None, 150), pg.font.Font(None, 64), pg.font.Font(None, 30), pg.font.Font(None, 22)
        s.audio = Mute() if headless else Synth()
        s.player, s.enemy, s.fx, s.door = Player(100, 1, PLAYER_HP), Enemy(320, -1, ENEMY_HP), Effects(), Door()
        s.F, s.FG = pg.Surface((LW // FIG + 1, LH // FIG + 1), pg.SRCALPHA), pg.Surface((LW // FIG + 1, LH // FIG + 1))
        s.state, s.t, s.buttons, s.cache, s.ret = "TITLE", 0, {}, {}, "TITLE"
        s.motes = [[random.uniform(0, LW), random.uniform(0, LH), random.uniform(0.1, 0.35), random.uniform(0, 6)] for _ in range(36)]
        s.held = {"left": False, "right": False, "charge": False}
        s.reset()

    def reset(s):
        """Restart the encounter: health, positions, facing, velocity, attacks, AI, energy, dodge, timers, effects, door, results."""
        s.player.reset(); s.enemy.reset(); s.fx.clear(); s.door.reset()
        s.waves, s.hitstop, s.shake, s.phase_t, s.round_t = [], 0, 0.0, 0, ROUND_TIME
        s.combo, s.combo_t, s.score, s.cause, s.flash, s.hint_t = 0, 0, 0, "", 0.0, 0
        s.intro_t, s.vic_t = 0, 0
        s.pressed = {k: False for k in ("jump", "light", "heavy", "dodge", "flash")}
        s.audio.charge(False)

    # --------------------------------------------------- hooks used by fighters
    def sfx(s, name, vol=1.0): s.audio.play(name, vol)
    def on_swing(s, f):
        heavy = f.move == "heavy"
        s.sfx("sword" if heavy and f is s.player else "jab", 0.6 if heavy else 0.4)
        hb = f.hitbox()
        if hb: s.fx.slash(hb.centerx, hb.centery, f.facing, heavy)
    def on_brace(s, pl):
        s.sfx("brace", 0.6); s.audio.charge(False)
    def launch_wave(s, pl):
        cx, cy = pl.centre(); s.waves.append(Wave(cx, cy)); s.flash = 0.6; s.shake = max(s.shake, 4); s.sfx("flash", 0.8)
        s.fx.burst(cx, cy, 30, 3.5, (FX, ENERGY, DOOR), (20, 40), 0.0)

    # --------------------------------------------------- input (edge-triggered presses, held movement/charge)
    def start(s): s.reset(); s.state = "INTRO"; s.audio.music_on()
    CONTROLS_FROM = ("TITLE", "RULES", "INTRO", "FIGHT", "PAUSED")
    def open_controls(s):
        """Controls card: freezes the round (like pause) and returns to wherever it was opened from."""
        if s.state not in s.CONTROLS_FROM: return
        s.ret, s.state = s.state, "CONTROLS"
        s.pressed = {k: False for k in s.pressed}; s.audio.charge(False)
    def close_controls(s): s.state = s.ret
    def key_down(s, key):
        st = s.state
        if key == pg.K_m: s.audio.toggle(); return
        if key == pg.K_c and st in s.CONTROLS_FROM: s.open_controls(); return
        if st == "CONTROLS":
            if key in (pg.K_c, pg.K_ESCAPE, pg.K_RETURN, pg.K_KP_ENTER): s.close_controls()
        elif st == "TITLE":
            if key in (pg.K_RETURN, pg.K_KP_ENTER): s.sfx("click"); s.start()
            elif key == pg.K_h: s.state = "RULES"
        elif st == "RULES":
            if key in (pg.K_RETURN, pg.K_h, pg.K_ESCAPE): s.state = "TITLE"
        elif st == "FIGHT":
            if key == pg.K_ESCAPE: s.state = "PAUSED"; s.audio.charge(False)
            for k, name in ((pg.K_w, "jump"), (pg.K_UP, "jump"), (pg.K_j, "light"), (pg.K_k, "heavy"), (pg.K_LSHIFT, "dodge"), (pg.K_RSHIFT, "dodge"), (pg.K_i, "flash")):
                if key == k: s.pressed[name] = True
        elif st == "PAUSED":
            if key == pg.K_ESCAPE: s.state = "FIGHT"
            elif key == pg.K_r: s.start()
        elif st == "PORTAL":
            if key in (pg.K_w, pg.K_UP): s.pressed["jump"] = True
        elif st in ("GAME_OVER", "VICTORY"):
            if key == pg.K_r: s.sfx("click"); s.start()

    # --------------------------------------------------- update (fixed 60 Hz step)
    def step(s):
        s.t += 1
        for m in s.motes: m[1] -= m[2]; m[0] += math.sin(s.t * 0.01 + m[3]) * 0.15; m[1] %= LH
        s.shake *= 0.85; s.flash = max(0.0, s.flash - 0.03)
        st = s.state
        if st in ("TITLE", "RULES", "PAUSED", "CONTROLS"): return
        s.fx.update()
        pl, en = s.player, s.enemy
        if st == "INTRO":
            s.intro_t += 1
            if s.intro_t == 150: s.sfx("fight", 0.7)
            if s.intro_t >= 190: s.state = "FIGHT"
            return
        if st == "FIGHT": s.update_fight()
        elif st == "DEFEAT":
            s.phase_t += 1; en.update(pl, (ARENA_L, ARENA_R), s); en.cur_target = en.anim_pose(); lerp_pose(en.cur, en.anim_pose(), 0.1)
            lerp_pose(pl.cur, pl.anim_pose(), 0.2)
            if s.phase_t > 40:
                en.dissolve = min(1.0, (s.phase_t - 40) / 45)
                if s.phase_t % 2 == 0: s.fx.add(en.x + random.uniform(-14, 14), en.y - random.uniform(0, 40), random.uniform(-0.3, 0.3), random.uniform(-1.2, -0.4), 40, random.choice((MONK, GOLD, AMBER)), 1, 0)
            if s.phase_t >= DEFEAT_T: s.state, s.phase_t = "BARRIER", 0; s.door.make_cracks()
        if st in ("BARRIER", "DOOR_REVEAL", "PORTAL", "VICTORY"): en.tick_timers()           # health bar keeps easing to empty
        if st == "BARRIER":
            s.phase_t += 1; d = s.door
            d.crack = min(1.0, s.phase_t / CRACK_T)
            if s.phase_t % 12 == 1 and s.phase_t < CRACK_T: s.sfx("crack", 0.5)
            if s.phase_t == CRACK_T:                                                            # shatter into fragments
                d.shattered = True; s.shake = 5; s.sfx("shatter", 0.7)
                rnd = random.Random(8)
                for i in range(22):
                    x, y = rnd.uniform(d.X0, d.X1), rnd.uniform(d.TOP, GROUND)
                    s.fx.frags.append([x, y, rnd.uniform(-2.5, 1.0), rnd.uniform(-3, 0), 0.0, rnd.uniform(-0.2, 0.2), 0, rnd.randint(4, 9)])
                s.fx.burst(421, 150, 40, 3, (FX, CREAM, ENERGY), (20, 45), 0.15)
            if s.phase_t >= BARRIER_T: s.state, s.phase_t = "DOOR_REVEAL", 0; s.sfx("slide", 0.7)
        elif st == "DOOR_REVEAL":
            s.phase_t += 1; d = s.door
            k = min(1.0, s.phase_t / 80); d.slide = k * k * (3 - 2 * k)
            if s.phase_t == 70: s.sfx("portal", 0.6)
            if s.phase_t >= REVEAL_T: s.state, s.phase_t, d.open = "PORTAL", 0, True; s.hint_t = 240
        elif st == "PORTAL":
            s.door.portal_t += 1
            inp = s.read_input(); inp.update(light=False, heavy=False, dodge=False, flash=False, charge=False)
            pl.update(inp, en, (ARENA_L, ARENA_R_OPEN), s); pl.facing = 1 if inp["right"] or not inp["left"] else -1
            lerp_pose(pl.cur, pl.anim_pose(), 0.3)
            if random.random() < 0.5:
                a = random.uniform(0, math.tau); sx, sy = PORTAL_X + math.cos(a) * 40, 150 + math.sin(a) * 70
                s.fx.add(sx, sy, (PORTAL_X - sx) * 0.05, (150 - sy) * 0.05, 20, random.choice((DOOR, FX, ENERGY)), 1, 0)
            if pl.hurtbox().colliderect(s.door.entrance()):                                    # physically walked into the portal
                s.state, s.vic_t = "VICTORY", 0; pl.state = "victory"; s.sfx("win", 0.8); s.audio.music_off()
                s.fx.burst(PORTAL_X, 160, 50, 3.5, (DOOR, FX, ENERGY), (30, 60), 0.0)
        elif st == "VICTORY":
            s.vic_t += 1; lerp_pose(pl.cur, pl.anim_pose(), 0.2)
        elif st == "GAME_OVER":
            s.phase_t += 1; lerp_pose(pl.cur, pl.anim_pose(), 0.1); lerp_pose(en.cur, en.anim_pose(), 0.2)
        s.pressed = {k: False for k in s.pressed}

    def read_input(s):
        return {"left": s.held["left"], "right": s.held["right"], "charge": s.held["charge"], **s.pressed}

    def update_fight(s):
        pl, en = s.player, s.enemy
        s.round_t -= 1; s.combo_t = max(0, s.combo_t - 1)
        if s.combo_t == 0: s.combo = 0
        if s.round_t <= 0:
            s.round_t = 0; s.lose("TIME UP"); return
        # the Solar Flash stun counts every simulation frame, even during hit-stop, so it is exactly 90 frames long
        if s.hitstop > 0:
            s.hitstop -= 1
            if en.stun > 0:
                en.stun -= 1
                if en.stun == 0: en.state = "idle"
            s.pressed = {k: False for k in s.pressed}; return
        inp = s.read_input()
        was_charging = pl.state == "charge"
        pl.update(inp, en, (ARENA_L, ARENA_R), s)
        en.update(pl, (ARENA_L, ARENA_R), s)
        if pl.state == "charge" and not was_charging: s.audio.charge(True)
        if pl.state != "charge" and was_charging: s.audio.charge(False)
        if pl.state == "charge" and s.t % 2 == 0:                                               # particles converge while charging
            a = random.uniform(0, math.tau); sx, sy = pl.x + math.cos(a) * 46, pl.y - 30 + math.sin(a) * 40
            s.fx.add(sx, sy, (pl.x - sx) / 16, (pl.y - 30 - sy) / 16, 16, random.choice((ENERGY, FX, PLAYER)), 1, 0)
        s.separate()
        s.resolve_hits()
        for w in s.waves:
            w.update()
            cx, cy = en.centre()
            if en.state != "defeat" and w.reaches(cx, cy):                                     # each wave hits at most once
                w.hit = True
                en.take_hit(FLASH_DMG, 1 if en.x > w.x else -1, 2.0, 0, ENEMY_INVULN, lethal=False)
                en.stun, en.state, en.move, en.hitstun = FLASH_STUN, "stun", None, 0
                s.sfx("stun", 0.7); s.fx.impact(cx, cy, True); s.fx.burst(cx, cy, 16, 2.5, (FX, ENERGY), (14, 28), 0.05)
            if s.t % 2 == 0 and not w.done:
                for i in range(3):
                    a = random.uniform(0, math.tau); s.fx.add(w.x + math.cos(a) * w.r, w.y + math.sin(a) * w.r * 0.6, 0, 0, 10, random.choice((FX, ENERGY)), 1, 0)
        s.waves = [w for w in s.waves if not w.done]
        lerp_pose(pl.cur, pl.anim_pose(), 0.35); lerp_pose(en.cur, en.anim_pose(), 0.3)
        if en.hp <= 0 and en.state != "defeat":
            en.state, en.move, en.stun, en.hitstun, en.vx = "defeat", None, 0, 0, en.facing * -2.0
            s.state, s.phase_t = "DEFEAT", 0; pl.state, pl.move = "idle", None; s.audio.charge(False); s.sfx("ko", 0.8); s.shake = 4
        elif pl.hp <= 0: s.lose("THANOS HAS FALLEN")

    def lose(s, cause):
        s.state, s.cause, s.phase_t = "GAME_OVER", cause, 0
        s.player.state, s.player.move = "defeat", None
        s.audio.charge(False); s.audio.music_off(); s.sfx("lose", 0.8)

    def separate(s):
        """Fighters cannot overlap: push both apart horizontally by half the overlap."""
        pl, en = s.player, s.enemy
        if en.state == "defeat": return
        over = (pl.HW + en.HW) - abs(pl.x - en.x)
        if over > 0 and pl.y > en.y - en.HT + 10 and en.y > pl.y - pl.HT + 10:
            d = 1 if pl.x < en.x else -1
            pl.x -= d * over / 2; en.x += d * over / 2
            for f in (pl, en): f.x = min(max(f.x, ARENA_L + f.HW), ARENA_R - f.HW)

    def resolve_hits(s):
        """Hitbox vs hurtbox. Each attack can land once; dodge and post-hit invulnerability are respected."""
        pl, en = s.player, s.enemy
        for atk, vic in ((pl, en), (en, pl)):
            hb = atk.hitbox()
            if not hb or atk.hit_done or vic.state == "defeat": continue
            if not hb.colliderect(vic.hurtbox()): continue
            atk.hit_done = True
            if (vic is pl and pl.invulnerable()) or (vic is en and en.invuln > 0): continue
            m = atk.MOVES[atk.move]; heavy = atk.move == "heavy"
            vic.take_hit(m["dmg"], atk.facing, m["kb"], m["stun"], PLAYER_INVULN if vic is pl else ENEMY_INVULN)
            vic.flash_t = 6; s.hitstop = m["hitstop"]; s.shake = max(s.shake, m["shake"])
            cx = (hb.centerx + vic.x) / 2; cy = hb.centery
            s.fx.impact(cx, cy, heavy); s.fx.burst(cx, cy, 10 if heavy else 5, 2.6 if heavy else 1.8, (FX, ENERGY, CREAM))
            s.sfx("heavyhit" if heavy else "hit", 0.7)
            if atk is pl: s.combo, s.combo_t, s.score = s.combo + 1, 70, s.score + m["dmg"] * 10 * (1 + s.combo // 3)
            else: s.audio.charge(False)                                                        # being hit interrupts charging (Player.take_hit sets hurt)

    # --------------------------------------------------- render
    def text(s, txt, font, col, pos, anchor="center", shadow=INK, aa=False):
        k = (txt, id(font), col, aa)
        img = s.cache.get(k)
        if img is None:
            img = font.render(txt, aa, col)
            if len(s.cache) > 300: s.cache.clear()
            s.cache[k] = img
        r = img.get_rect(**{anchor: pos})
        if shadow is not None:
            sk = (txt, id(font), shadow, aa)
            if sk not in s.cache: s.cache[sk] = font.render(txt, aa, shadow)
            s.display.blit(s.cache[sk], r.move(2, 2))
        s.display.blit(img, r); return r

    def draw(s):
        L, G, st, pl, en = s.L, s.glow, s.state, s.player, s.enemy
        G.fill((0, 0, 0))
        L.blit(s.arena, (0, 0))
        for m in s.motes: L.fill(ENERGY if int(m[3] * 10) % 3 else FX, (int(m[0]), int(m[1]), 1, 1)); pg.draw.circle(G, (40, 36, 0), (int(m[0]), int(m[1])), 2)
        pg.draw.ellipse(G, (12, 10, 0), (60, 150, 330, 120))                                 # subtle atmospheric glow over the battlefield
        s.door.draw(L, G, s.t)
        for f in s.fx.frags:                                                                    # barrier fragments
            x, y, sz, a = f[0], f[1], f[7], f[4]; k = 1 - f[6] / 70
            pts = [(x + math.cos(a + q * 2.1) * sz, y + math.sin(a + q * 2.1) * sz) for q in range(3)]
            pg.draw.polygon(L, OLIVE if k > 0.4 else MUTED, pts); pg.draw.polygon(L, GOLD, pts, 1)
        if st == "CONTROLS": st = s.ret                                                         # draw what the card sits on
        if st not in ("TITLE", "RULES"):
            for x, y, f, p, tl in pl.afterimages:                                               # dodge afterimages
                ghost = Player(x, f, 1); ghost.x, ghost.y, ghost.facing, ghost.cur, ghost.state = x, y, f, p, "dodge"
                s.draw_fighter(L, G, draw_thanos, ghost, int(110 * tl / 14), ghost=True)
            if en.dissolve < 1.0: s.draw_fighter(L, G, draw_minion, en, int(255 * (1 - en.dissolve)))
            if st != "VICTORY": s.draw_fighter(L, G, draw_thanos, pl, 255)
            elif s.vic_t < 20: s.draw_fighter(L, G, draw_thanos, pl, max(0, 255 - s.vic_t * 13))
        else:                                                                                   # title composition: face-off
            demo_p, demo_e = s.title_fighters()
            s.draw_fighter(L, G, draw_minion, demo_e, 255); s.draw_fighter(L, G, draw_thanos, demo_p, 255)
        for x, y, f, big, age, life in s.fx.slashes:                                            # slash arcs
            k = 1 - age / life; r = 22 if big else 14
            rect = pg.Rect(x - r, y - r, 2 * r, 2 * r)
            a0, a1 = (-1.2, 1.0) if f > 0 else (math.pi - 1.0, math.pi + 1.2)
            pg.draw.arc(L, FX, rect, a0, a1, 3 if big else 2); pg.draw.arc(G, (int(120 * k), int(115 * k), int(60 * k)), rect.inflate(6, 6), a0, a1, 5)
        for x, y, big, age, life in s.fx.flashes:                                               # impact stars
            k = 1 - age / life; r = (12 if big else 7) * (0.6 + 0.6 * age / life)
            pts = [(x + math.cos(i * math.pi / 4) * (r if i % 2 == 0 else r * 0.4), y + math.sin(i * math.pi / 4) * (r if i % 2 == 0 else r * 0.4)) for i in range(8)]
            pg.draw.polygon(L, FX, pts); pg.draw.circle(G, (int(140 * k), int(135 * k), int(70 * k)), (int(x), int(y)), int(r + 6))
        for w in s.waves:                                                                       # Solar Flash shockwave
            for i, (dr, c, wd) in enumerate(((0, FX, 3), (-6, ENERGY, 2), (-12, GOLD_HI, 1))):
                rr = w.r + dr
                if rr > 2: pg.draw.ellipse(L, c, (w.x - rr, w.y - rr * 0.6, rr * 2, rr * 1.2), wd)
            if w.r > 2: pg.draw.ellipse(G, (90, 86, 40), (w.x - w.r - 4, w.y - w.r * 0.6 - 4, w.r * 2 + 8, w.r * 1.2 + 8), 6)
        for q in s.fx.p: L.fill(q[6], (int(q[0]), int(q[1]), q[7], q[7]))
        small = pg.transform.smoothscale(G, (LW // 4, LH // 4))
        L.blit(pg.transform.smoothscale(small, (LW, LH)), (0, 0), special_flags=pg.BLEND_RGB_ADD); L.blit(G, (0, 0), special_flags=pg.BLEND_RGB_ADD)
        off = (random.uniform(-1, 1) * s.shake, random.uniform(-1, 1) * s.shake) if s.shake > 0.4 else (0, 0)
        s.display.fill(INK); s.display.blit(pg.transform.scale(L, (W, H)), (off[0] * SCALE, off[1] * SCALE))
        if s.flash > 0:
            o = pg.Surface((W, H)); o.fill(FX); o.set_alpha(int(150 * s.flash)); s.display.blit(o, (0, 0))
        s.buttons = {}
        s.draw_ui()
        pg.display.flip()

    def draw_fighter(s, L, G, fn, who, alpha, ghost=False):
        """Fighters live in arena space; they are drawn on a half-size layer and doubled, so they are big and chunky."""
        F, FG = s.F, s.FG
        F.fill((0, 0, 0, 0)); FG.fill((0, 0, 0))
        pg.draw.ellipse(L, INK, (who.x - who.HW * 0.8, GROUND - 3, who.HW * 1.6, 7))           # shadow on the floor
        ox, oy = who.x, who.y
        who.x, who.y = ox / FIG, oy / FIG
        try:
            if ghost: fn(F, who, s.t, FG, alpha_ghost=True)
            else: fn(F, who, s.t, FG)
        finally: who.x, who.y = ox, oy
        big = pg.transform.scale(F, (F.get_width() * FIG, F.get_height() * FIG))
        if alpha < 255: big.set_alpha(alpha)
        L.blit(big, (0, 0))
        G.blit(pg.transform.scale(FG, (FG.get_width() * FIG, FG.get_height() * FIG)), (0, 0), special_flags=pg.BLEND_RGB_ADD)

    def title_fighters(s):
        if not hasattr(s, "_tp"):
            s._tp, s._te = Player(140, 1, 1), Enemy(310, -1, 1)
        s._tp.cur = dict(PLAYER_POSES["idle"]); s._te.cur = dict(ENEMY_POSES["idle"])
        s._tp.cur["dy"] = math.sin(s.t * 0.05); s._te.cur["dy"] = 3 + math.sin(s.t * 0.06 + 1)
        return s._tp, s._te

    def panel(s, rect, alpha=200, border=GOLD):
        o = pg.Surface(rect.size, pg.SRCALPHA); o.fill((*DEEP, alpha)); s.display.blit(o, rect.topleft)
        pg.draw.rect(s.display, INK, rect.inflate(4, 4), 2); pg.draw.rect(s.display, border, rect, 2)

    def button(s, key, label, center):
        r = pg.Rect(0, 0, 240, 44); r.center = center
        hover = r.collidepoint(pg.mouse.get_pos()) if pg.mouse.get_focused() else False
        s.panel(r, 230, ENERGY if hover else GOLD); s.text(label, s.f_mid, FX if hover else CREAM, r.center); s.buttons[key] = r

    def bar(s, x, y, w, h, frac, trail, col, right=False):
        D = s.display
        pg.draw.polygon(D, INK, [(x - 4, y - 4), (x + w + 8, y - 4), (x + w + 4, y + h + 4), (x - 8, y + h + 4)])
        pg.draw.rect(D, DARK, (x, y, w, h))
        tw, fw = int(w * max(0, trail)), int(w * max(0, frac))
        if right: pg.draw.rect(D, CREAM, (x + w - tw, y, tw, h)); pg.draw.rect(D, col, (x + w - fw, y, fw, h))
        else: pg.draw.rect(D, CREAM, (x, y, tw, h)); pg.draw.rect(D, col, (x, y, fw, h))
        pg.draw.rect(D, GOLD, (x, y, w, h), 1)

    def portrait(s, rect, who):
        D = s.display; s.panel(rect, 240, GOLD)
        sub = pg.Surface((32, 30), pg.SRCALPHA)
        if who == "thanos":
            p = Player(16, 1, 1); p.cur = dict(PLAYER_POSES["idle"]); p.y = 72
            J = rig_points(16, 72, 1, p.cur, THANOS_DIMS)
            dy = 26 - J["neck"][1]; p.y += dy; draw_thanos(sub, p, s.t, pg.Surface((32, 30)))
        else:
            e = Enemy(14, 1, 1); e.cur = dict(ENEMY_POSES["idle"]); e.y = 60
            J = rig_points(14, 60, 1, e.cur, MINION_DIMS); e.y += 26 - J["neck"][1]; draw_minion(sub, e, s.t, pg.Surface((32, 30)))
        D.blit(pg.transform.scale(sub, (rect.w - 4, rect.h - 4)), (rect.x + 2, rect.y + 2))

    def draw_ui(s):
        if s.state == "CONTROLS":
            s.draw_screen(s.ret); s.buttons = {}                                               # the card sits on top; only its own button is live
            s.draw_controls()
        else: s.draw_screen(s.state)

    def draw_controls(s):
        D = s.display
        o = pg.Surface((W, H), pg.SRCALPHA); o.fill((*INK, 170)); D.blit(o, (0, 0))
        r = pg.Rect(150, 60, 600, 550); s.panel(r, 245, ENERGY)
        s.text("CONTROLS", s.f_big, ENERGY, (W // 2, 100), shadow=MUTED)
        s.text("The game is paused while this card is open", s.f_sm, GOLD_HI, (W // 2, 140))
        for i, (keys, what) in enumerate(CONTROLS):
            y = 180 + i * 31
            img = s.f_sm.render(keys, True, FX); cap = img.get_rect(midright=(W // 2 - 26, y)).inflate(16, 8)
            pg.draw.rect(D, INK, cap.move(0, 3)); pg.draw.rect(D, DARK, cap); pg.draw.rect(D, GOLD, cap, 1)
            s.text(keys, s.f_sm, FX, cap.center, shadow=None)
            s.text(what, s.f_sm, CREAM, (W // 2 - 4, y), "midleft")
        s.button("close", "CLOSE", (W // 2, 545))
        s.text("C / ESC / ENTER  close", s.f_sm, GOLD_HI, (W // 2, 590))

    def draw_screen(s, st):
        D, pl, en = s.display, s.player, s.enemy
        if st == "TITLE":
            o = pg.Surface((W, H), pg.SRCALPHA); o.fill((*INK, 120)); D.blit(o, (0, 0))
            s.text("YELLOW", s.f_title, ENERGY, (W // 2, 120), shadow=MUTED)
            s.text("PRESS ENTER TO START", s.f_mid, FX if (s.t // 30) % 2 else ENERGY, (W // 2, 205))
            s.button("start", "START", (W // 2, 262)); s.button("rules", "RULES", (W // 2, 314))
            s.button("controls", "CONTROLS", (W // 2, 366)); s.button("exit", "EXIT", (W // 2, 418))
            ctrl = ["A/D or ARROWS  move      W/UP  jump", "J  Gauntlet jab      K  double-bladed sword", "SHIFT  dodge      hold L  Solar charge      I  Solar Flash", "ESC  pause      M  mute      H  rules"]
            r = pg.Rect(150, 462, 600, 120); s.panel(r, 200)
            for i, line in enumerate(ctrl): s.text(line, s.f_sm, CREAM, (W // 2, 482 + i * 26))
            s.text("Forgot a key mid-fight? Press C or click CONTROLS (bottom left).", s.f_sm, GOLD_HI, (W // 2, 608))
            return
        if st == "RULES":
            o = pg.Surface((W, H), pg.SRCALPHA); o.fill((*INK, 150)); D.blit(o, (0, 0))
            r = pg.Rect(70, 36, 760, 570); s.panel(r, 240)
            s.text("RULES", s.f_big, ENERGY, (W // 2, 78), shadow=MUTED)
            y = 125
            for head, lines in RULES:
                s.text(head, s.f_mid, ENERGY, (110, y), "midleft"); y += 30
                for l in lines: s.text(l, s.f_sm, CREAM, (130, y), "midleft"); y += 24
                y += 10
            s.button("controls", "CONTROLS", (W // 2 - 130, 562)); s.button("back", "BACK", (W // 2 + 130, 562))
            s.text("ENTER / H  back      C  controls", s.f_sm, GOLD_HI, (W // 2, 628))
            return
        # HUD (after the reference: portraits, chunky bars, score and combo)
        s.portrait(pg.Rect(18, 14, 60, 56), "thanos")
        s.text("THANOS", s.f_sm, CREAM, (90, 18), "topleft")
        s.bar(90, 36, 280, 14, pl.shown_hp / pl.max_hp, pl.trail_hp / pl.max_hp, PLAYER)
        ready = pl.energy >= 100
        s.bar(90, 56, 200, 8, pl.energy / 100, pl.energy / 100, ENERGY if not ready or (s.t // 8) % 2 else FX)
        s.text("SOLAR FLASH READY - PRESS I" if ready else f"SOLAR {int(pl.energy)}%", s.f_sm, FX if ready else GOLD_HI, (298, 60), "midleft")
        cd = pl.dodge_cd / DODGE_COOLDOWN                                                       # dodge cooldown icon
        c = (40, 92); pg.draw.circle(D, INK, c, 13); pg.draw.circle(D, DARK, c, 11)
        if cd > 0: pg.draw.arc(D, GOLD, (c[0] - 11, c[1] - 11, 22, 22), math.pi / 2, math.pi / 2 + math.tau * (1 - cd), 3)
        else: pg.draw.circle(D, ENERGY, c, 11, 2)
        s.text(">>", s.f_sm, CREAM if cd == 0 else MUTED, c)
        s.text(f"{s.score:06d}", s.f_mid, ENERGY, (60, 108), "midleft")
        if s.combo >= 2: s.text(f"x{s.combo}", s.f_big, ENERGY, (175, 112), "midleft", shadow=MUTED)
        s.portrait(pg.Rect(W - 78, 14, 60, 56), "minion")
        s.text("WOLVERINE", s.f_sm, CREAM, (W - 90, 18), "topright")
        s.bar(W - 370, 36, 280, 14, en.shown_hp / en.max_hp, en.trail_hp / en.max_hp, AMBER, right=True)
        if en.stun > 0: s.text(f"STUNNED {en.stun}", s.f_sm, FX, (W - 90, 66), "topright")
        secs = math.ceil(s.round_t / FPS)
        r = pg.Rect(W // 2 - 36, 12, 72, 46); s.panel(r, 220)
        s.text(f"{secs:02d}", s.f_big, FX if secs <= 10 and (s.t // 15) % 2 else ENERGY, r.center)
        # subtitles / state overlays
        if st == "INTRO":
            line = INTRO_LINES[0] if s.intro_t < 150 else INTRO_LINES[1]
            if s.intro_t < 150:
                shown = line[: max(0, s.intro_t // 2)]
                r = pg.Rect(120, H - 74, 660, 44); s.panel(r, 210)
                s.portrait(pg.Rect(128, H - 70, 36, 36), "thanos")
                s.text(shown, s.f_mid, CREAM, (176, H - 52), "midleft")
            else: s.text("FIGHT!", s.f_title, ENERGY, (W // 2, H // 2 - 20), shadow=MUTED)
        elif st == "FIGHT":
            hint = "Wolverine is stunned - strike now!" if en.stun > 0 else ("His claws glow: DODGE (SHIFT) or JUMP!" if en.telegraph() > 0.3 else "")
            if hint: s.text(hint, s.f_mid, FX, (W // 2, H - 40))
        elif st == "PAUSED":
            o = pg.Surface((W, H), pg.SRCALPHA); o.fill((*INK, 150)); D.blit(o, (0, 0))
            s.text("PAUSED", s.f_title, ENERGY, (W // 2, 190), shadow=MUTED)
            s.text("ESC resume   ·   R restart   ·   M mute", s.f_mid, CREAM, (W // 2, 280))
            for i, l in enumerate(("A/D move · W jump · J jab · K sword", "SHIFT dodge · hold L charge · I Solar Flash")): s.text(l, s.f_sm, GOLD_HI, (W // 2, 330 + i * 26))
            s.button("controls", "CONTROLS", (W // 2, 420)); s.button("exit", "EXIT", (W // 2, 474))
        elif st in ("DEFEAT", "BARRIER", "DOOR_REVEAL"):
            s.text("K.O.!" if st == "DEFEAT" else ("THE BARRIER CRACKS..." if st == "BARRIER" else "THE PHASE DOOR OPENS"), s.f_big, ENERGY, (W // 2, 160), shadow=MUTED)
        elif st == "PORTAL":
            s.text("WALK INTO THE PHASE DOOR  >>", s.f_mid, FX if (s.t // 20) % 2 else ENERGY, (W // 2, 160))
        elif st == "GAME_OVER" and s.phase_t > 30:
            o = pg.Surface((W, H), pg.SRCALPHA); o.fill((*DEEP, 190)); D.blit(o, (0, 0))
            s.text("GAME OVER", s.f_title, ENERGY, (W // 2, 250), shadow=MUTED)
            s.text(s.cause, s.f_mid, CREAM, (W // 2, 330))
            s.text("PRESS R TO RESTART", s.f_mid, FX if (s.t // 30) % 2 else ENERGY, (W // 2, 390))
        elif st == "VICTORY":
            k = min(1.0, s.vic_t / VICTORY_FLASH)
            o = pg.Surface((W, H)); o.fill(DOOR); o.set_alpha(int(255 * max(0.0, 1 - abs(s.vic_t - 20) / 20)) if s.vic_t < 40 else 0); D.blit(o, (0, 0))
            if s.vic_t >= VICTORY_FLASH:
                o2 = pg.Surface((W, H), pg.SRCALPHA); o2.fill((*DEEP, int(200 * k))); D.blit(o2, (0, 0))
                s.text("PHASE DOOR UNLOCKED. TRANSITIONING TO LEVEL: BLUE", s.f_mid, DOOR, (W // 2, 290), shadow=MUTED)
                s.text(f"SCORE {s.score:06d}   ·   TIME LEFT {math.ceil(s.round_t / FPS)}s", s.f_sm, GOLD_HI, (W // 2, 330))
                s.text("PRESS R TO RESTART", s.f_mid, FX if (s.t // 30) % 2 else ENERGY, (W // 2, 380))
        if st in ("INTRO", "FIGHT"):                                                            # always-visible reminder button
            cb = pg.Rect(14, H - 34, 150, 24); hover = cb.collidepoint(pg.mouse.get_pos()) if pg.mouse.get_focused() else False
            s.panel(cb, 200, ENERGY if hover else GOLD); s.text("CONTROLS (C)", s.f_sm, FX if hover else CREAM, cb.center, shadow=None); s.buttons["controls"] = cb
        snd = pg.Rect(W - 110, H - 34, 96, 24); s.panel(snd, 200); s.text("MUTED" if s.audio.muted else "SOUND", s.f_sm, CREAM, snd.center, shadow=None); s.buttons["mute"] = snd

    # --------------------------------------------------- loop
    def action(s, k):
        if k != "mute": s.sfx("click")
        if k == "start": s.start()
        elif k == "rules": s.state = "RULES"
        elif k == "back": s.state = "TITLE"
        elif k == "controls": s.open_controls()
        elif k == "close": s.close_controls()
        elif k == "exit": s.running = False
        elif k == "mute": s.audio.toggle()

    def run(s):
        s.running, acc = True, 0.0
        while s.running:
            acc += min(0.1, s.clock.tick(FPS) / 1000)
            for e in pg.event.get():
                if e.type == pg.QUIT: s.running = False
                elif e.type == pg.KEYDOWN: s.key_down(e.key)
                elif e.type == pg.MOUSEBUTTONDOWN and e.button == 1:
                    for k, r in list(s.buttons.items()):
                        if r.collidepoint(e.pos): s.action(k); break
            keys = pg.key.get_pressed()
            s.held.update(left=keys[pg.K_a] or keys[pg.K_LEFT], right=keys[pg.K_d] or keys[pg.K_RIGHT], charge=bool(keys[pg.K_l]))
            while acc >= 1 / FPS:
                s.step(); acc -= 1 / FPS
            s.draw()
        pg.quit()


if __name__ == "__main__":
    Game().run()
    sys.exit()
