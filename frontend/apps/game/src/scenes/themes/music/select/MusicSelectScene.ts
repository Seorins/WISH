import Phaser from 'phaser'
import {
  createClickTargetMarker,
  createPlayer,
  ensurePlayerWalkAnimations,
  loadPlayerSpritesheet,
  type PlayerDirection,
  type PlayerSprite,
  type RatioPoint,
  updatePlayerMovement,
} from '@/game/entities/player'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'
import { createRatioRectangle, getRectangleEntryState } from '@/game/world/portal'

const MUSIC_SPRITE_FRAME = { width: 600, height: 600 }
const MUSIC_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.78 }
const MUSIC_EXIT_PORTAL = { xRatio: 0.43, yRatio: 0.86, widthRatio: 0.14, heightRatio: 0.12 }
const MUSIC_RETURN_SPAWN = { xRatio: 0.235, yRatio: 0.44 }
const GISUNG_ON_WINDOW = { xRatio: 0.5, bottomYRatio: 0.38, heightRatio: 0.22 }

type MusicSelectSceneData = {
  spawn?: RatioPoint
}

export class MusicSelectScene extends Phaser.Scene {
  private player!: PlayerSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private playerWasInExitPortal = true
  private isTransitioning = false

  constructor() {
    super({ key: 'MusicSelectScene' })
  }

  preload() {
    this.load.image('music-background', '/assets/images/themes/music/background/background.png')
    this.load.spritesheet(
      'music-gisung-sprite',
      '/assets/images/themes/music/characters/gisung_sprite.png',
      {
        frameWidth: MUSIC_SPRITE_FRAME.width,
        frameHeight: MUSIC_SPRITE_FRAME.height,
        margin: 0,
        spacing: 0,
      },
    )
    loadPlayerSpritesheet(this)
  }

  create(data: MusicSelectSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.target = null
    this.playerWasInExitPortal = true

    const background = addCoverBackground(this, 'music-background')
    this.createGisungAnimation()
    this.createGisungOnWindow(background)

    this.physics.world.setBounds(0, 0, vw, vh)
    ensurePlayerWalkAnimations(this)

    const spawn = data.spawn ?? MUSIC_ROOM_SPAWN
    this.player = createPlayer(this, vw * spawn.xRatio, vh * spawn.yRatio)
    this.exitPortal = createRatioRectangle(vw, vh, MUSIC_EXIT_PORTAL)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
      createClickTargetMarker(this, pointer.x, pointer.y)
    })

    this.cameras.main.fadeIn(250, 0, 0, 0)
  }

  update() {
    const movement = updatePlayerMovement({
      player: this.player,
      cursors: this.cursors,
      target: this.target,
      lastDirection: this.lastDirection,
      blocked: this.isTransitioning,
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    const exitState = getRectangleEntryState(
      this.exitPortal,
      this.player.x,
      this.player.y,
      this.playerWasInExitPortal,
    )
    if (!this.isTransitioning && exitState.didEnter) {
      this.returnToVillage()
    }
    this.playerWasInExitPortal = exitState.isInside
  }

  private createGisungAnimation() {
    if (this.anims.exists('music-gisung-play')) {
      return
    }

    this.anims.create({
      key: 'music-gisung-play',
      frames: this.anims.generateFrameNumbers('music-gisung-sprite', { start: 0, end: 1 }),
      frameRate: 2,
      repeat: -1,
    })
  }

  private createGisungOnWindow(background: Phaser.GameObjects.Image) {
    const backgroundLeft = background.x - background.displayWidth / 2
    const backgroundTop = background.y - background.displayHeight / 2
    const displaySize = Math.min(
      background.displayHeight * GISUNG_ON_WINDOW.heightRatio,
      background.displayWidth * 0.14,
    )

    const gisung = this.add
      .sprite(
        backgroundLeft + background.displayWidth * GISUNG_ON_WINDOW.xRatio,
        backgroundTop + background.displayHeight * GISUNG_ON_WINDOW.bottomYRatio,
        'music-gisung-sprite',
        0,
      )
      .setOrigin(0.5, 1)
      .setDepth(4)

    gisung.setDisplaySize(displaySize, displaySize)
    gisung.anims.play('music-gisung-play')
  }

  private returnToVillage() {
    if (this.isTransitioning) {
      return
    }

    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)

    fadeToScene(this, 'VillageScene', {
      duration: 250,
      data: {
        spawn: MUSIC_RETURN_SPAWN,
        portalCooldownMs: 250,
      },
    })
  }
}
