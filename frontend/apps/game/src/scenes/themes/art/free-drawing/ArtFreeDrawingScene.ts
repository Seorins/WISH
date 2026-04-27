import Phaser from 'phaser'
import { HandTracker, type TrackedHand } from '@/game/motion/handTracker'
import { detectIndexFingerGesture } from '@/game/motion/indexFingerGesture'
import { toPointerCanvasCoordinates } from '@/game/motion/pointerCanvasCoordinates'
import { toPointerConfidence } from '@/game/motion/pointerConfidence'
import { toPointerCoordinates } from '@/game/motion/pointerCoordinates'
import { getPointerReference } from '@/game/motion/pointerReference'
import { PointerSmoother } from '@/game/motion/pointerSmoother'
import { PointerTrackingGuard } from '@/game/motion/pointerTrackingGuard'
import { rumiContentDialogs, type RumiContentDialogStage } from '../dialog/rumiDialogs'

const ART_ROOM_RETURN_SPAWN = { xRatio: 0.5, yRatio: 0.76 }
const CANVAS_SOURCE_SIZE = { width: 1535, height: 1024 }
const CANVAS_DRAW_AREA = { x: 120, y: 150, width: 1288, height: 620 }
const PALETTE_SWATCHES = [
  { color: 0xff2b2b, sourceX: 1470, sourceY: 262 },
  { color: 0xff4d9a, sourceX: 1902, sourceY: 262 },
  { color: 0xff6a1f, sourceX: 1467, sourceY: 588 },
  { color: 0xffd12c, sourceX: 1903, sourceY: 589 },
  { color: 0x7bdd1e, sourceX: 1476, sourceY: 905 },
  { color: 0x138f2d, sourceX: 1890, sourceY: 895 },
  { color: 0x36b7ff, sourceX: 1467, sourceY: 1253 },
  { color: 0x3679ff, sourceX: 1895, sourceY: 1249 },
  { color: 0x9a43d9, sourceX: 1483, sourceY: 1609 },
  { color: 0xffb05a, sourceX: 1900, sourceY: 1598 },
  { color: 0x8e5c32, sourceX: 1490, sourceY: 1968 },
  { color: 0x2f2f2f, sourceX: 1873, sourceY: 2006 },
] as const

type PalettePoint = { color: number; x: number; y: number }
type HandPointerState = {
  point: Phaser.Math.Vector2
  isDrawingGesture: boolean
}
type HandActionKind = 'save' | 'reset' | 'exit'
type ExportedDrawingPng = {
  blob: Blob
  dataUrl: string
  filename: string
  width: number
  height: number
}

export class ArtFreeDrawingScene extends Phaser.Scene {
  private drawBounds = new Phaser.Geom.Rectangle()
  private canvasFrameBounds = new Phaser.Geom.Rectangle()
  private drawingTexture!: Phaser.GameObjects.RenderTexture
  private brushStroke!: Phaser.GameObjects.Graphics
  private paletteSelection!: Phaser.GameObjects.Arc
  private rumiBubble!: Phaser.GameObjects.Graphics
  private rumiBubbleText!: Phaser.GameObjects.Text
  private brushCursor!: Phaser.GameObjects.Image
  private saveButton: Phaser.GameObjects.Image | null = null
  private resetButton: Phaser.GameObjects.Image | null = null
  private exitButton: Phaser.GameObjects.Image | null = null
  private palettePoints: PalettePoint[] = []
  private handTracker: HandTracker | null = null
  private readonly handPointerSmoother = new PointerSmoother({ alpha: 0.38 })
  private readonly handTrackingGuard = new PointerTrackingGuard<Phaser.Math.Vector2>({
    holdDurationMs: 120,
  })

