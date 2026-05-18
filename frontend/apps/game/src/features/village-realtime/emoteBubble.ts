import Phaser from 'phaser'
import type { TaekwondoBeltColor } from '@wish/api-client'

import {
  getTaekwondoBeltColorFromBoastEmoji,
  getTaekwondoBeltLabel,
  isTaekwondoBeltBoastEmoji,
} from './types'

/** sprite 좌표 + 높이만 알면 되는 최소 인터페이스 — 로컬 player 와 원격 sprite 모두 매칭. */
export interface EmoteBubbleTarget {
  x: number
  y: number
  displayHeight: number
}

/** 이모지/단일 글자용 큰 폰트. */
const EMOTE_FONT_SIZE_EMOJI = 40
/** 한글 단축 메시지용 폰트 — 글자수가 많아 가독성 위해 한 단계 축소 (S14P31E103-769). */
const EMOTE_FONT_SIZE_TEXT = 26
/** 한글 (Hangul 음절 + Jamo) 포함 여부 — 폰트 크기 분기에 사용. */
const HANGUL_PATTERN = /[㄰-㆏가-힣]/
const BELT_BADGE_LABEL_FONT_SIZE = 14

const BELT_BADGE_COLORS: Record<
  TaekwondoBeltColor,
  { ribbon: number; stroke: number; text: string }
> = {
  WHITE: { ribbon: 0xf8fafc, stroke: 0xcbd5e1, text: '#111827' },
  YELLOW: { ribbon: 0xfacc15, stroke: 0xfef08a, text: '#3b2f00' },
  ORANGE: { ribbon: 0xfb923c, stroke: 0xfed7aa, text: '#321400' },
  GREEN: { ribbon: 0x22c55e, stroke: 0xbbf7d0, text: '#ffffff' },
  BLUE: { ribbon: 0x3b82f6, stroke: 0xbfdbfe, text: '#ffffff' },
  PURPLE: { ribbon: 0xa855f7, stroke: 0xe9d5ff, text: '#ffffff' },
  BROWN: { ribbon: 0x92400e, stroke: 0xfcd34d, text: '#ffffff' },
  RED: { ribbon: 0xef4444, stroke: 0xfecaca, text: '#ffffff' },
  BLACK: { ribbon: 0x111827, stroke: 0xf5c451, text: '#ffffff' },
}

/**
 * 매 프레임 sprite 좌표로 lerp 하는 비율. 1.0 정확 추적은 walk anim + 서브픽셀 렌더링이 합쳐져 텍스트가 "흔들려" 식별이 어려움 —
 * 약간의 지연 + 정수 좌표 snap 으로 안정화. 0.25 → 60fps 에서 half-life ≈ 3 프레임 (~50ms). 캐릭터 빠르게 움직여도 부드럽게 trail.
 */
const FOLLOW_LERP = 0.25

/** sprite 상단 위로 띄울 여백 (px). */
const EMOTE_VERTICAL_GAP_PX = 16
/** scale 0.5 → 1.2 → 1.0 통통 tween 의 첫 단계 길이 (overshoot). */
const POP_IN_MS = 180
/** overshoot 후 안정 scale 1.0 으로 settle. */
const POP_SETTLE_MS = 120
/** 전체 표시 시간 (pop-in 포함). 이 후 fade out 시작. */
const DISPLAY_DURATION_MS = 2_500
/** fade out 길이. */
const FADE_OUT_MS = 400

/**
 * sprite 위에 빠른 표현 (이모지/한글 단축 메시지) 텍스트를 띄운다. 통통 tween + 자동 fade out + destroy.
 *
 * <p>S14P31E103-769: 캐릭터가 움직이면 버블도 따라오도록 매 프레임 위치 동기화. cleanup 은 fade out 의 onComplete 단계에서 listener
 * off + bubble destroy.
 */
