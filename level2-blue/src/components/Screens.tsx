import { motion } from 'framer-motion';
import { BookOpen, DoorOpen, LogOut, Pause, Play, RotateCcw, Trophy, Waves } from 'lucide-react';
import { useState } from 'react';
import { LEVEL, LEVEL_INFO, RULES_CONTINUATION, RULES_PLACEHOLDER } from '../game/config';
import type { Snapshot } from '../game/engine';
import { FINAL_LABELS, finalSegments, type LevelNo, type Progress } from '../game/progress';
import { formatTime } from '../game/timer';
import { Overlay, PixelButton } from './ui';

export function LevelIntro({ onStart, onRules, onExit, continueLevel, onContinue }: { onStart: () => void; onRules: () => void; onExit: () => void; continueLevel?: LevelNo | null; onContinue?: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-abyss/60 via-abyss/80 to-abyss/95 p-6 text-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.h1 className="font-pixel text-[clamp(40px,7vw,84px)] leading-none text-cyan drop-shadow-[0_0_18px_#258BFF]"
        initial={{ y: -10 }} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}>
        {LEVEL.title}
      </motion.h1>
      <p className="mt-5 font-pixel text-[12px] tracking-[0.3em] text-pale">LEVEL {LEVEL_INFO[2].number}: {LEVEL_INFO[2].name}</p>
      <p className="mt-3 font-term text-2xl text-electric">{LEVEL.tagline}</p>
      <p className="mt-4 max-w-[620px] font-term text-xl leading-snug text-pale/90">{LEVEL.story}</p>
      <p className="mt-2 font-term text-lg text-primary">Three levels. One 3-minute clock. Run out, and it all starts again.</p>
      <div className="mt-6 flex flex-col gap-4">
        {continueLevel && onContinue ? (
          <>
            <PixelButton onClick={onContinue} autoFocus className="w-64"><Play size={12} className="mr-2 inline" aria-hidden />Continue · Level {LEVEL_INFO[continueLevel].number}</PixelButton>
            <PixelButton variant="ghost" onClick={onStart} className="w-64"><RotateCcw size={12} className="mr-2 inline" aria-hidden />New Game</PixelButton>
          </>
        ) : (
          <PixelButton onClick={onStart} autoFocus className="w-64"><Play size={12} className="mr-2 inline" aria-hidden />Start Level</PixelButton>
        )}
        <PixelButton variant="ghost" onClick={onRules} className="w-64"><BookOpen size={12} className="mr-2 inline" aria-hidden />Rules</PixelButton>
        <PixelButton variant="ghost" onClick={onExit} className="w-64"><LogOut size={12} className="mr-2 inline" aria-hidden />Exit</PixelButton>
      </div>
      <p className="mt-6 font-term text-lg text-primary">← → / A D move · Space jump · E interact · Esc pause</p>
    </motion.div>
  );
}

