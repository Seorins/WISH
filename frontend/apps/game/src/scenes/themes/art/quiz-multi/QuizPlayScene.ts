import Phaser from 'phaser'
import { type QuizRoomSnapshot } from '@wish/api-client'
import { assetPath } from '@/game/assets/assetPath'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'

/**
 * 그림 퀴즈 멀티플레이 플레이 씬 (S14P31E103-820, M2).
 *
 * <p>캐치마인드 클래식 레이아웃:
 *
 * <ul>
 *   <li>상단: 제시어/타이머 바
 *   <li>좌/우 사이드바: 플레이어 슬롯 (최대 4명, 좌측 2 / 우측 2)
 *   <li>중앙: 그림 캔버스 (출제자만 그림, 정답자는 수신 렌더)
 *   <li>하단: 팔레트/도구 (출제자 한정 활성) + 채팅·정답 입력 (정답자 한정)
 * </ul>
 *
 * <p>M2-1 단계: 레이아웃 셸만 — 실제 그리기/스트로크 송수신/제시어/타이머는 후속 슬라이스에서 채운다.
 */
const FONT_FAMILY =
  '"Pretendard Variable", Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, sans-serif'

const PANEL_BG = 0x1f2a3a
const PANEL_BORDER = 0x3a4a62
const CANVAS_BG = 0xfdfdfb
const CANVAS_BORDER = 0x2a364c
const SLOT_BG = 0x2a3850
const SLOT_BG_ACTIVE = 0xf4a64a
const SLOT_BG_EMPTY = 0x1b2435
const TOOLBAR_BG = 0x1a2230

export interface QuizPlaySceneInit {
  snapshot: QuizRoomSnapshot
  currentUserId: number | null
}

export class QuizPlayScene extends Phaser.Scene {
  private snapshot!: QuizRoomSnapshot
  private currentUserId: number | null = null

  private root!: Phaser.GameObjects.Container
  private backdrop: Phaser.GameObjects.Rectangle | null = null
  private layoutContainer: Phaser.GameObjects.Container | null = null

  constructor() {
    super('QuizPlayScene')
  }

  init(data: Partial<QuizPlaySceneInit>) {
    if (!data.snapshot) {
      // 직접 진입은 허용하지 않음 — 로비에서 시작 버튼으로만 들어와야 함.
      throw new Error('QuizPlayScene requires snapshot via init data')
    }
    this.snapshot = data.snapshot
    this.currentUserId = data.currentUserId ?? null
  }

  preload() {
    if (!this.textures.exists('art-room-background')) {
      this.load.image(
        'art-room-background',
        assetPath('images/themes/art/background/background.png'),
      )
    }
  }

  create() {
    addCoverBackground(this, 'art-room-background')
    this.backdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x0a1220, 0.78)
      .setOrigin(0)
      .setDepth(0)
    this.root = this.add.container(0, 0)
    this.root.setDepth(1)

    this.scale.on('resize', this.layout, this)
    this.events.once('shutdown', this.handleShutdown, this)

    this.drawLayout()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // layout

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
    const padding = 16

    // ── 사이드바 폭은 한 슬롯 너비 기준으로 잡고, 남은 영역을 중앙 캔버스 + 하단 도구에 분배.
    const sidebarW = Math.max(180, Math.min(220, w * 0.16))
    const topBarH = 64
    const bottomBarH = Math.max(140, h * 0.22)
    const canvasAreaTop = padding + topBarH + padding
    const canvasAreaBottom = h - padding - bottomBarH - padding
    const canvasAreaH = canvasAreaBottom - canvasAreaTop

    // 상단 바
    this.drawTopBar(container, padding, padding, w - padding * 2, topBarH)

    // 좌측 사이드바 (P1, P3)
    this.drawSidebar(container, padding, canvasAreaTop, sidebarW, canvasAreaH, [0, 2])
    // 우측 사이드바 (P2, P4)
    this.drawSidebar(
      container,
      w - padding - sidebarW,
      canvasAreaTop,
      sidebarW,
      canvasAreaH,
      [1, 3],
    )

    // 중앙 캔버스 영역
    const canvasX = padding + sidebarW + padding
    const canvasW = w - padding - sidebarW - padding - padding - sidebarW - padding
    this.drawCanvasArea(container, canvasX, canvasAreaTop, canvasW, canvasAreaH)

