import { EXERCISE_SESSION_ERROR_MESSAGE } from '@wish/api-client'
import type { CSSProperties } from 'react'
import { useExerciseSessions } from './hooks'
import { resolvePatientProfileId } from './patientProfile'
import {
  buildExerciseSessionReportSummary,
  formatAccuracy,
  formatDateTime,
  formatDurationSec,
  formatExerciseType,
} from './format'

type ExerciseSessionListOverlayProps = {
  open: boolean
  onClose: () => void
}

const overlayStyles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(31, 26, 21, 0.52)',
    fontFamily:
      '"Pretendard Variable", Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, sans-serif',
  },
  panel: {
    width: 'min(720px, calc(100vw - 32px))',
    maxHeight: 'min(760px, calc(100vh - 32px))',
    overflow: 'auto',
    borderRadius: 8,
    border: '3px solid #7f5a32',
    background: '#fff7e8',
    boxShadow: '0 18px 42px rgba(35, 24, 13, 0.28)',
    padding: 24,
    color: '#3e2a18',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  title: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.25,
  },
  closeButton: {
    border: 0,
    borderRadius: 6,
    padding: '9px 13px',
    background: '#6d4a27',
    color: '#fff8ec',
    fontWeight: 700,
    cursor: 'pointer',
  },
  message: {
    margin: '22px 0',
    borderRadius: 8,
    background: '#f2e2c8',
    padding: 18,
    fontWeight: 700,
  },
  retryButton: {
    marginTop: 12,
    border: 0,
    borderRadius: 6,
    padding: '10px 14px',
    background: '#8a6339',
    color: '#fff8ec',
    fontWeight: 700,
    cursor: 'pointer',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10,
    marginBottom: 18,
  },
  summaryItem: {
    borderRadius: 8,
    background: '#f4e5ca',
    padding: 12,
  },
  summaryLabel: {
    display: 'block',
    marginBottom: 4,
    fontSize: 13,
    color: '#73583b',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 800,
  },
  list: {
    display: 'grid',
    gap: 12,
  },
  card: {
    borderRadius: 8,
    border: '2px solid #d6bd92',
    background: '#fffdf8',
    padding: 16,
  },
  cardTitle: {
    margin: '0 0 10px',
    fontSize: 18,
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 8,
    fontSize: 14,
  },
} satisfies Record<string, CSSProperties>

export function ExerciseSessionListOverlay({ open, onClose }: ExerciseSessionListOverlayProps) {
  const patientProfileId = resolvePatientProfileId()
  const { data = [], isLoading, isError, refetch } = useExerciseSessions(patientProfileId)
  const summary = buildExerciseSessionReportSummary(data)

  if (!open) return null

  return (
    <div style={overlayStyles.backdrop} role="dialog" aria-modal="true">
      <section style={overlayStyles.panel}>
        <header style={overlayStyles.header}>
          <h2 style={overlayStyles.title}>체조 세션 기록</h2>
          <button type="button" style={overlayStyles.closeButton} onClick={onClose}>
            닫기
          </button>
        </header>

        {!patientProfileId && (
          <p style={overlayStyles.message}>환자 프로필을 선택한 뒤 기록을 확인할 수 있습니다.</p>
        )}

        {patientProfileId && isLoading && (
          <p style={overlayStyles.message}>체조 세션 기록을 불러오는 중입니다.</p>
        )}

        {patientProfileId && isError && (
          <div style={overlayStyles.message}>
            <p>{EXERCISE_SESSION_ERROR_MESSAGE}</p>
            <button type="button" style={overlayStyles.retryButton} onClick={() => void refetch()}>
              다시 시도
            </button>
          </div>
        )}

        {patientProfileId && !isLoading && !isError && data.length === 0 && (
          <p style={overlayStyles.message}>아직 기록된 체조 세션이 없습니다.</p>
        )}

        {patientProfileId && !isLoading && !isError && data.length > 0 && (
          <>
            <div style={overlayStyles.summaryGrid}>
              <SummaryItem label="총 체조 세션" value={`${summary.totalSessionCount}회`} />
              <SummaryItem
                label="총 운동 시간"
                value={formatDurationSec(summary.totalDurationSec)}
              />
              <SummaryItem label="평균 정확도" value={formatAccuracy(summary.averageAccuracy)} />
              <SummaryItem label="완료 동작 수" value={`${summary.totalCompletedMotionCount}개`} />
              <SummaryItem label="최근 운동일" value={formatDateTime(summary.latestSessionAt)} />
            </div>

            <div style={overlayStyles.list}>
              {data.map(session => (
                <article key={session.id} style={overlayStyles.card}>
                  <h3 style={overlayStyles.cardTitle}>
                    운동 종류: {formatExerciseType(session.exerciseType)}
                  </h3>
                  <div style={overlayStyles.detailGrid}>
                    <span>운동 시간: {formatDurationSec(session.durationSec)}</span>
                    <span>평균 정확도: {formatAccuracy(session.averageAccuracy)}</span>
                    <span>완료 동작: {session.completedMotionCount}개</span>
                    <span>날짜: {formatDateTime(session.createdAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={overlayStyles.summaryItem}>
      <span style={overlayStyles.summaryLabel}>{label}</span>
      <strong style={overlayStyles.summaryValue}>{value}</strong>
    </div>
  )
}
