/* YellowEngine — fixed 60 Hz simulation, keyboard + mouse, rendering, snapshot for React. */
import type { YellowAudio } from './audio';
import { H, W } from './config';
import { Renderer } from './render';
import { YellowGame, type State } from './sim';

export interface Snapshot { state: State; won: boolean }
const STEP = 1 / 60;

export class YellowEngine {
  readonly game: YellowGame; readonly r: Renderer;
  private raf = 0; private last = 0; private acc = 0; private sig = '';
  constructor(private canvas: HTMLCanvasElement, private audio: YellowAudio, private onChange: (s: Snapshot) => void, private onMute: () => void, private onExit: () => void) {
    canvas.width = W; canvas.height = H;
    this.game = new YellowGame((s, v) => audio.play(s, v), (on) => audio.musicOn(on), (on) => audio.charge(on));
    this.r = new Renderer(canvas.getContext('2d')!);
    window.addEventListener('keydown', this.onKey, true); window.addEventListener('keyup', this.onKey, true); window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('mousemove', this.onMove); canvas.addEventListener('mousedown', this.onClick); canvas.addEventListener('mouseleave', this.onLeave);
    this.raf = requestAnimationFrame(this.frame);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey, true); window.removeEventListener('keyup', this.onKey, true); window.removeEventListener('blur', this.onBlur);
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
    const g = this.game; this.audio.init();
    if (k !== 'mute') this.audio.play('click');
    if (k === 'start') g.start();
    else if (k === 'rules') g.state = 'RULES';
    else if (k === 'back') g.state = 'TITLE';
    else if (k === 'controls') g.openControls();
    else if (k === 'close') g.closeControls();
    else if (k === 'exit') { g.reset(); g.state = 'TITLE'; this.audio.musicOn(false); this.onExit(); }
    else if (k === 'mute') this.onMute();
    this.emit(true);
  }
  private onBlur = () => { Object.assign(this.game.held, { left: false, right: false, charge: false }); };
  /** Held keys (movement, charge) are tracked continuously; presses (attacks, jump, dodge, flash) are edge-triggered once. */
  private onKey = (e: KeyboardEvent) => {
    const down = e.type === 'keydown', k = e.key.toLowerCase(), h = this.game.held;
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
    if (k === 'a' || k === 'arrowleft') h.left = down;
    else if (k === 'd' || k === 'arrowright') h.right = down;
    else if (k === 'l') h.charge = down;
    if (!down || e.repeat) return;
    this.audio.init();
    if (k === 'm') { this.onMute(); return; }
    this.game.keyDown(k);
    this.emit(true);
  };
  frame = (now: number) => {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0; this.last = now;
    this.acc += dt; let n = 0;
    while (this.acc >= STEP && n < 6) { this.game.step(); this.acc -= STEP; n++; }
    if (n === 6) this.acc = 0;
    this.r.muted = this.audio.muted;
    this.r.draw(this.game);
    this.emit(false);
    this.raf = requestAnimationFrame(this.frame);
  };
  private emit(force: boolean) {
    const s: Snapshot = { state: this.game.state, won: this.game.state === 'VICTORY' };
    const sig = JSON.stringify(s); if (force || sig !== this.sig) { this.sig = sig; this.onChange(s); }
  }
}
