import type { AxiosInstance } from 'axios'
import { apiClient } from './client'
import type { ApiResponse, PageResponse } from './artworks'
import type { TaegeukAnalyzeResponse } from './taekwondo-ai'
import type { Poomsae } from './taekwondo-motions'

export type CreateTaekwondoSessionMotionRequest = {
  taekwondoMotionId: number
  durationSec: number
  accuracy: number
  completedReps: number
  feedback: string
  videoKey?: string
  thumbKey?: string
}

export type CreateTaekwondoSessionRequest = {
  patientProfileId: number
  poomsae: Poomsae
  durationSec: number
  averageAccuracy: number
  monstersDefeated: number
  motions: CreateTaekwondoSessionMotionRequest[]
}

export type TaekwondoSessionMotionResult = {
  id: number
  taekwondoMotionId: number
  motionName: string
  routineOrder: number
  durationSec: number
  accuracy: number
  completedReps: number
  feedback: string
  videoUrl?: string | null
  thumbUrl?: string | null
  createdAt: string
}

export type TaekwondoSessionDetail = {
  id: number
  patientProfileId: number
  poomsae: Poomsae
  durationSec: number
  averageAccuracy: number
  completedMotionCount: number
  monstersDefeated: number
  createdAt: string
  motions: TaekwondoSessionMotionResult[]
  beltPromotion?: unknown
}

function calculateTaekwondoAverageAccuracy(motions: CreateTaekwondoSessionMotionRequest[]) {
  if (motions.length === 0) {
    return 0
  }

  const total = motions.reduce((sum, motion) => sum + motion.accuracy, 0)
  return total / motions.length
}

function clampTaekwondoAccuracy(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

export function toTaekwondoAccuracy(score: number) {
  return clampTaekwondoAccuracy(score / 100)
}

export function calculateTaekwondoMonstersDefeated(motions: CreateTaekwondoSessionMotionRequest[]) {
  return motions.reduce((count, motion) => count + (motion.completedReps > 0 ? 1 : 0), 0)
}

const MAX_TAEKWONDO_FEEDBACK_LENGTH = 255

export function formatTaekwondoAiFeedback(
  analysis: Pick<TaegeukAnalyzeResponse, 'weakest_body_part' | 'worst_joint' | 'feedback_summary'>,
  fallback = 'Taekwondo motion analysis completed.',
) {
  const summary = analysis.feedback_summary?.trim() || fallback
  const detailParts = [analysis.weakest_body_part, analysis.worst_joint]
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part))
  const prefix = detailParts.length > 0 ? `[${detailParts.join('/')}] ` : ''
  const feedback = `${prefix}${summary}`.trim()

  if (feedback.length <= MAX_TAEKWONDO_FEEDBACK_LENGTH) {
    return feedback
  }

  return `${feedback.slice(0, MAX_TAEKWONDO_FEEDBACK_LENGTH - 3)}...`
}

export type ToCreateTaekwondoSessionMotionRequestParams = {
  taekwondoMotionId: number
  durationSec: number
  targetReps: number
  analysis: TaegeukAnalyzeResponse | null | undefined
  feedbackFallback?: string
}

export function toCreateTaekwondoSessionMotionRequest({
  taekwondoMotionId,
  durationSec,
  targetReps,
  analysis,
  feedbackFallback,
}: ToCreateTaekwondoSessionMotionRequestParams): CreateTaekwondoSessionMotionRequest {
  return {
    taekwondoMotionId,
    durationSec,
    accuracy: analysis ? toTaekwondoAccuracy(analysis.score) : 0,
    completedReps: analysis?.passed ? Math.max(1, targetReps) : 0,
    feedback: analysis
      ? formatTaekwondoAiFeedback(analysis, feedbackFallback)
      : feedbackFallback || 'Taekwondo motion analysis was not completed.',
  }
}

export { calculateTaekwondoAverageAccuracy }

export async function createTaekwondoSession(
  payload: CreateTaekwondoSessionRequest,
  client: AxiosInstance = apiClient,
): Promise<TaekwondoSessionDetail> {
  const response = await client.post<ApiResponse<TaekwondoSessionDetail | null>>(
    '/taekwondo-sessions',
    payload,
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
  )

  const session = response.data.data
  if (!session) {
    throw new Error(response.data.message || 'Failed to save taekwondo session.')
  }

  return session
}

export type TaekwondoSessionPage = PageResponse<TaekwondoSessionDetail>

export type GetMyTaekwondoSessionsParams = {
  page?: number
  size?: number
  sort?: string
  poomsae?: Poomsae
}

// 본인 환자 프로필의 태권도 세션 목록 — 음악(`/music/results/me`)과 동일 패턴.
// 페이지 응답에 motions[] 가 embedding 되어 있어야 우측 동작 리스트의 motion-별
// 통계 집계가 가능. BE 엔드포인트가 추가되기 전엔 404 → react-query 가 error
// 상태로 처리하고 UI 는 placeholder('—') 그대로 유지.
export async function getMyTaekwondoSessions({
  page = 0,
  size = 50,
  sort = 'createdAt,desc',
  poomsae,
}: GetMyTaekwondoSessionsParams = {}) {
  const response = await apiClient.get<ApiResponse<TaekwondoSessionPage>>(
    '/taekwondo-sessions/me',
    {
      params: { page, size, sort, ...(poomsae ? { poomsae } : {}) },
    },
  )
  return response.data
}

// 단건 상세 — list 응답엔 motion의 videoUrl 이 빈 채로 내려와서,
// 영상 재생용 presigned URL 을 받으려면 이걸 호출해야 한다.
// getExerciseSessionDetail 과 동일하게 ApiResponse 를 unwrap 해서 detail 만 반환.
export async function getTaekwondoSessionDetail(id: number): Promise<TaekwondoSessionDetail> {
  const response = await apiClient.get<ApiResponse<TaekwondoSessionDetail | null>>(
    `/taekwondo-sessions/${id}`,
  )
  const detail = response.data.data
  if (!detail) {
    throw new Error(response.data.message || 'Failed to load taekwondo session detail.')
  }
  return detail
}
