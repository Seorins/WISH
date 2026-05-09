import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import {
  getChartStats,
  getMusicResult,
  type ChartStats,
  type MusicResultDetail,
} from '@wish/api-client'
import { ActivityLayout } from '@/features/activity/components/ActivityLayout'
import { MainPlaceholder } from '@/features/activity/components/MainPlaceholder'
import { SidebarPlaceholder } from '@/features/activity/components/SidebarPlaceholder'
import { DEMO_MUSIC_RESULT_ID } from '@/features/activity/constants'
import { useDailyUsageStats } from '@/features/activity/hooks'
import { useMyPatientId } from '@/features/auth/hooks/useMyPatientId'
import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import '@/features/dashboard/tokens.css'

// KST 기준 오늘(YYYY-MM-DD) — daily-usage 배치도 KST 01:00 기준으로 동작.
function todayKst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

export function ActivityPage() {
  const [searchParams] = useSearchParams()
  const resultIdParam = searchParams.get('id')
  const resultId = resultIdParam ? Number(resultIdParam) : null

  const { data: patientId } = useMyPatientId()
  const today = todayKst()
  const { data: daily } = useDailyUsageStats(patientId ?? undefined, {
    from: today,
    to: today,
  })
  const todayMusicSeconds = daily?.items[0]?.music ?? 0

  const [result, setResult] = useState<MusicResultDetail | null>(null)
  const [chartStats, setChartStats] = useState<ChartStats | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (resultIdParam == null) return
    if (resultId == null || Number.isNaN(resultId)) {
      setError('활동 ID가 지정되지 않았어요')
      return
    }
    let cancelled = false
    getMusicResult(resultId)
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
  }, [resultId, resultIdParam])

  // id 미지정 진입 시 기본 활동(음악)으로 리다이렉트.
  // 추후 latest 조회 API가 생기면 그 결과 id로 대체.
  if (resultIdParam == null) {
    return <Navigate to={`/activity?id=${DEMO_MUSIC_RESULT_ID}`} replace />
  }

  return (
    <ActivityLayout
      header={<HeaderBar />}
      sidebar={<SidebarPlaceholder />}
      main={
        result ? (
          <MainPlaceholder
            result={result}
            chartStats={chartStats}
            todayMusicSeconds={todayMusicSeconds}
          />
        ) : error ? (
          <div style={{ padding: 24, color: '#c43855' }}>활동을 불러오지 못했어요: {error}</div>
        ) : (
          <div style={{ padding: 24, color: '#7a7891' }}>활동 결과를 불러오는 중...</div>
        )
      }
    />
  )
}
