import Phaser from 'phaser'
import { assetPath } from '@/game/assets/assetPath'
import {
  createClickTargetMarker,
  createPlayer,
  ensurePlayerWalkAnimations,
  loadPlayerSpritesheet,
  type PlayerDirection,
  type PlayerSprite,
  updatePlayerMovement,
} from '@/game/entities/player'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { getPlayerMoveSpeed } from '@/game/settings/gameSettings'
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
import { createRatioRectangle, isPointInRectangle } from '@/game/world/portal'
import { seokjaeSelectDialogs } from '../dialog/seokjaeDialogs'

const TAEKWONDO_SPRITE_FRAME = { width: 384, height: 512 }
const ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.78 }
const EXIT_PORTAL = { xRatio: 0.45, yRatio: 0.8, widthRatio: 0.11, heightRatio: 0.26 }
const RETURN_SPAWN = { xRatio: 0.445, yRatio: 0.15 }
const SEOKJAE = { xRatio: 0.5, yRatio: 0.4, scaleRatio: 0.34 }
const SEOKJAE_INTERACTION = { radiusRatio: 0.08 }
const SEOKJAE_TALK_ICON_OFFSET = { yRatio: 0.15 }
const SEOKJAE_POSES = [0, 1, 2]
const RANDOM_POSE_DELAY = 500
const DIALOG_TEXT_BOX = { x: 580, y: 180, width: 1500, height: 400 }
const DIALOG_NAME_BOX = { x: 505, y: 109, width: 390, height: 150 }

export class TaekwondoSelectScene extends Phaser.Scene {
  private player!: PlayerSprite
  private seokjaeNpc!: Phaser.GameObjects.Sprite
  private seokjaeInteractionRadius = 0
  private talkIcon!: Phaser.GameObjects.Image
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private randomPoseTimer?: Phaser.Time.TimerEvent
  private isTransitioning = false

  private dialog!: SimpleDialogUi
  private isDialogVisible = false
  private dialogDismissed = false

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (this.isDialogVisible) {
      const clickedDialog = this.dialog.frame.getBounds().contains(pointer.x, pointer.y)

      if (clickedDialog) {
        this.startPoomsaeSelectScene()
        return
      }

      this.closeDialog(true)
      return
    }

