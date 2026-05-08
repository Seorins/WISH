import Phaser from 'phaser'
import { assetPath } from '@/game/assets/assetPath'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'
import {
  CameraSuccessEffect,
  type CameraSuccessEffectOptions,
} from '../effects/cameraSuccessEffect'
import {
  DEFAULT_TAEKWONDO_BELT_COLOR,
  getTaekwondoPoomsaeNumber,
  listTaekwondoMotions,
  type Poomsae,
  type TaekwondoBeltColor,
  type TaekwondoMotion,
} from '@wish/api-client'

type TaekwondoPoomsaePracticeData = {
  poomsaeId?: string
  poomsaeName?: string
  poomsae?: Poomsae
  beltColor?: TaekwondoBeltColor
}

const ASSET_KEYS = {
  background: 'taekwondo-practice-background',
  deleteButton: 'taekwondo-practice-delete-button',
  feedback: 'taekwondo-practice-feedback',
  guide: 'taekwondo-practice-guide',
  guidePose: 'taekwondo-practice-guide-pose',
  progress: 'taekwondo-practice-progress',
  seokjae: 'taekwondo-practice-seokjae',
  seokjaeProgress: 'taekwondo-practice-seokjae-progress',
  seokjaeProgressActive: 'taekwondo-practice-seokjae-progress-active',
  userCamera: 'taekwondo-practice-user-camera',
} as const

const FADE_DURATION = 220
const OVERLAY_ALPHA = 0.08
const TEXT_COLOR = '#3a2110'
const TEMP_TOTAL_STEP_COUNT = 9
const TEMP_ACTIVE_STEP_COUNT = 4
const DEFAULT_CURRENT_MOTION_NAME = '동작 준비중'
const DEFAULT_FEEDBACK_MESSAGE = '실시간 피드백'
const CAMERA_DENIED_MESSAGE = '카메라를 아직 준비 중입니다.'
const PROGRESS_VISIBLE_HEIGHT_RATIO = 274 / 725
const PROGRESS_VISIBLE_CENTER_OFFSET_RATIO = (725 / 2 - (193 + 466) / 2) / 725

const IMAGE_ASPECT = {
  deleteButton: 344 / 336,
  feedback: 852 / 330,
  guide: 1086 / 1449,
  progress: 2169 / 725,
  seokjae: 617 / 890,
  userCamera: 1448 / 1086,
} as const

export class TaekwondoPoomsaePracticeScene extends Phaser.Scene {
  private mediaStream: MediaStream | null = null
  private videoElement: HTMLVideoElement | null = null
  private cameraCanvas: HTMLCanvasElement | null = null
  private cameraContext: CanvasRenderingContext2D | null = null
  private cameraTexture: Phaser.Textures.CanvasTexture | null = null
  private cameraSuccessEffect?: CameraSuccessEffect
  private feedbackText?: Phaser.GameObjects.Text
  private currentMotionText?: Phaser.GameObjects.Text
  private motions: TaekwondoMotion[] = []
  private currentMotionIndex = 0
  private isSceneShuttingDown = false
  private hasDrawnCameraPlaceholder = false
  private lastVideoTime = -1
  private poomsaeId = 'taegeuk-1'
  private poomsae?: Poomsae
  private beltColor: TaekwondoBeltColor = DEFAULT_TAEKWONDO_BELT_COLOR

  private readonly handleEscDown = () => {
    this.returnToPoomsaeSelect()
  }

  private readonly handleNextMotionTestDown = () => {
    this.advanceToNextMotion()
  }

  constructor() {
    super({ key: 'TaekwondoPoomsaePracticeScene' })
  }

  init(data: TaekwondoPoomsaePracticeData = {}) {
    this.poomsaeId = data.poomsaeId ?? 'taegeuk-1'
    this.poomsae = data.poomsae
    this.beltColor = data.beltColor ?? DEFAULT_TAEKWONDO_BELT_COLOR
    this.motions = []
    this.currentMotionIndex = 0
    this.isSceneShuttingDown = false
  }

