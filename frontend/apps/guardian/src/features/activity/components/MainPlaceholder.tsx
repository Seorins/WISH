import type { ChartStats, MusicResultDetail } from '@wish/api-client'
import styles from './MainPlaceholder.module.css'

type Props = {
  result: MusicResultDetail
  chartStats?: ChartStats
}

const TONE_CLASS = {
  perfect: styles.chipPerfect,
  great: styles.chipGreat,
  good: styles.chipGood,
  miss: styles.chipMiss,
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0초'
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds}초`
  if (seconds === 0) return `${minutes}분`
  return `${minutes}분 ${seconds}초`
}

function formatScore(score: number): string {
  return `${score.toLocaleString('ko-KR')}점`
}

function formatTimeOfDay(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
}

function rankLabel(rank: string): string {
  return rank === 'D' ? '연습 중' : `${rank}등급`
}

function accuracyMessage(accuracy: number): { headline: string; sub: string; emoji: string } {
  if (accuracy >= 0.95)
    return { headline: '완벽한 박자였어요!', sub: '정확도가 매우 높아요.', emoji: '🤩' }
  if (accuracy >= 0.85)
    return { headline: '박자를 잘 맞췄어요!', sub: '정확도가 높아요.', emoji: '😊' }
  if (accuracy >= 0.7)
    return { headline: '리듬을 잘 따라갔어요.', sub: '조금만 더 정확하게!', emoji: '🙂' }
  if (accuracy >= 0.5)
    return { headline: '꾸준히 따라갔어요.', sub: '연습하면 더 좋아져요.', emoji: '🙂' }
  return { headline: '리듬에 익숙해지는 중.', sub: '함께 한 번 더 도전해봐요.', emoji: '🤍' }
}

export function MainPlaceholder({ result, chartStats }: Props) {
  const playedDurationLabel = formatDuration(result.playedDurationMs)
  const othersAvgMs = chartStats?.averagePlayedDurationMs ?? 0
  const hasOthersAvg = othersAvgMs > 0
  const othersAvgLabel = hasOthersAvg ? formatDuration(othersAvgMs) : '집계 중'
  const maxBarMs = Math.max(result.playedDurationMs, othersAvgMs, 1)
  const mineBarPct = Math.round((result.playedDurationMs / maxBarMs) * 100)
  const othersBarPct = hasOthersAvg ? Math.round((othersAvgMs / maxBarMs) * 100) : 0
  const diffMinutes = hasOthersAvg
    ? Math.round((result.playedDurationMs - othersAvgMs) / 60_000)
    : 0

  const message = accuracyMessage(result.accuracy)

  const stats = [
    { id: 'song', icon: '🎵', label: '선택한 노래', value: result.chartTitle },
    { id: 'time', icon: '🕐', label: '플레이 시간', value: playedDurationLabel },
    { id: 'score', icon: '⭐', label: '점수', value: formatScore(result.score) },
    { id: 'rank', icon: '🏆', label: '활동 결과', value: rankLabel(result.rank) },
  ] as const

  const chips = [
    {
      id: 'perfect',
      label: 'Perfect',
      value: result.perfectCount,
      tone: 'perfect' as const,
    },
    {
      id: 'great',
      label: 'Great',
      value: result.greatCount ?? 0,
      tone: 'great' as const,
    },
    { id: 'good', label: 'Good', value: result.goodCount, tone: 'good' as const },
    { id: 'miss', label: 'Miss', value: result.missCount, tone: 'miss' as const },
  ]

  return (
    <>
      <section className={styles.heroCard}>
        <header className={styles.heroHeader}>
          <h2 className={styles.heroTitle}>활동 결과</h2>
        </header>
        <div className={styles.heroBody}>
          <div className={styles.media} aria-label="활동 영상 영역">
            {result.videoUrl ? (
              <video
                className={styles.video}
                src={result.videoUrl}
                poster={result.thumbUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
              />
            ) : null}
          </div>
          <div className={styles.heroMeta}>
            <span className={styles.tag}>음악실</span>
            <h3 className={styles.songTitle}>{result.chartTitle}</h3>
            <div className={styles.timeRow}>
              <span aria-hidden>🕐</span>
              <span>{formatTimeOfDay(result.playedAt)}</span>
              <span aria-hidden className={styles.dot}>
                ·
              </span>
              <span>{playedDurationLabel}</span>
            </div>
            <p className={styles.description}>리듬에 맞춰 노트를 따라치며 연주했어요.</p>
          </div>
        </div>
      </section>

      <section className={styles.statRow}>
        {stats.map(stat => (
          <div key={stat.id} className={styles.statCard}>
            <span className={styles.statIcon} aria-hidden>
              {stat.icon}
            </span>
            <div className={styles.statBody}>
              <span className={styles.statLabel}>{stat.label}</span>
              <span className={styles.statValue}>{stat.value}</span>
            </div>
          </div>
        ))}
      </section>

      <section className={styles.accuracyCard}>
        <div className={styles.accuracyMeta}>
          <h4 className={styles.accuracyTitle}>리듬 정확도</h4>
          <span className={styles.accuracySub}>{Math.round(result.accuracy * 100)}%</span>
          <p className={styles.accuracyMessage}>
            <span aria-hidden className={styles.accuracyIcon}>
              {message.emoji}
            </span>
            <span>
              <strong>{message.headline}</strong>
              <br />
              {message.sub}
            </span>
          </p>
        </div>
        <div className={styles.chipRow}>
          {chips.map(chip => (
            <div key={chip.id} className={`${styles.chip} ${TONE_CLASS[chip.tone]}`}>
              <span className={styles.chipLabel}>{chip.label}</span>
              <span className={styles.chipValue}>{chip.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.peerCard}>
        <div className={styles.peerLabel}>
          <span className={styles.peerIcon} aria-hidden>
            👥
          </span>
          <div className={styles.peerLabelText}>
            <strong>다른 사용자들과 비교</strong>
            <span>
              {hasOthersAvg
                ? diffMinutes > 0
                  ? `평균보다 ${diffMinutes}분 더 참여했어요.`
                  : diffMinutes < 0
                    ? `평균보다 ${Math.abs(diffMinutes)}분 짧게 참여했어요.`
                    : '평균과 비슷한 시간 참여했어요.'
                : '평균 데이터를 모으는 중이에요.'}
            </span>
          </div>
        </div>
        <div className={styles.peerBars}>
          <div className={styles.peerSide}>
            <div className={styles.peerSideHead}>
              <span className={styles.peerSideLabel}>다른 사용자들 평균</span>
              <strong className={styles.peerSideValue}>{othersAvgLabel}</strong>
            </div>
            <div className={`${styles.peerBar} ${styles.peerBarOther}`} aria-hidden>
              <div className={styles.peerBarFill} style={{ width: `${othersBarPct}%` }} />
            </div>
          </div>
          <span className={styles.peerVs} aria-hidden>
            VS
          </span>
          <div className={styles.peerSide}>
            <div className={styles.peerSideHead}>
              <span className={styles.peerSideLabel}>우리 아이 플레이 시간</span>
              <strong className={styles.peerSideValue}>{playedDurationLabel}</strong>
            </div>
            <div className={`${styles.peerBar} ${styles.peerBarMine}`} aria-hidden>
              <div className={styles.peerBarFill} style={{ width: `${mineBarPct}%` }} />
            </div>
          </div>
        </div>
        <div className={styles.peerSummary}>
          <span aria-hidden className={styles.peerSummaryIcon}>
            📈
          </span>
          <span>
            {hasOthersAvg && diffMinutes > 0 ? (
              <>
                평균보다
                <br />
                <strong>{diffMinutes}분 더 참여했어요!</strong>
              </>
            ) : (
              <>
                평균
                <br />
                <strong>{othersAvgLabel}</strong>
              </>
            )}
          </span>
        </div>
      </section>
    </>
  )
}
