import { listPatientProfiles } from '@wish/api-client'

const PATIENT_PROFILE_STORAGE_KEY = 'wish_patient_profile_id'
const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'

function parsePositiveInteger(value: string | null | undefined) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function readCachedPatientProfileId() {
  if (!window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)) {
    return undefined
  }
  return parsePositiveInteger(window.localStorage.getItem(PATIENT_PROFILE_STORAGE_KEY))
}

export function resolvePatientProfileId() {
  const params = new URLSearchParams(window.location.search)
  return (
    parsePositiveInteger(params.get('patientProfileId')) ??
    readCachedPatientProfileId() ??
    parsePositiveInteger(import.meta.env.VITE_PATIENT_PROFILE_ID)
  )
}

export function clearPatientProfileId() {
  window.localStorage.removeItem(PATIENT_PROFILE_STORAGE_KEY)
}

export async function resolvePatientProfileIdOrFetch() {
  const resolved = resolvePatientProfileId()
  if (resolved) {
    return resolved
  }

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
