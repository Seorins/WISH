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
import { createRatioRectangle, getRectangleEntryState } from '@/game/world/portal'
import {
  gisungChoiceDialogs,
  gisungSelectDialogs,
  musicChoiceOptions,
  type MusicChoiceOption,
  type MusicContentMode,
} from '../dialog/gisungDialogs'

const MUSIC_SPRITE_FRAME = { width: 600, height: 600 }
const MUSIC_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.78 }
const MUSIC_EXIT_PORTAL = { xRatio: 0.43, yRatio: 0.86, widthRatio: 0.14, heightRatio: 0.12 }
const MUSIC_RETURN_SPAWN = { xRatio: 0.235, yRatio: 0.44 }
const GISUNG_ON_WINDOW = { xRatio: 0.5, bottomYRatio: 0.38, heightRatio: 0.22 }
const GISUNG_INTERACTION_RADIUS_RATIO = 0.12
const GISUNG_TALK_ICON_OFFSET_RATIO = 1.05
const DIALOG_TEXT_BOX = { x: 900, y: 400, width: 1060, height: 180 }
const CARD_DEPTH = 24
const CARD_FONT_FAMILY = '"Malgun Gothic", "Noto Sans KR", sans-serif'
const CARD_FRAME_ASPECT_RATIO = 408 / 612
const CONTENT_CONFIRM_VISIBLE_MS = 1300
const MUSIC_CONTENT_SCENE_KEYS: Record<MusicContentMode, string> = {
  'rhythm-game': 'MusicRhythmScene',
  'free-play': 'MusicFreePlayScene',
}

type MusicSelectSceneData = {
  spawn?: RatioPoint
}

type MusicCardView = {
  choice: MusicChoiceOption
  container: Phaser.GameObjects.Container
  frame: Phaser.GameObjects.Image
  selectButton: Phaser.GameObjects.Graphics
  selectLabel: Phaser.GameObjects.Text
  baseX: number
  baseY: number
  width: number
  height: number
}

type MusicDialogPhase = 'closed' | 'intro' | 'choice' | 'confirm'

