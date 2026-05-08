import { apiClient } from './client'
import type { ApiResponse } from './artworks'

export type DailyUsageItem = {
  date: string
  login: number
  art: number
  music: number
  taekwondo: number
  gymnastics: number
}

export type DailyUsageStats = {
  patientId: number
  from: string
  to: string
  items: DailyUsageItem[]
}

export type CumulativeUsageStats = {
  patientId: number
  login: number
  art: number
  music: number
  taekwondo: number
  gymnastics: number
}

export type DailyUsageStatsParams = {
  from?: string
  to?: string
}

export async function getDailyUsageStats(patientId: number, params: DailyUsageStatsParams = {}) {
  const response = await apiClient.get<ApiResponse<DailyUsageStats>>(
    `/patients/${patientId}/usage-stats/daily`,
    { params },
  )
  return response.data
}

export async function getCumulativeUsageStats(patientId: number) {
  const response = await apiClient.get<ApiResponse<CumulativeUsageStats>>(
    `/patients/${patientId}/usage-stats/cumulative`,
  )
  return response.data
}
