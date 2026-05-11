import { useMemo, useState } from 'react'
import { ChatLayout } from '@/features/chat/components/ChatLayout'
import { CharacterSidebar } from '@/features/chat/components/CharacterSidebar'
import { ConversationMain } from '@/features/chat/components/ConversationMain'
import { EmotionPanel } from '@/features/chat/components/EmotionPanel'
import {
  CHARACTERS,
  EMOTION_SHARES,
  EMOTION_SIGNALS,
  EMOTION_TREND,
  MESSAGES,
  SESSION_META,
  SUMMARY,
  TODAY_SCORE,
} from '@/features/chat/data/mock'
import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import {
  CHARACTER_ID_TO_NPC,
  deriveFromSession,
  formatDurationLabel,
  formatWhenLabel,
} from '@/features/chat/adapters'
import {
  useGuardianDialogueNpcTones,
  useGuardianDialogueSession,
  useGuardianDialogueSessions,
} from '@/features/chat/hooks'
import type { GuardianDialogueNpc } from '@wish/api-client'
import type { EmotionTone } from '@/features/chat/data/mock'
import { useMyPatient } from '@/features/auth/hooks/useMyPatient'
import '@/features/dashboard/tokens.css'

export function ChatPage() {
  const [selectedId, setSelectedId] = useState(SESSION_META.characterId)
  const selected = CHARACTERS.find(c => c.id === selectedId) ?? CHARACTERS[0]

  const { data: patient } = useMyPatient()
  const patientProfileId = patient?.id ?? null
  const npc = CHARACTER_ID_TO_NPC[selectedId]

  const sidebarNpcList = useMemo(
    () =>
      CHARACTERS.map(c => CHARACTER_ID_TO_NPC[c.id]).filter((n): n is GuardianDialogueNpc => !!n),
    [],
  )
  const npcTones = useGuardianDialogueNpcTones(patientProfileId, sidebarNpcList)
  const sidebarTones = useMemo(() => {
    const out: Record<string, EmotionTone | null> = {}
    for (const c of CHARACTERS) {
      const n = CHARACTER_ID_TO_NPC[c.id]
      out[c.id] = n ? (npcTones[n] ?? null) : null
    }
    return out
  }, [npcTones])

  const sessionsQuery = useGuardianDialogueSessions({ patientProfileId, npc, size: 1 })
  const latestSessionId = sessionsQuery.data?.content?.[0]?.sessionId ?? null
  const latestMeta = sessionsQuery.data?.content?.[0] ?? null

  const detailQuery = useGuardianDialogueSession(patientProfileId, latestSessionId)

  const derived = useMemo(
    () => (detailQuery.data ? deriveFromSession(detailQuery.data) : null),
    [detailQuery.data],
  )

  const hasRealSession = !!derived && derived.messages.length > 0
  const isEmptyForLoggedIn = !!patientProfileId && sessionsQuery.isSuccess && !latestMeta

  const messages = hasRealSession ? derived!.messages : isEmptyForLoggedIn ? [] : MESSAGES
  const trend = hasRealSession ? derived!.trend : EMOTION_TREND
  const signals = hasRealSession ? derived!.signals : EMOTION_SIGNALS
  const topics = hasRealSession ? derived!.topics : SUMMARY.topics

  const whenLabel = latestMeta
    ? formatWhenLabel(latestMeta.startedAt)
    : isEmptyForLoggedIn
      ? undefined
      : SESSION_META.whenLabel
  const durationLabel = latestMeta
    ? formatDurationLabel(latestMeta)
    : isEmptyForLoggedIn
      ? undefined
      : SESSION_META.durationLabel

  const trendSample = !hasRealSession
  const signalsSample = !hasRealSession
  const topicsSample = !hasRealSession

  return (
    <ChatLayout
      header={<HeaderBar />}
      sidebar={
        <CharacterSidebar
          characters={CHARACTERS}
          selectedId={selectedId}
          onSelect={setSelectedId}
          tones={sidebarTones}
        />
      }
      main={
        <ConversationMain
          characterName={selected.name}
          whenLabel={whenLabel}
          durationLabel={durationLabel}
          messages={messages}
          summary={{ ...SUMMARY, topics }}
          partnerImageUrl={selected.chatImageUrl ?? selected.avatarUrl}
          partnerImageScale={selected.chatImageScale}
          partnerImageOffsetX={selected.chatImageOffsetX}
          partnerImageOffsetY={selected.chatImageOffsetY}
          topicsSample={topicsSample}
          recommendedActivitySample
          emptyState={isEmptyForLoggedIn}
        />
      }
      rightPanel={
        <EmotionPanel
          todayScore={TODAY_SCORE}
          shares={EMOTION_SHARES}
          trend={trend}
          signals={signals}
          summarySample
          trendSample={trendSample}
          signalsSample={signalsSample}
        />
      }
    />
  )
}
