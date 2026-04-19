import axios from 'axios'
import { authInterceptor } from './interceptors/auth'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(authInterceptor)
