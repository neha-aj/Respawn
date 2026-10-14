# ORANGE (Python)

A typing-dance rhythm game in chibi pixel art, drawn only in shades of orange. Every correct keystroke is a dance move for **Thanos**. Type whole sentences, and hold at least **40 WPM with at least 88% accuracy for 60 seconds**: the speakers slide apart and Thanos dances through the Phase Door to RED.

## Run

```bash
python -m pip install pygame
python orange.py
```

There are no asset files. Every pixel, every letter of the 5×7 pixel font, every sound effect and the music are generated in code.

## Controls

| Key | Action |
|---|---|
| Letters, space, `.` `,` | Type the sentence on screen |
| BACKSPACE | Fix the current sentence (it never erases errors) |
| ENTER | Start (title → ready → start the 60 s timer) |
| ESC | Pause / resume |
| R | Restart after a result |
| M | Mute (outside the challenge; the SOUND button works any time) |

## Scoring

- **Sentences:** 60 original Thanos/Marvel/dance lines, dealt from a shuffled deck. None repeats until all have been used, even across restarts.
- **WPM** = correct characters × 12 / seconds (five characters = one word; spaces count, as in standard typing tests). Characters removed with backspace stop counting.
- **Accuracy** = correct keystrokes / all letter keystrokes. A wrong key stays an error even after you fix the word.
- **Result:** judged once, when the full 60 seconds end. You win only if WPM ≥ 40 *and* accuracy ≥ 88%.

## The stage

- **The dancer:** Thanos is a chibi dancer built from joints that blend smoothly between 13 poses: idle groove, arm swings, arms up, side-steps, twist, dip, disco point, jump, stumble, victory and collapse.
  - Every correct character is the next move in the routine.
  - A finished word triggers a spin or a jump; a finished sentence triggers a big jump-spin and a crowd cheer.
  - A mistake makes him stumble.
  - His face changes with how you're doing, and he puts sunglasses on during a hot streak.
- **The Avengers:** sad chibi Avengers stand at the back (Iron Man, Captain America, Thor, Hulk, Spider-Man, Black Widow, Black Panther and Doctor Strange).
  - If you fail, they cheer.
  - If you win, Thanos snaps and they turn to dust.
- **The crowd:** Marvel fans seen from behind (Loki horns, Cap's helmet, Panther ears, Groot) wave glowsticks to the beat.
- **The club:** a neon Infinity Gauntlet sign, sweeping spotlights, a disco floor that lights up as you type, and two speaker stacks that pulse to the beat. The Phase Door hides behind the speakers.

## Sound

- **Music:** an original 120 BPM superhero-disco loop with a heroic brass-style lead, a disco octave bass and four-on-the-floor drums. It is not the Avengers theme, which is copyrighted.
- **Sound effects:**
  - Every correct key plays the next note of a pentatonic scale.
  - Wrong keys buzz.
  - Finished words chime, and the crowd cheers each finished sentence.
  - A fanfare plays when you reach 40 WPM pace.
  - The last five seconds count down.
  - The ending has a fail sound, a victory fanfare, the Thanos snap, a speaker rumble and a portal whoosh.

The Rules screen is a placeholder until the final rules are supplied.

## Tests

```bash
python test_orange.py
```

The tests cover the spec's mandatory checklist, the scoring maths, the orange-only palette and the pixel font. It also checks that no sentence repeats until all have been used. Typing bots check four outcomes:
- 48 WPM wins.
- 36 WPM loses on speed.
- Fast but 83% accurate loses on accuracy.
- 55 WPM at about 92% accuracy wins.
