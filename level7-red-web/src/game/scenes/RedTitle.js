/* RED title screen: START · RULES · EXIT, over the room backdrop with Thanos facing the lit doorway. */
import LevelBase, { FONT } from '../LevelBase.js';
import { drawBackdrop, drawDoor, drawPlatform, drawThanos } from '../art.js';
import { COLORS, LEVEL7_DATA, TEXT, TEXT_DIM } from '../redLogic.js';

const RULES = [
  'PLACEHOLDER - FINAL RULES TO BE ATTACHED',
  '',
  'Guide Thanos through four rooms to the lit doorway.',
  'Arrows / WASD move · Space jumps · R restarts the room.',
  'Rooms change their rules. Traps hide. Read the warnings.',
  'Die anywhere and you start again from Room 1.',
  'Four deaths in a room switch on mercy mode.',
  'The Fever thermometer rises with every death.',
  'P or Esc pauses · M mutes.',
];

export default class RedTitle extends LevelBase {
  constructor() { super('RedTitle'); }

  create() {
    const g = this.add.graphics();
    drawBackdrop(g, LEVEL7_DATA.rooms[0], 0);
    drawPlatform(g, { x: 0, y: 600, w: 1280, h: 120 });
    this.door = this.add.graphics();
    this.hero = this.add.graphics();
    this.t = 0;
    this.add.text(640, 150, 'RED', { fontFamily: FONT, fontSize: '120px', color: TEXT, fontStyle: 'bold' }).setOrigin(0.5).setShadow(0, 0, '#FF1744', 24, true, true);
    const items = [['START', () => this.start()], ['RULES', () => this.showRules(true)], ['EXIT', () => this.exit()]];
    this.buttons = items.map(([label, fn], i) => {
      const b = this.add.text(640, 330 + i * 64, label, { fontFamily: FONT, fontSize: '28px', color: TEXT, backgroundColor: '#1C070CDD', padding: { x: 60, y: 10 }, fixedWidth: 260, align: 'center' })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      b.on('pointerover', () => b.setColor('#FF3B4E')).on('pointerout', () => b.setColor(TEXT)).on('pointerdown', () => { this.audio?.init?.(); this.sfx('click'); fn(); });
      return b;
    });
    this.add.text(640, 560, 'ENTER START · H RULES', { fontFamily: FONT, fontSize: '14px', color: TEXT_DIM }).setOrigin(0.5);
    this.rules = this.add.text(640, 360, RULES.join('\n') + '\n\nENTER / H / CLICK  BACK', { fontFamily: FONT, fontSize: '20px', color: TEXT, align: 'center', backgroundColor: '#1C070CF2', padding: { x: 40, y: 30 }, lineSpacing: 8 })
      .setOrigin(0.5).setDepth(10).setVisible(false).setInteractive().on('pointerdown', () => this.showRules(false));
    this.input.keyboard.on('keydown-ENTER', () => (this.rules.visible ? this.showRules(false) : this.start()));
    this.input.keyboard.on('keydown-H', () => this.showRules(!this.rules.visible));
    this.input.keyboard.on('keydown-ESC', () => this.showRules(false));
  }
  showRules(on) { this.rules.setVisible(on); this.buttons.forEach((b) => b.setVisible(!on)); }
  start() { this.audio?.init?.(); this.scene.start('Level7RagePlatformer'); }
  exit() { this.hooks.onExit?.(); }

  update(_, delta) {
    this.t += delta / 1000;
    this.door.clear(); drawDoor(this.door, { x: 1000, y: 600 }, 1, this.t);
    this.hero.clear(); drawThanos(this.hero, 760 + Math.sin(this.t * 0.4) * 40, 572, 1, this.t * 4, false);
  }
}
