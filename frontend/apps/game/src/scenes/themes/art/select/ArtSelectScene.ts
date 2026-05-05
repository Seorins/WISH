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
import { createRatioRectangle, isPointInRectangle } from '@/game/world/portal'
import {
  artChoiceOptions,
  rumiContentDialogs,
  rumiSelectDialogs,
  type ArtChoiceOption,
  type ArtContentMode,
} from '../dialog/rumiDialogs'

const ART_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.76 }
const ART_EXIT_PORTAL = { xRatio: 0.44, yRatio: 0.86, widthRatio: 0.12, heightRatio: 0.12 }
const ART_RETURN_SPAWN = { xRatio: 0.37, yRatio: 0.58 }
const RUMI_TALK_ICON = { xRatio: 0.37, yRatio: 0.42 }
const RUMI_INTERACTION = { xRatio: 0.37, yRatio: 0.66, radiusRatio: 0.06 }
const ALBUM_OBJECT = { xRatio: 0.755, yRatio: 0.73, sizeRatio: 0.086 }
// frame asset is 2172 x 724 — values below are in that pixel space
const DIALOG_TEXT_BOX = { x: 580, y: 180, width: 1500, height: 400 }
const DIALOG_NAME_BOX = { x: 505, y: 107, width: 390, height: 150 }
const CARD_DEPTH = 24
const CARD_FONT_FAMILY =
  '"Pretendard Variable", Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
const CARD_FRAME_ASPECT_RATIO = 408 / 612
const CONTENT_CONFIRM_VISIBLE_MS = 1300

const CARD_LAYOUT = {
  tagTopOffset: 0.085,
  characterCenterY: -0.06,
  characterSize: 0.4,
  titleY: 0.21,
  descGap: 0.07,
  buttonCenterY: 0.4,
  buttonWidth: 0.55,
  buttonHeight: 0.078,
} as const

const ART_CONTENT_SCENE_KEYS: Record<ArtContentMode, string> = {
  'free-drawing': 'ArtFreeDrawingScene',
  coloring: 'ArtColoringSelectScene',
}

type ArtSelectSceneData = {
  spawn?: RatioPoint
  suppressRumiDialog?: boolean
}

