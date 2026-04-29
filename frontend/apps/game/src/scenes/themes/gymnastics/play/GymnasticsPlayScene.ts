import Phaser from 'phaser'
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
export class GymnasticsTopScene extends Phaser.Scene {
  private motionIndex = 0
  private score = 120
  private remainingSeconds = 72
  private mediaStream: MediaStream | null = null
  private videoElement: HTMLVideoElement | null = null
  private cameraCanvas!: HTMLCanvasElement
  private cameraContext!: CanvasRenderingContext2D
  private cameraTexture!: Phaser.Textures.CanvasTexture
  private cameraBounds!: PanelBounds
  private statusDot!: Phaser.GameObjects.Arc
  private statusText!: Phaser.GameObjects.Text
  private motionCounterText!: Phaser.GameObjects.Text
  private motionTitleText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text
  private scoreText!: Phaser.GameObjects.Text
  private feedbackTitleText!: Phaser.GameObjects.Text
  private feedbackTipTexts: Phaser.GameObjects.Text[] = []
  private timerEvent?: Phaser.Time.TimerEvent
  private isCameraRecognized = false
  private motionCounterMaxWidth = 0
  private motionTitleMaxWidth = 0
  private scoreMaxWidth = 0
  private timerMaxWidth = 0
  private feedbackTitleMaxWidth = 0

  constructor() {
    super({ key: 'GymnasticsTopScene' })
  }

  preload() {
    this.load.image(
      'gymnastics-play-background',
      '/assets/images/themes/gymnastics/background/background.png',
    )
    this.load.image('gymnastics-raccoon', '/assets/images/themes/gymnastics/characters/Raccoon.png')
    this.load.image('gymnastics-pose-frame', '/assets/images/themes/gymnastics/ui/pose.png')
    this.load.image(
      'gymnastics-feedback-frame',
      '/assets/images/themes/gymnastics/ui/livefeedback.png',
    )
  }

