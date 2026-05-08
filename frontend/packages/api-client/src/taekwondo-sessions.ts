import type { AxiosInstance } from 'axios'
import { apiClient } from './client'
import type { ApiResponse } from './artworks'
import type { Poomsae } from './taekwondo-motions'

export type CreateTaekwondoSessionMotionRequest = {
  taekwondoMotionId: number
  durationSec: number
  accuracy: number
  completedReps: number
  feedback: string
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

  if (!response.data.data) {
    throw new Error(response.data.message || 'Failed to save taekwondo session.')
  }

  return response.data.data
}
