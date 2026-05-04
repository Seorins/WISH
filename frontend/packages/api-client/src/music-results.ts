import { apiClient } from './client'
import type { ApiResponse } from './artworks'

export type MusicResultRequest = {
  chartId: string
  score: number
  maxCombo: number
  perfectCount: number
  goodCount: number
  missCount: number
  totalNotes: number
  playedDurationMs: number
}

export type MusicResult = {
  id: number
  chartId: string
  score: number
  maxCombo: number
  perfectCount: number
  goodCount: number
  missCount: number
  totalNotes: number
  accuracy: number
  rank: string
  playedDurationMs: number
  playedAt: string
  isNewBest: boolean
  previousBestScore: number
}

export async function saveMusicResult(request: MusicResultRequest) {
  const response = await apiClient.post<ApiResponse<MusicResult>>('/music/results', request)
  return response.data
}

export async function getMyBestMusicResults() {
  const response = await apiClient.get<ApiResponse<MusicResult[]>>('/music/results/me/best')
  return response.data
}
