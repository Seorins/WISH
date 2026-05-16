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
const COMPACT_PANEL = {
  designWidth: 320,
  designHeight: 188,
  maxWidth: 320,
  minWidth: 300,
  marginX: 28,
  marginY: 104,
  iconSize: 64,
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
  shadow: Phaser.GameObjects.Rectangle
  card: Phaser.GameObjects.Rectangle
  button: Phaser.GameObjects.Zone
  buttonBg: Phaser.GameObjects.Rectangle
  buttonText: Phaser.GameObjects.Text
  starIcon: Phaser.GameObjects.Image
  mailIconText: Phaser.GameObjects.Text
  messageBox: Phaser.GameObjects.Rectangle
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
    const maxPanelWidth = Math.min(COMPACT_PANEL.maxWidth, vw - 48)
    const panelWidth = Phaser.Math.Clamp(
      maxPanelWidth,
      COMPACT_PANEL.minWidth,
      COMPACT_PANEL.maxWidth,
    )
    const panelHeight = panelWidth * (COMPACT_PANEL.designHeight / COMPACT_PANEL.designWidth)
    const panelX = COMPACT_PANEL.marginX
    const panelY = vh - panelHeight - COMPACT_PANEL.marginY
    const scaleY = panelWidth / COMPACT_PANEL.designWidth

    const panel = this.add.container(panelX, panelY).setDepth(FUEL_PANEL_DEPTH)
    const shadow = this.add
      .rectangle(5 * scaleY, 8 * scaleY, panelWidth, panelHeight, 0x000000, 0.12)
      .setOrigin(0, 0)
    const card = this.add
      .rectangle(0, 0, panelWidth, panelHeight, 0xffffff, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(2 * scaleY, 0xe6dcff, 1)
    const titleText = this.add
      .text(115 * scaleY, 28 * scaleY, '', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(20 * scaleY)}px`,
        fontStyle: '700',
        color: '#372d28',
      })
      .setOrigin(0, 0)
    const subText = this.add
      .text(115 * scaleY, 56 * scaleY, '', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(12.5 * scaleY)}px`,
        color: '#766960',
      })
      .setOrigin(0, 0)

    const starIcon = this.add
      .image(62 * scaleY, 72 * scaleY, STAR_FRAME_KEY)
      .setOrigin(0.5)
      .setDisplaySize(58 * scaleY, 58 * scaleY)
    const mailIconText = this.add
      .text(32 * scaleY, 32 * scaleY, '✉', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(30 * scaleY)}px`,
        fontStyle: '700',
        color: '#7657dd',
      })
      .setOrigin(0.5)

    const messageBox = this.add
      .rectangle(34 * scaleY, 92 * scaleY, 392 * scaleY, 50 * scaleY, 0xffffff, 0.7)
      .setOrigin(0, 0)
      .setStrokeStyle(2 * scaleY, 0xe8d2b2, 0.7)
    const messageTitleText = this.add
      .text(230 * scaleY, 100 * scaleY, '', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(12 * scaleY)}px`,
        fontStyle: '700',
        color: '#372d28',
        align: 'center',
        wordWrap: { width: 350 * scaleY },
      })
      .setOrigin(0.5, 0)
    const messageBodyText = this.add
      .text(230 * scaleY, 105 * scaleY, '', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(13.5 * scaleY)}px`,
        color: '#4b413a',
        align: 'center',
        wordWrap: { width: 350 * scaleY },
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0)

    const progressTrack = this.add
      .rectangle(145 * scaleY, 113 * scaleY, 240 * scaleY, 12 * scaleY, 0xe7e2f6, 1)
      .setOrigin(0, 0.5)
    const progressFill = this.add
      .rectangle(145 * scaleY, 113 * scaleY, 240 * scaleY, 12 * scaleY, 0x7650df, 1)
      .setOrigin(0, 0.5)
    const rewardText = this.add
      .text(230 * scaleY, 151 * scaleY, '', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(15.5 * scaleY)}px`,
        fontStyle: '700',
        color: '#7152de',
        align: 'center',
        wordWrap: { width: 390 * scaleY },
      })
      .setOrigin(0.5, 0)
    const button = this.add
      .zone(230 * scaleY, 192 * scaleY, 392 * scaleY, 40 * scaleY)
      .setInteractive({ useHandCursor: true })
    const buttonBg = this.add
      .rectangle(230 * scaleY, 192 * scaleY, 392 * scaleY, 40 * scaleY, 0x7657dd, 1)
      .setOrigin(0.5)
    const buttonText = this.add
      .text(230 * scaleY, 192 * scaleY, '', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(16.5 * scaleY)}px`,
        fontStyle: '700',
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
      shadow,
      card,
      titleText,
      subText,
      messageBox,
      starIcon,
      mailIconText,
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
      shadow,
      card,
      button,
      buttonBg,
      buttonText,
      starIcon,
      mailIconText,
      messageBox,
      progressTrack,
      progressFill,
      titleText,
      subText,
      messageTitleText,
      messageBodyText,
      rewardText,
      starStart: new Phaser.Math.Vector2(panelX + 62 * scaleY, panelY + 72 * scaleY),
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
    const popupY = Math.min(iconY + iconSize + 10, this.scale.height - popupHeight - 16)
    const buttonY = 162 * ui

    const setPanelSize = (width: number, height: number) => {
      const scaledWidth = width * ui
      const scaledHeight = height * ui
      panel.shadow.setSize(scaledWidth, scaledHeight)
      panel.card.setSize(scaledWidth, scaledHeight)
      panel.bounds.setTo(panel.container.x, panel.container.y, scaledWidth, scaledHeight)
    }

    const showPopupFrame = () => {
      panel.container.setPosition(popupX, popupY)
      setPanelSize(COMPACT_PANEL.designWidth, COMPACT_PANEL.designHeight)
      panel.shadow
        .setVisible(true)
        .setPosition(5 * ui, 7 * ui)
        .setFillStyle(0x1d1308, 0.14)
      panel.card
        .setVisible(true)
        .setFillStyle(0xfffbf4, 0.98)
        .setStrokeStyle(2 * ui, 0xe6cfaa, 1)
      panel.mailIconText.setVisible(false)
      panel.starIcon
        .setVisible(true)
        .setPosition(42 * ui, 46 * ui)
        .setDisplaySize(38 * ui, 38 * ui)
      panel.titleText
        .setVisible(true)
        .setOrigin(0, 0)
        .setPosition(76 * ui, 20 * ui)
      panel.subText
        .setVisible(true)
        .setOrigin(0, 0)
        .setPosition(76 * ui, 47 * ui)
      panel.messageBox
        .setVisible(false)
        .setPosition(24 * ui, 80 * ui)
        .setSize(272 * ui, 48 * ui)
        .setFillStyle(0xffffff, 0.68)
        .setStrokeStyle(1 * ui, 0xe7d3b4, 0.9)
      panel.messageTitleText.setVisible(false).setText('')
      panel.messageBodyText
        .setVisible(true)
        .setOrigin(0, 0)
        .setPosition(26 * ui, 84 * ui)
        .setAlign('left')
      panel.rewardText
        .setVisible(true)
        .setOrigin(0, 0)
        .setPosition(26 * ui, 129 * ui)
        .setAlign('left')
      panel.progressTrack
        .setVisible(false)
        .setPosition(92 * ui, 109 * ui)
        .setSize(198 * ui, 10 * ui)
      panel.progressFill
        .setVisible(false)
        .setPosition(92 * ui, 109 * ui)
        .setSize(198 * ui, 10 * ui)
      panel.buttonBg
        .setVisible(true)
        .setPosition(160 * ui, buttonY)
        .setSize(272 * ui, 34 * ui)
        .setFillStyle(0x7657dd, 1)
      panel.button
        .setVisible(true)
        .setPosition(160 * ui, buttonY)
        .setSize(272 * ui, 34 * ui)
      panel.buttonText.setVisible(true).setPosition(160 * ui, buttonY)
      panel.button.setInteractive({ useHandCursor: true })
    }

    const showMailIcon = () => {
      panel.container.setPosition(iconX, iconY)
      setPanelSize(COMPACT_PANEL.iconSize, COMPACT_PANEL.iconSize)
      panel.shadow
        .setVisible(true)
        .setPosition(4 * ui, 5 * ui)
        .setFillStyle(0x1d1308, 0.14)
      panel.card
        .setVisible(true)
        .setFillStyle(0xfffbf4, 0.98)
        .setStrokeStyle(2 * ui, 0xe6cfaa, 1)
      panel.starIcon.setVisible(false)
      panel.mailIconText.setVisible(true).setPosition(32 * ui, 32 * ui)
      panel.titleText.setVisible(false).setText('')
      panel.subText.setVisible(false).setText('')
      panel.messageBox.setVisible(false)
      panel.messageTitleText.setVisible(false)
      panel.messageBodyText.setVisible(false)
      panel.rewardText.setVisible(false)
      panel.progressTrack.setVisible(false)
      panel.progressFill.setVisible(false)
      panel.buttonBg.setVisible(false)
      panel.buttonText.setVisible(false)
      panel.button
        .setVisible(true)
        .setPosition(32 * ui, 32 * ui)
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
      showMailIcon()
      return
    }

    if (this.fuelPopupState === 'emptyOpen') {
      showPopupFrame()
      panel.starIcon.setVisible(false)
      panel.mailIconText.setVisible(true).setPosition(42 * ui, 46 * ui)
      panel.titleText.setText('별빛 우편함')
      panel.subText.setText('아직 도착한 별빛이 없어요')
      panel.messageBodyText.setText('보호자의 응원이 도착하면\n이곳에서 확인할 수 있어요')
      panel.rewardText.setVisible(false).setText('')
      panel.buttonText.setText('확인')
      return
    }

    if (this.fuelPopupState === 'arrived' && hasPendingFuel) {
      showPopupFrame()
      panel.titleText.setText('별빛 연료 도착')
      panel.subText.setText('보호자가 응원을 보냈어요')
      panel.messageBox.setVisible(true)
      panel.messageBodyText
        .setOrigin(0.5, 0)
        .setPosition(160 * ui, 91 * ui)
        .setAlign('center')
      panel.messageBodyText.setText(
        this.lastReceivedMessage || '오늘도 정말 잘했어,\n천천히 같이 가보자.',
      )
      panel.rewardText
        .setOrigin(0.5, 0)
        .setPosition(160 * ui, 131 * ui)
        .setAlign('center')
      panel.rewardText.setText(`+${this.lastReceivedAmount}% 별빛 연료`)
      panel.buttonText.setText('별빛 받기')
      return
    }

    if (this.fuelPopupState === 'received') {
      showPopupFrame()
      panel.titleText.setText('별빛을 받았어요')
      panel.subText.setText('배에 별빛 연료가 채워졌어요')
      panel.messageBox.setVisible(false)
      panel.messageBodyText
        .setOrigin(0, 0)
        .setPosition(92 * ui, 83 * ui)
        .setAlign('left')
      panel.messageBodyText.setText(`현재 별빛 연료 ${this.currentFuelPercent}%`)
      panel.progressTrack.setVisible(true)
      panel.progressFill.setVisible(true)
      panel.rewardText
        .setOrigin(0, 0)
        .setPosition(92 * ui, 123 * ui)
        .setAlign('left')
      panel.rewardText.setText(`출발까지 ${remainPercent}% 남았어요`)
      panel.buttonText.setText('확인')
      return
    }

    if (this.fuelPopupState === 'complete') {
      showPopupFrame()
      panel.titleText.setText('연료가 가득 찼어요')
      panel.subText.setText('배가 출발할 준비를 마쳤어요')
      panel.messageBox.setVisible(false)
      panel.starIcon.setPosition(54 * ui, 96 * ui).setDisplaySize(46 * ui, 46 * ui)
      panel.messageBodyText
        .setOrigin(0, 0)
        .setPosition(92 * ui, 82 * ui)
        .setAlign('left')
      panel.messageBodyText.setText('100% 달성!')
      panel.rewardText
        .setOrigin(0, 0)
        .setPosition(92 * ui, 122 * ui)
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
