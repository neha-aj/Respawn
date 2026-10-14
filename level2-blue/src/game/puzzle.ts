/* ============================================================================
   Puzzle logic — pure functions, no rendering. The equations are the single
   source of truth: every value used by the physics comes from solveWeights().
   ============================================================================ */

export type WeightId = 'A' | 'B' | 'C';
export type Shape = 'TRIANGLE' | 'SQUARE' | 'PENTAGON';
export const WEIGHT_IDS: readonly WeightId[] = ['A', 'B', 'C'];

export interface Equation { terms: [WeightId, WeightId]; sum: number }

export const EQUATIONS: readonly Equation[] = [
  { terms: ['A', 'B'], sum: 11 },
  { terms: ['B', 'C'], sum: 13 },
  { terms: ['A', 'C'], sum: 10 },
];

/** Mapping shown in the chamber and stored in the Intelligence Bag. */
export const SHAPE_OF: Readonly<Record<WeightId, Shape>> = { A: 'TRIANGLE', B: 'PENTAGON', C: 'SQUARE' };

export const HINTS: readonly { title: string; text: string }[] = [
  { title: 'Observation', text: 'The three equations share pairs of weights. Look for a way to obtain their combined total.' },
  { title: 'Method', text: 'Add all three equations. Each unknown appears twice.' },
  { title: 'Breakthrough', text: 'The total of A, B and C is 17. Subtract each known pair-sum from 17 to obtain the remaining weight.' },
];

export const equationText = (e: Equation) => `${e.terms[0]} + ${e.terms[1]} = ${e.sum}`;

/** Sum of all three unknowns: adding every pair-sum counts each unknown twice. */
export function totalWeight(eqs: readonly Equation[] = EQUATIONS): number {
  return eqs.reduce((s, e) => s + e.sum, 0) / 2;
}

/** Each weight = total − (the pair-sum that does not contain it). */
export function solveWeights(eqs: readonly Equation[] = EQUATIONS): Record<WeightId, number> {
  const total = totalWeight(eqs);
  const out = {} as Record<WeightId, number>;
  for (const id of WEIGHT_IDS) {
    const other = eqs.find((e) => !e.terms.includes(id));
    if (!other) throw new Error(`No equation excludes ${id}`);
    out[id] = total - other.sum;
  }
  return out;
}

export type WeightVerdict = 'correct' | 'low' | 'high' | 'missing';
export interface Validation { allCorrect: boolean; verdicts: Record<WeightId, WeightVerdict> }

export function parseWeight(raw: string): number | null {
  const t = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function validateWeights(input: Partial<Record<WeightId, number | null>>, truth = solveWeights()): Validation {
  const verdicts = {} as Record<WeightId, WeightVerdict>;
  for (const id of WEIGHT_IDS) {
    const v = input[id];
    verdicts[id] = v == null ? 'missing' : v === truth[id] ? 'correct' : v < truth[id] ? 'low' : 'high';
  }
  return { allCorrect: WEIGHT_IDS.every((id) => verdicts[id] === 'correct'), verdicts };
}

export function lightestToHeaviest(w: Record<WeightId, number>): WeightId[] {
  return [...WEIGHT_IDS].sort((a, b) => w[a] - w[b]);
}

/** Read the weights in the geometric order carried over from Level 1. */
export function sequenceFromShapes(order: readonly Shape[], w: Record<WeightId, number>): string {
  return order.map((shape) => {
    const id = WEIGHT_IDS.find((k) => SHAPE_OF[k] === shape);
    if (!id) throw new Error(`No weight for ${shape}`);
    return String(w[id]);
  }).join('');
}

export type PressResult = 'progress' | 'complete' | 'wrong' | 'ignored';

/** Tracks the pressure-switch order. A wrong press resets progress (no penalty). */
export class SwitchSequence {
  private pressed: WeightId[] = [];
  constructor(private readonly order: readonly WeightId[]) {}
  get progress(): readonly WeightId[] { return this.pressed; }
  get done(): boolean { return this.pressed.length === this.order.length; }
  press(id: WeightId): PressResult {
    if (this.done || this.pressed.includes(id)) return 'ignored';
    if (this.order[this.pressed.length] !== id) { this.pressed = []; return 'wrong'; }
    this.pressed.push(id);
    return this.done ? 'complete' : 'progress';
  }
  reset() { this.pressed = []; }
}
