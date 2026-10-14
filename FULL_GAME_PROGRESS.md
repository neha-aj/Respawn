# Full-game merge: progress / handoff notes

STATUS: DONE

Branch: `full-game` (branched from `yellow`). Everything is in `respawn-game/`; see its README.

## Checklist
- [x] Shell project scaffolded (`respawn-game/`, Vite + React + TS)
- [x] Level bridges: every level posts `respawn:complete` to the shell when won
- [x] `npm run levels` builds every level into `public/levels/`; videos in `public/videos/`
- [x] Transitions: victory hold → iris (with pinhole beat) → spectrum card → video → bloom + iris open
- [x] Built and checked in the browser: every transition, focus hand-off, finale, `?chapter=`
- [x] README, `PLAY.bat` launcher, slots marked for the 3 pending pieces

## Still to come (from Neha)
1. Intro: VIBGYOR photo + tune. 2. Opening video. 18. Ending sequence.
See "Adding the pending pieces" in `respawn-game/README.md`.
