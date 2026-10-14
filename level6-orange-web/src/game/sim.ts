/* ORANGE simulation — typing & scoring, the procedural dancer, stage state and the game state machine. Mirrors orange.py. */
import {
  BEAT, C, CHALLENGE, CHOREO, DANCER_X, DOOR_T, ENTRY_T, FA, GROUND, HIPW, MAX_PARTICLES, POSES, SH, SHW, TARGET_ACC, TARGET_WPM, TH, TORSO, UA,
  VICTORY_DANCE_T, SENTENCES, TYPABLE, type Pose, type RGB,
} from './config';

export type State = 'TITLE' | 'RULES' | 'READY' | 'PLAYING' | 'PAUSED' | 'VICTORY_DANCE' | 'DOOR_OPENING' | 'PORTAL_ENTRY' | 'TRANSITION_SCREEN' | 'GAME_OVER';
export type Sound = 'wrong' | 'word' | 'cheer' | 'pace' | 'tick' | 'go' | 'fail' | 'win' | 'slide' | 'portal' | 'snap' | 'click';
export type Expr = 'focus' | 'smug' | 'grin' | 'wince' | 'exhausted' | 'victory';
type Pt = [number, number];

/** One sentence at a time, typed character by character (spaces count, as in standard WPM).
 *  Accuracy counts every keystroke ever made; WPM counts kept correct characters / 5.
 *  Sentences come from a shuffled deck that survives restarts, so none repeats until all have been used. */
export class Typing {
  correct = 0; wrong = 0; net = 0; words = 0; sentences = 0; streak = 0; best = 0; done = ''; text = ''; pos = 0;
  private deck: string[] = []; private last: string | null = null;
  constructor(private rnd: () => number = Math.random) { this.reset(); }
  reset() { this.correct = this.wrong = this.net = this.words = this.sentences = this.streak = this.best = 0; this.done = ''; this.text = this.pick(); this.pos = 0; }
  pick() {
    if (!this.deck.length) {
      this.deck = [...SENTENCES];
      for (let i = this.deck.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]; }
      if (this.deck[this.deck.length - 1] === this.last) this.deck.unshift(this.deck.pop()!);   // never the same line twice in a row
    }
    this.last = this.deck.pop()!;
    return this.last;
  }
  get attempts() { return this.correct + this.wrong; }
  accuracy() { return this.attempts === 0 ? 100 : (this.correct / this.attempts) * 100; }
  wpm(elapsed: number) { return elapsed <= 0 ? 0 : (this.net * 12) / elapsed; }
  press(ch: string): 'correct' | 'word' | 'sentence' | 'wrong' {
    if (ch === this.text[this.pos]) {
      this.correct++; this.net++; this.pos++; this.streak++; this.best = Math.max(this.best, this.streak);
      if (this.pos === this.text.length) { this.words++; this.sentences++; this.done = this.text; this.text = this.pick(); this.pos = 0; return 'sentence'; }
      if (ch === ' ') { this.words++; return 'word'; }
      return 'correct';
    }
    this.wrong++; this.streak = 0;
    return 'wrong';
  }
  backspace() {                                                   // finished sentences can never be erased
    if (this.pos === 0) return false;
    this.pos--; this.net--; if (this.text[this.pos] === ' ') this.words--;
    return true;
  }
}

export class Dancer {
  cur: Pose = { ...POSES.idle }; target: Pose = { ...POSES.idle };
  hold = 0; kick = 0; spin = 0; spinV = 0; shake = 0; choreo = 0;
  x = DANCER_X; scaleK = 1; expr: Expr = 'smug'; exprT = 0; shades = false; mode: 'groove' | 'pose' | 'walk' = 'groove'; baseExpr: Expr = 'focus';
  reset() { Object.assign(this, new Dancer()); }
  stepMove() { this.target = { ...POSES[CHOREO[this.choreo % CHOREO.length]] }; this.choreo++; this.hold = 0.42; this.kick = 1; }
  wordAccent(n: number) {
    if (n % 3 === 0) { this.target = { ...POSES.jump }; this.kick = 2; }
    else { this.spinV = (Math.PI * 2) / 0.45; this.target = { ...POSES.up }; this.kick = 1.6; }
    this.hold = 0.5; this.say('grin', 0.5);
  }
  miss() { this.target = { ...POSES.stumble }; this.hold = 0.32; this.shake = 1; this.say('wince', 0.5); }
  say(e: Expr, t: number) { this.expr = e; this.exprT = t; }
  pose(name: string, mode?: 'pose' | 'walk') { this.target = { ...POSES[name] }; this.hold = 1e9; if (mode) this.mode = mode; }

