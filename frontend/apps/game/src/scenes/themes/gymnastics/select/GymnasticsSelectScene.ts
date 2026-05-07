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
import { createSceneWeatherLayer } from '@/features/weather/phaserWeatherLayer'
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
  drawCuteCardPanel,
  drawCutePillButton,
  type CuteCardPalette,
} from '@/game/ui/cuteCard'
import { createRatioRectangle, getRectangleEntryState } from '@/game/world/portal'
import { seongsuDialogs } from './dialog/seongsuDialogs'

const TALK_DISTANCE = 82
const GYMNASTICS_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.76 }
const GYMNASTICS_EXIT_PORTAL = { xRatio: 0.44, yRatio: 0.86, widthRatio: 0.12, heightRatio: 0.12 }
const GYMNASTICS_RETURN_SPAWN = { xRatio: 0.733, yRatio: 0.286 }
const DIALOG_TEXT_BOX = { x: 520, y: 210, width: 1240, height: 240 }
const DIALOG_NAME_BOX = { x: 450, y: 115, width: 360, height: 95 }
const CARD_DEPTH = 24
const CARD_FRAME_ASPECT_RATIO = 408 / 612
const CONTENT_CONFIRM_VISIBLE_MS = 1000
const CARD_FONT_FAMILY =
  '"Pretendard Variable", Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
const GYMNASTICS_BACKGROUND_TEXTURE_KEY = 'gymnastics-background-v3'
const gymnasticsRoomSceneConfig = {
  backgroundFitMode: 'cover',
  backgroundAnchor: 'center',
  showNpcIndicator: true,
  npcPosition: {
    anchorTarget: 'center_main_purple_mat',
    xRatio: 0.5,
    yRatio: 0.62,
    offsetX: 0,
    offsetY: 0,
  },
} as const
const RACCOON_IDLE_ANIM_KEY = 'raccoon-gymnastics-idle'
const RACCOON_TEXTURE_KEY = 'raccoon-clean'
const RACCOON_FRAME_SIZE = 360
const RACCOON_CROP_RECTS = [
  { x: 120, y: 640, width: 360, height: 340 },
  { x: 580, y: 640, width: 360, height: 340 },
  { x: 1040, y: 640, width: 360, height: 340 },
  { x: 1460, y: 640, width: 360, height: 340 },
]

type GymnasticsContentMode = 'top' | 'daniel'
type GymnasticsDialogPhase = 'closed' | 'intro' | 'choice' | 'confirm'

type GymnasticsChoiceOption = {
  mode: GymnasticsContentMode
  label: string
  description: string
}

