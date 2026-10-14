import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { C, CHALLENGE, DANCER_X, DOOR_T, ENTRY_T, FONT, POSES, SENTENCES, TYPABLE, VICTORY_DANCE_T, wrap } from './config';
import { OrangeGame, Typing } from './sim';

const files: string[] = [];
const walk = (d: string) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx|css|js)$/.test(f) && !f.endsWith('.test.ts')) files.push(p); });
walk(join(__dirname, '..')); files.push(join(__dirname, '..', '..', 'tailwind.config.js'), join(__dirname, '..', '..', 'index.html'));
const all = files.map((f) => readFileSync(f, 'utf8')).join('\n');

/** Plays the challenge at `cps` letters per second; every `errEvery`-th keystroke is wrong. */
function bot(cps: number, errEvery = 0) {
  const g = new OrangeGame(); g.keyEnter(); g.keyEnter();
  let t = 0, nxt = 0, n = 0;
  while (g.state === 'PLAYING' && t < CHALLENGE + 1) {
    if (t >= nxt) { n++; const want = g.typing.text[g.typing.pos]; g.keyChar(errEvery && n % errEvery === 0 ? (want === 'Q' ? 'Z' : 'Q') : want); nxt += 1 / cps; }
    g.step(1 / 60); t += 1 / 60;
  }
  return g;
}

