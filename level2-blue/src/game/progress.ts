/* ============================================================================
   Cross-level progress for BLUE (Levels 2 → 3 → 4 → final escape protocol).
   Pure reducers: every result is validated before it is stored, earlier
   results survive retries, and the final code is assembled from state.
   ============================================================================ */
import { TRIANGLE_COUNT } from './geometry';
import { solveWeights, lightestToHeaviest, sequenceFromShapes, type Shape, type WeightId } from './puzzle';
import { SAFE_TILE, digitSum } from './remainder';

export type LevelNo = 2 | 3 | 4;

export interface Progress {
  previousOrder: readonly Shape[];
  level2: { weights: Record<WeightId, number>; order: WeightId[]; sequence: string } | null;
  level3: { triangles: number } | null;
  level4: { tile: number | null; digitSum: number | null; escaped: boolean };
  hints: Record<LevelNo, number>;
  times: Partial<Record<LevelNo, number>>;
}

export const initialProgress = (previousOrder: readonly Shape[]): Progress => ({
  previousOrder, level2: null, level3: null, level4: { tile: null, digitSum: null, escaped: false },
  hints: { 2: 0, 3: 0, 4: 0 }, times: {},
});

/** The next level the player is allowed to play. */
export function currentLevel(p: Progress): LevelNo | 'done' {
  if (!p.level2) return 2;
  if (!p.level3) return 3;
  return p.level4.escaped ? 'done' : 4;
}

/** Level 2 result is accepted only if it matches the solved equations. */
export function completeLevel2(p: Progress, r: { weights: Record<WeightId, number>; order: WeightId[]; sequence: string }, timeMs: number, hints: number): Progress {
  if (p.level2) return p; // completes once
  const w = solveWeights();
  const expected = sequenceFromShapes(p.previousOrder, w);
  const ok = (['A', 'B', 'C'] as const).every((k) => r.weights[k] === w[k])
    && r.order.join() === lightestToHeaviest(w).join() && r.sequence === expected;
  if (!ok) return p;
  return { ...p, level2: { weights: { ...r.weights }, order: [...r.order], sequence: r.sequence }, times: { ...p.times, 2: timeMs }, hints: { ...p.hints, 2: hints } };
}

export function completeLevel3(p: Progress, count: number, timeMs: number, hints: number): Progress {
  if (!p.level2 || p.level3 || count !== TRIANGLE_COUNT) return p; // never overwrite with a wrong value
  return { ...p, level3: { triangles: count }, times: { ...p.times, 3: timeMs }, hints: { ...p.hints, 3: hints } };
}

export function setSafeTile(p: Progress, tile: number): Progress {
  if (!p.level3 || tile !== SAFE_TILE) return p;
  return { ...p, level4: { ...p.level4, tile } };
}
export function setDigitSum(p: Progress, d: number): Progress {
  if (p.level4.tile == null || d !== digitSum(p.level4.tile)) return p;
  return { ...p, level4: { ...p.level4, digitSum: d } };
}

/** Time ran out anywhere: the whole run restarts at Level 2. Only the Level 1 clue survives. */
export const restartRun = (p: Progress): Progress => initialProgress(p.previousOrder);

/** Restarting Level 4 from the pause menu clears only Level 4's temporary results. */
export function resetLevel4(p: Progress): Progress {
  return p.level4.escaped ? p : { ...p, level4: { tile: null, digitSum: null, escaped: false }, hints: { ...p.hints, 4: 0 } };
}

export const FINAL_LABELS = ['Balance sequence', 'Triangle count', 'Safe tile', 'Digit sum'] as const;

/** The four components, in order, or null until every one has been earned. */
export function finalSegments(p: Progress): [string, string, string, string] | null {
  if (!p.level2 || !p.level3 || p.level4.tile == null || p.level4.digitSum == null) return null;
  return [p.level2.sequence, String(p.level3.triangles), String(p.level4.tile), String(p.level4.digitSum)];
}
export const finalCode = (p: Progress) => finalSegments(p)?.join('-') ?? null;

export interface FinalCheck { ok: boolean; locked: boolean; wrong: [boolean, boolean, boolean, boolean] }
export function validateFinalCode(p: Progress, entries: readonly string[]): FinalCheck {
  const seg = finalSegments(p);
  if (!seg) return { ok: false, locked: true, wrong: [false, false, false, false] };
  const norm = (s: string) => s.trim().replace(/^0+(?=\d)/, '');
  const wrong = seg.map((v, i) => norm(entries[i] ?? '') !== v) as FinalCheck['wrong'];
  return { ok: wrong.every((w) => !w), locked: false, wrong };
}

export function escape(p: Progress, entries: readonly string[], timeMs: number, hints: number): Progress {
  if (p.level4.escaped || !validateFinalCode(p, entries).ok) return p;
  return { ...p, level4: { ...p.level4, escaped: true }, times: { ...p.times, 4: timeMs }, hints: { ...p.hints, 4: hints } };
}

/** Level 1's order + Level 2 maths, for standalone sanity checks. */
export const EXPECTED_LEVEL2_SEQUENCE = (order: readonly Shape[]) => sequenceFromShapes(order, solveWeights());
