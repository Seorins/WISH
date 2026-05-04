import { apiClient } from './client'
import type { ApiResponse } from './artworks'

export type TokenResponse = {
  accessToken: string
  tokenType: string
  expiresIn: number
}

export type LoginRequest = {
  email: string
  password: string
}

export type SignupRequest = {
  email: string
  nickname: string
  password: string
}

export type UserRole = 'USER' | 'ADMIN'

export type UserResponse = {
  id: number
  email: string
  nickname: string
  role?: UserRole
  createdAt?: string
}

export async function issueDemoToken() {
  const response = await apiClient.post<ApiResponse<TokenResponse>>('/auth/demo-token')
  return response.data
}

export async function login(request: LoginRequest) {
  const response = await apiClient.post<ApiResponse<TokenResponse>>('/auth/login', request)
  return response.data
}

export async function signup(request: SignupRequest) {
  const response = await apiClient.post<ApiResponse<UserResponse>>('/auth/signup', request)
  return response.data
}
