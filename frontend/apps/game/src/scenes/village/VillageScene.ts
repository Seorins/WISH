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
import { createSceneWeatherLayer } from '@/features/weather/phaserWeatherLayer'
import {
  createSimpleDialogUi,
  fadeSimpleDialog,
  setCenteredDialogText,
  type SimpleDialogUi,
} from '@/game/ui/simpleDialog'
import { createSettingsMenu } from '@/game/ui/settingsMenu'
import { getRectangleEntryState } from '@/game/world/portal'
import { villageDialogs, type VillageNpcId } from './dialog/villageDialogs'
import {
  createInitialVillagePortalState,
  createVillagePortalRectangles,
  VILLAGE_THEME_PORTALS,
  type VillagePortalKey,
} from './villagePortals'

const NPC_DIALOG_DISTANCE = 28
const DIALOG_TEXT_BOX = { x: 585, y: 260, width: 1230, height: 250 }
const DIALOG_NAME_BOX = { x: 490, y: 130, width: 350, height: 72 }
const DIALOG_PORTRAIT_BOX = { x: 120, y: 100, width: 320, height: 400 }
const DIALOG_PORTRAIT_CROP_RATIO = 0.62
const DIALOG_PORTRAIT_SCALE_BOOST = 1.18
const VILLAGE_DIALOG_FRAME_KEY = 'village-dialog-frame'
const VILLAGE_DIALOG_FRAME_PATH = 'images/village/ui/dialogframe.png'
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
type VillageCharacterConfig = {
  id: VillageNpcId
  name: string
  key: string
  path: string
  portraitScale: number
  xRatio: number
  yRatio: number
  scale: number
}

const VILLAGE_CHARACTERS: VillageCharacterConfig[] = [
  {
    id: 'dain',
    name: '다인',
    key: 'village-character-dain',
    path: 'images/village/background/character/dain.png',
    portraitScale: 0.97,
    xRatio: 0.75,
    yRatio: 0.38,
    scale: 0.095,
  },
  {
    id: 'geonbin',
    name: '건빈',
    key: 'village-character-geonbin',
    path: 'images/village/background/character/geonbin.png',
    portraitScale: 1,
    xRatio: 0.43,
    yRatio: 0.31,
    scale: 0.095,
  },
  {
    id: 'joeun',
    name: '간호사 조은',
    key: 'village-character-joeun',
    path: 'images/village/background/character/joeun.png',
    portraitScale: 1.58,
    xRatio: 0.49,
    yRatio: 0.455,
    scale: 0.09,
  },
  {
    id: 'jungho',
    name: '정호',
    key: 'village-character-jungho',
    path: 'images/village/background/character/jungho.png',
    portraitScale: 1.12,
    xRatio: 0.616,
    yRatio: 0.29,
    scale: 0.14,
  },
  {
    id: 'komonge',
    name: '코몽이',
    key: 'village-character-komonge',
    path: 'images/village/background/character/komonge.png',
    portraitScale: 1.03,
    xRatio: 0.58,
    yRatio: 0.398,
    scale: 0.08,
  },
] as const

const SEHYUN_NPC = {
  id: 'sehyun',
  name: '세현',
  portraitKey: 'village-character-sehyun',
  portraitPath: 'images/village/background/character/sehyun.png',
  portraitScale: 0.85,
} as const

