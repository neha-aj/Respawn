import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, LogOut, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { drawThanosFace } from '../game/art';
import { GreenAudio } from '../game/audio';
import { H, LEVEL, RULES_PLACEHOLDER, W } from '../game/config';
import { GreenEngine, type Snapshot } from '../game/engine';

/**
 * Level GREEN as one self-contained component, ready to drop into a larger game.
 *   onComplete — called once when Thanos enters the tree portal
 *   onExit     — called by the Exit button (defaults to a "you can close this tab" screen)
 */
export default function GreenLevel({ onComplete, onExit }: { onComplete?: () => void; onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GreenEngine | null>(null);
  const audioRef = useRef<GreenAudio | null>(null);
  if (!audioRef.current) audioRef.current = new GreenAudio();
  const audio = audioRef.current;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [muted, setMuted] = useState(false);
  const [exited, setExited] = useState(false);
  const mutedRef = useRef(false), completeRef = useRef(onComplete); completeRef.current = onComplete;
  const desktop = useMemo(() => !window.matchMedia || window.matchMedia('(any-pointer: fine)').matches, []);

  const toggleMute = useCallback(() => { const m = !mutedRef.current; mutedRef.current = m; audio.setMuted(m); setMuted(m); }, [audio]);
  useEffect(() => {
    const e = new GreenEngine(canvasRef.current!, audio, setSnap, () => toggleMute());
    engineRef.current = e;
    if (import.meta.env.DEV) (window as unknown as { __green?: GreenEngine }).__green = e;   // dev-only test hook
    return () => { e.destroy(); engineRef.current = null; audio.destroy(); };
  }, [audio, toggleMute]);
  useEffect(() => { if (snap?.won) completeRef.current?.(); }, [snap?.won]);

  const eng = () => engineRef.current;
  const click = (fn: () => void) => () => { audio.play('click'); fn(); };
  const exit = () => (onExit ? onExit() : setExited(true));
  const state = snap?.state ?? 'TITLE';
  const tl = snap?.timeLeft ?? 0;

  return (
    <div className="flex h-full w-full items-center justify-center bg-grn-void">
      <div className="relative" style={{ width: `min(100vw, calc(100vh * ${W} / ${H}))`, aspectRatio: `${W} / ${H}` }}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair" aria-label="Green: Thanos explores a dark forest maze with a flashlight, hunted by a phantom" />
        <button type="button" onClick={toggleMute} aria-pressed={!muted} aria-label={muted ? 'Sound off. Click to turn on' : 'Sound on. Click to mute'}
          className="absolute bottom-2 right-2 z-20 flex items-center gap-1 border border-grn-moss bg-grn-void/80 px-3 py-1 font-grn text-[11px] text-grn-dim hover:text-grn-text">
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />} {muted ? 'MUTED' : 'SOUND'}
        </button>
        <AnimatePresence>
          {state === 'TITLE' && (
            <Screen key="title" tint={0.55}>
              <h1 className="mt-1 font-fell text-[clamp(40px,7vw,76px)] leading-none text-grn-text [text-shadow:0_0_18px_rgba(57,255,20,0.35)]">{LEVEL.title}</h1>
              <p className="mt-3 font-grn text-lg text-grn-pale">{LEVEL.tagline}</p>
              <p className="font-grn text-sm text-grn-text">{LEVEL.goal}</p>
              <div className="mt-4 flex items-center gap-6">
                <div className="flex flex-col items-center"><Portrait /><span className="mt-1 font-grn text-[11px] text-grn-dim">YOU ARE THANOS</span></div>
                <ul className="space-y-1 text-left font-grn text-sm text-grn-text">{LEVEL.controls.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
              <p className="mt-4 animate-pulse font-grn text-xl text-grn-glow">PRESS ENTER TO BEGIN</p>
              <div className="mt-4 flex flex-col gap-3">
                <ForestButton onClick={click(() => eng()?.start())} autoFocus><Play size={15} /> BEGIN</ForestButton>
                <ForestButton onClick={click(() => eng()?.showRules(true))}><BookOpen size={15} /> RULES</ForestButton>
                <ForestButton onClick={click(exit)}><LogOut size={15} /> EXIT</ForestButton>
              </div>
              <p className="mt-3 font-grn text-[11px] text-grn-dim">R RESTART · P / ESC PAUSE · M MUTE · H RULES</p>
            </Screen>
          )}
          {state === 'RULES' && (
            <Screen key="rules" tint={0.85}>
              <h2 className="font-fell text-5xl text-grn-text">RULES</h2>
              {RULES_PLACEHOLDER.isPlaceholder && <p className="mt-2 font-grn text-xs text-grn-light">PLACEHOLDER — FINAL RULES TO BE ATTACHED</p>}
              <ul className="mt-5 max-w-[720px] space-y-2 text-left font-grn text-[14px] leading-snug text-grn-pale">{RULES_PLACEHOLDER.lines.map((l) => <li key={l}>~ {l}</li>)}</ul>
              <p className="mt-4 font-grn text-xs text-grn-dim">{RULES_PLACEHOLDER.controls}</p>
              <div className="mt-6"><ForestButton onClick={click(() => eng()?.showRules(false))} autoFocus>BACK</ForestButton></div>
            </Screen>
          )}
          {state === 'PAUSED' && (
            <Screen key="pause">
              <h2 className="flex items-center gap-3 font-fell text-6xl text-grn-text"><Pause size={44} /> PAUSED</h2>
              <div className="mt-8 flex flex-col gap-3">
                <ForestButton onClick={click(() => eng()?.resume())} autoFocus><Play size={15} /> RESUME</ForestButton>
                <ForestButton onClick={click(() => eng()?.restart())}><RotateCcw size={15} /> RESTART (R)</ForestButton>
                <ForestButton onClick={click(exit)}><LogOut size={15} /> EXIT</ForestButton>
              </div>
            </Screen>
          )}
          {state === 'GAME_OVER' && (
            <Screen key="over" tint={0.85}>
              <h2 className="font-fell text-[clamp(34px,5.5vw,60px)] text-grn-text [text-shadow:0_0_20px_rgba(57,255,20,0.3)]">{LEVEL.over[0]}</h2>
              <p className="mt-3 font-grn text-base text-grn-dim">{snap?.cause}</p>
              <p className="mt-3 font-grn text-xl text-grn-pale">{LEVEL.over[1]}</p>
              <div className="mt-6"><ForestButton onClick={click(() => eng()?.restart())} autoFocus><RotateCcw size={15} /> TRY AGAIN (R)</ForestButton></div>
            </Screen>
          )}
          {snap?.won && (
            <Screen key="won" tint={0.6}>
              <h2 className="font-fell text-[clamp(36px,6vw,64px)] text-grn-portal [text-shadow:0_0_24px_#39FF14]">{LEVEL.victory[0]}</h2>
              <p className="mt-3 font-grn text-2xl tracking-[0.1em] text-grn-glow">{LEVEL.victory[1]}</p>
              <p className="mt-3 font-grn text-sm text-grn-dim">LIVES {snap.lives} · RUNES 3/3 · TIME LEFT {Math.floor(tl / 60)}:{String(tl % 60).padStart(2, '0')}</p>
              <p className="mt-3 font-grn text-xl text-grn-pale">{LEVEL.victory[2]}</p>
              <div className="mt-6"><ForestButton onClick={click(() => eng()?.restart())} autoFocus><RotateCcw size={15} /> REPLAY (R)</ForestButton></div>
            </Screen>
          )}
        </AnimatePresence>
        {exited && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-grn-void text-center">
            <p className="font-fell text-5xl text-grn-text">GREEN</p>
            <p className="font-grn text-base text-grn-pale">The forest falls silent. You can close this browser tab now.</p>
            <ForestButton onClick={() => setExited(false)}>BACK</ForestButton>
          </div>
        )}
      </div>
      {!desktop && <div className="fixed inset-0 z-50 flex items-center justify-center bg-grn-void p-8 text-center font-grn text-lg text-grn-pale">GREEN is made for desktop and laptop computers with a keyboard and mouse.</div>}
    </div>
  );
}

