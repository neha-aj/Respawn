"""
ORANGE
A typing-dance rhythm game in chibi pixel art. Type whole sentences; every correct keystroke is a
dance move for Thanos. Hold at least 40 WPM with at least 88% accuracy for 60 seconds and the
speakers slide apart to reveal the Phase Door to RED.

Standalone: Python 3 + pygame only (python -m pip install pygame). Every pixel, glyph,
sound effect and the music are generated in code. Orange shades only.
Keys: type the sentence (letters, spaces, punctuation) · BACKSPACE fix the current sentence · ENTER start · ESC pause/resume
      R restart (after a result) · M mute (outside the challenge) · close the window to quit
"""
import array, math, random, sys, threading
import pygame as pg

W, H, FPS, SCALE = 900, 650, 60, 2
LW, LH = W // SCALE, H // SCALE                     # 450 × 325 pixel-art canvas, scaled ×2 with hard pixels
CHALLENGE = 60.0
TARGET_WPM, TARGET_ACC = 40, 88.0
BPM = 120.0
BEAT = 60.0 / BPM
VICTORY_DANCE_T, DOOR_T, ENTRY_T = 2.6, 2.6, 3.2
MAX_PARTICLES = 260
GROUND, DANCER_X = 236, 150                         # dancer's feet on the floor (canvas px)

# ---- strict orange palette (spec primaries first, then orange-derived shades) ----
STAGE, SPOT, DANCER, HUD_C, DOOR = (58, 19, 0), (255, 102, 0), (255, 153, 0), (255, 229, 204), (255, 240, 224)
INK, DEEP, DARK, BURNT, TERRA, MID = (20, 6, 0), (40, 12, 0), (90, 32, 0), (140, 52, 0), (180, 70, 10), (230, 110, 20)
AMBER, LAMBER, PEACH, SKIN_SH, HI, GLOWC = (255, 176, 64), (255, 204, 128), (255, 190, 120), (214, 112, 0), (255, 196, 110), (255, 140, 30)

SENTENCES = [                                       # original lines; dealt from a shuffled deck so none repeats
    "THANOS DANCES ON THE STAGE TONIGHT.", "THE GAUNTLET GLOWS WITH EVERY BEAT.", "SIX STONES SPARKLE UNDER THE LIGHTS.",
    "THE CROWD WAVES THEIR GLOWSTICKS HIGH.", "A TITAN NEVER MISSES A SINGLE STEP.", "SPIN AROUND AND SNAP YOUR FINGERS.",
    "THE SPEAKERS SHAKE THE WHOLE CLUB.", "BALANCE THE RHYTHM, BALANCE THE WORLD.", "THE AVENGERS WATCH IN SILENCE.",
    "EVERY KEY YOU PRESS IS A NEW MOVE.", "THE DISCO FLOOR LIGHTS UP IN ORANGE.", "KEEP YOUR FINGERS LIGHT AND QUICK.",
    "THE BASS LINE BOUNCES OFF THE WALLS.", "IRON MAN CANNOT BELIEVE HIS EYES.", "THOR DROPS HIS HAMMER IN SURPRISE.",
    "THE HULK TRIES TO DANCE BUT FALLS.", "SPIDER MAN FEELS A STRANGE TINGLE.", "CAPTAIN AMERICA SALUTES THE GROOVE.",
    "BLACK WIDOW TAPS HER FOOT TO THE BEAT.", "DOCTOR STRANGE SEES ONE WINNING DANCE.", "GROOT SWAYS SLOWLY IN THE BACK ROW.",
    "LOKI CLAIMS HE TAUGHT THANOS TO DANCE.", "THE PHASE DOOR WAITS BEHIND THE SPEAKERS.", "TYPE FAST AND THE TITAN WILL GROOVE.",
    "A PERFECT SPIN EARNS A LOUD CHEER.", "THE SPOTLIGHTS SWEEP ACROSS THE CROWD.", "ONE MORE SONG BEFORE THE FINAL SNAP.",
    "THE MUSIC NEVER STOPS ON TITAN.", "STARS FLICKER ABOVE THE DANCE FLOOR.", "THANOS WEARS SUNGLASSES INDOORS.",
    "THE PURPLE GIANT LOVES A GOOD BEAT.", "HEROES AND VILLAINS SHARE ONE STAGE.", "FOLLOW THE RHYTHM WITH YOUR HANDS.",
    "THE INFINITY STONES HUM IN TUNE.", "A COSMIC PARTY NEEDS A COSMIC DJ.", "STEP LEFT, STEP RIGHT, NOW JUMP HIGH.",
    "THE GAUNTLET CLICKS ON EVERY SNAP.", "NEVER STOP MOVING YOUR FEET.", "THE ORANGE GLOW FILLS THE ROOM.",
    "SMOOTH MOVES BEAT SPEED EVERY TIME.", "THE CROWD CHANTS THE NAME OF THE TITAN.", "HAWKEYE AIMS AN ARROW AT THE DISCO BALL.",
    "ANT MAN DANCES ON THE SPEAKER CONE.", "THE GUARDIANS BROUGHT THEIR OWN MIXTAPE.", "STAR LORD WANTS A DANCE BATTLE.",
    "ROCKET COUNTS EVERY MISSED STEP.", "VISION FLOATS ABOVE THE DANCE FLOOR.", "THE BEAT DROPS AND THE ROOM JUMPS.",
    "A SINGLE SNAP CAN END THE SONG.", "KEEP CALM AND KEEP TYPING.", "THE TITAN BOWS TO A ROARING CROWD.",
    "SHUFFLE YOUR FEET AND SWING YOUR ARMS.", "THE NIGHT IS YOUNG AND THE MUSIC IS LOUD.", "FIND THE RHYTHM AND HOLD IT TIGHT.",
    "NO HERO CAN STOP THIS GROOVE.", "THE DRUMS ROLL LIKE DISTANT THUNDER.", "WAKANDA SENDS ITS BEST DRUMMERS.",
    "THE BALCONY SHAKES WITH EVERY BASS HIT.", "FALCON GLIDES OVER THE CHEERING FANS.", "THE LAST SONG BELONGS TO THANOS.",
]
TYPABLE = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ .,")
LINE_CHARS = 40                                     # sentence panel wraps at 40 characters per line

# ---- 5×7 pixel font (hex rows) ----
FONT_SRC = ("A0e11111f111111|B1e11111e11111e|C0e11101010110e|D1e11111111111e|E1f10101e10101f|F1f10101e101010|G0e11101711110f|"
            "H1111111f111111|I0e04040404040e|J0702020202120c|K11121418141211|L1010101010101f|M111b1515111111|N11111915131111|"
            "O0e11111111110e|P1e11111e101010|Q0e11111115120d|R1e11111e141211|S0f10100e01011e|T1f040404040404|U1111111111110e|"
            "V1111111111 0a04|W1111111515150a|X11110a040a1111|Y11110a04040404|Z1f01020408101f|00e11131519110e|1040c040404040e|"
            "20e11010204081f|31f02040201110e|402060a121f0202|51f101e0101110e|606081 01e11110e|71f010204080808|80e11110e11110e|"
            "90e11110f01020c|.0000000000 0c0c|,000000000c0408|:000c0c000c0c00|%1819020408 1303|/00010204081000|-0000001f000000|"
            "!04040404040004|?0e110102040004|'04040800000000|(02040808080402|)08040202020408|+0004041f040400|=00001f001f0000|"
            ">08040201020408|<02040810080402|*00000004000000|#0a0a1f0a1f0a0a")
FONT = {" ": [0] * 7}
for g in FONT_SRC.split("|"):
    g = g.replace(" ", "")
    FONT[g[0]] = [int(g[1 + 2 * i:3 + 2 * i], 16) for i in range(7)]
FONT["·"] = FONT["*"]


class PixelFont:
    """Crisp 5×7 bitmap text, cached per (text, pixel size, colour)."""
    def __init__(s): s.cache = {}
    @staticmethod
    def width(text, px): return max(0, len(text) * 6 - 1) * px
    def render(s, text, px, col):
        key = (text, px, col)
        if key not in s.cache:
            surf = pg.Surface((max(1, s.width(text, px)), 7 * px), pg.SRCALPHA)
            for i, ch in enumerate(text):
                rows = FONT.get(ch, FONT["?"])
                for r, bits in enumerate(rows):
                    for c in range(5):
                        if bits & (16 >> c): surf.fill(col, (i * 6 * px + c * px, r * px, px, px))
            if len(s.cache) > 500: s.cache.clear()
            s.cache[key] = surf
        return s.cache[key]
    def draw(s, surf, text, px, col, pos, anchor="center", shadow=INK):
        img = s.render(text, px, col)
        r = img.get_rect(**{anchor: pos})
        if shadow is not None: surf.blit(s.render(text, px, shadow), r.move(px, px))
        surf.blit(img, r)
        return r


# =============================================================== typing & scoring
class Typing:
    """One sentence at a time, typed character by character (spaces count, as in standard WPM).
    Accuracy counts every keystroke ever made; WPM counts kept correct characters / 5.
    Sentences come from a shuffled deck that survives restarts, so none repeats until all have been used."""
    def __init__(s, rng): s.rng, s.deck, s.last = rng, [], None; s.reset()
    def reset(s):
        s.correct = s.wrong = s.net = s.words = s.sentences = 0
        s.streak = s.best = 0
        s.done = ""
        s.text = s.pick()
        s.pos = 0
    def pick(s):
        if not s.deck:
            s.deck = SENTENCES[:]; s.rng.shuffle(s.deck)
            if s.deck[-1] == s.last: s.deck.insert(0, s.deck.pop())     # never the same line twice in a row
        s.last = s.deck.pop()
        return s.last
    @property
    def attempts(s): return s.correct + s.wrong
    def accuracy(s): return 100.0 if s.attempts == 0 else s.correct / s.attempts * 100.0
    def wpm(s, elapsed): return 0.0 if elapsed <= 0 else s.net * 12.0 / elapsed
    def press(s, ch):
        """Returns 'correct', 'word' (finished a word), 'sentence' (finished the sentence) or 'wrong'."""
        if ch == s.text[s.pos]:
            s.correct += 1; s.net += 1; s.pos += 1; s.streak += 1; s.best = max(s.best, s.streak)
            if s.pos == len(s.text):
                s.words += 1; s.sentences += 1; s.done = s.text; s.text = s.pick(); s.pos = 0
                return "sentence"
            if ch == " ": s.words += 1; return "word"
            return "correct"
        s.wrong += 1; s.streak = 0
        return "wrong"
    def backspace(s):
        if s.pos == 0: return False                              # finished sentences can never be erased
        s.pos -= 1; s.net -= 1
        if s.text[s.pos] == " ": s.words -= 1
        return True


