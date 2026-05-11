import {
  requestPresignedUploadUrls,
  uploadToPresignedUrl,
  type UploadPurpose,
} from '@wish/api-client'
import type { PerformanceRecording } from './performanceRecorder'

export type PerformanceVideoKeys = {
  videoKey: string
  thumbKey: string
}

export async function uploadPerformanceRecording(
  recording: PerformanceRecording,
  purpose: Extract<UploadPurpose, 'GYMNASTICS_PERFORMANCE' | 'TAEKWONDO_PERFORMANCE'>,
): Promise<PerformanceVideoKeys> {
  const presigned = await requestPresignedUploadUrls({
    videoContentType: recording.videoMimeType,
    thumbContentType: recording.thumbMimeType,
    purpose,
  })
  const { video, thumb } = presigned.data
  await Promise.all([
    uploadToPresignedUrl(video, recording.videoBlob),
    uploadToPresignedUrl(thumb, recording.thumbBlob),
  ])
  return {
    videoKey: video.key,
    thumbKey: thumb.key,
  }
}
