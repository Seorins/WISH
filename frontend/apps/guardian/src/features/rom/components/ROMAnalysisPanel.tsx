import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { ScoreRing } from '@/features/dashboard/components/ScoreRing'
import type { RomJointDetail, RomJointTrendPoint } from '../data/model'
import { InfoTip } from './InfoTip'
import styles from './ROMAnalysisPanel.module.css'

type Props = {
  joint: RomJointDetail
}

function formatDeg(value: number | null): string {
  return typeof value === 'number' ? `${value.toFixed(1)}°` : '분석 불가'
}

function formatPercent(value: number | null): string {
  return typeof value === 'number' ? `${value}%` : '-'
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}초`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`
}

function buildYDomain(data: RomJointTrendPoint[]): { domain: [number, number]; ticks: number[] } {
  const values = data
    .map(point => point.rangeDeg)
    .filter((value): value is number => typeof value === 'number')
  const max = values.length > 0 ? Math.max(...values) : 30
  const upper = Math.min(180, Math.max(30, Math.ceil((max + 10) / 10) * 10))
  const tickStep = upper <= 60 ? 10 : 30
  const ticks: number[] = []
  for (let value = 0; value <= upper; value += tickStep) ticks.push(value)
  if (ticks[ticks.length - 1] !== upper) ticks.push(upper)
  return { domain: [0, upper], ticks }
}

function sideBarWidth(value: number | null, max: number): string {
  if (typeof value !== 'number' || max <= 0) return '0%'
  return `${Math.min(100, Math.round((value / max) * 100))}%`
}

