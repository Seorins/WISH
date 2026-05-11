import { useRef } from 'react'
import type { ActiveLiveSession } from '@/stores/realtimeStore'
import { useLiveKitViewer, type LiveKitViewerStatus } from './useLiveKitViewer'
import styles from './LiveKitViewer.module.css'

type Props = {
  activeSession: ActiveLiveSession
}

// 활성 LoginSession 에 대응되는 LiveKit room 의 게임 화면을 보여주는 viewer.
// 부모(LiveMonitorPage) 가 activeSession 이 null 인 경우엔 아예 이 컴포넌트를 마운트하지 않는다.
export function LiveKitViewer({ activeSession }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const { status, hasRemoteVideo } = useLiveKitViewer({
    loginSessionId: activeSession.loginSessionId,
    videoRef,
    audioRef,
  })

  return (
    <div className={styles.viewer}>
      <div className={styles.stage}>
        <video
          ref={videoRef}
          className={styles.video}
          autoPlay
          playsInline
          muted
          // 안드로이드 Chrome 에서 일부 비디오 코덱이 autoplay 정책 검사를 못 통과하는 경우 대비.
          controls={false}
        />
        <audio ref={audioRef} autoPlay />
        {hasRemoteVideo ? null : (
          <div className={styles.overlay}>{overlayMessage(status, activeSession.patientName)}</div>
        )}
      </div>
      <div className={styles.statusBar}>
        <span className={styles.statusText}>
          {activeSession.patientName} 님이 게임에 접속해 있어요
        </span>
        <span
          className={`${styles.statusBadge} ${status === 'connected' ? styles.statusBadgeLive : ''}`}
        >
          {statusLabel(status)}
        </span>
      </div>
    </div>
  )
}

function overlayMessage(status: LiveKitViewerStatus, patientName: string): string {
  switch (status) {
    case 'idle':
      return '연결을 준비하고 있어요...'
    case 'requesting-token':
      return '실시간 입장권을 받아오고 있어요...'
    case 'connecting':
      return '아이의 화면에 연결하고 있어요...'
    case 'connected':
      return `${patientName} 님의 화면을 기다리고 있어요...`
    case 'disconnected':
      return '연결이 끊겼어요. 새로고침해서 다시 시도해 주세요.'
    case 'error':
      return '연결에 실패했어요. 잠시 후 다시 시도해 주세요.'
  }
}

function statusLabel(status: LiveKitViewerStatus): string {
  switch (status) {
    case 'idle':
      return '대기'
    case 'requesting-token':
      return '입장권 요청 중'
    case 'connecting':
      return '연결 중'
    case 'connected':
      return 'LIVE'
    case 'disconnected':
      return '연결 끊김'
    case 'error':
      return '오류'
  }
}
