import type { ExerciseSessionSummary } from '@wish/api-client'

export type ExerciseSessionReportSummary = {
  totalSessionCount: number
  totalDurationSec: number
  averageAccuracy: number | null
  totalCompletedMotionCount: number
  latestSessionAt: string | null
  exerciseTypeCounts: Record<string, number>
}

export function formatDurationSec(durationSec: number) {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return '0초'
  const totalSeconds = Math.floor(durationSec)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds}초`
  return seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`
}

export function formatAccuracy(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  const percent = value <= 1 ? value * 100 : value
  return `${Math.round(percent)}%`
}

export function formatExerciseType(type: string) {
  const labels: Record<string, string> = {
    TOP: '상체',
    BOTTOM: '하체',
    FULL_BODY: '전신',
    DANIEL: '다니엘',
  }

  return labels[type] ?? type
}

export function formatDateTime(createdAt: string | null | undefined) {
  if (!createdAt) return '-'
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replace(/\s/g, '')
}

export function buildExerciseSessionReportSummary(
  sessions: ExerciseSessionSummary[],
): ExerciseSessionReportSummary {
  if (!sessions.length) {
    return {
      totalSessionCount: 0,
      totalDurationSec: 0,
      averageAccuracy: null,
      totalCompletedMotionCount: 0,
      latestSessionAt: null,
      exerciseTypeCounts: {},
    }
  }

  const totalDurationSec = sessions.reduce((sum, session) => sum + (session.durationSec ?? 0), 0)
  const totalCompletedMotionCount = sessions.reduce(
    (sum, session) => sum + (session.completedMotionCount ?? 0),
    0,
  )
  const accuracyValues = sessions
    .map(session => session.averageAccuracy)
    .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))
  const averageAccuracy =
    accuracyValues.length > 0
      ? accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length
      : null
  const latestSessionAt =
    [...sessions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0]?.createdAt ?? null
  const exerciseTypeCounts = sessions.reduce<Record<string, number>>((acc, session) => {
    const type = session.exerciseType ?? 'UNKNOWN'
    acc[type] = (acc[type] ?? 0) + 1
    return acc
  }, {})

  return {
    totalSessionCount: sessions.length,
    totalDurationSec,
    averageAccuracy,
    totalCompletedMotionCount,
    latestSessionAt,
    exerciseTypeCounts,
  }
}
