import { issueDemoToken } from '@wish/api-client'
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
const FALLBACK_QUESTION = '오늘 기분은 어떠니?'
const REST_TODAY_CHOICE_ID = 'rest_today'
const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'
const PATIENT_PROFILE_STORAGE_KEY = 'wish_patient_profile_id'
const PATIENT_PROFILE_OWNER_STORAGE_KEY = 'wish_patient_profile_owner'
const DIALOGUE_SESSION_DETAIL_ERROR_MESSAGE = 'Dialogue session detail response is invalid.'

let pendingDemoToken: Promise<string> | null = null

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function refreshDemoToken() {
  if (!pendingDemoToken) {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
    localStorage.removeItem(PATIENT_PROFILE_STORAGE_KEY)
    localStorage.removeItem(PATIENT_PROFILE_OWNER_STORAGE_KEY)

    pendingDemoToken = issueDemoToken()
      .then(response => {
        const token = response.data.accessToken
        localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)
        return token
      })
      .finally(() => {
        pendingDemoToken = null
      })
  }

  return pendingDemoToken
}

async function fetchWithDemoRetry(url: string, init: RequestInit) {
  const response = await fetch(url, init)
  if (response.status !== 401 || import.meta.env.VITE_ENABLE_DEMO_AUTH !== 'true') {
    return response
  }

  await refreshDemoToken()
  return fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      ...getAuthHeaders(),
    },
  })
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
  const response = await fetchWithDemoRetry(`${API_BASE_URL}/dialogue/sessions`, {
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
  request: SubmitLighthouseTurnRequest,
): Promise<SubmitLighthouseTurnResponse> {
  const response = await fetchWithDemoRetry(
    `${API_BASE_URL}/dialogue/sessions/${sessionId}/turns`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        ...request,
        selectedChoice: normalizeSelectedChoiceForRequest(request.selectedChoice),
      }),
    },
  )

  if (!response.ok) {
    throw new Error('선택을 저장하지 못했어요.')
  }

  const payload = (await response.json()) as
    | SubmitLighthouseTurnApiResponse
    | SubmitLighthouseTurnResponse
  const data = 'data' in payload ? payload.data : payload
  if (!data?.nextScene) {
    throw new Error(
      '?ì±—ì¨”??ì±¦ì§ íƒ‘íš‚??â”‘ë®¤??íš‚??ì±˜ì¨‹ì©? ì±¦ì§ í˜§ì±™?ìŠ¿ë¤ãƒ‚ë¼˜?ì±˜í¸í˜–ì±™íž‹??',
    )
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
  const response = await fetchWithDemoRetry(
    `${API_BASE_URL}/dialogue/sessions/${sessionId}/finish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        finishReason,
      }),
    },
  )

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
  const response = await fetchWithDemoRetry(`${API_BASE_URL}/dialogue/sessions/${sessionId}`, {
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
