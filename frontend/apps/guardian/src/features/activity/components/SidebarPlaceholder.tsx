import type { CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import gisungImg from '@/assets/gisung.png'
import rumiImg from '@/assets/rumi.png'
import seokjaeImg from '@/assets/seokjae.png'
import sungsuImg from '@/assets/sungsu.png'
import { useMyPatientId } from '@/features/auth/hooks/useMyPatientId'
import { useDailyUsageStats } from '@/features/activity/hooks'
import styles from './SidebarPlaceholder.module.css'

type ActivityStatus = 'done' | 'pending'
type ActivityItemId = 'music' | 'art' | 'taekwondo' | 'gymnastics'

type ActivityItem = {
  id: ActivityItemId
  name: string
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
  pending: '활동 없음',
}

const STATUS_CLASS: Record<ActivityStatus, string> = {
  done: 'statusDone',
  pending: 'statusNone',
}

// 각 캐릭터 일러스트가 전신 비율이라 scale + translateY 로 상반신만 크롭.
// 캐릭터별로 디테일 다르면 thumbScale/thumbOffsetY 로 미세조정.
const ACTIVITY_ITEMS: ActivityItem[] = [
  {
    id: 'music',
    name: '음악',
    avatarUrl: gisungImg,
    thumbScale: '1.5',
    thumbOffsetY: '-6%',
    to: '/activity',
  },
  {
    id: 'art',
    name: '미술',
    avatarUrl: rumiImg,
    thumbScale: '1.5',
    thumbOffsetY: '-8%',
    to: '/activity?tab=art',
  },
  {
    id: 'taekwondo',
    name: '태권도',
    avatarUrl: seokjaeImg,
    thumbScale: '1.5',
    thumbOffsetY: '-6%',
    to: '/activity?tab=taekwondo',
  },
  {
    id: 'gymnastics',
    name: '체조',
    avatarUrl: sungsuImg,
    thumbScale: '1.5',
    thumbOffsetY: '-6%',
    to: '/activity?tab=gymnastics',
  },
]

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function resolveActiveItemId(searchParams: URLSearchParams): ActivityItemId | null {
  const tab = searchParams.get('tab')
  if (tab === 'art') return 'art'
  if (tab === 'taekwondo') return 'taekwondo'
  if (tab === 'gymnastics') return 'gymnastics'
  // 기본 진입(/activity)과 ?id= 딥링크 모두 음악으로 간주.
  return 'music'
}

/**
 * "오늘 한 활동" 사이드. 각 활동은 오늘 사용 시간이 0초보다 크면 '완료', 아니면 '아직'.
 * 사용 시간은 UsageStat 일별 응답에서 컨텐츠별 초 값을 그대로 본다.
 */
export function SidebarPlaceholder() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeItemId = resolveActiveItemId(searchParams)

  const { data: patientId } = useMyPatientId()
  const today = todayIsoDate()
  const { data: daily } = useDailyUsageStats(patientId ?? undefined, { from: today, to: today })
  const todayItem = daily?.items?.find(item => item.date === today)

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>오늘 한 활동</h3>
      <div className={styles.list}>
        {ACTIVITY_ITEMS.map(item => {
          const isSelected = activeItemId === item.id
          const isClickable = item.to != null
          // UsageStat 의 컨텐츠 키: music/art/taekwondo/gymnastics (sec). 0 초과면 '완료'.
          const seconds = todayItem ? (todayItem[item.id] ?? 0) : 0
          const status: ActivityStatus = seconds > 0 ? 'done' : 'pending'
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
                <span className={`${styles.status} ${styles[STATUS_CLASS[status]]}`}>
                  {STATUS_LABEL[status]}
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
