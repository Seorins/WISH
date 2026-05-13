// BE 마을 광장 STOMP DTO (com.comong.backend.domain.village.realtime.dto) 와 미러.
// 스키마가 바뀌면 양쪽 같이 손봐야 한다.

export type PlayerDirection = 'up' | 'down' | 'left' | 'right'

export interface PositionPacket {
  x: number
  y: number
  dir: PlayerDirection
  moving: boolean
}

export interface VillageJoinEvent {
  type: 'join'
  userId: number
  nickname: string
  textureKey: string
  x: number
  y: number
  dir: PlayerDirection
}

export interface VillageMoveEvent {
  type: 'move'
  userId: number
  x: number
  y: number
  dir: PlayerDirection
  moving: boolean
}

export interface VillageLeaveEvent {
  type: 'leave'
  userId: number
}

export interface VillageEmoteEvent {
  type: 'emote'
  userId: number
  emoji: string
}

export type VillageEvent =
  | VillageJoinEvent
  | VillageMoveEvent
  | VillageLeaveEvent
  | VillageEmoteEvent

export interface EmotePacket {
  emoji: string
}

/**
 * BE VillageEmojis.ALLOWED 와 동기. 변경 시 BE 화이트리스트도 같이.
 *
 * <p>S14P31E103-769: 이모지뿐 아니라 짧은 한글 메시지도 슬롯에 포함 — 또래 환자 간 간단한 소통. 키맵은 1\~9, 0 순서.
 */
export const VILLAGE_EMOJIS = [
  '안녕',
  '따라와',
  '좋아',
  '고마워',
  '힘내',
  '😄',
  '😢',
  '👍',
  '❤️',
  '❓',
] as const
export type VillageEmoji = (typeof VILLAGE_EMOJIS)[number]

export interface SnapshotMember {
  userId: number
  nickname: string
  textureKey: string
  x: number
  y: number
  dir: PlayerDirection
}

export interface VillageSnapshot {
  members: SnapshotMember[]
}
