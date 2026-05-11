import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { authInterceptor } from './interceptors/auth'

const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'
const PATIENT_PROFILE_STORAGE_KEY = 'wish_patient_profile_id'
const PATIENT_PROFILE_OWNER_STORAGE_KEY = 'wish_patient_profile_owner'
const DEMO_TOKEN_PATH = '/auth/demo-token'

type DemoRetryConfig = InternalAxiosRequestConfig & {
  _demoAuthRetry?: boolean
}

type DemoTokenApiResponse = {
  data?: {
    accessToken?: string
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
    const config = error.config as DemoRetryConfig | undefined
    if (
      import.meta.env.VITE_ENABLE_DEMO_AUTH !== 'true' ||
      error.response?.status !== 401 ||
      !config ||
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
