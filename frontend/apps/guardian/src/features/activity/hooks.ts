import { useQuery } from '@tanstack/react-query'
import {
  getCumulativeUsageStats,
  getDailyUsageStats,
  type DailyUsageStatsParams,
} from '@wish/api-client'

export const USAGE_STATS_DAILY_QUERY_KEY = 'usage-stats-daily'
export const USAGE_STATS_CUMULATIVE_QUERY_KEY = 'usage-stats-cumulative'

export function useDailyUsageStats(
  patientId: number | undefined,
  params: DailyUsageStatsParams = {},
) {
  return useQuery({
    queryKey: [USAGE_STATS_DAILY_QUERY_KEY, patientId, params.from, params.to],
    queryFn: async () => {
      const response = await getDailyUsageStats(patientId!, params)
      return response.data
    },
    enabled: typeof patientId === 'number' && patientId > 0,
  })
}

export function useCumulativeUsageStats(patientId: number | undefined) {
  return useQuery({
    queryKey: [USAGE_STATS_CUMULATIVE_QUERY_KEY, patientId],
    queryFn: async () => {
      const response = await getCumulativeUsageStats(patientId!)
      return response.data
    },
    enabled: typeof patientId === 'number' && patientId > 0,
  })
}
