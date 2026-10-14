import { describe, expect, it } from 'vitest';
import { DEV_PREVIOUS_LEVEL } from './config';
import { TRIANGLE_COUNT } from './geometry';
import {
  completeLevel2, completeLevel3, currentLevel, escape, finalCode, finalSegments, initialProgress, resetLevel4, restartRun,
  setDigitSum, setSafeTile, validateFinalCode, type Progress,
} from './progress';
import { GRID_NUMBERS, LOCK_RULES, SAFE_TILE, digitSum, explainRejection, satisfiesAll, violatedRules } from './remainder';

const L2 = { weights: { A: 4, B: 7, C: 6 }, order: ['A', 'C', 'B'] as ('A' | 'B' | 'C')[], sequence: '467' };
const start = () => initialProgress(DEV_PREVIOUS_LEVEL.geometricOrder);
const throughL3 = (): Progress => completeLevel3(completeLevel2(start(), L2, 30_000, 1), TRIANGLE_COUNT, 40_000, 2);
const throughLock = () => setDigitSum(setSafeTile(throughL3(), 12), 3);
const CODE = ['467', String(TRIANGLE_COUNT), '12', '3'];

describe('Remainder Lock', () => {
  it('grid holds every integer 1–16', () => { expect(GRID_NUMBERS).toEqual(Array.from({ length: 16 }, (_, i) => i + 1)); });
  it('displays the three rules exactly', () => {
    expect(LOCK_RULES.map((r) => r.text)).toEqual([
      'The safe number is even.', 'When divided by 5, it leaves a remainder of 2.', 'The safe number is greater than 10.',
    ]);
  });
  it('12 satisfies every rule and is the only such tile', () => {
    expect(SAFE_TILE).toBe(12);
    expect(GRID_NUMBERS.filter(satisfiesAll)).toEqual([12]);
  });
  it('every other tile breaks at least one rule, with an explanation', () => {
    for (const n of GRID_NUMBERS.filter((x) => x !== 12)) {
      expect(violatedRules(n).length).toBeGreaterThan(0);
      expect(explainRejection(n)).toContain(`Tile ${n}`);
    }
    expect(explainRejection(7)).toContain('odd');
    expect(explainRejection(2)).toContain('greater than 10');
    expect(explainRejection(14)).toContain('remainder 4');
  });
  it('digit reduction 1 + 2 = 3', () => { expect(digitSum(12)).toBe(3); });
});

describe('progression and stored clues', () => {
  it('starts at Level 2 and advances 2 → 3 → 4 → done', () => {
    let p = start();
    expect(currentLevel(p)).toBe(2);
    p = completeLevel2(p, L2, 1, 0); expect(currentLevel(p)).toBe(3);
    p = completeLevel3(p, TRIANGLE_COUNT, 1, 0); expect(currentLevel(p)).toBe(4);
    p = escape(setDigitSum(setSafeTile(p, 12), 3), CODE, 1, 0); expect(currentLevel(p)).toBe('done');
  });
  it('preserves 467 from the balance level', () => { expect(throughL3().level2?.sequence).toBe('467'); });
  it('rejects a falsified Level 2 result', () => { expect(completeLevel2(start(), { ...L2, sequence: '999' }, 1, 0).level2).toBeNull(); });
  it('Level 3 only stores the verified triangle count, never a wrong one', () => {
    const p = completeLevel2(start(), L2, 1, 0);
    expect(completeLevel3(p, TRIANGLE_COUNT + 1, 1, 0).level3).toBeNull();
    const ok = completeLevel3(p, TRIANGLE_COUNT, 1, 0);
    expect(ok.level3?.triangles).toBe(TRIANGLE_COUNT);
    expect(completeLevel3(ok, 5, 1, 0).level3?.triangles).toBe(TRIANGLE_COUNT); // cannot be overwritten
  });
  it('Level 3 cannot be completed before Level 2', () => { expect(completeLevel3(start(), TRIANGLE_COUNT, 1, 0).level3).toBeNull(); });
  it('stores the safe tile 12 and the digit sum 3 separately, validating both', () => {
    const p = throughL3();
    expect(setSafeTile(p, 14).level4.tile).toBeNull();
    const t = setSafeTile(p, 12);
    expect(t.level4.tile).toBe(12);
    expect(setDigitSum(t, 4).level4.digitSum).toBeNull();
    expect(setDigitSum(t, 3).level4).toEqual({ tile: 12, digitSum: 3, escaped: false });
  });
  it('the digit sum cannot be entered before the tile', () => { expect(setDigitSum(throughL3(), 3).level4.digitSum).toBeNull(); });
});

describe('final escape protocol', () => {
  it('stays locked until every component has been earned', () => {
    expect(finalSegments(throughL3())).toBeNull();
    expect(validateFinalCode(setSafeTile(throughL3(), 12), CODE).locked).toBe(true);
    expect(escape(throughL3(), CODE, 1, 0).level4.escaped).toBe(false);
  });
  it('assembles 467-T-12-3 from stored state, in order', () => {
    expect(finalSegments(throughLock())).toEqual(['467', String(TRIANGLE_COUNT), '12', '3']);
    expect(finalCode(throughLock())).toBe(`467-${TRIANGLE_COUNT}-12-3`);
    expect(finalCode(throughLock())).toBe('467-22-12-3');
  });
  it('flags exactly the wrong segments', () => {
    const r = validateFinalCode(throughLock(), ['467', '21', '12', '4']);
    expect(r.ok).toBe(false);
    expect(r.wrong).toEqual([false, true, false, true]);
  });
  it('accepts the correct code and escapes exactly once', () => {
    const p = escape(throughLock(), CODE, 50_000, 1);
    expect(p.level4.escaped).toBe(true);
    expect(escape(p, CODE, 99, 3)).toBe(p);
  });
  it('rejects a wrong code without escaping', () => { expect(escape(throughLock(), ['467', '22', '12', '9'], 1, 0).level4.escaped).toBe(false); });
});

describe('running out of time', () => {
  it('restarts the whole run at Level 2, keeping only the Level 1 clue', () => {
    const p = restartRun(throughLock());
    expect(currentLevel(p)).toBe(2);
    expect(p.level2).toBeNull();
    expect(p.level3).toBeNull();
    expect(p.level4).toEqual({ tile: null, digitSum: null, escaped: false });
    expect(p.previousOrder).toEqual(DEV_PREVIOUS_LEVEL.geometricOrder);
  });
});

describe('retry rules', () => {
  it('retrying Level 4 clears only Level 4 temporary results', () => {
    const p = resetLevel4(throughLock());
    expect(p.level2?.sequence).toBe('467');
    expect(p.level3?.triangles).toBe(TRIANGLE_COUNT);
    expect(p.level4).toEqual({ tile: null, digitSum: null, escaped: false });
    expect(currentLevel(p)).toBe(4);
  });
  it('a Level 3 retry leaves Level 2 untouched (no Level 3 result is stored before success)', () => {
    const p = completeLevel2(start(), L2, 1, 0);
    expect(currentLevel(p)).toBe(3);
    expect(p.level2?.sequence).toBe('467');
  });
});
