import styles from './SidebarPlaceholder.module.css'

type ActivityStatus = 'done' | 'planned'

type ActivityItem = {
  id: string
  name: string
  status: ActivityStatus
  /** 후속 PR 에서 캐릭터 이미지 URL 로 교체 */
  avatarPlaceholderColor: string
}

const STATUS_LABEL: Record<ActivityStatus, string> = {
  done: '완료',
  planned: '예정',
}

const STATUS_CLASS: Record<ActivityStatus, string> = {
  done: 'statusDone',
  planned: 'statusPlanned',
}

// 활동별 캐릭터 이미지가 디자인에서 나오면 avatarUrl 로 교체
const PLACEHOLDER_ITEMS: ActivityItem[] = [
  { id: 'music', name: '음악', status: 'done', avatarPlaceholderColor: '#e3dcff' },
  { id: 'art', name: '미술', status: 'planned', avatarPlaceholderColor: '#fff1e1' },
  { id: 'pe', name: '체육', status: 'planned', avatarPlaceholderColor: '#d4f3e5' },
]

/**
 * "오늘 한 활동" 사이드.
 * 대화 페이지의 CharacterSidebar 와 동일한 카드/리스트 포맷.
 * 후속 티켓에서 캐릭터 이미지 + 활동 데이터 연동.
 */
export function SidebarPlaceholder() {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>오늘 한 활동</h3>
      <div className={styles.list}>
        {PLACEHOLDER_ITEMS.map(item => {
          const isActive = item.status === 'done'
          return (
            <button
              key={item.id}
              type="button"
              className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
            >
              <span
                className={styles.avatar}
                style={{ background: item.avatarPlaceholderColor }}
                aria-hidden
              />
              <span className={styles.meta}>
                <span className={styles.name}>{item.name}</span>
                <span className={`${styles.status} ${styles[STATUS_CLASS[item.status]]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </span>
              {isActive && <span className={styles.check}>✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
