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
import { addCoverBackground } from '@/game/world/background'
import { createRatioRectangle, isPointInRectangle } from '@/game/world/portal'
import {
  artChoiceOptions,
  rumiContentDialogs,
  rumiSelectDialogs,
  type ArtChoiceOption,
  type ArtContentMode,
  type RumiDialogLine,
} from '../dialog/rumiDialogs'

const ART_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.76 }
const ART_EXIT_PORTAL = { xRatio: 0.44, yRatio: 0.86, widthRatio: 0.12, heightRatio: 0.12 }
const ART_RETURN_SPAWN = { xRatio: 0.585, yRatio: 0.855 }
const RUMI_TALK_ICON = { xRatio: 0.335, yRatio: 0.33 }
const RUMI_INTERACTION = { xRatio: 0.335, yRatio: 0.55, radiusRatio: 0.06 }
const ALBUM_OBJECT = { xRatio: 0.768, yRatio: 0.638, sizeRatio: 0.086 }
const DIALOG_TEXT_BOX = {
  withChoicesX: 790,
  withChoicesWidth: 1260,
  withChoicesY: 410,
  withoutChoicesX: 900,
  withoutChoicesWidth: 1040,
  withoutChoicesY: 445,
}
const DIALOG_BUTTON_ROW_Y = 548
const CONTENT_CONFIRM_VISIBLE_MS = 1400

type ArtSelectSceneData = {
  spawn?: RatioPoint
  suppressRumiDialog?: boolean
}

type RumiDialogStep = {
  line: RumiDialogLine
  choices?: ArtChoiceOption[]
}

export class ArtSelectScene extends Phaser.Scene {
  private player!: PlayerSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private isTransitioning = false

  private talkIcon!: Phaser.GameObjects.Image
  private rumiAnchor = new Phaser.Math.Vector2()
  private rumiInteractionRadius = 0

  private dialogFrame!: Phaser.GameObjects.Image
  private dialogText!: Phaser.GameObjects.Text
  private dialogEnterHint!: Phaser.GameObjects.Image
  private dialogChoiceButtons: Phaser.GameObjects.Container[] = []
  private dialogTextBaseX = 0
  private dialogTextBaseY = 0
  private dialogFrameTop = 0
  private dialogTextWrapWidth = 0
  private dialogScale = 1
  private isAlbumVisible = false

  private isDialogVisible = false
  private dialogDismissed = false
  private dialogSteps: RumiDialogStep[] = []
  private dialogStepIndex = 0
  private selectedMode: ArtContentMode | null = null
  private isWaitingContentStart = false
  private contentStartReadyAt = 0
  private contentStartTimer: Phaser.Time.TimerEvent | null = null

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

    if (this.isAlbumVisible) {
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
    if (this.isAlbumVisible) {
      this.closeAlbum()
      return
    }

    if (!this.isDialogVisible) {
      return
    }

    this.closeDialog(true)
  }

  constructor() {
    super({ key: 'ArtSelectScene' })
  }

  preload() {
    this.load.image('art-room-background', '/assets/images/themes/art/background/background.png')
    loadInteractionIcons(this)
    this.load.image('rumi-dialog-frame', '/assets/images/npcs/rumi/dialog-frame.png')
    this.load.image('dialog-enter', '/assets/images/ui/dialog/enter.png')
    this.load.image('dialog-select', '/assets/images/ui/dialog/select.png')
    this.load.image('art-ui-album', '/assets/images/themes/art/ui/album.png')
    loadPlayerSpritesheet(this)
  }

