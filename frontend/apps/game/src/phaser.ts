import Phaser from 'phaser'
import { StartScene } from './scenes/start/StartScene'
import { ArtSelectScene } from './scenes/themes/art/select/ArtSelectScene'
import { VillageScene } from './scenes/village/VillageScene'

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
    scene: [StartScene, VillageScene, ArtSelectScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })
}
