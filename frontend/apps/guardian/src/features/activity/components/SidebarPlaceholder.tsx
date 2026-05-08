import gisungImg from '@/assets/gisung.png'
import rumiImg from '@/assets/rumi.png'
import seokjaeImg from '@/assets/seokjae.png'
import styles from './SidebarPlaceholder.module.css'

type ActivityStatus = 'done' | 'planned'

type ActivityItem = {
  id: string
  name: string
  status: ActivityStatus
  avatarUrl: string
}

const STATUS_LABEL: Record<ActivityStatus, string> = {
  done: '완료',
  planned: '예정',
}

const STATUS_CLASS: Record<ActivityStatus, string> = {
  done: 'statusDone',
  planned: 'statusPlanned',
}

const PLACEHOLDER_ITEMS: ActivityItem[] = [
  { id: 'music', name: '음악', status: 'done', avatarUrl: gisungImg },
  { id: 'art', name: '미술', status: 'planned', avatarUrl: rumiImg },
  { id: 'taekwondo', name: '태권도', status: 'planned', avatarUrl: seokjaeImg },
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
              <span className={styles.avatar} aria-hidden>
                <img src={item.avatarUrl} alt="" className={styles.avatarImg} />
              </span>
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
