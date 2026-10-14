import { motion } from 'framer-motion';
import { Maximize2, RotateCcw, Shapes, Triangle as TriangleIcon, X, ZoomIn } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { OVERLAP_GRAPH, OVERLAP_HINTS, TRIANGLE_COUNT, isTriangle, onPath, triangleKey } from '../game/geometry';
import { DIAGRAM_RENDER_SEGMENTS, DIAGRAM_SIZE } from '../game/geometryRender';
import { HintSystem } from './PuzzleConsole';

type VB = [number, number, number, number];
const PAD = 0.6;
const FULL: VB = [-PAD, -PAD, DIAGRAM_SIZE + 2 * PAD, DIAGRAM_SIZE + 2 * PAD];
const QUADS: { label: string; vb: VB }[] = [
  { label: 'Top-left', vb: [-0.4, -0.4, 3.8, 3.8] }, { label: 'Top-right', vb: [2.6, -0.4, 3.8, 3.8] },
  { label: 'Bottom-left', vb: [-0.4, 2.6, 3.8, 3.8] }, { label: 'Bottom-right', vb: [2.6, 2.6, 3.8, 3.8] },
];
const P = OVERLAP_GRAPH.points;
const pathOfSegment = new Map(DIAGRAM_RENDER_SEGMENTS.map((s) => [s.id, OVERLAP_GRAPH.paths.findIndex((p) => p.segmentIds.includes(s.id))]));

/** Smoothly animated viewBox (exponential easing toward the target). */
function useAnimatedViewBox(target: VB): VB {
  const [vb, setVb] = useState<VB>(target);
  const cur = useRef<VB>(target);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const next = cur.current.map((v, i) => v + (target[i] - v) * 0.22) as VB;
      const done = next.every((v, i) => Math.abs(v - target[i]) < 0.002);
      cur.current = done ? target : next; setVb(cur.current);
      if (!done) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return vb;
}

function whyNotTriangle(sel: number[]): string {
  const [a, b, c] = sel;
  const cr = (P[b].x - P[a].x) * (P[c].y - P[a].y) - (P[b].y - P[a].y) * (P[c].x - P[a].x);
  if (Math.abs(cr) < 1e-9) return 'These three points lie on one straight line.';
  const pairs: [number, number][] = [[a, b], [b, c], [a, c]];
  const missing = pairs.filter(([i, j]) => !OVERLAP_GRAPH.connected(i, j)).length;
  return `${missing} side${missing > 1 ? 's are' : ' is'} not drawn, so this is not a triangle.`;
}

export interface OverlapState { marked: string[]; answer: string }

