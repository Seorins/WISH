import type { AxiosInstance } from 'axios'
import { apiClient } from './client'
import type { ApiResponse } from './artworks'

export type ExerciseSessionType = string

export type ExerciseSessionSummary = {
  id: number
  patientProfileId: number
  exerciseType: ExerciseSessionType
  durationSec: number
  averageAccuracy: number
  completedMotionCount: number
  createdAt: string
}

export const EXERCISE_SESSION_ERROR_MESSAGE =
  '체조 세션 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'

export function createExerciseSessionError(error: unknown) {
  const message =
    error instanceof Error && error.message.trim() ? error.message : EXERCISE_SESSION_ERROR_MESSAGE
  return new Error(message)
}

function assertValidPatientProfileId(patientProfileId: number) {
  if (!Number.isInteger(patientProfileId) || patientProfileId <= 0) {
    throw new Error('patientProfileId가 올바르지 않습니다.')
  }
}

export async function getExerciseSessions(
  patientProfileId: number,
  client: AxiosInstance = apiClient,
): Promise<ExerciseSessionSummary[]> {
  assertValidPatientProfileId(patientProfileId)

  try {
    const response = await client.get<ApiResponse<ExerciseSessionSummary[] | null>>(
      '/exercise-sessions',
      {
        params: { patientProfileId },
        headers: { Accept: 'application/json' },
      },
    )

    const body = response.data
    if (body.errors && Object.keys(body.errors).length > 0) {
      throw new Error(body.message || EXERCISE_SESSION_ERROR_MESSAGE)
    }

    return body.data ?? []
  } catch (error) {
    throw createExerciseSessionError(error)
  }
}
