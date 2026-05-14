import Phaser from 'phaser'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { PHOTO_BOOTH_FRAMES } from './frames'

const FONT = "'Jua', 'Apple SD Gothic Neo', sans-serif"

type PhotoBoothCameraSceneData = {
  frameId?: string
}

export class PhotoBoothCameraScene extends Phaser.Scene {
  private isTransitioning = false
  private frameId: string | null = null

  constructor() {
    super({ key: 'PhotoBoothCameraScene' })
  }

  create(data: PhotoBoothCameraSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.frameId = data.frameId ?? null

    const frame = PHOTO_BOOTH_FRAMES.find(f => f.id === this.frameId) ?? PHOTO_BOOTH_FRAMES[0]

    this.add.rectangle(0, 0, vw, vh, 0x1f1a17).setOrigin(0)

    this.add
      .text(vw / 2, vh / 2 - 40, '카메라', {
        fontFamily: FONT,
        fontSize: '42px',
        color: '#fff4dc',
      })
      .setOrigin(0.5)
    this.add
      .text(vw / 2, vh / 2 + 8, `선택한 프레임: ${frame.id} · 준비 중이에요`, {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#bfae9a',
      })
      .setOrigin(0.5)

    const backButton = this.add
      .rectangle(vw / 2 - 110, vh / 2 + 96, 180, 48, 0x3b302a, 1)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x7a665a, 1)
      .setInteractive({ useHandCursor: true })
    this.add
      .text(vw / 2 - 110, vh / 2 + 96, '← 프레임 다시 고르기', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#fff4dc',
      })
      .setOrigin(0.5)
    backButton.on('pointerdown', () => this.backToFrameSelect())

    const villageButton = this.add
      .rectangle(vw / 2 + 110, vh / 2 + 96, 180, 48, 0x7657dd, 1)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    this.add
      .text(vw / 2 + 110, vh / 2 + 96, '마을로 돌아가기', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
    villageButton.on('pointerdown', () => this.returnToVillage())

    this.input.keyboard?.on('keydown-ESC', () => this.backToFrameSelect())

    this.cameras.main.fadeIn(250, 0, 0, 0)
  }

  private backToFrameSelect() {
    if (this.isTransitioning) return
    this.isTransitioning = true
    fadeToScene(this, 'PhotoBoothFrameSelectScene', { duration: 250 })
  }

  private returnToVillage() {
    if (this.isTransitioning) return
    this.isTransitioning = true
    fadeToScene(this, 'VillageScene', {
      duration: 250,
      data: { spawn: { xRatio: 0.515, yRatio: 0.345 }, portalCooldownMs: 250 },
    })
  }
}
