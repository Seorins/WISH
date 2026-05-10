import type { VillagerChoiceEvent } from './types'

const LOCAL_STORAGE_KEY = 'villager_dialogue_events'

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
        questionText: event.questionText,
        selectedChoice: {
          choiceIntentId: event.choiceIntentId,
          text: event.choiceText,
          intensity: event.intensity,
          concernFlags: event.concernFlags,
          protectiveFactors: event.protectiveFactors,
        },
      }),
    })

    return
  }

  const prev = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '[]') as VillagerChoiceEvent[]
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...prev, event]))
}
