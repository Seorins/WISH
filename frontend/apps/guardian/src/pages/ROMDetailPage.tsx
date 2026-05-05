import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import { ChevronLeftIcon } from '@/features/dashboard/components/icons'
import { JointStepNav } from '@/features/rom/components/JointStepNav'
import { ROMAnalysisPanel } from '@/features/rom/components/ROMAnalysisPanel'
import { JOINT_ROM_DETAILS, type JointId } from '@/features/rom/data/mock'
import '@/features/dashboard/tokens.css'
import styles from './ROMDetailPage.module.css'

export function ROMDetailPage() {
  const [activeId, setActiveId] = useState<JointId>('shoulder')

  return (
    <div className={styles.shell}>
      <div className={styles.headerSlot}>
        <HeaderBar />
      </div>

      <main className={styles.main}>
        <aside className={styles.leftCol}>
          <article className={styles.leftCard}>
            <header className={styles.leftHead}>
              <Link to="/" className={styles.backBtn} aria-label="대시보드로 돌아가기">
                <ChevronLeftIcon className={styles.backIcon} />
                <span>관절 가동 범위</span>
              </Link>
            </header>
            <div className={styles.stepNavSlot}>
              <JointStepNav activeId={activeId} onSelect={setActiveId} />
            </div>
            <div className={styles.characterSlot}>
              <div className={styles.characterPlaceholder} aria-hidden>
                <span className={styles.placeholderLabel}>
                  {JOINT_ROM_DETAILS.find(j => j.id === activeId)?.name} 줌인 영역
                </span>
              </div>
            </div>
          </article>
        </aside>

        <section className={styles.rightCol}>
          {JOINT_ROM_DETAILS.map(joint => (
            <article
              key={joint.id}
              id={`joint-panel-${joint.id}`}
              data-joint-id={joint.id}
              className={styles.panel}
            >
              <div className={styles.panelInner}>
                <ROMAnalysisPanel joint={joint} />
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
