import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { authInterceptor } from './interceptors/auth'

const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'
const REFRESH_TOKEN_STORAGE_KEY = 'wish_refresh_token'
const PATIENT_PROFILE_STORAGE_KEY = 'wish_patient_profile_id'
const PATIENT_PROFILE_OWNER_STORAGE_KEY = 'wish_patient_profile_owner'
const DEMO_TOKEN_PATH = '/auth/demo-token'
const REFRESH_PATH = '/auth/refresh'
const LOGIN_PATH = '/auth/login'

type RetryConfig = InternalAxiosRequestConfig & {
  _demoAuthRetry?: boolean
  _refreshRetry?: boolean
}

type DemoTokenApiResponse = {
  data?: {
    accessToken?: string
  }
}

type RefreshApiResponse = {
  data?: {
    accessToken?: string
    refreshToken?: string
  }
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: 10_000,
})

apiClient.interceptors.request.use(authInterceptor)
apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined
    if (error.response?.status !== 401 || !config) {
      throw error
    }

    // Refresh token 흐름 우선 (S14P31E103-780). refresh token 이 저장돼 있으면 자동 갱신 + 원 요청 재시도.
    if (
      !config._refreshRetry &&
      !config.url?.includes(REFRESH_PATH) &&
      !config.url?.includes(LOGIN_PATH) &&
      localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
    ) {
      config._refreshRetry = true
      try {
        const newToken = await refreshAccessToken()
        config.headers.Authorization = `Bearer ${newToken}`
        return apiClient.request(config)
      } catch {
        // refresh 도 실패 → refresh 토큰 무효화. demo 폴백이나 사용자 재로그인으로 넘긴다.
        localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
      }
    }

    // 데모 폴백 — refresh 가 없거나 실패했을 때 시연 환경에서만 동작.
    if (
      import.meta.env.VITE_ENABLE_DEMO_AUTH !== 'true' ||
      config._demoAuthRetry ||
      config.url?.includes(DEMO_TOKEN_PATH)
    ) {
      throw error
    }

    config._demoAuthRetry = true
    const token = await refreshDemoToken()
    config.headers.Authorization = `Bearer ${token}`
    return apiClient.request(config)
  },
)

let pendingRefresh: Promise<string> | null = null

/**
 * 401 단일 화살 (single-flight) 갱신. 동시에 여러 요청이 401 을 맞아도 /auth/refresh 는 한 번만 호출되고 모두 같은 새 토큰을
 * 받아 retry 한다. 성공 시 localStorage 의 access + refresh 둘 다 새 값으로 갱신.
 */
async function refreshAccessToken(): Promise<string> {
  if (!pendingRefresh) {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
    if (!refreshToken) {
      throw new Error('No refresh token available.')
    }
    pendingRefresh = axios
      .post<RefreshApiResponse>(
        `${apiClient.defaults.baseURL}${REFRESH_PATH}`,
        { refreshToken },
        { timeout: 10_000 },
      )
      .then(response => {
        const access = response.data.data?.accessToken
        const newRefresh = response.data.data?.refreshToken
        if (!access || !newRefresh) {
          throw new Error('Refresh response missing tokens.')
        }
        localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, access)
        localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, newRefresh)
        return access
      })
      .finally(() => {
        pendingRefresh = null
      })
  }

  return pendingRefresh
}

let pendingDemoToken: Promise<string> | null = null

async function refreshDemoToken() {
  if (!pendingDemoToken) {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
    localStorage.removeItem(PATIENT_PROFILE_STORAGE_KEY)
    localStorage.removeItem(PATIENT_PROFILE_OWNER_STORAGE_KEY)

    pendingDemoToken = axios
      .post<DemoTokenApiResponse>(`${apiClient.defaults.baseURL}${DEMO_TOKEN_PATH}`)
      .then(response => {
        const token = response.data.data?.accessToken
        if (!token) {
          throw new Error('Demo token response is missing accessToken.')
        }
        localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)
        return token
      })
      .finally(() => {
        pendingDemoToken = null
      })
  }

  return pendingDemoToken
}
