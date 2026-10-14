import { AnimatePresence, motion } from 'framer-motion';
import { Grid3x3, Lock, Unlock, X } from 'lucide-react';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { LOCK_HINTS, LOCK_RULES, GRID_NUMBERS, digitSumExpression } from '../game/remainder';
import { HintSystem } from './PuzzleConsole';

/** Tile grid with roving focus: arrows move, Enter/Space selects, X crosses a tile out. */
export function NumberGrid(p: { eliminated: ReadonlySet<number>; solvedTile: number | null; shakeKey: number; onSelect: (n: number) => void; onToggleEliminate: (n: number) => void; disabled: boolean }) {
  const [focus, setFocus] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => { const k = (i + 16) % 16; setFocus(k); refs.current[k]?.focus(); };
  const onKey = (e: KeyboardEvent, i: number, n: number) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); move(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(i - 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(i + 4); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(i - 4); }
    else if (e.key === 'x' || e.key === 'X') { e.preventDefault(); p.onToggleEliminate(n); }
  };
  return (
    <motion.div key={p.shakeKey} animate={p.shakeKey ? { x: [0, -6, 6, -4, 4, 0] } : {}} transition={{ duration: 0.35 }}
      className="grid grid-cols-4 gap-1.5" role="grid" aria-label="Numbered tiles 1 to 16">
      {GRID_NUMBERS.map((n, i) => {
        const safe = p.solvedTile === n, elim = p.eliminated.has(n);
        return (
          <button
            key={n} ref={(el) => { refs.current[i] = el; }} type="button" role="gridcell" tabIndex={i === focus ? 0 : -1}
            disabled={p.disabled && !safe} onFocus={() => setFocus(i)}
            onClick={() => p.onSelect(n)} onContextMenu={(e) => { e.preventDefault(); p.onToggleEliminate(n); }} onKeyDown={(e) => onKey(e, i, n)}
            aria-label={`Tile ${n}${elim ? ', crossed out' : ''}${safe ? ', safe tile' : ''}`}
            className={`relative aspect-square border-2 font-pixel text-[15px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan
              ${safe ? 'border-ice bg-pale text-abyss shadow-[0_0_14px_#52C7FF]' : elim ? 'border-dark bg-navy text-deep line-through' : 'border-deep bg-dark text-pale hover:border-cyan hover:bg-deep'}`}
          >
            {n}
            {elim && !safe && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[22px] text-deep">╳</span>}
          </button>
        );
      })}
    </motion.div>
  );
}

export function DigitReductionPanel(p: { tile: number; value: string; setValue: (v: string) => void; onSubmit: () => void; done: boolean }) {
  const submit = (e: FormEvent) => { e.preventDefault(); if (!p.done) p.onSubmit(); };
  return (
    <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="border-2 border-electric bg-abyss/70 p-3" aria-label="Digit reduction">
      <h3 className="font-pixel text-[8px] text-primary">DIGIT REDUCTION</h3>
      <div className="mt-2 flex items-center gap-3 font-pixel text-[16px] text-ice">
        <span className="bg-pale px-2 py-1 text-abyss">{p.tile}</span>
        <span className="text-cyan">→</span>
        <span>{digitSumExpression(p.tile)} =</span>
        <input type="text" inputMode="numeric" maxLength={2} value={p.value} disabled={p.done} autoFocus
          onChange={(e) => p.setValue(e.target.value.replace(/\D/g, ''))} aria-label="Digit sum"
          className={`w-14 border-2 bg-abyss px-1 py-1 text-center font-pixel text-[16px] text-ice outline-none focus:border-cyan ${p.done ? 'border-pale' : 'border-deep'}`} />
        {!p.done && <button type="submit" className="bg-electric px-3 py-2 font-pixel text-[9px] text-abyss shadow-[0_3px_0_#103D78] hover:bg-cyan">OK ⏎</button>}
      </div>
      {p.done && <p className="mt-2 flex items-center gap-2 font-term text-lg text-ice"><Unlock size={14} aria-hidden /> Lock released. The escape terminal by the door is live.</p>}
    </motion.form>
  );
}

export function RemainderLockStage(p: {
  eliminated: ReadonlySet<number>; solvedTile: number | null; digitDone: boolean; digit: string; setDigit: (v: string) => void;
  onSelect: (n: number) => void; onToggleEliminate: (n: number) => void; onDigit: () => void; shakeKey: number;
  hintsUsed: number; onHint: () => void; onClose: () => void;
}) {
  return (
    <motion.div
      className="pixel-frame-bright absolute bottom-[17%] left-[19%] top-[3%] z-20 flex w-[min(720px,62%)] gap-3 bg-navy/95 p-3"
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      role="dialog" aria-label="Remainder Lock"
    >
      <div className="flex aspect-square h-full min-h-0 shrink-0 flex-col justify-center bg-abyss p-2">
        <NumberGrid eliminated={p.eliminated} solvedTile={p.solvedTile} shakeKey={p.shakeKey} onSelect={p.onSelect} onToggleEliminate={p.onToggleEliminate} disabled={p.solvedTile != null} />
      </div>
      <div className="scroll-blue flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-pixel text-[9px] text-cyan"><Grid3x3 size={13} aria-hidden /> REMAINDER LOCK</h2>
          <button type="button" onClick={p.onClose} aria-label="Close lock (Esc)" className="text-primary hover:text-ice"><X size={16} /></button>
        </div>
        <ol className="space-y-1 border-2 border-dark bg-abyss/60 p-2" aria-label="Conditions">
          {LOCK_RULES.map((r, i) => (
            <li key={r.id} className="flex gap-2 font-term text-lg leading-tight text-pale"><span className="text-cyan">{i + 1}.</span>{r.text}</li>
          ))}
        </ol>
        <p className="font-term text-base leading-tight text-primary">
          <Lock size={12} className="mr-1 inline" aria-hidden />Click the safe tile. Right-click or press X to cross a tile out. Arrow keys move between tiles.
        </p>
        <AnimatePresence>
          {p.solvedTile != null && (
            <DigitReductionPanel tile={p.solvedTile} value={p.digit} setValue={p.setDigit} onSubmit={p.onDigit} done={p.digitDone} />
          )}
        </AnimatePresence>
        <HintSystem used={p.hintsUsed} onHint={p.onHint} hints={LOCK_HINTS} />
      </div>
    </motion.div>
  );
}
