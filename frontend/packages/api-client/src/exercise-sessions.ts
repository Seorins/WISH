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
  '\uCCB4\uC870 \uC138\uC158 \uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.'

export const CREATE_EXERCISE_SESSION_ERROR_MESSAGE =
  '\uCCB4\uC870 \uAE30\uB85D\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.'

export const EXERCISE_SESSION_DETAIL_ERROR_MESSAGE =
  '\uCCB4\uC870 \uC138\uC158 \uC0C1\uC138 \uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.'

const INVALID_PATIENT_PROFILE_ID_MESSAGE =
  'patientProfileId\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.'
const INVALID_EXERCISE_SESSION_ID_MESSAGE =
  '\uCCB4\uC870 \uC138\uC158 ID\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.'
const INVALID_EXERCISE_TYPE_MESSAGE =
  '\uC6B4\uB3D9 \uC885\uB958\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.'
const INVALID_DURATION_MESSAGE =
  '\uC6B4\uB3D9 \uC2DC\uAC04\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.'
const INVALID_AVERAGE_ACCURACY_MESSAGE =
  '\uD3C9\uADE0 \uC815\uD655\uB3C4\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.'
const EMPTY_MOTIONS_MESSAGE =
  '\uC800\uC7A5\uD560 \uB3D9\uC791 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'
const INVALID_SAVE_RESPONSE_MESSAGE =
  '\uCCB4\uC870 \uC138\uC158 \uC800\uC7A5 \uC751\uB2F5\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.'
const INVALID_DETAIL_RESPONSE_MESSAGE =
  '\uCCB4\uC870 \uC138\uC158 \uC0C1\uC138 \uC751\uB2F5\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.'

export function createExerciseSessionError(error: unknown) {
  const message =
    error instanceof Error && error.message.trim() ? error.message : EXERCISE_SESSION_ERROR_MESSAGE
  return new Error(message)
}

function assertValidPatientProfileId(patientProfileId: number) {
  if (!Number.isInteger(patientProfileId) || patientProfileId <= 0) {
    throw new Error(INVALID_PATIENT_PROFILE_ID_MESSAGE)
  }
}

function assertValidExerciseSessionId(id: number) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(INVALID_EXERCISE_SESSION_ID_MESSAGE)
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

function getMotionMessage(
  order: number,
  field: 'info' | 'duration' | 'accuracy' | 'reps' | 'feedback',
) {
  const labels = {
    info: '\uB3D9\uC791 \uC815\uBCF4',
    duration: '\uB3D9\uC791 \uC2DC\uAC04',
    accuracy: '\uB3D9\uC791 \uC815\uD655\uB3C4',
    reps: '\uBC18\uBCF5 \uD69F\uC218',
    feedback: '\uD53C\uB4DC\uBC31',
  } satisfies Record<typeof field, string>
  return `${order}\uBC88\uC9F8 ${labels[field]}\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`
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
    throw new Error(INVALID_EXERCISE_TYPE_MESSAGE)
  }

  assertFiniteNumber(payload.durationSec, INVALID_DURATION_MESSAGE)
  if (payload.durationSec < 0) {
    throw new Error(INVALID_DURATION_MESSAGE)
  }

  assertAccuracy(payload.averageAccuracy, INVALID_AVERAGE_ACCURACY_MESSAGE)

  if (!Array.isArray(payload.motions) || payload.motions.length === 0) {
    throw new Error(EMPTY_MOTIONS_MESSAGE)
  }

  payload.motions.forEach((motion, index) => {
    const order = index + 1

    if (!Number.isInteger(motion.exerciseMotionId) || motion.exerciseMotionId <= 0) {
      throw new Error(getMotionMessage(order, 'info'))
    }

    assertFiniteNumber(motion.durationSec, getMotionMessage(order, 'duration'))
    if (motion.durationSec < 0) {
      throw new Error(getMotionMessage(order, 'duration'))
    }

    assertAccuracy(motion.accuracy, getMotionMessage(order, 'accuracy'))

    assertFiniteNumber(motion.completedReps, getMotionMessage(order, 'reps'))
    if (motion.completedReps < 0) {
      throw new Error(getMotionMessage(order, 'reps'))
    }

    if (motion.feedback !== undefined && typeof motion.feedback !== 'string') {
      throw new Error(getMotionMessage(order, 'feedback'))
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
      throw new Error(INVALID_SAVE_RESPONSE_MESSAGE)
    }

    return body.data
  } catch (error) {
    if (error instanceof Error && error.message === INVALID_SAVE_RESPONSE_MESSAGE) {
      throw error
    }
    throw new Error(CREATE_EXERCISE_SESSION_ERROR_MESSAGE)
  }
}

export async function getExerciseSessionDetail(
  id: number,
  client: AxiosInstance = apiClient,
): Promise<ExerciseSessionDetail> {
  assertValidExerciseSessionId(id)

  try {
    const response = await client.get<ApiResponse<ExerciseSessionDetail | null>>(
      `/exercise-sessions/${id}`,
      {
        headers: { Accept: 'application/json' },
      },
    )

    const body = response.data
    if (body.errors && Object.keys(body.errors).length > 0) {
      throw new Error(EXERCISE_SESSION_DETAIL_ERROR_MESSAGE)
    }

    if (!body.data) {
      throw new Error(INVALID_DETAIL_RESPONSE_MESSAGE)
    }

    return body.data
  } catch (error) {
    if (error instanceof Error && error.message === INVALID_DETAIL_RESPONSE_MESSAGE) {
      throw error
    }
    throw new Error(EXERCISE_SESSION_DETAIL_ERROR_MESSAGE)
  }
}
