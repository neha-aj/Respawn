/* GreenEngine — fixed 60 Hz simulation, keyboard + mouse input, rendering, snapshot for the React screens. */
import type { GreenAudio } from './audio';
import { H, TIME_LIMIT, W } from './config';
import { FONT, Renderer } from './render';
import { GreenGame, type State } from './sim';

export interface Snapshot { state: State; cause: string; lives: number; runes: number; timeLeft: number; won: boolean }
const STEP = 1 / 60;

export class GreenEngine {
  readonly game: GreenGame;
  private r: Renderer; private raf = 0; private last = 0; private acc = 0; private sig = '';
  private mouse: { x: number; y: number } | null = null;
  constructor(private canvas: HTMLCanvasElement, private audio: GreenAudio, private onChange: (s: Snapshot) => void, private onMute: () => void) {
    canvas.width = W; canvas.height = H;
    this.game = new GreenGame((s, v) => audio.play(s, v));
    this.r = new Renderer(canvas.getContext('2d')!);
    void document.fonts?.load(`16px ${FONT}`).then(() => this.r.clearTextCache());
    window.addEventListener('keydown', this.onKey, true); window.addEventListener('keyup', this.onKey, true); window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('mousemove', this.onMouse);
    this.raf = requestAnimationFrame(this.frame);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey, true); window.removeEventListener('keyup', this.onKey, true); window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('mousemove', this.onMouse);
  }

  start() { this.audio.init(); this.audio.musicOn(); this.game.begin(); this.emit(true); }
  restart() { this.game.restart(); this.emit(true); }
  pause() { if (this.game.state === 'PLAYING') { this.game.state = 'PAUSED'; this.emit(true); } }
  resume() { if (this.game.state === 'PAUSED') { this.game.state = 'PLAYING'; this.last = performance.now(); this.emit(true); } }
  showRules(on: boolean) { if (this.game.state === 'TITLE' || this.game.state === 'RULES') { this.game.state = on ? 'RULES' : 'TITLE'; this.emit(true); } }

  private onBlur = () => Object.assign(this.game.ctrl, { up: false, down: false, left: false, right: false, sprint: false });
  private onMouse = (e: MouseEvent) => {
    const b = this.canvas.getBoundingClientRect();
    this.mouse = { x: ((e.clientX - b.left) / b.width) * W, y: ((e.clientY - b.top) / b.height) * H };
  };
  private onKey = (e: KeyboardEvent) => {
    const down = e.type === 'keydown', k = e.key.toLowerCase(), c = this.game.ctrl, st = this.game.state;
    const map: Record<string, keyof typeof c> = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', shift: 'sprint' };
    if (k in map) { c[map[k]] = down; if (k.startsWith('arrow')) e.preventDefault(); return; }
    if (!down || e.repeat) return;
    if (k === 'enter') { if (st === 'TITLE') this.start(); else if (st === 'RULES') this.showRules(false); }
    else if (k === 'r') this.restart();
    else if (k === 'h') { if (st === 'TITLE') this.showRules(true); else if (st === 'RULES') this.showRules(false); }
    else if (k === 'p' || k === 'escape') { if (st === 'PLAYING') this.pause(); else if (st === 'PAUSED') this.resume(); else if (st === 'RULES') this.showRules(false); }
    else if (k === 'm') this.onMute();
  };

  /** Mouse aim: the flashlight points from Thanos (on screen) toward the cursor. */
  private aim() {
    const g = this.game, cam = this.r.cam;
    if (!this.mouse || g.state !== 'PLAYING') return;
    const dx = this.mouse.x + cam.x - g.player.pos.x, dy = this.mouse.y + cam.y - g.player.pos.y;
    if (dx * dx + dy * dy > 4) g.player.aim = Math.atan2(dy, dx);
  }

  frame = (now: number) => {
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0; this.last = now;
    this.aim();
    if (this.game.state !== 'PAUSED') {
      this.acc += dt; let n = 0;
      while (this.acc >= STEP && n < 8) { this.game.step(STEP); this.acc -= STEP; n++; }
      if (n === 8) this.acc = 0;
    }
    this.r.draw(this.game);
    this.emit(false);
    this.raf = requestAnimationFrame(this.frame);
  };
  private emit(force: boolean) {
    const g = this.game;
    const s: Snapshot = { state: g.state, cause: g.cause, lives: g.lives, runes: g.collected.size, timeLeft: Math.ceil(g.state === 'TITLE' ? TIME_LIMIT : g.timeLeft), won: g.state === 'VICTORY' && g.victoryT > 1.2 };
    const sig = JSON.stringify(s); if (force || sig !== this.sig) { this.sig = sig; this.onChange(s); }
  }
}
