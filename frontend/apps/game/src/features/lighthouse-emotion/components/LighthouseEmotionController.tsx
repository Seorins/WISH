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
import type { EmotionChoiceViewModel, LighthouseDialogueStatus } from '../types'

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
  return status === 'loading_llm'
}

function getVisibleLines({
  status,
  currentSceneQuestion,
  npcResponseLines,
  closingLines,
}: {
  status: LighthouseDialogueStatus
  currentSceneQuestion?: string
  npcResponseLines: string[]
  closingLines: string[]
}) {
  if (status === 'opening_welcome') {
    return LIGHTHOUSE_OPENING_WELCOME_LINES
  }

  if (status === 'opening_safe_line') {
    return LIGHTHOUSE_OPENING_SAFE_LINES
  }

  if (status === 'showing_local_bridge' || status === 'showing_response') {
    return npcResponseLines.length > 0 ? npcResponseLines : [SAFE_EMPTY_LINE]
  }

  if (status === 'loading_llm') {
    return [LIGHTHOUSE_LOADING_LINE]
  }

  if (status === 'waiting_final_close' || status === 'finished') {
    return closingLines.length > 0 ? closingLines : [SAFE_FINAL_LINE]
  }

  return currentSceneQuestion ? [currentSceneQuestion] : []
}

function getVisibleChoices(
  sceneChoices: EmotionChoiceViewModel[],
  secondaryAction: EmotionChoiceViewModel | null,
) {
  const visibleChoices = sceneChoices.slice(0, 3)

  if (
    secondaryAction &&
    !visibleChoices.some(choice => choice.choiceIntentId === secondaryAction.choiceIntentId)
  ) {
    visibleChoices.push(secondaryAction)
  }

  return visibleChoices
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
  const { state, start, advance, selectChoice, cancel, close, reset } = useLighthouseEmotionSession(
    {
      patientProfileId: effectivePatientProfileId ?? 0,
      onFinished: onClose,
    },
  )

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
    currentSceneQuestion: state.currentScene?.questionText,
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

  const showChoices =
    (state.status === 'entry_question' || state.status === 'waiting_choice') &&
    state.currentScene !== null
  const visibleChoices = showChoices
    ? getVisibleChoices(
        state.currentScene?.choices ?? [],
        state.currentScene?.secondaryAction ?? null,
      )
    : []
  const canAdvance =
    state.status === 'opening_welcome' ||
    state.status === 'opening_safe_line' ||
    state.status === 'waiting_final_close'

  return (
    <DialogueLayer
      isOpen={isOpen}
      displayName={LIGHTHOUSE_IDENTITY.displayName}
      visibleLines={visibleLines}
      choices={visibleChoices}
      showChoices={showChoices && !loading}
      selectedChoiceId={state.selectedChoiceIntentId}
      loading={loading}
      loadingText={LIGHTHOUSE_LOADING_LINE}
      footerAction={null}
      showFrame={false}
      onSelectChoice={choice => void selectChoice(choice)}
      onAdvance={canAdvance ? advance : undefined}
      onClose={close}
      onCancel={cancel}
    />
  )
}
