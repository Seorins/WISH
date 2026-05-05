import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { OVERALL_SCORE, RANGE_OF_MOTION, TREND, type RangeOfMotion } from '../data/mock'
import { ArrowUpIcon, ChevronDownIcon, InfoIcon } from './icons'
import { ScoreRing } from './ScoreRing'
import styles from './InsightCards.module.css'

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className={styles.cardTitle}>
      {children}
      <InfoIcon className={styles.cardTitleIcon} />
    </h3>
  )
}

export function OverallScoreCard() {
  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <CardTitle>전체 동작 점수</CardTitle>
      </header>
      <div className={styles.scoreBody}>
        <ScoreRing
          value={OVERALL_SCORE.current}
          size={90}
          strokeWidth={8}
          fontSize={26}
          gradientFrom="#6ddec0"
          gradientTo="#34c99c"
        />
        <div className={styles.scoreCopy}>
          <span className={styles.scoreTitle}>{OVERALL_SCORE.title}</span>
          <span className={styles.scoreSubtitle}>{OVERALL_SCORE.subtitle}</span>
          <span className={styles.scoreDelta}>
            <ArrowUpIcon className={styles.scoreDeltaIcon} />
            {OVERALL_SCORE.delta}점
          </span>
        </div>
        <span className={styles.scoreStar} aria-hidden>
          ⭐
        </span>
      </div>
    </article>
  )
}

function buildYDomain(values: number[]): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) return { domain: [0, 100], ticks: [0, 25, 50, 75, 100] }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const lower = Math.max(0, Math.floor((min - 5) / 10) * 10)
  const upper = Math.min(100, Math.ceil((max + 5) / 10) * 10)
  const span = upper - lower
  const step = span / 4
  const ticks = [0, 1, 2, 3, 4].map(i => Math.round(lower + step * i))
  return { domain: [lower, upper], ticks }
}

export function TrendChartCard() {
  const { domain, ticks } = buildYDomain(TREND.map(t => t.score))
  return (
    <article className={`${styles.card} ${styles.cardFlex}`}>
      <header className={styles.cardHead}>
        <CardTitle>동작 추세</CardTitle>
        <button type="button" className={styles.cardAction}>
          최근 6회
          <ChevronDownIcon className={styles.cardActionChev} />
        </button>
      </header>
      <div className={styles.trendBody}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={TREND} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
            <defs>
              <linearGradient id="trend-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a892ff" />
                <stop offset="100%" stopColor="#7c5cff" />
              </linearGradient>
              <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a892ff" stopOpacity={0.35} />
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
              stroke="url(#trend-line)"
              strokeWidth={2.5}
              fill="url(#trend-area)"
              dot={(props: { cx?: number; cy?: number; index?: number; key?: string | number }) => {
                const { cx = 0, cy = 0, index = 0, key } = props
                const isLast = index === TREND.length - 1
                return (
                  <circle
                    key={key ?? `trend-dot-${index}`}
                    cx={cx}
                    cy={cy}
                    r={isLast ? 5.5 : 3.5}
                    fill={isLast ? '#7c5cff' : '#fff'}
                    stroke={isLast ? '#fff' : '#7c5cff'}
                    strokeWidth={isLast ? 2.5 : 2}
                  />
                )
              }}
              activeDot={{ r: 6, fill: '#7c5cff', stroke: '#fff', strokeWidth: 2.5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}

const ROM_TONE_CLASS: Record<RangeOfMotion['tone'], { cell: string; rating: string }> = {
  mint: { cell: styles.romCellMint, rating: styles.romRatingMint },
  lavender: { cell: styles.romCellLavender, rating: styles.romRatingLavender },
  pink: { cell: styles.romCellPink, rating: styles.romRatingPink },
  cyan: { cell: styles.romCellCyan, rating: styles.romRatingCyan },
}

export function ROMSummaryCard() {
  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <CardTitle>관절 가동 범위</CardTitle>
        <button type="button" className={styles.cardAction}>
          상세 보기
        </button>
      </header>
      <div className={styles.romGrid}>
        {RANGE_OF_MOTION.map(item => {
          const tone = ROM_TONE_CLASS[item.tone]
          return (
            <div key={item.joint} className={`${styles.romCell} ${tone.cell}`}>
              <span className={styles.romJoint}>{item.joint}</span>
              <span className={styles.romPercent}>{item.percent}%</span>
              <span className={`${styles.romRating} ${tone.rating}`}>{item.rating}</span>
            </div>
          )
        })}
      </div>
    </article>
  )
}
