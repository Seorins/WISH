import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { getExerciseSessions } from '@wish/api-client'
import type { PropsWithChildren } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { EXERCISE_SESSIONS_QUERY_KEY, useExerciseSessions } from './hooks'

vi.mock('@wish/api-client', () => ({
  getExerciseSessions: vi.fn().mockResolvedValue([]),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
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

  it('exports a stable query key root', () => {
    expect(EXERCISE_SESSIONS_QUERY_KEY).toBe('exerciseSessions')
  })
})
