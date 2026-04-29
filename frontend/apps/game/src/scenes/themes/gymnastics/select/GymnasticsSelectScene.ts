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
import {
  createRatioRectangle,
  getRectangleEntryState,
  isPointInRectangle,
} from '@/game/world/portal'
import { seongsuDialogs, type SeongsuDialogLine } from './dialog/seongsuDialogs'

const TALK_DISTANCE = 100
const GYMNASTICS_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.76 }
const GYMNASTICS_EXIT_PORTAL = { xRatio: 0.44, yRatio: 0.86, widthRatio: 0.12, heightRatio: 0.12 }
const GYMNASTICS_RETURN_SPAWN = { xRatio: 0.72, yRatio: 0.58 }
const DIALOG_TEXT_BOX = { x: 900, y: 445, width: 1040, height: 190 }
const GYM_SELECT_CARD_SIZE = { width: 538, height: 785 }
const GYM_SELECT_TITLE_SIZE = { width: 893, height: 207 }
const RACCOON_IDLE_ANIM_KEY = 'raccoon-gymnastics-idle'
const RACCOON_TEXTURE_KEY = 'raccoon-clean'
const RACCOON_FRAME_SIZE = 360
const RACCOON_CROP_RECTS = [
  { x: 120, y: 640, width: 360, height: 340 },
  { x: 580, y: 640, width: 360, height: 340 },
  { x: 1040, y: 640, width: 360, height: 340 },
  { x: 1460, y: 640, width: 360, height: 340 },
]

type GymnasticsSelectSceneData = {
  spawn?: RatioPoint
}

export class GymnasticsSelectScene extends Phaser.Scene {
  private player!: PlayerSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private isTransitioning = false
  private playerWasInExitPortal = true

  private raccoon!: Phaser.GameObjects.Sprite
  private raccoonAnchor = new Phaser.Math.Vector2()
  private talkIcon!: Phaser.GameObjects.Image
  private dialog!: SimpleDialogUi
  private isDialogVisible = false
  private dialogDismissed = false
  private dialogSteps: SeongsuDialogLine[] = []
  private dialogStepIndex = 0

  private isSelectVisible = false
  private selectContainer: Phaser.GameObjects.Container | null = null

  constructor() {
    super({ key: 'GymnasticsSelectScene' })
  }

  preload() {
    this.load.image(
      'gymnastics-background',
      assetPath('images/themes/gymnastics/background/background.png'),
    )

    this.load.image('raccoon', assetPath('images/themes/gymnastics/characters/Raccoon.png'))

    this.load.image(
      'raccoon-source',
      assetPath('images/themes/gymnastics/characters/raccoon_exercise_spritesheet.png'),
    )

    this.load.image(
      'gym-select-title',
      assetPath('images/themes/gymnastics/ui/gym_select_title_component.png'),
    )
    this.load.image(
      'gym-card-top',
      assetPath('images/themes/gymnastics/ui/topgymnastics_select.png'),
    )
    this.load.image(
      'gym-card-daniel',
      assetPath('images/themes/gymnastics/ui/daniel_gymnastics_select.png'),
    )
    loadInteractionIcons(this)
    this.load.image('seongsu-dialog', assetPath('images/npcs/seongsu/dialog-frame.png'))
    loadPlayerSpritesheet(this)
  }

