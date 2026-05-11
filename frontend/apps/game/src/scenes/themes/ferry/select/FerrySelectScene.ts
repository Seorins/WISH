import Phaser from 'phaser'
import { assetPath } from '@/game/assets/assetPath'
import {
  createClickTargetMarker,
  createPlayer,
  ensurePlayerWalkAnimations,
  loadPlayerSpritesheet,
  type PlayerDirection,
  type PlayerSprite,
  type RatioPoint,
  updatePlayerMovement,
} from '@/game/entities/player'
import { getPlayerMoveSpeed } from '@/game/settings/gameSettings'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'
import { createRatioRectangle, getRectangleEntryState } from '@/game/world/portal'

const FERRY_BACKGROUND_KEY = 'ferry-background'
const FERRY_FRAME_KEY = 'ferry-frame'
const STAR_FRAME_KEY = 'ferry-star-frame'
const FERRY_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.78 }
const FERRY_EXIT_PORTAL = { xRatio: 0.43, yRatio: 0.86, widthRatio: 0.14, heightRatio: 0.12 }
const FERRY_RETURN_SPAWN = { xRatio: 0.475, yRatio: 0.755 }
const FUEL_GOAL_PERCENT = 100
const FUEL_PANEL_DEPTH = 20
const INITIAL_FUEL_PERCENT = 72
const SEND_FUEL_AMOUNT = 15
const STAR_FLY_DURATION_MS = 750
const STAR_FLY_ARC_HEIGHT = 80
const SHIP_TARGET = { xRatio: 0.54, yRatio: 0.56 }
const COMPACT_PANEL = {
  width: 850,
  height: 240,
  top: 80,
} as const

type FuelPanelUi = {
  bounds: Phaser.Geom.Rectangle
  button: Phaser.GameObjects.Zone
  buttonText: Phaser.GameObjects.Text
  percentText: Phaser.GameObjects.Text
  remainText: Phaser.GameObjects.Text
  messageTitleText: Phaser.GameObjects.Text
  messageBodyText: Phaser.GameObjects.Text
  starStart: Phaser.Math.Vector2
  shipTarget: Phaser.Math.Vector2
}

type FerrySelectSceneData = {
  spawn?: RatioPoint
}

export class FerrySelectScene extends Phaser.Scene {
  private player!: PlayerSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private playerWasInExitPortal = true
  private isTransitioning = false
  private currentFuelPercent = INITIAL_FUEL_PERCENT
  private fuelPanel?: FuelPanelUi
  private isStarFlying = false

  constructor() {
    super({ key: 'FerrySelectScene' })
  }

  preload() {
    this.load.image(FERRY_BACKGROUND_KEY, assetPath('images/themes/ferry/background/ferry.png'))
    this.load.image(FERRY_FRAME_KEY, assetPath('images/themes/ferry/ui/ferryframe.png'))
    this.load.image(STAR_FRAME_KEY, assetPath('images/themes/ferry/ui/starframe.png'))
    loadPlayerSpritesheet(this)
  }