def wrap(text, width=LINE_CHARS):
    """Greedy word wrap; returns (start index, line) pairs. Each line keeps its trailing space."""
    lines, start, cur = [], 0, ""
    for word in text.split(" "):
        piece = word + " "
        if cur and len(cur) + len(word) > width:
            lines.append((start, cur)); start += len(cur); cur = ""
        cur += piece
    cur = cur[:-1]
    lines.append((start, cur))
    return lines


# =============================================================== sound
class Synth:
    SR = 22050
    def __init__(s):
        s.ok, s.muted, s.snd, s.music, s.mchan = False, False, {}, None, None
        try: pg.mixer.quit(); pg.mixer.init(s.SR, -16, 1, 512); s.ok = pg.mixer.get_init() == (s.SR, -16, 1)   # pg.init() opened 44.1 kHz stereo
        except pg.error: s.ok = False
        if not s.ok: return
        pg.mixer.set_num_channels(24)
        rnd = random.Random(7); nz = lambda: rnd.uniform(-1, 1); ex, sin, tau = math.exp, math.sin, math.tau
        def mk(dur, fn):
            return pg.mixer.Sound(buffer=array.array("h", (int(max(-1, min(1, fn(i / s.SR))) * 30000) for i in range(int(dur * s.SR)))).tobytes())
        s.keys = []                                                            # a pentatonic pluck per keystroke
        for m in (69, 72, 74, 76, 79, 81, 84, 86, 88, 91):
            f = 440 * 2 ** ((m - 69) / 12)
            s.keys.append(mk(0.16, lambda t, f=f: ((sin(tau * f * t) > 0) * 2 - 1) * 0.22 * ex(-t * 22) + sin(tau * f * 2 * t) * 0.2 * ex(-t * 30)))
        s.snd["wrong"] = mk(0.22, lambda t: (((t * 92) % 1) * 2 - 1 + ((t * 97) % 1) * 2 - 1) * 0.3 * ex(-t * 14))
        s.snd["word"] = mk(0.45, lambda t: sum(sin(tau * f * t) * ex(-max(0, t - d) * 9) * (t >= d) for f, d in ((880, 0), (1108.7, 0.05), (1318.5, 0.1))) * 0.3 + nz() * 0.15 * ex(-t * 18))
        s.snd["cheer"] = mk(1.1, lambda t: nz() * (0.5 + 0.3 * sin(tau * 9 * t)) * min(1, t * 8) * ex(-t * 2.2) * 0.45)
        s.snd["pace"] = mk(0.9, lambda t: sum(((t * f) % 1 * 2 - 1) * (t >= d) * ex(-max(0, t - d) * 4) for f, d in ((523.3, 0), (659.3, 0.12), (784, 0.24), (1046.5, 0.36))) * 0.18)
        s.snd["tick"] = mk(0.12, lambda t: sin(tau * 1200 * t) * ex(-t * 30) * 0.5)
        s.snd["go"] = mk(0.7, lambda t: (sin(tau * (900 + 400 * min(1, t * 4)) * t) * 0.4 + sin(tau * 440 * t) * 0.25) * ex(-t * 3))
        s.snd["fail"] = mk(1.8, lambda t: sum((((t * f * (1 - 0.06 * math.floor(t / 0.42)))) % 1 * 2 - 1) for f in (233.1, 233.8)) * 0.16 * (0.6 + 0.4 * sin(tau * 6 * t)) * ex(-t * 0.9))
        s.snd["win"] = mk(1.6, lambda t: sum(((t * f) % 1 * 2 - 1) * (t >= d) * ex(-max(0, t - d) * 2.2) for f, d in ((392, 0), (523.3, 0.16), (659.3, 0.32), (784, 0.48), (1046.5, 0.64))) * 0.16)
        s.snd["slide"] = mk(2.4, lambda t: (nz() * 0.5 + sin(tau * 48 * t)) * 0.35 * min(1, t * 3) * ex(-t * 0.8))
        s.snd["portal"] = mk(2.6, lambda t: (sin(tau * (150 + 600 * t * t) * t) * 0.4 + nz() * 0.1) * min(1, t * 2) * ex(-t * 0.9))
        s.snd["snap"] = mk(0.9, lambda t: (nz() * ex(-t * 90) * 0.9 + sin(tau * 2200 * t) * ex(-t * 60) * 0.3 + nz() * 0.08 * ex(-t * 3)))
        s.snd["click"] = mk(0.05, lambda t: sin(tau * 1700 * t) * ex(-t * 70) * 0.4)
        s.mchan = pg.mixer.Channel(0)
        threading.Thread(target=s.build_music, daemon=True).start()               # ~1 s of synthesis, off the main thread

    def build_music(s):
        """Original 120 BPM superhero-disco loop (8 bars): four-on-the-floor kick, claps, hats, octave disco bass,
        a heroic brass-style lead and a soft pad. Steady pulse, made for typing to."""
        sr, tau = s.SR, math.tau
        n = int(32 * BEAT * sr); buf = [0.0] * n; rnd = random.Random(3)
        mf = lambda m: 440 * 2 ** ((m - 69) / 12)
        chords = [(45, (57, 60, 64)), (41, (57, 60, 65)), (48, (55, 60, 64)), (43, (55, 59, 62)),
                  (45, (57, 60, 64)), (41, (57, 60, 65)), (43, (55, 59, 62)), (40, (56, 59, 64))]
        def add(start, dur, fn):
            a = int(start * sr)
            for i in range(a, min(n, a + int(dur * sr))): buf[i] += fn((i - a) / sr)
        for b in range(32):                                                   # drums
            t0 = b * BEAT
            add(t0, 0.3, lambda t: math.sin(tau * (45 + 90 * math.exp(-t * 30)) * t) * math.exp(-t * 9) * 0.55)
            if b % 2 == 1: add(t0, 0.18, lambda t: rnd.uniform(-1, 1) * math.exp(-t * 22) * 0.28)
            add(t0 + BEAT / 2, 0.05, lambda t: rnd.uniform(-1, 1) * math.exp(-t * 80) * 0.14)
            add(t0 + BEAT * 0.75, 0.03, lambda t: rnd.uniform(-1, 1) * math.exp(-t * 120) * 0.06)
        for bar, (root, tones) in enumerate(chords):                          # disco octave bass + pad
            for e in range(8):
                f = mf(root + (12 if e % 2 else 0))
                add(bar * 4 * BEAT + e * BEAT / 2, 0.2, lambda t, f=f: (math.sin(tau * f * t) + 0.35 * (1 if math.sin(tau * f * t) > 0 else -1)) * math.exp(-t * 7) * 0.24)
            for m in tones:
                f = mf(m)
                add(bar * 4 * BEAT, 4 * BEAT, lambda t, f=f: math.sin(tau * f * t) * 0.05 * min(1, t * 4) * min(1, (4 * BEAT - t) * 4))
        melody = [(0, .5, 69), (.5, .5, 69), (1, 1.5, 76), (2.5, .5, 74), (3, 1, 72), (4, .5, 72), (4.5, .5, 74), (5, 1.5, 77), (6.5, .5, 76), (7, 1, 72),
                  (8, .5, 76), (8.5, .5, 76), (9, 1.5, 79), (10.5, .5, 77), (11, 1, 76), (12, 1, 74), (13, 1, 71), (14, 2, 74),
                  (16, .5, 69), (16.5, .5, 72), (17, .5, 76), (17.5, 1.5, 81), (19, 1, 79), (20, 1.5, 77), (21.5, .5, 76), (22, 1, 72), (23, 1, 69),
                  (24, .5, 71), (24.5, .5, 74), (25, 1.5, 79), (26.5, .5, 77), (27, 1, 74), (28, 1, 76), (29, 1, 80), (30, 2, 83)]
        for beat, dur, m in melody:                                           # heroic brass-style lead
            f, d = mf(m), dur * BEAT
            def lead(t, f=f, d=d):
                v = f * (1 + 0.004 * math.sin(tau * 5.5 * t) * min(1, t * 3))
                saw = ((t * v) % 1) * 2 - 1 + (((t * v * 1.005) % 1) * 2 - 1) * 0.6
                return saw * 0.085 * min(1, t * 40) * (0.75 + 0.25 * math.exp(-t * 6)) * min(1, (d - t) * 25)
            add(beat * BEAT, d, lead)
        lp, peak = 0.0, 0.0
        for i in range(n): lp += (buf[i] - lp) * 0.55; buf[i] = lp; peak = max(peak, abs(lp))
        k = 0.92 / max(peak, 1e-6)
        s.music = pg.mixer.Sound(buffer=array.array("h", (int(x * k * 30000) for x in buf)).tobytes())

    def play(s, name, vol=1.0):
        if s.ok and not s.muted and name in s.snd: s.snd[name].set_volume(vol); s.snd[name].play()
    def key(s, i):
        if s.ok and not s.muted: s.keys[i % len(s.keys)].play()
    def music_on(s):
        if s.ok and not s.muted and s.music is not None and not s.mchan.get_busy(): s.mchan.play(s.music, loops=-1); s.mchan.set_volume(0.55)
    def music_pause(s, on):
        if s.ok and s.mchan: (s.mchan.pause() if on else s.mchan.unpause())
    def music_stop(s):
        if s.ok and s.mchan: s.mchan.stop()
    def toggle(s):
        s.muted = not s.muted
        if not s.ok: return
        if s.muted: pg.mixer.pause()
        else: pg.mixer.unpause()


class Mute:
    muted = False
    def play(s, *a, **k): pass
    def key(s, i): pass
    def music_on(s): pass
    def music_pause(s, on): pass
    def music_stop(s): pass
    def toggle(s): pass


