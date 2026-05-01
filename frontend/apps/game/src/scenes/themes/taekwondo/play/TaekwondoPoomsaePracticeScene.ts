import Phaser from 'phaser'
import { assetPath } from '@/game/assets/assetPath'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'

const ASSET_KEYS = {
  background: 'taekwondo-practice-background',
  deleteButton: 'taekwondo-practice-delete-button',
  feedback: 'taekwondo-practice-feedback',
  seokjae: 'taekwondo-practice-seokjae',
  seokjaeProgress: 'taekwondo-practice-seokjae-progress',
  seokjaeProgressActive: 'taekwondo-practice-seokjae-progress-active',
} as const

const FADE_DURATION = 220
const OVERLAY_ALPHA = 0.12
const PANEL_FILL = 0xfff7ea
const PANEL_STROKE = 0x7b4a19
const PANEL_ALPHA = 0.9
const TEXT_COLOR = '#2c1708'
const TEMP_POOMSAE_STEP_COUNT = 6
const TEMP_COMPLETED_STEP_COUNT = 2
const TEMP_FEEDBACK_MESSAGE = '주어지는 피드백 표시 후 소멸'
const FEEDBACK_VISIBLE_MS = 2200

export class TaekwondoPoomsaePracticeScene extends Phaser.Scene {
  private mediaStream: MediaStream | null = null
  private videoElement: HTMLVideoElement | null = null
  private cameraCanvas: HTMLCanvasElement | null = null
  private cameraContext: CanvasRenderingContext2D | null = null
  private cameraTexture: Phaser.Textures.CanvasTexture | null = null
  private feedbackContainer?: Phaser.GameObjects.Container
  private hasDrawnCameraPlaceholder = false
  private lastVideoTime = -1

  private readonly handleEscDown = () => {
    this.returnToPoomsaeSelect()
  }

  constructor() {
    super({ key: 'TaekwondoPoomsaePracticeScene' })
  }

  preload() {
    this.load.image(
      ASSET_KEYS.background,
      assetPath('images/themes/taekwondo/background/taekwondo_inside.png'),
    )
    this.load.image(ASSET_KEYS.seokjae, assetPath('images/themes/taekwondo/characters/seokjae.png'))
    this.load.image(ASSET_KEYS.deleteButton, assetPath('images/themes/taekwondo/ui/delete_btn.png'))
    this.load.image(ASSET_KEYS.feedback, assetPath('images/themes/taekwondo/ui/feedback.png'))
    this.load.image(
      ASSET_KEYS.seokjaeProgress,
      assetPath('images/themes/taekwondo/ui/seokjae_icon.png'),
    )
    this.load.image(
      ASSET_KEYS.seokjaeProgressActive,
      assetPath('images/themes/taekwondo/ui/seokjae_icon_activate.png'),
    )
  }

  create() {
    const { width: vw, height: vh } = this.scale

    addCoverBackground(this, ASSET_KEYS.background)
    this.add.rectangle(vw / 2, vh / 2, vw, vh, 0x120d08, OVERLAY_ALPHA).setDepth(1)

    this.createCameraTexture()
    this.createTopBar(vw, vh)
    this.createPracticePanels(vw, vh)
    this.createGuideNpc(vw, vh)
    this.showFeedback(TEMP_FEEDBACK_MESSAGE)
    this.startCamera()

    this.input.keyboard?.on('keydown-ESC', this.handleEscDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup())
    this.cameras.main.fadeIn(FADE_DURATION, 0, 0, 0)
  }

  update() {
    this.drawCameraFrame()
  }

  private createCameraTexture() {
    this.cameraCanvas = document.createElement('canvas')
    this.cameraCanvas.width = 960
    this.cameraCanvas.height = 720

    const context = this.cameraCanvas.getContext('2d')
    if (!context) {
      throw new Error('Taekwondo camera canvas context is not available.')
    }
    this.cameraContext = context

    const textureKey = `${this.scene.key}-camera`
    if (this.textures.exists(textureKey)) {
      this.textures.remove(textureKey)
    }

    const texture = this.textures.addCanvas(textureKey, this.cameraCanvas)
    if (!texture) {
      throw new Error('Taekwondo camera texture is not available.')
    }
    this.cameraTexture = texture
  }

  private createTopBar(vw: number, vh: number) {
    const topY = vh * 0.075
    const topHeight = Phaser.Math.Clamp(vh * 0.075, 58, 78)
    this.createPoomsaeProgress(vw / 2, topY, topHeight)

    this.createDeleteButton(vw * 0.87, topY, topHeight, () => this.stopPractice())
  }

  private createPracticePanels(vw: number, vh: number) {
    const contentTop = vh * 0.145
    const contentBottom = vh * 0.92
    const contentHeight = contentBottom - contentTop
    const leftX = vw * 0.275
    const leftWidth = vw * 0.42
    const rightX = vw * 0.7
    const rightWidth = vw * 0.42

    this.createCameraPanel(leftX, contentTop + contentHeight / 2, leftWidth, contentHeight)

    this.createPanel(rightX, contentTop + contentHeight / 2, rightWidth, contentHeight, 0.68)
    this.addLabel(rightX, contentTop + contentHeight * 0.42, '따라할 동작', 32, 5)
  }

