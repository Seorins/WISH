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
import { createRatioRectangle, isPointInRectangle } from '@/game/world/portal'

const LIGHTHOUSE_ROOM_SPAWN = { xRatio: 0.74, yRatio: 0.76 }
const LIGHTHOUSE_EXIT_PORTAL = { xRatio: 0.44, yRatio: 0.86, widthRatio: 0.12, heightRatio: 0.12 }
const LIGHTHOUSE_RETURN_SPAWN = { xRatio: 0.9, yRatio: 0.46 }
const YOUNGCHEOL_POSITION = { xRatio: 0.28, yRatio: 0.66, heightRatio: 0.18 }
const YOUNGCHEOL_TALK_ICON_OFFSET_RATIO = 0.205
const YOUNGCHEOL_INTERACTION = { xRatio: 0.28, yRatio: 0.64, radiusRatio: 0.06 }
const DIALOG_TEXT_BOX = { x: 520, y: 190, width: 1320, height: 330 }
const DIALOG_NAME_BOX = { x: 455, y: 125, width: 390, height: 90 }

const youngcheolLines = [
  '어서 오게. 바다는 늘 천천히 보아야 잘 보인다네.',
  '등대 불빛처럼 마음도 한 번씩 쉬어 가면 좋지.',
  '길을 잃은 것 같을 땐, 가장 밝은 쪽을 천천히 따라가 보게.',
]

type LighthouseSelectSceneData = {
  spawn?: RatioPoint
}

export class LighthouseSelectScene extends Phaser.Scene {
  private player!: PlayerSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private isTransitioning = false
  private isDialogVisible = false
  private dialogDismissed = false
  private talkIcon!: Phaser.GameObjects.Image
  private youngcheolAnchor = new Phaser.Math.Vector2()
  private youngcheolInteractionRadius = 0
  private dialog!: SimpleDialogUi

  constructor() {
    super({ key: 'LighthouseSelectScene' })
  }

  preload() {
    this.load.image(
      'lighthouse-background',
      assetPath('images/themes/lighthouse/background/Lighthouse.png'),
    )
    this.load.image(
      'lighthouse-youngcheol',
      assetPath('images/themes/lighthouse/characters/youngcheolbuji.png'),
    )
    this.load.image(
      'lighthouse-youngcheol-dialog-frame',
      assetPath('images/themes/lighthouse/ui/youngcheol_dialogframe.png'),
    )
    loadInteractionIcons(this)
    loadPlayerSpritesheet(this)
  }

  create(data: LighthouseSelectSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.isDialogVisible = false
    this.dialogDismissed = false
    this.target = null

    const background = addCoverBackground(this, 'lighthouse-background')
    const backgroundLeft = background.x - background.displayWidth / 2
    const backgroundTop = background.y - background.displayHeight / 2

    this.createYoungcheolCharacter(
      backgroundLeft,
      backgroundTop,
      background.displayWidth,
      background.displayHeight,
    )

    this.talkIcon = createFloatingInteractionIcon(this, {
      x: backgroundLeft + background.displayWidth * YOUNGCHEOL_POSITION.xRatio,
      y:
        backgroundTop +
        background.displayHeight * (YOUNGCHEOL_POSITION.yRatio - YOUNGCHEOL_TALK_ICON_OFFSET_RATIO),
      displaySize: 44,
      depth: 7,
      bobOffset: 10,
    })

    this.youngcheolAnchor.set(
      backgroundLeft + background.displayWidth * YOUNGCHEOL_INTERACTION.xRatio,
      backgroundTop + background.displayHeight * YOUNGCHEOL_INTERACTION.yRatio,
    )
    this.youngcheolInteractionRadius =
      Math.min(background.displayWidth, background.displayHeight) *
      YOUNGCHEOL_INTERACTION.radiusRatio

    this.physics.world.setBounds(0, 0, vw, vh)
    ensurePlayerWalkAnimations(this)
    this.createDialogUi()

    const spawn = data.spawn ?? LIGHTHOUSE_ROOM_SPAWN
    this.player = createPlayer(this, vw * spawn.xRatio, vh * spawn.yRatio)
    this.exitPortal = createRatioRectangle(vw, vh, LIGHTHOUSE_EXIT_PORTAL)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.on('pointerdown', this.handlePointerDown)
    this.input.keyboard!.on('keydown-ENTER', this.handleEnterDown)
    this.input.keyboard!.on('keydown-ESC', this.handleEscDown)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
      blocked: this.isDialogVisible,
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    this.updateYoungcheolConversation()

    if (this.isDialogVisible) return

    if (
      !this.isTransitioning &&
      isPointInRectangle(this.exitPortal, this.player.x, this.player.y)
    ) {
      this.returnToVillage()
    }
  }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (this.isDialogVisible) {
      const clickedDialog = this.dialog.frame.getBounds().contains(pointer.x, pointer.y)
      if (!clickedDialog) this.closeDialog(true)
      return
    }

