import { useEffect, type CSSProperties } from 'react'
import { useSpeechRecognition } from '../useSpeechRecognition'

type LighthouseSttOverlayProps = {
  visible: boolean
  disabled: boolean
  onSubmit: (transcript: string) => void
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 'clamp(300px, 32vh, 360px)',
  zIndex: 40,
  width: 'min(720px, 60vw)',
  transform: 'translateX(-50%)',
  pointerEvents: 'none',
}

const panelStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
  padding: 18,
  borderRadius: 12,
  border: '4px solid #7a5630',
  background: 'rgba(255, 243, 212, 0.96)',
  boxShadow: '0 6px 0 rgba(43, 27, 16, 0.26), inset 0 0 0 2px rgba(247, 216, 148, 0.8)',
  pointerEvents: 'auto',
}

const micButtonBase: CSSProperties = {
  width: 92,
  height: 92,
  borderRadius: '50%',
  border: '4px solid #7a5630',
  background: '#fff3d4',
  color: '#4b341f',
  fontSize: 40,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 5px 0 rgba(43, 27, 16, 0.26), inset 0 0 0 2px rgba(247, 216, 148, 0.8)',
  transition: 'transform 140ms ease, background 140ms ease, color 140ms ease',
}

const micButtonListening: CSSProperties = {
  background: '#ffb4a2',
  borderColor: '#7a2f1f',
  color: '#7a2f1f',
}

const statusTextStyle: CSSProperties = {
  fontFamily: '"Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif',
  fontSize: 'clamp(16px, 1.05vw, 20px)',
  fontWeight: 700,
  color: '#4b341f',
  textAlign: 'center',
  minHeight: 24,
}

const transcriptBoxStyle: CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '10px 14px',
  borderRadius: 8,
  border: '2px dashed rgba(122, 86, 48, 0.55)',
  background: 'rgba(255, 255, 255, 0.55)',
  fontFamily: '"Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif',
  fontSize: 'clamp(16px, 1.05vw, 20px)',
  color: '#3a2814',
  whiteSpace: 'pre-wrap',
  textAlign: 'center',
}

const errorTextStyle: CSSProperties = {
  fontFamily: '"Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif',
  fontSize: 14,
  color: '#9a2f1f',
  textAlign: 'center',
}

export function LighthouseSttOverlay({ visible, disabled, onSubmit }: LighthouseSttOverlayProps) {
  const {
    supported,
    status,
    finalTranscript,
    interimTranscript,
    errorMessage,
    start,
    stop,
    reset,
  } = useSpeechRecognition({
    lang: 'ko-KR',
    onFinalResult: transcript => {
      onSubmit(transcript)
      reset()
    },
  })

  useEffect(() => {
    if (!visible) reset()
  }, [reset, visible])

  if (!visible) return null

  const isListening = status === 'listening'
  const liveText = (finalTranscript + ' ' + interimTranscript).trim()
  const buttonDisabled = disabled || !supported || status === 'denied'

  const statusLine = !supported
    ? '이 브라우저는 음성 인식을 지원하지 않아요.'
    : status === 'denied'
      ? '마이크 권한을 허용한 뒤 다시 시도해줘.'
      : isListening
        ? '듣고 있어요... 천천히 말해도 돼.'
        : '마이크 버튼을 누르고 한 마디 들려줘.'

  const handleClick = () => {
    if (buttonDisabled) return
    if (isListening) {
      stop()
      return
    }
    start()
  }

  return (
    <div style={overlayStyle} role="group" aria-label="등대지기 음성 입력">
      <div style={panelStyle}>
        <button
          type="button"
          disabled={buttonDisabled}
          aria-pressed={isListening}
          aria-label={isListening ? '음성 입력 멈추기' : '음성 입력 시작하기'}
          style={{
            ...micButtonBase,
            ...(isListening ? micButtonListening : null),
            opacity: buttonDisabled ? 0.55 : 1,
            cursor: buttonDisabled ? 'not-allowed' : 'pointer',
          }}
          onClick={handleClick}
        >
          {isListening ? '■' : '🎤'}
        </button>
        <div style={statusTextStyle} aria-live="polite">
          {statusLine}
        </div>
        <div style={transcriptBoxStyle} aria-live="polite">
          {liveText || '여기에 너의 말이 보일 거야.'}
        </div>
        {errorMessage ? <div style={errorTextStyle}>{errorMessage}</div> : null}
      </div>
    </div>
  )
}