type ArtCardView = {
  choice: ArtChoiceOption
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

type RumiDialogPhase = 'closed' | 'intro' | 'choice' | 'confirm'

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

  private dialog!: SimpleDialogUi
  private cards: ArtCardView[] = []
  private isAlbumVisible = false

  private isDialogVisible = false
  private dialogDismissed = false
  private dialogPhase: RumiDialogPhase = 'closed'
  private hoveredMode: ArtContentMode | null = null
  private selectedMode: ArtContentMode | null = null
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

    if (this.isAlbumVisible) {
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
    if (this.isAlbumVisible) {
      this.closeAlbum()
      return
    }

    if (this.isDialogVisible) {
      this.closeDialog(true)
    }
  }

  constructor() {
    super({ key: 'ArtSelectScene' })
  }

  preload() {
    this.load.image('art-room-background', assetPath('images/themes/art/background/background.png'))
    loadInteractionIcons(this)
    this.load.image('rumi-dialog-frame', assetPath('images/npcs/rumi/dialog-frame.png'))
    this.load.image('art-ui-album', assetPath('images/themes/art/ui/album.png'))
    this.load.image('art-rumi-character', assetPath('images/themes/art/ui/rumi.png'))
    this.load.image('art-card-free', assetPath('images/themes/art/ui/free.png'))
    this.load.image('art-card-paint', assetPath('images/themes/art/ui/paint.png'))
    loadPlayerSpritesheet(this)
  }

  create(data: ArtSelectSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.isDialogVisible = false
    this.dialogDismissed = Boolean(data.suppressRumiDialog)
    this.dialogPhase = 'closed'
    this.hoveredMode = null
    this.selectedMode = null
    this.isWaitingContentStart = false
    this.target = null
    this.cards = []
    this.clearContentStartTimer()

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

    this.createRumiCharacter(
      backgroundLeft,
      backgroundTop,
      background.displayWidth,
      background.displayHeight,
    )

    this.rumiAnchor.set(
      backgroundLeft + background.displayWidth * RUMI_INTERACTION.xRatio,
      backgroundTop + background.displayHeight * RUMI_INTERACTION.yRatio,
    )
    this.rumiInteractionRadius =
      Math.min(background.displayWidth, background.displayHeight) * RUMI_INTERACTION.radiusRatio

    this.physics.world.setBounds(0, 0, vw, vh)

    ensurePlayerWalkAnimations(this)
    this.createDialogUi()
    this.createChoiceCards(vw, vh)

    const spawn = data.spawn ?? ART_ROOM_SPAWN
    this.player = createPlayer(this, vw * spawn.xRatio, vh * spawn.yRatio)

    this.exitPortal = createRatioRectangle(vw, vh, ART_EXIT_PORTAL)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.on('pointerdown', this.handlePointerDown)
    this.input.keyboard!.on('keydown-ENTER', this.handleEnterDown)
    this.input.keyboard!.on('keydown-ESC', this.handleEscDown)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearContentStartTimer()
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
      speed: getPlayerMoveSpeed(),
      blocked: this.isDialogVisible || this.isAlbumVisible,
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    this.updateRumiConversation()

    if (this.isDialogVisible || this.isAlbumVisible) {
      return
    }

    if (
      !this.isTransitioning &&
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

    setInteractionIconActive(this.talkIcon, this.isDialogVisible)

    if (!isNearRumi) {
      this.dialogDismissed = false
      return
    }

    if (!this.isDialogVisible && !this.dialogDismissed) {
      this.startRumiConversation()
    }
  }

  private createDialogUi() {
    this.dialog = createSimpleDialogUi(this, {
      frameKey: 'rumi-dialog-frame',
      textBox: DIALOG_TEXT_BOX,
      dialogWidthRatio: 0.7,
      maxDialogWidth: 1000,
      fontSize: 46,
      lineSpacing: 6,
      nameBox: DIALOG_NAME_BOX,
      nameText: '루미',
      nameFontColor: '#2a1f17',
      nameFontSize: 48,
      nameLetterSpacing: 6,
      opticalOffsets: { single: 0 },
    })
  }

  private createRumiCharacter(
    backgroundLeft: number,
    backgroundTop: number,
    backgroundWidth: number,
    backgroundHeight: number,
  ) {
    const source = this.textures.get('art-rumi-character').getSourceImage() as HTMLImageElement
    const aspect = source.width / source.height
    const rumiHeight = backgroundHeight * 0.23
    const rumiWidth = rumiHeight * aspect
    const x = backgroundLeft + backgroundWidth * RUMI_TALK_ICON.xRatio
    const iconHalfHeight = this.talkIcon.displayHeight / 2
    const y = backgroundTop + backgroundHeight * RUMI_TALK_ICON.yRatio + iconHalfHeight + 6

    this.add
      .image(x, y, 'art-rumi-character')
      .setOrigin(0.5, 0)
      .setDepth(5)
      .setDisplaySize(rumiWidth, rumiHeight)
  }

  private createChoiceCards(vw: number, vh: number) {
    const cardHeight = Phaser.Math.Clamp(vh * 0.78, 540, 690)
    const cardWidth = cardHeight * (CARD_FRAME_ASPECT_RATIO + 0.055)
    const gap = Phaser.Math.Clamp(vw * 0.04, 56, 86)
    const totalWidth = cardWidth * artChoiceOptions.length + gap
    const firstX = vw / 2 - totalWidth / 2 + cardWidth / 2
    const centerY = Phaser.Math.Clamp(vh * 0.48, 24 + cardHeight / 2, vh - cardHeight / 2 - 24)

    this.cards = artChoiceOptions.map((choice, index) =>
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
    choice: ArtChoiceOption,
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
      choice.mode === 'free-drawing' ? CUTE_CARD_PALETTES.rose : CUTE_CARD_PALETTES.sage
    const tagText = choice.label

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

    // ── hero: rumi character image (1024×1024 square) ──
    // paint.png leaves more empty space around the owl (rainbow takes up the
    // upper-left), so it visually reads smaller — bump its display size a bit
    // to match the free-drawing card.
    const characterKey = choice.mode === 'free-drawing' ? 'art-card-free' : 'art-card-paint'
    const characterScale = choice.mode === 'free-drawing' ? 1 : 1.18
    const characterSize = height * CARD_LAYOUT.characterSize * characterScale
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

    container.add([tagBg, tagLabel, character, title, description, selectButton, selectLabel])

    const card: ArtCardView = {
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

  private startRumiConversation() {
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
    const line = Phaser.Utils.Array.GetRandom(rumiSelectDialogs.greeting)
    setCenteredDialogText(this.dialog, line.text)
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

  private handleCardHover(mode: ArtContentMode) {
    if (!this.isDialogVisible || this.isWaitingContentStart) {
      return
    }

    this.hoveredMode = mode
    this.updateCardStates()
  }

  private handleCardOut(mode: ArtContentMode) {
    if (this.isWaitingContentStart || this.hoveredMode !== mode) {
      return
    }

    this.hoveredMode = null
    this.updateCardStates()
  }

  private handleChoiceSelected(mode: ArtContentMode) {
    if (this.isTransitioning || this.isWaitingContentStart) {
      return
    }

    this.selectedMode = mode
    this.hoveredMode = null
    this.isWaitingContentStart = true
    this.dialogPhase = 'confirm'
    this.updateCardStates()
    this.hideCards()

    const line = Phaser.Utils.Array.GetRandom(rumiContentDialogs[mode].confirm)
    setCenteredDialogText(this.dialog, line.text)
    fadeSimpleDialog(this, this.dialog, 1, 180)

    this.contentStartTimer = this.time.delayedCall(CONTENT_CONFIRM_VISIBLE_MS, () => {
      this.contentStartTimer = null
      this.startSelectedContent(mode)
    })
  }

  private startSelectedContent(mode: ArtContentMode) {
    if (this.isTransitioning) {
      return
    }

    const targetSceneKey = ART_CONTENT_SCENE_KEYS[mode]
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

  private createAlbumObject(
    backgroundLeft: number,
    backgroundTop: number,
    backgroundWidth: number,
    backgroundHeight: number,
  ) {
    const albumSize = backgroundWidth * ALBUM_OBJECT.sizeRatio
    const albumX = backgroundLeft + backgroundWidth * ALBUM_OBJECT.xRatio
    const albumY = backgroundTop + backgroundHeight * ALBUM_OBJECT.yRatio
    // soft yellow rim — visible enough to signal "this is interactive"
    const albumGlow = this.add
      .image(albumX, albumY, 'art-ui-album')
      .setDepth(7)
      .setDisplaySize(albumSize * 1.12, albumSize * 1.12)
      .setTint(0xffd86a)
      .setAlpha(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)

    this.tweens.add({
      targets: albumGlow,
      alpha: 0.78,
      duration: 1000,
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
