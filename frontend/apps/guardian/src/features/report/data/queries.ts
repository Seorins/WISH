import { useMemo } from 'react'
import type {
  Artwork,
  ArtworkPage,
  DailyUsageStats,
  ExerciseSessionDetail,
  FuelStatus,
  MusicResultDetail,
  MusicResultPage,
  TaekwondoSessionDetail,
  TaekwondoSessionPage,
  UsageAverages,
} from '@wish/api-client'
import {
  useDailyUsageStats,
  useMyArtworks,
  usePatientExerciseSessions,
  useMyMusicResults,
  useMyTaekwondoSessions,
  useUsageAverages,
} from '@/features/activity/hooks'
import { useFuelStatus } from '@/features/fuel/hooks'
import { buildMockReport, buildUsageRanking } from './mock'
import type {
  GameAchievement,
  ParticipationDay,
  ReportData,
  ReportSummary,
  TimeBucket,
  TimeBucketId,
  UsageCompare,
  WeekRange,
} from './types'
import { shiftWeek, toISODate } from './week'

const DAY_MS = 24 * 60 * 60 * 1000

function intensityFromMinutes(min: number): 0 | 1 | 2 | 3 | 4 {
  if (min <= 0) return 0
  if (min < 20) return 1
  if (min < 40) return 2
  if (min < 60) return 3
  return 4
}

function inWeek(isoTs: string | null | undefined, week: WeekRange): boolean {
  if (!isoTs) return false
  const date = isoTs.slice(0, 10)
  return date >= week.start && date <= week.end
}

function buildParticipationFromDaily(
  daily: DailyUsageStats | undefined,
  week: WeekRange,
): ParticipationDay[] {
  const start = new Date(week.start)
  const map = new Map<string, number>()
  if (daily?.items) {
    for (const item of daily.items) {
      const minutes = Math.round((item.login ?? 0) / 60)
      map.set(item.date, minutes)
    }
  }
  return Array.from({ length: 7 }, (_, i) => {
    const date = toISODate(new Date(start.getTime() + i * DAY_MS))
    const minutes = map.get(date) ?? 0
    return { date, minutes, intensity: intensityFromMinutes(minutes) }
  })
}

function sumDailyLoginMinutes(daily: DailyUsageStats | undefined): number {
  if (!daily?.items) return 0
  return daily.items.reduce((sum, item) => sum + Math.round((item.login ?? 0) / 60), 0)
}

function countWeekResults<T>(
  page: { content?: T[] } | undefined,
  pickDate: (item: T) => string | null | undefined,
  week: WeekRange,
): T[] {
  if (!page?.content) return []
  return page.content.filter(item => inWeek(pickDate(item), week))
}

function sumFuelEarnedThisWeek(fuel: FuelStatus | undefined, week: WeekRange): number {
  if (!fuel?.events) return 0
  return fuel.events
    .filter(e => inWeek(e.createdAt, week))
    .reduce((sum, e) => sum + (e.amount ?? 0), 0)
}

function buildSummary({
  daily,
  musicWeek,
  taekwondoWeek,
  exerciseWeek,
  fuelEarned,
}: {
  daily: DailyUsageStats | undefined
  musicWeek: MusicResultDetail[]
  taekwondoWeek: TaekwondoSessionDetail[]
  exerciseWeek: ExerciseSessionDetail[]
  fuelEarned: number
}): ReportSummary {
  const totalMinutes = sumDailyLoginMinutes(daily)
  const participatedDays = (daily?.items ?? []).filter(item => (item.login ?? 0) > 0).length
  const sessionCount = musicWeek.length + taekwondoWeek.length + exerciseWeek.length
  return {
    participatedDays,
    totalMinutes,
    sessionCount,
    fuelEarned,
    diff: { participatedDays: 0, totalMinutes: 0, sessionCount: 0, fuelEarned: 0 },
  }
}

function buildUsageCompare(
  averages: UsageAverages | undefined,
  selfMinutes: number,
  selfName: string,
): UsageCompare {
  const othersAverageMinutes = averages ? Math.round((averages.login?.averageSeconds ?? 0) / 60) : 0
  return {
    selfMinutes,
    othersAverageMinutes,
    ranking: buildUsageRanking(selfName, selfMinutes),
  }
}

