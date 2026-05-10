import { WEEKLY_LOG } from '../data/mock'
import { StarIcon } from './icons'
import styles from './WeeklyFuelLogCard.module.css'

const MAX_BAR_AMOUNT = 25

export function WeeklyFuelLogCard() {
  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <span className={styles.title}>이번 주 연료 기록</span>
      </header>

      <ul className={styles.list}>
        {WEEKLY_LOG.map(entry => {
          const fillWidth = `${Math.min(100, (entry.amount / MAX_BAR_AMOUNT) * 100)}%`
          return (
            <li key={`${entry.date}-${entry.label}`} className={styles.row}>
              <span className={styles.rowDate}>{entry.date}</span>
              <span className={styles.rowStar}>
                <StarIcon color={entry.starColor} width={20} height={20} />
              </span>
              <span className={styles.rowLabel}>{entry.label}</span>
              <span className={styles.rowMeta}>
                <span className={styles.rowBar}>
                  <span
                    className={styles.rowBarFill}
                    style={{ width: fillWidth, background: entry.starColor }}
                  />
                </span>
                <span className={styles.rowAmount}>+{entry.amount}%</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
