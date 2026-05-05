import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import '@/features/dashboard/tokens.css'
import styles from './ROMDetailPage.module.css'

export function ROMDetailPage() {
  return (
    <div className={styles.shell}>
      <div className={styles.headerSlot}>
        <HeaderBar />
      </div>
      <main className={styles.main}>
        <div className={styles.placeholder}>관절 가동 범위 상세 화면 (구성 중)</div>
      </main>
    </div>
  )
}
