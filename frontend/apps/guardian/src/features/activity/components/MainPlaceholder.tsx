import styles from './MainPlaceholder.module.css'

const STAT_SLOTS = [
  { id: 'song', title: '선택한 노래' },
  { id: 'time', title: '오늘 플레이 시간' },
  { id: 'score', title: '점수' },
  { id: 'result', title: '활동 결과' },
]

const ACCURACY_SLOTS = ['Perfect', 'Great', 'Good', 'Miss']

/**
 * 활동 결과 메인 자리잡이.
 * 후속 티켓에서 다음 영역을 실제 컨텐츠로 대체:
 *  - 미디어 영역: 524 ActivityPreview (썸네일 호버 영상)
 *  - 메타 우측: 곡명·시간·등급
 *  - 통계·정확도·또래비교 카드들
 */
export function MainPlaceholder() {
  return (
    <>
      <h1 className={styles.title}>활동 결과</h1>

      <section className={styles.heroCard}>
        <div className={styles.media} aria-label="활동 영상 영역" />
        <div className={styles.heroMeta}>
          <span className={styles.tag}>음악실</span>
          <h2 className={styles.songTitle}>리듬 따라치기</h2>
          <p className={styles.songMeta}>곡명 · 플레이 시간</p>
          <div className={styles.gradeChip}>
            <span className={styles.gradeLabel}>활동 결과</span>
            <span className={styles.gradeValue}>S 등급</span>
          </div>
        </div>
      </section>

      <section className={styles.statRow}>
        {STAT_SLOTS.map(stat => (
          <div key={stat.id} className={styles.statCard}>
            <span className={styles.statTitle}>{stat.title}</span>
            <span className={styles.statValue}>—</span>
          </div>
        ))}
      </section>

      <section className={styles.accuracyCard}>
        <div className={styles.accuracyHeader}>
          <span className={styles.accuracyTitle}>리듬 정확도</span>
          <span className={styles.accuracyMessage}>박자를 잘 맞췄어요!</span>
        </div>
        <div className={styles.chips}>
          {ACCURACY_SLOTS.map(label => (
            <div key={label} className={styles.chip}>
              <span className={styles.chipLabel}>{label}</span>
              <span className={styles.chipValue}>—</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.peerCard}>
        <div className={styles.peerHeader}>
          <span className={styles.peerTitle}>또래 비교</span>
          <span className={styles.peerCaption}>또래 평균 vs 우리 아이</span>
        </div>
        <div className={styles.peerBar} aria-hidden />
      </section>
    </>
  )
}
