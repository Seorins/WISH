import type { AxiosInstance } from 'axios'
import { apiClient } from './client'
import type { ApiResponse, PageResponse } from './artworks'
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
