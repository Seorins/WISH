import { listPatientProfiles } from '@wish/api-client'

const PATIENT_PROFILE_STORAGE_KEY = 'wish_patient_profile_id'
const PATIENT_PROFILE_OWNER_STORAGE_KEY = 'wish_patient_profile_owner'
const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'

function parsePositiveInteger(value: string | null | undefined) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function getAuthToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split('.')
  if (!payload) return null

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    return JSON.parse(atob(padded)) as Record<string, unknown>
  } catch {
    return null
  }
}

function getPatientProfileOwnerKey(token: string | null) {
  if (!token) return null

  const payload = decodeJwtPayload(token)
  const subject = payload?.sub
  if (typeof subject === 'string' && subject.trim()) {
    return `sub:${subject}`
  }

  const email = payload?.email
  if (typeof email === 'string' && email.trim()) {
    return `email:${email}`
  }

  return `token:${token}`
}

function readCachedPatientProfileId(token: string) {
  const currentOwner = getPatientProfileOwnerKey(token)
  const cachedOwner = window.localStorage.getItem(PATIENT_PROFILE_OWNER_STORAGE_KEY)

  if (cachedOwner && cachedOwner !== currentOwner) {
    clearPatientProfileId()
    return undefined
  }

  const cachedProfileId = parsePositiveInteger(
    window.localStorage.getItem(PATIENT_PROFILE_STORAGE_KEY),
  )
  if (!cachedProfileId) return undefined

  if (!cachedOwner) {
    clearPatientProfileId()
    return undefined
  }

  return cachedProfileId
}

function writeCachedPatientProfileId(patientProfileId: number, token: string) {
  window.localStorage.setItem(PATIENT_PROFILE_STORAGE_KEY, String(patientProfileId))
  const owner = getPatientProfileOwnerKey(token)
  if (owner) {
    window.localStorage.setItem(PATIENT_PROFILE_OWNER_STORAGE_KEY, owner)
  }
}

export function resolvePatientProfileId() {
  const params = new URLSearchParams(window.location.search)
  const fromQuery = parsePositiveInteger(params.get('patientProfileId'))
  if (fromQuery) return fromQuery

  const token = getAuthToken()
  if (token) {
    const fromCache = readCachedPatientProfileId(token)
    if (fromCache) return fromCache
  }

  return parsePositiveInteger(import.meta.env.VITE_PATIENT_PROFILE_ID)
}

export async function resolvePatientProfileIdOrFetch() {
  const resolved = resolvePatientProfileId()
  if (resolved) return resolved

  const token = getAuthToken()
  if (!token) return undefined

  try {
    const response = await listPatientProfiles()
    const patientProfileId = response.data?.[0]?.id
    if (patientProfileId) {
      writeCachedPatientProfileId(patientProfileId, token)
    }
    return patientProfileId
  } catch (error) {
    console.warn('patient profile id를 API에서 가져오는데 실패함.', error)
    return undefined
  }
}

export function clearPatientProfileId() {
  window.localStorage.removeItem(PATIENT_PROFILE_STORAGE_KEY)
  window.localStorage.removeItem(PATIENT_PROFILE_OWNER_STORAGE_KEY)
}
