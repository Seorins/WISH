import Phaser from 'phaser'
import {
  leaveQuizRoom,
  type PromptAssignment,
  type QuizMember,
  type QuizRoomSnapshot,
  type QuizStrokeMessage,
} from '@wish/api-client'
import { QuizRealtimeClient, type QuizRoomEvent } from '@/features/quiz-realtime'
import { assetPath } from '@/game/assets/assetPath'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'

const FONT_FAMILY =
  '"Pretendard Variable", Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, sans-serif'

// 톤: 어두운 네이비 → 밝은 미드네이비로 통일. 캔버스 우드 프레임(BOARD_FRAME) 과 어우러지게.
const PANEL_BG = 0x445d83
const PANEL_BORDER = 0x91a5c4
const CANVAS_BG = 0xfdfdfb
const CANVAS_BORDER = 0x8a5a2f
const BOARD_FRAME = 0xd7a158
const BOARD_FRAME_DARK = 0x8f592a
const PAPER_SHADOW = 0xcbbda5
const SLOT_BG = 0x5b7398
const SLOT_BG_ACTIVE = 0xf4b35f
const SLOT_BG_EMPTY = 0x435a7d
const TOOLBAR_BG = 0x3d557d
const CHIP_BG = 0xffe9c2
const STROKE_THROTTLE_MS = 60

/**
 * 플레이어 슬롯 아바타 — 게임 NPC 캐릭터 이미지(themes/art/coloring/*.png) 의 상반신만 원형 마스크로 잘라 표시.
 * joinOrder 로 4명 NPC 순환. 다른 씬 로드와 충돌 안 나게 quiz 전용 키 사용.
 */
const SLOT_NPCS = ['rumi', 'kongmong', 'gisung', 'seokjae'] as const

function slotNpcKey(joinOrder: number): string {
  const npc = SLOT_NPCS[(joinOrder < 0 ? 0 : joinOrder) % SLOT_NPCS.length]
  return `quiz-avatar-npc-${npc}`
}

function slotNpcPath(joinOrder: number): string {
  const npc = SLOT_NPCS[(joinOrder < 0 ? 0 : joinOrder) % SLOT_NPCS.length]
  return `images/themes/art/coloring/${npc}.png`
}

const BRUSH_COLORS = [
  { label: '빨강', color: '#ff4d4d', value: 0xff4d4d },
  { label: '주황', color: '#ffa64a', value: 0xffa64a },
  { label: '노랑', color: '#ffd84a', value: 0xffd84a },
  { label: '초록', color: '#5cc26b', value: 0x5cc26b },
  { label: '파랑', color: '#4a90e2', value: 0x4a90e2 },
] as const

type Point = { x: number; y: number }
type DrawSegment = {
  from: Point
  to: Point
  color: string
  size: number
  eraser: boolean
}
type Tool = 'brush' | 'eraser'
type QuizMessage = { id: number; kind: 'chat' | 'system' | 'correct'; text: string }

export interface QuizPlaySceneInit {
  snapshot: QuizRoomSnapshot
  currentUserId: number | null
  prompt: PromptAssignment | null
  wordLength: number | null
  realtimeClient: QuizRealtimeClient | null
}

export class QuizPlayScene extends Phaser.Scene {
  private snapshot!: QuizRoomSnapshot
  private currentUserId: number | null = null
  private prompt: PromptAssignment | null = null
  private wordLength: number | null = null
  private realtimeClient: QuizRealtimeClient | null = null

  private root!: Phaser.GameObjects.Container
  private backdrop: Phaser.GameObjects.Rectangle | null = null
  private layoutContainer: Phaser.GameObjects.Container | null = null
  private drawingGraphics: Phaser.GameObjects.Graphics | null = null
  private timerText: Phaser.GameObjects.Text | null = null
  private timerEvent: Phaser.Time.TimerEvent | null = null

  private canvasBounds = new Phaser.Geom.Rectangle()
  private strokes: DrawSegment[] = []
  private remoteLastPoints = new Map<string, Point>()
  private activePointerId: number | null = null
  private activeStrokeId: string | null = null
  private activeLastPoint: Point | null = null
  private lastStrokeSendAt = 0

  private brushColor: string = BRUSH_COLORS[0].color
  private selectedTool: Tool = 'brush'
  private brushSize = 6
  private guessOverlayOpen = false
  private messageSeq = 0
  private messages: QuizMessage[] = []
  private roundEnded = false
  private finalMembers: QuizMember[] | null = null
  private isLeaving = false

  constructor() {
    super('QuizPlayScene')
  }

  init(data: Partial<QuizPlaySceneInit>) {
    if (!data.snapshot) {
      throw new Error('QuizPlayScene requires snapshot via init data')
    }
    this.snapshot = data.snapshot
    this.currentUserId = data.currentUserId ?? null
    this.prompt = data.prompt ?? null
    this.wordLength = data.wordLength ?? data.prompt?.word.length ?? null
    this.realtimeClient = data.realtimeClient ?? null
  }

