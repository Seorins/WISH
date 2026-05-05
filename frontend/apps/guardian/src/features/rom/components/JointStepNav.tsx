import type { JointId } from '../data/mock'
import { JOINT_ROM_DETAILS } from '../data/mock'
import styles from './JointStepNav.module.css'

type Props = {
  activeId: JointId
  onSelect: (id: JointId) => void
}

export function JointStepNav({ activeId, onSelect }: Props) {
  return (
    <nav className={styles.nav} aria-label="관절 스텝">
      <ul className={styles.list}>
        {JOINT_ROM_DETAILS.map((joint, idx) => {
          const isActive = joint.id === activeId
          const isLast = idx === JOINT_ROM_DETAILS.length - 1
          return (
            <li key={joint.id} className={styles.itemWrap}>
              <button
                type="button"
                className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                onClick={() => onSelect(joint.id)}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className={styles.itemNum}>{joint.step}</span>
                <span className={styles.itemBody}>
                  <span className={styles.itemLabel}>{joint.name}</span>
                  {isActive && <span className={styles.itemMeta}>현재 보기</span>}
                </span>
              </button>
              {!isLast && <span className={styles.connector} aria-hidden />}
            </li>
          )
        })}
      </ul>
      <div className={styles.scrollHint} aria-hidden>
        <span className={styles.scrollArrow}>↓</span>
        <span className={styles.scrollText}>
          아래로 스크롤하여
          <br />
          다음 관절로 이동해요
        </span>
      </div>
    </nav>
  )
}
