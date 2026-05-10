import type { VillagerChoiceEvent } from './types'

const LOCAL_STORAGE_KEY = 'villager_dialogue_events'

export async function saveVillagerChoiceEvent(event: VillagerChoiceEvent) {
  const mode = import.meta.env.VITE_VILLAGE_DIALOGUE_SAVE_MODE ?? 'local'

  if (mode === 'backend') {
    await fetch(`/api/v1/emotion-checkin/sessions/${event.sessionId}/turns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selectedChoice: {
          choiceIntentId: event.choiceIntentId,
          text: event.choiceText,
          intensity: event.intensity,
          concernFlags: event.concernFlags,
          protectiveFactors: event.protectiveFactors,
        },
        sceneId: event.sceneId,
        npcId: event.npcId,
        questionText: event.questionText,
      }),
    })

    return
  }

  const prev = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '[]') as VillagerChoiceEvent[]
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...prev, event]))
}
