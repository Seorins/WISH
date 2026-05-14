import Phaser from 'phaser'
import {
  createQuizRoom,
  ensureFreshAccessToken,
  joinQuizRoom,
  leaveQuizRoom,
  type QuizRoomSnapshot,
} from '@wish/api-client'
import { assetPath } from '@/game/assets/assetPath'
import { QuizRealtimeClient } from '@/features/quiz-realtime'
import type { QuizRoomEvent } from '@/features/quiz-realtime'
import { extractUserIdFromToken } from '@/features/village-realtime/jwtUserId'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'
import { CUTE_CARD_PALETTES, drawCuteCardPanel, drawCutePillButton } from '@/game/ui/cuteCard'

/**
 * 그림 퀴즈 모드 선택 + 멀티플레이 로비 (S14P31E103-820).
 *
 * <p>상태 머신:
 *
 * <ul>
 *   <li>{@code modeSelect} — Step1: 솔로 (AI) / 멀티 두 큰 버튼
 *   <li>{@code multiMethod} — Step2: 방 만들기 / 코드로 입장 두 큰 버튼
 *   <li>{@code creating} — createQuizRoom 진행 중
 *   <li>{@code waitingCode} — React 오버레이가 코드 입력 받는 중
 *   <li>{@code joining} — joinQuizRoom 진행 중
 *   <li>{@code lobby} — WS 연결 + 멤버 슬롯 + 시작 버튼 (방장)
 *   <li>{@code leaving} — leaveQuizRoom + 미술실 복귀
 * </ul>
 *
 * <p>M1 단계: 시작 버튼은 자리만 잡아두고 실제 게임 전이는 M2 에서.
 */
const FONT_FAMILY =
  '"Pretendard Variable", Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, sans-serif'

type LobbyState =
  | 'modeSelect'
  | 'multiMethod'
  | 'creating'
  | 'waitingCode'
  | 'joining'
  | 'lobby'
  | 'leaving'

const PALETTE_HOST = CUTE_CARD_PALETTES.butter
const PALETTE_GUEST = CUTE_CARD_PALETTES.sage
const PALETTE_EMPTY = CUTE_CARD_PALETTES.clay
const PALETTE_DANGER = CUTE_CARD_PALETTES.rose

// 게임 느낌 큰 버튼 컬러 — 채도 높여서 카드 톤과 분리.
const COLOR_SOLO = 0xf4a64a
const COLOR_SOLO_DARK = 0xc77a1f
const COLOR_MULTI = 0x6aaa64
const COLOR_MULTI_DARK = 0x447f3e
const COLOR_CREATE = 0xf4a64a
const COLOR_CREATE_DARK = 0xc77a1f
const COLOR_JOIN = 0x4a8fc4
const COLOR_JOIN_DARK = 0x2e6592

export class QuizLobbyScene extends Phaser.Scene {
  private state: LobbyState = 'modeSelect'
  private snapshot: QuizRoomSnapshot | null = null
  private currentUserId: number | null = null
  private realtimeClient: QuizRealtimeClient | null = null

  private root!: Phaser.GameObjects.Container
  private backdrop: Phaser.GameObjects.Rectangle | null = null
  private statusText!: Phaser.GameObjects.Text

  private menuContainer: Phaser.GameObjects.Container | null = null
  private lobbyContainer: Phaser.GameObjects.Container | null = null

  constructor() {
    super('QuizLobbyScene')
  }

  preload() {
    // ArtSelectScene 도 같은 키로 로드하지만, 다른 진입 경로 (재접속 새로고침 등) 에서 본 씬이 먼저 뜰 수도 있어 안전하게 중복 로드.
    if (!this.textures.exists('art-room-background')) {
      this.load.image(
        'art-room-background',
        assetPath('images/themes/art/background/background.png'),
      )
    }
  }

