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

export type VillageEvent = VillageJoinEvent | VillageMoveEvent | VillageLeaveEvent

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