  update(dt: number, t: number, active = true) {
    this.hold -= dt; this.exprT -= dt;
    if (this.hold <= 0 && this.mode === 'groove') {                     // gentle idle groove on the beat
      const ph = (t / BEAT) * Math.PI, s = Math.sin(ph);
      this.target = { ...POSES.idle, dy: -2 * Math.abs(s), ls: 0.3 + 0.25 * s, rs: 0.3 - 0.25 * s, lean: 0.05 * Math.sin(ph / 2), lk: 0.15 * Math.abs(s), rk: 0.15 * Math.abs(s) };
    }
    const k = 1 - Math.exp(-dt * (active ? 16 : 6));                    // smooth interpolation, never a teleport
    for (const key of Object.keys(this.cur) as (keyof Pose)[]) this.cur[key] += (this.target[key] - this.cur[key]) * k;
    this.kick *= Math.exp(-dt * 9); this.shake *= Math.exp(-dt * 10);
    if (this.spinV) { this.spin += this.spinV * dt; if (this.spin >= Math.PI * 2) { this.spin = 0; this.spinV = 0; } }
  }

  joints() {
    const p = this.cur, sx = this.spinV ? Math.cos(this.spin) : 1, k = this.scaleK;
    const feet = ([[-1, p.lh, p.lk], [1, p.rh, p.rk]] as const).map(([side, h, kn]) => [side * HIPW + side * Math.sin(h) * TH + side * Math.sin(h + kn) * SH, Math.cos(h) * TH + Math.cos(h + kn) * SH]);
    const hipY = GROUND - Math.max(feet[0][1], feet[1][1]) + p.dy - 3 * this.kick;
    const cx = this.x + p.dx + Math.sin(this.shake * 40) * 2 * this.shake;
    const X = (rel: number) => cx + rel * sx * k, Y = (abs: number) => GROUND + (abs - GROUND) * k;
    const neck: Pt = [cx + Math.sin(p.lean) * TORSO, hipY - Math.cos(p.lean) * TORSO];
    const J: Record<string, Pt> = {};
    const perp = [Math.cos(p.lean), Math.sin(p.lean)];
    for (const [side, n] of [[-1, 'l'], [1, 'r']] as const) {
      const sh: Pt = [neck[0] - cx + side * perp[0] * SHW * p.twist, neck[1] + side * perp[1] * SHW * p.twist + 3];
      const a = p[`${n}s`], e = p[`${n}e`];
      const el: Pt = [sh[0] + side * Math.sin(a) * UA, sh[1] + Math.cos(a) * UA];
      const ha: Pt = [el[0] + side * Math.sin(a + e) * FA, el[1] + Math.cos(a + e) * FA];
      const hp: Pt = [side * HIPW * p.twist, hipY], h = p[`${n}h`], kn = p[`${n}k`];
      const knee: Pt = [hp[0] + side * Math.sin(h) * TH, hp[1] + Math.cos(h) * TH];
      const ft: Pt = [knee[0] + side * Math.sin(h + kn) * SH, knee[1] + Math.cos(h + kn) * SH];
      for (const [nm, q] of [['sh', sh], ['el', el], ['ha', ha], ['hp', hp], ['kn', knee], ['ft', ft]] as const) J[n + nm] = [X(q[0]), Y(q[1])];
    }
    J.hip = [X(0), Y(hipY)]; J.neck = [X(neck[0] - cx), Y(neck[1])];
    return { J, sx };
  }
}

export interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; col: RGB; size: number; grav: number; spark: boolean }
export class Particles {
  p: Particle[] = [];
  add(x: number, y: number, vx: number, vy: number, life: number, col: RGB, size = 1, grav = 0, spark = false) { if (this.p.length < MAX_PARTICLES) this.p.push({ x, y, vx, vy, age: 0, life, col, size, grav, spark }); }
  burst(x: number, y: number, n: number, speed: number, cols: readonly RGB[], life: [number, number] = [0.4, 1], grav = 40, spark = false) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random() * 0.7) * speed; this.add(x, y, Math.cos(a) * v, Math.sin(a) * v, life[0] + Math.random() * (life[1] - life[0]), cols[i % cols.length], Math.random() < 0.67 ? 1 : 2, grav, spark); }
  }
  update(dt: number) { for (const q of this.p) { q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.age += dt; } this.p = this.p.filter((q) => q.age < q.life); }
  clear() { this.p = []; }
}

export class OrangeGame {
  state: State = 'TITLE'; t = 0;
  typing: Typing; dancer = new Dancer(); fx = new Particles();
  tiles: number[][] = []; spkOpen = 0; pulse = 0; portalT = 0;
  elapsed = 0; finalWpm = 0; finalAcc = 100; won: boolean | null = null;
  phaseT = 0; energy = 0; hype = 0; flash = 0; toasts: { text: string; left: number }[] = []; lastTick = 6; paceHit = false;
  wordPop: { word: string; t: number } | null = null; errT = 0; dust = 0; shake = 0;
  constructor(private sfx: (s: Sound, vol?: number) => void = () => {}, private keyNote: (i: number) => void = () => {}, private music: (cmd: 'on' | 'pause' | 'resume' | 'stop') => void = () => {}, rnd: () => number = Math.random) {
    this.typing = new Typing(rnd); this.reset();
  }

  /** Full restart to the ready screen: timer, stats, word, dancer, stage, particles, door, pause, result. */
  reset() {
    this.typing.reset(); this.dancer.reset(); this.fx.clear();
    this.tiles = Array.from({ length: 5 }, () => new Array(8).fill(0)); this.spkOpen = 0; this.pulse = 0; this.portalT = 0;
    this.elapsed = 0; this.finalWpm = 0; this.finalAcc = 100; this.won = null;
    this.phaseT = 0; this.energy = 0; this.hype = 0; this.flash = 0; this.toasts = []; this.lastTick = 6; this.paceHit = false;
    this.wordPop = null; this.errT = 0; this.dust = 0; this.shake = 0;
    this.music('stop');
  }

