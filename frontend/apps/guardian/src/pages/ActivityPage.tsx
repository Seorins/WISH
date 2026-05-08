import { useEffect, useState } from 'react'
import {
  getChartStats,
  getMusicResult,
  type ChartStats,
  type MusicResultDetail,
} from '@wish/api-client'
import { ActivityLayout } from '@/features/activity/components/ActivityLayout'
import { MainPlaceholder } from '@/features/activity/components/MainPlaceholder'
import { SidebarPlaceholder } from '@/features/activity/components/SidebarPlaceholder'
import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import '@/features/dashboard/tokens.css'

const TEMP_RESULT_ID = 12

export function ActivityPage() {
  const [result, setResult] = useState<MusicResultDetail | null>(null)
  const [chartStats, setChartStats] = useState<ChartStats | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getMusicResult(TEMP_RESULT_ID)
      .then(response => {
        if (cancelled) return
        setResult(response.data)
        return getChartStats(response.data.chartId)
          .then(statsResponse => {
            if (!cancelled) setChartStats(statsResponse.data)
          })
          .catch(() => {
            // 통계는 옵셔널 — 화면은 "집계 중"으로 그려짐
          })
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : '결과를 불러오지 못했어요')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ActivityLayout
      header={<HeaderBar />}
      sidebar={<SidebarPlaceholder />}
      main={
        result ? (
          <MainPlaceholder result={result} chartStats={chartStats} />
        ) : error ? (
          <div style={{ padding: 24, color: '#c43855' }}>활동을 불러오지 못했어요: {error}</div>
        ) : (
          <div style={{ padding: 24, color: '#7a7891' }}>활동 결과를 불러오는 중...</div>
        )
      }
    />
  )
}
