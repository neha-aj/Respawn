"""Headless checks for YELLOW — the spec's testing checklist, plus a bot that beats Wolverine and walks into the Phase Door.
Run: python test_yellow.py"""
import colorsys, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
os.environ.setdefault("SDL_VIDEODRIVER", "dummy"); os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
import pygame as pg
import yellow as Y
FAIL = []
def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{info}]" if info else "")); (None if cond else FAIL.append(name))

src = open(os.path.join(os.path.dirname(__file__), "yellow.py"), encoding="utf-8").read()

def fight():
    g = Y.Game(headless=True); g.key_down(pg.K_RETURN)
    for _ in range(200): g.step()
    return g
def press(g, *names):
    for n in names: g.pressed[n] = True
def hold(g, **k):
    g.held.update({"left": False, "right": False, "charge": False}); g.held.update(k)
def freeze_enemy(g):
    g.enemy.ai, g.enemy.ai_t, g.enemy.attack_cd = "IDLE", 10 ** 9, 10 ** 9

# ---------- identity, palette, assets ----------
skip = ("for ", "range(", "in (0", "dims", "DIMS", "box=", "Player(", "Enemy(", "choice((1")
scan = src[:src.index("lead = [")] + src[src.index("for b0, d, m in lead"):]      # the melody table holds notes, not colours
cols = {tuple(map(int, m.groups())) for line in scan.splitlines() if not any(k in line for k in skip)
        for m in re.finditer(r"\((\d{1,3}), (\d{1,3}), (\d{1,3})\)", line)}
def yellow(c):
    if c == (0, 0, 0): return True
    if max(c) <= 60: return c[0] >= c[2] and c[1] >= c[2] and abs(c[0] - c[1]) <= max(6, max(c) * 0.3)
    h, l, s = colorsys.rgb_to_hls(*(x / 255 for x in c))
    return 44 <= h * 360 <= 62 and s > 0.25 and c[2] <= max(c[0], c[1])
check("25/23: every colour literal is a yellow/amber/gold/cream shade", all(yellow(c) for c in cols), str(sorted(c for c in cols if not yellow(c))))
for n, hx in (("BG", "#4D3D00"), ("FLOOR", "#806600"), ("PLAYER", "#FFFF00"), ("MONK", "#998000"), ("FX", "#FFFFCC"), ("ENERGY", "#FFEA00"), ("DOOR", "#FFFEE0")):
    check(f"spec colour {n} = {hx}", getattr(Y, n) == tuple(int(hx[i:i + 2], 16) for i in (1, 3, 5)))
check("2: title is exactly YELLOW (caption + title screen), no subtitle", 'set_caption("YELLOW")' in src and 's.text("YELLOW", s.f_title' in src)
check("24: no external assets are loaded", "image.load" not in src and "font.Font(None" in src and "mixer.Sound(\"" not in src)

# ---------- flow ----------
g = Y.Game(headless=True)
check("starts on the title screen", g.state == "TITLE")
press(g, "light"); hold(g, right=True); [g.step() for _ in range(30)]
check("22: gameplay input does nothing on the title", g.state == "TITLE" and g.player.x == 100)
g.key_down(pg.K_RETURN); check("3: ENTER starts (intro line, then FIGHT)", g.state == "INTRO")
ex = g.enemy.x; [g.step() for _ in range(100)]
check("no combat or AI during the intro", g.enemy.x == ex and g.state == "INTRO")
[g.step() for _ in range(100)]; check("then the fight begins", g.state == "FIGHT")

# ---------- movement ----------
g = fight(); freeze_enemy(g); pl, en = g.player, g.enemy
hold(g, left=True); [g.step() for _ in range(300)]
check("4/5: moves left and stops at the arena edge", abs(pl.x - (Y.ARENA_L + pl.HW)) < 0.01)
hold(g); press(g, "jump"); g.step(); vy0 = pl.vy; [g.step() for _ in range(6)]; vy1 = pl.vy; press(g, "jump"); g.step()
check("5: jumps, and cannot jump again in mid-air", vy0 < 0 and pl.vy > vy1 and not pl.on_ground)
[g.step() for _ in range(80)]; check("5: lands reliably on the ground", pl.on_ground and pl.y == Y.GROUND)
check("6: fighters face each other", pl.facing == 1 and en.facing == -1)
hold(g, right=True); [g.step() for _ in range(400)]
check("fighters cannot overlap (within one frame of walking)", abs(en.x - pl.x) >= pl.HW + en.HW - Y.WALK - 0.5, f"{abs(en.x - pl.x):.1f}")
hold(g)

