import Phaser from 'phaser'
import { assetPath } from '@/game/assets/assetPath'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'

type PoomsaeOption = {
  id: string
  chapter: string
  name: string
  belt: string
  description: string
  estimatedMinutes: number
  difficulty: 'easy' | 'normal' | 'hard'
  seokjaeFrame: number
}

type PoomsaeCard = {
  container: Phaser.GameObjects.Container
  background: Phaser.GameObjects.Image
  glow: Phaser.GameObjects.Graphics
  tabLabel: Phaser.GameObjects.Text
  title: Phaser.GameObjects.Text
  meta: Phaser.GameObjects.Text
  sprite: Phaser.GameObjects.Sprite
  description: Phaser.GameObjects.Text
}

const ASSET_KEYS = {
  background: 'taekwondo-room-background',
  sign: 'taekwondo-poomsae-select-sign',
  card: 'taekwondo-poomsae-card',
  cardCropped: 'taekwondo-poomsae-card-cropped',
  arrowLeft: 'taekwondo-poomsae-arrow-left',
  arrowRight: 'taekwondo-poomsae-arrow-right',
  backButton: 'taekwondo-poomsae-back-button',
  backPressed: 'taekwondo-poomsae-back-pressed',
  startButton: 'taekwondo-poomsae-start-button',
  startPressed: 'taekwondo-poomsae-start-pressed',
  seokjae: 'taekwondo-poomsae-seokjae',
} as const

const SEOKJAE_FRAME_SIZE = { width: 384, height: 512 }
const FADE_DURATION = 220
const OVERLAY_ALPHA = 0.06
const CARD_GAP = 44
const CARD_CROP = { x: 477, y: 46, width: 580, height: 935 }
const CARD_ASPECT_RATIO = CARD_CROP.width / CARD_CROP.height
const CARD_VISIBLE_COUNT = 3
const CARD_SELECTED_SCALE = 1.04
const CARD_NORMAL_SCALE = 0.98
const CARD_SCROLL_STEP = 1
const SIGN_Y_RATIO = 0.105
const LIST_Y_RATIO = 0.535
const ACTION_Y_RATIO = 0.89
const ACTION_BUTTON_SIZE = { widthRatio: 0.18, maxWidth: 260, heightRatio: 0.078, maxHeight: 70 }

const TEST_POOMSAE_OPTIONS: PoomsaeOption[] = [
  {
    id: 'taegeuk-1',
    chapter: '1장',
    name: '태극 1장',
    belt: '흰띠',
    description: '기본 서기와 아래막기, 몸통지르기를 익히는 첫 품새',
    estimatedMinutes: 3,
    difficulty: 'easy',
    seokjaeFrame: 0,
  },
  {
    id: 'taegeuk-2',
    chapter: '2장',
    name: '태극 2장',
    belt: '노란띠',
    description: '앞차기와 방향 전환을 자연스럽게 이어가는 품새',
    estimatedMinutes: 4,
    difficulty: 'easy',
    seokjaeFrame: 1,
  },
  {
    id: 'taegeuk-3',
    chapter: '3장',
    name: '태극 3장',
    belt: '초록띠',
    description: '손날막기와 연속 동작의 리듬을 연습하는 품새',
    estimatedMinutes: 5,
    difficulty: 'normal',
    seokjaeFrame: 4,
  },
  {
    id: 'taegeuk-4',
    chapter: '4장',
    name: '태극 4장',
    belt: '파란띠',
    description: '옆차기와 손날 동작을 균형 있게 연결하는 품새',
    estimatedMinutes: 6,
    difficulty: 'normal',
    seokjaeFrame: 6,
  },
  {
    id: 'taegeuk-5',
    chapter: '5장',
    name: '태극 5장',
    belt: '빨간띠',
    description: '팔굽 동작과 강약 조절을 함께 익히는 품새',
    estimatedMinutes: 7,
    difficulty: 'hard',
    seokjaeFrame: 2,
  },
]