export function ROMAnalysisPanel({ joint }: Props) {
  const { domain, ticks } = buildYDomain(joint.trend)
  const sideMax = Math.max(joint.leftRangeDeg ?? 0, joint.rightRangeDeg ?? 0, 1)
  const firstExcludedSegment = joint.excludedSegments[0]

  return (
    <article className={styles.panel}>
      <section className={styles.summaryCard}>
        <header className={styles.head}>
          <div>
            <h2 className={styles.title}>
              {joint.name} 움직임 범위
              <InfoTip tip="최근 체조 세션의 좌표 replay를 분석한 관절 각도 변화량입니다. 의료적 관절 가동 범위가 아니라 운동 중 움직임 기록으로 봐야 합니다." />
            </h2>
            <p className={styles.metaLine}>
              {joint.analyzedMotionCount}/{joint.motionCount}개 동작 분석 · 유효 프레임{' '}
              {joint.validFrameCount.toLocaleString()}개
            </p>
          </div>
        </header>

        <section className={styles.chartSection}>
          <h3 className={styles.sectionTitle}>
            동작별 각도 변화량
            <InfoTip tip="같은 세션 안에서 각 체조 동작마다 이 관절의 최소/최대 각도 차이를 계산한 값입니다." />
          </h3>
          <div className={styles.chartBody}>
            {joint.trend.length === 0 ? (
              <div className={styles.emptyChart}>분석 가능한 동작 데이터가 없습니다.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={joint.trend} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
                  <defs>
                    <linearGradient id={`rom-line-${joint.id}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6ddec0" />
                      <stop offset="100%" stopColor="#7c5cff" />
                    </linearGradient>
                    <linearGradient id={`rom-area-${joint.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#ECE9F5" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10.5, fill: '#b6b4c8' }}
                    tickLine={false}
                    axisLine={false}
                    padding={{ left: 8, right: 8 }}
                    interval={joint.trend.length > 6 ? Math.ceil(joint.trend.length / 6) - 1 : 0}
                  />
                  <YAxis
                    ticks={ticks}
                    domain={domain}
                    tick={{ fontSize: 10.5, fill: '#b6b4c8' }}
                    tickFormatter={value => `${value}°`}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Area
                    type="linear"
                    dataKey="rangeDeg"
                    stroke={`url(#rom-line-${joint.id})`}
                    strokeWidth={2.5}
                    fill={`url(#rom-area-${joint.id})`}
                    connectNulls={false}
                    dot={(props: {
                      cx?: number
                      cy?: number
                      index?: number
                      key?: string | number
                      payload?: RomJointTrendPoint
                    }) => {
                      const { cx = 0, cy = 0, index = 0, key, payload } = props
                      if (typeof payload?.rangeDeg !== 'number') {
                        return <circle key={key ?? `rom-dot-${index}`} cx={cx} cy={cy} r={0} />
                      }
                      return (
                        <g key={key ?? `rom-dot-${index}`}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill="#ffffff"
                            stroke="#7c5cff"
                            strokeWidth={2}
                          />
                          <text
                            x={cx}
                            y={cy - 12}
                            textAnchor="middle"
                            fontSize={11}
                            fontWeight={600}
                            fill="#3a345e"
                          >
                            {payload.rangeDeg.toFixed(1)}°
                          </text>
                        </g>
                      )
                    }}
                    activeDot={{ r: 6, fill: '#7c5cff', stroke: '#fff', strokeWidth: 2.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className={styles.metricGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>대표 범위</span>
            <span className={styles.metricValue}>{formatDeg(joint.currentRangeDeg)}</span>
            <span className={styles.metricFoot}>최근 세션 평균 각도 변화</span>
          </div>

          <div className={`${styles.metricCard} ${styles.metricCardWithRing}`}>
            <div className={styles.metricBody}>
              <span className={styles.metricLabel}>분석 커버리지</span>
              <span className={styles.metricValue}>{formatPercent(joint.coveragePercent)}</span>
              <span className={styles.metricFoot}>전체 프레임 중 사용 비율</span>
            </div>
            <ScoreRing
              className={styles.metricRing}
              value={joint.coveragePercent ?? 0}
              size={46}
              strokeWidth={5}
              fontSize={0}
              showUnit={false}
              gradientFrom="#6ddec0"
              gradientTo="#34c99c"
            />
          </div>

          <div className={`${styles.metricCard} ${styles.metricCardWithRing}`}>
            <div className={styles.metricBody}>
              <span className={styles.metricLabel}>좌표 신뢰도</span>
              <span className={styles.metricValue}>{formatPercent(joint.confidencePercent)}</span>
              <span className={styles.metricFoot}>confidence 평균</span>
            </div>
            <ScoreRing
              className={styles.metricRing}
              value={joint.confidencePercent ?? 0}
              size={46}
              strokeWidth={5}
              fontSize={0}
              showUnit={false}
              gradientFrom="#a892ff"
              gradientTo="#7c5cff"
            />
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>제외 시간</span>
            <span className={styles.metricValue}>{formatDuration(joint.excludedDurationMs)}</span>
            <span className={styles.metricFootWarning}>낮은 신뢰도 구간 제외</span>
          </div>
        </section>
      </section>

      <section className={styles.detailGrid}>
        <article className={styles.detailCard}>
          <header className={styles.detailHead}>
            <h3 className={styles.detailTitle}>
              좌우 {joint.name} 비교
              <InfoTip tip="왼쪽과 오른쪽 관절의 각도 변화량 평균을 비교합니다. 차이가 크면 한쪽 동작이 더 크게 기록된 것입니다." />
            </h3>
          </header>
          <div className={styles.balanceWrap}>
            <div className={styles.balanceRow}>
              <div className={styles.balanceSide}>
                <span className={styles.balanceLabel}>왼쪽 {joint.name}</span>
                <span className={styles.balanceValue}>{formatDeg(joint.leftRangeDeg)}</span>
                <div className={styles.balanceBar}>
                  <span
                    className={styles.balanceBarFill}
                    style={{ width: sideBarWidth(joint.leftRangeDeg, sideMax) }}
                  />
                </div>
              </div>

              <div className={styles.balanceCenter}>
                <ScoreRing
                  value={joint.confidencePercent ?? 0}
                  size={84}
                  strokeWidth={7}
                  fontSize={0}
                  showUnit={false}
                  gradientFrom="#a892ff"
                  gradientTo="#7c5cff"
                />
                <div className={styles.balanceCenterText}>
                  <span className={styles.balanceCenterValue}>
                    {formatPercent(joint.confidencePercent)}
                  </span>
                  <span className={styles.balanceCenterMeta}>신뢰도</span>
                </div>
              </div>

              <div className={styles.balanceSide}>
                <span className={styles.balanceLabel}>오른쪽 {joint.name}</span>
                <span className={styles.balanceValue}>{formatDeg(joint.rightRangeDeg)}</span>
                <div className={styles.balanceBar}>
                  <span
                    className={styles.balanceBarFill}
                    style={{ width: sideBarWidth(joint.rightRangeDeg, sideMax) }}
                  />
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className={`${styles.detailCard} ${styles.insightCard}`}>
          <header className={styles.detailHead}>
            <h3 className={styles.detailTitle}>
              <span className={styles.insightSparkle} aria-hidden>
                ✦
              </span>
              분석 메모
            </h3>
          </header>
          <p className={styles.insightText}>{joint.insight}</p>
          <p className={styles.insightHint}>
            분석 시간 {formatDuration(joint.analyzedDurationMs)}
            {firstExcludedSegment
              ? ` · 최근 제외 구간 ${formatDuration(firstExcludedSegment.startMs ?? 0)}~${formatDuration(
                  firstExcludedSegment.endMs ?? 0,
                )}`
              : ''}
          </p>
          <span className={styles.insightStar} aria-hidden>
            *
          </span>
        </article>
      </section>

      <section className={styles.tipCard}>
        <span className={styles.tipIcon} aria-hidden>
          i
        </span>
        <div className={styles.tipBody}>
          <span className={styles.tipLabel}>해석 기준</span>
          <p className={styles.tipText}>{joint.tip}</p>
        </div>
      </section>
    </article>
  )
}
