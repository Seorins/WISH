// BE 그림 퀴즈 STOMP DTO (com.comong.backend.domain.quiz.dto) 와 미러 (S14P31E103-820).
// 스키마가 바뀌면 양쪽 같이 손봐야 한다.

import type { QuizMember, QuizRoomSnapshot, QuizRoomStatus } from '@wish/api-client'

export type { QuizMember, QuizRoomSnapshot, QuizRoomStatus }

/** {@code /topic/quiz/<roomId>} 으로 브로드캐스트되는 이벤트. BE QuizRoomEvent 와 1:1 대응. */
export interface QuizMemberJoinedEvent {
  type: 'member_joined'
  member: QuizMember
}

export interface QuizMemberLeftEvent {
  type: 'member_left'
  userId: number
}

export interface QuizHostChangedEvent {
  type: 'host_changed'
  hostUserId: number
}

export interface QuizStatusChangedEvent {
  type: 'status_changed'
  status: QuizRoomStatus
}

export type QuizRoomEvent =
  | QuizMemberJoinedEvent
  | QuizMemberLeftEvent
  | QuizHostChangedEvent
  | QuizStatusChangedEvent
