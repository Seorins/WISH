export type EmotionTag =
  | 'hopeJoy'
  | 'anxietyFear'
  | 'sadnessLoneliness'
  | 'angerFrustration'
  | 'painSomatic'
  | 'parentConcern'
  | 'avoidanceWithdrawal'
  | 'supportSeeking'
  | 'agencyCoping'
  | 'informationNeed'

export type EmotionWeights = Partial<Record<EmotionTag, number>>

export type LighthouseChoiceIconKey =
  | 'sun'
  | 'fog'
  | 'wave'
  | 'heart'
  | 'bandage'
  | 'friend'
  | 'anchor'
  | 'lantern'
  | 'pause'

export type LighthouseEmotionChoice = {
  id: string
  text: string
  iconKey: LighthouseChoiceIconKey
  emotionWeights: EmotionWeights
  intensity: 0 | 1 | 2 | 3
  concernFlags?: string[]
  protectiveFactors?: string[]
  npcResponse: string[]
  followUpPromptId?: string | null
}

export type LighthouseEmotionScene = {
  id: string
  mode: 'NPC_DIALOGUE' | 'PLAYER_CHOICE'
  speaker: string
  nameplate: string
  questionText?: string
  maxChoices?: number
  npcLines: string[]
  choices?: LighthouseEmotionChoice[]
  onComplete?: {
    action: 'GENERATE_EMOTION_SUMMARY'
  }
}

export type WaveMeterCard = {
  id: 'wave_low' | 'wave_mid' | 'wave_high'
  text: string
  iconKey: LighthouseChoiceIconKey
  scoreRange: [number, number]
  distressSignalLevelHint: 'low' | 'watch' | 'support_recommended'
}

export const LIGHTHOUSE_EMOTION_START_SCENE_ID = 'lh_00_greeting_mood_check'
export const LIGHTHOUSE_EMOTION_CLOSING_SCENE_ID = 'lh_05_closing'
export const LIGHTHOUSE_MAX_QUESTION_SCENES = 3

export const globalRestTodayChoice: LighthouseEmotionChoice = {
  id: 'global_rest_today',
  text: '오늘은 쉬기',
  iconKey: 'pause',
  emotionWeights: {
    avoidanceWithdrawal: 1,
    agencyCoping: 1,
  },
  intensity: 1,
  concernFlags: ['ended_checkin'],
  protectiveFactors: ['sets_boundary'],
  npcResponse: ['알겠다. 오늘은 쉬어도 괜찮단다.', '등대 불은 조용히 켜두마.'],
  followUpPromptId: null,
}

export const waveMeterCards: WaveMeterCard[] = [
  {
    id: 'wave_low',
    text: '잔잔해요',
    iconKey: 'sun',
    scoreRange: [0, 2],
    distressSignalLevelHint: 'low',
  },
  {
    id: 'wave_mid',
    text: '흔들려요',
    iconKey: 'fog',
    scoreRange: [3, 5],
    distressSignalLevelHint: 'watch',
  },
  {
    id: 'wave_high',
    text: '너무 높아요',
    iconKey: 'wave',
    scoreRange: [6, 10],
    distressSignalLevelHint: 'support_recommended',
  },
]

