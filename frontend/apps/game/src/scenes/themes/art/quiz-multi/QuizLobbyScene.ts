import Phaser from 'phaser'
import {
  createQuizRoom,
  ensureFreshAccessToken,
  joinQuizRoom,
  leaveQuizRoom,
  startQuizRoom,
  type PromptAssignment,
  type QuizRoomSnapshot,
} from '@wish/api-client'
import { assetPath } from '@/game/assets/assetPath'
import { QuizRealtimeClient } from '@/features/quiz-realtime'
import type { QuizRoomEvent } from '@/features/quiz-realtime'
import { extractUserIdFromToken } from '@/features/village-realtime/jwtUserId'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'
import { CUTE_CARD_PALETTES } from '@/game/ui/cuteCard'

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
  | 'starting'
  | 'transitioningToPlay'
  | 'leaving'

const PALETTE_DANGER = CUTE_CARD_PALETTES.rose

// 카드 팔레트 — 채도 톤다운된 코디네이션 페어. 이전엔 #f4a64a/#6aaa64/#4a8fc4 가 너무 쨍해서 산만했음.
// 같은 채도/명도 패밀리에서 따뜻함(피치/테라코타) ↔ 차분함(세이지/슬레이트) 으로만 갈라줌.
const COLOR_WARM = 0xe89865
const COLOR_WARM_DARK = 0xb06840
const COLOR_COOL = 0x82b596
const COLOR_COOL_DARK = 0x517e64
const COLOR_SLATE = 0x7c9bc0
const COLOR_SLATE_DARK = 0x4f6c91

// 슬롯 아바타 — QuizPlayScene 과 동일한 char1~4 (art/ui) 를 joinOrder 기준 1~4 순환으로 사용.
// 게임 화면과 로비에서 같은 캐릭터가 같은 자리에 보이도록 매핑 동기화.
const SLOT_CHAR_NUMBERS = [1, 2, 3, 4] as const
const SLOT_CHAR_CROP_RATIO = 0.55

function slotCharKey(joinOrder: number): string {
  const n = SLOT_CHAR_NUMBERS[(joinOrder < 0 ? 0 : joinOrder) % SLOT_CHAR_NUMBERS.length]
  return `quiz-lobby-char${n}`
}

