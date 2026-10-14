/* Scene registration and the game factory. */
import Phaser from 'phaser';
import { RedAudio } from '../audio.js';
import RedTitle from './RedTitle.js';
import Level7RagePlatformer from './Level7RagePlatformer.js';

export const SCENES = [RedTitle, Level7RagePlatformer];

/**
 * Creates the RED game inside `parent`.
 * hooks.onComplete(id) is called once when the level is completed ('red'); hooks.onExit() by the title's EXIT button.
 */
export function createRedGame(parent, hooks = {}) {
  const audio = new RedAudio();
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: 1280, height: 720, backgroundColor: '#12060A',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1400 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: SCENES,
    callbacks: { preBoot: (g) => { g.registry.set('hooks', hooks); g.registry.set('audio', audio); } },
  });
  const destroy = () => { audio.destroy(); game.destroy(true); };
  return { game, audio, destroy };
}
