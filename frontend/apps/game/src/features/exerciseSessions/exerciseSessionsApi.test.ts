import { describe, expect, it, vi } from 'vitest'
import {
  calculateAverageAccuracy,
  CREATE_EXERCISE_SESSION_ERROR_MESSAGE,
  createExerciseSession,
  EXERCISE_SESSION_ERROR_MESSAGE,
  getExerciseSessions,
  validateCreateExerciseSessionRequest,
  type CreateExerciseSessionRequest,
  type ExerciseSessionDetail,
  type ExerciseSessionSummary,
} from '@wish/api-client'

const session: ExerciseSessionSummary = {
  id: 1,
  patientProfileId: 1,
  exerciseType: 'TOP',
  durationSec: 200,
  averageAccuracy: 0.82,
  completedMotionCount: 12,
  createdAt: '2026-05-06T01:36:20.863Z',
}

const createPayload: CreateExerciseSessionRequest = {
  patientProfileId: 1,
  exerciseType: 'TOP',
  durationSec: 78,
  averageAccuracy: 0.87,
  motions: [
    {
      exerciseMotionId: 1,
      durationSec: 12,
      accuracy: 0.91,
      completedReps: 8,
      feedback: '무릎을 조금 더 올려요',
    },
  ],
}

const createdSession: ExerciseSessionDetail = {
  id: 10,
  patientProfileId: 1,
  exerciseType: 'TOP',
  durationSec: 78,
  averageAccuracy: 0.87,
  completedMotionCount: 1,
  createdAt: '2026-05-06T01:58:09.949Z',
  motions: [
    {
      id: 100,
      exerciseMotionId: 1,
      motionName: '제자리 걷기',
      routineOrder: 1,
      durationSec: 12,
      accuracy: 0.91,
      completedReps: 8,
      feedback: '무릎을 조금 더 올려요',
      createdAt: '2026-05-06T01:58:09.949Z',
    },
  ],
}

function createClient(data: ExerciseSessionSummary[] | null = [session]) {
  return {
    get: vi.fn().mockResolvedValue({
      data: {
        code: 'OK',
        message: 'ok',
        data,
      },
    }),
  }
}

describe('getExerciseSessions', () => {
  it('requests exercise sessions with patientProfileId and Accept header', async () => {
    const client = createClient()

    await expect(getExerciseSessions(1, client as never)).resolves.toEqual([session])

    expect(client.get).toHaveBeenCalledWith('/exercise-sessions', {
      params: { patientProfileId: 1 },
      headers: { Accept: 'application/json' },
    })
  })

  it('returns an empty array when response data is null', async () => {
    const client = createClient(null)

    await expect(getExerciseSessions(1, client as never)).resolves.toEqual([])
  })

  it('does not request when patientProfileId is invalid', async () => {
    const client = createClient()

    await expect(getExerciseSessions(0, client as never)).rejects.toThrow(
      'patientProfileId가 올바르지 않습니다.',
    )
    expect(client.get).not.toHaveBeenCalled()
  })

  it('returns a user-friendly error when the API reports errors', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: {
          code: 'ERROR',
          message: '',
          data: null,
          errors: { patientProfileId: 'invalid' },
        },
      }),
    }

    await expect(getExerciseSessions(1, client as never)).rejects.toThrow(
      EXERCISE_SESSION_ERROR_MESSAGE,
    )
  })
})

describe('createExerciseSession', () => {
  it('posts exercise session with JSON headers and request body', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({
        data: {
          code: 'OK',
          message: 'ok',
          data: createdSession,
        },
      }),
    }

    await expect(createExerciseSession(createPayload, client as never)).resolves.toEqual(
      createdSession,
    )

    expect(client.post).toHaveBeenCalledWith('/exercise-sessions', createPayload, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
  })

  it('parses motion results from response data', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({
        data: {
          code: 'OK',
          message: 'ok',
          data: createdSession,
        },
      }),
    }

    const result = await createExerciseSession(createPayload, client as never)

    expect(result.motions).toEqual(createdSession.motions)
  })

  it('does not request when payload validation fails', async () => {
    const client = {
      post: vi.fn(),
    }

    await expect(
      createExerciseSession({ ...createPayload, averageAccuracy: 1.2 }, client as never),
    ).rejects.toThrow('평균 정확도가 올바르지 않습니다.')
    expect(client.post).not.toHaveBeenCalled()
  })

  it('returns a user-friendly error when the API reports errors', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({
        data: {
          code: 'ERROR',
          message: '',
          data: null,
          errors: { patientProfileId: 'invalid' },
        },
      }),
    }

    await expect(createExerciseSession(createPayload, client as never)).rejects.toThrow(
      CREATE_EXERCISE_SESSION_ERROR_MESSAGE,
    )
  })

  it('throws when response data is missing', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({
        data: {
          code: 'OK',
          message: 'ok',
          data: null,
        },
      }),
    }

    await expect(createExerciseSession(createPayload, client as never)).rejects.toThrow(
      '체조 세션 저장 응답이 올바르지 않습니다.',
    )
  })
})

describe('validateCreateExerciseSessionRequest', () => {
  it('accepts a valid payload', () => {
    expect(() => validateCreateExerciseSessionRequest(createPayload)).not.toThrow()
  })

  it('rejects invalid patient, exercise type, empty motions, and invalid motion values', () => {
    expect(() =>
      validateCreateExerciseSessionRequest({ ...createPayload, patientProfileId: 0 }),
    ).toThrow('patientProfileId가 올바르지 않습니다.')
    expect(() =>
      validateCreateExerciseSessionRequest({ ...createPayload, exerciseType: '' }),
    ).toThrow('운동 종류가 올바르지 않습니다.')
    expect(() => validateCreateExerciseSessionRequest({ ...createPayload, motions: [] })).toThrow(
      '저장할 동작 결과가 없습니다.',
    )
    expect(() =>
      validateCreateExerciseSessionRequest({
        ...createPayload,
        motions: [{ ...createPayload.motions[0], accuracy: Number.NaN }],
      }),
    ).toThrow('1번째 동작 정확도가 올바르지 않습니다.')
    expect(() =>
      validateCreateExerciseSessionRequest({
        ...createPayload,
        motions: [{ ...createPayload.motions[0], completedReps: -1 }],
      }),
    ).toThrow('1번째 반복 횟수가 올바르지 않습니다.')
  })
})

describe('calculateAverageAccuracy', () => {
  it('calculates a rounded 0 to 1 average', () => {
    expect(calculateAverageAccuracy([{ accuracy: 0.9 }, { accuracy: 0.82 }])).toBe(0.86)
    expect(calculateAverageAccuracy([{ accuracy: 0.8777 }, { accuracy: 0.8222 }])).toBe(0.85)
  })

  it('returns 0 when there are no valid values', () => {
    expect(calculateAverageAccuracy([{ accuracy: Number.NaN }])).toBe(0)
  })
})