function Portrait() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!; let raf = 0;
    const loop = (now: number) => {
      g.fillStyle = '#020A03'; g.fillRect(0, 0, 92, 92); g.strokeStyle = '#1E4620'; g.lineWidth = 2; g.strokeRect(1, 1, 90, 90);
      drawThanosFace(g, 46, 46, 38, 'wary', now / 1000); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={92} height={92} className="h-[92px] w-[92px]" aria-label="Thanos, wary" />;
}

function Screen({ children, tint = 0.7 }: { children: ReactNode; tint?: number }) {
  return (
    <motion.div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center"
      style={{ background: `radial-gradient(ellipse at center, rgba(2,10,3,${tint * 0.55}), rgba(2,10,3,${Math.min(0.96, tint + 0.25)}) 80%)` }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      {children}
    </motion.div>
  );
}

function ForestButton({ children, onClick, autoFocus }: { children: ReactNode; onClick: () => void; autoFocus?: boolean }) {
  return (
    <button type="button" onClick={onClick} autoFocus={autoFocus}
      className="flex w-64 items-center justify-center gap-2 border-2 border-grn-dim bg-grn-void/85 py-2 font-grn text-lg tracking-[0.2em] text-grn-text transition hover:border-grn-glow hover:bg-grn-moss hover:text-grn-portal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grn-glow">
      {children}
    </button>
  );
}