# =============================================================== the dancer (procedural, interpolated joints)
POSES = {
    "idle":   dict(lean=0, ls=.25, le=.4, rs=.25, re=.4, lh=.08, lk=0, rh=.08, rk=0, dx=0, dy=0, twist=1),
    "swingL": dict(lean=-.12, ls=1.9, le=.5, rs=.3, re=1.2, lh=.12, lk=0, rh=.05, rk=.2, dx=-2, dy=0, twist=1),
    "swingR": dict(lean=.12, ls=.3, le=1.2, rs=1.9, re=.5, lh=.05, lk=.2, rh=.12, rk=0, dx=2, dy=0, twist=1),
    "up":     dict(lean=0, ls=2.75, le=.2, rs=2.75, re=.2, lh=.1, lk=0, rh=.1, rk=0, dx=0, dy=-3, twist=1),
    "stepL":  dict(lean=-.1, ls=1.2, le=.9, rs=.6, re=.3, lh=.5, lk=.3, rh=.04, rk=0, dx=-9, dy=0, twist=1),
    "stepR":  dict(lean=.1, ls=.6, le=.3, rs=1.2, re=.9, lh=.04, lk=0, rh=.5, rk=.3, dx=9, dy=0, twist=1),
    "twist":  dict(lean=.06, ls=1.4, le=1.6, rs=.25, re=-.6, lh=.2, lk=.4, rh=.05, rk=0, dx=0, dy=1, twist=.45),
    "dip":    dict(lean=0, ls=1.45, le=.1, rs=1.45, re=.1, lh=.65, lk=-1.1, rh=.65, rk=-1.1, dx=0, dy=0, twist=1),
    "point":  dict(lean=.08, ls=.7, le=-1.9, rs=2.8, re=0, lh=.06, lk=0, rh=.45, rk=.6, dx=0, dy=0, twist=1),
    "jump":   dict(lean=0, ls=2.5, le=.4, rs=2.5, re=.4, lh=.35, lk=1.0, rh=.35, rk=1.0, dx=0, dy=-14, twist=1),
    "stumble": dict(lean=.35, ls=1.2, le=1.5, rs=.1, re=0, lh=.1, lk=0, rh=.45, rk=.3, dx=4, dy=1, twist=.8),
    "victory": dict(lean=-.06, ls=.75, le=-1.9, rs=2.85, re=-.1, lh=.05, lk=0, rh=.5, rk=.7, dx=0, dy=-2, twist=1),
    "collapse": dict(lean=.85, ls=.2, le=.1, rs=.35, re=.2, lh=.95, lk=-1.75, rh=.9, rk=-1.75, dx=0, dy=3, twist=.9),
}
CHOREO = ["swingL", "swingR", "stepL", "point", "stepR", "twist", "up", "dip"]
TORSO, SHW, HIPW, UA, FA, TH, SH = 20, 10, 5, 10, 9, 10, 10


