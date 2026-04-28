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
import {
  createFloatingInteractionIcon,
  loadInteractionIcons,
  setInteractionIconActive,
} from '@/game/ui/interactionIcon'
import {
  createSimpleDialogUi,
  fadeSimpleDialog,
  setCenteredDialogText,
  type SimpleDialogUi,
} from '@/game/ui/simpleDialog'
import { addCoverBackground } from '@/game/world/background'
import {
  createRatioRectangle,
  getRectangleEntryState,
  isPointInRectangle,
} from '@/game/world/portal'

const GYMNASTICS_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.76 }
const GYMNASTICS_EXIT_PORTAL = { xRatio: 0.44, yRatio: 0.86, widthRatio: 0.12, heightRatio: 0.12 }
const GYMNASTICS_RETURN_SPAWN = { xRatio: 0.72, yRatio: 0.58 }
const DIALOG_TEXT_BOX = { x: 830, y: 470, width: 780, height: 190 }

const RACCOON_DIALOGS = [
  '안녕! 나는 체조 선생님 성수야!',
  '오늘도 신나게 체조 해볼까?',
  '열심히 하면 누구든 잘 할 수 있어!',
  '같이 운동하면 더 즐거워!',
]

type GymnasticsSelectSceneData = {
  spawn?: RatioPoint
}

export class GymnasticsSelectScene extends Phaser.Scene {
  private player!: PlayerSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private isTransitioning = false
  private playerWasInExitPortal = true

  private raccoon!: Phaser.GameObjects.Image
  private talkIcon!: Phaser.GameObjects.Image
  private dialog!: SimpleDialogUi
  private isDialogVisible = false

  constructor() {
    super({ key: 'GymnasticsSelectScene' })
  }

  preload() {
    this.load.image(
      'gymnastics-background',
      '/assets/images/themes/gymnastics/background/background.png',
    )
    this.load.image('raccoon', '/assets/images/themes/gymnastics/characters/Raccoon.png')
    loadInteractionIcons(this)
    this.load.image('seongsu-dialog', '/assets/images/npcs/seongsu/dialog-frame.png')
    loadPlayerSpritesheet(this)
  }

  create(data: GymnasticsSelectSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.isDialogVisible = false
    this.target = null

    addCoverBackground(this, 'gymnastics-background')

    this.physics.world.setBounds(0, 0, vw, vh)

    const raccoonX = vw * 0.58
    const raccoonY = vh * 0.6
    const raccoonH = vh * 0.18
    this.raccoon = this.add.image(raccoonX, raccoonY, 'raccoon')
    this.raccoon.setDisplaySize(raccoonH, raccoonH).setDepth(5)

    this.talkIcon = createFloatingInteractionIcon(this, {
      x: raccoonX,
      y: raccoonY - raccoonH * 0.55,
      displaySize: 44,
      depth: 6,
      bobOffset: 8,
    })

    this.createDialogUi()
    ensurePlayerWalkAnimations(this)

    const spawn = data.spawn ?? GYMNASTICS_ROOM_SPAWN
    this.player = createPlayer(this, vw * spawn.xRatio, vh * spawn.yRatio)

    this.exitPortal = createRatioRectangle(vw, vh, GYMNASTICS_EXIT_PORTAL)

    this.cursors = this.input.keyboard!.createCursorKeys()

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isDialogVisible) {
        const bounds = this.dialog.frame.getBounds()
        if (!isPointInRectangle(bounds, pointer.x, pointer.y)) {
          this.hideDialog()
        }
        return
      }

      const raccoonBounds = this.raccoon.getBounds()
      if (isPointInRectangle(raccoonBounds, pointer.x, pointer.y)) {
        this.showDialog()
        return
      }

      this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
      createClickTargetMarker(this, pointer.x, pointer.y)
    })

    this.playerWasInExitPortal = true
    this.cameras.main.fadeIn(250, 0, 0, 0)
  }

  update() {
    const movement = updatePlayerMovement({
      player: this.player,
      cursors: this.cursors,
      target: this.target,
      lastDirection: this.lastDirection,
      blocked: this.isDialogVisible,
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    if (this.isDialogVisible) {
      return
    }

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

  private createDialogUi() {
    this.dialog = createSimpleDialogUi(this, {
      frameKey: 'seongsu-dialog',
      textBox: DIALOG_TEXT_BOX,
    })
  }

  private showDialog() {
    const line = Phaser.Utils.Array.GetRandom(RACCOON_DIALOGS) as string
    setCenteredDialogText(this.dialog, line)
    this.isDialogVisible = true
    setInteractionIconActive(this.talkIcon, true)
    fadeSimpleDialog(this, this.dialog, 1, 220)
  }

  private hideDialog() {
    this.isDialogVisible = false
    setInteractionIconActive(this.talkIcon, false)
    this.playerWasInExitPortal = isPointInRectangle(this.exitPortal, this.player.x, this.player.y)
    fadeSimpleDialog(this, this.dialog, 0, 180)
  }

  private returnToVillage() {
    if (this.isTransitioning) return

    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)

    fadeToScene(this, 'VillageScene', {
      duration: 250,
      data: {
        spawn: GYMNASTICS_RETURN_SPAWN,
      },
    })
  }
}