  preload() {
    this.load.image(
      ASSET_KEYS.background,
      assetPath('images/themes/taekwondo/background/taekwondo_inside.png'),
    )
    this.load.image(ASSET_KEYS.deleteButton, assetPath('images/themes/taekwondo/ui/delete_btn.png'))
    this.load.image(ASSET_KEYS.feedback, assetPath('images/themes/taekwondo/ui/feedback.png'))
    this.load.image(ASSET_KEYS.guide, assetPath('images/themes/taekwondo/ui/guide.png'))
    this.load.image(
      ASSET_KEYS.guidePose,
      assetPath(`images/themes/taekwondo/characters/poomsae_${this.getPoomsaeNumber()}.png`),
    )
    this.load.image(ASSET_KEYS.progress, assetPath('images/themes/taekwondo/ui/progress.png'))
    this.load.image(ASSET_KEYS.seokjae, assetPath('images/themes/taekwondo/characters/seokjae.png'))
    this.load.image(
      ASSET_KEYS.seokjaeProgress,
      assetPath('images/themes/taekwondo/ui/seokjae_icon.png'),
    )
    this.load.image(
      ASSET_KEYS.seokjaeProgressActive,
      assetPath('images/themes/taekwondo/ui/seokjae_icon_activate.png'),
    )
    this.load.image(ASSET_KEYS.userCamera, assetPath('images/themes/taekwondo/ui/user_camera.png'))
  }

