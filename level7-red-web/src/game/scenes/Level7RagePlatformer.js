/* RED: a rage platformer with original traps, a sarcastic narrator, a Fever meter, four rooms and an emotional ending.
 * Thanos (in his long coat) is the player. Phaser 3 Arcade Physics, 1280 × 720, procedural red-only graphics. */
import Phaser from 'phaser';
import LevelBase, { FONT } from '../LevelBase.js';
import { approach, clamp, rectsOverlap } from '../utils/math.js';
import { drawBackdrop, drawDashedRect, drawDoor, drawPlatform, drawSpikes, drawThanos } from '../art.js';
import {
  COLORS, ControlGlitch, ENDING_CARDS, JumpAssist, LEVEL7_DATA, MERCY_DEATHS, NARRATOR, Narrator, PATIENCE_MESSAGE, PHYS, PatienceTimer,
  RED_FROM_START, TEXT, TEXT_DIM, TEXT_HOT, deathLine, doorRect, feverOf, gravityAt, moverStart, sineY, stepMover, vignetteAlpha,
} from '../redLogic.js';

export { LEVEL7_DATA, NARRATOR, RED_FROM_START, fleeVx, jumpHeight, reflectVx, sineY } from '../redLogic.js';

const DEATH_ANIM = 0.6, IDLE_LINE = 20;

export default class Level7RagePlatformer extends LevelBase {
  constructor() { super('Level7RagePlatformer'); }

  init() {
    this._completed = false;
    this.roomIndex = RED_FROM_START ? 0 : 0;
    this.totalDeaths = 0; this.roomDeaths = [0, 0, 0, 0]; this.mercy = [false, false, false, false];
    this.dying = 0; this.paused = false; this.ending = false; this.runTime = 0; this.idleT = 0; this.idleSaid = false;
    this.glitch = new ControlGlitch(3); this.patience = new PatienceTimer(7.0); this.narrator = new Narrator(3.5); this.assist = new JumpAssist();
    this.movers = []; this.hiddenState = []; this.transitioning = false; this.shards = []; this.facing = 1; this.walkPhase = 0; this.lastTick = 99; this.jumpHeld = false;
  }

  create() {
    this.physics.world.gravity.y = PHYS.gravity;
    this.bg = this.add.graphics().setDepth(0);
    this.platformGroup = this.physics.add.staticGroup();
    this.moverGroup = this.physics.add.staticGroup();
    this.roomText = [];
    this.fxG = this.add.graphics().setDepth(5);          // motes, lasers, hidden spikes, movers, door
    this.playerG = this.add.graphics().setDepth(10);
    this.player = this.add.rectangle(LEVEL7_DATA.spawn.x, LEVEL7_DATA.spawn.y, PHYS.playerW, PHYS.playerH, COLORS.body, 0);
    this.physics.add.existing(this.player);
    this.player.body.setMaxVelocity(PHYS.speed * 2, 1100);
    this.physics.add.collider(this.player, this.platformGroup);
    this.physics.add.collider(this.player, this.moverGroup);
    this.makeVignette();
    this.vignette = this.add.image(640, 360, 'red-vignette').setDepth(40).setAlpha(0);
    this.glitchG = this.add.graphics().setDepth(41);
    this.hudG = this.add.graphics().setDepth(50);
    const mono = (size, color = TEXT) => ({ fontFamily: FONT, fontSize: `${size}px`, color });
    this.hud = {
      room: this.add.text(84, 22, '', mono(18)).setDepth(51),
      stats: this.add.text(84, 46, '', mono(14, TEXT_DIM)).setDepth(51),
      fever: this.add.text(36, 508, '', mono(13)).setDepth(51).setOrigin(0.5, 0),
      bubble: this.add.text(640, 40, '', { ...mono(18), align: 'center', wordWrap: { width: 760 } }).setDepth(52).setOrigin(0.5, 0),
      sub: this.add.text(640, 104, '', { ...mono(14, TEXT), align: 'center', wordWrap: { width: 700 } }).setDepth(52).setOrigin(0.5, 0),
      mech: this.add.text(640, 158, '', { ...mono(16), align: 'center' }).setDepth(51).setOrigin(0.5, 0),
      hint: this.add.text(640, 676, '', { ...mono(14, TEXT_HOT), align: 'center' }).setDepth(51).setOrigin(0.5, 0),
      help: this.add.text(1264, 22, 'ARROWS/WASD MOVE · SPACE JUMP · R RESTART ROOM · P PAUSE · M MUTE', mono(11, TEXT_DIM)).setDepth(51).setOrigin(1, 0),
      pause: this.add.text(640, 360, 'PAUSED\n\nP / ESC  RESUME\nR  RESTART ROOM\nQ  QUIT TO TITLE', { ...mono(28), align: 'center', backgroundColor: '#1C070CEE', padding: { x: 40, y: 30 } }).setDepth(90).setOrigin(0.5).setVisible(false),
    };
    this.keys = this.input.keyboard.addKeys({ left: 'LEFT', right: 'RIGHT', up: 'UP', a: 'A', d: 'D', w: 'W', space: 'SPACE', r: 'R', p: 'P', esc: 'ESC', m: 'M', q: 'Q' });
    this.input.keyboard.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
    this.input.keyboard.on('keydown', this.onKeyDown, this);
    this.events.once('shutdown', () => { this.input.keyboard.off('keydown', this.onKeyDown, this); });
    this.audio?.musicOn?.();
    this.buildRoom(this.roomIndex);
    this.respawn(false);
    this.cameras.main.fadeIn(400, 18, 6, 10);
  }

