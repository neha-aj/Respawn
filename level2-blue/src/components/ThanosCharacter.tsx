import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { GameMessage } from '../game/engine';
import { EXPRESSION_LABEL, type Expression } from '../game/sprites';

/**
 * Close-up of Thanos at the bottom of the screen. The pixels are painted by the
 * engine (setPortraitCanvas) so the face always matches the in-world sprite.
 */
export function ThanosPortrait({ canvasRef, expression, critical }: { canvasRef: (c: HTMLCanvasElement | null) => void; expression: Expression; critical: boolean }) {
  return (
    <div className="pointer-events-none absolute bottom-[3%] left-[2%] z-10 flex items-end gap-2" aria-live="polite">
      <div className={`bg-abyss/80 p-1 ${critical ? 'pixel-frame-bright' : 'pixel-frame'}`}>
        <canvas ref={canvasRef} width={64} height={64} className="pixelated block h-[clamp(72px,14vh,128px)] w-[clamp(72px,14vh,128px)]" aria-label={`Thanos looks ${EXPRESSION_LABEL[expression].toLowerCase()}`} role="img" />
      </div>
      <span className="mb-1 bg-abyss/80 px-2 py-0.5 font-pixel text-[8px] text-pale">{EXPRESSION_LABEL[expression].toUpperCase()}</span>
    </div>
  );
}

const KIND_STYLE: Record<GameMessage['kind'], string> = {
  info: 'border-deep text-pale',
  good: 'border-cyan text-ice drop-shadow-[0_0_6px_#258BFF]',
  bad: 'border-electric text-ice animate-pulseborder',
  hint: 'border-primary text-cyan',
};

/** Bottom-centre game message; auto-hides after a few seconds. */
export function MessageToast({ message, shifted = false, bottom = false }: { message: GameMessage | null; shifted?: boolean; bottom?: boolean }) {
  const [shown, setShown] = useState<GameMessage | null>(null);
  useEffect(() => {
    if (!message) return;
    setShown(message);
    const h = window.setTimeout(() => setShown((m) => (m?.id === message.id ? null : m)), message.kind === 'hint' ? 7000 : 4600);
    return () => window.clearTimeout(h);
  }, [message]);
  return (
    <div className={`pointer-events-none absolute z-30 ${bottom ? 'bottom-[3%] left-[20%] w-[62%]' : shifted ? 'left-[64%] top-[5%] w-[33%]' : 'left-1/2 top-[8%] w-[min(640px,62%)] -translate-x-1/2'}`} aria-live="assertive">
      <AnimatePresence>
        {shown && (
          <motion.p key={shown.id} className={`border-2 bg-abyss/90 px-4 py-2 text-center font-term text-xl leading-tight ${KIND_STYLE[shown.kind]}`}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            {shown.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
