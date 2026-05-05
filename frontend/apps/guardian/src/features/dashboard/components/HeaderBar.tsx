import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logoUrl from '@/assets/logo.png'
import { useAuthStore } from '@/shared/auth/store'
import { PATIENT } from '../data/mock'
import {
  ActivityIcon,
  BellIcon,
  ChatIcon,
  ChevronDownIcon,
  ClipboardIcon,
  ExerciseIcon,
  LogoutIcon,
  type HomeIcon,
} from './icons'
import styles from './HeaderBar.module.css'

type TabId = 'exercise' | 'chat' | 'activity' | 'reports'

const TABS: ReadonlyArray<{ id: TabId; label: string; Icon: typeof HomeIcon }> = [
  { id: 'exercise', label: '운동', Icon: ExerciseIcon },
  { id: 'chat', label: '대화', Icon: ChatIcon },
  { id: 'activity', label: '활동', Icon: ActivityIcon },
  { id: 'reports', label: '리포트', Icon: ClipboardIcon },
]

export function HeaderBar() {
  const [active, setActive] = useState<TabId>('exercise')
  const [menuOpen, setMenuOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const clearAuth = useAuthStore(s => s.clear)

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  const handleLogout = () => {
    setMenuOpen(false)
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <header className={styles.header}>
      <Link to="/" className={styles.brand} aria-label="대시보드로 이동">
        <img src={logoUrl} alt="WISH" className={styles.brandLogo} />
      </Link>

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
        <button type="button" className={styles.iconBtn} aria-label="알림">
          <BellIcon width={20} height={20} />
          <span className={styles.bellDot} />
        </button>
        <div className={styles.profileWrap} ref={profileRef}>
          <button
            type="button"
            className={styles.profile}
            onClick={() => setMenuOpen(open => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className={styles.avatar}>
              <img src={PATIENT.avatarUrl} alt="" />
            </span>
            <span className={styles.profileText}>
              <span className={styles.profileName}>{PATIENT.name}</span>
              <span className={styles.profileMeta}>{PATIENT.age}세</span>
            </span>
            <ChevronDownIcon className={`${styles.chev} ${menuOpen ? styles.chevOpen : ''}`} />
          </button>
          {menuOpen && (
            <div className={styles.menu} role="menu">
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={handleLogout}
              >
                <LogoutIcon className={styles.menuItemIcon} />
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
