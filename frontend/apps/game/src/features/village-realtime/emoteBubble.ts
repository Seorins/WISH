import Phaser from 'phaser'

/** sprite 좌표 + 높이만 알면 되는 최소 인터페이스 — 로컬 player 와 원격 sprite 모두 매칭. */
export interface EmoteBubbleTarget {
  x: number
  y: number
  displayHeight: number
}

const EMOTE_FONT_SIZE = 40
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
 * sprite 위에 이모티콘 텍스트를 띄운다. 통통 뛰는 tween + 자동 fade out + destroy.
 *
 * <p>버블은 분출 시점 sprite 위치에 고정된다 (이후 sprite 가 움직여도 따라오지 않음). 2.5초 + 0.4초 fade 동안 표시되므로 그 시간 안에 움직임은
 * 자연스럽게 무시할 수 있는 정도.
 */
export function emitEmoteBubble(
  scene: Phaser.Scene,
  target: EmoteBubbleTarget,
  emoji: string,
  depth: number,
): void {
  const textY = target.y - target.displayHeight / 2 - EMOTE_VERTICAL_GAP_PX
  const bubble = scene.add
    .text(target.x, textY, emoji, {
      fontSize: `${EMOTE_FONT_SIZE}px`,
      fontFamily: 'sans-serif',
      resolution: 2,
    })
    .setOrigin(0.5, 1)
    .setDepth(depth)
    .setScale(0.5)

  // overshoot pop-in
  scene.tweens.add({
    targets: bubble,
    scale: 1.2,
    duration: POP_IN_MS,
    ease: 'Back.Out',
    onComplete: () => {
      // settle 0.2 → 1.0
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
      onComplete: () => bubble.destroy(),
    })
  })
}
