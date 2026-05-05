import { useMemo, useState } from 'react'
import { MOVEMENTS, type MovementCategory, type SessionView } from '../data/mock'
import { Character3D } from './Character3D'
import { ChevronRightIcon, SparkleIcon } from './icons'
import { ScoreRing } from './ScoreRing'
import styles from './MovementProgressCard.module.css'

const CATEGORIES: ReadonlyArray<{ id: MovementCategory; label: string }> = [
  { id: 'all', label: 'All Movements' },
  { id: 'upper', label: 'Upper Body' },
  { id: 'lower', label: 'Lower Body' },
  { id: 'balance', label: 'Balance' },
  { id: 'flexibility', label: 'Flexibility' },
]

export function MovementProgressCard() {
  const [category, setCategory] = useState<MovementCategory>('all')
  const [session, setSession] = useState<SessionView>('current')

  const filtered = useMemo(
    () => (category === 'all' ? MOVEMENTS : MOVEMENTS.filter(m => m.category === category)),
    [category],
  )

  const scoreColor = (score: number) => {
    if (score >= 90) return { from: '#6ddec0', to: '#34c99c' }
    if (score >= 80) return { from: '#a892ff', to: '#7c5cff' }
    return { from: '#7cc7ff', to: '#5b9eff' }
  }

  return (
    <article className={styles.card}>
      <header className={styles.headRow}>
        <h2 className={styles.title}>
          Movement
          <br />
          Progress
          <SparkleIcon className={styles.titleSparkle} />
        </h2>
        <p className={styles.tagline}>
          Track, understand, and celebrate
          <br />
          every step of your progress.
        </p>
      </header>

      <div className={styles.leftCol}>
        <div className={styles.chips} role="tablist">
          {CATEGORIES.map(({ id, label }) => {
            const isActive = id === category
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${styles.chip} ${isActive ? styles.chipActive : ''}`}
                onClick={() => setCategory(id)}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className={styles.list}>
          {filtered.map(m => {
            const { from, to } = scoreColor(m.score)
            return (
              <div key={m.id} className={styles.row}>
                <div className={styles.thumb} aria-hidden>
                  {m.thumbnail}
                </div>
                <span className={styles.rowName}>{m.name}</span>
                <ScoreRing
                  value={m.score}
                  size={50}
                  strokeWidth={5}
                  fontSize={15}
                  gradientFrom={from}
                  gradientTo={to}
                />
              </div>
            )
          })}
        </div>

        <button type="button" className={styles.viewAll}>
          View All Movements
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
            Current Session
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${session === 'previous' ? styles.toggleBtnActive : ''}`}
            onClick={() => setSession('previous')}
          >
            Previous Session
          </button>
        </div>
      </div>
    </article>
  )
}
