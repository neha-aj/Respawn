import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioManager } from '../game/audio';
import { GAME_TIME_MS } from '../game/config';
import { GameEngine, type Snapshot } from '../game/engine';
import { TRIANGLE_COUNT } from '../game/geometry';
import {
  completeLevel2, completeLevel3, currentLevel, escape, initialProgress, resetLevel4, restartRun, setDigitSum, setSafeTile, validateFinalCode,
  type LevelNo, type Progress,
} from '../game/progress';
import type { Shape, WeightId } from '../game/puzzle';
import { digitSum, explainRejection, satisfiesAll } from '../game/remainder';
import { FinalEscapeConsole } from './FinalEscapeConsole';
import { GameHeader } from './GameHeader';
import { IntelligenceBag, bagCount } from './IntelligenceBag';
import { OverlapTrapStage, type OverlapState } from './OverlapTrapStage';
import { PuzzleConsole } from './PuzzleConsole';
import { RemainderLockStage } from './RemainderLockStage';
import {
  DesktopOnly, ExitConfirm, ExitedScreen, FailureScreen, Level3CompleteScreen, LevelCompleteScreen, LevelIntro, LevelIntroCard,
  PauseMenu, RulesPanel, VictoryScreen,
} from './Screens';
import { MessageToast, ThanosPortrait } from './ThanosCharacter';

const EMPTY = { A: '', B: '', C: '' } as Record<WeightId, string>;
const NO_OVERLAP: OverlapState = { marked: [], answer: '' };
const NO_CODE = ['', '', '', ''];

