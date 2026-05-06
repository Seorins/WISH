const PATIENT_PROFILE_STORAGE_KEY = 'wish_patient_profile_id'

function parsePositiveInteger(value: string | null | undefined) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export function resolvePatientProfileId() {
  const params = new URLSearchParams(window.location.search)
  return (
    parsePositiveInteger(params.get('patientProfileId')) ??
    parsePositiveInteger(window.localStorage.getItem(PATIENT_PROFILE_STORAGE_KEY)) ??
    parsePositiveInteger(import.meta.env.VITE_PATIENT_PROFILE_ID)
  )
}
