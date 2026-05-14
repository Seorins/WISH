import { useEffect, useState } from 'react'
import { DialogueLayer } from '../../dialogue/common/DialogueLayer'
import { resolvePatientProfileIdOrFetch } from '../../exerciseSessions/patientProfile'
import { getNpcIdentity } from '../../npcIdentity'
import {
  LIGHTHOUSE_LOADING_LINE,
  LIGHTHOUSE_OPENING_SAFE_LINES,
  LIGHTHOUSE_OPENING_WELCOME_LINES,
  useLighthouseEmotionSession,
} from '../useLighthouseEmotionSession'
import type { LighthouseDialogueStatus } from '../types'
import { LighthouseSttOverlay } from './LighthouseSttOverlay'

type LighthouseEmotionControllerProps = {
  patientProfileId: number
  isOpen: boolean
  onClose: () => void
  onTextChange?: (text: string) => void
}

const LIGHTHOUSE_IDENTITY = getNpcIdentity('lighthouse_keeper')
const SAFE_EMPTY_LINE = '괜찮아. 천천히 말해도 된단다.'
const SAFE_FINAL_LINE = '오늘은 여기까지 해도 괜찮아.'

function isLoadingStatus(status: LighthouseDialogueStatus) {
  return status === 'submitting_chat'
}

function getVisibleLines({
  status,
  currentQuestionText,
  npcResponseLines,
  closingLines,
}: {
  status: LighthouseDialogueStatus
  currentQuestionText: string
  npcResponseLines: string[]
  closingLines: string[]
}) {
  if (status === 'opening_welcome') {
    return LIGHTHOUSE_OPENING_WELCOME_LINES
  }

  if (status === 'opening_safe_line') {
    return LIGHTHOUSE_OPENING_SAFE_LINES
  }

  if (status === 'showing_response') {
    return npcResponseLines.length > 0 ? npcResponseLines : [SAFE_EMPTY_LINE]
  }

  if (status === 'submitting_chat') {
    return [LIGHTHOUSE_LOADING_LINE]
  }

  if (status === 'waiting_final_close' || status === 'finished') {
    return closingLines.length > 0 ? closingLines : [SAFE_FINAL_LINE]
  }

  return currentQuestionText ? [currentQuestionText] : []
}

export function LighthouseEmotionController({
  patientProfileId,
  isOpen,
  onClose,
  onTextChange,
}: LighthouseEmotionControllerProps) {
  const [resolvedPatientProfileId, setResolvedPatientProfileId] = useState<number | undefined>()
  const effectivePatientProfileId =
    Number.isInteger(patientProfileId) && patientProfileId > 0
      ? patientProfileId
      : resolvedPatientProfileId
  const hasValidPatientProfileId =
    Number.isInteger(effectivePatientProfileId) && (effectivePatientProfileId ?? 0) > 0
  const { state, start, advance, submitSttInput, cancel, close, reset } =
    useLighthouseEmotionSession({
      patientProfileId: effectivePatientProfileId ?? 0,
      onFinished: onClose,
    })

  useEffect(() => {
    if (!isOpen) {
      setResolvedPatientProfileId(undefined)
      return
    }

    if (hasValidPatientProfileId) return

    let cancelled = false

    void resolvePatientProfileIdOrFetch().then(id => {
      if (cancelled) return
      setResolvedPatientProfileId(id)
    })

    return () => {
      cancelled = true
    }
  }, [hasValidPatientProfileId, isOpen])

  useEffect(() => {
    if (!isOpen) {
      reset()
      return
    }

    if (state.status === 'idle' && hasValidPatientProfileId) {
      void start()
    }
  }, [hasValidPatientProfileId, isOpen, reset, start, state.status])

  const loading = isLoadingStatus(state.status)
  const visibleLines = getVisibleLines({
    status: state.status,
    currentQuestionText: state.currentQuestionText,
    npcResponseLines: state.npcResponseLines,
    closingLines: state.closingLines,
  })

  useEffect(() => {
    if (!isOpen) return
    if (!hasValidPatientProfileId && state.status === 'idle') return
    const text = visibleLines.join('\n')
    if (!text) return
    onTextChange?.(text)
  }, [hasValidPatientProfileId, isOpen, onTextChange, state.status, visibleLines])

  if (!isOpen) return null

  const isAwaitingUserSpeech =
    state.status === 'entry_question' || state.status === 'showing_response'
  const canAdvance =
    state.status === 'opening_welcome' ||
    state.status === 'opening_safe_line' ||
    state.status === 'waiting_final_close'

  const handleSttSubmit = (transcript: string) => {
    void submitSttInput(transcript)
  }

  return (
    <>
      <DialogueLayer
        isOpen={isOpen}
        displayName={LIGHTHOUSE_IDENTITY.displayName}
        visibleLines={visibleLines}
        choices={[]}
        showChoices={false}
        loading={loading}
        loadingText={LIGHTHOUSE_LOADING_LINE}
        footerAction={null}
        showFrame={false}
        onAdvance={canAdvance ? advance : undefined}
        onClose={close}
        onCancel={cancel}
      />
      <LighthouseSttOverlay
        visible={isAwaitingUserSpeech && !loading}
        disabled={loading}
        onSubmit={handleSttSubmit}
      />
    </>
  )
}