  private isDrawing = false
  private isHandDrawing = false
  private isStartingHandTracker = false
  private handTrackingDisposed = false
  private hasStartedDrawing = false
  private strokeCount = 0
  private lastDrawPoint: Phaser.Math.Vector2 | null = null
  private lastHandDrawPoint: Phaser.Math.Vector2 | null = null
  private currentColor: number = PALETTE_SWATCHES[0].color
  private lastInteractionAt = 0
  private lastIdlePromptAt = 0
  private lastHandColorSelectedAt = 0
  private pendingHandColor: number | null = null
  private pendingHandColorStartedAt = 0
  private pendingHandAction: HandActionKind | null = null
  private pendingHandActionStartedAt = 0
  private activatedHandAction: HandActionKind | null = null
  private isSavingDrawing = false
  private saveButtonBaseScale = { x: 1, y: 1 }
  private resetButtonBaseScale = { x: 1, y: 1 }
  private exitButtonBaseScale = { x: 1, y: 1 }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (!Phaser.Geom.Rectangle.Contains(this.drawBounds, pointer.x, pointer.y)) {
      return
    }

    this.isDrawing = true
    this.strokeCount += 1
    const point = this.clampToDrawBounds(pointer.x, pointer.y)
    this.lastDrawPoint = point
    this.drawDot(point.x, point.y)
    this.recordDrawingActivity()