  create(data: ArtSelectSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.isDialogVisible = false
    this.dialogDismissed = Boolean(data.suppressRumiDialog)
    this.target = null
    this.dialogSteps = []
    this.dialogStepIndex = 0
    this.selectedMode = null
    this.isWaitingContentStart = false
    this.contentStartReadyAt = 0
    this.clearContentStartTimer()
    const spawn = data.spawn ?? ART_ROOM_SPAWN

    const background = addCoverBackground(this, 'art-room-background')

    const backgroundLeft = background.x - background.displayWidth / 2
    const backgroundTop = background.y - background.displayHeight / 2

    this.createAlbumObject(
      backgroundLeft,
      backgroundTop,
      background.displayWidth,
      background.displayHeight,
    )

    this.talkIcon = createFloatingInteractionIcon(this, {
      x: backgroundLeft + background.displayWidth * RUMI_TALK_ICON.xRatio,
      y: backgroundTop + background.displayHeight * RUMI_TALK_ICON.yRatio,
    })

    this.rumiAnchor.set(
      backgroundLeft + background.displayWidth * RUMI_INTERACTION.xRatio,
      backgroundTop + background.displayHeight * RUMI_INTERACTION.yRatio,
    )
    this.rumiInteractionRadius =
      Math.min(background.displayWidth, background.displayHeight) * RUMI_INTERACTION.radiusRatio

    this.physics.world.setBounds(0, 0, vw, vh)

    ensurePlayerWalkAnimations(this)
    this.createDialogUi(vw, vh)

    this.player = createPlayer(this, vw * spawn.xRatio, vh * spawn.yRatio)

    this.exitPortal = createRatioRectangle(vw, vh, ART_EXIT_PORTAL)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.on('pointerdown', this.handlePointerDown)
    this.input.keyboard!.on('keydown-ENTER', this.handleEnterDown)
    this.input.keyboard!.on('keydown-ESC', this.handleEscDown)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handlePointerDown)
      this.input.keyboard?.off('keydown-ENTER', this.handleEnterDown)
      this.input.keyboard?.off('keydown-ESC', this.handleEscDown)
      this.closeAlbum()
    })

    this.cameras.main.fadeIn(250, 0, 0, 0)
  }

  update() {
    const movement = updatePlayerMovement({
      player: this.player,
      cursors: this.cursors,
      target: this.target,
      lastDirection: this.lastDirection,
      blocked: this.isDialogVisible || this.isAlbumVisible,
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    this.updateRumiConversation()

    if (
      !this.isDialogVisible &&
      isPointInRectangle(this.exitPortal, this.player.x, this.player.y)
    ) {
      this.returnToVillage()
    }
  }

  private updateRumiConversation() {
    if (this.isTransitioning || this.isAlbumVisible) {
      return
    }

    const distanceToRumi = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.rumiAnchor.x,
      this.rumiAnchor.y,
    )
    const isNearRumi = distanceToRumi <= this.rumiInteractionRadius

    if (!isNearRumi) {
      this.dialogDismissed = false
      return
    }

    if (!this.isDialogVisible && !this.dialogDismissed) {
      this.startRumiConversation()
    }
  }

  private startRumiConversation() {
    if (this.isAlbumVisible) {
      return
    }

    this.selectedMode = null
    this.isWaitingContentStart = false
    this.contentStartReadyAt = 0
    this.dialogSteps = [
      { line: Phaser.Utils.Array.GetRandom(rumiSelectDialogs.greeting) },
      {
        line: Phaser.Utils.Array.GetRandom(rumiSelectDialogs['choice-prompt']),
        choices: artChoiceOptions,
      },
    ]
    this.dialogStepIndex = 0
    this.isDialogVisible = true
    setInteractionIconActive(this.talkIcon, true)
    this.renderDialogStep()
    this.fadeDialog(1, 220)
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

  private renderChoiceButtons(choices: ArtChoiceOption[]) {
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
        return
      }

      button.setPosition(firstCenterX + index * (buttonWidth + gap), buttonCenterY)
      const background = button.list[0] as Phaser.GameObjects.Image
      const label = button.list[1] as Phaser.GameObjects.Text

      background.setDisplaySize(buttonWidth, buttonHeight)
      label.setText(choice.label)
      label.setStyle({ fontSize: `${Math.max(22, Math.round(34 * this.dialogScale))}px` })
      button.setData('mode', choice.mode)
      button.setVisible(true)
      button.setAlpha(1)
    })
  }

  private setChoiceButtonsVisible(visible: boolean) {
    this.dialogChoiceButtons.forEach(button => {
      button.setVisible(visible)
      button.setAlpha(visible ? 1 : 0)
    })
  }

  private handleChoiceSelected(mode: ArtContentMode) {
    if (this.isTransitioning) {
      return
    }

    this.clearContentStartTimer()
    this.selectedMode = mode
    this.isWaitingContentStart = true
    this.contentStartReadyAt = this.time.now + CONTENT_CONFIRM_VISIBLE_MS
    const confirmLine = Phaser.Utils.Array.GetRandom(rumiContentDialogs[mode].confirm)
    this.dialogSteps = [...this.dialogSteps, { line: confirmLine }]
    this.dialogStepIndex = this.dialogSteps.length - 1
    this.renderDialogStep()
    this.dialogEnterHint.setVisible(false)
    this.contentStartTimer = this.time.delayedCall(CONTENT_CONFIRM_VISIBLE_MS, () => {
      if (
        this.isDialogVisible &&
        this.isWaitingContentStart &&
        this.selectedMode === mode &&
        !this.isTransitioning
      ) {
        this.startSelectedContent(mode)
      }
    })
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

    if (this.isWaitingContentStart && this.selectedMode) {
      if (this.time.now < this.contentStartReadyAt) {
        return
      }

      this.startSelectedContent(this.selectedMode)
      return
    }

    this.closeDialog(true)
  }

  private closeDialog(markDismissed: boolean) {
    this.clearContentStartTimer()
    this.isDialogVisible = false
    this.dialogDismissed = markDismissed
    this.dialogSteps = []
    this.dialogStepIndex = 0
    this.selectedMode = null
    this.isWaitingContentStart = false
    this.contentStartReadyAt = 0
    setInteractionIconActive(this.talkIcon, false)
    this.setChoiceButtonsVisible(false)
    this.fadeDialog(0, 180)
  }

  private clearContentStartTimer() {
    this.contentStartTimer?.remove(false)
    this.contentStartTimer = null
  }

  private startSelectedContent(mode: ArtContentMode) {
    if (this.isTransitioning) {
      return
    }

    this.clearContentStartTimer()
    this.isTransitioning = true
    this.isWaitingContentStart = false
    this.contentStartReadyAt = 0
    this.target = null
    this.player.setVelocity(0, 0)
    this.closeDialog(false)
    fadeToScene(this, mode === 'free-drawing' ? 'ArtFreeDrawingScene' : 'ArtColoringSelectScene', {
      duration: 220,
    })
  }

  private fadeDialog(alpha: number, duration: number) {
    const targets: Phaser.GameObjects.GameObject[] = [
      this.dialogFrame,
      this.dialogText,
      this.dialogEnterHint,
      ...this.dialogChoiceButtons,
    ]

    this.tweens.killTweensOf(targets)
    this.tweens.add({
      targets,
      alpha,
      duration,
      ease: alpha > 0 ? 'Sine.easeOut' : 'Sine.easeIn',
    })
  }

  private createAlbumObject(
    backgroundLeft: number,
    backgroundTop: number,
    backgroundWidth: number,
    backgroundHeight: number,
  ) {
    const albumSize = backgroundWidth * ALBUM_OBJECT.sizeRatio
    const albumX = backgroundLeft + backgroundWidth * ALBUM_OBJECT.xRatio
    const albumY = backgroundTop + backgroundHeight * ALBUM_OBJECT.yRatio
    const albumGlow = this.add
      .image(albumX, albumY, 'art-ui-album')
      .setDepth(7)
      .setDisplaySize(albumSize * 1.08, albumSize * 1.08)
      .setTint(0xffed9b)
      .setAlpha(0.25)
      .setBlendMode(Phaser.BlendModes.ADD)
    const glowScale = { x: albumGlow.scaleX, y: albumGlow.scaleY }

    this.tweens.add({
      targets: albumGlow,
      alpha: 0.42,
      scaleX: glowScale.x * 1.05,
      scaleY: glowScale.y * 1.05,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    const album = this.add
      .image(albumX, albumY, 'art-ui-album')
      .setDepth(8)
      .setDisplaySize(albumSize, albumSize)
      .setInteractive({ useHandCursor: true })

    const baseScale = { x: album.scaleX, y: album.scaleY }

    album.on('pointerover', () => {
      album.setTint(0xfff3c4)
      album.setScale(baseScale.x * 1.05, baseScale.y * 1.05)
    })
    album.on('pointerout', () => {
      album.clearTint()
      album.setScale(baseScale.x, baseScale.y)
    })
    album.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        album.clearTint()
        album.setScale(baseScale.x, baseScale.y)
        this.openAlbum()
      },
    )
  }

  private openAlbum() {
    if (this.isTransitioning || this.isAlbumVisible) {
      return
    }

    this.target = null
    this.player.setVelocity(0, 0)

    if (this.isDialogVisible) {
      this.closeDialog(false)
    }

    this.isAlbumVisible = true
    const albumScene = this.scene.get('ArtAlbumScene')
    albumScene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.isAlbumVisible = false
    })
    this.scene.launch('ArtAlbumScene')
    this.scene.bringToTop('ArtAlbumScene')
  }

  private closeAlbum() {
    if (!this.isAlbumVisible) {
      this.isAlbumVisible = false
      return
    }

    this.scene.stop('ArtAlbumScene')
    this.isAlbumVisible = false
  }

  private createDialogUi(vw: number, vh: number) {
    const dialogSource = this.textures.get('rumi-dialog-frame').getSourceImage() as HTMLImageElement
    const dialogWidth = Math.min(vw * 0.78, 1080)

    this.dialogFrame = this.add.image(vw / 2, vh - 18, 'rumi-dialog-frame')
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

    this.dialogScale = this.dialogFrame.displayWidth / dialogSource.width
    const dialogLeft = this.dialogFrame.x - this.dialogFrame.displayWidth / 2
    const dialogTop = this.dialogFrame.y - this.dialogFrame.displayHeight
    this.dialogFrameTop = dialogTop

    this.dialogTextBaseX = dialogLeft + DIALOG_TEXT_BOX.withChoicesX * this.dialogScale
    this.dialogTextWrapWidth = DIALOG_TEXT_BOX.withChoicesWidth * this.dialogScale

    this.dialogText = this.add.text(this.dialogTextBaseX, this.dialogTextBaseY, '', {
      fontFamily: 'sans-serif',
      fontSize: `${Math.max(18, Math.round(40 * this.dialogScale))}px`,
      color: '#3b2a1f',
      wordWrap: { width: this.dialogTextWrapWidth, useAdvancedWrap: true },
      lineSpacing: Math.round(4 * this.dialogScale),
    })
    this.dialogText.setDepth(31).setScrollFactor(0).setOrigin(0, 0).setAlpha(0)

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

    this.dialogChoiceButtons = artChoiceOptions.map(choice => {
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
      return container
    })
  }

  private layoutDialogText() {
    const step = this.dialogSteps[this.dialogStepIndex]
    const lineCount = this.dialogText.getWrappedText(this.dialogText.text).length
    const hasChoices = Boolean(step?.choices?.length)
    const yOffset = hasChoices && lineCount >= 2 ? 18 * this.dialogScale : 0

    this.dialogText.setPosition(this.dialogTextBaseX, this.dialogTextBaseY - yOffset)
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
        spawn: ART_RETURN_SPAWN,
        portalCooldownMs: 250,
      },
    })
  }
}
