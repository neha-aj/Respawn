"""Headless checks for ORANGE — the spec's mandatory list, scoring maths and typing bots that win and lose.  Run: python test_orange.py"""
import colorsys, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
os.environ.setdefault("SDL_VIDEODRIVER", "dummy"); os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
import pygame as pg
import orange as O
FAIL = []
def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{info}]" if info else "")); (None if cond else FAIL.append(name))

src = open(os.path.join(os.path.dirname(__file__), "orange.py"), encoding="utf-8").read()

# ---------- identity and palette ----------
skip = ("melody", "chords", ".5,", "(45, (", "(41, (", "(48, (", "(43, (", "(40, (", "choice((1")    # note/chord tables, not colours
cols = {tuple(map(int, m.groups())) for line in src.splitlines() if not any(k in line for k in skip)
        for m in re.finditer(r"(?<!range)\((\d{1,3}), (\d{1,3}), (\d{1,3})\)", line)}
def orange(c):
    if c == (0, 0, 0) or c == (150, 140, 128): return True                  # transparent fill / multiply dimmer
    if max(c) <= 24: return c[0] >= c[1] >= c[2]
    h, l, s = colorsys.rgb_to_hls(*(x / 255 for x in c))
    return c[0] >= c[1] >= c[2] and 10 <= h * 360 <= 48 and s > 0.2
check("every colour literal is an orange shade", all(orange(c) for c in cols), str(sorted(c for c in cols if not orange(c))))
for n, hx in (("STAGE", "#3A1300"), ("SPOT", "#FF6600"), ("DANCER", "#FF9900"), ("HUD_C", "#FFE5CC"), ("DOOR", "#FFF0E0")):
    check(f"spec colour {n} = {hx}", getattr(O, n) == tuple(int(hx[i:i + 2], 16) for i in (1, 3, 5)))
check("title is exactly ORANGE (window caption and title screen)", 'set_caption("ORANGE")' in src and '"ORANGE", 14' in src)
texts = re.findall(r'"([A-Z0-9 .,:%/\-!?\'()+=<>·#]{3,})"', src)
check("the pixel font can draw every on-screen string", all(all(ch in O.FONT for ch in t) for t in texts), str([t for t in texts if not all(ch in O.FONT for ch in t)][:3]))
check("exact RED transition text", "PHASE DOOR UNLOCKED." in src and "TRANSITIONING TO LEVEL: RED" in src and "PRESS R TO RESTART" in src)
check("no external files are loaded", "image.load" not in src and "mixer.Sound(\"" not in src and "font.Font(" not in src)

# ---------- scoring maths ----------
tp = O.Typing(__import__("random").Random(1))
check("accuracy is 100% before any attempt", tp.accuracy() == 100.0 and tp.attempts == 0)
check("WPM handles zero elapsed time", tp.wpm(0) == 0.0)
tp.net = 200; check("WPM = correct chars × 12 / seconds (200 chars in 60 s = 40 WPM)", tp.wpm(60) == 40.0)
tp.reset(); w = tp.text
for ch in w[:2]: tp.press(ch)
wrong = "Q" if w[2] != "Q" else "Z"; tp.press(wrong)
check("a wrong letter is an error and does not advance", tp.wrong == 1 and tp.pos == 2)
tp.backspace(); tp.backspace(); tp.backspace()
check("backspace fixes progress but never erases the error", tp.pos == 0 and tp.wrong == 1 and tp.net == 0 and tp.correct == 2)
check("backspace cannot go past the start of the word", tp.backspace() is False)
first = tp.text; results = [tp.press(ch) for ch in tp.text]
check("a space finishes a word, the last character finishes the sentence", results.count("word") == first.count(" ") and results[-1] == "sentence" and tp.sentences == 1 and tp.pos == 0)
check("completed sentences cannot be backspaced", tp.backspace() is False and tp.sentences == 1)
tp2 = O.Typing(__import__("random").Random(5)); seen = [tp2.text] + [tp2.pick() for _ in range(len(O.SENTENCES) - 1)]
check("sentences never repeat until every one has been used", len(set(seen)) == len(O.SENTENCES))
check("every sentence fits on at most two lines and uses only typable characters", all(len(O.wrap(x)) <= 2 for x in O.SENTENCES) and set("".join(O.SENTENCES)) <= O.TYPABLE)
g0 = O.Game(headless=True); g0.key_enter(); g0.key_enter(); s1 = g0.typing.text; g0.reset(); g0.state = "PLAYING"
check("a restart deals a fresh sentence, not the same one again", g0.typing.text != s1)

