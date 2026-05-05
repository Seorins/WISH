export type JointId = 'shoulder' | 'hip' | 'knee' | 'ankle'

export type JointROMScorePoint = {
  date: string
  score: number
}

export type JointROMDetail = {
  id: JointId
  name: string
  step: number
  currentScore: number
  deltaPrev: number
  improvement: number
  balance: number
  leftScore: number
  rightScore: number
  weeklyTrend: JointROMScorePoint[]
  monthlyTrend: JointROMScorePoint[]
  aiInsight: string
  tip: string
}

function shortDate(daysAgo: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

function buildWeekly(values: number[]): JointROMScorePoint[] {
  return values.map((score, i) => ({
    date: shortDate(values.length - 1 - i),
    score,
  }))
}

function buildMonthly(start: number, end: number, count = 30): JointROMScorePoint[] {
  return Array.from({ length: count }, (_, i) => {
    const progress = i / (count - 1)
    const base = start + progress * (end - start)
    const noise = ((i * 7) % 9) - 4
    return {
      date: shortDate(count - 1 - i),
      score: Math.max(40, Math.min(100, Math.round(base + noise))),
    }
  })
}

export const JOINT_ROM_DETAILS: ReadonlyArray<JointROMDetail> = [
  {
    id: 'shoulder',
    name: '어깨',
    step: 1,
    currentScore: 90,
    deltaPrev: 3,
    improvement: 18,
    balance: 93,
    leftScore: 91,
    rightScore: 89,
    weeklyTrend: buildWeekly([72, 76, 79, 81, 84, 87, 90]),
    monthlyTrend: buildMonthly(72, 90),
    aiInsight: '최근 1주일 동안 어깨 가동 범위가 꾸준히 향상되고 있어요.',
    tip: '어깨 스트레칭 운동을 꾸준히 하면 일상생활에서 팔을 더 편하게 움직일 수 있어요.',
  },
  {
    id: 'hip',
    name: '엉덩이',
    step: 2,
    currentScore: 88,
    deltaPrev: 2,
    improvement: 14,
    balance: 95,
    leftScore: 88,
    rightScore: 87,
    weeklyTrend: buildWeekly([74, 76, 79, 82, 84, 86, 88]),
    monthlyTrend: buildMonthly(74, 88),
    aiInsight: '엉덩이 가동 범위가 안정적으로 유지되고 있어요. 좌우 균형도 좋아요.',
    tip: '앉았다 일어서기 동작을 천천히 반복하면 엉덩이 주변 근육이 부드러워져요.',
  },
  {
    id: 'knee',
    name: '무릎',
    step: 3,
    currentScore: 84,
    deltaPrev: 1,
    improvement: 9,
    balance: 91,
    leftScore: 85,
    rightScore: 82,
    weeklyTrend: buildWeekly([75, 76, 78, 80, 81, 83, 84]),
    monthlyTrend: buildMonthly(75, 84),
    aiInsight: '무릎 가동 범위가 천천히 좋아지는 중이에요. 무리하지 말고 꾸준히 해봐요.',
    tip: '계단 오르기 전 가벼운 무릎 스트레칭을 해주면 통증 예방에 좋아요.',
  },
  {
    id: 'ankle',
    name: '발목',
    step: 4,
    currentScore: 90,
    deltaPrev: 2,
    improvement: 12,
    balance: 96,
    leftScore: 90,
    rightScore: 89,
    weeklyTrend: buildWeekly([78, 80, 82, 84, 86, 88, 90]),
    monthlyTrend: buildMonthly(78, 90),
    aiInsight: '발목 균형이 매우 우수해요. 지금처럼 꾸준히 유지해보세요.',
    tip: '발목 돌리기를 하루 5번씩 하면 균형 감각과 보행 안정성에 도움이 돼요.',
  },
]

export type ROMRange = 'week' | 'month'

export const ROM_RANGE_OPTIONS: ReadonlyArray<{ id: ROMRange; label: string }> = [
  { id: 'week', label: '일주일' },
  { id: 'month', label: '한달' },
]
