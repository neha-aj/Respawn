/* ============================================================================
   Countdown computed from elapsed wall-clock time (never by counting frames),
   so dropped frames or a slow tab cannot make it drift.
   ============================================================================ */

export class CountdownTimer {
  private startedAt = 0;
  private banked = 0;          // elapsed time accumulated before the current run segment
  private running = false;
  private paused = false;

  constructor(readonly durationMs: number, private readonly now: () => number = () => performance.now()) {}

  start() { this.banked = 0; this.startedAt = this.now(); this.running = true; this.paused = false; }
  stop() { if (this.running && !this.paused) this.banked += this.now() - this.startedAt; this.running = false; }
  reset() { this.banked = 0; this.running = false; this.paused = false; }

  pause() {
    if (!this.running || this.paused) return;
    this.banked += this.now() - this.startedAt;
    this.paused = true;
  }
  resume() {
    if (!this.running || !this.paused) return;
    this.startedAt = this.now();
    this.paused = false;
  }

  /** Carry on a clock that was stopped between levels (or paused), keeping the time already used. */
  continueRun() {
    if (this.running && !this.paused) return;
    if (this.paused) { this.resume(); return; }
    this.startedAt = this.now(); this.running = true; this.paused = false;
  }

  get hasStarted() { return this.running || this.banked > 0; }
  get isRunning() { return this.running && !this.paused; }
  get isPaused() { return this.paused; }

  elapsed(): number {
    return this.banked + (this.running && !this.paused ? this.now() - this.startedAt : 0);
  }
  remaining(): number { return Math.max(0, this.durationMs - this.elapsed()); }
  isExpired(): boolean { return this.remaining() <= 0; }
}

export function formatTime(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return s.toFixed(1);
  const whole = Math.ceil(s);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
