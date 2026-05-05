import { useState } from 'react'
import { ClipboardIcon, ExerciseIcon, GoalIcon, HistoryIcon, HomeIcon, SettingsIcon } from './icons'
import styles from './Sidebar.module.css'

type NavId = 'overview' | 'sessions' | 'history' | 'exercises' | 'goals'

const NAV_ITEMS: ReadonlyArray<{ id: NavId; label: string; Icon: typeof HomeIcon }> = [
  { id: 'overview', label: 'Overview', Icon: HomeIcon },
  { id: 'sessions', label: 'Sessions', Icon: ClipboardIcon },
  { id: 'history', label: 'History', Icon: HistoryIcon },
  { id: 'exercises', label: 'Exercises', Icon: ExerciseIcon },
  { id: 'goals', label: 'Goals', Icon: GoalIcon },
]

export function Sidebar() {
  const [active, setActive] = useState<NavId>('overview')

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand} aria-label="WISH" />
      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = id === active
          return (
            <button
              key={id}
              type="button"
              className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
              onClick={() => setActive(id)}
            >
              <span className={styles.iconWrap}>
                <Icon />
              </span>
              {label}
            </button>
          )
        })}
      </nav>
      <div className={styles.bottom}>
        <button type="button" className={styles.item}>
          <span className={styles.iconWrap}>
            <SettingsIcon />
          </span>
          Settings
        </button>
      </div>
    </aside>
  )
}