describe('identity and palette', () => {
  it('every colour is an orange shade', () => {
    const orange = (r: number, g: number, b: number) => {
      if (Math.max(r, g, b) <= 24) return r >= g && g >= b;
      const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, s = mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 2 - mx - mn : mx + mn);
      const h = mx === mn ? 0 : 60 * (((g - b) / 255) / (mx - mn));
      return r >= g && g >= b && h >= 10 && h <= 48 && s > 0.2;
    };
    const bad: string[] = [];
    const visual = files.filter((f) => !f.endsWith('audio.ts')).map((f) => readFileSync(f, 'utf8')).join('\n');   // audio.ts holds note tables, not colours
    for (const m of visual.matchAll(/\[(\d{1,3}), (\d{1,3}), (\d{1,3})\]/g)) if (!orange(+m[1], +m[2], +m[3])) bad.push(m[0]);
    for (const m of all.matchAll(/#([0-9A-Fa-f]{6})\b/g)) { const n = parseInt(m[1], 16); if (!orange(n >> 16, (n >> 8) & 255, n & 255)) bad.push(m[0]); }
    expect(bad).toEqual([]);
    expect([C.STAGE, C.SPOT, C.DANCER, C.HUD, C.DOOR]).toEqual([[58, 19, 0], [255, 102, 0], [255, 153, 0], [255, 229, 204], [255, 240, 224]]);
  });
  it('title is exactly ORANGE; RED transition text is exact; the pixel font covers every string', () => {
    expect(all).toContain("this.text('ORANGE', 14");
    expect(all).toContain('<title>ORANGE</title>');
    for (const s of ['PHASE DOOR UNLOCKED.', 'TRANSITIONING TO LEVEL: RED', 'PRESS R TO RESTART', 'CHALLENGE FAILED', 'PRESS R TO RETRY']) expect(all).toContain(s);
    const strings = [...all.matchAll(/this\.text\('([^']+)'/g)].map((m) => m[1]);
    expect(strings.filter((s) => [...s].some((ch) => !(ch in FONT)))).toEqual([]);
  });
});

describe('scoring', () => {
  it('WPM = correct letters × 12 / seconds; accuracy counts every keystroke; backspace never erases errors', () => {
    const tp = new Typing(() => 0.1);
    expect(tp.accuracy()).toBe(100); expect(tp.wpm(0)).toBe(0);
    tp.net = 200; expect(tp.wpm(60)).toBe(40);
    tp.reset(); const w = tp.text;
    tp.press(w[0]); tp.press(w[1]); tp.press(w[2] === 'Q' ? 'Z' : 'Q');
    expect([tp.wrong, tp.pos]).toEqual([1, 2]);
    tp.backspace(); tp.backspace(); expect(tp.backspace()).toBe(false);
    expect([tp.pos, tp.wrong, tp.net, tp.correct]).toEqual([0, 1, 0, 2]);
    const first = tp.text, res = [...first].map((ch) => tp.press(ch));
    expect(res.filter((r) => r === 'word').length).toBe(first.split(' ').length - 1); expect(res.at(-1)).toBe('sentence');
    expect([tp.sentences, tp.pos]).toEqual([1, 0]); expect(tp.backspace()).toBe(false);
    const t2 = new Typing(); const seen = [t2.text, ...Array.from({ length: SENTENCES.length - 1 }, () => t2.pick())];
    expect(new Set(seen).size).toBe(SENTENCES.length);                       // no repeats until every sentence is used
    expect(SENTENCES.every((x) => wrap(x).length <= 2 && [...x].every((ch) => TYPABLE.has(ch)))).toBe(true);
    expect(wrap(SENTENCES[0]).map(([, l]) => l).join('')).toBe(SENTENCES[0]);
  });
});

describe('states and inputs', () => {
  it('title → ready → playing; typing elsewhere counts nothing; pause freezes; R is a letter mid-challenge', () => {
    const g = new OrangeGame();
    g.keyChar('A'); expect(g.typing.attempts).toBe(0);
    g.keyEnter(); expect(g.state).toBe('READY'); g.keyChar('A'); for (let i = 0; i < 30; i++) g.step(1 / 60);
    expect([g.typing.attempts, g.elapsed]).toEqual([0, 0]);
    g.keyEnter(); expect(g.state).toBe('PLAYING');
    const before = { ...g.dancer.target }; g.keyChar(g.typing.text[0]); expect(g.dancer.target).not.toEqual(before);
    const poses = new Set<string>(); for (let i = 0; i < 8; i++) { g.keyChar(g.typing.text[g.typing.pos]); poses.add(JSON.stringify(g.dancer.target)); }
    expect(poses.size).toBeGreaterThanOrEqual(6);
    g.step(1 / 60); expect(Object.keys(g.dancer.cur).some((k) => Math.abs(g.dancer.cur[k as 'lean'] - g.dancer.target[k as 'lean']) > 1e-3)).toBe(true);
    while (g.typing.text[g.typing.pos] !== ' ') g.keyChar(g.typing.text[g.typing.pos]);
    g.keyChar(' '); expect(g.dancer.spinV > 0 || g.dancer.target.dy <= -10).toBe(true);
    const sent = g.typing.sentences; while (g.typing.sentences === sent) g.keyChar(g.typing.text[g.typing.pos]);
    expect(g.dancer.target.dy).toBeLessThanOrEqual(-10); expect(g.wordPop).not.toBeNull();
    g.keyChar(g.typing.text[g.typing.pos] === 'Q' ? 'Z' : 'Q'); expect(g.dancer.target).toEqual(POSES.stumble);
    g.keyEscape(); const t0 = g.elapsed; for (let i = 0; i < 120; i++) g.step(1 / 60);
    expect(g.state).toBe('PAUSED'); expect(g.elapsed).toBe(t0);
    g.keyR(); expect(g.state).toBe('PAUSED');
    g.keyEscape(); for (let i = 0; i < 60; i++) g.step(1 / 60); expect(g.elapsed - t0).toBeCloseTo(1, 2);
  });
});

describe('results', () => {
  it('48 WPM perfect: victory, frozen result, full ending, R restarts', () => {
    const g = bot(4);
    expect(g.elapsed).toBe(CHALLENGE); expect(g.state).toBe('VICTORY_DANCE'); expect(g.finalWpm).toBeCloseTo((g.typing.net * 12) / 60, 9);
    const frozen = [g.finalWpm, g.finalAcc, g.typing.correct];
    g.keyChar('A'); g.keyEscape(); g.keyR(); g.keyEnter();
    expect([g.finalWpm, g.finalAcc, g.typing.correct]).toEqual(frozen); expect(g.state).toBe('VICTORY_DANCE');
    const seen: string[] = [];
    for (let i = 0; i < (VICTORY_DANCE_T + DOOR_T + ENTRY_T + 1) * 60; i++) { g.step(1 / 60); if (!seen.includes(g.state)) seen.push(g.state); }
    expect(seen).toEqual(['VICTORY_DANCE', 'DOOR_OPENING', 'PORTAL_ENTRY', 'TRANSITION_SCREEN']);
    expect(g.spkOpen).toBeGreaterThan(0.99); expect(g.dancer.x).toBeGreaterThan(370); expect(g.dancer.scaleK).toBeLessThan(0.05);
    g.keyR(); expect(g.state).toBe('READY'); expect([g.typing.attempts, g.spkOpen, g.dancer.x, g.won, g.fx.p.length]).toEqual([0, 0, DANCER_X, null, 0]);
  });
  it('too slow loses and collapses; fast-but-sloppy loses; ≥40 WPM and ≥88% wins; nothing typed never wins', () => {
    const slow = bot(3); expect(slow.state).toBe('GAME_OVER'); expect(slow.finalAcc).toBe(100); expect(slow.finalWpm).toBeLessThan(40);
    for (let i = 0; i < 90; i++) slow.step(1 / 60);
    expect(slow.dancer.cur.lean).toBeCloseTo(POSES.collapse.lean, 1);
    slow.keyR(); expect([slow.state, slow.typing.attempts, slow.elapsed, slow.dancer.mode]).toEqual(['READY', 0, 0, 'groove']);
    const sloppy = bot(6, 6); expect(sloppy.state).toBe('GAME_OVER'); expect(sloppy.finalWpm).toBeGreaterThanOrEqual(40); expect(sloppy.finalAcc).toBeLessThan(88);
    expect(bot(5, 12).state).toBe('VICTORY_DANCE');
    const idle = new OrangeGame(); idle.keyEnter(); idle.keyEnter(); for (let i = 0; i < 3700; i++) idle.step(1 / 60);
    expect(idle.state).toBe('GAME_OVER'); expect(idle.won).toBe(false);
  });
});
