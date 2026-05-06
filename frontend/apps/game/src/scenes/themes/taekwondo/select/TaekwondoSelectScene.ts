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
import { addCoverBackground } from '@/game/world/background'
import { createRatioRectangle, isPointInRectangle } from '@/game/world/portal'
import {
  seokjaeContentDialogs,
  seokjaeSelectDialogs,
  taekwondoChoiceOptions,
  type SeokjaeDialogLine,
  type TaekwondoChoiceOption,
  type TaekwondoContentMode,
} from '../dialog/seokjaeDialogs'

const TAEKWONDO_SPRITE_FRAME = { width: 384, height: 512 }
const ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.78 }
const EXIT_PORTAL = { xRatio: 0.45, yRatio: 0.8, widthRatio: 0.11, heightRatio: 0.26 }
const RETURN_SPAWN = { xRatio: 0.445, yRatio: 0.15 }
const SEOKJAE = { xRatio: 0.5, yRatio: 0.4, scaleRatio: 0.34 }
const SEOKJAE_INTERACTION = { radiusRatio: 0.08 }
const SEOKJAE_TALK_ICON_OFFSET = { yRatio: 0.15 }
const SEOKJAE_POSES = [0, 1, 2]
const RANDOM_POSE_DELAY = 500
const DIALOG_TEXT_BOX = {
  withChoicesX: 790,
  withChoicesWidth: 1260,
  withChoicesY: 410,
  withoutChoicesX: 790,
  withoutChoicesWidth: 1260,
  withoutChoicesY: 410,
}
const DIALOG_BUTTON_ROW_Y = 548

type SeokjaeDialogStep = {
  line: SeokjaeDialogLine
  choices?: TaekwondoChoiceOption[]
}