    this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
    createClickTargetMarker(this, pointer.x, pointer.y)
  }

  private readonly handleEnterDown = () => {
    if (this.isDialogVisible) {
      this.startPoomsaeSelectScene()
    }
  }

  private readonly handleEscDown = () => {
    if (!this.isDialogVisible) {
      return
    }

    this.closeDialog(true)
  }

  constructor() {
    super({ key: 'TaekwondoSelectScene' })
  }

  preload() {
    this.load.image(
      'taekwondo-room-background',
      assetPath('images/themes/taekwondo/background/taekwondo_inside.png'),
    )
    loadInteractionIcons(this)
    this.load.image('seokjae-dialog-frame', assetPath('images/npcs/seokjae/dialog-frame.png'))
    this.load.spritesheet(
      'seokjae',
      assetPath('images/themes/taekwondo/characters/seokjae_sprite.png'),
      {
        frameWidth: TAEKWONDO_SPRITE_FRAME.width,
        frameHeight: TAEKWONDO_SPRITE_FRAME.height,
        margin: 0,
        spacing: 0,
      },
    )
    loadPlayerSpritesheet(this)
  }

  create() {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.target = null
    this.isDialogVisible = false
    this.dialogDismissed = false

    const background = addCoverBackground(this, 'taekwondo-room-background')
    this.seokjaeInteractionRadius =
      Math.min(background.displayWidth, background.displayHeight) * SEOKJAE_INTERACTION.radiusRatio

    this.physics.world.setBounds(0, 0, vw, vh)
    ensurePlayerWalkAnimations(this)
    this.createSeokjaeNpc(vw, vh)
    this.createDialogUi()

    this.player = createPlayer(this, vw * ROOM_SPAWN.xRatio, vh * ROOM_SPAWN.yRatio)
    this.exitPortal = createRatioRectangle(vw, vh, EXIT_PORTAL)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.on('pointerdown', this.handlePointerDown)
    this.input.keyboard!.on('keydown-ENTER', this.handleEnterDown)
    this.input.keyboard!.on('keydown-ESC', this.handleEscDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handlePointerDown)
      this.input.keyboard?.off('keydown-ENTER', this.handleEnterDown)
      this.input.keyboard?.off('keydown-ESC', this.handleEscDown)
      this.randomPoseTimer?.remove(false)
      this.randomPoseTimer = undefined
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
      blocked: this.isDialogVisible,
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    this.updateSeokjaeTalkIcon()
    this.updateSeokjaeConversation()

    if (
      !this.isDialogVisible &&
      !this.isTransitioning &&
      isPointInRectangle(this.exitPortal, this.player.x, this.player.y)
    ) {
      this.returnToVillage()
    }
  }

  private updateSeokjaeConversation() {
    if (this.isTransitioning) {
      return
    }

    const isNearSeokjae = this.getDistanceToSeokjae() <= this.seokjaeInteractionRadius

    if (!isNearSeokjae) {
      this.dialogDismissed = false
      return
    }

    if (!this.isDialogVisible && !this.dialogDismissed) {
      this.startSeokjaeConversation()
    }
  }

  private startSeokjaeConversation() {
    this.setIntroLine()
    this.isDialogVisible = true
    setInteractionIconActive(this.talkIcon, true)
    fadeSimpleDialog(this, this.dialog, 1, 220)
  }

  private createSeokjaeNpc(vw: number, vh: number) {
    this.seokjaeNpc = this.add
      .sprite(vw * SEOKJAE.xRatio, vh * SEOKJAE.yRatio, 'seokjae', 0)
      .setDepth(6)
    const scale = (Math.min(vw, vh) / TAEKWONDO_SPRITE_FRAME.height) * SEOKJAE.scaleRatio
    this.seokjaeNpc.setScale(scale)
    this.createSeokjaeTalkIcon(vh)
    this.startRandomSeokjaePose()
  }

  private createSeokjaeTalkIcon(vh: number) {
    this.talkIcon = createFloatingInteractionIcon(this, {
      x: this.seokjaeNpc.x,
      y: this.seokjaeNpc.y - vh * SEOKJAE_TALK_ICON_OFFSET.yRatio,
    })
  }

  private updateSeokjaeTalkIcon() {
    setInteractionIconActive(this.talkIcon, this.isDialogVisible)
  }

  private getDistanceToSeokjae() {
    return Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.seokjaeNpc.x,
      this.seokjaeNpc.y,
    )
  }

  private createDialogUi() {
    this.dialog = createSimpleDialogUi(this, {
      frameKey: 'seokjae-dialog-frame',
      textBox: DIALOG_TEXT_BOX,
      dialogWidthRatio: 0.7,
      maxDialogWidth: 1000,
      fontSize: 46,
      lineSpacing: 6,
      nameBox: DIALOG_NAME_BOX,
      nameText: '석재',
      nameFontColor: '#2a1f17',
      nameFontSize: 48,
      nameLetterSpacing: 6,
      opticalOffsets: { single: 0 },
    })
  }

  private setIntroLine() {
    const line = Phaser.Utils.Array.GetRandom(seokjaeSelectDialogs)
    setCenteredDialogText(this.dialog, line.text)
  }

  private closeDialog(markDismissed: boolean) {
    this.isDialogVisible = false
    this.dialogDismissed = markDismissed
    setInteractionIconActive(this.talkIcon, false)
    fadeSimpleDialog(this, this.dialog, 0, 180)
  }

  private startRandomSeokjaePose() {
    this.randomPoseTimer?.remove(false)
    this.seokjaeNpc.setFrame(Phaser.Utils.Array.GetRandom(SEOKJAE_POSES))
    this.randomPoseTimer = this.time.addEvent({
      delay: RANDOM_POSE_DELAY,
      loop: true,
      callback: () => {
        this.seokjaeNpc.setFrame(Phaser.Utils.Array.GetRandom(SEOKJAE_POSES))
      },
    })
  }

  private startPoomsaeSelectScene() {
    if (this.isTransitioning) {
      return
    }

    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)
    this.closeDialog(false)
    fadeToScene(this, 'TaekwondoPoomsaeSelectScene', { duration: 220 })
  }

  private returnToVillage() {
    if (this.isTransitioning) {
      return
    }

    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)

    if (this.isDialogVisible) {
      this.closeDialog(false)
    }

    fadeToScene(this, 'VillageScene', {
      duration: 250,
      data: {
        spawn: RETURN_SPAWN,
        portalCooldownMs: 250,
      },
    })
  }
}
