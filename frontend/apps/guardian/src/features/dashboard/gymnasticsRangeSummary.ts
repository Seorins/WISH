import type {
  ExerciseSessionDetail,
  ExerciseSessionMotionResult,
  ExerciseSessionSummary,
} from '@wish/api-client'

export type GymnasticsRangeStatus = 'new' | 'improved' | 'steady' | 'lower'

export type GymnasticsRangeSummaryItem = {
  exerciseMotionId: number
  motionName: string
  routineOrder: number
  currentPercent: number
  previousPercent: number | null
  deltaPercent: number | null
  completionRate: number
  completedCount: number
  targetCount: number
  progressLabel: string
  status: GymnasticsRangeStatus
}

export type GymnasticsRangeSummary = {
  sessionId: number
  exerciseType: string
  createdAt: string
  averagePercent: number
  previousAveragePercent: number | null
  averageDeltaPercent: number | null
  improvedMotionCount: number
  decreasedMotionCount: number
  items: GymnasticsRangeSummaryItem[]
}

const TOP_TARGET_COUNT = 8
const DANIEL_TARGET_COUNT = 1
const DELTA_STEADY_THRESHOLD = 1

export function isGymnasticsSession(
  session: Pick<ExerciseSessionSummary, 'exerciseType'>,
): boolean {
  return session.exerciseType === 'TOP' || session.exerciseType === 'DANIEL'
}

function clampRate(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function roundPercent(rate: number): number {
  return Math.round(clampRate(rate) * 100)
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function normalizeCompletedCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

function resolveTargetCount(exerciseType: string, motion: ExerciseSessionMotionResult): number {
  if (exerciseType === 'TOP') {
    return TOP_TARGET_COUNT
  }

  if (exerciseType === 'DANIEL') {
    return DANIEL_TARGET_COUNT
  }

  return Math.max(1, Math.ceil(normalizeCompletedCount(motion.completedReps)))
}

function resolveRangeRate(exerciseType: string, motion: ExerciseSessionMotionResult): number {
  const completionRate = clampRate(motion.accuracy)
  const targetCount = resolveTargetCount(exerciseType, motion)
  const countRate = clampRate(normalizeCompletedCount(motion.completedReps) / targetCount)

  return Math.max(completionRate, countRate)
}

function resolveProgressLabel(
  exerciseType: string,
  completedCount: number,
  targetCount: number,
): string {
  if (exerciseType === 'DANIEL') {
    return completedCount >= 1 ? '10초 완료' : '10초 진행 중'
  }

  return `${completedCount}/${targetCount}회`
}

function resolveStatus(deltaPercent: number | null): GymnasticsRangeStatus {
  if (deltaPercent === null) return 'new'
  if (deltaPercent > DELTA_STEADY_THRESHOLD) return 'improved'
  if (deltaPercent < -DELTA_STEADY_THRESHOLD) return 'lower'
  return 'steady'
}

export function buildGymnasticsRangeSummary(
  current: ExerciseSessionDetail,
  previous?: ExerciseSessionDetail | null,
): GymnasticsRangeSummary {
  const previousByMotionId = new Map(
    previous?.motions.map(motion => [motion.exerciseMotionId, motion]) ?? [],
  )

  const items = [...current.motions]
    .sort((a, b) => a.routineOrder - b.routineOrder)
    .map(motion => {
      const currentPercent = roundPercent(resolveRangeRate(current.exerciseType, motion))
      const previousMotion = previousByMotionId.get(motion.exerciseMotionId)
      const previousPercent =
        previous && previousMotion
          ? roundPercent(resolveRangeRate(previous.exerciseType, previousMotion))
          : null
      const deltaPercent = previousPercent === null ? null : currentPercent - previousPercent
      const completedCount = normalizeCompletedCount(motion.completedReps)
      const targetCount = resolveTargetCount(current.exerciseType, motion)

      return {
        exerciseMotionId: motion.exerciseMotionId,
        motionName: motion.motionName,
        routineOrder: motion.routineOrder,
        currentPercent,
        previousPercent,
        deltaPercent,
        completionRate: clampRate(motion.accuracy),
        completedCount,
        targetCount,
        progressLabel: resolveProgressLabel(current.exerciseType, completedCount, targetCount),
        status: resolveStatus(deltaPercent),
      }
    })

  const averagePercent = average(items.map(item => item.currentPercent))
  const previousValues = items
    .map(item => item.previousPercent)
    .filter((value): value is number => value !== null)
  const previousAveragePercent = previousValues.length > 0 ? average(previousValues) : null
  const averageDeltaPercent =
    previousAveragePercent === null ? null : averagePercent - previousAveragePercent

  return {
    sessionId: current.id,
    exerciseType: current.exerciseType,
    createdAt: current.createdAt,
    averagePercent,
    previousAveragePercent,
    averageDeltaPercent,
    improvedMotionCount: items.filter(item => item.status === 'improved').length,
    decreasedMotionCount: items.filter(item => item.status === 'lower').length,
    items,
  }
}