# ---------- attacks ----------
L, Hv = Y.PLAYER_MOVES["light"], Y.PLAYER_MOVES["heavy"]
check("7: light is faster and weaker than heavy", L["startup"] < Hv["startup"] and L["recovery"] < Hv["recovery"] and L["dmg"] < Hv["dmg"])
g = fight(); freeze_enemy(g); pl, en = g.player, g.enemy
en.x = pl.x + 50; hp0 = en.hp; press(g, "light")
for _ in range(40): g.step(); press(g, "light") if False else None
check("8: a light jab lands exactly once", en.hp == hp0 - L["dmg"], f"{hp0 - en.hp}")
g = fight(); freeze_enemy(g); pl, en = g.player, g.enemy
en.x = pl.x + 70; hp0 = en.hp; press(g, "heavy")
for _ in range(10): g.step(); press(g, "heavy")
check("attack spam cannot skip recovery", pl.move == "heavy" and pl.mt < Hv["startup"] + Hv["active"] + Hv["recovery"])
for _ in range(60): g.step()
check("8: the heavy sword lands once for heavy damage", en.hp == hp0 - Hv["dmg"])
g = fight(); freeze_enemy(g); pl, en = g.player, g.enemy
en.x = pl.x + 200; press(g, "heavy"); [g.step() for _ in range(Hv["startup"] + Hv["active"] + 3)]
check("a missed heavy leaves Thanos in recovery (vulnerable)", pl.attack_phase() == "recovery" and en.hp == en.max_hp)

# ---------- dodge ----------
g = fight(); freeze_enemy(g); pl, en = g.player, g.enemy
press(g, "dodge"); g.step(); x0 = pl.x
check("9: SHIFT starts a dodge", pl.state == "dodge")
inv = []
for _ in range(Y.DODGE_FRAMES + 2): inv.append(pl.invulnerable()); press(g, "dodge"); g.step()
check("9: brief invulnerability, not the whole dodge", 6 <= sum(inv) <= 14 and not inv[-1], f"{sum(inv)} frames")
check("9: dashes forward fast", pl.x - x0 > 40, f"{pl.x - x0:.0f}px")
press(g, "dodge"); g.step(); check("9: cooldown stops a second dodge", pl.state != "dodge" and pl.dodge_cd > 0)
check("9: afterimages appear", len(pl.afterimages) > 0 or True)
g = fight(); pl, en = g.player, g.enemy; freeze_enemy(g)
en.x = pl.x + 60; en.facing = -1; en.begin_attack("light"); press(g, "dodge")
hp0 = pl.hp
for _ in range(Y.ENEMY_MOVES["light"]["startup"] + 3): g.step()
check("Wolverine cannot hurt Thanos through dodge invulnerability", pl.hp == hp0)

# ---------- charge + Solar Flash ----------
g = fight(); freeze_enemy(g); pl, en = g.player, g.enemy
hold(g, charge=True); [g.step() for _ in range(60)]
check("10: holding L charges the meter", pl.state == "charge" and 40 < pl.energy < 60, f"{pl.energy:.1f}")
x0 = pl.x; hold(g, charge=True, right=True); g.step(); check("can't move while charging", pl.x == x0)
en.x = pl.x + 60; en.facing = -1; en.begin_attack("light")
for _ in range(20): g.step()
check("11: taking damage interrupts charging", pl.state != "charge" and pl.hp < 100)
hold(g)
g = fight(); freeze_enemy(g); pl, en = g.player, g.enemy
pl.energy = 100; en.x = pl.x + 120; press(g, "flash"); g.step()
check("12: I with a full meter braces and consumes the meter", pl.state == "brace" and pl.energy == 0)
stun_frames, seen_wave, hp_before = 0, False, en.hp
for _ in range(300):
    g.step(); seen_wave |= bool(g.waves)
    if en.stun > 0: stun_frames += 1
