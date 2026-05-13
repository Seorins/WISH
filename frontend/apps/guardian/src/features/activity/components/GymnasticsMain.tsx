import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { listExerciseMotions, type ExerciseMotion, type ExerciseType } from '@wish/api-client'
import { useMyPatientId } from '@/features/auth/hooks/useMyPatientId'
import { useDailyUsageStats, usePatientExerciseSessions, useUsageAverages } from '../hooks'
import { aggregateExerciseMotionStats, type MotionStats } from '../utils/aggregateMotionStats'
import { ActivityEmptyState } from './ActivityEmptyState'
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

function dateKstFromIso(iso: string): string {
  const localDate = iso.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(iso)
  if (localDate && !hasTimezone) return localDate
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
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
 * 좌측 영상은 오늘 기록 중 가장 최근 수행본(`latestVideoUrl`)만 사용한다.
 * 영상이 없는 동작은 시범영상으로 폴백하지 않고 빈 상태를 표시한다.
 */
export function GymnasticsMain() {
  const { data: patientId } = useMyPatientId()
  const today = todayKst()
  const { data: daily } = useDailyUsageStats(patientId ?? undefined, { from: today, to: today })
  const todayGymSeconds = daily?.items[0]?.gymnastics ?? 0
  const { data: averages } = useUsageAverages({ from: today, to: today })
  const peerGym = averages?.contentAverages.find(c => c.contentType === 'GYMNASTICS')

  const [exerciseType, setExerciseType] = useState<ExerciseType>(DEFAULT_EXERCISE_TYPE)
  const { data: motions = [], isLoading, error } = useExerciseMotions(exerciseType)

  // 환아별 세션 상세를 가져와 같은 운동 종류의 motion별 통계를 집계한다.
  const { data: exerciseSessions = [] } = usePatientExerciseSessions(patientId ?? undefined, {
    exerciseType,
    size: 100,
  })
  const todaySessions = useMemo(() => {
    return exerciseSessions.filter(session => dateKstFromIso(session.createdAt) === today)
  }, [exerciseSessions, today])
  const motionStatsMap = useMemo(() => aggregateExerciseMotionStats(todaySessions), [todaySessions])
  const latestTodayMotionId = useMemo(() => {
    const latestMotion = todaySessions
      .flatMap(session =>
        session.motions.map(motion => ({
          motionId: motion.exerciseMotionId,
          playedAt: motion.createdAt,
          videoUrl: motion.videoUrl,
        })),
      )
      .filter(motion => Boolean(motion.videoUrl))
      .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())[0]

    return latestMotion?.motionId ?? null
  }, [todaySessions])
  const hasRecordedSessions = todaySessions.length > 0

  const sortedMotions = useMemo<ExerciseMotion[]>(() => {
    return [...motions].sort((a, b) => a.routineOrder - b.routineOrder)
  }, [motions])

  const [selectedMotionId, setSelectedMotionId] = useState<number | null>(null)

  // 운동 종류 변경 시 오늘 수행 영상이 있는 최신 동작을 우선 선택한다.
  useEffect(() => {
    if (sortedMotions.length === 0) {
      setSelectedMotionId(null)
      return
    }
    setSelectedMotionId(prev => {
      if (latestTodayMotionId != null && sortedMotions.some(m => m.id === latestTodayMotionId)) {
        return latestTodayMotionId
      }
      if (prev != null && sortedMotions.some(m => m.id === prev)) return prev
      return sortedMotions[0].id
    })
  }, [latestTodayMotionId, sortedMotions])

  const selectedMotion = sortedMotions.find(m => m.id === selectedMotionId) ?? null
  const selectedStats = selectedMotion ? motionStatsMap[selectedMotion.id] : undefined

  const dailyLoaded = daily !== undefined
  const noActivityToday = dailyLoaded && todayGymSeconds === 0 && !hasRecordedSessions

  if (noActivityToday) {
    return (
      <ActivityEmptyState
        icon="🤸"
        title="오늘 체조 활동 기록이 없어요"
        description="아이가 체조방에서 동작을 따라하면 여기에 결과가 표시돼요"
      />
    )
  }

  return (
    <div className={styles.layout}>
      <div className={styles.mainColumn}>
        <ExerciseTypeTabBar value={exerciseType} onChange={setExerciseType} />

        {isLoading ? (
          <ActivityEmptyState variant="loading" icon="🤸" title="동작을 불러오는 중..." />
        ) : error ? (
          <ActivityEmptyState
            variant="error"
            icon="⚠️"
            title="동작을 불러오지 못했어요"
            description="잠시 후 다시 시도해주세요"
          />
        ) : !selectedMotion ? (
          <ActivityEmptyState
            icon="🤸"
            title="아직 등록된 동작이 없어요"
            description="이 종목에 새로운 동작이 추가되면 여기에 표시돼요"
          />
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
        <PeerCompareCard
          mineSeconds={todayGymSeconds}
          peerSeconds={peerGym?.averageSeconds ?? null}
          activePatients={averages?.activePatients ?? 0}
        />
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
  const videoUrl = stats?.latestVideoUrl ?? null
  const hasVideo = Boolean(videoUrl)
  return (
    <section className={styles.videoCard}>
      <div className={styles.videoFrame}>
        {hasVideo ? (
          <video
            key={`${motion.id}-${videoUrl}`}
            className={styles.video}
            src={videoUrl ?? undefined}
            poster={stats?.latestThumbUrl ?? undefined}
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

function PeerCompareCard({
  mineSeconds,
  peerSeconds,
  activePatients,
}: {
  mineSeconds: number
  peerSeconds: number | null
  activePatients: number
}) {
  const hasPeer = peerSeconds != null && activePatients > 0
  const peerValue = hasPeer ? peerSeconds : 0

  const max = Math.max(mineSeconds, peerValue, 1)
  const minePct = (mineSeconds / max) * 100
  const peerPct = hasPeer ? (peerValue / max) * 100 : 0
  const peerLabel = hasPeer ? formatDurationSec(peerValue) : '집계 중'

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
      {!hasPeer && (
        <div className={styles.peerNote}>
          <span aria-hidden className={styles.peerNoteIcon}>
            ⌛
          </span>
          <span>또래 평균 데이터를 모으는 중이에요</span>
        </div>
      )}
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