  keyEnter() {
    if (this.state === 'TITLE') { this.sfx('click'); this.state = 'READY'; }
    else if (this.state === 'READY') this.begin();
    else if (this.state === 'RULES') this.state = 'TITLE';
  }
  begin() { this.reset(); this.state = 'PLAYING'; this.elapsed = 0; this.sfx('go'); this.music('on'); this.toast('GO!'); }
  keyEscape() {
    if (this.state === 'PLAYING') { this.state = 'PAUSED'; this.music('pause'); }
    else if (this.state === 'PAUSED') { this.state = 'PLAYING'; this.music('resume'); }
    else if (this.state === 'RULES') this.state = 'TITLE';
  }
  keyR() { if (this.state === 'GAME_OVER' || this.state === 'TRANSITION_SCREEN') { this.reset(); this.state = 'READY'; } }
  keyBackspace() { if (this.state === 'PLAYING' && this.typing.backspace()) { this.dancer.target = { ...POSES.idle }; this.dancer.hold = 0.15; } }
  keyChar(raw: string) {
    if (this.state !== 'PLAYING') return;
    const ch = raw.toUpperCase();
    if (ch.length !== 1 || !TYPABLE.has(ch)) return;
    const tp = this.typing, d = this.dancer, res = tp.press(ch);
    if (res === 'wrong') { d.miss(); this.errT = 0.35; this.sfx('wrong', 0.6); this.energy = Math.max(0, this.energy - 0.15); return; }
    this.keyNote(tp.streak);
    d.stepMove(); this.pulse = 0.6; this.energy = Math.min(1, this.energy + 0.05); this.hype = 1;
    for (let i = 0; i < 2; i++) this.tiles[Math.floor(Math.random() * 5)][Math.floor(Math.random() * 8)] = 1;
    this.fx.burst(d.x, GROUND - 40, 3, 50, [C.AMBER, C.HI, C.SPOT], [0.2, 0.5], 60, true);
    if (res === 'word') {
      d.wordAccent(tp.words); this.sfx('word', 0.4); this.pulse = 1;
      this.fx.burst(d.x, GROUND - 50, 8, 100, [C.DOOR, C.LAMBER, C.AMBER], [0.3, 0.8], 80, true);
    } else if (res === 'sentence') {                              // the biggest accent: jump + spin + cheer
      d.target = { ...POSES.jump }; d.kick = 2.4; d.hold = 0.6; d.spinV = (Math.PI * 2) / 0.5; d.say('grin', 0.8);
      this.sfx('word', 0.7); this.sfx('cheer', 0.45); this.pulse = 1;
      this.wordPop = { word: tp.done, t: 0 };
      this.fx.burst(d.x, GROUND - 50, 24, 140, [C.DOOR, C.LAMBER, C.AMBER], [0.4, 1], 80, true);
    }
    d.shades = tp.streak >= 12 || this.liveWpm() >= TARGET_WPM;
  }
  liveWpm() { return this.typing.wpm(Math.max(1, this.elapsed)); }
  toast(text: string) { this.toasts.push({ text, left: 1.2 }); }