  create(data: GymnasticsSelectSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.isDialogVisible = false
    this.isSelectVisible = false
    this.dialogDismissed = false
    this.dialogSteps = []
    this.dialogStepIndex = 0

    this.target = null

    addCoverBackground(this, 'gymnastics-background')
    this.physics.world.setBounds(0, 0, vw, vh)

    const raccoonX = vw * 0.58
    const raccoonY = vh * 0.6
    const raccoonH = vh * 0.18
    this.createCleanRaccoonTexture()
    this.ensureRaccoonAnimations()
    this.raccoon = this.add.sprite(raccoonX, raccoonY, RACCOON_TEXTURE_KEY, 0)
    this.raccoon.setOrigin(0.5, 0.58).setDisplaySize(raccoonH, raccoonH).setDepth(5)
    this.raccoon.play(RACCOON_IDLE_ANIM_KEY)
    this.raccoonAnchor.set(raccoonX, raccoonY)

    this.talkIcon = createFloatingInteractionIcon(this, {
      x: raccoonX,
      y: raccoonY - raccoonH * 0.55,
      displaySize: 44,
      depth: 6,
      bobOffset: 10,
    })

    this.createDialogUi()
    ensurePlayerWalkAnimations(this)

    const spawn = data.spawn ?? GYMNASTICS_ROOM_SPAWN
    this.player = createPlayer(this, vw * spawn.xRatio, vh * spawn.yRatio)
    this.exitPortal = createRatioRectangle(vw, vh, GYMNASTICS_EXIT_PORTAL)
    this.cursors = this.input.keyboard!.createCursorKeys()

    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.isDialogVisible) this.advanceDialog()
    })

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.isDialogVisible) this.closeDialog(true)
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isSelectVisible) return

      if (this.isDialogVisible) {
        const bounds = this.dialog.frame.getBounds()
        if (isPointInRectangle(bounds, pointer.x, pointer.y)) {
          this.advanceDialog()
        } else {
          this.closeDialog(true)
        }
        return
      }

      this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
      createClickTargetMarker(this, pointer.x, pointer.y)
    })

    this.playerWasInExitPortal = true
    this.cameras.main.fadeIn(250, 0, 0, 0)
  }

  update() {
    if (this.isSelectVisible) return

    const movement = updatePlayerMovement({
      player: this.player,
      cursors: this.cursors,
      target: this.target,
      lastDirection: this.lastDirection,
      blocked: this.isDialogVisible,
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    this.updateSeongsuConversation()

    if (this.isDialogVisible) return

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

  private updateSeongsuConversation() {
    if (this.isTransitioning) return

    const dist = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.raccoonAnchor.x,
      this.raccoonAnchor.y,
    )

    if (dist > TALK_DISTANCE) {
      this.dialogDismissed = false
      return
    }

    if (!this.isDialogVisible && !this.dialogDismissed) {
      this.startConversation()
    }
  }

  private createDialogUi() {
    this.dialog = createSimpleDialogUi(this, {
      frameKey: 'seongsu-dialog',
      textBox: DIALOG_TEXT_BOX,
      dialogWidthRatio: 0.78,
      maxDialogWidth: 1080,
      fontSize: 40,
      lineSpacing: 4,
    })
  }

  private createCleanRaccoonTexture() {
    if (this.textures.exists(RACCOON_TEXTURE_KEY)) return

    const source = this.textures.get('raccoon-source').getSourceImage() as HTMLImageElement
    const canvas = document.createElement('canvas')
    canvas.width = RACCOON_FRAME_SIZE * RACCOON_CROP_RECTS.length
    canvas.height = RACCOON_FRAME_SIZE
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Raccoon canvas context is not available.')
    }

    RACCOON_CROP_RECTS.forEach((rect, index) => {
      context.drawImage(
        source,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        index * RACCOON_FRAME_SIZE,
        RACCOON_FRAME_SIZE - rect.height,
        rect.width,
        rect.height,
      )
    })

    const texture = this.textures.addCanvas(RACCOON_TEXTURE_KEY, canvas)
    if (!texture) {
      throw new Error('Clean raccoon texture is not available.')
    }

    RACCOON_CROP_RECTS.forEach((_, index) => {
      texture.add(index, 0, index * RACCOON_FRAME_SIZE, 0, RACCOON_FRAME_SIZE, RACCOON_FRAME_SIZE)
    })
  }

  private ensureRaccoonAnimations() {
    if (this.anims.exists(RACCOON_IDLE_ANIM_KEY)) return

    this.anims.create({
      key: RACCOON_IDLE_ANIM_KEY,
      frames: this.anims.generateFrameNumbers(RACCOON_TEXTURE_KEY, { start: 0, end: 3 }),
      frameRate: 1.2,
      repeat: -1,
    })
  }

  private startConversation() {
    this.dialogSteps = [
      Phaser.Utils.Array.GetRandom(seongsuDialogs.guide),
      Phaser.Utils.Array.GetRandom(seongsuDialogs.choicePrompt),
    ]
    this.dialogStepIndex = 0
    setCenteredDialogText(this.dialog, this.dialogSteps[0].text)
    this.isDialogVisible = true
    setInteractionIconActive(this.talkIcon, true)
    fadeSimpleDialog(this, this.dialog, 1, 220)
  }

  private advanceDialog() {
    if (this.dialogStepIndex < this.dialogSteps.length - 1) {
      this.dialogStepIndex += 1
      setCenteredDialogText(this.dialog, this.dialogSteps[this.dialogStepIndex].text)
      return
    }
    // 마지막 단계 → 대화 닫고 선택 화면 표시
    this.closeDialog(false)
    this.showContentSelection()
  }

  private closeDialog(markDismissed: boolean) {
    this.isDialogVisible = false
    this.dialogDismissed = markDismissed
    this.dialogSteps = []
    this.dialogStepIndex = 0
    setInteractionIconActive(this.talkIcon, false)
    fadeSimpleDialog(this, this.dialog, 0, 180)
  }

  private showContentSelection() {
    const { width: vw, height: vh } = this.scale
    this.isSelectVisible = true
    this.player.setVelocity(0, 0)

    const titleW = Math.min(vw * 0.34, 420)
    const titleH = titleW * (GYM_SELECT_TITLE_SIZE.height / GYM_SELECT_TITLE_SIZE.width)
    const titleY = Math.max(vh * 0.11, titleH / 2 + 24)
    const title = this.add
      .image(vw / 2, titleY, 'gym-select-title')
      .setDepth(20)
      .setScrollFactor(0)
      .setAlpha(0)
    title.setDisplaySize(titleW, titleH)

    const gap = Phaser.Math.Clamp(vw * 0.06, 36, 96)
    const cardAspect = GYM_SELECT_CARD_SIZE.width / GYM_SELECT_CARD_SIZE.height
    const rowMaxWidth = vw * 0.86
    const maxCardHByWidth = (rowMaxWidth - gap) / 2 / cardAspect
    const cardTop = titleY + titleH / 2 + Phaser.Math.Clamp(vh * 0.035, 24, 44)
    const cardBottomPadding = Math.max(28, vh * 0.04)
    const maxCardHByHeight = vh - cardTop - cardBottomPadding
    const cardH = Math.max(280, Math.min(640, vh * 0.68, maxCardHByWidth, maxCardHByHeight))
    const cardW = cardH * cardAspect
    const cardY = cardTop + cardH / 2
    const firstCardX = vw / 2 - (cardW + gap) / 2
    const secondCardX = vw / 2 + (cardW + gap) / 2

    const topCard = this.add.image(0, cardY, 'gym-card-top').setDepth(20).setAlpha(0)
    topCard.setScrollFactor(0).setDisplaySize(cardW, cardH).setX(firstCardX)

    const danielCard = this.add.image(0, cardY, 'gym-card-daniel').setDepth(20).setAlpha(0)
    danielCard.setScrollFactor(0).setDisplaySize(cardW, cardH).setX(secondCardX)

    this.makeCardClickable(topCard, () => this.selectContent('top'))
    this.makeCardClickable(danielCard, () => this.selectContent('daniel'))

    const backBtn = this.createBackButton(104, Math.max(44, vh * 0.07))

    this.selectContainer = this.add.container(0, 0, [title, topCard, danielCard, backBtn])
    this.selectContainer.setDepth(20)

    this.tweens.add({
      targets: [title, topCard, danielCard, backBtn],
      alpha: 1,
      duration: 300,
      ease: 'Sine.easeOut',
    })
  }

  private closeContentSelection() {
    if (!this.selectContainer) return
    this.selectContainer.destroy(true)
    this.selectContainer = null
    this.isSelectVisible = false
    this.dialogDismissed = true
  }

  private createBackButton(x: number, y: number): Phaser.GameObjects.Container {
    const btnW = 160
    const btnH = 52
    const radius = 14

    const bg = this.add.graphics()
    bg.fillStyle(0xc67c2e, 1)
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, radius)
    bg.lineStyle(3, 0x7a4510, 1)
    bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, radius)

    const label = this.add
      .text(0, 0, '뒤로가기', {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        color: '#fff8e7',
        stroke: '#7a4510',
        strokeThickness: 3,
      })
      .setOrigin(0.5)

    const hitArea = this.add
      .rectangle(0, 0, btnW, btnH, 0x000000, 0)
      .setInteractive({ useHandCursor: true })

    hitArea.on('pointerover', () => bg.setAlpha(0.85))
    hitArea.on('pointerout', () => bg.setAlpha(1))
    hitArea.on('pointerdown', () => this.closeContentSelection())

    return this.add
      .container(x, y, [bg, label, hitArea])
      .setDepth(25)
      .setScrollFactor(0)
      .setAlpha(0)
  }

  private makeCardClickable(card: Phaser.GameObjects.Image, onClick: () => void) {
    const baseScaleX = card.scaleX
    const baseScaleY = card.scaleY

    card.setInteractive({ useHandCursor: true })
    card.on('pointerover', () => card.setScale(baseScaleX * 1.03, baseScaleY * 1.03))
    card.on('pointerout', () => card.setScale(baseScaleX, baseScaleY))
    card.on('pointerdown', onClick)
  }

  private selectContent(mode: 'top' | 'daniel') {
    if (this.isTransitioning) return
    this.isTransitioning = true

    const sceneKey = mode === 'top' ? 'GymnasticsTopScene' : 'GymnasticsDanielScene'
    fadeToScene(this, sceneKey, { duration: 250 })
  }

  private returnToVillage() {
    if (this.isTransitioning) return
    this.isTransitioning = true

    fadeToScene(this, 'VillageScene', {
      duration: 250,
      data: { spawn: GYMNASTICS_RETURN_SPAWN },
    })
  }
}