type GymnasticsCardView = {
  choice: GymnasticsChoiceOption
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

const CARD_LAYOUT = {
  tagTopOffset: 0.085,
  characterCenterY: -0.065,
  characterSize: 0.42,
  titleY: 0.21,
  descGap: 0.07,
  buttonCenterY: 0.4,
  buttonWidth: 0.55,
  buttonHeight: 0.078,
} as const

const gymnasticsChoiceOptions: GymnasticsChoiceOption[] = [
  { mode: 'top', label: 'TOP 체조', description: 'TOP 동작을 따라 하며 몸을 풀어봐.' },
  { mode: 'daniel', label: '다니엘 체조', description: '다니엘 동작으로 신나게 움직여봐.' },
]

const GYMNASTICS_CONTENT_SCENE_KEYS: Record<GymnasticsContentMode, string> = {
  top: 'GymnasticsTopScene',
  daniel: 'GymnasticsDanielScene',
}

type GymnasticsSelectSceneData = {
  spawn?: RatioPoint
}

type BackgroundDisplayArea = {
  x: number
  y: number
  width: number
  height: number
}

export class GymnasticsSelectScene extends Phaser.Scene {
  private player!: PlayerSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private isTransitioning = false
  private playerWasInExitPortal = true

  private raccoon!: Phaser.GameObjects.Sprite
  private raccoonAnchor = new Phaser.Math.Vector2()
  private talkIcon!: Phaser.GameObjects.Image
  private dialog!: SimpleDialogUi
  private cards: GymnasticsCardView[] = []
  private isDialogVisible = false
  private dialogDismissed = false
  private dialogPhase: GymnasticsDialogPhase = 'closed'
  private hoveredMode: GymnasticsContentMode | null = null
  private selectedMode: GymnasticsContentMode | null = null
  private isWaitingContentStart = false
  private contentStartTimer: Phaser.Time.TimerEvent | null = null
  private sessionHistoryButton!: Phaser.GameObjects.Text
  private backgroundDisplayArea!: BackgroundDisplayArea

  constructor() {
    super({ key: 'GymnasticsSelectScene' })
  }

  preload() {
    this.load.image(
      GYMNASTICS_BACKGROUND_TEXTURE_KEY,
      assetPath('images/themes/gymnastics/background/gymbackground.png'),
    )
    this.load.image(
      'raccoon-source',
      assetPath('images/themes/gymnastics/characters/raccoon_exercise_spritesheet.png'),
    )
    this.load.image(
      'gym-card-top-raccoon',
      assetPath('images/themes/gymnastics/characters/TOPracoon.png'),
    )
    this.load.image(
      'gym-card-daniel-raccoon',
      assetPath('images/themes/gymnastics/characters/dinielracoon.png'),
    )
    loadInteractionIcons(this)
    this.load.image(
      'gymnastics-seongsu-dialog-frame',
      assetPath('images/npcs/seongsu/dialog_frame.png'),
    )
    loadPlayerSpritesheet(this)
  }

  create(data: GymnasticsSelectSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.isDialogVisible = false
    this.dialogDismissed = false
    this.dialogPhase = 'closed'
    this.hoveredMode = null
    this.selectedMode = null
    this.isWaitingContentStart = false
    this.cards = []
    this.clearContentStartTimer()
    this.target = null

    this.backgroundDisplayArea = this.addContainBackground(GYMNASTICS_BACKGROUND_TEXTURE_KEY)
    createSceneWeatherLayer(this)
    this.physics.world.setBounds(0, 0, vw, vh)

    const npcPosition = this.toBackgroundPoint(
      gymnasticsRoomSceneConfig.npcPosition.xRatio,
      gymnasticsRoomSceneConfig.npcPosition.yRatio,
      gymnasticsRoomSceneConfig.npcPosition.offsetX,
      gymnasticsRoomSceneConfig.npcPosition.offsetY,
    )
    const raccoonX = npcPosition.x
    const raccoonY = npcPosition.y
    const raccoonH = Math.min(vh, this.backgroundDisplayArea.height) * 0.17
    this.createCleanRaccoonTexture()
    this.ensureRaccoonAnimations()
    this.raccoon = this.add.sprite(raccoonX, raccoonY, RACCOON_TEXTURE_KEY, 0)
    this.raccoon.setOrigin(0.5, 0.58).setDisplaySize(raccoonH, raccoonH).setDepth(5)
    this.raccoon.play(RACCOON_IDLE_ANIM_KEY)
    this.raccoonAnchor.set(raccoonX, raccoonY)

    this.talkIcon = createFloatingInteractionIcon(this, {
      x: raccoonX,
      y: raccoonY - raccoonH * 0.55,
      displaySize: 44,
      depth: 6,
      bobOffset: 10,
    })
    this.talkIcon.setVisible(gymnasticsRoomSceneConfig.showNpcIndicator)

    this.createDialogUi()
    this.createSessionHistoryButton(vw)
    this.createChoiceCards(vw, vh)
    ensurePlayerWalkAnimations(this)

    const spawn = data.spawn ?? GYMNASTICS_ROOM_SPAWN
    const spawnX = vw * spawn.xRatio
    const spawnY = vh * spawn.yRatio
    this.player = createPlayer(this, spawnX, spawnY)
    this.dialogDismissed =
      Phaser.Math.Distance.Between(spawnX, spawnY, this.raccoonAnchor.x, this.raccoonAnchor.y) <=
      TALK_DISTANCE
    this.exitPortal = createRatioRectangle(vw, vh, GYMNASTICS_EXIT_PORTAL)
    this.cursors = this.input.keyboard!.createCursorKeys()

    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.isDialogVisible) this.advanceDialog()
    })
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.isDialogVisible) this.closeDialog(true)
    })
    this.input.on('pointerdown', this.handlePointerDown)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearContentStartTimer()
      this.input.off('pointerdown', this.handlePointerDown)
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
      speed: getPlayerMoveSpeed(),
      blocked: this.isDialogVisible,
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    this.updateSeongsuConversation()

    if (this.isDialogVisible) return

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
    if (this.sessionHistoryButton.getBounds().contains(pointer.x, pointer.y)) {
      this.openSessionHistory()
      return
    }

    if (this.isDialogVisible) {
      if (this.isWaitingContentStart) return

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
      if (!clickedDialog) this.closeDialog(true)
      return
    }

    this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
    createClickTargetMarker(this, pointer.x, pointer.y)
  }

  private updateSeongsuConversation() {
    if (this.isTransitioning) return

    const dist = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.raccoonAnchor.x,
      this.raccoonAnchor.y,
    )

    if (dist > TALK_DISTANCE) {
      this.dialogDismissed = false
      return
    }

    if (!this.isDialogVisible && !this.dialogDismissed) {
      this.startConversation()
    }
  }

  private createDialogUi() {
    this.dialog = createSimpleDialogUi(this, {
      frameKey: 'gymnastics-seongsu-dialog-frame',
      textBox: DIALOG_TEXT_BOX,
      dialogWidthRatio: 0.7,
      maxDialogWidth: 1000,
      fontSize: 40,
      lineSpacing: 4,
      frameBottomMargin: -30,
      nameBox: DIALOG_NAME_BOX,
      nameText: '체조선생님 성수',
      nameFontColor: '#3b2414',
      nameFontSize: 34,
      opticalOffsets: { single: 0 },
    })
  }

  private createSessionHistoryButton(vw: number) {
    this.sessionHistoryButton = this.add
      .text(vw - 28, 28, '기록 보기', {
        fontFamily: CARD_FONT_FAMILY,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#fff8ec',
        backgroundColor: '#6d4a27',
        padding: { x: 14, y: 9 },
      })
      .setOrigin(1, 0)
      .setDepth(30)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })

    this.sessionHistoryButton.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.openSessionHistory()
      },
    )
  }

  private openSessionHistory() {
    this.game.events.emit('exercise-sessions:open')
  }

  private addContainBackground(textureKey: string): BackgroundDisplayArea {
    const { width, height } = this.scale
    const backgroundFill = this.add.rectangle(width / 2, height / 2, width, height, 0x1f1a15)
    backgroundFill.setDepth(-1)

    const background = this.add.image(width / 2, height / 2, textureKey)
    const source = background.texture.getSourceImage() as HTMLImageElement
    const scale =
      gymnasticsRoomSceneConfig.backgroundFitMode === 'cover'
        ? Math.max(width / source.width, height / source.height)
        : Math.min(width / source.width, height / source.height)
    const displayWidth = source.width * scale
    const displayHeight = source.height * scale
    background.setOrigin(0.5).setScale(scale).setDepth(0)

    return {
      x: (width - displayWidth) / 2,
      y: (height - displayHeight) / 2,
      width: displayWidth,
      height: displayHeight,
    }
  }

  private toBackgroundPoint(xRatio: number, yRatio: number, offsetX = 0, offsetY = 0) {
    return {
      x: this.backgroundDisplayArea.x + this.backgroundDisplayArea.width * xRatio + offsetX,
      y: this.backgroundDisplayArea.y + this.backgroundDisplayArea.height * yRatio + offsetY,
    }
  }

  private createCleanRaccoonTexture() {
    if (this.textures.exists(RACCOON_TEXTURE_KEY)) return

    const source = this.textures.get('raccoon-source').getSourceImage() as HTMLImageElement
    const canvas = document.createElement('canvas')
    canvas.width = RACCOON_FRAME_SIZE * RACCOON_CROP_RECTS.length
    canvas.height = RACCOON_FRAME_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Raccoon canvas context is not available.')

    RACCOON_CROP_RECTS.forEach((rect, index) => {
      context.drawImage(
        source,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        index * RACCOON_FRAME_SIZE,
        RACCOON_FRAME_SIZE - rect.height,
        rect.width,
        rect.height,
      )
    })

    const texture = this.textures.addCanvas(RACCOON_TEXTURE_KEY, canvas)
    if (!texture) throw new Error('Clean raccoon texture is not available.')

    RACCOON_CROP_RECTS.forEach((_, index) => {
      texture.add(index, 0, index * RACCOON_FRAME_SIZE, 0, RACCOON_FRAME_SIZE, RACCOON_FRAME_SIZE)
    })
  }

  private ensureRaccoonAnimations() {
    if (this.anims.exists(RACCOON_IDLE_ANIM_KEY)) return

    this.anims.create({
      key: RACCOON_IDLE_ANIM_KEY,
      frames: this.anims.generateFrameNumbers(RACCOON_TEXTURE_KEY, { start: 0, end: 3 }),
      frameRate: 1.2,
      repeat: -1,
    })
  }

  private startConversation() {
    this.hoveredMode = null
    this.selectedMode = null
    this.isWaitingContentStart = false
    this.clearContentStartTimer()
    this.dialogPhase = 'intro'
    setCenteredDialogText(this.dialog, Phaser.Utils.Array.GetRandom(seongsuDialogs.guide).text)
    this.isDialogVisible = true
    setInteractionIconActive(this.talkIcon, true)
    fadeSimpleDialog(this, this.dialog, 1, 220)
  }

  private advanceDialog() {
    if (this.dialogPhase === 'intro') this.showChoicePrompt()
  }

  private showChoicePrompt() {
    if (this.dialogPhase !== 'intro') return

    this.dialogPhase = 'choice'
    setCenteredDialogText(
      this.dialog,
      Phaser.Utils.Array.GetRandom(seongsuDialogs.choicePrompt).text,
    )
    fadeSimpleDialog(this, this.dialog, 0, 160)
    this.time.delayedCall(110, () => {
      if (this.isDialogVisible && this.dialogPhase === 'choice') this.showCards()
    })
  }

  private createChoiceCards(vw: number, vh: number) {
    const cardHeight = Phaser.Math.Clamp(vh * 0.78, 540, 690)
    const cardWidth = cardHeight * (CARD_FRAME_ASPECT_RATIO + 0.055)
    const gap = Phaser.Math.Clamp(vw * 0.04, 56, 86)
    const totalWidth = cardWidth * gymnasticsChoiceOptions.length + gap
    const firstX = vw / 2 - totalWidth / 2 + cardWidth / 2
    const centerY = Phaser.Math.Clamp(vh * 0.48, 24 + cardHeight / 2, vh - cardHeight / 2 - 24)

    this.cards = gymnasticsChoiceOptions.map((choice, index) =>
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
    choice: GymnasticsChoiceOption,
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

    const palette = choice.mode === 'top' ? CUTE_CARD_PALETTES.butter : CUTE_CARD_PALETTES.sage
    const panel = this.add.graphics()
    const tagFontSize = Math.round(height * 0.028)
    const tagLabel = this.add
      .text(0, 0, choice.label, {
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

    const characterKey = choice.mode === 'top' ? 'gym-card-top-raccoon' : 'gym-card-daniel-raccoon'
    const character = this.add
      .image(0, height * CARD_LAYOUT.characterCenterY, characterKey)
      .setDisplaySize(height * CARD_LAYOUT.characterSize, height * CARD_LAYOUT.characterSize)

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
      panel,
      tagBg,
      tagLabel,
      character,
      title,
      description,
      selectButton,
      selectLabel,
    ])

    const card = {
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
      if (!card.container.visible || card.container.alpha <= 0) return false

      const width = card.width * card.container.scaleX
      const height = card.height * card.container.scaleY

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

  private handleCardHover(mode: GymnasticsContentMode) {
    if (!this.isDialogVisible || this.isWaitingContentStart) return

    this.hoveredMode = mode
    this.updateCardStates()
  }

  private handleCardOut(mode: GymnasticsContentMode) {
    if (this.isWaitingContentStart || this.hoveredMode !== mode) return

    this.hoveredMode = null
    this.updateCardStates()
  }

  private handleChoiceSelected(mode: GymnasticsContentMode) {
    if (this.isTransitioning || this.isWaitingContentStart) return

    this.selectedMode = mode
    this.hoveredMode = null
    this.isWaitingContentStart = true
    this.dialogPhase = 'confirm'
    this.updateCardStates()
    this.hideCards()

    const choice = gymnasticsChoiceOptions.find(option => option.mode === mode)
    setCenteredDialogText(this.dialog, `${choice?.label ?? '체조'}로 시작할게! 준비됐지?`)
    fadeSimpleDialog(this, this.dialog, 1, 180)

    this.contentStartTimer = this.time.delayedCall(CONTENT_CONFIRM_VISIBLE_MS, () => {
      this.contentStartTimer = null
      this.startSelectedContent(mode)
    })
  }

  private updateCardStates() {
    this.cards.forEach(card => {
      const isSelected = card.choice.mode === this.selectedMode
      const isHovered = card.choice.mode === this.hoveredMode
      const dimmed = this.isWaitingContentStart && !isSelected
      const state = isSelected ? 'selected' : isHovered ? 'hover' : 'default'

      card.container.setScale(isSelected ? 1.035 : isHovered ? 1.02 : 1)
      card.container.setAlpha(dimmed ? 0.55 : 1)
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

  private startSelectedContent(mode: GymnasticsContentMode) {
    if (this.isTransitioning) return

    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)
    this.closeDialog(false)
    fadeToScene(this, GYMNASTICS_CONTENT_SCENE_KEYS[mode], { duration: 250 })
  }

  private returnToVillage() {
    if (this.isTransitioning) return
    this.isTransitioning = true

    fadeToScene(this, 'VillageScene', {
      duration: 250,
      data: { spawn: GYMNASTICS_RETURN_SPAWN },
    })
  }
}
