import { useQuery } from '@tanstack/react-query'
import {
  getExerciseMotionReplay,
  getExerciseSessionDetail,
  getExerciseSessions,
  type ExerciseSessionSummary,
} from '@wish/api-client'
import { buildGymnasticsRangeSummary, isGymnasticsSession } from './gymnasticsRangeSummary'

export const GYMNASTICS_RANGE_SUMMARY_QUERY_KEY = 'dashboard-gymnastics-range-summary'
export const GYMNASTICS_MOTION_REPLAY_QUERY_KEY = 'dashboard-gymnastics-motion-replay'

function createdAtDesc(a: ExerciseSessionSummary, b: ExerciseSessionSummary): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

function findLatestComparableGymnasticsSessions(sessions: ExerciseSessionSummary[]) {
  const sortedGymnasticsSessions = sessions.filter(isGymnasticsSession).sort(createdAtDesc)
  const current = sortedGymnasticsSessions[0]
  const previous = current
    ? sortedGymnasticsSessions.find(
        session => session.id !== current.id && session.exerciseType === current.exerciseType,
      )
    : undefined

  return { current, previous }
}

export function useGymnasticsRangeSummary(patientId: number | undefined | null) {
  return useQuery({
    queryKey: [GYMNASTICS_RANGE_SUMMARY_QUERY_KEY, patientId],
    queryFn: async () => {
      const sessions = await getExerciseSessions(patientId!)
      const { current, previous } = findLatestComparableGymnasticsSessions(sessions)

      if (!current) {
        return null
      }

      const [currentResult, previousResult] = await Promise.allSettled([
        getExerciseSessionDetail(current.id),
        previous ? getExerciseSessionDetail(previous.id) : Promise.resolve(null),
      ])

      if (currentResult.status === 'rejected') {
        throw currentResult.reason
      }

      const previousDetail = previousResult.status === 'fulfilled' ? previousResult.value : null

      return buildGymnasticsRangeSummary(currentResult.value, previousDetail)
    },
    enabled: typeof patientId === 'number' && patientId > 0,
  })
}

export function useGymnasticsMotionReplay(
  motionResultId: number | undefined | null,
  enabled = true,
) {
  return useQuery({
    queryKey: [GYMNASTICS_MOTION_REPLAY_QUERY_KEY, motionResultId],
    queryFn: () => getExerciseMotionReplay(motionResultId!),
    enabled: enabled && typeof motionResultId === 'number' && motionResultId > 0,
  })
}
