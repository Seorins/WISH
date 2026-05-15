import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { ScoreRing } from '@/features/dashboard/components/ScoreRing'
import type { RomJointDetail, RomJointTrendPoint } from '../data/model'
import { InfoTip } from './InfoTip'
import styles from './ROMAnalysisPanel.module.css'

type Props = {
  joint: RomJointDetail
}

function formatDeg(value: number | null): string {
  return typeof value === 'number' ? `약 ${value.toFixed(1)}도` : '확인 불가'
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

function rangeGap(left: number | null, right: number | null): number | null {
  if (left === null || right === null) return null
  return Math.abs(left - right)
}

function buildBalanceLabel(joint: RomJointDetail): string {
  const gap = rangeGap(joint.leftRangeDeg, joint.rightRangeDeg)
  if (gap === null) return '좌우 비교 준비 중'
  if (gap < 10) return '좌우가 비슷해요'
  if (gap < 20) return '조금 차이가 있어요'
  return '차이가 크게 기록됐어요'
}

function buildBalanceSummary(joint: RomJointDetail): string {
  const gap = rangeGap(joint.leftRangeDeg, joint.rightRangeDeg)
  if (gap === null) return '왼쪽과 오른쪽을 함께 확인할 수 있는 기록이 더 필요해요.'
  if (gap < 10)
    return '양쪽 움직임이 비슷하게 기록됐어요. 걱정보다는 오늘 움직임의 균형을 보는 참고값으로 봐 주세요.'
  if (gap < 20)
    return '한쪽이 조금 더 크게 움직인 것으로 기록됐어요. 통증을 뜻하는 값은 아니고 오늘 촬영된 움직임 차이입니다.'
  return '한쪽 움직임이 더 크게 기록됐어요. 다음 체조 때 같은 동작에서 반복되는지 한 번 더 확인해 주세요.'
}

function buildNextAction(joint: RomJointDetail): string {
  const gap = rangeGap(joint.leftRangeDeg, joint.rightRangeDeg)
  if (!joint.analysisAvailable) return '다음에는 아이의 전신이 화면 중앙에 보이도록 도와주세요.'
  if ((joint.confidencePercent ?? 0) < 60 || joint.excludedDurationMs > 0) {
    return '다음 촬영 때는 카메라를 조금 멀리 두고, 팔과 다리가 화면 밖으로 나가지 않게 해 주세요.'
  }
  if (gap !== null && gap >= 15) {
    return '다음 체조 때 같은 동작에서 좌우 차이가 반복되는지 한 번만 더 확인해 주세요.'
  }
  return '지금처럼 짧게 반복해도 충분해요. 다음 기록에서도 비슷한 흐름인지 보면 됩니다.'
}

export function ROMAnalysisPanel({ joint }: Props) {
  const { domain, ticks } = buildYDomain(joint.trend)
  const sideMax = Math.max(joint.leftRangeDeg ?? 0, joint.rightRangeDeg ?? 0, 1)
  const firstExcludedSegment = joint.excludedSegments[0]
  const balanceLabel = buildBalanceLabel(joint)
  const balanceSummary = buildBalanceSummary(joint)
  const nextAction = buildNextAction(joint)

  return (
    <article className={styles.panel}>
      <section className={styles.summaryCard}>
        <header className={styles.head}>
          <div>
            <h2 className={styles.title}>
              {joint.name} 움직임 기록
              <InfoTip tip="최근 체조에서 이 관절이 얼마나 접히고 펴졌는지 각도로 보여줍니다. 100점 만점의 점수가 아니라 움직인 각도입니다." />
            </h2>
            <p className={styles.metaLine}>
              {joint.analyzedMotionCount}/{joint.motionCount}개 동작 확인 · 촬영 안정도{' '}
              {formatPercent(joint.confidencePercent)}
            </p>
          </div>
        </header>

        <section className={styles.guardianNote}>
          <span className={styles.guardianNoteLabel}>보호자 요약</span>
          <strong>{joint.insight}</strong>
          <p>
            근거 수치: 평균 움직임 {formatDeg(joint.currentRangeDeg)} · 왼쪽{' '}
            {formatDeg(joint.leftRangeDeg)} · 오른쪽 {formatDeg(joint.rightRangeDeg)}
          </p>
        </section>

        <section className={styles.chartSection}>
          <h3 className={styles.sectionTitle}>
            동작별 움직인 각도
            <InfoTip tip="각 체조 동작에서 이 관절이 가장 적게 접힌 순간과 가장 많이 접힌 순간의 차이입니다." />
          </h3>
          <div className={styles.chartBody}>
            {joint.trend.length === 0 ? (
              <div className={styles.emptyChart}>확인할 수 있는 동작 기록이 없습니다.</div>
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
                    tickFormatter={value => `${value}도`}
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
                            {payload.rangeDeg.toFixed(1)}도
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

        <section className={styles.metricSection}>
          <h3 className={styles.sectionTitle}>자세한 수치</h3>
          <div className={styles.metricGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>평균 움직임</span>
              <span className={styles.metricValue}>{formatDeg(joint.currentRangeDeg)}</span>
              <span className={styles.metricFoot}>100점이 아니라 움직인 각도입니다</span>
            </div>

            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>확인된 동작</span>
              <span className={styles.metricValue}>
                {joint.analyzedMotionCount}/{joint.motionCount}개
              </span>
              <span className={styles.metricFoot}>관절이 화면에 잡힌 동작</span>
            </div>

            <div className={`${styles.metricCard} ${styles.metricCardWithRing}`}>
              <div className={styles.metricBody}>
                <span className={styles.metricLabel}>촬영 안정도</span>
                <span className={styles.metricValue}>{formatPercent(joint.confidencePercent)}</span>
                <span className={styles.metricFoot}>카메라가 관절을 잡은 정도</span>
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
              <span className={styles.metricLabel}>잘 안 보인 시간</span>
              <span className={styles.metricValue}>{formatDuration(joint.excludedDurationMs)}</span>
              <span className={styles.metricFootWarning}>관절 위치가 불안정한 구간</span>
            </div>
          </div>
        </section>
      </section>

      <section className={styles.detailGrid}>
        <article className={styles.detailCard}>
          <header className={styles.detailHead}>
            <h3 className={styles.detailTitle}>
              좌우 {joint.name} 움직임 비교
              <InfoTip tip="왼쪽과 오른쪽 관절이 각각 얼마나 움직였는지 비교합니다. 값이 커도 점수가 높은 것이 아니라 더 크게 움직였다는 뜻입니다." />
            </h3>
          </header>
          <div className={styles.balanceWrap}>
            <div className={styles.balanceRow}>
              <div className={styles.balanceSide}>
                <span className={styles.balanceLabel}>왼쪽 {joint.name} 움직임</span>
                <span className={styles.balanceValue}>{formatDeg(joint.leftRangeDeg)}</span>
                <div className={styles.balanceBar}>
                  <span
                    className={styles.balanceBarFill}
                    style={{ width: sideBarWidth(joint.leftRangeDeg, sideMax) }}
                  />
                </div>
              </div>

              <div className={styles.balanceCenter}>
                <strong>{balanceLabel}</strong>
                <span>차이 {formatDeg(rangeGap(joint.leftRangeDeg, joint.rightRangeDeg))}</span>
              </div>

              <div className={styles.balanceSide}>
                <span className={styles.balanceLabel}>오른쪽 {joint.name} 움직임</span>
                <span className={styles.balanceValue}>{formatDeg(joint.rightRangeDeg)}</span>
                <div className={styles.balanceBar}>
                  <span
                    className={styles.balanceBarFill}
                    style={{ width: sideBarWidth(joint.rightRangeDeg, sideMax) }}
                  />
                </div>
              </div>
            </div>
            <p className={styles.balanceSummary}>{balanceSummary}</p>
          </div>
        </article>

        <article className={`${styles.detailCard} ${styles.insightCard}`}>
          <header className={styles.detailHead}>
            <h3 className={styles.detailTitle}>
              <span className={styles.insightSparkle} aria-hidden>
                ✦
              </span>
              확인 메모
            </h3>
          </header>
          <p className={styles.insightText}>{joint.insight}</p>
          <div className={styles.nextAction}>
            <span>다음에 해볼 것</span>
            <strong>{nextAction}</strong>
          </div>
          <p className={styles.insightHint}>
            확인한 시간 {formatDuration(joint.analyzedDurationMs)}
            {firstExcludedSegment
              ? ` · 제외 구간 ${formatDuration(firstExcludedSegment.startMs ?? 0)}~${formatDuration(
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
          <span className={styles.tipLabel}>보는 기준</span>
          <p className={styles.tipText}>{joint.tip}</p>
        </div>
      </section>
    </article>
  )
}