    // 하단 도구 영역
    this.drawBottomBar(container, padding, h - padding - bottomBarH, w - padding * 2, bottomBarH)
  }

  private drawTopBar(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const panel = this.add.graphics()
    panel.fillStyle(PANEL_BG, 0.92)
    panel.fillRoundedRect(x, y, w, h, 14)
    panel.lineStyle(2, PANEL_BORDER, 1)
    panel.strokeRoundedRect(x, y, w, h, 14)
    container.add(panel)

    // 출제자 표시 (왼쪽)
    const hostMember = this.snapshot.members.find(m => m.userId === this.snapshot.hostUserId)
    const turnLabel = this.add
      .text(x + 24, y + h / 2, `🎨 출제자: ${hostMember?.nickname ?? '미정'}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#ffe9c2',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
    container.add(turnLabel)

    // 제시어 / 글자수 (중앙)
    const isHost = this.snapshot.hostUserId === this.currentUserId
    const promptLabel = this.add
      .text(x + w / 2, y + h / 2, isHost ? '제시어 대기 중…' : '글자수 대기 중…', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(promptLabel)

    // 타이머 placeholder (오른쪽)
    const timer = this.add
      .text(x + w - 24, y + h / 2, '⏱ --:--', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#ffe9c2',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5)
    container.add(timer)
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
      const slotY = y + i * (slotH + gap)
      this.drawPlayerSlot(container, x, slotY, w, slotH, index)
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
    const isHost = !!member && member.isHost

    const panel = this.add.graphics()
    const bg = !member ? SLOT_BG_EMPTY : isHost ? SLOT_BG_ACTIVE : SLOT_BG
    panel.fillStyle(bg, 1)
    panel.fillRoundedRect(x, y, w, h, 12)
    panel.lineStyle(2, isMyself ? 0xffe9c2 : PANEL_BORDER, isMyself ? 1 : 0.8)
    panel.strokeRoundedRect(x, y, w, h, 12)
    container.add(panel)

    if (!member) {
      const placeholder = this.add
        .text(x + w / 2, y + h / 2, `${slotIndex + 1}P\n대기 중`, {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          color: '#7d8aa3',
          align: 'center',
        })
        .setOrigin(0.5)
      container.add(placeholder)
      return
    }

    // 아바타 (이니셜 큰 글자)
    const initial = (member.nickname || '?').slice(0, 1)
    const avatarSize = Math.min(72, w * 0.5)
    const avatar = this.add
      .text(x + w / 2, y + 16 + avatarSize / 2, initial, {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.floor(avatarSize * 0.7)}px`,
        color: isHost ? '#3a2614' : '#ffe9c2',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(avatar)

    // 닉네임
    const nameText = this.add
      .text(x + w / 2, y + h - 50, member.nickname, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        color: isHost ? '#1a0e05' : '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: w - 16 },
        align: 'center',
      })
      .setOrigin(0.5)
    container.add(nameText)

    // 점수
    const scoreText = this.add
      .text(x + w / 2, y + h - 22, `${member.score}점`, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: isHost ? '#5a3818' : '#c5d0e3',
      })
      .setOrigin(0.5)
    container.add(scoreText)

    // 출제자 인디케이터
    if (isHost) {
      const badge = this.add
        .text(x + 10, y + 10, '🖌', {
          fontFamily: FONT_FAMILY,
          fontSize: '18px',
        })
        .setOrigin(0, 0)
      container.add(badge)
    }
    if (isMyself) {
      const meBadge = this.add
        .text(x + w - 10, y + 10, '나', {
          fontFamily: FONT_FAMILY,
          fontSize: '12px',
          color: '#1a0e05',
          backgroundColor: '#ffe9c2',
          padding: { x: 6, y: 2 },
          fontStyle: 'bold',
        })
        .setOrigin(1, 0)
      container.add(meBadge)
    }
  }

  private drawCanvasArea(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    // 흰 캔버스 배경 + 짙은 외곽
    const canvas = this.add.graphics()
    canvas.fillStyle(CANVAS_BG, 1)
    canvas.fillRoundedRect(x, y, w, h, 16)
    canvas.lineStyle(3, CANVAS_BORDER, 1)
    canvas.strokeRoundedRect(x, y, w, h, 16)
    container.add(canvas)

    // placeholder 텍스트
    const isHost = this.snapshot.hostUserId === this.currentUserId
    const hint = this.add
      .text(
        x + w / 2,
        y + h / 2,
        isHost ? '여기에 그림을 그려요 (M2-3에서 활성)' : '출제자의 그림이 여기 나타나요',
        {
          fontFamily: FONT_FAMILY,
          fontSize: '16px',
          color: '#a0a8b8',
          align: 'center',
        },
      )
      .setOrigin(0.5)
    container.add(hint)
  }

  private drawBottomBar(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const panel = this.add.graphics()
    panel.fillStyle(TOOLBAR_BG, 0.95)
    panel.fillRoundedRect(x, y, w, h, 14)
    panel.lineStyle(2, PANEL_BORDER, 1)
    panel.strokeRoundedRect(x, y, w, h, 14)
    container.add(panel)

    const isHost = this.snapshot.hostUserId === this.currentUserId
    if (isHost) {
      // 팔레트 placeholder — 색상 swatch 5개
      const colors = [0xff4d4d, 0xffa64a, 0xffd84a, 0x5cc26b, 0x4a90e2]
      const swatchSize = Math.min(48, h * 0.4)
      const swatchGap = 14
      const totalW = colors.length * swatchSize + (colors.length - 1) * swatchGap
      let cx = x + 24
      const cy = y + h / 2
      colors.forEach(color => {
        const sw = this.add.graphics()
        sw.fillStyle(color, 1)
        sw.fillRoundedRect(cx, cy - swatchSize / 2, swatchSize, swatchSize, 10)
        sw.lineStyle(2, 0xffffff, 0.9)
        sw.strokeRoundedRect(cx, cy - swatchSize / 2, swatchSize, swatchSize, 10)
        container.add(sw)
        cx += swatchSize + swatchGap
      })

      const toolsHint = this.add
        .text(x + 24 + totalW + 32, cy, '지우개 · 전체지우기 (M2-3)', {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          color: '#7d8aa3',
        })
        .setOrigin(0, 0.5)
      container.add(toolsHint)
    } else {
      // 정답자: 채팅 입력 placeholder
      const inputBg = this.add.graphics()
      const inputW = w - 48 - 120
      const inputH = h * 0.5
      const inputX = x + 24
      const inputY = y + h / 2 - inputH / 2
      inputBg.fillStyle(0x0d1320, 1)
      inputBg.fillRoundedRect(inputX, inputY, inputW, inputH, 10)
      inputBg.lineStyle(2, PANEL_BORDER, 1)
      inputBg.strokeRoundedRect(inputX, inputY, inputW, inputH, 10)
      container.add(inputBg)

      const placeholder = this.add
        .text(inputX + 16, y + h / 2, '정답을 입력하세요 (M3 에서 활성)', {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          color: '#5d6b85',
        })
        .setOrigin(0, 0.5)
      container.add(placeholder)
    }

    // 나가기 버튼 (모든 모드 공통)
    this.drawLeaveButton(container, x + w - 24 - 96, y + h / 2 - 22, 96, 44)
  }

  private drawLeaveButton(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const radius = h / 2
    const hit = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0xffffff, 0.001).setOrigin(0.5)
    hit.setInteractive({ useHandCursor: true })

    const g = this.add.graphics()
    const draw = (hovered: boolean) => {
      g.clear()
      g.fillStyle(0xa85b4d, hovered ? 1 : 0.92)
      g.fillRoundedRect(x, y, w, h, radius)
      g.lineStyle(2, 0xffffff, hovered ? 1 : 0.85)
      g.strokeRoundedRect(x, y, w, h, radius)
    }
    draw(false)

    const text = this.add
      .text(x + w / 2, y + h / 2, '나가기', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add([hit, g, text])

    hit.on(Phaser.Input.Events.POINTER_OVER, () => draw(true))
    hit.on(Phaser.Input.Events.POINTER_OUT, () => draw(false))
    hit.on(Phaser.Input.Events.POINTER_DOWN, () => this.handleLeave())
  }

  // ─────────────────────────────────────────────────────────────────────────
  // actions

  private handleLeave() {
    // M2-2 이후엔 BE 에 종료 전달 + WS disconnect. M2-1 단계에선 단순 로비 복귀.
    fadeToScene(this, 'QuizLobbyScene', { duration: 220 })
  }

  private handleShutdown() {
    this.scale.off('resize', this.layout, this)
  }
}
