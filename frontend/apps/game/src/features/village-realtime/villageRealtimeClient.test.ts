import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { VillageEvent, VillageSnapshot } from './types'
import { VillageRealtimeClient } from './villageRealtimeClient'

type Handler = (frame: { body: string; headers?: Record<string, string> }) => void

interface FakeSubscription {
  unsubscribe: () => void
  destination: string
}

interface FakeClientConfig {
  brokerURL?: string
  connectHeaders?: Record<string, string>
  reconnectDelay?: number
  onConnect?: () => void
  onStompError?: (frame: { headers: Record<string, string> }) => void
  onWebSocketError?: (e: unknown) => void
  onDisconnect?: () => void
}

/**
 * @stomp/stompjs Client mock. 실 lib 의 라이프사이클을 흉내내 client.activate() 호출 후
 * `triggerConnect()` 를 부르면 onConnect 콜백이 발화되는 식. 테스트에서 동기적으로 시퀀스를 흘릴 수 있게 한다.
 */
class FakeStompClient {
  config: FakeClientConfig
  connected = false
  activated = false
  subscriptions: FakeSubscription[] = []
  subscriptionHandlers = new Map<string, Handler>()
  published: { destination: string; body: string }[] = []

  constructor(config: FakeClientConfig) {
    this.config = config
  }

  activate() {
    this.activated = true
  }

  async deactivate() {
    this.activated = false
    this.connected = false
    this.config.onDisconnect?.()
  }

  subscribe(destination: string, handler: Handler): FakeSubscription {
    this.subscriptionHandlers.set(destination, handler)
    const sub: FakeSubscription = {
      destination,
      unsubscribe: () => {
        this.subscriptions = this.subscriptions.filter(s => s !== sub)
        this.subscriptionHandlers.delete(destination)
      },
    }
    this.subscriptions.push(sub)
    return sub
  }

  publish(frame: { destination: string; body: string }) {
    this.published.push(frame)
  }

  triggerConnect() {
    this.connected = true
    this.config.onConnect?.()
  }

  deliverTo(destination: string, body: unknown) {
    const handler = this.subscriptionHandlers.get(destination)
    if (!handler) throw new Error(`no subscription for ${destination}`)
    handler({ body: typeof body === 'string' ? body : JSON.stringify(body) })
  }

  triggerStompError(message: string) {
    this.config.onStompError?.({ headers: { message } })
  }
}

let fakeClient: FakeStompClient | undefined

vi.mock('@stomp/stompjs', () => ({
  Client: vi.fn().mockImplementation((config: FakeClientConfig) => {
    fakeClient = new FakeStompClient(config)
    return fakeClient
  }),
}))

beforeEach(() => {
  fakeClient = undefined
})

afterEach(() => {
  vi.clearAllMocks()
})

function createClient() {
  const events: VillageEvent[] = []
  const snapshots: VillageSnapshot[] = []
  const errors: Error[] = []
  let ready = false
  let disconnected = false

  const client = new VillageRealtimeClient({
    url: 'ws://test/api/v1/ws/village',
    token: 'jwt-here',
    onEvent: e => events.push(e),
    onSnapshot: s => snapshots.push(s),
    onReady: () => {
      ready = true
    },
    onDisconnect: () => {
      disconnected = true
    },
    onError: e => errors.push(e),
  })
  return {
    client,
    fake: () => {
      if (!fakeClient) throw new Error('fake client not instantiated')
      return fakeClient
    },
    events,
    snapshots,
    errors,
    isReady: () => ready,
    isDisconnected: () => disconnected,
  }
}

