import { AnimatePresence, motion } from 'framer-motion';
import { Backpack, CheckCircle2, Lock, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Bag } from '../game/engine';
import { finalCode, type LevelNo, type Progress } from '../game/progress';
import { SHAPE_OF, WEIGHT_IDS, type Shape, type WeightId } from '../game/puzzle';
import { digitSumExpression } from '../game/remainder';
import { ShapeIcon } from './ShapeIcon';

const idForShape = (s: Shape) => WEIGHT_IDS.find((k) => SHAPE_OF[k] === s) as WeightId;

function Entry({ title, children, locked = false, done = false }: { title: string; children?: ReactNode; locked?: boolean; done?: boolean }) {
  return (
    <section className={`border-2 bg-abyss/70 p-3 ${done ? 'border-primary' : 'border-dark'}`}>
      <h3 className="flex items-center gap-1 font-pixel text-[9px] text-primary">{done && <CheckCircle2 size={11} className="text-cyan" aria-label="completed" />}{title}</h3>
      {locked
        ? <p className="mt-2 flex items-center gap-2 font-term text-lg text-deep"><Lock size={14} aria-hidden /> Not recovered yet</p>
        : <div className="mt-2 font-term text-xl leading-tight text-pale">{children}</div>}
    </section>
  );
}

/** Combine stored progress with the live Level 2 bag (while Level 2 is being played). */
export function bagCount(progress: Progress, live: Bag | null) {
  const w = progress.level2?.weights ?? live?.weights, seq = progress.level2?.sequence ?? live?.sequence;
  return 1 + (w ? 1 : 0) + (seq ? 2 : 0) + (progress.level3 ? 1 : 0) + (progress.level4.tile != null ? 1 : 0) + (progress.level4.digitSum != null ? 1 : 0) + (progress.level4.escaped ? 1 : 0);
}

/** Slide-out log of validated clues across every level. Opening it never pauses the timer. */
export function IntelligenceBag({ open, onToggle, live, progress, level }: { open: boolean; onToggle: () => void; live: Bag | null; progress: Progress; level: LevelNo }) {
  const weights = progress.level2?.weights ?? (level === 2 ? live?.weights ?? null : null);
  const order = progress.level2?.order ?? (level === 2 ? live?.order ?? null : null);
  const sequence = progress.level2?.sequence ?? (level === 2 ? live?.sequence ?? null : null);
  const count = bagCount(progress, level === 2 ? live : null);
  const l4 = progress.level4;
  return (
    <>
      {!open && (
        <button type="button" onClick={onToggle} aria-label="Open Intelligence Bag"
          className="absolute right-0 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-2 border-2 border-r-0 border-electric bg-navy px-2 py-3 text-cyan hover:bg-deep">
          <Backpack size={20} aria-hidden />
          <span className="font-pixel text-[8px] [writing-mode:vertical-rl]">INTEL BAG</span>
          <span className="bg-electric px-1 font-pixel text-[8px] text-abyss">{count}</span>
        </button>
      )}
      <AnimatePresence>
        {open && (
          <motion.aside key="bag" className="pixel-frame-bright absolute bottom-0 right-0 top-0 z-30 flex w-[min(360px,42%)] flex-col bg-navy/95"
            initial={{ x: '105%' }} animate={{ x: 0 }} exit={{ x: '105%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} aria-label="Intelligence Bag">
            <div className="flex items-center justify-between border-b-2 border-deep p-3">
              <h2 className="flex items-center gap-2 font-pixel text-[10px] text-cyan"><Backpack size={16} aria-hidden /> INTELLIGENCE BAG</h2>
              <button type="button" onClick={onToggle} aria-label="Close Intelligence Bag" className="text-primary hover:text-ice"><X size={18} /></button>
            </div>
            <p className="px-3 pt-2 font-term text-base text-primary">The clock keeps running while the bag is open.</p>
            <div className="scroll-blue flex-1 space-y-3 overflow-y-auto p-3">
              <Entry title="STARTING CLUE · GEOMETRIC ORDER" done>
                <div className="flex flex-wrap items-center gap-1">
                  {progress.previousOrder.map((s, i) => (
                    <span key={s} className="flex items-center gap-1"><ShapeIcon shape={s} size={14} bright /> {s}{i < progress.previousOrder.length - 1 && <span className="text-primary">→</span>}</span>
                  ))}
                </div>
              </Entry>
              <Entry title="LEVEL 1 · CHAMBER MAPPING">
                <ul className="space-y-1">{WEIGHT_IDS.map((id) => <li key={id} className="flex items-center gap-2"><ShapeIcon shape={SHAPE_OF[id]} size={14} /> {SHAPE_OF[id]} = weight {id}</li>)}</ul>
              </Entry>
              <Entry title="LEVEL 1 · WEIGHTS" locked={!weights} done={!!weights}>{weights && <p>A = {weights.A} · B = {weights.B} · C = {weights.C}</p>}</Entry>
              <Entry title="LEVEL 1 · SWITCH ORDER" locked={!order} done={!!order}>{order && <p>{order.join(' → ')} <span className="text-primary">(lightest to heaviest)</span></p>}</Entry>
              <Entry title="LEVEL 1 · BALANCE SEQUENCE" locked={!sequence || !weights} done={!!sequence}>
                {sequence && weights && (
                  <>
                    <table className="w-full text-left"><tbody>
                      {progress.previousOrder.map((s) => (
                        <tr key={s}><td className="py-0.5"><ShapeIcon shape={s} size={12} /></td><td>{s}</td><td>{idForShape(s)}</td><td className="text-right text-ice">{weights[idForShape(s)]}</td></tr>
                      ))}
                    </tbody></table>
                    <p className="mt-2 font-pixel text-[18px] tracking-[0.3em] text-ice">{sequence}</p>
                  </>
                )}
              </Entry>
              <Entry title="LEVEL 2 · THE OVERLAP TRAP" locked={!progress.level3} done={!!progress.level3}>
                {progress.level3 && <p>Total distinct triangles: <span className="font-pixel text-[16px] text-ice">{progress.level3.triangles}</span></p>}
              </Entry>
              <Entry title="LEVEL 3 · REMAINDER LOCK" locked={l4.tile == null} done={l4.tile != null}>
                {l4.tile != null && <p>Safe tile: <span className="font-pixel text-[16px] text-ice">{l4.tile}</span><br /><span className="text-primary">Even · remainder 2 when ÷ 5 · greater than 10</span></p>}
              </Entry>
              <Entry title="LEVEL 3 · DIGIT REDUCTION" locked={l4.digitSum == null} done={l4.digitSum != null}>
                {l4.tile != null && l4.digitSum != null && <p>{digitSumExpression(l4.tile)} = <span className="font-pixel text-[16px] text-ice">{l4.digitSum}</span></p>}
              </Entry>
              <Entry title="FINAL ESCAPE CODE" locked={!l4.escaped} done={l4.escaped}>
                {l4.escaped && <p className="font-pixel text-[15px] tracking-[0.15em] text-ice">{finalCode(progress)}</p>}
              </Entry>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
