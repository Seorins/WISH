import { useState } from 'react'
import { MOVEMENTS } from '../data/mock'
import { MOTION_CLIPS } from '../data/motionClips'
import { Character3D } from './Character3D'
import { ChevronDownIcon } from './icons'
import { ScoreRing } from './ScoreRing'
import styles from './MovementProgressCard.module.css'

const COLLAPSED_COUNT = 3

export function MovementProgressCard() {
  const [expanded, setExpanded] = useState(true)
  const [activeMotionId, setActiveMotionId] = useState<string | null>(null)

  const scoreColor = (score: number) => {
    if (score >= 90) return { from: '#6ddec0', to: '#34c99c' }
    if (score >= 80) return { from: '#a892ff', to: '#7c5cff' }
    return { from: '#7cc7ff', to: '#5b9eff' }
  }

  const visible = expanded ? MOVEMENTS : MOVEMENTS.slice(0, COLLAPSED_COUNT)
  const canExpand = MOVEMENTS.length > COLLAPSED_COUNT

  const activeClip = activeMotionId ? (MOTION_CLIPS[activeMotionId] ?? null) : null

  const toggleMotion = (id: string) => {
    setActiveMotionId(prev => (prev === id ? null : id))
  }

  return (
    <article className={styles.card}>
      <div className={styles.sessionToggle}>
        <span className={styles.sessionLabel}>오늘 수행 동작</span>
      </div>

      <div className={`${styles.leftCol} ${!expanded ? styles.leftColCollapsed : ''}`}>
        <div className={styles.list}>
          {visible.map(m => {
            const { from, to } = scoreColor(m.score)
            const isActive = activeMotionId === m.id
            return (
              <button
                key={m.id}
                type="button"
                className={`${styles.row} ${isActive ? styles.rowActive : ''}`}
                onClick={() => toggleMotion(m.id)}
                aria-pressed={isActive}
              >
                <div className={styles.thumb} aria-hidden>
                  <img src={m.thumbnail} alt="" />
                </div>
                <span className={styles.rowName}>{m.name}</span>
                <ScoreRing
                  value={m.score}
                  size={52}
                  strokeWidth={5.5}
                  fontSize={17}
                  gradientFrom={from}
                  gradientTo={to}
                />
              </button>
            )
          })}
        </div>

        {canExpand && (
          <button
            type="button"
            className={styles.viewAll}
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
          >
            {expanded ? '접기' : '전체 동작 보기'}
            <ChevronDownIcon
              className={`${styles.viewAllChev} ${expanded ? styles.viewAllChevOpen : ''}`}
            />
          </button>
        )}
      </div>

      <div className={styles.rightCol}>
        <div className={styles.ghost} aria-hidden />
        <div className={styles.stage}>
          <Character3D activeMotion={activeClip} />
        </div>
      </div>
    </article>
  )
}
