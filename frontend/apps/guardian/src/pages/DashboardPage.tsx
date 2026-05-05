import { Character3D } from '@/features/dashboard/components/Character3D'
import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout'
import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import { Sidebar } from '@/features/dashboard/components/Sidebar'
import '@/features/dashboard/tokens.css'
import styles from './DashboardPage.module.css'

export function DashboardPage() {
  return (
    <DashboardLayout
      sidebar={<Sidebar />}
      header={<HeaderBar />}
      movementCard={
        <div className={styles.placeholderTall} style={{ padding: 0, border: 'none' }}>
          <Character3D />
        </div>
      }
      insightPanel={
        <>
          <div className={styles.placeholder} style={{ minHeight: 168 }}>
            Overall Score
          </div>
          <div className={styles.placeholder} style={{ minHeight: 192 }}>
            Movement Trend
          </div>
          <div className={styles.placeholder} style={{ minHeight: 168 }}>
            Range of Motion
          </div>
        </>
      }
      bottomRow={
        <div className={styles.bottomRow}>
          <div className={styles.placeholderShort}>Recent Sessions</div>
          <div className={styles.placeholderShort}>Next Session</div>
        </div>
      }
    />
  )
}
