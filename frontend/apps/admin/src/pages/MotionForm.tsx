import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ExerciseMotion, ExerciseType } from '@wish/api-client'

const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024

const motionSchema = z.object({
  exerciseType: z.enum(['TOP', 'DANIEL']),
  name: z.string().min(1, 'Enter a name').max(100),
  routineOrder: z.coerce.number().int().positive('Use a positive integer'),
  targetReps: z.coerce.number().int().positive('Use a positive integer'),
  description: z.string().min(1, 'Enter a description'),
})

type MotionMetadataValues = z.infer<typeof motionSchema>

export type MotionFormSubmit = {
  values: MotionMetadataValues
  thumbnail?: File
  demoVideo?: File
  clearThumbnail?: boolean
  clearDemoVideo?: boolean
}

type Props = {
  defaultExerciseType: ExerciseType
  initial?: ExerciseMotion
  onSubmit: (payload: MotionFormSubmit) => void | Promise<void>
  onCancel: () => void
  submitting?: boolean
}

export function MotionForm({
  defaultExerciseType,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: Props) {
  const [thumbnail, setThumbnail] = useState<File | undefined>()
  const [demoVideo, setDemoVideo] = useState<File | undefined>()
  const [clearThumbnail, setClearThumbnail] = useState(false)
  const [clearDemoVideo, setClearDemoVideo] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null)

  const { register, handleSubmit, formState } = useForm<MotionMetadataValues>({
    resolver: zodResolver(motionSchema),
    defaultValues: initial
      ? {
          exerciseType: initial.exerciseType,
          name: initial.name,
          routineOrder: initial.routineOrder,
          targetReps: initial.targetReps,
          description: initial.description,
        }
      : {
          exerciseType: defaultExerciseType,
          name: '',
          routineOrder: 1,
          targetReps: 8,
          description: '',
        },
  })

  const handleThumbnailChange = (file: File | undefined) => {
    setFileError(null)
    if (file && file.size > MAX_THUMBNAIL_BYTES) {
      setFileError('Thumbnail must be 10MB or smaller')
      return
    }
    setThumbnail(file)
    if (file) setClearThumbnail(false)
  }

  useEffect(() => {
    if (!thumbnail) {
      setThumbnailPreviewUrl(null)
      return
    }
    const previewUrl = URL.createObjectURL(thumbnail)
    setThumbnailPreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [thumbnail])

  const handleDemoVideoChange = (file: File | undefined) => {
    setFileError(null)
    if (file && file.size > MAX_VIDEO_BYTES) {
      setFileError('Demo video must be 100MB or smaller')
      return
    }
    setDemoVideo(file)
    if (file) setClearDemoVideo(false)
  }

  const submit = async (values: MotionMetadataValues) => {
    if (fileError) return
    await onSubmit({
      values,
      thumbnail,
      demoVideo,
      clearThumbnail: initial ? clearThumbnail : undefined,
      clearDemoVideo: initial ? clearDemoVideo : undefined,
    })
  }

  const visibleThumbnailUrl =
    thumbnailPreviewUrl ?? (!clearThumbnail ? (initial?.thumbnailUrl ?? null) : null)

  return (
    <form onSubmit={handleSubmit(submit)} style={styles.form}>
      <h3 style={styles.heading}>{initial ? 'Edit Motion' : 'Add Motion'}</h3>
      <div style={styles.grid}>
        {initial ? (
          <>
            <input type="hidden" {...register('exerciseType')} />
            <input type="hidden" {...register('routineOrder')} />
            <div style={styles.label}>
              <span>Exercise type</span>
              <span style={styles.readonlyValue}>{initial.exerciseType}</span>
            </div>
            <div style={styles.label}>
              <span>Order</span>
              <span style={styles.readonlyValue}>{initial.routineOrder}</span>
            </div>
          </>
        ) : (
          <>
            <label style={styles.label}>
              Exercise type
              <select {...register('exerciseType')} style={styles.input} disabled={submitting}>
                <option value="TOP">TOP</option>
                <option value="DANIEL">DANIEL</option>
              </select>
            </label>

            <label style={styles.label}>
              Order
              <input
                type="number"
                min={1}
                {...register('routineOrder')}
                style={styles.input}
                disabled={submitting}
              />
              {formState.errors.routineOrder && (
                <span style={styles.error}>{formState.errors.routineOrder.message}</span>
              )}
            </label>
          </>
        )}

        <label style={styles.label}>
          Name
          <input {...register('name')} style={styles.input} disabled={submitting} />
          {formState.errors.name && (
            <span style={styles.error}>{formState.errors.name.message}</span>
          )}
        </label>

        <label style={styles.label}>
          Target reps
          <input
            type="number"
            min={1}
            {...register('targetReps')}
            style={styles.input}
            disabled={submitting}
          />
          {formState.errors.targetReps && (
            <span style={styles.error}>{formState.errors.targetReps.message}</span>
          )}
        </label>

        <label style={{ ...styles.label, gridColumn: 'span 2' }}>
          Description
          <textarea
            rows={2}
            {...register('description')}
            style={styles.input}
            disabled={submitting}
          />
          {formState.errors.description && (
            <span style={styles.error}>{formState.errors.description.message}</span>
          )}
        </label>

        <div style={styles.label}>
          <span>Thumbnail (optional, image under 10MB)</span>
          {visibleThumbnailUrl && (
            <img src={visibleThumbnailUrl} alt="Motion thumbnail" style={styles.thumbnailPreview} />
          )}
          {initial?.thumbnailUrl && !thumbnail && (
            <span style={styles.mediaHint}>
              Current:{' '}
              <a href={initial.thumbnailUrl} target="_blank" rel="noreferrer">
                {extractFilename(initial.thumbnailUrl)}
              </a>
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={e => handleThumbnailChange(e.target.files?.[0])}
            style={styles.fileInput}
            disabled={submitting}
          />
          {initial?.thumbnailUrl && (
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={clearThumbnail}
                onChange={e => setClearThumbnail(e.target.checked)}
                disabled={submitting || Boolean(thumbnail)}
              />
              Remove existing thumbnail
            </label>
          )}
        </div>

        <div style={styles.label}>
          <span>Demo video (optional, video under 100MB)</span>
          {initial?.demoVideoUrl && !demoVideo && (
            <span style={styles.mediaHint}>
              Current:{' '}
              <a href={initial.demoVideoUrl} target="_blank" rel="noreferrer">
                {extractFilename(initial.demoVideoUrl)}
              </a>
            </span>
          )}
          <input
            type="file"
            accept="video/*"
            onChange={e => handleDemoVideoChange(e.target.files?.[0])}
            style={styles.fileInput}
            disabled={submitting}
          />
          {initial?.demoVideoUrl && (
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={clearDemoVideo}
                onChange={e => setClearDemoVideo(e.target.checked)}
                disabled={submitting || Boolean(demoVideo)}
              />
              Remove existing video
            </label>
          )}
        </div>
      </div>

      {fileError && <div style={styles.errorBox}>{fileError}</div>}

      <div style={styles.actions}>
        <button type="button" onClick={onCancel} style={styles.cancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" style={styles.submit} disabled={submitting || Boolean(fileError)}>
          {submitting ? 'Saving' : 'Save'}
        </button>
      </div>
    </form>
  )
}

function extractFilename(url: string): string {
  const trimmed = url.split('?')[0]
  const last = trimmed.substring(trimmed.lastIndexOf('/') + 1)
  return last || url
}

const styles: Record<string, CSSProperties> = {
  form: {
    background: '#fafafa',
    border: '1px solid #ddd',
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  heading: {
    margin: 0,
    fontSize: 16,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 13,
  },
  input: {
    padding: '6px 8px',
    fontSize: 13,
    border: '1px solid #ccc',
    borderRadius: 4,
  },
  readonlyValue: {
    minHeight: 30,
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    background: '#eef2f6',
    border: '1px solid #d9e2ec',
    borderRadius: 4,
    color: '#334e68',
    fontSize: 13,
  },
  fileInput: {
    fontSize: 12,
  },
  thumbnailPreview: {
    width: 120,
    height: 76,
    objectFit: 'cover',
    border: '1px solid #d9e2ec',
    borderRadius: 6,
    background: '#fff',
  },
  mediaHint: {
    fontSize: 11,
    color: '#555',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#555',
  },
  error: {
    color: '#d32f2f',
    fontSize: 11,
  },
  errorBox: {
    padding: 10,
    background: '#fdecea',
    color: '#d32f2f',
    borderRadius: 4,
    fontSize: 13,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancel: {
    padding: '6px 12px',
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: 4,
    cursor: 'pointer',
  },
  submit: {
    padding: '6px 14px',
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
}
