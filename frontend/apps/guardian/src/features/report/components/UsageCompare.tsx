import type { UsageCompare as UsageCompareType } from '../data/types'
import styles from './Sections.module.css'

type Props = {
  usage: UsageCompareType
  daysElapsed: number
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

function frameMessage(self: number, others: number): string {
  const diff = self - others
  if (diff > 10) {
    return `다른 친구들보다 ${formatMinutes(Math.abs(diff))} 더 함께했어요 ✨`
  }
  if (diff < -10) {
    return `다른 친구들보다 조금 적었어요. 다음 주엔 함께 도전해볼까요?`
  }
  return `다른 친구들과 비슷한 시간을 보내고 있어요`
}

export function UsageCompare({ usage, daysElapsed }: Props) {
  const dailyAvg = daysElapsed > 0 ? Math.round(usage.selfMinutes / daysElapsed) : 0
  const hasSample = usage.sampleSize >= usage.minSample
  const maxValue = Math.max(usage.selfMinutes, usage.othersAverageMinutes, 1)
  const selfPct = (usage.selfMinutes / maxValue) * 100
  const otherPct = (usage.othersAverageMinutes / maxValue) * 100

  return (
    <article className={styles.card} aria-label="사용 시간 비교">
      <header className={styles.cardHead}>
        <h3 className={styles.cardTitle}>사용 시간</h3>
      </header>

      <div className={styles.usageHead}>
        <div className={styles.usageBig}>
          <span>
            <span className={styles.usageBigValue}>{formatMinutes(usage.selfMinutes)}</span>
          </span>
          <span className={styles.usageBigSub}>하루 평균 {dailyAvg}분</span>
        </div>
      </div>

      {hasSample ? (
        <>
          <div className={styles.usageBars}>
            <div className={styles.usageBarRow}>
              <span className={styles.usageBarLabel}>우리 아이</span>
              <div className={styles.usageBarTrack}>
                <div
                  className={`${styles.usageBarFill} ${styles.usageBarFillSelf}`}
                  style={{ width: `${selfPct}%` }}
                />
              </div>
              <span className={styles.usageBarValue}>{formatMinutes(usage.selfMinutes)}</span>
            </div>
            <div className={styles.usageBarRow}>
              <span className={`${styles.usageBarLabel} ${styles.usageBarLabelMuted}`}>
                다른 친구들 평균
              </span>
              <div className={styles.usageBarTrack}>
                <div
                  className={`${styles.usageBarFill} ${styles.usageBarFillOther}`}
                  style={{ width: `${otherPct}%` }}
                />
              </div>
              <span className={styles.usageBarValue}>
                {formatMinutes(usage.othersAverageMinutes)}
              </span>
            </div>
          </div>
          <div className={styles.usageFrame}>
            {frameMessage(usage.selfMinutes, usage.othersAverageMinutes)}
          </div>
        </>
      ) : (
        <div className={styles.usageGuard}>
          비교할 친구 수가 아직 모이지 않았어요.
          <br />
          조금 더 시간이 지나면 평균이 표시돼요.
        </div>
      )}
    </article>
  )
}
