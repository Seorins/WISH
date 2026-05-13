import Phaser from 'phaser'

import { VILLAGE_EMOJIS, type VillageEmoji } from './types'

/** 우하단 화면 가장자리에서 안쪽으로 띄울 여백 (px). */
const PALETTE_MARGIN = 18
/** 10개 슬롯 가로 배치에 맞춰 56 → 50 으로 축소 (S14P31E103-769). */
const BUTTON_SIZE = 50
const BUTTON_GAP = 8
/** 이모지/단일 글자용 큰 폰트. */
const FONT_SIZE_EMOJI = 28
/** 한글 단축 메시지용 작은 폰트. */
const FONT_SIZE_TEXT = 16
const HANGUL_PATTERN = /[㄰-㆏가-힣]/

export interface VillageEmojiPaletteHandle {
  /** 키보드 1\~9, 0 단축키 또는 외부 트리거에서 호출 — 시각 피드백 + onSelect 발화. index 범위 밖이면 no-op. */
  triggerByIndex(index: number): void
  setVisible(visible: boolean): void
  isVisible(): boolean
  destroy(): void
}

interface CreateOptions {
  onSelect: (emoji: VillageEmoji) => void
  /** 초기 visibility. 미지정 시 false (Q 토글로 열어야 보임). */
  initiallyVisible?: boolean
}

/**
 * 우하단에 가로 배열된 빠른 표현 팔레트 (이모지 + 짧은 한글). setScrollFactor 0 으로 카메라 이동에 따라가지 않고 항상 같은 위치 고정.
 *
 * <p>S14P31E103-769: 10 슬롯 + 한글 가독성 위해 폰트 크기 적응형. 기본은 숨김 — VillageScene 의 Q 키로 토글한다. 키보드
 * 단축키는 팔레트 상태와 무관하게 발동 (학습 목적의 시각 매핑 + 즉시 발사 분리).
 */
export function createVillageEmojiPalette(
  scene: Phaser.Scene,
  options: CreateOptions,
): VillageEmojiPaletteHandle {
  const { width: vw, height: vh } = scene.scale
  const totalWidth = VILLAGE_EMOJIS.length * BUTTON_SIZE + (VILLAGE_EMOJIS.length - 1) * BUTTON_GAP
  const startX = vw - PALETTE_MARGIN - totalWidth
  const y = vh - PALETTE_MARGIN - BUTTON_SIZE
  const depth = 100

  const container = scene.add
    .container(startX, y)
    .setScrollFactor(0)
    .setDepth(depth)
    .setVisible(options.initiallyVisible ?? false)

  const buttons: Phaser.GameObjects.Text[] = []

  VILLAGE_EMOJIS.forEach((emoji, index) => {
    const buttonX = index * (BUTTON_SIZE + BUTTON_GAP) + BUTTON_SIZE / 2
    const buttonY = BUTTON_SIZE / 2
    const fontSize = HANGUL_PATTERN.test(emoji) ? FONT_SIZE_TEXT : FONT_SIZE_EMOJI

    const bg = scene.add
      .rectangle(buttonX, buttonY, BUTTON_SIZE, BUTTON_SIZE, 0x000000, 0.32)
      .setStrokeStyle(2, 0xffffff, 0.7)

    const text = scene.add
      .text(buttonX, buttonY, emoji, {
        fontSize: `${fontSize}px`,
        fontFamily: "'Jua', 'Apple SD Gothic Neo', sans-serif",
        resolution: 2,
      })
      .setOrigin(0.5, 0.5)

    // 1\~9, 0 매핑 키 라벨 — 사용자가 단축키 학습할 수 있게 작은 글씨로 좌상단.
    const keyLabel = (index + 1) % 10
    const keyText = scene.add
      .text(buttonX - BUTTON_SIZE / 2 + 4, buttonY - BUTTON_SIZE / 2 + 2, String(keyLabel), {
        fontSize: '10px',
        fontFamily: "'Jua', 'Apple SD Gothic Neo', sans-serif",
        color: '#ffffffaa',
        resolution: 2,
      })
      .setOrigin(0, 0)

    // Rectangle 자체 geometry 를 hit area 로 자동 사용 (이전엔 container 좌표를 직접 hit area 에 박아 클릭 영역이
    // 어긋나 있었음). useHandCursor 로 클릭 가능 affordance 도 함께.
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerdown', (event: Phaser.Types.Input.EventData) => {
      ;(event as unknown as { stopPropagation?: () => void }).stopPropagation?.()
      triggerByIndex(index)
    })

    container.add([bg, text, keyText])
    buttons.push(text)
  })

  function triggerByIndex(index: number) {
    if (index < 0 || index >= VILLAGE_EMOJIS.length) return
    const emoji = VILLAGE_EMOJIS[index]
    // 살짝 통통 피드백.
    const target = buttons[index]
    scene.tweens.add({
      targets: target,
      scale: 1.35,
      duration: 90,
      yoyo: true,
      ease: 'Quad.Out',
    })
    options.onSelect(emoji)
  }

  return {
    triggerByIndex,
    setVisible(visible: boolean) {
      container.setVisible(visible)
    },
    isVisible() {
      return container.visible
    },
    destroy() {
      container.destroy()
    },
  }
}
