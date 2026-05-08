import Phaser from 'phaser'
import { StartScene } from './scenes/start/StartScene'
import { ArtAlbumScene } from './scenes/themes/art/album/ArtAlbumScene'
import { ArtColoringScene } from './scenes/themes/art/coloring/ArtColoringScene'
import { ArtColoringSelectScene } from './scenes/themes/art/coloring/ArtColoringSelectScene'
import { ArtFreeDrawingScene } from './scenes/themes/art/free-drawing/ArtFreeDrawingScene'
import { ArtSelectScene } from './scenes/themes/art/select/ArtSelectScene'
import { TaekwondoPoomsaeSelectScene } from './scenes/themes/taekwondo/select/TaekwondoPoomsaeSelectScene'
import { TaekwondoSelectScene } from './scenes/themes/taekwondo/select/TaekwondoSelectScene'
import { TaekwondoPoomsaePracticeScene } from './scenes/themes/taekwondo/play/TaekwondoPoomsaePracticeScene'
import {
  GymnasticsDanielScene,
  GymnasticsTopScene,
} from './scenes/themes/gymnastics/play/GymnasticsPlayScene'
import { GymnasticsSelectScene } from './scenes/themes/gymnastics/select/GymnasticsSelectScene'
import { LighthouseSelectScene } from './scenes/themes/lighthouse/select/LighthouseSelectScene'
import { MusicRhythmScene } from './scenes/themes/music/play/MusicRhythmScene'
import { MusicSelectScene } from './scenes/themes/music/select/MusicSelectScene'
import { MusicSongSelectScene } from './scenes/themes/music/select/MusicSongSelectScene'
import { VillageScene } from './scenes/village/VillageScene'

function configureTouchSurface(element: HTMLElement) {
  element.style.setProperty('overscroll-behavior', 'none')
  element.style.setProperty('touch-action', 'none')
  element.style.setProperty('user-select', 'none')
  element.style.setProperty('-webkit-user-select', 'none')
  element.style.setProperty('-webkit-touch-callout', 'none')
}

export function createGame(parent: HTMLElement): Phaser.Game {
  configureTouchSurface(parent)

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#000000',
    antialias: true,
    roundPixels: true,
    disableContextMenu: true,
    render: {
      preserveDrawingBuffer: true,
    },
    input: {
      mouse: {
        preventDefaultDown: true,
        preventDefaultMove: true,
        preventDefaultUp: true,
        preventDefaultWheel: true,
      },
      touch: {
        capture: true,
      },
      windowEvents: true,
    },
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
      TaekwondoPoomsaePracticeScene,
      GymnasticsSelectScene,
      GymnasticsTopScene,
      GymnasticsDanielScene,
      LighthouseSelectScene,
      MusicSelectScene,
      MusicSongSelectScene,
      MusicRhythmScene,
    ],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })

  configureTouchSurface(game.canvas)

  return game
}
