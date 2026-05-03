import { create } from 'zustand'

const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'
const TOKEN_EXPIRY_MARGIN_MS = 30_000

type JwtPayload = {
  sub?: string
  email?: string
  role?: string
  exp?: number
}

function decodeJwt(token: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length < 2) return null

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    return JSON.parse(atob(padded)) as JwtPayload
  } catch {
    return null
  }
}

function isTokenValid(token: string | null): boolean {
  if (!token) return false
  const payload = decodeJwt(token)
  if (!payload) return false
  if (typeof payload.exp !== 'number') return true
  return payload.exp * 1000 > Date.now() + TOKEN_EXPIRY_MARGIN_MS
}

function readInitialToken(): string | null {
  const stored = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  if (stored && isTokenValid(stored)) return stored
  if (stored) localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  return null
}

type AuthState = {
  token: string | null
  setToken: (token: string) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>(set => ({
  token: readInitialToken(),
  setToken: token => {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)
    set({ token })
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
    set({ token: null })
  },
}))

export function useIsAuthenticated(): boolean {
  return useAuthStore(state => isTokenValid(state.token))
}

export function hasValidAuthToken(): boolean {
  return isTokenValid(useAuthStore.getState().token)
}