  preload() {
    if (!this.textures.exists('art-room-background')) {
      this.load.image(
        'art-room-background',
        assetPath('images/themes/art/background/background.png'),
      )
    }
    // 슬롯 아바타 — 4명 정원이라 4명 NPC 모두 미리 로드. 단일 이미지 (themes/art/coloring/*.png) 를 원형 마스크로 잘라 사용.
    SLOT_NPCS.forEach((_, index) => {
      const key = slotNpcKey(index)
      if (!this.textures.exists(key)) {
        this.load.image(key, assetPath(slotNpcPath(index)))
      }
    })
  }

  create() {
    addCoverBackground(this, 'art-room-background')
    this.backdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x0b1020, 0.58)
      .setOrigin(0)
      .setDepth(0)
    this.root = this.add.container(0, 0).setDepth(1)

    this.realtimeClient?.setHandlers({
      onSnapshot: snapshot => {
        this.snapshot = snapshot
        this.drawLayout()
      },
      onPrompt: prompt => {
        this.prompt = prompt
        this.wordLength = prompt.word.length
        this.drawLayout()
      },
      onEvent: event => this.handleRealtimeEvent(event),
      onError: error => this.addMessage('system', friendlyWsError(error.message)),
    })

    this.scale.on('resize', this.layout, this)
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this)
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this)
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this)
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this)
    // 정답 입력은 HTML 오버레이가 담당 — Phaser 키 입력은 한글 IME 처리 불가라 우회 (S14P31E103-820).
    this.game.events.on('quiz-guess:submit', this.handleGuessOverlaySubmit, this)
    this.events.once('shutdown', this.handleShutdown, this)

    // 진입 시점에 이미 라운드가 진행 중이고 본인이 정답자라면 오버레이 즉시 노출.
    if (this.snapshot.status === 'PLAYING' && !this.isDrawer()) {
      this.setGuessOverlay(true)
    }
    this.timerEvent = this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => this.updateTimerText(),
    })

    this.drawLayout()
  }

  private layout() {
    this.backdrop?.setSize(this.scale.width, this.scale.height)
    this.drawLayout()
  }

  private drawLayout() {
    this.layoutContainer?.destroy()
    const container = this.add.container(0, 0)
    this.root.add(container)
    this.layoutContainer = container

    const w = this.scale.width
    const h = this.scale.height
    const padding = 18
    const sidebarW = Math.max(148, Math.min(178, w * 0.13))
    const topBarH = 74
    const bottomBarH = Math.max(126, h * 0.18)
    const canvasAreaTop = padding + topBarH + padding
    const canvasAreaBottom = h - padding - bottomBarH - padding
    const canvasAreaH = canvasAreaBottom - canvasAreaTop

    this.drawTopBar(container, padding, padding, w - padding * 2, topBarH)
    this.drawSidebar(container, padding, canvasAreaTop, sidebarW, canvasAreaH, [0, 2])
    this.drawSidebar(
      container,
      w - padding - sidebarW,
      canvasAreaTop,
      sidebarW,
      canvasAreaH,
      [1, 3],
    )

    const canvasX = padding + sidebarW + padding
    const canvasW = w - padding - sidebarW - padding - padding - sidebarW - padding
    this.drawCanvasArea(container, canvasX, canvasAreaTop, canvasW, canvasAreaH)
    this.drawBottomBar(container, padding, h - padding - bottomBarH, w - padding * 2, bottomBarH)

    if (this.finalMembers) {
      this.drawResultModal(container)
    }
  }

  private drawTopBar(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const panel = this.add.graphics()
    panel.fillStyle(0x060914, 0.2)
    panel.fillRoundedRect(x + 4, y + 5, w - 8, h, 18)
    panel.fillStyle(PANEL_BG, 0.96)
    panel.fillRoundedRect(x, y, w, h, 18)
    panel.fillStyle(0x34435f, 0.38)
    panel.fillRoundedRect(x + 8, y + 8, w - 16, h / 2 - 2, 14)
    panel.lineStyle(3, PANEL_BORDER, 0.95)
    panel.strokeRoundedRect(x, y, w, h, 18)
    container.add(panel)

    const drawer = this.snapshot.members.find(m => m.userId === this.snapshot.currentDrawerUserId)
    const roundChip = this.add.graphics()
    roundChip.fillStyle(0xffd36b, 1)
    roundChip.fillRoundedRect(x + 18, y + 13, 132, h - 26, 18)
    roundChip.lineStyle(3, 0x9a5f21, 1)
    roundChip.strokeRoundedRect(x + 18, y + 13, 132, h - 26, 18)
    container.add(roundChip)
    container.add(
      this.add
        .text(x + 84, y + h / 2 - 1, `ROUND ${this.snapshot.roundNumber}`, {
          fontFamily: FONT_FAMILY,
          fontSize: '17px',
          color: '#4a2f16',
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    )

    const turnLabel = this.add
      .text(x + 168, y + h / 2 - 8, `출제자 ${drawer?.nickname ?? '대기'}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: '#ffe9c2',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
    container.add(turnLabel)

    const pipGap = 18
    const pipStart = x + 170
    for (let i = 0; i < this.snapshot.totalRounds; i++) {
      const active = i + 1 <= this.snapshot.roundNumber
      const pip = this.add.circle(
        pipStart + i * pipGap,
        y + h - 17,
        5,
        active ? 0xffd36b : 0x5b6680,
        1,
      )
      pip.setStrokeStyle(1, active ? 0xfff3c4 : 0x2d374e, 1)
      container.add(pip)
    }

    const promptText = this.isDrawer()
      ? this.prompt?.word
        ? `제시어: ${this.prompt.word}`
        : '제시어 확인 중'
      : this.wordLength
        ? `${this.wordLength}글자`
        : '그림을 맞춰봐!'
    const promptW = Math.min(420, w * 0.36)
    const promptBg = this.add.graphics()
    promptBg.fillStyle(0x121a2b, 1)
    promptBg.fillRoundedRect(x + w / 2 - promptW / 2, y + 10, promptW, h - 20, 20)
    promptBg.lineStyle(2, 0xffe9c2, 0.9)
    promptBg.strokeRoundedRect(x + w / 2 - promptW / 2, y + 10, promptW, h - 20, 20)
    container.add(promptBg)
    const promptLabel = this.add
      .text(x + w / 2, y + h / 2, promptText, {
        fontFamily: FONT_FAMILY,
        fontSize: this.isDrawer() ? '22px' : '21px',
        color: this.isDrawer() ? '#ffd36b' : '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(promptLabel)

    const timerBg = this.add.graphics()
    timerBg.fillStyle(0x0f1626, 1)
    timerBg.fillRoundedRect(x + w - 138, y + 13, 118, h - 26, 18)
    timerBg.lineStyle(2, 0xffe9c2, 0.9)
    timerBg.strokeRoundedRect(x + w - 138, y + 13, 118, h - 26, 18)
    container.add(timerBg)
    this.timerText = this.add
      .text(x + w - 79, y + h / 2, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: '#ffe9c2',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(this.timerText)
    this.updateTimerText()
  }

  private drawSidebar(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    slotIndices: number[],
  ) {
    const gap = 12
    const slotH = (h - gap * (slotIndices.length - 1)) / slotIndices.length
    slotIndices.forEach((index, i) => {
      this.drawPlayerSlot(container, x, y + i * (slotH + gap), w, slotH, index)
    })
  }

  private drawPlayerSlot(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    slotIndex: number,
  ) {
    const member = this.snapshot.members[slotIndex] ?? null
    const isMyself = !!member && member.userId === this.currentUserId
    const isDrawer = !!member && member.userId === this.snapshot.currentDrawerUserId

    const panel = this.add.graphics()
    panel.fillStyle(0x050814, 0.25)
    panel.fillRoundedRect(x + 4, y + 5, w - 2, h, 18)
    panel.fillStyle(!member ? SLOT_BG_EMPTY : isDrawer ? SLOT_BG_ACTIVE : SLOT_BG, 1)
    panel.fillRoundedRect(x, y, w, h, 18)
    panel.fillStyle(0xffffff, member ? 0.08 : 0.03)
    panel.fillRoundedRect(x + 8, y + 8, w - 16, h * 0.34, 14)
    panel.lineStyle(3, isMyself ? 0xffe9c2 : isDrawer ? 0xffd36b : PANEL_BORDER, 1)
    panel.strokeRoundedRect(x, y, w, h, 18)
    container.add(panel)

    if (!member) {
      const plus = this.add.circle(x + w / 2, y + h / 2 - 18, 23, 0x26324a, 1)
      plus.setStrokeStyle(2, 0x51607a, 1)
      container.add(plus)
      container.add(
        this.add
          .text(x + w / 2, y + h / 2 - 19, `${slotIndex + 1}P`, {
            fontFamily: FONT_FAMILY,
            fontSize: '16px',
            color: '#9facc4',
            fontStyle: 'bold',
            align: 'center',
          })
          .setOrigin(0.5),
      )
      container.add(
        this.add
          .text(x + w / 2, y + h / 2 + 24, '대기 중', {
            fontFamily: FONT_FAMILY,
            fontSize: '13px',
            color: '#7d8aa3',
          })
          .setOrigin(0.5),
      )
      return
    }

    // NPC 캐릭터(themes/art/coloring/*.png) 의 상반신만 원형 마스크로 잘라 표시.
    const avatarSize = Math.min(80, w * 0.58)
    const avatarY = y + Math.max(54, h * 0.34)
    const avatarBg = this.add.circle(
      x + w / 2,
      avatarY,
      avatarSize / 2,
      isDrawer ? 0xfff2cc : 0xeaf0ff,
      1,
    )
    avatarBg.setStrokeStyle(3, isDrawer ? 0x7b461a : 0x91a5c4, 1)
    container.add(avatarBg)
    const avatarKey = slotNpcKey(member.joinOrder)
    if (this.textures.exists(avatarKey)) {
      const source = this.textures.get(avatarKey).getSourceImage() as HTMLImageElement
      const srcW = source.width || 1
      const srcH = source.height || 1
      // 짧은 변 기준으로 1.7배 확대해 캐릭터 머리·상반신이 원 안을 꽉 채우게.
      const target = avatarSize * 1.7
      const scale = target / Math.min(srcW, srcH)
      const npc = this.add.image(x + w / 2, avatarY, avatarKey)
      npc.setScale(scale)
      // origin (0.5, 0.32) 로 잡으면 캐릭터 머리 부근이 원 중심에 옴 — 상반신만 자연스럽게 노출.
      npc.setOrigin(0.5, 0.32)
      const mask = this.make
        .graphics({ x: 0, y: 0 })
        .fillStyle(0xffffff, 1)
        .fillCircle(x + w / 2, avatarY, avatarSize / 2 - 2)
      npc.setMask(mask.createGeometryMask())
      container.add(npc)
    }
    container.add(
      this.add
        .text(x + w / 2, y + h - 58, member.nickname, {
          fontFamily: FONT_FAMILY,
          fontSize: '16px',
          color: isDrawer ? '#1a0e05' : '#ffffff',
          fontStyle: 'bold',
          wordWrap: { width: w - 16 },
          align: 'center',
        })
        .setOrigin(0.5),
    )
    const scoreChip = this.add.graphics()
    scoreChip.fillStyle(isDrawer ? 0x4a2f16 : CHIP_BG, 1)
    scoreChip.fillRoundedRect(x + w / 2 - 42, y + h - 38, 84, 26, 13)
    scoreChip.lineStyle(1.5, isDrawer ? 0xffe9c2 : 0x6f5331, 0.9)
    scoreChip.strokeRoundedRect(x + w / 2 - 42, y + h - 38, 84, 26, 13)
    container.add(scoreChip)
    container.add(
      this.add
        .text(x + w / 2, y + h - 25, `${member.score}점`, {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          color: isDrawer ? '#ffe9c2' : '#3a2614',
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    )
    const roleText = isDrawer ? 'DRAW' : `P${slotIndex + 1}`
    const roleColor = isDrawer ? 0x7b461a : 0x101827
    const roleBg = this.add.graphics()
    roleBg.fillStyle(isDrawer ? 0xffe9c2 : 0x44516b, 1)
    roleBg.fillRoundedRect(x + 10, y + 10, isDrawer ? 54 : 38, 24, 12)
    roleBg.lineStyle(1, roleColor, 0.8)
    roleBg.strokeRoundedRect(x + 10, y + 10, isDrawer ? 54 : 38, 24, 12)
    container.add(roleBg)
    if (isDrawer) {
      container.add(
        this.add
          .text(x + 37, y + 22, roleText, {
            fontFamily: FONT_FAMILY,
            fontSize: '12px',
            color: '#3a2614',
            fontStyle: 'bold',
          })
          .setOrigin(0.5),
      )
    } else {
      container.add(
        this.add
          .text(x + 29, y + 22, roleText, {
            fontFamily: FONT_FAMILY,
            fontSize: '12px',
            color: '#ffffff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5),
      )
    }
    if (isMyself) {
      const meBg = this.add.graphics()
      meBg.fillStyle(0xffffff, 1)
      meBg.fillRoundedRect(x + w - 42, y + 10, 32, 24, 12)
      meBg.lineStyle(1, 0x7b461a, 0.8)
      meBg.strokeRoundedRect(x + w - 42, y + 10, 32, 24, 12)
      container.add(meBg)
      container.add(
        this.add
          .text(x + w - 26, y + 22, '나', {
            fontFamily: FONT_FAMILY,
            fontSize: '12px',
            color: '#1a0e05',
            fontStyle: 'bold',
          })
          .setOrigin(0.5),
      )
    }
  }

  private drawCanvasArea(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const frame = Math.max(18, Math.min(26, w * 0.022))
    const paperX = x + frame
    const paperY = y + frame
    const paperW = w - frame * 2
    const paperH = h - frame * 2
    this.canvasBounds.setTo(paperX, paperY, paperW, paperH)
    const canvas = this.add.graphics()
    canvas.fillStyle(0x060914, 0.25)
    canvas.fillRoundedRect(x + 8, y + 10, w, h, 24)
    canvas.fillStyle(BOARD_FRAME_DARK, 1)
    canvas.fillRoundedRect(x, y, w, h, 24)
    canvas.fillStyle(BOARD_FRAME, 1)
    canvas.fillRoundedRect(x + 5, y + 5, w - 10, h - 10, 20)
    canvas.fillStyle(0xffcf7a, 0.38)
    canvas.fillRoundedRect(x + 13, y + 13, w - 26, 26, 14)
    canvas.lineStyle(4, CANVAS_BORDER, 1)
    canvas.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 22)
    canvas.fillStyle(PAPER_SHADOW, 1)
    canvas.fillRoundedRect(paperX + 4, paperY + 5, paperW, paperH, 16)
    canvas.fillStyle(CANVAS_BG, 1)
    canvas.fillRoundedRect(paperX, paperY, paperW, paperH, 16)
    canvas.lineStyle(2, 0xe5dfd3, 1)
    canvas.strokeRoundedRect(paperX + 2, paperY + 2, paperW - 4, paperH - 4, 14)
    container.add(canvas)

    this.drawingGraphics = this.add.graphics()
    container.add(this.drawingGraphics)
    this.redrawStrokes()
  }

  private drawBottomBar(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const panel = this.add.graphics()
    panel.fillStyle(0x050814, 0.28)
    panel.fillRoundedRect(x + 5, y + 6, w - 10, h, 20)
    panel.fillStyle(TOOLBAR_BG, 0.96)
    panel.fillRoundedRect(x, y, w, h, 20)
    panel.fillStyle(0x2d3a55, 0.42)
    panel.fillRoundedRect(x + 10, y + 10, w - 20, h / 2 - 8, 16)
    panel.lineStyle(3, PANEL_BORDER, 1)
    panel.strokeRoundedRect(x, y, w, h, 20)
    container.add(panel)

    if (this.isDrawer()) {
      this.drawDrawerTools(container, x + 30, y, h)
    } else {
      this.drawGuessPanel(container, x + 30, y + 14, w - 182, h - 28)
    }

    this.drawLeaveButton(container, x + w - 30 - 104, y + h / 2 - 24, 104, 48)
  }

  private drawDrawerTools(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    h: number,
  ) {
    const cy = y + h / 2 + 6
    let cx = x
    // 팔레트 swatch — 어두운 베이스 링 제거하고 색만 꽉 채움. 선택된 swatch 만 두꺼운 cream 보더로 강조.
    const size = Math.min(52, h * 0.38)
    BRUSH_COLORS.forEach(option => {
      const selected = this.selectedTool === 'brush' && this.brushColor === option.color
      const radius = size / 2 + (selected ? 4 : 0)
      const swatch = this.add.circle(cx + size / 2, cy, radius, option.value, 1)
      swatch.setStrokeStyle(selected ? 4 : 2, selected ? 0xffe9c2 : 0xffffff, selected ? 1 : 0.85)
      swatch.setInteractive({ useHandCursor: true })
      swatch.on(Phaser.Input.Events.POINTER_DOWN, () => {
        this.selectedTool = 'brush'
        this.brushColor = option.color
        this.drawLayout()
      })
      container.add(swatch)
      cx += size + 18
    })

    container.add(
      this.createToolButton(cx + 52, cy, 96, 48, '지우개', this.selectedTool === 'eraser', () => {
        this.selectedTool = 'eraser'
        this.drawLayout()
      }),
    )
    container.add(
      this.createToolButton(cx + 164, cy, 112, 48, '전체 삭제', false, () => this.clearCanvas()),
    )
  }

  private drawGuessPanel(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const messageH = Math.max(58, h - 54)
    const board = this.add.graphics()
    board.fillStyle(0x101827, 0.82)
    board.fillRoundedRect(x, y, w, messageH - 4, 14)
    board.lineStyle(2, 0x3b4864, 0.9)
    board.strokeRoundedRect(x, y, w, messageH - 4, 14)
    container.add(board)
    container.add(
      this.add
        .text(x + 14, y + 14, '채팅 / 정답 흐름', {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          color: '#ffe9c2',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5),
    )
    const visible = this.messages.slice(-4)
    visible.forEach((message, i) => {
      const color =
        message.kind === 'correct' ? '#7ee08b' : message.kind === 'system' ? '#ffe9c2' : '#d8e2f3'
      container.add(
        this.add
          .text(x + 16, y + 34 + i * 20, message.text, {
            fontFamily: FONT_FAMILY,
            fontSize: '14px',
            color,
            wordWrap: { width: w - 32 },
          })
          .setOrigin(0, 0),
      )
    })

    // 정답 입력은 HTML 오버레이(QuizGuessOverlay) 가 캔버스 아래 sticky 로 띄운다 — Phaser 키 입력은 한글 IME 가 안 됨.
    // 여기엔 입력 영역만큼의 placeholder 만 남겨 둠 (시각적 균형). 입력 활성/비활성은 오버레이의 open 상태가 책임.
    const inputY = y + messageH
    const inputH = 42
    const hintText =
      this.roundEnded || this.finalMembers ? '라운드가 끝났어요' : '아래 입력창에 정답을 적어주세요'
    container.add(
      this.add
        .text(x + 14, inputY + inputH / 2, hintText, {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          color: '#9da8be',
        })
        .setOrigin(0, 0.5),
    )
  }

  private drawLeaveButton(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    container.add(
      this.createToolButton(x + w / 2, y + h / 2, w, h, '나가기', false, () => this.handleLeave()),
    )
  }

  private createToolButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    selected: boolean,
    onClick: () => void,
  ) {
    const container = this.add.container(cx, cy)
    const button = this.add.graphics()
    const radius = Math.min(14, h / 2)
    button.fillStyle(0x050814, 0.28)
    button.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, radius)
    button.fillStyle(selected ? 0xffc45f : 0x34445e, 1)
    button.fillRoundedRect(-w / 2, -h / 2, w, h, radius)
    button.fillStyle(0xffffff, selected ? 0.24 : 0.1)
    button.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h / 2 - 2, radius - 2)
    button.lineStyle(2.5, selected ? 0xfff3c4 : 0x7d8aa3, 1)
    button.strokeRoundedRect(-w / 2, -h / 2, w, h, radius)
    const hit = this.add.rectangle(0, 0, w, h, 0xffffff, 0.001).setOrigin(0.5)
    hit.setInteractive({ useHandCursor: true })
    hit.on(Phaser.Input.Events.POINTER_DOWN, onClick)
    const text = this.add
      .text(0, 0, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: selected ? '#3a2614' : '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add([button, hit, text])
    return container
  }

  private drawResultModal(container: Phaser.GameObjects.Container) {
    const w = this.scale.width
    const h = this.scale.height
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55)
    container.add(overlay)
    const panelW = 520
    const panelH = 390
    const panel = this.add.graphics()
    panel.fillStyle(0x050814, 0.35)
    panel.fillRoundedRect(w / 2 - panelW / 2 + 8, h / 2 - panelH / 2 + 10, panelW, panelH, 24)
    panel.fillStyle(0x243049, 1)
    panel.fillRoundedRect(w / 2 - panelW / 2, h / 2 - panelH / 2, panelW, panelH, 24)
    panel.fillStyle(0xffd36b, 1)
    panel.fillRoundedRect(w / 2 - 150, h / 2 - panelH / 2 - 18, 300, 56, 24)
    panel.lineStyle(4, 0xffe9c2, 1)
    panel.strokeRoundedRect(w / 2 - panelW / 2, h / 2 - panelH / 2, panelW, panelH, 24)
    container.add(panel)
    container.add(
      this.add
        .text(w / 2, h / 2 - 164, '최종 결과', {
          fontFamily: FONT_FAMILY,
          fontSize: '32px',
          color: '#3a2614',
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    )
    const members = [...(this.finalMembers ?? [])].sort((a, b) => b.score - a.score)
    members.forEach((member, i) => {
      const row = this.add.graphics()
      row.fillStyle(i === 0 ? 0x3d2f1d : 0x121a2b, i === 0 ? 0.92 : 0.78)
      row.fillRoundedRect(w / 2 - 190, h / 2 - 106 + i * 42, 380, 34, 14)
      row.lineStyle(1.5, i === 0 ? 0xffd36b : 0x3b4864, 0.9)
      row.strokeRoundedRect(w / 2 - 190, h / 2 - 106 + i * 42, 380, 34, 14)
      container.add(row)
      container.add(
        this.add
          .text(w / 2, h / 2 - 89 + i * 42, `${i + 1}위  ${member.nickname}   ${member.score}점`, {
            fontFamily: FONT_FAMILY,
            fontSize: '20px',
            color: i === 0 ? '#ffd96b' : '#d8e2f3',
            fontStyle: i === 0 ? 'bold' : 'normal',
          })
          .setOrigin(0.5),
      )
    })
    container.add(
      this.createToolButton(w / 2 - 90, h / 2 + 140, 150, 48, '한 판 더', false, () =>
        this.restart(),
      ),
    )
    container.add(
      this.createToolButton(w / 2 + 90, h / 2 + 140, 150, 48, '아트룸으로', false, () =>
        this.handleLeave(),
      ),
    )
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.canDraw()) return
    const point = this.pointerToCanvasPoint(pointer)
    if (!point) {
      return
    }
    this.activePointerId = pointer.id
    this.activeStrokeId = `${this.currentUserId ?? 'me'}-${Date.now()}`
    this.activeLastPoint = point
    this.lastStrokeSendAt = 0
    this.realtimeClient?.publishStroke(this.makeStroke('begin', point))
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.canDraw() || this.activePointerId !== pointer.id || !pointer.isDown) return
    const point = this.pointerToCanvasPoint(pointer)
    if (!point || !this.activeLastPoint) return
    this.appendSegment(
      this.activeLastPoint,
      point,
      this.brushColor,
      this.brushSize,
      this.selectedTool === 'eraser',
    )
    this.activeLastPoint = point
    const now = Date.now()
    if (now - this.lastStrokeSendAt >= STROKE_THROTTLE_MS) {
      this.lastStrokeSendAt = now
      this.realtimeClient?.publishStroke(this.makeStroke('move', point))
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer) {
    if (this.activePointerId !== pointer.id) return
    const point = this.pointerToCanvasPoint(pointer) ?? this.activeLastPoint
    if (point && this.activeLastPoint) {
      this.appendSegment(
        this.activeLastPoint,
        point,
        this.brushColor,
        this.brushSize,
        this.selectedTool === 'eraser',
      )
      this.realtimeClient?.publishStroke(this.makeStroke('end', point))
    }
    this.activePointerId = null
    this.activeStrokeId = null
    this.activeLastPoint = null
  }

  private handleRealtimeEvent(event: QuizRoomEvent) {
    if (event.type === 'member_left') {
      this.snapshot = {
        ...this.snapshot,
        members: this.snapshot.members.filter(member => member.userId !== event.userId),
      }
      this.addMessage('system', '참여자가 나갔어요.')
    } else if (event.type === 'host_changed') {
      this.snapshot = {
        ...this.snapshot,
        hostUserId: event.hostUserId,
        members: this.snapshot.members.map(member => ({
          ...member,
          isHost: member.userId === event.hostUserId,
        })),
      }
    } else if (event.type === 'round_started') {
      this.snapshot = {
        ...this.snapshot,
        status: event.status,
        roundNumber: event.roundNumber,
        currentDrawerUserId: event.currentDrawerUserId,
        roundEndsAtEpochMillis: event.roundEndsAtEpochMillis,
        totalRounds: event.totalRounds,
      }
      this.prompt = null
      this.wordLength = event.wordLength
      this.roundEnded = false
      this.strokes = []
      this.remoteLastPoints.clear()
      this.addMessage('system', `라운드 ${event.roundNumber} 시작`)
      // 정답자(=출제자 아님) 한정으로 정답 입력 오버레이 노출.
      this.setGuessOverlay(!this.isDrawer())
      this.drawLayout()
    } else if (event.type === 'stroke') {
      if (event.userId !== this.currentUserId) {
        this.applyRemoteStroke(event.stroke)
      }
    } else if (event.type === 'guess_submitted') {
      this.addMessage(
        event.correct ? 'correct' : 'chat',
        event.correct ? `${event.nickname} 정답!` : `${event.nickname}: ${event.message}`,
      )
    } else if (event.type === 'round_ended') {
      this.roundEnded = true
      this.snapshot = { ...this.snapshot, members: event.members }
      this.addMessage('system', `정답은 "${event.word}"`)
      // 라운드 종료 시 정답 입력 닫음 — 다음 라운드 시작 이벤트에서 다시 열림.
      this.setGuessOverlay(false)
      this.drawLayout()
    } else if (event.type === 'game_finished') {
      this.finalMembers = event.members
      this.snapshot = { ...this.snapshot, status: 'FINISHED', members: event.members }
      this.setGuessOverlay(false)
      this.drawLayout()
    }
  }

  /** HTML 오버레이 표시/숨김 토글. 멱등 + 중복 emit 회피. */
  private setGuessOverlay(open: boolean) {
    if (this.guessOverlayOpen === open) return
    this.guessOverlayOpen = open
    this.game.events.emit(open ? 'quiz-guess:open' : 'quiz-guess:close')
  }

  private makeStroke(kind: QuizStrokeMessage['kind'], point: Point): QuizStrokeMessage {
    return {
      kind,
      strokeId: this.activeStrokeId ?? undefined,
      x: point.x,
      y: point.y,
      color: this.brushColor,
      size: this.brushSize,
      eraser: this.selectedTool === 'eraser',
    }
  }

  private applyRemoteStroke(stroke: QuizStrokeMessage) {
    if (stroke.kind === 'clear') {
      this.strokes = []
      this.remoteLastPoints.clear()
      this.redrawStrokes()
      return
    }
    if (!stroke.strokeId || stroke.x === undefined || stroke.y === undefined) return
    const point = { x: clamp01(stroke.x), y: clamp01(stroke.y) }
    if (stroke.kind === 'begin') {
      this.remoteLastPoints.set(stroke.strokeId, point)
      return
    }
    const previous = this.remoteLastPoints.get(stroke.strokeId)
    if (previous) {
      this.appendSegment(
        previous,
        point,
        stroke.color ?? '#ff4d4d',
        stroke.size ?? this.brushSize,
        !!stroke.eraser,
      )
    }
    if (stroke.kind === 'end') {
      this.remoteLastPoints.delete(stroke.strokeId)
    } else {
      this.remoteLastPoints.set(stroke.strokeId, point)
    }
  }

  private appendSegment(from: Point, to: Point, color: string, size: number, eraser: boolean) {
    const segment = { from, to, color, size, eraser }
    this.strokes.push(segment)
    this.drawSegment(segment)
  }

  private drawSegment(segment: DrawSegment) {
    if (!this.drawingGraphics) return
    const from = this.canvasToScreen(segment.from)
    const to = this.canvasToScreen(segment.to)
    this.drawingGraphics.lineStyle(
      segment.size,
      segment.eraser ? CANVAS_BG : hexToNumber(segment.color),
      1,
    )
    this.drawingGraphics.beginPath()
    this.drawingGraphics.moveTo(from.x, from.y)
    this.drawingGraphics.lineTo(to.x, to.y)
    this.drawingGraphics.strokePath()
  }

  private redrawStrokes() {
    this.drawingGraphics?.clear()
    this.strokes.forEach(segment => this.drawSegment(segment))
  }

  private clearCanvas() {
    if (!this.canDraw()) return
    this.strokes = []
    this.remoteLastPoints.clear()
    this.redrawStrokes()
    this.realtimeClient?.publishStroke({ kind: 'clear' })
  }

  /**
   * HTML 오버레이({@code QuizGuessOverlay}) 가 Enter/버튼으로 정답을 보내올 때 호출. 출제자 본인이거나 라운드/게임 종료 상태면 무시.
   */
  private handleGuessOverlaySubmit(payload: { text: string }) {
    const text = payload?.text?.trim()
    if (!text || this.isDrawer() || this.roundEnded || this.finalMembers) return
    this.realtimeClient?.publishGuess(text)
  }

  private updateTimerText() {
    if (!this.timerText) return
    if (this.roundEnded) {
      this.timerText.setText('결과 확인')
      return
    }
    const endsAt = this.snapshot.roundEndsAtEpochMillis
    if (!endsAt) {
      this.timerText.setText('--:--')
      return
    }
    const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
    const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
    const ss = String(remaining % 60).padStart(2, '0')
    this.timerText.setText(`${mm}:${ss}`)
  }

  private pointerToCanvasPoint(pointer: Phaser.Input.Pointer): Point | null {
    if (!this.canvasBounds.contains(pointer.x, pointer.y)) return null
    return {
      x: clamp01((pointer.x - this.canvasBounds.x) / this.canvasBounds.width),
      y: clamp01((pointer.y - this.canvasBounds.y) / this.canvasBounds.height),
    }
  }

  private canvasToScreen(point: Point): Point {
    return {
      x: this.canvasBounds.x + point.x * this.canvasBounds.width,
      y: this.canvasBounds.y + point.y * this.canvasBounds.height,
    }
  }

  private isDrawer() {
    return this.currentUserId !== null && this.snapshot.currentDrawerUserId === this.currentUserId
  }

  private canDraw() {
    return this.isDrawer() && !this.roundEnded && !this.finalMembers
  }

  private addMessage(kind: QuizMessage['kind'], text: string) {
    this.messages.push({ id: ++this.messageSeq, kind, text })
    this.messages = this.messages.slice(-8)
    this.drawLayout()
  }

  private async handleLeave() {
    if (this.isLeaving) return
    this.isLeaving = true
    await this.disconnectAndLeave()
    fadeToScene(this, 'ArtSelectScene', { duration: 220 })
  }

  private async restart() {
    if (this.isLeaving) return
    this.isLeaving = true
    await this.disconnectAndLeave()
    fadeToScene(this, 'QuizLobbyScene', { duration: 220 })
  }

  private async disconnectAndLeave() {
    const client = this.realtimeClient
    this.realtimeClient = null
    if (client) {
      await client.disconnect()
    }
    try {
      await leaveQuizRoom()
    } catch {
      // Room may already be closed after game finish.
    }
  }

  private handleShutdown() {
    this.scale.off('resize', this.layout, this)
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this)
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this)
    this.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this)
    this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this)
    this.game.events.off('quiz-guess:submit', this.handleGuessOverlaySubmit, this)
    this.setGuessOverlay(false)
    this.timerEvent?.remove(false)
    if (!this.isLeaving) {
      this.realtimeClient?.setHandlers({
        onSnapshot: () => {},
        onPrompt: () => {},
        onEvent: () => {},
      })
    }
  }
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function hexToNumber(color: string) {
  return Number.parseInt(color.replace('#', ''), 16)
}

function friendlyWsError(raw: string): string {
  if (!raw) return '연결을 확인하는 중...'
  const lower = raw.toLowerCase()
  if (lower.includes('not a member')) return '방 멤버가 아니에요. 다시 입장해줘.'
  if (lower.includes('quiz realtime disabled') || lower.includes('village realtime disabled')) {
    return '실시간 기능이 잠시 꺼져 있어요.'
  }
  return '연결을 다시 시도하는 중...'
}