function hourToBucket(hour: number): TimeBucketId {
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'day'
  if (hour >= 18 && hour < 21) return 'evening'
  return 'night'
}

function buildTimeBucketsFromSessions({
  musicWeek,
  taekwondoWeek,
  exerciseWeek,
  artworksWeek,
}: {
  musicWeek: MusicResultDetail[]
  taekwondoWeek: TaekwondoSessionDetail[]
  exerciseWeek: ExerciseSessionDetail[]
  artworksWeek: Artwork[]
}): { buckets: TimeBucket[]; topBucketId: TimeBucketId } {
  const minutes: Record<TimeBucketId, number> = {
    morning: 0,
    day: 0,
    evening: 0,
    night: 0,
  }
  const add = (iso: string, secondsOrMs: number, isMs = false) => {
    const hour = new Date(iso).getHours()
    const secs = isMs ? secondsOrMs / 1000 : secondsOrMs
    minutes[hourToBucket(hour)] += Math.round(secs / 60)
  }
  for (const m of musicWeek) add(m.playedAt, m.playedDurationMs ?? 0, true)
  for (const t of taekwondoWeek) add(t.createdAt, t.durationSec ?? 0)
  for (const e of exerciseWeek) add(e.createdAt, e.durationSec ?? 0)
  for (const a of artworksWeek) add(a.createdAt, a.playDurationSeconds ?? 0)

  const buckets: TimeBucket[] = [
    { id: 'morning', label: '아침', range: '6~12시', minutes: minutes.morning },
    { id: 'day', label: '낮', range: '12~18시', minutes: minutes.day },
    { id: 'evening', label: '저녁', range: '18~21시', minutes: minutes.evening },
    { id: 'night', label: '밤', range: '21~24시', minutes: minutes.night },
  ]
  const topBucketId = buckets.reduce((top, b) => (b.minutes > top.minutes ? b : top), buckets[0]).id
  return { buckets, topBucketId }
}