export const lighthouseShortEmotionDialogue: LighthouseEmotionScene[] = [
  {
    id: 'lh_00_greeting_mood_check',
    mode: 'PLAYER_CHOICE',
    speaker: '등대지기 영철',
    nameplate: '등대지기 영철',
    questionText: '오늘 기분은 어떻니?',
    maxChoices: 3,
    npcLines: ['안녕, 오늘도 와줬구나.', '오늘 기분은 어떻니?'],
    choices: [
      {
        id: 'mood_okay',
        text: '괜찮아요',
        iconKey: 'sun',
        emotionWeights: { hopeJoy: 2, agencyCoping: 1 },
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['positive_mood', 'answered_checkin'],
        npcResponse: ['좋구나. 작은 햇빛이 보이는 날이네.'],
        followUpPromptId: 'lh_03_small_light',
      },
      {
        id: 'mood_worried',
        text: '걱정돼요',
        iconKey: 'fog',
        emotionWeights: { anxietyFear: 2, informationNeed: 1 },
        intensity: 2,
        concernFlags: ['worry_present'],
        protectiveFactors: ['emotion_named'],
        npcResponse: ['걱정 안개가 찾아왔구나.', '어디서 오는지 같이 살펴보자.'],
        followUpPromptId: 'lh_01_worry_source',
      },
      {
        id: 'mood_hard',
        text: '힘들어요',
        iconKey: 'wave',
        emotionWeights: { sadnessLoneliness: 1, painSomatic: 1, avoidanceWithdrawal: 1 },
        intensity: 2,
        concernFlags: ['distress_present'],
        protectiveFactors: ['emotion_named'],
        npcResponse: ['말해줘서 고맙구나.', '오늘 파도가 조금 높았나 보네.'],
        followUpPromptId: 'lh_02_hard_part',
      },
    ],
  },
  {
    id: 'lh_01_worry_source',
    mode: 'PLAYER_CHOICE',
    speaker: '등대지기 영철',
    nameplate: '등대지기 영철',
    questionText: '걱정 바람은 어디서 불어오니?',
    maxChoices: 3,
    npcLines: ['걱정 바람은 어디서 불어오니?'],
    choices: [
      {
        id: 'worry_pain',
        text: '아플까 봐',
        iconKey: 'bandage',
        emotionWeights: { anxietyFear: 2, painSomatic: 2 },
        intensity: 3,
        concernFlags: ['pain_concern', 'procedure_fear'],
        protectiveFactors: ['can_name_fear'],
        npcResponse: [
          '아플까 봐 무서운 건 자연스러운 마음이란다.',
          '간호사 선생님께 말해도 괜찮아.',
        ],
        followUpPromptId: 'lh_04_support_choice',
      },
      {
        id: 'worry_unknown',
        text: '모르겠어요',
        iconKey: 'fog',
        emotionWeights: { anxietyFear: 2, informationNeed: 2 },
        intensity: 2,
        concernFlags: ['uncertainty', 'needs_information'],
        protectiveFactors: ['information_need_named'],
        npcResponse: ['모를 때는 안개가 더 짙어지지.', '한 가지씩 물어봐도 된단다.'],
        followUpPromptId: 'lh_04_support_choice',
      },
      {
        id: 'worry_family',
        text: '가족 걱정',
        iconKey: 'heart',
        emotionWeights: { parentConcern: 3, anxietyFear: 1 },
        intensity: 3,
        concernFlags: ['parent_concern'],
        protectiveFactors: ['empathy'],
        npcResponse: [
          '가족을 많이 아끼는구나.',
          '하지만 어른의 걱정을 네가 다 들고 있지 않아도 돼.',
        ],
        followUpPromptId: 'lh_04_support_choice',
      },
    ],
  },
  {
    id: 'lh_02_hard_part',
    mode: 'PLAYER_CHOICE',
    speaker: '등대지기 영철',
    nameplate: '등대지기 영철',
    questionText: '어디가 가장 무겁니?',
    maxChoices: 3,
    npcLines: ['어디가 가장 무겁니?'],
    choices: [
      {
        id: 'hard_body',
        text: '몸이 힘들어요',
        iconKey: 'bandage',
        emotionWeights: { painSomatic: 3, sadnessLoneliness: 1 },
        intensity: 3,
        concernFlags: ['body_discomfort', 'fatigue_or_pain'],
        protectiveFactors: ['body_state_named'],
        npcResponse: ['몸이 힘들면 마음도 지치기 쉽지.', '아픈 건 숨기지 않아도 된단다.'],
        followUpPromptId: 'lh_04_support_choice',
      },
      {
        id: 'hard_lonely',
        text: '외로워요',
        iconKey: 'friend',
        emotionWeights: { sadnessLoneliness: 3, avoidanceWithdrawal: 1 },
        intensity: 3,
        concernFlags: ['loneliness', 'social_isolation'],
        protectiveFactors: ['emotion_named'],
        npcResponse: ['혼자 떠 있는 배처럼 느껴졌구나.', '등대 불빛을 하나 찾아보자.'],
        followUpPromptId: 'lh_04_support_choice',
      },
      {
        id: 'hard_angry',
        text: '화가 나요',
        iconKey: 'wave',
        emotionWeights: { angerFrustration: 3 },
        intensity: 2,
        concernFlags: ['anger_or_frustration'],
        protectiveFactors: ['emotion_named'],
        npcResponse: ['화나는 마음도 말해도 괜찮아.', '그 마음은 나쁜 마음이 아니란다.'],
        followUpPromptId: 'lh_04_support_choice',
      },
    ],
  },
  {
    id: 'lh_03_small_light',
    mode: 'PLAYER_CHOICE',
    speaker: '등대지기 영철',
    nameplate: '등대지기 영철',
    questionText: '오늘 켜볼 작은 등불은?',
    maxChoices: 3,
    npcLines: ['오늘 켜볼 작은 등불은?'],
    choices: [
      {
        id: 'light_breathe',
        text: '숨 세 번',
        iconKey: 'anchor',
        emotionWeights: { agencyCoping: 3 },
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['breathing_coping'],
        npcResponse: ['좋구나. 숨은 작은 닻이 된단다.'],
        followUpPromptId: 'lh_05_closing',
      },
      {
        id: 'light_draw',
        text: '그림 그리기',
        iconKey: 'lantern',
        emotionWeights: { agencyCoping: 2, supportSeeking: 1 },
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['creative_expression'],
        npcResponse: ['그림도 마음의 말이 될 수 있지.'],
        followUpPromptId: 'lh_05_closing',
      },
      {
        id: 'light_tell',
        text: '한마디 하기',
        iconKey: 'heart',
        emotionWeights: { supportSeeking: 3, agencyCoping: 1 },
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['adult_support_plan'],
        npcResponse: ['좋다. 한마디면 충분할 때도 있단다.'],
        followUpPromptId: 'lh_05_closing',
      },
    ],
  },
  {
    id: 'lh_04_support_choice',
    mode: 'PLAYER_CHOICE',
    speaker: '등대지기 영철',
    nameplate: '등대지기 영철',
    questionText: '누구의 불빛이 필요할까?',
    maxChoices: 3,
    npcLines: ['누구의 불빛이 필요할까?'],
    choices: [
      {
        id: 'support_family',
        text: '가족',
        iconKey: 'heart',
        emotionWeights: { supportSeeking: 3 },
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['family_support_preference'],
        npcResponse: ['가족에게 한마디 건네보자.', "'오늘 마음이 무거워요'도 괜찮아."],
        followUpPromptId: 'lh_05_closing',
      },
      {
        id: 'support_medical',
        text: '선생님',
        iconKey: 'bandage',
        emotionWeights: { supportSeeking: 2, informationNeed: 2 },
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['medical_support_preference'],
        npcResponse: ['의사 선생님이나 간호사 선생님께 말해도 된단다.', '질문은 용기야.'],
        followUpPromptId: 'lh_05_closing',
      },
      {
        id: 'support_draw',
        text: '그림/편지',
        iconKey: 'lantern',
        emotionWeights: { supportSeeking: 1, agencyCoping: 2 },
        intensity: 0,
        concernFlags: ['prefers_nonverbal_expression'],
        protectiveFactors: ['alternative_expression'],
        npcResponse: ['말이 어려우면 그림도 좋단다.', '마음은 여러 방법으로 말할 수 있어.'],
        followUpPromptId: 'lh_05_closing',
      },
    ],
  },
  {
    id: 'lh_05_closing',
    mode: 'NPC_DIALOGUE',
    speaker: '등대지기 영철',
    nameplate: '등대지기 영철',
    npcLines: ['오늘 말해줘서 고맙구나.', '등대 불은 여기 켜두마.'],
    onComplete: {
      action: 'GENERATE_EMOTION_SUMMARY',
    },
  },
]

const lighthouseEmotionSceneById = new Map(
  lighthouseShortEmotionDialogue.map(scene => [scene.id, scene]),
)

export function getLighthouseEmotionScene(id: string) {
  return lighthouseEmotionSceneById.get(id) ?? null
}

export function getVisibleChoices(scene: LighthouseEmotionScene) {
  if (scene.mode !== 'PLAYER_CHOICE') return []
  return (scene.choices ?? []).slice(0, scene.maxChoices ?? 3)
}

export function getChoiceDisplayText(choice: LighthouseEmotionChoice) {
  return choice.text
}

export function getQuestionDisplayText(scene: LighthouseEmotionScene) {
  return scene.questionText ?? scene.npcLines.at(-1) ?? ''
}