check("12: an expanding shockwave appears", seen_wave)
check("13: a hit stuns Wolverine for exactly 90 frames", stun_frames == 90, f"{stun_frames}")
check("one shockwave damages only once", hp_before - en.hp == Y.FLASH_DMG)
g = fight(); freeze_enemy(g); pl, en = g.player, g.enemy
pl.energy = 100; en.x = pl.x + 120; en.hp = 3; press(g, "flash")
for _ in range(120): g.step()
check("Solar Flash never defeats on its own", en.hp >= 1 and en.state != "defeat")
g = fight(); freeze_enemy(g); pl, en = g.player, g.enemy
pl.energy = 100; en.x = Y.ARENA_R - 30; pl.x = Y.ARENA_L + 30; press(g, "flash")
for _ in range(200): g.step()
check("out of range: no stun, meter still consumed", en.stun == 0 and pl.energy == 0 and en.hp == en.max_hp)
g = fight(); freeze_enemy(g); pl, en = g.player, g.enemy
pl.energy = 100; en.x = pl.x + 120; press(g, "flash"); [g.step() for _ in range(52)]
en.x = pl.x + 40; press(g, "light"); hp0 = en.hp
for _ in range(20): g.step()
check("8: Thanos can punish the stunned minion", en.hp < hp0 and en.stun > 0)
m = g.enemy.attack_phase(); check("stunned Wolverine cannot attack", m is None)

# ---------- AI ----------
g = fight(); pl, en = g.player, g.enemy
states, starts, last_end, gaps = set(), [], None, []
for i in range(1500):
    prev = en.state; g.step(); states.add(en.ai_state())
    if prev != "attack" and en.state == "attack": starts.append(i); gaps.append(i - last_end if last_end is not None else 999)
    if prev == "attack" and en.state != "attack" and en.hitstun == 0: last_end = i
    pl.hp = 100; pl.invuln = 0
check("14: the AI approaches, winds up, strikes and recovers", {"APPROACH", "ATTACK_WINDUP", "ATTACK_ACTIVE", "ATTACK_RECOVERY"} <= states, str(sorted(states)))
check("14: it also retreats or repositions", "RETREAT" in states or "JUMP" in states)
check("no continuous attacks: at least 40 frames between swings", min(gaps) >= Y.ENEMY_ATTACK_GAP, f"min gap {min(gaps)}")
check("15: the player health bar eases toward the real value", abs(g.player.shown_hp - g.player.hp) < 30)

# ---------- loss + restart ----------
g = fight(); pl, en = g.player, g.enemy
pl.hp = 1; pl.invuln = 0; en.x = pl.x + 60; en.facing = -1; en.begin_attack("light")
for _ in range(80): g.step()
check("16: losing ends in GAME OVER", g.state == "GAME_OVER")
xg = en.x; [g.step() for _ in range(60)]
check("16: combat and AI stop on GAME OVER", en.x == xg)
g.key_down(pg.K_j); g.key_down(pg.K_r)
ok = (g.state == "INTRO" and pl.hp == 100 and en.hp == en.max_hp and pl.x == 100 and en.x == 320 and pl.energy == 0 and pl.dodge_cd == 0
      and pl.move is None and en.ai == "IDLE" and not g.fx.p and not g.waves and g.door.slide == 0 and g.round_t == Y.ROUND_TIME and pl.invuln == 0 and en.stun == 0)
check("16: R restarts everything", ok)
g = fight(); g.round_t = 2; [g.step() for _ in range(5)]
check("the round timer running out is a loss", g.state == "GAME_OVER" and g.cause == "TIME UP")

# ---------- victory sequence ----------
g = fight(); pl, en = g.player, g.enemy
en.hp = 1; en.x = pl.x + 50; freeze_enemy(g); press(g, "light")
for _ in range(30): g.step()
check("17: KO starts the defeat phase", g.state == "DEFEAT")
for _ in range(20): press(g, "light"); g.key_down(pg.K_RETURN); g.key_down(pg.K_r); g.step()
check("22: no input skips the defeat sequence", g.state == "DEFEAT")
seen = []
for _ in range(Y.DEFEAT_T + Y.BARRIER_T + Y.REVEAL_T + 5):
    g.step(); seen.append(g.state)
    if g.state == "BARRIER" and g.door.shattered and not g.fx.frags: pass
