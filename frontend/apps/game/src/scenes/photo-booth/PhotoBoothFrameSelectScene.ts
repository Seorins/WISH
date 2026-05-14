import Phaser from 'phaser'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { PHOTO_BOOTH_FRAMES, type PhotoFrame } from './frames'

const PHOTO_BOOTH_RETURN_SPAWN = { xRatio: 0.515, yRatio: 0.345 }
const PREVIEW_WIDTH = 640
const PREVIEW_HEIGHT = 400
const PREVIEW_BORDER = 22
const ARROW_OFFSET_X = 420
const FONT = "'Jua', 'Apple SD Gothic Neo', sans-serif"

export class PhotoBoothFrameSelectScene extends Phaser.Scene {
  private isTransitioning = false
  private currentIndex = 0
  private previewCard!: Phaser.GameObjects.Rectangle
  private previewAccent!: Phaser.GameObjects.Rectangle
  private previewInner!: Phaser.GameObjects.Rectangle
  private indicatorDots: Phaser.GameObjects.Arc[] = []

  constructor() {
    super({ key: 'PhotoBoothFrameSelectScene' })
  }

  create() {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.currentIndex = 0
    this.indicatorDots = []

    this.add.rectangle(0, 0, vw, vh, 0x1f1a17).setOrigin(0)

    const centerX = vw / 2
    const centerY = vh / 2 - 20

    this.previewCard = this.add
      .rectangle(centerX, centerY, PREVIEW_WIDTH, PREVIEW_HEIGHT, 0xffffff, 1)
      .setOrigin(0.5)
    this.previewAccent = this.add
      .rectangle(centerX, centerY, PREVIEW_WIDTH, PREVIEW_HEIGHT, 0x000000, 0)
      .setOrigin(0.5)
      .setStrokeStyle(6, 0x000000, 1)
    this.previewInner = this.add
      .rectangle(
        centerX,
        centerY,
        PREVIEW_WIDTH - PREVIEW_BORDER * 2,
        PREVIEW_HEIGHT - PREVIEW_BORDER * 2,
        0x2a221d,
        1,
      )
      .setOrigin(0.5)

    this.createArrowButton(centerX - ARROW_OFFSET_X, centerY, 'left', () => this.selectPrev())
    this.createArrowButton(centerX + ARROW_OFFSET_X, centerY, 'right', () => this.selectNext())

    const dotsY = centerY + PREVIEW_HEIGHT / 2 + 48
    PHOTO_BOOTH_FRAMES.forEach((_, index) => {
      const dot = this.add
        .circle(
          centerX - ((PHOTO_BOOTH_FRAMES.length - 1) * 18) / 2 + index * 18,
          dotsY,
          5,
          0xffffff,
          0.3,
        )
        .setInteractive({ useHandCursor: true })
      dot.on('pointerdown', () => this.selectIndex(index))
      this.indicatorDots.push(dot)
    })

    this.createNextButton(vw - 140, vh - 60)
    this.createBackButton(60, 40)

    this.input.keyboard?.on('keydown-ESC', () => this.returnToVillage())
    this.input.keyboard?.on('keydown-LEFT', () => this.selectPrev())
    this.input.keyboard?.on('keydown-RIGHT', () => this.selectNext())
    this.input.keyboard?.on('keydown-ENTER', () => this.confirmSelection())

    this.renderCurrentFrame()
    this.cameras.main.fadeIn(250, 0, 0, 0)
  }

  private createArrowButton(x: number, y: number, dir: 'left' | 'right', onClick: () => void) {
    const bg = this.add
      .circle(x, y, 32, 0x3b302a, 1)
      .setStrokeStyle(2, 0x7a665a, 1)
      .setInteractive({ useHandCursor: true })
    this.add
      .text(x, y - 2, dir === 'left' ? '‹' : '›', {
        fontFamily: FONT,
        fontSize: '42px',
        color: '#fff4dc',
      })
      .setOrigin(0.5)
    bg.on('pointerdown', onClick)
    bg.on('pointerover', () => bg.setFillStyle(0x4f4039))
    bg.on('pointerout', () => bg.setFillStyle(0x3b302a))
  }

  private createNextButton(x: number, y: number) {
    const button = this.add
      .rectangle(x, y, 200, 56, 0x7657dd, 1)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    this.add
      .text(x, y, '다음 →', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
    button.on('pointerdown', () => this.confirmSelection())
    button.on('pointerover', () => button.setFillStyle(0x8b6dee))
    button.on('pointerout', () => button.setFillStyle(0x7657dd))
  }

  private createBackButton(x: number, y: number) {
    const button = this.add
      .rectangle(x, y, 100, 40, 0x000000, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    this.add
      .text(x, y, '← 마을로', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#bfae9a',
      })
      .setOrigin(0.5)
    button.on('pointerdown', () => this.returnToVillage())
  }

  private selectPrev() {
    this.selectIndex(
      (this.currentIndex - 1 + PHOTO_BOOTH_FRAMES.length) % PHOTO_BOOTH_FRAMES.length,
    )
  }

  private selectNext() {
    this.selectIndex((this.currentIndex + 1) % PHOTO_BOOTH_FRAMES.length)
  }

  private selectIndex(index: number) {
    if (this.currentIndex === index) return
    this.currentIndex = index
    this.renderCurrentFrame()
  }

  private renderCurrentFrame() {
    const frame: PhotoFrame = PHOTO_BOOTH_FRAMES[this.currentIndex]
    this.previewCard.setFillStyle(frame.placeholderColor, 1)
    this.previewAccent.setStrokeStyle(6, frame.placeholderAccent, 1)
    this.previewInner.setVisible(true)
    this.indicatorDots.forEach((dot, index) => {
      dot.setFillStyle(0xffffff, index === this.currentIndex ? 1 : 0.3)
      dot.setRadius(index === this.currentIndex ? 6 : 5)
    })
  }

  private confirmSelection() {
    if (this.isTransitioning) return
    const frame = PHOTO_BOOTH_FRAMES[this.currentIndex]
    this.isTransitioning = true
    fadeToScene(this, 'PhotoBoothCameraScene', {
      duration: 250,
      data: { frameId: frame.id },
    })
  }

  private returnToVillage() {
    if (this.isTransitioning) return
    this.isTransitioning = true
    fadeToScene(this, 'VillageScene', {
      duration: 250,
      data: { spawn: PHOTO_BOOTH_RETURN_SPAWN, portalCooldownMs: 250 },
    })
  }
}
