import { useMemo, useState } from 'react'
import { ChatLayout } from '@/features/chat/components/ChatLayout'
import { CharacterSidebar } from '@/features/chat/components/CharacterSidebar'
import { ConversationMain } from '@/features/chat/components/ConversationMain'
import { EmotionPanel } from '@/features/chat/components/EmotionPanel'
import { PastDialoguesModal } from '@/features/chat/components/PastDialoguesModal'
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
  pickFirstFinished,
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

  // 캐릭터 전환 시 사용자가 고른 과거 세션은 리셋
  const [pickedSessionId, setPickedSessionId] = useState<number | null>(null)
  const [pastOpen, setPastOpen] = useState(false)

  // 최신 FINISHED 세션을 찾기 위해 최근 10개 메타를 받아오고 클라이언트에서 필터
  const sessionsQuery = useGuardianDialogueSessions({ patientProfileId, npc, size: 10 })
  const latestFinishedMeta = pickFirstFinished(sessionsQuery.data?.content)
  const latestFinishedId = latestFinishedMeta?.sessionId ?? null

  const activeSessionId = pickedSessionId ?? latestFinishedId
  const activeMeta =
    sessionsQuery.data?.content?.find(m => m.sessionId === activeSessionId) ?? latestFinishedMeta

  const detailQuery = useGuardianDialogueSession(patientProfileId, activeSessionId)

  const derived = useMemo(
    () => (detailQuery.data ? deriveFromSession(detailQuery.data) : null),
    [detailQuery.data],
  )

  const hasRealSession = !!derived && derived.messages.length > 0
  const isEmptyForLoggedIn =
    !!patientProfileId && sessionsQuery.isSuccess && !latestFinishedMeta && !pickedSessionId

  const messages = hasRealSession ? derived!.messages : isEmptyForLoggedIn ? [] : MESSAGES
  const trend = hasRealSession ? derived!.trend : EMOTION_TREND
  const signals = hasRealSession ? derived!.signals : EMOTION_SIGNALS
  const topics = hasRealSession ? derived!.topics : SUMMARY.topics
  const shares = hasRealSession ? derived!.shares : EMOTION_SHARES
  // 점수 = 안정 비율 (보호적 신호 / 전체 감정 신호). 신호가 없으면 mock 점수로 fallback.
  const todayScore = hasRealSession
    ? (shares.find(s => s.tone === 'calm')?.percent ?? 0)
    : TODAY_SCORE

  const whenLabel = activeMeta
    ? formatWhenLabel(activeMeta.startedAt)
    : isEmptyForLoggedIn
      ? undefined
      : SESSION_META.whenLabel
  const durationLabel = activeMeta
    ? formatDurationLabel(activeMeta)
    : isEmptyForLoggedIn
      ? undefined
      : SESSION_META.durationLabel

  const trendSample = !hasRealSession
  const signalsSample = !hasRealSession
  const topicsSample = !hasRealSession
  const summarySample = !hasRealSession

  const handleSelectCharacter = (id: string) => {
    setSelectedId(id)
    setPickedSessionId(null)
  }

  return (
    <>
      <ChatLayout
        header={<HeaderBar />}
        sidebar={
          <CharacterSidebar
            characters={CHARACTERS}
            selectedId={selectedId}
            onSelect={handleSelectCharacter}
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
            onOpenPast={() => setPastOpen(true)}
            isViewingPast={!!pickedSessionId}
            onReturnToLatest={() => setPickedSessionId(null)}
          />
        }
        rightPanel={
          <EmotionPanel
            todayScore={todayScore}
            shares={shares}
            trend={trend}
            signals={signals}
            summarySample={summarySample}
            trendSample={trendSample}
            signalsSample={signalsSample}
          />
        }
      />
      <PastDialoguesModal
        isOpen={pastOpen}
        onClose={() => setPastOpen(false)}
        patientProfileId={patientProfileId}
        npc={npc}
        characterName={selected.name}
        activeSessionId={activeSessionId}
        onSelectSession={id => {
          setPickedSessionId(id)
          setPastOpen(false)
        }}
      />
    </>
  )
}
