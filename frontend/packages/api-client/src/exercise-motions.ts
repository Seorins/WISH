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

export type CreateExerciseMotionRequest = {
  exerciseType: ExerciseType
  name: string
  routineOrder: number
  targetReps: number
  description: string
  demoVideoUrl?: string | null
  thumbnailUrl?: string | null
}

export type UpdateExerciseMotionRequest = Partial<CreateExerciseMotionRequest>

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

export async function createExerciseMotion(request: CreateExerciseMotionRequest) {
  const response = await apiClient.post<ApiResponse<ExerciseMotion>>('/exercise-motions', request)
  return response.data
}

export async function updateExerciseMotion(id: number, request: UpdateExerciseMotionRequest) {
  const response = await apiClient.patch<ApiResponse<ExerciseMotion>>(
    `/exercise-motions/${id}`,
    request,
  )
  return response.data
}

export async function deleteExerciseMotion(id: number) {
  await apiClient.delete(`/exercise-motions/${id}`)
}