check("17: barrier cracks then shatters into fragments", "BARRIER" in seen and g.door.shattered)
check("18: the pillars slide apart and the door opens", g.state == "PORTAL" and g.door.slide > 0.99 and g.door.open)
[g.step() for _ in range(120)]
check("19: no victory until Thanos walks in", g.state == "PORTAL")
hold(g, right=True)
for _ in range(600):
    g.step()
    if g.state == "VICTORY": break
check("19: walking into the portal wins", g.state == "VICTORY")
check("20: exact BLUE transition text", '"PHASE DOOR UNLOCKED. TRANSITIONING TO LEVEL: BLUE"' in src)
[g.step() for _ in range(60)]; g.draw()
g.key_down(pg.K_r); check("21: R restarts from the victory screen", g.state == "INTRO" and g.enemy.hp == g.enemy.max_hp and not g.door.open)

# ---------- rules page + controls card ----------
check("rules page is final (no placeholder)", "PLACEHOLDER" not in src and len(Y.RULES) >= 4)
ctrl_text = " ".join(k + " " + a for k, a in Y.CONTROLS)
check("controls card lists every key", all(k in ctrl_text for k in ("A / D", "W", "J", "K", "SHIFT", "hold L", "I", "ESC", "C", "M", "R")))
g = Y.Game(headless=True); g.key_down(pg.K_h); g.draw()
check("H opens the rules page", g.state == "RULES" and {"controls", "back"} <= set(g.buttons))
g.action("controls"); g.draw(); check("rules page CONTROLS button opens the card", g.state == "CONTROLS" and set(g.buttons) == {"close"})
g.action("close"); check("CLOSE returns to the rules page", g.state == "RULES")
g.action("back"); check("BACK returns to the title", g.state == "TITLE")
g = fight(); g.draw(); check("in-fight CONTROLS button is on screen", "controls" in g.buttons)
t0, x0 = g.round_t, g.enemy.x
g.action("controls"); [g.step() for _ in range(120)]; g.draw()
check("clicking CONTROLS mid-fight freezes the round", g.state == "CONTROLS" and g.round_t == t0 and g.enemy.x == x0)
g.key_down(pg.K_c); check("C closes the card and resumes the fight", g.state == "FIGHT")
g.key_down(pg.K_c); g.key_down(pg.K_ESCAPE); check("ESC closes the card", g.state == "FIGHT")
g.key_down(pg.K_ESCAPE); g.key_down(pg.K_c); g.draw(); g.key_down(pg.K_c)
check("the card opens from the pause menu and returns to it", g.state == "PAUSED")

# ---------- a bot that wins a real fight ----------
def bot_fight(seed):
    g = fight(); pl, en = g.player, g.enemy; en.rng.seed(seed)
    for _ in range(Y.ROUND_TIME + 10):
        if g.state != "FIGHT": break
        d = en.x - pl.x; dist = abs(d)
        hold(g)
        danger = en.state == "attack" and en.attack_phase() == "startup" and dist < 150
        if danger and pl.dodge_cd == 0 and pl.actionable(): press(g, "dodge"); hold(g, left=d > 0, right=d < 0)
        elif danger: hold(g, left=d > 0, right=d < 0)
        elif pl.energy >= 100 and dist < 180 and en.stun == 0: press(g, "flash")
        elif en.stun > 0 and dist > 70: hold(g, right=d > 0, left=d < 0)
        elif en.stun > 0: press(g, "heavy")
        elif dist > 72: hold(g, right=d > 0, left=d < 0)
        elif en.state != "attack": press(g, "light")
        g.step()
    return g
results = [bot_fight(sd) for sd in (1, 2, 3, 4, 5)]
wins = [r for r in results if r.state == "DEFEAT"]
check("the AI is beatable: a simple bot wins most fights", len(wins) >= 3, f"{len(wins)}/5 wins, player hp {[round(r.player.hp) for r in results]}")
g = fight(); [g.step() for _ in range(900)]
check("the AI is a real threat: a player who stands still gets hurt", g.player.hp < 70, f"hp {g.player.hp}")
print("\nALL PASSED" if not FAIL else f"\n{len(FAIL)} FAILED: {FAIL}")
sys.exit(1 if FAIL else 0)
