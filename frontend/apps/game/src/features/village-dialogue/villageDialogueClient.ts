import type { VillagerChoiceEvent } from './types'

const LOCAL_STORAGE_KEY = 'villager_dialogue_events'
const LOCAL_SESSION_STORAGE_KEY = 'villager_dialogue_sessions'

export async function saveVillagerChoiceEvent(event: VillagerChoiceEvent) {
  const mode = import.meta.env.VITE_VILLAGE_DIALOGUE_SAVE_MODE ?? 'local'

  if (mode === 'backend') {
    await fetch(`/api/v1/dialogue/sessions/${event.sessionId}/turns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        clientEventId: event.clientEventId,
        npcId: event.npcId,
        npcName: event.npcName,
        questionText: event.questionText,
        sceneId: event.sceneId,
        nodeId: event.nodeId,
        topicId: event.topicId,
        selectedChoice: {
          choiceIntentId: event.choiceIntentId,
          text: event.choiceText,
        },
        intensity: event.intensity,
        concernFlags: event.concernFlags,
        protectiveFactors: event.protectiveFactors,
        generatedBy: event.generatedBy,
      }),
    })

    return
  }

  const prev = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '[]') as VillagerChoiceEvent[]
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...prev, event]))
}

export async function cancelVillagerDialogueSession(sessionId: string) {
  const mode = import.meta.env.VITE_VILLAGE_DIALOGUE_SAVE_MODE ?? 'local'

  if (mode === 'backend') {
    await fetch(`/api/v1/dialogue/sessions/${sessionId}/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        finishReason: 'CANCELLED',
      }),
    })

    return
  }

  const prev = JSON.parse(localStorage.getItem(LOCAL_SESSION_STORAGE_KEY) ?? '[]') as Array<{
    sessionId: string
    status: string
    finishedAt: string
  }>
  localStorage.setItem(
    LOCAL_SESSION_STORAGE_KEY,
    JSON.stringify([
      ...prev,
      {
        sessionId,
        status: 'CANCELLED',
        finishedAt: new Date().toISOString(),
      },
    ]),
  )
}
