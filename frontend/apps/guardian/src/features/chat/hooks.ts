import { useQueries, useQuery } from '@tanstack/react-query'
import {
  getGuardianDialogueSession,
  listGuardianDialogueSessions,
  type GuardianDialogueNpc,
  type GuardianDialogueSessionMeta,
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

/** 백엔드에 status 필터가 없어 클라이언트에서 FINISHED (정상 종료된) 세션만 남긴다.
 *  IN_PROGRESS / ABANDONED 는 사용자에게 노출하지 않는다. */
export function pickFirstFinished(
  metas: GuardianDialogueSessionMeta[] | undefined,
): GuardianDialogueSessionMeta | null {
  if (!metas) return null
  for (const m of metas) {
    if (m.status === 'FINISHED') return m
  }
  return null
}

export function useGuardianDialogueNpcTones(
  patientProfileId: number | null | undefined,
  npcs: GuardianDialogueNpc[],
): Record<GuardianDialogueNpc, EmotionTone | null> {
  const enabled = typeof patientProfileId === 'number' && patientProfileId > 0
  const sessionsSize = 10

  const sessionQueries = useQueries({
    queries: npcs.map(npc => ({
      queryKey: [
        GUARDIAN_DIALOGUE_SESSIONS_QUERY_KEY,
        patientProfileId,
        npc,
        null,
        null,
        sessionsSize,
      ],
      queryFn: async () => {
        const res = await listGuardianDialogueSessions({
          patientProfileId: patientProfileId!,
          npc,
          page: 0,
          size: sessionsSize,
        })
        return res.data
      },
      enabled,
    })),
  })

  const detailQueries = useQueries({
    queries: npcs.map((_, i) => {
      const latestFinished = pickFirstFinished(sessionQueries[i]?.data?.content)
      const sessionId = latestFinished?.sessionId ?? null
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
