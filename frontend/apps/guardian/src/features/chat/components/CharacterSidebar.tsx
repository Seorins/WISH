import type { ChatCharacter, EmotionTone } from '../data/mock'
import styles from './CharacterSidebar.module.css'

type Props = {
  characters: ChatCharacter[]
  selectedId: string
  onSelect: (id: string) => void
}

const TONE_LABEL: Record<EmotionTone, string> = {
  calm: '안정',
  tired: '피로',
  worried: '걱정',
}

const TONE_CLASS: Record<EmotionTone, string> = {
  calm: styles.toneCalm,
  tired: styles.toneTired,
  worried: styles.toneWorried,
}

export function CharacterSidebar({ characters, selectedId, onSelect }: Props) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>대화 캐릭터</h3>
      <div className={styles.list}>
        {characters.map(c => {
          const isActive = c.id === selectedId
          return (
            <button
              key={c.id}
              type="button"
              className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
              onClick={() => onSelect(c.id)}
            >
              <span className={styles.avatar} />
              <span className={styles.meta}>
                <span className={styles.name}>{c.name}</span>
                <span className={`${styles.tone} ${TONE_CLASS[c.emotion]}`}>
                  {TONE_LABEL[c.emotion]}
                </span>
              </span>
              {isActive && <span className={styles.check}>✓</span>}
            </button>
          )
        })}
      </div>
      <button type="button" className={styles.more}>
        더 보기 ⌄
      </button>
    </div>
  )
}