# ---------- states and inputs ----------
g = O.Game(headless=True)
check("starts on the title screen", g.state == "TITLE")
g.key_char("A"); check("typing on the title counts nothing", g.typing.attempts == 0)
g.key_enter(); check("ENTER opens the ready screen", g.state == "READY")
g.key_char("A"); [g.step(1 / 60) for _ in range(30)]
check("typing on the ready screen counts nothing and the timer has not started", g.typing.attempts == 0 and g.elapsed == 0)
g.key_enter(); check("ENTER starts the 60-second challenge", g.state == "PLAYING" and g.elapsed == 0)
pose0 = dict(g.dancer.target); g.key_char(g.typing.text[0]); [g.step(1 / 60) for _ in range(3)]
check("a correct letter changes the dance pose immediately", g.dancer.target != pose0 and g.typing.pos == 1)
targets = set()
for _ in range(8): g.key_char(g.typing.text[g.typing.pos]); targets.add(tuple(sorted(g.dancer.target.items())))
check("keystrokes cycle through many different poses", len(targets) >= 6, f"{len(targets)} poses")
cur = dict(g.dancer.cur); g.step(1 / 60)
check("poses interpolate (no teleport in one frame)", any(abs(g.dancer.cur[k] - g.dancer.target[k]) > 1e-3 for k in cur))
while g.typing.text[g.typing.pos] != " ": g.key_char(g.typing.text[g.typing.pos])
g.key_char(" ")
check("a space (finished word) triggers a big accent (spin or jump)", g.dancer.spin_v > 0 or g.dancer.target["dy"] <= -10)
sent0 = g.typing.sentences
while g.typing.sentences == sent0: g.key_char(g.typing.text[g.typing.pos])
check("finishing a sentence triggers the biggest accent", g.dancer.target["dy"] <= -10 and g.dancer.spin_v > 0 and g.word_pop is not None)
g.key_char("Q" if g.typing.text[g.typing.pos] != "Q" else "Z")
check("a wrong letter triggers the stumble", g.dancer.target == O.POSES["stumble"] and g.typing.wrong == 1)
g.key_escape(); t0 = g.elapsed; [g.step(1 / 60) for _ in range(120)]
check("ESC pauses: timer frozen", g.state == "PAUSED" and g.elapsed == t0)
g.key_char("A"); check("no typing while paused", g.typing.wrong == 1 and g.typing.correct > 0)
g.key_r(); check("R does nothing during a challenge (it is a typing letter)", g.state == "PAUSED")
g.key_escape(); check("ESC resumes", g.state == "PLAYING")
for _ in range(60): g.step(1 / 60)
check("the timer counts down in real time", abs(g.elapsed - t0 - 1.0) < 0.02, f"{g.elapsed - t0:.3f}")

def bot(cps, err_every=0, seconds=61.0):
    g = O.Game(headless=True); g.key_enter(); g.key_enter()
    t, nxt, n = 0.0, 0.0, 0
    while g.state == "PLAYING" and t < seconds + 1:
        if t >= nxt:
            n += 1
            if err_every and n % err_every == 0: g.key_char("Q" if g.typing.text[g.typing.pos] != "Q" else "Z")
            else: g.key_char(g.typing.text[g.typing.pos])
            nxt += 1 / cps
        g.step(1 / 60); t += 1 / 60
    return g

g = bot(4.0)                                                                       # 48 WPM, perfect
check("timer ends at exactly 60 s and freezes the result", g.elapsed == O.CHALLENGE and g.state == "VICTORY_DANCE", f"{g.final_wpm:.1f} WPM")
check("final WPM uses exactly 60 s", abs(g.final_wpm - g.typing.net * 12 / 60) < 1e-9)
frozen = (g.final_wpm, g.final_acc, g.typing.correct)
g.key_char("A"); g.key_escape(); g.key_r(); g.key_enter()
check("no input changes the result or skips the ending", (g.final_wpm, g.final_acc, g.typing.correct) == frozen and g.state == "VICTORY_DANCE")
seen = []
for _ in range(int((O.VICTORY_DANCE_T + O.DOOR_T + O.ENTRY_T + 1) * 60)):
    g.step(1 / 60)
    if g.state not in seen: seen.append(g.state)
    if g.state == "DOOR_OPENING" and g.stage.spk_open > 0.5: mid_open = g.stage.spk_open
    if g.state == "PORTAL_ENTRY": mid_x = g.dancer.x
    if not seen or g.state == "VICTORY_DANCE": g.draw()
check("victory → speakers part → portal entry → transition", seen == ["VICTORY_DANCE", "DOOR_OPENING", "PORTAL_ENTRY", "TRANSITION_SCREEN"], str(seen))
check("the speakers slide all the way apart", g.stage.spk_open > 0.99)
check("the dancer walks into the portal", g.dancer.x > 370 and g.dancer.scale_k < 0.05)
g.draw(); g.key_r()
check("R on the transition screen restarts ORANGE at the ready screen", g.state == "READY" and g.typing.attempts == 0 and g.stage.spk_open == 0 and g.dancer.x == O.DANCER_X and g.won is None and not g.fx.p)

g = bot(3.0)                                                                       # 36 WPM
check("too slow loses even with perfect accuracy", g.state == "GAME_OVER" and g.final_acc == 100.0 and g.final_wpm < 40, f"{g.final_wpm:.1f} WPM")
for _ in range(90): g.step(1 / 60)
check("failure collapses the dancer", g.dancer.mode == "pose" and abs(g.dancer.cur["lean"] - O.POSES["collapse"]["lean"]) < 0.05)
g.draw()
g.key_r(); check("R retries from the ready screen with everything reset", g.state == "READY" and g.typing.attempts == 0 and g.elapsed == 0 and g.dancer.mode == "groove")
g = bot(6.0, err_every=6)                                                          # fast but ~83 % accurate
check("fast but inaccurate loses", g.state == "GAME_OVER" and g.final_wpm >= 40 and g.final_acc < 88, f"{g.final_wpm:.1f} WPM {g.final_acc:.1f}%")
g = bot(5.0, err_every=12)                                                         # ~91.7 % accurate
check("≥ 40 WPM and ≥ 88 % accuracy wins", g.state == "VICTORY_DANCE", f"{g.final_wpm:.1f} WPM {g.final_acc:.1f}%")
g = O.Game(headless=True); g.key_enter(); g.key_enter()
for _ in range(3700): g.step(1 / 60)
check("typing nothing never wins", g.state == "GAME_OVER" and g.won is False)
check("early high WPM alone is not victory (judged only at 60 s)", "s.elapsed >= CHALLENGE: s.finish()" in src)

print("\nALL PASSED" if not FAIL else f"\n{len(FAIL)} FAILED: {FAIL}")
sys.exit(1 if FAIL else 0)
