import type { VillagerChoiceEvent } from './types'
import type { VillageDialogueNpcEnum } from './npcMapping'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'
const LOCAL_STORAGE_KEY = 'villager_dialogue_events'
const LOCAL_SESSION_STORAGE_KEY = 'villager_dialogue_sessions'

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type VillageDialogueSessionStatus = 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED'

export type StartVillageDialogueSessionResponse = {
  sessionId: number
  status: VillageDialogueSessionStatus
}

type StartApiResponse = {
  code: string
  message: string
  data: {
    sessionId: number
    status: VillageDialogueSessionStatus
  } | null
}

export async function startVillageDialogueSession(
  patientProfileId: number,
  npcName: VillageDialogueNpcEnum,
): Promise<StartVillageDialogueSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/dialogue/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ patientProfileId, npcName }),
  })

  if (!response.ok) {
    throw new Error('대화 세션을 시작하지 못했습니다.')
  }

  const payload = (await response.json()) as StartApiResponse
  if (!payload.data?.sessionId) {
    throw new Error('대화 세션 응답이 올바르지 않습니다.')
  }

  return {
    sessionId: payload.data.sessionId,
    status: payload.data.status,
  }
}

export async function saveVillagerChoiceEvent(event: VillagerChoiceEvent) {
  const mode = import.meta.env.VITE_VILLAGE_DIALOGUE_SAVE_MODE ?? 'local'

  if (mode === 'backend' || typeof event.sessionId === 'number') {
    const response = await fetch(`${API_BASE_URL}/dialogue/sessions/${event.sessionId}/turns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        clientEventId: event.clientEventId,
        npcId: event.npcId,
        npcName: event.npcName,
        topicId: event.topicId,
        sceneId: event.sceneId,
        nodeId: event.nodeId,
        questionText: event.questionText,
        selectedChoice: {
          choiceIntentId: event.choiceIntentId,
          text: event.choiceText,
          intensity: event.intensity,
          concernFlags: event.concernFlags,
          protectiveFactors: event.protectiveFactors,
        },
        generatedBy: event.generatedBy,
      }),
    })

    if (!response.ok) {
      throw new Error('대화 선택을 저장하지 못했습니다.')
    }

    return
  }

  const prev = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '[]') as VillagerChoiceEvent[]
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...prev, event]))
}

export type VillageDialogueFinishReason = 'COMPLETED' | 'CANCELLED' | 'ERROR'

export async function finishVillageDialogueSession(
  sessionId: number,
  finishReason: VillageDialogueFinishReason,
) {
  const response = await fetch(`${API_BASE_URL}/dialogue/sessions/${sessionId}/finish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ finishReason }),
  })

  if (!response.ok) {
    throw new Error('대화 세션을 종료하지 못했습니다.')
  }
}

export async function cancelVillagerDialogueSession(sessionId: string | number) {
  if (typeof sessionId === 'number') {
    await finishVillageDialogueSession(sessionId, 'CANCELLED')
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
