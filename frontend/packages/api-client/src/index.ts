export { apiClient } from './client'
export { authInterceptor } from './interceptors/auth'
export { issueDemoToken, login } from './auth'
export { createArtwork, deleteArtwork, getArtwork, getMyArtworks, updateArtwork } from './artworks'
export {
  createExerciseMotion,
  deleteExerciseMotion,
  getExerciseMotion,
  listExerciseMotions,
  updateExerciseMotion,
} from './exercise-motions'
export type { LoginRequest, TokenResponse } from './auth'
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
  CreateExerciseMotionRequest,
  ExerciseMotion,
  ExerciseType,
  UpdateExerciseMotionRequest,
} from './exercise-motions'
