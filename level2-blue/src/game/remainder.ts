/* ============================================================================
   Level 4 — The Remainder Lock: rules, tile validation and digit reduction.
   The safe tile is DERIVED from the displayed rules over the 1–16 grid.
   ============================================================================ */

export interface LockRule { id: 'even' | 'mod5' | 'gt10'; text: string; test: (n: number) => boolean; why: (n: number) => string }

export const LOCK_RULES: readonly LockRule[] = [
  { id: 'even', text: 'The safe number is even.', test: (n) => n % 2 === 0, why: (n) => `${n} is odd.` },
  { id: 'mod5', text: 'When divided by 5, it leaves a remainder of 2.', test: (n) => n % 5 === 2, why: (n) => `${n} ÷ 5 leaves remainder ${n % 5}, not 2.` },
  { id: 'gt10', text: 'The safe number is greater than 10.', test: (n) => n > 10, why: (n) => `${n} is not greater than 10.` },
];

export const GRID_NUMBERS: readonly number[] = Array.from({ length: 16 }, (_, i) => i + 1);

export const violatedRules = (n: number) => LOCK_RULES.filter((r) => !r.test(n));
export const satisfiesAll = (n: number) => violatedRules(n).length === 0;

/** Explanation for a rejected tile, naming every condition it breaks. */
export function explainRejection(n: number): string {
  const v = violatedRules(n);
  return v.length === 0 ? '' : `Tile ${n} fails: ${v.map((r) => r.why(n)).join(' ')}`;
}

function deriveSafeTile(): number {
  const ok = GRID_NUMBERS.filter(satisfiesAll);
  if (ok.length !== 1) throw new Error(`Remainder Lock must have exactly one safe tile, found ${ok.length}`);
  return ok[0];
}
export const SAFE_TILE = deriveSafeTile();

export const digitSum = (n: number) => String(Math.abs(Math.trunc(n))).split('').reduce((s, d) => s + Number(d), 0);
export const digitSumExpression = (n: number) => String(n).split('').join(' + ');

export const LOCK_HINTS: readonly { title: string; text: string }[] = [
  { title: 'Narrow the candidates', text: 'Eliminate every odd number first. Then focus on the numbers greater than 10.' },
  { title: 'Use the remainder', text: 'When a number leaves remainder 2 after division by 5, it is 2 more than a multiple of 5.' },
  { title: 'Check the remaining candidates', text: 'Compare the even numbers greater than 10 with the remainder rule. Then add the digits of the valid number to obtain the final single-digit clue.' },
];
