import Phaser from 'phaser'
import { fadeToScene } from '@/game/systems/sceneTransition'

const PHOTO_BOOTH_RETURN_SPAWN = { xRatio: 0.515, yRatio: 0.345 }

export class PhotoBoothFrameSelectScene extends Phaser.Scene {
  private isTransitioning = false

  constructor() {
    super({ key: 'PhotoBoothFrameSelectScene' })
  }

  create() {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false

    this.add.rectangle(0, 0, vw, vh, 0x1f1a17).setOrigin(0)

    this.add
      .text(vw / 2, vh / 2 - 40, '사진 프레임 선택', {
        fontFamily: "'Jua', 'Apple SD Gothic Neo', sans-serif",
        fontSize: '42px',
        color: '#fff4dc',
      })
      .setOrigin(0.5)

    this.add
      .text(vw / 2, vh / 2 + 16, '준비 중이에요', {
        fontFamily: "'Jua', 'Apple SD Gothic Neo', sans-serif",
        fontSize: '20px',
        color: '#bfae9a',
      })
      .setOrigin(0.5)

    const backButton = this.add
      .rectangle(vw / 2, vh / 2 + 96, 200, 48, 0x7657dd, 1)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    this.add
      .text(vw / 2, vh / 2 + 96, '마을로 돌아가기', {
        fontFamily: "'Jua', 'Apple SD Gothic Neo', sans-serif",
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    backButton.on('pointerdown', () => this.returnToVillage())
    this.input.keyboard?.on('keydown-ESC', () => this.returnToVillage())

    this.cameras.main.fadeIn(250, 0, 0, 0)
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
