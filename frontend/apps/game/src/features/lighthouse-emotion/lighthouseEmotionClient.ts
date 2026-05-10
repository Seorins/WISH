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
  SubmitLighthouseTurnResponse,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const FALLBACK_QUESTION = '오늘 기분은 어떠니?'
const REST_TODAY_CHOICE_ID = 'rest_today'
const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'
const DIALOGUE_SESSION_DETAIL_ERROR_MESSAGE = 'Dialogue session detail response is invalid.'

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
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

export function sanitizeEmotionScene(
  scene: Partial<EmotionSceneViewModel> | null | undefined,
  isFirstScene: boolean,
): EmotionSceneViewModel {
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
      : null

  const questionText =
    typeof scene?.questionText === 'string' && scene.questionText.trim()
      ? scene.questionText
      : FALLBACK_QUESTION

  return {
    sceneId: typeof scene?.sceneId === 'string' ? scene.sceneId : null,
    questionText,
    choices: safeChoices,
    secondaryAction,
    shouldEndSession: Boolean(scene?.shouldEndSession),
  }
}

export async function startLighthouseEmotionSession(
  patientProfileId: number,
): Promise<StartLighthouseEmotionResponse> {
  const response = await fetch(`${API_BASE_URL}/emotion-checkin/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      patientProfileId,
      npcName: 'YEONGCHEOL',
    }),
  })

  if (!response.ok) {
    throw new Error('등대지기 대화를 시작하지 못했어요.')
  }

  const payload = (await response.json()) as StartLighthouseEmotionApiResponse
  if (!payload.data || payload.data.scene === null) {
    throw new Error('?ê¹…?ï§žÂ€æ¹²??Â€?ë¶¾? ?ì’–ì˜‰?ì„? ï§ì‚µë»½?ëŒìŠ‚.')
  }

  return {
    sessionId: String(payload.data.sessionId),
    status: payload.data.status,
    scene: payload.data.scene,
  }
}

export async function submitLighthouseEmotionTurn(
  sessionId: string,
  selectedChoice: EmotionChoiceViewModel,
): Promise<SubmitLighthouseTurnResponse> {
  const response = await fetch(`${API_BASE_URL}/emotion-checkin/sessions/${sessionId}/turns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      selectedChoice,
    }),
  })

  if (!response.ok) {
    throw new Error('선택을 저장하지 못했어요.')
  }

  return response.json()
}

export async function finishLighthouseEmotionSession(
  sessionId: string,
  finishReason: FinishLighthouseEmotionRequest['finishReason'],
): Promise<FinishLighthouseEmotionResponse> {
  const response = await fetch(`${API_BASE_URL}/dialogue/sessions/${sessionId}/finish`, {
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
    throw new Error('등대지기 대화를 마치지 못했어요.')
  }

  const payload = (await response.json()) as FinishLighthouseEmotionApiResponse
  if (!payload.data) {
    throw new Error('?ê¹…?ï§žÂ€æ¹²??Â€?ë¶¾? ï§ë‰íŠ‚ï§žÂ€ ï§ì‚µë»½?ëŒìŠ‚.')
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
  const response = await fetch(`${API_BASE_URL}/dialogue/sessions/${sessionId}`, {
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
