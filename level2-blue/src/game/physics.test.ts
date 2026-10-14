import { describe, expect, it } from 'vitest';
import { Balance, FIXED_DT, G_EFF, MOVE, Spring, jumpHeight, stepBody, type Body } from './physics';
import { CountdownTimer, formatTime } from './timer';
import { BODY_H, FLOOR_Y, LEDGE } from './layout';

const run = (b: Balance, seconds: number) => { for (let i = 0; i < seconds / FIXED_DT; i++) b.step(); };

describe('balance physics', () => {
  it('settles level when both pans carry the same weight', () => {
    const b = new Balance(7, 7); b.angle = 0.3; b.omega = 1;
    run(b, 8);
    expect(Math.abs(b.angle)).toBeLessThan(0.01);
    expect(b.isSettled()).toBe(true);
  });
  it('tips toward the weight when the counterweight is too light', () => {
    const b = new Balance(7, 5); run(b, 6);
    expect(b.angle).toBeGreaterThan(0.3);
  });
  it('tips toward the counterweights when they are too heavy', () => {
    const b = new Balance(6, 9); run(b, 6);
    expect(b.angle).toBeLessThan(-0.3);
  });
  it('heavier weights never tip the wrong way (symmetric arms)', () => {
    for (let l = 1; l <= 10; l++) for (let r = 0; r <= 10; r++) {
      if (l === r) continue;
      const b = new Balance(l, r); run(b, 4);
      expect(Math.sign(b.angle)).toBe(Math.sign(l - r));
    }
  });
});

describe('character physics', () => {
  it('can jump onto the ledge and also walk underneath it', () => {
    expect(jumpHeight()).toBeGreaterThan(FLOOR_Y - LEDGE.y + 4);
    expect(LEDGE.y + LEDGE.h).toBeLessThan(FLOOR_Y - BODY_H);
  });
  it('lands on the floor and stops', () => {
    const body: Body = { x: 10, y: 0, w: 12, h: 40, vx: 0, vy: 0, onGround: false };
    const floor = { x: 0, y: 226, w: 480, h: 44 };
    for (let i = 0; i < 600; i++) stepBody(body, [floor], { dir: 0, jump: false });
    expect(body.onGround).toBe(true);
    expect(body.y + body.h).toBeCloseTo(226, 5);
  });
  it('walk speed is capped', () => {
    const body: Body = { x: 10, y: 186, w: 12, h: 40, vx: 0, vy: 0, onGround: true };
    const floor = { x: 0, y: 226, w: 4800, h: 44 };
    for (let i = 0; i < 600; i++) stepBody(body, [floor], { dir: 1, jump: false });
    expect(body.vx).toBeLessThanOrEqual(MOVE.maxSpeed);
    expect(G_EFF).toBeLessThan(900);
  });
  it('a damped spring reaches its target', () => {
    const s = new Spring(0, 60, 0.6); s.target = -64;
    for (let i = 0; i < 1200; i++) s.step();
    expect(s.value).toBeCloseTo(-64, 1);
  });
});

describe('countdown timer', () => {
  it('is computed from elapsed time, not frames', () => {
    let t = 1000; const timer = new CountdownTimer(90_000, () => t);
    timer.start(); t += 30_000;
    expect(timer.remaining()).toBe(60_000);
    t += 5_000; // a long dropped frame
    expect(timer.remaining()).toBe(55_000);
  });
  it('freezes while paused and resumes accurately', () => {
    let t = 0; const timer = new CountdownTimer(90_000, () => t);
    timer.start(); t = 10_000; timer.pause(); t = 50_000;
    expect(timer.remaining()).toBe(80_000);
    timer.resume(); t = 60_000;
    expect(timer.remaining()).toBe(70_000);
  });
  it('expires at zero and never goes negative', () => {
    let t = 0; const timer = new CountdownTimer(90_000, () => t);
    timer.start(); t = 120_000;
    expect(timer.isExpired()).toBe(true);
    expect(timer.remaining()).toBe(0);
  });
  it('restart resets the full 90 seconds', () => {
    let t = 0; const timer = new CountdownTimer(90_000, () => t);
    timer.start(); t = 70_000; timer.start();
    expect(timer.remaining()).toBe(90_000);
  });
  it('one shared clock carries across levels: stopping between levels keeps the time used', () => {
    let t = 0; const timer = new CountdownTimer(180_000, () => t);
    timer.start(); t = 50_000;          // Level 2 takes 50 s
    timer.stop(); t = 200_000;          // completion screen + intro card: frozen
    expect(timer.remaining()).toBe(130_000);
    timer.continueRun(); t = 230_000;   // Level 3 takes 30 s
    expect(timer.remaining()).toBe(100_000);
    timer.pause(); t = 999_000; timer.continueRun(); t = 1_009_000; // pause, then continue
    expect(timer.remaining()).toBe(90_000);
  });
  it('a new run restarts the full 3 minutes', () => {
    let t = 0; const timer = new CountdownTimer(180_000, () => t);
    timer.start(); t = 170_000; timer.stop();
    expect(timer.hasStarted).toBe(true);
    timer.start();
    expect(timer.remaining()).toBe(180_000);
  });
  it('formats the display', () => {
    expect(formatTime(90_000)).toBe('1:30');
    expect(formatTime(9_420)).toBe('9.4');
  });
});
