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
import { fadeToScene } from '@/game/systems/sceneTransition'
import { getPlayerMoveSpeed } from '@/game/settings/gameSettings'
import {
  createFloatingInteractionIcon,
  loadInteractionIcons,
  setInteractionIconActive,
} from '@/game/ui/interactionIcon'
import {
  createSimpleDialogUi,
  fadeSimpleDialog,
  setCenteredDialogText,
  type SimpleDialogUi,
} from '@/game/ui/simpleDialog'
import { addCoverBackground } from '@/game/world/background'
import { createRatioRectangle, getRectangleEntryState } from '@/game/world/portal'
import { gisungChoiceDialogs, gisungSelectDialogs } from '../dialog/gisungDialogs'

// gisung_sprite.png is 2400x600 with four dogs in 600-wide cells, but the
// dogs aren't perfectly centered in their cells (dog 1 center=356, dog 2
// center=932 within naive 600-wide halves). We only use the first two frames
// and slice them as 576x600 windows centered on each dog so animation stays
// rock-steady: frame 0 = x[68..644], frame 1 = x[644..1220].
const MUSIC_SPRITE_FRAME = { width: 576, height: 600 }
const MUSIC_SPRITE_FRAME_RECTS: Array<{ x: number; y: number; w: number; h: number }> = [
  { x: 68, y: 0, w: 576, h: 600 },
  { x: 644, y: 0, w: 576, h: 600 },
]
const MUSIC_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.78 }
const MUSIC_EXIT_PORTAL = { xRatio: 0.43, yRatio: 0.86, widthRatio: 0.14, heightRatio: 0.12 }
const MUSIC_RETURN_SPAWN = { xRatio: 0.235, yRatio: 0.44 }
const GISUNG_ON_WINDOW = { xRatio: 0.5, yRatio: 0.42, heightRatio: 0.32 }
const GISUNG_INTERACTION_RADIUS_RATIO = 0.16
const GISUNG_TALK_ICON_OFFSET_RATIO = 1.18
// frame asset is 2172 x 724 — values below are in that pixel space
const DIALOG_TEXT_BOX = { x: 580, y: 180, width: 1500, height: 400 }
const DIALOG_NAME_BOX = { x: 505, y: 107, width: 390, height: 150 }
const CONTENT_CONFIRM_VISIBLE_MS = 1300
const RHYTHM_TARGET_SCENE_KEY = 'MusicSongSelectScene'

// Flow: 인사 → 게임 설명 → 출발 신호. Picked from existing dialog pool so
// the lines flow naturally (no repeated phrases like "귀를 쫑긋").
const INTRO_LINES = [
  gisungSelectDialogs.greeting[0].text, // "오늘은 음악으로 놀아볼 시간이야!"
  gisungChoiceDialogs['rhythm-game'].hover[0].text, // "노래를 잘 듣고, 알맞은 순간에..."
]
const CONFIRM_LINE = gisungChoiceDialogs['rhythm-game'].confirm[1].text // "좋아! 하나, 둘, 셋!..."

type MusicSelectSceneData = {
  spawn?: RatioPoint
}

type MusicDialogPhase = 'closed' | 'intro' | 'confirm'

export class MusicSelectScene extends Phaser.Scene {
  private player!: PlayerSprite
  private gisungNpc!: Phaser.GameObjects.Sprite
  private gisungAnchor = new Phaser.Math.Vector2()
  private gisungInteractionRadius = 0
  private talkIcon!: Phaser.GameObjects.Image
  private dialog!: SimpleDialogUi
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private playerWasInExitPortal = true
  private isTransitioning = false
  private isDialogVisible = false
  private dialogDismissed = false
  private dialogPhase: MusicDialogPhase = 'closed'
  private introStep = 0
  private isWaitingContentStart = false
  private contentStartTimer: Phaser.Time.TimerEvent | null = null

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (this.isDialogVisible) {
      if (this.isWaitingContentStart) {
        return
      }

      const clickedDialog = this.dialog.frame.getBounds().contains(pointer.x, pointer.y)

      if (this.dialogPhase === 'intro' && clickedDialog) {
        this.advanceIntro()
        return
      }

      if (clickedDialog) {
        return
      }

      this.closeDialog(true)
      return
    }