export function OverlapTrapStage(p: {
  state: OverlapState; setState: (s: OverlapState) => void; hintsUsed: number; onHint: () => void; onClose: () => void;
  onWrong: (n: number) => void; onCorrect: () => void; sfx: { select: () => void; zoom: (i: boolean) => void; trace: () => void; segment: () => void; click: () => void };
}) {
  const [zoom, setZoom] = useState<number | null>(null);
  const [hoverPath, setHoverPath] = useState<number | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const vb = useAnimatedViewBox(zoom == null ? FULL : QUADS[zoom].vb);
  const marked = useMemo(() => new Set(p.state.marked), [p.state.marked]);

  const selValid = sel.length === 3 && isTriangle(OVERLAP_GRAPH, sel[0], sel[1], sel[2]);
  const selKey = sel.length === 3 ? triangleKey(sel) : '';

  const pick = (i: number) => {
    if (solved) return;
    p.sfx.select();
    setSel((s) => (s.includes(i) ? s.filter((k) => k !== i) : s.length >= 3 ? [i] : [...s, i]));
  };
  const markSel = () => {
    if (!selValid || marked.has(selKey)) return;
    p.sfx.click();
    p.setState({ ...p.state, marked: [...p.state.marked, selKey] });
    setSel([]);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (solved) return;
    const n = Number(p.state.answer.trim());
    if (!p.state.answer.trim() || !Number.isInteger(n)) return;
    // correct: saved and the clock stops at once; the success glow plays on the room monitor
    if (n === TRIANGLE_COUNT) { setSolved(true); setSel([]); p.onCorrect(); }
    else p.onWrong(n);
  };
  const strokeW = (vb[2] / FULL[2]) * 0.06;
  const poly = (t: readonly number[]) => t.map((i) => `${P[i].x},${P[i].y}`).join(' ');

  return (
    <motion.div
      className="pixel-frame-bright absolute bottom-[17%] left-[19%] right-[3%] top-[3%] z-20 flex gap-3 bg-navy/95 p-3"
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      role="dialog" aria-label="Overlap Trap security panel"
    >
      {/* ---------------- diagram ---------------- */}
      <div className="relative flex aspect-square h-full min-h-0 shrink-0 flex-col bg-abyss">
        <svg viewBox={vb.join(' ')} className="h-full w-full" role="img" aria-label="Two overlapping squares with all four diagonals">
          <defs>
            <pattern id="dots" width="1" height="1" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="0.025" fill="#103D78" /></pattern>
          </defs>
          <rect x={-2} y={-2} width={DIAGRAM_SIZE + 4} height={DIAGRAM_SIZE + 4} fill="url(#dots)" />
          {[...marked].map((k) => <polygon key={k} points={poly(k.split('-').map(Number))} fill="#1769C2" opacity={0.22} />)}
          {sel.length === 3 && <polygon points={poly(sel)} fill={selValid ? '#52C7FF' : '#0A2450'} opacity={selValid ? 0.35 : 0.6} />}
          {hoverPath != null && (() => {
            const path = OVERLAP_GRAPH.paths[hoverPath];
            const a = { x: path.origin.x + path.dir.x * path.lo, y: path.origin.y + path.dir.y * path.lo };
            const b = { x: path.origin.x + path.dir.x * path.hi, y: path.origin.y + path.dir.y * path.hi };
            return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#A5E2FF" strokeWidth={strokeW * 3} opacity={0.5} strokeLinecap="round" />;
          })()}
          {DIAGRAM_RENDER_SEGMENTS.map((s) => (
            <g key={s.id}>
              <line x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke={solved ? '#E4F5FF' : s.kind === 'diagonal' ? '#52C7FF' : '#258BFF'} strokeWidth={strokeW} strokeLinecap="square" />
              <line x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke="transparent" strokeWidth={strokeW * 6} className="cursor-crosshair"
                onPointerEnter={() => { const pi = pathOfSegment.get(s.id) ?? null; setHoverPath(pi); p.sfx.trace(); }} onPointerLeave={() => setHoverPath(null)} />
            </g>
          ))}
          {P.map((pt, i) => {
            const on = sel.includes(i);
            const onHover = hoverPath != null && onPath(OVERLAP_GRAPH.paths[hoverPath], pt);
            return (
              <g key={i} className="cursor-pointer" onClick={() => pick(i)} role="button" aria-label={`Corner at ${pt.x}, ${pt.y}${on ? ', selected' : ''}`}>
                <circle cx={pt.x} cy={pt.y} r={strokeW * 4.5} fill="transparent" />
                <rect x={pt.x - strokeW * 1.6} y={pt.y - strokeW * 1.6} width={strokeW * 3.2} height={strokeW * 3.2}
                  fill={on ? '#E4F5FF' : onHover ? '#A5E2FF' : '#52C7FF'} stroke="#020817" strokeWidth={strokeW * 0.4}>
                  {!on && <animate attributeName="opacity" values="1;0.55;1" dur={`${1.6 + (i % 4) * 0.3}s`} repeatCount="indefinite" />}
                </rect>
              </g>
            );
          })}
        </svg>
        <div className="absolute bottom-1 left-1 flex gap-1">
          <button type="button" onClick={() => { p.sfx.zoom(false); setZoom(null); }} aria-label="Show the whole diagram"
            className={`border-2 px-1.5 py-1 ${zoom == null ? 'border-cyan text-ice' : 'border-deep text-pale hover:border-electric'} bg-navy`}><Maximize2 size={12} /></button>
          {QUADS.map((q, i) => (
            <button key={q.label} type="button" onClick={() => { p.sfx.zoom(true); setZoom(i); }} aria-label={`Zoom into the ${q.label.toLowerCase()} quarter`}
              className={`border-2 bg-navy px-1.5 py-1 font-pixel text-[7px] ${zoom === i ? 'border-cyan text-ice' : 'border-deep text-pale hover:border-electric'}`}>
              <ZoomIn size={10} className="inline" /> {q.label.split('-').map((w) => w[0].toUpperCase()).join('')}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- tools ---------------- */}
      <div className="scroll-blue flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-pixel text-[9px] text-cyan"><Shapes size={13} aria-hidden /> OVERLAP TRAP</h2>
          <button type="button" onClick={p.onClose} aria-label="Close panel (Esc)" className="text-primary hover:text-ice"><X size={16} /></button>
        </div>
        <p className="font-term text-lg leading-tight text-pale">How many distinct triangles are in the diagram? Larger triangles count separately.</p>

        <form onSubmit={submit} className="flex items-end gap-2" aria-label="Enter the triangle count">
          <label className="flex flex-1 flex-col">
            <span className="font-pixel text-[8px] text-pale">TOTAL TRIANGLES</span>
            <input ref={inputRef} type="text" inputMode="numeric" maxLength={3} value={p.state.answer} disabled={solved} autoFocus
              onChange={(e) => { p.sfx.segment(); p.setState({ ...p.state, answer: e.target.value.replace(/\D/g, '') }); }}
              className="mt-1 w-full border-2 border-deep bg-abyss px-2 py-1 text-center font-pixel text-[16px] text-ice outline-none focus:border-cyan" aria-label="Total triangles" />
          </label>
          <button type="submit" disabled={solved} className="bg-electric px-3 py-2 font-pixel text-[9px] text-abyss shadow-[0_3px_0_#103D78] hover:bg-cyan disabled:opacity-50">SUBMIT ⏎</button>
          <button type="button" disabled={solved} onClick={() => { p.setState({ ...p.state, answer: '' }); inputRef.current?.focus(); }}
            className="border-2 border-deep bg-navy px-2 py-1.5 font-pixel text-[8px] text-pale hover:border-cyan disabled:opacity-50">CLEAR</button>
        </form>

        <section className="border-2 border-dark bg-abyss/60 p-2" aria-label="Triangle tester">
          <h3 className="flex items-center gap-1 font-pixel text-[8px] text-primary"><TriangleIcon size={11} aria-hidden /> TRIANGLE TESTER (OPTIONAL)</h3>
          <p className="mt-1 font-term text-base leading-tight text-pale">
            {solved ? `Accepted: ${TRIANGLE_COUNT} triangles.` :
              sel.length < 3 ? `Click three corners (${sel.length}/3). Hover a line to trace its full length.` :
                selValid ? (marked.has(selKey) ? 'Valid triangle: already marked.' : 'Valid triangle.') : whyNotTriangle(sel)}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <button type="button" onClick={markSel} disabled={!selValid || marked.has(selKey)} className="border-2 border-deep bg-navy px-2 py-1 font-pixel text-[8px] text-pale hover:border-cyan disabled:opacity-40">MARK IT</button>
            <button type="button" onClick={() => setSel([])} disabled={!sel.length} className="border-2 border-deep bg-navy px-2 py-1 font-pixel text-[8px] text-pale hover:border-cyan disabled:opacity-40">DESELECT</button>
            <span className="ml-auto font-term text-lg text-cyan">Marked: {marked.size}</span>
            <button type="button" onClick={() => p.setState({ ...p.state, marked: [] })} disabled={!marked.size} aria-label="Clear all marks" className="text-primary hover:text-ice disabled:opacity-40"><RotateCcw size={13} /></button>
          </div>
        </section>

        <HintSystem used={p.hintsUsed} onHint={p.onHint} hints={OVERLAP_HINTS} />
      </div>
    </motion.div>
  );
}
