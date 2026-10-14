/* ============================================================================
   VioletEngine — fixed 60 Hz simulation (identical physics on any monitor),
   input, rendering, and a small snapshot for the React overlays.
   ============================================================================ */
import type { VioletAudio } from './audio';
import { H, W } from './config';
import { VioletGame, type State } from './logic';
import { Renderer } from './render';

export interface Snapshot { state: State; overReason: string; lives: number; ammo: number; drones: number; timeLeft: number; wonT: number }

const STEP = 1 / 60;
const isTyping = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

export class VioletEngine {
  readonly game: VioletGame;
  private renderer: Renderer;
  private raf = 0; private last = 0; private acc = 0; private lastSig = '';
  private mouse = { x: W / 2, y: H / 2 };

  constructor(private canvas: HTMLCanvasElement, private audio: VioletAudio, private onChange: (s: Snapshot) => void, private onMute: () => void) {
    canvas.width = W; canvas.height = H;
    this.game = new VioletGame((s, v) => audio.play(s, v));
    this.renderer = new Renderer(canvas.getContext('2d')!);
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onKey, true);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onKey, true);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
  }

  /* ---------- actions used by the React overlays ---------- */
  start() { this.audio.init(); this.audio.musicOn(); this.game.start(); this.emit(true); }
  restart() { this.start(); }
  pause() { if (this.game.state === 'play') { this.game.state = 'pause'; this.emit(true); } }
  resume() { if (this.game.state === 'pause') { this.game.state = 'play'; this.last = performance.now(); this.emit(true); } }
  toMenu() { this.game.reset(); this.game.state = 'menu'; this.emit(true); }
  showRules(on: boolean) { if (this.game.state === 'menu' || this.game.state === 'rules') { this.game.state = on ? 'rules' : 'menu'; this.emit(true); } }

  /* ---------- input ---------- */
  private onBlur = () => { const i = this.game.input; i.left = i.right = i.jump = false; };
  private onKey = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    const down = e.type === 'keydown', k = e.key.toLowerCase(), i = this.game.input;
    if (['a', 'arrowleft'].includes(k)) i.left = down;
    else if (['d', 'arrowright'].includes(k)) i.right = down;
    else if (['w', 'arrowup', ' '].includes(k)) i.jump = down;
    else if (!down) return;
    else if (k === 'escape') { if (this.game.state === 'play') this.pause(); else if (this.game.state === 'pause') this.resume(); else if (this.game.state === 'rules') this.showRules(false); }
    else if (k === 'r' && (this.game.state === 'over' || this.game.state === 'won')) this.restart();
    else if (k === 'm' && !e.repeat) this.onMute();
    else if (k === 'enter' && this.game.state === 'menu') this.start();
    else return;
    if (['arrowleft', 'arrowright', 'arrowup', ' '].includes(k)) e.preventDefault();   // no page scroll / button re-click
  };
  private toCanvas(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }
  private onPointerMove = (e: PointerEvent) => { this.mouse = this.toCanvas(e); this.game.aimPoint = this.mouse; };
  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.mouse = this.toCanvas(e); this.game.aimPoint = this.mouse;
    if (this.game.state === 'play') { this.game.refreshAim(); this.game.fire(); }
  };

  /* ---------- loop ---------- */
  private frame = (now: number) => {
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0;
    this.last = now;
    if (this.game.state !== 'pause') {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 8) { this.game.update(STEP); this.acc -= STEP; steps++; }
      if (steps === 8) this.acc = 0;
    }
    this.renderer.draw(this.game, dt, this.game.state === 'play', this.mouse);
    this.emit(false);
    this.raf = requestAnimationFrame(this.frame);
  };

  private emit(force: boolean) {
    const g = this.game;
    const s: Snapshot = { state: g.state, overReason: g.overReason, lives: g.lives, ammo: g.ammo, drones: g.dronesLeft, timeLeft: Math.ceil(g.timeLeft), wonT: g.wonT > 1.2 ? 1 : 0 };
    const sig = JSON.stringify(s);
    if (force || sig !== this.lastSig) { this.lastSig = sig; this.onChange(s); }
  }
}
