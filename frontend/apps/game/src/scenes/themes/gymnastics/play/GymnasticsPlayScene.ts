import Phaser from 'phaser'
import { assetPath } from '@/game/assets/assetPath'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'

type GymnasticsMotion = {
  title: string
  goal: string
  tips: string[]
}

type PanelBounds = {
  x: number
  y: number
  width: number
  height: number
}

const TOP_MOTIONS: GymnasticsMotion[] = [
  {
    title: '팔 벌리기',
    goal: '양팔을 어깨 높이로 올려요',
    tips: ['양팔을 어깨 높이로', '시선은 정면', '다리는 그대로'],
  },
  {
    title: '무릎 올리기',
    goal: '무릎을 천천히 들어요',
    tips: ['등은 곧게 펴요', '무릎은 천천히', '숨은 편하게'],
  },
  {
    title: '가볍게 흔들기',
    goal: '몸을 부드럽게 움직여요',
    tips: ['작게 움직여도 좋아요', '아프면 쉬어요', '즐겁게 마무리'],
  },
]

const DANIEL_MOTIONS: GymnasticsMotion[] = TOP_MOTIONS

const FLAT_COLORS = {
  surface: 0xfffbf2,
  surfaceAlt: 0xfff6e7,
  border: 0xe3c28d,
  accent: 0x7f4a24,
  text: '#2f2116',
  muted: '#7a5430',
  primary: 0x2f9e58,
  primaryDark: 0x237a42,
  secondary: 0xfff6e7,
}
const TARGET_POSE_FRAME_SCALE = 1.12
const HEADER_FRAME_TEXTURE_KEY = 'gymnastics-header-frame-cropped'
const HEADER_FRAME_CROP = { x: 39, y: 134, width: 1920, height: 246 }
const HEADER_FRAME_CAP_WIDTH = 360
class GymnasticsPlaySceneBase extends Phaser.Scene {
  private motionIndex = 0
  private remainingSeconds = 72
  private mediaStream: MediaStream | null = null
  private videoElement: HTMLVideoElement | null = null
  private cameraCanvas!: HTMLCanvasElement
  private cameraContext!: CanvasRenderingContext2D
  private cameraTexture!: Phaser.Textures.CanvasTexture
  private cameraBounds!: PanelBounds
  private statusBadgeBounds!: PanelBounds
  private statusDot!: Phaser.GameObjects.Arc
  private statusText!: Phaser.GameObjects.Text
  private motionCounterText!: Phaser.GameObjects.Text
  private motionTitleText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text
  private feedbackTitleText!: Phaser.GameObjects.Text
  private feedbackStarImage!: Phaser.GameObjects.Image
  private feedbackTipTexts: Phaser.GameObjects.Text[] = []
  private timerEvent?: Phaser.Time.TimerEvent
  private isCameraRecognized = false
  private motionCounterMaxWidth = 0
  private motionTitleMaxWidth = 0
  private timerMaxWidth = 0
  private headerFontSize = 0
  private feedbackTitleMaxWidth = 0

  constructor(
    sceneKey: string,
    private readonly motions: GymnasticsMotion[],
    private readonly modeLabel: string,
  ) {
    super({ key: sceneKey })
  }

  preload() {
    this.load.image(
      'gymnastics-play-background',
      assetPath('images/themes/gymnastics/background/gymbackground.png'),
    )
    this.load.image(
      'gymnastics-raccoon',
      assetPath('images/themes/gymnastics/characters/Raccoon.png'),
    )
    this.load.image('gymnastics-pose-frame', assetPath('images/themes/gymnastics/ui/pose.png'))
    this.load.image(
      'gymnastics-feedback-frame',
      assetPath('images/themes/gymnastics/ui/livefeedback.png'),
    )
    this.load.image('gymnastics-feedback-star', assetPath('images/themes/gymnastics/ui/star.png'))
    this.load.image('gymnastics-header-frame', assetPath('images/themes/gymnastics/ui/frame.png'))
    this.load.image(
      'gymnastics-delete-button',
      assetPath('images/themes/gymnastics/ui/delete_btn.png'),
    )
  }

