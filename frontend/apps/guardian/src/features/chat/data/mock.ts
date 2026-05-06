export type EmotionTone = 'calm' | 'tired' | 'worried'

export type ChatCharacter = {
  id: string
  name: string
  avatarUrl: string
  emotion: EmotionTone
}

export type ChatMessage = {
  id: string
  speaker: 'character' | 'child'
  text: string
}

export type EmotionTrendPoint = {
  label: string
  score: number
}

export type EmotionShare = {
  tone: EmotionTone
  label: string
  percent: number
}

export type EmotionSignal = {
  id: string
  tone: EmotionTone
  title: string
  description: string
}

export type ConversationSummary = {
  trustDelta: number
  topics: string[]
  recommendedActivity: string
}

export const CHARACTERS: ChatCharacter[] = [
  { id: 'tori', name: '토리', avatarUrl: '', emotion: 'calm' },
  { id: 'bruno', name: '브루노', avatarUrl: '', emotion: 'tired' },
  { id: 'luna', name: '루나', avatarUrl: '', emotion: 'worried' },
  { id: 'koa', name: '코아', avatarUrl: '', emotion: 'calm' },
]

export const SESSION_META = {
  characterId: 'tori',
  whenLabel: '어제, 오후 7:20',
  durationLabel: '대화 완료 (10분)',
}

export const MESSAGES: ChatMessage[] = [
  { id: 'm1', speaker: 'character', text: '오늘 하루는 어땠어?' },
  { id: 'm2', speaker: 'child', text: '조금 피곤했어. 숙제가 많았거든.' },
  { id: 'm3', speaker: 'character', text: '이야기해줘서 고마워!' },
]

export const SUMMARY: ConversationSummary = {
  trustDelta: 12,
  topics: ['숙제', '피로'],
  recommendedActivity: '가벼운 스트레칭과 감정 일기 쓰기를 추천해요.',
}

export const TODAY_SCORE = 72

export const EMOTION_SHARES: EmotionShare[] = [
  { tone: 'calm', label: '안정', percent: 58 },
  { tone: 'tired', label: '피로', percent: 27 },
  { tone: 'worried', label: '걱정', percent: 15 },
]

export const EMOTION_TREND: EmotionTrendPoint[] = [
  { label: '시작', score: 45 },
  { label: '2분', score: 70 },
  { label: '4분', score: 80 },
  { label: '6분', score: 55 },
  { label: '8분', score: 60 },
  { label: '10분', score: 72 },
]

export const EMOTION_SIGNALS: EmotionSignal[] = [
  { id: 's1', tone: 'tired', title: '피로 표현 있음', description: '숙제와 피로를 이야기했어요.' },
  {
    id: 's2',
    tone: 'calm',
    title: '대화 후반 안정됨',
    description: '부담이 줄어들어 안정되었어요.',
  },
  {
    id: 's3',
    tone: 'calm',
    title: '안심 표현 있음',
    description: '이야기 후 안심하는 모습을 보였어요.',
  },
]