  makeVignette() {
    if (this.textures.exists('red-vignette')) return;
    const tex = this.textures.createCanvas('red-vignette', 1280, 720), c = tex.getContext();
    const g = c.createRadialGradient(640, 360, 220, 640, 360, 760);
    g.addColorStop(0, 'rgba(143,24,48,0)'); g.addColorStop(0.6, 'rgba(143,24,48,0.55)'); g.addColorStop(1, 'rgba(255,23,68,1)');
    c.fillStyle = g; c.fillRect(0, 0, 1280, 720); tex.refresh();
  }

  get room() { return LEVEL7_DATA.rooms[this.roomIndex]; }

  // ------------------------------------------------------------ room construction
  buildRoom(i) {
    this.roomIndex = i;
    const room = this.room;
    this.platformGroup.clear(true, true); this.moverGroup.clear(true, true);
    this.roomText.forEach((t) => t.destroy()); this.roomText = [];
    this.bg.clear(); drawBackdrop(this.bg, room, i);
    room.platforms.forEach((p) => { drawPlatform(this.bg, p); const r = this.add.rectangle(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, 0, 0); this.platformGroup.add(r); });
    this.platformGroup.refresh();
    room.hazards.forEach((h) => drawSpikes(this.bg, h, h.dir));
    if (room.gravityZone) {                                                    // clearly marked low-gravity column + restoration line
      const z = room.gravityZone;
      for (let y = 70; y < 690; y += 26) this.bg.fillStyle(COLORS.pale, 0.08).fillRect(z.x0, y, z.x1 - z.x0, 10);
      this.bg.lineStyle(3, COLORS.pale, 0.8).lineBetween(z.x0, 64, z.x0, 690);
      this.bg.lineStyle(3, COLORS.edge, 0.9).lineBetween(z.x1, 64, z.x1, 690);
      this.roomText.push(this.add.text(z.x0 + 8, 74, 'LOW GRAVITY ×0.45', { fontFamily: FONT, fontSize: '13px', color: TEXT }).setDepth(3));
    }
    room.signs.forEach((s) => this.roomText.push(this.add.text(s.x, s.y, s.text, { fontFamily: FONT, fontSize: '15px', color: TEXT, align: 'center', backgroundColor: '#1C070CCC', padding: { x: 8, y: 5 } }).setOrigin(0.5).setDepth(3)));
    this.movers = room.movers.map((m) => {
      const st = moverStart(m), body = this.add.rectangle(st.x + m.w / 2, m.y + m.h / 2, m.w, m.h, 0, 0);
      this.moverGroup.add(body); return { st, body };
    });
    this.moverGroup.refresh();
    this.hud.room.setText(`ROOM ${room.id}/4 · ${room.name}`);
    this.narrator.clearPersistent();
    if (room.patience) this.narrator.setPersistent(PATIENCE_MESSAGE);      // Room 4's message is never overwritten
  }

