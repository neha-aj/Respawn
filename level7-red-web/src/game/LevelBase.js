/* LevelBase — shared scene plumbing: guarded audio, the one-time completion contract, flash and ending cards. */
import Phaser from 'phaser';
import { COLORS, TEXT } from './redLogic.js';

export const FONT = '"IBM Plex Mono", "Courier New", monospace';

export default class LevelBase extends Phaser.Scene {
  constructor(key) { super(key); this._completed = false; }

  /** Host callbacks ({ onComplete, onExit }) set by the game factory. */
  get hooks() { return this.registry.get('hooks') ?? {}; }
  get audio() { return this.registry.get('audio') ?? null; }
  sfx(name, vol = 1) { try { this.audio?.play(name, vol); } catch { /* audio is optional */ } }

  /**
   * Completion contract: emits `level-complete` on the game event bus and calls hooks.onComplete(id).
   * Guarded so a level can complete exactly once per scene run.
   */
  completeLevel(id) {
    if (this._completed) return false;
    this._completed = true;
    this.game.events.emit('level-complete', id);
    try { this.hooks.onComplete?.(id); } catch { /* host errors must not break the ending */ }
    return true;
  }

  /** Full-screen flash in a pale-red-family colour. */
  flash(color = COLORS.flash, ms = 700) {
    const r = this.add.rectangle(640, 360, 1280, 720, color).setDepth(1000).setAlpha(0).setScrollFactor(0);
    this.tweens.add({ targets: r, alpha: 0.95, duration: ms * 0.3, yoyo: true, hold: ms * 0.2, onComplete: () => r.destroy() });
  }

  /** Dark-red typewriter cards, shown one after another; the last one stays. */
  showEndingCards(lines, { charMs = 45, holdMs = 1900 } = {}) {
    const bg = this.add.rectangle(640, 360, 1280, 720, COLORS.card).setDepth(2000).setAlpha(0).setScrollFactor(0);
    const frame = this.add.rectangle(640, 360, 1100, 260, COLORS.bg1, 0.55).setStrokeStyle(2, COLORS.dim).setDepth(2001).setAlpha(0).setScrollFactor(0);
    const txt = this.add.text(640, 360, '', { fontFamily: FONT, fontSize: '34px', color: TEXT, align: 'center', wordWrap: { width: 1000 } }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);
    this.tweens.add({ targets: [bg, frame], alpha: 1, duration: 600 });
    let card = 0;
    const typeCard = () => {
      const line = lines[card]; let i = 0;
      txt.setText(''); txt.setAlpha(1);
      txt.setFontSize(card === lines.length - 1 ? 64 : 34);
      this.time.addEvent({
        delay: charMs, repeat: line.length - 1, callback: () => {
          i++; txt.setText(line.slice(0, i));
          if (line[i - 1] !== ' ') this.sfx('tick', 0.15);
          if (i === line.length && card < lines.length - 1) {
            this.time.delayedCall(holdMs, () => this.tweens.add({ targets: txt, alpha: 0, duration: 400, onComplete: () => { card++; typeCard(); } }));
          }
        },
      });
    };
    this.time.delayedCall(700, typeCard);
    return txt;
  }
}
