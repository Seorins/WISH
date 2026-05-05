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

const LIGHTHOUSE_ROOM_SPAWN = { xRatio: 0.62, yRatio: 0.76 }
const LIGHTHOUSE_EXIT_PORTAL = { xRatio: 0.28, yRatio: 0.86, widthRatio: 0.18, heightRatio: 0.14 }
const LIGHTHOUSE_RETURN_SPAWN = { xRatio: 0.9, yRatio: 0.46 }
const YOUNGCHEOL_POSITION = { xRatio: 0.28, yRatio: 0.66, heightRatio: 0.18 }
const YOUNGCHEOL_TALK_ICON_OFFSET_RATIO = 0.205
const YOUNGCHEOL_INTERACTION = { xRatio: 0.28, yRatio: 0.64, radiusRatio: 0.06 }
const DIALOG_TEXT_BOX = { x: 520, y: 190, width: 1320, height: 330 }
const DIALOG_NAME_BOX = { x: 455, y: 125, width: 390, height: 90 }
const SYSTEM_PROMPT_DEPTH = 28
const CHOICE_BUTTON_DEPTH = 29
const CHILD_REPLY_DELAY_MS = 520
const CHILD_CHOICE_PROMPT = '선택: 등대지기에게 건넬 말을 골라주세요.'
const SYSTEM_PROMPT_PANEL = {
  widthRatio: 0.68,
  maxWidth: 980,
  height: 78,
  bottomMargin: 42,
  radius: 10,
  paddingX: 28,
}
const CHOICE_BUTTON = {
  gap: 12,
  widthRatio: 0.46,
  maxWidth: 620,
  height: 58,
  radius: 8,
  paddingX: 64,
  bottomGap: 14,
}

const youngcheolLines = [
  '어서 오게. 바다는 늘 천천히 보아야 잘 보인다네.',
  '등대 불빛처럼 마음도 한 번씩 쉬어 가면 좋지.',
  '길을 잃은 것 같을 땐, 가장 밝은 쪽을 천천히 따라가 보게.',
]

const youngcheolReplyLines = [
  '안녕, 나는 등대지기 영철이야. 오늘은 네가 건네는 말로 등대를 밝혀볼까?',
  '바다는 조금 어둡지만 괜찮아. 따뜻한 말 한마디가 길을 비춰줄 수 있거든.',
  '말하고 싶은 문장을 골라줘. 네 목소리가 등대 불빛처럼 전해질 거야.',
]

const getYoungcheolReplyLine = () =>
  Phaser.Utils.Array.GetRandom(
    youngcheolReplyLines.length > 0 ? youngcheolReplyLines : youngcheolLines,
  )

type LighthouseUiMode = 'NPC_DIALOGUE' | 'PLAYER_CHOICE' | 'SYSTEM_PROMPT'

type LighthouseDialogPhase = 'closed' | 'intro' | 'choosing' | 'selected' | 'reply'

type ChildSpeechChoice = {
  id: string
  label: string
  reply: string
}

type ChoiceButtonVisualState = 'normal' | 'hover' | 'focused' | 'pressed' | 'disabled'

type ChoiceButton = {
  container: Phaser.GameObjects.Container
  background: Phaser.GameObjects.Graphics
  marker: Phaser.GameObjects.Text
  label: Phaser.GameObjects.Text
  baseY: number
  choice: ChildSpeechChoice
  disabled: boolean
  state: ChoiceButtonVisualState
  index: number
  width: number
  height: number
}

type SystemPromptUi = {
  panel: Phaser.GameObjects.Graphics
  text: Phaser.GameObjects.Text
  width: number
  height: number
}

