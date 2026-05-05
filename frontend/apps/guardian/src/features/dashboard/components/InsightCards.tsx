import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
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
        <CardTitle>Overall Movement Score</CardTitle>
      </header>
      <div className={styles.scoreBody}>
        <ScoreRing
          value={OVERALL_SCORE.current}
          size={108}
          strokeWidth={9}
          fontSize={32}
          gradientFrom="#6ddec0"
          gradientTo="#34c99c"
        />
        <div className={styles.scoreCopy}>
          <span className={styles.scoreTitle}>{OVERALL_SCORE.title}</span>
          <span className={styles.scoreSubtitle}>{OVERALL_SCORE.subtitle}</span>
          <span className={styles.scoreDelta}>
            <ArrowUpIcon className={styles.scoreDeltaIcon} />
            {OVERALL_SCORE.delta} pts
          </span>
        </div>
        <span className={styles.scoreStar} aria-hidden>
          ⭐
        </span>
      </div>
    </article>
  )
}

export function TrendChartCard() {
  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <CardTitle>Movement Trend</CardTitle>
        <button type="button" className={styles.cardAction}>
          Last 6 Sessions
          <ChevronDownIcon className={styles.cardActionChev} />
        </button>
      </header>
      <div className={styles.trendBody}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={TREND} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
            <defs>
              <linearGradient id="trend-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a892ff" />
                <stop offset="100%" stopColor="#7c5cff" />
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
              ticks={[0, 25, 50, 75, 100]}
              domain={[0, 100]}
              tick={{ fontSize: 10.5, fill: '#b6b4c8' }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="url(#trend-line)"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#fff', stroke: '#7c5cff', strokeWidth: 2 }}
              activeDot={{ r: 5.5, fill: '#7c5cff', stroke: '#fff', strokeWidth: 2.5 }}
            />
          </LineChart>
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
        <CardTitle>Range of Motion Summary</CardTitle>
        <button type="button" className={styles.cardAction}>
          Details
        </button>
      </header>
      <div className={styles.romGrid}>
        {RANGE_OF_MOTION.map(item => {
          const tone = ROM_TONE_CLASS[item.tone]
          return (
            <div key={item.joint} className={`${styles.romCell} ${tone.cell}`}>
              <span className={styles.romEmoji} aria-hidden>
                {item.emoji}
              </span>
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
