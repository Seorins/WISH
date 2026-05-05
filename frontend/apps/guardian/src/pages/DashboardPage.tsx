import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout'
import '@/features/dashboard/tokens.css'
import styles from './DashboardPage.module.css'

export function DashboardPage() {
  return (
    <DashboardLayout
      sidebar={<div className={styles.placeholderSidebar}>Sidebar</div>}
      header={<div className={styles.placeholderHeader}>Header</div>}
      movementCard={<div className={styles.placeholderTall}>Movement Progress</div>}
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
