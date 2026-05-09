import { listPatientProfiles } from '@wish/api-client'

const PATIENT_PROFILE_STORAGE_KEY = 'wish_patient_profile_id'
const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'

function parsePositiveInteger(value: string | null | undefined) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function hasAuthToken() {
  return !!window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
}

export function resolvePatientProfileId() {
  const params = new URLSearchParams(window.location.search)
  const fromQuery = parsePositiveInteger(params.get('patientProfileId'))
  if (fromQuery) return fromQuery

  if (hasAuthToken()) {
    const fromCache = parsePositiveInteger(window.localStorage.getItem(PATIENT_PROFILE_STORAGE_KEY))
    if (fromCache) return fromCache
  }

  return parsePositiveInteger(import.meta.env.VITE_PATIENT_PROFILE_ID)
}

export async function resolvePatientProfileIdOrFetch() {
  const resolved = resolvePatientProfileId()
  if (resolved) return resolved

  if (!hasAuthToken()) return undefined

  try {
    const response = await listPatientProfiles()
    const patientProfileId = response.data?.[0]?.id
    if (patientProfileId) {
      window.localStorage.setItem(PATIENT_PROFILE_STORAGE_KEY, String(patientProfileId))
    }
    return patientProfileId
  } catch (error) {
    console.warn('patient profile id를 API에서 가져오는데 실패함.', error)
    return undefined
  }
}

export function clearPatientProfileId() {
  window.localStorage.removeItem(PATIENT_PROFILE_STORAGE_KEY)
}
