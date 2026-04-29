import { apiClient } from './client'
import type { ApiResponse } from './artworks'

export type TokenResponse = {
  accessToken: string
  tokenType: string
  expiresIn: number
}

export async function issueDemoToken() {
  const response = await apiClient.post<ApiResponse<TokenResponse>>('/auth/demo-token')
  return response.data
}
