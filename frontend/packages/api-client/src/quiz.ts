import { apiClient } from './client'
import type { ApiResponse } from './artworks'

// 그림 퀴즈 멀티플레이 REST 클라이언트 (S14P31E103-820).
// BE: QuizRoomController (`/quiz/rooms/...`)

export type QuizRoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED'

export type QuizMember = {
  userId: number
  nickname: string
  joinOrder: number
  score: number
  isHost: boolean
}

export type QuizRoomSnapshot = {
  roomId: string
  code: string
  status: QuizRoomStatus
  hostUserId: number
  minPlayers: number
  maxPlayers: number
  members: QuizMember[]
  /** STOMP CONNECT 시 Room 헤더로 전달할 prefixed 키 (예: {@code quiz.AB12CD}). */
  stompRoomKey: string
}

/** 방장이 새 방 생성. 본인이 첫 멤버 + 호스트로 등록됨. */
export async function createQuizRoom(): Promise<QuizRoomSnapshot> {
  const response = await apiClient.post<ApiResponse<QuizRoomSnapshot>>('/quiz/rooms')
  return response.data.data
}

/** 6자리 코드로 방 입장. */
export async function joinQuizRoom(code: string): Promise<QuizRoomSnapshot> {
  const response = await apiClient.post<ApiResponse<QuizRoomSnapshot>>('/quiz/rooms/join', {
    code,
  })
  return response.data.data
}

/** 명시적 퇴장. WS disconnect 와 등가지만, 게임 외 페이지 이동 시 fan-out 즉시 트리거에 사용. */
export async function leaveQuizRoom(): Promise<void> {
  await apiClient.post<ApiResponse<void>>('/quiz/rooms/leave')
}

/** 재접속 / 새로고침 시 현재 상태 조회. 비멤버도 호출 가능 (멤버 검증은 WS CONNECT 단계). */
export async function getQuizRoom(roomId: string): Promise<QuizRoomSnapshot> {
  const response = await apiClient.get<ApiResponse<QuizRoomSnapshot>>(
    `/quiz/rooms/${encodeURIComponent(roomId)}`,
  )
  return response.data.data
}