  create() {
    const { width: vw, height: vh } = this.scale
    this.motionIndex = 0
    this.score = 120
    this.remainingSeconds = 72
    this.isCameraRecognized = false

    addCoverBackground(this, 'gymnastics-play-background').setDepth(0)
    this.add.rectangle(vw / 2, vh / 2, vw, vh, 0x2d1b10, 0.16).setDepth(1)

    this.createCameraTexture()
    this.createLayout(vw, vh)
    this.renderMotion()
    this.startCamera()

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.remainingSeconds = Math.max(0, this.remainingSeconds - 1)
        this.timerText.setText(this.formatTime(this.remainingSeconds))
        this.fitTextToWidth(this.timerText, this.timerMaxWidth, 18, 12)
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

  private createLayout(vw: number, vh: number) {
    const margin = Phaser.Math.Clamp(Math.min(vw, vh) * 0.045, 16, 24)
    const headerH = Phaser.Math.Clamp(vh * 0.085, 32, 44)
    const footerH = Phaser.Math.Clamp(vh * 0.085, 32, 44)
    const sideW = Phaser.Math.Clamp(vw * 0.36, 220, 300)
    const gap = Phaser.Math.Clamp(vw * 0.018, 10, 16)
    const contentTop = margin + headerH + gap
    const availableH = vh - contentTop - footerH - margin - gap
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
    const contentY = contentTop + (availableH - contentH) / 2

    this.cameraBounds = {
      x: groupX,
      y: contentY,
      width: cameraW,
      height: cameraH,
    }

    this.createHeader(margin, headerH, groupX, groupW)
    this.createCameraPanel(this.cameraBounds)
    this.createSidePanels(groupX + cameraW + gap, contentY, sideW, contentH)
    this.createFooter(vh, margin, footerH, groupX, groupW)
  }

  private createHeader(margin: number, headerH: number, groupX: number, groupW: number) {
    const y = margin + headerH / 2
    const buttonSize = headerH
    const headerGap = Math.max(8, headerH * 0.28)
    this.createHomeButton(groupX + buttonSize / 2, y, buttonSize, () =>
      fadeToScene(this, 'GymnasticsSelectScene'),
    )

    const pauseX = groupX + groupW - buttonSize / 2
    const mainPanelX = groupX + buttonSize + headerGap
    const statsPanelW = Phaser.Math.Clamp(groupW * 0.18, 96, 132)
    const statsPanelX = pauseX - buttonSize / 2 - headerGap - statsPanelW
    const mainPanelW = Math.max(180, statsPanelX - headerGap - mainPanelX)

    this.createPanel(mainPanelX, margin, mainPanelW, headerH, 12)
    this.createPanel(statsPanelX, margin, statsPanelW, headerH, 12)

    this.motionCounterMaxWidth = Math.max(64, mainPanelW * 0.18)
    this.motionTitleMaxWidth = mainPanelW - this.motionCounterMaxWidth - 68
    this.scoreMaxWidth = statsPanelW * 0.48
    this.timerMaxWidth = statsPanelW * 0.48

    this.motionCounterText = this.add
      .text(mainPanelX + 24, y, '', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(headerH * 0.36)}px`,
        color: FLAT_COLORS.muted,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(12)

    this.motionTitleText = this.add
      .text(
        mainPanelX + 24 + this.motionCounterMaxWidth + 20 + this.motionTitleMaxWidth / 2,
        y,
        '',
        {
          fontFamily: 'sans-serif',
          fontSize: `${Math.round(headerH * 0.42)}px`,
          color: FLAT_COLORS.text,
          fontStyle: 'bold',
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setDepth(12)

    this.scoreText = this.add
      .text(statsPanelX + statsPanelW * 0.27, y, `별 ${this.score}`, {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(headerH * 0.3)}px`,
        color: FLAT_COLORS.text,
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(12)

    this.timerText = this.add
      .text(statsPanelX + statsPanelW * 0.74, y, this.formatTime(this.remainingSeconds), {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(headerH * 0.3)}px`,
        color: FLAT_COLORS.muted,
        align: 'center',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(12)

    this.createIconButton(pauseX, y, buttonSize, '정지', () => {
      this.scene.pause()
    })
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
    const badge = this.add.graphics().setDepth(9)
    badge.fillStyle(0x3f220c, 0.14)
    badge.fillRoundedRect(badgeX, badgeY + 2, badgeW, badgeH, 12)
    badge.fillStyle(FLAT_COLORS.surface, 0.98)
    badge.fillRoundedRect(badgeX, badgeY, badgeW, badgeH, 12)
    badge.lineStyle(1, FLAT_COLORS.border, 1)
    badge.strokeRoundedRect(badgeX, badgeY, badgeW, badgeH, 12)
    this.statusDot = this.add.circle(badgeX + 15, badgeY + badgeH / 2, 5.5, 0xd13b2f).setDepth(10)
    this.statusText = this.add
      .text(badgeX + 28, badgeY + badgeH / 2, '인식 불가', {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: FLAT_COLORS.text,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(10)
  }

  private createSidePanels(x: number, y: number, width: number, height: number) {
    const panelGap = Math.max(12, height * 0.04)
    const panelH = (height - panelGap) / 2
    const targetH = panelH
    const feedbackY = y + panelH + panelGap
    const feedbackH = panelH

    const poseScale = 1.12
    this.add
      .image(x + width / 2, y + targetH / 2, 'gymnastics-pose-frame')
      .setDisplaySize(width * poseScale, targetH * poseScale)
      .setDepth(11)
    this.add
      .text(x + width / 2, y + targetH * 0.105, '목표 자세', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(targetH * 0.09, 16, 22))}px`,
        color: '#fff4d4',
        fontStyle: 'bold',
        stroke: '#4b250c',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(13)

    this.add
      .image(x + width / 2, y + targetH * 0.56, 'gymnastics-raccoon')
      .setDisplaySize(Math.min(width * 0.74, targetH * 0.7), Math.min(width * 0.74, targetH * 0.7))
      .setDepth(13)

    this.add
      .image(x + width / 2, feedbackY + feedbackH / 2, 'gymnastics-feedback-frame')
      .setDisplaySize(width, feedbackH)
      .setDepth(11)
    this.add
      .text(x + width / 2, feedbackY + feedbackH * 0.095, '실시간 피드백', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(feedbackH * 0.105, 15, 20))}px`,
        color: '#fff4d4',
        fontStyle: 'bold',
        stroke: '#4b250c',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(13)

    this.feedbackTitleText = this.add
      .text(x + width * 0.58, feedbackY + feedbackH * 0.34, '', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(feedbackH * 0.115, 18, 24))}px`,
        color: '#3b2412',
        fontStyle: 'bold',
        stroke: '#fff1d0',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(13)
    this.feedbackTitleMaxWidth = width * 0.58

    this.feedbackTipTexts = [0, 1, 2, 3].map(index => {
      const isSummary = index === 0
      return this.add
        .text(
          x + (isSummary ? width * 0.58 : width * 0.18),
          feedbackY + feedbackH * (isSummary ? 0.46 : 0.6 + (index - 1) * 0.105),
          '',
          {
            fontFamily: 'sans-serif',
            fontSize: isSummary ? '13px' : '14px',
            color: isSummary ? '#b94122' : '#352312',
            fontStyle: isSummary ? 'bold' : 'normal',
            align: isSummary ? 'center' : 'left',
            stroke: '#fff1d0',
            strokeThickness: 1,
            wordWrap: { width: width * (isSummary ? 0.58 : 0.62), useAdvancedWrap: true },
          },
        )
        .setOrigin(isSummary ? 0.5 : 0, 0.5)
        .setDepth(13)
    })
  }

  private createFooter(
    vh: number,
    margin: number,
    footerH: number,
    groupX: number,
    groupW: number,
  ) {
    const y = vh - margin - footerH / 2
    const buttonGap = Math.max(12, groupW * 0.035)
    const buttonW = Math.min(220, (groupW - buttonGap * 2) / 3)
    const buttonH = Math.min(64, footerH * 0.86)
    const centerX = groupX + groupW / 2

    this.createTextButton(centerX - buttonW - buttonGap, y, buttonW, buttonH, '이전 동작', () =>
      this.moveMotion(-1),
    )
    this.createTextButton(centerX, y, buttonW, buttonH, '다시 보기', () => this.renderMotion())
    this.createTextButton(
      centerX + buttonW + buttonGap,
      y,
      buttonW,
      buttonH,
      '다음 동작',
      () => this.moveMotion(1),
      FLAT_COLORS.primary,
    )
  }

  private createPanel(x: number, y: number, width: number, height: number, radius: number) {
    const graphics = this.add.graphics().setDepth(4)
    graphics.fillStyle(0x3f220c, 0.16)
    graphics.fillRoundedRect(x, y + 7, width, height, radius)
    graphics.fillStyle(FLAT_COLORS.surface, 0.96)
    graphics.fillRoundedRect(x, y, width, height, radius)
    graphics.lineStyle(1, FLAT_COLORS.border, 1)
    graphics.strokeRoundedRect(x, y, width, height, radius)
    return graphics
  }

  private createHomeButton(x: number, y: number, size: number, onClick: () => void) {
    const bg = this.add.graphics().setDepth(14)
    bg.fillStyle(0x3f220c, 0.14)
    bg.fillRoundedRect(-size / 2, -size / 2 + 4, size, size, 12)
    bg.fillStyle(FLAT_COLORS.surface, 1)
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, 12)
    bg.lineStyle(1, FLAT_COLORS.border, 1)
    bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 12)
    const label = this.add
      .text(0, 0, '홈', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(size * 0.34)}px`,
        color: FLAT_COLORS.text,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(15)
    const hitArea = this.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({
      useHandCursor: true,
    })
    hitArea.on('pointerdown', onClick)

    return this.add.container(x, y, [bg, label, hitArea]).setDepth(14)
  }

  private createIconButton(x: number, y: number, size: number, label: string, onClick: () => void) {
    const bg = this.add.graphics().setDepth(14)
    bg.fillStyle(0x3f220c, 0.14)
    bg.fillRoundedRect(-size / 2, -size / 2 + 4, size, size, 12)
    bg.fillStyle(FLAT_COLORS.surface, 1)
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, 12)
    bg.lineStyle(1, FLAT_COLORS.border, 1)
    bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 12)
    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(size * 0.24)}px`,
        color: FLAT_COLORS.text,
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(15)
    const hitArea = this.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({
      useHandCursor: true,
    })
    hitArea.on('pointerdown', onClick)
    return this.add.container(x, y, [bg, text, hitArea]).setDepth(14)
  }

  private createTextButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    fillColor = FLAT_COLORS.secondary,
  ) {
    const isPrimary = fillColor === FLAT_COLORS.primary
    const bg = this.add.graphics().setDepth(14)
    bg.fillStyle(0x3f220c, isPrimary ? 0.18 : 0.13)
    bg.fillRoundedRect(-width / 2, -height / 2 + 5, width, height, 12)
    bg.fillStyle(isPrimary ? FLAT_COLORS.primary : FLAT_COLORS.secondary, 1)
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12)
    bg.lineStyle(1, isPrimary ? FLAT_COLORS.primaryDark : FLAT_COLORS.border, 1)
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12)
    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'sans-serif',
        fontSize: `${Math.max(18, Math.min(24, Math.floor(width * 0.12)))}px`,
        color: isPrimary ? '#ffffff' : FLAT_COLORS.text,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: width - 24, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setDepth(15)
    const hitArea = this.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({
      useHandCursor: true,
    })
    hitArea.on('pointerdown', onClick)
    return this.add.container(x, y, [bg, text, hitArea]).setDepth(14)
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
      this.fitTextToWidth(this.feedbackTitleText, this.feedbackTitleMaxWidth, 24, 16)
    }
  }

  private moveMotion(direction: number) {
    this.motionIndex = Phaser.Math.Wrap(this.motionIndex + direction, 0, TOP_MOTIONS.length)
    this.renderMotion()
  }

  private renderMotion() {
    const motion = TOP_MOTIONS[this.motionIndex]
    this.motionCounterText?.setText(`${this.motionIndex + 1} / ${TOP_MOTIONS.length}`)
    this.motionTitleText?.setText(motion.title)
    this.scoreText?.setText(`별 ${this.score}`)
    this.feedbackTitleText?.setText(this.isCameraRecognized ? '좋아요!' : '기다릴게요')
    this.fitTextToWidth(this.motionCounterText, this.motionCounterMaxWidth, 24, 16)
    this.fitTextToWidth(this.motionTitleText, this.motionTitleMaxWidth, 34, 20)
    this.fitTextToWidth(this.scoreText, this.scoreMaxWidth, 22, 14)
    this.fitTextToWidth(this.timerText, this.timerMaxWidth, 18, 12)
    this.fitTextToWidth(this.feedbackTitleText, this.feedbackTitleMaxWidth, 24, 16)
    this.feedbackTipTexts.forEach((text, index) => {
      const content = index === 0 ? motion.goal : (motion.tips[index - 1] ?? '')
      text.setText(index === 0 ? content : `${index}. ${content}`)
      this.fitTextToWidth(
        text,
        index === 0 ? this.feedbackTitleMaxWidth * 1.12 : this.feedbackTitleMaxWidth * 0.98,
        index === 0 ? 12 : 12,
        9,
      )
    })
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
