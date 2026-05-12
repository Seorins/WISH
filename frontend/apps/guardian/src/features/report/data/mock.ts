import type {
  GameAchievement,
  ParticipationDay,
  ReportData,
  RomJointTrend,
  TimeBucket,
  WeekRange,
} from './types'
import { buildWeekRange, toISODate } from './week'

const DAY_MS = 24 * 60 * 60 * 1000

function daysOfWeek(week: WeekRange): string[] {
  const start = new Date(week.start)
  return Array.from({ length: 7 }, (_, i) => toISODate(new Date(start.getTime() + i * DAY_MS)))
}

function buildParticipation(week: WeekRange, seed: number): ParticipationDay[] {
  const days = daysOfWeek(week)
  const pattern: Array<{ intensity: 0 | 1 | 2 | 3 | 4; minutes: number }> = [
    { intensity: 3, minutes: 38 },
    { intensity: 2, minutes: 22 },
    { intensity: 4, minutes: 52 },
    { intensity: 0, minutes: 0 },
    { intensity: 3, minutes: 41 },
    { intensity: 2, minutes: 28 },
    { intensity: 4, minutes: 44 },
  ]
  return days.map((date, i) => {
    const within = week.isCurrentWeek && i >= week.daysElapsed
    const base = pattern[(i + seed) % pattern.length]
    if (within) return { date, intensity: 0, minutes: 0 }
    return { date, intensity: base.intensity, minutes: base.minutes }
  })
}

function buildRomTrends(): RomJointTrend[] {
  return [
    {
      joint: '어깨 외전',
      unit: '°',
      current: 142,
      delta: 12,
      tone: 'lavender',
      trend: [
        { weekLabel: '4주 전', value: 118 },
        { weekLabel: '3주 전', value: 124 },
        { weekLabel: '2주 전', value: 130 },
        { weekLabel: '지난주', value: 130 },
        { weekLabel: '이번 주', value: 142 },
      ],
    },
    {
      joint: '팔꿈치 굴곡',
      unit: '°',
      current: 128,
      delta: 4,
      tone: 'mint',
      trend: [
        { weekLabel: '4주 전', value: 116 },
        { weekLabel: '3주 전', value: 120 },
        { weekLabel: '2주 전', value: 122 },
        { weekLabel: '지난주', value: 124 },
        { weekLabel: '이번 주', value: 128 },
      ],
    },
    {
      joint: '무릎 굴곡',
      unit: '°',
      current: 134,
      delta: -2,
      tone: 'cyan',
      trend: [
        { weekLabel: '4주 전', value: 130 },
        { weekLabel: '3주 전', value: 132 },
        { weekLabel: '2주 전', value: 138 },
        { weekLabel: '지난주', value: 136 },
        { weekLabel: '이번 주', value: 134 },
      ],
    },
  ]
}

function buildTimeBuckets(): TimeBucket[] {
  return [
    { id: 'morning', label: '아침', range: '6~12시', minutes: 18 },
    { id: 'day', label: '낮', range: '12~18시', minutes: 42 },
    { id: 'evening', label: '저녁', range: '18~21시', minutes: 96 },
    { id: 'night', label: '밤', range: '21~24시', minutes: 12 },
  ]
}

function buildAchievements(): GameAchievement[] {
  return [
    {
      gameId: 'music',
      label: '음악 게임',
      emoji: '🎵',
      averageAccuracy: 88,
      bestRecord: '정확도 96%',
      topContent: '반짝반짝 작은별',
      highlight: '새 곡 잠금해제',
    },
    {
      gameId: 'taekwondo',
      label: '태권도',
      emoji: '🥋',
      averageAccuracy: 82,
      bestRecord: '품새 5단 도달',
      topContent: '태극 1장',
      highlight: null,
    },
    {
      gameId: 'exercise',
      label: '체조',
      emoji: '🤸',
      averageAccuracy: 91,
      bestRecord: '연속 동작 12회',
      topContent: '어깨 풀기',
      highlight: '신기록',
    },
  ]
}

export function buildMockReport(week: WeekRange): ReportData {
  const participation = buildParticipation(week, 0)
  const totalMinutes = participation.reduce((sum, d) => sum + d.minutes, 0)
  const participatedDays = participation.filter(d => d.intensity > 0).length
  return {
    patientName: '시현',
    week,
    oneLiner: '이번 주, 시현이는 어깨를 더 자유롭게 움직였어요 ✨',
    summary: {
      participatedDays,
      totalMinutes,
      sessionCount: 14,
      fuelEarned: 320,
      diff: {
        participatedDays: 2,
        totalMinutes: 15,
        sessionCount: 3,
        fuelEarned: 60,
      },
    },
    participation,
    romTrends: buildRomTrends(),
    usage: {
      selfMinutes: totalMinutes,
      othersAverageMinutes: 170,
      sampleSize: 64,
      minSample: 30,
    },
    timeBuckets: buildTimeBuckets(),
    topBucketId: 'evening',
    achievements: buildAchievements(),
  }
}

export function buildEmptyMockReport(week: WeekRange): ReportData {
  return {
    patientName: '시현',
    week,
    oneLiner: '아직 데이터를 모으고 있어요',
    summary: {
      participatedDays: 0,
      totalMinutes: 0,
      sessionCount: 0,
      fuelEarned: 0,
      diff: { participatedDays: 0, totalMinutes: 0, sessionCount: 0, fuelEarned: 0 },
    },
    participation: Array.from({ length: 7 }, (_, i) => {
      const start = new Date(week.start)
      const date = new Date(start.getTime() + i * DAY_MS)
      return { date: toISODate(date), intensity: 0 as const, minutes: 0 }
    }),
    romTrends: [],
    usage: {
      selfMinutes: 0,
      othersAverageMinutes: 170,
      sampleSize: 4,
      minSample: 30,
    },
    timeBuckets: buildTimeBuckets().map(b => ({ ...b, minutes: 0 })),
    topBucketId: 'evening',
    achievements: [],
  }
}

export const MOCK_CURRENT_WEEK = buildWeekRange()
