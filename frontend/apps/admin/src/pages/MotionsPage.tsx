import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  createExerciseMotion,
  deleteExerciseMotion,
  listExerciseMotions,
  updateExerciseMotion,
} from '@wish/api-client'
import type { ExerciseMotion, ExerciseType } from '@wish/api-client'
import { useAuthStore } from '../shared/auth/store'
import { MotionForm } from './MotionForm'
import type { MotionFormSubmit } from './MotionForm'

const EXERCISE_TYPES: ExerciseType[] = ['TOP', 'DANIEL']

export function MotionsPage() {
  const navigate = useNavigate()
  const { email, clear } = useAuthStore()
  const queryClient = useQueryClient()
  const [exerciseType, setExerciseType] = useState<ExerciseType>('TOP')
  const [editing, setEditing] = useState<ExerciseMotion | null>(null)
  const [creating, setCreating] = useState(false)

  const motionsQuery = useQuery({
    queryKey: ['motions', exerciseType],
    queryFn: () => listExerciseMotions(exerciseType).then(r => r.data),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['motions'] })

  const createMutation = useMutation({
    mutationFn: (payload: MotionFormSubmit) =>
      createExerciseMotion({
        request: {
          exerciseType: payload.values.exerciseType,
          name: payload.values.name,
          routineOrder: payload.values.routineOrder,
          targetReps: payload.values.targetReps,
          description: payload.values.description,
        },
        thumbnail: payload.thumbnail,
        demoVideo: payload.demoVideo,
      }),
    onSuccess: () => {
      setCreating(false)
      invalidate()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MotionFormSubmit }) =>
      updateExerciseMotion(id, {
        request: {
          // exerciseType / routineOrder 는 PATCH 대상 외 (BE UpdateRequest 에 없음). 수정 폼 입력은
          // metadata 변경에만 의미가 있고, 미디어는 thumbnail/demoVideo + clear* 플래그로 처리.
          name: payload.values.name,
          targetReps: payload.values.targetReps,
          description: payload.values.description,
          clearThumbnail: payload.clearThumbnail,
          clearDemoVideo: payload.clearDemoVideo,
        },
        thumbnail: payload.thumbnail,
        demoVideo: payload.demoVideo,
      }),
    onSuccess: () => {
      setEditing(null)
      invalidate()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteExerciseMotion(id),
    onSuccess: invalidate,
  })

  const onLogout = () => {
    clear()
    navigate('/login', { replace: true })
  }

  const onDelete = (motion: ExerciseMotion) => {
    if (!confirm(`"${motion.name}" 동작을 삭제할까요? 수행 기록이 있으면 거부됩니다.`)) return
    deleteMutation.mutate(motion.id)
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>WISH Admin · 체조 모션</h1>
        <div style={styles.headerRight}>
          <span style={styles.userBadge}>{email}</span>
          <button onClick={onLogout} style={styles.logout}>
            로그아웃
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.toolbar}>
          <label style={styles.typeLabel}>
            체조 타입
            <select
              value={exerciseType}
              onChange={e => {
                setExerciseType(e.target.value as ExerciseType)
                setEditing(null)
                setCreating(false)
              }}
              style={styles.select}
            >
              {EXERCISE_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              setCreating(true)
              setEditing(null)
            }}
            style={styles.addButton}
            disabled={creating}
          >
            + 동작 추가
          </button>
        </div>

        {creating && (
          <MotionForm
            defaultExerciseType={exerciseType}
            onCancel={() => setCreating(false)}
            onSubmit={async payload => {
              await createMutation.mutateAsync(payload)
            }}
            submitting={createMutation.isPending}
          />
        )}

        {createMutation.isError && (
          <div style={styles.errorBox}>추가 실패: {extractMessage(createMutation.error)}</div>
        )}
        {updateMutation.isError && (
          <div style={styles.errorBox}>수정 실패: {extractMessage(updateMutation.error)}</div>
        )}
        {deleteMutation.isError && (
          <div style={styles.errorBox}>삭제 실패: {extractMessage(deleteMutation.error)}</div>
        )}

        {motionsQuery.isLoading && <div>불러오는 중…</div>}
        {motionsQuery.isError && (
          <div style={styles.errorBox}>목록 조회 실패: {extractMessage(motionsQuery.error)}</div>
        )}

        {motionsQuery.data && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>순서</th>
                <th style={styles.th}>이름</th>
                <th style={styles.th}>목표</th>
                <th style={styles.th}>설명</th>
                <th style={styles.th}>액션</th>
              </tr>
            </thead>
            <tbody>
              {motionsQuery.data.length === 0 && (
                <tr>
                  <td colSpan={5} style={styles.emptyRow}>
                    동작이 없습니다.
                  </td>
                </tr>
              )}
              {motionsQuery.data.map(motion => (
                <tr key={motion.id}>
                  {editing?.id === motion.id ? (
                    <td colSpan={5} style={styles.editCell}>
                      <MotionForm
                        defaultExerciseType={exerciseType}
                        initial={motion}
                        onCancel={() => setEditing(null)}
                        onSubmit={async payload => {
                          await updateMutation.mutateAsync({ id: motion.id, payload })
                        }}
                        submitting={updateMutation.isPending}
                      />
                    </td>
                  ) : (
                    <>
                      <td style={styles.td}>{motion.routineOrder}</td>
                      <td style={styles.td}>{motion.name}</td>
                      <td style={styles.td}>{motion.targetReps}회</td>
                      <td style={styles.td}>{motion.description}</td>
                      <td style={styles.td}>
                        <button
                          onClick={() => {
                            setEditing(motion)
                            setCreating(false)
                          }}
                          style={styles.editButton}
                        >
                          수정
                        </button>
                        <button onClick={() => onDelete(motion)} style={styles.deleteButton}>
                          삭제
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const res = (error as { response?: { data?: { message?: string; code?: string } } }).response
    if (res?.data?.message) return res.data.message
    if (res?.data?.code) return res.data.code
  }
  if (error instanceof Error) return error.message
  return '알 수 없는 오류'
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: '#f5f5f5' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    background: '#1976d2',
    color: '#fff',
  },
  title: { margin: 0, fontSize: 18 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  userBadge: { fontSize: 13, opacity: 0.85 },
  logout: {
    padding: '6px 12px',
    background: 'transparent',
    color: '#fff',
    border: '1px solid #fff',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
  },
  main: { padding: 24, maxWidth: 1100, margin: '0 auto' },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  typeLabel: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 },
  select: {
    padding: '6px 8px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 4,
    minWidth: 120,
  },
  addButton: {
    padding: '8px 14px',
    background: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  th: {
    padding: 10,
    textAlign: 'left',
    fontSize: 13,
    background: '#fafafa',
    borderBottom: '1px solid #ddd',
  },
  td: { padding: 10, borderBottom: '1px solid #eee', fontSize: 13, verticalAlign: 'top' },
  editCell: { padding: 0, borderBottom: '1px solid #eee' },
  emptyRow: { padding: 20, textAlign: 'center', color: '#888' },
  editButton: {
    padding: '4px 10px',
    background: '#fff',
    border: '1px solid #1976d2',
    color: '#1976d2',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    marginRight: 6,
  },
  deleteButton: {
    padding: '4px 10px',
    background: '#fff',
    border: '1px solid #d32f2f',
    color: '#d32f2f',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  },
  errorBox: {
    padding: 10,
    background: '#fdecea',
    color: '#d32f2f',
    borderRadius: 4,
    fontSize: 13,
    marginBottom: 12,
  },
}
