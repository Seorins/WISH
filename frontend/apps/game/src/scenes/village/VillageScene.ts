import Phaser from 'phaser'
import { useAuthStore } from '@/features/auth/store'
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
import { NpcInteractionHintUi } from '@/game/ui/npcInteractionHint'
import { getRectangleEntryState } from '@/game/world/portal'
import type { VillagerNpcId } from '@/features/village-dialogue/types'
import {
  VILLAGER_FIRST_GREETING,
  villageDialogues,
} from '@/features/village-dialogue/villageDialogues'
import {
  createInitialVillagePortalState,
  createVillagePortalRectangles,
  VILLAGE_THEME_PORTALS,
  type VillagePortalKey,
} from './villagePortals'
import { VillageObstacleManager } from './villageObstacles'

const NPC_DIALOG_DISTANCE = 28
const DIALOG_TEXT_BOX = { x: 585, y: 260, width: 1230, height: 250 }
const DIALOG_NAME_BOX = { x: 490, y: 130, width: 350, height: 72 }
const DIALOG_PORTRAIT_BOX = { x: 120, y: 100, width: 320, height: 400 }
const DIALOG_PORTRAIT_CROP_RATIO = 0.62
const DIALOG_PORTRAIT_SCALE_BOOST = 1.18
const VILLAGE_DIALOG_FRAME_KEY = 'village-dialog-frame'
const VILLAGE_DIALOG_FRAME_PATH = 'images/village/ui/dialogframe.png'
const VILLAGE_SHIP_KEY = 'village-ship'
const VILLAGE_SHIP_PATH = 'images/themes/ferry/ui/ship.png'
const VILLAGE_SHIP = {
  xRatio: 0.5,
  yRatio: 0.92,
  scale: 0.22,
} as const
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
  id: VillagerNpcId
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
    key: 'village-character-dain',
    path: 'images/village/background/character/dain.png',
    portraitScale: 0.97,
    xRatio: 0.75,
    yRatio: 0.38,
    scale: 0.095,
  },
  {
    id: 'nurse_bunny',
    key: 'village-character-joeun',
    path: 'images/village/background/character/joeun.png',
    portraitScale: 1.58,
    xRatio: 0.49,
    yRatio: 0.455,
    scale: 0.09,
  },
  {
    id: 'sleepy_sheep',
    key: 'village-character-geonbin',
    path: 'images/village/background/character/geonbin.png',
    portraitScale: 1,
    xRatio: 0.43,
    yRatio: 0.31,
    scale: 0.095,
  },
  {
    id: 'gardener_bear',
    key: 'village-character-jungho',
    path: 'images/village/background/character/jungho.png',
    portraitScale: 1.12,
    xRatio: 0.616,
    yRatio: 0.29,
    scale: 0.14,
  },
  {
    id: 'monkey_friend',
    key: 'village-character-komonge',
    path: 'images/village/background/character/komonge.png',
    portraitScale: 1.03,
    xRatio: 0.58,
    yRatio: 0.398,
    scale: 0.08,
  },
] as const

const SEHYUN_NPC = {
  id: 'squirrel_friend',
  portraitKey: 'village-character-sehyun',
  portraitPath: 'images/village/background/character/sehyun.png',
  portraitScale: 0.85,
} satisfies { id: VillagerNpcId; portraitKey: string; portraitPath: string; portraitScale: number }

type VillageNpcInstance = {
  id: VillagerNpcId
  object: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite
}

type VillageSceneData = {
  spawn?: RatioPoint
  portalCooldownMs?: number
}

export class VillageScene extends Phaser.Scene {
  private player!: PlayerSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private obstacles!: Phaser.Physics.Arcade.StaticGroup
  private obstacleManager?: VillageObstacleManager
  private sehyunNpc!: Phaser.GameObjects.Sprite
  private dialogs = new Map<VillagerNpcId, SimpleDialogUi>()
  private villageNpcs: VillageNpcInstance[] = []
  private portalCooldownUntil = 0
  private portals = new Map<VillagePortalKey, Phaser.Geom.Rectangle>()
  private playerWasInPortal = createInitialVillagePortalState()
  private isTransitioning = false
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private lastSafePlayerPosition?: Phaser.Math.Vector2
  private isVillagerDialogueOpen = false
  private dialogDismissed = false
  private nearestNpcId: VillagerNpcId | null = null
  private activeDialogNpcId: VillagerNpcId | null = null
  private settingsMenu!: ReturnType<typeof createSettingsMenu>
  private interactionHint!: NpcInteractionHintUi

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
    this.load.image(VILLAGE_SHIP_KEY, assetPath(VILLAGE_SHIP_PATH))
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
    this.obstacleManager?.destroy()
    this.obstacleManager = undefined
    this.dialogs.clear()
    this.isVillagerDialogueOpen = false
    this.activeDialogNpcId = null
    this.nearestNpcId = null
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
    this.obstacleManager = new VillageObstacleManager(this, this.obstacles, W, H)
    this.obstacleManager.addInitialObstacles()

