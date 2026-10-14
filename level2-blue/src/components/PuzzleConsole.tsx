import { AnimatePresence, motion } from 'framer-motion';
import { Lightbulb, Scale, X } from 'lucide-react';
import { useEffect, useRef, type FormEvent } from 'react';
import { EQUATIONS, HINTS, SHAPE_OF, WEIGHT_IDS, equationText, type WeightId, type WeightVerdict } from '../game/puzzle';
import { ShapeIcon } from './ShapeIcon';

/** Progressive hints. Revealing one never pauses the timer and never fills in answers. */
export function HintSystem({ used, onHint, hints = HINTS }: { used: number; onHint: () => void; hints?: readonly { title: string; text: string }[] }) {
  const latest = used > 0 ? hints[used - 1] : null;
  return (
    <section aria-label="Hints" className="flex min-w-0 items-start gap-2 border-t-2 border-dark pt-2">
      <button
        type="button" onClick={onHint} disabled={used >= hints.length}
        className="flex shrink-0 items-center gap-1 border-2 border-deep bg-navy px-2 py-1 font-pixel text-[8px] text-pale hover:border-cyan disabled:opacity-40"
      >
        <Lightbulb size={12} aria-hidden /> HINT {used}/{hints.length}
      </button>
      <AnimatePresence mode="wait">
        {latest && (
          <motion.p key={latest.title} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="min-w-0 font-term text-lg leading-tight text-pale" title={HINTS.slice(0, used).map((h) => h.text).join('\n')}>
            <span className="text-cyan">{latest.title}:</span> {latest.text}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

const VERDICT_TEXT: Record<WeightVerdict | 'unknown', string> = { unknown: '', correct: '✓ level', low: 'too light', high: 'too heavy', missing: 'missing' };

/** Compact terminal strip across the top of the chamber so the balance below stays in view. */
export function PuzzleConsole(p: {
  values: Record<WeightId, string>; setValue: (id: WeightId, v: string) => void; onSubmit: () => void; onClose: () => void;
  weighing: boolean; verdicts: Record<WeightId, WeightVerdict | 'unknown'>; hintsUsed: number; onHint: () => void;
}) {
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  const submit = (e: FormEvent) => { e.preventDefault(); if (!p.weighing) p.onSubmit(); };
  return (
    <motion.div
      className="pixel-frame-bright absolute left-[3.5%] top-[3%] z-20 w-[58%] bg-navy/95 px-3 py-2"
      initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      role="dialog" aria-label="Balance console"
    >
      <div className="flex items-center gap-3">
        <h2 className="flex shrink-0 items-center gap-2 font-pixel text-[9px] text-cyan"><Scale size={13} aria-hidden /> CONSOLE</h2>
        <div className="flex flex-1 flex-wrap justify-around gap-x-3 bg-abyss px-2 font-term text-xl leading-7 text-cyan" aria-label="Equations">
          {EQUATIONS.map((e) => <code key={equationText(e)} className="whitespace-nowrap">{equationText(e)}</code>)}
        </div>
        <button type="button" onClick={p.onClose} aria-label="Close console (Esc)" className="shrink-0 text-primary hover:text-ice"><X size={16} /></button>
      </div>
      <form onSubmit={submit} className="my-2 flex items-end gap-2" aria-label="Enter the three weights">
        {WEIGHT_IDS.map((id, i) => {
          const v = p.verdicts[id];
          return (
            <label key={id} className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1 font-pixel text-[9px] text-pale"><ShapeIcon shape={SHAPE_OF[id]} size={12} /> {id} = <span className="ml-auto font-term text-base text-primary">{VERDICT_TEXT[v]}</span></span>
              <input
                ref={i === 0 ? first : undefined}
                type="text" inputMode="numeric" maxLength={3} value={p.values[id]} disabled={p.weighing}
                onChange={(e) => p.setValue(id, e.target.value.replace(/[^\d.-]/g, ''))}
                aria-label={`Weight ${id}`} aria-invalid={v === 'low' || v === 'high'}
                className={`mt-1 w-full border-2 bg-abyss px-2 py-1 text-center font-pixel text-[14px] text-ice outline-none focus:border-cyan ${v === 'correct' ? 'border-pale' : v === 'low' || v === 'high' ? 'animate-pulseborder border-electric' : 'border-deep'}`}
              />
            </label>
          );
        })}
        <button type="submit" disabled={p.weighing}
          className="shrink-0 bg-electric px-3 py-2 font-pixel text-[9px] uppercase text-abyss shadow-[0_3px_0_#103D78] hover:bg-cyan active:translate-y-[2px] disabled:opacity-50">
          {p.weighing ? 'Weighing…' : 'Weigh ⏎'}
        </button>
      </form>
      <HintSystem used={p.hintsUsed} onHint={p.onHint} />
    </motion.div>
  );
}
