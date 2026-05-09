import type { CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import gisungImg from '@/assets/gisung.png'
import rumiImg from '@/assets/rumi.png'
import seokjaeImg from '@/assets/seokjae.png'
import styles from './SidebarPlaceholder.module.css'

type ActivityStatus = 'done' | 'planned'
type ActivityItemId = 'music' | 'art' | 'taekwondo'

type ActivityItem = {
  id: ActivityItemId
  name: string
  status: ActivityStatus
  avatarUrl: string
  /** 사이드 썸네일 줌 배율 (기본 1.25). 클수록 상반신 클로즈업 */
  thumbScale?: string
  /** 세로 오프셋 (음수=위로). 예: '-8%' */
  thumbOffsetY?: string
  /** 클릭 시 이동할 경로. 없으면 비활성 버튼 */
  to?: string
}

const STATUS_LABEL: Record<ActivityStatus, string> = {
  done: '완료',
  planned: '예정',
}

const STATUS_CLASS: Record<ActivityStatus, string> = {
  done: 'statusDone',
  planned: 'statusPlanned',
}

// 각 캐릭터 일러스트가 전신 비율이라 scale + translateY 로 상반신만 크롭.
// 캐릭터별로 디테일 다르면 thumbScale/thumbOffsetY 로 미세조정.
const PLACEHOLDER_ITEMS: ActivityItem[] = [
  {
    id: 'music',
    name: '음악',
    status: 'done',
    avatarUrl: gisungImg,
    thumbScale: '1.5',
    thumbOffsetY: '-6%',
    to: '/activity',
  },
  {
    id: 'art',
    name: '미술',
    status: 'done',
    avatarUrl: rumiImg,
    thumbScale: '1.5',
    thumbOffsetY: '-8%',
    to: '/activity?tab=art',
  },
  {
    id: 'taekwondo',
    name: '태권도',
    status: 'planned',
    avatarUrl: seokjaeImg,
    thumbScale: '1.5',
    thumbOffsetY: '-6%',
  },
]

function resolveActiveItemId(searchParams: URLSearchParams): ActivityItemId | null {
  const tab = searchParams.get('tab')
  if (tab === 'art') return 'art'
  if (tab === 'taekwondo') return 'taekwondo'
  // 기본 진입(/activity)과 ?id= 딥링크 모두 음악으로 간주.
  return 'music'
}

/**
 * "오늘 한 활동" 사이드.
 * 대화 페이지의 CharacterSidebar 와 동일한 카드/리스트 포맷.
 * 후속 티켓에서 캐릭터 이미지 + 활동 데이터 연동.
 */
export function SidebarPlaceholder() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeItemId = resolveActiveItemId(searchParams)

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>오늘 한 활동</h3>
      <div className={styles.list}>
        {PLACEHOLDER_ITEMS.map(item => {
          const isSelected = activeItemId === item.id
          const isClickable = item.to != null
          return (
            <button
              key={item.id}
              type="button"
              disabled={!isClickable}
              aria-current={isSelected ? 'page' : undefined}
              onClick={isClickable ? () => navigate(item.to!) : undefined}
              className={`${styles.item} ${isSelected ? styles.itemActive : ''}`}
            >
              <span className={styles.avatar} aria-hidden>
                <img
                  src={item.avatarUrl}
                  alt=""
                  className={styles.avatarImg}
                  style={
                    {
                      ...(item.thumbScale ? { '--thumb-scale': item.thumbScale } : {}),
                      ...(item.thumbOffsetY ? { '--thumb-offset-y': item.thumbOffsetY } : {}),
                    } as CSSProperties
                  }
                />
              </span>
              <span className={styles.meta}>
                <span className={styles.name}>{item.name}</span>
                <span className={`${styles.status} ${styles[STATUS_CLASS[item.status]]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </span>
              {isSelected && <span className={styles.check}>✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