/** onComplete — called once when the final escape succeeds (the victory screen appears). */
export default function BlueLevel({ previousOrder, onComplete }: { previousOrder: readonly Shape[]; onComplete?: () => void }) {
  const completeRef = useRef(onComplete); completeRef.current = onComplete;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const portraitRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  if (!audioRef.current) audioRef.current = new AudioManager();
  const audio = audioRef.current;

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [muted, setMuted] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [exitAsk, setExitAsk] = useState<null | 'menu' | 'game'>(null);
  const [exited, setExited] = useState(false);
  const [card, setCard] = useState<3 | 4 | null>(null);                // intro card before Levels 3 / 4
  // cross-level progress (single source of truth for earned clues)
  const [progress, setProgress] = useState<Progress>(() => initialProgress(previousOrder));
  const progressRef = useRef(progress); progressRef.current = progress;
  // per-attempt puzzle state
  const [values, setValues] = useState<Record<WeightId, string>>(EMPTY);
  const [overlap, setOverlap] = useState<OverlapState>(NO_OVERLAP);
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [digit, setDigit] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [code, setCode] = useState<string[]>(NO_CODE);
  const [codeWrong, setCodeWrong] = useState<boolean[]>([false, false, false, false]);

  const mainRef = useRef<HTMLElement>(null);
  const [frame, setFrame] = useState({ w: 960, h: 540 });
  useEffect(() => {
    const el = mainRef.current; if (!el) return;
    const fit = () => { const r = el.getBoundingClientRect(); const w = Math.max(320, Math.min(r.width - 24, ((r.height - 24) * 16) / 9)); setFrame({ w, h: (w * 9) / 16 }); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);
  const desktop = useMemo(() => !window.matchMedia || window.matchMedia('(any-pointer: fine)').matches, []);

  useEffect(() => {
    const engine = new GameEngine(canvasRef.current!, audio, { previousOrder, timeLimitMs: GAME_TIME_MS, onChange: setSnap });
    engine.setPortraitCanvas(portraitRef.current);
    engineRef.current = engine;
    if (import.meta.env.DEV) (window as unknown as { __blue?: GameEngine }).__blue = engine; // dev-only test hook
    return () => { engine.destroy(); engineRef.current = null; audio.destroy(); };
  }, [audio, previousOrder]);

  const setPortrait = useCallback((c: HTMLCanvasElement | null) => { portraitRef.current = c; engineRef.current?.setPortraitCanvas(c); }, []);

  const phase = snap?.phase ?? 'intro';
  const level: LevelNo = snap?.level ?? 2;
  const remaining = snap?.remainingMs ?? GAME_TIME_MS;
  const levelTime = () => engineRef.current?.levelElapsedMs() ?? 0;
  const eng = () => engineRef.current;

  /* ---------------- flow ---------------- */
  const resetAttempt = useCallback((n: LevelNo) => {
    if (n === 2) setValues(EMPTY);
    if (n === 3) setOverlap(NO_OVERLAP);
    if (n === 4) { setEliminated([]); setDigit(''); setCode(NO_CODE); setCodeWrong([false, false, false, false]); setProgress(resetLevel4); }
  }, []);

  /** `fresh` restarts the shared 3-minute clock (only for a new run at Level 2). */
  const startLevel = useCallback((n: LevelNo, fresh: boolean) => {
    audio.init(); audio.setMuted(muted); audio.click();
    resetAttempt(n);
    setCard(null); setBagOpen(false); setRulesOpen(false); setExitAsk(null);
    eng()?.start(n, fresh);
  }, [audio, muted, resetAttempt]);

  const newGame = useCallback(() => { setProgress(initialProgress(previousOrder)); setOverlap(NO_OVERLAP); startLevel(2, true); }, [previousOrder, startLevel]);
  // between levels the clock is frozen, not reset
  const showCard = useCallback((n: 3 | 4) => { audio.softClick(); setRulesOpen(false); setBagOpen(false); eng()?.preview(n, true); setCard(n); }, [audio]);
  const toMenu = useCallback(() => {
    setExitAsk(null); setRulesOpen(false); setBagOpen(false); setCard(null);
    const c = currentLevel(progressRef.current);
    eng()?.toMenu(c === 3 || c === 4); // a run in progress keeps its remaining time for Continue
  }, []);
  /** Pause → Restart Level: Level 2 restarts the run; Levels 3–4 restart their puzzle while the clock keeps going. */
  const restartLevel = useCallback(() => { if (level === 2) newGame(); else startLevel(level, false); }, [level, newGame, startLevel]);

  // The final escape: tell the host once, as the victory screen appears.
  const escaped = !!snap?.showComplete && level === 4 && progress.level4.escaped;
  useEffect(() => { if (escaped) completeRef.current?.(); }, [escaped]);

  // Time ran out on any level: the run is over and everything from Level 2 on is cleared.
  useEffect(() => { if (snap?.phase === 'failed') setProgress(restartRun); }, [snap?.phase]);

  // Level 2 finished: store its validated result exactly once (completeLevel2 is idempotent).
  useEffect(() => {
    if (snap?.level !== 2 || snap.phase !== 'complete' || !snap.bag.weights || !snap.bag.order || !snap.bag.sequence) return;
    const r = { weights: snap.bag.weights, order: snap.bag.order, sequence: snap.bag.sequence };
    setProgress((p) => completeLevel2(p, r, snap.stats.timeMs, snap.stats.hints));
  }, [snap?.level, snap?.phase, snap?.bag, snap?.stats.timeMs, snap?.stats.hints]);

  /* ---------------- Level 3 ---------------- */
  const onOverlapWrong = (n: number) => {
    audio.wrong();
    eng()?.notify(n < TRIANGLE_COUNT
      ? `${n} is not it. Some triangles are still hiding: look for larger ones whose sides run through several intersections.`
      : `${n} is not it. Check for triangles counted twice, or shapes with a side that is not actually drawn.`, 'bad', 'confused', 2.4);
  };
  const onOverlapCorrect = () => {
    setProgress((p) => completeLevel3(p, TRIANGLE_COUNT, levelTime(), snap?.hintsUsed ?? 0));
    eng()?.notify(`${TRIANGLE_COUNT} triangles: correct. The passage is opening.`, 'good', 'relieved', 3);
    eng()?.overlapSolved();
  };

  /* ---------------- Level 4 ---------------- */
  const onTile = (n: number) => {
    if (progressRef.current.level4.tile != null) return;
    if (satisfiesAll(n)) {
      audio.correct();
      setProgress((p) => setSafeTile(p, n));
      eng()?.setLockView({ solvedTile: n, selected: n });
      eng()?.notify(`Tile ${n} satisfies all three conditions. Now reduce it to a single digit.`, 'good', 'focused', 2.4);
    } else {
      audio.wrong(); setShakeKey((k) => k + 1);
      eng()?.setLockView({ selected: n, errorT: 1 });
      eng()?.notify(explainRejection(n), 'bad', 'confused', 2);
    }
  };
  const onEliminate = (n: number) => {
    audio.eliminate();
    setEliminated((e) => { const next = e.includes(n) ? e.filter((k) => k !== n) : [...e, n]; eng()?.setLockView({ eliminated: new Set(next) }); return next; });
  };
  const onDigit = () => {
    const tile = progressRef.current.level4.tile; const d = Number(digit);
    if (tile == null || !digit) return;
    if (d === digitSum(tile)) {
      audio.correct();
      setProgress((p) => setDigitSum(p, d));
      eng()?.lockSolved();
    } else {
      audio.wrong();
      eng()?.notify('Not quite. Add the digits of the safe number: the tens digit plus the ones digit.', 'bad', 'confused', 1.8);
    }
  };
  const onFinal = () => {
    const res = validateFinalCode(progressRef.current, code);
    if (res.locked) { audio.wrong(); eng()?.notify('The terminal is still locked.', 'bad', 'confused'); return; }
    if (res.ok) {
      setCodeWrong([false, false, false, false]);
      setProgress((p) => escape(p, code, levelTime(), snap?.hintsUsed ?? 0));
      audio.powerDown();
      eng()?.escapeAccepted();
    } else {
      setCodeWrong(res.wrong); audio.wrong();
      const n = res.wrong.filter(Boolean).length;
      eng()?.notify(`Code rejected. ${n} segment${n > 1 ? 's need' : ' needs'} another look; check the Intelligence Bag.`, 'bad', 'confused', 2);
    }
  };

  /* ---------------- UI plumbing ---------------- */
  const toggleSound = useCallback(() => setMuted((m) => { audio.setMuted(!m); if (m) audio.click(); return !m; }), [audio]);
  const toggleBag = useCallback(() => { audio.softClick(); setBagOpen((o) => !o); }, [audio]);
  const openRules = useCallback(() => { audio.softClick(); setRulesOpen(true); }, [audio]);

  // Esc: close the top-most layer, otherwise pause / resume. M toggles sound.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement;
      if (e.key === 'Escape') {
        if (rulesOpen) setRulesOpen(false);
        else if (exitAsk) setExitAsk(null);
        else if (snap?.consoleOpen) { eng()?.closeConsole(); (document.activeElement as HTMLElement | null)?.blur(); }
        else if (snap?.station) { eng()?.closeStation(); (document.activeElement as HTMLElement | null)?.blur(); }
        else if (phase === 'playing') eng()?.pause();
        else if (phase === 'paused') eng()?.resume();
      } else if (!typing && (e.key === 'm' || e.key === 'M') && !e.repeat) toggleSound();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rulesOpen, exitAsk, snap?.consoleOpen, snap?.station, phase, toggleSound]);

  const continueLevel = (() => { const c = currentLevel(progress); return c === 3 || c === 4 ? c : null; })();
  const playing = phase === 'playing';
  const lockView = useMemo(() => new Set(eliminated), [eliminated]);
  const station = playing ? snap?.station ?? null : null;

  return (
    <div className="flex h-full flex-col bg-abyss">
      <GameHeader
        remainingMs={remaining} totalMs={GAME_TIME_MS} timerActive={phase === 'playing' || phase === 'paused'} stage={snap?.stage ?? 'solve'} level={level}
        hintsUsed={snap?.hintsUsed ?? 0} bagCount={bagCount(progress, level === 2 ? snap?.bag ?? null : null)} bagOpen={bagOpen} muted={muted} canPause={playing}
        onBag={toggleBag} onSound={toggleSound} onPause={() => eng()?.pause()} onRules={openRules}
      />
      <main ref={mainRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div className="pixel-frame relative" style={{ width: frame.w, height: frame.h }}>
          <canvas ref={canvasRef} className="pixelated absolute inset-0 h-full w-full cursor-pointer" aria-label="Underwater research chamber. Thanos stands at the bottom of the room." />

          <ThanosPortrait canvasRef={setPortrait} expression={snap?.expression ?? 'determined'} critical={playing && remaining < 10_000} />
          {phase !== 'intro' && <MessageToast message={snap?.message ?? null} shifted={!!snap?.consoleOpen} bottom={!!station} />}

          <AnimatePresence>
            {level === 2 && snap?.consoleOpen && snap.stage === 'solve' && playing && (
              <PuzzleConsole
                key="console" values={values}
                setValue={(id, v) => { audio.key(); setValues((s) => ({ ...s, [id]: v })); }}
                onSubmit={() => eng()?.submitWeights(values)}
                onClose={() => eng()?.closeConsole()}
                weighing={snap.weighing} verdicts={snap.verdicts} hintsUsed={snap.hintsUsed}
                onHint={() => eng()?.requestHint()}
              />
            )}
            {level === 3 && station === 'panel' && (
              <OverlapTrapStage
                key="overlap" state={overlap} setState={setOverlap} hintsUsed={snap?.hintsUsed ?? 0} onHint={() => eng()?.requestHint()}
                onClose={() => eng()?.closeStation()} onWrong={onOverlapWrong} onCorrect={onOverlapCorrect}
                sfx={{ select: () => audio.select(), zoom: (i) => audio.zoom(i), trace: () => audio.trace(), segment: () => audio.key(), click: () => audio.click() }}
              />
            )}
            {level === 4 && station === 'panel' && (
              <RemainderLockStage
                key="lock" eliminated={lockView} solvedTile={progress.level4.tile} digitDone={progress.level4.digitSum != null}
                digit={digit} setDigit={(v) => { audio.key(); setDigit(v); }} onSelect={onTile} onToggleEliminate={onEliminate} onDigit={onDigit}
                shakeKey={shakeKey} hintsUsed={snap?.hintsUsed ?? 0} onHint={() => eng()?.requestHint()} onClose={() => eng()?.closeStation()}
              />
            )}
            {level === 4 && station === 'terminal' && (
              <FinalEscapeConsole key="final" entries={code} setEntries={(e) => { setCode(e); setCodeWrong([false, false, false, false]); }}
                wrong={codeWrong} onSubmit={onFinal} onClose={() => eng()?.closeStation()} onKey={() => audio.segment()} locked={snap?.stage !== 'final'} />
            )}
          </AnimatePresence>

          {phase !== 'intro' && snap && <IntelligenceBag open={bagOpen} onToggle={toggleBag} live={snap.bag} progress={progress} level={level} />}

          <AnimatePresence>
            {phase === 'intro' && !exited && card == null && (
              <LevelIntro key="intro" onStart={newGame} onRules={openRules} onExit={() => setExitAsk('menu')}
                continueLevel={continueLevel} onContinue={continueLevel ? () => showCard(continueLevel) : undefined} />
            )}
            {phase === 'intro' && card != null && !rulesOpen && (
              <LevelIntroCard key={`card${card}`} level={card} onStart={() => startLevel(card, false)} onRules={openRules} onMenu={toMenu} />
            )}
            {phase === 'paused' && !rulesOpen && !exitAsk && (
              <PauseMenu key="pause" onResume={() => eng()?.resume()} onRestart={restartLevel} onRules={openRules} onMenu={() => setExitAsk('game')} />
            )}
            {snap?.showFailure && <FailureScreen key="fail" level={level} onRetry={newGame} onMenu={toMenu} />}
            {snap?.showComplete && level === 2 && (
              <LevelCompleteScreen key="done2" snap={snap} onReplay={newGame} onMenu={toMenu} onContinue={progress.level2 ? () => showCard(3) : undefined} />
            )}
            {snap?.showComplete && level === 3 && progress.level3 && (
              <Level3CompleteScreen key="done3" triangles={progress.level3.triangles} timeMs={progress.times[3] ?? 0} hints={progress.hints[3]} onContinue={() => showCard(4)} onMenu={toMenu} />
            )}
            {snap?.showComplete && level === 4 && progress.level4.escaped && (
              <VictoryScreen key="victory" progress={progress} onRestart={newGame} onMenu={toMenu} />
            )}
            {rulesOpen && <RulesPanel key="rules" level={card ?? level} inGame={playing} onClose={() => setRulesOpen(false)} />}
            {exitAsk && (
              <ExitConfirm key="exit" inGame={exitAsk === 'game'} onCancel={() => setExitAsk(null)}
                onConfirm={() => { if (exitAsk === 'game') toMenu(); else { setExitAsk(null); setExited(true); audio.setMuted(true); } }} />
            )}
          </AnimatePresence>
          {exited && <ExitedScreen onBack={() => { setExited(false); audio.setMuted(muted); }} />}
        </div>
      </main>
      {!desktop && <DesktopOnly />}
    </div>
  );
}
