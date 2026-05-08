import styles from './MainPlaceholder.module.css'

const STAT_SLOTS = [
  { id: 'song', icon: '🎵', label: '선택한 노래', value: '반짝반짝 작은별' },
  { id: 'time', icon: '🕐', label: '오늘 플레이 시간', value: '8분' },
  { id: 'score', icon: '⭐', label: '점수', value: '1280점' },
  { id: 'result', icon: '🏆', label: '활동 결과', value: '성공' },
]

const ACCURACY_CHIPS = [
  { id: 'perfect', label: 'Perfect', value: 18, tone: 'perfect' as const },
  { id: 'great', label: 'Great', value: 6, tone: 'great' as const },
  { id: 'good', label: 'Good', value: 2, tone: 'good' as const },
  { id: 'miss', label: 'Miss', value: 1, tone: 'miss' as const },
]

const TONE_CLASS = {
  perfect: styles.chipPerfect,
  great: styles.chipGreat,
  good: styles.chipGood,
  miss: styles.chipMiss,
}

/**
 * 활동 결과 메인.
 * 후속 티켓에서 다음 영역을 실제 컨텐츠로 대체:
 *  - 미디어 영역: 524 ActivityPreview (썸네일 호버 영상)
 *  - 통계/정확도/또래비교: 실제 결과 데이터 연동
 *
 * 아이콘은 emoji placeholder. 디자인 SVG 들어오면 교체.
 */
export function MainPlaceholder() {
  return (
    <>
      <section className={styles.heroCard}>
        <header className={styles.heroHeader}>
          <h2 className={styles.heroTitle}>활동 결과</h2>
        </header>
        <div className={styles.heroBody}>
          <div className={styles.media} aria-label="활동 영상 영역" />
          <div className={styles.heroMeta}>
            <span className={styles.tag}>음악실</span>
            <h3 className={styles.songTitle}>리듬 따라치기</h3>
            <div className={styles.timeRow}>
              <span aria-hidden>🕐</span>
              <span>오전 10:20</span>
              <span aria-hidden className={styles.dot}>
                ·
              </span>
              <span>8분</span>
            </div>
            <p className={styles.description}>노래를 고르고 리듬에 맞춰 실로폰을 연주했어요.</p>
          </div>
        </div>
      </section>

      <section className={styles.statRow}>
        {STAT_SLOTS.map(stat => (
          <div key={stat.id} className={styles.statCard}>
            <span className={styles.statIcon} aria-hidden>
              {stat.icon}
            </span>
            <div className={styles.statBody}>
              <span className={styles.statLabel}>{stat.label}</span>
              <span className={styles.statValue}>{stat.value}</span>
            </div>
          </div>
        ))}
      </section>

      <section className={styles.accuracyCard}>
        <div className={styles.accuracyMeta}>
          <h4 className={styles.accuracyTitle}>리듬 정확도</h4>
          <span className={styles.accuracySub}>결과</span>
          <p className={styles.accuracyMessage}>
            <span aria-hidden className={styles.accuracyIcon}>
              😊
            </span>
            <span>
              <strong>박자를 잘 맞췄어요!</strong>
              <br />
              정확도가 높아요.
            </span>
          </p>
        </div>
        <div className={styles.chipRow}>
          {ACCURACY_CHIPS.map(chip => (
            <div key={chip.id} className={`${styles.chip} ${TONE_CLASS[chip.tone]}`}>
              <span className={styles.chipLabel}>{chip.label}</span>
              <span className={styles.chipValue}>{chip.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.peerCard}>
        <div className={styles.peerLabel}>
          <span className={styles.peerIcon} aria-hidden>
            👥
          </span>
          <div className={styles.peerLabelText}>
            <strong>또래 비교</strong>
            <span>또래 평균보다 조금 더 오래 참여했어요.</span>
          </div>
        </div>
        <div className={styles.peerBars}>
          <div className={styles.peerSide}>
            <div className={styles.peerSideHead}>
              <span className={styles.peerSideLabel}>또래 평균 플레이 시간</span>
              <strong className={styles.peerSideValue}>6분</strong>
            </div>
            <div className={`${styles.peerBar} ${styles.peerBarOther}`} aria-hidden>
              <div className={styles.peerBarFill} style={{ width: '60%' }} />
            </div>
          </div>
          <span className={styles.peerVs} aria-hidden>
            VS
          </span>
          <div className={styles.peerSide}>
            <div className={styles.peerSideHead}>
              <span className={styles.peerSideLabel}>우리 아이 플레이 시간</span>
              <strong className={styles.peerSideValue}>8분</strong>
            </div>
            <div className={`${styles.peerBar} ${styles.peerBarMine}`} aria-hidden>
              <div className={styles.peerBarFill} style={{ width: '80%' }} />
            </div>
          </div>
        </div>
        <div className={styles.peerSummary}>
          <span aria-hidden className={styles.peerSummaryIcon}>
            📈
          </span>
          <span>
            또래 평균보다
            <br />
            <strong>2분 더 참여했어요!</strong>
          </span>
        </div>
      </section>
    </>
  )
}
