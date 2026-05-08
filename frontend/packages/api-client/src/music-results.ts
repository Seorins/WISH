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
  videoKey?: string
  thumbKey?: string
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
  videoKey: string | null
  thumbKey: string | null
  isNewBest: boolean
  previousBestScore: number | null
}

export type MusicResultDetail = {
  id: number
  chartId: string
  chartTitle: string
  score: number
  maxCombo: number
  perfectCount: number
  greatCount?: number
  goodCount: number
  missCount: number
  totalNotes: number
  accuracy: number
  rank: string
  playedDurationMs: number
  othersAveragePlayedDurationMs?: number
  playedAt: string
  videoKey: string | null
  thumbKey: string | null
  videoUrl: string | null
  thumbUrl: string | null
}

export type MusicBestResult = {
  chartId: string
  bestScore: number
  bestRank: string
  bestAccuracy: number
  playCount: number
  lastPlayedAt: string
}

export async function saveMusicResult(request: MusicResultRequest) {
  const response = await apiClient.post<ApiResponse<MusicResult>>('/music/results', request)
  return response.data
}

export async function getMusicResult(id: number) {
  const response = await apiClient.get<ApiResponse<MusicResultDetail>>(`/music/results/${id}`)
  return response.data
}

export async function getMyBestMusicResults() {
  const response = await apiClient.get<ApiResponse<MusicBestResult[]>>('/music/results/me/best')
  return response.data
}
