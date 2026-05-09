import { useQuery } from '@tanstack/react-query'
import {
  getCumulativeUsageStats,
  getDailyUsageStats,
  getMyArtworks,
  type DailyUsageStatsParams,
  type GetMyArtworksParams,
} from '@wish/api-client'

export const USAGE_STATS_DAILY_QUERY_KEY = 'usage-stats-daily'
export const USAGE_STATS_CUMULATIVE_QUERY_KEY = 'usage-stats-cumulative'
export const MY_ARTWORKS_QUERY_KEY = 'artworks-me'

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

export function useMyArtworks(params: GetMyArtworksParams = {}) {
  return useQuery({
    queryKey: [MY_ARTWORKS_QUERY_KEY, params.page ?? 0, params.size ?? 20, params.sort],
    queryFn: async () => {
      const response = await getMyArtworks(params)
      return response.data
    },
  })
}
