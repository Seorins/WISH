import { useMemo } from 'react'
import type { WeekRange } from './data/types'
import { buildWeekRange } from './data/week'
import { useReportData } from './data/queries'

type UseReportOptions = {
  patientId: number | undefined
  patientName: string
}

export function useReport({ patientId, patientName }: UseReportOptions) {
  const week = useMemo<WeekRange>(() => buildWeekRange(), [])
  const { data, isLoading, isError } = useReportData({ patientId, patientName, week })
  return { week, data, isLoading, isError }
}
