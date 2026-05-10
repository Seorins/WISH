import { apiClient } from './client'
import type { ApiResponse } from './artworks'

// 실시간 모니터링 콘텐츠 타입.
// BE 의 ContentType enum 과 정확히 일치해야 함 — 스키마 변경 시 양쪽 동기화 필요.
export type RealtimeContentType = 'MUSIC' | 'GYMNASTICS' | 'TAEKWONDO' | 'ART'

// 게임앱이 LiveKit room 에 접속할 때 받는 응답.
// livekitUrl 은 BE 가 응답에 포함시켜 FE env 에 secret 을 두지 않도록 한다.
export type GameLivekitTokenResponse = {
  loginSessionId: number
  patientProfileId: number
  roomName: string
  livekitUrl: string
  token: string
}

// 보호자앱이 LiveKit room 에 접속할 때 받는 응답.
// 보호자는 콘텐츠 진행 상태를 알아야 PTT 마이크 버튼 활성/비활성을 결정할 수 있어
// contentActive / contentType 가 같이 내려온다.
export type GuardianLivekitTokenResponse = {
  loginSessionId: number
  roomName: string
  livekitUrl: string
  token: string
  contentActive: boolean
  contentType: RealtimeContentType | null
}

export type StartContentRequest = {
  contentType: RealtimeContentType
}

// /realtime/events SSE 채널 이벤트.
// type 으로 분기하는 discriminated union — 새 이벤트 추가 시 여기와 BE 양쪽 추가.
export type RealtimeEvent =
  | {
      type: 'GAME_STARTED'
      loginSessionId: number
      patientProfileId: number
      patientName: string
    }
  | {
      type: 'GAME_ENDED'
      loginSessionId: number
      patientProfileId: number
    }
  | {
      type: 'CONTENT_STARTED'
      loginSessionId: number
      contentType: RealtimeContentType
      message?: string
    }
  | {
      type: 'CONTENT_ENDED'
      loginSessionId: number
      contentType: RealtimeContentType
    }

export async function requestGameLivekitToken(loginSessionId: number) {
  const response = await apiClient.post<ApiResponse<GameLivekitTokenResponse>>(
    `/realtime/login-sessions/${loginSessionId}/game-token`,
  )
  return response.data
}

export async function requestGuardianLivekitToken(loginSessionId: number) {
  const response = await apiClient.post<ApiResponse<GuardianLivekitTokenResponse>>(
    `/realtime/login-sessions/${loginSessionId}/guardian-token`,
  )
  return response.data
}

export async function startContent(loginSessionId: number, request: StartContentRequest) {
  const response = await apiClient.post<ApiResponse<void>>(
    `/realtime/login-sessions/${loginSessionId}/content/start`,
    request,
  )
  return response.data
}

export async function endContent(loginSessionId: number) {
  const response = await apiClient.post<ApiResponse<void>>(
    `/realtime/login-sessions/${loginSessionId}/content/end`,
  )
  return response.data
}

type RealtimeSubscriptionOptions = {
  onEvent: (event: RealtimeEvent) => void
  onError?: (error: unknown) => void
  signal?: AbortSignal
}

// EventSource 가 Authorization 헤더를 못 붙이는 한계를 우회하려고 fetch + ReadableStream 으로
// 직접 SSE 를 구독한다. text/event-stream 의 최소 스펙(`data:` 라인 + 빈 줄로 메시지 구분) 만 처리.
// 재연결/백오프는 호출자 (useRealtimeEvents) 에서 처리.
export async function subscribeRealtimeEvents({
  onEvent,
  onError,
  signal,
}: RealtimeSubscriptionOptions): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
  const token = localStorage.getItem('wish_access_token')
  const response = await fetch(`${baseUrl}/realtime/events`, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  })

  if (!response.ok || !response.body) {
    throw new Error(`SSE connection failed: ${response.status}`)
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      // SSE 메시지 구분자는 빈 줄(\n\n).
      let separatorIndex = buffer.indexOf('\n\n')
      while (separatorIndex !== -1) {
        const rawMessage = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)
        const dataLine = rawMessage.split('\n').find(line => line.startsWith('data:'))
        if (dataLine) {
          const payload = dataLine.slice('data:'.length).trim()
          if (payload) {
            try {
              onEvent(JSON.parse(payload) as RealtimeEvent)
            } catch (parseError) {
              onError?.(parseError)
            }
          }
        }
        separatorIndex = buffer.indexOf('\n\n')
      }
    }
  } catch (streamError) {
    if (signal?.aborted) return
    onError?.(streamError)
  } finally {
    reader.releaseLock()
  }
}
