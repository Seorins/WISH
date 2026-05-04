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
import {
  CUTE_CARD_PALETTES,
  drawCutePillButton,
  drawCuteCardPanel,
  type CuteCardPalette,
} from '@/game/ui/cuteCard'
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
// frame asset is 2172 x 724 — values below are in that pixel space
const DIALOG_TEXT_BOX = { x: 580, y: 180, width: 1500, height: 400 }
const DIALOG_NAME_BOX = { x: 505, y: 107, width: 390, height: 150 }
const CARD_DEPTH = 24
const CARD_FONT_FAMILY =
  '"Pretendard Variable", Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
const CARD_FRAME_ASPECT_RATIO = 408 / 612
const CONTENT_CONFIRM_VISIBLE_MS = 1300

// Card layout constants (ratios of card height, card center is the origin).
// Keeping these in one place makes it easy to keep elements visually aligned.
const CARD_LAYOUT = {
  tagTopOffset: 0.085, // tag center distance from card top
  characterCenterY: -0.06, // negative = above card center
  characterSize: 0.4, // square character
  titleY: 0.21, // title baseline (origin 0.5)
  descGap: 0.07, // gap from title to description
  buttonCenterY: 0.4, // button center
  buttonWidth: 0.55,
  buttonHeight: 0.078,
} as const
const MUSIC_CONTENT_SCENE_KEYS: Record<MusicContentMode, string> = {
  'rhythm-game': 'MusicSongSelectScene',
  'free-play': 'MusicFreePlayScene',
}

type MusicSelectSceneData = {
  spawn?: RatioPoint
}

