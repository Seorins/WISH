import { issueDemoToken } from '@wish/api-client'

const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'
const TOKEN_EXPIRY_MARGIN_MS = 30_000

let pendingDemoAuth: Promise<void> | null = null

export function ensureDemoAuthToken() {
  if (import.meta.env.VITE_ENABLE_DEMO_AUTH !== 'true') {
    return Promise.resolve()
  }

  const storedToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  if (storedToken && isUsableJwt(storedToken)) {
    return Promise.resolve()
  }

  if (!pendingDemoAuth) {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
    pendingDemoAuth = issueDemoToken()
      .then(response => {
        localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, response.data.accessToken)
      })
      .catch(error => {
        console.warn('Failed to issue demo auth token.', error)
      })
      .finally(() => {
        pendingDemoAuth = null
      })
  }

  return pendingDemoAuth
}

export function clearDemoAuthToken() {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
}

function isUsableJwt(token: string) {
  const [, payload] = token.split('.')
  if (!payload) return false

  try {
    const decoded = JSON.parse(atob(toBase64(payload))) as { exp?: unknown }
    if (typeof decoded.exp !== 'number') return true
    return decoded.exp * 1000 > Date.now() + TOKEN_EXPIRY_MARGIN_MS
  } catch {
    return false
  }
}

function toBase64(base64Url: string) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  return base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
}
