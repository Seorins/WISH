import { describe, expect, it, vi } from 'vitest'
import {
  EXERCISE_SESSION_ERROR_MESSAGE,
  getExerciseSessions,
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
