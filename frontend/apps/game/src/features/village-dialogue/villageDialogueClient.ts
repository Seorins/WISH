import type { VillagerChoiceEvent } from './types'
import type { VillageDialogueNpcEnum } from './npcMapping'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'

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
    throw new Error('마을 친구와의 대화를 시작하지 못했어요.')
  }

  const payload = (await response.json()) as StartApiResponse
  if (!payload.data?.sessionId) {
    throw new Error('대화 세션을 만들지 못했어요.')
  }

  return {
    sessionId: payload.data.sessionId,
    status: payload.data.status,
  }
}

export async function saveVillagerChoiceEvent(event: VillagerChoiceEvent) {
  const response = await fetch(`${API_BASE_URL}/dialogue/sessions/${event.sessionId}/turns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
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

  if (!response.ok) {
    throw new Error('선택을 저장하지 못했어요.')
  }
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
    throw new Error('대화를 마치지 못했어요.')
  }
}
