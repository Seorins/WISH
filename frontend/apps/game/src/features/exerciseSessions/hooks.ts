import {
  createExerciseSession,
  getExerciseSessions,
  type CreateExerciseSessionRequest,
} from '@wish/api-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const EXERCISE_SESSIONS_QUERY_KEY = 'exerciseSessions'
export const EXERCISE_SESSION_REPORT_QUERY_KEY = 'exerciseSessionReport'

export function useExerciseSessions(patientProfileId?: number) {
  const enabled =
    typeof patientProfileId === 'number' &&
    Number.isInteger(patientProfileId) &&
    patientProfileId > 0

  return useQuery({
    queryKey: [EXERCISE_SESSIONS_QUERY_KEY, patientProfileId],
    queryFn: () => getExerciseSessions(patientProfileId!),
    enabled,
    staleTime: 1000 * 60,
    retry: 1,
    select: data => data ?? [],
  })
}

export function useCreateExerciseSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateExerciseSessionRequest) => createExerciseSession(payload),
    onSuccess: createdSession => {
      queryClient.invalidateQueries({
        queryKey: [EXERCISE_SESSIONS_QUERY_KEY, createdSession.patientProfileId],
      })
      queryClient.invalidateQueries({
        queryKey: [EXERCISE_SESSION_REPORT_QUERY_KEY, createdSession.patientProfileId],
      })
    },
  })
}
