import { useState } from 'react'
import { PATIENT } from '../data/mock'
import { BellIcon, ChevronDownIcon, ClipboardIcon, ExerciseIcon, GoalIcon, HomeIcon } from './icons'
import styles from './HeaderBar.module.css'

type TabId = 'dashboard' | 'reports' | 'exercises' | 'goals'

const TABS: ReadonlyArray<{ id: TabId; label: string; Icon: typeof HomeIcon }> = [
  { id: 'dashboard', label: '대시보드', Icon: HomeIcon },
  { id: 'reports', label: '리포트', Icon: ClipboardIcon },
  { id: 'exercises', label: '운동', Icon: ExerciseIcon },
  { id: 'goals', label: '목표', Icon: GoalIcon },
]

export function HeaderBar() {
  const [active, setActive] = useState<TabId>('dashboard')

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.brandMark} aria-hidden />
        <div className={styles.brandText}>
          <span className={styles.brandName}>WISH</span>
          <span className={styles.brandTag}>동작 분석</span>
        </div>
      </div>

      <nav className={styles.tabs}>
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active
          return (
            <button
              key={id}
              type="button"
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => setActive(id)}
            >
              <Icon className={styles.tabIcon} />
              {label}
            </button>
          )
        })}
      </nav>

      <div className={styles.right}>
        <button type="button" className={styles.bell} aria-label="알림">
          <BellIcon />
          <span className={styles.bellDot} />
        </button>
        <button type="button" className={styles.profile}>
          <span className={styles.avatar}>
            <img src={PATIENT.avatarUrl} alt="" />
          </span>
          <span className={styles.profileText}>
            <span className={styles.profileName}>{PATIENT.name}</span>
            <span className={styles.profileMeta}>{PATIENT.age}세</span>
          </span>
          <ChevronDownIcon className={styles.chev} />
        </button>
      </div>
    </header>
  )
}