    this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
    createClickTargetMarker(this, pointer.x, pointer.y)
  }

  private readonly handleEnterDown = () => {
    if (this.isDialogVisible) this.closeDialog(true)
  }

  private readonly handleEscDown = () => {
    if (this.isDialogVisible) this.closeDialog(true)
  }

  private createYoungcheolCharacter(
    backgroundLeft: number,
    backgroundTop: number,
    backgroundWidth: number,
    backgroundHeight: number,
  ) {
    const textureKey = this.createVisibleTexture(
      'lighthouse-youngcheol',
      'lighthouse-youngcheol-visible',
    )
    const source = this.textures.get(textureKey).getSourceImage() as HTMLCanvasElement
    const aspect = source.width / source.height
    const characterHeight = backgroundHeight * YOUNGCHEOL_POSITION.heightRatio
    const characterWidth = characterHeight * aspect
    const x = backgroundLeft + backgroundWidth * YOUNGCHEOL_POSITION.xRatio
    const y = backgroundTop + backgroundHeight * YOUNGCHEOL_POSITION.yRatio

    this.add
      .image(x, y, textureKey)
      .setOrigin(0.5, 1)
      .setDepth(5)
      .setDisplaySize(characterWidth, characterHeight)
  }

  private createVisibleTexture(sourceKey: string, textureKey: string) {
    if (this.textures.exists(textureKey)) return textureKey

    const source = this.textures.get(sourceKey).getSourceImage() as HTMLImageElement
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    const context = canvas.getContext('2d')
    if (!context) return sourceKey

    context.drawImage(source, 0, 0)
    const imageData = context.getImageData(0, 0, source.width, source.height)
    const pixels = imageData.data

    this.makeConnectedBackgroundTransparent(pixels, source.width, source.height)

    let minX = source.width
    let minY = source.height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const alpha = pixels[(y * source.width + x) * 4 + 3]
        if (alpha <= 8) continue
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }

    if (maxX < minX || maxY < minY) return sourceKey

    context.putImageData(imageData, 0, 0)

    const width = maxX - minX + 1
    const height = maxY - minY + 1
    const cropped = document.createElement('canvas')
    cropped.width = width
    cropped.height = height
    const croppedContext = cropped.getContext('2d')
    if (!croppedContext) return sourceKey

    croppedContext.drawImage(canvas, minX, minY, width, height, 0, 0, width, height)
    this.textures.addCanvas(textureKey, cropped)
    return textureKey
  }

  private makeConnectedBackgroundTransparent(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
  ) {
    const visited = new Uint8Array(width * height)
    const queue: number[] = []
    let head = 0

    const enqueue = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return

      const index = y * width + x
      if (visited[index]) return
      visited[index] = 1

      const pixelIndex = index * 4
      const red = pixels[pixelIndex]
      const green = pixels[pixelIndex + 1]
      const blue = pixels[pixelIndex + 2]
      const alpha = pixels[pixelIndex + 3]

      if (alpha <= 8 || (red <= 10 && green <= 10 && blue <= 10)) {
        pixels[pixelIndex + 3] = 0
        queue.push(index)
      }
    }

    for (let x = 0; x < width; x += 1) {
      enqueue(x, 0)
      enqueue(x, height - 1)
    }

    for (let y = 0; y < height; y += 1) {
      enqueue(0, y)
      enqueue(width - 1, y)
    }

    while (head < queue.length) {
      const index = queue[head]
      head += 1

      const x = index % width
      const y = Math.floor(index / width)

      enqueue(x + 1, y)
      enqueue(x - 1, y)
      enqueue(x, y + 1)
      enqueue(x, y - 1)
    }
  }

  private createDialogUi() {
    this.dialog = createSimpleDialogUi(this, {
      frameKey: 'lighthouse-youngcheol-dialog-frame',
      textBox: DIALOG_TEXT_BOX,
      dialogWidthRatio: 0.78,
      maxDialogWidth: 1120,
      fontColor: '#3b2a1f',
      fontSize: 42,
      lineSpacing: 6,
      frameBottomMargin: -22,
      nameBox: DIALOG_NAME_BOX,
      nameText: '등대지기 영철',
      nameFontColor: '#3b2414',
      nameFontSize: 34,
      opticalOffsets: { single: 18, double: 14, multi: 4 },
    })
  }

  private updateYoungcheolConversation() {
    if (this.isTransitioning) return

    const distanceToYoungcheol = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.youngcheolAnchor.x,
      this.youngcheolAnchor.y,
    )
    const isNearYoungcheol = distanceToYoungcheol <= this.youngcheolInteractionRadius

    setInteractionIconActive(this.talkIcon, this.isDialogVisible)

    if (!isNearYoungcheol) {
      this.dialogDismissed = false
      return
    }

    if (!this.isDialogVisible && !this.dialogDismissed) {
      this.startYoungcheolConversation()
    }
  }

  private startYoungcheolConversation() {
    setCenteredDialogText(this.dialog, Phaser.Utils.Array.GetRandom(youngcheolLines))
    this.isDialogVisible = true
    setInteractionIconActive(this.talkIcon, true)
    fadeSimpleDialog(this, this.dialog, 1, 220)
  }

  private closeDialog(markDismissed: boolean) {
    this.isDialogVisible = false
    this.dialogDismissed = markDismissed
    setInteractionIconActive(this.talkIcon, false)
    fadeSimpleDialog(this, this.dialog, 0, 180)
  }

  private returnToVillage() {
    if (this.isTransitioning) return

    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)

    if (this.isDialogVisible) this.closeDialog(false)

    fadeToScene(this, 'VillageScene', {
      duration: 250,
      data: {
        spawn: LIGHTHOUSE_RETURN_SPAWN,
        portalCooldownMs: 250,
      },
    })
  }
}