describe('VillageRealtimeClient', () => {
  it('passes Bearer token and broker URL to the underlying STOMP client', () => {
    const { fake } = createClient()

    expect(fake().config.brokerURL).toBe('ws://test/api/v1/ws/village')
    expect(fake().config.connectHeaders).toEqual({ Authorization: 'Bearer jwt-here' })
    expect(fake().config.reconnectDelay).toBe(0)
  })

  it('connect activates the underlying client', () => {
    const { client, fake } = createClient()

    client.connect()

    expect(fake().activated).toBe(true)
  })

  it('on CONNECT, subscribes to snapshot queue and topic, then publishes ready and fires onReady', () => {
    const { client, fake, isReady } = createClient()

    client.connect()
    fake().triggerConnect()

    expect(fake().subscriptionHandlers.has('/user/queue/village.snapshot')).toBe(true)
    expect(fake().subscriptionHandlers.has('/topic/village.default')).toBe(true)
    expect(fake().published).toContainEqual({ destination: '/app/village/ready', body: '' })
    expect(isReady()).toBe(true)
  })

  it('forwards snapshot frame to onSnapshot', () => {
    const { client, fake, snapshots } = createClient()
    client.connect()
    fake().triggerConnect()

    fake().deliverTo('/user/queue/village.snapshot', {
      members: [{ userId: 1, nickname: 'a', textureKey: 'character', x: 0.5, y: 0.3, dir: 'down' }],
    })

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].members[0].userId).toBe(1)
  })

  it('forwards topic frames (join/move/leave) to onEvent', () => {
    const { client, fake, events } = createClient()
    client.connect()
    fake().triggerConnect()

    fake().deliverTo('/topic/village.default', {
      type: 'move',
      userId: 7,
      x: 0.1,
      y: 0.2,
      dir: 'left',
      moving: true,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'move', userId: 7, dir: 'left', moving: true })
  })

  it('publishPosition serializes packet to JSON body', () => {
    const { client, fake } = createClient()
    client.connect()
    fake().triggerConnect()

    client.publishPosition({ x: 0.42, y: 0.78, dir: 'left', moving: true })

    expect(fake().published).toContainEqual({
      destination: '/app/village/position',
      body: JSON.stringify({ x: 0.42, y: 0.78, dir: 'left', moving: true }),
    })
  })

  it('publishEmote serializes packet and sends to /app/village/emote, returns true', () => {
    const { client, fake } = createClient()
    client.connect()
    fake().triggerConnect()

    const sent = client.publishEmote({ emoji: '😄' })

    expect(sent).toBe(true)
    expect(fake().published).toContainEqual({
      destination: '/app/village/emote',
      body: JSON.stringify({ emoji: '😄' }),
    })
  })

  it('publishEmote returns false before connection completes', () => {
    const { client, fake } = createClient()

    const sent = client.publishEmote({ emoji: '😄' })

    expect(sent).toBe(false)
    expect(fake().published).toEqual([])
  })

  it('publishPosition returns true on success and false before connection', () => {
    const { client, fake } = createClient()

    // 미연결 — false 반환 + 송신 없음
    expect(client.publishPosition({ x: 0.1, y: 0.1, dir: 'down', moving: false })).toBe(false)
    expect(fake().published).toEqual([])

    // 연결 후 — true 반환 + 송신
    client.connect()
    fake().triggerConnect()
    expect(client.publishPosition({ x: 0.2, y: 0.3, dir: 'up', moving: true })).toBe(true)
    expect(fake().published).toContainEqual({
      destination: '/app/village/position',
      body: JSON.stringify({ x: 0.2, y: 0.3, dir: 'up', moving: true }),
    })
  })

  it('disconnect unsubscribes both destinations and deactivates the client', async () => {
    const { client, fake, isDisconnected } = createClient()
    client.connect()
    fake().triggerConnect()

    await client.disconnect()

    expect(fake().subscriptionHandlers.size).toBe(0)
    expect(fake().activated).toBe(false)
    expect(isDisconnected()).toBe(true)
  })

  it('translates STOMP ERROR frame message into onError', () => {
    const { client, fake, errors } = createClient()
    client.connect()

    fake().triggerStompError('village room full (capacity=30)')

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('village room full (capacity=30)')
  })
})
