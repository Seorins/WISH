import { useState } from 'react'
import { MOVEMENTS, type SessionView } from '../data/mock'
import { MOTION_CLIPS } from '../data/motionClips'
import { Character3D } from './Character3D'
import { ChevronDownIcon } from './icons'
import { ScoreRing } from './ScoreRing'
import styles from './MovementProgressCard.module.css'

const COLLAPSED_COUNT = 3

export function MovementProgressCard() {
  const [session, setSession] = useState<SessionView>('current')
  const [expanded, setExpanded] = useState(false)
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

      <div className={styles.leftCol}>
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
