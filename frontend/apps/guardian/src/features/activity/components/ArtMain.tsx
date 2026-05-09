import { useMemo, useState } from 'react'
import type { Artwork } from '@wish/api-client'
import { useMyArtworks } from '../hooks'
import styles from './ArtMain.module.css'

function todayKst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

function isCreatedTodayKst(createdAt: string): boolean {
  const dateStr = new Date(createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  return dateStr === todayKst()
}

function artworkDisplayTitle(artwork: Artwork, indexInList: number): string {
  return artwork.title?.trim() ? artwork.title : `내 그림 ${indexInList + 1}`
}

/**
 * 미술 활동 결과 화면.
 * 당일 그림 carousel — 좌우 화살표로 그림 이동.
 * 그림별 정보 카드 / 또래 비교 / 지난 그림 보기는 후속 커밋.
 */
export function ArtMain() {
  const { data, isLoading, error } = useMyArtworks({ size: 20 })
  const [index, setIndex] = useState(0)

  const todayArtworks = useMemo<Artwork[]>(() => {
    if (!data?.content) return []
    return data.content.filter(a => isCreatedTodayKst(a.createdAt))
  }, [data])

  if (isLoading) {
    return <div className={styles.empty}>그림을 불러오는 중...</div>
  }

  if (error) {
    return <div className={styles.error}>그림을 불러오지 못했어요</div>
  }

  if (todayArtworks.length === 0) {
    return (
      <section className={styles.heroCard}>
        <h2 className={styles.title}>미술 결과</h2>
        <div className={styles.emptyArt}>오늘 그린 그림이 아직 없어요</div>
      </section>
    )
  }

  const safeIndex = Math.min(index, todayArtworks.length - 1)
  const current = todayArtworks[safeIndex]
  const hasPrev = safeIndex > 0
  const hasNext = safeIndex < todayArtworks.length - 1

  return (
    <section className={styles.heroCard}>
      <h2 className={styles.title}>미술 결과</h2>
      <div className={styles.carousel}>
        <button
          type="button"
          className={`${styles.navBtn} ${styles.navPrev}`}
          onClick={() => setIndex(i => Math.max(0, i - 1))}
          disabled={!hasPrev}
          aria-label="이전 그림"
        >
          ‹
        </button>
        <div className={styles.imageFrame}>
          <img
            src={current.imageUrl}
            alt={artworkDisplayTitle(current, safeIndex)}
            className={styles.image}
          />
          <div className={styles.captionBar}>
            <span className={styles.captionLabel}>오늘의 작품</span>
            <strong className={styles.captionTitle}>
              {artworkDisplayTitle(current, safeIndex)}
            </strong>
          </div>
        </div>
        <button
          type="button"
          className={`${styles.navBtn} ${styles.navNext}`}
          onClick={() => setIndex(i => Math.min(todayArtworks.length - 1, i + 1))}
          disabled={!hasNext}
          aria-label="다음 그림"
        >
          ›
        </button>
      </div>
      {todayArtworks.length > 1 && (
        <div className={styles.indexPill}>
          {safeIndex + 1} / {todayArtworks.length}
        </div>
      )}
    </section>
  )
}
