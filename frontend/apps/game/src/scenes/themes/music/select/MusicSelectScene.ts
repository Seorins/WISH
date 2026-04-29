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
import { createRatioRectangle, getRectangleEntryState } from '@/game/world/portal'

const MUSIC_SPRITE_FRAME = { width: 600, height: 600 }
const MUSIC_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.78 }
const MUSIC_EXIT_PORTAL = { xRatio: 0.43, yRatio: 0.86, widthRatio: 0.14, heightRatio: 0.12 }
const MUSIC_RETURN_SPAWN = { xRatio: 0.235, yRatio: 0.44 }
const GISUNG_ON_WINDOW = { xRatio: 0.5, bottomYRatio: 0.38, heightRatio: 0.22 }
const GISUNG_INTERACTION_RADIUS_RATIO = 0.12
const GISUNG_TALK_ICON_OFFSET_RATIO = 1.05
const DIALOG_TEXT_BOX = { x: 900, y: 400, width: 1060, height: 180 }
const GISUNG_DIALOG_LINES = [
  '좋아, 오늘은 바이올린 소리를 천천히 따라와 보자.',
  '음악은 박자를 느끼는 게 제일 중요해. 하나씩 맞춰 보자!',
  '지금처럼 편하게 들어오면 돼. 준비되면 같이 연주해 보자.',
]

type MusicSelectSceneData = {
  spawn?: RatioPoint
}

export class MusicSelectScene extends Phaser.Scene {
  private player!: PlayerSprite
  private gisungNpc!: Phaser.GameObjects.Sprite
  private gisungAnchor = new Phaser.Math.Vector2()
  private gisungInteractionRadius = 0
  private talkIcon!: Phaser.GameObjects.Image
  private dialog!: SimpleDialogUi
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private playerWasInExitPortal = true
  private isTransitioning = false
  private isDialogVisible = false
  private dialogDismissed = false

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (this.isDialogVisible) {
      this.closeDialog(true)
      return
    }

    this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
    createClickTargetMarker(this, pointer.x, pointer.y)
  }

  private readonly handleEnterDown = () => {
    if (this.isDialogVisible) {
      this.closeDialog(true)
    }
  }

  private readonly handleEscDown = () => {
    if (this.isDialogVisible) {
      this.closeDialog(true)
    }
  }

  constructor() {
    super({ key: 'MusicSelectScene' })
  }

  preload() {
    this.load.image('music-background', assetPath('images/themes/music/background/background.png'))
    this.load.spritesheet(
      'music-gisung-sprite',
      assetPath('images/themes/music/characters/gisung_sprite.png'),
      {
        frameWidth: MUSIC_SPRITE_FRAME.width,
        frameHeight: MUSIC_SPRITE_FRAME.height,
        margin: 0,
        spacing: 0,
      },
    )
    loadInteractionIcons(this)
    this.load.image('gisung-dialog-frame', assetPath('images/npcs/gisung/dialog-frame.png'))
    loadPlayerSpritesheet(this)
  }

  create(data: MusicSelectSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.isDialogVisible = false
    this.dialogDismissed = false
    this.target = null
    this.playerWasInExitPortal = true

    const background = addCoverBackground(this, 'music-background')
    this.createGisungAnimation()
    this.createGisungOnWindow(background)
    this.createDialogUi()

    this.physics.world.setBounds(0, 0, vw, vh)
    ensurePlayerWalkAnimations(this)

    const spawn = data.spawn ?? MUSIC_ROOM_SPAWN
    this.player = createPlayer(this, vw * spawn.xRatio, vh * spawn.yRatio)
    this.exitPortal = createRatioRectangle(vw, vh, MUSIC_EXIT_PORTAL)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.on('pointerdown', this.handlePointerDown)
    this.input.keyboard!.on('keydown-ENTER', this.handleEnterDown)
    this.input.keyboard!.on('keydown-ESC', this.handleEscDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handlePointerDown)
      this.input.keyboard?.off('keydown-ENTER', this.handleEnterDown)
      this.input.keyboard?.off('keydown-ESC', this.handleEscDown)
    })

    this.cameras.main.fadeIn(250, 0, 0, 0)
  }

  update() {
    const movement = updatePlayerMovement({
      player: this.player,
      cursors: this.cursors,
      target: this.target,
      lastDirection: this.lastDirection,
      blocked: this.isTransitioning || this.isDialogVisible,
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    this.updateGisungConversation()

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

  private createGisungAnimation() {
    if (this.anims.exists('music-gisung-play')) {
      return
    }

    this.anims.create({
      key: 'music-gisung-play',
      frames: this.anims.generateFrameNumbers('music-gisung-sprite', { start: 0, end: 1 }),
      frameRate: 1,
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

    this.gisungNpc = this.add
      .sprite(
        backgroundLeft + background.displayWidth * GISUNG_ON_WINDOW.xRatio,
        backgroundTop + background.displayHeight * GISUNG_ON_WINDOW.bottomYRatio,
        'music-gisung-sprite',
        0,
      )
      .setOrigin(0.5, 1)
      .setDepth(4)

    this.gisungNpc.setDisplaySize(displaySize, displaySize)
    this.gisungNpc.anims.play('music-gisung-play')
    this.gisungAnchor.set(this.gisungNpc.x, this.gisungNpc.y)
    this.gisungInteractionRadius =
      Math.min(background.displayWidth, background.displayHeight) * GISUNG_INTERACTION_RADIUS_RATIO

    this.talkIcon = createFloatingInteractionIcon(this, {
      x: this.gisungNpc.x,
      y: this.gisungNpc.y - this.gisungNpc.displayHeight * GISUNG_TALK_ICON_OFFSET_RATIO,
      displaySize: 44,
      depth: 6,
      bobOffset: 8,
    })
  }

  private createDialogUi() {
    this.dialog = createSimpleDialogUi(this, {
      frameKey: 'gisung-dialog-frame',
      textBox: DIALOG_TEXT_BOX,
      dialogWidthRatio: 0.78,
      maxDialogWidth: 1080,
      fontSize: 40,
      lineSpacing: 4,
    })
  }

  private updateGisungConversation() {
    if (this.isTransitioning) {
      return
    }

    const distanceToGisung = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.gisungAnchor.x,
      this.gisungAnchor.y,
    )
    const isNearGisung = distanceToGisung <= this.gisungInteractionRadius

    setInteractionIconActive(this.talkIcon, this.isDialogVisible)

    if (!isNearGisung) {
      this.dialogDismissed = false
      return
    }

    if (!this.isDialogVisible && !this.dialogDismissed) {
      this.startGisungConversation()
    }
  }

  private startGisungConversation() {
    setCenteredDialogText(this.dialog, Phaser.Utils.Array.GetRandom(GISUNG_DIALOG_LINES))
    this.isDialogVisible = true
    setInteractionIconActive(this.talkIcon, true)
    fadeSimpleDialog(this, this.dialog, 1, 220)
  }

  private closeDialog(markDismissed: boolean) {
    this.isDialogVisible = false
    this.dialogDismissed = markDismissed
    setInteractionIconActive(this.talkIcon, false)
    fadeSimpleDialog(this, this.dialog, 0, 180)
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
