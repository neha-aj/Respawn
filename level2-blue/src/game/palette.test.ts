import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PALETTE } from './config';

/** Hue/saturation check: a colour counts as "blue" if its hue is 190°–230° (or it is a near-white blue tint). */
function isBlue(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (b !== max) return false;
  if (d === 0) return false;
  let h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  return h >= 190 && h <= 230;
}
const hexToRgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const; };

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|css|js|html)$/.test(f) && !f.endsWith('.test.ts') ? [p] : [];
  });
}

describe('blue-only palette', () => {
  it('every palette entry is a shade of blue', () => {
    for (const hex of Object.values(PALETTE)) expect(isBlue(...hexToRgb(hex)), hex).toBe(true);
  });
  it('no non-blue colour literal appears anywhere in the source', () => {
    const root = join(__dirname, '..', '..');
    const sources = [...files(join(root, 'src')), join(root, 'tailwind.config.js'), join(root, 'index.html')];
    const offenders: string[] = [];
    for (const f of sources) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/#[0-9a-fA-F]{6}\b/g)) if (!isBlue(...hexToRgb(m[0]))) offenders.push(`${f}: ${m[0]}`);
      for (const m of text.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) if (!isBlue(+m[1], +m[2], +m[3])) offenders.push(`${f}: ${m[0]}`);
    }
    expect(offenders).toEqual([]);
  });
});
