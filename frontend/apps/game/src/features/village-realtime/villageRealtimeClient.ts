import { Client, type IFrame, type StompSubscription } from '@stomp/stompjs'

import type { EmotePacket, PositionPacket, VillageEvent, VillageSnapshot } from './types'

// BE 라우팅 규약 (S14P31E103-714 / 718 / 728). 변경 시 BE 와 함께 손본다.
const TOPIC_VILLAGE = '/topic/village.default'
const QUEUE_SNAPSHOT = '/user/queue/village.snapshot'
const APP_READY = '/app/village/ready'
const APP_POSITION = '/app/village/position'
const APP_EMOTE = '/app/village/emote'

export interface VillageRealtimeClientOptions {
  /** WS broker URL — 미지정 시 동일 origin 의 {@code /api/v1/ws/village} 사용. */
  url?: string
  /** STOMP CONNECT 프레임에 실릴 Bearer 토큰 (Authorization 헤더). */
  token: string
  /** join/move/leave 이벤트 콜백. */
  onEvent: (event: VillageEvent) => void
  /** ready 직후 1회 도착하는 룸 스냅샷 콜백. */
  onSnapshot: (snapshot: VillageSnapshot) => void
  /** CONNECT + 구독 + ready 발행이 끝난 직후. */
  onReady?: () => void
  /** WebSocket 연결이 종료된 후 (정상/비정상 공통). */
  onDisconnect?: () => void
  /** STOMP ERROR 프레임 또는 WS 에러. */
  onError?: (error: Error) => void
}

/**
 * 마을 광장 STOMP 클라이언트 wrapper.
 *
 * <p>흐름: connect() → CONNECT → 구독 (snapshot 큐 + 토픽) → ready 발행 → 서버로부터 snapshot + 자기 join 수신.
 *
 * <p>한 번 만들면 한 세션. 재접속이 필요하면 새 인스턴스를 생성. 자동 재접속은 끄고 (reconnectDelay: 0) 호출자가 라이프사이클을 관리한다 — Phaser 씬
 * shutdown 과 자연스럽게 묶기 위함.
 */
export class VillageRealtimeClient {
  private readonly client: Client
  private topicSubscription: StompSubscription | null = null
  private snapshotSubscription: StompSubscription | null = null

  constructor(private readonly options: VillageRealtimeClientOptions) {
    this.client = new Client({
      brokerURL: options.url ?? defaultBrokerUrl(),
      connectHeaders: { Authorization: `Bearer ${options.token}` },
      reconnectDelay: 0,
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

  /** 위치 발행. 연결 전이면 no-op (호출자가 5Hz tick 으로 안전하게 쏘도록). */
  publishPosition(packet: PositionPacket): void {
    if (!this.client.connected) return
    this.client.publish({
      destination: APP_POSITION,
      body: JSON.stringify(packet),
    })
  }

  /** 이모티콘 발신. 연결 전이면 no-op. 서버측 throttle / 화이트리스트 검증은 BE 가 담당. */
  publishEmote(packet: EmotePacket): void {
    if (!this.client.connected) return
    this.client.publish({
      destination: APP_EMOTE,
      body: JSON.stringify(packet),
    })
  }

  private handleConnect(): void {
    this.snapshotSubscription = this.client.subscribe(QUEUE_SNAPSHOT, frame => {
      this.options.onSnapshot(JSON.parse(frame.body) as VillageSnapshot)
    })
    this.topicSubscription = this.client.subscribe(TOPIC_VILLAGE, frame => {
      this.options.onEvent(JSON.parse(frame.body) as VillageEvent)
    })
    // 구독 SUBSCRIBE 프레임은 같은 inbound 채널에 직렬 처리되므로 곧바로 ready 를 보내도
    // 서버 처리 순서상 구독 등록이 먼저 끝난다. SimpleBroker 는 RECEIPT 가 없어 클라가 따로 동기화 불가능.
    this.client.publish({ destination: APP_READY, body: '' })
    this.options.onReady?.()
  }

  private handleStompError(frame: IFrame): void {
    const message = frame.headers['message'] ?? 'stomp error'
    this.options.onError?.(new Error(message))
  }
}

function defaultBrokerUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/v1/ws/village`
}

function coerceError(e: unknown): Error {
  if (e instanceof Error) return e
  return new Error('websocket error')
}
