import Phaser from 'phaser'
import { playSceneBgm } from '@/game/systems/sceneBgm'
import { consumeFuel, getFuelInbox, getFuelStatus, type FuelInboxEvent } from '@wish/api-client'
import { assetPath } from '@/game/assets/assetPath'
import {
  createClickTargetMarker,
  createPlayer,
  ensurePlayerWalkAnimations,
  loadPlayerSpritesheets,
  type PlayerDirection,
  type PlayerSprite,
  type RatioPoint,
  updatePlayerMovement,
} from '@/game/entities/player'
import { getPlayerMoveSpeed } from '@/game/settings/gameSettings'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { getGameWeather } from '@/features/weather/weatherStore'
import type { WeatherCondition } from '@/features/weather/types'
import { addCoverBackground } from '@/game/world/background'
import { createRatioRectangle, getRectangleEntryState } from '@/game/world/portal'
import {
  attachEmojiPalette,
  attachVillageRealtime,
  type AttachedEmojiPalette,
  type VillageRealtimeIntegration,
} from '@/features/village-realtime'

const FERRY_BACKGROUND_KEY = 'ferry-background'
const FERRY_CLOUDY_BACKGROUND_KEY = 'ferry-background-cloudy'
const FERRY_FRAME_KEY = 'ferry-frame'
const STAR_FRAME_KEY = 'ferry-star-frame'
const FERRY_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.78 }
const FERRY_EXIT_PORTAL = { xRatio: 0.43, yRatio: 0.86, widthRatio: 0.14, heightRatio: 0.12 }
const FERRY_RETURN_SPAWN = { xRatio: 0.475, yRatio: 0.755 }
const FUEL_GOAL_PERCENT = 100
const FUEL_PANEL_DEPTH = 20
const INITIAL_FUEL_PERCENT = 0
const STAR_FLY_DURATION_MS = 750
const STAR_FLY_ARC_HEIGHT = 90
const SHIP_TARGET = { xRatio: 0.54, yRatio: 0.56 }
const DEFAULT_GUARDIAN_MESSAGE = '오늘도 정말 잘했어, 천천히 같이 가보자.'
const FERRY_UI_FONT_FAMILY =
  '"Pretendard Variable", Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
const FERRY_FUEL_COLORS = {
  shadow: 0x4a321e,
  panel: 0xfffdf7,
  panelBottom: 0xf8f0e4,
  panelBorder: 0xb99f71,
  innerBorder: 0xe8dcc8,
  message: 0xfffdf8,
  messageBorder: 0xeadfce,
  title: '#3b3026',
  text: '#4a3a2c',
  muted: '#8a7d70',
  accent: 0xf0c979,
  accentText: '#9a6a25',
  accentDark: 0x9a6a25,
  primary: 0xf3a86f,
  primaryDark: 0xd4834f,
  progressTrack: 0xeee5d8,
  progressFill: 0xf0c979,
} as const
const COMPACT_PANEL = {
  designWidth: 360,
  designHeight: 226,
  maxWidth: 380,
  minWidth: 330,
  marginX: 28,
  marginY: 92,
  iconSize: 76,
  iconMarginX: 28,
  iconMarginY: 24,
} as const

const DEBUG_OBSTACLES = false
const OBSTACLE_EDITOR_ENABLED = import.meta.env.DEV
const OBSTACLE_EDITOR_MIN_SIZE = 0.003

type ObstacleRect = { x: number; y: number; w: number; h: number }
type ObstacleInstance = {
  rect: ObstacleRect
  object: Phaser.GameObjects.Rectangle
}

const ROOM_OBSTACLES: ObstacleRect[] = [
  { x: 0, y: 0.0026, w: 0.9965, h: 0.5856 },
  { x: 0, y: 0.481, w: 0.0764, h: 0.5163 },
  { x: 0.0736, y: 0.7307, w: 0.0674, h: 0.1765 },
  { x: 0.1139, y: 0.7216, w: 0.0104, h: 0.017 },
  { x: 0.159, y: 0.5961, w: 0.0715, h: 0.0588 },
  { x: 0.3465, y: 0.6275, w: 0.0201, h: 0.0876 },
  { x: 0.35, y: 0.5778, w: 0.1792, h: 0.0366 },
  { x: 0.4722, y: 0.7098, w: 0.0187, h: 0.085 },
  { x: 0.7521, y: 0.5333, w: 0.2458, h: 0.4601 },
  { x: 0.584, y: 0.5647, w: 0.2056, h: 0.3137 },
  { x: 0.5104, y: 0.6954, w: 0.0986, h: 0.0431 },
  { x: 0.5062, y: 0.6667, w: 0.0222, h: 0.051 },
  { x: 0.5465, y: 0.566, w: 0.0646, h: 0.1752 },
  { x: 0.3618, y: 0.6052, w: 0.2396, h: 0.0353 },
  { x: 0.2562, y: 0.5608, w: 0.1118, h: 0.0601 },
  { x: 0.0625, y: 0.5621, w: 0.0951, h: 0.0641 },
]

type FuelPopupState = 'emptyIcon' | 'emptyOpen' | 'arrived' | 'received' | 'complete'