const DIFFICULTY_LABEL: Record<PoomsaeOption['difficulty'], string> = {
  easy: '쉬움',
  normal: '보통',
  hard: '어려움',
}

export class TaekwondoPoomsaeSelectScene extends Phaser.Scene {
  private selectedOptionId = TEST_POOMSAE_OPTIONS[0]?.id ?? ''
  private optionCards: PoomsaeCard[] = []
  private rail!: Phaser.GameObjects.Container
  private scrollX = 0
  private maxScrollX = 0
  private viewportX = 0
  private viewportWidth = 0
  private cardStep = 0
  private isDragging = false
  private dragStartX = 0
  private dragStartScrollX = 0

  private readonly handleEscDown = () => {
    this.returnToDojang()
  }

  private readonly handleWheel = (
    _pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
  ) => {
    this.setScroll(this.scrollX + deltaY + deltaX)
  }

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer) => {
    if (!this.isDragging) {
      return
    }

    this.setScroll(this.dragStartScrollX - (pointer.x - this.dragStartX))
  }

  private readonly handlePointerUp = () => {
    this.isDragging = false
  }

  constructor() {
    super({ key: 'TaekwondoPoomsaeSelectScene' })
  }

  preload() {
    this.load.image(
      ASSET_KEYS.background,
      assetPath('images/themes/taekwondo/background/taekwondo_inside.png'),
    )
    this.load.image(ASSET_KEYS.sign, assetPath('images/themes/taekwondo/ui/poomsae_select.png'))
    this.load.image(ASSET_KEYS.card, assetPath('images/themes/taekwondo/ui/tkd_list.png'))
    this.load.image(
      ASSET_KEYS.arrowLeft,
      assetPath('images/themes/taekwondo/ui/poomsae_arrow_left.png'),
    )
    this.load.image(
      ASSET_KEYS.arrowRight,
      assetPath('images/themes/taekwondo/ui/poomsae_arrow_right.png'),
    )
    this.load.image(ASSET_KEYS.backButton, assetPath('images/themes/taekwondo/ui/back_button.png'))
    this.load.image(
      ASSET_KEYS.backPressed,
      assetPath('images/themes/taekwondo/ui/back_pressed.png'),
    )
    this.load.image(
      ASSET_KEYS.startButton,
      assetPath('images/themes/taekwondo/ui/start_button.png'),
    )
    this.load.image(
      ASSET_KEYS.startPressed,
      assetPath('images/themes/taekwondo/ui/start_pressed.png'),
    )
    this.load.spritesheet(
      ASSET_KEYS.seokjae,
      assetPath('images/themes/taekwondo/characters/seokjae_sprite.png'),
      {
        frameWidth: SEOKJAE_FRAME_SIZE.width,
        frameHeight: SEOKJAE_FRAME_SIZE.height,
      },
    )
  }

  create() {
    const { width: vw, height: vh } = this.scale
    addCoverBackground(this, ASSET_KEYS.background)
    this.add.rectangle(vw / 2, vh / 2, vw, vh, 0x120d08, OVERLAY_ALPHA).setDepth(1)
    this.createCroppedCardTexture()

    this.createHeader(vw, vh)
    this.createHorizontalOptionList(vw, vh)
    this.createActionButtons(vw, vh)

    if (TEST_POOMSAE_OPTIONS.length === 0) {
      this.showEmptyState(vw, vh)
    } else {
      this.updateSelection(this.selectedOptionId)
    }

    this.input.keyboard?.on('keydown-ESC', this.handleEscDown)
    this.input.on('wheel', this.handleWheel)
    this.input.on('pointermove', this.handlePointerMove)
    this.input.on('pointerup', this.handlePointerUp)
    this.input.on('pointerupoutside', this.handlePointerUp)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeSceneListeners())

    this.cameras.main.fadeIn(FADE_DURATION, 0, 0, 0)
  }

  private createHeader(vw: number, vh: number) {
    const sign = this.add
      .image(vw / 2, vh * SIGN_Y_RATIO, ASSET_KEYS.sign)
      .setOrigin(0.5)
      .setDepth(3)

    sign.setScale(Math.min(vh * 0.18, 170) / sign.height)
  }

  private createHorizontalOptionList(vw: number, vh: number) {
    const cardHeight = Phaser.Math.Clamp(vh * 0.58, 330, 450)
    const cardWidth = cardHeight * CARD_ASPECT_RATIO
    const viewportHeight = cardHeight * CARD_SELECTED_SCALE + 28
    const viewportY = vh * LIST_Y_RATIO

    this.cardStep = cardWidth + CARD_GAP
    this.viewportWidth = Math.min(
      vw * 0.66,
      cardWidth * CARD_VISIBLE_COUNT + CARD_GAP * (CARD_VISIBLE_COUNT - 1),
    )
    this.viewportX = vw / 2 - this.viewportWidth / 2

    const maskShape = this.add
      .rectangle(
        this.viewportX,
        viewportY - viewportHeight / 2,
        this.viewportWidth,
        viewportHeight,
        0xffffff,
        0,
      )
      .setOrigin(0)
      .setVisible(false)
    const mask = maskShape.createGeometryMask()

    this.rail = this.add.container(this.viewportX, viewportY).setDepth(3)
    this.rail.setMask(mask)

    const contentWidth =
      TEST_POOMSAE_OPTIONS.length * cardWidth +
      Math.max(0, TEST_POOMSAE_OPTIONS.length - 1) * CARD_GAP
    this.maxScrollX = Math.max(0, contentWidth - this.viewportWidth)

    this.optionCards = TEST_POOMSAE_OPTIONS.map((option, index) =>
      this.createOptionCard(
        option,
        index * this.cardStep + cardWidth / 2,
        0,
        cardWidth,
        cardHeight,
      ),
    )

    const dragZone = this.add
      .zone(this.viewportX, viewportY - viewportHeight / 2, this.viewportWidth, viewportHeight)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .setDepth(2)
    dragZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true
      this.dragStartX = pointer.x
      this.dragStartScrollX = this.scrollX
    })

    const arrowSize = { width: Math.min(vw * 0.06, 76), height: Math.min(vw * 0.06, 76) }
    this.createImageButton(
      vw / 2 - this.viewportWidth / 2 - Math.min(vw * 0.055, 74),
      viewportY,
      ASSET_KEYS.arrowLeft,
      ASSET_KEYS.arrowLeft,
      arrowSize,
      () => this.scrollByCards(-CARD_SCROLL_STEP),
    )
    this.createImageButton(
      vw / 2 + this.viewportWidth / 2 + Math.min(vw * 0.055, 74),
      viewportY,
      ASSET_KEYS.arrowRight,
      ASSET_KEYS.arrowRight,
      arrowSize,
      () => this.scrollByCards(CARD_SCROLL_STEP),
    )
  }

  private createOptionCard(
    option: PoomsaeOption,
    x: number,
    y: number,
    width: number,
    height: number,
  ): PoomsaeCard {
    const glow = this.add.graphics()
    const background = this.add
      .image(0, 0, ASSET_KEYS.cardCropped)
      .setDisplaySize(width, height)
      .setInteractive({ useHandCursor: true })

    const tabLabel = this.add
      .text(0, -height * 0.435, option.chapter, {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(width * 0.07)}px`,
        color: '#fff3cf',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setStroke('#3b1f08', 4)

    const title = this.add
      .text(0, -height * 0.29, option.name, {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(width * 0.105)}px`,
        color: '#2d1606',
        fontStyle: '700',
      })
      .setOrigin(0.5)

    const meta = this.add
      .text(
        0,
        -height * 0.205,
        `${option.belt} · ${DIFFICULTY_LABEL[option.difficulty]} · 약 ${option.estimatedMinutes}분`,
        {
          fontFamily: 'sans-serif',
          fontSize: `${Math.round(width * 0.052)}px`,
          color: '#3d210a',
          fontStyle: '700',
        },
      )
      .setOrigin(0.5)

    const sprite = this.add
      .sprite(0, height * 0.035, ASSET_KEYS.seokjae, option.seokjaeFrame)
      .setScale((height * 0.43) / SEOKJAE_FRAME_SIZE.height)

    const description = this.add
      .text(0, height * 0.33, option.description, {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(width * 0.054)}px`,
        color: '#3a1e09',
        fontStyle: '700',
        align: 'center',
        wordWrap: { width: width * 0.8, useAdvancedWrap: true },
        lineSpacing: 4,
      })
      .setOrigin(0.5)

    const container = this.add
      .container(x, y, [glow, background, tabLabel, title, meta, sprite, description])
      .setSize(width, height)
      .setData('optionId', option.id)
    this.rail.add(container)

    background.on('pointerdown', () => this.updateSelection(option.id))
    background.on('pointerover', () => {
      if (this.selectedOptionId !== option.id) {
        container.setScale(1.01)
      }
    })
    background.on('pointerout', () => this.updateCardStyle(card))

    const card = { container, background, glow, tabLabel, title, meta, sprite, description }
    return card
  }

  private createActionButtons(vw: number, vh: number) {
    const buttonY = vh * ACTION_Y_RATIO
    const buttonSize = {
      width: Math.min(vw * ACTION_BUTTON_SIZE.widthRatio, ACTION_BUTTON_SIZE.maxWidth),
      height: Math.min(vh * ACTION_BUTTON_SIZE.heightRatio, ACTION_BUTTON_SIZE.maxHeight),
    }

    this.createImageButton(
      vw / 2 - Math.min(vw * 0.13, 210),
      buttonY,
      ASSET_KEYS.backButton,
      ASSET_KEYS.backPressed,
      buttonSize,
      () => this.returnToDojang(),
    )
    this.createImageButton(
      vw / 2 + Math.min(vw * 0.13, 210),
      buttonY,
      ASSET_KEYS.startButton,
      ASSET_KEYS.startPressed,
      buttonSize,
      () => this.showReadyMessage(),
    )
  }

  private createCroppedCardTexture() {
    if (this.textures.exists(ASSET_KEYS.cardCropped)) {
      return
    }

    const source = this.textures.get(ASSET_KEYS.card).getSourceImage() as HTMLImageElement
    const texture = this.textures.createCanvas(
      ASSET_KEYS.cardCropped,
      CARD_CROP.width,
      CARD_CROP.height,
    )

    if (!texture) {
      return
    }

    texture
      .getContext()
      .drawImage(
        source,
        CARD_CROP.x,
        CARD_CROP.y,
        CARD_CROP.width,
        CARD_CROP.height,
        0,
        0,
        CARD_CROP.width,
        CARD_CROP.height,
      )
    texture.refresh()
  }

  private createImageButton(
    x: number,
    y: number,
    defaultTexture: string,
    pressedTexture: string,
    displaySize: { width: number; height: number },
    onClick: () => void,
  ) {
    const button = this.add
      .image(x, y, defaultTexture)
      .setOrigin(0.5)
      .setScale(this.getContainScale(defaultTexture, displaySize.width, displaySize.height))
      .setInteractive({ useHandCursor: true })
      .setDepth(4)

    button.on('pointerdown', () => button.setTexture(pressedTexture))
    button.on('pointerup', () => {
      button.setTexture(defaultTexture)
      onClick()
    })
    button.on('pointerout', () => button.setTexture(defaultTexture))

    return button
  }

  private scrollByCards(direction: number) {
    this.setScroll(this.scrollX + this.cardStep * direction)
  }

  private setScroll(scrollX: number) {
    this.scrollX = Phaser.Math.Clamp(scrollX, 0, this.maxScrollX)
    this.rail.x = this.viewportX - this.scrollX
  }

  private updateSelection(optionId: string) {
    this.selectedOptionId = optionId
    this.optionCards.forEach(card => this.updateCardStyle(card))
  }

  private updateCardStyle(card: PoomsaeCard) {
    const isSelected = card.container.getData('optionId') === this.selectedOptionId
    const { width, height } = card.container
    const targetScale = isSelected ? CARD_SELECTED_SCALE : CARD_NORMAL_SCALE

    card.container.setScale(targetScale)
    card.background.clearTint()
    card.tabLabel.setColor(isSelected ? '#fff7d6' : '#f4dfbd')
    card.title.setColor(isSelected ? '#1f0e02' : '#2d1606')
    card.meta.setColor(isSelected ? '#2a1504' : '#3d210a')
    card.description.setColor(isSelected ? '#2d1606' : '#3a1e09')
    card.glow.clear()

    if (!isSelected) {
      return
    }

    card.glow.lineStyle(5, 0xffd65c, 0.95)
    card.glow.strokeRoundedRect(-width / 2 + 17, -height / 2 + 16, width - 34, height - 32, 12)
    card.glow.lineStyle(13, 0xffbb33, 0.18)
    card.glow.strokeRoundedRect(-width / 2 + 11, -height / 2 + 10, width - 22, height - 20, 18)
    card.glow.fillStyle(0xffe27a, 0.9)
    card.glow.fillCircle(-width / 2 + 20, -height / 2 + 20, 4)
    card.glow.fillCircle(width / 2 - 18, -height / 2 + 42, 3)
    card.glow.fillCircle(-width / 2 + 28, height / 2 - 34, 3)
    card.glow.fillCircle(width / 2 - 28, height / 2 - 22, 4)
  }

  private showReadyMessage() {
    this.isDragging = false
    const selectedOption = TEST_POOMSAE_OPTIONS.find(option => option.id === this.selectedOptionId)

    if (!selectedOption) {
      this.showTemporaryNotice('품새를 선택해줘.')
      return
    }

    this.showTemporaryNotice(`${selectedOption.name} 연습 화면은 곧 연결할게!`)
  }

  private showTemporaryNotice(message: string) {
    const { width: vw, height: vh } = this.scale
    const notice = this.add
      .text(vw / 2, vh * 0.78, message, {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(vh * 0.026, 17, 24))}px`,
        color: '#fff3cf',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setStroke('#3b1f08', 5)
      .setDepth(5)

    this.tweens.add({
      targets: notice,
      alpha: 0,
      y: notice.y - 18,
      duration: 900,
      delay: 900,
      onComplete: () => notice.destroy(),
    })
  }

  private showEmptyState(vw: number, vh: number) {
    this.add
      .text(vw / 2, vh * 0.5, '아직 불러올 품새가 없어.', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(vh * 0.03, 20, 30))}px`,
        color: '#fff3cf',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setStroke('#3b1f08', 5)
      .setDepth(4)
  }

  private returnToDojang() {
    this.isDragging = false
    fadeToScene(this, 'TaekwondoSelectScene', { duration: FADE_DURATION })
  }

  private removeSceneListeners() {
    this.isDragging = false
    this.input.keyboard?.off('keydown-ESC', this.handleEscDown)
    this.input.off('wheel', this.handleWheel)
    this.input.off('pointermove', this.handlePointerMove)
    this.input.off('pointerup', this.handlePointerUp)
    this.input.off('pointerupoutside', this.handlePointerUp)
  }

  private getContainScale(textureKey: string, maxWidth: number, maxHeight: number) {
    const source = this.textures.get(textureKey).getSourceImage() as HTMLImageElement
    return Math.min(maxWidth / source.width, maxHeight / source.height)
  }
}