  private createGuideNpc(vw: number, vh: number) {
    const npcHeight = Phaser.Math.Clamp(vh * 0.3, 140, 230)
    const npcX = vw * 0.93
    const npcY = vh * 0.98

    this.add
      .image(npcX, npcY, ASSET_KEYS.seokjae)
      .setOrigin(0.5, 1)
      .setDisplaySize(npcHeight * (617 / 890), npcHeight)
      .setDepth(5)
  }

  private showFeedback(message: string) {
    this.feedbackContainer?.destroy()

    if (!message) {
      this.feedbackContainer = undefined
      return
    }

    const { width: vw, height: vh } = this.scale
    const feedbackWidth = Math.min(vw * 0.32, 500)
    const feedbackHeight = feedbackWidth * (330 / 852)
    const feedbackX = vw * 0.8
    const feedbackY = vh * 0.615

    const background = this.add
      .image(0, 0, ASSET_KEYS.feedback)
      .setDisplaySize(feedbackWidth, feedbackHeight)
      .setDepth(7)
    const label = this.add
      .text(0, -feedbackHeight * 0.04, message, {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(feedbackHeight * 0.18, 18, 28))}px`,
        color: TEXT_COLOR,
        fontStyle: '700',
        align: 'center',
        wordWrap: { width: feedbackWidth * 0.72, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setDepth(8)

    this.feedbackContainer = this.add
      .container(feedbackX, feedbackY, [background, label])
      .setDepth(7)
      .setAlpha(0)

    this.tweens.add({
      targets: this.feedbackContainer,
      alpha: 1,
      duration: 160,
      yoyo: true,
      hold: FEEDBACK_VISIBLE_MS,
      onComplete: () => {
        this.feedbackContainer?.destroy()
        this.feedbackContainer = undefined
      },
    })
  }

  private createCameraPanel(x: number, y: number, width: number, height: number) {
    this.createPanel(x, y, width, height, 0.92)

    const cameraInset = 10
    const cameraWidth = width - cameraInset * 2
    const cameraHeight = height - cameraInset * 2
    this.resizeCameraTexture(cameraWidth, cameraHeight)

    if (!this.cameraTexture) {
      return
    }

    const cameraImage = this.add
      .image(x, y, this.cameraTexture.key)
      .setDisplaySize(cameraWidth, cameraHeight)
      .setDepth(5)

    const maskShape = this.add.graphics()
    maskShape
      .fillStyle(0xffffff, 1)
      .fillRoundedRect(
        x - width / 2 + cameraInset,
        y - height / 2 + cameraInset,
        cameraWidth,
        cameraHeight,
        10,
      )
      .setVisible(false)
    cameraImage.setMask(maskShape.createGeometryMask())
  }

  private resizeCameraTexture(displayWidth: number, displayHeight: number) {
    if (!this.cameraCanvas || !this.cameraTexture) {
      return
    }

    const canvasWidth = 960
    const canvasHeight = Math.max(1, Math.round(canvasWidth * (displayHeight / displayWidth)))

    if (this.cameraCanvas.width === canvasWidth && this.cameraCanvas.height === canvasHeight) {
      return
    }

    this.cameraCanvas.width = canvasWidth
    this.cameraCanvas.height = canvasHeight

    const context = this.cameraCanvas.getContext('2d')
    if (!context) {
      throw new Error('Taekwondo camera canvas context is not available.')
    }
    this.cameraContext = context
    this.cameraTexture.refresh()
    this.hasDrawnCameraPlaceholder = false
    this.lastVideoTime = -1
  }

  private createPanel(x: number, y: number, width: number, height: number, alpha = PANEL_ALPHA) {
    const panel = this.add
      .rectangle(x, y, width, height, PANEL_FILL, alpha)
      .setStrokeStyle(Math.max(3, Math.round(Math.min(width, height) * 0.035)), PANEL_STROKE, 0.85)
      .setDepth(3)

    return panel
  }

  private createPoomsaeProgress(x: number, y: number, height: number) {
    const iconSize = height * 0.82
    const gap = iconSize * 0.22
    const totalWidth = iconSize * TEMP_POOMSAE_STEP_COUNT + gap * (TEMP_POOMSAE_STEP_COUNT - 1)
    const startX = x - totalWidth / 2 + iconSize / 2

    for (let index = 0; index < TEMP_POOMSAE_STEP_COUNT; index += 1) {
      const texture =
        index < TEMP_COMPLETED_STEP_COUNT
          ? ASSET_KEYS.seokjaeProgressActive
          : ASSET_KEYS.seokjaeProgress

      this.add
        .image(startX + index * (iconSize + gap), y, texture)
        .setDisplaySize(iconSize, iconSize)
        .setDepth(5)
    }
  }

  private createDeleteButton(x: number, y: number, size: number, onClick: () => void) {
    const button = this.add
      .image(0, 0, ASSET_KEYS.deleteButton)
      .setDisplaySize(size, size)
      .setDepth(6)

    const hitArea = this.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({
      useHandCursor: true,
    })
    hitArea.on('pointerdown', onClick)
    hitArea.on('pointerover', () => button.setTint(0xffefc4))
    hitArea.on('pointerout', () => button.clearTint())

    return this.add.container(x, y, [button, hitArea]).setDepth(6)
  }

  private addLabel(x: number, y: number, text: string, fontSize: number, depth: number) {
    return this.add
      .text(x, y, text, {
        fontFamily: 'sans-serif',
        fontSize: `${fontSize}px`,
        color: TEXT_COLOR,
        fontStyle: '700',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5)
      .setDepth(depth)
  }

  private async startCamera() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      this.videoElement = document.createElement('video')
      this.videoElement.srcObject = this.mediaStream
      this.videoElement.muted = true
      this.videoElement.playsInline = true
      await this.videoElement.play()
    } catch {
      this.mediaStream = null
      this.videoElement = null
      this.hasDrawnCameraPlaceholder = false
      this.showFeedback('카메라 권한을 허용해주세요')
    }
  }

  private canReadCameraFrame() {
    return Boolean(
      this.videoElement &&
      this.videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      this.mediaStream?.active,
    )
  }

  private drawCameraFrame() {
    if (!this.cameraCanvas || !this.cameraContext || !this.cameraTexture) {
      return
    }

    if (this.canReadCameraFrame() && this.videoElement) {
      if (this.videoElement.currentTime === this.lastVideoTime) {
        return
      }

      this.lastVideoTime = this.videoElement.currentTime
      this.hasDrawnCameraPlaceholder = false
    } else if (this.hasDrawnCameraPlaceholder) {
      return
    }

    this.cameraContext.clearRect(0, 0, this.cameraCanvas.width, this.cameraCanvas.height)

    if (this.canReadCameraFrame() && this.videoElement) {
      const videoWidth = this.videoElement.videoWidth || this.cameraCanvas.width
      const videoHeight = this.videoElement.videoHeight || this.cameraCanvas.height
      const canvasAspect = this.cameraCanvas.width / this.cameraCanvas.height
      const videoAspect = videoWidth / videoHeight
      let sourceX = 0
      let sourceY = 0
      let sourceWidth = videoWidth
      let sourceHeight = videoHeight

      if (videoAspect > canvasAspect) {
        sourceWidth = videoHeight * canvasAspect
        sourceX = (videoWidth - sourceWidth) / 2
      } else {
        sourceHeight = videoWidth / canvasAspect
        sourceY = (videoHeight - sourceHeight) / 2
      }

      this.cameraContext.save()
      this.cameraContext.translate(this.cameraCanvas.width, 0)
      this.cameraContext.scale(-1, 1)
      this.cameraContext.drawImage(
        this.videoElement,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        this.cameraCanvas.width,
        this.cameraCanvas.height,
      )
      this.cameraContext.restore()
    } else {
      const gradient = this.cameraContext.createLinearGradient(0, 0, 0, this.cameraCanvas.height)
      gradient.addColorStop(0, '#f8d49a')
      gradient.addColorStop(1, '#8b4f1f')
      this.cameraContext.fillStyle = gradient
      this.cameraContext.fillRect(0, 0, this.cameraCanvas.width, this.cameraCanvas.height)
      this.cameraContext.fillStyle = 'rgba(46, 24, 8, 0.78)'
      this.cameraContext.font = 'bold 42px sans-serif'
      this.cameraContext.textAlign = 'center'
      this.cameraContext.textBaseline = 'middle'
      this.cameraContext.fillText(
        '카메라를 준비하고 있어요',
        this.cameraCanvas.width / 2,
        this.cameraCanvas.height / 2,
      )
      this.hasDrawnCameraPlaceholder = true
    }

    this.cameraTexture.refresh()
  }

  private returnToPoomsaeSelect() {
    fadeToScene(this, 'TaekwondoPoomsaeSelectScene', { duration: FADE_DURATION })
  }

  private stopPractice() {
    this.stopCamera()
    this.returnToPoomsaeSelect()
  }

  private stopCamera() {
    this.mediaStream?.getTracks().forEach(track => track.stop())
    this.mediaStream = null

    if (this.videoElement) {
      this.videoElement.pause()
      this.videoElement.srcObject = null
    }
    this.videoElement = null
    this.lastVideoTime = -1
    this.hasDrawnCameraPlaceholder = false
  }

  private cleanup() {
    this.input.keyboard?.off('keydown-ESC', this.handleEscDown)
    this.feedbackContainer?.destroy()
    this.feedbackContainer = undefined
    this.stopCamera()

    if (this.cameraTexture) {
      this.textures.remove(this.cameraTexture.key)
      this.cameraTexture = null
    }

    if (this.cameraCanvas) {
      this.cameraCanvas.remove()
      this.cameraCanvas = null
    }

    this.cameraContext = null
  }
}
