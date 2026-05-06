import Phaser from 'phaser'
import { clearDemoAuthToken } from '@/auth/demoAuth'
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
import { fadeToScene } from '@/game/systems/sceneTransition'
import { getPlayerMoveSpeed } from '@/game/settings/gameSettings'
import {
  createSimpleDialogUi,
  fadeSimpleDialog,
  setCenteredDialogText,
  type SimpleDialogUi,
} from '@/game/ui/simpleDialog'
import { createSettingsMenu } from '@/game/ui/settingsMenu'
import { getRectangleEntryState } from '@/game/world/portal'
import { villageDialogs } from './dialog/villageDialogs'
import {
  createInitialVillagePortalState,
  createVillagePortalRectangles,
  VILLAGE_THEME_PORTALS,
  type VillagePortalKey,
} from './villagePortals'

const TALK_DISTANCE = 55
const DIALOG_TEXT_BOX = { x: 830, y: 470, width: 780, height: 190 }
const DEFAULT_PLAYER_SPAWN = { xRatio: 0.5, yRatio: 0.3 }
const MAP_TILE_ROWS = 3
const MAP_TILE_COLUMNS = 3
const MAP_TILE_KEYS = Array.from({ length: MAP_TILE_ROWS * MAP_TILE_COLUMNS }, (_, index) => {
  const tileNumber = index.toString().padStart(2, '0')
  return {
    key: `village-map-tile-${tileNumber}`,
    path: `images/village/background/tile_${tileNumber}.webp`,
    row: Math.floor(index / MAP_TILE_COLUMNS),
    column: index % MAP_TILE_COLUMNS,
  }
})

type ObstacleRect = { x: number; y: number; w: number; h: number }
type VillageSceneData = {
  spawn?: RatioPoint
  portalCooldownMs?: number
}

const OBSTACLES: ObstacleRect[] = []

export class VillageScene extends Phaser.Scene {
  private player!: PlayerSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private obstacles!: Phaser.Physics.Arcade.StaticGroup
  private sehyunNpc!: Phaser.GameObjects.Sprite
  private dialog!: SimpleDialogUi
  private portalCooldownUntil = 0
  private portals = new Map<VillagePortalKey, Phaser.Geom.Rectangle>()
  private playerWasInPortal = createInitialVillagePortalState()
  private isTransitioning = false
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private isDialogVisible = false
  private dialogDismissed = false
  private settingsMenu!: ReturnType<typeof createSettingsMenu>

  constructor() {
    super({ key: 'VillageScene' })
  }

  preload() {
    MAP_TILE_KEYS.forEach(tile => {
      this.load.image(tile.key, assetPath(tile.path))
    })
    this.load.image('sehyun_talk', assetPath('images/npcs/sehyun/dialog-frame.png'))
    this.load.image('profile', assetPath('images/common/profile.png'))
    this.load.image('menu', assetPath('images/ui/buttons/menu.png'))
    this.load.image('menu-frame', assetPath('images/ui/buttons/meunframe.png'))
    this.load.image('setting-frame', assetPath('images/ui/buttons/settingframe.png'))
    this.load.image('settings-button', assetPath('images/ui/buttons/settingbutton.png'))
    this.load.image('exit-button', assetPath('images/ui/buttons/exit button.png'))
    this.load.spritesheet('sehyun', assetPath('images/npcs/sehyun/sprite.png'), {
      frameWidth: 313,
      frameHeight: 313,
      margin: 1,
      spacing: 0,
    })
    loadPlayerSpritesheet(this)
  }

