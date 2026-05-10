import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { listExerciseMotions, type ExerciseMotion, type ExerciseType } from '@wish/api-client'
import { useMyPatientId } from '@/features/auth/hooks/useMyPatientId'
import { useDailyUsageStats, useMyExerciseSessions } from '../hooks'
import { aggregateExerciseMotionStats, type MotionStats } from '../utils/aggregateMotionStats'
import styles from './MotionActivity.module.css'

const EXERCISE_TYPE_VALUES: ExerciseType[] = ['TOP', 'DANIEL']

const EXERCISE_TYPE_LABEL: Record<ExerciseType, string> = {
  TOP: '탑',
  DANIEL: '다니엘',
}

const DEFAULT_EXERCISE_TYPE: ExerciseType = 'TOP'

function todayKst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

function formatDurationSec(seconds: number): string {
  if (seconds <= 0) return '0초'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}초`
  if (s === 0) return `${m}분`
  return `${m}분 ${s}초`
}

function useExerciseMotions(exerciseType: ExerciseType) {
  return useQuery({
    queryKey: ['exercise-motions', exerciseType],
    queryFn: async () => {
      const response = await listExerciseMotions(exerciseType)
      return response.data ?? []
    },
  })
}

/**
 * 체조 활동 결과 화면.
 * 좌측: 선택된 동작의 영상 + 설명 + 통계 + (우측 또래 비교).
 * 우측: 운동 종류별 동작 리스트(클릭 시 좌측 영상 교체) + 다른 사용자들과 비교.
 *
 * 좌측 영상은 me-sessions 의 가장 최근 수행본(`latestVideoUrl`) 우선,
 * 없으면 motion 의 시범영상(`demoVideoUrl`)으로 폴백. me-sessions 엔드포인트
 * 미구현 상태에서는 stats 가 undefined 로 떨어지고 통계 칸은 '—' 표시.
 */
export function GymnasticsMain() {
  const { data: patientId } = useMyPatientId()
  const today = todayKst()
  const { data: daily } = useDailyUsageStats(patientId ?? undefined, { from: today, to: today })
  const todayGymSeconds = daily?.items[0]?.gymnastics ?? 0

  const [exerciseType, setExerciseType] = useState<ExerciseType>(DEFAULT_EXERCISE_TYPE)
  const { data: motions = [], isLoading, error } = useExerciseMotions(exerciseType)

  // me-sessions: 같은 운동 종류로 필터링 (서버가 지원하면) 후 motion-별 집계.
  const { data: sessionsPage } = useMyExerciseSessions({ exerciseType, size: 100 })
  const motionStatsMap = useMemo(
    () => aggregateExerciseMotionStats(sessionsPage?.content ?? []),
    [sessionsPage],
  )

  const sortedMotions = useMemo<ExerciseMotion[]>(() => {
    return [...motions].sort((a, b) => a.routineOrder - b.routineOrder)
  }, [motions])

  const [selectedMotionId, setSelectedMotionId] = useState<number | null>(null)

  // 운동 종류 변경 시 첫 번째 동작 자동 선택
  useEffect(() => {
    if (sortedMotions.length === 0) {
      setSelectedMotionId(null)
      return
    }
    setSelectedMotionId(prev => {
      if (prev != null && sortedMotions.some(m => m.id === prev)) return prev
      return sortedMotions[0].id
    })
  }, [sortedMotions])

  const selectedMotion = sortedMotions.find(m => m.id === selectedMotionId) ?? null
  const selectedStats = selectedMotion ? motionStatsMap[selectedMotion.id] : undefined

  return (
    <div className={styles.layout}>
      <div className={styles.mainColumn}>
        <ExerciseTypeTabBar value={exerciseType} onChange={setExerciseType} />

        {isLoading ? (
          <div className={styles.fullStatus}>동작을 불러오는 중...</div>
        ) : error ? (
          <div className={`${styles.fullStatus} ${styles.error}`}>동작을 불러오지 못했어요</div>
        ) : !selectedMotion ? (
          <div className={styles.fullStatus}>등록된 동작이 없어요</div>
        ) : (
          <>
            <VideoCard motion={selectedMotion} stats={selectedStats} />
            <DescriptionCard motion={selectedMotion} />
            <StatsCard motion={selectedMotion} stats={selectedStats} />
          </>
        )}
      </div>

      <aside className={styles.sideColumn}>
        <MotionListCard
          motions={sortedMotions}
          selectedId={selectedMotionId}
          onSelect={setSelectedMotionId}
          isLoading={isLoading}
        />
        <PeerCompareCard mineSeconds={todayGymSeconds} />
      </aside>
    </div>
  )
}

function ExerciseTypeTabBar({
  value,
  onChange,
}: {
  value: ExerciseType
  onChange: (v: ExerciseType) => void
}) {
  return (
    <div className={styles.poomsaeBar} role="tablist" aria-label="운동 종류 선택">
      {EXERCISE_TYPE_VALUES.map(t => {
        const active = t === value
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t)}
            className={`${styles.poomsaeChip} ${active ? styles.poomsaeChipActive : ''}`}
          >
            {EXERCISE_TYPE_LABEL[t]}
          </button>
        )
      })}
    </div>
  )
}

function VideoCard({ motion, stats }: { motion: ExerciseMotion; stats: MotionStats | undefined }) {
  // 아이가 수행한 가장 최근 영상 → 시범영상 순 폴백.
  const videoUrl = stats?.latestVideoUrl ?? motion.demoVideoUrl ?? null
  const hasVideo = Boolean(videoUrl)
  return (
    <section className={styles.videoCard}>
      <div className={styles.videoFrame}>
        {hasVideo ? (
          <video
            key={`${motion.id}-${videoUrl}`}
            className={styles.video}
            src={videoUrl ?? undefined}
            poster={motion.thumbnailUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
          />
        ) : (
          <div className={styles.videoEmpty}>
            <span className={styles.videoEmptyIcon} aria-hidden>
              🎬
            </span>
            <span className={styles.videoEmptyText}>아이의 수행 영상이 들어갈 자리예요</span>
            <span className={styles.videoEmptySub}>(BE 영상 업로드 연동 대기 중)</span>
          </div>
        )}
      </div>
      <div className={styles.videoCaption}>
        <span className={styles.tag}>체조</span>
        <h3 className={styles.motionTitle}>{motion.name}</h3>
      </div>
    </section>
  )
}

function DescriptionCard({ motion }: { motion: ExerciseMotion }) {
  const description = motion.description?.trim() || '동작 설명이 곧 추가될 예정이에요.'
  return (
    <section className={styles.descCard}>
      <h3 className={styles.cardTitle}>동작 설명</h3>
      <p className={styles.descText}>{description}</p>
    </section>
  )
}

function StatsCard({ motion, stats }: { motion: ExerciseMotion; stats: MotionStats | undefined }) {
  const cells = [
    {
      id: 'duration',
      icon: '⏱️',
      label: '수행 시간',
      value: stats ? formatDurationSec(stats.latestDurationSec) : '—',
    },
    { id: 'motion', icon: '🤸', label: '동작', value: motion.name },
    {
      id: 'reps',
      icon: '🔁',
      label: '총 연습 수',
      value: stats ? `${stats.totalReps}회` : '—',
    },
    {
      id: 'accuracy',
      icon: '🎯',
      label: '평균 정확도',
      value: stats ? `${Math.round(stats.avgAccuracy * 100)}%` : '—',
    },
  ] as const

  return (
    <section className={styles.statsCard}>
      <h3 className={styles.cardTitle}>활동 통계</h3>
      <div className={styles.statRow}>
        {cells.map(cell => (
          <div key={cell.id} className={styles.statCell}>
            <span className={styles.statIcon} aria-hidden>
              {cell.icon}
            </span>
            <div className={styles.statBody}>
              <span className={styles.statLabel}>{cell.label}</span>
              <span className={styles.statValue}>{cell.value}</span>
            </div>
          </div>
        ))}
      </div>
      <p className={styles.statsNote}>목표 반복 수: {motion.targetReps}회</p>
    </section>
  )
}

function PeerCompareCard({ mineSeconds }: { mineSeconds: number }) {
  // 또래 평균 API 미구현 — 음악/미술과 동일하게 "집계 중" 처리.
  const hasPeer = false
  const peerSeconds = 0

  const max = Math.max(mineSeconds, peerSeconds, 1)
  const minePct = (mineSeconds / max) * 100
  const peerPct = hasPeer ? (peerSeconds / max) * 100 : 0
  const peerLabel = hasPeer ? formatDurationSec(peerSeconds) : '집계 중'

  return (
    <section className={styles.peerCard}>
      <h3 className={styles.cardTitle}>다른 사용자들과 비교</h3>
      <div className={styles.peerRows}>
        <div className={styles.peerRow}>
          <div className={styles.peerRowHead}>
            <span className={styles.peerRowLabel}>아이</span>
            <strong className={styles.peerRowValue}>{formatDurationSec(mineSeconds)}</strong>
          </div>
          <div className={styles.peerBar}>
            <div
              className={`${styles.peerBarFill} ${styles.peerBarFillMine}`}
              style={{ width: `${minePct}%` }}
            />
          </div>
        </div>
        <div className={styles.peerRow}>
          <div className={styles.peerRowHead}>
            <span className={styles.peerRowLabel}>평균</span>
            <strong className={styles.peerRowValue}>{peerLabel}</strong>
          </div>
          <div className={styles.peerBar}>
            <div
              className={`${styles.peerBarFill} ${styles.peerBarFillOther}`}
              style={{ width: `${peerPct}%` }}
            />
          </div>
        </div>
      </div>
      <div className={styles.peerNote}>
        <span aria-hidden className={styles.peerNoteIcon}>
          ⌛
        </span>
        <span>또래 평균 데이터를 모으는 중이에요</span>
      </div>
    </section>
  )
}

function MotionListCard({
  motions,
  selectedId,
  onSelect,
  isLoading,
}: {
  motions: ExerciseMotion[]
  selectedId: number | null
  onSelect: (id: number) => void
  isLoading: boolean
}) {
  return (
    <section className={styles.motionListCard}>
      <h3 className={styles.cardTitle}>동작 리스트</h3>
      {isLoading ? (
        <div className={styles.motionListEmpty}>불러오는 중...</div>
      ) : motions.length === 0 ? (
        <div className={styles.motionListEmpty}>등록된 동작이 없어요</div>
      ) : (
        <ul className={styles.motionList}>
          {motions.map(motion => {
            const active = motion.id === selectedId
            return (
              <li key={motion.id}>
                <button
                  type="button"
                  onClick={() => onSelect(motion.id)}
                  className={`${styles.motionItem} ${active ? styles.motionItemActive : ''}`}
                  aria-current={active ? 'true' : undefined}
                >
                  <span className={styles.motionOrder}>{motion.routineOrder}</span>
                  <span className={styles.motionName}>{motion.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