export function emitEmoteBubble(
  scene: Phaser.Scene,
  target: EmoteBubbleTarget,
  emoji: string,
  depth: number,
): void {
  const bubblePosition = computePosition(target)
  const bubble = isTaekwondoBeltBoastEmoji(emoji)
    ? createBeltBadgeBubble(scene, bubblePosition.x, bubblePosition.y, emoji, depth)
    : createTextBubble(scene, bubblePosition.x, bubblePosition.y, emoji, depth)

  // sprite 가 움직일 때마다 버블이 같이 움직이도록.
  const follow = () => {
    if (!bubble.active) return
    const next = computePosition(target)
    bubble.x = Math.round(bubble.x + (next.x - bubble.x) * FOLLOW_LERP)
    bubble.y = Math.round(bubble.y + (next.y - bubble.y) * FOLLOW_LERP)
  }
  scene.events.on(Phaser.Scenes.Events.UPDATE, follow)

  // overshoot pop-in
  scene.tweens.add({
    targets: bubble,
    scale: 1.2,
    duration: POP_IN_MS,
    ease: 'Back.Out',
    onComplete: () => {
      // settle 1.2 → 1.0
      scene.tweens.add({
        targets: bubble,
        scale: 1.0,
        duration: POP_SETTLE_MS,
        ease: 'Linear',
      })
    },
  })

  // 2.5초 후 fade out + destroy
  scene.time.delayedCall(DISPLAY_DURATION_MS, () => {
    scene.tweens.add({
      targets: bubble,
      alpha: 0,
      duration: FADE_OUT_MS,
      onComplete: () => {
        scene.events.off(Phaser.Scenes.Events.UPDATE, follow)
        bubble.destroy()
      },
    })
  })
}

function createTextBubble(scene: Phaser.Scene, x: number, y: number, emoji: string, depth: number) {
  const fontSize = HANGUL_PATTERN.test(emoji) ? EMOTE_FONT_SIZE_TEXT : EMOTE_FONT_SIZE_EMOJI
  return scene.add
    .text(x, y, emoji, {
      fontSize: `${fontSize}px`,
      fontFamily: "'Jua', 'Apple SD Gothic Neo', sans-serif",
      resolution: 2,
    })
    .setOrigin(0.5, 1)
    .setDepth(depth)
    .setScale(0.5)
}

function createBeltBadgeBubble(
  scene: Phaser.Scene,
  x: number,
  y: number,
  emoji: string,
  depth: number,
) {
  const beltColor = getTaekwondoBeltColorFromBoastEmoji(emoji)
  const beltLabel = beltColor ? getTaekwondoBeltLabel(beltColor) : emoji.replace(/^🥋/, '')
  const colors = beltColor
    ? BELT_BADGE_COLORS[beltColor]
    : { ribbon: 0x1f2937, stroke: 0xf5c451, text: '#ffffff' }

  const container = scene.add.container(x, y).setDepth(depth).setScale(0.5)
  const shadow = scene.add.graphics()
  shadow.fillStyle(0x000000, 0.26)
  shadow.fillEllipse(0, -30, 132, 58)

  const crest = scene.add.graphics()
  crest.fillStyle(0x0f172a, 0.94)
  crest.lineStyle(3, 0xf5c451, 1)
  crest.beginPath()
  crest.moveTo(0, -76)
  crest.lineTo(48, -61)
  crest.lineTo(60, -23)
  crest.lineTo(0, 0)
  crest.lineTo(-60, -23)
  crest.lineTo(-48, -61)
  crest.closePath()
  crest.fillPath()
  crest.strokePath()

  crest.lineStyle(2, colors.stroke, 0.88)
  crest.fillStyle(colors.ribbon, 0.96)
  crest.fillRoundedRect(-44, -34, 88, 21, 9)
  crest.strokeRoundedRect(-44, -34, 88, 21, 9)

  const icon = scene.add
    .text(0, -52, '🥋', {
      fontSize: '26px',
      fontFamily: "'Jua', 'Apple SD Gothic Neo', sans-serif",
      resolution: 2,
    })
    .setOrigin(0.5, 0.5)

  const label = scene.add
    .text(0, -23, beltLabel, {
      fontSize: `${BELT_BADGE_LABEL_FONT_SIZE}px`,
      fontFamily: "'Jua', 'Apple SD Gothic Neo', sans-serif",
      color: colors.text,
      resolution: 2,
    })
    .setOrigin(0.5, 0.5)

  container.add([shadow, crest, icon, label])
  return container
}

function computePosition(target: EmoteBubbleTarget): { x: number; y: number } {
  return {
    x: target.x,
    y: target.y - target.displayHeight / 2 - EMOTE_VERTICAL_GAP_PX,
  }
}
