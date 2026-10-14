import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { YellowAudio } from '../game/audio';
import { H, W } from '../game/config';
import { YellowEngine, type Snapshot } from '../game/engine';

/**
 * Level YELLOW as one self-contained component, ready to drop into a larger game.
 * Every screen (title, rules, HUD, pause, results) is drawn on the canvas.
 *   onComplete — called once when Thanos walks through the Phase Door
 *   onExit     — called by the Exit button (defaults to a "you can close this tab" screen)
 */
export default function YellowLevel({ onComplete, onExit }: { onComplete?: () => void; onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<YellowAudio | null>(null);
  if (!audioRef.current) audioRef.current = new YellowAudio();
  const audio = audioRef.current;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [exited, setExited] = useState(false);
  const completeRef = useRef(onComplete); completeRef.current = onComplete;
  const exitRef = useRef(onExit); exitRef.current = onExit;
  const desktop = useMemo(() => !window.matchMedia || window.matchMedia('(any-pointer: fine)').matches, []);

  const toggleMute = useCallback(() => audio.setMuted(!audio.muted), [audio]);
  useEffect(() => {
    const e = new YellowEngine(canvasRef.current!, audio, setSnap, toggleMute, () => (exitRef.current ? exitRef.current() : setExited(true)));
    if (import.meta.env.DEV) (window as unknown as { __yellow?: YellowEngine }).__yellow = e;   // dev-only test hook
    return () => { e.destroy(); audio.destroy(); };
  }, [audio, toggleMute]);
  useEffect(() => { if (snap?.won) completeRef.current?.(); }, [snap?.won]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-ylw-ink">
      <div className="relative" style={{ width: `min(100vw, calc(100vh * ${W} / ${H}))`, aspectRatio: `${W} / ${H}` }}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full [image-rendering:pixelated]" tabIndex={0}
          aria-label="Yellow: a 2D fighting game. Thanos fights Wolverine in a golden throne room." />
        {exited && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-ylw-ink text-center font-ylw">
            <p className="text-5xl text-ylw-energy">YELLOW</p>
            <p className="text-sm text-ylw-fx">THE ARENA FALLS SILENT. YOU CAN CLOSE THIS TAB NOW.</p>
            <button type="button" onClick={() => setExited(false)} className="border-2 border-ylw-gold bg-ylw-deep px-8 py-3 text-sm text-ylw-fx hover:border-ylw-energy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ylw-fx">BACK</button>
          </div>
        )}
      </div>
      {!desktop && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ylw-ink p-8 text-center font-ylw text-sm leading-relaxed text-ylw-fx">YELLOW IS A KEYBOARD FIGHTING GAME. PLAY IT ON A COMPUTER.</div>}
    </div>
  );
}