type ObstacleRect = { x: number; y: number; w: number; h: number }
type VillageNpcInstance = {
  id: VillageNpcId
  object: Phaser.GameObjects.Components.Transform
}
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
  private dialogs = new Map<VillageNpcId, SimpleDialogUi>()
  private villageNpcs: VillageNpcInstance[] = []
  private portalCooldownUntil = 0
  private portals = new Map<VillagePortalKey, Phaser.Geom.Rectangle>()
  private playerWasInPortal = createInitialVillagePortalState()
  private isTransitioning = false
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private isDialogVisible = false
  private dialogDismissed = false
  private activeDialogNpcId: VillageNpcId | null = null
  private settingsMenu!: ReturnType<typeof createSettingsMenu>

  constructor() {
    super({ key: 'VillageScene' })
  }

  preload() {
    MAP_TILE_KEYS.forEach(tile => {
      this.load.image(tile.key, assetPath(tile.path))
    })
    VILLAGE_CHARACTERS.forEach(character => {
      this.load.image(character.key, assetPath(character.path))
    })
    this.load.image(SEHYUN_NPC.portraitKey, assetPath(SEHYUN_NPC.portraitPath))
    this.load.image(VILLAGE_DIALOG_FRAME_KEY, assetPath(VILLAGE_DIALOG_FRAME_PATH))
    this.load.image('profile', assetPath('images/common/profile.png'))
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
    this.villageNpcs = []
    this.dialogs.clear()
    this.activeDialogNpcId = null
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
    createSceneWeatherLayer(this)

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

    VILLAGE_CHARACTERS.forEach(character => {
      const x = character.xRatio * W
      const y = character.yRatio * H
      const npc = this.add
        .image(x, y, character.key)
        .setOrigin(0.5, 1)
        .setScale(character.scale)
        .setDepth(4)
      this.villageNpcs.push({ id: character.id, object: npc })

      const box = this.add.rectangle(x, y - 18, 48, 36, 0xff0000, 0).setDepth(1)
      this.physics.add.existing(box, true)
      this.obstacles.add(box)
    })

    ensurePlayerWalkAnimations(this)

    this.anims.create({
      key: 'sehyun-loop',
      frames: this.anims.generateFrameNumbers('sehyun', { start: 0, end: 3 }),
      frameRate: 3,
      repeat: -1,
    })
    this.sehyunNpc = this.add.sprite(0.38 * W, 0.3 * H, 'sehyun').setDepth(4)
    this.sehyunNpc.setScale(0.38)
    this.sehyunNpc.anims.play('sehyun-loop')
    this.villageNpcs.push({ id: SEHYUN_NPC.id, object: this.sehyunNpc })

    const sehyunBox = this.add
      .rectangle(this.sehyunNpc.x, this.sehyunNpc.y + 10, 40, 30, 0xff0000, 0)
      .setDepth(1)
    this.physics.add.existing(sehyunBox, true)
    this.obstacles.add(sehyunBox)

    VILLAGE_CHARACTERS.forEach(character => {
      this.dialogs.set(
        character.id,
        this.createVillageDialog(character.name, character.key, character.portraitScale),
      )
    })
    this.dialogs.set(
      SEHYUN_NPC.id,
      this.createVillageDialog(SEHYUN_NPC.name, SEHYUN_NPC.portraitKey, SEHYUN_NPC.portraitScale),
    )

    const profileSize = Math.min(vw * 0.16, 180)
    const profile = this.add.image(0, 0, 'profile')
    profile.setDisplaySize(profileSize, profileSize)
    profile.setDepth(20)
    profile.setScrollFactor(0)
    profile.x = profileSize / 2 + 12
    profile.y = profileSize / 2 + 12

    const spawn = data.spawn ?? DEFAULT_PLAYER_SPAWN
    this.player = createPlayer(this, W * spawn.xRatio, H * spawn.yRatio, { depth: 5 })

    this.physics.add.collider(this.player, this.obstacles)

    this.cameras.main.centerOn(this.player.x, this.player.y)
    this.cameras.main.startFollow(this.player, true, 1, 1)

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
        const dialog = this.getActiveDialog()
        const b = dialog?.frame.getBounds()
        if (!b) return
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

    const nearestNpc = this.getNearestNpcInTalkDistance()
    const near = nearestNpc !== null

    if (near) {
      if (!this.isDialogVisible && !this.dialogDismissed && nearestNpc) {
        this.showNpcDialog(nearestNpc.id)
      }
    } else {
      this.dialogDismissed = false
      if (this.isDialogVisible) {
        this.hideDialog(false)
      }
    }

    this.updateThemePortalTransitions()
  }

  private showNpcDialog(npcId: VillageNpcId) {
    const dialog = this.dialogs.get(npcId)
    if (!dialog) return

    const line = Phaser.Utils.Array.GetRandom(villageDialogs[npcId])
    setCenteredDialogText(dialog, line.text)
    this.isDialogVisible = true
    this.activeDialogNpcId = npcId

    fadeSimpleDialog(this, dialog, 1, 300)
  }

  private createVillageDialog(name: string, portraitKey: string, portraitScale: number) {
    const dialog = createSimpleDialogUi(this, {
      frameKey: VILLAGE_DIALOG_FRAME_KEY,
      textBox: DIALOG_TEXT_BOX,
      fontSize: 48,
      lineSpacing: 8,
      nameBox: DIALOG_NAME_BOX,
      nameText: name,
      nameFontColor: '#4a2b17',
      nameFontSize: 44,
      opticalOffsets: { single: 18, double: 10, multi: 0 },
    })
    dialog.extras.push(...this.createDialogPortraitObjects(dialog, portraitKey, portraitScale))
    return dialog
  }

  private createDialogPortraitObjects(
    dialog: SimpleDialogUi,
    portraitKey: string,
    portraitScale: number,
  ) {
    const frameSource = dialog.frame.texture.getSourceImage() as HTMLImageElement
    const frameScale = dialog.frame.displayWidth / frameSource.width
    const frameLeft = dialog.frame.x - dialog.frame.displayWidth / 2
    const frameTop = dialog.frame.y - dialog.frame.displayHeight / 2
    const boxLeft = frameLeft + DIALOG_PORTRAIT_BOX.x * frameScale
    const boxTop = frameTop + DIALOG_PORTRAIT_BOX.y * frameScale
    const boxWidth = DIALOG_PORTRAIT_BOX.width * frameScale
    const boxHeight = DIALOG_PORTRAIT_BOX.height * frameScale
    const maskShape = this.add.graphics().setScrollFactor(0).setAlpha(0)
    maskShape.fillStyle(0xffffff, 1)
    maskShape.fillRect(boxLeft, boxTop, boxWidth, boxHeight)
    const portraitMask = maskShape.createGeometryMask()
    const portrait = this.add
      .image(boxLeft + boxWidth / 2, boxTop + boxHeight + 6 * frameScale, portraitKey, 0)
      .setDepth(dialog.frame.depth + 0.2)
      .setAlpha(0)
      .setScrollFactor(0)
      .setMask(portraitMask)
    const source = portrait.texture.getSourceImage() as HTMLImageElement
    const cropHeight = Math.round(source.height * DIALOG_PORTRAIT_CROP_RATIO)
    portrait.setCrop(0, 0, source.width, cropHeight)
    portrait.setOrigin(0.5, cropHeight / source.height)
    portrait.setScale(
      Math.min(boxWidth / source.width, boxHeight / cropHeight) *
        DIALOG_PORTRAIT_SCALE_BOOST *
        portraitScale,
    )

    return [portrait]
  }

  private hideDialog(markDismissed: boolean) {
    const dialog = this.getActiveDialog()
    this.isDialogVisible = false
    this.dialogDismissed = markDismissed
    this.activeDialogNpcId = null

    if (dialog) {
      fadeSimpleDialog(this, dialog, 0, 200)
    }
  }

  private getActiveDialog() {
    if (!this.activeDialogNpcId) return null
    return this.dialogs.get(this.activeDialogNpcId) ?? null
  }

  private getNearestNpcInTalkDistance() {
    let nearest: VillageNpcInstance | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const npc of this.villageNpcs) {
      const dx = this.player.x - npc.object.x
      const dy = this.player.y - npc.object.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < NPC_DIALOG_DISTANCE && distance < nearestDistance) {
        nearest = npc
        nearestDistance = distance
      }
    }

    return nearest
  }

  private updateThemePortalTransitions() {
    VILLAGE_THEME_PORTALS.forEach(portal => {
      const rectangle = this.portals.get(portal.key)
      if (!rectangle) {
        console.warn(`[VillageScene] Missing portal rectangle for "${portal.key}"`)
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

      this.playerWasInPortal[portal.key] = portalState.isInside
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
    this.game.events.emit('auth:logout')
    this.settingsMenu.close()
    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)
    fadeToScene(this, 'StartScene', { duration: 250 })
  }
}
