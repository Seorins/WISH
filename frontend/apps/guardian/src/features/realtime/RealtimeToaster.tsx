import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RealtimeContentType, RealtimeEvent } from '@wish/api-client'
import { useRealtimeStore } from '@/stores/realtimeStore'
import styles from './RealtimeToaster.module.css'

type ToastItem = {
  id: number
  variant: 'info' | 'live'
  title: string
  description?: string
  cta?: { label: string; onClick: () => void }
  /** 자동 dismiss 까지 남은 ms. Infinity 면 sticky. */
  durationMs: number
}

const TOAST_DEFAULT_DURATION_MS = 4_000
const TOAST_LIVE_DURATION_MS = 8_000

// 실시간 이벤트를 토스트로 노출하는 헤드 컴포넌트.
// realtimeStore.lastEventNonce 가 증가할 때마다 토스트 1장 추가.
// 라이브 보기 CTA 는 활성 세션이 있을 때만 (= GAME_STARTED 토스트에만) 노출.
export function RealtimeToaster() {
  const navigate = useNavigate()
  const lastEvent = useRealtimeStore(state => state.lastEvent)
  const lastEventNonce = useRealtimeStore(state => state.lastEventNonce)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextIdRef = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts(items => items.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    if (!lastEvent || lastEventNonce === 0) return
    const toast = buildToast(lastEvent, () => navigate('/live'))
    if (!toast) return
    const id = nextIdRef.current++
    const item: ToastItem = { ...toast, id }
    setToasts(items => [...items, item])
  }, [lastEvent, lastEventNonce, navigate])

  // 토스트 별 자동 dismiss 타이머. duration 이 바뀌지 않으므로 id 만 의존성.
  useEffect(() => {
    const timers = toasts
      .filter(t => Number.isFinite(t.durationMs))
      .map(t =>
        window.setTimeout(() => {
          dismiss(t.id)
        }, t.durationMs),
      )
    return () => {
      timers.forEach(timer => window.clearTimeout(timer))
    }
    // toasts.length 변화에만 반응하면 충분 — 새 토스트 추가 시 기존 타이머 재설정되지만
    // 곧바로 같은 시점에 다시 등록되므로 사용자 인지엔 영향 없음.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toasts.length])

  if (toasts.length === 0) return null

  return (
    <div className={styles.viewport} role="region" aria-label="실시간 알림">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`${styles.toast} ${toast.variant === 'live' ? styles.toastLive : ''}`}
          role="status"
        >
          <div className={styles.header}>
            <h2 className={styles.title}>{toast.title}</h2>
            <button
              type="button"
              className={styles.close}
              aria-label="알림 닫기"
              onClick={() => dismiss(toast.id)}
            >
              ×
            </button>
          </div>
          {toast.description ? <p className={styles.description}>{toast.description}</p> : null}
          {toast.cta ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cta}
                onClick={() => {
                  toast.cta?.onClick()
                  dismiss(toast.id)
                }}
              >
                {toast.cta.label}
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

type ToastTemplate = Omit<ToastItem, 'id'>

function buildToast(event: RealtimeEvent, goToLive: () => void): ToastTemplate | null {
  switch (event.type) {
    case 'GAME_STARTED':
      return {
        variant: 'live',
        title: `${event.patientName} 님이 게임에 접속했어요`,
        description: '지금 라이브 화면에서 함께 볼 수 있어요.',
        cta: { label: '라이브 보기', onClick: goToLive },
        durationMs: TOAST_LIVE_DURATION_MS,
      }
    case 'GAME_ENDED':
      return {
        variant: 'info',
        title: '아이가 게임을 마쳤어요',
        durationMs: TOAST_DEFAULT_DURATION_MS,
      }
    case 'CONTENT_STARTED':
      return {
        variant: 'info',
        title: `${contentLabel(event.contentType)} 활동을 시작했어요`,
        description: '지금부터 라이브 화면에서 마이크로 응원할 수 있어요.',
        durationMs: TOAST_DEFAULT_DURATION_MS,
      }
    case 'CONTENT_ENDED':
      return {
        variant: 'info',
        title: `${contentLabel(event.contentType)} 활동이 끝났어요`,
        durationMs: TOAST_DEFAULT_DURATION_MS,
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
