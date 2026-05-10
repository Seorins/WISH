export type FuelOptionId = 'small' | 'warm' | 'sparkle' | 'custom'

export type FuelOption = {
  id: FuelOptionId
  label: string
  amount: number | null
  starColor: string
}

export const FUEL_OPTIONS: ReadonlyArray<FuelOption> = [
  { id: 'small', label: '잔잔한 별빛', amount: 5, starColor: '#dcd9ec' },
  { id: 'warm', label: '따뜻한 별빛', amount: 10, starColor: '#ffd55c' },
  { id: 'sparkle', label: '환한 별빛', amount: 15, starColor: '#a892ff' },
  { id: 'custom', label: '직접 입력', amount: null, starColor: '#ffb547' },
]

export const FUEL_STATUS = {
  currentPercent: 72,
  goalPercent: 100,
}

export type WeeklyLogEntry = {
  date: string
  label: string
  amount: number
  starColor: string
}

export const WEEKLY_LOG: ReadonlyArray<WeeklyLogEntry> = [
  { date: '5/10', label: '환한 별빛', amount: 15, starColor: '#a892ff' },
  { date: '5/09', label: '잔잔한 별빛', amount: 5, starColor: '#dcd9ec' },
  { date: '5/08', label: '따뜻한 별빛', amount: 10, starColor: '#ffd55c' },
  { date: '5/07', label: '직접 입력', amount: 25, starColor: '#ffb547' },
]

export const MESSAGE_MAX_LENGTH = 100
