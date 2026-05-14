import { Client, type IFrame, type StompSubscription } from '@stomp/stompjs'

import type { QuizRoomEvent, QuizRoomSnapshot } from './types'

// BE 라우팅 규약 (S14P31E103-820). 변경 시 BE 와 함께 손본다.
// roomId 는 BE 가 발급한 6자리 코드와 동일하며, stompRoomKey 는 'quiz.<roomId>' 형식.
const TOPIC_PREFIX = '/topic/quiz/'
const USER_QUEUE_PREFIX = '/user/queue/quiz/'
const SNAPSHOT_SUFFIX = '/snapshot'
const APP_READY_PREFIX = '/app/quiz/'
const APP_READY_SUFFIX = '/ready'

/** 재접속 대기 시간 (ms) — village 와 동일 정책 (S14P31E103-782). */
const RECONNECT_DELAY_MS = 5_000

export interface QuizRealtimeClientOptions {
  /** BE 발급 roomId (== 코드). */
  roomId: string
  /** STOMP CONNECT 시 Room 헤더에 사용할 prefixed 키. QuizRoomSnapshot.stompRoomKey 그대로. */
  stompRoomKey: string
  /** WS broker URL — 미지정 시 동일 origin 의 {@code /api/v1/ws/quiz} 사용. */
  url?: string
  /**
   * 매 CONNECT 시 호출되는 token fetcher. 만료 임박이면 refresh 후 새 토큰을 돌려주고, 인증 불가면 null. null 일 땐 클라이언트를
   * deactivate 해서 무한 재접속 루프를 끊는다 (village 동일).
   */
  getAccessToken: () => Promise<string | null>
  /** 방 토픽 이벤트 (member_joined / left / host_changed / status_changed). */
  onEvent: (event: QuizRoomEvent) => void
  /** ready 직후 1회 도착하는 룸 스냅샷. */
  onSnapshot: (snapshot: QuizRoomSnapshot) => void
  /** CONNECT + 구독 + ready 발행이 끝난 직후. 재접속할 때마다 호출. */
  onReady?: () => void
  /** WS 연결 종료 후 (정상/비정상 공통). */
  onDisconnect?: () => void
  /** STOMP ERROR 프레임 또는 WS 에러. */
  onError?: (error: Error) => void
}

/**
 * 그림 퀴즈 멀티플레이 STOMP 클라이언트 wrapper.
 *
 * <p>흐름: connect() → CONNECT (Room: quiz.{roomId}) → 구독 ({@code /topic/quiz/{roomId}} + snapshot
 * queue) → ready 발행 → 서버로부터 snapshot 수신 + 이후 토픽 이벤트 스트림.
 *
 * <p>역할이 단순(로비 + 진행) 하므로 village 와 달리 latest-wins / replace 로직은 없다. WS 끊김 → BE QuizPresenceInterceptor
 * 는 단순 재접속을 허용 (멤버십 유지).
 */
export class QuizRealtimeClient {
  private readonly client: Client
  private readonly topic: string
  private readonly userSnapshotQueue: string
  private readonly appReady: string
  private topicSubscription: StompSubscription | null = null
  private snapshotSubscription: StompSubscription | null = null

  constructor(private readonly options: QuizRealtimeClientOptions) {
    this.topic = `${TOPIC_PREFIX}${options.roomId}`
    this.userSnapshotQueue = `${USER_QUEUE_PREFIX}${options.roomId}${SNAPSHOT_SUFFIX}`
    this.appReady = `${APP_READY_PREFIX}${options.roomId}${APP_READY_SUFFIX}`

    this.client = new Client({
      brokerURL: options.url ?? defaultBrokerUrl(),
      reconnectDelay: RECONNECT_DELAY_MS,
      beforeConnect: () => this.refreshConnectHeaders(),
      onConnect: () => this.handleConnect(),
      onStompError: frame => this.handleStompError(frame),
      onWebSocketError: e => this.options.onError?.(coerceError(e)),
      onDisconnect: () => this.options.onDisconnect?.(),
    })
  }

  connect(): void {
    this.client.activate()
  }

  /** WS 종료. 진행 중인 구독 cleanup + deactivate. 멱등. */
  async disconnect(): Promise<void> {
    this.topicSubscription?.unsubscribe()
    this.snapshotSubscription?.unsubscribe()
    this.topicSubscription = null
    this.snapshotSubscription = null
    await this.client.deactivate()
  }

  private async refreshConnectHeaders(): Promise<void> {
    const token = await this.options.getAccessToken()
    if (!token) {
      void this.client.deactivate()
      this.options.onError?.(new Error('No access token available for quiz WS connect.'))
      return
    }
    // Room 헤더로 BE QuizPresenceInterceptor 가 라우팅. prefix 가 quiz. 으로 시작해야 quiz 인터셉터가 잡는다.
    this.client.connectHeaders = {
      Authorization: `Bearer ${token}`,
      Room: this.options.stompRoomKey,
    }
  }

  private handleConnect(): void {
    this.snapshotSubscription = this.client.subscribe(this.userSnapshotQueue, frame => {
      this.options.onSnapshot(JSON.parse(frame.body) as QuizRoomSnapshot)
    })
    this.topicSubscription = this.client.subscribe(this.topic, frame => {
      this.options.onEvent(JSON.parse(frame.body) as QuizRoomEvent)
    })
    // SUBSCRIBE 와 SEND 가 같은 inbound 채널에 직렬 처리되므로 곧바로 ready 를 보내도 구독이 먼저 등록된다 (village 와 동일).
    this.client.publish({ destination: this.appReady, body: '' })
    this.options.onReady?.()
  }

  private handleStompError(frame: IFrame): void {
    const message = frame.headers['message'] ?? 'stomp error'
    this.options.onError?.(new Error(message))
  }
}

function defaultBrokerUrl(): string {
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (apiBase) {
    return apiBase.replace(/^http/, 'ws') + '/ws/quiz'
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/v1/ws/quiz`
}

function coerceError(e: unknown): Error {
  if (e instanceof Error) return e
  return new Error('websocket error')
}
