import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import '@/features/dashboard/tokens.css'
import styles from './LiveMonitorPage.module.css'

// 실시간 모니터링 페이지 — 현재는 빈 상태(skeleton).
// 후속 체크포인트에서 SSE 로 활성 LoginSession 을 받으면 LiveKit viewer 가
// 마운트되도록 분기를 추가한다.
export function LiveMonitorPage() {
  return (
    <div className={styles.shell}>
      <div className={styles.headerSlot}>
        <HeaderBar />
      </div>
      <div className={styles.body}>
        <section className={styles.placeholder}>
          <h1 className={styles.title}>아이가 아직 게임에 접속하지 않았어요</h1>
          <p className={styles.subtitle}>
            아이가 게임을 시작하면 이 화면에서 실시간으로 함께 볼 수 있어요.
          </p>
        </section>
      </div>
    </div>
  )
}
