import Phaser from 'phaser'
import { createArtwork, updateArtwork } from '@wish/api-client'
import { assetPath } from '@/game/assets/assetPath'
import { HandTracker, type TrackedHand } from '@/game/motion/handTracker'
import { detectIndexFingerGesture } from '@/game/motion/indexFingerGesture'
import { toPointerCanvasCoordinates } from '@/game/motion/pointerCanvasCoordinates'
import { toPointerConfidence } from '@/game/motion/pointerConfidence'
import { toPointerCoordinates } from '@/game/motion/pointerCoordinates'
import { getPointerReference } from '@/game/motion/pointerReference'
import { PointerSmoother } from '@/game/motion/pointerSmoother'
import { PointerTrackingGuard } from '@/game/motion/pointerTrackingGuard'
import { createArtCameraPreview, type ArtCameraPreview } from '../ui/artCameraPreview'
import { getArtBrushColorOverlayTextureKey } from '../ui/artBrushColorOverlayTexture'
import { createArtConfirmDialog, type ArtConfirmDialog } from '../ui/artConfirmDialog'

const ART_ROOM_RETURN_SPAWN = { xRatio: 0.5, yRatio: 0.76 }
const CANVAS_SOURCE_SIZE = { width: 1535, height: 1024 }
const CANVAS_DRAW_AREA = { x: 120, y: 150, width: 1288, height: 620 }
const DELETE_BUTTON_SIZE = { width: 344, height: 336 }
const EXIT_CONFIRM_DEPTH = 60
type DrawingTool = 'brush' | 'eraser'
const DRAWING_TOOLS: DrawingTool[] = ['brush', 'eraser']
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
type ArtFreeDrawingSceneData = {
  suppressIntroDialog?: boolean
  editArtwork?: EditableArtworkSceneData
}
type EditableArtworkSceneData = {
  id: number
  imageTextureKey: string
  isPublic: boolean
}
type HandActionKind = 'save' | 'reset' | 'exit'
type ExportedDrawingPng = {
  blob: Blob
  dataUrl: string
  filename: string
  isPublic: boolean
  playDurationSeconds: number
  width: number
  height: number
}

export class ArtFreeDrawingScene extends Phaser.Scene {
  private drawBounds = new Phaser.Geom.Rectangle()
  private canvasFrameBounds = new Phaser.Geom.Rectangle()
  private paletteBounds = new Phaser.Geom.Rectangle()
  private drawingTexture!: Phaser.GameObjects.RenderTexture
  private brushStroke!: Phaser.GameObjects.Graphics
  private paletteSelection!: Phaser.GameObjects.Arc
  private cameraPreview: ArtCameraPreview | null = null
  private brushCursor: Phaser.GameObjects.Image | null = null
  private brushColorOverlay: Phaser.GameObjects.Image | null = null
  private toolButtons: Partial<Record<DrawingTool, Phaser.GameObjects.Image>> = {}
  private toolButtonFrames: Partial<Record<DrawingTool, Phaser.GameObjects.Arc>> = {}
  private toolButtonGlows: Partial<Record<DrawingTool, Phaser.GameObjects.Image>> = {}
  private toolButtonBaseScales: Partial<Record<DrawingTool, { x: number; y: number }>> = {}
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
  private isTransitioning = false
  private hasStartedDrawing = false
  private strokeCount = 0
  private lastDrawPoint: Phaser.Math.Vector2 | null = null
  private lastHandDrawPoint: Phaser.Math.Vector2 | null = null
  private currentTool: DrawingTool = 'brush'
  private currentColor: number = PALETTE_SWATCHES[0].color
  private lastHandColorSelectedAt = 0
  private pendingHandColor: number | null = null
  private pendingHandColorStartedAt = 0
  private pendingHandTool: DrawingTool | null = null
  private pendingHandToolStartedAt = 0
  private lastHandToolSelectedAt = 0
  private pendingHandAction: HandActionKind | null = null
  private pendingHandActionStartedAt = 0
  private activatedHandAction: HandActionKind | null = null
  private isSavingDrawing = false
  private isExitConfirmOpen = false
  private exitConfirmDialog: ArtConfirmDialog | null = null
  private isSaveVisibilityConfirmOpen = false
  private saveVisibilityConfirmDialog: ArtConfirmDialog | null = null
  private editingArtwork: EditableArtworkSceneData | null = null
  private contentStartedAt = 0
  private saveButtonBaseScale = { x: 1, y: 1 }
  private resetButtonBaseScale = { x: 1, y: 1 }
  private exitButtonBaseScale = { x: 1, y: 1 }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (
      this.isTransitioning ||
      this.isSavingDrawing ||
      this.isExitConfirmOpen ||
      this.isSaveVisibilityConfirmOpen
    ) {
      return
    }

