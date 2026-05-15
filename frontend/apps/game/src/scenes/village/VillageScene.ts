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
  attachVillageRealtime,
  createVillageEmojiPalette,
  emitEmoteBubble,
  VILLAGE_EMOJIS,
  type VillageEmojiPaletteHandle,
  type VillageRealtimeIntegration,
} from '@/features/village-realtime'
import {
  createInitialVillagePortalState,
  createVillagePortalRectangles,
  VILLAGE_THEME_PORTALS,
  type VillagePortalKey,
} from './villagePortals'
import { VillageObstacleManager } from './villageObstacles'

const NPC_DIALOG_DISTANCE = 28
const PHOTO_BOOTH_INTERACT_DISTANCE = 40
const PHOTO_GALLERY_INTERACT_DISTANCE = 40
const GOMOKU_BOARD_INTERACT_DISTANCE = 56
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
const VILLAGE_PHOTO_BOOTH_KEY = 'village-photo-booth'
const VILLAGE_PHOTO_BOOTH_PATH = 'images/village/objects/photo.png'
const VILLAGE_PHOTO_BOOTH = {
  xRatio: 0.515,
  yRatio: 0.31,
  scale: 0.145,
} as const
const VILLAGE_PHOTO_GALLERY_KEY = 'village-photo-gallery'
const VILLAGE_PHOTO_GALLERY_PATH = 'images/village/objects/gallery.png'
// 포토부스 우측 가로등 위에 덮어쓰는 위치. 같은 원점(0.5, 1) 사용.
const VILLAGE_PHOTO_GALLERY = {
  xRatio: 0.5461,
  yRatio: 0.3285,
  scale: 0.14,
} as const
const SEHYUN_NPC_WORLD = {
  xRatio: 0.38,
  yRatio: 0.3,
  scale: 0.38,
} as const
const NURSE_BUNNY_WORLD = {
  xRatio: 0.49,
  yRatio: 0.455,
  scale: 0.09,
} as const
const VILLAGE_GOMOKU_BOARD_KEY = 'village-gomoku-board'
const VILLAGE_GOMOKU_BOARD_PATH = 'images/village/objects/gomoku-board.png'
const VILLAGE_GOMOKU_BOARD = {
  xRatio: SEHYUN_NPC_WORLD.xRatio,
  yRatio: NURSE_BUNNY_WORLD.yRatio - 0.02,
  scale: 0.187,
} as const
const GOMOKU_BOARD_POSITION_OFFSET = {
  xBoardWidthRatio: -0.56,
} as const
const GOMOKU_BOARD_INTERACT_RECT = {
  left: 0.72,
  top: 1.08,
  width: 1.36,
  height: 0.9,
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
    xRatio: NURSE_BUNNY_WORLD.xRatio,
    yRatio: NURSE_BUNNY_WORLD.yRatio,
    scale: NURSE_BUNNY_WORLD.scale,
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
  private photoBooth?: Phaser.GameObjects.Image
  private photoGallery?: Phaser.GameObjects.Image
  private gomokuBoard?: Phaser.GameObjects.Image
  private isPhotoBoothInRange = false
  private isPhotoGalleryInRange = false
  private isGomokuBoardInRange = false
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
  private isGomokuOpen = false
  private isPhotoGalleryOpen = false
  private dialogDismissed = false
  private nearestNpcId: VillagerNpcId | null = null
  private activeDialogNpcId: VillagerNpcId | null = null
  private settingsMenu!: ReturnType<typeof createSettingsMenu>
  private interactionHint!: NpcInteractionHintUi
  private villageRealtime: VillageRealtimeIntegration | null = null
  private emojiPalette: VillageEmojiPaletteHandle | null = null
  /** Q 키로 사용자가 의도적으로 팔레트를 켰는지. 다이얼로그/설정 패널 자동 숨김과 분리. */
  private emojiPaletteManuallyShown = false
  /** 팔레트 숨겨져 있을 때 우하단에 "[Q] 이모티콘" 으로 토글 단축키 안내 (S14P31E103-769). */
  private emojiHint: Phaser.GameObjects.Text | null = null

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
    this.load.image(VILLAGE_PHOTO_BOOTH_KEY, assetPath(VILLAGE_PHOTO_BOOTH_PATH))
    this.load.image(VILLAGE_PHOTO_GALLERY_KEY, assetPath(VILLAGE_PHOTO_GALLERY_PATH))
    this.load.image(VILLAGE_GOMOKU_BOARD_KEY, assetPath(VILLAGE_GOMOKU_BOARD_PATH))
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
    this.isGomokuOpen = false
    this.isPhotoGalleryOpen = false
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

    this.photoBooth = this.add
      .image(
        VILLAGE_PHOTO_BOOTH.xRatio * W,
        VILLAGE_PHOTO_BOOTH.yRatio * H,
        VILLAGE_PHOTO_BOOTH_KEY,
      )
      .setOrigin(0.5, 1)
      .setScale(VILLAGE_PHOTO_BOOTH.scale)
      .setDepth(3)
      .setInteractive({ useHandCursor: true })
    this.photoBooth.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.enterPhotoBoothScene()
      },
    )
    this.isPhotoBoothInRange = false
    this.photoGallery = this.createPhotoGallery(W, H)
    this.isPhotoGalleryInRange = false
    this.gomokuBoard = this.createGomokuBoard(W, H)
    this.isGomokuBoardInRange = false

    ensurePlayerWalkAnimations(this)

    this.anims.create({
      key: 'sehyun-loop',
      frames: this.anims.generateFrameNumbers('sehyun', { start: 0, end: 3 }),
      frameRate: 3,
      repeat: -1,
    })
    this.sehyunNpc = this.add
      .sprite(SEHYUN_NPC_WORLD.xRatio * W, SEHYUN_NPC_WORLD.yRatio * H, 'sehyun')
      .setDepth(4)
    this.sehyunNpc.setScale(SEHYUN_NPC_WORLD.scale)
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
    this.villageRealtime = attachVillageRealtime({
      scene: this,
      worldWidth: W,
      worldHeight: H,
      roomId: 'village.default',
    })
    this.emojiPalette = createVillageEmojiPalette(this, {
      onSelect: emoji => {
        if (this.isVillagerDialogueOpen || this.settingsMenu.isOpen()) return
        if (!this.villageRealtime?.publishEmote(emoji)) return
        // 로컬 즉시 렌더로 latency 가림. 서버 echo 는 RemotePlayersGroup 가 localUserId 필터링으로 무시.
        emitEmoteBubble(this, this.player, emoji, 100)
      },
    })
    this.emojiPaletteManuallyShown = false
    // 팔레트는 기본 숨김 → 단축키를 모른 사용자가 발견할 수 있도록 우하단 고정 힌트. 팔레트가 열리면 같은 자리이므로 숨겨서 겹침 회피.
    this.emojiHint = this.add
      .text(vw - 18, vh - 18, '[Q] 이모티콘', {
        fontSize: '14px',
        fontFamily: "'Jua', 'Apple SD Gothic Neo', sans-serif",
        color: '#ffffff',
        backgroundColor: '#00000080',
        padding: { left: 8, right: 8, top: 4, bottom: 4 },
        resolution: 2,
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(100)
    // 1\~9 + 0 단축키. 인덱스 0\~9 매핑. 팔레트가 숨겨져 있어도 발사 가능 (학습용 토글 vs 즉시 발사 분리).
    const emojiKeyNames = [
      'ONE',
      'TWO',
      'THREE',
      'FOUR',
      'FIVE',
      'SIX',
      'SEVEN',
      'EIGHT',
      'NINE',
      'ZERO',
    ] as const
    emojiKeyNames.forEach((name, index) => {
      if (index >= VILLAGE_EMOJIS.length) return
      this.input.keyboard?.on(`keydown-${name}`, () => {
        if (this.isVillagerDialogueOpen || this.settingsMenu.isOpen()) return
        this.emojiPalette?.triggerByIndex(index)
      })
    })
    // Q 키 — 팔레트 토글. 다이얼로그/설정 패널 열려있으면 무시.
    this.input.keyboard?.on('keydown-Q', () => {
      if (this.isVillagerDialogueOpen || this.settingsMenu.isOpen()) return
      this.emojiPaletteManuallyShown = !this.emojiPaletteManuallyShown
    })
    this.game.events.on('villager-dialogue:closed', this.handleVillagerDialogueClosed, this)
    this.game.events.on('villager-dialogue:text', this.handleVillagerDialogueText, this)
    this.game.events.on('gomoku:closed', this.handleGomokuClosed, this)
    this.game.events.on('photo-gallery:closed', this.handlePhotoGalleryClosed, this)
    // photo-booth FrameSelect 가 pause 해뒀던 마을을 resume 시켜 돌아올 때 isTransitioning 해제.
    // 안 풀면 update 의 transitioning 가드에 걸려 입력이 죽음.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.isTransitioning = false
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME)
      this.game.events.off('villager-dialogue:closed', this.handleVillagerDialogueClosed, this)
      this.game.events.off('villager-dialogue:text', this.handleVillagerDialogueText, this)
      this.game.events.off('gomoku:closed', this.handleGomokuClosed, this)
      this.game.events.off('photo-gallery:closed', this.handlePhotoGalleryClosed, this)
      this.input.off('pointermove', this.handleObstacleEditorPointerMove, this)
      this.input.off('pointerup', this.handleObstacleEditorPointerUp, this)
      this.input.keyboard?.off('keydown-E', this.handleNpcInteract, this)
      this.input.keyboard?.off('keydown-ENTER', this.handleNpcInteract, this)
      this.input.keyboard?.off('keydown-R', this.clearEditedObstacleRects, this)
      this.input.keyboard?.off('keydown-BACKSPACE', this.undoObstaclePolygonPoint, this)
      this.villageRealtime?.destroy()
      this.villageRealtime = null
      this.emojiPalette?.destroy()
      this.emojiPalette = null
      this.emojiHint?.destroy()
      this.emojiHint = null
    })
  }

  update(_time: number, delta: number) {
    const movement = updatePlayerMovement({
      player: this.player,
      cursors: this.cursors,
      target: this.target,
      lastDirection: this.lastDirection,
      speed: getPlayerMoveSpeed(),
      blocked:
        this.isVillagerDialogueOpen ||
        this.settingsMenu.isOpen() ||
        this.isGomokuOpen ||
        this.isPhotoGalleryOpen,
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection
    this.preventPolygonObstaclePenetration(delta)
    this.resolvePolygonObstacleCollision()

    this.villageRealtime?.publishLocal(this.player, this.lastDirection, movement.moving)
    const overlaysOpen =
      this.isVillagerDialogueOpen ||
      this.settingsMenu.isOpen() ||
      this.isGomokuOpen ||
      this.isPhotoGalleryOpen
    const paletteVisible = this.emojiPaletteManuallyShown && !overlaysOpen
    this.emojiPalette?.setVisible(paletteVisible)
    this.emojiHint?.setVisible(!paletteVisible && !overlaysOpen)

    const nearestNpc = this.getNearestNpcInTalkDistance()
    const photoBoothDistance = this.getPhotoBoothDistance()
    const photoGalleryDistance = this.getPhotoGalleryDistance()
    const gomokuBoardDistance = this.getGomokuBoardDistance()
    const npcDistance = nearestNpc
      ? Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          nearestNpc.object.x,
          nearestNpc.object.y,
        )
      : Number.POSITIVE_INFINITY
    const photoBoothInRange = photoBoothDistance < PHOTO_BOOTH_INTERACT_DISTANCE
    const photoGalleryInRange = photoGalleryDistance < PHOTO_GALLERY_INTERACT_DISTANCE
    const gomokuBoardInRange = gomokuBoardDistance < GOMOKU_BOARD_INTERACT_DISTANCE
    let nearestAction: 'npc' | 'photo' | 'gallery' | 'gomoku' | null = nearestNpc ? 'npc' : null
    let nearestActionDistance = npcDistance

    if (photoBoothInRange && photoBoothDistance < nearestActionDistance) {
      nearestAction = 'photo'
      nearestActionDistance = photoBoothDistance
    }

    if (photoGalleryInRange && photoGalleryDistance < nearestActionDistance) {
      nearestAction = 'gallery'
      nearestActionDistance = photoGalleryDistance
    }

    if (gomokuBoardInRange && gomokuBoardDistance < nearestActionDistance) {
      nearestAction = 'gomoku'
    }

    this.nearestNpcId = nearestAction === 'npc' ? (nearestNpc?.id ?? null) : null
    this.isPhotoBoothInRange = nearestAction === 'photo'
    this.isPhotoGalleryInRange = nearestAction === 'gallery'
    this.isGomokuBoardInRange = nearestAction === 'gomoku'
    this.updateInteractionHint(nearestAction === 'npc' ? nearestNpc : null)

    if (!nearestNpc) {
      this.dialogDismissed = false
      if (this.isVillagerDialogueOpen) {
        this.hideDialog(false)
      }
    }

    this.updateThemePortalTransitions()
  }

  private createPhotoGallery(worldWidth: number, worldHeight: number) {
    const x = VILLAGE_PHOTO_GALLERY.xRatio * worldWidth
    const y = VILLAGE_PHOTO_GALLERY.yRatio * worldHeight
    const gallery = this.add
      .image(x, y, VILLAGE_PHOTO_GALLERY_KEY)
      .setOrigin(0.5, 1)
      .setScale(VILLAGE_PHOTO_GALLERY.scale)
      .setDepth(3)
      .setInteractive({ useHandCursor: true })
    gallery.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.openPhotoGallery()
      },
    )

    const box = this.add
      .rectangle(
        x,
        y - gallery.displayHeight * 0.25,
        gallery.displayWidth * 0.55,
        gallery.displayHeight * 0.4,
        0xff0000,
        0,
      )
      .setDepth(1)
    this.physics.add.existing(box, true)
    this.obstacles.add(box)

    return gallery
  }

  private createGomokuBoard(worldWidth: number, worldHeight: number) {
    const baseX = VILLAGE_GOMOKU_BOARD.xRatio * worldWidth
    const y = VILLAGE_GOMOKU_BOARD.yRatio * worldHeight
    const board = this.add
      .image(baseX, y, VILLAGE_GOMOKU_BOARD_KEY)
      .setOrigin(0.5, 1)
      .setScale(VILLAGE_GOMOKU_BOARD.scale)
      .setDepth(3)
      .setInteractive({ useHandCursor: true })
    const x = baseX + board.displayWidth * GOMOKU_BOARD_POSITION_OFFSET.xBoardWidthRatio
    board.setX(x)
    board.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.enterGomokuGame()
      },
    )

    const box = this.add.rectangle(x, y - 22, 90, 44, 0xff0000, 0).setDepth(1)
    this.physics.add.existing(box, true)
    this.obstacles.add(box)

    return board
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
    if (
      !this.isVillagerDialogueOpen &&
      !this.settingsMenu.isOpen() &&
      !this.isGomokuOpen &&
      !this.isPhotoGalleryOpen &&
      !this.dialogDismissed
    ) {
      if (this.isPhotoBoothInRange) {
        event?.preventDefault()
        this.enterPhotoBoothScene()
        return
      }
      if (this.isPhotoGalleryInRange) {
        event?.preventDefault()
        this.openPhotoGallery()
        return
      }
      if (this.isGomokuBoardInRange) {
        event?.preventDefault()
        this.tryOpenGomokuGame()
        return
      }
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

  private tryOpenGomokuGame() {
    if (this.isVillagerDialogueOpen || this.settingsMenu.isOpen() || this.isGomokuOpen) return
    if (this.getGomokuBoardDistance() > GOMOKU_BOARD_INTERACT_DISTANCE) return
    this.enterGomokuGame()
  }

  private showNpcDialog(npcId: VillagerNpcId) {
    const dialog = this.dialogs.get(npcId)
    if (!dialog) return

    setCenteredDialogText(dialog, VILLAGER_FIRST_GREETING[npcId].slice(0, 2).join('\n'))
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

  private handleGomokuClosed() {
    this.isGomokuOpen = false
  }

  private openPhotoGallery() {
    if (
      this.isPhotoGalleryOpen ||
      this.isVillagerDialogueOpen ||
      this.settingsMenu.isOpen() ||
      this.isGomokuOpen
    ) {
      return
    }
    this.isPhotoGalleryOpen = true
    this.target = null
    this.player.setVelocity(0, 0)
    this.interactionHint.hide()
    this.game.events.emit('photo-gallery:open')
  }

  private handlePhotoGalleryClosed = () => {
    this.isPhotoGalleryOpen = false
  }

  private updateInteractionHint(nearestNpc: VillageNpcInstance | null) {
    if (
      this.isVillagerDialogueOpen ||
      this.settingsMenu.isOpen() ||
      this.isGomokuOpen ||
      this.isPhotoGalleryOpen
    ) {
      this.interactionHint.hide()
      return
    }

    if (this.isPhotoBoothInRange && this.photoBooth) {
      this.interactionHint.show(
        this.photoBooth.x,
        this.photoBooth.y - this.photoBooth.displayHeight,
        '포토부스',
        { badgeLabel: '사진', helpMessage: 'E 또는 Enter로 사진 찍기' },
      )
      return
    }

    if (this.isPhotoGalleryInRange && this.photoGallery) {
      this.interactionHint.show(
        this.photoGallery.x,
        this.photoGallery.y - this.photoGallery.displayHeight,
        '사진 갤러리',
        { badgeLabel: '갤러리', helpMessage: 'E 또는 Enter로 공개 사진 보기' },
      )
      return
    }

    if (this.isGomokuBoardInRange && this.gomokuBoard) {
      this.interactionHint.show(
        this.gomokuBoard.x,
        this.gomokuBoard.y - this.gomokuBoard.displayHeight,
        '\uC624\uBAA9',
        {
          badgeLabel: '\uC624\uBAA9',
          helpMessage: 'E / Enter: \uC624\uBAA9 \uD55C \uD310',
        },
      )
      return
    }

    if (!nearestNpc) {
      this.interactionHint.hide()
      return
    }

    this.interactionHint.show(
      nearestNpc.object.x,
      nearestNpc.object.y - nearestNpc.object.displayHeight,
      villageDialogues[nearestNpc.id].displayName,
    )
  }

  private getPhotoBoothDistance() {
    if (!this.photoBooth) {
      return Number.POSITIVE_INFINITY
    }
    return Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.photoBooth.x,
      this.photoBooth.y,
    )
  }

  private getPhotoGalleryDistance() {
    if (!this.photoGallery) {
      return Number.POSITIVE_INFINITY
    }
    return Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.photoGallery.x,
      this.photoGallery.y,
    )
  }

  private getGomokuBoardDistance() {
    if (!this.gomokuBoard) {
      return Number.POSITIVE_INFINITY
    }

    const rect = this.getGomokuBoardInteractionRect()
    const nearestX = Phaser.Math.Clamp(this.player.x, rect.left, rect.right)
    const nearestY = Phaser.Math.Clamp(this.player.y, rect.top, rect.bottom)

    return Phaser.Math.Distance.Between(this.player.x, this.player.y, nearestX, nearestY)
  }

  private getGomokuBoardInteractionRect() {
    if (!this.gomokuBoard) {
      return new Phaser.Geom.Rectangle(0, 0, 0, 0)
    }

    const width = this.gomokuBoard.displayWidth * GOMOKU_BOARD_INTERACT_RECT.width
    const height = this.gomokuBoard.displayHeight * GOMOKU_BOARD_INTERACT_RECT.height
    const x = this.gomokuBoard.x - this.gomokuBoard.displayWidth * GOMOKU_BOARD_INTERACT_RECT.left
    const y = this.gomokuBoard.y - this.gomokuBoard.displayHeight * GOMOKU_BOARD_INTERACT_RECT.top

    return new Phaser.Geom.Rectangle(x, y, width, height)
  }

  private enterGomokuGame() {
    this.isGomokuOpen = true
    this.target = null
    this.player.setVelocity(0, 0)
    if (this.isVillagerDialogueOpen) {
      this.hideDialog(false)
    }
    this.interactionHint.hide()
    this.game.events.emit('gomoku:open')
  }

  private enterPhotoBoothScene() {
    if (this.isTransitioning) return
    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)
    if (this.isVillagerDialogueOpen) {
      this.hideDialog(false)
    }
    // 마을은 정지(paused) 상태로 두고 FrameSelect 를 위에 띄워서 마을이 반투명하게 비춰 보이게.
    // 다른 photo-booth 씬(Camera/Pick/Result/Save) 은 불투명 배경이라 마을이 가려지므로 그대로 paused.
    // 마지막에 fadeToScene('VillageScene') 으로 복귀 시 Phaser 가 stop + restart 처리.
    this.scene.launch('PhotoBoothFrameSelectScene')
    this.scene.bringToTop('PhotoBoothFrameSelectScene')
    this.scene.pause()
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
