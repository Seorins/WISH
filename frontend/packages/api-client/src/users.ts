import { apiClient } from './client'
import type { ApiResponse } from './artworks'
import type { UserResponse } from './auth'

export async function listUsers() {
  const response = await apiClient.get<ApiResponse<UserResponse[]>>('/users')
  return response.data
}
