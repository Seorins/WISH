import { useQuery } from '@tanstack/react-query'
import {
  getDailyUsageStats,
  getExerciseMotionReplay,
  getExerciseSessionDetail,
  getExerciseSessions,
  type DailyUsageItem,
  type ExerciseSessionSummary,
} from '@wish/api-client'
import { buildGymnasticsRangeSummary, isGymnasticsSession } from './gymnasticsRangeSummary'

export const GYMNASTICS_RANGE_SUMMARY_QUERY_KEY = 'dashboard-gymnastics-range-summary'
export const GYMNASTICS_MOTION_REPLAY_QUERY_KEY = 'dashboard-gymnastics-motion-replay'
export const GYMNASTICS_DASHBOARD_SUMMARY_QUERY_KEY = 'dashboard-gymnastics-summary'

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

export type GymnasticsTrendPoint = {
  date: string
  label: string
  gymnasticsSeconds: number
  minutes: number
}

export type GymnasticsRecentSession = {
  id: number
  date: string
  shortDate: string
  weekday: string
  exerciseType: string
  exerciseTypeLabel: string
  durationSec: number
  completedMotionCount: number
  averageCompletionPercent: number
  isToday: boolean
}

export type GymnasticsDashboardSummary = {
  from: string
  to: string
  todayGymSeconds: number
  periodGymSeconds: number
  activeDays: number
  todaySessionCount: number
  todayCompletedMotionCount: number
  latestSession: GymnasticsRecentSession | null
  recentSessions: GymnasticsRecentSession[]
  trend: GymnasticsTrendPoint[]
}

function createdAtDesc(a: ExerciseSessionSummary, b: ExerciseSessionSummary): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLocalDateDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  return toLocalIsoDate(date)
}

function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatShortDate(date: string): string {
  const parsed = parseIsoDate(date)
  return `${parsed.getMonth() + 1}월 ${parsed.getDate()}일`
}

function formatWeekday(date: string, today: string): string {
  if (date === today) return '오늘'
  return WEEKDAY_KO[parseIsoDate(date).getDay()]
}

function dateKstFromIso(iso: string): string {
  const localDate = iso.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(iso)
  if (localDate && !hasTimezone) return localDate
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

function normalizeRangeDays(rangeDays: number): number {
  if (!Number.isFinite(rangeDays)) return 7
  return Math.min(30, Math.max(1, Math.round(rangeDays)))
}

function toExerciseTypeLabel(exerciseType: string): string {
  if (exerciseType === 'TOP') return '탑'
  if (exerciseType === 'DANIEL') return '다니엘'
  return exerciseType
}

function toRecentSession(session: ExerciseSessionSummary, today: string): GymnasticsRecentSession {
  const date = dateKstFromIso(session.createdAt)
  return {
    id: session.id,
    date,
    shortDate: formatShortDate(date),
    weekday: formatWeekday(date, today),
    exerciseType: session.exerciseType,
    exerciseTypeLabel: toExerciseTypeLabel(session.exerciseType),
    durationSec: Math.max(0, Math.round(session.durationSec)),
    completedMotionCount: Math.max(0, session.completedMotionCount),
    averageCompletionPercent: Math.round(Math.min(1, Math.max(0, session.averageAccuracy)) * 100),
    isToday: date === today,
  }
}

function buildTrend(items: DailyUsageItem[], from: string, to: string): GymnasticsTrendPoint[] {
  const itemByDate = new Map(items.map(item => [item.date, item]))
  const points: GymnasticsTrendPoint[] = []
  const cursor = parseIsoDate(from)
  const end = parseIsoDate(to)

  while (cursor.getTime() <= end.getTime()) {
    const date = toLocalIsoDate(cursor)
    const seconds = Math.max(0, Math.round(itemByDate.get(date)?.gymnastics ?? 0))
    points.push({
      date,
      label: formatShortDate(date),
      gymnasticsSeconds: seconds,
      minutes: Math.round((seconds / 60) * 10) / 10,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return points
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

export function useGymnasticsDashboardSummary(patientId: number | undefined | null, rangeDays = 7) {
  const normalizedRangeDays = normalizeRangeDays(rangeDays)
  const to = getLocalDateDaysAgo(0)
  const from = getLocalDateDaysAgo(normalizedRangeDays - 1)

  return useQuery({
    queryKey: [GYMNASTICS_DASHBOARD_SUMMARY_QUERY_KEY, patientId, from, to],
    queryFn: async (): Promise<GymnasticsDashboardSummary> => {
      const [dailyResponse, sessions] = await Promise.all([
        getDailyUsageStats(patientId!, { from, to }),
        getExerciseSessions(patientId!),
      ])
      const trend = buildTrend(dailyResponse.data?.items ?? [], from, to)
      const sortedGymnasticsSessions = sessions.filter(isGymnasticsSession).sort(createdAtDesc)
      const todaySessions = sortedGymnasticsSessions.filter(
        session => dateKstFromIso(session.createdAt) === to,
      )
      const recentSessions = sortedGymnasticsSessions
        .slice(0, 6)
        .map(session => toRecentSession(session, to))

      return {
        from,
        to,
        todayGymSeconds: trend[trend.length - 1]?.gymnasticsSeconds ?? 0,
        periodGymSeconds: trend.reduce((sum, point) => sum + point.gymnasticsSeconds, 0),
        activeDays: trend.filter(point => point.gymnasticsSeconds > 0).length,
        todaySessionCount: todaySessions.length,
        todayCompletedMotionCount: todaySessions.reduce(
          (sum, session) => sum + Math.max(0, session.completedMotionCount),
          0,
        ),
        latestSession: recentSessions[0] ?? null,
        recentSessions,
        trend,
      }
    },
    enabled: typeof patientId === 'number' && patientId > 0,
  })
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
