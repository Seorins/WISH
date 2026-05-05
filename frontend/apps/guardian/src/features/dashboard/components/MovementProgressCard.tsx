import { useState } from 'react'
import { MOVEMENTS, type SessionView } from '../data/mock'
import { Character3D } from './Character3D'
import { ChevronRightIcon, SparkleIcon } from './icons'
import { ScoreRing } from './ScoreRing'
import styles from './MovementProgressCard.module.css'

export function MovementProgressCard() {
  const [session, setSession] = useState<SessionView>('current')

  const scoreColor = (score: number) => {
    if (score >= 90) return { from: '#6ddec0', to: '#34c99c' }
    if (score >= 80) return { from: '#a892ff', to: '#7c5cff' }
    return { from: '#7cc7ff', to: '#5b9eff' }
  }

  return (
    <article className={styles.card}>
      <header className={styles.headRow}>
        <h2 className={styles.title}>
          동작 진행도
          <SparkleIcon className={styles.titleSparkle} />
        </h2>
        <p className={styles.tagline}>매 진전을 추적하고, 이해하며, 함께 축하해요.</p>
      </header>

      <div className={styles.leftCol}>
        <div className={styles.list}>
          {MOVEMENTS.map(m => {
            const { from, to } = scoreColor(m.score)
            return (
              <div key={m.id} className={styles.row}>
                <div className={styles.thumb} aria-hidden>
                  <img src={m.thumbnail} alt="" />
                </div>
                <span className={styles.rowName}>{m.name}</span>
                <ScoreRing
                  value={m.score}
                  size={46}
                  strokeWidth={5}
                  fontSize={14}
                  gradientFrom={from}
                  gradientTo={to}
                />
              </div>
            )
          })}
        </div>

        <button type="button" className={styles.viewAll}>
          전체 동작 보기
          <ChevronRightIcon className={styles.viewAllChev} />
        </button>
      </div>

      <div className={styles.rightCol}>
        <div className={styles.ghost} aria-hidden />
        <div className={styles.stage}>
          <Character3D />
        </div>
      </div>

      <div className={styles.sessionToggle}>
        <div className={styles.toggleInner}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${session === 'current' ? styles.toggleBtnActive : ''}`}
            onClick={() => setSession('current')}
          >
            현재 세션
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${session === 'previous' ? styles.toggleBtnActive : ''}`}
            onClick={() => setSession('previous')}
          >
            이전 세션
          </button>
        </div>
      </div>
    </article>
  )
}
