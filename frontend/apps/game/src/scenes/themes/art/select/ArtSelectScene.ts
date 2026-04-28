import Phaser from 'phaser'
import {
  artChoiceOptions,
  rumiContentDialogs,
  rumiSelectDialogs,
  type ArtChoiceOption,
  type ArtContentMode,
  type RumiDialogLine,
} from '../dialog/rumiDialogs'

const FRAME_SIZE = 313
const SPEED = 180
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
  spawn?: { xRatio: number; yRatio: number }
  suppressRumiDialog?: boolean
}

type RumiDialogStep = {
  line: RumiDialogLine
  choices?: ArtChoiceOption[]
}

export class ArtSelectScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection = 'down'
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
  private albumOverlay: Phaser.GameObjects.Container | null = null
  private isAlbumVisible = false
  private isAlbumPageTurning = false
  private albumPageTurnTimers: Phaser.Time.TimerEvent[] = []

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
      const clickedDialog = Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y)

      if (clickedDialog && step && !step.choices) {
        this.advanceDialog()
      } else if (!clickedDialog) {
        this.closeDialog(true)
      }

      return
    }

    if (this.isAlbumVisible) {
      this.closeAlbum()
      return
    }

    this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
    const marker = this.add.circle(pointer.x, pointer.y, 6, 0xffffff, 0.6)
    this.tweens.add({
      targets: marker,
      alpha: 0,
      scale: 2,
      duration: 400,
      onComplete: () => marker.destroy(),
    })
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
    this.load.image('talk-icon', '/assets/images/ui/icons/talk.png')
    this.load.image('talking-icon', '/assets/images/ui/icons/talking.png')
    this.load.image('rumi-dialog-frame', '/assets/images/npcs/rumi/dialog-frame.png')
    this.load.image('dialog-enter', '/assets/images/ui/dialog/enter.png')
    this.load.image('dialog-select', '/assets/images/ui/dialog/select.png')
    this.load.image('art-ui-album', '/assets/images/themes/art/ui/album.png')
    this.load.image('art-ui-delete-btn', '/assets/images/themes/art/ui/delete_btn.png')
    this.load.image('art-ui-album-page', '/assets/images/themes/art/ui/album_page.png')
    this.load.image('art-ui-album-next1', '/assets/images/themes/art/ui/album_next1.png')
    this.load.image('art-ui-album-next2', '/assets/images/themes/art/ui/album_next2.png')
    this.load.spritesheet('character', '/assets/images/common/player/character_sheet.png', {
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
      margin: 0,
      spacing: 0,
    })
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

    const background = this.add.image(vw / 2, vh / 2, 'art-room-background')
    const source = background.texture.getSourceImage() as HTMLImageElement
    const scale = Math.max(vw / source.width, vh / source.height)
    background.setScale(scale).setDepth(0)

    const backgroundLeft = background.x - background.displayWidth / 2
    const backgroundTop = background.y - background.displayHeight / 2

    this.createAlbumObject(
      backgroundLeft,
      backgroundTop,
      background.displayWidth,
      background.displayHeight,
    )

    this.talkIcon = this.add
      .image(
        backgroundLeft + background.displayWidth * RUMI_TALK_ICON.xRatio,
        backgroundTop + background.displayHeight * RUMI_TALK_ICON.yRatio,
        'talk-icon',
      )
      .setDepth(12)
      .setDisplaySize(56, 56)

    this.tweens.add({
      targets: this.talkIcon,
      y: this.talkIcon.y - 10,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.rumiAnchor.set(
      backgroundLeft + background.displayWidth * RUMI_INTERACTION.xRatio,
      backgroundTop + background.displayHeight * RUMI_INTERACTION.yRatio,
    )
    this.rumiInteractionRadius =
      Math.min(background.displayWidth, background.displayHeight) * RUMI_INTERACTION.radiusRatio

    this.physics.world.setBounds(0, 0, vw, vh)

    this.ensureCharacterAnimations()
    this.createDialogUi(vw, vh)

    this.player = this.physics.add.sprite(vw * spawn.xRatio, vh * spawn.yRatio, 'character', 0)
    this.player.setScale(0.55).setDepth(10)
    this.player.setCollideWorldBounds(true)
    this.player.body.setSize(FRAME_SIZE * 0.35, FRAME_SIZE * 0.25)
    this.player.body.setOffset(FRAME_SIZE * 0.33, FRAME_SIZE * 0.65)

    this.exitPortal = new Phaser.Geom.Rectangle(
      vw * ART_EXIT_PORTAL.xRatio,
      vh * ART_EXIT_PORTAL.yRatio,
      vw * ART_EXIT_PORTAL.widthRatio,
      vh * ART_EXIT_PORTAL.heightRatio,
    )

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
    const { left, right, up, down } = this.cursors
    const isKeyPressed = left.isDown || right.isDown || up.isDown || down.isDown

    let vx = 0
    let vy = 0

    if (isKeyPressed) {
      this.target = null
      if (left.isDown) {
        vx -= SPEED
        this.lastDirection = 'left'
      }
      if (right.isDown) {
        vx += SPEED
        this.lastDirection = 'right'
      }
      if (up.isDown) {
        vy -= SPEED
        this.lastDirection = 'up'
      }
      if (down.isDown) {
        vy += SPEED
        this.lastDirection = 'down'
      }
      if (vx !== 0 && vy !== 0) {
        vx *= 0.707
        vy *= 0.707
      }
    } else if (this.target) {
      const dx = this.target.x - this.player.x
      const dy = this.target.y - this.player.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 6) {
        this.target = null
      } else {
        const speed = Math.min(SPEED, dist * 5)
        vx = (dx / dist) * speed
        vy = (dy / dist) * speed
        if (Math.abs(dx) > Math.abs(dy)) {
          this.lastDirection = dx > 0 ? 'right' : 'left'
        } else {
          this.lastDirection = dy > 0 ? 'down' : 'up'
        }
      }
    }

    if (this.isDialogVisible || this.isAlbumVisible) {
      vx = 0
      vy = 0
      this.target = null
    }

    this.player.setVelocity(vx, vy)

    const moving = vx !== 0 || vy !== 0
    if (moving) {
      const anim = `walk-${this.lastDirection}`
      if (this.player.anims.currentAnim?.key !== anim || !this.player.anims.isPlaying) {
        this.player.anims.play(anim)
      }
    } else {
      this.player.anims.stop()
    }

    this.updateRumiConversation()

    if (
      !this.isDialogVisible &&
      Phaser.Geom.Rectangle.Contains(this.exitPortal, this.player.x, this.player.y)
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
    this.talkIcon.setTexture('talking-icon')
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
    this.talkIcon.setTexture('talk-icon')
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
    this.cameras.main.fadeOut(220, 0, 0, 0)

    this.time.delayedCall(220, () => {
      if (mode === 'free-drawing') {
        this.scene.start('ArtFreeDrawingScene', { suppressIntroDialog: true })
        return
      }

      this.scene.start('ArtColoringSelectScene', { suppressIntroDialog: true })
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

    const { width: vw, height: vh } = this.scale
    const dim = this.add
      .rectangle(vw / 2, vh / 2, vw, vh, 0x000000, 1)
      .setDepth(40)
      .setScrollFactor(0)
      .setAlpha(0)
      .setInteractive()

    const albumPageSource = this.textures
      .get('art-ui-album-page')
      .getSourceImage() as HTMLImageElement
    const albumPageRatio = albumPageSource.width / albumPageSource.height
    const albumPageHeight = Math.min(vh * 0.96, (vw * 0.94) / albumPageRatio)
    const albumPageWidth = albumPageHeight * albumPageRatio
    const albumPage = this.add
      .image(vw / 2, vh / 2, 'art-ui-album-page')
      .setDepth(41)
      .setDisplaySize(albumPageWidth, albumPageHeight)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0)
    const albumPageScale = { x: albumPage.scaleX, y: albumPage.scaleY }
    albumPage.setScale(albumPageScale.x * 0.98, albumPageScale.y * 0.98)

    const pageTurnFrame = this.add
      .image(vw / 2, vh / 2, 'art-ui-album-next1')
      .setDepth(42)
      .setDisplaySize(albumPageWidth, albumPageHeight)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false)
    const pageTurnMaskShape = this.make.graphics({}, false)
    const pageTurnMaskLeft = vw / 2 - albumPageWidth * 0.32
    const pageTurnMaskTop = vh / 2 - albumPageHeight * 0.48
    const pageTurnMaskWidth = albumPageWidth * 0.64
    pageTurnMaskShape.fillStyle(0xffffff)
    pageTurnMaskShape.fillRect(
      pageTurnMaskLeft,
      pageTurnMaskTop,
      pageTurnMaskWidth,
      albumPageHeight * 0.72,
    )
    pageTurnMaskShape.fillTriangle(
      pageTurnMaskLeft,
      vh / 2 + albumPageHeight * 0.24,
      pageTurnMaskLeft + pageTurnMaskWidth,
      vh / 2 + albumPageHeight * 0.24,
      vw / 2,
      vh / 2 + albumPageHeight * 0.33,
    )
    pageTurnFrame.setMask(pageTurnMaskShape.createGeometryMask())
    pageTurnFrame.on('destroy', () => pageTurnMaskShape.destroy())

    const pageTurnZoneWidth = albumPageWidth * 0.28
    const pageTurnZoneHeight = albumPageHeight * 0.76
    const previousPageZone = this.add
      .zone(vw / 2 - albumPageWidth * 0.28, vh / 2, pageTurnZoneWidth, pageTurnZoneHeight)
      .setDepth(42)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    const nextPageZone = this.add
      .zone(vw / 2 + albumPageWidth * 0.28, vh / 2, pageTurnZoneWidth, pageTurnZoneHeight)
      .setDepth(42)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    const turnAlbumPage = (direction: 'next' | 'previous') => {
      if (this.isAlbumPageTurning) {
        return
      }

      this.isAlbumPageTurning = true
      this.clearAlbumPageTurnTimers()
      this.isAlbumPageTurning = true

      const frameKeys =
        direction === 'next'
          ? ['art-ui-album-next1', 'art-ui-album-next2']
          : ['art-ui-album-next2', 'art-ui-album-next1']

      frameKeys.forEach((frameKey, index) => {
        const timer = this.time.delayedCall(115 * index, () => {
          if (!this.albumOverlay || !this.isAlbumVisible || !pageTurnFrame.active) {
            return
          }

          pageTurnFrame
            .setTexture(frameKey)
            .setDisplaySize(albumPageWidth, albumPageHeight)
            .setAlpha(1)
            .setVisible(true)

          if (index === frameKeys.length - 1) {
            const hideTimer = this.time.delayedCall(115, () => {
              if (pageTurnFrame.active) {
                pageTurnFrame.setAlpha(0).setVisible(false)
              }
              this.clearAlbumPageTurnTimers()
            })
            this.albumPageTurnTimers.push(hideTimer)
          }
        })
        this.albumPageTurnTimers.push(timer)
      })
    }

    previousPageZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        turnAlbumPage('previous')
      },
    )
    nextPageZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        turnAlbumPage('next')
      },
    )
    albumPage.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => event.stopPropagation(),
    )

    const closeButtonSource = this.textures
      .get('art-ui-delete-btn')
      .getSourceImage() as HTMLImageElement
    const closeButtonSize = Math.min(64, Math.max(46, vh * 0.07))
    const closeButton = this.add
      .image(vw - 32 - closeButtonSize / 2, 32 + closeButtonSize / 2, 'art-ui-delete-btn')
      .setDepth(43)
      .setDisplaySize(
        closeButtonSize,
        closeButtonSize * (closeButtonSource.height / closeButtonSource.width),
      )
      .setScrollFactor(0)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true })
    const closeButtonScale = { x: closeButton.scaleX, y: closeButton.scaleY }
    closeButton.on('pointerover', () => {
      closeButton.setTint(0xfff3c4)
      closeButton.setScale(closeButtonScale.x * 1.06, closeButtonScale.y * 1.06)
    })
    closeButton.on('pointerout', () => {
      closeButton.clearTint()
      closeButton.setScale(closeButtonScale.x, closeButtonScale.y)
    })
    closeButton.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.closeAlbum()
      },
    )

    dim.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.closeAlbum()
      },
    )

    this.albumOverlay = this.add
      .container(0, 0, [dim, albumPage, pageTurnFrame, previousPageZone, nextPageZone, closeButton])
      .setDepth(40)
    this.isAlbumVisible = true

    this.tweens.add({
      targets: dim,
      alpha: 0.56,
      duration: 160,
      ease: 'Sine.easeOut',
    })
    this.tweens.add({
      targets: albumPage,
      alpha: 1,
      scaleX: albumPageScale.x,
      scaleY: albumPageScale.y,
      duration: 180,
      ease: 'Sine.easeOut',
    })
    this.tweens.add({
      targets: closeButton,
      alpha: 1,
      duration: 160,
      ease: 'Sine.easeOut',
    })
  }

  private closeAlbum() {
    if (!this.albumOverlay) {
      this.isAlbumVisible = false
      return
    }

    this.tweens.killTweensOf(this.albumOverlay.list)
    this.clearAlbumPageTurnTimers()
    this.albumOverlay.destroy(true)
    this.albumOverlay = null
    this.isAlbumVisible = false
  }

  private clearAlbumPageTurnTimers() {
    this.albumPageTurnTimers.forEach(timer => timer.remove(false))
    this.albumPageTurnTimers = []
    this.isAlbumPageTurning = false
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

    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.time.delayedCall(250, () => {
      this.scene.start('VillageScene', {
        spawn: ART_RETURN_SPAWN,
        portalCooldownMs: 250,
      })
    })
  }

  private ensureCharacterAnimations() {
    if (!this.anims.exists('walk-down')) {
      this.anims.create({
        key: 'walk-down',
        frames: this.anims.generateFrameNumbers('character', { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      })
    }
    if (!this.anims.exists('walk-left')) {
      this.anims.create({
        key: 'walk-left',
        frames: this.anims.generateFrameNumbers('character', { start: 4, end: 7 }),
        frameRate: 8,
        repeat: -1,
      })
    }
    if (!this.anims.exists('walk-right')) {
      this.anims.create({
        key: 'walk-right',
        frames: this.anims.generateFrameNumbers('character', { start: 8, end: 11 }),
        frameRate: 8,
        repeat: -1,
      })
    }
    if (!this.anims.exists('walk-up')) {
      this.anims.create({
        key: 'walk-up',
        frames: this.anims.generateFrameNumbers('character', { start: 12, end: 15 }),
        frameRate: 8,
        repeat: -1,
      })
    }
  }
}
