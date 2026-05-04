export { apiClient } from './client'
export { authInterceptor } from './interceptors/auth'
export { issueDemoToken, login, signup } from './auth'
export { createArtwork, deleteArtwork, getArtwork, getMyArtworks, updateArtwork } from './artworks'
export {
  createExerciseMotion,
  deleteExerciseMotion,
  getExerciseMotion,
  listExerciseMotions,
  updateExerciseMotion,
} from './exercise-motions'
export { getMyBestMusicResults, saveMusicResult } from './music-results'
export { createPatientProfile, listPatientProfiles } from './patient-profiles'
export type { LoginRequest, SignupRequest, TokenResponse, UserResponse } from './auth'
export type {
  ApiResponse,
  Artwork,
  ArtworkPage,
  CreateArtworkParams,
  CreateArtworkRequest,
  GetMyArtworksParams,
  Pageable,
  PageResponse,
  PageSort,
  UpdateArtworkParams,
  UpdateArtworkRequest,
} from './artworks'
export type {
  CreateExerciseMotionParams,
  CreateExerciseMotionRequest,
  ExerciseMotion,
  ExerciseType,
  UpdateExerciseMotionParams,
  UpdateExerciseMotionRequest,
} from './exercise-motions'
export type { MusicResult, MusicResultRequest } from './music-results'
export type { Gender, PatientProfile, PatientProfileCreateRequest } from './patient-profiles'
