import Phaser from 'phaser'
import { assetPath } from '@/game/assets/assetPath'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'

type PoomsaeOption = {
  id: string
  name: string
  belt: string
  estimatedMinutes: number
  difficulty: 'easy' | 'normal' | 'hard'
  seokjaeFrame: number
}

type PoomsaeCard = {
  container: Phaser.GameObjects.Container
  background: Phaser.GameObjects.Image
  glow: Phaser.GameObjects.Graphics
  title: Phaser.GameObjects.Text
  meta: Phaser.GameObjects.Text
  sprite: Phaser.GameObjects.Sprite
}

const ASSET_KEYS = {
  background: 'taekwondo-room-background',
  sign: 'taekwondo-poomsae-select-sign',
  card: 'taekwondo-poomsae-card',
  arrowLeft: 'taekwondo-poomsae-arrow-left',
  arrowRight: 'taekwondo-poomsae-arrow-right',
  seokjae: 'taekwondo-poomsae-seokjae',
} as const

const SEOKJAE_FRAME_SIZE = { width: 384, height: 512 }
const FADE_DURATION = 220
const OVERLAY_ALPHA = 0.06
const CARD_GAP = 56
const CARD_ASPECT_RATIO = 408 / 612
const CARD_VISIBLE_COUNT = 3
const CARD_SELECTED_SCALE = 1.04
const CARD_NORMAL_SCALE = 0.98
const CARD_SCROLL_STEP = 1
const SIGN_Y_RATIO = 0.105
const LIST_Y_RATIO = 0.535

const TEST_POOMSAE_OPTIONS: PoomsaeOption[] = [
  {
    id: 'taegeuk-1',
    name: '태극 1장',
    belt: '흰띠',
    estimatedMinutes: 3,
    difficulty: 'easy',
    seokjaeFrame: 0,
  },
  {
    id: 'taegeuk-2',
    name: '태극 2장',
    belt: '노란띠',
    estimatedMinutes: 4,
    difficulty: 'easy',
    seokjaeFrame: 1,
  },
  {
    id: 'taegeuk-3',
    name: '태극 3장',
    belt: '초록띠',
    estimatedMinutes: 5,
    difficulty: 'normal',
    seokjaeFrame: 4,
  },
  {
    id: 'taegeuk-4',
    name: '태극 4장',
    belt: '파란띠',
    estimatedMinutes: 6,
    difficulty: 'normal',
    seokjaeFrame: 6,
  },
  {
    id: 'taegeuk-5',
    name: '태극 5장',
    belt: '빨간띠',
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
  private selectedOptionId = ''
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
    this.load.image(ASSET_KEYS.card, assetPath('images/themes/taekwondo/ui/poomsae_lst.png'))
    this.load.image(
      ASSET_KEYS.arrowLeft,
      assetPath('images/themes/taekwondo/ui/poomsae_arrow_left.png'),
    )
    this.load.image(
      ASSET_KEYS.arrowRight,
      assetPath('images/themes/taekwondo/ui/poomsae_arrow_right.png'),
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

    this.createHeader(vw, vh)
    this.createHorizontalOptionList(vw, vh)

    if (TEST_POOMSAE_OPTIONS.length === 0) {
      this.showEmptyState(vw, vh)
    } else {
      this.optionCards.forEach(card => this.updateCardStyle(card))
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
    const cardHeight = Phaser.Math.Clamp(vh * 0.66, 380, 540)
    const cardWidth = cardHeight * CARD_ASPECT_RATIO
    const viewportHeight = cardHeight * CARD_SELECTED_SCALE + 28
    const viewportY = vh * LIST_Y_RATIO

    this.cardStep = cardWidth + CARD_GAP
    this.viewportWidth = Math.min(
      vw * 0.82,
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

    const arrowSize = { width: Math.min(vw * 0.105, 148), height: Math.min(vw * 0.105, 148) }
    this.createImageButton(
      vw / 2 - this.viewportWidth / 2 - Math.min(vw * 0.07, 104),
      viewportY,
      ASSET_KEYS.arrowLeft,
      ASSET_KEYS.arrowLeft,
      arrowSize,
      () => this.scrollByCards(-CARD_SCROLL_STEP),
    )
    this.createImageButton(
      vw / 2 + this.viewportWidth / 2 + Math.min(vw * 0.07, 104),
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
      .image(0, 0, ASSET_KEYS.card)
      .setDisplaySize(width, height)
      .setInteractive({ useHandCursor: true })

    const title = this.add
      .text(0, -height * 0.29, option.name, {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(width * 0.118)}px`,
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
          fontSize: `${Math.round(width * 0.06)}px`,
          color: '#3d210a',
          fontStyle: '700',
        },
      )
      .setOrigin(0.5)

    const sprite = this.add
      .sprite(0, height * 0.035, ASSET_KEYS.seokjae, option.seokjaeFrame)
      .setScale((height * 0.48) / SEOKJAE_FRAME_SIZE.height)

    const container = this.add
      .container(x, y, [glow, background, title, meta, sprite])
      .setSize(width, height)
      .setData('optionId', option.id)
    this.rail.add(container)

    background.on('pointerdown', () => this.updateSelection(option.id))
    background.on('pointerup', () => {
      this.clearSelection()
      this.startPoomsaePractice(option)
    })
    background.on('pointerupoutside', () => this.clearSelection())
    background.on('pointerover', () => {
      if (this.selectedOptionId !== option.id) {
        container.setScale(1.01)
      }
    })
    background.on('pointerout', () => {
      if (this.selectedOptionId === option.id) {
        this.clearSelection()
        return
      }

      this.updateCardStyle(card)
    })

    const card = { container, background, glow, title, meta, sprite }
    return card
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

  private clearSelection() {
    this.selectedOptionId = ''
    this.optionCards.forEach(card => this.updateCardStyle(card))
  }

  private updateCardStyle(card: PoomsaeCard) {
    const isSelected = card.container.getData('optionId') === this.selectedOptionId
    const { width, height } = card.container
    const targetScale = isSelected ? CARD_SELECTED_SCALE : CARD_NORMAL_SCALE

    card.container.setScale(targetScale)
    card.background.clearTint()
    card.title.setColor(isSelected ? '#1f0e02' : '#2d1606')
    card.meta.setColor(isSelected ? '#2a1504' : '#3d210a')
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

  private startPoomsaePractice(option: PoomsaeOption) {
    this.isDragging = false
    this.showTemporaryNotice(`${option.name} 연습 화면은 곧 연결할게!`)
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
