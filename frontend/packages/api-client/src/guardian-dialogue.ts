import { apiClient } from './client'
import type { ApiResponse, PageResponse } from './artworks'

export type GuardianDialogueNpc =
  | 'YEONGCHEOL'
  | 'JOEUN'
  | 'DAIN'
  | 'GEONBIN'
  | 'SEORIN'
  | 'JEONGHO'
  | 'SEHYEON'

export type GuardianDialogueSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED'

export type GuardianDialogueFinishReason = 'COMPLETED' | 'ABANDONED' | 'EXPIRED' | null

export type GuardianDialogueGeneratedBy = 'CLAUDE' | 'TEMPLATE' | 'FALLBACK'

export type GuardianDialogueSessionMeta = {
  sessionId: number
  npcName: GuardianDialogueNpc
  status: GuardianDialogueSessionStatus
  stepCount: number
  maxSteps: number
  finishReason: GuardianDialogueFinishReason
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
}

export type GuardianDialogueTurn = {
  id: number
  stepIndex: number
  questionText: string
  choiceIntentId: string | null
  choiceText: string | null
  intensity: number | null
  concernFlags: string[]
  protectiveFactors: string[]
  generatedBy: GuardianDialogueGeneratedBy
  createdAt: string
}

export type GuardianDialogueSessionDetail = GuardianDialogueSessionMeta & {
  patientProfileId: number
  turns: GuardianDialogueTurn[]
}

export type ListGuardianDialogueSessionsParams = {
  patientProfileId: number
  npc?: GuardianDialogueNpc
  from?: string
  to?: string
  page?: number
  size?: number
}

export async function listGuardianDialogueSessions({
  patientProfileId,
  npc,
  from,
  to,
  page = 0,
  size = 20,
}: ListGuardianDialogueSessionsParams) {
  const response = await apiClient.get<ApiResponse<PageResponse<GuardianDialogueSessionMeta>>>(
    `/guardian/patients/${patientProfileId}/dialogue/sessions`,
    {
      params: {
        ...(npc ? { npc } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        page,
        size,
        sort: 'startedAt,desc',
      },
    },
  )
  return response.data
}

export async function getGuardianDialogueSession(patientProfileId: number, sessionId: number) {
  const response = await apiClient.get<ApiResponse<GuardianDialogueSessionDetail>>(
    `/guardian/patients/${patientProfileId}/dialogue/sessions/${sessionId}`,
  )
  return response.data
}
