import { apiClient } from './client'
import type { ApiResponse } from './artworks'

export type Poomsae =
  | 'TAEGEUK_1'
  | 'TAEGEUK_2'
  | 'TAEGEUK_3'
  | 'TAEGEUK_4'
  | 'TAEGEUK_5'
  | 'TAEGEUK_6'
  | 'TAEGEUK_7'
  | 'TAEGEUK_8'

export type TaekwondoMotion = {
  id: number
  poomsae: Poomsae
  name: string
  routineOrder: number
  targetReps: number
  description: string
  demoVideoUrl?: string | null
  thumbnailUrl?: string | null
  createdAt: string
  updatedAt: string
}

export type CreateTaekwondoMotionRequest = {
  poomsae: Poomsae
  name: string
  routineOrder: number
  targetReps: number
  description: string
}

export type UpdateTaekwondoMotionRequest = {
  name?: string
  routineOrder?: number
  targetReps?: number
  description?: string
  clearThumbnail?: boolean
  clearDemoVideo?: boolean
}

export type TaekwondoMotionReorderRequest = {
  poomsae: Poomsae
  motionIds: number[]
}

export type CreateTaekwondoMotionParams = {
  request: CreateTaekwondoMotionRequest
  thumbnail?: File
  demoVideo?: File
}

export type UpdateTaekwondoMotionParams = {
  request: UpdateTaekwondoMotionRequest
  thumbnail?: File
  demoVideo?: File
}

export async function listTaekwondoMotions(poomsae: Poomsae) {
  const response = await apiClient.get<ApiResponse<TaekwondoMotion[]>>('/taekwondo-motions', {
    params: { poomsae },
  })
  return response.data
}

export async function getTaekwondoMotion(id: number) {
  const response = await apiClient.get<ApiResponse<TaekwondoMotion>>(`/taekwondo-motions/${id}`)
  return response.data
}

export async function createTaekwondoMotion({
  request,
  thumbnail,
  demoVideo,
}: CreateTaekwondoMotionParams) {
  const formData = buildFormData(request, thumbnail, demoVideo)
  const response = await apiClient.post<ApiResponse<TaekwondoMotion>>(
    '/taekwondo-motions',
    formData,
  )
  return response.data
}

export async function updateTaekwondoMotion(
  id: number,
  { request, thumbnail, demoVideo }: UpdateTaekwondoMotionParams,
) {
  const formData = buildFormData(request, thumbnail, demoVideo)
  const response = await apiClient.patch<ApiResponse<TaekwondoMotion>>(
    `/taekwondo-motions/${id}`,
    formData,
  )
  return response.data
}

export async function reorderTaekwondoMotions(request: TaekwondoMotionReorderRequest) {
  const response = await apiClient.patch<ApiResponse<TaekwondoMotion[]>>(
    '/taekwondo-motions/reorder',
    request,
  )
  return response.data
}

export async function deleteTaekwondoMotion(id: number) {
  await apiClient.delete(`/taekwondo-motions/${id}`)
}

function buildFormData(request: object, thumbnail?: File, demoVideo?: File): FormData {
  const formData = new FormData()
  formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }))
  if (thumbnail) {
    formData.append('thumbnail', thumbnail, thumbnail.name)
  }
  if (demoVideo) {
    formData.append('demoVideo', demoVideo, demoVideo.name)
  }
  return formData
}
