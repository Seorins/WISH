import { apiClient } from './client'
import type { ApiResponse } from './artworks'

export type ExerciseType = 'TOP' | 'DANIEL'

export type ExerciseMotion = {
  id: number
  exerciseType: ExerciseType
  name: string
  routineOrder: number
  targetReps: number
  description: string
  demoVideoUrl?: string | null
  thumbnailUrl?: string | null
  createdAt: string
  updatedAt: string
}

/** 생성 요청의 메타데이터 부분 (multipart 의 request part 에 JSON 으로 직렬화). */
export type CreateExerciseMotionRequest = {
  exerciseType: ExerciseType
  name: string
  routineOrder: number
  targetReps: number
  description: string
}

/**
 * 부분 수정 요청 (PATCH). 텍스트 필드는 모두 optional, `clear*` 플래그는 파일 part 가 없을 때만 의미가 있고 true 이면 기존 미디어를 제거.
 */
export type UpdateExerciseMotionRequest = {
  name?: string
  targetReps?: number
  description?: string
  clearThumbnail?: boolean
  clearDemoVideo?: boolean
}

export type CreateExerciseMotionParams = {
  request: CreateExerciseMotionRequest
  thumbnail?: File
  demoVideo?: File
}

export type UpdateExerciseMotionParams = {
  request: UpdateExerciseMotionRequest
  thumbnail?: File
  demoVideo?: File
}

export async function listExerciseMotions(exerciseType: ExerciseType) {
  const response = await apiClient.get<ApiResponse<ExerciseMotion[]>>('/exercise-motions', {
    params: { exerciseType },
  })
  return response.data
}

export async function getExerciseMotion(id: number) {
  const response = await apiClient.get<ApiResponse<ExerciseMotion>>(`/exercise-motions/${id}`)
  return response.data
}

export async function createExerciseMotion({
  request,
  thumbnail,
  demoVideo,
}: CreateExerciseMotionParams) {
  const formData = buildFormData(request, thumbnail, demoVideo)
  const response = await apiClient.post<ApiResponse<ExerciseMotion>>('/exercise-motions', formData)
  return response.data
}

export async function updateExerciseMotion(
  id: number,
  { request, thumbnail, demoVideo }: UpdateExerciseMotionParams,
) {
  const formData = buildFormData(request, thumbnail, demoVideo)
  const response = await apiClient.patch<ApiResponse<ExerciseMotion>>(
    `/exercise-motions/${id}`,
    formData,
  )
  return response.data
}

export async function deleteExerciseMotion(id: number) {
  await apiClient.delete(`/exercise-motions/${id}`)
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
