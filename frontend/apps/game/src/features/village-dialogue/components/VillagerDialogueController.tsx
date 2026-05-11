import { useEffect, useState } from 'react'
import { useVillageDialogueSession } from '../useVillageDialogueSession'
import type { VillagerChoice, VillagerNpcId } from '../types'
import { VillagerChoiceOverlay } from './VillagerChoiceOverlay'

interface VillagerDialogueControllerProps {
  npcId: VillagerNpcId | null
  patientProfileId: number | undefined
  isOpen: boolean
  onClose: () => void
  onTextChange?: (text: string) => void
}

export function VillagerDialogueController({
  npcId,
  patientProfileId,
  isOpen,
  onClose,
  onTextChange,
}: VillagerDialogueControllerProps) {
  const {
    status,
    currentScene,
    currentResponse,
    script,
    startVillagerDialogue,
    selectChoice,
    closeDialogue,
  } = useVillageDialogueSession(patientProfileId, onClose)
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !npcId) return
    void startVillagerDialogue(npcId)
  }, [isOpen, npcId, startVillagerDialogue])

  const visibleText = currentResponse ?? currentScene?.questionText ?? ''

  useEffect(() => {
    if (!isOpen || !visibleText) return
    onTextChange?.(visibleText)
  }, [isOpen, onTextChange, visibleText])

  useEffect(() => {
    setSelectedChoiceId(null)
  }, [currentScene?.sceneId, status])

  if (!isOpen || !script || !currentScene) return null

  const isWaitingChoice = status === 'waiting_choice'
  const isBusy =
    status === 'opening' ||
    status === 'submitting_choice' ||
    status === 'showing_response' ||
    status === 'closing'

  const handleSelectChoice = (choice: VillagerChoice) => {
    setSelectedChoiceId(choice.choiceIntentId)
    void selectChoice(choice)
  }

  return (
    <>
      {isWaitingChoice && (
        <VillagerChoiceOverlay
          choices={currentScene.choices}
          disabled={isBusy}
          selectedChoiceId={selectedChoiceId}
          onSelect={handleSelectChoice}
        />
      )}
      {status === 'error' && (
        <button
          type="button"
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 42,
          }}
          onClick={closeDialogue}
        >
          닫기
        </button>
      )}
    </>
  )
}
