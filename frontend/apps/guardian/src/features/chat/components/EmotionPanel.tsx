import type { EmotionShare, EmotionSignal, EmotionTone, EmotionTrendPoint } from '../data/mock'
import styles from './EmotionPanel.module.css'

const SHARE_DOT: Record<EmotionTone, string> = {
  calm: '💚',
  tired: '🥱',
  worried: '😟',
}

const SIGNAL_ICON_CLASS: Record<EmotionTone, string> = {
  calm: styles.signalIconCalm,
  tired: styles.signalIconTired,
  worried: styles.signalIconWorried,
}

const SHARE_ITEM_CLASS: Record<EmotionTone, string> = {
  calm: styles.shareItemCalm,
  tired: styles.shareItemTired,
  worried: styles.shareItemWorried,
}

/**
 * 응답 톤 비율 위젯. 큰 숫자는 *긍정·보통 응답 비율 %* 이며 점수가 아니다 — 임상 진단 위험 회피를 위한 v3 설계 반영.
 */
function ScoreRing({ score }: { score: number }) {
  const r = 46
  const c = 2 * Math.PI * r
  const fill = c * (score / 100)
  return (
    <div className={styles.ringWrap}>
      <svg viewBox="0 0 108 108" className={styles.ringSvg}>
        <circle cx="54" cy="54" r={r} className={styles.ringTrack} />
        <circle
          cx="54"
          cy="54"
          r={r}
          className={styles.ringFill}
          strokeDasharray={`${fill} ${c - fill}`}
        />
      </svg>
      <div className={styles.ringText}>
        <span className={styles.ringScore}>{score}</span>
        <span className={styles.ringTotal}>%</span>
      </div>
    </div>
  )
}

function TrendLine({ points }: { points: EmotionTrendPoint[] }) {
  const w = 320
  const h = 160
  const padX = 28
  const padY = 22
  const xs = points.map((_, i) => padX + (i * (w - padX * 2)) / (points.length - 1))
  const ys = points.map(p => h - padY - (p.score / 100) * (h - padY * 2))
  const d = points.map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${ys[i]}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={styles.chartWrap}>
      {[0, 25, 50, 75, 100].map(g => {
        const y = h - padY - (g / 100) * (h - padY * 2)
        return (
          <g key={g}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="#ece8f7" strokeWidth="1" />
            <text x={4} y={y + 3} fontSize="9" fill="#9b96b3">
              {g}
            </text>
          </g>
        )
      })}
      <path d={d} fill="none" stroke="#7c5cff" strokeWidth="2" strokeLinecap="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r="3" fill="#fff" stroke="#7c5cff" strokeWidth="2" />
      ))}
      {points.map((p, i) => (
        <text key={p.label} x={xs[i]} y={h - 4} fontSize="9" fill="#9b96b3" textAnchor="middle">
          {p.label}
        </text>
      ))}
    </svg>
  )
}

type Props = {
  todayScore: number
  shares: EmotionShare[]
  trend: EmotionTrendPoint[]
  signals: EmotionSignal[]
  summarySample?: boolean
  trendSample?: boolean
  signalsSample?: boolean
}

function SampleBadge() {
  return <span className={styles.sampleBadge}>샘플</span>
}

export function EmotionPanel({
  todayScore,
  shares,
  trend,
  signals,
  summarySample = false,
  trendSample = false,
  signalsSample = false,
}: Props) {
  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>오늘의 응답 톤 {summarySample && <SampleBadge />}</h3>
        <div className={styles.summaryRow}>
          <ScoreRing score={todayScore} />
          <div className={styles.shareList}>
            {shares.map(s => (
              <div key={s.tone} className={`${styles.shareItem} ${SHARE_ITEM_CLASS[s.tone]}`}>
                <span className={styles.shareLabel}>
                  {SHARE_DOT[s.tone]} {s.label}
                </span>
                <span className={styles.sharePct}>{s.percent}%</span>
              </div>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 11, color: '#9b96b3', marginTop: 8, marginBottom: 0 }}>
          ⓘ 임상 진단이 아닌 응답 분류 결과예요
        </p>
      </div>

      <div className={`${styles.card} ${styles.cardTrend}`}>
        <h3 className={styles.cardTitle}>지난 주 응답 톤 변화 {trendSample && <SampleBadge />}</h3>
        <TrendLine points={trend} />
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>오늘 보인 감정 신호 {signalsSample && <SampleBadge />}</h3>
        <div className={styles.signalList}>
          {signals.map(sig => (
            <div key={sig.id} className={styles.signal}>
              <span className={`${styles.signalIcon} ${SIGNAL_ICON_CLASS[sig.tone]}`}>
                {SHARE_DOT[sig.tone]}
              </span>
              <div>
                <div className={styles.signalTitle}>{sig.title}</div>
                <div className={styles.signalDesc}>{sig.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
