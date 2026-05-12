import { useMemo, useState } from 'react'
import { buildMockReport } from './data/mock'
import type { ReportData, WeekRange } from './data/types'
import { buildWeekRange, shiftWeek } from './data/week'

export type ReportRangeMode = 'weekly' | 'monthly'

export function useReport() {
  const [week, setWeek] = useState<WeekRange>(() => buildWeekRange())
  const [mode, setMode] = useState<ReportRangeMode>('weekly')

  const data = useMemo<ReportData>(() => buildMockReport(week), [week])

  const goPrev = () => setWeek(w => shiftWeek(w, -1))
  const goNext = () => {
    setWeek(w => {
      const next = shiftWeek(w, 1)
      const todayWeek = buildWeekRange()
      return new Date(next.start) > new Date(todayWeek.start) ? w : next
    })
  }
  const goCurrent = () => setWeek(buildWeekRange())

  return {
    week,
    mode,
    setMode,
    data,
    goPrev,
    goNext,
    goCurrent,
    isCurrentWeek: week.isCurrentWeek,
  }
}