  create() {
    const { width: vw, height: vh } = this.scale
    this.motionIndex = 0
    this.remainingSeconds = 72
    this.isCameraRecognized = false

    addCoverBackground(this, 'gymnastics-play-background').setDepth(0)
    this.add.rectangle(vw / 2, vh / 2, vw, vh, 0x2d1b10, 0.16).setDepth(1)

    this.createCameraTexture()
    this.createHeaderFrameTexture()
    this.createLayout(vw, vh)
    this.renderMotion()
    this.startCamera()

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.remainingSeconds = Math.max(0, this.remainingSeconds - 1)
        this.timerText.setText(this.formatTime(this.remainingSeconds))
        this.fitTextToWidth(this.timerText, this.timerMaxWidth, this.headerFontSize, 14)
      },
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup())
    this.cameras.main.fadeIn(220, 0, 0, 0)
  }

  update() {
    this.drawCameraFrame()
    this.updateRecognitionStatus(this.canReadCameraFrame())
  }

  private createCameraTexture() {
    this.cameraCanvas = document.createElement('canvas')
    this.cameraCanvas.width = 960
    this.cameraCanvas.height = 720
    const context = this.cameraCanvas.getContext('2d')
    if (!context) {
      throw new Error('Camera canvas context is not available.')
    }
    this.cameraContext = context

    const textureKey = `${this.scene.key}-camera`
    if (this.textures.exists(textureKey)) {
      this.textures.remove(textureKey)
    }
    const texture = this.textures.addCanvas(textureKey, this.cameraCanvas)
    if (!texture) {
      throw new Error('Camera texture is not available.')
    }
    this.cameraTexture = texture
  }

  private createHeaderFrameTexture() {
    if (this.textures.exists(HEADER_FRAME_TEXTURE_KEY)) return

    const source = this.textures.get('gymnastics-header-frame').getSourceImage() as HTMLImageElement
    const canvas = document.createElement('canvas')
    canvas.width = HEADER_FRAME_CROP.width
    canvas.height = HEADER_FRAME_CROP.height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Header frame canvas context is not available.')
    }

    context.drawImage(
      source,
      HEADER_FRAME_CROP.x,
      HEADER_FRAME_CROP.y,
      HEADER_FRAME_CROP.width,
      HEADER_FRAME_CROP.height,
      0,
      0,
      HEADER_FRAME_CROP.width,
      HEADER_FRAME_CROP.height,
    )
    this.textures.addCanvas(HEADER_FRAME_TEXTURE_KEY, canvas)
  }

  private createLayout(vw: number, vh: number) {
    const margin = Phaser.Math.Clamp(Math.min(vw, vh) * 0.032, 12, 18)
    const headerH = Phaser.Math.Clamp(vh * 0.085, 32, 44)
    const sideW = Phaser.Math.Clamp(vw * 0.32, 240, 360)
    const gap = Phaser.Math.Clamp(vw * 0.014, 8, 12)
    const contentTop = margin + headerH + gap
    const availableH = vh - contentTop - margin
    const maxGroupW = vw - margin * 2
    const maxCameraW = maxGroupW - sideW - gap
    const sidePanelGap = Math.max(12, availableH * 0.04)
    const frameAspect = 1448 / 1086
    const sidePanelH = Math.min((availableH - sidePanelGap) / 2, sideW / frameAspect)
    const contentH = sidePanelH * 2 + sidePanelGap
    const cameraH = contentH
    const cameraW = Math.min(maxCameraW * 0.74, cameraH * frameAspect)
    const groupW = cameraW + gap + sideW
    const groupX = (vw - groupW) / 2
    const contentY = contentTop + Math.max(0, (availableH - contentH) / 2)
    const sideX = groupX + cameraW + gap
    const sideHeaderInset = Math.max(12, sideW * 0.04)
    const sideHeaderW = sideW - sideHeaderInset * 2
    const sideHeaderX = sideX + sideHeaderInset
    const headerTop = Math.max(margin, contentY - gap - headerH)

    this.cameraBounds = {
      x: groupX,
      y: contentY,
      width: cameraW,
      height: cameraH,
    }

    this.createHeader(headerTop, headerH, groupX, cameraW, sideHeaderX, sideHeaderW)
    this.createCameraPanel(this.cameraBounds)
    this.createSidePanels(sideX, contentY, sideW, contentH)
  }

  private createHeader(
    headerTop: number,
    headerH: number,
    headerX: number,
    headerW: number,
    rightHeaderX: number,
    rightHeaderW: number,
  ) {
    const y = headerTop + headerH / 2
    const headerGap = Math.max(8, headerH * 0.28)
    const timerLikeW = Phaser.Math.Clamp(headerW * 0.18, 96, 132)
    const modePanelW = headerH + headerGap + timerLikeW
    const motionPanelW = headerW - modePanelW - headerGap
    const motionPanelX = headerX + modePanelW + headerGap
    const headerFontSize = Math.round(headerH * 0.38)
    const headerTextStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'sans-serif',
      fontSize: `${headerFontSize}px`,
      color: '#fff4d4',
      fontStyle: 'bold',
      align: 'center',
      stroke: '#4b250c',
      strokeThickness: 2,
    }

    this.createHeaderFrame(headerX, headerTop, modePanelW, headerH)
    this.createHeaderFrame(motionPanelX, headerTop, motionPanelW, headerH)

    const headerTextInset = Math.max(18, headerH * 0.9)
    const modeTextCenterX = headerX + headerTextInset + (modePanelW - headerTextInset * 2) / 2
    this.motionCounterMaxWidth = modePanelW - headerTextInset * 2
    this.motionTitleMaxWidth = motionPanelW - 32
    this.timerMaxWidth = Math.max(64, rightHeaderW - headerH - headerGap - 28)
    this.headerFontSize = headerFontSize

    this.motionCounterText = this.add
      .text(modeTextCenterX, y, this.modeLabel, headerTextStyle)
      .setOrigin(0.5)
      .setDepth(12)

    this.motionTitleText = this.add
      .text(motionPanelX + motionPanelW / 2, y, '', headerTextStyle)
      .setOrigin(0.5)
      .setDepth(12)

    const timerPanelX = rightHeaderX
    const timerPanelW = Math.max(0, rightHeaderW - headerH - headerGap)
    this.createHeaderFrame(timerPanelX, headerTop, timerPanelW, headerH)
    this.timerText = this.add
      .text(
        timerPanelX + timerPanelW / 2,
        y,
        this.formatTime(this.remainingSeconds),
        headerTextStyle,
      )
      .setOrigin(0.5)
      .setDepth(12)

    this.createDeleteButton(rightHeaderX + rightHeaderW - headerH / 2, y, headerH, () =>
      fadeToScene(this, 'GymnasticsSelectScene'),
    )
  }

  private createCameraPanel(bounds: PanelBounds) {
    this.createPanel(bounds.x, bounds.y, bounds.width, bounds.height, 16)
    const cameraInset = 8
    const cameraRadius = 12
    const cameraImage = this.add
      .image(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, this.cameraTexture.key)
      .setDisplaySize(bounds.width - cameraInset * 2, bounds.height - cameraInset * 2)
      .setDepth(5)

    const cameraMaskShape = this.add.graphics()
    cameraMaskShape
      .fillStyle(0xffffff, 1)
      .fillRoundedRect(
        bounds.x + cameraInset,
        bounds.y + cameraInset,
        bounds.width - cameraInset * 2,
        bounds.height - cameraInset * 2,
        cameraRadius,
      )
      .setVisible(false)
    cameraImage.setMask(cameraMaskShape.createGeometryMask())

    const badgeW = 94
    const badgeH = 28
    const badgeX = bounds.x + 18
    const badgeY = bounds.y + 18
    this.statusBadgeBounds = { x: badgeX, y: badgeY, width: badgeW, height: badgeH }
    const badge = this.add.graphics().setDepth(9)
    badge.fillStyle(0x3f220c, 0.14)
    badge.fillRoundedRect(badgeX, badgeY + 2, badgeW, badgeH, 12)
    badge.fillStyle(FLAT_COLORS.surface, 0.98)
    badge.fillRoundedRect(badgeX, badgeY, badgeW, badgeH, 12)
    badge.lineStyle(1, FLAT_COLORS.border, 1)
    badge.strokeRoundedRect(badgeX, badgeY, badgeW, badgeH, 12)
    this.statusDot = this.add.circle(0, badgeY + badgeH / 2, 5.5, 0xd13b2f).setDepth(10)
    this.statusText = this.add
      .text(badgeX + 28, badgeY + badgeH / 2, '인식 불가', {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: FLAT_COLORS.text,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(10)
    this.layoutStatusBadge()
  }

  private layoutStatusBadge() {
    const dotRadius = this.statusDot.radius
    const gap = 8
    const groupW = dotRadius * 2 + gap + this.statusText.width
    const startX = this.statusBadgeBounds.x + (this.statusBadgeBounds.width - groupW) / 2
    const centerY = this.statusBadgeBounds.y + this.statusBadgeBounds.height / 2

    this.statusDot.setPosition(startX + dotRadius, centerY)
    this.statusText.setPosition(startX + dotRadius * 2 + gap, centerY)
  }

  private createSidePanels(x: number, y: number, width: number, height: number) {
    const panelGap = Math.max(12, height * 0.04)
    const panelH = (height - panelGap) / 2
    const targetH = panelH
    const feedbackY = y + panelH + panelGap
    const feedbackH = panelH
    const sectionTitleX = x + width / 2
    const targetTitleY = y + targetH * 0.088
    const feedbackTitleY = feedbackY + feedbackH * 0.094

    this.add
      .image(x + width / 2, y + targetH / 2, 'gymnastics-pose-frame')
      .setDisplaySize(width * TARGET_POSE_FRAME_SCALE, targetH * TARGET_POSE_FRAME_SCALE)
      .setDepth(11)
    this.add
      .text(sectionTitleX, targetTitleY, '가이드 영상', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(targetH * 0.078, 16, 20))}px`,
        color: '#fff4d4',
        fontStyle: 'bold',
        stroke: '#4b250c',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(13)

    this.add
      .image(x + width / 2, feedbackY + feedbackH / 2, 'gymnastics-feedback-frame')
      .setDisplaySize(width, feedbackH)
      .setDepth(11)
    this.add
      .text(sectionTitleX, feedbackTitleY, '실시간 피드백', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(feedbackH * 0.082, 15, 20))}px`,
        color: '#fff4d4',
        fontStyle: 'bold',
        stroke: '#4b250c',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(13)

    const feedbackTitleFontSize = Math.round(Phaser.Math.Clamp(feedbackH * 0.18, 26, 38))
    this.feedbackTitleText = this.add
      .text(x + width * 0.58, feedbackY + feedbackH * 0.42, '', {
        fontFamily: 'sans-serif',
        fontSize: `${feedbackTitleFontSize}px`,
        color: '#3b2412',
        fontStyle: 'bold',
        stroke: '#fff1d0',
        strokeThickness: 2,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(13)
    this.feedbackTitleMaxWidth = width * 0.78

    this.feedbackStarImage = this.add
      .image(0, this.feedbackTitleText.y, 'gymnastics-feedback-star')
      .setOrigin(0.5)
      .setDepth(13)

    this.feedbackTipTexts = [
      this.add
        .text(x + width / 2, feedbackY + feedbackH * 0.64, '', {
          fontFamily: 'sans-serif',
          fontSize: `${Math.round(Phaser.Math.Clamp(feedbackH * 0.08, 15, 22))}px`,
          color: '#b94122',
          fontStyle: 'bold',
          align: 'center',
          stroke: '#fff1d0',
          strokeThickness: 1,
          wordWrap: { width: width * 0.78, useAdvancedWrap: true },
        })
        .setOrigin(0.5)
        .setDepth(13),
    ]
  }

  private createPanel(x: number, y: number, width: number, height: number, radius: number) {
    const graphics = this.add.graphics().setDepth(4)
    graphics.fillStyle(0x241106, 0.28)
    graphics.fillRoundedRect(x, y + 7, width, height, radius)
    graphics.fillStyle(0x7f4a24, 0.98)
    graphics.fillRoundedRect(x, y, width, height, radius)
    graphics.lineStyle(3, 0x4b250c, 1)
    graphics.strokeRoundedRect(x, y, width, height, radius)
    graphics.lineStyle(1, 0xd7a55a, 0.72)
    graphics.strokeRoundedRect(x + 4, y + 4, width - 8, height - 8, Math.max(4, radius - 4))
    return graphics
  }

  private createHeaderFrame(x: number, y: number, width: number, height: number) {
    const textureKey = this.createSizedHeaderFrameTexture(width, height)
    return this.add.image(x + width / 2, y + height / 2, textureKey).setDepth(10)
  }

  private createSizedHeaderFrameTexture(width: number, height: number) {
    const targetW = Math.max(1, Math.round(width))
    const targetH = Math.max(1, Math.round(height))
    const textureKey = `${HEADER_FRAME_TEXTURE_KEY}-${targetW}x${targetH}`
    if (this.textures.exists(textureKey)) return textureKey

    const source = this.textures.get(HEADER_FRAME_TEXTURE_KEY).getSourceImage() as HTMLCanvasElement
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Sized header frame canvas context is not available.')
    }

    const sourceW = source.width
    const sourceH = source.height
    const capSrcW = Math.min(HEADER_FRAME_CAP_WIDTH, sourceW / 2)
    const dstCapW = Math.min(targetW / 2, capSrcW * (targetH / sourceH))
    const centerSrcW = sourceW - capSrcW * 2
    const centerDstW = Math.max(0, targetW - dstCapW * 2)

    context.drawImage(source, 0, 0, capSrcW, sourceH, 0, 0, dstCapW, targetH)
    if (centerDstW > 0) {
      context.drawImage(source, capSrcW, 0, centerSrcW, sourceH, dstCapW, 0, centerDstW, targetH)
    }
    context.drawImage(
      source,
      sourceW - capSrcW,
      0,
      capSrcW,
      sourceH,
      targetW - dstCapW,
      0,
      dstCapW,
      targetH,
    )

    this.textures.addCanvas(textureKey, canvas)
    return textureKey
  }

  private createDeleteButton(x: number, y: number, size: number, onClick: () => void) {
    const bg = this.add
      .image(0, 0, 'gymnastics-delete-button')
      .setDisplaySize(size, size)
      .setDepth(14)
    const hitArea = this.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({
      useHandCursor: true,
    })
    hitArea.on('pointerdown', onClick)

    return this.add.container(x, y, [bg, hitArea]).setDepth(14)
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
      this.updateRecognitionStatus(false)
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
    this.cameraContext.clearRect(0, 0, this.cameraCanvas.width, this.cameraCanvas.height)

    if (this.canReadCameraFrame() && this.videoElement) {
      this.cameraContext.save()
      this.cameraContext.translate(this.cameraCanvas.width, 0)
      this.cameraContext.scale(-1, 1)
      this.cameraContext.drawImage(
        this.videoElement,
        0,
        0,
        this.cameraCanvas.width,
        this.cameraCanvas.height,
      )
      this.cameraContext.restore()
    } else {
      const gradient = this.cameraContext.createLinearGradient(0, 0, 0, this.cameraCanvas.height)
      gradient.addColorStop(0, '#f6c067')
      gradient.addColorStop(1, '#91511d')
      this.cameraContext.fillStyle = gradient
      this.cameraContext.fillRect(0, 0, this.cameraCanvas.width, this.cameraCanvas.height)
      this.cameraContext.fillStyle = 'rgba(61, 34, 16, 0.75)'
      this.cameraContext.font = 'bold 42px sans-serif'
      this.cameraContext.textAlign = 'center'
      this.cameraContext.fillText(
        '카메라를 준비하고 있어요',
        this.cameraCanvas.width / 2,
        this.cameraCanvas.height / 2,
      )
    }

    this.cameraTexture.refresh()
  }

  private updateRecognitionStatus(isRecognized: boolean) {
    if (this.isCameraRecognized === isRecognized) return
    this.isCameraRecognized = isRecognized
    this.statusDot.setFillStyle(isRecognized ? 0x1fbf5b : 0xd13b2f)
    this.statusText.setText(isRecognized ? '인식 중' : '인식 불가')
    this.feedbackTitleText?.setText(isRecognized ? '좋아요!' : '기다릴게요')
    if (this.feedbackTitleText) {
      this.layoutStatusBadge()
      this.fitTextToWidth(this.feedbackTitleText, this.feedbackTitleMaxWidth, 38, 22)
      this.positionFeedbackStar()
    }
  }

  private renderMotion() {
    const motion = this.motions[this.motionIndex]
    this.motionCounterText?.setText(this.modeLabel)
    this.motionTitleText?.setText(motion.title)
    this.timerText?.setText(this.formatTime(this.remainingSeconds))
    this.feedbackTitleText?.setText(this.isCameraRecognized ? '좋아요!' : '기다릴게요')
    this.fitTextToWidth(this.motionCounterText, this.motionCounterMaxWidth, this.headerFontSize, 14)
    this.fitTextToWidth(this.motionTitleText, this.motionTitleMaxWidth, this.headerFontSize, 14)
    this.fitTextToWidth(this.timerText, this.timerMaxWidth, this.headerFontSize, 14)
    this.fitTextToWidth(this.feedbackTitleText, this.feedbackTitleMaxWidth, 38, 22)
    this.positionFeedbackStar()
    this.feedbackTipTexts.forEach((text, index) => {
      text.setText(index === 0 ? motion.goal : '')
      this.fitTextToWidth(text, this.feedbackTitleMaxWidth, 22, 14)
    })
  }

  private positionFeedbackStar() {
    const starSize = Phaser.Math.Clamp(this.feedbackTitleText.height * 1.35, 42, 68)
    this.feedbackStarImage.setDisplaySize(starSize, starSize)
    const gap = Math.max(10, this.feedbackTitleText.height * 0.2)
    const x =
      this.feedbackTitleText.x -
      this.feedbackTitleText.width / 2 -
      this.feedbackStarImage.displayWidth / 2 -
      gap
    this.feedbackStarImage.setPosition(x, this.feedbackTitleText.y)
  }

  private fitTextToWidth(
    text: Phaser.GameObjects.Text,
    maxWidth: number,
    maxFontSize: number,
    minFontSize: number,
  ) {
    let fontSize = maxFontSize
    text.setFontSize(fontSize)

    while (text.width > maxWidth && fontSize > minFontSize) {
      fontSize -= 1
      text.setFontSize(fontSize)
    }
  }

  private formatTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  private cleanup() {
    this.timerEvent?.remove(false)
    this.timerEvent = undefined
    this.mediaStream?.getTracks().forEach(track => track.stop())
    this.mediaStream = null
    this.videoElement?.remove()
    this.videoElement = null
  }
}

export class GymnasticsTopScene extends GymnasticsPlaySceneBase {
  constructor() {
    super('GymnasticsTopScene', TOP_MOTIONS, 'top \uCCB4\uC870')
  }
}

export class GymnasticsDanielScene extends GymnasticsPlaySceneBase {
  constructor() {
    super('GymnasticsDanielScene', DANIEL_MOTIONS, '\uB2E4\uB2C8\uC5D8 \uCCB4\uC870')
  }
}
