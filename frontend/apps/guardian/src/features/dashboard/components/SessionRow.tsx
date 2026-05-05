import { RECENT_SESSIONS } from '../data/mock'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { ScoreRing } from './ScoreRing'
import styles from './SessionRow.module.css'

export function SessionRow() {
  return (
    <div className={styles.row}>
      <section className={styles.recent}>
        <span className={styles.recentTitle}>최근 세션</span>
        <button type="button" className={styles.recentArrow} aria-label="이전 세션">
          <ChevronLeftIcon className={styles.recentArrowIcon} />
        </button>
        <div className={styles.recentList}>
          {RECENT_SESSIONS.map(s => {
            const ringFrom = s.isToday ? '#a892ff' : '#cfc7e8'
            const ringTo = s.isToday ? '#7c5cff' : '#a39cbf'
            return (
              <button
                key={s.id}
                type="button"
                className={`${styles.session} ${s.isToday ? styles.sessionToday : ''}`}
              >
                <span className={styles.sessionLabel}>
                  <span
                    className={`${styles.sessionDate} ${s.isToday ? styles.sessionTodayLabel : ''}`}
                  >
                    {s.shortDate}
                  </span>
                  <span className={styles.sessionWeekday}>{s.weekday}</span>
                </span>
                <ScoreRing
                  value={s.score}
                  size={36}
                  strokeWidth={4}
                  fontSize={11}
                  showUnit={false}
                  gradientFrom={ringFrom}
                  gradientTo={ringTo}
                />
              </button>
            )
          })}
        </div>
        <button type="button" className={styles.recentArrow} aria-label="다음 세션">
          <ChevronRightIcon className={styles.recentArrowIcon} />
        </button>
      </section>
    </div>
  )
}
