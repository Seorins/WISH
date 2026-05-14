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
  /** 1-based 라운드 번호. WAITING/FINISHED 일 땐 0. */
  roundNumber: number
  /** 현재 출제자 userId. PLAYING 일 때만 의미 있음 (0 = 미정). */
  currentDrawerUserId: number
}

/** 출제자에게만 노출되는 라운드 제시어. 정답자는 글자수 힌트만 별도 라우팅으로 받음 (M2-5 예정). */
export type PromptAssignment = {
  roundNumber: number
  word: string
  hint: string
}

/**
 * {@code POST /quiz/rooms/{roomId}/start} 응답. 방장만 호출하므로 prompt 는 항상 채워진다 — WS race 회피용으로 REST 에
 * 동봉.
 */
export type QuizGameStartedResponse = {
  snapshot: QuizRoomSnapshot
  prompt: PromptAssignment
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

/**
 * 방장이 호출 — 다음 라운드 시작. WAITING → PLAYING 또는 PLAYING 다음 라운드. 응답에 새 스냅샷 + 제시어 동봉.
 */
export async function startQuizRoom(roomId: string): Promise<QuizGameStartedResponse> {
  const response = await apiClient.post<ApiResponse<QuizGameStartedResponse>>(
    `/quiz/rooms/${encodeURIComponent(roomId)}/start`,
  )
  return response.data.data
}