type FuelPanelUi = {
  container: Phaser.GameObjects.Container
  bounds: Phaser.Geom.Rectangle
  uiScale: number
  card: Phaser.GameObjects.Graphics
  button: Phaser.GameObjects.Zone
  buttonBg: Phaser.GameObjects.Graphics
  buttonText: Phaser.GameObjects.Text
  starIcon: Phaser.GameObjects.Image
  inboxIcon: Phaser.GameObjects.Graphics
  messageBox: Phaser.GameObjects.Graphics
  progressTrack: Phaser.GameObjects.Rectangle
  progressFill: Phaser.GameObjects.Rectangle
  titleText: Phaser.GameObjects.Text
  subText: Phaser.GameObjects.Text
  messageTitleText: Phaser.GameObjects.Text
  messageBodyText: Phaser.GameObjects.Text
  rewardText: Phaser.GameObjects.Text
  starStart: Phaser.Math.Vector2
  shipTarget: Phaser.Math.Vector2
}

type FerrySelectSceneData = {
  spawn?: RatioPoint
}

function isFerryCloudyWeather(condition: WeatherCondition) {
  return (
    condition === 'CLOUDY' ||
    condition === 'PARTLY_CLOUDY' ||
    condition === 'RAIN' ||
    condition === 'HEAVY_RAIN' ||
    condition === 'SNOW' ||
    condition === 'FOG' ||
    condition === 'THUNDER'
  )
}

function drawFuelPanelSurface(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  ui: number,
) {
  const radius = 12 * ui
  graphics.clear()
  graphics.fillStyle(FERRY_FUEL_COLORS.shadow, 0.12)
  graphics.fillRoundedRect(4 * ui, 6 * ui, width, height, radius)
  graphics.fillStyle(FERRY_FUEL_COLORS.panel, 0.99)
  graphics.fillRoundedRect(0, 0, width, height, radius)
  graphics.fillStyle(FERRY_FUEL_COLORS.panelBottom, 0.34)
  graphics.fillRoundedRect(6 * ui, height * 0.56, width - 12 * ui, height * 0.38, radius - 3 * ui)
  graphics.lineStyle(1.5 * ui, FERRY_FUEL_COLORS.innerBorder, 0.62)
  graphics.strokeRoundedRect(4 * ui, 4 * ui, width - 8 * ui, height - 8 * ui, radius - 3 * ui)
  graphics.lineStyle(2.2 * ui, FERRY_FUEL_COLORS.panelBorder, 0.95)
  graphics.strokeRoundedRect(0, 0, width, height, radius)
}

function drawFuelMessageBox(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  ui: number,
) {
  const radius = 8 * ui
  graphics.clear()
  graphics.fillStyle(FERRY_FUEL_COLORS.message, 0.96)
  graphics.fillRoundedRect(x, y, width, height, radius)
  graphics.lineStyle(1.2 * ui, FERRY_FUEL_COLORS.messageBorder, 0.92)
  graphics.strokeRoundedRect(x, y, width, height, radius)
}

function drawFuelButton(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  width: number,
  height: number,
  ui: number,
) {
  const radius = 8 * ui
  const x = cx - width / 2
  const y = cy - height / 2
  graphics.clear()
  graphics.fillStyle(FERRY_FUEL_COLORS.primary, 1)
  graphics.fillRoundedRect(x, y, width, height, radius)
  graphics.fillStyle(0xffffff, 0.12)
  graphics.fillRoundedRect(x + 3 * ui, y + 3 * ui, width - 6 * ui, height * 0.34, radius - 2 * ui)
  graphics.lineStyle(1.5 * ui, FERRY_FUEL_COLORS.primaryDark, 0.92)
  graphics.strokeRoundedRect(x, y, width, height, radius)
}

function drawFuelInboxIcon(graphics: Phaser.GameObjects.Graphics, size: number, hasStar: boolean) {
  const width = size * 0.76
  const height = size * 0.5
  const x = -width / 2
  const y = -height / 2 + size * 0.06
  const flapY = y + height * 0.5
  const strokeWidth = Math.max(2.5, size * 0.07)

  graphics.clear()
  graphics.fillStyle(FERRY_FUEL_COLORS.message, 0.98)
  graphics.fillRoundedRect(x, y, width, height, size * 0.1)
  graphics.lineStyle(strokeWidth, FERRY_FUEL_COLORS.panelBorder, 0.95)
  graphics.strokeRoundedRect(x, y, width, height, size * 0.1)
  graphics.lineStyle(strokeWidth, FERRY_FUEL_COLORS.accentDark, 0.9)
  graphics.lineBetween(x + 3, y + 4, 0, flapY)
  graphics.lineBetween(width / 2 - 3, y + 4, 0, flapY)
  graphics.lineBetween(x + 4, y + height - 4, -width * 0.14, flapY + height * 0.08)
  graphics.lineBetween(width / 2 - 4, y + height - 4, width * 0.14, flapY + height * 0.08)

  if (hasStar) {
    graphics.fillStyle(FERRY_FUEL_COLORS.accent, 1)
    graphics.fillCircle(width * 0.34, y + 1, size * 0.13)
  }
}

function normalizeFuelMessage(message: string) {
  const text = message.trim().replace(/\s+/g, ' ') || DEFAULT_GUARDIAN_MESSAGE
  return text.length > 36 ? `${text.slice(0, 35)}...` : text
}

