import { useQueries, useQuery } from '@tanstack/react-query'
import {
  getGuardianDialogueSession,
  listGuardianDialogueSessions,
  type GuardianDialogueNpc,
} from '@wish/api-client'
import { deriveDominantTone, type EmotionTone } from './adapters'

export const GUARDIAN_DIALOGUE_SESSIONS_QUERY_KEY = 'guardian-dialogue-sessions'
export const GUARDIAN_DIALOGUE_SESSION_QUERY_KEY = 'guardian-dialogue-session'

type SessionsParams = {
  patientProfileId: number | null | undefined
  npc?: GuardianDialogueNpc
  from?: string
  to?: string
  size?: number
}

export function useGuardianDialogueSessions({
  patientProfileId,
  npc,
  from,
  to,
  size = 20,
}: SessionsParams) {
  return useQuery({
    queryKey: [
      GUARDIAN_DIALOGUE_SESSIONS_QUERY_KEY,
      patientProfileId,
      npc ?? null,
      from ?? null,
      to ?? null,
      size,
    ],
    queryFn: async () => {
      const res = await listGuardianDialogueSessions({
        patientProfileId: patientProfileId!,
        npc,
        from,
        to,
        page: 0,
        size,
      })
      return res.data
    },
    enabled: typeof patientProfileId === 'number' && patientProfileId > 0,
  })
}

export function useGuardianDialogueSession(
  patientProfileId: number | null | undefined,
  sessionId: number | null | undefined,
) {
  return useQuery({
    queryKey: [GUARDIAN_DIALOGUE_SESSION_QUERY_KEY, patientProfileId, sessionId],
    queryFn: async () => {
      const res = await getGuardianDialogueSession(patientProfileId!, sessionId!)
      return res.data
    },
    enabled:
      typeof patientProfileId === 'number' &&
      patientProfileId > 0 &&
      typeof sessionId === 'number' &&
      sessionId > 0,
  })
}

export function useGuardianDialogueNpcTones(
  patientProfileId: number | null | undefined,
  npcs: GuardianDialogueNpc[],
): Record<GuardianDialogueNpc, EmotionTone | null> {
  const enabled = typeof patientProfileId === 'number' && patientProfileId > 0

  const sessionQueries = useQueries({
    queries: npcs.map(npc => ({
      queryKey: [GUARDIAN_DIALOGUE_SESSIONS_QUERY_KEY, patientProfileId, npc, null, null, 1],
      queryFn: async () => {
        const res = await listGuardianDialogueSessions({
          patientProfileId: patientProfileId!,
          npc,
          page: 0,
          size: 1,
        })
        return res.data
      },
      enabled,
    })),
  })

  const detailQueries = useQueries({
    queries: npcs.map((_, i) => {
      const sessionId = sessionQueries[i]?.data?.content?.[0]?.sessionId ?? null
      return {
        queryKey: [GUARDIAN_DIALOGUE_SESSION_QUERY_KEY, patientProfileId, sessionId],
        queryFn: async () => {
          const res = await getGuardianDialogueSession(patientProfileId!, sessionId!)
          return res.data
        },
        enabled: enabled && typeof sessionId === 'number' && sessionId > 0,
      }
    }),
  })

  const out = {} as Record<GuardianDialogueNpc, EmotionTone | null>
  npcs.forEach((npc, i) => {
    const detail = detailQueries[i]?.data
    out[npc] = detail ? deriveDominantTone(detail.turns) : null
  })
  return out
}