type DialogChoiceButton = {
  container: Phaser.GameObjects.Container
  background: Phaser.GameObjects.Image
  label: Phaser.GameObjects.Text
}

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

  private dialogFrame!: Phaser.GameObjects.Image
  private dialogText!: Phaser.GameObjects.Text
  private dialogEnterHint!: Phaser.GameObjects.Image
  private dialogChoiceButtons: DialogChoiceButton[] = []
  private dialogTextBaseX = 0
  private dialogTextBaseY = 0
  private dialogFrameTop = 0
  private dialogTextWrapWidth = 0
  private dialogScale = 1
  private isDialogVisible = false
  private dialogDismissed = false
  private dialogSteps: SeokjaeDialogStep[] = []
  private dialogStepIndex = 0
  private selectedMode: TaekwondoContentMode | null = null

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (this.isDialogVisible) {
      const step = this.dialogSteps[this.dialogStepIndex]
      const bounds = this.dialogFrame.getBounds()
      const clickedDialog = isPointInRectangle(bounds, pointer.x, pointer.y)

      if (clickedDialog && step && !step.choices) {
        this.advanceDialog()
      } else if (!clickedDialog) {
        this.closeDialog(true)
      }

      return
    }

    this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
    createClickTargetMarker(this, pointer.x, pointer.y)
  }

  private readonly handleEnterDown = () => {
    if (!this.isDialogVisible) {
      return
    }

    this.advanceDialog()
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
    this.load.image('dialog-enter', assetPath('images/ui/dialog/enter.png'))
    this.load.image('dialog-select', assetPath('images/ui/dialog/select.png'))
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
    this.dialogSteps = []
    this.dialogStepIndex = 0
    this.selectedMode = null

    const background = addCoverBackground(this, 'taekwondo-room-background')
    this.seokjaeInteractionRadius =
      Math.min(background.displayWidth, background.displayHeight) * SEOKJAE_INTERACTION.radiusRatio

    this.physics.world.setBounds(0, 0, vw, vh)
    ensurePlayerWalkAnimations(this)
    this.createSeokjaeNpc(vw, vh)
    this.createDialogUi(vw, vh)

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
    this.selectedMode = null
    this.dialogSteps = [
      { line: Phaser.Utils.Array.GetRandom(seokjaeSelectDialogs.greeting) },
      {
        line: Phaser.Utils.Array.GetRandom(seokjaeSelectDialogs['choice-prompt']),
        choices: taekwondoChoiceOptions,
      },
    ]
    this.dialogStepIndex = 0
    this.isDialogVisible = true
    setInteractionIconActive(this.talkIcon, true)
    this.renderDialogStep()
    this.fadeDialog(1, 220)
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
    setInteractionIconActive(
      this.talkIcon,
      this.getDistanceToSeokjae() <= this.seokjaeInteractionRadius,
    )
  }

  private getDistanceToSeokjae() {
    return Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.seokjaeNpc.x,
      this.seokjaeNpc.y,
    )
  }

  private renderDialogStep() {
    const step = this.dialogSteps[this.dialogStepIndex]
    if (!step) {
      return
    }

    const showChoices = Boolean(step.choices?.length)
    this.dialogTextBaseX =
      this.dialogFrame.x -
      this.dialogFrame.displayWidth / 2 +
      (showChoices ? DIALOG_TEXT_BOX.withChoicesX : DIALOG_TEXT_BOX.withoutChoicesX) *
        this.dialogScale
    this.dialogTextWrapWidth =
      (showChoices ? DIALOG_TEXT_BOX.withChoicesWidth : DIALOG_TEXT_BOX.withoutChoicesWidth) *
      this.dialogScale
    this.dialogTextBaseY =
      this.dialogFrameTop +
      (showChoices ? DIALOG_TEXT_BOX.withChoicesY : DIALOG_TEXT_BOX.withoutChoicesY) *
        this.dialogScale
    this.dialogText.setText(step.line.text)
    this.dialogText.setWordWrapWidth(this.dialogTextWrapWidth, true)
    this.layoutDialogText()
    this.dialogEnterHint.setVisible(!showChoices)
    this.setChoiceButtonsVisible(false)

    if (showChoices && step.choices) {
      this.renderChoiceButtons(step.choices)
    }
  }

  private renderChoiceButtons(choices: TaekwondoChoiceOption[]) {
    this.setChoiceButtonsVisible(false)

    const dialogTop = this.dialogFrame.y - this.dialogFrame.displayHeight
    const buttonWidth = 430 * this.dialogScale
    const buttonHeight = buttonWidth * (887 / 1774)
    const gap = 36 * this.dialogScale
    const totalWidth = buttonWidth * choices.length + gap * Math.max(0, choices.length - 1)
    const firstCenterX =
      this.dialogTextBaseX + this.dialogTextWrapWidth / 2 - totalWidth / 2 + buttonWidth / 2
    const buttonCenterY = dialogTop + DIALOG_BUTTON_ROW_Y * this.dialogScale

    choices.forEach((choice, index) => {
      const button = this.dialogChoiceButtons[index]
      if (!button) {
        console.error(`Missing taekwondo dialog choice button for index ${index}`)
        return
      }

      button.container.setPosition(firstCenterX + index * (buttonWidth + gap), buttonCenterY)
      button.background.setDisplaySize(buttonWidth, buttonHeight)
      button.label.setText(choice.label)
      button.label.setStyle({ fontSize: `${Math.max(22, Math.round(34 * this.dialogScale))}px` })
      button.container.setData('mode', choice.mode)
      button.container.setVisible(true)
      button.container.setAlpha(1)
    })
  }

  private setChoiceButtonsVisible(visible: boolean) {
    this.dialogChoiceButtons.forEach(button => {
      button.container.setVisible(visible)
      button.container.setAlpha(visible ? 1 : 0)
    })
  }

  private handleChoiceSelected(mode: TaekwondoContentMode) {
    this.selectedMode = mode
    const confirmLine = Phaser.Utils.Array.GetRandom(seokjaeContentDialogs[mode].confirm)
    this.dialogSteps = [...this.dialogSteps, { line: confirmLine }]
    this.dialogStepIndex = this.dialogSteps.length - 1
    this.renderDialogStep()
  }

  private advanceDialog() {
    const step = this.dialogSteps[this.dialogStepIndex]
    if (!step || step.choices) {
      return
    }

    if (this.dialogStepIndex < this.dialogSteps.length - 1) {
      this.dialogStepIndex += 1
      this.renderDialogStep()
      return
    }

    if (this.selectedMode === 'practice') {
      this.startPoomsaeSelectScene()
      return
    }

    this.closeDialog(true)
  }

  private closeDialog(markDismissed: boolean) {
    this.isDialogVisible = false
    this.dialogDismissed = markDismissed
    this.dialogSteps = []
    this.dialogStepIndex = 0
    this.selectedMode = null
    setInteractionIconActive(this.talkIcon, false)
    this.setChoiceButtonsVisible(false)
    this.fadeDialog(0, 180)
  }

  private fadeDialog(alpha: number, duration: number) {
    const targets: Phaser.GameObjects.GameObject[] = [
      this.dialogFrame,
      this.dialogText,
      this.dialogEnterHint,
      ...this.dialogChoiceButtons.map(button => button.container),
    ]

    this.tweens.killTweensOf(targets)
    this.tweens.add({
      targets,
      alpha,
      duration,
      ease: alpha > 0 ? 'Sine.easeOut' : 'Sine.easeIn',
    })
  }

  private createDialogUi(vw: number, vh: number) {
    const dialogSource = this.textures
      .get('seokjae-dialog-frame')
      .getSourceImage() as HTMLImageElement
    this.createDialogFrame(vw, vh, dialogSource)

    this.dialogScale = this.dialogFrame.displayWidth / dialogSource.width
    const dialogLeft = this.dialogFrame.x - this.dialogFrame.displayWidth / 2
    const dialogTop = this.dialogFrame.y - this.dialogFrame.displayHeight
    this.dialogFrameTop = dialogTop

    this.dialogTextBaseX = dialogLeft + DIALOG_TEXT_BOX.withChoicesX * this.dialogScale
    this.dialogTextWrapWidth = DIALOG_TEXT_BOX.withChoicesWidth * this.dialogScale

    this.createDialogText()
    this.createDialogEnterHint(dialogLeft, dialogTop)
    this.createChoiceButtons()
  }

  private createDialogFrame(vw: number, vh: number, dialogSource: HTMLImageElement) {
    const dialogWidth = Math.min(vw * 0.78, 1080)

    this.dialogFrame = this.add.image(vw / 2, vh - 18, 'seokjae-dialog-frame')
    this.dialogFrame.setDisplaySize(
      dialogWidth,
      dialogWidth * (dialogSource.height / dialogSource.width),
    )
    this.dialogFrame.setOrigin(0.5, 1).setDepth(30).setScrollFactor(0).setAlpha(0)
    this.dialogFrame.setInteractive({ useHandCursor: true })
    this.dialogFrame.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()

        if (!this.isDialogVisible) {
          return
        }

        const step = this.dialogSteps[this.dialogStepIndex]
        if (step && !step.choices) {
          this.advanceDialog()
        }
      },
    )
  }

  private createDialogText() {
    this.dialogText = this.add.text(this.dialogTextBaseX, this.dialogTextBaseY, '', {
      fontFamily: 'sans-serif',
      fontSize: `${Math.max(18, Math.round(40 * this.dialogScale))}px`,
      color: '#3b2a1f',
      wordWrap: { width: this.dialogTextWrapWidth, useAdvancedWrap: true },
      lineSpacing: Math.round(4 * this.dialogScale),
    })
    this.dialogText.setDepth(31).setScrollFactor(0).setOrigin(0, 0).setAlpha(0)
  }

  private createDialogEnterHint(dialogLeft: number, dialogTop: number) {
    this.dialogEnterHint = this.add.image(
      dialogLeft + this.dialogFrame.displayWidth - 92 * this.dialogScale,
      dialogTop + this.dialogFrame.displayHeight - 86 * this.dialogScale,
      'dialog-enter',
    )
    this.dialogEnterHint
      .setDisplaySize(38 * this.dialogScale, 26 * this.dialogScale)
      .setOrigin(0.5)
      .setDepth(31)
      .setScrollFactor(0)
      .setAlpha(0)
  }

  private createChoiceButtons() {
    this.dialogChoiceButtons = taekwondoChoiceOptions.map(choice => {
      const background = this.add.image(0, 0, 'dialog-select').setDepth(31)
      const label = this.add
        .text(0, 0, choice.label, {
          fontFamily: 'sans-serif',
          fontSize: `${Math.max(18, Math.round(32 * this.dialogScale))}px`,
          color: '#5d3c22',
          align: 'center',
        })
        .setDepth(32)
        .setOrigin(0.5)
      const mode = choice.mode

      background.setInteractive({ useHandCursor: true })
      background.on('pointerover', () => background.setTint(0xf8edd6))
      background.on('pointerout', () => background.clearTint())
      background.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event.stopPropagation()
          this.handleChoiceSelected(mode)
        },
      )

      const container = this.add.container(0, 0, [background, label])
      container.setDepth(31).setAlpha(0).setVisible(false).setScrollFactor(0)
      return { container, background, label }
    })
  }

  private layoutDialogText() {
    const step = this.dialogSteps[this.dialogStepIndex]
    const lineCount = this.dialogText.getWrappedText(this.dialogText.text).length
    const hasChoices = Boolean(step?.choices?.length)
    const yOffset = hasChoices && lineCount >= 2 ? 18 * this.dialogScale : 0

    this.dialogText.setPosition(this.dialogTextBaseX, this.dialogTextBaseY - yOffset)
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