export class FerrySelectScene extends Phaser.Scene {
  /** 룸 ID — 같은 테마 select 에 들어온 환자끼리만 보이도록 (S14P31E103-794). */
  private static readonly REALTIME_ROOM_ID = 'ferry.select'

  private player!: PlayerSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private villageRealtime: VillageRealtimeIntegration | null = null
  private emojiPalette: AttachedEmojiPalette | null = null
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private playerWasInExitPortal = true
  private isTransitioning = false
  private obstacles!: Phaser.Physics.Arcade.StaticGroup
  private obstacleInstances: ObstacleInstance[] = []
  private obstacleEditorStart?: Phaser.Math.Vector2
  private obstacleEditorDraft?: Phaser.GameObjects.Rectangle
  private currentFuelPercent = INITIAL_FUEL_PERCENT
  private fuelPanel?: FuelPanelUi
  private isStarFlying = false
  private isFuelRequestPending = false
  private pendingFuelEvents: FuelInboxEvent[] = []
  private lastReceivedAmount = 0
  private lastReceivedMessage = ''
  private fuelPopupState: FuelPopupState = 'emptyIcon'

  constructor() {
    super({ key: 'FerrySelectScene' })
  }

  preload() {
    this.load.image(FERRY_BACKGROUND_KEY, assetPath('images/themes/ferry/background/ferry.png'))
    this.load.image(
      FERRY_CLOUDY_BACKGROUND_KEY,
      assetPath('images/themes/ferry/background/cloudyferry.png'),
    )
    this.load.image(FERRY_FRAME_KEY, assetPath('images/themes/ferry/ui/ferryframe.png'))
    this.load.image(STAR_FRAME_KEY, assetPath('images/themes/ferry/ui/starframe.png'))
    loadPlayerSpritesheets(this)
  }

  create(data: FerrySelectSceneData = {}) {
    playSceneBgm(this)
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.target = null
    this.playerWasInExitPortal = true
    this.fuelPanel = undefined
    this.isStarFlying = false
    this.isFuelRequestPending = false
    this.pendingFuelEvents = []
    this.lastReceivedAmount = 0
    this.lastReceivedMessage = ''
    this.fuelPopupState = 'emptyIcon'
    this.obstacleInstances = []
    this.obstacleEditorStart = undefined
    this.obstacleEditorDraft?.destroy()
    this.obstacleEditorDraft = undefined

    const background = addCoverBackground(this, FERRY_BACKGROUND_KEY)
    void this.applyWeatherBackground(background)
    this.physics.world.setBounds(0, 0, vw, vh)
    this.obstacles = this.physics.add.staticGroup()
    ROOM_OBSTACLES.forEach(rect => this.addObstacleRect(rect, vw, vh))
    ensurePlayerWalkAnimations(this)

    const spawn = data.spawn ?? FERRY_ROOM_SPAWN
    this.player = createPlayer(this, vw * spawn.xRatio, vh * spawn.yRatio)
    this.physics.add.collider(this.player, this.obstacles)
    this.exitPortal = createRatioRectangle(vw, vh, FERRY_EXIT_PORTAL)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.on('pointerdown', this.handlePointerDown)
    this.input.on('pointermove', this.handleObstacleEditorPointerMove)
    this.input.on('pointerup', this.handleObstacleEditorPointerUp)
    this.input.keyboard!.on('keydown-E', this.exportObstacleRects)
    this.input.keyboard!.on('keydown-R', this.clearEditedObstacleRects)
    this.input.mouse?.disableContextMenu()

    this.villageRealtime = attachVillageRealtime({
      scene: this,
      worldWidth: vw,
      worldHeight: vh,
      roomId: FerrySelectScene.REALTIME_ROOM_ID,
    })
    this.emojiPalette = attachEmojiPalette(this, {
      realtime: this.villageRealtime,
      getPlayer: () => this.player,
      isOverlayOpen: () => this.isTransitioning,
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handlePointerDown)
      this.input.off('pointermove', this.handleObstacleEditorPointerMove)
      this.input.off('pointerup', this.handleObstacleEditorPointerUp)
      this.input.keyboard?.off('keydown-E', this.exportObstacleRects)
      this.input.keyboard?.off('keydown-R', this.clearEditedObstacleRects)
      this.fuelPanel = undefined
      this.emojiPalette?.destroy()
      this.emojiPalette = null
      this.villageRealtime?.destroy()
      this.villageRealtime = null
    })

    this.createFuelPanel(vw, vh)
    void this.loadFuelState()

