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
import { getNpcIdentity } from '../npcIdentity'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const LIGHTHOUSE_IDENTITY = getNpcIdentity('lighthouse_keeper')
const FALLBACK_QUESTION = '오늘 기분은 어떠니?'
const REST_TODAY_CHOICE_ID = 'rest_today'
const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'
const DIALOGUE_SESSION_DETAIL_ERROR_MESSAGE = 'Dialogue session detail response is invalid.'

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function fetchWithAuth(url: string, init: RequestInit) {
  return fetch(url, init)
}

function isDisplayChoice(value: unknown): value is EmotionChoiceViewModel {
  if (!value || typeof value !== 'object') return false
  const choice = value as Partial<EmotionChoiceViewModel>
  return (
    typeof choice.choiceIntentId === 'string' &&
    choice.choiceIntentId.trim().length > 0 &&
    typeof choice.text === 'string' &&
    choice.text.trim().length > 0
  )
}

function normalizeSelectedChoiceForRequest(choice: EmotionChoiceViewModel): EmotionChoiceViewModel {
  return {
    choiceIntentId: choice.choiceIntentId,
    text: choice.text,
    intensity: typeof choice.intensity === 'number' ? choice.intensity : 0,
    concernFlags: Array.isArray(choice.concernFlags) ? choice.concernFlags : [],
    protectiveFactors: Array.isArray(choice.protectiveFactors) ? choice.protectiveFactors : [],
  }
}

export function sanitizeEmotionScene(
  scene: Partial<EmotionSceneViewModel> | null | undefined,
  isFirstScene: boolean,
): EmotionSceneViewModel {
  const fallbackChoices: EmotionChoiceViewModel[] = [
    { choiceIntentId: 'mood_okay', text: '괜찮아요' },
    { choiceIntentId: 'mood_worried', text: '걱정돼요' },
    { choiceIntentId: 'mood_hard', text: '힘들어요' },
  ]
  const safeChoices = Array.isArray(scene?.choices)
    ? scene.choices
        .filter(isDisplayChoice)
        .filter(choice => choice.choiceIntentId !== REST_TODAY_CHOICE_ID)
        .map(choice => ({
          choiceIntentId: choice.choiceIntentId,
          text: choice.text,
        }))
        .slice(0, 3)
    : []

  const secondaryAction =
    isFirstScene &&
    isDisplayChoice(scene?.secondaryAction) &&
    scene.secondaryAction.choiceIntentId === REST_TODAY_CHOICE_ID
      ? {
          choiceIntentId: scene.secondaryAction.choiceIntentId,
          text: scene.secondaryAction.text,
        }
      : isFirstScene
        ? {
            choiceIntentId: REST_TODAY_CHOICE_ID,
            text: '오늘은 쉬고 싶어요',
          }
        : null

  const questionText =
    typeof scene?.questionText === 'string' && scene.questionText.trim()
      ? scene.questionText
      : FALLBACK_QUESTION

  return {
    sceneId: typeof scene?.sceneId === 'string' ? scene.sceneId : null,
    questionText,
    choices: safeChoices.length > 0 ? safeChoices : isFirstScene ? fallbackChoices : safeChoices,
    secondaryAction,
    shouldEndSession: Boolean(scene?.shouldEndSession),
  }
}

export async function startLighthouseEmotionSession(
  patientProfileId: number,
): Promise<StartLighthouseEmotionResponse> {
  const response = await fetchWithAuth(`${API_BASE_URL}/dialogue/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      patientProfileId,
      npcId: LIGHTHOUSE_IDENTITY.npcId,
      npcName: LIGHTHOUSE_IDENTITY.backendNpcName,
      mode: 'LIGHTHOUSE_LLM',
    }),
  })

  if (!response.ok) {
    throw new Error('등대지기 대화를 시작하지 못했습니다.')
  }

  const payload = (await response.json()) as StartLighthouseEmotionApiResponse
  if (!payload.data || payload.data.scene === null) {
    throw new Error('Dialogue session start response is invalid.')
  }

  return {
    sessionId: String(payload.data.sessionId),
    status: payload.data.status,
    scene: payload.data.scene,
  }
}

export async function submitLighthouseEmotionTurn(
  sessionId: string,
  request: SubmitLighthouseTurnRequest,
): Promise<SubmitLighthouseTurnResponse> {
  const response = await fetchWithAuth(`${API_BASE_URL}/dialogue/sessions/${sessionId}/turns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      npcId: LIGHTHOUSE_IDENTITY.npcId,
      npcName: LIGHTHOUSE_IDENTITY.backendNpcName,
      ...request,
      selectedChoice: normalizeSelectedChoiceForRequest(request.selectedChoice),
    }),
  })

  if (!response.ok) {
    throw new Error('등대지기 대화를 이어가지 못했습니다.')
  }

  const payload = (await response.json()) as
    | SubmitLighthouseTurnApiResponse
    | SubmitLighthouseTurnResponse
  const data = 'data' in payload ? payload.data : payload
  if (!data?.nextScene) {
    throw new Error('Dialogue turn response is invalid.')
  }

  return {
    nextScene: data.nextScene,
    ...('npcResponse' in data && data.npcResponse ? { npcResponse: data.npcResponse } : {}),
    ...('closingLines' in data && data.closingLines ? { closingLines: data.closingLines } : {}),
  }
}

export async function finishLighthouseEmotionSession(
  sessionId: string,
  finishReason: FinishLighthouseEmotionRequest['finishReason'],
): Promise<FinishLighthouseEmotionResponse> {
  const response = await fetchWithAuth(`${API_BASE_URL}/dialogue/sessions/${sessionId}/finish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      finishReason,
    }),
  })

  if (!response.ok) {
    throw new Error('등대지기 대화를 마무리하지 못했습니다.')
  }

  const payload = (await response.json()) as FinishLighthouseEmotionApiResponse
  if (!payload.data) {
    throw new Error('Dialogue finish response is invalid.')
  }

  return {
    sessionId: String(payload.data.sessionId),
    status: payload.data.status,
    closingLines: payload.data.closingLines,
  }
}

export async function getDialogueSessionDetail(
  sessionId: number | string,
): Promise<DialogueSessionDetail> {
  const response = await fetchWithAuth(`${API_BASE_URL}/dialogue/sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  })

  if (!response.ok) {
    throw new Error(DIALOGUE_SESSION_DETAIL_ERROR_MESSAGE)
  }

  const payload = (await response.json()) as DialogueSessionDetailApiResponse
  if (!payload.data) {
    throw new Error(DIALOGUE_SESSION_DETAIL_ERROR_MESSAGE)
  }

  return payload.data
}