  create(data: VillageSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.target = null
    this.portalCooldownUntil = this.time.now + (data.portalCooldownMs ?? 0)

    const firstTile = this.textures.get(MAP_TILE_KEYS[0].key).getSourceImage() as HTMLImageElement
    const rawTileW = firstTile.width
    const rawTileH = firstTile.height
    const rawW = rawTileW * MAP_TILE_COLUMNS
    const rawH = rawTileH * MAP_TILE_ROWS
    const mapScale = Math.max(vw / rawW, vh / rawH) * 3

    const W = rawW * mapScale
    const H = rawH * mapScale

    MAP_TILE_KEYS.forEach(tile => {
      this.add
        .image(
          (tile.column + 0.5) * rawTileW * mapScale,
          (tile.row + 0.5) * rawTileH * mapScale,
          tile.key,
        )
        .setScale(mapScale)
        .setDepth(0)
    })

    this.physics.world.setBounds(0, 0, W, H)
    this.cameras.main.setBounds(0, 0, W, H)
    this.playerWasInPortal = createInitialVillagePortalState()
    this.portals = createVillagePortalRectangles(W, H)

    this.obstacles = this.physics.add.staticGroup()
    OBSTACLES.forEach(({ x, y, w, h }) => {
      const box = this.add.rectangle(x * W, y * H, w * W, h * H, 0xff0000, 0).setDepth(1)
      this.physics.add.existing(box, true)
      this.obstacles.add(box)
    })

    ensurePlayerWalkAnimations(this)

    this.anims.create({
      key: 'sehyun-loop',
      frames: this.anims.generateFrameNumbers('sehyun', { start: 0, end: 15 }),
      frameRate: 6,
      repeat: -1,
    })
    this.sehyunNpc = this.add.sprite(0.38 * W, 0.3 * H, 'sehyun').setDepth(4)
    this.sehyunNpc.setScale(0.38)
    this.sehyunNpc.anims.play('sehyun-loop')

    const sehyunBox = this.add
      .rectangle(this.sehyunNpc.x, this.sehyunNpc.y + 10, 40, 30, 0xff0000, 0)
      .setDepth(1)
    this.physics.add.existing(sehyunBox, true)
    this.obstacles.add(sehyunBox)

    this.dialog = createSimpleDialogUi(this, {
      frameKey: 'sehyun_talk',
      textBox: DIALOG_TEXT_BOX,
    })

    const profileSize = Math.min(vw * 0.16, 180)
    const profile = this.add.image(0, 0, 'profile')
    profile.setDisplaySize(profileSize, profileSize)
    profile.setDepth(20)
    profile.setScrollFactor(0)
    profile.x = profileSize / 2 + 12
    profile.y = profileSize / 2 + 12

    const menu = this.add.image(0, 0, 'menu')
    const menuW = profileSize * 0.65
    menu.setDisplaySize(menuW, menuW * (menu.height / menu.width))
    menu.setDepth(20).setScrollFactor(0)
    menu.x = menuW / 2 + 12 + (profileSize - menuW) / 2
    menu.y = profile.y + profileSize / 2 + menu.displayHeight / 2 - 4

    const spawn = data.spawn ?? DEFAULT_PLAYER_SPAWN
    this.player = createPlayer(this, W * spawn.xRatio, H * spawn.yRatio, { depth: 5 })

    this.physics.add.collider(this.player, this.obstacles)

    this.cameras.main.centerOn(this.player.x, this.player.y)
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.settingsMenu = createSettingsMenu(this, {
      onLogout: () => this.logout(),
    })

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.isDialogVisible) {
        this.hideDialog(true)
        return
      }
      this.settingsMenu.toggleButton()
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.settingsMenu.isOpen()) {
        return
      }

      if (this.isDialogVisible) {
        const b = this.dialog.frame.getBounds()
        const outside =
          pointer.x < b.left || pointer.x > b.right || pointer.y < b.top || pointer.y > b.bottom
        if (outside) {
          this.hideDialog(true)
        }
        return
      }

      this.target = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY)
      createClickTargetMarker(this, pointer.worldX, pointer.worldY)
    })

    this.cameras.main.fadeIn(400, 0, 0, 0)
  }

  update() {
    const movement = updatePlayerMovement({
      player: this.player,
      cursors: this.cursors,
      target: this.target,
      lastDirection: this.lastDirection,
      speed: getPlayerMoveSpeed(),
      blocked: this.isDialogVisible || this.settingsMenu.isOpen(),
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    const dx = this.player.x - this.sehyunNpc.x
    const dy = this.player.y - this.sehyunNpc.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const near = dist < TALK_DISTANCE

    if (near) {
      if (!this.isDialogVisible && !this.dialogDismissed) {
        this.showSehyunDialog()
      }
    } else {
      this.dialogDismissed = false
      if (this.isDialogVisible) {
        this.hideDialog(false)
      }
    }

    this.updateThemePortalTransitions()
  }

  private showSehyunDialog() {
    const line = Phaser.Utils.Array.GetRandom(villageDialogs.sehyun)
    setCenteredDialogText(this.dialog, line.text)
    this.isDialogVisible = true

    fadeSimpleDialog(this, this.dialog, 1, 300)
  }

  private hideDialog(markDismissed: boolean) {
    this.isDialogVisible = false
    this.dialogDismissed = markDismissed

    fadeSimpleDialog(this, this.dialog, 0, 200)
  }

  private updateThemePortalTransitions() {
    VILLAGE_THEME_PORTALS.forEach(portal => {
      const rectangle = this.portals.get(portal.key)
      if (!rectangle) {
        return
      }

      const portalState = getRectangleEntryState(
        rectangle,
        this.player.x,
        this.player.y,
        this.playerWasInPortal[portal.key],
      )

      const canUsePortal = this.time.now >= this.portalCooldownUntil

      if (!this.isTransitioning && canUsePortal && portalState.didEnter) {
        this.enterThemeScene(portal.sceneKey)
      }

      this.playerWasInPortal[portal.key] = canUsePortal
        ? portalState.isInside
        : this.playerWasInPortal[portal.key] && portalState.isInside
    })
  }

  private enterThemeScene(sceneKey: string) {
    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)

    if (this.isDialogVisible) {
      this.hideDialog(false)
    }

    fadeToScene(this, sceneKey, { duration: 250 })
  }

  private logout() {
    clearDemoAuthToken()
    this.settingsMenu.close()
    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)
    fadeToScene(this, 'StartScene', { duration: 250 })
  }
}
