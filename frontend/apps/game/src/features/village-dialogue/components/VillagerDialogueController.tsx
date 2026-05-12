import { useEffect } from 'react'
import { DialogueLayer } from '../../dialogue/common/DialogueLayer'
import { useVillageDialogueSession } from '../useVillageDialogueSession'
import type { DailyActivityState, VillagerChoice, VillagerNpcId } from '../types'

interface VillagerDialogueControllerProps {
  npcId: VillagerNpcId | null
  patientProfileId: number | undefined
  isOpen: boolean
  onClose: () => void
  onTextChange?: (text: string) => void
  dailyActivityState?: DailyActivityState
}

export function VillagerDialogueController({
  npcId,
  patientProfileId,
  isOpen,
  onClose,
  onTextChange,
  dailyActivityState,
}: VillagerDialogueControllerProps) {
  const {
    status,
    currentNode,
    visibleLines,
    visibleText,
    selectedChoiceIntentId,
    script,
    startVillagerDialogue,
    selectChoice,
    advanceDialogue,
    cancelDialogue,
  } = useVillageDialogueSession(patientProfileId, onClose, dailyActivityState)

  useEffect(() => {
    if (!isOpen || !npcId) return
    void startVillagerDialogue(npcId)
  }, [isOpen, npcId, startVillagerDialogue])

  useEffect(() => {
    if (!isOpen || !visibleText) return
    onTextChange?.(visibleText)
  }, [isOpen, onTextChange, visibleText])

  if (!isOpen || !script) return null

  const isWaitingChoice = status === 'waiting_choice'

  const handleSelectChoice = (choice: VillagerChoice) => {
    void selectChoice(choice)
  }

  return (
    <DialogueLayer
      isOpen={isOpen}
      displayName={script.displayName}
      visibleLines={
        status === 'error' ? ['대화를 저장하지 못했어. 잠시 후 다시 해보자.'] : visibleLines
      }
      choices={currentNode?.choices ?? []}
      showChoices={isWaitingChoice}
      selectedChoiceId={selectedChoiceIntentId}
      footerAction={null}
      showFrame={false}
      onSelectChoice={handleSelectChoice}
      onAdvance={advanceDialogue}
      onClose={advanceDialogue}
      onCancel={cancelDialogue}
    />
  )
}
