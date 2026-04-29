import Phaser from 'phaser'
import { StartScene } from './scenes/start/StartScene'
import { ArtAlbumScene } from './scenes/themes/art/album/ArtAlbumScene'
import { ArtColoringScene } from './scenes/themes/art/coloring/ArtColoringScene'
import { ArtColoringSelectScene } from './scenes/themes/art/coloring/ArtColoringSelectScene'
import { ArtFreeDrawingScene } from './scenes/themes/art/free-drawing/ArtFreeDrawingScene'
import { ArtSelectScene } from './scenes/themes/art/select/ArtSelectScene'
import { TaekwondoPoomsaeSelectScene } from './scenes/themes/taekwondo/select/TaekwondoPoomsaeSelectScene'
import { TaekwondoSelectScene } from './scenes/themes/taekwondo/select/TaekwondoSelectScene'
import {
  GymnasticsDanielScene,
  GymnasticsTopScene,
} from './scenes/themes/gymnastics/play/GymnasticsPlayScene'
import { GymnasticsSelectScene } from './scenes/themes/gymnastics/select/GymnasticsSelectScene'
import { MusicSelectScene } from './scenes/themes/music/select/MusicSelectScene'
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
    scene: [
      StartScene,
      VillageScene,
      ArtSelectScene,
      ArtAlbumScene,
      ArtFreeDrawingScene,
      ArtColoringSelectScene,
      ArtColoringScene,
      TaekwondoSelectScene,
      TaekwondoPoomsaeSelectScene,
      GymnasticsSelectScene,
      GymnasticsTopScene,
      GymnasticsDanielScene,
      MusicSelectScene,
    ],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })
}
