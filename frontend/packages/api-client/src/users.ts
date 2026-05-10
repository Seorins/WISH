import { apiClient } from './client'
import type { ApiResponse } from './artworks'
import type { UserResponse, UserRole } from './auth'

export async function listUsers() {
  const response = await apiClient.get<ApiResponse<UserResponse[]>>('/users')
  return response.data
}

export async function changeUserRole(userId: number, role: UserRole) {
  const response = await apiClient.patch<ApiResponse<UserResponse>>(`/users/${userId}/role`, {
    role,
  })
  return response.data
}