export class MusicSelectScene extends Phaser.Scene {
  private player!: PlayerSprite
  private gisungNpc!: Phaser.GameObjects.Sprite
  private gisungAnchor = new Phaser.Math.Vector2()
  private gisungInteractionRadius = 0
  private talkIcon!: Phaser.GameObjects.Image
  private dialog!: SimpleDialogUi
  private cards: MusicCardView[] = []
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private playerWasInExitPortal = true
  private isTransitioning = false
  private isDialogVisible = false
  private dialogDismissed = false
  private dialogPhase: MusicDialogPhase = 'closed'
  private hoveredMode: MusicContentMode | null = null
  private selectedMode: MusicContentMode | null = null
  private isWaitingContentStart = false
  private contentStartTimer: Phaser.Time.TimerEvent | null = null

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (this.isDialogVisible) {
      if (this.isWaitingContentStart) {
        return
      }

      const clickedDialog = this.dialog.frame.getBounds().contains(pointer.x, pointer.y)

      if (this.dialogPhase === 'intro' && clickedDialog) {
        this.showChoicePrompt()
        return
      }

      if (this.dialogPhase === 'choice') {
        const clickedCard = this.getCardAtPointer(pointer)

        if (clickedCard) {
          this.handleChoiceSelected(clickedCard.choice.mode)
          return
        }

        this.closeDialog(true)
        return
      }

      if (clickedDialog) {
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
      this.advanceDialog()
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
    this.load.image('music-card-frame', assetPath('images/themes/music/ui/frame.png'))
    this.load.image('music-gisung-card-1', assetPath('images/themes/music/ui/gisung_card1.png'))
    this.load.image('music-gisung-card-2', assetPath('images/themes/music/ui/gisung_card2.png'))
    this.load.image('music-piano', assetPath('images/themes/music/ui/piano.png'))
    this.load.image('music-violin', assetPath('images/themes/music/ui/violin.png'))
    Array.from({ length: 5 }, (_, index) => {
      this.load.image(
        `music-note-${index + 1}`,
        assetPath(`images/themes/music/ui/note${index + 1}.png`),
      )
    })
    loadPlayerSpritesheet(this)
  }

  create(data: MusicSelectSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.isDialogVisible = false
    this.dialogDismissed = false
    this.dialogPhase = 'closed'
    this.hoveredMode = null
    this.selectedMode = null
    this.isWaitingContentStart = false
    this.target = null
    this.playerWasInExitPortal = true
    this.cards = []
    this.clearContentStartTimer()

    const background = addCoverBackground(this, 'music-background')
    this.createGisungAnimation()
    this.createGisungOnWindow(background)
    this.createDialogUi()
    this.createChoiceCards(vw, vh)

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
      this.clearContentStartTimer()
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
      speed: getPlayerMoveSpeed(),
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

  private createChoiceCards(vw: number, vh: number) {
    const cardHeight = Phaser.Math.Clamp(vh * 0.78, 540, 690)
    const cardWidth = cardHeight * (CARD_FRAME_ASPECT_RATIO + 0.055)
    const gap = Phaser.Math.Clamp(vw * 0.04, 56, 86)
    const totalWidth = cardWidth * musicChoiceOptions.length + gap
    const firstX = vw / 2 - totalWidth / 2 + cardWidth / 2
    const centerY = Phaser.Math.Clamp(vh * 0.55, 42 + cardHeight / 2, vh - cardHeight / 2 - 34)

    this.cards = musicChoiceOptions.map((choice, index) =>
      this.createChoiceCard(
        choice,
        firstX + index * (cardWidth + gap),
        centerY,
        cardWidth,
        cardHeight,
      ),
    )
    this.hideCards(true)
  }

  private createChoiceCard(
    choice: MusicChoiceOption,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const container = this.add.container(x, y).setDepth(CARD_DEPTH).setAlpha(0).setVisible(false)
    container.setSize(width, height)
    container.setScrollFactor(0)
    container.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains,
    )
    container.input!.cursor = 'pointer'

    const frame = this.add.image(0, 0, 'music-card-frame').setDisplaySize(width, height)
    container.add(frame)

    if (choice.mode === 'rhythm-game') {
      this.createRhythmCardArt(container, width, height)
    } else {
      this.createFreePlayCardArt(container, width, height)
    }

    const title = this.add
      .text(0, -height * 0.335, choice.label, {
        fontFamily: CARD_FONT_FAMILY,
        fontSize: `${Math.round(height * 0.054)}px`,
        fontStyle: 'bold',
        color: '#3f2c1d',
        stroke: '#f4dfbd',
        strokeThickness: Math.max(2, Math.round(height * 0.003)),
        align: 'center',
      })
      .setOrigin(0.5)
    const description = this.add
      .text(0, -height * 0.27, choice.description, {
        fontFamily: CARD_FONT_FAMILY,
        fontSize: `${Math.round(height * 0.026)}px`,
        fontStyle: 'bold',
        color: '#5f4630',
        align: 'center',
        wordWrap: { width: width * 0.78, useAdvancedWrap: true },
      })
      .setOrigin(0.5)

    const selectButton = this.add.graphics()
    const selectLabel = this.add
      .text(0, height * 0.365, '선택', {
        fontFamily: CARD_FONT_FAMILY,
        fontSize: `${Math.round(height * 0.034)}px`,
        fontStyle: 'bold',
        color: '#fff0d0',
        stroke: '#332012',
        strokeThickness: Math.max(2, Math.round(height * 0.004)),
        align: 'center',
      })
      .setOrigin(0.5)

    container.add([title, description, selectButton, selectLabel])
    const card: MusicCardView = {
      choice,
      container,
      frame,
      selectButton,
      selectLabel,
      baseX: x,
      baseY: y,
      width,
      height,
    }

    container.on('pointerover', () => this.handleCardHover(choice.mode))
    container.on('pointerout', () => this.handleCardOut(choice.mode))
    container.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.handleChoiceSelected(choice.mode)
      },
    )