  create(data: FerrySelectSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.target = null
    this.playerWasInExitPortal = true
    this.fuelPanel = undefined
    this.isStarFlying = false

    addCoverBackground(this, FERRY_BACKGROUND_KEY)
    this.physics.world.setBounds(0, 0, vw, vh)
    ensurePlayerWalkAnimations(this)

    const spawn = data.spawn ?? FERRY_ROOM_SPAWN
    this.player = createPlayer(this, vw * spawn.xRatio, vh * spawn.yRatio)
    this.exitPortal = createRatioRectangle(vw, vh, FERRY_EXIT_PORTAL)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.on('pointerdown', this.handlePointerDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handlePointerDown)
      this.fuelPanel = undefined
    })

    this.createFuelPanel(vw, vh)

    this.cameras.main.fadeIn(250, 0, 0, 0)
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
    if (this.isTransitioning) return
    if (this.fuelPanel?.bounds.contains(pointer.x, pointer.y)) return

    this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
    createClickTargetMarker(this, pointer.x, pointer.y)
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
    const maxPanelWidth = Math.min(COMPACT_PANEL.width, vw - 48)
    const panelWidth = Phaser.Math.Clamp(maxPanelWidth, 520, COMPACT_PANEL.width)
    const panelHeight = panelWidth * (COMPACT_PANEL.height / COMPACT_PANEL.width)
    const panelX = (vw - panelWidth) / 2
    const panelY = COMPACT_PANEL.top
    const scaleY = panelWidth / COMPACT_PANEL.width

    const panel = this.add.container(panelX, panelY).setDepth(FUEL_PANEL_DEPTH)
    const frame = this.add.image(0, 0, FERRY_FRAME_KEY).setOrigin(0, 0)
    frame.setScale(panelWidth / 2000, panelHeight / 688)

    const title = this.add.text(170 * scaleY, 42 * scaleY, '연료 모으기', {
      fontFamily: 'sans-serif',
      fontSize: `${Math.round(28 * scaleY)}px`,
      fontStyle: '700',
      color: '#4c351d',
    })
    const subtitle = this.add.text(170 * scaleY, 76 * scaleY, '보호자가 보내준 별빛 연료', {
      fontFamily: 'sans-serif',
      fontSize: `${Math.round(14 * scaleY)}px`,
      color: '#725b3b',
    })
    const percentText = this.add.text(170 * scaleY, 112 * scaleY, '', {
      fontFamily: 'sans-serif',
      fontSize: `${Math.round(36 * scaleY)}px`,
      fontStyle: '700',
      color: '#4a321b',
    })
    const remainText = this.add.text(292 * scaleY, 127 * scaleY, '', {
      fontFamily: 'sans-serif',
      fontSize: `${Math.round(14 * scaleY)}px`,
      color: '#6c5639',
      wordWrap: { width: 250 * scaleY },
    })
    const messageTitleText = this.add.text(494 * scaleY, 56 * scaleY, '', {
      fontFamily: 'sans-serif',
      fontSize: `${Math.round(17 * scaleY)}px`,
      fontStyle: '700',
      color: '#4c351d',
      wordWrap: { width: 320 * scaleY },
    })
    const messageBodyText = this.add.text(494 * scaleY, 93 * scaleY, '', {
      fontFamily: 'sans-serif',
      fontSize: `${Math.round(14 * scaleY)}px`,
      color: '#4c351d',
      wordWrap: { width: 330 * scaleY },
      lineSpacing: 3,
    })
    const button = this.add
      .zone(panelWidth / 2, 189 * scaleY, panelWidth - 64 * scaleY, 58 * scaleY)
      .setInteractive({ useHandCursor: true })
    const buttonText = this.add
      .text(panelWidth / 2, 189 * scaleY, '', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(21 * scaleY)}px`,
        fontStyle: '700',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)

    button.on('pointerdown', () => this.sendFuel())

    panel.add([
      frame,
      title,
      subtitle,
      percentText,
      remainText,
      messageTitleText,
      messageBodyText,
      button,
      buttonText,
    ])

    this.fuelPanel = {
      bounds: new Phaser.Geom.Rectangle(panelX, panelY, panelWidth, panelHeight),
      button,
      buttonText,
      percentText,
      remainText,
      messageTitleText,
      messageBodyText,
      starStart: new Phaser.Math.Vector2(panelX + 101 * scaleY, panelY + 101 * scaleY),
      shipTarget: new Phaser.Math.Vector2(vw * SHIP_TARGET.xRatio, vh * SHIP_TARGET.yRatio),
    }
    this.refreshFuelUi()
  }

  private sendFuel() {
    if (this.isStarFlying || this.currentFuelPercent >= FUEL_GOAL_PERCENT) {
      return
    }

    this.currentFuelPercent = Phaser.Math.Clamp(
      this.currentFuelPercent + SEND_FUEL_AMOUNT,
      0,
      FUEL_GOAL_PERCENT,
    )
    this.refreshFuelUi()
    this.playStarFlyAnimation()

    if (this.currentFuelPercent >= FUEL_GOAL_PERCENT) {
      this.onFuelCompleted()
    }
  }

  private refreshFuelUi() {
    if (!this.fuelPanel) return

    this.currentFuelPercent = Phaser.Math.Clamp(this.currentFuelPercent, 0, FUEL_GOAL_PERCENT)
    const remainPercent = FUEL_GOAL_PERCENT - this.currentFuelPercent
    this.fuelPanel.percentText.setText(`${this.currentFuelPercent}%`)
    this.fuelPanel.remainText.setText(`출발까지 ${remainPercent}% 남았어요`)
    this.fuelPanel.messageTitleText.setText('아이의 응원이 도착했어요!')
    this.fuelPanel.messageBodyText.setText('오늘도 정말 잘했어, 천천히 같이 가보자.')
    this.fuelPanel.buttonText.setText('별빛 연료 보내기')
    this.fuelPanel.button.setInteractive({ useHandCursor: true })
    this.fuelPanel.buttonText.setAlpha(1)
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
    if (!this.fuelPanel) return

    this.fuelPanel.remainText.setText('출발 준비 완료!')
    this.fuelPanel.buttonText.setText('배 출발하기')
    this.fuelPanel.button.disableInteractive()
    this.fuelPanel.buttonText.setAlpha(0.86)
    console.info('별빛 연료 100% 완료. 배 출발 연출 실행 가능.')
  }
}