function slotCharPath(joinOrder: number): string {
  const n = SLOT_CHAR_NUMBERS[(joinOrder < 0 ? 0 : joinOrder) % SLOT_CHAR_NUMBERS.length]
  return `images/themes/art/ui/char${n}.png`
}

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
    // 슬롯 아바타 — 멤버 슬롯에 NPC 캐릭터 상반신을 노출. 게임 씬과 같은 char1~4.
    SLOT_CHAR_NUMBERS.forEach((_, index) => {
      const key = slotCharKey(index)
      if (!this.textures.exists(key)) {
        this.load.image(key, assetPath(slotCharPath(index)))
      }
    })
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
        fill: COLOR_WARM,
        shadow: COLOR_WARM_DARK,
        onClick: () => this.startSingleplayer(),
      }),
    )

    container.add(
      this.createBigButton(rightX, cy, buttonW, buttonH, {
        icon: '👥',
        title: '멀티 모드',
        desc: '친구들이랑 같이\n그리고 맞춰봐',
        fill: COLOR_COOL,
        shadow: COLOR_COOL_DARK,
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
    // 진입 경로: 멀티 버튼 클릭 / 코드 입력 취소 / 방 생성·입장 실패 복구.
    // 가드는 lobby 진입 후 역행만 막으면 충분 — modeSelect-only 가드는 cancel/error 복구를 깨뜨려서 제거.
    if (this.state === 'lobby' || this.state === 'leaving') return
    this.state = 'multiMethod'
    this.tearDownLobby()
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
        fill: COLOR_WARM,
        shadow: COLOR_WARM_DARK,
        onClick: () => this.startCreate(),
      }),
    )

    container.add(
      this.createBigButton(rightX, cy, buttonW, buttonH, {
        icon: '🔑',
        title: '코드로 입장',
        desc: '친구가 알려준\n방 코드를 입력',
        fill: COLOR_SLATE,
        shadow: COLOR_SLATE_DARK,
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
    void this.createRoomWithStaleCleanup()
  }

  /**
   * 방 생성 시 Q-004(이미 방에 있음) 가 떨어지면 BE 가 들고 있는 stale 방을 정리하고 한 번 더 시도. 페이지 새로고침/이탈 등으로 이전 세션이
   * 깔끔하게 정리되지 못한 케이스를 자동 복구한다. (BE 의 WS disconnect 정리 흐름은 별도 카드)
   */
  private async createRoomWithStaleCleanup() {
    try {
      const snapshot = await createQuizRoom()
      await this.enterLobby(snapshot)
    } catch (error) {
      if (isAlreadyInRoomError(error)) {
        try {
          await leaveQuizRoom()
          const snapshot = await createQuizRoom()
          await this.enterLobby(snapshot)
          return
        } catch (retryError) {
          this.setStatus(extractMessage(retryError, '방 생성에 실패했어요. 잠시 후 다시 시도해줘.'))
          this.showMultiMethod()
          return
        }
      }
      this.setStatus(extractMessage(error, '방 생성에 실패했어요. 잠시 후 다시 시도해줘.'))
      this.showMultiMethod()
    }
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
    void this.joinRoomWithStaleCleanup(payload.code)
  }

  /** 입장 시 Q-004 가 떨어지면 stale 정리 후 재시도 — createRoomWithStaleCleanup 과 동일 사유. */
  private async joinRoomWithStaleCleanup(code: string) {
    try {
      const snapshot = await joinQuizRoom(code)
      await this.enterLobby(snapshot)
    } catch (error) {
      if (isAlreadyInRoomError(error)) {
        try {
          await leaveQuizRoom()
          const snapshot = await joinQuizRoom(code)
          await this.enterLobby(snapshot)
          return
        } catch (retryError) {
          this.setStatus(extractMessage(retryError, '입장에 실패했어요. 코드를 확인해줘.'))
          this.showMultiMethod()
          return
        }
      }
      this.setStatus(extractMessage(error, '입장에 실패했어요. 코드를 확인해줘.'))
      this.showMultiMethod()
    }
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
      onPrompt: () => {},
      onEvent: event => this.handleRealtimeEvent(event),
      onError: error => this.setStatus(friendlyWsError(error.message)),
      onReady: () => this.setStatus(''),
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
    } else if (event.type === 'round_started') {
      // 게스트 진입 경로: 호스트가 /start 호출 → BE broadcast → 여기서 플레이 씬 전이.
      // 호스트는 REST 응답 핸들러에서 직접 전이하므로(이미 state=transitioningToPlay), 중복 호출 안 됨.
      this.snapshot = {
        ...this.snapshot,
        status: event.status,
        roundNumber: event.roundNumber,
        currentDrawerUserId: event.currentDrawerUserId,
        roundEndsAtEpochMillis: event.roundEndsAtEpochMillis,
        totalRounds: event.totalRounds,
      }
      this.transitionToPlayScene(this.snapshot, null, event.wordLength)
      return
    }
    this.drawLobby()
  }

  private transitionToPlayScene(
    snapshot: QuizRoomSnapshot,
    prompt: PromptAssignment | null,
    wordLength?: number,
  ) {
    if (this.state === 'transitioningToPlay' || this.state === 'leaving') return
    this.state = 'transitioningToPlay'
    const realtimeClient = this.realtimeClient
    this.realtimeClient = null
    realtimeClient?.setHandlers({
      onSnapshot: () => {},
      onPrompt: () => {},
      onEvent: () => {},
      onError: () => {},
    })
    fadeToScene(this, 'QuizPlayScene', {
      duration: 220,
      data: {
        snapshot,
        currentUserId: this.currentUserId,
        prompt,
        wordLength: wordLength ?? prompt?.word.length ?? null,
        realtimeClient,
      },
    })
  }

  private drawLobby() {
    if (!this.snapshot) return
    this.lobbyContainer?.destroy()
    const w = this.scale.width
    const h = this.scale.height
    const container = this.add.container(0, 0)
    this.root.add(container)
    this.lobbyContainer = container

    // 헤더 — 모드 선택 화면과 같은 톤(흰 텍스트 + 짙은 외곽선) 으로 배경과 분리.
    const headerY = h * 0.15
    const header = this.add
      .text(w / 2, headerY, '방 코드', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#ffe9c2',
        stroke: '#1a0e05',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
    container.add(header)

    // 코드 박스 — 두툼한 라운드 사각형 + 큰 모노스페이스 같은 굵은 글자.
    const codeBoxW = 360
    const codeBoxH = 92
    const codeBoxY = headerY + 22
    this.drawCodeBox(container, w / 2, codeBoxY, codeBoxW, codeBoxH, this.snapshot.code)

    // 멤버 슬롯 — 최대 정원만큼 가로 정렬, 게임 메뉴 톤(다크 카드 + 강조 보더).
    const slotW = Math.min(180, (w - 80) / this.snapshot.maxPlayers - 20)
    const slotH = 220
    const slotGap = 20
    const totalW = this.snapshot.maxPlayers * slotW + (this.snapshot.maxPlayers - 1) * slotGap
    const slotY = h * 0.56
    let cursorX = w / 2 - totalW / 2 + slotW / 2

    for (let i = 0; i < this.snapshot.maxPlayers; i++) {
      const member = this.snapshot.members[i] ?? null
      const slot = this.createMemberSlot(cursorX, slotY, slotW, slotH, member, i)
      container.add(slot)
      cursorX += slotW + slotGap
    }

    // 액션 버튼 — 시작은 큰 게임 버튼, 나가기는 pill.
    const isHost = this.snapshot.hostUserId === this.currentUserId
    const canStart = isHost && this.snapshot.members.length >= this.snapshot.minPlayers
    const buttonY = h - 110

    if (isHost) {
      this.drawStartButton(container, w / 2, buttonY, '게임 시작', canStart)
    } else {
      const waitText = this.add
        .text(w / 2, buttonY, '방장이 시작하면 출발!', {
          fontFamily: FONT_FAMILY,
          fontSize: '18px',
          color: '#fff4dc',
          stroke: '#1a0e05',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
      container.add(waitText)
    }

    // 우측 상단 X 버튼 — 방 나가기. 모달의 close 패턴.
    container.add(this.createCloseButton(w - 28, 28, () => this.handleLeave()))
  }

  /**
   * 코드 박스 — 클릭하면 클립보드에 방 코드 복사. 호버 시 살짝 밝아지고, 복사 직후 박스 아래
   * "복사됨!" 토스트가 1.4s 동안 뜨고 사라진다. (Phaser graphic 위에 hit zone Rectangle 을
   * 깔아두는 패턴은 본 씬의 다른 큰 버튼과 동일 — 시각=클릭 영역 일치.)
   */
  private drawCodeBox(
    container: Phaser.GameObjects.Container,
    cx: number,
    cy: number,
    w: number,
    h: number,
    code: string,
  ) {
    const hit = this.add.rectangle(cx, cy + h / 2, w, h, 0xffffff, 0.001).setOrigin(0.5)
    hit.setInteractive({ useHandCursor: true })

    const g = this.add.graphics()
    const draw = (hovered: boolean) => {
      g.clear()
      // 짙은 배경 + 밝은 외곽선으로 게임 HUD 톤.
      g.fillStyle(hovered ? 0x243049 : 0x1a2230, 0.96)
      g.fillRoundedRect(cx - w / 2, cy, w, h, 18)
      g.lineStyle(3, hovered ? 0xffffff : 0xffe9c2, hovered ? 1 : 0.95)
      g.strokeRoundedRect(cx - w / 2, cy, w, h, 18)
    }
    draw(false)

    const text = this.add
      .text(cx, cy + h / 2, code, {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '52px',
        color: '#ffd96b',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    text.setLetterSpacing(8)

    container.add([hit, g, text])

    hit.on(Phaser.Input.Events.POINTER_OVER, () => draw(true))
    hit.on(Phaser.Input.Events.POINTER_OUT, () => draw(false))
    hit.on(Phaser.Input.Events.POINTER_DOWN, () => this.copyCodeToClipboard(code, cx, cy + h + 12))
  }

  private async copyCodeToClipboard(code: string, toastX: number, toastY: number) {
    let ok = false
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
        ok = true
      }
    } catch {
      ok = false
    }
    if (!ok) {
      // 폴백 — 안전 컨텍스트 외/권한 거절 등. 임시 textarea 로 execCommand.
      try {
        const ta = document.createElement('textarea')
        ta.value = code
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        ok = false
      }
    }
    this.showCopyToast(ok ? '복사됨!' : '복사 실패', toastX, toastY)
  }

  private showCopyToast(label: string, cx: number, cy: number) {
    const toast = this.add
      .text(cx, cy, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: '#1a0e05',
        backgroundColor: '#ffe9c2',
        padding: { x: 12, y: 6 },
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setDepth(50)
    this.root.add(toast)
    this.tweens.add({
      targets: toast,
      alpha: { from: 1, to: 0 },
      y: cy - 8,
      duration: 1400,
      ease: 'Sine.easeOut',
      onComplete: () => toast.destroy(),
    })
  }

  /**
   * 우측 상단 모달 close 버튼 — 작은 라운드 사각형 + X 글리프. 빨강 톤(PALETTE_DANGER) 으로 위험/종료 신호.
   */
  private createCloseButton(cx: number, cy: number, onClick: () => void) {
    const container = this.add.container(cx, cy)
    const size = 36
    const radius = 8

    const hit = this.add.rectangle(0, 0, size + 4, size + 4, 0xffffff, 0.001)
    hit.setInteractive({ useHandCursor: true })

    const g = this.add.graphics()
    const draw = (hovered: boolean) => {
      g.clear()
      g.fillStyle(0x000000, 0.18)
      g.fillRoundedRect(-size / 2 + 1, -size / 2 + 2, size, size, radius)
      g.fillStyle(PALETTE_DANGER.accent, hovered ? 1 : 0.92)
      g.fillRoundedRect(-size / 2, -size / 2, size, size, radius)
      g.lineStyle(1.5, 0xffffff, hovered ? 1 : 0.85)
      g.strokeRoundedRect(-size / 2, -size / 2, size, size, radius)
    }
    draw(false)

    const x = this.add
      .text(0, 1, '✕', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add([hit, g, x])

    hit.on(Phaser.Input.Events.POINTER_OVER, () => draw(true))
    hit.on(Phaser.Input.Events.POINTER_OUT, () => draw(false))
    hit.on(Phaser.Input.Events.POINTER_DOWN, onClick)
    return container
  }

  private drawStartButton(
    container: Phaser.GameObjects.Container,
    cx: number,
    cy: number,
    label: string,
    enabled: boolean,
  ) {
    const w = 320
    const h = 72
    const radius = h / 2
    const fill = enabled ? 0x6aaa64 : 0x4a5468
    const shadow = enabled ? 0x447f3e : 0x2a3344

    const hit = this.add.rectangle(cx, cy, w + 4, h + 12, 0xffffff, 0.001).setOrigin(0.5)
    hit.setInteractive({ useHandCursor: enabled })

    const g = this.add.graphics()
    const draw = (hovered: boolean) => {
      g.clear()
      // 외부 부드러운 그림자
      for (let i = 0; i < 4; i++) {
        g.fillStyle(0x000000, 0.07)
        g.fillRoundedRect(cx - w / 2 - i, cy - h / 2 + 4 + i, w + i * 2, h + i, radius + i)
      }
      // 하단 두께
      g.fillStyle(shadow, 1)
      g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h + 8, radius)
      // 윗 면
      g.fillStyle(enabled && hovered ? brighten(fill) : fill, 1)
      g.fillRoundedRect(cx - w / 2, cy - h / 2 - (enabled && hovered ? 2 : 0), w, h, radius)
    }
    draw(false)

    const text = this.add
      .text(cx, cy, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        color: enabled ? '#ffffff' : '#b8c3d2',
        fontStyle: 'bold',
        stroke: '#1a0e05',
        strokeThickness: enabled ? 4 : 0,
      })
      .setOrigin(0.5)
    container.add([hit, g, text])

    if (enabled) {
      hit.on(Phaser.Input.Events.POINTER_OVER, () => {
        draw(true)
        text.y = cy - 2
      })
      hit.on(Phaser.Input.Events.POINTER_OUT, () => {
        draw(false)
        text.y = cy
      })
      hit.on(Phaser.Input.Events.POINTER_DOWN, () => this.handleStartGame())
    }
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
    const isMyself = !!member && member.userId === this.currentUserId
    const isHost = !!member && member.isHost

    // 다크 카드 + 강조 보더. host 일 땐 노란 강조, 빈 슬롯은 흐릿한 점선 톤.
    const g = this.add.graphics()
    if (!member) {
      // 빈 슬롯: 어두운 박스 + 점선 느낌 외곽 (Phaser graphic 으론 진짜 점선 비싸서, 옅은 alpha 더블 스트로크로 흉내)
      g.fillStyle(0x1b2435, 0.9)
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 18)
      g.lineStyle(2, 0x4a5468, 0.7)
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 18)
    } else {
      g.fillStyle(isHost ? 0xf4a64a : 0x2a3850, 1)
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 18)
      g.lineStyle(3, isMyself ? 0xffe9c2 : isHost ? 0xc77a1f : 0x3a4a62, 1)
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 18)
    }
    container.add(g)

    // 슬롯 내 vertical anchor — 빈/채워진 카드 모두 동일 위치를 사용해 줄이 흐트러지지 않게.
    // NPC 캐릭터 상반신은 아바타 박스 안에서 살짝 위로. name/role 과 16px+ 의 호흡공간을 둔다.
    const avatarY = -h / 2 + 64
    const nameY = -h / 2 + 158
    const roleY = -h / 2 + 188

    if (!member) {
      const slotLabel = this.add
        .text(0, avatarY, `${slotIndex + 1}P`, {
          fontFamily: FONT_FAMILY,
          fontSize: '36px',
          color: '#4a5468',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
      const empty = this.add
        .text(0, nameY, '비어 있어요', {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          color: '#7d8aa3',
        })
        .setOrigin(0.5)
      container.add([slotLabel, empty])
      return container
    }

    // 게임 씬과 동일하게 char1~4 상반신만 setCrop 으로 노출. 텍스처 미로드 시 글자 폴백.
    const avatarKey = slotCharKey(member.joinOrder)
    const avatarSize = Math.min(96, w * 0.6)
    if (this.textures.exists(avatarKey)) {
      const source = this.textures.get(avatarKey).getSourceImage() as HTMLImageElement
      const srcH = source.height || 1
      const srcW = source.width || 1
      const cropH = srcH * SLOT_CHAR_CROP_RATIO
      const scale = avatarSize / cropH
      const npc = this.add.image(0, avatarY, avatarKey)
      npc.setScale(scale)
      npc.setOrigin(0.5, SLOT_CHAR_CROP_RATIO / 2)
      npc.setCrop(0, 0, srcW, cropH)
      container.add(npc)
    } else {
      const initial = (member.nickname || '?').slice(0, 1)
      const fallback = this.add
        .text(0, avatarY, initial, {
          fontFamily: FONT_FAMILY,
          fontSize: '54px',
          color: isHost ? '#3a2614' : '#ffe9c2',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
      container.add(fallback)
    }
    const name = this.add
      .text(0, nameY, member.nickname, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: isHost ? '#1a0e05' : '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: w - 16 },
        align: 'center',
      })
      .setOrigin(0.5)
    const role = this.add
      .text(0, roleY, isHost ? '방장' : '참여자', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: isHost ? '#5a3818' : '#c5d0e3',
      })
      .setOrigin(0.5)
    container.add([name, role])

    if (isHost) {
      const badge = this.add
        .text(-w / 2 + 12, -h / 2 + 12, '🖌', {
          fontFamily: FONT_FAMILY,
          fontSize: '20px',
        })
        .setOrigin(0, 0)
      container.add(badge)
    }
    if (isMyself) {
      const me = this.add
        .text(w / 2 - 12, -h / 2 + 12, '나', {
          fontFamily: FONT_FAMILY,
          fontSize: '12px',
          color: '#1a0e05',
          backgroundColor: '#ffe9c2',
          padding: { x: 7, y: 3 },
          fontStyle: 'bold',
        })
        .setOrigin(1, 0)
      container.add(me)
    }
    return container
  }

  private handleStartGame() {
    if (!this.snapshot) return
    if (this.state !== 'lobby') return
    const roomId = this.snapshot.roomId
    this.state = 'starting'
    this.setStatus('게임 시작 중…')
    void startQuizRoom(roomId)
      .then(response => {
        // 호스트 진입 경로: REST 응답에 prompt 동봉. 토픽의 round_started 가 비슷한 시점에 도착하지만,
        // transitionToPlayScene 가 상태 가드로 중복 전이를 막는다.
        this.transitionToPlayScene(response.snapshot, response.prompt, response.prompt.word.length)
      })
      .catch(error => {
        this.setStatus(extractMessage(error, '시작에 실패했어요. 잠시 후 다시 시도해줘.'))
        this.state = 'lobby'
        this.drawLobby()
      })
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
   * 게임 느낌의 큰 선택 버튼. 채도 높은 색 + 짙은 하단 두께(3D) + 흰 외곽선 + 큰 이모지 + 타이틀/설명.
   *
   * <p>클릭 영역은 시각 바운드 전체와 항상 일치해야 한다 — 컨테이너에 Geom.Rectangle hit area 를 거는 방식은 자식 그래픽이 영역 밖으로 삐져나오면
   * 시각 ≠ 클릭 이슈가 생기므로, 투명 Rectangle 게임오브젝트를 hit zone 으로 깔고 그 위에 그래픽/텍스트를 쌓는다.
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
    const thickness = 12
    const dropOffset = 8
    const liftAmount = 4

    const hitW = w + 4
    const hitH = h + thickness + dropOffset + 4
    const hitY = (thickness + dropOffset) / 2 - 2
    const hit = this.add.rectangle(0, hitY, hitW, hitH, 0xffffff, 0.001).setOrigin(0.5)
    hit.setInteractive({ useHandCursor: true })

    const shadowG = this.add.graphics()
    const faceG = this.add.graphics()
    const drawButton = (lifted: boolean) => {
      const lift = lifted ? liftAmount : 0
      shadowG.clear()
      const shadowSteps = 5
      for (let i = 0; i < shadowSteps; i++) {
        const spread = i * 2
        shadowG.fillStyle(0x000000, 0.06)
        shadowG.fillRoundedRect(
          -w / 2 - spread,
          -h / 2 + dropOffset - lift * 0.5 + spread * 0.6,
          w + spread * 2,
          h + thickness + spread,
          radius + spread,
        )
      }

      faceG.clear()
      faceG.fillStyle(shadow, 1)
      faceG.fillRoundedRect(-w / 2, -h / 2 - lift, w, h + thickness, radius)
      faceG.fillStyle(fill, 1)
      faceG.fillRoundedRect(-w / 2, -h / 2 - lift, w, h, radius)
      faceG.lineStyle(2, shadow, 0.7)
      faceG.strokeRoundedRect(-w / 2 + 1, -h / 2 - lift + 1, w - 2, h - 2, radius - 1)
    }
    drawButton(false)
    container.add([hit, shadowG, faceG])

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

    hit.on(Phaser.Input.Events.POINTER_DOWN, onClick)
    hit.on(Phaser.Input.Events.POINTER_OVER, () => {
      drawButton(true)
      iconText.y = -h / 2 + 96 - liftAmount
      titleText.y = -h / 2 + 192 - liftAmount
      descText.y = -h / 2 + 240 - liftAmount
    })
    hit.on(Phaser.Input.Events.POINTER_OUT, () => {
      drawButton(false)
      iconText.y = -h / 2 + 96
      titleText.y = -h / 2 + 192
      descText.y = -h / 2 + 240
    })
    return container
  }

  /**
   * 단색 pill 버튼. 공용 drawCutePillButton 의 외곽 글로우/상단 글로스가 시각적으로 두꺼워 보이는 것을 피해, 본 씬에서는 직접 그린다.
   * 클릭 영역은 investment 안 들이려고 투명 Rectangle hit zone 으로 시각 = 클릭 일치.
   */
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
    const radius = h / 2

    const hit = this.add.rectangle(0, 0, w, h, 0xffffff, 0.001).setOrigin(0.5)
    hit.setInteractive({ useHandCursor: true })

    const g = this.add.graphics()
    const draw = (hovered: boolean) => {
      g.clear()
      g.fillStyle(palette.accent, hovered ? 1 : 0.92)
      g.fillRoundedRect(-w / 2, -h / 2, w, h, radius)
      g.lineStyle(2, 0xffffff, hovered ? 1 : 0.9)
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius)
    }
    draw(false)

    const text = this.add
      .text(0, 0, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add([hit, g, text])

    hit.on(Phaser.Input.Events.POINTER_DOWN, onClick)
    hit.on(Phaser.Input.Events.POINTER_OVER, () => draw(true))
    hit.on(Phaser.Input.Events.POINTER_OUT, () => draw(false))
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

/** axios error 의 응답 body.code 가 BE 의 ALREADY_IN_ROOM(Q-004) 인지 검사. 다른 형태 응답은 false. */
function isAlreadyInRoomError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('response' in error)) return false
  const response = (error as { response?: { status?: number; data?: { code?: string } } }).response
  return response?.status === 409 && response?.data?.code === 'Q-004'
}

