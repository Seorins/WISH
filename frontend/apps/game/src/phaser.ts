import Phaser from 'phaser'
import { StartScene } from './scenes/StartScene'
import { GameScene } from './scenes/GameScene'

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#000000',
    antialias: true,
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scene: [StartScene, GameScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })
}
