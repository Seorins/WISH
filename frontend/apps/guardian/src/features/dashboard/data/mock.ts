export type MovementCategory = 'all' | 'upper' | 'lower' | 'balance' | 'flexibility'

export type Movement = {
  id: string
  name: string
  category: Exclude<MovementCategory, 'all'>
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
  emoji: string
  percent: number
  rating: 'Good' | 'Excellent' | 'Needs Work'
  tone: 'mint' | 'lavender' | 'pink' | 'cyan'
}

export type TrendPoint = {
  date: string
  score: number
}

export type SessionView = 'current' | 'previous'

export const PATIENT = {
  name: 'Alex Kim',
  age: 9,
  avatarEmoji: '🧒',
}

export const MOVEMENTS: Movement[] = [
  { id: 'arm-raise', name: 'Arm Raise', category: 'upper', score: 92, thumbnail: '🙆' },
  { id: 'deep-squat', name: 'Deep Squat', category: 'lower', score: 78, thumbnail: '🧎' },
  {
    id: 'single-leg-balance',
    name: 'Single Leg Balance',
    category: 'balance',
    score: 85,
    thumbnail: '🧍',
  },
]

export const RECENT_SESSIONS: Session[] = [
  { id: 's1', date: '2025-05-03', weekday: 'Fri', shortDate: 'May 3', score: 78 },
  { id: 's2', date: '2025-05-05', weekday: 'Sun', shortDate: 'May 5', score: 82 },
  { id: 's3', date: '2025-05-08', weekday: 'Wed', shortDate: 'May 8', score: 75 },
  { id: 's4', date: '2025-05-10', weekday: 'Fri', shortDate: 'May 10', score: 80 },
  { id: 's5', date: '2025-05-12', weekday: 'Sun', shortDate: 'May 12', score: 83 },
  { id: 's6', date: '2025-05-17', weekday: 'Today', shortDate: 'May 17', score: 87, isToday: true },
]

export const RANGE_OF_MOTION: RangeOfMotion[] = [
  { joint: 'Shoulders', emoji: '🤸', percent: 92, rating: 'Good', tone: 'mint' },
  { joint: 'Hips', emoji: '🕺', percent: 88, rating: 'Good', tone: 'lavender' },
  { joint: 'Knees', emoji: '🦵', percent: 84, rating: 'Good', tone: 'pink' },
  { joint: 'Ankles', emoji: '👟', percent: 90, rating: 'Excellent', tone: 'cyan' },
]

export const TREND: TrendPoint[] = [
  { date: 'Apr 12', score: 42 },
  { date: 'Apr 19', score: 55 },
  { date: 'Apr 26', score: 60 },
  { date: 'May 3', score: 52 },
  { date: 'May 10', score: 75 },
  { date: 'May 17', score: 82 },
]

export const OVERALL_SCORE = {
  current: 87,
  delta: 6,
  title: 'Great Job!',
  subtitle: "You're performing\nbetter than last time.",
}

export const NEXT_SESSION = {
  date: 'May 24, 2025',
  time: '10:00 AM',
  label: 'Full Body Assessment',
}

export type JointMarker = {
  id: string
  label: string
  position: [number, number, number]
}

export const JOINT_MARKERS: JointMarker[] = [
  { id: 'shoulder-l', label: 'L Shoulder', position: [-0.35, 1.25, 0.05] },
  { id: 'shoulder-r', label: 'R Shoulder', position: [0.35, 1.25, 0.05] },
  { id: 'elbow-l', label: 'L Elbow', position: [-0.5, 0.85, 0.05] },
  { id: 'elbow-r', label: 'R Elbow', position: [0.5, 0.85, 0.05] },
  { id: 'wrist-l', label: 'L Wrist', position: [-0.55, 0.45, 0.05] },
  { id: 'wrist-r', label: 'R Wrist', position: [0.55, 0.45, 0.05] },
  { id: 'hip-l', label: 'L Hip', position: [-0.18, 0.2, 0.05] },
  { id: 'hip-r', label: 'R Hip', position: [0.18, 0.2, 0.05] },
  { id: 'knee-l', label: 'L Knee', position: [-0.2, -0.3, 0.05] },
  { id: 'knee-r', label: 'R Knee', position: [0.2, -0.3, 0.05] },
  { id: 'ankle-l', label: 'L Ankle', position: [-0.22, -0.85, 0.05] },
  { id: 'ankle-r', label: 'R Ankle', position: [0.22, -0.85, 0.05] },
]
