export { apiClient } from './client'
export { authInterceptor } from './interceptors/auth'
export { createArtwork, deleteArtwork, getArtwork, getMyArtworks, updateArtwork } from './artworks'
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