    return card
  }

  private getCardAtPointer(pointer: Phaser.Input.Pointer) {
    return this.cards.find(card => {
      if (!card.container.visible || card.container.alpha <= 0) {
        return false
      }

      const scaleX = card.container.scaleX
      const scaleY = card.container.scaleY
      const width = card.width * scaleX
      const height = card.height * scaleY

      return Phaser.Geom.Rectangle.Contains(
        new Phaser.Geom.Rectangle(
          card.container.x - width / 2,
          card.container.y - height / 2,
          width,
          height,
        ),
        pointer.x,
        pointer.y,
      )
    })
  }

  private createRhythmCardArt(
    container: Phaser.GameObjects.Container,
    width: number,
    height: number,
  ) {
    const beatLine = this.add.graphics()
    beatLine.lineStyle(Math.max(3, Math.round(width * 0.014)), 0xa879d6, 0.52)
    beatLine.lineBetween(-width * 0.31, height * 0.245, width * 0.31, height * 0.245)
    beatLine.lineStyle(Math.max(2, Math.round(width * 0.008)), 0xffffff, 0.76)
    beatLine.lineBetween(-width * 0.27, height * 0.245, width * 0.27, height * 0.245)

    const notePositions = [
      { xRatio: -0.23, yRatio: -0.16, endYRatio: 0.08 },
      { xRatio: 0.22, yRatio: -0.22, endYRatio: 0.13 },
      { xRatio: -0.04, yRatio: -0.06, endYRatio: 0.19 },
    ]
    const notes = notePositions.map((position, index) => {
      const note = this.add
        .image(width * position.xRatio, height * position.yRatio, `music-note-${(index % 5) + 1}`)
        .setDisplaySize(height * 0.07, height * 0.07)
        .setAlpha(0.82)
      this.tweens.add({
        targets: note,
        y: height * position.endYRatio,
        alpha: 0.2,
        duration: 4300 + index * 320,
        delay: index * 780,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onRepeat: () => note.setAlpha(0.82),
      })
      return note
    })

    const character = this.add
      .image(0, height * 0.065, 'music-gisung-card-1')
      .setDisplaySize(height * 0.35, height * 0.415)
      .setAlpha(0.98)

    this.tweens.add({
      targets: beatLine,
      alpha: 0.3,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    this.tweens.add({
      targets: character,
      y: character.y - height * 0.012,
      duration: 820,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    container.add([...notes, beatLine, character])
  }

  private createFreePlayCardArt(
    container: Phaser.GameObjects.Container,
    width: number,
    height: number,
  ) {
    const piano = this.add
      .image(-width * 0.24, -height * 0.015, 'music-piano')
      .setDisplaySize(width * 0.27, width * 0.255)
      .setAngle(-7)
      .setAlpha(0.3)
    const violin = this.add
      .image(width * 0.23, height * 0.16, 'music-violin')
      .setDisplaySize(width * 0.15, height * 0.27)
      .setAngle(9)
      .setAlpha(0.3)
    const character = this.add
      .image(0, height * 0.065, 'music-gisung-card-2')
      .setDisplaySize(height * 0.34, height * 0.405)
      .setAlpha(0.98)

    this.tweens.add({
      targets: piano,
      y: piano.y + height * 0.01,
      angle: -3,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    this.tweens.add({
      targets: violin,
      y: violin.y - height * 0.012,
      angle: 5,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    this.tweens.add({
      targets: character,
      y: character.y - height * 0.01,
      duration: 880,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    container.add([piano, violin, character])
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
    this.hoveredMode = null
    this.selectedMode = null
    this.isWaitingContentStart = false
    this.clearContentStartTimer()
    this.dialogPhase = 'intro'
    this.setIntroLine()
    this.isDialogVisible = true
    setInteractionIconActive(this.talkIcon, true)
    fadeSimpleDialog(this, this.dialog, 1, 220)
  }

  private setIntroLine() {
    setCenteredDialogText(this.dialog, gisungSelectDialogs.greeting[0].text)
  }

  private advanceDialog() {
    if (this.dialogPhase === 'intro') {
      this.showChoicePrompt()
    }
  }

  private showChoicePrompt() {
    if (this.dialogPhase !== 'intro') {
      return
    }

    this.dialogPhase = 'choice'
    fadeSimpleDialog(this, this.dialog, 0, 160)
    this.time.delayedCall(110, () => {
      if (this.isDialogVisible && this.dialogPhase === 'choice') {
        this.showCards()
      }
    })
  }

  private handleCardHover(mode: MusicContentMode) {
    if (!this.isDialogVisible || this.isWaitingContentStart) {
      return
    }

    this.hoveredMode = mode
    this.updateCardStates()
  }

  private handleCardOut(mode: MusicContentMode) {
    if (this.isWaitingContentStart || this.hoveredMode !== mode) {
      return
    }

    this.hoveredMode = null
    this.updateCardStates()
  }

  private handleChoiceSelected(mode: MusicContentMode) {
    if (this.isTransitioning || this.isWaitingContentStart) {
      return
    }

    this.selectedMode = mode
    this.hoveredMode = null
    this.isWaitingContentStart = true
    this.dialogPhase = 'confirm'
    this.updateCardStates()
    this.hideCards()

    const line = gisungChoiceDialogs[mode].confirm[0]
    setCenteredDialogText(this.dialog, line.text)
    fadeSimpleDialog(this, this.dialog, 1, 180)

    this.contentStartTimer = this.time.delayedCall(CONTENT_CONFIRM_VISIBLE_MS, () => {
      this.contentStartTimer = null
      this.startSelectedContent(mode)
    })
  }

  private startSelectedContent(mode: MusicContentMode) {
    if (this.isTransitioning) {
      return
    }

    const targetSceneKey = MUSIC_CONTENT_SCENE_KEYS[mode]
    if (!this.scene.manager.keys[targetSceneKey]) {
      this.closeDialog(true)
      return
    }

    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)
    this.closeDialog(false)
    fadeToScene(this, targetSceneKey, { duration: 220 })
  }

  private updateCardStates() {
    this.cards.forEach(card => {
      const isSelected = card.choice.mode === this.selectedMode
      const isHovered = card.choice.mode === this.hoveredMode
      const alpha = this.isWaitingContentStart && !isSelected ? 0.7 : 1
      card.container.setScale(isSelected ? 1.035 : isHovered ? 1.02 : 1)
      card.frame.setAlpha(alpha)
      card.selectButton.setAlpha(alpha)
      card.selectLabel.setAlpha(alpha)
      this.drawSelectButton(card, isSelected ? 'selected' : isHovered ? 'hover' : 'default')
    })
  }

  private drawSelectButton(card: MusicCardView, state: 'default' | 'hover' | 'selected') {
    const { selectButton, width, height } = card
    const buttonWidth = width * 0.44
    const buttonHeight = height * 0.072
    const x = -buttonWidth / 2
    const y = height * 0.365 - buttonHeight / 2
    const fill = state === 'default' ? 0x8a572b : state === 'hover' ? 0x9d6734 : 0xb27335
    const stroke = state === 'default' ? 0x3d2614 : 0x2f1c0d

    selectButton.clear()
    selectButton.fillStyle(0x2a190b, 0.22)
    selectButton.fillRoundedRect(
      x + width * 0.012,
      y + height * 0.009,
      buttonWidth,
      buttonHeight,
      8,
    )
    selectButton.fillStyle(fill, 0.98)
    selectButton.fillRoundedRect(x, y, buttonWidth, buttonHeight, 8)
    selectButton.fillStyle(0xf3bd72, 0.2)
    selectButton.fillRoundedRect(x + 5, y + 4, buttonWidth - 10, buttonHeight * 0.38, 6)
    selectButton.lineStyle(Math.max(2, Math.round(height * 0.004)), stroke, 0.96)
    selectButton.strokeRoundedRect(x, y, buttonWidth, buttonHeight, 8)
  }

  private showCards() {
    this.cards.forEach((card, index) => {
      card.container.setVisible(true)
      card.container.setAlpha(0)
      card.container.setPosition(card.baseX, card.baseY + 18)
      card.container.setScale(1)
      this.tweens.killTweensOf(card.container)
      this.tweens.add({
        targets: card.container,
        alpha: 1,
        y: card.baseY,
        duration: 240,
        delay: index * 70,
        ease: 'Sine.easeOut',
      })
    })
    this.updateCardStates()
  }

  private hideCards(immediate = false) {
    this.cards.forEach(card => {
      this.tweens.killTweensOf(card.container)
      if (immediate) {
        card.container.setVisible(false).setAlpha(0)
        return
      }

      this.tweens.add({
        targets: card.container,
        alpha: 0,
        y: card.baseY + 12,
        duration: 160,
        ease: 'Sine.easeIn',
        onComplete: () => {
          card.container.setVisible(false)
          card.container.setPosition(card.baseX, card.baseY)
        },
      })
    })
  }

  private closeDialog(markDismissed: boolean) {
    this.clearContentStartTimer()
    this.isDialogVisible = false
    this.dialogDismissed = markDismissed
    this.dialogPhase = 'closed'
    this.hoveredMode = null
    this.selectedMode = null
    this.isWaitingContentStart = false
    setInteractionIconActive(this.talkIcon, false)
    this.hideCards()
    fadeSimpleDialog(this, this.dialog, 0, 180)
  }

  private clearContentStartTimer() {
    this.contentStartTimer?.remove(false)
    this.contentStartTimer = null
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
        spawn: MUSIC_RETURN_SPAWN,
        portalCooldownMs: 250,
      },
    })
  }
}
