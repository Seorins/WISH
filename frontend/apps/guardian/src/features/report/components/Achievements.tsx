import type { GameAchievement } from '../data/types'
import styles from './Sections.module.css'

type Props = {
  achievements: GameAchievement[]
}

export function Achievements({ achievements }: Props) {
  return (
    <article className={styles.card} aria-label="게임별 성취">
      <header className={styles.cardHead}>
        <h3 className={styles.cardTitle}>게임별 성취</h3>
      </header>
      <div className={styles.achievementList}>
        {achievements.map(a => (
          <div key={a.gameId} className={styles.achievementCard}>
            {a.highlight && <span className={styles.achievementHighlight}>⭐ {a.highlight}</span>}
            <div className={styles.achievementHead}>
              <span className={styles.achievementEmoji} aria-hidden>
                {a.emoji}
              </span>
              <span className={styles.achievementName}>{a.label}</span>
            </div>
            <span className={styles.achievementStat}>
              평균 정확도 <span className={styles.achievementStatStrong}>{a.averageAccuracy}%</span>
            </span>
            <span className={styles.achievementStat}>
              베스트 <span className={styles.achievementStatStrong}>{a.bestRecord}</span>
            </span>
            <span className={styles.achievementStat}>가장 많이 한: {a.topContent}</span>
          </div>
        ))}
      </div>
    </article>
  )
}
