import { useEffect } from 'react'
import { DialogueLayer } from '../../dialogue/common/DialogueLayer'
import { getNpcIdentity } from '../../npcIdentity'
import { useLighthouseEmotionSession } from '../useLighthouseEmotionSession'
import type { EmotionChoiceViewModel, LighthouseDialogueStatus } from '../types'

type LighthouseEmotionControllerProps = {
  patientProfileId: number
  isOpen: boolean
  onClose: () => void
  onTextChange?: (text: string) => void
}

const LIGHTHOUSE_IDENTITY = getNpcIdentity('lighthouse_keeper')

function getLoadingText(status: LighthouseDialogueStatus) {
  if (status === 'starting') return '등대지기가 불빛을 살피고 있어요'
  if (status === 'finishing') return '등대 불빛을 정리하고 있어요'
  return '등대지기가 불빛을 모으는 중이에요'
}

function isLoadingStatus(status: LighthouseDialogueStatus) {
  return (
    status === 'starting' ||
    status === 'submitting_choice' ||
    status === 'loading_next' ||
    status === 'finishing'
  )
}

function getVisibleLines({
  status,
  currentSceneQuestion,
  npcResponseLines,
  closingLines,
  errorMessage,
}: {
  status: LighthouseDialogueStatus
  currentSceneQuestion?: string
  npcResponseLines: string[]
  closingLines: string[]
  errorMessage: string | null
}) {
  if (status === 'showing_response') {
    return npcResponseLines.length > 0 ? npcResponseLines : ['천천히 골라도 괜찮아.']
  }

  if (status === 'showing_closing' || status === 'finished') {
    return closingLines.length > 0 ? closingLines : ['오늘 이야기해줘서 고맙구나.']
  }

  if (status === 'error') {
    return [errorMessage ?? '잠시 후 다시 말을 걸어줘.']
  }

  return currentSceneQuestion ? [currentSceneQuestion] : []
}

function getVisibleChoices(
  sceneChoices: EmotionChoiceViewModel[],
  secondaryAction: EmotionChoiceViewModel | null,
) {
  const primaryChoices = sceneChoices.filter(choice => choice.choiceIntentId !== 'rest_today')
  const visibleChoices = primaryChoices.slice(0, 3)

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
  const { state, start, selectChoice, cancel, close, reset } = useLighthouseEmotionSession({
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

  const loading = isLoadingStatus(state.status)
  const visibleLines = getVisibleLines({
    status: state.status,
    currentSceneQuestion: state.currentScene?.questionText,
    npcResponseLines: state.npcResponseLines,
    closingLines: state.closingLines,
    errorMessage: state.errorMessage,
  })

  useEffect(() => {
    if (!isOpen) return
    const text = loading ? getLoadingText(state.status) : visibleLines.join('\n')
    if (!text) return
    onTextChange?.(text)
  }, [isOpen, loading, onTextChange, state.status, visibleLines])

  if (!isOpen) return null

  const showChoices = state.status === 'waiting_choice' && state.currentScene !== null
  const visibleChoices = showChoices
    ? getVisibleChoices(
        state.currentScene?.choices ?? [],
        state.currentScene?.secondaryAction ?? null,
      )
    : []
  return (
    <DialogueLayer
      isOpen={isOpen}
      displayName={LIGHTHOUSE_IDENTITY.displayName}
      visibleLines={visibleLines}
      choices={visibleChoices}
      showChoices={showChoices}
      selectedChoiceId={state.selectedChoiceIntentId}
      loading={loading}
      loadingText={getLoadingText(state.status)}
      footerAction={null}
      showFrame={false}
      onSelectChoice={choice => void selectChoice(choice)}
      onClose={close}
      onCancel={cancel}
    />
  )
}
