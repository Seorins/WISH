import Phaser from 'phaser'

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
  const fontSize = HANGUL_PATTERN.test(emoji) ? EMOTE_FONT_SIZE_TEXT : EMOTE_FONT_SIZE_EMOJI
  const bubblePosition = computePosition(target)
  const bubble = scene.add
    .text(bubblePosition.x, bubblePosition.y, emoji, {
      fontSize: `${fontSize}px`,
      fontFamily: 'sans-serif',
      resolution: 2,
    })
    .setOrigin(0.5, 1)
    .setDepth(depth)
    .setScale(0.5)

  // sprite 가 움직일 때마다 버블이 같이 움직이도록.
  const follow = () => {
    if (!bubble.active) return
    const next = computePosition(target)
    bubble.x = next.x
    bubble.y = next.y
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

function computePosition(target: EmoteBubbleTarget): { x: number; y: number } {
  return {
    x: target.x,
    y: target.y - target.displayHeight / 2 - EMOTE_VERTICAL_GAP_PX,
  }
}
