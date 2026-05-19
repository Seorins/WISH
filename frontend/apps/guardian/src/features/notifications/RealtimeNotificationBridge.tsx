import { useEffect, useRef } from 'react'
import {
  getActiveLiveSession,
  type RealtimeContentType,
  type RealtimeEvent,
} from '@wish/api-client'
import { useAuthStore } from '@/shared/auth/store'
import { useNotificationStore, type NotificationItem } from '@/stores/notificationStore'
import { useRealtimeStore } from '@/stores/realtimeStore'

// realtimeStore 의 lastEventNonce 가 증가할 때마다 새 이벤트를 notificationStore 로 변환해 push 한다.
// 토스트 컴포넌트를 대체 — 화면 가운데 팝업 대신 헤더 종 아이콘에 누적되는 형태.
export function RealtimeNotificationBridge() {
  const token = useAuthStore(state => state.token)
  const activeSession = useRealtimeStore(state => state.activeSession)
  const hydrateActiveSession = useRealtimeStore(state => state.hydrateActiveSession)
  const lastEvent = useRealtimeStore(state => state.lastEvent)
  const lastEventNonce = useRealtimeStore(state => state.lastEventNonce)
  const push = useNotificationStore(state => state.push)
  const clear = useNotificationStore(state => state.clear)
  const notifiedActiveSessionIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!token) return

    const controller = new AbortController()
    let cancelled = false
    const expectedSessionVersion = useRealtimeStore.getState().sessionVersion

    const hydrateSnapshot = async () => {
      try {
        const snapshot = await getActiveLiveSession({ signal: controller.signal })
        if (cancelled) return
        hydrateActiveSession(snapshot, expectedSessionVersion)
      } catch (error) {
        if (cancelled || controller.signal.aborted) return
        console.warn('Initial active live session snapshot failed', error)
      }
    }

    void hydrateSnapshot()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [hydrateActiveSession, token])

  useEffect(() => {
    if (!lastEvent || lastEventNonce === 0) return
    const built = buildNotification(lastEvent)
    if (built) {
      if (lastEvent.type === 'GAME_STARTED') {
        notifiedActiveSessionIdRef.current = lastEvent.loginSessionId
      }
      push(built)
    }
  }, [lastEvent, lastEventNonce, push])

  useEffect(() => {
    if (!activeSession) {
      notifiedActiveSessionIdRef.current = null
      return
    }

    if (notifiedActiveSessionIdRef.current === activeSession.loginSessionId) return

    notifiedActiveSessionIdRef.current = activeSession.loginSessionId
    push({
      kind: 'GAME_STARTED',
      title: `${activeSession.patientName} 님이 접속 중이에요`,
      description: '실시간으로 확인해보세요.',
      href: '/live',
    })
  }, [activeSession, push])

  useEffect(() => {
    if (!token) {
      notifiedActiveSessionIdRef.current = null
      clear()
    }
  }, [token, clear])

  return null
}

type BuiltNotification = Omit<NotificationItem, 'id' | 'createdAt'>

function buildNotification(event: RealtimeEvent): BuiltNotification | null {
  switch (event.type) {
    case 'GAME_STARTED':
      return {
        kind: 'GAME_STARTED',
        title: `${event.patientName} 님이 게임에 접속했어요`,
        description: '라이브 화면에서 함께 볼 수 있어요.',
        href: '/live',
      }
    case 'GAME_ENDED':
      return {
        kind: 'GAME_ENDED',
        title: '아이가 게임을 마쳤어요',
      }
    case 'CONTENT_STARTED':
      return {
        kind: 'CONTENT_STARTED',
        title: `${contentLabel(event.contentType)} 활동을 시작했어요`,
        description: '지금부터 라이브 화면에서 마이크로 응원할 수 있어요.',
        href: '/live',
      }
    case 'CONTENT_ENDED':
      return {
        kind: 'CONTENT_ENDED',
        title: `${contentLabel(event.contentType)} 활동이 끝났어요`,
      }
    case 'CONNECTED':
      return null
  }
}

function contentLabel(contentType: RealtimeContentType): string {
  switch (contentType) {
    case 'MUSIC':
      return '음악'
    case 'GYMNASTICS':
      return '체조'
    case 'TAEKWONDO':
      return '태권도'
    case 'ART':
      return '미술'
  }
}
