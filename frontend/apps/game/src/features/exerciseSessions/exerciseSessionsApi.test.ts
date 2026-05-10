import { describe, expect, it, vi } from 'vitest'
import {
  calculateAverageCompletionRate,
  calculateAverageAccuracy,
  CREATE_EXERCISE_SESSION_ERROR_MESSAGE,
  createExerciseSession,
  EXERCISE_SESSION_DETAIL_ERROR_MESSAGE,
  EXERCISE_SESSION_ERROR_MESSAGE,
  getExerciseSessionDetail,
  getExerciseSessions,
  toCreateExerciseSessionRequest,
  validateCreateExerciseSessionRequest,
  type CreateExerciseSessionRecord,
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
      feedback: '\uBB34\uB98E\uC744 \uC870\uAE08 \uB354 \uC62C\uB824\uC694',
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
      motionName: '\uC81C\uC790\uB9AC \uAC77\uAE30',
      routineOrder: 1,
      durationSec: 12,
      accuracy: 0.91,
      completedReps: 8,
      feedback: '\uBB34\uB98E\uC744 \uC870\uAE08 \uB354 \uC62C\uB824\uC694',
      createdAt: '2026-05-06T01:58:09.949Z',
    },
  ],
}

function createListClient(data: ExerciseSessionSummary[] | null = [session]) {
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

function createDetailClient(data: ExerciseSessionDetail | null = createdSession) {
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
    const client = createListClient()

    await expect(getExerciseSessions(1, client as never)).resolves.toEqual([session])

    expect(client.get).toHaveBeenCalledWith('/exercise-sessions', {
      params: { patientProfileId: 1 },
      headers: { Accept: 'application/json' },
    })
  })

  it('returns an empty array when response data is null', async () => {
    const client = createListClient(null)

    await expect(getExerciseSessions(1, client as never)).resolves.toEqual([])
  })

  it('does not request when patientProfileId is invalid', async () => {
    const client = createListClient()

    await expect(getExerciseSessions(0, client as never)).rejects.toThrow(/patientProfileId/)
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

describe('getExerciseSessionDetail', () => {
  it('requests exercise session detail with id and Accept header', async () => {
    const client = createDetailClient()

    await expect(getExerciseSessionDetail(1, client as never)).resolves.toEqual(createdSession)

    expect(client.get).toHaveBeenCalledWith('/exercise-sessions/1', {
      headers: { Accept: 'application/json' },
    })
  })

  it('parses motion results from response data', async () => {
    const client = createDetailClient()

    const result = await getExerciseSessionDetail(1, client as never)

    expect(result.motions).toEqual(createdSession.motions)
  })

  it('does not request when id is invalid', async () => {
    const client = createDetailClient()

    await expect(getExerciseSessionDetail(0, client as never)).rejects.toThrow(/ID/)
    expect(client.get).not.toHaveBeenCalled()
  })

  it('returns a user-friendly error when detail API reports errors', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: {
          code: 'ERROR',
          message: '',
          data: null,
          errors: { id: 'invalid' },
        },
      }),
    }

    await expect(getExerciseSessionDetail(1, client as never)).rejects.toThrow(
      EXERCISE_SESSION_DETAIL_ERROR_MESSAGE,
    )
  })

  it('throws when detail response data is missing', async () => {
    const client = createDetailClient(null)

    await expect(getExerciseSessionDetail(1, client as never)).rejects.toThrow(
      '\uCCB4\uC870 \uC138\uC158 \uC0C1\uC138 \uC751\uB2F5\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.',
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
    ).rejects.toThrow(
      '\uD3C9\uADE0 \uC218\uD589\uB960\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.',
    )
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
      '\uCCB4\uC870 \uC138\uC158 \uC800\uC7A5 \uC751\uB2F5\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.',
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
    ).toThrow(/patientProfileId/)
    expect(() =>
      validateCreateExerciseSessionRequest({ ...createPayload, exerciseType: '' }),
    ).toThrow('\uC6B4\uB3D9 \uC885\uB958\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.')
    expect(() => validateCreateExerciseSessionRequest({ ...createPayload, motions: [] })).toThrow(
      '\uC800\uC7A5\uD560 \uB3D9\uC791 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.',
    )
    expect(() =>
      validateCreateExerciseSessionRequest({
        ...createPayload,
        motions: [{ ...createPayload.motions[0], accuracy: Number.NaN }],
      }),
    ).toThrow(
      '1\uBC88\uC9F8 \uB3D9\uC791 \uC218\uD589\uB960\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.',
    )
    expect(() =>
      validateCreateExerciseSessionRequest({
        ...createPayload,
        motions: [{ ...createPayload.motions[0], completedReps: -1 }],
      }),
    ).toThrow(
      '1\uBC88\uC9F8 \uC218\uD589 \uD69F\uC218\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.',
    )
  })
})

describe('calculateAverageCompletionRate', () => {
  it('calculates a rounded 0 to 1 average from completion rates', () => {
    expect(
      calculateAverageCompletionRate([{ completionRate: 0.9 }, { completionRate: 0.82 }]),
    ).toBe(0.86)
    expect(
      calculateAverageCompletionRate([{ completionRate: 0.8777 }, { completionRate: 0.8222 }]),
    ).toBe(0.85)
  })

  it('returns 0 when there are no valid completion rates', () => {
    expect(calculateAverageCompletionRate([{ completionRate: Number.NaN }])).toBe(0)
  })
})

describe('calculateAverageAccuracy', () => {
  it('keeps the legacy API-field average helper compatible', () => {
    expect(calculateAverageAccuracy([{ accuracy: 0.9 }, { accuracy: 0.82 }])).toBe(0.86)
    expect(calculateAverageAccuracy([{ accuracy: 0.8777 }, { accuracy: 0.8222 }])).toBe(0.85)
  })

  it('returns 0 when there are no valid values', () => {
    expect(calculateAverageAccuracy([{ accuracy: Number.NaN }])).toBe(0)
  })
})

describe('toCreateExerciseSessionRequest', () => {
  it('maps record-oriented fields to the current exercise session API payload', () => {
    const record: CreateExerciseSessionRecord = {
      patientProfileId: 1,
      exerciseType: 'TOP',
      durationSec: 78,
      averageCompletionRate: 0.87,
      motions: [
        {
          exerciseMotionId: 1,
          durationSec: 12,
          completionRate: 0.91,
          completedCount: 8,
          feedback: '\uBB34\uB98E\uC744 \uC870\uAE08 \uB354 \uC62C\uB824\uC694',
        },
      ],
    }

    expect(toCreateExerciseSessionRequest(record)).toEqual(createPayload)
  })
})
