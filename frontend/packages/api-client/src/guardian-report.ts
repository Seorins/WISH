import { apiClient } from './client'
import type { ApiResponse } from './artworks'

export type WeeklyReportAiSummary = {
  summary: string[]
  activityObservations: string[]
  emotionObservations: string[]
  connection: string | null
  suggestion: string
  isFallback: boolean
}

/**
 * 보호자 페이지 주간 리포트 AI 요약 (S14P31E103-745).
 *
 * 월요일 `weekStart` 기준 그 주 활동/대화 데이터를 모아 AI 가 생성한 종합 코멘트 + 관찰 + 제안을 반환한다.
 * AI 호출 실패 시에도 `isFallback: true` 안전 응답이 내려가므로 리포트 화면 자체는 항상 노출된다.
 *
 * @param patientProfileId 환자 프로필 ID
 * @param weekStart 주 시작일 (YYYY-MM-DD, 반드시 월요일)
 */
export async function getReportAiSummary(
  patientProfileId: number,
  weekStart: string,
): Promise<WeeklyReportAiSummary> {
  const response = await apiClient.get<ApiResponse<WeeklyReportAiSummary>>(
    `/guardian/patients/${patientProfileId}/report/ai-summary`,
    { params: { weekStart } },
  )
  return response.data.data
}