  /** Reset everything room-specific: movers, hidden traps, mechanic timers, gravity. Total deaths are kept. */
  resetRoomMechanics() {
    this.movers.forEach((m) => { m.st = moverStart(m.st); m.body.setPosition(m.st.x + m.st.w / 2, m.st.y + m.st.h / 2); m.body.body.updateFromGameObject(); });
    this.hiddenState = this.room.hidden.map(() => ({ popped: false, t: 0 }));
    this.glitch.reset(); this.patience.reset(); this.lastTick = 99;
    this.player.body.setGravityY(0);
  }

  respawn(countAsRetry = true) {
    this.resetRoomMechanics();
    const b = this.player.body, s = LEVEL7_DATA.spawn;
    this.player.setPosition(s.x, s.y); b.reset(s.x, s.y); b.setVelocity(0, 0); b.enable = true; this.player.setVisible(true);
    this.assist = new JumpAssist(); this.facing = 1; this.dying = 0; this.shards = [];
    if (countAsRetry) this.cameras.main.flash(150, 58, 10, 20);
  }

  nextRoom() {
    this.sfx('door', 0.7);
    this.cameras.main.fadeOut(180, 18, 6, 10);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.buildRoom(this.roomIndex + 1); this.respawn(false); this.cameras.main.fadeIn(260, 18, 6, 10);
      this.transitioning = false;
    });
    this.transitioning = true;
  }

  // ------------------------------------------------------------ input
  onKeyDown(e) {
    if (this.ending) return;
    this.idleT = 0; this.idleSaid = false;
    const k = e.key.toLowerCase();
    if (k === 'p' || k === 'escape') this.setPaused(!this.paused);
    else if (k === 'm') { const a = this.audio; if (a) a.setMuted(!a.muted); }
    else if (k === 'r' && !this.transitioning) { this.setPaused(false); this.respawn(true); }
    else if (k === 'q' && this.paused) { this.audio?.musicOff?.(); this.scene.start('RedTitle'); }
    this.audio?.init?.();
  }
  setPaused(p) {
    if (this.ending) return;
    this.paused = p; this.hud.pause.setVisible(p);
    if (p) this.physics.world.pause(); else this.physics.world.resume();
  }

  // ------------------------------------------------------------ death
  die() {
    if (this.dying > 0 || this.ending || this.transitioning) return;           // a death is counted exactly once
    this.dying = DEATH_ANIM;
    this.totalDeaths++; const r = this.roomIndex; this.roomDeaths[r]++;
    if (this.roomDeaths[r] >= MERCY_DEATHS) this.mercy[r] = true;
    const b = this.player.body, cx = this.player.x, cy = this.player.y;
    b.setVelocity(0, 0); b.enable = false; this.player.setVisible(false);
    this.shards = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; return { x: cx, y: cy, vx: Math.cos(a) * (180 + (i % 3) * 60), vy: Math.sin(a) * (180 + (i % 4) * 50) - 120, rot: i, size: 6 + (i % 3) * 3 }; });
    this.narrator.say(deathLine(this.room.key, this.roomDeaths[r], this.totalDeaths));
    this.sfx('bonk', 0.8);
    this.cameras.main.shake(160, 0.006);
  }

  // ------------------------------------------------------------ main loop
  update(time, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.drawFx(time / 1000);
    this.drawHud(time / 1000);
    if (this.ending || this.paused) return;
    this.narrator.update(dt);
    this.runTime += dt;
    if (this.dying > 0) {                                                      // death animation; all room timers frozen
      this.dying -= dt;
      this.shards.forEach((s) => { s.vy += 900 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += dt * 8; });
      if (this.dying <= 0) {                                                   // any death sends Thanos back to Room 1
        if (this.roomIndex > 0) this.buildRoom(0);
        this.respawn(true);
      }
      return;
    }
    if (this.transitioning) return;
    const room = this.room, body = this.player.body, k = this.keys;

    // idle narrator
    this.idleT += dt;
    if (this.idleT >= IDLE_LINE && !this.idleSaid) { this.idleSaid = true; this.narrator.say(NARRATOR.idle20); }

    // room mechanics (same update as collision checks)
    if (room.controlGlitch) {
      const before = this.glitch.timeToShift; this.glitch.update(dt);
      if (this.glitch.timeToShift > before) this.sfx('tick', 0.5);             // the shift itself
    }
    if (room.patience && this.patience.update(dt)) { this.sfx('win', 0.35); }  // lasers switch off now — collisions too, below
    this.movers = this.movers.map((m) => {
      const prevX = m.st.x; m.st = stepMover(m.st, dt, this.player.x);
      m.body.setPosition(m.st.x + m.st.w / 2, m.st.y + m.st.h / 2); m.body.body.updateFromGameObject();
      const pb = body, onTop = pb.blocked.down && Math.abs(pb.bottom - m.st.y) < 3 && pb.right > m.st.x && pb.left < m.st.x + m.st.w;
      if (onTop) this.player.x += m.st.x - prevX;                               // carry the rider
      return m;
    });

    // controls: mirrored left/right in Room 3 (jump is never inverted); velocity eases, never snaps
    let dir = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    if (room.controlGlitch && this.glitch.mirrored) dir = -dir;
    const grounded = body.blocked.down || body.touching.down;
    body.setVelocityX(approach(body.velocity.x, dir * PHYS.speed, (grounded ? PHYS.accel : PHYS.airAccel) * dt));
    if (dir) this.facing = dir;
    this.walkPhase += Math.abs(body.velocity.x) * dt * 0.06;
    const jumpDown = k.space.isDown || k.up.isDown || k.w.isDown;
    if (jumpDown && !this.jumpHeld) this.assist.press();
    this.assist.update(dt, grounded);
    if (this.assist.consume()) { body.setVelocityY(PHYS.jumpV); this.sfx('jump', 0.4); }
    if (!jumpDown && this.jumpHeld && body.velocity.y < -220) body.setVelocityY(-220);   // variable jump height
    this.jumpHeld = jumpDown;
    body.setGravityY(gravityAt(room, this.player.x) - PHYS.gravity);           // Room 2 low-gravity column
    this.player.x = clamp(this.player.x, PHYS.playerW / 2, LEVEL7_DATA.width - PHYS.playerW / 2);

    // hidden traps spring when their trigger zone is entered
    const pr = { x: body.left, y: body.top, w: body.width, h: body.height }, centre = { x: this.player.x, y: this.player.y, w: 1, h: 1 };
    room.hidden.forEach((h, i) => {
      const s = this.hiddenState[i];
      if (!s.popped && rectsOverlap(centre, h.trigger)) { s.popped = true; this.sfx('nope', 0.6); }
      if (s.popped) s.t = Math.min(0.12, s.t + dt);
    });

    // hazards (slightly forgiving hitboxes, matching what is drawn)
    const hit = (r) => rectsOverlap(pr, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 6 });
    let dead = room.hazards.some(hit) || room.hidden.some((h, i) => this.hiddenState[i].t >= 0.06 && hit(h));
    if (room.lasers && this.patience.lasersOn) dead = dead || room.lasers.some((l) => rectsOverlap(pr, l));
    if (body.top > PHYS.killY) dead = true;
    if (dead) { this.die(); return; }

    // exit
    if (rectsOverlap(pr, doorRect(room.exit))) {
      if (this.roomIndex < LEVEL7_DATA.rooms.length - 1) this.nextRoom();
      else if (!this.patience.lasersOn) this.beginEnding();
    }
  }

  // ------------------------------------------------------------ ending (logic unchanged: freeze → 0.5 s → flash → complete once → cards)
  beginEnding() {
    if (this.ending) return;
    this.ending = true;
    this.physics.world.pause(); this.player.body.setVelocity(0, 0);
    this.narrator.clear(); this.narrator.clearPersistent();
    this.time.delayedCall(500, () => {
      this.flash(COLORS.flash, 900);
      this.sfx('win', 0.8); this.audio?.musicOff?.();
      this.completeLevel('red');
      this.showEndingCards(ENDING_CARDS);
    });
  }

  // ------------------------------------------------------------ drawing
  drawFx(t) {
    const g = this.fxG, room = this.room; g.clear();
    for (let i = 0; i < 46; i++) {                                              // dust motes drifting on sine waves
      const x = (i * 97 + t * (8 + (i % 5) * 3)) % 1280, y = 60 + ((i * 53) % 620) + sineY(i, t, 10);
      g.fillStyle(COLORS.flash, 0.18 + 0.12 * ((i % 3) / 2)).fillRect(x, y, i % 4 === 0 ? 3 : 2, i % 4 === 0 ? 3 : 2);
    }
    room.hazards.forEach((h, hi) => {                                           // embers rising off the spikes
      for (let j = 0; j < Math.ceil(h.w / 60); j++) {
        const life = (t * 0.7 + j * 0.37 + hi * 0.21) % 1, x = h.x + ((j * 61 + hi * 13) % Math.max(1, h.w)), y = (h.dir === 'up' ? h.y : h.y + h.h) - life * 40;
        g.fillStyle(COLORS.pale, 0.6 * (1 - life)).fillRect(x + sineY(j, t * 3, 3), y, 2, 2);
      }
    });
    drawDoor(g, room.exit, room.patience && this.patience.lasersOn ? 0.35 : 1, t);
    this.movers.forEach(({ st }) => {
      drawPlatform(g, { x: st.x, y: st.y, w: st.w, h: st.h });
      const ax = st.x + st.w / 2, ay = st.y + 10, d = Math.sign(st.vx);
      g.fillStyle(COLORS.flash, 0.7).fillTriangle(ax + d * 12, ay, ax - d * 4, ay - 5, ax - d * 4, ay + 5);
      if (st.shy && (st.warn || st.flash > 0) && Math.floor(t * 8) % 2 === 0) {   // telegraph: the shy platform blinks a warning
        g.fillStyle(COLORS.hazard, 1).fillRect(ax - 3, st.y - 46, 6, 22).fillRect(ax - 3, st.y - 20, 6, 6);
      }
    });
    room.hidden.forEach((h, i) => {
      const s = this.hiddenState[i];
      if (s?.popped) drawSpikes(g, h, 'up', s.t / 0.12);
      else if (this.mercy[this.roomIndex]) drawDashedRect(g, h);              // mercy mode: show where it hides
    });
    if (room.lasers) {
      const on = this.patience.lasersOn, pulse = 0.6 + 0.4 * Math.sin(t * 14);
      room.lasers.forEach((l) => {
        if (on) {
          g.fillStyle(COLORS.hazard, 0.18 * pulse).fillRect(l.x - 10, l.y, l.w + 20, l.h);
          g.fillStyle(COLORS.hazard, 0.9).fillRect(l.x + 2, l.y, l.w - 4, l.h);
          g.fillStyle(COLORS.flash, 0.8 * pulse).fillRect(l.x + 4, l.y, 2, l.h);
        } else g.fillStyle(COLORS.dim, 0.5).fillRect(l.x + 4, l.y, 2, l.h);
        g.fillStyle(COLORS.platform, 1).fillRect(l.x - 6, l.y - 4, l.w + 12, 10).fillRect(l.x - 6, l.y + l.h - 6, l.w + 12, 10);
      });
    }
    const pg = this.playerG; pg.clear();
    if (this.dying > 0 || this.shards.length) {
      const k = Math.max(0, this.dying / DEATH_ANIM);
      this.shards.forEach((s, i) => {
        const c = Math.cos(s.rot), sn = Math.sin(s.rot), r = s.size;
        pg.fillStyle(i % 2 ? COLORS.hazard : COLORS.body, k).fillTriangle(s.x + c * r, s.y + sn * r, s.x - sn * r, s.y + c * r, s.x - c * r, s.y - sn * r);
      });
      if (this.dying > 0) pg.lineStyle(3, COLORS.hazard, k).strokeCircle(this.player.x, this.player.y, 20 + (1 - k) * 70);
    }
    if (this.player.visible) {
      const b = this.player.body;
      drawThanos(pg, this.player.x, this.player.y, this.facing, this.walkPhase, !(b.blocked.down || b.touching.down));
    }
  }

  drawHud(t) {
    const g = this.hudG, h = this.hud, room = this.room; g.clear();
    const F = feverOf(this.totalDeaths);
    this.vignette.setAlpha(vignetteAlpha(F));
    if (F > 80 && !this.paused && !this.ending) this.cameras.main.shake(60, 0.0015, true);
    // thermometer (left)
    g.fillStyle(COLORS.glass, 0.95).fillRoundedRect(24, 90, 24, 380, 12).fillCircle(36, 480, 22);
    g.lineStyle(2, COLORS.dim, 1).strokeRoundedRect(24, 90, 24, 380, 12);
    const top = 458 - 350 * (F / 100);
    g.fillStyle(COLORS.hazard, 1).fillRect(31, top, 10, 462 - top).fillCircle(36, 480, 15);
    for (let i = 0; i <= 10; i++) g.fillStyle(COLORS.pale, 0.6).fillRect(48, 458 - 35 * i, i % 5 === 0 ? 10 : 5, 2);
    h.fever.setText(`FEVER\n${F}`);
    h.stats.setText(`DEATHS ${this.totalDeaths} · IN THIS ROOM ${this.roomDeaths[this.roomIndex]} · TIME ${Math.floor(this.runTime / 60)}:${String(Math.floor(this.runTime % 60)).padStart(2, '0')}`);
    // narrator bubble (top centre): persistent line wins; transient lines never overwrite it
    const main = this.ending ? '' : this.narrator.main, sub = this.ending ? '' : this.narrator.sub;
    if (h.bubble.text !== main) h.bubble.setText(main);
    if (h.sub.text !== sub) h.sub.setText(sub);
    const a = this.narrator.persistent ? 1 : this.narrator.alpha;
    h.bubble.setAlpha(a); h.sub.setAlpha(this.narrator.alpha);
    if (main) {
      const bw = Math.max(240, h.bubble.width + 40), bh = h.bubble.height + 22;
      g.fillStyle(COLORS.card, 0.9 * a).fillRoundedRect(640 - bw / 2, 30, bw, bh, 10);
      g.lineStyle(2, COLORS.edge, a).strokeRoundedRect(640 - bw / 2, 30, bw, bh, 10);
      g.fillStyle(COLORS.card, 0.9 * a).fillTriangle(630, 30 + bh, 650, 30 + bh, 640, 42 + bh);
      h.sub.setY(30 + bh + 22);
    }
    if (sub) {                                                                  // the smaller line beneath a persistent message
      const sa = this.narrator.alpha, sw = h.sub.width + 28, sh = h.sub.height + 12;
      g.fillStyle(COLORS.card, 0.85 * sa).fillRoundedRect(640 - sw / 2, h.sub.y - 6, sw, sh, 8);
      g.lineStyle(1, COLORS.dim, sa).strokeRoundedRect(640 - sw / 2, h.sub.y - 6, sw, sh, 8);
    }
    // room mechanics readouts
    let mech = '';
    if (room.controlGlitch && !this.ending) {
      const m = this.glitch.mirrored;
      mech = `CONTROLS: ${m ? 'MIRRORED' : 'NORMAL'}   ${this.glitch.timeToShift.toFixed(1)}s` + (this.glitch.warning ? '\nCONTROL SHIFT IN 0.5s' : '');
      this.glitchG.clear();
      if (m || this.glitch.warning) for (let i = 0; i < (m ? 5 : 2); i++) { const y = (i * 151 + Math.floor(t * 24) * 47) % 720; this.glitchG.fillStyle(COLORS.hazard, 0.06).fillRect(0, y, 1280, 3 + (i % 3)); }
    } else this.glitchG.clear();
    if (room.patience && !this.ending) {
      const p = this.patience, w = 360;
      mech = p.lasersOn ? `LASERS OFF IN ${p.remaining.toFixed(1)}s` : 'LASERS OFF — WALK ON';
      g.fillStyle(COLORS.glass, 1).fillRect(640 - w / 2, 190, w, 10);
      g.fillStyle(p.lasersOn ? COLORS.hazard : COLORS.flash, 1).fillRect(640 - w / 2, 190, w * (p.t / p.duration), 10);
    }
    if (h.mech.text !== mech) h.mech.setText(mech);
    h.mech.setColor(room.controlGlitch && this.glitch.warning ? TEXT_HOT : TEXT);
    const hint = this.mercy[this.roomIndex] && !this.ending ? `MERCY MODE · ${room.hint}` : '';
    if (h.hint.text !== hint) h.hint.setText(hint);
  }
}