/**
 * 사용자에게 그대로 노출하기 부적절한 STOMP/BE 원본 에러 문구를 친절한 한 줄로 매핑.
 *
 * <p>대부분의 일시적 에러(서버 인터셉터 race, 네트워크 일시 끊김 등) 는 stomp client 가 자동 재접속하므로, 사용자 행동을 요구하는 단정적인 안내는
 * 피하고 "잠시 후 다시 연결" 정도로 부드럽게 둔다. 진짜 사용자 액션이 필요한 케이스 (멤버 아님 등) 만 명시.
 */
function friendlyWsError(raw: string): string {
  if (!raw) return '연결을 확인하는 중…'
  const lower = raw.toLowerCase()
  if (lower.includes('not a member')) return '방 멤버가 아니에요. 다시 입장해줘.'
  // 실시간 비활성 상태 — 사용자에게 굳이 노출하지 않는다. dev/local 에선 yaml 로 활성화되며
  // 운영에서 의도적으로 꺼진 상태일 때도 로비 화면에 경고를 띄우면 오히려 혼란.
  if (lower.includes('quiz realtime disabled') || lower.includes('village realtime disabled'))
    return ''
  // principal missing / missing bearer / 일반 에러 — 자동 재접속에 맡기고 부드럽게.
  return '연결을 다시 시도하는 중…'
}

/**
 * 24-bit 색을 약 12% 정도 밝게. hover/active 강조에 사용. r/g/b 각 채널을 0xff 와 비율로 보간.
 */
function brighten(color: number): number {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  const lift = (c: number) => Math.min(255, c + Math.floor((255 - c) * 0.18))
  return (lift(r) << 16) | (lift(g) << 8) | lift(b)
}