  step(dt: number) {
    this.t += dt;
    this.fx.update(dt); this.pulse *= Math.exp(-dt * 6); this.hype *= Math.exp(-dt * 4); this.errT -= dt; this.flash = Math.max(0, this.flash - dt);
    for (const row of this.tiles) for (let i = 0; i < 8; i++) row[i] *= Math.exp(-dt * 3);
    this.toasts = this.toasts.map((x) => ({ ...x, left: x.left - dt })).filter((x) => x.left > 0);
    if (this.wordPop) { this.wordPop.t += dt; if (this.wordPop.t >= 0.6) this.wordPop = null; }
    const st = this.state, d = this.dancer;
    d.update(dt, this.t, st !== 'GAME_OVER');
    if (st === 'TITLE' || st === 'READY' || st === 'RULES') d.baseExpr = 'smug';
    if (st === 'PAUSED') return;
    if (st === 'PLAYING') {
      this.elapsed = Math.min(CHALLENGE, this.elapsed + dt);
      const left = CHALLENGE - this.elapsed, sec = Math.ceil(left);
      if (sec < this.lastTick && sec <= 5 && left > 0) { this.lastTick = sec; this.sfx('tick', 0.5); }
      this.energy *= Math.exp(-dt * 0.3);
      if (!this.paceHit && this.elapsed > 3 && this.liveWpm() >= TARGET_WPM && this.typing.accuracy() >= TARGET_ACC) { this.paceHit = true; this.sfx('pace', 0.5); this.toast('40 WPM PACE!'); }
      d.baseExpr = this.typing.streak >= 5 ? 'smug' : 'focus';
      if (this.elapsed >= CHALLENGE) this.finish();
    } else if (st === 'VICTORY_DANCE') {
      this.phaseT += dt;
      if (Math.random() < 0.3) this.fx.burst(60 + Math.random() * 240, 80 + Math.random() * 120, 8, 90, [C.DOOR, C.LAMBER, C.AMBER, C.SPOT], [0.5, 1], 50, true);
      for (const row of this.tiles) for (let i = 0; i < 8; i++) row[i] = Math.max(row[i], 0.5 + 0.5 * Math.sin(this.t * 8 + i));
      this.dust = Math.min(1, Math.max(0, (this.phaseT - 0.9) / 1.5));
      if (this.dust > 0 && Math.random() < 0.6) this.fx.add(30 + Math.random() * 260, 135 + Math.random() * 33, 20 + Math.random() * 30, -25 + Math.random() * 20, 1.2, [C.BURNT, C.TERRA, C.DARK][Math.floor(Math.random() * 3)], 1, -5);
      if (this.phaseT >= VICTORY_DANCE_T) { this.state = 'DOOR_OPENING'; this.phaseT = 0; this.sfx('slide', 0.7); }
    } else if (st === 'DOOR_OPENING') {
      this.phaseT += dt; const p = Math.min(1, this.phaseT / (DOOR_T * 0.8));
      this.spkOpen = p * p * (3 - 2 * p); this.shake = p < 1 ? 2.5 * (1 - p) : 0; this.portalT += dt * p;
      if (Math.random() < 0.4) this.fx.burst(380, 100 + Math.random() * 145, 3, 60, [C.DOOR, C.LAMBER], [0.3, 0.7], 0, true);
      if (this.phaseT >= DOOR_T) { this.state = 'PORTAL_ENTRY'; this.phaseT = 0; this.sfx('portal', 0.7); d.pose('idle', 'walk'); }
    } else if (st === 'PORTAL_ENTRY') {
      this.phaseT += dt; this.portalT += dt;
      const p = Math.min(1, this.phaseT / (ENTRY_T * 0.85)), walk = Math.sin(this.phaseT * 12);
      d.x = DANCER_X + (380 - DANCER_X) * Math.min(1, p * 1.25);
      d.target = { ...POSES.idle, lh: 0.3 * walk, rh: -0.3 * walk, ls: 0.4 - 0.4 * walk, rs: 0.4 + 0.4 * walk, dy: -Math.abs(walk) * 2 };
      d.scaleK = Math.max(0, 1 - Math.max(0, p - 0.75) * 4);
      if (Math.random() < 0.6) { const a = Math.random() * Math.PI * 2, sx = 380 + Math.cos(a) * 60, sy = 172 + Math.sin(a) * 80; this.fx.add(sx, sy, (380 - sx) * 1.5, (172 - sy) * 1.5, 0.6, [C.DOOR, C.LAMBER, C.HI][Math.floor(Math.random() * 3)]); }
      if (this.phaseT >= ENTRY_T) { this.state = 'TRANSITION_SCREEN'; this.phaseT = 0; this.sfx('snap'); this.flash = 0.6; }
    } else if (st === 'TRANSITION_SCREEN') { this.phaseT += dt; this.portalT += dt; }
    else if (st === 'GAME_OVER') this.phaseT += dt;
  }

  /** Time is up: freeze the final result (denominator exactly 60 s) and judge speed AND accuracy. */
  finish() {
    const tp = this.typing;
    this.elapsed = CHALLENGE; this.finalWpm = tp.wpm(CHALLENGE); this.finalAcc = tp.accuracy();
    this.won = tp.attempts > 0 && this.finalWpm >= TARGET_WPM && this.finalAcc >= TARGET_ACC;
    this.phaseT = 0;
    if (this.won) {
      this.state = 'VICTORY_DANCE'; this.dancer.pose('victory', 'pose'); this.dancer.shades = true; this.dancer.say('victory', 1e9);
      this.sfx('win', 0.8); this.sfx('snap', 0.8); this.sfx('cheer', 0.6);
      this.fx.burst(this.dancer.x, GROUND - 60, 50, 160, [C.DOOR, C.LAMBER, C.AMBER, C.SPOT], [0.6, 1.2], 60, true);
    } else {
      this.state = 'GAME_OVER'; this.dancer.pose('collapse', 'pose'); this.dancer.say('exhausted', 1e9);
      this.music('stop'); this.sfx('fail', 0.8);
    }
  }
}
