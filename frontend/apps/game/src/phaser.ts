import Phaser from 'phaser'
import { StartScene } from './scenes/start/StartScene'
import { ArtFreeDrawingScene } from './scenes/themes/art/free-drawing/ArtFreeDrawingScene'
import { ArtSelectScene } from './scenes/themes/art/select/ArtSelectScene'
import { TaekwondoSelectScene } from './scenes/themes/taekwondo/select/TaekwondoSelectScene'
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
    scene: [StartScene, VillageScene, ArtSelectScene, ArtFreeDrawingScene, TaekwondoSelectScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })
}
