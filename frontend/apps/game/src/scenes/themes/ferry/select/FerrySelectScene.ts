import Phaser from 'phaser'
import { assetPath } from '@/game/assets/assetPath'
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
import { getPlayerMoveSpeed } from '@/game/settings/gameSettings'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'
import { createRatioRectangle, getRectangleEntryState } from '@/game/world/portal'

const FERRY_BACKGROUND_KEY = 'ferry-background'
const FERRY_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.78 }
const FERRY_EXIT_PORTAL = { xRatio: 0.43, yRatio: 0.86, widthRatio: 0.14, heightRatio: 0.12 }
const FERRY_RETURN_SPAWN = { xRatio: 0.475, yRatio: 0.755 }

type FerrySelectSceneData = {
  spawn?: RatioPoint
}

export class FerrySelectScene extends Phaser.Scene {
  private player!: PlayerSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private playerWasInExitPortal = true
  private isTransitioning = false

  constructor() {
    super({ key: 'FerrySelectScene' })
  }

  preload() {
    this.load.image(FERRY_BACKGROUND_KEY, assetPath('images/themes/ferry/background/ferry.png'))
    loadPlayerSpritesheet(this)
  }

  create(data: FerrySelectSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.target = null
    this.playerWasInExitPortal = true

    addCoverBackground(this, FERRY_BACKGROUND_KEY)
    this.physics.world.setBounds(0, 0, vw, vh)
    ensurePlayerWalkAnimations(this)

    const spawn = data.spawn ?? FERRY_ROOM_SPAWN
    this.player = createPlayer(this, vw * spawn.xRatio, vh * spawn.yRatio)
    this.exitPortal = createRatioRectangle(vw, vh, FERRY_EXIT_PORTAL)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.on('pointerdown', this.handlePointerDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handlePointerDown)
    })

    this.cameras.main.fadeIn(250, 0, 0, 0)
  }

  update() {
    const movement = updatePlayerMovement({
      player: this.player,
      cursors: this.cursors,
      target: this.target,
      lastDirection: this.lastDirection,
      speed: getPlayerMoveSpeed(),
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

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (this.isTransitioning) return

    this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
    createClickTargetMarker(this, pointer.x, pointer.y)
  }

  private returnToVillage() {
    if (this.isTransitioning) return

    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)

    fadeToScene(this, 'VillageScene', {
      duration: 250,
      data: {
        spawn: FERRY_RETURN_SPAWN,
        portalCooldownMs: 250,
      },
    })
  }
}
