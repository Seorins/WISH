import { getExerciseSessions } from '@wish/api-client'
import { useQuery } from '@tanstack/react-query'

export const EXERCISE_SESSIONS_QUERY_KEY = 'exerciseSessions'

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
