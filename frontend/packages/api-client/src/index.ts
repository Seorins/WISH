export { apiClient } from './client'
export { authInterceptor } from './interceptors/auth'
export { issueDemoToken } from './auth'
export { createArtwork, deleteArtwork, getArtwork, getMyArtworks, updateArtwork } from './artworks'
export type { TokenResponse } from './auth'
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
