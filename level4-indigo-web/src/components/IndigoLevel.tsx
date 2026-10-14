import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, LogOut, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IndigoAudio } from '../game/audio';
import { H, LEVEL, RULES_PLACEHOLDER, W } from '../game/config';
import { IndigoEngine, type Snapshot } from '../game/engine';

/**
 * Level INDIGO as one self-contained component, ready to drop into a larger game.
 *   onComplete — called once when Thanos passes through the Indigo Gate
 *   onExit     — called by the Exit button (defaults to a "you can close this tab" screen)
 */
export default function IndigoLevel({ onComplete, onExit }: { onComplete?: () => void; onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<IndigoEngine | null>(null);
  const audioRef = useRef<IndigoAudio | null>(null);
  if (!audioRef.current) audioRef.current = new IndigoAudio();
  const audio = audioRef.current;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [muted, setMuted] = useState(false);
  const [exited, setExited] = useState(false);
  const mutedRef = useRef(false), completeRef = useRef(onComplete); completeRef.current = onComplete;
  const desktop = useMemo(() => !window.matchMedia || window.matchMedia('(any-pointer: fine)').matches, []);

  const toggleMute = useCallback(() => { const m = !mutedRef.current; mutedRef.current = m; audio.setMuted(m); setMuted(m); }, [audio]);
  useEffect(() => {
    const e = new IndigoEngine(canvasRef.current!, audio, setSnap, () => toggleMute());
    engineRef.current = e;
    if (import.meta.env.DEV) (window as unknown as { __indigo?: IndigoEngine }).__indigo = e;   // dev-only test hook
    return () => { e.destroy(); engineRef.current = null; audio.destroy(); };
  }, [audio, toggleMute]);
  useEffect(() => { if (snap?.won) completeRef.current?.(); }, [snap?.won]);

  const eng = () => engineRef.current;
  const click = (fn: () => void) => () => { audio.play('click'); fn(); };
  const exit = () => (onExit ? onExit() : setExited(true));
  const state = snap?.state ?? 'menu';
  const tl = snap?.timeLeft ?? 0;

  return (
    <div className="flex h-full w-full items-center justify-center bg-ind-bg">
      <div className="relative" style={{ width: `min(100vw, calc(100vh * ${W} / ${H}))`, aspectRatio: `${W} / ${H}` }}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Indigo: Thanos in an astronaut helmet pilots a ship through gravity wells toward the Indigo Gate" />
        <button type="button" onClick={toggleMute} aria-pressed={!muted} aria-label={muted ? 'Sound off. Click to turn on' : 'Sound on. Click to mute'}
          className="absolute bottom-7 right-2 z-20 flex items-center gap-1 rounded-full border border-ind-laser bg-ind-bg/80 px-3 py-1 font-ind text-[11px] text-ind-pale hover:text-ind-white">
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />} {muted ? 'MUTED' : 'SOUND'}
        </button>
        <AnimatePresence>
          {state === 'menu' && (
            <Screen key="menu" tint={0.35}>
              <h1 className="font-ind text-[clamp(52px,9vw,96px)] font-black italic tracking-[0.12em] text-ind-white [text-shadow:0_0_24px_#A066FF,0_0_60px_#6C2DC7]">INDIGO</h1>
              <p className="mt-2 font-ind text-sm text-ind-pale">Thanos must pilot through the Indigo Dimension to the gate.</p>
              <div className="mt-8 flex flex-col gap-4">
                <OrbitButton onClick={click(() => eng()?.start())} autoFocus><Play size={15} /> START</OrbitButton>
                <OrbitButton onClick={click(() => eng()?.showRules(true))}><BookOpen size={15} /> RULES</OrbitButton>
                <OrbitButton onClick={click(exit)}><LogOut size={15} /> EXIT</OrbitButton>
              </div>
              <p className="mt-6 font-ind text-xs text-ind-soft">ENTER or SPACE to start</p>
            </Screen>
          )}
          {state === 'rules' && (
            <Screen key="rules" tint={0.82}>
              <h2 className="font-ind text-5xl font-black italic text-ind-white [text-shadow:0_0_16px_#A066FF]">RULES</h2>
              {RULES_PLACEHOLDER.isPlaceholder && <p className="mt-2 font-ind text-xs font-semibold text-ind-lilac">PLACEHOLDER — FINAL RULES TO BE ATTACHED</p>}
              <ul className="mt-5 max-w-[700px] space-y-2 text-left font-ind text-[14px] leading-snug text-ind-pale">{RULES_PLACEHOLDER.lines.map((l) => <li key={l}>✦ {l}</li>)}</ul>
              <p className="mt-4 font-ind text-xs text-ind-soft">{RULES_PLACEHOLDER.controls}</p>
              <div className="mt-6"><OrbitButton onClick={click(() => eng()?.showRules(false))} autoFocus>BACK</OrbitButton></div>
            </Screen>
          )}
          {state === 'pause' && (
            <Screen key="pause">
              <h2 className="flex items-center gap-3 font-ind text-6xl font-black italic text-ind-white [text-shadow:0_0_16px_#A066FF]"><Pause size={44} /> PAUSED</h2>
              <div className="mt-8 flex flex-col gap-4">
                <OrbitButton onClick={click(() => eng()?.resume())} autoFocus><Play size={15} /> RESUME</OrbitButton>
                <OrbitButton onClick={click(() => eng()?.toMenu())}>MAIN MENU</OrbitButton>
                <OrbitButton onClick={click(exit)}><LogOut size={15} /> EXIT</OrbitButton>
              </div>
            </Screen>
          )}
          {state === 'over' && (
            <Screen key="over" tint={0.85}>
              <h2 className="font-ind text-7xl font-black italic text-ind-white [text-shadow:0_0_20px_#6C2DC7]">SIGNAL LOST</h2>
              <p className="mt-3 font-ind text-xl font-bold text-ind-lilac">{snap?.reason}</p>
              <p className="mt-3 font-ind text-lg font-semibold text-ind-pale">PRESS R TO RETRY</p>
              <div className="mt-6 flex flex-col gap-4">
                <OrbitButton onClick={click(() => eng()?.restart())} autoFocus><RotateCcw size={15} /> RETRY (R)</OrbitButton>
                <OrbitButton onClick={click(() => eng()?.toMenu())}>MAIN MENU</OrbitButton>
              </div>
            </Screen>
          )}
          {snap?.won && (
            <Screen key="won" tint={0.55}>
              <h2 className="font-ind text-[clamp(32px,5vw,58px)] font-black italic text-ind-white [text-shadow:0_0_24px_#A066FF,0_0_50px_#6C2DC7]">{LEVEL.victory[0]}</h2>
              <p className="mt-3 font-ind text-2xl font-bold tracking-[0.12em] text-ind-lilac">{LEVEL.victory[1]}</p>
              <p className="mt-3 font-ind text-sm text-ind-pale">Lives {snap.lives} · Anchors {snap.shots} · Time {Math.floor(tl / 60)}:{String(tl % 60).padStart(2, '0')}</p>
              <p className="mt-3 font-ind text-lg font-semibold text-ind-pale">PRESS R TO REPLAY INDIGO</p>
              <div className="mt-6 flex flex-col gap-4">
                <OrbitButton onClick={click(() => eng()?.restart())} autoFocus><RotateCcw size={15} /> REPLAY (R)</OrbitButton>
                <OrbitButton onClick={click(() => eng()?.toMenu())}>MAIN MENU</OrbitButton>
              </div>
            </Screen>
          )}
        </AnimatePresence>
        {exited && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-ind-bg text-center">
            <p className="font-ind text-4xl font-black italic text-ind-white">INDIGO</p>
            <p className="font-ind text-base text-ind-pale">The anomaly falls silent. You can close this browser tab now.</p>
            <OrbitButton onClick={() => setExited(false)}>BACK</OrbitButton>
          </div>
        )}
      </div>
      {!desktop && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ind-bg p-8 text-center font-ind text-lg text-ind-pale">INDIGO is made for desktop and laptop computers with a keyboard.</div>}
    </div>
  );
}

function Screen({ children, tint = 0.7 }: { children: ReactNode; tint?: number }) {
  return (
    <motion.div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center"
      style={{ background: `radial-gradient(ellipse at center, rgba(8,0,26,${tint * 0.5}), rgba(8,0,26,${Math.min(0.95, tint + 0.25)}) 78%)` }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      {children}
    </motion.div>
  );
}

function OrbitButton({ children, onClick, autoFocus }: { children: ReactNode; onClick: () => void; autoFocus?: boolean }) {
  return (
    <button type="button" onClick={onClick} autoFocus={autoFocus}
      className="flex w-72 items-center justify-center gap-2 rounded-full border-2 border-ind-portal bg-ind-deep/80 py-3 font-ind text-base font-bold italic tracking-[0.2em] text-ind-pale shadow-[0_0_18px_rgba(160,102,255,0.45)] transition hover:bg-ind-mid hover:text-ind-white hover:shadow-[0_0_30px_rgba(200,182,255,0.75)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ind-pale">
      {children}
    </button>
  );
}