function mostFrequent<T, K extends string | number>(items: T[], keyFn: (item: T) => K): K | null {
  if (items.length === 0) return null
  const counts = new Map<K, number>()
  for (const item of items) {
    const k = keyFn(item)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  let top: K | null = null
  let topCount = 0
  for (const [k, c] of counts.entries()) {
    if (c > topCount) {
      top = k
      topCount = c
    }
  }
  return top
}

function sumDailyField(
  daily: DailyUsageStats | undefined,
  field: 'music' | 'taekwondo' | 'gymnastics' | 'art',
): number {
  if (!daily?.items) return 0
  return daily.items.reduce((sum, item) => sum + Math.round((item[field] ?? 0) / 60), 0)
}

function buildMusicAchievement(results: MusicResultDetail[], minutes: number): GameAchievement {
  if (results.length === 0) {
    return {
      gameId: 'music',
      label: '음악 게임',
      emoji: '🎵',
      minutes,
      hasData: minutes > 0,
      averageAccuracy: null,
      bestRecord: null,
      topContent: null,
      highlight: null,
    }
  }
  const avgAccuracy = Math.round(
    (results.reduce((s, r) => s + (r.accuracy ?? 0), 0) / results.length) * 100,
  )
  const best = results.reduce<MusicResultDetail>((b, r) => (r.score > b.score ? r : b), results[0])
  const topChart = mostFrequent(results, r => r.chartTitle ?? r.chartId) ?? '—'
  const hasNewBest = results.some(r => r.score === best.score)
  return {
    gameId: 'music',
    label: '음악 게임',
    emoji: '🎵',
    minutes,
    hasData: true,
    averageAccuracy: avgAccuracy,
    bestRecord: `최고 점수 ${best.score.toLocaleString()}`,
    topContent: String(topChart),
    highlight: hasNewBest && results.length >= 3 ? '신기록' : null,
  }
}

function buildTaekwondoAchievement(
  sessions: TaekwondoSessionDetail[],
  minutes: number,
): GameAchievement {
  if (sessions.length === 0) {
    return {
      gameId: 'taekwondo',
      label: '태권도',
      emoji: '🥋',
      minutes,
      hasData: minutes > 0,
      averageAccuracy: null,
      bestRecord: null,
      topContent: null,
      highlight: null,
    }
  }
  const avgAccuracy = Math.round(
    (sessions.reduce((s, r) => s + (r.averageAccuracy ?? 0), 0) / sessions.length) * 100,
  )
  const bestSession = sessions.reduce(
    (b, s) => (s.averageAccuracy > b.averageAccuracy ? s : b),
    sessions[0],
  )
  const topPoomsae = mostFrequent(sessions, s => s.poomsae) ?? '—'
  return {
    gameId: 'taekwondo',
    label: '태권도',
    emoji: '🥋',
    minutes,
    hasData: true,
    averageAccuracy: avgAccuracy,
    bestRecord: `최고 정확도 ${Math.round(bestSession.averageAccuracy * 100)}%`,
    topContent: String(topPoomsae),
    highlight: null,
  }
}

function buildExerciseAchievement(
  sessions: ExerciseSessionDetail[],
  minutes: number,
): GameAchievement {
  if (sessions.length === 0) {
    return {
      gameId: 'exercise',
      label: '체조',
      emoji: '🤸',
      minutes,
      hasData: minutes > 0,
      averageAccuracy: null,
      bestRecord: null,
      topContent: null,
      highlight: null,
    }
  }
  const avgAccuracy = Math.round(
    (sessions.reduce((s, r) => s + (r.averageAccuracy ?? 0), 0) / sessions.length) * 100,
  )
  const bestSession = sessions.reduce(
    (b, s) => (s.averageAccuracy > b.averageAccuracy ? s : b),
    sessions[0],
  )
  const topType = mostFrequent(sessions, s => s.exerciseType) ?? '—'
  return {
    gameId: 'exercise',
    label: '체조',
    emoji: '🤸',
    minutes,
    hasData: true,
    averageAccuracy: avgAccuracy,
    bestRecord: `최고 정확도 ${Math.round(bestSession.averageAccuracy * 100)}%`,
    topContent: String(topType),
    highlight: null,
  }
}

function buildArtAchievement(artworks: Artwork[], minutes: number): GameAchievement {
  if (artworks.length === 0) {
    return {
      gameId: 'art',
      label: '미술',
      emoji: '🎨',
      minutes,
      hasData: minutes > 0,
      averageAccuracy: null,
      bestRecord: null,
      topContent: null,
      highlight: null,
    }
  }
  return {
    gameId: 'art',
    label: '미술',
    emoji: '🎨',
    minutes,
    hasData: true,
    averageAccuracy: null,
    bestRecord: `${artworks.length}개 작품 완성`,
    topContent: null,
    highlight: null,
  }
}

type UseReportDataOptions = {
  patientId: number | undefined
  patientName: string
  week: WeekRange
}

export function useReportData({ patientId, patientName, week }: UseReportDataOptions): {
  data: ReportData
  isLoading: boolean
  isError: boolean
} {
  const lastWeek = useMemo(() => shiftWeek(week, -1), [week])

  const dailyQuery = useDailyUsageStats(patientId, { from: week.start, to: week.end })
  const lastDailyQuery = useDailyUsageStats(patientId, {
    from: lastWeek.start,
    to: lastWeek.end,
  })
  const averagesQuery = useUsageAverages({ from: week.start, to: week.end })
  const musicQuery = useMyMusicResults({ size: 100 })
  const taekwondoQuery = useMyTaekwondoSessions(patientId, { size: 100 })
  const exerciseQuery = usePatientExerciseSessions(patientId, { size: 100 })
  const artworksQuery = useMyArtworks({ size: 100 })
  const fuelQuery = useFuelStatus()

  const data = useMemo<ReportData>(() => {
    // ROM 추이 / one-liner 만 mock — 나머지는 BE 실데이터
    const mock = buildMockReport(week, patientName)

    const dailyData = dailyQuery.data as DailyUsageStats | undefined
    const lastDailyData = lastDailyQuery.data as DailyUsageStats | undefined
    const averagesData = averagesQuery.data as UsageAverages | undefined
    const musicPage = musicQuery.data as MusicResultPage | undefined
    const taekwondoPage = taekwondoQuery.data as TaekwondoSessionPage | undefined
    const exerciseSessions = exerciseQuery.data as ExerciseSessionDetail[] | undefined
    const artworksPage = artworksQuery.data as ArtworkPage | undefined
    const fuelData = fuelQuery.data as FuelStatus | undefined

    const musicWeek = countWeekResults(musicPage, r => r.playedAt, week)
    const taekwondoWeek = countWeekResults(taekwondoPage, s => s.createdAt, week)
    const exerciseWeek = exerciseSessions
      ? exerciseSessions.filter(s => inWeek(s.createdAt, week))
      : []
    const artworksWeek = countWeekResults(artworksPage, a => a.createdAt, week)
    const fuelEarned = sumFuelEarnedThisWeek(fuelData, week)

    // 지난주 데이터 (변화량 계산용) — 세션은 동일 list 에서 필터, daily 만 추가 fetch
    const lastMusicWeek = countWeekResults(musicPage, r => r.playedAt, lastWeek)
    const lastTaekwondoWeek = countWeekResults(taekwondoPage, s => s.createdAt, lastWeek)
    const lastExerciseWeek = exerciseSessions
      ? exerciseSessions.filter(s => inWeek(s.createdAt, lastWeek))
      : []
    const lastFuelEarned = sumFuelEarnedThisWeek(fuelData, lastWeek)

    const participation = buildParticipationFromDaily(dailyData, week)
    const thisSummary = buildSummary({
      daily: dailyData,
      musicWeek,
      taekwondoWeek,
      exerciseWeek,
      fuelEarned,
    })
    const lastSummary = buildSummary({
      daily: lastDailyData,
      musicWeek: lastMusicWeek,
      taekwondoWeek: lastTaekwondoWeek,
      exerciseWeek: lastExerciseWeek,
      fuelEarned: lastFuelEarned,
    })
    const summary: ReportSummary = {
      ...thisSummary,
      diff: {
        participatedDays: thisSummary.participatedDays - lastSummary.participatedDays,
        totalMinutes: thisSummary.totalMinutes - lastSummary.totalMinutes,
        sessionCount: thisSummary.sessionCount - lastSummary.sessionCount,
        fuelEarned: thisSummary.fuelEarned - lastSummary.fuelEarned,
      },
    }

    const usage = buildUsageCompare(averagesData, summary.totalMinutes, patientName)

    const { buckets: timeBuckets, topBucketId } = buildTimeBucketsFromSessions({
      musicWeek,
      taekwondoWeek,
      exerciseWeek,
      artworksWeek,
    })

    const achievements: GameAchievement[] = [
      buildMusicAchievement(musicWeek, sumDailyField(dailyData, 'music')),
      buildTaekwondoAchievement(taekwondoWeek, sumDailyField(dailyData, 'taekwondo')),
      buildExerciseAchievement(exerciseWeek, sumDailyField(dailyData, 'gymnastics')),
      buildArtAchievement(artworksWeek, sumDailyField(dailyData, 'art')),
    ]

    return {
      patientName,
      week,
      oneLiner: mock.oneLiner,
      summary,
      participation,
      romTrends: mock.romTrends,
      usage,
      timeBuckets,
      topBucketId,
      achievements,
    }
  }, [
    week,
    lastWeek,
    patientName,
    dailyQuery.data,
    lastDailyQuery.data,
    averagesQuery.data,
    musicQuery.data,
    taekwondoQuery.data,
    exerciseQuery.data,
    artworksQuery.data,
    fuelQuery.data,
  ])

  return {
    data,
    isLoading:
      dailyQuery.isLoading ||
      averagesQuery.isLoading ||
      musicQuery.isLoading ||
      fuelQuery.isLoading,
    isError: dailyQuery.isError && averagesQuery.isError,
  }
}
