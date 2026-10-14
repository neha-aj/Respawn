import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, LogOut, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { VioletAudio } from '../game/audio';
import { H, LEVEL, RULES_PLACEHOLDER, W } from '../game/config';
import { VioletEngine, type Snapshot } from '../game/engine';

/**
 * Level VIOLET as one self-contained component, ready to drop into a larger game.
 *   onComplete — called once when the Phase Door is struck (victory)
 *   onExit     — called by the Exit button (defaults to a "you can close this tab" screen)
 */
export default function VioletLevel({ onComplete, onExit }: { onComplete?: () => void; onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VioletEngine | null>(null);
  const audioRef = useRef<VioletAudio | null>(null);
  if (!audioRef.current) audioRef.current = new VioletAudio();
  const audio = audioRef.current;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [muted, setMuted] = useState(false);
  const [exited, setExited] = useState(false);
  const mutedRef = useRef(false);
  const completeRef = useRef(onComplete); completeRef.current = onComplete;
  const desktop = useMemo(() => !window.matchMedia || window.matchMedia('(any-pointer: fine)').matches, []);

  const toggleMute = useCallback(() => {
    const m = !mutedRef.current; mutedRef.current = m; audio.setMuted(m); setMuted(m);
  }, [audio]);

  useEffect(() => {
    const eng = new VioletEngine(canvasRef.current!, audio, setSnap, () => toggleMute());
    engineRef.current = eng;
    if (import.meta.env.DEV) (window as unknown as { __violet?: VioletEngine }).__violet = eng;   // dev-only test hook
    return () => { eng.destroy(); engineRef.current = null; audio.destroy(); };
  }, [audio, toggleMute]);

  const won = snap?.state === 'won';
  useEffect(() => { if (won) completeRef.current?.(); }, [won]);

  const eng = () => engineRef.current;
  const click = (fn: () => void) => () => { audio.play('click'); fn(); };
  const state = snap?.state ?? 'menu';

  return (
    <div className="flex h-full w-full items-center justify-center bg-vio-bg">
      <div className="relative" style={{ width: `min(100vw, calc(100vh * ${W} / ${H}))`, aspectRatio: `${W} / ${H}` }}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-none" aria-label="Violet: Thanos in a neon violet city, facing security drones and a hidden Phase Door" />
        <button type="button" onClick={toggleMute} aria-label={muted ? 'Sound off. Click to turn on' : 'Sound on. Click to mute'} aria-pressed={!muted}
          className="absolute bottom-2 right-2 z-20 flex items-center gap-1 border border-vio-wall bg-vio-bg/80 px-2 py-1 font-vio text-[10px] text-vio-soft hover:text-vio-pale">
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />} {muted ? 'MUTED' : 'SOUND'}
        </button>
        <AnimatePresence>
          {state === 'menu' && (
            <Screen key="menu">
              <h1 className="font-vio text-[clamp(44px,8vw,84px)] font-black tracking-[0.18em] text-vio-pale [text-shadow:0_0_18px_#8F00FF,0_0_42px_#8F00FF]">{LEVEL.name}</h1>
              <p className="mt-3 font-vio text-xs text-vio-lilac">{LEVEL.tagline}</p>
              <div className="mt-8 flex flex-col gap-4">
                <NeonButton onClick={click(() => eng()?.start())} autoFocus><Play size={14} /> START</NeonButton>
                <NeonButton onClick={click(() => eng()?.showRules(true))}><BookOpen size={14} /> RULES</NeonButton>
                <NeonButton onClick={click(() => (onExit ? onExit() : setExited(true)))}><LogOut size={14} /> EXIT</NeonButton>
              </div>
            </Screen>
          )}
          {state === 'rules' && (
            <Screen key="rules">
              <h2 className="font-vio text-4xl font-black tracking-[0.2em] text-vio-pale [text-shadow:0_0_14px_#8F00FF]">RULES</h2>
              {RULES_PLACEHOLDER.isPlaceholder && <p className="mt-2 font-vio text-[11px] text-vio-orchid">PLACEHOLDER — FINAL RULES TO BE ATTACHED</p>}
              <ul className="mt-5 max-w-[680px] space-y-2 text-left font-vio text-[13px] leading-snug text-vio-soft">
                {RULES_PLACEHOLDER.lines.map((l) => <li key={l}>▸ {l}</li>)}
              </ul>
              <p className="mt-4 font-vio text-[11px] text-vio-lilac">{RULES_PLACEHOLDER.controls}</p>
              <div className="mt-6"><NeonButton onClick={click(() => eng()?.showRules(false))} autoFocus>BACK</NeonButton></div>
            </Screen>
          )}
          {state === 'pause' && (
            <Screen key="pause">
              <h2 className="flex items-center gap-3 font-vio text-5xl font-black text-vio-pale [text-shadow:0_0_16px_#8F00FF]"><Pause size={36} /> PAUSED</h2>
              <div className="mt-8 flex flex-col gap-4">
                <NeonButton onClick={click(() => eng()?.resume())} autoFocus><Play size={14} /> RESUME</NeonButton>
                <NeonButton onClick={click(() => eng()?.toMenu())}>MAIN MENU</NeonButton>
                <NeonButton onClick={click(() => (onExit ? onExit() : setExited(true)))}><LogOut size={14} /> EXIT</NeonButton>
              </div>
            </Screen>
          )}
          {state === 'over' && (
            <Screen key="over" tint={0.6}>
              <h2 className="font-vio text-6xl font-black text-vio-pale [text-shadow:0_0_18px_#8F00FF]">GAME OVER</h2>
              <p className="mt-3 font-vio text-xl font-bold text-vio-orchid">{snap?.overReason}</p>
              <p className="mt-3 font-vio text-sm text-vio-soft">Press R to restart the level</p>
              <div className="mt-6 flex flex-col gap-4">
                <NeonButton onClick={click(() => eng()?.restart())} autoFocus><RotateCcw size={14} /> RESTART (R)</NeonButton>
                <NeonButton onClick={click(() => eng()?.toMenu())}>MAIN MENU</NeonButton>
              </div>
            </Screen>
          )}
          {won && snap?.wonT === 1 && (
            <Screen key="won" tint={0.5}>
              <h2 className="font-vio text-[clamp(26px,4.4vw,46px)] font-black text-vio-pale [text-shadow:0_0_20px_#F0DCFF,0_0_40px_#8F00FF]">PHASE DOOR UNLOCKED.</h2>
              <p className="mt-3 font-vio text-lg font-bold tracking-[0.15em] text-vio-lilac [text-shadow:0_0_12px_#8F00FF]">TRANSITIONING TO LEVEL: INDIGO</p>
              <p className="mt-3 font-vio text-xs text-vio-soft">Bullets left {snap.ammo} · Lives {snap.lives} · Time {Math.floor(snap.timeLeft / 60)}:{String(snap.timeLeft % 60).padStart(2, '0')}</p>
              <div className="mt-6 flex flex-col gap-4">
                <NeonButton onClick={click(() => eng()?.restart())} autoFocus><RotateCcw size={14} /> RESTART (R)</NeonButton>
                <NeonButton onClick={click(() => eng()?.toMenu())}>MAIN MENU</NeonButton>
              </div>
            </Screen>
          )}
        </AnimatePresence>
        {exited && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-vio-bg text-center">
            <p className="font-vio text-3xl font-black text-vio-pale">VIOLET</p>
            <p className="font-vio text-sm text-vio-soft">The city goes quiet. You can close this browser tab now.</p>
            <NeonButton onClick={() => setExited(false)}>BACK</NeonButton>
          </div>
        )}
      </div>
      {!desktop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-vio-bg p-8 text-center font-vio text-lg text-vio-soft">
          VIOLET is made for desktop and laptop computers with a keyboard and mouse.
        </div>
      )}
    </div>
  );
}

function Screen({ children, tint = 0.72 }: { children: ReactNode; tint?: number }) {
  return (
    <motion.div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center"
      style={{ background: `radial-gradient(ellipse at center, rgba(18,0,36,${tint * 0.6}), rgba(18,0,36,${tint + 0.2}) 75%)` }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      {children}
    </motion.div>
  );
}

function NeonButton({ children, onClick, autoFocus }: { children: ReactNode; onClick: () => void; autoFocus?: boolean }) {
  return (
    <button type="button" onClick={onClick} autoFocus={autoFocus}
      className="flex w-64 items-center justify-center gap-2 border-2 border-vio-wall bg-vio-deep/80 py-3 font-vio text-sm font-bold tracking-[0.25em] text-vio-soft shadow-[0_0_14px_rgba(160,32,240,0.55),inset_0_0_10px_rgba(160,32,240,0.35)] transition hover:border-vio-pale hover:bg-vio-mid hover:text-vio-pale hover:shadow-[0_0_24px_rgba(236,222,255,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-vio-pale">
      {children}
    </button>
  );
}