    VILLAGE_CHARACTERS.forEach(character => {
      const x = character.xRatio * W
      const y = character.yRatio * H
      const npc = this.add
        .image(x, y, character.key)
        .setOrigin(0.5, 1)
        .setScale(character.scale)
        .setDepth(4)
        .setInteractive({ useHandCursor: true })
      npc.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event.stopPropagation()
          this.tryOpenNpcDialogue(character.id)
        },
      )
      this.villageNpcs.push({ id: character.id, object: npc })

      const box = this.add.rectangle(x, y - 18, 48, 36, 0xff0000, 0).setDepth(1)
      this.physics.add.existing(box, true)
      this.obstacles.add(box)
    })

    this.add
      .image(VILLAGE_SHIP.xRatio * W, VILLAGE_SHIP.yRatio * H, VILLAGE_SHIP_KEY)
      .setOrigin(0.5, 1)
      .setScale(VILLAGE_SHIP.scale)
      .setDepth(3)

    ensurePlayerWalkAnimations(this)

    this.anims.create({
      key: 'sehyun-loop',
      frames: this.anims.generateFrameNumbers('sehyun', { start: 0, end: 3 }),
      frameRate: 3,
      repeat: -1,
    })
    this.sehyunNpc = this.add.sprite(0.38 * W, 0.3 * H, 'sehyun').setDepth(4)
    this.sehyunNpc.setScale(0.38)
    this.sehyunNpc.setInteractive({ useHandCursor: true })
    this.sehyunNpc.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.tryOpenNpcDialogue(SEHYUN_NPC.id)
      },
    )
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
        this.createVillageDialog(
          villageDialogues[character.id].displayName,
          character.key,
          character.portraitScale,
        ),
      )
    })
    this.dialogs.set(
      SEHYUN_NPC.id,
      this.createVillageDialog(
        villageDialogues[SEHYUN_NPC.id].displayName,
        SEHYUN_NPC.portraitKey,
        SEHYUN_NPC.portraitScale,
      ),
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
    this.lastSafePlayerPosition = new Phaser.Math.Vector2(this.player.x, this.player.y)

    this.physics.add.collider(this.player, this.obstacles)

    this.cameras.main.centerOn(this.player.x, this.player.y)
    this.cameras.main.startFollow(this.player, true, 1, 1)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.settingsMenu = createSettingsMenu(this, {
      onLogout: () => this.logout(),
    })
    this.interactionHint = new NpcInteractionHintUi(this)

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.isVillagerDialogueOpen) {
        this.hideDialog(true)
        return
      }
      this.settingsMenu.toggleButton()
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.obstacleManager?.handlePointerDown(pointer)) {
        return
      }

      if (this.settingsMenu.isOpen()) {
        return
      }

      if (this.isVillagerDialogueOpen) {
        return
      }

      if (this.isPolygonObstacleTarget(pointer.worldX, pointer.worldY)) {
        return
      }

      this.target = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY)
      createClickTargetMarker(this, pointer.worldX, pointer.worldY)
    })
    this.input.on('pointermove', this.handleObstacleEditorPointerMove, this)
    this.input.on('pointerup', this.handleObstacleEditorPointerUp, this)
    this.input.mouse?.disableContextMenu()
    this.input.keyboard!.on('keydown-E', this.handleNpcInteract, this)
    this.input.keyboard!.on('keydown-ENTER', this.handleNpcInteract, this)
    this.input.keyboard!.on('keydown-R', this.clearEditedObstacleRects, this)
    this.input.keyboard!.on('keydown-BACKSPACE', this.undoObstaclePolygonPoint, this)

    this.cameras.main.fadeIn(400, 0, 0, 0)
    this.game.events.on('villager-dialogue:closed', this.handleVillagerDialogueClosed, this)
    this.game.events.on('villager-dialogue:text', this.handleVillagerDialogueText, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('villager-dialogue:closed', this.handleVillagerDialogueClosed, this)
      this.game.events.off('villager-dialogue:text', this.handleVillagerDialogueText, this)
      this.input.off('pointermove', this.handleObstacleEditorPointerMove, this)
      this.input.off('pointerup', this.handleObstacleEditorPointerUp, this)
      this.input.keyboard?.off('keydown-E', this.handleNpcInteract, this)
      this.input.keyboard?.off('keydown-ENTER', this.handleNpcInteract, this)
      this.input.keyboard?.off('keydown-R', this.clearEditedObstacleRects, this)
      this.input.keyboard?.off('keydown-BACKSPACE', this.undoObstaclePolygonPoint, this)
    })
  }

  update(_time: number, delta: number) {
    const movement = updatePlayerMovement({
      player: this.player,
      cursors: this.cursors,
      target: this.target,
      lastDirection: this.lastDirection,
      speed: getPlayerMoveSpeed(),
      blocked: this.isVillagerDialogueOpen || this.settingsMenu.isOpen(),
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection
    this.preventPolygonObstaclePenetration(delta)
    this.resolvePolygonObstacleCollision()

    const nearestNpc = this.getNearestNpcInTalkDistance()
    this.nearestNpcId = nearestNpc?.id ?? null
    this.updateInteractionHint(nearestNpc)

    if (!nearestNpc) {
      this.dialogDismissed = false
      if (this.isVillagerDialogueOpen) {
        this.hideDialog(false)
      }
    }

    this.updateThemePortalTransitions()
  }

  private readonly handleObstacleEditorPointerMove = (pointer: Phaser.Input.Pointer) => {
    this.obstacleManager?.handlePointerMove(pointer)
  }

  private readonly handleObstacleEditorPointerUp = (pointer: Phaser.Input.Pointer) => {
    this.obstacleManager?.handlePointerUp(pointer)
  }

  private readonly clearEditedObstacleRects = () => {
    this.obstacleManager?.clearEditedObstacleRects()
  }

  private readonly undoObstaclePolygonPoint = () => {
    this.obstacleManager?.undoPolygonEditorPoint()
  }

  private readonly handleNpcInteract = (event?: KeyboardEvent) => {
    if (!this.isVillagerDialogueOpen && !this.settingsMenu.isOpen() && !this.dialogDismissed) {
      if (this.nearestNpcId) {
        event?.preventDefault()
        this.tryOpenNpcDialogue(this.nearestNpcId)
        return
      }
    }

    if (event?.key === 'e' || event?.key === 'E') {
      this.obstacleManager?.exportObstacleRects()
      return
    }

    if (event?.key === 'Enter') {
      this.obstacleManager?.commitPolygonEditor()
    }
  }

  private preventPolygonObstaclePenetration(delta: number) {
    if (!this.player.body || !this.obstacleManager) {
      return
    }

    const footRadius = 0
    const dt = Math.min(delta, 50) / 1000
    const velocity = this.player.body.velocity

    if (velocity.x === 0 && velocity.y === 0) {
      return
    }

    const nextX = this.player.x + velocity.x * dt
    const nextY = this.player.y + velocity.y * dt

    if (!this.isPlayerFootBlockedAt(nextX, nextY, footRadius)) {
      return
    }

    const canMoveX =
      velocity.x !== 0 && !this.isPlayerFootBlockedAt(nextX, this.player.y, footRadius)
    const canMoveY =
      velocity.y !== 0 && !this.isPlayerFootBlockedAt(this.player.x, nextY, footRadius)

    if (canMoveX && canMoveY) {
      if (Math.abs(velocity.x) >= Math.abs(velocity.y)) {
        this.player.setVelocityY(0)
      } else {
        this.player.setVelocityX(0)
      }
      return
    }

    if (canMoveX) {
      this.player.setVelocityY(0)
      return
    }

    if (canMoveY) {
      this.player.setVelocityX(0)
      return
    }

    this.player.setVelocity(0, 0)
    this.target = null
  }

  private resolvePolygonObstacleCollision() {
    if (!this.player.body || !this.obstacleManager) {
      return
    }

    const footRadius = 0

    if (!this.isPlayerFootBlockedAt(this.player.x, this.player.y, footRadius)) {
      this.lastSafePlayerPosition?.set(this.player.x, this.player.y)
      return
    }

    const fallback =
      this.lastSafePlayerPosition ?? new Phaser.Math.Vector2(this.player.x, this.player.y)
    const current = new Phaser.Math.Vector2(this.player.x, this.player.y)
    const candidates =
      Math.abs(current.x - fallback.x) > Math.abs(current.y - fallback.y)
        ? [
            new Phaser.Math.Vector2(current.x, fallback.y),
            new Phaser.Math.Vector2(fallback.x, current.y),
          ]
        : [
            new Phaser.Math.Vector2(fallback.x, current.y),
            new Phaser.Math.Vector2(current.x, fallback.y),
          ]
    const slidePosition = candidates.find(
      candidate => !this.isPlayerFootBlockedAt(candidate.x, candidate.y, footRadius),
    )
    const nextPosition = slidePosition ?? fallback

    this.player.body.reset(nextPosition.x, nextPosition.y)
    this.player.setVelocity(0, 0)
    this.lastSafePlayerPosition ??= new Phaser.Math.Vector2(nextPosition.x, nextPosition.y)
    this.lastSafePlayerPosition.set(nextPosition.x, nextPosition.y)

    if (!slidePosition) {
      this.target = null
    }
  }

  private isPolygonObstacleTarget(worldX: number, worldY: number) {
    if (!this.player.body || !this.obstacleManager) {
      return false
    }

    const footRadius = 0
    return this.obstacleManager.containsBlockedFoot(worldX, worldY, footRadius)
  }

  private isPlayerFootBlockedAt(playerX: number, playerY: number, radius: number) {
    if (!this.player.body || !this.obstacleManager) {
      return false
    }

    const footOffsetX = this.player.body.center.x - this.player.x
    const footOffsetY = this.player.body.bottom - this.player.y

    return this.obstacleManager.containsBlockedFoot(
      playerX + footOffsetX,
      playerY + footOffsetY,
      radius,
    )
  }

  private tryOpenNpcDialogue(npcId: VillagerNpcId) {
    if (this.isVillagerDialogueOpen || this.settingsMenu.isOpen() || this.dialogDismissed) return

    const npc = this.villageNpcs.find(candidate => candidate.id === npcId)
    if (!npc) return

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      npc.object.x,
      npc.object.y,
    )
    if (distance > NPC_DIALOG_DISTANCE) return

    this.showNpcDialog(npcId)
  }

  private showNpcDialog(npcId: VillagerNpcId) {
    const dialog = this.dialogs.get(npcId)
    if (!dialog) return

    setCenteredDialogText(dialog, VILLAGER_FIRST_GREETING[npcId] ?? '안녕, 와줬구나.')
    this.isVillagerDialogueOpen = true
    this.activeDialogNpcId = npcId
    this.target = null
    this.player.setVelocity(0, 0)
    this.interactionHint.hide()
    fadeSimpleDialog(this, dialog, 1, 120)
    this.game.events.emit('villager-dialogue:open', { npcId })
  }

  private hideDialog(markDismissed: boolean, notifyReact = true) {
    const dialog = this.getActiveDialog()
    if (this.isVillagerDialogueOpen && notifyReact) {
      this.game.events.emit('villager-dialogue:force-close')
    }
    this.isVillagerDialogueOpen = false
    this.dialogDismissed = markDismissed
    this.activeDialogNpcId = null

    if (dialog) {
      fadeSimpleDialog(this, dialog, 0, 200)
    }
  }

  private handleVillagerDialogueClosed() {
    this.hideDialog(true, false)
  }

  private handleVillagerDialogueText({ text }: { text: string }) {
    const dialog = this.getActiveDialog()
    if (!dialog) return
    setCenteredDialogText(dialog, text)
  }

  private updateInteractionHint(nearestNpc: VillageNpcInstance | null) {
    if (!nearestNpc || this.isVillagerDialogueOpen || this.settingsMenu.isOpen()) {
      this.interactionHint.hide()
      return
    }

    this.interactionHint.show(
      nearestNpc.object.x,
      nearestNpc.object.y - nearestNpc.object.displayHeight,
      villageDialogues[nearestNpc.id].displayName,
    )
  }

  private getActiveDialog() {
    if (!this.activeDialogNpcId) return null
    return this.dialogs.get(this.activeDialogNpcId) ?? null
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

    if (this.isVillagerDialogueOpen) {
      this.hideDialog(false)
    }

    fadeToScene(this, sceneKey, { duration: 250 })
  }

  private logout() {
    useAuthStore.getState().clear()
    this.game.events.emit('auth:logout')
    this.settingsMenu.close()
    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)
    fadeToScene(this, 'StartScene', { duration: 250 })
  }
}