    if (!this.hasStartedDrawing) {
      this.hasStartedDrawing = true
      this.showRumiLine('first-action')
    } else if (this.strokeCount % 4 === 0) {
      this.showRumiLine('encourage')
    }
  }

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer) => {
    if (!this.isDrawing || !pointer.isDown) {
      return
    }

    const currentPoint = this.clampToDrawBounds(pointer.x, pointer.y)
    if (!this.lastDrawPoint) {
      this.lastDrawPoint = currentPoint
      this.drawDot(currentPoint.x, currentPoint.y)
      return
    }

    this.drawStroke(this.lastDrawPoint, currentPoint)
    this.lastDrawPoint = currentPoint
    this.recordDrawingActivity()

    if (!Phaser.Geom.Rectangle.Contains(this.drawBounds, pointer.x, pointer.y)) {
      this.stopDrawing()
    }
  }

  private readonly handlePointerUp = () => {
    this.stopDrawing()
  }

  private readonly handleEscDown = () => {
    this.returnToArtRoom()
  }

  constructor() {
    super({ key: 'ArtFreeDrawingScene' })
  }

  preload() {
    this.load.image('art-room-background', '/assets/images/themes/art/background/background.png')
    this.load.image('art-ui-canvas', '/assets/images/themes/art/ui/canvas.png')
    this.load.image('art-ui-palette', '/assets/images/themes/art/ui/palette.png')
    this.load.image('art-ui-rumi', '/assets/images/themes/art/ui/rumi.png')
    this.load.image('art-ui-brush', '/assets/images/themes/art/ui/brush.png')
    this.load.image('art-ui-delete-btn', '/assets/images/themes/art/ui/delete_btn.png')
    this.load.image('art-ui-reset-btn', '/assets/images/themes/art/ui/reset.png')
    this.load.image('art-ui-save-btn', '/assets/images/themes/art/ui/save_btn.png')
  }

  create() {
    const { width: vw, height: vh } = this.scale
    this.lastInteractionAt = this.time.now
    this.lastIdlePromptAt = this.time.now
    this.handTrackingDisposed = false

    const background = this.add.image(vw / 2, vh / 2, 'art-room-background')
    const backgroundSource = background.texture.getSourceImage() as HTMLImageElement
    const backgroundScale = Math.max(vw / backgroundSource.width, vh / backgroundSource.height)
    background.setScale(backgroundScale).setDepth(0)

    this.add.rectangle(vw / 2, vh / 2, vw, vh, 0xf4ead7, 0.08).setDepth(1)

    this.createCanvas(vw, vh)
    this.createHeader(vw, vh)
    this.createExitButton(vw, vh)
    this.createPalette(vw, vh)
    this.createActionButtons()
    this.createRumiArea(vw, vh)
    this.createBrushCursor()

    this.showRumiLine('intro')

    this.input.on('pointerdown', this.handlePointerDown)
    this.input.on('pointermove', this.handlePointerMove)
    this.input.on('pointerup', this.handlePointerUp)
    this.input.on('pointerupoutside', this.handlePointerUp)
    this.input.keyboard!.on('keydown-ESC', this.handleEscDown)
    this.startHandDrawingMode()

    this.time.addEvent({
      delay: 7000,
      loop: true,
      callback: () => {
        if (!this.hasStartedDrawing || this.isDrawing) {
          return
        }

        const now = this.time.now
        if (now - this.lastInteractionAt < 5500 || now - this.lastIdlePromptAt < 6500) {
          return
        }

        this.lastIdlePromptAt = now
        this.showRumiLine('idle')
      },
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handlePointerDown)
      this.input.off('pointermove', this.handlePointerMove)
      this.input.off('pointerup', this.handlePointerUp)
      this.input.off('pointerupoutside', this.handlePointerUp)
      this.input.keyboard?.off('keydown-ESC', this.handleEscDown)
      this.input.setDefaultCursor('default')
      this.stopHandTracking()
    })

    this.cameras.main.fadeIn(220, 0, 0, 0)
  }

  update(time: number) {
    const pointer = this.input.activePointer
    if (this.brushCursor) {
      this.brushCursor.setPosition(pointer.x, pointer.y)
    }

    this.updateHandDrawing(time)
  }

  private createHeader(vw: number, _vh: number) {
    const headerX = this.drawBounds.left
    const headerTop = Math.max(28, this.drawBounds.top - 108)
    const titleY = headerTop
    const subtitleY = titleY + 44

    this.add
      .text(headerX, titleY, '자유 그림', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.max(28, Math.round(vw * 0.02))}px`,
        color: '#fff8ec',
        stroke: '#59361d',
        strokeThickness: 6,
      })
      .setDepth(10)
      .setOrigin(0, 0)

    this.add
      .text(headerX, subtitleY, '검지를 펴고 손을 움직여 마음껏 그려봐.', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.max(16, Math.round(vw * 0.01))}px`,
        color: '#fff6ea',
        stroke: '#5f4129',
        strokeThickness: 4,
      })
      .setDepth(10)
      .setOrigin(0, 0)
  }

  private createCanvas(vw: number, vh: number) {
    const leftMargin = vw * 0.055
    const rightPanelLeft = vw * 0.805
    const availableLeftWidth = rightPanelLeft - leftMargin
    const maxWidthByHeight = vh * 1.72
    const maxWidth = Math.min(availableLeftWidth, maxWidthByHeight)
    const canvasX = leftMargin + maxWidth / 2

    const canvas = this.add.image(canvasX, vh * 0.528, 'art-ui-canvas').setDepth(5)
    canvas.setDisplaySize(
      maxWidth,
      maxWidth * (CANVAS_SOURCE_SIZE.height / CANVAS_SOURCE_SIZE.width),
    )

    this.canvasFrameBounds.setTo(
      canvas.x - canvas.displayWidth / 2,
      canvas.y - canvas.displayHeight / 2,
      canvas.displayWidth,
      canvas.displayHeight,
    )

    const scaleX = canvas.displayWidth / CANVAS_SOURCE_SIZE.width
    const scaleY = canvas.displayHeight / CANVAS_SOURCE_SIZE.height

    this.drawBounds.setTo(
      canvas.x - canvas.displayWidth / 2 + CANVAS_DRAW_AREA.x * scaleX,
      canvas.y - canvas.displayHeight / 2 + CANVAS_DRAW_AREA.y * scaleY,
      CANVAS_DRAW_AREA.width * scaleX,
      CANVAS_DRAW_AREA.height * scaleY,
    )

    this.drawingTexture = this.add
      .renderTexture(
        this.drawBounds.x,
        this.drawBounds.y,
        this.drawBounds.width,
        this.drawBounds.height,
      )
      .setOrigin(0, 0)
      .setDepth(6)

    this.brushStroke = this.add.graphics().setVisible(false)
  }

  private createPalette(vw: number, vh: number) {
    const paletteHeight = Math.min(this.drawBounds.height * 0.88, vh * 0.41)
    const panelCenterX = vw * 0.878
    const paletteTargetTop = this.drawBounds.top + 2
    const palette = this.add
      .image(panelCenterX, paletteTargetTop + paletteHeight / 2, 'art-ui-palette')
      .setDepth(8)
    palette.setDisplaySize(paletteHeight * (3429 / 2286), paletteHeight)

    const paletteLeft = palette.x - palette.displayWidth / 2
    const paletteBoundsTop = palette.y - palette.displayHeight / 2
    const scaleX = palette.displayWidth / 3429
    const scaleY = palette.displayHeight / 2286
    const selectionRadius = Math.max(11, palette.displayWidth * 0.034)
    const hitWidth = palette.displayWidth * 0.115
    const hitHeight = palette.displayHeight * 0.06

    this.paletteSelection = this.add
      .circle(0, 0, selectionRadius, 0xffffff, 0)
      .setStrokeStyle(Math.max(3, selectionRadius * 0.14), 0xfff4da)
      .setDepth(10)
      .setVisible(false)

    this.palettePoints = []

    PALETTE_SWATCHES.forEach(swatch => {
      const x = paletteLeft + swatch.sourceX * scaleX
      const y = paletteBoundsTop + swatch.sourceY * scaleY
      this.palettePoints.push({ color: swatch.color, x, y })

      const hitArea = this.add
        .rectangle(x, y, hitWidth, hitHeight, 0xffffff, 0.001)
        .setDepth(9)
        .setInteractive({ useHandCursor: true })

      hitArea.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event.stopPropagation()
          this.selectColor(swatch.color, x, y)
        },
      )

      hitArea.on('pointerover', () => {
        if (this.input.activePointer.isDown) {
          this.selectColor(swatch.color, x, y)
        }
      })
    })

    palette.setInteractive({ useHandCursor: true })
    palette.on(
      'pointerdown',
      (
        pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        const nearest = this.getNearestPaletteColor(pointer.x, pointer.y)
        if (nearest !== null) {
          this.selectColor(nearest.color, nearest.x, nearest.y)
        }
      },
    )

    const firstPoint = this.palettePoints[0]
    if (firstPoint) {
      this.selectColor(this.currentColor, firstPoint.x, firstPoint.y)
    }
  }

  private createActionButtons() {
    const saveSource = this.textures.get('art-ui-save-btn').getSourceImage() as HTMLImageElement
    const resetSource = this.textures.get('art-ui-reset-btn').getSourceImage() as HTMLImageElement
    const resetButtonHeight = 48
    const resetButtonWidth = Math.round(
      resetButtonHeight * (resetSource.width / resetSource.height),
    )
    const saveButtonHeight = 44
    const saveButtonWidth = Math.round(saveButtonHeight * (saveSource.width / saveSource.height))
    const buttonGap = 2
    const buttonY = Math.min(
      this.scale.height - saveButtonHeight / 2 - 18,
      this.drawBounds.bottom + saveButtonHeight / 2 + 6,
    )
    const rowRight = this.drawBounds.right - 54
    const resetButtonX = rowRight - resetButtonWidth / 2
    const saveButtonX = rowRight - resetButtonWidth - buttonGap - saveButtonWidth / 2
    const saveButton = this.add.image(saveButtonX, buttonY, 'art-ui-save-btn').setDepth(15)
    saveButton.setDisplaySize(saveButtonWidth, saveButtonHeight)
    this.saveButton = saveButton
    this.saveButtonBaseScale = { x: saveButton.scaleX, y: saveButton.scaleY }

    saveButton.setInteractive({ useHandCursor: true })
    saveButton.on('pointerover', () => saveButton.setTint(0xf9f1d9))
    saveButton.on('pointerout', () => saveButton.clearTint())
    saveButton.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.saveDrawing()
      },
    )

    const resetButton = this.add.image(resetButtonX, buttonY, 'art-ui-reset-btn').setDepth(15)
    resetButton.setDisplaySize(resetButtonWidth, resetButtonHeight)
    this.resetButton = resetButton
    this.resetButtonBaseScale = { x: resetButton.scaleX, y: resetButton.scaleY }

    resetButton.setInteractive({ useHandCursor: true })
    resetButton.on('pointerover', () => resetButton.setTint(0xf9f1d9))
    resetButton.on('pointerout', () => resetButton.clearTint())
    resetButton.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.resetDrawing()
      },
    )
  }

  private createRumiArea(vw: number, vh: number) {
    const panelCenterX = vw * 0.878
    const paletteHeight = Math.min(this.drawBounds.height * 0.88, vh * 0.41)
    const paletteBottom = this.drawBounds.top + 2 + paletteHeight
    const bubbleWidth = Math.min(vw * 0.19, 320)
    const bubbleHeight = Math.min(vh * 0.14, 148)
    const bubbleX = panelCenterX
    const bubbleY = Math.min(vh * 0.71, paletteBottom + bubbleHeight / 2 + 10)
    const rumiHeight = Math.min(vh * 0.24, 252)
    const rumiX = panelCenterX
    const rumiY = Math.min(
      vh - rumiHeight / 2 - 10,
      bubbleY + bubbleHeight / 2 + rumiHeight / 2 - 28,
    )

    this.rumiBubble = this.add.graphics().setDepth(8)
    this.drawSpeechBubble(bubbleX, bubbleY, bubbleWidth, bubbleHeight)

    this.rumiBubbleText = this.add
      .text(bubbleX, bubbleY, '', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.max(16, Math.round(vw * 0.01))}px`,
        color: '#4e321f',
        align: 'center',
        wordWrap: { width: bubbleWidth - 42, useAdvancedWrap: true },
        lineSpacing: 6,
      })
      .setDepth(9)
      .setOrigin(0.5)

    const rumi = this.add.image(rumiX, rumiY, 'art-ui-rumi').setDepth(8)
    rumi.setDisplaySize(rumiHeight * (871 / 1024), rumiHeight)
  }

  private createExitButton(vw: number, _vh: number) {
    const buttonHeight = Math.max(48, Math.round(vw * 0.034))
    const buttonWidth = Math.round(buttonHeight * (745 / 497))
    const button = this.add
      .image(vw - 26 - buttonWidth / 2, 26 + buttonHeight / 2, 'art-ui-delete-btn')
      .setDepth(16)
      .setDisplaySize(buttonWidth, buttonHeight)
      .setInteractive({ useHandCursor: true })
    this.exitButton = button
    this.exitButtonBaseScale = { x: button.scaleX, y: button.scaleY }

    button.on('pointerover', () => button.setTint(0xf9f1d9))
    button.on('pointerout', () => button.clearTint())
    button.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.returnToArtRoom()
      },
    )
  }

  private drawSpeechBubble(x: number, y: number, width: number, height: number) {
    this.rumiBubble.clear()
    this.rumiBubble.fillStyle(0xfff6e8, 0.96)
    this.rumiBubble.lineStyle(4, 0x8f6c48, 1)
    this.rumiBubble.fillRoundedRect(x - width / 2, y - height / 2, width, height, 22)
    this.rumiBubble.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 22)
  }

  private createBrushCursor() {
    this.input.setDefaultCursor('none')
    this.brushCursor = this.add.image(0, 0, 'art-ui-brush').setDepth(20)
    this.brushCursor.setDisplaySize(48, 48)
    this.brushCursor.setOrigin(0.18, 0.88)
    this.brushCursor.setScrollFactor(0)
  }

  private startHandDrawingMode() {
    if (this.handTracker || this.isStartingHandTracker) {
      return
    }

    const tracker = new HandTracker()
    this.handTracker = tracker
    this.isStartingHandTracker = true

    void tracker
      .start()
      .then(() => {
        this.isStartingHandTracker = false

        if (this.handTrackingDisposed) {
          tracker.stop()
          if (this.handTracker === tracker) {
            this.handTracker = null
          }
        }
      })
      .catch(() => {
        this.isStartingHandTracker = false
        tracker.stop()

        if (this.handTracker === tracker) {
          this.handTracker = null
        }
      })
  }

  private stopHandTracking() {
    this.handTrackingDisposed = true
    this.isStartingHandTracker = false
    this.stopHandDrawing()
    this.clearPendingHandAction()
    this.handPointerSmoother.reset()
    this.handTrackingGuard.reset()
    this.handTracker?.stop()
    this.handTracker = null
  }

  private updateHandDrawing(timestampMs: number) {
    const tracker = this.handTracker
    if (!tracker?.isStarted || this.isDrawing) {
      return
    }

    const result = tracker.detect(timestampMs)
    const handState = result.hands[0] ? this.getHandPointerState(result.hands[0]) : null
    const tracking = this.handTrackingGuard.update(handState?.point ?? null, result.timestampMs)

    if (tracking.shouldResetSmoother) {
      this.handPointerSmoother.reset()
      this.stopHandDrawing()
    }

    if (!tracking.point) {
      this.stopHandDrawing()
      this.clearPendingHandAction()
      return
    }

    const smoothedPoint = this.handPointerSmoother.smooth(tracking.point)
    this.brushCursor?.setPosition(smoothedPoint.x, smoothedPoint.y)

    if (tracking.status !== 'tracked') {
      return
    }

    if (!handState?.isDrawingGesture) {
      this.stopHandDrawing()
      this.clearPendingHandAction()
      return
    }

    if (this.tryActivateActionButtonFromHand(smoothedPoint, result.timestampMs)) {
      this.stopHandDrawing()
      return
    }

    if (this.trySelectColorFromHand(smoothedPoint, result.timestampMs)) {
      this.stopHandDrawing()
      return
    }

    if (!Phaser.Geom.Rectangle.Contains(this.drawBounds, smoothedPoint.x, smoothedPoint.y)) {
      this.stopHandDrawing()
      return
    }

    this.drawHandPoint(smoothedPoint)
  }

  private getHandPointerState(hand: TrackedHand): HandPointerState | null {
    const confidence = toPointerConfidence(hand.score, { activeThreshold: 0.35 })
    if (hand.score !== undefined && !confidence.isConfident) {
      return null
    }

    const pointerReference = getPointerReference(hand)
    if (!pointerReference) {
      return null
    }

    const pointerCoordinates = toPointerCoordinates(
      pointerReference,
      { width: this.scale.width, height: this.scale.height },
      { mirrorX: true },
    )
    const canvasCoordinates = toPointerCanvasCoordinates(
      pointerCoordinates,
      {
        left: this.drawBounds.left,
        top: this.drawBounds.top,
        width: this.drawBounds.width,
        height: this.drawBounds.height,
      },
      undefined,
      { clampToCanvas: false },
    )

    return {
      point: new Phaser.Math.Vector2(
        this.drawBounds.left + canvasCoordinates.canvasX,
        this.drawBounds.top + canvasCoordinates.canvasY,
      ),
      isDrawingGesture: detectIndexFingerGesture(hand).isIndexOnlyGesture,
    }
  }

  private drawHandPoint(point: Phaser.Math.Vector2) {
    const currentPoint = this.clampToDrawBounds(point.x, point.y)

    if (!this.isHandDrawing) {
      this.isHandDrawing = true
      this.strokeCount += 1
      this.lastHandDrawPoint = currentPoint
      this.drawDot(currentPoint.x, currentPoint.y)
      this.recordDrawingActivity()

      if (!this.hasStartedDrawing) {
        this.hasStartedDrawing = true
        this.showRumiLine('first-action')
      } else if (this.strokeCount % 4 === 0) {
        this.showRumiLine('encourage')
      }

      return
    }

    if (!this.lastHandDrawPoint) {
      this.lastHandDrawPoint = currentPoint
      this.drawDot(currentPoint.x, currentPoint.y)
      return
    }

    this.drawStroke(this.lastHandDrawPoint, currentPoint)
    this.lastHandDrawPoint = currentPoint
    this.recordDrawingActivity()
  }

  private stopHandDrawing() {
    this.isHandDrawing = false
    this.lastHandDrawPoint = null
  }

  private tryActivateActionButtonFromHand(point: Phaser.Math.Vector2, timestampMs: number) {
    const action = this.getHandActionAt(point)
    if (!action) {
      this.clearPendingHandAction()
      return false
    }

    this.setActionButtonHover(action)

    if (this.pendingHandAction !== action) {
      this.pendingHandAction = action
      this.pendingHandActionStartedAt = timestampMs
      this.activatedHandAction = null
      return true
    }

    if (
      this.activatedHandAction === action ||
      timestampMs - this.pendingHandActionStartedAt < 600
    ) {
      return true
    }

    this.activatedHandAction = action
    if (action === 'save') {
      this.saveDrawing()
    } else if (action === 'reset') {
      this.resetDrawing()
    } else {
      this.returnToArtRoom()
    }

    return true
  }

  private getHandActionAt(point: Phaser.Math.Vector2): HandActionKind | null {
    if (this.saveButton?.getBounds().contains(point.x, point.y)) {
      return 'save'
    }

    if (this.resetButton?.getBounds().contains(point.x, point.y)) {
      return 'reset'
    }

    if (this.exitButton?.getBounds().contains(point.x, point.y)) {
      return 'exit'
    }

    return null
  }

  private setActionButtonHover(action: HandActionKind | null) {
    this.applyActionButtonEffect(this.saveButton, this.saveButtonBaseScale, action === 'save')
    this.applyActionButtonEffect(this.resetButton, this.resetButtonBaseScale, action === 'reset')
    this.applyActionButtonEffect(this.exitButton, this.exitButtonBaseScale, action === 'exit')
  }

  private applyActionButtonEffect(
    button: Phaser.GameObjects.Image | null,
    baseScale: { x: number; y: number },
    isActive: boolean,
  ) {
    if (!button) {
      return
    }

    if (isActive) {
      button.setTint(0xf9f1d9)
      button.setScale(baseScale.x * 1.06, baseScale.y * 1.06)
      return
    }

    button.clearTint()
    button.setScale(baseScale.x, baseScale.y)
  }

  private clearPendingHandAction() {
    this.pendingHandAction = null
    this.pendingHandActionStartedAt = 0
    this.activatedHandAction = null
    this.setActionButtonHover(null)
  }

  private trySelectColorFromHand(point: Phaser.Math.Vector2, timestampMs: number) {
    const nearest = this.getNearestPaletteColor(point.x, point.y)
    if (!nearest) {
      return false
    }

    const distance = Phaser.Math.Distance.Between(point.x, point.y, nearest.x, nearest.y)
    const hitRadius = Math.max(24, Math.min(this.scale.width, this.scale.height) * 0.034)
    if (distance > hitRadius) {
      this.clearPendingHandColor()
      return false
    }

    if (this.pendingHandColor !== nearest.color) {
      this.pendingHandColor = nearest.color
      this.pendingHandColorStartedAt = timestampMs
      return true
    }

    if (timestampMs - this.pendingHandColorStartedAt < 600) {
      return true
    }

    if (nearest.color === this.currentColor && timestampMs - this.lastHandColorSelectedAt < 220) {
      return true
    }

    this.selectColor(nearest.color, nearest.x, nearest.y)
    this.lastHandColorSelectedAt = timestampMs
    this.clearPendingHandColor()
    this.recordDrawingActivity()

    return true
  }

  private clearPendingHandColor() {
    this.pendingHandColor = null
    this.pendingHandColorStartedAt = 0
  }

  private showRumiLine(stage: RumiContentDialogStage) {
    const line = Phaser.Utils.Array.GetRandom(rumiContentDialogs['free-drawing'][stage])
    this.rumiBubbleText.setText(line.text)
  }

  private selectColor(color: number, _x: number, _y: number) {
    this.currentColor = color
    this.paletteSelection.setVisible(false)
  }

  private getNearestPaletteColor(x: number, y: number): PalettePoint | null {
    let nearest: PalettePoint | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const point of this.palettePoints) {
      const distance = Phaser.Math.Distance.Between(x, y, point.x, point.y)
      if (distance < nearestDistance) {
        nearest = point
        nearestDistance = distance
      }
    }

    return nearest
  }

  private drawDot(x: number, y: number) {
    this.brushStroke.clear()
    this.brushStroke.fillStyle(this.currentColor, 1)
    this.brushStroke.fillCircle(
      x - this.drawBounds.x,
      y - this.drawBounds.y,
      this.getBrushSize() / 2,
    )
    this.drawingTexture.draw(this.brushStroke)
  }

  private drawStroke(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2) {
    this.brushStroke.clear()
    this.brushStroke.lineStyle(this.getBrushSize(), this.currentColor, 1)
    this.brushStroke.beginPath()
    this.brushStroke.moveTo(from.x - this.drawBounds.x, from.y - this.drawBounds.y)
    this.brushStroke.lineTo(to.x - this.drawBounds.x, to.y - this.drawBounds.y)
    this.brushStroke.strokePath()
    this.brushStroke.fillStyle(this.currentColor, 1)
    this.brushStroke.fillCircle(
      to.x - this.drawBounds.x,
      to.y - this.drawBounds.y,
      this.getBrushSize() / 2,
    )
    this.drawingTexture.draw(this.brushStroke)
  }

  private getBrushSize() {
    return Math.max(6, Math.round(this.drawBounds.width * 0.013))
  }

  private clampToDrawBounds(x: number, y: number) {
    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(x, this.drawBounds.left, this.drawBounds.right),
      Phaser.Math.Clamp(y, this.drawBounds.top, this.drawBounds.bottom),
    )
  }

  private recordDrawingActivity() {
    this.lastInteractionAt = this.time.now
  }

  private stopDrawing() {
    this.isDrawing = false
    this.lastDrawPoint = null
  }

  private resetDrawing() {
    this.stopDrawing()
    this.stopHandDrawing()
    this.handPointerSmoother.reset()
    this.handTrackingGuard.reset()
    this.drawingTexture.clear()
    this.hasStartedDrawing = false
    this.strokeCount = 0
    this.showRumiLine('intro')
  }

  private saveDrawing() {
    if (this.isSavingDrawing) {
      return
    }

    this.isSavingDrawing = true
    void this.exportDrawingLinesPng()
      .then(exportedDrawing => {
        this.downloadBlob(exportedDrawing.blob, exportedDrawing.filename)
        this.showRumiLine('complete')
      })
      .catch(error => {
        console.error('Failed to export free drawing PNG.', error)
      })
      .finally(() => {
        this.isSavingDrawing = false
      })
  }

  private exportDrawingLinesPng(): Promise<ExportedDrawingPng> {
    return new Promise((resolve, reject) => {
      this.drawingTexture.snapshot(snapshot => {
        if (!(snapshot instanceof HTMLImageElement)) {
          reject(new Error('Drawing snapshot did not return an image.'))
          return
        }

        const dataUrl = snapshot.src
        resolve({
          blob: this.dataUrlToBlob(dataUrl),
          dataUrl,
          filename: `free-drawing-lines-${Date.now()}.png`,
          width: Math.round(this.drawBounds.width),
          height: Math.round(this.drawBounds.height),
        })
      }, 'image/png')
    })
  }

  private dataUrlToBlob(dataUrl: string) {
    const [metadata, base64Data] = dataUrl.split(',')
    const mimeType = metadata.match(/^data:(.*?);/)?.[1] ?? 'image/png'
    const binary = atob(base64Data)
    const bytes = new Uint8Array(binary.length)

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }

    return new Blob([bytes], { type: mimeType })
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  private returnToArtRoom() {
    this.stopDrawing()
    this.stopHandTracking()
    this.cameras.main.fadeOut(220, 0, 0, 0)
    this.time.delayedCall(220, () => {
      this.scene.start('ArtSelectScene', {
        spawn: ART_ROOM_RETURN_SPAWN,
        suppressRumiDialog: true,
      })
    })
  }
}
