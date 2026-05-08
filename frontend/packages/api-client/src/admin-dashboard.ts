import { apiClient } from './client'
import type { ApiResponse } from './artworks'

export type AdminDashboardSummary = {
  totalUsers: number
  guardianUsers: number
  adminUsers: number
  totalPatients: number
  todayActivePatients: number
  todayTotalSeconds: number
  periodTotalSeconds: number
  averageDailySeconds: number
  atRiskPatients: number
  newUsersToday: number
  newPatientsToday: number
}

export type AdminDashboardDailyUsage = {
  date: string
  login: number
  art: number
  music: number
  taekwondo: number
  gymnastics: number
  total: number
  activePatients: number
}

export type AdminDashboardContentShare = {
  contentType: string
  label: string
  totalSeconds: number
  percentage: number
}

export type AdminDashboardPatientStatus = 'ACTIVE' | 'NORMAL' | 'RISK'

export type AdminDashboardPatientActivity = {
  patientId: number
  patientName: string
  patientNickname: string
  guardianEmail: string
  todaySeconds: number
  periodSeconds: number
  favoriteContent: string
  lastActiveDate: string | null
  status: AdminDashboardPatientStatus
}

export type AdminDashboardAlert = {
  type: string
  title: string
  description: string
  severity: 'normal' | 'info' | 'warning'
  count: number
}

export type AdminDashboard = {
  from: string
  to: string
  summary: AdminDashboardSummary
  dailyUsage: AdminDashboardDailyUsage[]
  contentShares: AdminDashboardContentShare[]
  patientActivities: AdminDashboardPatientActivity[]
  alerts: AdminDashboardAlert[]
}

export type GetAdminDashboardParams = {
  from?: string
  to?: string
}

export async function getAdminDashboard(params?: GetAdminDashboardParams) {
  const response = await apiClient.get<ApiResponse<AdminDashboard>>('/admin/dashboard', {
    params,
  })
  return response.data
}