def make_head(expr, shades=False, back=False):
    """Chibi Thanos head (32 × 29 canvas px): bald, square jaw, ridged chin. Expression drawn pixel by pixel."""
    s = pg.Surface((32, 29), pg.SRCALPHA)
    pg.draw.rect(s, INK, (0, 0, 32, 29), border_radius=7)
    pg.draw.rect(s, DANCER, (1, 1, 30, 27), border_radius=6)
    pg.draw.rect(s, SKIN_SH, (24, 3, 6, 23), border_radius=3)                  # shaded side
    pg.draw.rect(s, HI, (6, 3, 10, 3))                                          # bald highlight
    s.fill(LAMBER, (8, 3, 4, 1))
    if back:
        pg.draw.rect(s, SKIN_SH, (4, 18, 24, 8), border_radius=3)
        return s
    pg.draw.rect(s, SKIN_SH, (4, 22, 24, 6), border_radius=3)                   # heavy jaw
    for x in (10, 13, 16, 19, 22): s.fill(BURNT, (x, 21, 1, 7))                # the famous chin ridges
    for y0 in (12, 13, 14, 15, 16): s.fill(SKIN_SH, (1, y0, 2, 1)); s.fill(BURNT, (29, y0, 2, 1))   # ears
    brow = {"focus": 0, "smug": 1, "grin": 0, "wince": -1, "exhausted": -1, "victory": 0}[expr]
    for i in range(7):                                                          # heavy brow ridge
        s.fill(BURNT, (5 + i, 11 + (brow * (i - 3)) // 3, 1, 2)); s.fill(BURNT, (26 - i, 11 + (brow * (i - 3)) // 3, 1, 2))
    if shades:
        for x0 in (5, 18):
            pg.draw.rect(s, INK, (x0, 12, 9, 5), border_radius=1); s.fill(TERRA, (x0 + 1, 13, 2, 1))
        s.fill(INK, (14, 13, 4, 1))
    elif expr in ("grin", "victory"):
        for x0 in (7, 20): s.fill(INK, (x0, 15, 1, 1)); s.fill(INK, (x0 + 1, 14, 3, 1)); s.fill(INK, (x0 + 4, 15, 1, 1))
    elif expr == "wince":
        for x0 in (8, 20): s.fill(INK, (x0, 13, 1, 1)); s.fill(INK, (x0 + 1, 14, 2, 1)); s.fill(INK, (x0, 15, 1, 1))
    elif expr == "exhausted":
        for x0 in (7, 20): s.fill(INK, (x0, 15, 5, 1)); s.fill(INK, (x0 + 1, 16, 3, 1))
    else:
        lid = 1 if expr == "smug" else 0
        for x0 in (7, 20):
            s.fill(DOOR, (x0, 13, 5, 3)); s.fill(INK, (x0 + 2, 13 + lid, 2, 3 - lid))
            if lid: s.fill(SKIN_SH, (x0, 13, 5, 1))
    if expr in ("grin", "victory"):                                             # mouths
        s.fill(INK, (9, 18, 14, 1)); s.fill(INK, (10, 19, 12, 3)); s.fill(DOOR, (11, 19, 10, 1))
        s.fill(INK, (8, 17, 1, 1)); s.fill(INK, (23, 17, 1, 1))
    elif expr == "smug":
        s.fill(INK, (11, 19, 9, 1)); s.fill(INK, (20, 18, 2, 1))
    elif expr == "wince":
        for i in range(6): s.fill(INK, (10 + 2 * i, 19 + i % 2, 2, 1))
    elif expr == "exhausted":
        pg.draw.ellipse(s, INK, (13, 18, 6, 5))
    else:
        s.fill(INK, (11, 19, 10, 1))
    return s


class Dancer:
    def __init__(s):
        s.heads = {}
        s.reset()
    def reset(s):
        s.cur, s.target = dict(POSES["idle"]), dict(POSES["idle"])
        s.hold, s.kick, s.spin, s.spin_v, s.shake, s.choreo = 0.0, 0.0, 0.0, 0.0, 0.0, 0
        s.x, s.scale_k, s.expr, s.expr_t, s.shades, s.mode = float(DANCER_X), 1.0, "smug", 0.0, False, "groove"
    def head(s, expr, shades, back):
        k = (expr, shades, back)
        if k not in s.heads: s.heads[k] = make_head(expr, shades, back)
        return s.heads[k]
    # --- reactions
    def step_move(s):
        s.target = dict(POSES[CHOREO[s.choreo % len(CHOREO)]]); s.choreo += 1
        s.hold, s.kick = 0.42, 1.0
    def word_accent(s, n):
        if n % 3 == 0: s.target, s.kick = dict(POSES["jump"]), 2.0
        else: s.spin_v = math.tau / 0.45; s.target, s.kick = dict(POSES["up"]), 1.6
        s.hold = 0.5; s.say("grin", 0.5)
    def miss(s): s.target, s.hold, s.shake = dict(POSES["stumble"]), 0.32, 1.0; s.say("wince", 0.5)
    def say(s, e, t): s.expr, s.expr_t = e, t
    def pose(s, name, mode=None):
        s.target = dict(POSES[name]); s.hold = 1e9
        if mode: s.mode = mode

    def update(s, dt, t, active=True):
        s.hold -= dt; s.expr_t -= dt
        if s.hold <= 0 and s.mode == "groove":                                    # gentle idle groove on the beat
            g = dict(POSES["idle"]); ph = t / BEAT * math.pi
            g["dy"] = -2 * abs(math.sin(ph)); g["ls"] = .3 + .25 * math.sin(ph); g["rs"] = .3 - .25 * math.sin(ph)
            g["lean"] = .05 * math.sin(ph / 2); g["lk"] = g["rk"] = .15 * abs(math.sin(ph))
            s.target = g
        k = 1 - math.exp(-dt * (16 if active else 6))                           # smooth interpolation, never a teleport
        for key in s.cur: s.cur[key] += (s.target[key] - s.cur[key]) * k
        s.kick *= math.exp(-dt * 9); s.shake *= math.exp(-dt * 10)
        if s.spin_v:
            s.spin += s.spin_v * dt
            if s.spin >= math.tau: s.spin, s.spin_v = 0.0, 0.0

    def joints(s):
        p = s.cur
        sx = math.cos(s.spin) if s.spin_v else 1.0
        d = lambda a, side: (side * math.sin(a), math.cos(a))
        feet = []
        for side, h, k in ((-1, p["lh"], p["lk"]), (1, p["rh"], p["rk"])):
            a, b = d(h, side), d(h + k, side)
            feet.append((side * HIPW + a[0] * TH + b[0] * SH, a[1] * TH + b[1] * SH))
        hip_y = GROUND - max(f[1] for f in feet) + p["dy"] - 3 * s.kick
        cx = s.x + p["dx"] + (math.sin(s.shake * 40) * 2 * s.shake)
        X = lambda rel: cx + rel * sx * s.scale_k
        Y = lambda rel: GROUND + (rel - GROUND) * s.scale_k
        hip = (cx, hip_y)
        neck = (hip[0] + math.sin(p["lean"]) * TORSO, hip_y - math.cos(p["lean"]) * TORSO)
        J = {"hip": hip, "neck": neck}
        perp = (math.cos(p["lean"]), math.sin(p["lean"]))
        for side, name in ((-1, "l"), (1, "r")):
            sh = (neck[0] - cx + side * perp[0] * SHW * p["twist"], neck[1] + side * perp[1] * SHW * p["twist"] + 3)
            a, e = p[name + "s"], p[name + "e"]
            el = (sh[0] + side * math.sin(a) * UA, sh[1] + math.cos(a) * UA)
            ha = (el[0] + side * math.sin(a + e) * FA, el[1] + math.cos(a + e) * FA)
            hp = (side * HIPW * p["twist"], hip_y)
            h, k = p[name + "h"], p[name + "k"]
            kn = (hp[0] + side * math.sin(h) * TH, hp[1] + math.cos(h) * TH)
            ft = (kn[0] + side * math.sin(h + k) * SH, kn[1] + math.cos(h + k) * SH)
            for nm, q in (("sh", sh), ("el", el), ("ha", ha), ("hp", hp), ("kn", kn), ("ft", ft)):
                J[name + nm] = (X(q[0]), Y(q[1]))
        J["hip"], J["neck"] = (X(0), Y(hip_y)), (X(neck[0] - cx), Y(neck[1]))
        J["sx"] = sx
        return J

    def draw(s, L, t, collapse=False):
        J = s.joints(); sx = J["sx"]; k = s.scale_k
        w = lambda n: max(1, int(round(n * k)))
        pg.draw.ellipse(L, DEEP, (J["hip"][0] - 16 * k, GROUND - 3 * k, 32 * k, 6 * k))       # shadow
        def limb(a, b, col, width):
            pg.draw.line(L, INK, a, b, w(width + 2)); pg.draw.circle(L, INK, a, w(width / 2 + 1)); pg.draw.circle(L, INK, b, w(width / 2 + 1))
        def limb_fill(a, b, col, width):
            pg.draw.line(L, col, a, b, w(width)); pg.draw.circle(L, col, a, w(width / 2)); pg.draw.circle(L, col, b, w(width / 2))
        segs_legs = [(J["lhp"], J["lkn"]), (J["lkn"], J["lft"]), (J["rhp"], J["rkn"]), (J["rkn"], J["rft"])]
        for a, b in segs_legs: limb(a, b, BURNT, 6)
        for a, b in segs_legs: limb_fill(a, b, BURNT, 6)
        for f in (J["lft"], J["rft"]):                                                        # golden boots
            r = pg.Rect(0, 0, w(9), w(5)); r.center = (f[0], f[1] - w(1)); pg.draw.rect(L, INK, r.inflate(2, 2)); pg.draw.rect(L, AMBER, r)
        torso = [J["lsh"], J["rsh"], (J["hip"][0] + (J["rhp"][0] - J["hip"][0]) * 1.3, J["hip"][1]), (J["hip"][0] + (J["lhp"][0] - J["hip"][0]) * 1.3, J["hip"][1])]
        pg.draw.polygon(L, INK, torso, 0); pg.draw.polygon(L, INK, [(x + 1, y) for x, y in torso], 2)
        inner = [((x - J["hip"][0]) * .86 + J["hip"][0], (y - (J["hip"][1] + J["neck"][1]) / 2) * .9 + (J["hip"][1] + J["neck"][1]) / 2) for x, y in torso]
        pg.draw.polygon(L, BURNT, inner)
        top = [inner[0], inner[1], ((inner[1][0] + inner[2][0]) / 2, (inner[1][1] + inner[2][1]) / 2), ((inner[0][0] + inner[3][0]) / 2, (inner[0][1] + inner[3][1]) / 2)]
        pg.draw.polygon(L, AMBER, top); pg.draw.polygon(L, TERRA, top, 1)                     # golden chest armour
        mid = ((inner[0][0] + inner[1][0]) / 2, (inner[0][1] + inner[3][1]) / 2 + 2)
        pg.draw.line(L, DEEP, ((inner[2][0] + inner[1][0] * 2) / 3, inner[2][1] - w(3)), ((inner[3][0] + inner[0][0] * 2) / 3, inner[3][1] - w(3)), w(2))   # belt
        L.fill(LAMBER, (mid[0] - 1, mid[1] - 4, 2, 2))
        def arm(side):
            n = "l" if side < 0 else "r"
            for a2, b2 in ((J[n + "sh"], J[n + "el"]), (J[n + "el"], J[n + "ha"])): limb(a2, b2, BURNT, 6)
            for a2, b2 in ((J[n + "sh"], J[n + "el"]), (J[n + "el"], J[n + "ha"])): limb_fill(a2, b2, BURNT, 6)
            sh = J[n + "sh"]; pg.draw.circle(L, INK, sh, w(5)); pg.draw.circle(L, AMBER, sh, w(4)); L.fill(HI, (sh[0] - 1, sh[1] - 3, 2, 1))
            if n == "r": pg.draw.circle(L, INK, J["rha"], w(4)); pg.draw.circle(L, DANCER, J["rha"], w(3))   # bare hand
            else:                                                                                            # the Infinity Gauntlet
                gx, gy = J["lha"]
                pg.draw.circle(L, INK, (gx, gy), w(5)); pg.draw.circle(L, AMBER, (gx, gy), w(4))
                for i, c in enumerate((DOOR, SPOT, LAMBER, MID, HI, GLOWC)):
                    a3 = i / 6 * math.tau + t * 2; L.fill(c, (gx + math.cos(a3) * 2.4 * k, gy + math.sin(a3) * 2.4 * k, 1, 1))
        raised = [sd for sd, n in ((-1, "l"), (1, "r")) if s.cur[n + "s"] > 1.6]                   # raised arms go in front of the big head
        for sd in (-1, 1):
            if sd not in raised: arm(sd)
        expr = s.expr if s.expr_t > 0 else ("exhausted" if collapse else s.base_expr)
        back = abs(s.spin - math.pi) < math.pi / 2 and s.spin_v != 0
        img = s.head(expr, s.shades and not collapse, back)
        hw = max(2, int(32 * k * max(0.25, abs(sx))))
        img = pg.transform.scale(img, (hw, int(29 * k)))
        L.blit(img, img.get_rect(midbottom=(J["neck"][0] + math.sin(s.cur["lean"]) * 4, J["neck"][1] + 4 * k)))
        for sd in raised: arm(sd)
    base_expr = "focus"


# =============================================================== Avengers (chibi pixel heroes)
HEROES = ["ironman", "cap", "thor", "hulk", "spidey", "widow", "panther", "strange"]


def draw_hero(L, kind, x, y, mood, t, idx, dust=0.0):
    """Chibi Marvel hero drawn on a small canvas, then enlarged ×1.5 with hard pixels."""
    tmp = pg.Surface((44, 40), pg.SRCALPHA)
    _hero(tmp, kind, 22, 37, mood, t, idx, dust)
    big = pg.transform.scale(tmp, (66, 60))
    L.blit(big, (int(x) - 33, int(y) - 55))


def _hero(L, kind, x, y, mood, t, idx, dust=0.0):
    """Chibi Marvel hero, 16 px wide head. mood ∈ sad, cheer. `dust` (0..1) erodes the right side away."""
    big = kind == "hulk"
    bw = 16 if big else 12
    bob = int(abs(math.sin(t * math.pi / BEAT + idx)) * 2) if mood == "cheer" else 0
    y -= bob
    suit = {"ironman": TERRA, "cap": BURNT, "thor": DARK, "hulk": DARK, "spidey": MID, "widow": DEEP, "panther": DARK, "strange": BURNT}[kind]
    skin = {"hulk": SKIN_SH}.get(kind, PEACH)
    parts = []
    if kind in ("thor", "strange"): parts.append(((x - 8, y - 16, 16, 14), TERRA if kind == "strange" else BURNT))     # capes
    parts += [((x - 4, y - 5, 3, 5), suit), ((x + 1, y - 5, 3, 5), suit), ((x - bw // 2, y - 14, bw, 9), suit)]
    if mood == "cheer": parts += [((x - bw // 2 - 2, y - 22, 2, 9), suit), ((x + bw // 2, y - 22, 2, 9), suit)]
    else: parts += [((x - bw // 2 - 2, y - 14, 2, 7), suit), ((x + bw // 2, y - 14, 2, 7), suit)]
    hw = 16
    parts.append(((x - hw // 2, y - 28, hw, 14), skin))
    for r, c in parts: pg.draw.rect(L, INK, pg.Rect(r).inflate(2, 2))
    for r, c in parts: pg.draw.rect(L, c, r)
    hx, hy = x - hw // 2, y - 28
    f = lambda c, rx, ry, rw=1, rh=1: L.fill(c, (hx + rx, hy + ry, rw, rh))
    if kind == "ironman":
        f(TERRA, 0, 0, 16, 14); f(LAMBER, 3, 4, 10, 9); f(TERRA, 3, 4, 1, 3); f(TERRA, 12, 4, 1, 3); f(DOOR, 12 - 8, 7, 3); f(DOOR, 9, 7, 3)
        L.fill(DOOR, (x - 1, y - 11, 2, 2))
    elif kind == "cap":
        f(BURNT, 0, 0, 16, 6); f(DOOR, 7, 1, 2, 1); f(DOOR, 6, 2, 1, 3); f(DOOR, 9, 2, 1, 3); f(DOOR, 7, 3, 2, 1); f(LAMBER, 0, 3, 2, 2); f(LAMBER, 14, 3, 2, 2)
        L.fill(DOOR, (x - 1, y - 11, 2, 2))
        sx0 = x + bw // 2 + 4
        pg.draw.circle(L, INK, (sx0, y - 9), 6); pg.draw.circle(L, TERRA, (sx0, y - 9), 5); pg.draw.circle(L, LAMBER, (sx0, y - 9), 3); pg.draw.circle(L, TERRA, (sx0, y - 9), 2); L.fill(DOOR, (sx0, y - 9, 1, 1))
    elif kind == "thor":
        f(LAMBER, 0, 0, 16, 3); f(LAMBER, 0, 0, 3, 16); f(LAMBER, 13, 0, 3, 16); f(AMBER, 4, 10, 8, 4)
        hxm = x + bw // 2 + 3
        L.fill(INK, (hxm - 1, y - 13, 7, 5)); L.fill(TERRA, (hxm, y - 12, 5, 3)); L.fill(BURNT, (hxm + 2, y - 9, 1, 5))
    elif kind == "hulk":
        f(INK, 0, 0, 16, 3); f(DEEP, 1, 1, 14, 1); L.fill(BURNT, (x - 7, y - 6, 14, 2))
    elif kind == "spidey":
        f(MID, 0, 0, 16, 14)
        for i in range(0, 16, 4): f(TERRA, i, 0, 1, 14)
        for j in range(2, 14, 4): f(TERRA, 0, j, 16, 1)
        L.fill(INK, (x - 1, y - 12, 2, 4)); L.fill(INK, (x - 3, y - 11, 6, 1))
    elif kind == "widow":
        f(SPOT, 0, 0, 16, 4); f(SPOT, 0, 0, 3, 18); f(SPOT, 13, 0, 3, 18); L.fill(AMBER, (x - 6, y - 7, 12, 1))
    elif kind == "panther":
        f(DARK, 0, 0, 16, 14); f(INK, 1, -2, 2, 2); f(INK, 13, -2, 2, 2); f(BURNT, 3, 4, 10, 1)
        for i in range(5): L.fill(LAMBER, (x - 5 + i * 2 + 1, y - 13, 1, 1))
    elif kind == "strange":
        f(DARK, 0, 0, 16, 4); f(DARK, 0, 0, 2, 8); f(DARK, 14, 0, 2, 8); f(DARK, 6, 11, 4, 3); L.fill(AMBER, (x - 1, y - 12, 3, 3))
    # face: sad or cheering (masks show it through the eyes)
    masked = kind in ("ironman", "spidey", "panther")
    if mood == "sad":
        if kind == "spidey":
            f(DOOR, 3, 5, 4, 3); f(DOOR, 9, 5, 4, 3); f(MID, 3, 5, 1, 1); f(MID, 12, 5, 1, 1)
        elif not masked:
            f(INK, 4, 7, 2, 1); f(INK, 10, 7, 2, 1); f(INK, 3, 5, 2, 1); f(INK, 11, 5, 2, 1)
            f(INK, 6, 11, 4, 1); f(INK, 5, 12, 1, 1); f(INK, 10, 12, 1, 1)
        tear = int((t * 6 + idx * 3) % 6)
        f(DOOR, 4, 8 + tear // 2, 1, 1)
    else:
        if kind == "spidey": f(DOOR, 3, 5, 4, 2); f(DOOR, 9, 5, 4, 2)
        elif not masked:
            f(INK, 3, 7, 1, 1); f(INK, 4, 6, 2, 1); f(INK, 6, 7, 1, 1); f(INK, 9, 7, 1, 1); f(INK, 10, 6, 2, 1); f(INK, 12, 7, 1, 1)
            f(INK, 5, 10, 6, 1); f(INK, 6, 11, 4, 2); f(DOOR, 7, 11, 2, 1)
    if dust > 0:                                                                       # turning to dust, right side first
        rnd = random.Random(idx * 31 + int(t * 20))
        cut = x + bw // 2 + 3 - int((bw + 10) * dust)
        for yy in range(y - 30, y + 1):
            for xx in range(cut, x + bw // 2 + 4):
                if rnd.random() < 0.85 and 0 <= xx < 44 and 0 <= yy < 40: L.set_at((xx, yy), (0, 0, 0, 0))


# =============================================================== particles
class Particles:
    def __init__(s): s.p = []
    def add(s, pos, vel, life, col, size=1, grav=0.0, kind="dot"):
        if len(s.p) < MAX_PARTICLES: s.p.append([list(pos), list(vel), 0.0, life, col, size, grav, kind])
    def burst(s, pos, n, speed, cols, life=(0.4, 1.0), grav=40.0, kind="dot"):
        for _ in range(n):
            a = random.uniform(0, math.tau); v = random.uniform(0.3, 1) * speed
            s.add(pos, (math.cos(a) * v, math.sin(a) * v), random.uniform(*life), random.choice(cols), random.choice((1, 1, 2)), grav, kind)
    def update(s, dt):
        for q in s.p: q[1][1] += q[6] * dt; q[0][0] += q[1][0] * dt; q[0][1] += q[1][1] * dt; q[2] += dt
        s.p = [q for q in s.p if q[2] < q[3]]
    def draw(s, L):
        for q in s.p:
            x, y = int(q[0][0]), int(q[0][1]); k = 1 - q[2] / q[3]
            if q[7] == "spark" and k > 0.3:
                L.fill(q[4], (x - 1, y, 3, 1)); L.fill(q[4], (x, y - 1, 1, 3))
            else: L.fill(q[4], (x, y, q[5], q[5]))
    def clear(s): s.p.clear()


# =============================================================== stage
class Stage:
    SPK = [(318, 378), (382, 442)]                                      # two speaker stacks (x ranges) hiding the Phase Door
    def __init__(s):
        s.bg = s.bake_bg()
        s.reset()
    def reset(s):
        s.tiles = [[0.0] * 8 for _ in range(5)]
        s.spk_open, s.pulse, s.shake = 0.0, 0.0, 0.0
        s.portal_t = 0.0

    def bake_bg(s):
        L = pg.Surface((LW, LH)); L.fill(STAGE)
        rnd = random.Random(4)
        for y in range(37, 176, 8):                                   # back-wall panels
            off = 0 if (y // 8) % 2 else 16
            for x in range(-off, LW, 32): pg.draw.rect(L, (66, 22, 0), (x + 1, y + 1, 30, 6))
        for _ in range(120): L.fill(DEEP, (rnd.randrange(LW), rnd.randrange(37, 176), 1, 1))
        for side in (0, 1):                                            # curtains with folds
            x0 = 0 if side == 0 else LW - 22
            pg.draw.rect(L, BURNT, (x0, 37, 22, 200))
            for i in range(0, 22, 5): pg.draw.rect(L, TERRA, (x0 + i, 37, 2, 200)); pg.draw.rect(L, DARK, (x0 + i + 3, 37, 1, 200))
            pg.draw.rect(L, MID, (x0, 37, 22, 6)); pg.draw.rect(L, INK, (x0, 43, 22, 1))
        pg.draw.rect(L, DARK, (22, 160, LW - 44, 16)); pg.draw.rect(L, BURNT, (22, 160, LW - 44, 2))        # hero riser
        pg.draw.rect(L, INK, (0, 37, LW, 9)); pg.draw.rect(L, DARK, (0, 39, LW, 5))                         # truss
        for x in range(4, LW, 12): pg.draw.line(L, BURNT, (x, 39), (x + 6, 44)); pg.draw.line(L, BURNT, (x + 6, 39), (x, 44))
        return L

    def floor_poly(s): return [(20, 176), (430, 176), (490, 262), (-40, 262)]

    def draw(s, L, t, energy, alive, glow):
        L.blit(s.bg, (0, 0))
        b = (t / BEAT) % 1
        # neon Infinity Gauntlet sign on the back wall
        cx, cy = 225, 78
        fl = 1.0 if not alive else (0.65 + 0.35 * (1 - b) ** 2)
        col = tuple(int(c * fl) for c in SPOT)
        pts = [(cx - 14, cy + 22), (cx - 14, cy - 2), (cx - 10, cy - 2), (cx - 10, cy - 16), (cx - 6, cy - 16), (cx - 6, cy - 4), (cx - 3, cy - 4), (cx - 3, cy - 20), (cx + 1, cy - 20),
               (cx + 1, cy - 4), (cx + 4, cy - 4), (cx + 4, cy - 18), (cx + 8, cy - 18), (cx + 8, cy - 2), (cx + 12, cy - 2), (cx + 12, cy - 12), (cx + 16, cy - 12), (cx + 16, cy + 8), (cx + 8, cy + 22)]
        pg.draw.lines(L, col, True, pts, 1); pg.draw.lines(glow, tuple(c // 2 for c in col), True, pts, 3)
        for i, c in enumerate((DOOR, LAMBER, AMBER, MID, HI, GLOWC)):
            q = (cx - 8 + i * 4, cy + 6) if i < 5 else (cx, cy + 14)
            L.fill(c, (q[0], q[1], 2, 2)); pg.draw.circle(glow, tuple(int(v * 0.35 * fl) for v in c), q, 4)
        # ceiling bulbs blink on the beat
        for i, x in enumerate(range(10, LW, 20)):
            on = alive and ((i + int(t / BEAT)) % 3 == 0 or energy > 0.8)
            L.fill(INK, (x - 2, 44, 5, 4)); L.fill(HUD_C if on else TERRA, (x - 1, 45, 3, 2))
            if on: pg.draw.circle(glow, (90, 40, 10), (x, 46), 5)
        # floor
        fp = s.floor_poly()
        pg.draw.polygon(L, DEEP, fp)
        vp = (225, 40)
        rows = [176, 186, 198, 213, 234, 262]
        for r in range(5):
            for c in range(8):
                v = s.tiles[r][c]
                if v <= 0.02: continue
                y0, y1 = rows[r], rows[r + 1]
                def xat(col, y): xb = -40 + col * 530 / 8; return vp[0] + (xb - vp[0]) * (y - vp[1]) / (262 - vp[1])
                quad = [(xat(c, y0), y0), (xat(c + 1, y0), y0), (xat(c + 1, y1), y1), (xat(c, y1), y1)]
                pg.draw.polygon(L, tuple(int(DARK[i] + (MID[i] - DARK[i]) * v) for i in range(3)), quad)
        lc = SPOT if alive else BURNT
        for c in range(9):
            xb = -40 + c * 530 / 8; x0 = vp[0] + (xb - vp[0]) * (176 - vp[1]) / (262 - vp[1])
            pg.draw.line(L, lc, (x0, 176), (xb, 262))
        for y in rows:
            pg.draw.line(L, lc, (vp[0] + (-40 - vp[0]) * (y - vp[1]) / (262 - vp[1]), y), (vp[0] + (490 - vp[0]) * (y - vp[1]) / (262 - vp[1]), y))
            if alive: pg.draw.line(glow, (60, 22, 0), (0, y), (LW, y), 1)
        pg.draw.rect(L, BURNT, (0, 262, LW, 4)); pg.draw.rect(L, INK, (0, 266, LW, 2))

    def draw_spots(s, L, t, alive):
        if not alive: return
        layer = pg.Surface((LW, LH), pg.SRCALPHA)
        for i, (x0, ph) in enumerate(((60, 0), (170, 1.7), (280, 3.1), (390, 4.4))):
            a = math.sin(t * 0.7 + ph) * 0.55
            tip = (x0 + math.sin(a) * 210, 250)
            pg.draw.polygon(layer, (*SPOT, 38), [(x0 - 3, 46), (x0 + 3, 46), (tip[0] + 26, tip[1]), (tip[0] - 26, tip[1])])
            pg.draw.ellipse(layer, (*AMBER, 40), (tip[0] - 28, tip[1] - 6, 56, 12))
        L.blit(layer, (0, 0))

    def draw_portal(s, L, glow, t):
        """Phase Door behind the speakers: tall frame, layered glow, rotating geometry, inward motes."""
        cx, top, bot = 380, 96, 248
        k = min(1.0, s.portal_t / 0.8)
        w = 34
        for i in range(4, 0, -1):
            pg.draw.rect(glow, tuple(int(c * 0.18 * k * i / 4) for c in DOOR), (cx - w - i * 4, top - i * 4, 2 * w + i * 8, bot - top + i * 8), border_radius=6)
        pg.draw.rect(L, INK, (cx - w - 4, top - 4, 2 * w + 8, bot - top + 8), border_radius=4)
        pg.draw.rect(L, LAMBER, (cx - w - 3, top - 3, 2 * w + 6, bot - top + 6), 3, border_radius=4)
        inner = pg.Rect(cx - w, top, 2 * w, bot - top)
        pg.draw.rect(L, AMBER if k > 0 else BURNT, inner)
        for r in range(6):
            rr = (r + 1) * 9 + 4 * math.sin(t * 3 + r)
            pg.draw.rect(L, (HI, LAMBER, DOOR)[r % 3], (cx - rr * 0.55, (top + bot) / 2 - rr, rr * 1.1, rr * 2), 1)
        for j in range(3):
            a = t * (1.5 + j * 0.6) + j
            pts = [(cx + math.cos(a + q * math.tau / 3) * (14 + j * 8), (top + bot) / 2 + math.sin(a + q * math.tau / 3) * (22 + j * 12)) for q in range(3)]
            pg.draw.polygon(L, DOOR, pts, 1)
        pg.draw.rect(L, DOOR, (cx - 3, top + 8, 6, bot - top - 16))
        pg.draw.rect(glow, tuple(int(c * 0.5 * k) for c in DOOR), inner.inflate(-20, -10))

    def draw_speakers(s, L, glow, t, alive, energy):
        off = s.spk_open
        for i, (x0, x1) in enumerate(s.SPK):
            dx = -off * 74 if i == 0 else off * 74
            for j, (y0, y1) in enumerate(((92, 150), (150, 200), (200, 250))):
                r = pg.Rect(x0 + dx, y0, x1 - x0, y1 - y0)
                pg.draw.rect(L, INK, r); pg.draw.rect(L, DARK, r.inflate(-2, -2)); pg.draw.rect(L, BURNT, r.inflate(-2, -2), 1)
                c = r.center
                pulse = (1 - ((t / BEAT) % 1)) ** 3 * 0.5 + s.pulse if alive else 0.0
                rad = 16 if j else 12
                pg.draw.circle(L, INK, (c[0], c[1] + 2), rad + 2); pg.draw.circle(L, TERRA, (c[0], c[1] + 2), rad + int(pulse * 2))
                pg.draw.circle(L, DARK, (c[0], c[1] + 2), int(rad * 0.62 + pulse * 2)); pg.draw.circle(L, SPOT if alive else BURNT, (c[0], c[1] + 2), 3)
                if alive and pulse > 0.25: pg.draw.circle(glow, (int(70 * pulse), int(25 * pulse), 0), (c[0], c[1] + 2), rad + 4)
                pg.draw.circle(L, INK, (r.x + 6, r.y + 5), 3); pg.draw.circle(L, AMBER, (r.x + 6, r.y + 5), 2)


def draw_audience(L, t, energy, alive, hype):
    """Marvel fans from behind (the reference crowd): heads, helmets, horns and waving glowsticks."""
    kinds = ["loki", "cap", "hair", "panther", "spiky", "pony", "ironman", "hair", "loki", "groot", "spiky", "cap", "pony"]
    for i, kd in enumerate(kinds):
        x = 14 + i * 35; base = LH + 4
        bob = (abs(math.sin(t * math.pi / BEAT + i * 0.9)) * (2 + 3 * energy)) if alive else 0
        y = base - 34 - bob - (i % 2) * 6
        col = (DARK, BURNT, DEEP)[i % 3]
        for sgn in (-1, 1):                                                   # arms + glowsticks
            if (i + (sgn > 0)) % 2 and alive:
                ang = -math.pi / 2 + sgn * (0.35 + 0.25 * math.sin(t * math.pi / BEAT * 2 + i)) - hype * sgn * 0.2
                hx, hy = x + sgn * 10, y + 12
                ex, ey = hx + math.cos(ang) * 14, hy + math.sin(ang) * 14
                pg.draw.line(L, INK, (hx, hy), (ex, ey), 4); pg.draw.line(L, col, (hx, hy), (ex, ey), 2)
                gx, gy = ex + math.cos(ang - sgn * 0.4) * 8, ey + math.sin(ang - sgn * 0.4) * 8
                pg.draw.line(L, (HI, SPOT, LAMBER)[i % 3], (ex, ey), (gx, gy), 2)
        pg.draw.ellipse(L, INK, (x - 16, y + 14, 32, 30)); pg.draw.ellipse(L, col, (x - 15, y + 15, 30, 28))      # shoulders
        pg.draw.rect(L, INK, (x - 11, y - 1, 22, 20), border_radius=6); pg.draw.rect(L, col, (x - 10, y, 20, 18), border_radius=5)
        if kd == "loki": pg.draw.polygon(L, AMBER, [(x - 8, y + 2), (x - 14, y - 12), (x - 5, y)]); pg.draw.polygon(L, AMBER, [(x + 8, y + 2), (x + 14, y - 12), (x + 5, y)])
        elif kd == "cap": L.fill(LAMBER, (x - 12, y + 4, 3, 4)); L.fill(LAMBER, (x + 9, y + 4, 3, 4))
        elif kd == "panther": L.fill(INK, (x - 9, y - 3, 3, 4)); L.fill(INK, (x + 6, y - 3, 3, 4))
        elif kd == "spiky":
            for j in range(4): pg.draw.polygon(L, col, [(x - 9 + j * 6, y + 2), (x - 6 + j * 6, y - 6), (x - 3 + j * 6, y + 2)])
        elif kd == "pony": pg.draw.rect(L, TERRA, (x - 3, y + 12, 6, 12))
        elif kd == "ironman": L.fill(TERRA, (x - 10, y, 20, 6))
        elif kd == "groot":
            for j in range(3): L.fill(TERRA, (x - 6 + j * 6, y - 5, 2, 6))
        else: pg.draw.rect(L, DEEP, (x - 10, y, 20, 6), border_radius=4)


# =============================================================== game
class Game:
    def __init__(s, headless=False):
        pg.init()
        s.display = pg.display.set_mode((W, H)); pg.display.set_caption("ORANGE")
        s.clock = pg.time.Clock()
        s.L = pg.Surface((LW, LH)); s.glow = pg.Surface((LW, LH))
        s.font = PixelFont()
        s.audio = Mute() if headless else Synth()
        s.stage, s.dancer, s.fx = Stage(), Dancer(), Particles()
        s.rng = random.Random()
        s.typing = Typing(s.rng)
        s.state, s.t, s.buttons = "TITLE", 0.0, {}
        s.reset()

    def reset(s):
        """Full restart to the ready screen: timer, stats, word, dancer, stage, particles, door, pause, result."""
        s.typing.reset(); s.dancer.reset(); s.stage.reset(); s.fx.clear()
        s.elapsed, s.final_wpm, s.final_acc, s.won = 0.0, 0.0, 100.0, None
        s.phase_t, s.energy, s.hype, s.flash = 0.0, 0.0, 0.0, 0.0
        s.toasts, s.last_tick, s.pace_hit, s.word_pop, s.err_t = [], 6, False, None, 0.0
        s.dust, s.shake = 0.0, 0.0
        s.audio.music_stop()

    # --------------------------------------------------- inputs (also used by the tests)
    def key_enter(s):
        if s.state == "TITLE": s.audio.play("click"); s.state = "READY"
        elif s.state == "READY": s.begin()
        elif s.state == "RULES": s.state = "TITLE"
    def begin(s):
        s.reset(); s.state = "PLAYING"; s.elapsed = 0.0
        s.audio.play("go"); s.audio.music_on(); s.toast("GO!")
    def key_escape(s):
        if s.state == "PLAYING": s.state = "PAUSED"; s.audio.music_pause(True)
        elif s.state == "PAUSED": s.state = "PLAYING"; s.audio.music_pause(False)
        elif s.state == "RULES": s.state = "TITLE"
    def key_r(s):
        if s.state in ("GAME_OVER", "TRANSITION_SCREEN"): s.reset(); s.state = "READY"
    def key_backspace(s):
        if s.state == "PLAYING" and s.typing.backspace(): s.dancer.target = dict(POSES["idle"]); s.dancer.hold = 0.15
    def key_char(s, ch):
        if s.state != "PLAYING": return
        ch = ch.upper()
        if len(ch) != 1 or ch not in TYPABLE: return
        tp, d = s.typing, s.dancer
        res = tp.press(ch)
        if res == "wrong":
            d.miss(); s.err_t = 0.35; s.audio.play("wrong", 0.6); s.energy = max(0.0, s.energy - 0.15)
            return
        s.audio.key(tp.streak)
        d.step_move(); s.stage.pulse = 0.6; s.energy = min(1.0, s.energy + 0.05); s.hype = 1.0
        for _ in range(2):
            r, c = random.randrange(5), random.randrange(8); s.stage.tiles[r][c] = 1.0
        s.fx.burst((d.x, GROUND - 40), 3, 50, (AMBER, HI, SPOT), (0.2, 0.5), 60, "spark")
        if res == "word":
            d.word_accent(tp.words); s.audio.play("word", 0.4); s.stage.pulse = 1.0
            s.fx.burst((d.x, GROUND - 50), 8, 100, (DOOR, LAMBER, AMBER), (0.3, 0.8), 80, "spark")
        elif res == "sentence":                                        # the biggest accent: jump + cheer
            d.target, d.kick, d.hold = dict(POSES["jump"]), 2.4, 0.6; d.spin_v = math.tau / 0.5; d.say("grin", 0.8)
            s.audio.play("word", 0.7); s.audio.play("cheer", 0.45); s.stage.pulse = 1.0
            s.word_pop = [tp.done, 0.0]
            s.fx.burst((d.x, GROUND - 50), 24, 140, (DOOR, LAMBER, AMBER), (0.4, 1.0), 80, "spark")
        d.shades = tp.streak >= 12 or s.live_wpm() >= TARGET_WPM

    def live_wpm(s): return s.typing.wpm(max(1.0, s.elapsed))
    def toast(s, text, secs=1.2): s.toasts.append([text, secs, secs])

    # --------------------------------------------------- update
    def step(s, dt):
        s.t += dt
        s.fx.update(dt); s.stage.pulse *= math.exp(-dt * 6); s.hype *= math.exp(-dt * 4); s.err_t -= dt; s.flash = max(0.0, s.flash - dt)
        for tile_row in s.stage.tiles:
            for i in range(8): tile_row[i] *= math.exp(-dt * 3)
        s.toasts = [[a, b - dt, c] for a, b, c in s.toasts if b - dt > 0]
        if s.word_pop: s.word_pop[1] += dt; s.word_pop = s.word_pop if s.word_pop[1] < 0.6 else None
        st = s.state
        alive = st not in ("GAME_OVER",)
        s.dancer.update(dt, s.t, alive)
        if st in ("TITLE", "READY", "RULES"): s.dancer.base_expr = "smug"
        if st == "PAUSED": return
        if st == "PLAYING":
            s.elapsed = min(CHALLENGE, s.elapsed + dt)
            left = CHALLENGE - s.elapsed
            sec = math.ceil(left)
            if sec < s.last_tick and sec <= 5 and left > 0: s.last_tick = sec; s.audio.play("tick", 0.5)
            s.energy *= math.exp(-dt * 0.3)
            wpm, acc = s.live_wpm(), s.typing.accuracy()
            if not s.pace_hit and s.elapsed > 3 and wpm >= TARGET_WPM and acc >= TARGET_ACC:
                s.pace_hit = True; s.audio.play("pace", 0.5); s.toast("40 WPM PACE!")
            s.dancer.base_expr = "smug" if s.typing.streak >= 5 else "focus"
            if s.elapsed >= CHALLENGE: s.finish()
        elif st == "VICTORY_DANCE":
            s.phase_t += dt
            if random.random() < 0.3: s.fx.burst((random.uniform(60, 300), random.uniform(80, 200)), 8, 90, (DOOR, LAMBER, AMBER, SPOT), (0.5, 1.0), 50, "spark")
            for row in s.stage.tiles:
                for i in range(8): row[i] = max(row[i], 0.5 + 0.5 * math.sin(s.t * 8 + i))
            s.dust = min(1.0, max(0.0, (s.phase_t - 0.9) / 1.5))
            if s.dust > 0 and random.random() < 0.6:
                s.fx.add((random.uniform(30, 290), random.uniform(135, 168)), (random.uniform(20, 50), random.uniform(-25, -5)), 1.2, random.choice((BURNT, TERRA, DARK)), 1, -5)
            if s.phase_t >= VICTORY_DANCE_T:
                s.state, s.phase_t = "DOOR_OPENING", 0.0; s.audio.play("slide", 0.7)
        elif st == "DOOR_OPENING":
            s.phase_t += dt; p = min(1.0, s.phase_t / (DOOR_T * 0.8))
            s.stage.spk_open = p * p * (3 - 2 * p)
            s.shake = 2.5 * (1 - p) if p < 1 else 0.0
            s.stage.portal_t += dt * p
            if random.random() < 0.4: s.fx.burst((380, random.uniform(100, 245)), 3, 60, (DOOR, LAMBER), (0.3, 0.7), 0, "spark")
            if s.phase_t >= DOOR_T:
                s.state, s.phase_t = "PORTAL_ENTRY", 0.0; s.audio.play("portal", 0.7); s.dancer.pose("idle", "walk")
        elif st == "PORTAL_ENTRY":
            s.phase_t += dt; s.stage.portal_t += dt
            p = min(1.0, s.phase_t / (ENTRY_T * 0.85))
            d = s.dancer
            d.x = DANCER_X + (380 - DANCER_X) * min(1.0, p * 1.25)
            walk = math.sin(s.phase_t * 12)
            d.target = dict(POSES["idle"], lh=.3 * walk, rh=-.3 * walk, ls=.4 - .4 * walk, rs=.4 + .4 * walk, dy=-abs(walk) * 2)
            d.scale_k = max(0.0, 1 - max(0.0, p - 0.75) * 4)
            if random.random() < 0.6:
                a = random.uniform(0, math.tau); src = (380 + math.cos(a) * 60, 172 + math.sin(a) * 80)
                s.fx.add(src, ((380 - src[0]) * 1.5, (172 - src[1]) * 1.5), 0.6, random.choice((DOOR, LAMBER, HI)), 1)
            if s.phase_t >= ENTRY_T:
                s.state, s.phase_t = "TRANSITION_SCREEN", 0.0; s.audio.play("snap"); s.flash = 0.6
        elif st == "TRANSITION_SCREEN":
            s.phase_t += dt; s.stage.portal_t += dt
        elif st == "GAME_OVER":
            s.phase_t += dt

    def finish(s):
        """Time is up: freeze the final result (denominator exactly 60 s) and judge speed AND accuracy."""
        s.elapsed = CHALLENGE
        s.final_wpm = s.typing.wpm(CHALLENGE); s.final_acc = s.typing.accuracy()
        s.won = s.typing.attempts > 0 and s.final_wpm >= TARGET_WPM and s.final_acc >= TARGET_ACC
        s.phase_t = 0.0
        if s.won:
            s.state = "VICTORY_DANCE"; s.dancer.pose("victory", "pose"); s.dancer.shades = True
            s.dancer.say("victory", 1e9); s.audio.play("win", 0.8); s.audio.play("snap", 0.8); s.audio.play("cheer", 0.6)
            s.fx.burst((s.dancer.x, GROUND - 60), 50, 160, (DOOR, LAMBER, AMBER, SPOT), (0.6, 1.2), 60, "spark")
        else:
            s.state = "GAME_OVER"; s.dancer.pose("collapse", "pose"); s.dancer.say("exhausted", 1e9)
            s.audio.music_stop(); s.audio.play("fail", 0.8)

    # --------------------------------------------------- drawing
    def draw(s):
        L, G = s.L, s.glow
        G.fill((0, 0, 0))
        st = s.state
        alive = st != "GAME_OVER"
        s.stage.draw(L, s.t, s.energy, alive, G)
        hero_mood = "cheer" if st == "GAME_OVER" else "sad"
        for i, kind in enumerate(HEROES):
            if s.dust >= 1.0 or st in ("DOOR_OPENING", "PORTAL_ENTRY", "TRANSITION_SCREEN"): break
            draw_hero(L, kind, 38 + i * 35, 161, hero_mood, s.t, i, s.dust * (0.6 + 0.4 * ((i * 37) % 7) / 7))
        if st in ("DOOR_OPENING", "PORTAL_ENTRY", "TRANSITION_SCREEN"): s.stage.draw_portal(L, G, s.t)
        s.stage.draw_spots(L, s.t, alive and st != "PAUSED")
        if st != "TRANSITION_SCREEN" and s.dancer.scale_k > 0.02:
            s.dancer.draw(L, s.t, collapse=(st == "GAME_OVER"))
        s.stage.draw_speakers(L, G, s.t, alive and st not in ("PAUSED",), s.energy)
        s.fx.draw(L)
        draw_audience(L, s.t, s.energy if st == "PLAYING" else (1.0 if st in ("VICTORY_DANCE", "DOOR_OPENING", "PORTAL_ENTRY", "TRANSITION_SCREEN") else 0.3), alive, s.hype)
        if not alive:                                                                     # subdued, dimmed stage
            dim = pg.Surface((LW, LH)); dim.fill((150, 140, 128)); L.blit(dim, (0, 0), special_flags=pg.BLEND_RGB_MULT)
        small = pg.transform.smoothscale(G, (LW // 4, LH // 4))
        L.blit(pg.transform.smoothscale(small, (LW, LH)), (0, 0), special_flags=pg.BLEND_RGB_ADD)
        L.blit(G, (0, 0), special_flags=pg.BLEND_RGB_ADD)
        off = (random.uniform(-1, 1) * s.shake * 2, random.uniform(-1, 1) * s.shake * 2) if s.shake > 0.1 else (0, 0)
        s.display.fill(INK)
        s.display.blit(pg.transform.scale(L, (W, H)), off)
        s.buttons = {}
        s.draw_ui()
        if s.flash > 0:
            o = pg.Surface((W, H)); o.fill(DOOR); o.set_alpha(int(255 * min(1.0, s.flash * 2))); s.display.blit(o, (0, 0))
        pg.display.flip()

    def panel(s, rect, alpha=200, border=SPOT):
        o = pg.Surface(rect.size, pg.SRCALPHA); o.fill((*INK, alpha)); s.display.blit(o, rect.topleft)
        pg.draw.rect(s.display, INK, rect.inflate(4, 4), 2); pg.draw.rect(s.display, border, rect, 2)

    def button(s, key, label, center):
        r = pg.Rect(0, 0, 250, 46); r.center = center
        hover = r.collidepoint(pg.mouse.get_pos()) if pg.mouse.get_focused() else False
        s.panel(r, 230, AMBER if hover else SPOT)
        s.font.draw(s.display, label, 3, DOOR if hover else HUD_C, r.center)
        s.buttons[key] = r

    def draw_ui(s):
        D, F, st, tp = s.display, s.font, s.state, s.typing
        if st == "TITLE":
            s.panel(pg.Rect(150, 110, 600, 420), 175)
            F.draw(D, "ORANGE", 14, SPOT, (W // 2, 205), shadow=INK)
            s.button("start", "START", (W // 2, 330)); s.button("rules", "RULES", (W // 2, 392)); s.button("exit", "EXIT", (W // 2, 454))
            F.draw(D, "ENTER START  ·  H RULES  ·  M MUTE", 2, HUD_C, (W // 2, 505))
            return
        if st == "RULES":
            s.panel(pg.Rect(110, 90, 680, 470), 225)
            F.draw(D, "RULES", 7, SPOT, (W // 2, 140))
            F.draw(D, "PLACEHOLDER - FINAL RULES TO BE ATTACHED", 2, AMBER, (W // 2, 180))
            lines = ["TYPE THE SENTENCE ON SCREEN, SPACES AND ALL.", "EVERY CORRECT KEY IS A DANCE MOVE FOR THANOS.", "WRONG KEYS ARE ERRORS - BACKSPACE CANNOT ERASE THEM.",
                     "BACKSPACE ONLY FIXES THE CURRENT SENTENCE.", "HOLD 40 WPM WITH 88% ACCURACY FOR 60 SECONDS.", "WPM = CORRECT CHARACTERS / 5 PER MINUTE.",
                     "ESC PAUSES. WIN AND THE PHASE DOOR OPENS."]
            for i, l in enumerate(lines): F.draw(D, l, 2, HUD_C, (W // 2, 228 + i * 34))
            s.button("back", "BACK", (W // 2, 505))
            return
        # HUD strip
        s.panel(pg.Rect(8, 6, W - 16, 64), 215)
        left = max(0.0, CHALLENGE - s.elapsed)
        wpm = s.final_wpm if s.won is not None else s.live_wpm()
        acc = s.final_acc if s.won is not None else tp.accuracy()
        F.draw(D, "TIME", 2, AMBER, (24, 20), "topleft")
        F.draw(D, f"{left:.1f}" if left < 10 else f"{int(math.ceil(left))}", 5, SPOT if left < 10 and st == "PLAYING" and int(s.t * 4) % 2 else HUD_C, (24, 34), "topleft")
        def meter(x, label, val, target, cap, fmt):
            ok = val >= target
            F.draw(D, label, 2, AMBER, (x, 20), "topleft")
            F.draw(D, fmt.format(val), 5, DOOR if ok else HUD_C, (x, 34), "topleft")
            bar = pg.Rect(x + 110, 38, 120, 12)
            pg.draw.rect(D, INK, bar.inflate(4, 4)); pg.draw.rect(D, DARK, bar)
            pg.draw.rect(D, AMBER if ok else MID, (bar.x, bar.y, int(bar.w * min(1.0, val / cap)), bar.h))
            tx = bar.x + int(bar.w * target / cap); pg.draw.rect(D, DOOR, (tx - 1, bar.y - 4, 2, bar.h + 8))
            F.draw(D, ("OK" if ok else "LOW") if st == "PLAYING" else f"{target:g}", 2, DOOR if ok else SPOT, (bar.right + 8, 44), "midleft", None)
        meter(140, "WPM / 40", wpm, TARGET_WPM, 90, "{:3.0f}")
        meter(420, "ACCURACY / 88%", acc, TARGET_ACC, 100, "{:3.0f}%")
        F.draw(D, f"CORRECT {tp.correct}", 2, HUD_C, (W - 22, 20), "topright", None)
        F.draw(D, f"ERRORS  {tp.wrong}", 2, SPOT if s.err_t > 0 else HUD_C, (W - 22, 36), "topright", None)
        F.draw(D, f"WORDS   {tp.words}", 2, HUD_C, (W - 22, 52), "topright", None)
        # the active sentence (wrapped onto up to two lines)
        if st in ("READY", "PLAYING", "PAUSED"):
            box = pg.Rect(70, 474, 760, 88); s.panel(box, 210, SPOT if s.err_t <= 0 else AMBER)
            text, px = tp.text, 3
            lines = wrap(text)
            for li, (start, line) in enumerate(lines):
                x0 = W // 2 - PixelFont.width(line.rstrip(), px) // 2
                y0 = box.y + 14 + li * 32 + (16 if len(lines) == 1 else 0)
                for j, ch in enumerate(line):
                    i = start + j
                    typed = i < tp.pos
                    dx = random.uniform(-3, 3) if (s.err_t > 0 and i == tp.pos) else 0
                    X = x0 + j * 6 * px + dx
                    if ch != " ":
                        D.blit(F.render(ch, px, INK), (X + px, y0 + px)); D.blit(F.render(ch, px, SPOT if typed else HUD_C), (X, y0))
                    if typed: pg.draw.rect(D, AMBER, (X, y0 + 7 * px + 3, 5 * px, 2))
                    if i == tp.pos and st == "PLAYING" and int(s.t * 3) % 2 == 0: pg.draw.rect(D, DOOR, (X, y0 + 7 * px + 3, 5 * px, 3))
            pg.draw.rect(D, DARK, (box.x + 10, box.bottom - 8, box.w - 20, 3))
            pg.draw.rect(D, AMBER, (box.x + 10, box.bottom - 8, int((box.w - 20) * tp.pos / len(text)), 3))
            if s.word_pop and s.word_pop[0]:
                k = s.word_pop[1] / 0.6
                img = F.render(s.word_pop[0], 2, LAMBER); img.set_alpha(int(255 * (1 - k)))
                D.blit(img, img.get_rect(center=(W // 2, box.y - 14 - 40 * k)))
        for i, (text, left_t, total_t) in enumerate(s.toasts[-2:]):
            F.draw(D, text, 4, DOOR, (W // 2, 440 - i * 34))
        if st == "PLAYING" and s.elapsed > 6:
            fb = "ON PACE" if s.live_wpm() >= TARGET_WPM else "BELOW PACE - FASTER!"
            F.draw(D, fb, 2, DOOR if s.live_wpm() >= TARGET_WPM else SPOT, (W // 2, 578), shadow=INK)
        if st == "READY":
            r = pg.Rect(140, 110, 620, 330); s.panel(r, 225)
            F.draw(D, "READY?", 8, SPOT, (W // 2, 160))
            for i, l in enumerate(("TYPE EACH SENTENCE TO MAKE THANOS DANCE.", "REACH AT LEAST 40 WPM", "WITH AT LEAST 88% ACCURACY", "OVER THE FULL 60 SECONDS.")):
                F.draw(D, l, 3 if i in (1, 2) else 2, DOOR if i in (1, 2) else HUD_C, (W // 2, 222 + i * 38))
            F.draw(D, "PRESS ENTER TO START", 4, SPOT if int(s.t * 2) % 2 else AMBER, (W // 2, 400))
        elif st == "PAUSED":
            r = pg.Rect(250, 140, 400, 300); s.panel(r, 230)
            F.draw(D, "PAUSED", 8, SPOT, (W // 2, 190))
            F.draw(D, "ESC TO RESUME", 2, HUD_C, (W // 2, 240))
            s.button("resume", "RESUME", (W // 2, 296)); s.button("restart", "RESTART", (W // 2, 352)); s.button("exit", "EXIT", (W // 2, 408))
        elif st == "GAME_OVER" and s.phase_t > 0.8:
            r = pg.Rect(160, 130, 580, 330); s.panel(r, 230)
            F.draw(D, "CHALLENGE FAILED", 5, SPOT, (W // 2, 180))
            F.draw(D, f"FINAL WPM {s.final_wpm:.1f}", 3, HUD_C, (W // 2, 240))
            F.draw(D, f"ACCURACY {s.final_acc:.1f}%", 3, HUD_C, (W // 2, 278))
            missed = []
            if s.typing.attempts == 0: missed.append("NO LETTERS TYPED")
            else:
                if s.final_wpm < TARGET_WPM: missed.append(f"SPEED MISSED: {s.final_wpm:.1f} / 40 WPM")
                if s.final_acc < TARGET_ACC: missed.append(f"ACCURACY MISSED: {s.final_acc:.1f} / 88%")
            for i, m in enumerate(missed): F.draw(D, m, 2, AMBER, (W // 2, 322 + i * 26))
            F.draw(D, "PRESS R TO RETRY", 4, DOOR if int(s.t * 2) % 2 else SPOT, (W // 2, 420))
        elif st in ("VICTORY_DANCE", "DOOR_OPENING", "PORTAL_ENTRY"):
            F.draw(D, f"{s.final_wpm:.0f} WPM  ·  {s.final_acc:.1f}%", 4, DOOR, (W // 2, 506))
            F.draw(D, "CHALLENGE COMPLETE!" if st == "VICTORY_DANCE" else "THE PHASE DOOR OPENS...", 3, AMBER, (W // 2, 548))
        elif st == "TRANSITION_SCREEN":
            o = pg.Surface((W, H), pg.SRCALPHA); o.fill((*STAGE, min(185, int(s.phase_t * 300)))); D.blit(o, (0, 0))
            F.draw(D, "PHASE DOOR UNLOCKED.", 6, DOOR, (W // 2, 250))
            F.draw(D, "TRANSITIONING TO LEVEL: RED", 4, SPOT, (W // 2, 310))
            F.draw(D, f"{s.final_wpm:.1f} WPM  ·  {s.final_acc:.1f}% ACCURACY", 2, HUD_C, (W // 2, 360))
            F.draw(D, "PRESS R TO RESTART", 3, AMBER if int(s.t * 2) % 2 else HUD_C, (W // 2, 420))
        snd = pg.Rect(W - 120, H - 34, 110, 26)
        s.panel(snd, 200, SPOT); F.draw(D, "MUTED" if s.audio.muted else "SOUND", 2, HUD_C, snd.center, shadow=None); s.buttons["mute"] = snd

    # --------------------------------------------------- loop
    def action(s, k):
        if k != "mute": s.audio.play("click")
        if k == "start": s.state = "READY"
        elif k == "rules": s.state = "RULES"
        elif k == "back": s.state = "TITLE"
        elif k == "resume": s.key_escape()
        elif k == "restart": s.reset(); s.state = "READY"
        elif k == "exit": s.running = False
        elif k == "mute": s.audio.toggle()

    def run(s):
        s.running, acc = True, 0.0
        while s.running:
            acc += min(0.25, s.clock.tick(FPS) / 1000)
            for e in pg.event.get():                                  # KEYDOWN fires once per press (key repeat is off)
                if e.type == pg.QUIT: s.running = False
                elif e.type == pg.KEYDOWN:
                    if e.key == pg.K_ESCAPE: s.key_escape()
                    elif e.key in (pg.K_RETURN, pg.K_KP_ENTER): s.key_enter()
                    elif e.key == pg.K_BACKSPACE: s.key_backspace()
                    elif s.state == "PLAYING": s.key_char(e.unicode)
                    elif e.key == pg.K_r: s.key_r()
                    elif e.key == pg.K_h and s.state in ("TITLE", "RULES"): s.state = "RULES" if s.state == "TITLE" else "TITLE"
                    elif e.key == pg.K_m: s.audio.toggle()
                elif e.type == pg.MOUSEBUTTONDOWN and e.button == 1:
                    for k, r in list(s.buttons.items()):
                        if r.collidepoint(e.pos): s.action(k); break
            while acc >= 1 / FPS:
                s.step(1 / FPS); acc -= 1 / FPS
            s.draw()
        pg.quit()


if __name__ == "__main__":
    Game().run()
    sys.exit()