  create() {
    addCoverBackground(this, 'art-room-background')

    // 메뉴/로비 모두 가독성을 위해 배경 위에 어두운 백드롭을 깔아둔다. alpha 0.55 면 배경 분위기는 살리고 텍스트는 또렷.
    this.backdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.55)
      .setOrigin(0)
      .setDepth(0)
    this.root = this.add.container(0, 0)
    this.root.setDepth(1)

    this.statusText = this.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: '#ffe9c2',
      })
      .setOrigin(0.5)
    this.root.add(this.statusText)

    this.scale.on('resize', this.layout, this)
    this.events.once('shutdown', this.handleShutdown, this)

    this.game.events.on('quiz-join-code:submitted', this.handleCodeSubmitted, this)
    this.game.events.on('quiz-join-code:cancelled', this.handleCodeCancelled, this)

    this.showModeSelect()
  }

  private layout() {
    this.backdrop?.setSize(this.scale.width, this.scale.height)
    if (this.state === 'lobby') {
      this.drawLobby()
    } else if (this.state === 'modeSelect') {
      this.drawModeSelect()
    } else if (this.state === 'multiMethod') {
      this.drawMultiMethod()
    }
    this.statusText.setPosition(this.scale.width / 2, this.scale.height - 48)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // mode select (Step 1: 솔로 / 멀티)

  private showModeSelect() {
    this.state = 'modeSelect'
    this.tearDownLobby()
    this.drawModeSelect()
    this.setStatus('')
  }

  private drawModeSelect() {
    this.menuContainer?.destroy()
    const w = this.scale.width
    const h = this.scale.height
    const container = this.add.container(0, 0)
    this.root.add(container)
    this.menuContainer = container

    this.drawHeader(container, '그림 퀴즈', '어떤 모드로 놀까?')

    // 큰 게임 버튼 2개 가로 배치.
    const buttonW = Math.min(360, (w - 200) / 2)
    const buttonH = 320
    const gap = 56
    const cy = h * 0.55
    const leftX = w / 2 - buttonW / 2 - gap / 2
    const rightX = w / 2 + buttonW / 2 + gap / 2

    container.add(
      this.createBigButton(leftX, cy, buttonW, buttonH, {
        icon: '🎨',
        title: '솔로 모드',
        desc: 'AI 랑 둘이서\n제시어 그림 퀴즈',
        fill: COLOR_SOLO,
        shadow: COLOR_SOLO_DARK,
        onClick: () => this.startSingleplayer(),
      }),
    )

    container.add(
      this.createBigButton(rightX, cy, buttonW, buttonH, {
        icon: '👥',
        title: '멀티 모드',
        desc: '친구들이랑 같이\n그리고 맞춰봐',
        fill: COLOR_MULTI,
        shadow: COLOR_MULTI_DARK,
        onClick: () => this.showMultiMethod(),
      }),
    )

    container.add(
      this.createPillButton(130, h - 90, 200, 56, '← 미술실로', PALETTE_DANGER, () =>
        this.backToArtRoom(),
      ),
    )
  }

  private startSingleplayer() {
    if (this.state !== 'modeSelect') return
    // 혼자 모드는 기존 ArtFreeDrawingScene 단독 플로우. 본 로비/멀티 리소스는 정리하지 않아도 다음 씬에서 재초기화됨.
    fadeToScene(this, 'ArtFreeDrawingScene', { duration: 220 })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // multi method (Step 2: 방 만들기 / 코드 입장)

  private showMultiMethod() {
    if (this.state !== 'modeSelect') return
    this.state = 'multiMethod'
    this.drawMultiMethod()
    this.setStatus('')
  }

  private drawMultiMethod() {
    this.menuContainer?.destroy()
    const w = this.scale.width
    const h = this.scale.height
    const container = this.add.container(0, 0)
    this.root.add(container)
    this.menuContainer = container

    this.drawHeader(container, '멀티 모드', '방을 어떻게 잡을까?')

    const buttonW = Math.min(360, (w - 200) / 2)
    const buttonH = 320
    const gap = 56
    const cy = h * 0.55
    const leftX = w / 2 - buttonW / 2 - gap / 2
    const rightX = w / 2 + buttonW / 2 + gap / 2

    container.add(
      this.createBigButton(leftX, cy, buttonW, buttonH, {
        icon: '🏠',
        title: '방 만들기',
        desc: '코드를 받아서\n친구를 초대해',
        fill: COLOR_CREATE,
        shadow: COLOR_CREATE_DARK,
        onClick: () => this.startCreate(),
      }),
    )

    container.add(
      this.createBigButton(rightX, cy, buttonW, buttonH, {
        icon: '🔑',
        title: '코드로 입장',
        desc: '친구가 알려준\n방 코드를 입력',
        fill: COLOR_JOIN,
        shadow: COLOR_JOIN_DARK,
        onClick: () => this.startJoinByCode(),
      }),
    )

    container.add(
      this.createPillButton(130, h - 90, 200, 56, '← 뒤로', PALETTE_DANGER, () =>
        this.showModeSelect(),
      ),
    )
  }

  private drawHeader(
    container: Phaser.GameObjects.Container,
    titleText: string,
    subtitleText: string,
  ) {
    const w = this.scale.width
    const h = this.scale.height
    const titleY = h * 0.18
    const title = this.add
      .text(w / 2, titleY, titleText, {
        fontFamily: FONT_FAMILY,
        fontSize: '56px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a0e05',
        strokeThickness: 8,
        shadow: { offsetX: 0, offsetY: 4, color: '#000', blur: 8, fill: true },
      })
      .setOrigin(0.5)
    const subtitle = this.add
      .text(w / 2, titleY + 70, subtitleText, {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        color: '#ffe9c2',
        stroke: '#1a0e05',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
    container.add([title, subtitle])
  }

  private startCreate() {
    if (this.state !== 'multiMethod') return
    this.state = 'creating'
    this.setStatus('방 만드는 중…')
    this.tearDownMenu()
    void createQuizRoom()
      .then(snapshot => this.enterLobby(snapshot))
      .catch(error => {
        this.setStatus(extractMessage(error, '방 생성에 실패했어요. 잠시 후 다시 시도해줘.'))
        this.showMultiMethod()
      })
  }

  private startJoinByCode() {
    if (this.state !== 'multiMethod') return
    this.state = 'waitingCode'
    this.tearDownMenu()
    this.setStatus('코드 입력 창을 띄웠어요')
    this.game.events.emit('quiz-join-code:open')
  }

  private handleCodeCancelled() {
    if (this.state !== 'waitingCode') return
    this.showMultiMethod()
  }

  private handleCodeSubmitted(payload: { code: string }) {
    if (this.state !== 'waitingCode') return
    this.state = 'joining'
    this.setStatus('방에 입장하는 중…')
    void joinQuizRoom(payload.code)
      .then(snapshot => this.enterLobby(snapshot))
      .catch(error => {
        this.setStatus(extractMessage(error, '입장에 실패했어요. 코드를 확인해줘.'))
        this.showMultiMethod()
      })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // lobby

  private async enterLobby(snapshot: QuizRoomSnapshot) {
    this.snapshot = snapshot
    this.currentUserId = await this.resolveCurrentUserId()
    this.state = 'lobby'
    this.setStatus('')
    this.connectRealtime(snapshot)
    this.drawLobby()
  }

  private async resolveCurrentUserId(): Promise<number | null> {
    const token = await ensureFreshAccessToken()
    return token ? extractUserIdFromToken(token) : null
  }

  private connectRealtime(snapshot: QuizRoomSnapshot) {
    this.realtimeClient = new QuizRealtimeClient({
      roomId: snapshot.roomId,
      stompRoomKey: snapshot.stompRoomKey,
      getAccessToken: () => ensureFreshAccessToken(),
      onSnapshot: next => {
        this.snapshot = next
        this.drawLobby()
      },
      onEvent: event => this.handleRealtimeEvent(event),
      onError: error => this.setStatus(error.message),
    })
    this.realtimeClient.connect()
  }

  private handleRealtimeEvent(event: QuizRoomEvent) {
    if (!this.snapshot) return
    if (event.type === 'member_joined') {
      const existing = this.snapshot.members.some(m => m.userId === event.member.userId)
      if (!existing) {
        this.snapshot = {
          ...this.snapshot,
          members: [...this.snapshot.members, event.member],
        }
      }
    } else if (event.type === 'member_left') {
      this.snapshot = {
        ...this.snapshot,
        members: this.snapshot.members.filter(m => m.userId !== event.userId),
      }
    } else if (event.type === 'host_changed') {
      this.snapshot = {
        ...this.snapshot,
        hostUserId: event.hostUserId,
        members: this.snapshot.members.map(m => ({ ...m, isHost: m.userId === event.hostUserId })),
      }
    } else if (event.type === 'status_changed') {
      this.snapshot = { ...this.snapshot, status: event.status }
      // M2: PLAYING 으로 바뀌면 플레이 씬으로 전이. 일단 표시만.
    }
    this.drawLobby()
  }

  private drawLobby() {
    if (!this.snapshot) return
    this.lobbyContainer?.destroy()
    const w = this.scale.width
    const h = this.scale.height
    const container = this.add.container(0, 0)
    this.root.add(container)
    this.lobbyContainer = container

    const headerY = h * 0.16
    const header = this.add
      .text(w / 2, headerY, '친구 기다리는 중', {
        fontFamily: FONT_FAMILY,
        fontSize: '36px',
        color: '#3a2614',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(header)

    const codeLabel = this.add
      .text(w / 2, headerY + 56, '방 코드', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: '#6a4a26',
      })
      .setOrigin(0.5)
    const code = this.add
      .text(w / 2, headerY + 92, this.snapshot.code, {
        fontFamily: FONT_FAMILY,
        fontSize: '56px',
        color: '#a85b4d',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add([codeLabel, code])

    // 멤버 슬롯 — 최대 정원만큼 가로 정렬.
    const slotW = 160
    const slotH = 200
    const slotGap = 24
    const totalW = this.snapshot.maxPlayers * slotW + (this.snapshot.maxPlayers - 1) * slotGap
    const slotY = h * 0.55
    let cursorX = w / 2 - totalW / 2 + slotW / 2

    for (let i = 0; i < this.snapshot.maxPlayers; i++) {
      const member = this.snapshot.members[i] ?? null
      const slot = this.createMemberSlot(cursorX, slotY, slotW, slotH, member, i)
      container.add(slot)
      cursorX += slotW + slotGap
    }

    // 액션 버튼.
    const isHost = this.snapshot.hostUserId === this.currentUserId
    const canStart = isHost && this.snapshot.members.length >= this.snapshot.minPlayers
    const buttonY = h - 110
    const buttonW = 240
    const buttonH = 64

    if (isHost) {
      const startBtn = this.createPillButton(
        w / 2 - buttonW / 2 - 16,
        buttonY,
        buttonW,
        buttonH,
        canStart ? '시작' : `친구 ${this.snapshot.minPlayers}명 모이면 시작`,
        canStart ? PALETTE_HOST : PALETTE_EMPTY,
        () => {
          if (canStart) this.handleStartGame()
        },
      )
      container.add(startBtn)
    } else {
      const waitText = this.add
        .text(w / 2 - 8, buttonY, '방장이 시작하면 출발!', {
          fontFamily: FONT_FAMILY,
          fontSize: '18px',
          color: '#6a4a26',
        })
        .setOrigin(1, 0.5)
      container.add(waitText)
    }

    const leaveBtn = this.createPillButton(
      w / 2 + buttonW / 2 + 16 + 90,
      buttonY,
      180,
      buttonH,
      '방 나가기',
      PALETTE_DANGER,
      () => this.handleLeave(),
    )
    container.add(leaveBtn)
  }

  private createMemberSlot(
    cx: number,
    cy: number,
    w: number,
    h: number,
    member: QuizRoomSnapshot['members'][number] | null,
    slotIndex: number,
  ) {
    const container = this.add.container(cx, cy)
    const panel = this.add.graphics()
    const palette = member ? (member.isHost ? PALETTE_HOST : PALETTE_GUEST) : PALETTE_EMPTY
    drawCuteCardPanel(panel, w, h, palette, member ? 'default' : 'default', 20)
    container.add(panel)

    if (member) {
      const initial = (member.nickname || '?').slice(0, 1)
      const avatar = this.add
        .text(0, -h / 2 + 70, initial, {
          fontFamily: FONT_FAMILY,
          fontSize: '48px',
          color: palette.accentHex,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
      const name = this.add
        .text(0, 16, member.nickname, {
          fontFamily: FONT_FAMILY,
          fontSize: '20px',
          color: '#3a2614',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
      const role = this.add
        .text(0, 48, member.isHost ? '방장' : '참여자', {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          color: palette.accentHex,
        })
        .setOrigin(0.5)
      container.add([avatar, name, role])
    } else {
      const placeholder = this.add
        .text(0, 0, `${slotIndex + 1}번 자리 비어있음`, {
          fontFamily: FONT_FAMILY,
          fontSize: '15px',
          color: '#a08868',
        })
        .setOrigin(0.5)
      container.add(placeholder)
    }
    return container
  }

  private handleStartGame() {
    // M2 에서 BE 시작 API + 플레이 씬 전이 구현. 일단 안내.
    this.setStatus('게임 시작은 다음 마일스톤에서 연결돼요')
  }

  private async handleLeave() {
    if (this.state === 'leaving') return
    this.state = 'leaving'
    this.setStatus('나가는 중…')
    await this.tearDownRealtime()
    try {
      await leaveQuizRoom()
    } catch {
      // 이미 떠난 상태라면 무시. UX 상 그대로 art room 으로 복귀.
    }
    this.backToArtRoom()
  }

  private backToArtRoom() {
    fadeToScene(this, 'ArtSelectScene', { duration: 220 })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // shutdown

  private async tearDownRealtime() {
    const client = this.realtimeClient
    this.realtimeClient = null
    if (client) {
      await client.disconnect()
    }
  }

  private tearDownMenu() {
    this.menuContainer?.destroy()
    this.menuContainer = null
  }

  private tearDownLobby() {
    this.lobbyContainer?.destroy()
    this.lobbyContainer = null
  }

  private handleShutdown() {
    this.scale.off('resize', this.layout, this)
    this.game.events.off('quiz-join-code:submitted', this.handleCodeSubmitted, this)
    this.game.events.off('quiz-join-code:cancelled', this.handleCodeCancelled, this)
    void this.tearDownRealtime()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // helpers

  private setStatus(text: string) {
    this.statusText.setText(text)
    this.statusText.setPosition(this.scale.width / 2, this.scale.height - 56)
  }

  /**
   * 게임 느낌의 큰 선택 버튼. 카드 톤이 아니라 RPG 메뉴 스타일 — 두툼한 채도 높은 색 + 짙은 하단 그림자 + 흰색 외곽선 + 큰 이모지 아이콘.
   * hover 시 살짝 위로 떠오르고 그림자가 짧아진다.
   */
  private createBigButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    config: {
      icon: string
      title: string
      desc: string
      fill: number
      shadow: number
      onClick: () => void
    },
  ) {
    const { icon, title, desc, fill, shadow, onClick } = config
    const container = this.add.container(cx, cy)
    const radius = 28
    const shadowOffset = 10

    const shadowG = this.add.graphics()
    const faceG = this.add.graphics()
    const drawButton = (lifted: boolean) => {
      const lift = lifted ? shadowOffset * 0.35 : 0
      const shadowDepth = lifted ? shadowOffset * 0.55 : shadowOffset

      shadowG.clear()
      shadowG.fillStyle(0x000000, 0.35)
      shadowG.fillRoundedRect(-w / 2, -h / 2 + shadowDepth - lift, w, h + shadowOffset, radius)

      faceG.clear()
      // 하단 어두운 면 (3D 두께감)
      faceG.fillStyle(shadow, 1)
      faceG.fillRoundedRect(-w / 2, -h / 2 - lift, w, h + 14, radius)
      // 윗 면 (메인 컬러)
      faceG.fillStyle(fill, 1)
      faceG.fillRoundedRect(-w / 2, -h / 2 - lift, w, h, radius)
      // 상단 글로스
      faceG.fillStyle(0xffffff, 0.18)
      faceG.fillRoundedRect(-w / 2 + 8, -h / 2 - lift + 8, w - 16, h * 0.32, radius - 8)
      // 흰색 외곽선
      faceG.lineStyle(4, 0xffffff, 0.9)
      faceG.strokeRoundedRect(-w / 2, -h / 2 - lift, w, h, radius)
      // 짙은 외곽
      faceG.lineStyle(2, shadow, 1)
      faceG.strokeRoundedRect(-w / 2 - 2, -h / 2 - 2 - lift, w + 4, h + 4, radius + 2)
    }
    drawButton(false)
    container.add([shadowG, faceG])

    const iconText = this.add
      .text(0, -h / 2 + 96, icon, {
        fontFamily: FONT_FAMILY,
        fontSize: '88px',
      })
      .setOrigin(0.5)
    const titleText = this.add
      .text(0, -h / 2 + 192, title, {
        fontFamily: FONT_FAMILY,
        fontSize: '34px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a0e05',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
    const descText = this.add
      .text(0, -h / 2 + 240, desc, {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        color: '#fff4dc',
        align: 'center',
        wordWrap: { width: w - 40 },
      })
      .setOrigin(0.5, 0)
    container.add([iconText, titleText, descText])

    container.setSize(w, h)
    container.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    )
    container.on(Phaser.Input.Events.POINTER_DOWN, onClick)
    container.on(Phaser.Input.Events.POINTER_OVER, () => {
      drawButton(true)
      iconText.y = -h / 2 + 96 - shadowOffset * 0.35
      titleText.y = -h / 2 + 192 - shadowOffset * 0.35
      descText.y = -h / 2 + 240 - shadowOffset * 0.35
      this.input.setDefaultCursor('pointer')
    })
    container.on(Phaser.Input.Events.POINTER_OUT, () => {
      drawButton(false)
      iconText.y = -h / 2 + 96
      titleText.y = -h / 2 + 192
      descText.y = -h / 2 + 240
      this.input.setDefaultCursor('default')
    })
    return container
  }

  private createPillButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    palette: (typeof CUTE_CARD_PALETTES)[keyof typeof CUTE_CARD_PALETTES],
    onClick: () => void,
  ) {
    const container = this.add.container(cx, cy)
    const g = this.add.graphics()
    drawCutePillButton(g, 0, 0, w, h, palette, 'default')
    const text = this.add
      .text(0, 0, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add([g, text])
    container.setSize(w, h)
    container.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    )
    container.on(Phaser.Input.Events.POINTER_DOWN, onClick)
    container.on(Phaser.Input.Events.POINTER_OVER, () => {
      drawCutePillButton(g, 0, 0, w, h, palette, 'hover')
      this.input.setDefaultCursor('pointer')
    })
    container.on(Phaser.Input.Events.POINTER_OUT, () => {
      drawCutePillButton(g, 0, 0, w, h, palette, 'default')
      this.input.setDefaultCursor('default')
    })
    return container
  }
}

function extractMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}
