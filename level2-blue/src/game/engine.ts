/* ============================================================================
   GameEngine — owns the canvas, game loop, input, physics and level state.
   React talks to it through methods and receives Snapshots via onChange.
   ============================================================================ */
import type { AudioManager } from './audio';
import { CHARACTER_SPRITE_URL, PALETTE as P, VIEW_H, VIEW_W } from './config';
import { BALANCE, BODY_H, BODY_W, CONSOLE, DOOR, FLOOR_Y, LEDGE, LOCK_PANEL, MONITOR, PLATES, SOLIDS_BASE, SPAWN, TERMINAL, WALL_R } from './layout';
import { OVERLAP_HINTS } from './geometry';
import type { LevelNo } from './progress';
import { LOCK_HINTS } from './remainder';
import { drawCircuitry, drawDiagramMonitor, drawLockPanel, drawPowerDown, drawTerminal, type LockView } from './rooms';
import { Balance, FIXED_DT, G_EFF, Spring, overlaps, stepBody, type Body, type Rect } from './physics';
import {
  HINTS, SwitchSequence, WEIGHT_IDS, lightestToHeaviest, parseWeight, sequenceFromShapes, solveWeights, validateWeights,
  type Shape, type Validation, type WeightId, type WeightVerdict,
} from './puzzle';
import {
  buildBackground, counterPanTop, drawBackground, drawBalance, drawBubbles, drawConsole, drawDoor, drawFlood, drawLedge,
  drawPlates, drawWarning, type Background, type Bubble, type PlateView, type ScaleView,
} from './scene';
import { drawPortrait, drawThanos, recolourToBlue, type Expression, type Pose } from './sprites';
import { CountdownTimer } from './timer';

export type Phase = 'intro' | 'playing' | 'paused' | 'failed' | 'complete';
export type Stage = 'solve' | 'switches' | 'exit' | 'final';
export type Near = 'console' | 'balance' | WeightId | 'door' | 'panel' | 'terminal' | null;
export type Station = 'panel' | 'terminal' | null;
export type MessageKind = 'info' | 'good' | 'bad' | 'hint';
export interface GameMessage { id: number; text: string; kind: MessageKind }
export interface Bag {
  previousOrder: readonly Shape[];
  weights: Record<WeightId, number> | null;
  order: WeightId[] | null;
  sequence: string | null;
}
export interface Snapshot {
  level: LevelNo; station: Station;
  phase: Phase; stage: Stage; remainingMs: number; expression: Expression; near: Near;
  consoleOpen: boolean; weighing: boolean; verdicts: Record<WeightId, WeightVerdict | 'unknown'>;
  switchProgress: WeightId[]; message: GameMessage | null; hintsUsed: number; bag: Bag;
  showFailure: boolean; showComplete: boolean;
  stats: { timeMs: number; totalMs: number; hints: number; wrongSubmissions: number; wrongSwitches: number };
}
export interface EngineOptions { previousOrder: readonly Shape[]; timeLimitMs: number; onChange: (s: Snapshot) => void }

interface ScaleState { balance: Balance; verdict: WeightVerdict | 'unknown'; landed: number; queue: number; unit: number; falling: { y: number; vy: number }[]; glow: number; spawnT: number }

const TRUTH = solveWeights();
const HINTS_BY_LEVEL: Record<LevelNo, readonly { title: string; text: string }[]> = { 2: HINTS, 3: OVERLAP_HINTS, 4: LOCK_HINTS };
const SOLIDS_ROOM = SOLIDS_BASE.filter((r) => r !== LEDGE); // Levels 3-4 have no ledge
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);

export class GameEngine {
  private g: CanvasRenderingContext2D;
  private bg: Background;
  private timer: CountdownTimer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private t = 0;

  // player
  private body: Body = { x: SPAWN.x, y: SPAWN.y, w: BODY_W, h: BODY_H, vx: 0, vy: 0, onGround: true };
  private facing: 1 | -1 = 1;
  private walk = 0;
  private stepCycle = 0;
  private keys = new Set<string>();
  private jumpQueued = false;
  private transient: { e: Expression; until: number } | null = null;
  private interactUntil = 0;
  private sprite: HTMLCanvasElement | null = null;
  private portrait: CanvasRenderingContext2D | null = null;
  private portraitT = 0;

