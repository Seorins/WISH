import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { ScoreRing } from '@/features/dashboard/components/ScoreRing'
import { ArrowUpIcon } from '@/features/dashboard/components/icons'
import {
  ROM_RANGE_OPTIONS,
  type JointROMDetail,
  type JointROMScorePoint,
  type ROMRange,
} from '../data/mock'
import styles from './ROMAnalysisPanel.module.css'

type Props = {
  joint: JointROMDetail
}

function buildYDomain(values: number[]): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) return { domain: [0, 100], ticks: [0, 25, 50, 75, 100] }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const lower = Math.max(0, Math.floor((min - 5) / 10) * 10)
  const upper = Math.min(100, Math.ceil((max + 5) / 10) * 10)
  const span = upper - lower
  const step = span / 4
  return {
    domain: [lower, upper],
    ticks: [0, 1, 2, 3, 4].map(i => Math.round(lower + step * i)),
  }
}

export function ROMAnalysisPanel({ joint }: Props) {
  const [range, setRange] = useState<ROMRange>('week')

  const data: JointROMScorePoint[] = range === 'week' ? joint.weeklyTrend : joint.monthlyTrend
  const { domain, ticks } = buildYDomain(data.map(p => p.score))

  return (
    <article className={styles.panel}>
      <header className={styles.head}>
        <h2 className={styles.title}>{joint.name} 관절 가동 범위</h2>
        <div className={styles.toggle} role="tablist" aria-label="기간 선택">
          {ROM_RANGE_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={opt.id === range}
              className={`${styles.toggleItem} ${opt.id === range ? styles.toggleItemActive : ''}`}
              onClick={() => setRange(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      <section className={styles.chartSection}>
        <h3 className={styles.sectionTitle}>점수 추이</h3>
        <div className={styles.chartBody}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
              <defs>
                <linearGradient id={`rom-line-${joint.id}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#a892ff" />
                  <stop offset="100%" stopColor="#7c5cff" />
                </linearGradient>
                <linearGradient id={`rom-area-${joint.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a892ff" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#a892ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#ECE9F5" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10.5, fill: '#b6b4c8' }}
                tickLine={false}
                axisLine={false}
                padding={{ left: 8, right: 8 }}
                interval={data.length > 12 ? Math.ceil(data.length / 6) - 1 : 0}
              />
              <YAxis
                ticks={ticks}
                domain={domain}
                tick={{ fontSize: 10.5, fill: '#b6b4c8' }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Area
                type="linear"
                dataKey="score"
                stroke={`url(#rom-line-${joint.id})`}
                strokeWidth={2.5}
                fill={`url(#rom-area-${joint.id})`}
                dot={(props: {
                  cx?: number
                  cy?: number
                  index?: number
                  key?: string | number
                  payload?: JointROMScorePoint
                }) => {
                  const { cx = 0, cy = 0, index = 0, key, payload } = props
                  const isLast = index === data.length - 1
                  const showDot = data.length <= 12 || isLast
                  if (!showDot) {
                    return <circle key={key ?? `rom-dot-${index}`} cx={cx} cy={cy} r={0} />
                  }
                  return (
                    <g key={key ?? `rom-dot-${index}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isLast ? 5.5 : 3.5}
                        fill={isLast ? '#7c5cff' : '#fff'}
                        stroke={isLast ? '#fff' : '#7c5cff'}
                        strokeWidth={isLast ? 2.5 : 2}
                      />
                      {payload && (
                        <text
                          x={cx}
                          y={cy - 12}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={600}
                          fill="#3a345e"
                        >
                          {payload.score}
                        </text>
                      )}
                    </g>
                  )
                }}
                activeDot={{ r: 6, fill: '#7c5cff', stroke: '#fff', strokeWidth: 2.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className={styles.metricGrid}>
        <div className={`${styles.metricCard} ${styles.metricCardWithRing}`}>
          <div className={styles.metricBody}>
            <span className={styles.metricLabel}>현재 점수</span>
            <span className={styles.metricValue}>
              {joint.currentScore}
              <span className={styles.metricUnit}>/100</span>
            </span>
            <span className={styles.metricFoot}>
              {joint.currentScore >= 90
                ? '훌륭해요!'
                : joint.currentScore >= 80
                  ? '좋아요!'
                  : '꾸준히 해봐요'}
            </span>
          </div>
          <ScoreRing
            value={joint.currentScore}
            size={56}
            strokeWidth={6}
            fontSize={0}
            gradientFrom="#6ddec0"
            gradientTo="#34c99c"
          />
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>이전 대비</span>
          <span className={styles.metricValueRow}>
            <span className={styles.metricValueDelta}>+{joint.deltaPrev}</span>
            <span className={styles.metricBadge} aria-hidden>
              <ArrowUpIcon className={styles.metricBadgeIcon} />
            </span>
          </span>
          <span className={styles.metricFoot}>지난주 {joint.currentScore - joint.deltaPrev}점</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>개선 폭</span>
          <span className={styles.metricValueRow}>
            <span className={styles.metricValueDelta}>+{joint.improvement}</span>
            <span className={styles.metricBadge} aria-hidden>
              <ArrowUpIcon className={styles.metricBadgeIcon} />
            </span>
          </span>
          <span className={styles.metricFoot}>
            2주 전 {joint.currentScore - joint.improvement}점 대비
          </span>
        </div>

        <div className={`${styles.metricCard} ${styles.metricCardWithRing}`}>
          <div className={styles.metricBody}>
            <span className={styles.metricLabel}>좌/우 균형</span>
            <span className={styles.metricValue}>{joint.balance}%</span>
            <span className={styles.metricFootBalance}>균형이 좋아요</span>
          </div>
          <ScoreRing
            value={joint.balance}
            size={56}
            strokeWidth={6}
            fontSize={0}
            gradientFrom="#a892ff"
            gradientTo="#7c5cff"
          />
        </div>
      </section>

      <section className={styles.detailGrid}>
        <article className={styles.detailCard}>
          <header className={styles.detailHead}>
            <h3 className={styles.detailTitle}>좌/우 {joint.name} 비교</h3>
          </header>
          <div className={styles.balanceRow}>
            <div className={styles.balanceSide}>
              <span className={styles.balanceLabel}>왼쪽 {joint.name}</span>
              <span className={styles.balanceValue}>
                {joint.leftScore}
                <span className={styles.balanceUnit}>/100</span>
              </span>
              <div className={styles.balanceBar}>
                <span className={styles.balanceBarFill} style={{ width: `${joint.leftScore}%` }} />
              </div>
            </div>

            <div className={styles.balanceCenter}>
              <ScoreRing
                value={joint.balance}
                size={84}
                strokeWidth={8}
                fontSize={20}
                fontWeight={700}
                unit="%"
                showUnit
                gradientFrom="#a892ff"
                gradientTo="#7c5cff"
              />
              <span className={styles.balanceCenterLabel}>균형도</span>
            </div>

            <div className={styles.balanceSide}>
              <span className={styles.balanceLabel}>오른쪽 {joint.name}</span>
              <span className={styles.balanceValue}>
                {joint.rightScore}
                <span className={styles.balanceUnit}>/100</span>
              </span>
              <div className={styles.balanceBar}>
                <span className={styles.balanceBarFill} style={{ width: `${joint.rightScore}%` }} />
              </div>
            </div>
          </div>
        </article>

        <article className={`${styles.detailCard} ${styles.insightCard}`}>
          <header className={styles.detailHead}>
            <h3 className={styles.detailTitle}>
              <span className={styles.insightSparkle} aria-hidden>
                ✨
              </span>
              AI 인사이트
            </h3>
          </header>
          <p className={styles.insightText}>{joint.aiInsight}</p>
          <p className={styles.insightHint}>
            지속하면 재활/회복에 도움이 되는 운동을
            <br />
            계속해보아요!
          </p>
          <span className={styles.insightStar} aria-hidden>
            ⭐
          </span>
        </article>
      </section>

      <section className={styles.tipCard}>
        <span className={styles.tipIcon} aria-hidden>
          💡
        </span>
        <div className={styles.tipBody}>
          <span className={styles.tipLabel}>팁</span>
          <p className={styles.tipText}>{joint.tip}</p>
        </div>
      </section>
    </article>
  )
}
