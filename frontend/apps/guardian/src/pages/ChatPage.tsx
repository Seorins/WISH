import { useState } from 'react'
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
import '@/features/dashboard/tokens.css'

export function ChatPage() {
  const [selectedId, setSelectedId] = useState(SESSION_META.characterId)
  const selected = CHARACTERS.find(c => c.id === selectedId) ?? CHARACTERS[0]

  return (
    <ChatLayout
      header={<HeaderBar />}
      sidebar={
        <CharacterSidebar
          characters={CHARACTERS}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      }
      main={
        <ConversationMain
          characterName={selected.name}
          whenLabel={SESSION_META.whenLabel}
          durationLabel={SESSION_META.durationLabel}
          messages={MESSAGES}
          summary={SUMMARY}
        />
      }
      rightPanel={
        <EmotionPanel
          todayScore={TODAY_SCORE}
          shares={EMOTION_SHARES}
          trend={EMOTION_TREND}
          signals={EMOTION_SIGNALS}
        />
      }
    />
  )
}
