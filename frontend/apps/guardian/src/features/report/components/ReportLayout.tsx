import type { ReactNode } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@/features/dashboard/components/icons'
import type { ReportRangeMode } from '../hooks'
import type { WeekRange } from '../data/types'
import { formatWeekLabel } from '../data/week'
import styles from './ReportLayout.module.css'

type Props = {
  header: ReactNode
  week: WeekRange
  mode: ReportRangeMode
  isCurrentWeek: boolean
  onPrev: () => void
  onNext: () => void
  onCurrent: () => void
  onModeChange: (mode: ReportRangeMode) => void
  leftColumn: ReactNode
  rightColumn: ReactNode
}

export function ReportLayout({
  header,
  week,
  mode,
  isCurrentWeek,
  onPrev,
  onNext,
  onCurrent,
  onModeChange,
  leftColumn,
  rightColumn,
}: Props) {
  return (
    <div className={styles.shell}>
      <div className={styles.headerSlot}>{header}</div>
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.weekNav}>
              <button
                type="button"
                className={styles.weekNavBtn}
                onClick={onPrev}
                aria-label="이전 주"
              >
                <ChevronLeftIcon className={styles.weekNavBtnIcon} />
              </button>
              <span className={styles.weekNavLabel}>{formatWeekLabel(week)}</span>
              <button
                type="button"
                className={styles.weekNavBtn}
                onClick={onNext}
                disabled={isCurrentWeek}
                aria-label="다음 주"
              >
                <ChevronRightIcon className={styles.weekNavBtnIcon} />
              </button>
            </div>
            {!isCurrentWeek && (
              <button type="button" className={styles.thisWeekBtn} onClick={onCurrent}>
                이번 주로
              </button>
            )}
          </div>
          <div className={styles.modeSwitch} role="tablist" aria-label="기간 단위">
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === 'weekly' ? styles.modeBtnActive : ''}`}
              onClick={() => onModeChange('weekly')}
              role="tab"
              aria-selected={mode === 'weekly'}
            >
              주간
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === 'monthly' ? styles.modeBtnActive : ''}`}
              onClick={() => onModeChange('monthly')}
              role="tab"
              aria-selected={mode === 'monthly'}
            >
              월간
            </button>
          </div>
        </div>

        <section className={styles.grid}>
          <div className={styles.column}>{leftColumn}</div>
          <div className={styles.column}>{rightColumn}</div>
        </section>
      </main>
    </div>
  )
}
