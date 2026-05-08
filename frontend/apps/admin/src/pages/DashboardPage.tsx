import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAdminDashboard } from '@wish/api-client'
import type {
  AdminDashboardAlert,
  AdminDashboardContentShare,
  AdminDashboardPatientActivity,
  AdminDashboardPatientStatus,
} from '@wish/api-client'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AdminShell } from '../shared/components/AdminShell'

type RangeDays = 7 | 14 | 30

const RANGE_OPTIONS: Array<{ days: RangeDays; label: string }> = [
  { days: 7, label: '7일' },
  { days: 14, label: '14일' },
  { days: 30, label: '30일' },
]

const CONTENT_COLORS: Record<string, string> = {
  login: '#486581',
  art: '#0b7285',
  music: '#5f3dc4',
  taekwondo: '#2f855a',
  gymnastics: '#c92a2a',
  ART: '#0b7285',
  MUSIC: '#5f3dc4',
  TAEKWONDO: '#2f855a',
  GYMNASTICS: '#c92a2a',
}

const STATUS_VIEW: Record<AdminDashboardPatientStatus, { label: string; style: CSSProperties }> = {
  ACTIVE: {
    label: '활발',
    style: { color: '#0b7285', background: '#e6f6ff', borderColor: '#b3ecff' },
  },
  NORMAL: {
    label: '관찰',
    style: { color: '#5f3dc4', background: '#f3f0ff', borderColor: '#d0bfff' },
  },
  RISK: {
    label: '위험',
    style: { color: '#c92a2a', background: '#fff5f5', borderColor: '#ffc9c9' },
  },
}