type MusicCardView = {
  choice: MusicChoiceOption
  container: Phaser.GameObjects.Container
  panel: Phaser.GameObjects.Graphics
  selectButton: Phaser.GameObjects.Graphics
  selectLabel: Phaser.GameObjects.Text
  baseX: number
  baseY: number
  width: number
  height: number
  palette: CuteCardPalette
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
      dialogWidthRatio: 0.7,
      maxDialogWidth: 1000,
      fontSize: 46,
      lineSpacing: 6,
      nameBox: DIALOG_NAME_BOX,
      nameText: '기성',
      nameFontColor: '#2a1f17',
      nameFontSize: 48,
      nameLetterSpacing: 6,
      // only flatten the optical offset for single-line text — multi-line keeps default
      opticalOffsets: { single: 0 },
    })
  }

  private createChoiceCards(vw: number, vh: number) {
    const cardHeight = Phaser.Math.Clamp(vh * 0.78, 540, 690)
    const cardWidth = cardHeight * (CARD_FRAME_ASPECT_RATIO + 0.055)
    const gap = Phaser.Math.Clamp(vw * 0.04, 56, 86)
    const totalWidth = cardWidth * musicChoiceOptions.length + gap
    const firstX = vw / 2 - totalWidth / 2 + cardWidth / 2
    const centerY = Phaser.Math.Clamp(vh * 0.48, 24 + cardHeight / 2, vh - cardHeight / 2 - 24)

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

    const palette =
      choice.mode === 'rhythm-game' ? CUTE_CARD_PALETTES.rose : CUTE_CARD_PALETTES.sage
    const tagText = choice.mode === 'rhythm-game' ? '리듬 놀이' : '자유 연주'

    const panel = this.add.graphics()
    container.add(panel)

    // ── top tag pill ──
    const tagFontSize = Math.round(height * 0.028)
    const tagLabel = this.add
      .text(0, 0, tagText, {
        fontFamily: CARD_FONT_FAMILY,
        fontSize: `${tagFontSize}px`,
        fontStyle: 'bold',
        color: palette.accentHex,
      })
      .setOrigin(0.5)
    const tagW = tagLabel.width + Math.round(height * 0.055)
    const tagH = Math.round(height * 0.052)
    const tagY = -height / 2 + Math.round(height * CARD_LAYOUT.tagTopOffset)
    const tagBg = this.add.graphics()
    tagBg.fillStyle(palette.accent, 0.22)
    tagBg.fillRoundedRect(-tagW / 2, tagY - tagH / 2, tagW, tagH, tagH / 2)
    tagBg.lineStyle(1.2, palette.accent, 0.55)
    tagBg.strokeRoundedRect(-tagW / 2, tagY - tagH / 2, tagW, tagH, tagH / 2)
    tagLabel.setPosition(0, tagY)

    // ── decorative scene: instruments / notes ──
    const decoNodes = this.createCardDecorations(choice.mode, width, height)

    // ── hero: dog character image ──
    const characterKey =
      choice.mode === 'rhythm-game' ? 'music-gisung-card-1' : 'music-gisung-card-2'
    const characterSize = height * CARD_LAYOUT.characterSize
    const character = this.add
      .image(0, height * CARD_LAYOUT.characterCenterY, characterKey)
      .setDisplaySize(characterSize, characterSize)

    // ── title ──
    const titleY = height * CARD_LAYOUT.titleY
    const title = this.add
      .text(0, titleY, choice.label, {
        fontFamily: CARD_FONT_FAMILY,
        fontSize: `${Math.round(height * 0.056)}px`,
        fontStyle: '700',
        color: '#3b2a44',
        align: 'center',
      })
      .setOrigin(0.5)

    // ── description ──
    const description = this.add
      .text(0, titleY + Math.round(height * CARD_LAYOUT.descGap), choice.description, {
        fontFamily: CARD_FONT_FAMILY,
        fontSize: `${Math.round(height * 0.026)}px`,
        fontStyle: 'bold',
        color: '#7a6e85',
        align: 'center',
        wordWrap: { width: width * 0.78, useAdvancedWrap: true },
      })
      .setOrigin(0.5)

    // ── select button ──
    const selectButton = this.add.graphics()
    const selectLabel = this.add
      .text(0, height * CARD_LAYOUT.buttonCenterY, '선택', {
        fontFamily: CARD_FONT_FAMILY,
        fontSize: `${Math.round(height * 0.034)}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setShadow(0, 1, `#${palette.shadow.toString(16).padStart(6, '0')}`, 2, false, true)

    container.add([
      tagBg,
      tagLabel,
      ...decoNodes,
      character,
      title,
      description,
      selectButton,
      selectLabel,
    ])

    const card: MusicCardView = {
      choice,
      container,
      panel,
      selectButton,
      selectLabel,
      baseX: x,
      baseY: y,
      width,
      height,
      palette,
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

  private createCardDecorations(
    mode: MusicContentMode,
    width: number,
    height: number,
  ): Phaser.GameObjects.GameObject[] {
    if (mode === 'rhythm-game') {
      const positions = [
        { xRatio: -0.27, yRatio: -0.18, size: 0.08 },
        { xRatio: 0.26, yRatio: -0.22, size: 0.075 },
        { xRatio: -0.05, yRatio: -0.06, size: 0.07 },
      ]
      return positions.map((p, i) => {
        const note = this.add
          .image(width * p.xRatio, height * p.yRatio, `music-note-${(i % 5) + 1}`)
          .setDisplaySize(height * p.size, height * p.size)
          .setAlpha(0.7)
        this.tweens.add({
          targets: note,
          y: note.y + height * 0.025,
          alpha: 0.45,
          duration: 1800 + i * 220,
          delay: i * 280,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
        return note
      })
    }

    // free-play: piano + violin softly placed at the character's sides,
    // kept small/desaturated so the dog stays the focal point
    const piano = this.add
      .image(-width * 0.32, -height * 0.06, 'music-piano')
      .setDisplaySize(width * 0.2, width * 0.18)
      .setAngle(-6)
      .setAlpha(0.4)
    const violin = this.add
      .image(width * 0.32, -height * 0.04, 'music-violin')
      .setDisplaySize(width * 0.12, height * 0.2)
      .setAngle(8)
      .setAlpha(0.4)
    this.tweens.add({
      targets: piano,
      y: piano.y + height * 0.012,
      angle: -3,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    this.tweens.add({
      targets: violin,
      y: violin.y - height * 0.012,
      angle: 5,
      duration: 1700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    return [piano, violin]
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
      const dimmed = this.isWaitingContentStart && !isSelected
      const alpha = dimmed ? 0.55 : 1
      const state = isSelected ? 'selected' : isHovered ? 'hover' : 'default'
      card.container.setScale(isSelected ? 1.035 : isHovered ? 1.02 : 1)
      card.container.setAlpha(alpha)
      drawCuteCardPanel(card.panel, card.width, card.height, card.palette, state, 28)
      drawCutePillButton(
        card.selectButton,
        0,
        card.height * CARD_LAYOUT.buttonCenterY,
        card.width * CARD_LAYOUT.buttonWidth,
        card.height * CARD_LAYOUT.buttonHeight,
        card.palette,
        state,
      )
    })
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
