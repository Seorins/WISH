import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ExerciseMotion, ExerciseType } from '@wish/api-client'

const motionSchema = z.object({
  exerciseType: z.enum(['TOP', 'DANIEL']),
  name: z.string().min(1, '이름을 입력하세요').max(100),
  routineOrder: z.coerce.number().int().positive('1 이상 정수'),
  targetReps: z.coerce.number().int().positive('1 이상 정수'),
  description: z.string().min(1, '설명을 입력하세요'),
  demoVideoUrl: z.string().max(500).optional().or(z.literal('')),
  thumbnailUrl: z.string().max(500).optional().or(z.literal('')),
})

export type MotionFormValues = z.infer<typeof motionSchema>

type Props = {
  defaultExerciseType: ExerciseType
  initial?: ExerciseMotion
  onSubmit: (values: MotionFormValues) => void | Promise<void>
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
  const { register, handleSubmit, formState } = useForm<MotionFormValues>({
    resolver: zodResolver(motionSchema),
    defaultValues: initial
      ? {
          exerciseType: initial.exerciseType,
          name: initial.name,
          routineOrder: initial.routineOrder,
          targetReps: initial.targetReps,
          description: initial.description,
          demoVideoUrl: initial.demoVideoUrl ?? '',
          thumbnailUrl: initial.thumbnailUrl ?? '',
        }
      : {
          exerciseType: defaultExerciseType,
          name: '',
          routineOrder: 1,
          targetReps: 8,
          description: '',
          demoVideoUrl: '',
          thumbnailUrl: '',
        },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
      <h3 style={styles.heading}>{initial ? '동작 수정' : '동작 추가'}</h3>
      <div style={styles.grid}>
        <label style={styles.label}>
          체조 타입
          <select {...register('exerciseType')} style={styles.input} disabled={submitting}>
            <option value="TOP">TOP</option>
            <option value="DANIEL">DANIEL</option>
          </select>
        </label>

        <label style={styles.label}>
          순서
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

        <label style={styles.label}>
          이름
          <input {...register('name')} style={styles.input} disabled={submitting} />
          {formState.errors.name && (
            <span style={styles.error}>{formState.errors.name.message}</span>
          )}
        </label>

        <label style={styles.label}>
          목표 횟수
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
          설명
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

        <label style={styles.label}>
          시범 영상 URL (선택)
          <input {...register('demoVideoUrl')} style={styles.input} disabled={submitting} />
        </label>

        <label style={styles.label}>
          썸네일 URL (선택)
          <input {...register('thumbnailUrl')} style={styles.input} disabled={submitting} />
        </label>
      </div>

      <div style={styles.actions}>
        <button type="button" onClick={onCancel} style={styles.cancel} disabled={submitting}>
          취소
        </button>
        <button type="submit" style={styles.submit} disabled={submitting}>
          {submitting ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  )
}

const styles: Record<string, React.CSSProperties> = {
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
  heading: { margin: 0, fontSize: 16 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 },
  input: {
    padding: '6px 8px',
    fontSize: 13,
    border: '1px solid #ccc',
    borderRadius: 4,
  },
  error: { color: '#d32f2f', fontSize: 11 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
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