  // level state
  private level: LevelNo = 2;
  private station: Station = null;
  private autoExit = false;
  private solvedT = 0;
  private power = 1;
  private powerDown = 0;
  private lock: LockView = { selected: null, eliminated: new Set(), solvedTile: null, digitDone: false, errorT: 0 };
  private phase: Phase = 'intro';
  private stage: Stage = 'solve';
  private near: Near = null;
  private consoleOpen = false;
  private weighing = false;
  private settleT = 0;
  private pending: Validation | null = null;
  private scales = {} as Record<WeightId, ScaleState>;
  private plates = {} as Record<WeightId, { spring: Spring; lit: boolean; flash: number }>;
  private door = new Spring(0, 40, 0.55);
  private seq = new SwitchSequence(lightestToHeaviest(TRUTH));
  private hintsUsed = 0;
  private wrongSubmissions = 0;
  private wrongSwitches = 0;
  private message: GameMessage | null = null;
  private msgId = 0;
  private bag: Bag;
  private warned30 = false;
  private lastPing = -1;
  private flood = 0;
  private failT = 0;
  private completeT = 0;
  private finalTime = 0;
  private levelStart = 0; // shared clock reading when this level began
  private flash = 0;
  private shake = 0;

  // ambience
  private bubbles: Bubble[] = [];
  private bubbleT = 0;
  private breathT = 2;
  private shafts = Array.from({ length: 11 }, (_, i) => ({ x: 24 + i * 41 + ((i * 17) % 13), w: 2 + ((i * 7) % 9), len: 40 + ((i * 37) % 110), ph: i * 1.7 }));

  private lastSig = '';

