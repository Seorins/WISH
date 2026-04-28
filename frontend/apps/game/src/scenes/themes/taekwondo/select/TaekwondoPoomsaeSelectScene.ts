import Phaser from 'phaser'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'

type PoomsaeOption = {
  id: string
  name: string
  belt: string
  description: string
  estimatedMinutes: number
  difficulty: 'easy' | 'normal' | 'hard'
}

type PoomsaeCard = {
  container: Phaser.GameObjects.Container
  background: Phaser.GameObjects.Rectangle
}

const FADE_DURATION = 220
const OVERLAY_ALPHA = 0.68
const HEADER_TITLE_Y = 54
const HEADER_SUBTITLE_Y = 98
const ACTION_STATUS_OFFSET_Y = 104
const ACTION_BUTTON_OFFSET_Y = 54

const TEST_POOMSAE_OPTIONS: PoomsaeOption[] = [
  {
    id: 'taegeuk-1',
    name: '태극 1장',
    belt: '흰띠',
    description: '기본 서기와 아래막기, 몸통지르기를 익히는 첫 품새',
    estimatedMinutes: 3,
    difficulty: 'easy',
  },
  {
    id: 'taegeuk-2',
    name: '태극 2장',
    belt: '노란띠',
    description: '앞차기와 방향 전환을 자연스럽게 이어가는 품새',
    estimatedMinutes: 4,
    difficulty: 'easy',
  },
  {
    id: 'taegeuk-3',
    name: '태극 3장',
    belt: '초록띠',
    description: '손날막기와 연속 동작의 리듬을 연습하는 품새',
    estimatedMinutes: 5,
    difficulty: 'normal',
  },
  {
    id: 'taegeuk-4',
    name: '태극 4장',
    belt: '파란띠',
    description: '막기와 지르기를 더 빠르게 연결하는 중급 품새',
    estimatedMinutes: 6,
    difficulty: 'normal',
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
  private statusText!: Phaser.GameObjects.Text
  private scrollX = 0
  private maxScrollX = 0
  private viewportX = 0
  private viewportWidth = 0
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
      'taekwondo-room-background',
      '/assets/images/themes/taekwondo/background/taekwondo_inside.png',
    )
  }

  create() {
    const { width: vw, height: vh } = this.scale
    addCoverBackground(this, 'taekwondo-room-background')
    this.add.rectangle(vw / 2, vh / 2, vw, vh, 0x1c1712, OVERLAY_ALPHA).setDepth(1)

    this.createHeader(vw)
    this.createHorizontalOptionList(vw, vh)
    this.createActionBar(vw, vh)

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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.isDragging = false
      this.input.keyboard?.off('keydown-ESC', this.handleEscDown)
      this.input.off('wheel', this.handleWheel)
      this.input.off('pointermove', this.handlePointerMove)
      this.input.off('pointerup', this.handlePointerUp)
      this.input.off('pointerupoutside', this.handlePointerUp)
    })

    this.cameras.main.fadeIn(FADE_DURATION, 0, 0, 0)
  }

  private createHeader(vw: number) {
    this.add
      .text(vw / 2, HEADER_TITLE_Y, '품새 선택', {
        fontFamily: 'sans-serif',
        fontSize: '38px',
        color: '#fff6df',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(3)

    this.add
      .text(vw / 2, HEADER_SUBTITLE_Y, '연습할 품새를 고르고 시작해보자', {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#e6d3af',
      })
      .setOrigin(0.5)
      .setDepth(3)
  }

  private createHorizontalOptionList(vw: number, vh: number) {
    this.viewportWidth = Math.min(vw * 0.78, 1040)
    this.viewportX = vw / 2 - this.viewportWidth / 2
    const viewportY = Math.max(160, vh * 0.23)
    const viewportHeight = Math.min(250, vh * 0.34)
    const cardWidth = Math.min(310, this.viewportWidth * 0.34)
    const cardHeight = viewportHeight - 20
    const gap = 18
    const contentWidth =
      TEST_POOMSAE_OPTIONS.length * cardWidth + Math.max(0, TEST_POOMSAE_OPTIONS.length - 1) * gap

    const maskShape = this.add
      .rectangle(this.viewportX, viewportY, this.viewportWidth, viewportHeight, 0xffffff, 0)
      .setOrigin(0)
      .setVisible(false)
    const mask = maskShape.createGeometryMask()

    this.rail = this.add.container(this.viewportX, viewportY + 10).setDepth(3)
    this.rail.setMask(mask)
    this.maxScrollX = Math.max(0, contentWidth - this.viewportWidth)

    this.optionCards = TEST_POOMSAE_OPTIONS.map((option, index) =>
      this.createOptionCard(option, index * (cardWidth + gap), 0, cardWidth, cardHeight),
    )

    const dragZone = this.add
      .zone(this.viewportX, viewportY, this.viewportWidth, viewportHeight)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .setDepth(2)
    dragZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true
      this.dragStartX = pointer.x
      this.dragStartScrollX = this.scrollX
    })

    this.createScrollButton(this.viewportX - 42, viewportY + viewportHeight / 2, '<', () =>
      this.setScroll(this.scrollX - cardWidth - gap),
    )
    this.createScrollButton(
      this.viewportX + this.viewportWidth + 42,
      viewportY + viewportHeight / 2,
      '>',
      () => this.setScroll(this.scrollX + cardWidth + gap),
    )
  }

  private createOptionCard(
    option: PoomsaeOption,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const background = this.add
      .rectangle(0, 0, width, height, 0x2c251d, 0.94)
      .setStrokeStyle(2, 0x8a6a3e, 0.75)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .setData('optionId', option.id)

    const title = this.add.text(22, 22, option.name, {
      fontFamily: 'sans-serif',
      fontSize: '25px',
      color: '#fff3d7',
      fontStyle: '700',
    })

    const meta = this.add.text(
      22,
      60,
      `${option.belt} · ${DIFFICULTY_LABEL[option.difficulty]} · 약 ${option.estimatedMinutes}분`,
      {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color: '#d5bf98',
      },
    )

    const description = this.add.text(22, 102, option.description, {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: '#f2e4c8',
      wordWrap: { width: width - 44, useAdvancedWrap: true },
      lineSpacing: 5,
    })

    const container = this.add.container(x, y, [background, title, meta, description])
    container.setSize(width, height).setData('optionId', option.id)
    this.rail.add(container)

    background.on('pointerdown', () => this.updateSelection(option.id))
    background.on('pointerover', () => {
      if (this.selectedOptionId !== option.id) {
        background.setFillStyle(0x3b3024, 0.98)
      }
    })
    background.on('pointerout', () => this.updateCardStyle({ container, background }))

    return { container, background }
  }

  private createScrollButton(x: number, y: number, labelText: string, onClick: () => void) {
    const background = this.add
      .circle(0, 0, 24, 0x5f4424, 0.96)
      .setStrokeStyle(2, 0xb98b45, 0.85)
      .setInteractive({ useHandCursor: true })
    const label = this.add
      .text(0, -1, labelText, {
        fontFamily: 'sans-serif',
        fontSize: '25px',
        color: '#fff6df',
        fontStyle: '700',
      })
      .setOrigin(0.5)

    background.on('pointerover', () => background.setFillStyle(0x76552b, 1))
    background.on('pointerout', () => background.setFillStyle(0x5f4424, 0.96))
    background.on('pointerdown', onClick)

    return this.add.container(x, y, [background, label]).setDepth(4)
  }

  private setScroll(scrollX: number) {
    this.scrollX = Phaser.Math.Clamp(scrollX, 0, this.maxScrollX)
    this.rail.x = this.viewportX - this.scrollX
  }

  private createActionBar(vw: number, vh: number) {
    this.statusText = this.add
      .text(vw / 2, vh - ACTION_STATUS_OFFSET_Y, '', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#f6ddac',
      })
      .setOrigin(0.5)
      .setDepth(3)

    const buttonY = vh - ACTION_BUTTON_OFFSET_Y
    this.createTextButton(vw / 2 - 120, buttonY, 170, '돌아가기', () => this.returnToDojang())
    this.createTextButton(vw / 2 + 120, buttonY, 170, '시작하기', () => this.showReadyMessage())
  }

  private createTextButton(
    x: number,
    y: number,
    width: number,
    labelText: string,
    onClick: () => void,
  ) {
    const background = this.add
      .rectangle(0, 0, width, 46, 0x5f4424, 0.96)
      .setStrokeStyle(2, 0xb98b45, 0.85)
      .setInteractive({ useHandCursor: true })
    const label = this.add
      .text(0, 0, labelText, {
        fontFamily: 'sans-serif',
        fontSize: '19px',
        color: '#fff6df',
        fontStyle: '700',
      })
      .setOrigin(0.5)

    background.on('pointerover', () => background.setFillStyle(0x76552b, 1))
    background.on('pointerout', () => background.setFillStyle(0x5f4424, 0.96))
    background.on('pointerdown', onClick)

    return this.add.container(x, y, [background, label]).setDepth(3)
  }

  private updateSelection(optionId: string) {
    this.selectedOptionId = optionId
    this.optionCards.forEach(card => this.updateCardStyle(card))
    const selectedOption = TEST_POOMSAE_OPTIONS.find(option => option.id === optionId)
    this.statusText?.setText(selectedOption ? `${selectedOption.name} 선택됨` : '')
  }

  private updateCardStyle(card: PoomsaeCard) {
    const isSelected = card.container.getData('optionId') === this.selectedOptionId
    card.background.setFillStyle(isSelected ? 0x60431f : 0x2c251d, isSelected ? 1 : 0.94)
    card.background.setStrokeStyle(2, isSelected ? 0xffd47b : 0x8a6a3e, isSelected ? 1 : 0.75)
  }

  private showReadyMessage() {
    this.isDragging = false
    const selectedOption = TEST_POOMSAE_OPTIONS.find(option => option.id === this.selectedOptionId)
    this.statusText.setText(
      selectedOption ? `${selectedOption.name} 연습 화면은 아직 준비 중이야.` : '품새를 선택해줘.',
    )
  }

  private showEmptyState(vw: number, vh: number) {
    this.statusText.setText('표시할 품새가 아직 없어.')
    this.add
      .text(vw / 2, vh * 0.45, '품새 테스트 데이터가 비어 있어.', {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        color: '#fff6df',
      })
      .setOrigin(0.5)
      .setDepth(3)
  }

  private returnToDojang() {
    this.isDragging = false
    fadeToScene(this, 'TaekwondoSelectScene', { duration: FADE_DURATION })
  }
}
