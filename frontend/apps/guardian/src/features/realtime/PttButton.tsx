import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './PttButton.module.css'

type Props = {
  /** 콘텐츠 진행 중일 때만 true — false 면 버튼이 disabled 로 노출되어 PTT 불가. */
  enabled: boolean
  /** LiveKit LocalParticipant.setMicrophoneEnabled 래퍼. 권한 거절 등 실패 시 throw. */
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>
}

// Push-To-Talk 마이크 버튼.
// pointerdown 으로 마이크 enable, pointerup/leave/cancel 로 disable.
// 첫 enable 호출에서 LiveKit 이 트랙 publish + 브라우저 권한 다이얼로그를 띄움 — 사용자가
// 권한을 거절하면 error 상태로 전환되고 다음 시도까지 버튼이 disable 된다.
export function PttButton({ enabled, setMicrophoneEnabled }: Props) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 빠른 pointerdown→up 의 race 와 cleanup 시 잔여 마이크 켜짐 방지용.
  // pressed=true 인 동안만 publish 의도가 살아있다. pressGeneration 은 매 press 마다
  // 증가시켜 async 콜백이 자기 세대 이후로 들어왔는지 비교한다.
  const pressedRef = useRef(false)
  const pressGenerationRef = useRef(0)

  useEffect(() => {
    if (!enabled && isSpeaking) {
      // 콘텐츠가 끝나는 등 외부 이유로 enabled 가 false 가 되면 즉시 mute.
      pressedRef.current = false
      void setMicrophoneEnabled(false).catch(() => {})
      setIsSpeaking(false)
    }
  }, [enabled, isSpeaking, setMicrophoneEnabled])

  // 언마운트 시 잔여 publish 방지.
  useEffect(
    () => () => {
      void setMicrophoneEnabled(false).catch(() => {})
    },
    [setMicrophoneEnabled],
  )

  const handleStart = useCallback(async () => {
    if (!enabled || pressedRef.current) return
    const generation = ++pressGenerationRef.current
    pressedRef.current = true
    setError(null)
    setIsSpeaking(true)
    try {
      await setMicrophoneEnabled(true)
      // 누르고 있는 사이에 release 가 발생해 generation 이 바뀌었으면 즉시 다시 mute.
      if (pressGenerationRef.current !== generation) {
        await setMicrophoneEnabled(false)
      }
    } catch (e) {
      pressedRef.current = false
      setIsSpeaking(false)
      const message =
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? '마이크 권한을 허용해 주세요'
          : '마이크를 켤 수 없어요'
      setError(message)
    }
  }, [enabled, setMicrophoneEnabled])

  const handleStop = useCallback(async () => {
    if (!pressedRef.current) return
    pressedRef.current = false
    pressGenerationRef.current++
    setIsSpeaking(false)
    try {
      await setMicrophoneEnabled(false)
    } catch {
      // mute 실패는 사용자 알림 가치 낮음.
    }
  }, [setMicrophoneEnabled])

  const label = !enabled
    ? '콘텐츠 진행 중일 때 사용할 수 있어요'
    : isSpeaking
      ? '말하는 중...'
      : '꾹 눌러서 말하세요'

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.button} ${isSpeaking ? styles.buttonActive : ''}`}
        disabled={!enabled}
        onPointerDown={event => {
          event.preventDefault()
          ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
          void handleStart()
        }}
        onPointerUp={() => void handleStop()}
        onPointerLeave={() => void handleStop()}
        onPointerCancel={() => void handleStop()}
        aria-pressed={isSpeaking}
        aria-label={isSpeaking ? '마이크 ON (송신 중)' : '꾹 눌러서 말하기'}
      >
        {isSpeaking ? 'ON' : 'PTT'}
      </button>
      <p className={`${styles.hint} ${error ? styles.error : ''}`}>{error ?? label}</p>
    </div>
  )
}
