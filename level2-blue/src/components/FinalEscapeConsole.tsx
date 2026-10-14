import { motion } from 'framer-motion';
import { KeyRound, X } from 'lucide-react';
import { useRef, type FormEvent } from 'react';
import { FINAL_LABELS } from '../game/progress';

const SOURCES = ['Level 1 · balance', 'Level 2 · overlap', 'Level 3 · lock', 'Level 3 · digits'];
const MAXLEN = [3, 3, 2, 1];

/** Four separate segments: the player assembles the code from the Intelligence Bag. */
export function FinalEscapeConsole(p: {
  entries: string[]; setEntries: (e: string[]) => void; wrong: boolean[]; onSubmit: () => void; onClose: () => void; onKey: () => void; locked: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const submit = (e: FormEvent) => { e.preventDefault(); if (!p.locked) p.onSubmit(); };
  const set = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, MAXLEN[i]);
    const next = [...p.entries]; next[i] = clean; p.setEntries(next); p.onKey();
    if (clean.length === MAXLEN[i] && i < 3) refs.current[i + 1]?.focus();
  };
  return (
    <motion.div
      className="pixel-frame-bright absolute left-1/2 top-[10%] z-20 w-[min(680px,74%)] -translate-x-1/2 bg-navy/95 p-4"
      initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      role="dialog" aria-label="Final escape protocol"
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-pixel text-[10px] text-cyan"><KeyRound size={14} aria-hidden /> FINAL ESCAPE PROTOCOL</h2>
        <button type="button" onClick={p.onClose} aria-label="Close terminal (Esc)" className="text-primary hover:text-ice"><X size={16} /></button>
      </div>
      <p className="mt-2 font-term text-lg text-pale">Enter every clue you earned, in order. Format: <code className="text-cyan">BALANCE-TRIANGLES-TILE-DIGIT</code>. Open the Intelligence Bag if you need to check.</p>
      <form onSubmit={submit} className="mt-3" aria-label="Escape code">
        <div className="flex items-end justify-center gap-2">
          {FINAL_LABELS.map((label, i) => (
            <div key={label} className="flex items-end gap-2">
              <label className="flex flex-col items-center">
                <span className="font-pixel text-[7px] text-pale">{label.toUpperCase()}</span>
                <span className="font-term text-sm text-primary">{SOURCES[i]}</span>
                <input
                  ref={(el) => { refs.current[i] = el; }} autoFocus={i === 0} type="text" inputMode="numeric" value={p.entries[i] ?? ''} disabled={p.locked}
                  onChange={(e) => set(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Backspace' && !(p.entries[i] ?? '') && i > 0) refs.current[i - 1]?.focus(); }}
                  aria-label={label} aria-invalid={p.wrong[i]}
                  style={{ width: `${MAXLEN[i] * 1.6 + 1.4}em` }}
                  className={`mt-1 border-2 bg-abyss px-1 py-2 text-center font-pixel text-[18px] text-ice outline-none focus:border-cyan ${p.wrong[i] ? 'animate-pulseborder border-electric' : 'border-deep'}`}
                />
                <span className="h-4 font-term text-sm text-cyan">{p.wrong[i] ? 'check this' : ''}</span>
              </label>
              {i < 3 && <span className="pb-6 font-pixel text-[18px] text-primary">-</span>}
            </div>
          ))}
        </div>
        <button type="submit" disabled={p.locked} className="mt-3 w-full bg-electric py-3 font-pixel text-[11px] text-abyss shadow-[0_4px_0_#103D78] hover:bg-cyan active:translate-y-[2px] disabled:opacity-50">
          UNLOCK  ⏎
        </button>
      </form>
    </motion.div>
  );
}