export function RulesPanel({ onClose, inGame, level = 2 }: { onClose: () => void; inGame: boolean; level?: LevelNo }) {
  const [tab, setTab] = useState<LevelNo>(level);
  const sections = tab === 2 ? RULES_PLACEHOLDER.sections : RULES_CONTINUATION[tab];
  return (
    <Overlay wide label="Rules">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-pixel text-[16px] text-cyan">RULES</h2>
        {tab === 2 && RULES_PLACEHOLDER.isPlaceholder && <span className="border-2 border-electric px-2 py-1 font-pixel text-[8px] text-pale">PLACEHOLDER · FINAL RULES TO BE SUPPLIED</span>}
      </div>
      <div className="mt-3 flex gap-2" role="tablist" aria-label="Rules by level">
        {([2, 3, 4] as LevelNo[]).map((n) => (
          <button key={n} type="button" role="tab" aria-selected={tab === n} onClick={() => setTab(n)}
            className={`border-2 px-2 py-1 font-pixel text-[8px] ${tab === n ? 'border-cyan bg-deep text-ice' : 'border-deep bg-navy text-pale hover:border-electric'}`}>
            L{LEVEL_INFO[n].number} · {LEVEL_INFO[n].title.toUpperCase()}
          </button>
        ))}
      </div>
      {inGame && <p className="mt-2 font-term text-lg text-primary">The timer keeps running while rules are open. Press Esc and pause first if you need time.</p>}
      <dl className="mt-4 space-y-3">
        {sections.map((s) => (
          <div key={s.title}>
            <dt className="font-pixel text-[10px] text-pale">{s.title}</dt>
            <dd className="mt-1 font-term text-xl leading-snug text-ice/90">{s.body}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex justify-end"><PixelButton onClick={onClose} autoFocus>Close</PixelButton></div>
    </Overlay>
  );
}

export function PauseMenu(p: { onResume: () => void; onRestart: () => void; onRules: () => void; onMenu: () => void }) {
  return (
    <Overlay label="Paused">
      <h2 className="flex items-center gap-3 font-pixel text-[16px] text-cyan"><Pause size={18} aria-hidden /> PAUSED</h2>
      <p className="mt-2 font-term text-xl text-pale">The timer is frozen.</p>
      <div className="mt-5 flex flex-col gap-4">
        <PixelButton onClick={p.onResume} autoFocus><Play size={12} className="mr-2 inline" aria-hidden />Resume</PixelButton>
        <PixelButton variant="ghost" onClick={p.onRestart}><RotateCcw size={12} className="mr-2 inline" aria-hidden />Restart Level</PixelButton>
        <PixelButton variant="ghost" onClick={p.onRules}><BookOpen size={12} className="mr-2 inline" aria-hidden />Rules</PixelButton>
        <PixelButton variant="danger" onClick={p.onMenu}><LogOut size={12} className="mr-2 inline" aria-hidden />Exit to Main Menu</PixelButton>
      </div>
    </Overlay>
  );
}

export function FailureScreen({ onRetry, onMenu, level = 2 }: { onRetry: () => void; onMenu: () => void; level?: LevelNo }) {
  return (
    <Overlay label="Time expired">
      <div className="flex flex-col items-center text-center">
        <Waves size={40} className="text-electric" aria-hidden />
        <h2 className="mt-3 font-pixel text-[14px] leading-relaxed text-ice">TIME EXPIRED — THANOS MUST TRY AGAIN</h2>
        <p className="mt-3 font-term text-xl text-pale">{LEVEL_INFO[level].failText} The 3-minute clock ran out and the chamber flooded. Thanos must start again from Level 1; clues from this run are cleared.</p>
        <div className="mt-5 flex gap-4">
          <PixelButton onClick={onRetry} autoFocus><RotateCcw size={12} className="mr-2 inline" aria-hidden />Restart from Level 1</PixelButton>
          <PixelButton variant="ghost" onClick={onMenu}>Main Menu</PixelButton>
        </div>
      </div>
    </Overlay>
  );
}

export function LevelCompleteScreen({ snap, onReplay, onMenu, onContinue }: { snap: Snapshot; onReplay: () => void; onMenu: () => void; onContinue?: () => void }) {
  const s = snap.stats;
  return (
    <Overlay label="Level complete">
      <div className="flex flex-col items-center text-center">
        <DoorOpen size={40} className="text-cyan" aria-hidden />
        <h2 className="mt-3 font-pixel text-[16px] text-ice">LEVEL 1 COMPLETE</h2>
        <p className="mt-2 font-term text-xl text-pale">Thanos balanced the impossible and beat the flood. The escape digits are his.</p>
        <motion.p className="mt-4 font-pixel text-[40px] tracking-[0.35em] text-ice drop-shadow-[0_0_14px_#258BFF]"
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}>
          {snap.bag.sequence}
        </motion.p>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 font-term text-xl">
          <dt className="text-primary">Level time</dt><dd className="text-ice">{formatTime(s.timeMs)}</dd>
          <dt className="text-primary">Clock left</dt><dd className="text-ice">{formatTime(snap.remainingMs)}</dd>
          <dt className="text-primary">Hints used</dt><dd className="text-ice">{s.hints}/3</dd>
          <dt className="text-primary">Wrong weighings</dt><dd className="text-ice">{s.wrongSubmissions}</dd>
          <dt className="text-primary">Switch resets</dt><dd className="text-ice">{s.wrongSwitches}</dd>
        </dl>
        <p className="mt-3 font-term text-lg text-primary">Saved to the Intelligence Bag for the final escape code.</p>
        <div className="mt-5 flex gap-4">
          {onContinue && <PixelButton onClick={onContinue} autoFocus>Continue · Level 2</PixelButton>}
          <PixelButton variant="ghost" onClick={onReplay} autoFocus={!onContinue}>Play Again</PixelButton>
          <PixelButton variant="ghost" onClick={onMenu}>Main Menu</PixelButton>
        </div>
      </div>
    </Overlay>
  );
}

/** Intro card shown before Levels 2 and 3 (ids 3 and 4). The timer starts only on Start Level. */
export function LevelIntroCard({ level, onStart, onRules, onMenu }: { level: 3 | 4; onStart: () => void; onRules: () => void; onMenu: () => void }) {
  const info = LEVEL_INFO[level];
  return (
    <motion.div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-abyss/50 via-abyss/80 to-abyss/95 p-6 text-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <p className="font-pixel text-[12px] tracking-[0.3em] text-pale">LEVEL {info.number}</p>
      <h1 className="mt-4 font-pixel text-[clamp(26px,4.4vw,48px)] leading-tight text-cyan drop-shadow-[0_0_14px_#258BFF]">{info.title}</h1>
      <p className="mt-3 font-term text-2xl text-electric">{info.subtitle}</p>
      <p className="mt-4 max-w-[640px] font-term text-xl leading-snug text-pale/90">{info.story}</p>
      <p className="mt-2 font-term text-lg text-primary">The 3-minute clock carries over from the last level. It is frozen on this screen and resumes when you start.</p>
      <div className="mt-6 flex flex-col gap-4">
        <PixelButton onClick={onStart} autoFocus className="w-64"><Play size={12} className="mr-2 inline" aria-hidden />Start Level</PixelButton>
        <PixelButton variant="ghost" onClick={onRules} className="w-64"><BookOpen size={12} className="mr-2 inline" aria-hidden />Rules</PixelButton>
        <PixelButton variant="ghost" onClick={onMenu} className="w-64"><LogOut size={12} className="mr-2 inline" aria-hidden />Main Menu</PixelButton>
      </div>
    </motion.div>
  );
}

export function Level3CompleteScreen({ triangles, timeMs, hints, onContinue, onMenu }: { triangles: number; timeMs: number; hints: number; onContinue: () => void; onMenu: () => void }) {
  return (
    <Overlay label="Level 2 complete">
      <div className="flex flex-col items-center text-center">
        <DoorOpen size={40} className="text-cyan" aria-hidden />
        <h2 className="mt-3 font-pixel text-[15px] text-ice">LEVEL 2 COMPLETE</h2>
        <p className="mt-2 font-term text-xl text-pale">Every intersection accounted for. The passage opens and Thanos moves deeper.</p>
        <p className="mt-3 font-term text-xl text-primary">Distinct triangles</p>
        <motion.p className="font-pixel text-[40px] text-ice drop-shadow-[0_0_14px_#258BFF]" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>{triangles}</motion.p>
        <p className="mt-2 font-term text-lg text-primary">Time {formatTime(timeMs)} · Hints {hints}/3 · Saved to the Intelligence Bag</p>
        <div className="mt-5 flex gap-4">
          <PixelButton onClick={onContinue} autoFocus>Continue · Level 3</PixelButton>
          <PixelButton variant="ghost" onClick={onMenu}>Main Menu</PixelButton>
        </div>
      </div>
    </Overlay>
  );
}

export function VictoryScreen({ progress, onRestart, onMenu }: { progress: Progress; onRestart: () => void; onMenu: () => void }) {
  const seg = finalSegments(progress);
  const totalHints = progress.hints[2] + progress.hints[3] + progress.hints[4];
  return (
    <Overlay wide label="BLUE protocol complete">
      <div className="flex flex-col items-center text-center">
        <Trophy size={42} className="text-cyan" aria-hidden />
        <h2 className="mt-3 font-pixel text-[18px] text-ice drop-shadow-[0_0_10px_#258BFF]">BLUE PROTOCOL COMPLETE</h2>
        <p className="mt-3 font-pixel text-[10px] leading-relaxed text-pale">ALL CLUES RECOVERED. ESCAPE CODE ACCEPTED.</p>
        <motion.p className="mt-3 font-pixel text-[16px] text-cyan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>THANOS HAS WON.</motion.p>
        {seg && (
          <div className="mt-5 grid w-full grid-cols-4 gap-2">
            {seg.map((v, i) => (
              <div key={FINAL_LABELS[i]} className="border-2 border-primary bg-abyss p-2">
                <p className="font-term text-base text-primary">{FINAL_LABELS[i]}</p>
                <p className="font-pixel text-[18px] text-ice">{v}</p>
              </div>
            ))}
          </div>
        )}
        {seg && <p className="mt-2 font-pixel text-[13px] tracking-[0.2em] text-pale">{seg.join('-')}</p>}
        <dl className="mt-4 grid grid-cols-3 gap-x-6 gap-y-1 font-term text-xl">
          {([2, 3, 4] as LevelNo[]).map((n) => (
            <div key={n} className="text-left"><dt className="text-primary">L{LEVEL_INFO[n].number} · {LEVEL_INFO[n].title}</dt><dd className="text-ice">✓ {progress.times[n] != null ? formatTime(progress.times[n]!) : '—'} · hints {progress.hints[n]}/3</dd></div>
          ))}
        </dl>
        <p className="mt-2 font-term text-lg text-primary">Levels completed: 3 of 3 · Total time: {formatTime((progress.times[2] ?? 0) + (progress.times[3] ?? 0) + (progress.times[4] ?? 0))} of 3:00 · Total hints used: {totalHints}</p>
        <div className="mt-5 flex gap-4">
          <PixelButton onClick={onRestart} autoFocus><RotateCcw size={12} className="mr-2 inline" aria-hidden />Restart Game</PixelButton>
          <PixelButton variant="ghost" onClick={onMenu}>Main Menu</PixelButton>
        </div>
      </div>
    </Overlay>
  );
}

export function ExitConfirm({ inGame, onConfirm, onCancel }: { inGame: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Overlay label="Exit">
      <h2 className="font-pixel text-[14px] text-cyan">{inGame ? 'LEAVE THIS RUN?' : 'EXIT BLUE?'}</h2>
      <p className="mt-3 font-term text-xl text-pale">{inGame ? 'Progress in this level will be lost and you will return to the main menu.' : 'The game will close its session. You can return at any time.'}</p>
      <div className="mt-5 flex gap-4">
        <PixelButton variant="danger" onClick={onConfirm}>{inGame ? 'Main Menu' : 'Exit'}</PixelButton>
        <PixelButton variant="ghost" onClick={onCancel} autoFocus>Cancel</PixelButton>
      </div>
    </Overlay>
  );
}

export function ExitedScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-abyss text-center">
      <p className="font-pixel text-[20px] text-cyan">BLUE</p>
      <p className="font-term text-2xl text-pale">The chamber is quiet. You can close this browser tab now.</p>
      <PixelButton variant="ghost" onClick={onBack}>Back to the game</PixelButton>
    </div>
  );
}

export function DesktopOnly() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-abyss p-8 text-center">
      <p className="font-pixel text-[20px] text-cyan">BLUE</p>
      <p className="font-term text-2xl text-pale">This level is made for desktop and laptop computers with a keyboard and mouse.</p>
    </div>
  );
}
