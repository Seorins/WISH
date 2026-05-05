import type { ReactNode } from 'react'
import styles from './DashboardLayout.module.css'

type Props = {
  sidebar: ReactNode
  header: ReactNode
  movementCard: ReactNode
  insightPanel: ReactNode
  bottomRow: ReactNode
}

export function DashboardLayout({ sidebar, header, movementCard, insightPanel, bottomRow }: Props) {
  return (
    <div className={styles.shell}>
      <div className={styles.sidebarSlot}>{sidebar}</div>
      <div className={styles.contentColumn}>
        <div className={styles.headerSlot}>{header}</div>
        <main className={styles.main}>
          <section className={styles.topGrid}>
            <div>{movementCard}</div>
            <div className={styles.rightStack}>{insightPanel}</div>
          </section>
          <section>{bottomRow}</section>
        </main>
      </div>
    </div>
  )
}