  constructor(private canvas: HTMLCanvasElement, private audio: AudioManager, private opts: EngineOptions) {
    canvas.width = VIEW_W; canvas.height = VIEW_H;
    this.g = canvas.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.bg = buildBackground();
    this.timer = new CountdownTimer(opts.timeLimitMs);
    this.bag = { previousOrder: opts.previousOrder, weights: null, order: null, sequence: null };
    this.resetLevelState();
    if (CHARACTER_SPRITE_URL) {
      const img = new Image();
      img.onload = () => { this.sprite = recolourToBlue(img); };
      img.onerror = () => { this.sprite = null; }; // missing asset → built-in sprite
      img.src = CHARACTER_SPRITE_URL;
    }
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('pointerdown', this.onPointer);
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointer);
  }

  setPortraitCanvas(c: HTMLCanvasElement | null) {
    this.portrait = c ? c.getContext('2d') : null;
    if (this.portrait) this.portrait.imageSmoothingEnabled = false;
  }

  /* ================= public flow ================= */
  /**
   * One clock is shared by Levels 2–4. `fresh` (a new run) restarts it at the full limit;
   * otherwise it carries on from the time already used.
   */
  start(level: LevelNo = this.level, fresh = level === 2) {
    this.level = level;
    this.resetLevelState(); this.phase = 'playing';
    if (fresh || !this.timer.hasStarted) this.timer.start(); else this.timer.continueRun();
    this.levelStart = this.timer.elapsed();
    this.say(level === 2 ? 'Thanos enters the chamber. The console on the left holds the equations.'
      : level === 3 ? 'A sealed geometric panel blocks the passage. Walk to the monitor and press E to inspect it.'
        : 'The final chamber. Use the lock panel to find the safe tile, then the escape terminal by the door.', 'info');
    this.emit(true);
  }
  /** Show a level's room behind a menu or intro card without starting its timer. */
  preview(level: LevelNo, keepClock = false) {
    this.level = level;
    if (keepClock) this.timer.stop(); else this.timer.reset(); // between levels the shared clock is frozen, not reset
    this.resetLevelState(); this.phase = 'intro'; this.emit(true);
  }
  get currentLevel() { return this.level; }
  /** Time spent in the current level on the shared clock. */
  levelElapsedMs() { return this.timer.elapsed() - this.levelStart; }
  restart() { this.start(); }
  pause() { if (this.phase !== 'playing') return; this.phase = 'paused'; this.timer.pause(); this.keys.clear(); this.emit(true); }
  resume() { if (this.phase !== 'paused') return; this.phase = 'playing'; this.timer.resume(); this.last = performance.now(); this.emit(true); }
  toMenu(keepClock = false) { this.preview(2, keepClock); }

  /* ---- stations (Levels 3-4) ---- */
  openStation() {
    if (this.phase !== 'playing' || (this.near !== 'panel' && this.near !== 'terminal')) return;
    if (this.near === 'terminal' && this.stage !== 'final') { this.audio.wrong(); this.notify('The escape terminal is locked. Solve the lock panel first.', 'bad', 'confused', 1.4); return; }
    this.station = this.near; this.audio.interact(); this.react('examining', 1.6); this.emit(true);
  }
  closeStation() { if (this.station) { this.station = null; this.emit(true); } }

  /** Feedback from the React puzzle panels: message + Thanos reaction. */
  notify(text: string, kind: MessageKind, expr?: Expression, seconds = 2) {
    this.say(text, kind); if (expr) this.react(expr, seconds); this.emit(true);
  }
  setLockView(v: Partial<LockView>) { this.lock = { ...this.lock, ...v }; if (v.errorT) this.shake = 0.12; }

  /** Level 3 solved: glow the diagram, open the passage, Thanos walks out. */
  overlapSolved() {
    if (this.level !== 3 || this.phase !== 'playing' || this.stage !== 'solve') return;
    this.stage = 'exit'; this.station = null; this.solvedT = 0; this.keys.clear();
    this.finalTime = this.timer.elapsed() - this.levelStart; this.timer.stop();
    this.door.target = -(DOOR.h + 2); this.autoExit = true;
    this.audio.correct(); window.setTimeout(() => this.audio.doorUnlock(), 500);
    this.flash = 0.35; this.shake = 0.4; this.react('relieved', 3);
    this.emit(true);
  }
  /** Level 4 lock + digit solved: the escape terminal comes alive. */
  lockSolved() {
    if (this.level !== 4 || this.stage !== 'solve') return;
    this.stage = 'final'; this.station = null; this.lock = { ...this.lock, digitDone: true };
    this.audio.switchOn(2); this.flash = 0.25; this.react('focused', 2.5);
    this.say('The lock releases. The escape terminal by the door is now live.', 'good'); this.emit(true);
  }
  /** Final code accepted: stop the clock, power down security, open the door, celebrate. */
  escapeAccepted() {
    if (this.level !== 4 || this.phase !== 'playing' || this.stage !== 'final') return;
    this.stage = 'exit'; this.station = null; this.keys.clear();
    this.door.target = -(DOOR.h + 2); this.powerDown = 0.001;
    this.audio.doorUnlock();
    this.complete();
  }

  openConsole() { if (this.phase === 'playing' && this.near === 'console') { this.consoleOpen = true; this.audio.interact(); this.react('examining', 1.5); this.emit(true); } }
  closeConsole() { if (this.consoleOpen) { this.consoleOpen = false; this.emit(true); } }

  requestHint(): void {
    const hints = HINTS_BY_LEVEL[this.level];
    if (this.phase !== 'playing' || this.hintsUsed >= hints.length) return;
    this.hintsUsed++;
    this.audio.softClick();
    this.react('thinking', 2.2);
    this.say(`Hint ${this.hintsUsed}: ${hints[this.hintsUsed - 1].text}`, 'hint');
    this.emit(true);
  }

  /** Answers come in as raw strings from the console inputs. The equations decide; the balance shows it. */
  submitWeights(raw: Record<WeightId, string>) {
    if (this.level !== 2 || this.phase !== 'playing' || this.stage !== 'solve' || this.weighing) return;
    const values = {} as Record<WeightId, number | null>;
    for (const id of WEIGHT_IDS) values[id] = parseWeight(raw[id] ?? '');
    if (WEIGHT_IDS.some((id) => values[id] == null)) {
      this.audio.wrong(); this.react('confused', 1.6);
      this.say('Enter a number for each of A, B and C.', 'bad'); this.emit(true); return;
    }
    this.pending = validateWeights(values, TRUTH);
    for (const id of WEIGHT_IDS) {
      const s = this.scales[id], v = values[id] ?? 0;
      const count = Math.max(0, Math.min(20, Math.round(v)));
      s.landed = 0; s.falling = []; s.balance.right = 0; s.verdict = 'unknown';
      s.queue = count; s.unit = count > 0 ? v / count : 0; s.spawnT = 0;
    }
    this.weighing = true; this.settleT = 0;
    this.audio.creak(); this.audio.click();
    this.say('Weighing… counterweights are dropping onto the scales.', 'info');
    this.emit(true);
  }

  /* ================= internals ================= */
  private resetLevelState() {
    this.body = { x: SPAWN.x, y: SPAWN.y, w: BODY_W, h: BODY_H, vx: 0, vy: 0, onGround: true };
    this.facing = 1; this.walk = 0; this.keys.clear(); this.jumpQueued = false; this.transient = null; this.interactUntil = 0;
    this.stage = 'solve'; this.near = null; this.consoleOpen = false; this.weighing = false; this.pending = null; this.settleT = 0;
    for (const id of WEIGHT_IDS) {
      const b = new Balance(TRUTH[id], 0, BALANCE.arm);
      b.angle = b.maxAngle * 0.6;
      this.scales[id] = { balance: b, verdict: 'unknown', landed: 0, queue: 0, unit: 0, falling: [], glow: 0, spawnT: 0 };
      this.plates[id] = { spring: new Spring(0, 140, 0.35), lit: false, flash: 0 };
    }
    this.door = new Spring(0, 40, 0.55);
    this.seq = new SwitchSequence(lightestToHeaviest(TRUTH));
    this.hintsUsed = 0; this.wrongSubmissions = 0; this.wrongSwitches = 0;
    this.message = null; this.warned30 = false; this.lastPing = -1;
    this.flood = 0; this.failT = 0; this.completeT = 0; this.finalTime = 0; this.flash = 0; this.shake = 0;
    this.station = null; this.autoExit = false; this.solvedT = 0; this.power = 1; this.powerDown = 0;
    this.lock = { selected: null, eliminated: new Set(), solvedTile: null, digitDone: false, errorT: 0 };
    // current-level clues reset; information from earlier levels is kept
    this.bag = { previousOrder: this.opts.previousOrder, weights: null, order: null, sequence: null };
  }

  private say(text: string, kind: MessageKind) { this.message = { id: ++this.msgId, text, kind }; }
  private react(e: Expression, seconds: number) { this.transient = { e, until: this.t + seconds }; }

  private onBlur = () => this.keys.clear();
  private onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    const k = e.key.toLowerCase();
    const game = ['arrowleft', 'arrowright', 'arrowup', ' ', 'a', 'd', 'w', 'e'].includes(k);
    if (!game) return;
    if (this.station) return; // a puzzle panel is open: its own keyboard controls take over
    e.preventDefault(); // keeps Space from re-clicking a focused button or scrolling the page
    if (this.phase !== 'playing') return;
    if (!this.keys.has(k) && (k === ' ' || k === 'w' || k === 'arrowup')) this.jumpQueued = true;
    if (!this.keys.has(k) && k === 'e') this.interact(this.near, false);
    this.keys.add(k);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', ' ', 'a', 'd', 'w', 'e'].includes(k) && !isTyping(e.target)) e.preventDefault();
    this.keys.delete(k);
  };

  private onPointer = (e: PointerEvent) => {
    if (this.phase !== 'playing' || e.button !== 0) return;
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * VIEW_W, y = ((e.clientY - r.top) / r.height) * VIEW_H;
    const hit = (rc: Rect) => x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h;
    let target: Near = null;
    if (this.level !== 2) {
      if (hit({ x: DOOR.x - 6, y: DOOR.y - 14, w: DOOR.w + 6, h: DOOR.h + 14 })) target = 'door';
      else if (this.level === 3 && hit({ x: MONITOR.x, y: MONITOR.y, w: MONITOR.w, h: FLOOR_Y - MONITOR.y })) target = 'panel';
      else if (this.level === 4 && hit({ x: LOCK_PANEL.x, y: LOCK_PANEL.y, w: LOCK_PANEL.w, h: FLOOR_Y - LOCK_PANEL.y })) target = 'panel';
      else if (this.level === 4 && hit(TERMINAL)) target = 'terminal';
      if (target) this.interact(target, true);
      return;
    }
    for (const id of WEIGHT_IDS) { const p = PLATES[id]; if (hit({ x: p.x - 2, y: p.y - 36, w: p.w + 4, h: 38 })) target = id; }
    if (!target && hit({ x: DOOR.x - 6, y: DOOR.y - 14, w: DOOR.w + 6, h: DOOR.h + 14 })) target = 'door';
    if (!target && hit(CONSOLE)) target = 'console';
    if (!target && hit({ x: BALANCE.x, y: BALANCE.barY - 18, w: BALANCE.w, h: 110 })) target = 'balance';
    if (target) this.interact(target, true);
  };

  private interact(target: Near, fromClick: boolean) {
    if (this.phase !== 'playing' || !target) return;
    if (this.near !== target) {
      this.audio.softClick();
      this.say(fromClick ? 'Too far away. Walk Thanos next to it, then click or press E.' : 'Nothing to use here.', 'info');
      this.emit(true); return;
    }
    this.interactUntil = this.t + 0.35;
    if (target === 'panel' || target === 'terminal') { if (this.station === target) this.closeStation(); else this.openStation(); return; }
    if (this.level !== 2 && target === 'door') {
      this.say(this.stage === 'exit' ? 'The door is open.' : this.level === 3 ? 'Sealed. The geometric panel controls this passage.' : 'Sealed. Only the full escape code opens it.', 'info');
      this.audio.softClick(); this.emit(true); return;
    }
    if (target === 'console') { this.consoleOpen ? this.closeConsole() : this.openConsole(); return; }
    if (target === 'balance') {
      this.audio.interact(); this.react('examining', 2);
      this.say(this.stage === 'solve'
        ? 'Each scale holds one unknown weight. Enter values at the console: matching counterweights level the beam, while wrong ones tip it.'
        : 'All three beams hang level. The weights are confirmed.', 'info');
      for (const id of WEIGHT_IDS) this.scales[id].balance.kick(0.4);
      this.emit(true); return;
    }
    if (target === 'door') {
      this.say(this.stage === 'exit' ? 'The door is open. Walk through it!' : 'Sealed. Three pressure switches control this door.', 'info');
      this.audio.softClick(); this.emit(true); return;
    }
    this.pressPlate(target);
  }

  private pressPlate(id: WeightId) {
    const plate = this.plates[id];
    plate.spring.vel += 70;
    if (this.stage === 'solve') {
      this.audio.wrong(); this.react('confused', 1.2);
      this.say('Locked. The switches stay dead until all three weights are verified at the console.', 'bad'); this.emit(true); return;
    }
    if (this.stage !== 'switches') return;
    const res = this.seq.press(id);
    if (res === 'ignored') { this.audio.softClick(); this.say(`Switch ${id} is already engaged.`, 'info'); this.emit(true); return; }
    if (res === 'wrong') {
      this.wrongSwitches++;
      for (const k of WEIGHT_IDS) { this.plates[k].lit = false; this.plates[k].flash = 1; }
      this.audio.wrong(); this.react('confused', 1.8); this.shake = 0.15;
      this.say(`Switch ${id} is out of order, so the sequence resets. Lightest to heaviest.`, 'bad'); this.emit(true); return;
    }
    plate.lit = true;
    const n = this.seq.progress.length;
    this.audio.switchOn(n - 1);
    this.scales[id].glow = 1; this.scales[id].balance.kick(0.9);
    this.flash = 0.15; this.react('focused', 1.4);
    if (res === 'complete') this.unlockDoor();
    else this.say(`Switch ${id} engaged (${n}/3).`, 'good');
    this.emit(true);
  }

  private unlockDoor() {
    this.stage = 'exit';
    this.door.target = -(DOOR.h + 2);
    this.audio.doorUnlock(); this.shake = 0.6; this.flash = 0.35;
    const order = this.seq.progress.slice();
    this.bag = { ...this.bag, order, sequence: sequenceFromShapes(this.opts.previousOrder, TRUTH) };
    this.react('relieved', 2.5);
    this.say(`The door grinds open. Sequence recovered: ${this.bag.sequence}. Get out!`, 'good');
  }

  private finishWeighing() {
    this.weighing = false;
    const v = this.pending!; this.pending = null;
    for (const id of WEIGHT_IDS) this.scales[id].verdict = v.verdicts[id];
    if (v.allCorrect) {
      this.stage = 'switches';
      this.bag = { ...this.bag, weights: { ...TRUTH } };
      for (const id of WEIGHT_IDS) this.scales[id].glow = 1;
      this.audio.correct(); this.flash = 0.3; this.react('focused', 2.5);
      this.consoleOpen = false;
      this.say(`All three beams are level: A = ${TRUTH.A}, B = ${TRUTH.B}, C = ${TRUTH.C}. The switches are live. Press them from lightest to heaviest.`, 'good');
    } else {
      this.wrongSubmissions++;
      const wrong = WEIGHT_IDS.filter((id) => v.verdicts[id] !== 'correct')
        .map((id) => `${id} ${v.verdicts[id] === 'low' ? 'is too light (the beam tips toward the weight)' : 'is too heavy (the beam tips toward the counterweights)'}`);
      this.audio.wrong(); this.react(this.wrongSubmissions >= 3 ? 'frustrated' : 'confused', 2.4);
      this.say(`Not balanced: ${wrong.join('; ')}. Check the equations again.`, 'bad');
    }
    this.emit(true);
  }

  private fail() {
    this.phase = 'failed'; this.timer.stop(); this.keys.clear(); this.consoleOpen = false; this.weighing = false;
    this.audio.fail(); this.failT = 0; this.shake = 0.4;
    this.station = null; this.autoExit = false;
    this.say('TIME EXPIRED — THANOS MUST TRY AGAIN', 'bad');
    this.emit(true);
  }

  private complete() {
    if (this.phase === 'complete') return;
    this.phase = 'complete'; if (this.timer.isRunning) this.finalTime = this.timer.elapsed() - this.levelStart; this.timer.stop(); this.autoExit = false; this.keys.clear();
    this.body.vx = 0; this.completeT = 0; this.flash = 0.6;
    this.audio.victory();
    this.say(this.level === 2 ? `BLUE cleared. Sequence ${this.bag.sequence} secured.` : this.level === 3 ? 'The Overlap Trap is open. Thanos moves deeper.' : 'Escape code accepted. Security is powering down.', 'good');
    this.emit(true);
  }

  private nearTarget(): Near {
    const b = this.body, cx = b.x + b.w / 2, feet = b.y + b.h;
    const onFloor = Math.abs(feet - FLOOR_Y) < 3 && b.onGround;
    if (this.level !== 2) {
      if (!onFloor) return null;
      if (cx > WALL_R - 22) return 'door';
      if (this.level === 4 && Math.abs(cx - (TERMINAL.x + TERMINAL.w / 2)) < 26) return 'terminal';
      const area = this.level === 3 ? MONITOR : LOCK_PANEL;
      if (cx > area.x - 10 && cx < area.x + area.w + 10) return 'panel';
      return null;
    }
    for (const id of WEIGHT_IDS) { const p = PLATES[id]; if (Math.abs(cx - (p.x + p.w / 2)) < 14 && Math.abs(feet - p.y) < 4 && b.onGround) return id; }
    if (onFloor && cx > WALL_R - 22) return 'door';
    if (onFloor && Math.abs(cx - (CONSOLE.x + CONSOLE.w / 2)) < 32) return 'console';
    if (onFloor && cx > BALANCE.x && cx < BALANCE.x + BALANCE.w) return 'balance';
    return null;
  }

  private expression(): Expression {
    if (this.phase === 'failed') return 'disappointed';
    if (this.phase === 'complete') return 'celebrate';
    if (this.transient && this.t < this.transient.until) return this.transient.e;
    if (this.phase === 'playing' || this.phase === 'paused') {
      const rem = this.timer.remaining();
      if (rem < 10_000) return 'panic';
      if (rem < 30_000) return 'urgent';
    }
    if (this.consoleOpen || this.weighing) return 'examining';
    if (this.station === 'panel') return this.level === 3 ? 'thinking' : 'examining';
    if (this.station === 'terminal') return 'focused';
    if (this.stage === 'switches' || this.stage === 'final') return 'focused';
    if (this.stage === 'exit') return 'relieved';
    return 'determined';
  }

  private pose(): Pose {
    if (this.phase === 'complete') return 'celebrate';
    if (this.phase === 'failed') return 'fail';
    if (this.t < this.interactUntil) return 'interact';
    if (!this.body.onGround) return 'jump';
    if (Math.abs(this.body.vx) > 8) return 'walk';
    if (this.consoleOpen || this.weighing || this.station) return 'think';
    return 'idle';
  }

  private solids(): Rect[] {
    const doorRect = { x: DOOR.x, y: DOOR.y + this.door.value, w: DOOR.w, h: DOOR.h };
    return [...(this.level === 2 ? SOLIDS_BASE : SOLIDS_ROOM), doorRect];
  }

  private physicsStep(dt: number) {
    const playing = this.phase === 'playing';
    const left = this.keys.has('arrowleft') || this.keys.has('a');
    const right = this.keys.has('arrowright') || this.keys.has('d');
    const auto = this.autoExit && this.door.value < -BODY_H;
    const dir: -1 | 0 | 1 = auto ? 1 : playing && !this.autoExit ? (left === right ? 0 : left ? -1 : 1) : 0;
    if (dir) this.facing = dir;
    const landed = stepBody(this.body, this.solids(), { dir, jump: playing && !this.autoExit && this.jumpQueued }, dt);
    if (this.jumpQueued && playing) this.audio.bubble();
    this.jumpQueued = false;
    if (landed) this.audio.land();
    if (this.body.onGround && Math.abs(this.body.vx) > 8) {
      this.walk += Math.abs(this.body.vx) * dt * 0.28;
      const cyc = Math.floor(this.walk / Math.PI);
      if (cyc !== this.stepCycle) { this.stepCycle = cyc; this.audio.footstep(); }
    }

    // balance scales + falling counterweight blocks (gravity in water)
    for (const id of WEIGHT_IDS) {
      const s = this.scales[id], cx = BALANCE.scales[id];
      s.spawnT -= dt;
      if (s.queue > 0 && s.spawnT <= 0) { s.falling.push({ y: BALANCE.pivotY - 18, vy: 0 }); s.queue--; s.spawnT = 0.06; }
      for (const fb of s.falling) {
        fb.vy += G_EFF * dt; fb.y += fb.vy * dt;
        if (fb.y >= counterPanTop(cx, s.balance, s.landed)) {
          s.landed++; s.balance.right += s.unit; s.balance.kick(-0.06 * Math.min(4, fb.vy / 60));
          fb.vy = -1; this.audio.block();
        }
      }
      s.falling = s.falling.filter((fb) => fb.vy >= 0);
      s.balance.step(dt);
      s.glow = Math.max(0, s.glow - dt * 0.5);
    }
    if (this.weighing) {
      const busy = WEIGHT_IDS.some((id) => this.scales[id].queue > 0 || this.scales[id].falling.length > 0);
      this.settleT = busy ? 0 : this.settleT + dt;
      if (this.settleT > 1.1) this.finishWeighing();
    }

    for (const id of WEIGHT_IDS) { const p = this.plates[id]; p.spring.target = p.lit ? 2 : 0; p.spring.step(dt); p.flash = Math.max(0, p.flash - dt * 2); }
    this.door.step(dt);

    this.near = playing && !this.autoExit ? this.nearTarget() : null;
    if (this.consoleOpen && this.near !== 'console') this.consoleOpen = false;
    if (this.station && this.near !== this.station) this.station = null;
    if (playing && this.stage === 'exit' && this.door.value < -BODY_H && this.body.x + this.body.w > WALL_R - 2) this.complete();
  }

  private effects(dt: number) {
    // bubbles rise with buoyancy, wobble sideways (sine), and pop at the window top
    this.bubbleT -= dt;
    if (this.bubbleT <= 0) {
      this.bubbleT = 0.12 + Math.random() * 0.2;
      this.bubbles.push({ x: 20 + Math.random() * 440, y: FLOOR_Y - 2, r: Math.random() < 0.3 ? 2 : 1, vy: -10, ph: Math.random() * 6, life: 9 });
    }
    this.breathT -= dt;
    if (this.breathT <= 0 && this.phase !== 'intro') {
      this.breathT = 2 + Math.random() * 2;
      const mx = this.body.x + this.body.w / 2 + this.facing * 3, my = this.body.y + 9;
      for (let i = 0; i < 3; i++) this.bubbles.push({ x: mx + (Math.random() - 0.5) * 3, y: my - i * 4, r: i === 0 ? 2 : 1, vy: -14 - i * 4, ph: Math.random() * 6, life: 6 });
      if (this.phase === 'playing' && Math.random() < 0.4) this.audio.bubble();
    }
    for (const b of this.bubbles) { b.vy = Math.max(-34, b.vy - 30 * dt); b.y += b.vy * dt; b.x += Math.sin(this.t * 3 + b.ph) * 0.25; b.life -= dt; }
    this.bubbles = this.bubbles.filter((b) => b.y > 20 && b.life > 0).slice(-140);

    this.flash = Math.max(0, this.flash - dt * 1.6);
    this.solvedT += dt;
    if (this.lock.errorT > 0) this.lock = { ...this.lock, errorT: Math.max(0, this.lock.errorT - dt * 2) };
    if (this.powerDown > 0) this.powerDown = Math.min(1, this.powerDown + dt * 0.5);
    this.power = 1 - this.powerDown * 0.8;
    this.shake = Math.max(0, this.shake - dt);
    if (this.phase === 'failed') {
      this.failT += dt;
      this.flood = Math.min(VIEW_H + 6, this.flood + dt * (VIEW_H / 2.2));
    } else this.flood = Math.max(0, this.flood - dt * 200);
    if (this.phase === 'complete') this.completeT += dt;
  }

  private timerEvents() {
    if (this.phase !== 'playing' || !this.timer.isRunning) return;
    const rem = this.timer.remaining();
    this.audio.setTension(1 - rem / this.opts.timeLimitMs);
    if (!this.warned30 && rem <= 30_000) { this.warned30 = true; this.audio.sonar(); this.say('30 seconds left. The water is rising!', 'bad'); }
    const sec = Math.ceil(rem / 1000);
    if (rem <= 10_000 && sec !== this.lastPing && sec > 0) { this.lastPing = sec; this.audio.sonar(true); }
    if (this.timer.isExpired()) this.fail();
  }

  private frame = (now: number) => {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (this.phase !== 'paused') {
      this.t += dt;
      this.timerEvents();
      this.acc += dt;
      while (this.acc >= FIXED_DT) { this.physicsStep(FIXED_DT); this.acc -= FIXED_DT; }
      this.effects(dt);
    }
    this.render();
    this.emit(false);
    this.raf = requestAnimationFrame(this.frame);
  };

  private render() {
    const g = this.g, t = this.t;
    g.save();
    if (this.shake > 0) g.translate(Math.round(Math.sin(t * 61) * 2 * this.shake), Math.round(Math.cos(t * 47) * this.shake));
    drawBackground(g, this.bg, t, this.shafts);
    if (this.level === 2) {
      drawConsole(g, t, this.near === 'console', this.stage !== 'solve', this.consoleOpen);
      const sv = {} as Record<WeightId, ScaleView>;
      for (const id of WEIGHT_IDS) { const s = this.scales[id]; sv[id] = { balance: s.balance, verdict: s.verdict, blocksLanded: s.landed, falling: s.falling, glow: s.glow }; }
      drawBalance(g, t, sv, this.near === 'balance', this.stage !== 'solve');
      drawLedge(g);
      const pv = {} as Record<WeightId, PlateView>;
      for (const id of WEIGHT_IDS) { const p = this.plates[id]; pv[id] = { offset: p.spring.value, lit: p.lit, active: this.stage === 'switches', flash: p.flash, near: this.near === id }; }
      drawPlates(g, t, pv);
    } else {
      drawCircuitry(g, t, this.power);
      if (this.level === 3) drawDiagramMonitor(g, t, this.near === 'panel' && !this.station, this.stage !== 'solve', this.solvedT, this.power);
      else {
        drawLockPanel(g, t, this.near === 'panel' && !this.station, this.lock);
        drawTerminal(g, t, this.near === 'terminal' && !this.station, this.stage === 'final', this.stage === 'exit');
      }
    }
    drawDoor(g, t, this.door.value, this.stage === 'exit', this.near === 'door');

    const b = this.body;
    const feetX = b.x + b.w / 2 - 14;
    if (this.sprite) {
      g.save(); g.translate(Math.round(b.x + b.w / 2), Math.round(b.y + b.h)); g.scale(this.facing, 1);
      g.drawImage(this.sprite, -Math.round(this.sprite.width / 2), -this.sprite.height); g.restore();
    } else {
      drawThanos(g, feetX, b.y + b.h, { facing: this.facing, pose: this.pose(), t, walk: this.walk, expr: this.expression(), glow: this.stage === 'exit' || this.phase === 'complete' ? 1 : this.stage === 'switches' ? 0.6 : 0.2 });
    }
    drawBubbles(g, this.bubbles);
    drawFlood(g, t, this.flood);
    g.restore();
    drawPowerDown(g, this.powerDown);

    if (this.phase === 'playing' || this.phase === 'paused') drawWarning(g, t, this.timer.remaining());
    if (this.flash > 0) { g.globalAlpha = Math.min(0.6, this.flash); g.fillStyle = P.pale; g.fillRect(0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1; }
    if (this.phase === 'paused') { g.globalAlpha = 0.5; g.fillStyle = P.abyss; g.fillRect(0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1; }

    if (this.portrait && (t - this.portraitT > 1 / 15 || t < this.portraitT)) {
      this.portraitT = t;
      drawPortrait(this.portrait, this.expression(), t, this.stage === 'exit' || this.phase === 'complete' ? 1 : this.stage === 'switches' ? 0.6 : 0.2);
    }
  }

  private snapshot(): Snapshot {
    const verdicts = {} as Record<WeightId, WeightVerdict | 'unknown'>;
    for (const id of WEIGHT_IDS) verdicts[id] = this.scales[id].verdict;
    return {
      level: this.level, station: this.station,
      phase: this.phase, stage: this.stage,
      remainingMs: Math.round(this.timer.remaining() / 100) * 100,
      expression: this.expression(), near: this.near, consoleOpen: this.consoleOpen, weighing: this.weighing, verdicts,
      switchProgress: this.seq.progress.slice(), message: this.message, hintsUsed: this.hintsUsed, bag: this.bag,
      showFailure: this.phase === 'failed' && this.failT > 2.4,
      showComplete: this.phase === 'complete' && this.completeT > 1.8,
      stats: { timeMs: this.finalTime, totalMs: this.timer.elapsed(), hints: this.hintsUsed, wrongSubmissions: this.wrongSubmissions, wrongSwitches: this.wrongSwitches },
    };
  }

  private emit(force: boolean) {
    const s = this.snapshot();
    const sig = JSON.stringify(s);
    if (force || sig !== this.lastSig) { this.lastSig = sig; this.opts.onChange(s); }
  }
}

/** Exposed for tests / debugging. */
export const ENGINE_FACTS = { truth: TRUTH, ledgeHeight: FLOOR_Y - LEDGE.y, overlaps };
