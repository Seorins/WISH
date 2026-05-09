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

function formatDurationSec(seconds: number): string {
  if (seconds <= 0) return '0초'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}초`
  if (s === 0) return `${m}분`
  return `${m}분 ${s}초`
}

function formatShortDateKst(createdAt: string): string {
  const kst = new Date(createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const [, mm, dd] = kst.split('-')
  return `${parseInt(mm, 10)}/${parseInt(dd, 10)}`
}

const PAST_VISIBLE_COUNT = 3

// 색 추적은 Phase 2 (백엔드 colors_used 컬럼) 에서 실제값으로 교체.
const PLACEHOLDER_COLORS_USED = 8

/**
 * 미술 활동 결과 화면.
 * 좌측: 당일 그림 carousel.
 * 우측: 그림별 정보 카드 (시간/색/종류). 또래 비교/지난 그림은 후속 커밋.
 */
export function ArtMain() {
  const { data, isLoading, error } = useMyArtworks({ size: 20 })
  const [index, setIndex] = useState(0)

  const todayArtworks = useMemo<Artwork[]>(() => {
    if (!data?.content) return []
    return data.content.filter(a => isCreatedTodayKst(a.createdAt))
  }, [data])

  const pastArtworks = useMemo<Artwork[]>(() => {
    if (!data?.content) return []
    return data.content.filter(a => !isCreatedTodayKst(a.createdAt))
  }, [data])

  if (isLoading) {
    return <div className={styles.fullStatus}>그림을 불러오는 중...</div>
  }

  if (error) {
    return <div className={`${styles.fullStatus} ${styles.error}`}>그림을 불러오지 못했어요</div>
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
    <div className={styles.layout}>
      <div className={styles.mainColumn}>
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
      </div>
      <aside className={styles.sideColumn}>
        <ArtInfoCard artwork={current} />
        <ArtPastCarousel artworks={pastArtworks} />
      </aside>
    </div>
  )
}

function ArtPastCarousel({ artworks }: { artworks: Artwork[] }) {
  const [offset, setOffset] = useState(0)
  const safeOffset = Math.min(offset, Math.max(0, artworks.length - PAST_VISIBLE_COUNT))
  const visible = artworks.slice(safeOffset, safeOffset + PAST_VISIBLE_COUNT)
  const hasPrev = safeOffset > 0
  const hasNext = safeOffset + PAST_VISIBLE_COUNT < artworks.length

  return (
    <section className={styles.pastCard}>
      <h3 className={styles.pastTitle}>지난 그림 보기</h3>
      {artworks.length === 0 ? (
        <div className={styles.pastEmpty}>아직 지난 그림이 없어요</div>
      ) : (
        <div className={styles.pastRow}>
          <button
            type="button"
            className={`${styles.pastNavBtn} ${styles.pastNavPrev}`}
            onClick={() => setOffset(o => Math.max(0, o - 1))}
            disabled={!hasPrev}
            aria-label="이전 그림 묶음"
          >
            ‹
          </button>
          <div className={styles.pastThumbs}>
            {visible.map(a => (
              <div key={a.id} className={styles.pastThumb}>
                <div className={styles.pastThumbFrame}>
                  <img
                    src={a.imageUrl}
                    alt={a.title?.trim() || '지난 그림'}
                    className={styles.pastThumbImg}
                  />
                </div>
                <span className={styles.pastThumbDate}>{formatShortDateKst(a.createdAt)}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`${styles.pastNavBtn} ${styles.pastNavNext}`}
            onClick={() => setOffset(o => Math.min(artworks.length - PAST_VISIBLE_COUNT, o + 1))}
            disabled={!hasNext}
            aria-label="다음 그림 묶음"
          >
            ›
          </button>
        </div>
      )}
    </section>
  )
}

function ArtInfoCard({ artwork }: { artwork: Artwork }) {
  const kindLabel = artwork.sketchCode == null ? '자유그림' : '색칠하기'
  const stats = [
    {
      id: 'time',
      icon: '⏱',
      label: '그리기 시간',
      value: formatDurationSec(artwork.playDurationSeconds),
      accent: true,
    },
    {
      id: 'colors',
      icon: '🎨',
      label: '사용한 색',
      value: `${PLACEHOLDER_COLORS_USED}가지`,
    },
    {
      id: 'kind',
      icon: '✏️',
      label: '활동 종류',
      value: kindLabel,
    },
  ] as const

  return (
    <section className={styles.infoCard}>
      <h3 className={styles.infoCardTitle}>그림 정보</h3>
      <div className={styles.infoRows}>
        {stats.map(stat => (
          <div key={stat.id} className={styles.infoRow}>
            <span className={styles.infoIcon} aria-hidden>
              {stat.icon}
            </span>
            <div className={styles.infoMeta}>
              <span className={styles.infoLabel}>{stat.label}</span>
              <span className={`${styles.infoValue} ${stat.accent ? styles.infoValueAccent : ''}`}>
                {stat.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