const childSpeechChoices: ChildSpeechChoice[] = [
  {
    id: 'hello',
    label: '안녕하세요, 등대지기님!',
    reply: '반갑구나. 네 인사가 등대 안을 환하게 만들어줬어.',
  },
  {
    id: 'help',
    label: '제가 도와드릴게요.',
    reply: '정말 든든하네. 함께라면 멀리 있는 배도 금방 찾을 수 있겠어.',
  },
  {
    id: 'light',
    label: '불빛을 켜 주세요.',
    reply: '좋아. 네 말에 맞춰 등대 불빛을 더 밝게 켜볼게.',
  },
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
  private uiMode: LighthouseUiMode = 'NPC_DIALOGUE'
  private dialogPhase: LighthouseDialogPhase = 'closed'
  private selectedChildLine = ''
  private talkIcon!: Phaser.GameObjects.Image
  private youngcheolAnchor = new Phaser.Math.Vector2()
  private youngcheolInteractionRadius = 0
  private dialog!: SimpleDialogUi
  private systemPrompt!: SystemPromptUi
  private choiceButtons: ChoiceButton[] = []
  private focusedChoiceIndex = 0
  private replyTimer?: Phaser.Time.TimerEvent
  private gamepadChoiceInputAvailableAt = 0

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
    this.uiMode = 'NPC_DIALOGUE'
    this.dialogPhase = 'closed'
    this.selectedChildLine = ''
    this.focusedChoiceIndex = 0
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
    this.createSystemPromptUi()

    const spawn = data.spawn ?? LIGHTHOUSE_ROOM_SPAWN
    this.player = createPlayer(this, vw * spawn.xRatio, vh * spawn.yRatio)
    this.exitPortal = createRatioRectangle(vw, vh, LIGHTHOUSE_EXIT_PORTAL)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.on('pointerdown', this.handlePointerDown)
    this.input.keyboard!.on('keydown-ENTER', this.handleEnterDown)
    this.input.keyboard!.on('keydown-SPACE', this.handleSpaceDown)
    this.input.keyboard!.on('keydown-UP', this.handleChoiceUp)
    this.input.keyboard!.on('keydown-DOWN', this.handleChoiceDown)
    this.input.keyboard!.on('keydown-ESC', this.handleEscDown)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearReplyTimer()
      this.input.off('pointerdown', this.handlePointerDown)
      this.input.keyboard?.off('keydown-ENTER', this.handleEnterDown)
      this.input.keyboard?.off('keydown-SPACE', this.handleSpaceDown)
      this.input.keyboard?.off('keydown-UP', this.handleChoiceUp)
      this.input.keyboard?.off('keydown-DOWN', this.handleChoiceDown)
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
    this.updateGamepadChoiceInput()

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
      if (this.uiMode === 'PLAYER_CHOICE') {
        const clickedChoice = this.choiceButtons.some(
          button =>
            button.container.visible &&
            this.getChoiceButtonBounds(button).contains(pointer.x, pointer.y),
        )
        if (!clickedChoice) return
      }

      const clickedDialog = this.dialog.frame.getBounds().contains(pointer.x, pointer.y)

      if (clickedDialog) {
        this.advanceDialog()
      } else {
        this.closeDialog(true)
      }
      return
    }

    this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
    createClickTargetMarker(this, pointer.x, pointer.y)
  }

  private readonly handleEnterDown = () => {
    if (!this.isDialogVisible) return

    if (this.uiMode === 'PLAYER_CHOICE') {
      this.selectFocusedChoice()
      return
    }

    this.advanceDialog()
  }

  private readonly handleSpaceDown = () => {
    if (this.isDialogVisible && this.uiMode === 'PLAYER_CHOICE') {
      this.selectFocusedChoice()
    }
  }

  private readonly handleChoiceUp = () => {
    if (this.isDialogVisible && this.uiMode === 'PLAYER_CHOICE') {
      this.moveChoiceFocus(-1)
    }
  }

  private readonly handleChoiceDown = () => {
    if (this.isDialogVisible && this.uiMode === 'PLAYER_CHOICE') {
      this.moveChoiceFocus(1)
    }
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

  private createSystemPromptUi() {
    const { width: vw, height: vh } = this.scale
    const panelWidth = Math.min(vw * SYSTEM_PROMPT_PANEL.widthRatio, SYSTEM_PROMPT_PANEL.maxWidth)
    const panelHeight = SYSTEM_PROMPT_PANEL.height
    const x = vw / 2
    const y = vh - SYSTEM_PROMPT_PANEL.bottomMargin - panelHeight / 2

    const panel = this.add.graphics().setDepth(SYSTEM_PROMPT_DEPTH).setScrollFactor(0).setAlpha(0)
    const text = this.add
      .text(x, y, CHILD_CHOICE_PROMPT, {
        fontFamily: '"Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif',
        fontSize: `${Math.max(20, Math.round(Math.min(vw, vh) * 0.031))}px`,
        fontStyle: 'bold',
        color: '#4a3320',
        align: 'center',
        wordWrap: {
          width: panelWidth - SYSTEM_PROMPT_PANEL.paddingX * 2,
          useAdvancedWrap: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(SYSTEM_PROMPT_DEPTH + 1)
      .setScrollFactor(0)
      .setAlpha(0)

    this.systemPrompt = { panel, text, width: panelWidth, height: panelHeight }
    this.drawSystemPromptPanel()
  }

  private drawSystemPromptPanel() {
    const { width: vw, height: vh } = this.scale
    const panel = this.systemPrompt
    const left = vw / 2 - panel.width / 2
    const top = vh - SYSTEM_PROMPT_PANEL.bottomMargin - panel.height

    panel.panel.clear()
    panel.panel.fillStyle(0x2b1b10, 0.28)
    panel.panel.fillRoundedRect(
      left + 6,
      top + 7,
      panel.width,
      panel.height,
      SYSTEM_PROMPT_PANEL.radius,
    )
    panel.panel.fillStyle(0xfff3d4, 0.98)
    panel.panel.lineStyle(4, 0x6d4a27, 1)
    panel.panel.fillRoundedRect(left, top, panel.width, panel.height, SYSTEM_PROMPT_PANEL.radius)
    panel.panel.strokeRoundedRect(left, top, panel.width, panel.height, SYSTEM_PROMPT_PANEL.radius)
    panel.panel.lineStyle(2, 0xf7d894, 1)
    panel.panel.strokeRoundedRect(left + 8, top + 8, panel.width - 16, panel.height - 16, 5)
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
    this.clearReplyTimer()
    this.uiMode = 'NPC_DIALOGUE'
    this.dialogPhase = 'intro'
    this.selectedChildLine = ''
    this.isDialogVisible = true
    setInteractionIconActive(this.talkIcon, true)
    this.hideChoiceButtons()
    this.hideSystemPrompt()
    setCenteredDialogText(this.dialog, Phaser.Utils.Array.GetRandom(youngcheolLines))
    fadeSimpleDialog(this, this.dialog, 1, 220)
  }

  private advanceDialog() {
    if (!this.isDialogVisible) return

    if (this.dialogPhase === 'intro') {
      this.showPlayerChoice()
      return
    }

    if (this.dialogPhase === 'choosing') return

    if (this.dialogPhase === 'selected') {
      this.showYoungcheolReply()
      return
    }

    this.closeDialog(true)
  }

  private showPlayerChoice() {
    this.clearReplyTimer()
    this.uiMode = 'PLAYER_CHOICE'
    this.dialogPhase = 'choosing'
    this.focusedChoiceIndex = 0
    fadeSimpleDialog(this, this.dialog, 0, 120)
    this.showSystemPrompt(CHILD_CHOICE_PROMPT)
    this.showChoiceButtons()
  }

  private showChoiceButtons() {
    this.hideChoiceButtons()

    const { width: vw, height: vh } = this.scale
    const buttonWidth = Math.min(vw * CHOICE_BUTTON.widthRatio, CHOICE_BUTTON.maxWidth)
    const buttonHeight = CHOICE_BUTTON.height
    const totalHeight =
      childSpeechChoices.length * buttonHeight +
      Math.max(0, childSpeechChoices.length - 1) * CHOICE_BUTTON.gap
    const promptTop = vh - SYSTEM_PROMPT_PANEL.bottomMargin - SYSTEM_PROMPT_PANEL.height
    const startX = vw / 2
    const startY = promptTop - CHOICE_BUTTON.bottomGap - totalHeight + buttonHeight / 2
    const fontSize = Math.max(18, Math.round(Math.min(vw, vh) * 0.024))

    childSpeechChoices.forEach((choice, index) => {
      const button = this.choiceButtons[index] ?? this.createChoiceButton(choice, index)

      button.choice = choice
      button.index = index
      button.width = buttonWidth
      button.height = buttonHeight
      button.baseY = startY + index * (buttonHeight + CHOICE_BUTTON.gap)
      button.disabled = false
      button.container.setPosition(startX, button.baseY)
      button.container.setSize(buttonWidth, buttonHeight)
      button.container.input!.hitArea = new Phaser.Geom.Rectangle(
        -buttonWidth / 2,
        -buttonHeight / 2,
        buttonWidth,
        buttonHeight,
      )
      button.label.setText(choice.label)
      button.label.setStyle({
        fontSize: `${fontSize}px`,
        wordWrap: { width: buttonWidth - CHOICE_BUTTON.paddingX * 2, useAdvancedWrap: true },
      })
      button.container.setVisible(true).setAlpha(0)
      this.setChoiceButtonState(button, index === this.focusedChoiceIndex ? 'focused' : 'normal')
      this.tweens.add({
        targets: button.container,
        alpha: 1,
        y: button.baseY - 4,
        duration: 180,
        delay: index * 45,
        ease: 'Sine.easeOut',
      })
    })
  }

  private createChoiceButton(choice: ChildSpeechChoice, index: number) {
    const background = this.add.graphics()
    const marker = this.add
      .text(0, 0, '▶', {
        fontFamily: '"Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#6b401c',
      })
      .setOrigin(0.5)
      .setVisible(false)
    const label = this.add
      .text(0, 0, choice.label, {
        fontFamily: '"Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif',
        fontSize: '24px',
        color: '#4b341f',
        align: 'left',
      })
      .setOrigin(0, 0.5)
    const container = this.add
      .container(0, 0, [background, marker, label])
      .setDepth(CHOICE_BUTTON_DEPTH)
      .setScrollFactor(0)
      .setSize(1, 1)
      .setVisible(false)

    container.setInteractive(
      new Phaser.Geom.Rectangle(-1, -1, 2, 2),
      Phaser.Geom.Rectangle.Contains,
    )
    container.on('pointerover', () => {
      this.focusedChoiceIndex = index
      this.refreshChoiceButtonStates('hover')
      this.input.setDefaultCursor('pointer')
    })
    container.on('pointerout', () => {
      this.refreshChoiceButtonStates()
      this.input.setDefaultCursor('default')
    })
    container.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.pressChoiceButton(index)
      },
    )

    const button = {
      container,
      background,
      marker,
      label,
      baseY: 0,
      choice,
      disabled: false,
      state: 'normal' as ChoiceButtonVisualState,
      index,
      width: 1,
      height: 1,
    }
    this.choiceButtons.push(button)
    return button
  }

  private setChoiceButtonState(button: ChoiceButton, state: ChoiceButtonVisualState) {
    const isFocused = state === 'focused' || state === 'hover'
    const isPressed = state === 'pressed'
    const isDisabled = state === 'disabled'
    const yOffset = isPressed ? 3 : isFocused ? -4 : 0
    const shadowOffset = isPressed ? 2 : 6
    const fillColor = isDisabled ? 0xd7c8ad : isFocused ? 0xffe8ae : 0xfff3d4
    const strokeColor = isDisabled ? 0x9d927e : isFocused ? 0x5a3516 : 0x7a5630
    const innerStrokeColor = isFocused ? 0xffffff : 0xf7d894
    const left = -button.width / 2
    const top = -button.height / 2

    button.state = state
    button.container.y = button.baseY + yOffset
    button.container.setAlpha(isDisabled ? 0.55 : 1)
    button.marker.setVisible(isFocused && !isDisabled)
    button.marker.setPosition(left + 28, 0)
    button.label.setPosition(left + CHOICE_BUTTON.paddingX, 0)
    button.label.setColor(isDisabled ? '#8d806c' : isFocused ? '#24180f' : '#4b341f')

    button.background.clear()
    button.background.fillStyle(0x2b1b10, isDisabled ? 0.12 : 0.26)
    button.background.fillRoundedRect(
      left + 5,
      top + shadowOffset,
      button.width,
      button.height,
      CHOICE_BUTTON.radius,
    )
    button.background.fillStyle(fillColor, 1)
    button.background.lineStyle(4, strokeColor, 1)
    button.background.fillRoundedRect(left, top, button.width, button.height, CHOICE_BUTTON.radius)
    button.background.strokeRoundedRect(
      left,
      top,
      button.width,
      button.height,
      CHOICE_BUTTON.radius,
    )
    button.background.lineStyle(2, innerStrokeColor, isFocused ? 0.95 : 0.8)
    button.background.strokeRoundedRect(
      left + 7,
      top + 7,
      button.width - 14,
      button.height - 14,
      Math.max(3, CHOICE_BUTTON.radius - 4),
    )
  }

  private refreshChoiceButtonStates(hoverState?: ChoiceButtonVisualState) {
    this.choiceButtons.forEach((button, index) => {
      if (!button.container.visible) return

      const state = button.disabled
        ? 'disabled'
        : index === this.focusedChoiceIndex
          ? (hoverState ?? 'focused')
          : 'normal'
      this.setChoiceButtonState(button, state)
    })
  }

  private moveChoiceFocus(direction: 1 | -1) {
    if (this.choiceButtons.length === 0) return

    const optionCount = childSpeechChoices.length
    this.focusedChoiceIndex = Phaser.Math.Wrap(this.focusedChoiceIndex + direction, 0, optionCount)
    this.refreshChoiceButtonStates()
  }

  private selectFocusedChoice() {
    this.pressChoiceButton(this.focusedChoiceIndex)
  }

  private pressChoiceButton(index: number) {
    const button = this.choiceButtons[index]
    if (!button || button.disabled || this.dialogPhase !== 'choosing') return

    this.focusedChoiceIndex = index
    this.setChoiceButtonState(button, 'pressed')
    this.time.delayedCall(90, () => this.handleChoiceSelected(button.choice))
  }

  private showSystemPrompt(line: string) {
    this.uiMode = 'PLAYER_CHOICE'
    this.systemPrompt.text.setText(line)
    this.drawSystemPromptPanel()
    this.tweens.killTweensOf([this.systemPrompt.panel, this.systemPrompt.text])
    this.systemPrompt.panel.setVisible(true)
    this.systemPrompt.text.setVisible(true)
    this.tweens.add({
      targets: [this.systemPrompt.panel, this.systemPrompt.text],
      alpha: 1,
      duration: 160,
      ease: 'Sine.easeOut',
    })
  }

  private hideSystemPrompt() {
    this.tweens.killTweensOf([this.systemPrompt.panel, this.systemPrompt.text])
    this.systemPrompt.panel.setAlpha(0).setVisible(false)
    this.systemPrompt.text.setAlpha(0).setVisible(false)
  }

  private handleChoiceSelected(choice: ChildSpeechChoice) {
    if (!this.isDialogVisible || this.dialogPhase !== 'choosing') return

    this.clearReplyTimer()
    this.uiMode = 'SYSTEM_PROMPT'
    this.dialogPhase = 'selected'
    this.selectedChildLine = choice.label
    this.disableChoiceButtons()
    this.hideSystemPrompt()
    this.hideChoiceButtons()
    fadeSimpleDialog(this, this.dialog, 1, 120)
    setCenteredDialogText(this.dialog, '...')
    this.replyTimer = this.time.delayedCall(CHILD_REPLY_DELAY_MS, () => {
      this.replyTimer = undefined
      this.showYoungcheolReply()
    })
  }

  private showYoungcheolReply() {
    if (!this.isDialogVisible || this.dialogPhase !== 'selected') return

    this.clearReplyTimer()
    const choice = childSpeechChoices.find(option => option.label === this.selectedChildLine)
    this.uiMode = 'NPC_DIALOGUE'
    this.dialogPhase = 'reply'
    this.hideSystemPrompt()
    setCenteredDialogText(this.dialog, choice?.reply ?? getYoungcheolReplyLine())
  }

  private disableChoiceButtons() {
    this.choiceButtons.forEach(button => {
      button.disabled = true
      if (button.container.visible) {
        this.setChoiceButtonState(button, 'disabled')
      }
    })
  }

  private hideChoiceButtons() {
    this.choiceButtons.forEach(button => {
      button.container.setVisible(false).setAlpha(0)
    })
  }

  private getChoiceButtonBounds(button: ChoiceButton) {
    return new Phaser.Geom.Rectangle(
      button.container.x - button.width / 2,
      button.container.y - button.height / 2,
      button.width,
      button.height,
    )
  }

  private updateGamepadChoiceInput() {
    if (!this.isDialogVisible || this.uiMode !== 'PLAYER_CHOICE') return
    if (this.time.now < this.gamepadChoiceInputAvailableAt) return

    const gamepad = this.input.gamepad
    if (!gamepad || gamepad.total <= 0) return

    const pad = gamepad.getPad(0) as unknown as {
      up?: boolean
      down?: boolean
      A?: boolean
      buttons?: Array<{ pressed?: boolean }>
      leftStick?: { y?: number }
      axes?: Array<{ getValue?: () => number }>
    }
    const vertical = pad.leftStick?.y ?? pad.axes?.[1]?.getValue?.() ?? 0
    const wantsUp = Boolean(pad.up || pad.buttons?.[12]?.pressed || vertical < -0.55)
    const wantsDown = Boolean(pad.down || pad.buttons?.[13]?.pressed || vertical > 0.55)
    const wantsConfirm = Boolean(pad.A || pad.buttons?.[0]?.pressed)

    if (wantsUp) {
      this.moveChoiceFocus(-1)
      this.gamepadChoiceInputAvailableAt = this.time.now + 180
      return
    }

    if (wantsDown) {
      this.moveChoiceFocus(1)
      this.gamepadChoiceInputAvailableAt = this.time.now + 180
      return
    }

    if (wantsConfirm) {
      this.selectFocusedChoice()
      this.gamepadChoiceInputAvailableAt = this.time.now + 220
    }
  }

  private closeDialog(markDismissed: boolean) {
    this.clearReplyTimer()
    this.isDialogVisible = false
    this.dialogDismissed = markDismissed
    this.uiMode = 'NPC_DIALOGUE'
    this.dialogPhase = 'closed'
    this.selectedChildLine = ''
    setInteractionIconActive(this.talkIcon, false)
    this.hideChoiceButtons()
    this.hideSystemPrompt()
    fadeSimpleDialog(this, this.dialog, 0, 180)
  }

  private clearReplyTimer() {
    this.replyTimer?.remove(false)
    this.replyTimer = undefined
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
