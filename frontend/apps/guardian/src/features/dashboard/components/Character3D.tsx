import { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import type { Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import wishGlbUrl from '@/assets/wish.glb?url'
import { JOINT_MARKERS } from '../data/mock'
import { MinusIcon, PersonDimIcon, PersonIcon, PlusIcon, RefreshIcon } from './icons'
import styles from './Character3D.module.css'

useGLTF.preload(wishGlbUrl)

type ViewMode = 'live' | 'silhouette'

function CharacterModel({ targetScale }: { targetScale: number }) {
  const { scene } = useGLTF(wishGlbUrl)
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const next = g.scale.x + (targetScale - g.scale.x) * 0.15
    g.scale.set(next, next, next)
  })

  return (
    <group ref={groupRef} position={[0, -1.1, 0]}>
      <primitive object={scene} />
    </group>
  )
}

function JointMarkers() {
  return (
    <>
      {JOINT_MARKERS.map(m => (
        <Html key={m.id} position={m.position} center distanceFactor={3.4} zIndexRange={[40, 0]}>
          <div className={styles.marker} aria-hidden />
        </Html>
      ))}
    </>
  )
}

export function Character3D() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const [zoom, setZoom] = useState(0)
  const [view, setView] = useState<ViewMode>('live')

  const targetScale = 1 + zoom * 0.15

  const handleReset = () => {
    setZoom(0)
    controlsRef.current?.reset()
  }

  return (
    <div className={styles.viewer}>
      <div
        className={styles.canvasWrap}
        style={{
          opacity: view === 'silhouette' ? 0.45 : 1,
          filter: view === 'silhouette' ? 'grayscale(0.4) blur(0.4px)' : 'none',
          transition: 'opacity 0.3s ease, filter 0.3s ease',
        }}
      >
        <Canvas camera={{ position: [0, 0.4, 3.4], fov: 35 }} gl={{ alpha: true, antialias: true }}>
          <ambientLight intensity={0.85} />
          <directionalLight position={[2, 4, 3]} intensity={0.9} />
          <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#c8b6ff" />
          <Suspense fallback={null}>
            <CharacterModel targetScale={targetScale} />
            <JointMarkers />
          </Suspense>
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            enableZoom
            minDistance={2.4}
            maxDistance={5.2}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={(2 * Math.PI) / 3}
          />
        </Canvas>
      </div>

      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={handleReset}
            aria-label="시점 초기화"
          >
            <RefreshIcon width={18} height={18} />
          </button>
          <button
            type="button"
            className={`${styles.controlBtn} ${view === 'live' ? styles.controlBtnActive : ''}`}
            onClick={() => setView('live')}
            aria-label="기본 뷰"
          >
            <PersonIcon width={18} height={18} />
          </button>
          <button
            type="button"
            className={`${styles.controlBtn} ${view === 'silhouette' ? styles.controlBtnActive : ''}`}
            onClick={() => setView('silhouette')}
            aria-label="실루엣 뷰"
          >
            <PersonDimIcon width={18} height={18} />
          </button>
        </div>
        <div className={styles.controlGroup}>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => setZoom(z => Math.min(z + 1, 4))}
            aria-label="확대"
          >
            <PlusIcon width={18} height={18} />
          </button>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => setZoom(z => Math.max(z - 1, -3))}
            aria-label="축소"
          >
            <MinusIcon width={18} height={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
