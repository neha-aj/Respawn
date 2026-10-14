import { describe, expect, it } from 'vitest';
import {
  EQUATIONS, HINTS, SHAPE_OF, SwitchSequence, equationText, lightestToHeaviest, parseWeight,
  sequenceFromShapes, solveWeights, totalWeight, validateWeights,
} from './puzzle';
import { DEV_PREVIOUS_LEVEL } from './config';

describe('balance equations', () => {
  it('displays the three equations exactly', () => {
    expect(EQUATIONS.map(equationText)).toEqual(['A + B = 11', 'B + C = 13', 'A + C = 10']);
  });
  it('total weight is 17', () => { expect(totalWeight()).toBe(17); });
  it('solves A = 4, B = 7, C = 6', () => { expect(solveWeights()).toEqual({ A: 4, B: 7, C: 6 }); });
  it('solution satisfies every equation', () => {
    const w = solveWeights();
    for (const e of EQUATIONS) expect(w[e.terms[0]] + w[e.terms[1]]).toBe(e.sum);
  });
  it('orders lightest to heaviest as A → C → B', () => {
    expect(lightestToHeaviest(solveWeights())).toEqual(['A', 'C', 'B']);
  });
  it('maps shapes so the Level 1 order gives 467', () => {
    expect(SHAPE_OF).toEqual({ A: 'TRIANGLE', B: 'PENTAGON', C: 'SQUARE' });
    expect(sequenceFromShapes(DEV_PREVIOUS_LEVEL.geometricOrder, solveWeights())).toBe('467');
  });
  it('has three progressive hints, the last revealing the total', () => {
    expect(HINTS).toHaveLength(3);
    expect(HINTS[2].text).toContain('17');
  });
});

describe('answer validation', () => {
  it('accepts the correct answers', () => {
    expect(validateWeights({ A: 4, B: 7, C: 6 }).allCorrect).toBe(true);
  });
  it('reports low, high and missing values', () => {
    const v = validateWeights({ A: 3, B: 9, C: null });
    expect(v.allCorrect).toBe(false);
    expect(v.verdicts).toEqual({ A: 'low', B: 'high', C: 'missing' });
  });
  it('parses only plain numbers', () => {
    expect(parseWeight(' 7 ')).toBe(7);
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('7a')).toBeNull();
  });
});

describe('switch order', () => {
  it('completes on A → C → B', () => {
    const s = new SwitchSequence(['A', 'C', 'B']);
    expect(s.press('A')).toBe('progress');
    expect(s.press('C')).toBe('progress');
    expect(s.press('B')).toBe('complete');
    expect(s.done).toBe(true);
  });
  it('a wrong switch resets progress with no lock-out', () => {
    const s = new SwitchSequence(['A', 'C', 'B']);
    expect(s.press('A')).toBe('progress');
    expect(s.press('B')).toBe('wrong');
    expect(s.progress).toEqual([]);
    expect(s.press('A')).toBe('progress');
    expect(s.press('C')).toBe('progress');
    expect(s.press('B')).toBe('complete');
  });
  it('pressing an already-lit switch is ignored', () => {
    const s = new SwitchSequence(['A', 'C', 'B']);
    s.press('A');
    expect(s.press('A')).toBe('ignored');
    expect(s.progress).toEqual(['A']);
  });
  it('the first switch must be the lightest', () => {
    const s = new SwitchSequence(['A', 'C', 'B']);
    expect(s.press('C')).toBe('wrong');
    expect(s.press('B')).toBe('wrong');
  });
});