    this.cameras.main.fadeIn(250, 0, 0, 0)
  }

  private async applyWeatherBackground(background: Phaser.GameObjects.Image) {
    const weather = await getGameWeather()

    if (!this.scene.isActive() || !isFerryCloudyWeather(weather.condition)) {
      return
    }

    const displayWidth = background.displayWidth
    const displayHeight = background.displayHeight
    background.setTexture(FERRY_CLOUDY_BACKGROUND_KEY)
    background.setDisplaySize(displayWidth, displayHeight)
  }

  update() {
    const movement = updatePlayerMovement({
      player: this.player,
      cursors: this.cursors,
      target: this.target,
      lastDirection: this.lastDirection,
      speed: getPlayerMoveSpeed(),
      blocked: this.isTransitioning,
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    this.villageRealtime?.publishLocal(this.player, this.lastDirection, movement.moving)
    this.emojiPalette?.update()

    const exitState = getRectangleEntryState(
      this.exitPortal,
      this.player.x,
      this.player.y,
      this.playerWasInExitPortal,
    )
    if (!this.isTransitioning && exitState.didEnter) {
      this.returnToVillage()
    }
    this.playerWasInExitPortal = exitState.isInside
  }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (this.emojiPalette?.consumePointerDown(pointer)) {
      return
    }

    if (this.handleObstacleEditorPointerDown(pointer)) {
      return
    }
    if (this.isTransitioning) return
    if (this.fuelPanel?.container.visible && this.fuelPanel.bounds.contains(pointer.x, pointer.y)) {
      return
    }

    this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
    createClickTargetMarker(this, pointer.x, pointer.y)
  }

  private addObstacleRect(rect: ObstacleRect, vw: number, vh: number) {
    const x = Phaser.Math.Clamp(rect.x, 0, 1)
    const y = Phaser.Math.Clamp(rect.y, 0, 1)
    const w = Phaser.Math.Clamp(rect.w, 0, 1 - x)
    const h = Phaser.Math.Clamp(rect.h, 0, 1 - y)
    const box = this.add
      .rectangle(
        (x + w / 2) * vw,
        (y + h / 2) * vh,
        w * vw,
        h * vh,
        0xff0000,
        DEBUG_OBSTACLES ? 0.22 : 0,
      )
      .setDepth(1)

    if (DEBUG_OBSTACLES) {
      box.setStrokeStyle(2, 0xff3333, 0.85)
    }

    this.physics.add.existing(box, true)
    this.obstacles.add(box)
    this.obstacleInstances.push({ rect: { x, y, w, h }, object: box })

    return box
  }

  private handleObstacleEditorPointerDown(pointer: Phaser.Input.Pointer) {
    if (!OBSTACLE_EDITOR_ENABLED || !this.obstacles) {
      return false
    }

    const event = pointer.event as MouseEvent | PointerEvent | undefined
    const isShiftDrag = Boolean(event?.shiftKey)
    const isRightClick = pointer.rightButtonDown() || pointer.button === 2

    if (isRightClick) {
      this.removeObstacleAt(pointer.x, pointer.y)
      return true
    }

    if (!isShiftDrag) {
      return false
    }

    this.obstacleEditorStart = new Phaser.Math.Vector2(pointer.x, pointer.y)
    this.obstacleEditorDraft?.destroy()
    this.obstacleEditorDraft = this.add
      .rectangle(pointer.x, pointer.y, 1, 1, 0x00aaff, 0.26)
      .setDepth(30)
      .setStrokeStyle(2, 0x0077ff, 0.95)

    return true
  }

  private readonly handleObstacleEditorPointerMove = (pointer: Phaser.Input.Pointer) => {
    if (!this.obstacleEditorStart || !this.obstacleEditorDraft) {
      return
    }

    const bounds = this.getObstacleDragBounds(this.obstacleEditorStart, pointer.x, pointer.y)
    this.obstacleEditorDraft.setPosition(bounds.centerX, bounds.centerY)
    this.obstacleEditorDraft.setSize(bounds.width, bounds.height)
    this.obstacleEditorDraft.setDisplaySize(bounds.width, bounds.height)
  }

  private readonly handleObstacleEditorPointerUp = (pointer: Phaser.Input.Pointer) => {
    if (!this.obstacleEditorStart || !this.obstacleEditorDraft) {
      return
    }

    const bounds = this.getObstacleDragBounds(this.obstacleEditorStart, pointer.x, pointer.y)
    this.obstacleEditorDraft.destroy()
    this.obstacleEditorDraft = undefined
    this.obstacleEditorStart = undefined

    const { width: vw, height: vh } = this.scale
    const rect = {
      x: bounds.x / vw,
      y: bounds.y / vh,
      w: bounds.width / vw,
      h: bounds.height / vh,
    }

    if (rect.w < OBSTACLE_EDITOR_MIN_SIZE || rect.h < OBSTACLE_EDITOR_MIN_SIZE) {
      return
    }

    this.addObstacleRect(rect, vw, vh)
  }

  private getObstacleDragBounds(start: Phaser.Math.Vector2, currentX: number, currentY: number) {
    const { width: vw, height: vh } = this.scale
    const x = Phaser.Math.Clamp(Math.min(start.x, currentX), 0, vw)
    const y = Phaser.Math.Clamp(Math.min(start.y, currentY), 0, vh)
    const right = Phaser.Math.Clamp(Math.max(start.x, currentX), 0, vw)
    const bottom = Phaser.Math.Clamp(Math.max(start.y, currentY), 0, vh)
    const width = Math.max(1, right - x)
    const height = Math.max(1, bottom - y)

    return new Phaser.Geom.Rectangle(x, y, width, height)
  }

  private removeObstacleAt(x: number, y: number) {
    for (let index = this.obstacleInstances.length - 1; index >= 0; index -= 1) {
      const instance = this.obstacleInstances[index]
      if (!instance.object.getBounds().contains(x, y)) {
        continue
      }

      this.obstacles.remove(instance.object, true, true)
      this.obstacleInstances.splice(index, 1)
      return
    }
  }

  private readonly exportObstacleRects = () => {
    if (!OBSTACLE_EDITOR_ENABLED) {
      return
    }

    const lines = this.obstacleInstances.map(({ rect }) => {
      const x = Number(rect.x.toFixed(4))
      const y = Number(rect.y.toFixed(4))
      const w = Number(rect.w.toFixed(4))
      const h = Number(rect.h.toFixed(4))
      return `  { x: ${x}, y: ${y}, w: ${w}, h: ${h} },`
    })
    const output = `const ROOM_OBSTACLES: ObstacleRect[] = [\n${lines.join('\n')}\n]`

    console.info('[FerrySelectScene] Exported obstacle rectangles:\n' + output)
    void navigator.clipboard?.writeText(output).catch(() => undefined)
  }

  private readonly clearEditedObstacleRects = () => {
    if (!OBSTACLE_EDITOR_ENABLED) {
      return
    }

    this.obstacleInstances.forEach(({ object }) => {
      this.obstacles.remove(object, true, true)
    })
    this.obstacleInstances = []
    this.obstacleEditorDraft?.destroy()
    this.obstacleEditorDraft = undefined
    this.obstacleEditorStart = undefined
  }

  private returnToVillage() {
    if (this.isTransitioning) return

    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)

    fadeToScene(this, 'VillageScene', {
      duration: 250,
      data: {
        spawn: FERRY_RETURN_SPAWN,
        portalCooldownMs: 250,
      },
    })
  }

  private createFuelPanel(vw: number, vh: number) {
    const viewportPanelLimit = Math.max(280, vw - 32)
    const maxPanelWidth = Math.min(COMPACT_PANEL.maxWidth, viewportPanelLimit)
    const panelWidth = Phaser.Math.Clamp(maxPanelWidth, 280, COMPACT_PANEL.maxWidth)
    const panelHeight = panelWidth * (COMPACT_PANEL.designHeight / COMPACT_PANEL.designWidth)
    const panelX = COMPACT_PANEL.marginX
    const panelY = vh - panelHeight - COMPACT_PANEL.marginY
    const scaleY = panelWidth / COMPACT_PANEL.designWidth

    const panel = this.add.container(panelX, panelY).setDepth(FUEL_PANEL_DEPTH)
    const card = this.add.graphics()
    const titleText = this.add
      .text(96 * scaleY, 24 * scaleY, '', {
        fontFamily: FERRY_UI_FONT_FAMILY,
        fontSize: `${Math.round(24 * scaleY)}px`,
        fontStyle: '800',
        color: FERRY_FUEL_COLORS.title,
      })
      .setOrigin(0, 0)
    const subText = this.add
      .text(96 * scaleY, 60 * scaleY, '', {
        fontFamily: FERRY_UI_FONT_FAMILY,
        fontSize: `${Math.round(15 * scaleY)}px`,
        fontStyle: '700',
        color: FERRY_FUEL_COLORS.muted,
      })
      .setOrigin(0, 0)

    const starIcon = this.add
      .image(58 * scaleY, 50 * scaleY, STAR_FRAME_KEY)
      .setOrigin(0.5)
      .setDisplaySize(50 * scaleY, 50 * scaleY)
    const inboxIcon = this.add.graphics()
    const messageBox = this.add.graphics()
    const messageTitleText = this.add
      .text(180 * scaleY, 100 * scaleY, '', {
        fontFamily: FERRY_UI_FONT_FAMILY,
        fontSize: `${Math.round(13 * scaleY)}px`,
        fontStyle: '800',
        color: FERRY_FUEL_COLORS.title,
        align: 'center',
        wordWrap: { width: 300 * scaleY },
      })
      .setOrigin(0.5, 0)
    const messageBodyText = this.add
      .text(180 * scaleY, 105 * scaleY, '', {
        fontFamily: FERRY_UI_FONT_FAMILY,
        fontSize: `${Math.round(17 * scaleY)}px`,
        fontStyle: '700',
        color: FERRY_FUEL_COLORS.text,
        align: 'center',
        wordWrap: { width: 300 * scaleY },
        lineSpacing: 5,
      })
      .setOrigin(0.5, 0)

    const progressTrack = this.add
      .rectangle(
        110 * scaleY,
        126 * scaleY,
        220 * scaleY,
        12 * scaleY,
        FERRY_FUEL_COLORS.progressTrack,
        1,
      )
      .setOrigin(0, 0.5)
    const progressFill = this.add
      .rectangle(
        110 * scaleY,
        126 * scaleY,
        220 * scaleY,
        12 * scaleY,
        FERRY_FUEL_COLORS.progressFill,
        1,
      )
      .setOrigin(0, 0.5)
    const rewardText = this.add
      .text(180 * scaleY, 152 * scaleY, '', {
        fontFamily: FERRY_UI_FONT_FAMILY,
        fontSize: `${Math.round(16.5 * scaleY)}px`,
        fontStyle: '800',
        color: FERRY_FUEL_COLORS.accentText,
        align: 'center',
        wordWrap: { width: 312 * scaleY },
      })
      .setOrigin(0.5, 0)
    const button = this.add
      .zone(180 * scaleY, 194 * scaleY, 312 * scaleY, 40 * scaleY)
      .setInteractive({ useHandCursor: true })
    const buttonBg = this.add.graphics()
    const buttonText = this.add
      .text(180 * scaleY, 194 * scaleY, '', {
        fontFamily: FERRY_UI_FONT_FAMILY,
        fontSize: `${Math.round(18 * scaleY)}px`,
        fontStyle: '800',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)

    button.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        void this.handleFuelButton()
      },
    )

    panel.add([
      card,
      titleText,
      subText,
      messageBox,
      inboxIcon,
      starIcon,
      messageTitleText,
      messageBodyText,
      progressTrack,
      progressFill,
      rewardText,
      buttonBg,
      button,
      buttonText,
    ])

    this.fuelPanel = {
      container: panel,
      bounds: new Phaser.Geom.Rectangle(panelX, panelY, panelWidth, panelHeight),
      uiScale: scaleY,
      card,
      button,
      buttonBg,
      buttonText,
      starIcon,
      inboxIcon,
      messageBox,
      progressTrack,
      progressFill,
      titleText,
      subText,
      messageTitleText,
      messageBodyText,
      rewardText,
      starStart: new Phaser.Math.Vector2(panelX + 58 * scaleY, panelY + 50 * scaleY),
      shipTarget: new Phaser.Math.Vector2(vw * SHIP_TARGET.xRatio, vh * SHIP_TARGET.yRatio),
    }
    this.refreshFuelUi()
  }

  private async loadFuelState() {
    if (this.isFuelRequestPending) return

    this.isFuelRequestPending = true
    this.refreshFuelUi()

    try {
      const [statusResponse, inboxResponse] = await Promise.all([getFuelStatus(), getFuelInbox()])
      this.currentFuelPercent = Phaser.Math.Clamp(
        statusResponse.data?.percentage ?? 0,
        0,
        FUEL_GOAL_PERCENT,
      )
      this.pendingFuelEvents = inboxResponse.data ?? []
      const latestEvent = this.pendingFuelEvents.at(-1)
      this.lastReceivedAmount = this.pendingFuelEvents.reduce((sum, event) => sum + event.amount, 0)
      this.lastReceivedMessage = latestEvent?.message ?? DEFAULT_GUARDIAN_MESSAGE
      this.fuelPopupState = this.pendingFuelEvents.length > 0 ? 'arrived' : 'emptyIcon'
    } catch (error) {
      console.warn('Failed to load ferry fuel state.', error)
      this.pendingFuelEvents = []
      this.lastReceivedAmount = 0
      this.lastReceivedMessage = ''
    } finally {
      this.isFuelRequestPending = false
      this.refreshFuelUi()
    }
  }

  private async receiveFuel() {
    if (this.isStarFlying || this.isFuelRequestPending) return

    if (this.pendingFuelEvents.length === 0) {
      void this.loadFuelState()
      return
    }

    this.fuelPopupState = 'received'
    const eventIds = this.pendingFuelEvents.map(event => event.id)
    this.isFuelRequestPending = true
    this.refreshFuelUi()

    try {
      await consumeFuel({ ids: eventIds })
      const [statusResponse, inboxResponse] = await Promise.all([getFuelStatus(), getFuelInbox()])
      this.currentFuelPercent = Phaser.Math.Clamp(
        statusResponse.data?.percentage ?? this.currentFuelPercent,
        0,
        FUEL_GOAL_PERCENT,
      )
      this.pendingFuelEvents = inboxResponse.data ?? []
      const latestEvent = this.pendingFuelEvents.at(-1)
      this.lastReceivedAmount = this.pendingFuelEvents.reduce((sum, event) => sum + event.amount, 0)
      this.lastReceivedMessage = latestEvent?.message ?? DEFAULT_GUARDIAN_MESSAGE
      this.fuelPopupState = this.currentFuelPercent >= FUEL_GOAL_PERCENT ? 'complete' : 'received'
      this.refreshFuelUi()
      this.playStarFlyAnimation()
    } catch (error) {
      console.warn('Failed to receive ferry fuel.', error)
    } finally {
      this.isFuelRequestPending = false
      this.refreshFuelUi()
    }
  }

  private async handleFuelButton() {
    if (this.fuelPopupState === 'received') {
      this.fuelPopupState = 'emptyIcon'
      this.refreshFuelUi()
      return
    }

    if (this.fuelPopupState === 'emptyIcon') {
      await this.loadFuelState()
      if (this.pendingFuelEvents.length === 0) {
        this.fuelPopupState = 'emptyOpen'
        this.refreshFuelUi()
      }
      return
    }

    if (this.fuelPopupState === 'emptyOpen') {
      this.fuelPopupState = 'emptyIcon'
      this.refreshFuelUi()
      return
    }

    if (this.fuelPopupState === 'complete') {
      this.onFuelCompleted()
      return
    }

    await this.receiveFuel()
  }

  private refreshFuelUi() {
    if (!this.fuelPanel) return

    const panel = this.fuelPanel
    const ui = panel.uiScale
    const popupWidth = COMPACT_PANEL.designWidth * ui
    const popupHeight = COMPACT_PANEL.designHeight * ui
    const iconSize = COMPACT_PANEL.iconSize * ui
    const iconX = this.scale.width - iconSize - COMPACT_PANEL.iconMarginX
    const iconY = COMPACT_PANEL.iconMarginY
    const popupX = Math.max(16, this.scale.width - popupWidth - COMPACT_PANEL.iconMarginX)
    const popupY = Phaser.Math.Clamp(iconY, 16, this.scale.height - popupHeight - 16)
    const buttonY = 194 * ui

    const setPanelFrame = (width: number, height: number) => {
      const scaledWidth = width * ui
      const scaledHeight = height * ui
      drawFuelPanelSurface(panel.card, scaledWidth, scaledHeight, ui)
      panel.bounds.setTo(panel.container.x, panel.container.y, scaledWidth, scaledHeight)
    }

    const showPopupFrame = () => {
      panel.container.setPosition(popupX, popupY)
      setPanelFrame(COMPACT_PANEL.designWidth, COMPACT_PANEL.designHeight)
      panel.card.setVisible(true)
      panel.inboxIcon.setVisible(false).clear()
      panel.starIcon
        .setVisible(true)
        .setPosition(58 * ui, 50 * ui)
        .setDisplaySize(50 * ui, 50 * ui)
      panel.starStart.set(popupX + 58 * ui, popupY + 50 * ui)
      panel.titleText
        .setVisible(true)
        .setOrigin(0, 0)
        .setPosition(96 * ui, 24 * ui)
      panel.subText
        .setVisible(true)
        .setOrigin(0, 0)
        .setPosition(96 * ui, 60 * ui)
      panel.messageBox.setVisible(false).clear()
      panel.messageTitleText.setVisible(false).setText('')
      panel.messageBodyText
        .setVisible(true)
        .setOrigin(0, 0)
        .setPosition(28 * ui, 96 * ui)
        .setAlign('left')
        .setWordWrapWidth(304 * ui, true)
      panel.rewardText
        .setVisible(true)
        .setOrigin(0, 0)
        .setPosition(28 * ui, 152 * ui)
        .setAlign('left')
      panel.progressTrack
        .setVisible(false)
        .setPosition(110 * ui, 126 * ui)
        .setSize(220 * ui, 12 * ui)
        .setFillStyle(FERRY_FUEL_COLORS.progressTrack, 1)
      panel.progressFill
        .setVisible(false)
        .setPosition(110 * ui, 126 * ui)
        .setSize(220 * ui, 12 * ui)
        .setFillStyle(FERRY_FUEL_COLORS.progressFill, 1)
      drawFuelButton(panel.buttonBg, 180 * ui, buttonY, 312 * ui, 40 * ui, ui)
      panel.buttonBg.setVisible(true)
      panel.button
        .setVisible(true)
        .setPosition(180 * ui, buttonY)
        .setSize(312 * ui, 40 * ui)
      panel.buttonText.setVisible(true).setPosition(180 * ui, buttonY)
      panel.button.setInteractive({ useHandCursor: true })
    }

    const showInboxIcon = () => {
      panel.container.setPosition(iconX, iconY)
      setPanelFrame(COMPACT_PANEL.iconSize, COMPACT_PANEL.iconSize)
      panel.card.setVisible(true)
      panel.inboxIcon.setVisible(true).setPosition(38 * ui, 38 * ui)
      drawFuelInboxIcon(panel.inboxIcon, 56 * ui, false)
      panel.starIcon
        .setVisible(true)
        .setPosition(20 * ui, 27 * ui)
        .setDisplaySize(24 * ui, 24 * ui)
      panel.titleText.setVisible(false).setText('')
      panel.subText.setVisible(false).setText('')
      panel.messageBox.setVisible(false).clear()
      panel.messageTitleText.setVisible(false)
      panel.messageBodyText.setVisible(false)
      panel.rewardText.setVisible(false)
      panel.progressTrack.setVisible(false)
      panel.progressFill.setVisible(false)
      panel.buttonBg.setVisible(false).clear()
      panel.buttonText.setVisible(false)
      panel.button
        .setVisible(true)
        .setPosition(38 * ui, 38 * ui)
        .setSize(COMPACT_PANEL.iconSize * ui, COMPACT_PANEL.iconSize * ui)
      panel.button.setInteractive({ useHandCursor: true })
    }

    this.currentFuelPercent = Phaser.Math.Clamp(this.currentFuelPercent, 0, FUEL_GOAL_PERCENT)
    const remainPercent = FUEL_GOAL_PERCENT - this.currentFuelPercent
    const hasPendingFuel = this.pendingFuelEvents.length > 0
    const progressRatio = Phaser.Math.Clamp(this.currentFuelPercent / FUEL_GOAL_PERCENT, 0, 1)
    panel.progressFill.setScale(progressRatio, 1)

    if (this.isFuelRequestPending) {
      panel.container.setVisible(false)
      panel.button.disableInteractive()
      return
    }

    panel.container.setVisible(true)

    if (this.fuelPopupState === 'emptyIcon') {
      showInboxIcon()
      return
    }

    if (this.fuelPopupState === 'emptyOpen') {
      showPopupFrame()
      panel.starIcon
        .setVisible(true)
        .setPosition(36 * ui, 38 * ui)
        .setDisplaySize(24 * ui, 24 * ui)
      panel.inboxIcon.setVisible(true).setPosition(56 * ui, 49 * ui)
      drawFuelInboxIcon(panel.inboxIcon, 58 * ui, false)
      panel.titleText
        .setOrigin(0, 0.5)
        .setPosition(96 * ui, 52 * ui)
        .setText('별빛 우편함')
      panel.subText.setVisible(false).setText('')
      panel.messageBox.setVisible(true)
      drawFuelMessageBox(panel.messageBox, 24 * ui, 86 * ui, 312 * ui, 72 * ui, ui)
      panel.messageBodyText
        .setOrigin(0.5, 0.5)
        .setPosition(180 * ui, 122 * ui)
        .setAlign('center')
        .setWordWrapWidth(290 * ui, true)
      panel.messageBodyText.setText('아직 받은 별빛이 없어요')
      panel.rewardText.setVisible(false).setText('')
      panel.buttonText.setText('확인')
      return
    }

    if (this.fuelPopupState === 'arrived' && hasPendingFuel) {
      showPopupFrame()
      panel.titleText.setText('별빛이 도착했어요')
      panel.subText.setText('응원 메시지를 확인하고 연료를 받아요')
      panel.messageBox.setVisible(true)
      drawFuelMessageBox(panel.messageBox, 26 * ui, 88 * ui, 308 * ui, 64 * ui, ui)
      panel.messageBodyText
        .setOrigin(0.5, 0)
        .setPosition(180 * ui, 98 * ui)
        .setAlign('center')
        .setWordWrapWidth(270 * ui, true)
      panel.messageBodyText.setText(normalizeFuelMessage(this.lastReceivedMessage))
      panel.rewardText
        .setOrigin(0.5, 0)
        .setPosition(180 * ui, 156 * ui)
        .setAlign('center')
      panel.rewardText.setText(`+${this.lastReceivedAmount}% 연료 충전`)
      panel.buttonText.setText('별빛 받기')
      return
    }

    if (this.fuelPopupState === 'received') {
      showPopupFrame()
      panel.titleText.setText('별빛 연료 충전 완료')
      panel.subText.setText('배에 별빛이 스며들었어요')
      panel.messageBox.setVisible(false).clear()
      panel.starIcon.setPosition(58 * ui, 112 * ui).setDisplaySize(54 * ui, 54 * ui)
      panel.messageBodyText
        .setOrigin(0, 0)
        .setPosition(110 * ui, 92 * ui)
        .setAlign('left')
        .setWordWrapWidth(220 * ui, true)
      panel.messageBodyText.setText(`현재 별빛 연료 ${this.currentFuelPercent}%`)
      panel.progressTrack.setVisible(true)
      panel.progressFill.setVisible(true)
      panel.rewardText
        .setOrigin(0, 0)
        .setPosition(110 * ui, 150 * ui)
        .setAlign('left')
      panel.rewardText.setText(`출발까지 ${remainPercent}% 남았어요`)
      panel.buttonText.setText('확인')
      return
    }

    if (this.fuelPopupState === 'complete') {
      showPopupFrame()
      panel.titleText.setText('별빛 연료가 가득해요')
      panel.subText.setText('이제 배를 출발시킬 수 있어요')
      panel.messageBox.setVisible(false).clear()
      panel.starIcon.setPosition(58 * ui, 112 * ui).setDisplaySize(56 * ui, 56 * ui)
      panel.messageBodyText
        .setOrigin(0, 0)
        .setPosition(110 * ui, 94 * ui)
        .setAlign('left')
        .setWordWrapWidth(220 * ui, true)
      panel.messageBodyText.setText('100% 달성!')
      panel.rewardText
        .setOrigin(0, 0)
        .setPosition(110 * ui, 148 * ui)
        .setAlign('left')
      panel.rewardText.setText('출발 준비 완료')
      panel.buttonText.setText('배 출발하기')
      return
    }

    this.fuelPopupState = 'emptyIcon'
    this.refreshFuelUi()
  }
  private playStarFlyAnimation() {
    if (!this.fuelPanel) return

    const star = this.add
      .image(this.fuelPanel.starStart.x, this.fuelPanel.starStart.y, STAR_FRAME_KEY)
      .setOrigin(0.5)
      .setDepth(FUEL_PANEL_DEPTH + 2)
    star.setDisplaySize(42, 42)

    this.isStarFlying = true
    const start = this.fuelPanel.starStart.clone()
    const end = this.fuelPanel.shipTarget.clone()
    this.tweens.add({
      targets: { t: 0 },
      t: 1,
      scale: 0.65,
      alpha: 0.25,
      duration: STAR_FLY_DURATION_MS,
      ease: 'Sine.easeInOut',
      onUpdate: tween => {
        const t = tween.getValue() ?? 1
        const x = Phaser.Math.Linear(start.x, end.x, t)
        const y =
          Phaser.Math.Linear(start.y, end.y, t) - Math.sin(t * Math.PI) * STAR_FLY_ARC_HEIGHT
        star.setPosition(x, y)
        star.setScale(Phaser.Math.Linear(1, 0.65, t))
        star.setAngle(Phaser.Math.Linear(0, 180, t))
        star.setAlpha(Phaser.Math.Linear(1, 0.25, t))
      },
      onComplete: () => {
        star.destroy()
        this.isStarFlying = false
      },
    })
  }

  private onFuelCompleted() {
    console.info('별빛 연료 100% 완료. 배 출발 연출 실행 가능.')
  }
}
