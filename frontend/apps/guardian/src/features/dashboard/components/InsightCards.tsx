import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import {
  OVERALL_SCORE,
  RANGE_OF_MOTION,
  TREND,
  TREND_RANGE_OPTIONS,
  type RangeOfMotion,
  type TrendRangeId,
} from '../data/mock'
import { ArrowUpIcon, ChevronDownIcon, InfoIcon } from './icons'
import { ScoreRing } from './ScoreRing'
import styles from './InsightCards.module.css'

function CardTitle({ children, tip }: { children: React.ReactNode; tip?: string }) {
  return (
    <h3 className={styles.cardTitle}>
      {children}
      <span className={styles.infoTip} tabIndex={0} role="button" aria-label="설명 보기">
        <InfoIcon className={styles.cardTitleIcon} />
        {tip && (
          <span className={styles.tooltip} role="tooltip">
            {tip}
          </span>
        )}
      </span>
    </h3>
  )
}

export function OverallScoreCard() {
  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <CardTitle tip="오늘 수행한 모든 동작의 가중 평균 점수입니다. 자세 정확도, 관절 각도 도달률, 박자 일치도를 합산해 100점 만점으로 환산했어요.">
          전체 동작 점수
        </CardTitle>
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
  const [rangeId, setRangeId] = useState<TrendRangeId>(6)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const currentRange = TREND_RANGE_OPTIONS.find(r => r.id === rangeId) ?? TREND_RANGE_OPTIONS[0]
  const data = TREND.slice(-rangeId)
  const { domain, ticks } = buildYDomain(data.map(t => t.score))

  return (
    <article className={`${styles.card} ${styles.cardFlex}`}>
      <header className={styles.cardHead}>
        <CardTitle tip="최근 세션들의 전체 동작 점수를 시간 순으로 보여줍니다. 선이 우상향일수록 꾸준히 좋아지고 있다는 뜻이에요.">
          동작 추세
        </CardTitle>
        <div className={styles.rangeWrap} ref={menuRef}>
          <button
            type="button"
            className={styles.cardAction}
            onClick={() => setMenuOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {currentRange.label}
            <ChevronDownIcon
              className={`${styles.cardActionChev} ${menuOpen ? styles.cardActionChevOpen : ''}`}
            />
          </button>
          {menuOpen && (
            <div className={styles.rangeMenu} role="menu">
              {TREND_RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitem"
                  className={`${styles.rangeItem} ${opt.id === rangeId ? styles.rangeItemActive : ''}`}
                  onClick={() => {
                    setRangeId(opt.id)
                    setMenuOpen(false)
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      <div className={styles.trendBody}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
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
              stroke="url(#trend-line)"
              strokeWidth={2.5}
              fill="url(#trend-area)"
              dot={(props: { cx?: number; cy?: number; index?: number; key?: string | number }) => {
                const { cx = 0, cy = 0, index = 0, key } = props
                const isLast = index === data.length - 1
                const showDot = data.length <= 12 || isLast
                if (!showDot) {
                  return <circle key={key ?? `trend-dot-${index}`} cx={cx} cy={cy} r={0} />
                }
                return (
                  <circle
                    key={key ?? `trend-dot-${index}`}
                    cx={cx}
                    cy={cy}
                    r={isLast ? 5.5 : 3}
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
  const navigate = useNavigate()
  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <CardTitle tip="동작 중 각 관절이 도달한 최대 각도를 정상 가동 범위(ROM) 기준으로 환산한 비율입니다. 80% 이상 좋음, 90% 이상이면 우수예요.">
          관절 가동 범위
        </CardTitle>
        <button type="button" className={styles.cardAction} onClick={() => navigate('/rom')}>
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
