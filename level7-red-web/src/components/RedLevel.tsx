import { useEffect, useMemo, useRef, useState } from 'react';
import { createRedGame } from '../game/scenes/index.js';

/**
 * RED as one self-contained component.
 *   onComplete — called once with 'red' when Thanos walks through the last door
 *   onExit     — called by the title's EXIT button (defaults to a "you can close this tab" screen)
 */
export default function RedLevel({ onComplete, onExit }: { onComplete?: (id: string) => void; onExit?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [exited, setExited] = useState(false);
  const cb = useRef({ onComplete, onExit }); cb.current = { onComplete, onExit };
  const desktop = useMemo(() => !window.matchMedia || window.matchMedia('(any-pointer: fine)').matches, []);

  useEffect(() => {
    let handle: { destroy: () => void; game: unknown } | null = null, cancelled = false;
    const boot = () => {
      if (cancelled || !host.current) return;
      handle = createRedGame(host.current, {
        onComplete: (id: string) => cb.current.onComplete?.(id),
        onExit: () => (cb.current.onExit ? cb.current.onExit() : setExited(true)),
      });
      if (import.meta.env.DEV) (window as unknown as { __red?: unknown }).__red = handle!.game;   // dev-only test hook
    };
    // Phaser draws text with whatever font is ready, so wait for the monospace face first.
    Promise.race([document.fonts?.load('20px "IBM Plex Mono"') ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).then(boot, boot);
    return () => { cancelled = true; handle?.destroy(); };
  }, []);

  return (
    <div className="relative h-full w-full bg-red-bg">
      <div ref={host} className="h-full w-full" aria-label="Red: a rage platformer. Guide Thanos through four rooms to the lit doorway." />
      {exited && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-red-bg text-center font-mono">
          <p className="text-6xl font-bold text-red-text">RED</p>
          <p className="text-red-edge">The room goes dark. You can close this browser tab now.</p>
          <button type="button" onClick={() => setExited(false)} className="border-2 border-red-edge px-8 py-2 text-red-text hover:bg-red-plat focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-text">BACK</button>
        </div>
      )}
      {!desktop && <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-bg p-8 text-center font-mono text-red-text">RED needs a keyboard. Play it on a desktop or laptop.</div>}
    </div>
  );
}
