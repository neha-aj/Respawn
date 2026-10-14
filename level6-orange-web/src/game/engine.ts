/* OrangeEngine — fixed 60 Hz simulation, keyboard + mouse input, rendering, snapshot for React. */
import type { OrangeAudio } from './audio';
import { H, W } from './config';
import { Renderer } from './render';
import { OrangeGame, type State } from './sim';

export interface Snapshot { state: State; won: boolean }
const STEP = 1 / 60;

export class OrangeEngine {
  readonly game: OrangeGame;
  readonly r: Renderer;
  private raf = 0; private last = 0; private acc = 0; private sig = '';
  constructor(private canvas: HTMLCanvasElement, private audio: OrangeAudio, private onChange: (s: Snapshot) => void, private onMute: () => void, private onExit: () => void) {
    canvas.width = W; canvas.height = H;
    this.game = new OrangeGame((s, v) => audio.play(s, v), (i) => audio.key(i), (c) => audio.musicCmd(c));
    this.r = new Renderer(canvas.getContext('2d')!);
    window.addEventListener('keydown', this.onKey, true);
    canvas.addEventListener('mousemove', this.onMove); canvas.addEventListener('mousedown', this.onClick); canvas.addEventListener('mouseleave', this.onLeave);
    this.raf = requestAnimationFrame(this.frame);
  }
  destroy() {
    cancelAnimationFrame(this.raf); window.removeEventListener('keydown', this.onKey, true);
    this.canvas.removeEventListener('mousemove', this.onMove); this.canvas.removeEventListener('mousedown', this.onClick); this.canvas.removeEventListener('mouseleave', this.onLeave);
  }

  private pos(e: MouseEvent) { const b = this.canvas.getBoundingClientRect(); return { x: ((e.clientX - b.left) / b.width) * W, y: ((e.clientY - b.top) / b.height) * H }; }
  private onMove = (e: MouseEvent) => { this.r.mouse = this.pos(e); };
  private onLeave = () => { this.r.mouse = null; };
  private onClick = (e: MouseEvent) => {
    const p = this.pos(e);
    for (const [k, b] of Object.entries(this.r.buttons)) if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { this.action(k); break; }
  };
  action(k: string) {
    const g = this.game;
    this.audio.init();
    if (k !== 'mute') this.audio.play('click');
    if (k === 'start') g.state = 'READY';
    else if (k === 'rules') g.state = 'RULES';
    else if (k === 'back') g.state = 'TITLE';
    else if (k === 'resume') g.keyEscape();
    else if (k === 'restart') { g.reset(); g.state = 'READY'; }
    else if (k === 'exit') { if (g.state === 'PAUSED') { g.reset(); g.state = 'TITLE'; } this.onExit(); }
    else if (k === 'mute') this.onMute();
    this.emit(true);
  }

  /** Keydown fires once per press — browser key-repeat events are ignored. */
  private onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const g = this.game, st = g.state, k = e.key;
    if (k === 'Backspace' || k === ' ' || k === 'Enter' || k === 'Escape' || k.length === 1) e.preventDefault();
    if (e.repeat) return;
    this.audio.init();
    if (k === 'Escape') g.keyEscape();
    else if (k === 'Enter') g.keyEnter();
    else if (k === 'Backspace') g.keyBackspace();
    else if (st === 'PLAYING') g.keyChar(k);
    else if (k.toLowerCase() === 'r') g.keyR();
    else if (k.toLowerCase() === 'h' && (st === 'TITLE' || st === 'RULES')) g.state = st === 'TITLE' ? 'RULES' : 'TITLE';
    else if (k.toLowerCase() === 'm') this.onMute();
    this.emit(true);
  };

  frame = (now: number) => {
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0; this.last = now;
    this.acc += dt; let n = 0;
    while (this.acc >= STEP && n < 8) { this.game.step(STEP); this.acc -= STEP; n++; }
    if (n === 8) this.acc = 0;
    this.r.muted = this.audio.muted;
    this.r.draw(this.game);
    this.emit(false);
    this.raf = requestAnimationFrame(this.frame);
  };
  private emit(force: boolean) {
    const s: Snapshot = { state: this.game.state, won: this.game.state === 'TRANSITION_SCREEN' };
    const sig = JSON.stringify(s); if (force || sig !== this.sig) { this.sig = sig; this.onChange(s); }
  }
}
