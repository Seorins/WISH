import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout'
import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import {
  OverallScoreCard,
  ROMSummaryCard,
  TrendChartCard,
} from '@/features/dashboard/components/InsightCards'
import { MovementProgressCard } from '@/features/dashboard/components/MovementProgressCard'
import { Sidebar } from '@/features/dashboard/components/Sidebar'
import '@/features/dashboard/tokens.css'
import styles from './DashboardPage.module.css'

export function DashboardPage() {
  return (
    <DashboardLayout
      sidebar={<Sidebar />}
      header={<HeaderBar />}
      movementCard={<MovementProgressCard />}
      insightPanel={
        <>
          <OverallScoreCard />
          <TrendChartCard />
          <ROMSummaryCard />
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
