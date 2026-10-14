/* GREEN renderer — dark painterly forest with a shadow-casting flashlight, fog-of-war memory, bloom and a Darkwood-style HUD. */
import { bakeWorld, circle, drawGhost, drawGlyph, drawPhantomBody, drawThanosFace, drawThanosTopdown, GHOST_LO, line, mk, poly } from './art';
import { AMBIENT_R, C, CELL, DOOR_PHASE, H, JUMPSCARE_FRAMES, LIGHT_RANGE, LIVES, RING_LIFE, RING_MAX, RITUAL_TIME, rgb, scale, W, type RGB } from './config';
import { ForestMaze, V } from './maze';
import { Rng, type GreenGame } from './sim';

const TAU = Math.PI * 2;
export const FONT = '"Special Elite", "Courier New", monospace';

export class Renderer {
  private world: HTMLCanvasElement | null = null;
  private memory: HTMLCanvasElement | null = null;
  private light = mk(W, H); private add = mk(W, H);
  private ghostLo = mk(...GHOST_LO); private ghostHead = mk(...GHOST_LO);
  private grain: HTMLCanvasElement[] = []; private vignette = mk(W, H);
  cam = new V(); private camInit = false; private resetSeen = -1;
  private spores: number[][] = [];
  private cache = new Map<string, HTMLCanvasElement>();
  phantomVisible = false;

