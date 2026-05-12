import { getNpcIdentity } from '../npcIdentity'
import type {
  DialogueSessionDetail,
  DialogueSessionDetailApiResponse,
  EmotionChoiceViewModel,
  EmotionSceneViewModel,
  FinishLighthouseEmotionApiResponse,
  FinishLighthouseEmotionRequest,
  FinishLighthouseEmotionResponse,
  StartLighthouseEmotionApiResponse,
  StartLighthouseEmotionResponse,
  SubmitLighthouseTurnApiResponse,
  SubmitLighthouseTurnRequest,
  SubmitLighthouseTurnResponse,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const LIGHTHOUSE_IDENTITY = getNpcIdentity('lighthouse_keeper')
const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'
const DIALOGUE_SESSION_DETAIL_ERROR_MESSAGE = 'Dialogue session detail response is invalid.'

export const LIGHTHOUSE_ENTRY_QUESTION = '오늘은 어떻게 지내고 싶니?'

export const LIGHTHOUSE_ENTRY_CHOICES: EmotionChoiceViewModel[] = [
  {
    choiceIntentId: 'entry_rest',
    text: '쉬고 싶어요',
    nextNodeId: 'rest_01',
    intensity: 1,
    concernFlags: ['needs_rest'],
    protectiveFactors: ['sets_boundary', 'rest_need_named'],
    responseLines: ['그래, 쉬고 싶은 날도 있지.', '등대 옆에서 잠깐 쉬어가도 괜찮단다.'],
  },
  {
    choiceIntentId: 'entry_activity',
    text: '뭔가 해보고 싶어요',
    nextNodeId: 'activity_01',
    intensity: 0,
    concernFlags: [],
    protectiveFactors: ['agency_coping', 'positive_activity_interest'],
    responseLines: ['좋구나. 아주 가볍게 시작해도 괜찮아.', '등대 불빛처럼 작게 켜보자.'],
  },
  {
    choiceIntentId: 'entry_talk',
    text: '잠깐 얘기하고 싶어요',
    nextNodeId: 'talk_topic_01',
    intensity: 0,
    concernFlags: [],
    protectiveFactors: ['support_seeking', 'verbal_expression'],
    responseLines: ['그래, 길게 말하지 않아도 괜찮단다.', '편한 얘기부터 골라보자.'],
  },
]

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function fetchWithAuth(url: string, init: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...getAuthHeaders(),
    },
  })
}

export function createLighthouseEntryScene(): EmotionSceneViewModel {
  return {
    sceneId: 'entry_01',
    questionText: LIGHTHOUSE_ENTRY_QUESTION,
    choices: LIGHTHOUSE_ENTRY_CHOICES,
    secondaryAction: null,
    shouldEndSession: false,
    generatedBy: 'STATIC',
  }
}

function normalizeChoice(choice: EmotionChoiceViewModel): EmotionChoiceViewModel {
  return {
    ...choice,
    intensity: choice.intensity ?? 0,
    concernFlags: choice.concernFlags ?? [],
    protectiveFactors: choice.protectiveFactors ?? [],
  }
}

export function sanitizeEmotionScene(
  scene: Partial<EmotionSceneViewModel> | null | undefined,
  useFallback = true,
): EmotionSceneViewModel {
  const fallback = createLighthouseEntryScene()

  if (!scene) {
    return fallback
  }

  const questionText =
    typeof scene.questionText === 'string' && scene.questionText.trim().length > 0
      ? scene.questionText
      : useFallback
        ? fallback.questionText
        : ''

  const choices =
    Array.isArray(scene.choices) && scene.choices.length > 0
      ? scene.choices.slice(0, 3).map(choice => normalizeChoice(choice))
      : useFallback
        ? fallback.choices
        : []

  return {
    sceneId: scene.sceneId,
    questionText,
    choices,
    secondaryAction: null,
    shouldEndSession: Boolean(scene.shouldEndSession),
    generatedBy: scene.generatedBy,
  }
}

export async function startLighthouseEmotionSession(
  patientProfileId: number,
  signal?: AbortSignal,
): Promise<StartLighthouseEmotionResponse> {
  const response = await fetchWithAuth(`${API_BASE_URL}/dialogue/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      patientProfileId,
      npcId: LIGHTHOUSE_IDENTITY.npcId,
      npcName: LIGHTHOUSE_IDENTITY.backendNpcName,
      mode: 'LIGHTHOUSE_LLM',
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error('Failed to start lighthouse dialogue session.')
  }

  const body = (await response.json()) as StartLighthouseEmotionApiResponse
  if (!body.data || body.data.sessionId === undefined || body.data.sessionId === null) {
    throw new Error('Lighthouse session response is invalid.')
  }

  return {
    sessionId: String(body.data.sessionId),
    status: body.data.status,
    scene: createLighthouseEntryScene(),
  }
}

export async function submitLighthouseEmotionTurn(
  sessionId: string,
  request: SubmitLighthouseTurnRequest,
  signal?: AbortSignal,
): Promise<SubmitLighthouseTurnResponse> {
  const selectedChoice = normalizeChoice(request.selectedChoice)

  const response = await fetchWithAuth(`${API_BASE_URL}/dialogue/sessions/${sessionId}/turns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      npcId: LIGHTHOUSE_IDENTITY.npcId,
      npcName: LIGHTHOUSE_IDENTITY.backendNpcName,
      questionText: request.questionText,
      selectedChoice: {
        choiceIntentId: selectedChoice.choiceIntentId,
        text: selectedChoice.text,
        intensity: selectedChoice.intensity,
        concernFlags: selectedChoice.concernFlags,
        protectiveFactors: selectedChoice.protectiveFactors,
      },
      route: request.route,
      historyIntentIds: request.historyIntentIds,
      previousQuestionTexts: request.previousQuestionTexts,
      dailyActivityState: request.dailyActivityState,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error('Failed to submit lighthouse dialogue turn.')
  }

  const body = (await response.json()) as SubmitLighthouseTurnApiResponse
  const data = body.data

  return {
    npcResponse: data?.npcResponse,
    nextScene: data?.nextScene
      ? sanitizeEmotionScene(data.nextScene, false)
      : createLighthouseEntryScene(),
  }
}

export async function finishLighthouseEmotionSession(
  sessionId: string,
  finishReason: FinishLighthouseEmotionRequest['finishReason'] = 'COMPLETED',
  signal?: AbortSignal,
): Promise<FinishLighthouseEmotionResponse> {
  const response = await fetchWithAuth(`${API_BASE_URL}/dialogue/sessions/${sessionId}/finish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ finishReason }),
    signal,
  })

  if (!response.ok) {
    throw new Error('Failed to finish lighthouse dialogue session.')
  }

  const body = (await response.json()) as FinishLighthouseEmotionApiResponse
  return {
    sessionId: String(body.data?.sessionId ?? sessionId),
    status: body.data?.status ?? 'FINISHED',
    closingLines: body.data?.closingLines ?? [],
  }
}

export async function getDialogueSessionDetail(
  sessionId: string | number,
): Promise<DialogueSessionDetail> {
  const response = await fetchWithAuth(`${API_BASE_URL}/dialogue/sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(DIALOGUE_SESSION_DETAIL_ERROR_MESSAGE)
  }

  const body = (await response.json()) as DialogueSessionDetailApiResponse
  if (!body.data) {
    throw new Error(DIALOGUE_SESSION_DETAIL_ERROR_MESSAGE)
  }

  return body.data
}
