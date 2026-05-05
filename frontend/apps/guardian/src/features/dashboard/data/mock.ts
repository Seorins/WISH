import faceUrl from '@/assets/face.png'
import top1Url from '@/assets/top1.png'
import top2Url from '@/assets/top2.png'
import top3Url from '@/assets/top3.png'
import top4Url from '@/assets/top4.png'
import top5Url from '@/assets/top5.png'

export type Movement = {
  id: string
  name: string
  score: number
  thumbnail: string
}

export type Session = {
  id: string
  date: string
  weekday: string
  shortDate: string
  score: number
  isToday?: boolean
}

export type RangeOfMotion = {
  joint: string
  percent: number
  rating: '좋음' | '우수' | '보완 필요'
  tone: 'mint' | 'lavender' | 'pink' | 'cyan'
}

export type TrendPoint = {
  date: string
  score: number
}

export type SessionView = 'current' | 'previous'

export const PATIENT = {
  name: '김댕동',
  age: 8,
  avatarUrl: faceUrl,
}

export const MOVEMENTS: Movement[] = [
  { id: 'march', name: '제자리 걷기', score: 92, thumbnail: top1Url },
  { id: 'side-step', name: '사이드 스텝', score: 84, thumbnail: top2Url },
  { id: 'torso-cross', name: '몸통 가로 지르기', score: 78, thumbnail: top3Url },
  { id: 'face-cross', name: '얼굴 가로 지르기', score: 81, thumbnail: top4Url },
  { id: 'sit-stand', name: '앉았다 일어서기', score: 88, thumbnail: top5Url },
]

export const RECENT_SESSIONS: Session[] = [
  { id: 's1', date: '2025-05-03', weekday: '금', shortDate: '5월 3일', score: 78 },
  { id: 's2', date: '2025-05-05', weekday: '일', shortDate: '5월 5일', score: 82 },
  { id: 's3', date: '2025-05-08', weekday: '수', shortDate: '5월 8일', score: 75 },
  { id: 's4', date: '2025-05-10', weekday: '금', shortDate: '5월 10일', score: 80 },
  { id: 's5', date: '2025-05-12', weekday: '일', shortDate: '5월 12일', score: 83 },
  {
    id: 's6',
    date: '2025-05-17',
    weekday: '오늘',
    shortDate: '5월 17일',
    score: 87,
    isToday: true,
  },
]

export const RANGE_OF_MOTION: RangeOfMotion[] = [
  { joint: '어깨', percent: 92, rating: '좋음', tone: 'mint' },
  { joint: '엉덩이', percent: 88, rating: '좋음', tone: 'lavender' },
  { joint: '무릎', percent: 84, rating: '좋음', tone: 'pink' },
  { joint: '발목', percent: 90, rating: '우수', tone: 'cyan' },
]

export const TREND: TrendPoint[] = [
  { date: '4월 12일', score: 42 },
  { date: '4월 19일', score: 55 },
  { date: '4월 26일', score: 60 },
  { date: '5월 3일', score: 52 },
  { date: '5월 10일', score: 75 },
  { date: '5월 17일', score: 82 },
]

export const OVERALL_SCORE = {
  current: 87,
  delta: 6,
  title: '아주 잘했어요!',
  subtitle: '지난 번보다\n더 잘하고 있어요.',
}