  constructor(private ctx: CanvasRenderingContext2D) {
    const r = new Rng(3);
    for (let i = 0; i < 3; i++) {
      const c = mk(W, H), g = c.getContext('2d')!;
      for (let j = 0; j < 5200; j++) { g.fillStyle = rgb(r.pick([C.DEEP, C.GRASS_LO, C.VOID]), r.pick([0.35, 0.2, 0.47])); g.fillRect(Math.floor(r.uni(0, W)), Math.floor(r.uni(0, H)), 2, 2); }
      this.grain.push(c);
    }
    const vg = this.vignette.getContext('2d')!, grad = vg.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.62);
    grad.addColorStop(0, rgb(C.VOID, 0)); grad.addColorStop(1, rgb(C.VOID, 0.85)); vg.fillStyle = grad; vg.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) this.spores.push([r.uni(0, W), r.uni(0, H), r.uni(0.6, 1.6), r.uni(0, 6)]);
  }
  clearTextCache() { this.cache.clear(); }

  /** Text in the typewriter face; `distress` erodes it like worn ink (cached). */
  text(txt: string, size: number, col: RGB, x: number, y: number, align: CanvasTextAlign = 'center', distress = false) {
    const g = this.ctx, font = `${size}px ${FONT}`;
    if (!distress) { g.font = font; g.fillStyle = rgb(col); g.textAlign = align; g.textBaseline = 'middle'; g.fillText(txt, x, y); return; }
    const k = `${txt}|${size}|${col}`;
    let c = this.cache.get(k);
    if (!c) {
      const m = mk(1, 1).getContext('2d')!; m.font = font;
      const w = Math.ceil(m.measureText(txt).width) + 4, h = Math.ceil(size * 1.4);
      c = mk(w, h); const cg = c.getContext('2d')!;
      cg.font = font; cg.fillStyle = rgb(col); cg.textBaseline = 'middle'; cg.fillText(txt, 2, h / 2);
      const r = new Rng(txt.length * 131 + size);
      for (let i = 0; i < (w * h) / 45; i++) cg.clearRect(Math.floor(r.uni(0, w)), Math.floor(r.uni(0, h)), r.pick([1, 2, 2, 3]), 1);
      if (this.cache.size > 300) this.cache.clear();
      this.cache.set(k, c);
    }
    const ox = align === 'center' ? c.width / 2 : align === 'right' ? c.width : 0;
    g.drawImage(c, Math.round(x - ox), Math.round(y - c.height / 2));
  }

  draw(game: GreenGame) {
    const g = this.ctx;
    if (!this.world) this.world = bakeWorld(game.maze);
    if (!this.memory || this.resetSeen !== game.resetCount) {
      this.memory = mk(game.maze.worldW, game.maze.worldH); const mg = this.memory.getContext('2d')!;
      mg.fillStyle = '#000'; mg.fillRect(0, 0, game.maze.worldW, game.maze.worldH);
      this.resetSeen = game.resetCount; game.newlyExplored = [];
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = rgb(C.VOID); g.fillRect(0, 0, W, H);
    if (game.shake > 0.5) g.translate((Math.random() * 2 - 1) * game.shake, (Math.random() * 2 - 1) * game.shake);   // the whole image shakes
    if (game.state === 'JUMPSCARE') this.jumpscare(game);
    else {
      this.scene(game, game.state === 'TITLE' || game.state === 'RULES');
      if (game.state !== 'TITLE' && game.state !== 'RULES') this.hud(game);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  private camTarget(game: GreenGame, o: V, aim: number) {
    const c = o.add(V.ang(aim, 55)).sub(new V(W / 2, H / 2));
    return new V(Math.min(Math.max(c.x, 0), game.maze.worldW - W), Math.min(Math.max(c.y, 0), game.maze.worldH - H));
  }

  private scene(game: GreenGame, attract: boolean) {
    const g = this.ctx, mz = game.maze, lt = game.light;
    const origin = attract ? ForestMaze.center(mz.doorFront).add(new V(0, 70)) : game.player.pos;
    const aim = attract ? -Math.PI / 2 + Math.sin(game.t * 0.45) * 0.9 : game.player.aim;
    const tgt = this.camTarget(game, origin, aim);
    this.cam = this.camInit ? this.cam.add(tgt.sub(this.cam).mul(0.12)) : tgt; this.camInit = true;
    const cam = new V(Math.round(this.cam.x), Math.round(this.cam.y)), S = (p: V) => p.sub(cam);
    game.updateLight(origin, aim);
    const mg = this.memory!.getContext('2d')!;                           // fog of war remembers what Thanos has seen
    mg.globalCompositeOperation = 'lighten';
    for (const k of game.newlyExplored) {
      const c = ForestMaze.center([Math.floor(k / 100), k % 100]), gr = mg.createRadialGradient(c.x, c.y, 0, c.x, c.y, CELL + 4);
      gr.addColorStop(0, rgb([40, 62, 36])); gr.addColorStop(1, '#000'); mg.fillStyle = gr; mg.fillRect(c.x - CELL - 4, c.y - CELL - 4, 2 * CELL + 8, 2 * CELL + 8);
    }
    game.newlyExplored = [];
    g.drawImage(this.world!, cam.x, cam.y, W, H, 0, 0, W, H);
    const ag = this.add.getContext('2d')!; ag.globalCompositeOperation = 'source-over'; ag.fillStyle = '#000'; ag.fillRect(0, 0, W, H); ag.globalCompositeOperation = 'lighter';
    g.fillStyle = rgb(C.MOTE);
    for (const sp of this.spores) { sp[0] = (((sp[0] + Math.sin(game.t * 0.7 + sp[3]) * 0.3) % W) + W) % W; sp[1] = (((sp[1] - sp[2] * 0.25) % H) + H) % H; g.fillRect(sp[0], sp[1], 2, 2); }
    this.tree(game, cam, ag);
    for (const r of game.runes) {
      if (game.collected.has(r.idx)) continue;
      const seen = !attract && (lt.illuminates(mz, origin, aim, r.pos) || lt.near(mz, origin, r.pos));
      r.vis = seen ? Math.min(1, r.vis + 0.08) : Math.max(0, r.vis - 0.05);
      const p = S(r.pos).add(new V(0, Math.sin(game.t * 2 + r.idx) * 2));
      circle(g, p.x, p.y, 13, rgb(C.STONE), rgb(C.DEEP), 2); drawGlyph(g, r.idx, p.x, p.y, 8, rgb(r.vis > 0 ? C.GLOW : C.MOSS));
      if (r.vis > 0) {
        const k = r.vis * (0.7 + 0.3 * Math.sin(game.t * 4)), gr = ag.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30);
        gr.addColorStop(0, scale([60, 200, 50], k)); gr.addColorStop(1, '#000'); ag.fillStyle = gr; ag.fillRect(p.x - 30, p.y - 30, 60, 60);
        drawGlyph(ag, r.idx, p.x, p.y, 8, scale([60, 255, 40], k));
      }
    }
    const ph = game.phantom;
    this.phantomVisible = !attract && game.phantomVisible(origin, aim);
    if (this.phantomVisible) drawPhantomBody(g, S(ph.pos), ph.face, ph.anim);
    this.lighting(game, cam, origin);
    if (this.phantomVisible) {
      const pp = S(ph.pos);
      for (const s of [-1, 1]) { const e = pp.add(ph.face.mul(6)).add(new V(-ph.face.y, ph.face.x).mul(5 * s)); circle(ag, e.x, e.y, 6, rgb([30, 120, 30])); circle(ag, e.x, e.y, 2, rgb(C.PORTAL)); }
    }
    for (const r of game.rings) { const k = 1 - r.age / RING_LIFE, p = S(r.pos); circle(ag, p.x, p.y, 10 + (RING_MAX * r.age) / RING_LIFE, undefined, scale(C.LIGHT, k * 0.8), 2); }
    for (const p of game.particles) { const k = 1 - p.age / p.life, q = S(p.pos); circle(ag, q.x, q.y, 1 + 2 * k, scale(p.col, k)); }
    if (game.ritualT !== null && !attract) for (let i = 0; i < 3; i++) {
      const q = S(game.runeOrbit(i)), gr = ag.createRadialGradient(q.x, q.y, 0, q.x, q.y, 30);
      gr.addColorStop(0, rgb([60, 200, 50])); gr.addColorStop(1, '#000'); ag.fillStyle = gr; ag.fillRect(q.x - 30, q.y - 30, 60, 60);
      circle(g, q.x, q.y, 12, rgb(C.STONE)); drawGlyph(g, i, q.x, q.y, 8, rgb(C.GLOW)); drawGlyph(ag, i, q.x, q.y, 8, rgb(C.LIGHT));
    }
    g.globalCompositeOperation = 'lighter';                               // bloom: blurred copy + sharp copy of the glow layer
    g.filter = 'blur(10px)'; g.drawImage(this.add, 0, 0); g.filter = 'none'; g.drawImage(this.add, 0, 0);
    g.globalCompositeOperation = 'source-over';
    if (!attract && game.state !== 'VICTORY') {
      const pl = game.player;
      drawThanosTopdown(g, S(pl.pos), pl.aim, game.t, pl.moving, pl.sprinting, game.protect > 0 && Math.floor(game.t * 10) % 2 === 0);
    } else if (game.state === 'VICTORY') {
      const k = Math.max(0, 1 - game.victoryT / 1.2);
      if (k > 0) { const pc = S(ForestMaze.center(mz.portal)); g.save(); g.translate(pc.x, pc.y); g.rotate(-game.victoryT * 7); g.scale(k, k); drawThanosTopdown(g, new V(), -Math.PI / 2, game.t, false, false); g.restore(); }
    }
    if (game.danger > 0.15 && game.state === 'PLAYING') { g.globalAlpha = 0.35 * game.danger * (0.5 + 0.5 * Math.sin(game.t * 7)); g.drawImage(this.vignette, 0, 0); g.globalAlpha = 1; }   // pulse; never says where
    g.drawImage(this.grain[Math.floor(game.t * 24) % 3], 0, 0);
    g.drawImage(this.vignette, 0, 0);
  }

  private lighting(game: GreenGame, cam: V, origin: V) {
    const g = this.ctx, lc = this.light.getContext('2d')!, mz = game.maze, lt = game.light, o = origin.sub(cam);
    lc.globalCompositeOperation = 'source-over'; lc.filter = 'none';
    lc.fillStyle = '#000'; lc.fillRect(0, 0, W, H);
    lc.drawImage(this.memory!, cam.x, cam.y, W, H, 0, 0, W, H);
    lc.globalCompositeOperation = 'lighten';
    const tc = mz.treeCenter.sub(cam), [tr, tcol]: [number, RGB] = mz.doorOpen ? [240, [150, 240, 140]] : game.doorUnlocked ? [220, [96, 170, 86]] : [210, [60, 110, 54]];
    let gr = lc.createRadialGradient(tc.x, tc.y, 0, tc.x, tc.y, tr);
    gr.addColorStop(0, rgb(tcol)); gr.addColorStop(1, '#000'); lc.fillStyle = gr; lc.fillRect(tc.x - 250, tc.y - 250, 500, 500);
    lc.filter = 'blur(4px)';                                              // soft shadow edges
    gr = lc.createRadialGradient(o.x, o.y, 0, o.x, o.y, AMBIENT_R);
    gr.addColorStop(0, rgb([96, 150, 88])); gr.addColorStop(1, '#000'); poly(lc, lt.amb.map((p) => p.sub(cam)), undefined); lc.fillStyle = gr; lc.fill();
    const f = lt.flicker;
    gr = lc.createRadialGradient(o.x, o.y, 0, o.x, o.y, LIGHT_RANGE);
    gr.addColorStop(0, scale([225, 255, 205], f)); gr.addColorStop(0.5, scale([225, 255, 205], f * 0.78)); gr.addColorStop(0.85, scale([225, 255, 205], f * 0.36)); gr.addColorStop(1, '#000');
    poly(lc, lt.cone.map((p) => p.sub(cam)), undefined); lc.fillStyle = gr; lc.fill();
    lc.filter = 'none';
    g.globalCompositeOperation = 'multiply'; g.drawImage(this.light, 0, 0);
    g.globalCompositeOperation = 'lighten'; g.fillStyle = rgb(C.VOID); g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';                                // faint neon haze of the beam itself
    gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, LIGHT_RANGE);
    gr.addColorStop(0, scale([7, 26, 3], f)); gr.addColorStop(1, '#000'); poly(g, lt.cone.map((p) => p.sub(cam)), undefined); g.fillStyle = gr; g.fill();
    g.globalCompositeOperation = 'source-over';
  }

  /** Door slabs and hollow under the light; portal swirl and bark veins on the glow layer. */
  private tree(game: GreenGame, cam: V, ag: CanvasRenderingContext2D) {
    const g = this.ctx, mz = game.maze, dcx = ForestMaze.center(mz.door).x - cam.x, dx = dcx - 22;
    const topPortal = mz.portal[1] * CELL + 4 - cam.y, bottom = (mz.door[1] + 1) * CELL + 6 - cam.y, doorTop = mz.door[1] * CELL + 4 - cam.y;
    let p = game.ritualT === null ? 0 : Math.min(1, Math.max(0, (game.ritualT - DOOR_PHASE) / (RITUAL_TIME - DOOR_PHASE)));
    if (mz.doorOpen) p = 1;
    if (p > 0) { g.fillStyle = rgb(C.VOID); g.beginPath(); g.roundRect(dx, topPortal, 44, bottom - topPortal, [20, 20, 0, 0]); g.fill(); }
    const sw = 22 * (1 - p);
    if (sw > 0.5) for (const x0 of [dx, dx + 44 - sw]) {
      g.fillStyle = rgb(C.BARK_HI); g.fillRect(x0, doorTop, sw, bottom - doorTop);
      for (let yy = doorTop + 6; yy < bottom; yy += 9) line(g, { x: x0, y: yy }, { x: x0 + sw - 1, y: yy }, rgb(C.BARK), 2);
      g.strokeStyle = rgb(C.DEEP); g.lineWidth = 2; g.strokeRect(x0, doorTop, sw, bottom - doorTop);
    }
    if (p === 0) {                                                       // the seal: one notch per rune
      const sx = dcx, sy = (doorTop + bottom) / 2;
      circle(g, sx, sy, 13, rgb(C.DEEP), rgb(C.MOSS), 2);
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (TAU * i) / 3, qx = sx + Math.cos(a) * 9, qy = sy + Math.sin(a) * 9, on = game.collected.has(i);
        circle(g, qx, qy, 3, rgb(on ? C.GLOW : C.MOSS)); if (on) circle(ag, qx, qy, 7, rgb([20, 90, 16]));
      }
    }
    const tc = mz.treeCenter.sub(cam);
    if (game.doorUnlocked) {
      const gl = 0.5 + 0.5 * Math.sin(game.t * 2.4), r = new Rng(7);
      for (let i = 0; i < 14; i++) {                                     // pulsing veins of light in the bark
        let ang = (TAU * i) / 14 + r.uni(-0.1, 0.1);
        const skip = Math.abs((((ang - Math.PI / 2 + Math.PI) % TAU) + TAU) % TAU - Math.PI) < 0.3;
        const pts = [tc.add(V.ang(ang, 26))];
        for (let j = 0; j < 4; j++) { ang += r.uni(-0.3, 0.3); pts.push(pts[pts.length - 1].add(V.ang(ang, r.uni(16, 22)))); }
        if (skip) continue;
        const ph = 0.5 + 0.5 * Math.sin(game.t * 3 - i * 0.7);
        ag.strokeStyle = `rgb(${Math.round(14 * gl * ph + 6)},${Math.round(110 * gl * ph + 30)},${Math.round(10 * gl * ph + 4)})`; ag.lineWidth = 2;
        ag.beginPath(); pts.forEach((q, j) => (j ? ag.lineTo(q.x, q.y) : ag.moveTo(q.x, q.y))); ag.stroke();
      }
    }
    if (p > 0) {
      const pc = new V(dcx, (topPortal + doorTop) / 2 + 6);
      for (let k = 6; k > 0; k--) circle(ag, pc.x, pc.y, 4 + k * 4 * p + 2 * Math.sin(game.t * 5 + k), `rgb(${Math.round(C.PORTAL[0] * 0.16 * (k / 6) * p)},${Math.round(C.PORTAL[1] * 0.22 * p)},${Math.round(C.PORTAL[2] * 0.16 * (k / 6) * p)})`);
      ag.strokeStyle = rgb([60, 200, 60]); ag.lineWidth = 2;
      for (let k = 0; k < 3; k++) { const a = game.t * 3 + k * 2.1; ag.beginPath(); ag.arc(pc.x, pc.y, 14, a, a + 1.6); ag.stroke(); }
    }
  }

  private jumpscare(game: GreenGame) {
    const g = this.ctx, k = Math.min(JUMPSCARE_FRAMES - 1, Math.max(0, JUMPSCARE_FRAMES - game.jsFrames));
    drawGhost(this.ghostLo, this.ghostHead, k, game.t);
    g.imageSmoothingEnabled = false; g.drawImage(this.ghostLo, 0, 0, W, H); g.imageSmoothingEnabled = true;   // hard pixels, like the reference
    const r = new Rng(k + 1);
    if (k % 6 === 2 || k % 6 === 3) for (let i = 0; i < 4; i++) {          // glitch: torn horizontal bands
      const y0 = Math.floor(r.uni(0, H - 40)), hh = Math.floor(r.uni(8, 40));
      g.drawImage(g.canvas, 0, y0, W, hh, Math.floor(r.uni(-40, 40)), y0, W, hh);
    }
    if (k % 10 === 0) { g.fillStyle = rgb(C.LIGHT, 0.22); g.fillRect(0, 0, W, H); }
    g.fillStyle = rgb(C.VOID); for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    g.drawImage(this.vignette, 0, 0);
  }

  private hud(game: GreenGame) {
    const g = this.ctx, frame = (x: number, y: number, w: number, h: number) => {
      g.fillStyle = rgb(C.VOID); g.fillRect(x, y, w, h); g.strokeStyle = rgb(C.MOSS); g.lineWidth = 2; g.strokeRect(x, y, w, h);
      line(g, { x, y }, { x: x + 10, y }, rgb(C.TEXT_DIM), 2); line(g, { x: x + w, y: y + h }, { x: x + w - 10, y: y + h }, rgb(C.TEXT_DIM), 2);
    };
    frame(12, 12, 66, 66); drawThanosFace(g, 45, 45, 28, game.mood(), game.t);
    this.text('THANOS', 12, C.TEXT_DIM, 45, 90);
    const x0 = 90;
    this.text('LIVES', 12, C.TEXT_DIM, x0, 20, 'left');
    for (let i = 0; i < LIVES; i++) { g.fillStyle = rgb(i < game.lives ? C.GLOW : C.DEEP); g.fillRect(x0 + i * 46, 30, 42, 8); g.strokeStyle = rgb(C.MOSS); g.lineWidth = 1; g.strokeRect(x0 + i * 46 + 0.5, 30.5, 41, 7); }
    this.text(`RUNES: ${game.collected.size}/3`, 16, C.TEXT, x0, 56, 'left');
    for (let i = 0; i < 3; i++) {
      const cx = x0 + 128 + i * 26, on = game.collected.has(i);
      g.fillStyle = rgb(C.VOID); g.fillRect(cx - 11, 44, 22, 22); g.strokeStyle = rgb(C.MOSS); g.lineWidth = 1; g.strokeRect(cx - 10.5, 44.5, 21, 21);
      drawGlyph(g, i, cx, 55, 7, rgb(on ? C.GLOW : C.MOSS), on ? 2 : 1);
    }
    this.text('GREEN', 16, C.TEXT, W - 14, 28, 'right');
    const tl = Math.max(0, game.timeLeft), low = tl < 60;
    this.text(`${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`, 22, low && Math.floor(game.t * 4) % 2 ? C.PORTAL : C.TEXT, W - 14, 62, 'right');
    const bx = W / 2 - 130, by = H - 44;                                    // noise meter (the reference's bottom bar)
    g.fillStyle = rgb(C.VOID); g.fillRect(bx - 2, by - 2, 264, 10); g.strokeStyle = rgb(C.MOSS); g.lineWidth = 1; g.strokeRect(bx - 1.5, by - 1.5, 263, 9);
    for (let i = 0; i < 13; i++) { g.fillStyle = rgb(game.noise * 13 > i ? C.LIGHT : C.DEEP); g.fillRect(bx + i * 20 + 1, by, 18, 6); }
    if (game.noise > 0.05) this.text('NOISE', 12, C.LIGHT, bx - 8, by + 3, 'right');
    this.text(game.objective(), 16, C.TEXT, W / 2, H - 22, 'center', true);
    if (game.msgT > 0 && game.msg) this.text(game.msg, 22, C.PALE, W / 2, H - 78, 'center', true);
  }
}
