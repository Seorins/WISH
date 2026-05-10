import { useEffect } from 'react'
import { useLighthouseEmotionSession } from '../useLighthouseEmotionSession'
import type { LighthouseEmotionState } from '../types'
import { LighthouseChoiceOverlay } from './LighthouseChoiceOverlay'

type LighthouseEmotionControllerProps = {
  patientProfileId: number
  isOpen: boolean
  onClose: () => void
  onTextChange?: (text: string) => void
}

function getLighthouseDisplayText(state: LighthouseEmotionState) {
  if (state.status === 'starting') {
    return '등대지기가 불빛을 살피고 있어요...'
  }

  if (state.status === 'submitting_choice') {
    return state.currentScene?.questionText ?? '잠시만 기다려줘...'
  }

  if (state.status === 'showing_response') {
    return state.npcResponseLines.join('\n') || '고개를 끄덕이고 있어요.'
  }

  if (state.status === 'closing' || state.status === 'finished') {
    return state.closingLines.join('\n') || '오늘 말해줘서 고맙구나.'
  }

  if (state.status === 'error') {
    return state.errorMessage ?? '잠시 후 다시 말을 걸어줘.'
  }

  return state.currentScene?.questionText ?? ''
}

export function LighthouseEmotionController({
  patientProfileId,
  isOpen,
  onClose,
  onTextChange,
}: LighthouseEmotionControllerProps) {
  const { state, start, selectChoice, cancel, reset } = useLighthouseEmotionSession({
    patientProfileId,
    onFinished: onClose,
  })

  useEffect(() => {
    if (!isOpen) {
      reset()
      return
    }

    if (state.status === 'idle') {
      void start()
    }
  }, [isOpen, reset, start, state.status])

  const displayText = getLighthouseDisplayText(state)

  useEffect(() => {
    if (!isOpen || !displayText) return
    onTextChange?.(displayText)
  }, [displayText, isOpen, onTextChange])

  if (!isOpen) return null

  const showChoices = state.status === 'waiting_choice' && state.currentScene !== null

  return (
    <>
      <LighthouseChoiceOverlay
        visible={showChoices}
        choices={state.currentScene?.choices ?? []}
        secondaryAction={state.currentScene?.secondaryAction ?? null}
        selectedChoiceIntentId={state.selectedChoiceIntentId}
        disabled={state.status !== 'waiting_choice'}
        onSelect={selectChoice}
      />
      {state.status === 'error' && (
        <button
          type="button"
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 42,
            padding: '10px 18px',
            borderRadius: 8,
            border: '3px solid #7a5630',
            background: '#fff3d4',
            color: '#4b341f',
            fontWeight: 800,
            cursor: 'pointer',
          }}
          onClick={cancel}
        >
          닫기
        </button>
      )}
    </>
  )
}
