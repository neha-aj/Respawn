import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OrangeAudio } from '../game/audio';
import { H, W } from '../game/config';
import { OrangeEngine, type Snapshot } from '../game/engine';

/**
 * Level ORANGE as one self-contained component, ready to drop into a larger game.
 * Every screen (title, rules, ready, HUD, pause, results) is drawn on the canvas in the pixel font.
 *   onComplete — called once when Thanos steps through the Phase Door
 *   onExit     — called by the Exit button (defaults to a "you can close this tab" screen)
 */
export default function OrangeLevel({ onComplete, onExit }: { onComplete?: () => void; onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<OrangeAudio | null>(null);
  if (!audioRef.current) audioRef.current = new OrangeAudio();
  const audio = audioRef.current;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [exited, setExited] = useState(false);
  const completeRef = useRef(onComplete); completeRef.current = onComplete;
  const exitRef = useRef(onExit); exitRef.current = onExit;
  const desktop = useMemo(() => !window.matchMedia || window.matchMedia('(any-pointer: fine)').matches, []);

  const toggleMute = useCallback(() => audio.setMuted(!audio.muted), [audio]);
  useEffect(() => {
    const e = new OrangeEngine(canvasRef.current!, audio, setSnap, toggleMute, () => (exitRef.current ? exitRef.current() : setExited(true)));
    if (import.meta.env.DEV) (window as unknown as { __orange?: OrangeEngine }).__orange = e;   // dev-only test hook
    return () => { e.destroy(); audio.destroy(); };
  }, [audio, toggleMute]);
  useEffect(() => { if (snap?.won) completeRef.current?.(); }, [snap?.won]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-org-ink">
      <div className="relative" style={{ width: `min(100vw, calc(100vh * ${W} / ${H}))`, aspectRatio: `${W} / ${H}` }}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full [image-rendering:pixelated]" tabIndex={0}
          aria-label="Orange: a typing dance game. Type the words on screen; each correct letter makes Thanos dance." />
        {exited && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-org-ink text-center font-org">
            <p className="text-5xl text-org-spot">ORANGE</p>
            <p className="text-sm leading-relaxed text-org-hud">THE MUSIC STOPS. YOU CAN CLOSE THIS BROWSER TAB NOW.</p>
            <button type="button" onClick={() => setExited(false)} className="border-2 border-org-spot bg-org-stage px-8 py-3 text-sm text-org-hud hover:text-org-door focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-org-door">BACK</button>
          </div>
        )}
      </div>
      {!desktop && <div className="fixed inset-0 z-50 flex items-center justify-center bg-org-ink p-8 text-center font-org text-sm leading-relaxed text-org-hud">ORANGE IS A TYPING GAME. PLAY IT ON A COMPUTER WITH A KEYBOARD.</div>}
    </div>
  );
}
