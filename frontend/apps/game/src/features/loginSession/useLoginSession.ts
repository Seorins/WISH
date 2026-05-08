import { useEffect, useRef } from 'react'
import { endLoginSession, heartbeatLoginSession, startLoginSession } from '@wish/api-client'

const HEARTBEAT_INTERVAL_MS = 30_000
const ACCESS_TOKEN_STORAGE_KEY = 'wish_access_token'

function bestEffortEnd(sessionId: number) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
  const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  try {
    void fetch(`${baseUrl}/login-sessions/${sessionId}/end`, {
      method: 'PATCH',
      keepalive: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    // pagehide 동안 발사한 요청은 결과를 알 수 없음 — BE 가 5분 후 자동 마감
  }
}

export function useLoginSession(patientProfileId: number | undefined) {
  const sessionIdRef = useRef<number | null>(null)
  const intervalIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!patientProfileId) return

    let cancelled = false

    const stopHeartbeat = () => {
      if (intervalIdRef.current !== null) {
        window.clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
    }

    const sendHeartbeat = () => {
      const sessionId = sessionIdRef.current
      if (sessionId === null) return
      heartbeatLoginSession(sessionId).catch(() => {
        // 한 번 실패해도 다음 주기에 자동 재시도
      })
    }

    const startHeartbeat = () => {
      stopHeartbeat()
      intervalIdRef.current = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)
    }

    const handleVisibilityChange = () => {
      if (sessionIdRef.current === null) return
      if (document.visibilityState === 'hidden') {
        stopHeartbeat()
      } else {
        sendHeartbeat()
        startHeartbeat()
      }
    }

    const handlePageHide = () => {
      const sessionId = sessionIdRef.current
      if (sessionId === null) return
      stopHeartbeat()
      bestEffortEnd(sessionId)
      sessionIdRef.current = null
    }

    void startLoginSession({ patientProfileId })
      .then(response => {
        if (cancelled) return
        sessionIdRef.current = response.data.id
        if (document.visibilityState !== 'hidden') {
          startHeartbeat()
        }
      })
      .catch(error => {
        console.warn('Failed to start login session.', error)
      })

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      stopHeartbeat()
      const sessionId = sessionIdRef.current
      sessionIdRef.current = null
      if (sessionId !== null) {
        endLoginSession(sessionId).catch(() => {})
      }
    }
  }, [patientProfileId])
}
