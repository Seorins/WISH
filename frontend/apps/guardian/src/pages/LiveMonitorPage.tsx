import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import { LiveKitViewer } from '@/features/realtime'
import { useRealtimeStore } from '@/stores/realtimeStore'
import '@/features/dashboard/tokens.css'
import styles from './LiveMonitorPage.module.css'

// 실시간 모니터링 페이지.
// realtimeStore.activeSession 이 있으면 LiveKitViewer 마운트 → guardian-token 요청 → 영상 표시.
// 없으면 빈 상태 카드.
export function LiveMonitorPage() {
  const activeSession = useRealtimeStore(state => state.activeSession)

  return (
    <div className={styles.shell}>
      <div className={styles.headerSlot}>
        <HeaderBar />
      </div>
      <div className={styles.body}>
        {activeSession ? (
          <LiveKitViewer activeSession={activeSession} />
        ) : (
          <section className={styles.placeholder}>
            <h1 className={styles.title}>아이가 아직 게임에 접속하지 않았어요</h1>
            <p className={styles.subtitle}>
              아이가 게임을 시작하면 이 화면에서 실시간으로 함께 볼 수 있어요.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
