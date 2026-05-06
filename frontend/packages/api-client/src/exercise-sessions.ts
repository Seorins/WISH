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

export type CreateExerciseMotionResultRequest = {
  exerciseMotionId: number
  durationSec: number
  accuracy: number
  completedReps: number
  feedback?: string
}

export type CreateExerciseSessionRequest = {
  patientProfileId: number
  exerciseType: ExerciseSessionType
  durationSec: number
  averageAccuracy: number
  motions: CreateExerciseMotionResultRequest[]
}

export type ExerciseSessionMotionResult = {
  id: number
  exerciseMotionId: number
  motionName: string
  routineOrder: number
  durationSec: number
  accuracy: number
  completedReps: number
  feedback: string
  createdAt: string
}

export type ExerciseSessionDetail = ExerciseSessionSummary & {
  motions: ExerciseSessionMotionResult[]
}

export const EXERCISE_SESSION_ERROR_MESSAGE =
  '체조 세션 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'

export const CREATE_EXERCISE_SESSION_ERROR_MESSAGE =
  '체조 기록을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'

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

function assertFiniteNumber(value: number, message: string) {
  if (!Number.isFinite(value)) {
    throw new Error(message)
  }
}

function assertAccuracy(value: number, message: string) {
  assertFiniteNumber(value, message)
  if (value < 0 || value > 1) {
    throw new Error(message)
  }
}

export function calculateAverageAccuracy(motions: Array<{ accuracy: number }>): number {
  const validValues = motions.map(motion => motion.accuracy).filter(value => Number.isFinite(value))

  if (validValues.length === 0) {
    return 0
  }

  const sum = validValues.reduce((acc, value) => acc + value, 0)
  return Math.round((sum / validValues.length) * 1000) / 1000
}

export function validateCreateExerciseSessionRequest(payload: CreateExerciseSessionRequest): void {
  assertValidPatientProfileId(payload.patientProfileId)

  if (!payload.exerciseType.trim()) {
    throw new Error('운동 종류가 올바르지 않습니다.')
  }

  assertFiniteNumber(payload.durationSec, '운동 시간이 올바르지 않습니다.')
  if (payload.durationSec < 0) {
    throw new Error('운동 시간이 올바르지 않습니다.')
  }

  assertAccuracy(payload.averageAccuracy, '평균 정확도가 올바르지 않습니다.')

  if (!Array.isArray(payload.motions) || payload.motions.length === 0) {
    throw new Error('저장할 동작 결과가 없습니다.')
  }

  payload.motions.forEach((motion, index) => {
    const order = index + 1

    if (!Number.isInteger(motion.exerciseMotionId) || motion.exerciseMotionId <= 0) {
      throw new Error(`${order}번째 동작 정보가 올바르지 않습니다.`)
    }

    assertFiniteNumber(motion.durationSec, `${order}번째 동작 시간이 올바르지 않습니다.`)
    if (motion.durationSec < 0) {
      throw new Error(`${order}번째 동작 시간이 올바르지 않습니다.`)
    }

    assertAccuracy(motion.accuracy, `${order}번째 동작 정확도가 올바르지 않습니다.`)

    assertFiniteNumber(motion.completedReps, `${order}번째 반복 횟수가 올바르지 않습니다.`)
    if (motion.completedReps < 0) {
      throw new Error(`${order}번째 반복 횟수가 올바르지 않습니다.`)
    }

    if (motion.feedback !== undefined && typeof motion.feedback !== 'string') {
      throw new Error(`${order}번째 피드백이 올바르지 않습니다.`)
    }
  })
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

export async function createExerciseSession(
  payload: CreateExerciseSessionRequest,
  client: AxiosInstance = apiClient,
): Promise<ExerciseSessionDetail> {
  validateCreateExerciseSessionRequest(payload)

  try {
    const response = await client.post<ApiResponse<ExerciseSessionDetail | null>>(
      '/exercise-sessions',
      payload,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    )

    const body = response.data
    if (body.errors && Object.keys(body.errors).length > 0) {
      throw new Error(CREATE_EXERCISE_SESSION_ERROR_MESSAGE)
    }

    if (!body.data) {
      throw new Error('체조 세션 저장 응답이 올바르지 않습니다.')
    }

    return body.data
  } catch (error) {
    if (error instanceof Error && error.message === '체조 세션 저장 응답이 올바르지 않습니다.') {
      throw error
    }
    throw new Error(CREATE_EXERCISE_SESSION_ERROR_MESSAGE)
  }
}
