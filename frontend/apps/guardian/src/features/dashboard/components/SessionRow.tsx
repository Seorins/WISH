import { NEXT_SESSION, RECENT_SESSIONS } from '../data/mock'
import { ArrowRightIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './icons'
import { ScoreRing } from './ScoreRing'
import styles from './SessionRow.module.css'

export function SessionRow() {
  return (
    <div className={styles.row}>
      <section className={styles.recent}>
        <span className={styles.recentTitle}>Recent Sessions</span>
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

      <section className={styles.next}>
        <div className={styles.nextIcon}>
          <CalendarIcon />
        </div>
        <div className={styles.nextBody}>
          <span className={styles.nextLabel}>Next Session</span>
          <span className={styles.nextDate}>
            {NEXT_SESSION.date}
            <span className={styles.nextDateDot} />
            {NEXT_SESSION.time}
          </span>
          <span className={styles.nextType}>{NEXT_SESSION.label}</span>
        </div>
        <button type="button" className={styles.nextCta} aria-label="세션 상세">
          <ArrowRightIcon className={styles.nextCtaIcon} />
        </button>
      </section>
    </div>
  )
}
