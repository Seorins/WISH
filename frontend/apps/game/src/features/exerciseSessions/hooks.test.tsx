import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createExerciseSession, getExerciseSessions } from '@wish/api-client'
import type { PropsWithChildren } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  EXERCISE_SESSION_REPORT_QUERY_KEY,
  EXERCISE_SESSIONS_QUERY_KEY,
  useCreateExerciseSession,
  useExerciseSessions,
} from './hooks'

vi.mock('@wish/api-client', () => ({
  createExerciseSession: vi.fn().mockResolvedValue({
    id: 1,
    patientProfileId: 1,
    exerciseType: 'TOP',
    durationSec: 78,
    averageAccuracy: 0.87,
    completedMotionCount: 1,
    createdAt: '2026-05-06T01:58:09.949Z',
    motions: [],
  }),
  getExerciseSessions: vi.fn().mockResolvedValue([]),
}))

function createWrapper(queryClient = createTestQueryClient()) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

describe('useExerciseSessions', () => {
  it('disables query when patientProfileId is missing', () => {
    vi.mocked(getExerciseSessions).mockClear()
    const { result } = renderHook(() => useExerciseSessions(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
    expect(getExerciseSessions).not.toHaveBeenCalled()
  })

  it('requests when patientProfileId is valid', async () => {
    vi.mocked(getExerciseSessions).mockClear()
    const { result } = renderHook(() => useExerciseSessions(1), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(getExerciseSessions).toHaveBeenCalledWith(1))
    await waitFor(() => expect(result.current.data).toEqual([]))
  })

  it('exports stable query key roots', () => {
    expect(EXERCISE_SESSIONS_QUERY_KEY).toBe('exerciseSessions')
    expect(EXERCISE_SESSION_REPORT_QUERY_KEY).toBe('exerciseSessionReport')
  })
})

describe('useCreateExerciseSession', () => {
  it('invalidates exercise session and report caches after successful save', async () => {
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const payload = {
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

    const { result } = renderHook(() => useCreateExerciseSession(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(createExerciseSession).toHaveBeenCalledWith(payload)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [EXERCISE_SESSIONS_QUERY_KEY, 1],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [EXERCISE_SESSION_REPORT_QUERY_KEY, 1],
    })
  })
})
