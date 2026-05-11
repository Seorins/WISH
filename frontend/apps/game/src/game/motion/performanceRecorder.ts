export type PerformanceRecording = {
  videoBlob: Blob
  videoMimeType: string
  thumbBlob: Blob
  thumbMimeType: string
}

export type PerformanceRecorderHandle = {
  stop: () => Promise<PerformanceRecording>
  cancel: () => void
}

const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4;codecs=h264',
  'video/mp4',
] as const

const THUMB_MIME_TYPE = 'image/jpeg'
const THUMB_QUALITY = 0.85

function pickSupportedMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const mime of VIDEO_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return null
}

function captureThumb(video: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const width = video.videoWidth || 960
    const height = video.videoHeight || 720
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      reject(new Error('performanceRecorder: thumbnail context unavailable'))
      return
    }

    context.drawImage(video, 0, 0, width, height)
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob)
        else reject(new Error('performanceRecorder: thumbnail capture returned null'))
      },
      THUMB_MIME_TYPE,
      THUMB_QUALITY,
    )
  })
}

export function startPerformanceRecording(
  video: HTMLVideoElement | null,
): PerformanceRecorderHandle | null {
  const mimeType = pickSupportedMime()
  if (!mimeType) {
    console.warn('[performanceRecorder] MediaRecorder video is not supported in this browser')
    return null
  }

  const sourceStream = video?.srcObject instanceof MediaStream ? video.srcObject : null
  const sourceTracks = sourceStream?.getVideoTracks() ?? []
  if (!video || sourceTracks.length === 0) {
    return null
  }

  const stream = new MediaStream(sourceTracks.map(track => track.clone()))
  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 1_500_000,
    })
  } catch (error) {
    console.warn('[performanceRecorder] failed to construct MediaRecorder', error)
    stream.getTracks().forEach(track => track.stop())
    return null
  }

  const chunks: Blob[] = []
  recorder.addEventListener('dataavailable', event => {
    if (event.data && event.data.size > 0) chunks.push(event.data)
  })

  recorder.start(1_000)

  let cleanedUp = false
  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    stream.getTracks().forEach(track => track.stop())
  }

  return {
    stop: async () => {
      const thumbPromise = captureThumb(video)
      const stopPromise = new Promise<void>(resolve => {
        recorder.addEventListener('stop', () => resolve(), { once: true })
      })
      if (recorder.state !== 'inactive') {
        recorder.stop()
      }
      const [thumbBlob] = await Promise.all([thumbPromise, stopPromise])
      cleanup()
      return {
        videoBlob: new Blob(chunks, { type: mimeType }),
        videoMimeType: mimeType,
        thumbBlob,
        thumbMimeType: THUMB_MIME_TYPE,
      }
    },
    cancel: () => {
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {
        // ignore
      }
      cleanup()
    },
  }
}
