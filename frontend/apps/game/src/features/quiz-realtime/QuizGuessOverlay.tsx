import { useEffect, useRef, useState } from 'react'

/**
 * 그림 퀴즈 정답 입력 오버레이 (S14P31E103-820).
 *
 * <p>Phaser 자체 키 입력은 한글 IME (composition 이벤트) 처리가 안 돼서 영문/숫자만 들어간다. HTML {@code <input>} 으로
 * 우회 — {@code QuizJoinCodeOverlay} 와 동일 패턴.
 *
 * <p>현 라운드 동안 항상 보이는 sticky 입력 줄. round 종료 / 게임 종료 / leave 시 부모가 {@code open=false} 로 닫는다.
 */

type QuizGuessOverlayProps = {
  open: boolean
  onSubmit: (text: string) => void
}

const MAX_LENGTH = 40

const styles = {
  wrapper: {
    position: 'fixed' as const,
    left: '50%',
    bottom: 36,
    transform: 'translateX(-50%)',
    zIndex: 1000,
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    fontFamily:
      '"Pretendard Variable", Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, sans-serif',
  },
  input: {
    width: 'min(420px, 70vw)',
    boxSizing: 'border-box' as const,
    padding: '14px 18px',
    fontSize: 18,
    fontWeight: 600,
    border: '2px solid #3b4864',
    borderRadius: 14,
    background: '#0f1626',
    color: '#ffffff',
    outline: 'none',
    fontFamily: 'inherit',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
  },
  submit: {
    padding: '12px 22px',
    background: '#f4a64a',
    color: '#1a0e05',
    border: 'none',
    borderRadius: 999,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer' as const,
    boxShadow: '0 8px 22px rgba(0, 0, 0, 0.4)',
  },
  submitDisabled: {
    background: '#5a6473',
    color: '#cfd6e3',
    cursor: 'not-allowed' as const,
  },
}

export function QuizGuessOverlay({ open, onSubmit }: QuizGuessOverlayProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      // 라운드 시작/재오픈 시 자동 포커스 + 잔여 텍스트 초기화. 사용자가 손가락으로 다른 곳 누르고 다시 와도 흐름이 깔끔.
      setValue('')
      const handle = window.setTimeout(() => inputRef.current?.focus(), 20)
      return () => window.clearTimeout(handle)
    }
    setValue('')
    return undefined
  }, [open])

  if (!open) return null

  const trimmed = value.trim()
  const canSubmit = trimmed.length > 0

  const submit = () => {
    if (!canSubmit) return
    onSubmit(trimmed)
    setValue('')
    // 다시 포커스 — 다음 추측 입력을 위해.
    inputRef.current?.focus()
  }

  return (
    <form
      style={styles.wrapper}
      onSubmit={e => {
        e.preventDefault()
        submit()
      }}
    >
      <input
        ref={inputRef}
        style={styles.input}
        maxLength={MAX_LENGTH}
        value={value}
        placeholder="정답을 입력하세요"
        onChange={e => setValue(e.target.value)}
        aria-label="정답 입력"
      />
      <button
        type="submit"
        style={canSubmit ? styles.submit : { ...styles.submit, ...styles.submitDisabled }}
        disabled={!canSubmit}
      >
        입력
      </button>
    </form>
  )
}