  create() {
    const { width: vw, height: vh } = this.scale

    addCoverBackground(this, ASSET_KEYS.background)
    this.add.rectangle(vw / 2, vh / 2, vw, vh, 0x120d08, OVERLAY_ALPHA).setDepth(1)

    this.createCameraTexture()
    this.createTopStatus(vw, vh)
    this.createPracticeLayout(vw, vh)
    this.startCamera()
    void this.loadPracticeMotions()

    this.input.keyboard?.on('keydown-ESC', this.handleEscDown)
    this.input.keyboard?.on('keydown-N', this.handleNextMotionTestDown)
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

  private getPoomsaeNumber() {
    if (this.poomsae) {
      return String(getTaekwondoPoomsaeNumber(this.poomsae))
    }

    const match = this.poomsaeId.match(/\d+$/)
    return match?.[0] ?? '1'
  }

  private getPoomsaeForApi(): Poomsae {
    if (this.poomsae) {
      return this.poomsae
    }

    const poomsaeNumber = Phaser.Math.Clamp(Number(this.getPoomsaeNumber()), 1, 8)
    return `TAEGEUK_${poomsaeNumber}` as Poomsae
  }

  private async loadPracticeMotions() {
    this.setCurrentMotionName(DEFAULT_CURRENT_MOTION_NAME)

    try {
      const response = await listTaekwondoMotions(this.getPoomsaeForApi())

      if (this.isSceneShuttingDown) {
        return
      }

      this.motions = [...(response.data ?? [])].sort(
        (left, right) => left.routineOrder - right.routineOrder,
      )
      this.currentMotionIndex = 0
      this.setCurrentMotionName(this.getCurrentMotionName())
    } catch {
      if (!this.isSceneShuttingDown) {
        this.motions = []
        this.currentMotionIndex = 0
        this.setCurrentMotionName(DEFAULT_CURRENT_MOTION_NAME)
      }
    }
  }

  private getCurrentMotionName() {
    return this.motions[this.currentMotionIndex]?.name ?? DEFAULT_CURRENT_MOTION_NAME
  }

  private setCurrentMotionName(name: string) {
    this.currentMotionText?.setText(name)
  }

  private advanceToNextMotion() {
    if (this.motions.length === 0) {
      this.setCurrentMotionName(DEFAULT_CURRENT_MOTION_NAME)
      return
    }

    const nextMotionIndex = this.currentMotionIndex + 1
    if (nextMotionIndex >= this.motions.length) {
      this.stopPractice()
      return
    }

    this.currentMotionIndex = nextMotionIndex
    this.setCurrentMotionName(this.getCurrentMotionName())
  }

  private createTopStatus(vw: number, vh: number) {
    const topY = vh * 0.116
    const progressWidth = vw * 0.49
    const progressHeight = vh * 0.25
    const currentHeight = progressHeight * PROGRESS_VISIBLE_HEIGHT_RATIO
    const visualTopY = topY - progressHeight * PROGRESS_VISIBLE_CENTER_OFFSET_RATIO
    const currentY = topY - progressHeight * 0.032
    const currentWidth = vw * 0.3
    const deleteSize = vh * 0.073

    this.createCurrentMotionPanel(vw * 0.23, currentY, currentWidth, currentHeight)

    this.currentMotionText = this.add
      .text(vw * 0.23, currentY - currentHeight * 0.02, DEFAULT_CURRENT_MOTION_NAME, {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(currentHeight * 0.3, 22, 32))}px`,
        color: TEXT_COLOR,
        fontStyle: '700',
        align: 'center',
        wordWrap: { width: currentWidth * 0.78, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setDepth(5)

    this.createPoomsaeProgress(
      vw * 0.553,
      topY,
      progressWidth,
      progressHeight,
      TEMP_TOTAL_STEP_COUNT,
      TEMP_ACTIVE_STEP_COUNT,
    )

    this.createDeleteButton(vw * 0.885, visualTopY, deleteSize, () => this.stopPractice())
  }

  private createCurrentMotionPanel(x: number, y: number, width: number, height: number) {
    const borderSize = 5
    const radius = Math.round(height * 0.48)
    const frame = this.add.graphics().setDepth(4)
    frame.fillStyle(0xfff8eb, 0.96)
    frame.fillRoundedRect(
      x - width / 2 - borderSize,
      y - height / 2 - borderSize,
      width + borderSize * 2,
      height + borderSize * 2,
      radius + borderSize,
    )
    frame.lineStyle(2, 0xe5c58f, 0.9)
    frame.strokeRoundedRect(
      x - width / 2 - borderSize,
      y - height / 2 - borderSize,
      width + borderSize * 2,
      height + borderSize * 2,
      radius + borderSize,
    )
  }

  private createPracticeLayout(vw: number, vh: number) {
    const cameraWidth = vw * 0.51
    const cameraHeight = vh * 0.732
    const cameraX = vw * 0.334
    const cameraY = vh * 0.548
    const rightX = vw * 0.754
    const rightWidth = vw * 0.286
    const guideY = vh * 0.396
    const guideHeight = vh * 0.437
    const feedbackY = vh * 0.783
    const feedbackHeight = vh * 0.25

    this.createCameraPanel(cameraX, cameraY, cameraWidth, cameraHeight)
    this.createGuideVideoPanel(rightX, guideY, rightWidth, guideHeight)
    this.createFeedbackPanel(rightX, feedbackY, rightWidth, feedbackHeight)
  }

  private createCameraPanel(x: number, y: number, width: number, height: number) {
    const borderSize = 5
    const radius = Math.round(Math.min(width, height) * 0.04)
    const frame = this.add.graphics().setDepth(3)
    frame.fillStyle(0xfff8eb, 0.96)
    frame.fillRoundedRect(
      x - width / 2 - borderSize,
      y - height / 2 - borderSize,
      width + borderSize * 2,
      height + borderSize * 2,
      radius + borderSize,
    )
    frame.lineStyle(2, 0xe5c58f, 0.9)
    frame.strokeRoundedRect(
      x - width / 2 - borderSize,
      y - height / 2 - borderSize,
      width + borderSize * 2,
      height + borderSize * 2,
      radius + borderSize,
    )

    const cameraWidth = width
    const cameraHeight = height
    const cameraX = x
    const cameraY = y
    this.resizeCameraTexture(cameraWidth, cameraHeight)

    if (!this.cameraTexture) {
      return frame
    }

    const cameraImage = this.add
      .image(cameraX, cameraY, this.cameraTexture.key)
      .setDisplaySize(cameraWidth, cameraHeight)
      .setDepth(4)

    const maskShape = this.add.graphics()
    maskShape
      .fillStyle(0xffffff, 1)
      .fillRoundedRect(
        cameraX - cameraWidth / 2,
        cameraY - cameraHeight / 2,
        cameraWidth,
        cameraHeight,
        radius,
      )
      .setVisible(false)
    cameraImage.setMask(maskShape.createGeometryMask())
    this.cameraSuccessEffect?.destroy()
    this.cameraSuccessEffect = new CameraSuccessEffect(this, {
      bounds: { x: cameraX, y: cameraY, width: cameraWidth, height: cameraHeight, radius },
      depth: 5,
      onSuccessFeedback: message => this.showFeedback(message),
    })

    return frame
  }

  triggerSuccessEffect(options: CameraSuccessEffectOptions = {}) {
    this.cameraSuccessEffect?.triggerSuccess(options)
  }

  spawnNextMotionEnemies() {
    this.cameraSuccessEffect?.spawnNextMotionEnemies()
  }

  private createGuideVideoPanel(x: number, y: number, width: number, height: number) {
    const borderSize = 5
    const radius = Math.round(Math.min(width, height) * 0.08)
    const frame = this.add.graphics().setDepth(3)
    frame.fillStyle(0xfff8eb, 0.96)
    frame.fillRoundedRect(
      x - width / 2 - borderSize,
      y - height / 2 - borderSize,
      width + borderSize * 2,
      height + borderSize * 2,
      radius + borderSize,
    )
    frame.lineStyle(2, 0xe5c58f, 0.9)
    frame.strokeRoundedRect(
      x - width / 2 - borderSize,
      y - height / 2 - borderSize,
      width + borderSize * 2,
      height + borderSize * 2,
      radius + borderSize,
    )

    this.add
      .text(x, y - height * 0.36, '\uac00\uc774\ub4dc \uc601\uc0c1', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(height * 0.085, 24, 38))}px`,
        color: TEXT_COLOR,
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(5)

    this.add
      .image(x, y + height * 0.08, ASSET_KEYS.guidePose)
      .setDisplaySize(width * 0.38, height * 0.52)
      .setDepth(5)
  }

  private createFeedbackPanel(x: number, y: number, width: number, height: number) {
    const borderSize = 5
    const radius = Math.round(Math.min(width, height) * 0.12)
    const frame = this.add.graphics().setDepth(3)
    frame.fillStyle(0xfff8eb, 0.96)
    frame.fillRoundedRect(
      x - width / 2 - borderSize,
      y - height / 2 - borderSize,
      width + borderSize * 2,
      height + borderSize * 2,
      radius + borderSize,
    )
    frame.lineStyle(2, 0xe5c58f, 0.9)
    frame.strokeRoundedRect(
      x - width / 2 - borderSize,
      y - height / 2 - borderSize,
      width + borderSize * 2,
      height + borderSize * 2,
      radius + borderSize,
    )

    this.feedbackText = this.add
      .text(x, y, DEFAULT_FEEDBACK_MESSAGE, {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(height * 0.16, 22, 34))}px`,
        color: TEXT_COLOR,
        fontStyle: '700',
        align: 'center',
        wordWrap: { width: width * 0.78, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setDepth(5)
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

  private createPoomsaeProgress(
    x: number,
    y: number,
    width: number,
    height: number,
    totalStepCount: number,
    activeStepCount: number,
  ) {
    this.add.image(x, y, ASSET_KEYS.progress).setDisplaySize(width, height).setDepth(4)

    const iconSize = Phaser.Math.Clamp(this.scale.height * 0.052, 44, 58)
    const iconY = y - height * 0.04
    const gap = iconSize * 0.18
    const totalWidth = iconSize * totalStepCount + gap * (totalStepCount - 1)
    const startX = x - totalWidth / 2 + iconSize / 2

    for (let index = 0; index < totalStepCount; index += 1) {
      const texture =
        index < activeStepCount ? ASSET_KEYS.seokjaeProgressActive : ASSET_KEYS.seokjaeProgress

      this.add
        .image(startX + index * (iconSize + gap), iconY, texture)
        .setDisplaySize(iconSize, iconSize)
        .setDepth(5)
    }
  }

  private createDeleteButton(x: number, y: number, size: number, onClick: () => void) {
    const buttonWidth = size * IMAGE_ASPECT.deleteButton
    const button = this.add
      .image(0, 0, ASSET_KEYS.deleteButton)
      .setDisplaySize(buttonWidth, size)
      .setDepth(6)

    const hitArea = this.add.rectangle(0, 0, buttonWidth, size, 0xffffff, 0).setInteractive({
      useHandCursor: true,
    })
    hitArea.on('pointerdown', onClick)
    hitArea.on('pointerover', () => button.setTint(0xffefc4))
    hitArea.on('pointerout', () => button.clearTint())

    return this.add.container(x, y, [button, hitArea]).setDepth(6)
  }

  private showFeedback(message: string) {
    this.feedbackText?.setText(message)
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
      this.showFeedback(CAMERA_DENIED_MESSAGE)
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
        '\uce74\uba54\ub77c\ub97c \uc900\ube44\ud558\ub294 \uc911\uc774\uc5d0\uc694.',
        this.cameraCanvas.width / 2,
        this.cameraCanvas.height / 2,
      )
      this.hasDrawnCameraPlaceholder = true
    }

    this.cameraTexture.refresh()
  }

  private returnToPoomsaeSelect() {
    fadeToScene(this, 'TaekwondoPoomsaeSelectScene', {
      duration: FADE_DURATION,
      data: { beltColor: this.beltColor },
    })
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

  private cleanupCameraEffects() {
    this.cameraSuccessEffect?.destroy()
    this.cameraSuccessEffect = undefined
  }

  private cleanup() {
    this.isSceneShuttingDown = true
    this.input.keyboard?.off('keydown-ESC', this.handleEscDown)
    this.input.keyboard?.off('keydown-N', this.handleNextMotionTestDown)
    this.feedbackText = undefined
    this.currentMotionText = undefined
    this.motions = []
    this.stopCamera()
    this.cleanupCameraEffects()

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