const numberFormat = new Intl.NumberFormat('ko-KR')
const shortDateFormat = new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit' })
const fullDateFormat = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function DashboardPage() {
  const [rangeDays, setRangeDays] = useState<RangeDays>(7)
  const dateRange = useMemo(() => createDateRange(rangeDays), [rangeDays])

  const dashboardQuery = useQuery({
    queryKey: ['admin-dashboard', dateRange.from, dateRange.to],
    queryFn: () => getAdminDashboard(dateRange).then(response => response.data),
    refetchInterval: 60_000,
  })

  const dashboard = dashboardQuery.data
  const usageChartData = useMemo(
    () =>
      dashboard?.dailyUsage.map(day => ({
        date: formatShortDate(day.date),
        login: day.login,
        art: day.art,
        music: day.music,
        taekwondo: day.taekwondo,
        gymnastics: day.gymnastics,
        activePatients: day.activePatients,
      })) ?? [],
    [dashboard],
  )
  const patientRows = useMemo(
    () => sortPatientActivities(dashboard?.patientActivities ?? []).slice(0, 12),
    [dashboard],
  )

  const actions = (
    <div style={styles.headerActions}>
      <div style={styles.segmented} role="group" aria-label="조회 기간">
        {RANGE_OPTIONS.map(option => (
          <button
            key={option.days}
            type="button"
            onClick={() => setRangeDays(option.days)}
            style={{
              ...styles.segmentButton,
              ...(rangeDays === option.days ? styles.segmentButtonActive : {}),
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => void dashboardQuery.refetch()}
        style={styles.refreshButton}
        disabled={dashboardQuery.isFetching}
      >
        {dashboardQuery.isFetching ? '갱신 중' : '새로고침'}
      </button>
    </div>
  )

  return (
    <AdminShell
      title="운영 대시보드"
      description="사용시간 집계 기반으로 오늘의 활동, 콘텐츠 편중, 위험 환자를 확인합니다."
      actions={actions}
    >
      {dashboardQuery.isLoading && <div style={styles.loading}>대시보드를 불러오는 중</div>}
      {dashboardQuery.isError && (
        <div style={styles.errorBox}>
          대시보드 조회 실패: {extractMessage(dashboardQuery.error)}
        </div>
      )}

      {dashboard && (
        <div style={styles.dashboard}>
          <section style={styles.kpiGrid}>
            <KpiCard
              label="총 보호자"
              value={`${formatNumber(dashboard.summary.guardianUsers)}명`}
              detail={`관리자 ${formatNumber(dashboard.summary.adminUsers)}명`}
            />
            <KpiCard
              label="환자 프로필"
              value={`${formatNumber(dashboard.summary.totalPatients)}명`}
              detail={`오늘 신규 ${formatNumber(dashboard.summary.newPatientsToday)}명`}
            />
            <KpiCard
              label="오늘 활성 환자"
              value={`${formatNumber(dashboard.summary.todayActivePatients)}명`}
              detail={`앱 사용 ${formatDuration(dashboard.summary.todayTotalSeconds)}`}
            />
            <KpiCard
              label="기간 앱 사용"
              value={formatDuration(dashboard.summary.periodTotalSeconds)}
              detail={`일 평균 앱 사용 ${formatDuration(dashboard.summary.averageDailySeconds)}`}
            />
            <KpiCard
              label="이탈 위험"
              value={`${formatNumber(dashboard.summary.atRiskPatients)}명`}
              detail="최근 7일 비활동 기준"
              tone={dashboard.summary.atRiskPatients > 0 ? 'risk' : 'normal'}
            />
            <KpiCard
              label="오늘 신규 계정"
              value={`${formatNumber(dashboard.summary.newUsersToday)}명`}
              detail="보호자/관리자 포함"
            />
          </section>

          <section style={styles.chartGrid}>
            <div style={styles.panelLarge}>
              <div style={styles.panelHeader}>
                <div>
                  <h2 style={styles.panelTitle}>일별 사용시간</h2>
                  <p style={styles.panelDescription}>
                    앱 사용시간은 선으로, 콘텐츠별 활동 시간은 막대로 표시합니다.
                  </p>
                </div>
                <span style={styles.periodBadge}>
                  {formatDateRange(dashboard.from, dashboard.to)}
                </span>
              </div>
              <div style={styles.chartFrame}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={usageChartData}
                    margin={{ top: 8, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#edf2f7" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                      tickFormatter={value => formatCompactDuration(Number(value))}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatDuration(Number(value)),
                        usageMetricLabel(String(name)),
                      ]}
                    />
                    <Legend formatter={value => usageMetricLabel(String(value))} />
                    <Bar dataKey="art" stackId="content" fill={CONTENT_COLORS.art} />
                    <Bar dataKey="music" stackId="content" fill={CONTENT_COLORS.music} />
                    <Bar dataKey="taekwondo" stackId="content" fill={CONTENT_COLORS.taekwondo} />
                    <Bar dataKey="gymnastics" stackId="content" fill={CONTENT_COLORS.gymnastics} />
                    <Line
                      type="monotone"
                      dataKey="login"
                      stroke={CONTENT_COLORS.login}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <h2 style={styles.panelTitle}>콘텐츠 비중</h2>
                  <p style={styles.panelDescription}>접속 시간을 제외한 활동 분포입니다.</p>
                </div>
              </div>
              <ContentSharePanel shares={dashboard.contentShares} />
            </div>
          </section>

          <section style={styles.chartGrid}>
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <h2 style={styles.panelTitle}>활성 환자 추이</h2>
                  <p style={styles.panelDescription}>하루 1초 이상 사용한 환자 수입니다.</p>
                </div>
              </div>
              <div style={styles.smallChartFrame}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={usageChartData}
                    margin={{ top: 8, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#edf2f7" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={value => [`${formatNumber(Number(value))}명`, '활성 환자']}
                    />
                    <Bar dataKey="activePatients" fill="#0b7285" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <h2 style={styles.panelTitle}>운영 알림</h2>
                  <p style={styles.panelDescription}>
                    발표에서 바로 말할 수 있는 관리 포인트입니다.
                  </p>
                </div>
              </div>
              <div style={styles.alertList}>
                {dashboard.alerts.map(alert => (
                  <AlertItem key={alert.type} alert={alert} />
                ))}
              </div>
            </div>
          </section>

          <section style={styles.tableSection}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>관심 환자 활동 현황</h2>
                <p style={styles.panelDescription}>
                  위험 상태를 우선 정렬하고 기간 앱 사용시간을 함께 표시합니다.
                </p>
              </div>
              <span style={styles.periodBadge}>상위 {formatNumber(patientRows.length)}명</span>
            </div>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>환자</th>
                    <th style={styles.th}>보호자</th>
                    <th style={styles.th}>오늘 앱 사용</th>
                    <th style={styles.th}>앱 사용 합계</th>
                    <th style={styles.th}>선호 콘텐츠</th>
                    <th style={styles.th}>마지막 활동</th>
                    <th style={styles.th}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {patientRows.length === 0 && (
                    <tr>
                      <td colSpan={7} style={styles.emptyRow}>
                        표시할 환자 활동이 없습니다.
                      </td>
                    </tr>
                  )}
                  {patientRows.map(patient => (
                    <tr key={patient.patientId}>
                      <td style={styles.nameCell}>
                        <strong>{patient.patientName}</strong>
                        <span style={styles.subText}>{patient.patientNickname}</span>
                      </td>
                      <td style={styles.emailCell}>{patient.guardianEmail}</td>
                      <td style={styles.td}>{formatDuration(patient.todaySeconds)}</td>
                      <td style={styles.td}>{formatDuration(patient.periodSeconds)}</td>
                      <td style={styles.td}>{patient.favoriteContent}</td>
                      <td style={styles.td}>{formatLastActiveDate(patient.lastActiveDate)}</td>
                      <td style={styles.td}>
                        <StatusBadge status={patient.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  )
}

function KpiCard({
  label,
  value,
  detail,
  tone = 'normal',
}: {
  label: string
  value: string
  detail: string
  tone?: 'normal' | 'risk'
}) {
  return (
    <article style={{ ...styles.kpiCard, ...(tone === 'risk' ? styles.kpiCardRisk : {}) }}>
      <span style={styles.kpiLabel}>{label}</span>
      <strong style={styles.kpiValue}>{value}</strong>
      <span style={styles.kpiDetail}>{detail}</span>
    </article>
  )
}

function ContentSharePanel({ shares }: { shares: AdminDashboardContentShare[] }) {
  const totalSeconds = shares.reduce((sum, share) => sum + share.totalSeconds, 0)
  return (
    <div style={styles.contentShareLayout}>
      <div style={styles.pieFrame}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shares}
              dataKey="totalSeconds"
              nameKey="label"
              innerRadius={54}
              outerRadius={82}
              paddingAngle={2}
            >
              {shares.map(share => (
                <Cell
                  key={share.contentType}
                  fill={CONTENT_COLORS[share.contentType] ?? '#486581'}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [formatDuration(Number(value)), String(name)]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={styles.shareList}>
        {shares.map(share => (
          <div key={share.contentType} style={styles.shareRow}>
            <span
              style={{
                ...styles.shareSwatch,
                background: CONTENT_COLORS[share.contentType] ?? '#486581',
              }}
            />
            <span style={styles.shareLabel}>{share.label}</span>
            <strong style={styles.shareValue}>
              {totalSeconds > 0 ? `${share.percentage.toFixed(1)}%` : '0%'}
            </strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function AlertItem({ alert }: { alert: AdminDashboardAlert }) {
  return (
    <article style={{ ...styles.alertItem, ...alertSeverityStyle(alert.severity) }}>
      <div style={styles.alertCount}>{formatNumber(alert.count)}</div>
      <div style={styles.alertBody}>
        <strong style={styles.alertTitle}>{alert.title}</strong>
        <span style={styles.alertDescription}>{alert.description}</span>
      </div>
    </article>
  )
}

function StatusBadge({ status }: { status: AdminDashboardPatientStatus }) {
  const view = STATUS_VIEW[status]
  return <span style={{ ...styles.statusBadge, ...view.style }}>{view.label}</span>
}

function createDateRange(days: RangeDays) {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - days + 1)
  return { from: toIsoDate(from), to: toIsoDate(to) }
}

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatShortDate(value: string) {
  return shortDateFormat.format(parseIsoDate(value))
}

function formatDateRange(from: string, to: string) {
  return `${formatShortDate(from)} - ${formatShortDate(to)}`
}

function formatLastActiveDate(value: string | null) {
  if (!value) return '기록 없음'
  return fullDateFormat.format(parseIsoDate(value))
}

function formatNumber(value: number) {
  return numberFormat.format(value)
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return '0분'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`
  if (hours > 0) return `${hours}시간`
  if (minutes > 0) return `${minutes}분`
  return `${seconds}초`
}

function formatCompactDuration(seconds: number) {
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`
  return `${seconds}s`
}

function usageMetricLabel(metric: string) {
  switch (metric) {
    case 'login':
      return '앱 사용'
    case 'art':
      return '미술'
    case 'music':
      return '음악'
    case 'taekwondo':
      return '태권도'
    case 'gymnastics':
      return '체조'
    default:
      return metric
  }
}

function sortPatientActivities(patients: AdminDashboardPatientActivity[]) {
  const priority: Record<AdminDashboardPatientStatus, number> = {
    RISK: 0,
    NORMAL: 1,
    ACTIVE: 2,
  }
  return [...patients].sort((left, right) => {
    const statusDiff = priority[left.status] - priority[right.status]
    if (statusDiff !== 0) return statusDiff
    return right.periodSeconds - left.periodSeconds
  })
}

function alertSeverityStyle(severity: AdminDashboardAlert['severity']): CSSProperties {
  if (severity === 'warning') {
    return {
      background: '#fff5f5',
      borderColor: '#ffc9c9',
    }
  }
  if (severity === 'info') {
    return {
      background: '#f3f0ff',
      borderColor: '#d0bfff',
    }
  }
  return {
    background: '#f8fafc',
    borderColor: '#d9e2ec',
  }
}

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const res = (error as { response?: { data?: { message?: string; code?: string } } }).response
    if (res?.data?.message) return res.data.message
    if (res?.data?.code) return res.data.code
  }
  if (error instanceof Error) return error.message
  return '알 수 없는 오류'
}

const styles: Record<string, CSSProperties> = {
  dashboard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  segmented: {
    display: 'inline-flex',
    padding: 3,
    background: '#f0f4f8',
    border: '1px solid #d9e2ec',
    borderRadius: 8,
    gap: 2,
  },
  segmentButton: {
    minWidth: 52,
    height: 30,
    padding: '0 10px',
    border: '1px solid transparent',
    borderRadius: 6,
    background: 'transparent',
    color: '#486581',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  segmentButtonActive: {
    background: '#fff',
    borderColor: '#bcccdc',
    color: '#102a43',
  },
  refreshButton: {
    height: 36,
    padding: '0 12px',
    background: '#0b7285',
    color: '#fff',
    border: '1px solid #0b7285',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 12,
  },
  kpiCard: {
    minHeight: 126,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 16,
    background: '#fff',
    border: '1px solid #d9e2ec',
    borderRadius: 8,
  },
  kpiCardRisk: {
    borderColor: '#ffc9c9',
    background: '#fffafa',
  },
  kpiLabel: {
    color: '#627d98',
    fontSize: 12,
    fontWeight: 700,
  },
  kpiValue: {
    display: 'block',
    color: '#102a43',
    fontSize: 24,
    lineHeight: 1.2,
    letterSpacing: 0,
  },
  kpiDetail: {
    color: '#829ab1',
    fontSize: 12,
    lineHeight: 1.35,
  },
  chartGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.55fr) minmax(320px, 0.95fr)',
    gap: 18,
  },
  panel: {
    minWidth: 0,
    padding: 18,
    background: '#fff',
    border: '1px solid #d9e2ec',
    borderRadius: 8,
  },
  panelLarge: {
    minWidth: 0,
    padding: 18,
    background: '#fff',
    border: '1px solid #d9e2ec',
    borderRadius: 8,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  panelTitle: {
    margin: 0,
    color: '#102a43',
    fontSize: 16,
    lineHeight: 1.3,
    letterSpacing: 0,
  },
  panelDescription: {
    margin: '4px 0 0',
    color: '#829ab1',
    fontSize: 12,
    lineHeight: 1.45,
  },
  periodBadge: {
    whiteSpace: 'nowrap',
    padding: '5px 8px',
    background: '#f0f4f8',
    border: '1px solid #d9e2ec',
    borderRadius: 6,
    color: '#486581',
    fontSize: 12,
    fontWeight: 700,
  },
  chartFrame: {
    width: '100%',
    height: 300,
  },
  smallChartFrame: {
    width: '100%',
    height: 220,
  },
  contentShareLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(180px, 1fr) minmax(150px, 0.8fr)',
    alignItems: 'center',
    gap: 12,
  },
  pieFrame: {
    width: '100%',
    height: 230,
  },
  shareList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
  },
  shareRow: {
    display: 'grid',
    gridTemplateColumns: '14px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 8,
    minHeight: 30,
  },
  shareSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  shareLabel: {
    color: '#486581',
    fontSize: 13,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  shareValue: {
    color: '#102a43',
    fontSize: 13,
  },
  alertList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  alertItem: {
    minHeight: 72,
    display: 'grid',
    gridTemplateColumns: '42px minmax(0, 1fr)',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    border: '1px solid #d9e2ec',
    borderRadius: 8,
  },
  alertCount: {
    width: 42,
    height: 42,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 8,
    background: '#fff',
    border: '1px solid rgba(16, 42, 67, 0.12)',
    color: '#102a43',
    fontWeight: 800,
    fontSize: 15,
  },
  alertBody: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  alertTitle: {
    color: '#102a43',
    fontSize: 13,
  },
  alertDescription: {
    color: '#627d98',
    fontSize: 12,
    lineHeight: 1.45,
  },
  tableSection: {
    padding: 18,
    background: '#fff',
    border: '1px solid #d9e2ec',
    borderRadius: 8,
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #d9e2ec',
    borderRadius: 8,
  },
  table: {
    width: '100%',
    minWidth: 920,
    borderCollapse: 'separate',
    borderSpacing: 0,
  },
  th: {
    padding: '11px 12px',
    textAlign: 'left',
    fontSize: 12,
    color: '#486581',
    background: '#f8fafc',
    borderBottom: '1px solid #d9e2ec',
  },
  td: {
    padding: 12,
    borderBottom: '1px solid #edf2f7',
    color: '#334e68',
    fontSize: 13,
    verticalAlign: 'middle',
  },
  nameCell: {
    width: 150,
    padding: 12,
    borderBottom: '1px solid #edf2f7',
    color: '#102a43',
    fontSize: 13,
    verticalAlign: 'middle',
  },
  subText: {
    display: 'block',
    marginTop: 3,
    color: '#829ab1',
    fontSize: 12,
    fontWeight: 500,
  },
  emailCell: {
    maxWidth: 230,
    padding: 12,
    borderBottom: '1px solid #edf2f7',
    color: '#486581',
    fontSize: 13,
    verticalAlign: 'middle',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusBadge: {
    minWidth: 54,
    display: 'inline-flex',
    justifyContent: 'center',
    padding: '4px 8px',
    border: '1px solid transparent',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 800,
  },
  emptyRow: {
    padding: 28,
    textAlign: 'center',
    color: '#829ab1',
    fontSize: 13,
  },
  loading: {
    padding: 20,
    background: '#fff',
    border: '1px solid #d9e2ec',
    borderRadius: 8,
    color: '#486581',
  },
  errorBox: {
    padding: 12,
    marginBottom: 12,
    background: '#fff5f5',
    color: '#c92a2a',
    border: '1px solid #ffc9c9',
    borderRadius: 8,
    fontSize: 13,
  },
}