    this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
    createClickTargetMarker(this, pointer.x, pointer.y)
  }

  private readonly handleEnterDown = () => {
    if (this.isDialogVisible) {
      this.advanceDialog()
    }
  }

  private readonly handleEscDown = () => {
    if (this.isDialogVisible) {
      this.closeDialog(true)
    }
  }

  constructor() {
    super({ key: 'MusicSelectScene' })
  }

  preload() {
    this.load.image('music-background', assetPath('images/themes/music/background/background.png'))
    // load as a plain image — frames are defined manually in create() because
    // the two dogs are not symmetrically placed within naive halves of the sheet
    this.load.image(
      'music-gisung-sprite',
      assetPath('images/themes/music/characters/gisung_sprite.png'),
    )
    loadInteractionIcons(this)
    this.load.image('gisung-dialog-frame', assetPath('images/npcs/gisung/dialog-frame.png'))
    loadPlayerSpritesheet(this)
  }

  create(data: MusicSelectSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.isDialogVisible = false
    this.dialogDismissed = false
    this.dialogPhase = 'closed'
    this.introStep = 0
    this.isWaitingContentStart = false
    this.target = null
    this.playerWasInExitPortal = true
    this.clearContentStartTimer()

    const background = addCoverBackground(this, 'music-background')
    this.setupGisungFrames()
    this.createGisungAnimation()
    this.createGisungOnWindow(background)
    this.createDialogUi()

    this.physics.world.setBounds(0, 0, vw, vh)
    ensurePlayerWalkAnimations(this)

    const spawn = data.spawn ?? MUSIC_ROOM_SPAWN
    this.player = createPlayer(this, vw * spawn.xRatio, vh * spawn.yRatio)
    this.exitPortal = createRatioRectangle(vw, vh, MUSIC_EXIT_PORTAL)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.on('pointerdown', this.handlePointerDown)
    this.input.keyboard!.on('keydown-ENTER', this.handleEnterDown)
    this.input.keyboard!.on('keydown-ESC', this.handleEscDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearContentStartTimer()
      this.input.off('pointerdown', this.handlePointerDown)
      this.input.keyboard?.off('keydown-ENTER', this.handleEnterDown)
      this.input.keyboard?.off('keydown-ESC', this.handleEscDown)
    })

    this.cameras.main.fadeIn(250, 0, 0, 0)
  }

  update() {
    const movement = updatePlayerMovement({
      player: this.player,
      cursors: this.cursors,
      target: this.target,
      lastDirection: this.lastDirection,
      speed: getPlayerMoveSpeed(),
      blocked: this.isTransitioning || this.isDialogVisible,
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    this.updateGisungConversation()

    if (this.isDialogVisible) {
      return
    }

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

  private setupGisungFrames() {
    const tex = this.textures.get('music-gisung-sprite')
    if (tex.has('0') && tex.has('1')) {
      return
    }
    MUSIC_SPRITE_FRAME_RECTS.forEach((rect, index) => {
      tex.add(index, 0, rect.x, rect.y, rect.w, rect.h)
    })
  }

  private createGisungAnimation() {
    if (this.anims.exists('music-gisung-play')) {
      return
    }

    this.anims.create({
      key: 'music-gisung-play',
      frames: this.anims.generateFrameNumbers('music-gisung-sprite', { start: 0, end: 1 }),
      frameRate: 1,
      repeat: -1,
    })
  }

  private createGisungOnWindow(background: Phaser.GameObjects.Image) {
    const backgroundLeft = background.x - background.displayWidth / 2
    const backgroundTop = background.y - background.displayHeight / 2
    const frameAspect = MUSIC_SPRITE_FRAME.width / MUSIC_SPRITE_FRAME.height
    const targetHeight = Math.min(
      background.displayHeight * GISUNG_ON_WINDOW.heightRatio,
      (background.displayWidth * 0.14) / frameAspect,
    )
    const displayHeight = targetHeight
    const displayWidth = targetHeight * frameAspect

    this.gisungNpc = this.add
      .sprite(
        backgroundLeft + background.displayWidth * GISUNG_ON_WINDOW.xRatio,
        backgroundTop + background.displayHeight * GISUNG_ON_WINDOW.yRatio,
        'music-gisung-sprite',
        0,
      )
      .setOrigin(0.5, 0.5)
      .setDepth(4)

    this.gisungNpc.setDisplaySize(displayWidth, displayHeight)
    this.gisungNpc.anims.play('music-gisung-play')
    this.gisungAnchor.set(this.gisungNpc.x, this.gisungNpc.y)
    this.gisungInteractionRadius =
      Math.min(background.displayWidth, background.displayHeight) * GISUNG_INTERACTION_RADIUS_RATIO

    this.talkIcon = createFloatingInteractionIcon(this, {
      x: this.gisungNpc.x,
      y: this.gisungNpc.y - this.gisungNpc.displayHeight * (GISUNG_TALK_ICON_OFFSET_RATIO - 0.5),
      displaySize: 44,
      depth: 6,
      bobOffset: 8,
    })
  }

  private createDialogUi() {
    this.dialog = createSimpleDialogUi(this, {
      frameKey: 'gisung-dialog-frame',
      textBox: DIALOG_TEXT_BOX,
      dialogWidthRatio: 0.7,
      maxDialogWidth: 1000,
      fontSize: 46,
      lineSpacing: 6,
      nameBox: DIALOG_NAME_BOX,
      nameText: '기성',
      nameFontColor: '#2a1f17',
      nameFontSize: 48,
      nameLetterSpacing: 6,
      // only flatten the optical offset for single-line text — multi-line keeps default
      opticalOffsets: { single: 0 },
    })
  }

  private updateGisungConversation() {
    if (this.isTransitioning) {
      return
    }

    const distanceToGisung = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.gisungAnchor.x,
      this.gisungAnchor.y,
    )
    const isNearGisung = distanceToGisung <= this.gisungInteractionRadius

    setInteractionIconActive(this.talkIcon, this.isDialogVisible)

    if (!isNearGisung) {
      this.dialogDismissed = false
      return
    }

    if (!this.isDialogVisible && !this.dialogDismissed) {
      this.startGisungConversation()
    }
  }

  private startGisungConversation() {
    this.isWaitingContentStart = false
    this.clearContentStartTimer()
    this.dialogPhase = 'intro'
    this.introStep = 0
    setCenteredDialogText(this.dialog, INTRO_LINES[0])
    this.isDialogVisible = true
    setInteractionIconActive(this.talkIcon, true)
    fadeSimpleDialog(this, this.dialog, 1, 220)
  }

  private advanceDialog() {
    if (this.dialogPhase === 'intro') {
      this.advanceIntro()
    }
  }

  private advanceIntro() {
    if (this.dialogPhase !== 'intro' || this.isWaitingContentStart) {
      return
    }

    if (this.introStep < INTRO_LINES.length - 1) {
      this.introStep += 1
      setCenteredDialogText(this.dialog, INTRO_LINES[this.introStep])
      return
    }

    this.showConfirm()
  }

  private showConfirm() {
    this.dialogPhase = 'confirm'
    this.isWaitingContentStart = true
    setCenteredDialogText(this.dialog, CONFIRM_LINE)

    this.contentStartTimer = this.time.delayedCall(CONTENT_CONFIRM_VISIBLE_MS, () => {
      this.contentStartTimer = null
      this.startRhythmContent()
    })
  }

  private startRhythmContent() {
    if (this.isTransitioning) {
      return
    }

    if (!this.scene.manager.keys[RHYTHM_TARGET_SCENE_KEY]) {
      this.closeDialog(true)
      return
    }

    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)
    this.closeDialog(false)
    fadeToScene(this, RHYTHM_TARGET_SCENE_KEY, { duration: 220 })
  }

  private closeDialog(markDismissed: boolean) {
    this.clearContentStartTimer()
    this.isDialogVisible = false
    this.dialogDismissed = markDismissed
    this.dialogPhase = 'closed'
    this.introStep = 0
    this.isWaitingContentStart = false
    setInteractionIconActive(this.talkIcon, false)
    fadeSimpleDialog(this, this.dialog, 0, 180)
  }

  private clearContentStartTimer() {
    this.contentStartTimer?.remove(false)
    this.contentStartTimer = null
  }

  private returnToVillage() {
    if (this.isTransitioning) {
      return
    }

    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)

    if (this.isDialogVisible) {
      this.closeDialog(false)
    }

    fadeToScene(this, 'VillageScene', {
      duration: 250,
      data: {
        spawn: MUSIC_RETURN_SPAWN,
        portalCooldownMs: 250,
      },
    })
  }
}
