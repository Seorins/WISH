import { useEffect, useState } from 'react'

/**
 * 그림 퀴즈 멀티플레이 코드 입력 오버레이 (S14P31E103-820).
 *
 * <p>Phaser 캔버스 위에 절대 위치 모달로 떠서 6자리 코드를 받는다. 실제 API 호출은 씬에서 처리 — 본 오버레이는 입력값을 정규화해서 이벤트로 돌려준다.
 *
 * <p>Phaser 자체 텍스트 입력은 한글 IME 처리가 까다로워 HTML input 으로 우회. AuthOverlay 와 동일 패턴.
 */

type QuizJoinCodeOverlayProps = {
  open: boolean
  onSubmit: (code: string) => void
  onCancel: () => void
}

const CODE_LENGTH = 6
const CODE_PATTERN = /^[A-Z0-9]+$/

const styles = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(20, 12, 4, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    fontFamily:
      '"Pretendard Variable", Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, sans-serif',
  },
  card: {
    width: 'min(420px, 92vw)',
    background: '#fcf8f0',
    border: '3px solid #a8845a',
    borderRadius: 24,
    padding: '32px 28px 24px',
    boxShadow: '0 20px 50px rgba(20, 12, 4, 0.4)',
    color: '#3a2614',
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
  },
  subtitle: {
    margin: '6px 0 20px',
    fontSize: 14,
    color: '#6a4a26',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '14px 16px',
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: 8,
    textAlign: 'center' as const,
    border: '2px solid #ddd0b8',
    borderRadius: 14,
    background: '#fff',
    color: '#3a2614',
    fontFamily: 'inherit',
    textTransform: 'uppercase' as const,
  },
  errorText: {
    marginTop: 8,
    minHeight: 18,
    fontSize: 13,
    color: '#a85b4d',
  },
  buttons: {
    display: 'flex',
    gap: 12,
    marginTop: 20,
  },
  cancel: {
    flex: 1,
    padding: '12px 16px',
    background: 'transparent',
    color: '#6a4a26',
    border: '2px solid #ddd0b8',
    borderRadius: 999,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer' as const,
  },
  submit: {
    flex: 2,
    padding: '12px 16px',
    background: '#d76a1f',
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer' as const,
  },
  submitDisabled: {
    background: '#c9a888',
    cursor: 'not-allowed' as const,
  },
}

export function QuizJoinCodeOverlay({ open, onSubmit, onCancel }: QuizJoinCodeOverlayProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValue('')
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const canSubmit = value.length === CODE_LENGTH && CODE_PATTERN.test(value)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      setError('코드는 영문/숫자 6글자야')
      return
    }
    onSubmit(value)
  }

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true">
      <form style={styles.card} onSubmit={handleSubmit}>
        <h2 style={styles.title}>방 코드 입력</h2>
        <p style={styles.subtitle}>친구가 알려준 6자리 코드를 적어줘</p>
        <input
          autoFocus
          inputMode="text"
          maxLength={CODE_LENGTH}
          value={value}
          style={styles.input}
          onChange={e => {
            const next = e.target.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '')
              .slice(0, CODE_LENGTH)
            setValue(next)
            if (error) setError(null)
          }}
          placeholder="ABCDEF"
          aria-label="방 코드"
        />
        <div style={styles.errorText}>{error ?? ''}</div>
        <div style={styles.buttons}>
          <button type="button" style={styles.cancel} onClick={onCancel}>
            취소
          </button>
          <button
            type="submit"
            style={canSubmit ? styles.submit : { ...styles.submit, ...styles.submitDisabled }}
            disabled={!canSubmit}
          >
            입장하기
          </button>
        </div>
      </form>
    </div>
  )
}
