import styles from './SidebarPlaceholder.module.css'

const PLACEHOLDER_ITEMS = [
  { id: 'music', label: '음악', status: 'done' as const, statusLabel: '완료' },
  { id: 'art', label: '미술', status: 'planned' as const, statusLabel: '예정' },
  { id: 'pe', label: '체육', status: 'planned' as const, statusLabel: '예정' },
]

/**
 * "오늘 한 활동" 사이드 자리잡이.
 * 후속 티켓에서 실제 캐릭터 일러스트 + 활동별 카드로 대체.
 */
export function SidebarPlaceholder() {
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.title}>오늘 한 활동</span>
      </header>
      <div className={styles.list}>
        {PLACEHOLDER_ITEMS.map(item => (
          <article
            key={item.id}
            className={`${styles.card} ${item.status === 'done' ? styles.cardDone : ''}`}
          >
            <div className={styles.thumb} aria-hidden />
            <div className={styles.body}>
              <span className={styles.label}>{item.label}</span>
              <span
                className={`${styles.badge} ${
                  item.status === 'done' ? styles.badgeDone : styles.badgePlanned
                }`}
              >
                {item.statusLabel}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
