import type { ChatMessage, ConversationSummary } from '../data/mock'
import styles from './ConversationMain.module.css'

type Props = {
  characterName: string
  whenLabel: string
  durationLabel: string
  messages: ChatMessage[]
  summary: ConversationSummary
}

export function ConversationMain({
  characterName,
  whenLabel,
  durationLabel,
  messages,
  summary,
}: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.topRow}>
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>{characterName}와의 대화</h2>
          <div className={styles.metaRow}>
            <span className={styles.metaChip}>📅 {whenLabel}</span>
            <span className={`${styles.metaChip} ${styles.metaChipDone}`}>✓ {durationLabel}</span>
          </div>
        </div>
        <button type="button" className={styles.pastBtn}>
          📅 지난 대화 보기
        </button>
      </div>

      <div className={styles.stage}>
        <div className={styles.bubbles}>
          {messages.map(m => (
            <div
              key={m.id}
              className={`${styles.bubble} ${m.speaker === 'child' ? styles.bubbleChild : ''}`}
            >
              {m.text}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.summarySection}>
        <div className={styles.summaryHeader}>
          <span>✨ 대화 결과 요약</span>
          <span className={styles.summarySub}>이번 대화의 핵심을 한눈에 확인해요.</span>
        </div>
        <div className={styles.summaryRow}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryTitle}>관계 신뢰 상승</div>
            <div>{characterName}와의 신뢰가 더 깊어졌어요.</div>
            <div className={styles.summaryDelta}>↑ {summary.trustDelta}%</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryTitle}>대화 주제</div>
            <div>주요 주제예요.</div>
            <div className={styles.tagRow}>
              {summary.topics.map(t => (
                <span key={t} className={styles.tag}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryTitle}>추천 후속 활동</div>
            <div>{summary.recommendedActivity}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
