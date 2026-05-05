import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import { ChevronLeftIcon } from '@/features/dashboard/components/icons'
import { JointStepNav } from '@/features/rom/components/JointStepNav'
import { ROMAnalysisPanel } from '@/features/rom/components/ROMAnalysisPanel'
import { ROMCharacter3D } from '@/features/rom/components/ROMCharacter3D'
import { JOINT_ROM_DETAILS, type JointId } from '@/features/rom/data/mock'
import '@/features/dashboard/tokens.css'
import styles from './ROMDetailPage.module.css'

export function ROMDetailPage() {
  const [activeId, setActiveId] = useState<JointId>('shoulder')
  const isProgrammaticScrollRef = useRef(false)
  const programmaticScrollTimerRef = useRef<number | null>(null)

  // ROM 상세 페이지에서만 가로 스크롤 차단 + 세로 스크롤바 시각 숨김
  useEffect(() => {
    document.body.classList.add('rom-no-scrollbar')
    return () => {
      document.body.classList.remove('rom-no-scrollbar')
    }
  }, [])

  useEffect(() => {
    const panels = JOINT_ROM_DETAILS.map(j =>
      document.getElementById(`joint-panel-${j.id}`),
    ).filter((el): el is HTMLElement => Boolean(el))
    if (panels.length === 0) return

    let rafId = 0
    const updateActive = () => {
      if (isProgrammaticScrollRef.current) return
      // 뷰포트 중앙선과 가장 가까운 패널을 활성으로
      const center = window.innerHeight * 0.45
      let bestId: JointId | null = null
      let bestDistance = Infinity
      for (const panel of panels) {
        const rect = panel.getBoundingClientRect()
        const panelCenter = rect.top + rect.height / 2
        const distance = Math.abs(panelCenter - center)
        if (distance < bestDistance) {
          bestDistance = distance
          bestId = panel.getAttribute('data-joint-id') as JointId | null
        }
      }
      if (bestId) {
        setActiveId(prev => (prev === bestId ? prev : bestId))
      }
    }

    const onScroll = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        updateActive()
      })
    }

    updateActive()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [])

  const handleSelect = useCallback((id: JointId) => {
    setActiveId(id)
    const target = document.getElementById(`joint-panel-${id}`)
    if (!target) return
    isProgrammaticScrollRef.current = true
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (programmaticScrollTimerRef.current !== null) {
      window.clearTimeout(programmaticScrollTimerRef.current)
    }
    programmaticScrollTimerRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false
    }, 700)
  }, [])

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
              <JointStepNav activeId={activeId} onSelect={handleSelect} />
            </div>
            <div className={styles.characterSlot}>
              <ROMCharacter3D focusJoint={activeId} />
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