    if (!Phaser.Geom.Rectangle.Contains(this.drawBounds, pointer.x, pointer.y)) {
      return
    }

    this.isDrawing = true
    this.strokeCount += 1
    const point = this.clampToDrawBounds(pointer.x, pointer.y)
    this.lastDrawPoint = point
    this.drawDot(point.x, point.y)

    if (!this.hasStartedDrawing) {
      this.hasStartedDrawing = true
    }
  }

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer) => {
    if (
      this.isTransitioning ||
      this.isSavingDrawing ||
      this.isExitConfirmOpen ||
      this.isSaveVisibilityConfirmOpen
    ) {
      this.stopDrawing()
      return
    }

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

    if (!Phaser.Geom.Rectangle.Contains(this.drawBounds, pointer.x, pointer.y)) {
      this.stopDrawing()
    }
  }

  private readonly handlePointerUp = () => {
    this.stopDrawing()
  }

  private readonly handleEscDown = () => {
    if (this.isSaveVisibilityConfirmOpen) {
      this.hideSaveVisibilityConfirm()
      return
    }

    if (this.isExitConfirmOpen) {
      this.hideExitConfirm()
      return
    }

    this.requestReturnToArtRoom()
  }

  constructor() {
    super({ key: 'ArtFreeDrawingScene' })
  }

  preload() {
    this.load.image('art-room-background', assetPath('images/themes/art/background/background.png'))
    this.load.image('art-ui-canvas', assetPath('images/themes/art/ui/canvas.png'))
    this.load.image('art-ui-palette', assetPath('images/themes/art/ui/palette.png'))
    this.load.image('art-ui-brush', assetPath('images/themes/art/ui/brush.png'))
    this.load.image('art-ui-eraser', assetPath('images/themes/art/ui/eraser.png'))
    this.load.image('art-ui-delete-btn', assetPath('images/themes/art/ui/delete_btn.png'))
    this.load.image('art-ui-reset-btn', assetPath('images/themes/art/ui/reset.png'))
    this.load.image('art-ui-save-btn', assetPath('images/themes/art/ui/save_btn.png'))
  }

  create(data: ArtFreeDrawingSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.editingArtwork = data.editArtwork ?? null
    this.contentStartedAt = this.time.now
    this.isTransitioning = false
    this.isSavingDrawing = false
    this.isExitConfirmOpen = false
    this.exitConfirmDialog = null
    this.isSaveVisibilityConfirmOpen = false
    this.saveVisibilityConfirmDialog = null
    this.brushCursor = null
    this.brushColorOverlay = null
    this.cameraPreview = null
    this.hasStartedDrawing = false
    this.strokeCount = 0
    this.handTrackingDisposed = false
    this.currentTool = 'brush'
    this.toolButtons = {}
    this.toolButtonFrames = {}
    this.toolButtonGlows = {}
    this.toolButtonBaseScales = {}
    this.pendingHandTool = null
    this.pendingHandToolStartedAt = 0
    this.lastHandToolSelectedAt = 0

    const background = this.add.image(vw / 2, vh / 2, 'art-room-background')
    const backgroundSource = background.texture.getSourceImage() as HTMLImageElement
    const backgroundScale = Math.max(vw / backgroundSource.width, vh / backgroundSource.height)
    background.setScale(backgroundScale).setDepth(0)

    this.add.rectangle(vw / 2, vh / 2, vw, vh, 0xf4ead7, 0.08).setDepth(1)

    this.createCanvas(vw, vh)
    if (this.applyInitialArtworkImage()) {
      this.hasStartedDrawing = true
    }
    this.createHeader(vw, vh)
    this.createExitButton(vw, vh)
    this.createBrushCursor()
    this.createPalette(vw, vh)
    this.createActionButtons()
    this.createToolSelector()
    this.createCameraPreview(vw, vh)

    this.input.on('pointerdown', this.handlePointerDown)
    this.input.on('pointermove', this.handlePointerMove)
    this.input.on('pointerup', this.handlePointerUp)
    this.input.on('pointerupoutside', this.handlePointerUp)
    this.input.keyboard!.on('keydown-ESC', this.handleEscDown)
    this.startHandDrawingMode()

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handlePointerDown)
      this.input.off('pointermove', this.handlePointerMove)
      this.input.off('pointerup', this.handlePointerUp)
      this.input.off('pointerupoutside', this.handlePointerUp)
      this.input.keyboard?.off('keydown-ESC', this.handleEscDown)
      this.input.setDefaultCursor('default')
      this.hideExitConfirm()
      this.hideSaveVisibilityConfirm()
      this.cameraPreview?.destroy()
      this.cameraPreview = null
      this.stopHandTracking()
      this.brushCursor = null
      this.brushColorOverlay = null
    })

    this.cameras.main.fadeIn(220, 0, 0, 0)
  }

  update(time: number) {
    const pointer = this.input.activePointer
    this.updateBrushCursorPosition(pointer.x, pointer.y)

    this.cameraPreview?.update()
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

  private applyInitialArtworkImage() {
    if (!this.editingArtwork || !this.textures.exists(this.editingArtwork.imageTextureKey)) {
      return false
    }

    const source = this.textures
      .get(this.editingArtwork.imageTextureKey)
      .getSourceImage() as HTMLImageElement
    const scale = Math.min(
      this.drawBounds.width / source.width,
      this.drawBounds.height / source.height,
    )
    const image = this.add
      .image(0, 0, this.editingArtwork.imageTextureKey)
      .setOrigin(0, 0)
      .setDisplaySize(source.width * scale, source.height * scale)
      .setVisible(false)
    image.setPosition(
      (this.drawBounds.width - image.displayWidth) / 2,
      (this.drawBounds.height - image.displayHeight) / 2,
    )
    this.drawingTexture.draw(image)
    image.destroy()
    return true
  }

  private createPalette(vw: number, vh: number) {
    const paletteHeight = Math.min(this.drawBounds.height * 0.88, vh * 0.41)
    const paletteWidth = paletteHeight * (3429 / 2286)
    const toolIconSize = Math.max(68, Math.min(90, Math.round(vw * 0.044)))
    const toolHitSize = toolIconSize + 18
    const toolGap = Math.max(10, Math.round(toolHitSize * 0.14))
    const minPanelCenterX = this.drawBounds.right + paletteWidth * 0.24
    const maxPanelCenterX = Math.max(
      minPanelCenterX,
      vw - toolHitSize - toolGap - paletteWidth * 0.18 - 24,
    )
    const panelCenterX = Phaser.Math.Clamp(
      this.drawBounds.right + paletteWidth * 0.35,
      minPanelCenterX,
      maxPanelCenterX,
    )
    const paletteTargetTop = this.drawBounds.top + 2
    const palette = this.add
      .image(panelCenterX, paletteTargetTop + paletteHeight / 2, 'art-ui-palette')
      .setDepth(8)
    palette.setDisplaySize(paletteWidth, paletteHeight)

    const paletteLeft = palette.x - palette.displayWidth / 2
    const paletteBoundsTop = palette.y - palette.displayHeight / 2
    const scaleX = palette.displayWidth / 3429
    const scaleY = palette.displayHeight / 2286
    const selectionRadius = Math.max(11, palette.displayWidth * 0.034)
    const hitWidth = palette.displayWidth * 0.115
    const hitHeight = palette.displayHeight * 0.06
    const minSwatchSourceX = Math.min(...PALETTE_SWATCHES.map(swatch => swatch.sourceX))
    const maxSwatchSourceX = Math.max(...PALETTE_SWATCHES.map(swatch => swatch.sourceX))
    const visualPaddingX = hitWidth * 0.9
    this.paletteBounds.setTo(
      paletteLeft + minSwatchSourceX * scaleX - visualPaddingX,
      paletteBoundsTop,
      (maxSwatchSourceX - minSwatchSourceX) * scaleX + visualPaddingX * 2,
      palette.displayHeight,
    )

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
        const nearest = this.getPaletteColorAt(pointer.x, pointer.y)
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
        this.requestSaveDrawing()
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

  private createToolSelector() {
    const iconSize = Math.max(68, Math.min(90, Math.round(this.scale.width * 0.044)))
    const hitSize = iconSize + 8
    const hitRadius = hitSize / 2
    const gap = Math.max(10, Math.round(hitSize * 0.14))
    const totalHeight = DRAWING_TOOLS.length * hitSize + (DRAWING_TOOLS.length - 1) * gap
    const x = Math.min(
      this.scale.width - hitRadius - 18,
      this.paletteBounds.right + gap + hitRadius,
    )
    const maxTop = Math.max(16, this.scale.height - totalHeight - 16)
    const startY = Phaser.Math.Clamp(this.paletteBounds.centerY - totalHeight / 2, 16, maxTop)

    DRAWING_TOOLS.forEach((tool, index) => {
      const y = startY + hitRadius + index * (hitSize + gap)
      const frame = this.add
        .circle(x, y, hitRadius, 0xfff6e8, 0.001)
        .setStrokeStyle(0, 0xffffff, 0)
        .setDepth(14)
      const glow = this.add
        .image(x, y, tool === 'brush' ? 'art-ui-brush' : 'art-ui-eraser')
        .setDepth(14)
        .setDisplaySize(iconSize, iconSize)
        .setTint(0x7fa7ff)
        .setAlpha(0)
      const button = this.add
        .image(x, y, tool === 'brush' ? 'art-ui-brush' : 'art-ui-eraser')
        .setDepth(15)
        .setDisplaySize(iconSize, iconSize)
        .setInteractive({ useHandCursor: true })

      this.toolButtonFrames[tool] = frame
      this.toolButtonGlows[tool] = glow
      this.toolButtons[tool] = button
      this.toolButtonBaseScales[tool] = { x: button.scaleX, y: button.scaleY }

      button.on('pointerover', () => this.refreshToolButtons(tool))
      button.on('pointerout', () => this.refreshToolButtons())
      button.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event.stopPropagation()
          this.setDrawingTool(tool)
        },
      )
    })

    this.refreshToolButtons()
  }

  private createCameraPreview(vw: number, vh: number) {
    const panelCenterX = vw * 0.878
    const paletteHeight = Math.min(this.drawBounds.height * 0.88, vh * 0.41)
    const paletteBottom = this.drawBounds.top + 2 + paletteHeight
    const availableTop = paletteBottom + Math.max(10, vh * 0.012)
    const availableBottom = vh - Math.max(14, vh * 0.018)
    const availableHeight = Math.max(120, availableBottom - availableTop)
    const panelWidth = Math.max(160, Math.min(vw * 0.21, 360, availableHeight * (4 / 3)))
    const panelHeight = panelWidth * 0.75
    const panelY = Math.min(availableBottom - panelHeight / 2, availableTop + panelHeight / 2)

    this.cameraPreview = createArtCameraPreview(this, {
      depth: 8,
      getVideoElement: () => this.handTracker?.video ?? null,
      height: panelHeight,
      textureKey: `${this.scene.key}-camera-preview`,
      width: panelWidth,
      x: panelCenterX,
      y: panelY,
    })
  }

  private createExitButton(vw: number, _vh: number) {
    const buttonHeight = Math.max(48, Math.round(vw * 0.034))
    const buttonWidth = Math.round(
      buttonHeight * (DELETE_BUTTON_SIZE.width / DELETE_BUTTON_SIZE.height),
    )
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
        this.requestReturnToArtRoom()
      },
    )
  }

  private createBrushCursor() {
    this.input.setDefaultCursor('none')
    this.brushCursor = this.add.image(0, 0, 'art-ui-brush').setDepth(20)
    this.brushCursor.setScrollFactor(0)
    this.brushColorOverlay = this.add
      .image(0, 0, getArtBrushColorOverlayTextureKey(this, this.currentColor))
      .setDepth(21)
    this.brushColorOverlay.setScrollFactor(0)
    this.updateBrushCursorPosition(this.input.activePointer.x, this.input.activePointer.y)
    this.updateBrushCursorTexture()
  }

  private setDrawingTool(tool: DrawingTool) {
    this.currentTool = tool
    this.clearPendingHandTool()
    this.refreshToolButtons()
    this.updateBrushCursorTexture()
  }

  private refreshToolButtons(hoveredTool: DrawingTool | null = null) {
    DRAWING_TOOLS.forEach(tool => {
      const button = this.toolButtons[tool]
      const frame = this.toolButtonFrames[tool]
      const glow = this.toolButtonGlows[tool]
      const baseScale = this.toolButtonBaseScales[tool]
      if (!button || !frame || !glow || !baseScale) {
        return
      }

      const isSelected = tool === this.currentTool
      const isHovered = tool === hoveredTool
      frame.setFillStyle(0xfff6e8, 0.001)
      frame.setStrokeStyle(0, 0xffffff, 0)
      glow.setAlpha(isSelected ? 0.42 : isHovered ? 0.22 : 0)
      glow.setScale(
        baseScale.x * (isSelected ? 1.32 : 1.22),
        baseScale.y * (isSelected ? 1.32 : 1.22),
      )
      button.clearTint()
      button.setTint(isSelected ? 0xffffff : isHovered ? 0xfff0c7 : 0xffffff)
      button.setScale(
        baseScale.x * (isSelected ? 1.08 : isHovered ? 1.04 : 1),
        baseScale.y * (isSelected ? 1.08 : isHovered ? 1.04 : 1),
      )
    })
  }

  private updateBrushCursorTexture() {
    const brushCursor = this.brushCursor
    if (!brushCursor || !brushCursor.scene || !brushCursor.active) {
      return
    }

    if (this.currentTool === 'eraser') {
      brushCursor.setTexture('art-ui-eraser')
      brushCursor.setDisplaySize(54, 54)
      brushCursor.setOrigin(0.5, 0.5)
      this.updateBrushColorPreview()
      return
    }

    brushCursor.setTexture('art-ui-brush')
    brushCursor.setDisplaySize(48, 48)
    brushCursor.setOrigin(0.18, 0.88)
    this.updateBrushColorPreview()
  }

  private updateBrushCursorPosition(x: number, y: number) {
    if (this.brushCursor?.scene && this.brushCursor.active) {
      this.brushCursor.setPosition(x, y)
    }
    if (this.brushColorOverlay?.scene && this.brushColorOverlay.active) {
      this.brushColorOverlay.setPosition(x, y)
    }
  }

  private updateBrushColorPreview() {
    const brushColorOverlay = this.brushColorOverlay
    if (!brushColorOverlay || !brushColorOverlay.scene || !brushColorOverlay.active) {
      return
    }

    brushColorOverlay.setVisible(this.currentTool === 'brush')
    brushColorOverlay.setTexture(getArtBrushColorOverlayTextureKey(this, this.currentColor))
    brushColorOverlay.setDisplaySize(48, 48)
    brushColorOverlay.setOrigin(0.18, 0.88)
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
    this.clearPendingHandTool()
    this.handPointerSmoother.reset()
    this.handTrackingGuard.reset()
    this.handTracker?.stop()
    this.handTracker = null
  }

  private updateHandDrawing(timestampMs: number) {
    const tracker = this.handTracker
    if (
      !tracker?.isStarted ||
      this.isDrawing ||
      this.isTransitioning ||
      this.isSavingDrawing ||
      this.isExitConfirmOpen ||
      this.isSaveVisibilityConfirmOpen
    ) {
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
      this.clearPendingHandTool()
      return
    }

    const smoothedPoint = this.handPointerSmoother.smooth(tracking.point)
    this.updateBrushCursorPosition(smoothedPoint.x, smoothedPoint.y)

    if (tracking.status !== 'tracked') {
      return
    }

    if (!handState?.isDrawingGesture) {
      this.stopHandDrawing()
      this.clearPendingHandAction()
      this.clearPendingHandTool()
      return
    }

    if (this.tryActivateActionButtonFromHand(smoothedPoint, result.timestampMs)) {
      this.stopHandDrawing()
      this.clearPendingHandTool()
      return
    }

    if (this.trySelectToolFromHand(smoothedPoint, result.timestampMs)) {
      this.stopHandDrawing()
      return
    }

    if (this.trySelectColorFromHand(smoothedPoint, result.timestampMs)) {
      this.stopHandDrawing()
      this.clearPendingHandTool()
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

      if (!this.hasStartedDrawing) {
        this.hasStartedDrawing = true
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
      this.requestSaveDrawing()
    } else if (action === 'reset') {
      this.resetDrawing()
    } else {
      this.requestReturnToArtRoom()
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

  private trySelectToolFromHand(point: Phaser.Math.Vector2, timestampMs: number) {
    const tool = this.getHandToolAt(point)
    if (!tool) {
      this.clearPendingHandTool()
      return false
    }

    this.refreshToolButtons(tool)

    if (this.pendingHandTool !== tool) {
      this.pendingHandTool = tool
      this.pendingHandToolStartedAt = timestampMs
      return true
    }

    if (timestampMs - this.pendingHandToolStartedAt < 600) {
      return true
    }

    if (tool === this.currentTool && timestampMs - this.lastHandToolSelectedAt < 220) {
      return true
    }

    this.setDrawingTool(tool)
    this.lastHandToolSelectedAt = timestampMs
    return true
  }

  private getHandToolAt(point: Phaser.Math.Vector2): DrawingTool | null {
    for (const tool of DRAWING_TOOLS) {
      if (this.toolButtonFrames[tool]?.getBounds().contains(point.x, point.y)) {
        return tool
      }
    }

    return null
  }

  private clearPendingHandTool() {
    this.pendingHandTool = null
    this.pendingHandToolStartedAt = 0
    this.refreshToolButtons()
  }

  private trySelectColorFromHand(point: Phaser.Math.Vector2, timestampMs: number) {
    const nearest = this.getPaletteColorAt(point.x, point.y)
    if (!nearest) {
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

    return true
  }

  private clearPendingHandColor() {
    this.pendingHandColor = null
    this.pendingHandColorStartedAt = 0
  }

  private selectColor(color: number, _x: number, _y: number) {
    this.currentColor = color
    this.setDrawingTool('brush')
    this.paletteSelection.setVisible(false)
  }

  private getPaletteColorAt(x: number, y: number): PalettePoint | null {
    const nearest = this.getNearestPaletteColor(x, y)
    if (!nearest) {
      return null
    }

    const distance = Phaser.Math.Distance.Between(x, y, nearest.x, nearest.y)
    if (distance > this.getPaletteHitRadius()) {
      return null
    }

    return nearest
  }

  private getPaletteHitRadius() {
    return Math.max(24, Math.min(this.scale.width, this.scale.height) * 0.034)
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
    const strokeSize = this.getActiveStrokeSize()
    this.brushStroke.clear()
    this.brushStroke.fillStyle(this.getActiveStrokeColor(), 1)
    this.brushStroke.fillCircle(x - this.drawBounds.x, y - this.drawBounds.y, strokeSize / 2)
    this.drawingTexture.draw(this.brushStroke)
  }

  private drawStroke(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2) {
    const strokeSize = this.getActiveStrokeSize()
    const strokeColor = this.getActiveStrokeColor()
    this.brushStroke.clear()
    this.brushStroke.lineStyle(strokeSize, strokeColor, 1)
    this.brushStroke.beginPath()
    this.brushStroke.moveTo(from.x - this.drawBounds.x, from.y - this.drawBounds.y)
    this.brushStroke.lineTo(to.x - this.drawBounds.x, to.y - this.drawBounds.y)
    this.brushStroke.strokePath()
    this.brushStroke.fillStyle(strokeColor, 1)
    this.brushStroke.fillCircle(to.x - this.drawBounds.x, to.y - this.drawBounds.y, strokeSize / 2)
    this.drawingTexture.draw(this.brushStroke)
  }

  private getActiveStrokeColor() {
    return this.currentTool === 'eraser' ? 0xffffff : this.currentColor
  }

  private getActiveStrokeSize() {
    const brushSize = this.getBrushSize()
    return this.currentTool === 'eraser' ? Math.round(brushSize * 2.1) : brushSize
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
  }

  private requestSaveDrawing() {
    if (
      this.isTransitioning ||
      this.isSavingDrawing ||
      this.isExitConfirmOpen ||
      this.isSaveVisibilityConfirmOpen
    ) {
      return
    }

    this.stopDrawing()
    this.stopHandDrawing()
    this.showSaveVisibilityConfirm()
  }

  private saveDrawing(isPublic: boolean) {
    if (this.isSavingDrawing) {
      return
    }

    this.isSavingDrawing = true
    const playDurationSeconds = this.getPlayDurationSeconds()
    void this.exportDrawingPng(playDurationSeconds, isPublic)
      .then(exportedDrawing => {
        if (this.editingArtwork) {
          return updateArtwork({
            id: this.editingArtwork.id,
            image: exportedDrawing.blob,
            filename: exportedDrawing.filename,
            additionalPlayDurationSeconds: exportedDrawing.playDurationSeconds,
            isPublic: exportedDrawing.isPublic,
          })
        }

        return createArtwork({
          image: exportedDrawing.blob,
          filename: exportedDrawing.filename,
          sketchCode: null,
          playDurationSeconds: exportedDrawing.playDurationSeconds,
          isPublic: exportedDrawing.isPublic,
        })
      })
      .then(() => {
        this.hasStartedDrawing = false
        this.returnToArtRoom()
      })
      .catch(error => {
        console.error('Failed to save free drawing artwork.', error)
      })
      .finally(() => {
        this.isSavingDrawing = false
      })
  }

  private exportDrawingPng(
    playDurationSeconds: number,
    isPublic: boolean,
  ): Promise<ExportedDrawingPng> {
    return new Promise((resolve, reject) => {
      this.drawingTexture.snapshot(snapshot => {
        if (!(snapshot instanceof HTMLImageElement) && !(snapshot instanceof HTMLCanvasElement)) {
          reject(new Error('Drawing snapshot did not return an image.'))
          return
        }

        const width = Math.round(this.drawBounds.width)
        const height = Math.round(this.drawBounds.height)
        const outputCanvas = document.createElement('canvas')
        outputCanvas.width = width
        outputCanvas.height = height
        const context = outputCanvas.getContext('2d')

        if (!context) {
          reject(new Error('Failed to create drawing export canvas.'))
          return
        }

        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, width, height)
        context.drawImage(snapshot, 0, 0, width, height)

        const dataUrl = outputCanvas.toDataURL('image/png')
        resolve({
          blob: this.dataUrlToBlob(dataUrl),
          dataUrl,
          filename: `free-drawing-${Date.now()}.png`,
          isPublic,
          playDurationSeconds,
          width,
          height,
        })
      }, 'image/png')
    })
  }

  private getPlayDurationSeconds() {
    return Math.max(0, Math.floor((this.time.now - this.contentStartedAt) / 1000))
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

  private requestReturnToArtRoom() {
    if (this.isTransitioning || this.isSavingDrawing || this.isSaveVisibilityConfirmOpen) {
      return
    }

    this.stopDrawing()
    this.stopHandDrawing()

    if (this.hasStartedDrawing) {
      this.showExitConfirm()
      return
    }

    this.returnToArtRoom()
  }

  private showExitConfirm() {
    if (this.isExitConfirmOpen) {
      return
    }

    this.isExitConfirmOpen = true
    this.exitConfirmDialog = createArtConfirmDialog(this, {
      depth: EXIT_CONFIRM_DEPTH,
      title: '아직 저장하지 않았어요',
      message: '나가면 지금 그린 그림은 사라져요.',
      secondaryButton: {
        label: '계속 그리기',
        fillColor: 0xfffbf1,
        strokeColor: 0xaa875b,
        textColor: '#5f3b22',
        onSelect: () => this.hideExitConfirm(),
      },
      primaryButton: {
        label: '나가기',
        fillColor: 0xb7603b,
        strokeColor: 0x7c3f27,
        textColor: '#ffffff',
        onSelect: () => {
          this.hideExitConfirm()
          this.returnToArtRoom()
        },
      },
    })
  }

  private showSaveVisibilityConfirm() {
    if (this.isSaveVisibilityConfirmOpen) {
      return
    }

    this.isSaveVisibilityConfirmOpen = true
    this.saveVisibilityConfirmDialog = createArtConfirmDialog(this, {
      depth: EXIT_CONFIRM_DEPTH,
      title: '공개 범위를 선택해줘',
      message: '저장한 그림을 다른 사람에게 보여줄까요?',
      secondaryButton: {
        label: '나만 보기',
        fillColor: 0xfffbf1,
        strokeColor: 0xaa875b,
        textColor: '#5f3b22',
        onSelect: () => {
          this.hideSaveVisibilityConfirm()
          this.saveDrawing(false)
        },
      },
      primaryButton: {
        label: '공개하기',
        fillColor: 0x65a843,
        strokeColor: 0x3f752a,
        textColor: '#ffffff',
        onSelect: () => {
          this.hideSaveVisibilityConfirm()
          this.saveDrawing(true)
        },
      },
    })
  }

  private hideExitConfirm() {
    this.exitConfirmDialog?.destroy()
    this.exitConfirmDialog = null
    this.isExitConfirmOpen = false
  }

  private hideSaveVisibilityConfirm() {
    this.saveVisibilityConfirmDialog?.destroy()
    this.saveVisibilityConfirmDialog = null
    this.isSaveVisibilityConfirmOpen = false
  }

  private returnToArtRoom() {
    if (this.isTransitioning) {
      return
    }

    this.isTransitioning = true
    this.hideExitConfirm()
    this.hideSaveVisibilityConfirm()
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
