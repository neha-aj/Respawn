/* IndigoEngine — fixed 60 Hz simulation, keyboard input, rendering, snapshot for the React screens. */
import type { IndigoAudio } from './audio';
import { H, W } from './config';
import { Renderer } from './render';
import { IndigoGame, type State } from './sim';

export interface Snapshot { state: State; reason: string; lives: number; shots: number; timeLeft: number; won: boolean }
const STEP = 1 / 60;

export class IndigoEngine {
  readonly game: IndigoGame;
  private r: Renderer; private raf = 0; private last = 0; private acc = 0; private sig = '';
  constructor(canvas: HTMLCanvasElement, private audio: IndigoAudio, private onChange: (s: Snapshot) => void, private onMute: () => void) {
    canvas.width = W; canvas.height = H;
    this.game = new IndigoGame((s, v) => audio.play(s, v));
    this.r = new Renderer(canvas.getContext('2d')!);
    window.addEventListener('keydown', this.onKey, true); window.addEventListener('keyup', this.onKey, true); window.addEventListener('blur', this.onBlur);
    this.raf = requestAnimationFrame(this.frame);
  }
  destroy() { cancelAnimationFrame(this.raf); window.removeEventListener('keydown', this.onKey, true); window.removeEventListener('keyup', this.onKey, true); window.removeEventListener('blur', this.onBlur); }

  start() { this.audio.init(); this.audio.musicOn(); this.game.start(); this.emit(true); }
  restart() { this.start(); }
  pause() { if (this.game.state === 'play') { this.game.state = 'pause'; this.audio.engine(false); this.emit(true); } }
  resume() { if (this.game.state === 'pause') { this.game.state = 'play'; this.last = performance.now(); this.emit(true); } }
  toMenu() { this.game.reset(); this.game.state = 'menu'; this.audio.engine(false); this.emit(true); }
  showRules(on: boolean) { if (this.game.state === 'menu' || this.game.state === 'rules') { this.game.state = on ? 'rules' : 'menu'; this.emit(true); } }

  private onBlur = () => Object.assign(this.game.controls, { thrust: false, reverse: false, left: false, right: false });
  private onKey = (e: KeyboardEvent) => {
    const down = e.type === 'keydown', k = e.key.toLowerCase(), c = this.game.controls, st = this.game.state;
    const map: Record<string, keyof typeof c> = { w: 'thrust', arrowup: 'thrust', s: 'reverse', arrowdown: 'reverse', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right' };
    if (k in map) { c[map[k]] = down; e.preventDefault(); return; }
    if (!down || e.repeat) { if (k === ' ') e.preventDefault(); return; }
    if (k === ' ') { e.preventDefault(); if (st === 'play') this.game.fire(); else if (st === 'menu') this.start(); }
    else if (k === 'enter' && st === 'menu') this.start();
    else if (k === 'r' && ['play', 'over', 'won', 'pause'].includes(st)) this.restart();
    else if (k === 'p') { if (st === 'play') this.pause(); else if (st === 'pause') this.resume(); }
    else if (k === 'escape') { if (st === 'play') this.pause(); else if (st === 'pause') this.resume(); else if (st === 'rules') this.showRules(false); }
    else if (k === 'm') this.onMute();
  };

  private frame = (now: number) => {
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0; this.last = now;
    if (this.game.state !== 'pause') {
      this.acc += dt; let n = 0;
      while (this.acc >= STEP && n < 8) { this.game.step(STEP); this.acc -= STEP; n++; }
      if (n === 8) this.acc = 0;
    }
    this.audio.engine(this.game.state === 'play' && this.game.controls.thrust);
    this.r.draw(this.game, dt);
    this.emit(false);
    this.raf = requestAnimationFrame(this.frame);
  };
  private emit(force: boolean) {
    const g = this.game, s: Snapshot = { state: g.state, reason: g.reason, lives: g.lives, shots: g.shots, timeLeft: Math.ceil(g.timeLeft), won: g.state === 'won' && g.wonT > 1.4 };
    const sig = JSON.stringify(s); if (force || sig !== this.sig) { this.sig = sig; this.onChange(s); }
  }
}
