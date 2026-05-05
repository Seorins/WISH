import { Suspense, useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import { Vector3, type Group, type Object3D } from 'three'
import wishGlbUrl from '@/assets/wish.glb?url'
import { MinusIcon, PersonIcon, PlusIcon, RefreshIcon } from './icons'
import styles from './Character3D.module.css'

useGLTF.preload(wishGlbUrl)

const BASE_SCALE = 1.0
const MODEL_OFFSET_Y = -0.95

type Joint = { id: string; position: [number, number, number] }

const FALLBACK_JOINTS: Joint[] = [
  { id: 'shoulder-l', position: [-0.18, 0.35, 0.06] },
  { id: 'shoulder-r', position: [0.18, 0.35, 0.06] },
  { id: 'elbow-l', position: [-0.22, 0.05, 0.05] },
  { id: 'elbow-r', position: [0.22, 0.05, 0.05] },
  { id: 'wrist-l', position: [-0.24, -0.25, 0.05] },
  { id: 'wrist-r', position: [0.24, -0.25, 0.05] },
  { id: 'hip-l', position: [-0.1, -0.15, 0.06] },
  { id: 'hip-r', position: [0.1, -0.15, 0.06] },
  { id: 'knee-l', position: [-0.1, -0.55, 0.06] },
  { id: 'knee-r', position: [0.1, -0.55, 0.06] },
  { id: 'ankle-l', position: [-0.1, -0.9, 0.06] },
  { id: 'ankle-r', position: [0.1, -0.9, 0.06] },
]

function classifyBone(rawName: string): string | null {
  const n = rawName.toLowerCase()
  const isLeft = /^left|(^|[._\-:])l(?=$|[._\-:])|\.l\b|_l\b/.test(n)
  const isRight = /^right|(^|[._\-:])r(?=$|[._\-:])|\.r\b|_r\b/.test(n)
  const side = isLeft ? 'l' : isRight ? 'r' : null
  if (!side) return null

  // Mixamo-style mapping. Order matters — check most specific suffixes first.
  if (n.includes('forearm')) return `elbow-${side}`
  if (n.includes('upleg') || n.includes('thigh')) return `hip-${side}`
  if (n.endsWith('toebase') || n.includes('toe')) return null
  if (n.endsWith('shoulder') || n.includes('clavicle')) return null
  if (n.endsWith('arm') && !n.includes('forearm')) return `shoulder-${side}`
  if (n.endsWith('leg') && !n.includes('upleg')) return `knee-${side}`
  if (n.endsWith('hand') && !n.includes('handle')) return `wrist-${side}`
  if (n.endsWith('foot') || n.includes('ankle')) return `ankle-${side}`
  if (n.includes('knee') || n.includes('shin') || n.includes('calf')) return `knee-${side}`
  if (n.includes('elbow')) return `elbow-${side}`
  if (n.includes('wrist')) return `wrist-${side}`
  if (/(?<!hip\W*)hip\b/.test(n)) return `hip-${side}`
  return null
}

function extractJoints(scene: Object3D): Joint[] {
  scene.updateMatrixWorld(true)
  const found = new Map<string, [number, number, number]>()
  scene.traverse(obj => {
    if (!obj.name) return
    const id = classifyBone(obj.name)
    if (!id || found.has(id)) return
    const wp = new Vector3()
    obj.getWorldPosition(wp)
    found.set(id, [wp.x, wp.y, wp.z])
  })
  return Array.from(found, ([id, position]) => ({ id, position }))
}

function CharacterModel({
  targetScale,
  onJoints,
}: {
  targetScale: number
  onJoints: (joints: Joint[]) => void
}) {
  const { scene } = useGLTF(wishGlbUrl)
  const groupRef = useRef<Group>(null)

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    group.updateMatrixWorld(true)
    onJoints(extractJoints(group))
  }, [scene, onJoints])

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const next = g.scale.x + (targetScale - g.scale.x) * 0.15
    g.scale.set(next, next, next)
  })

  return (
    <group ref={groupRef} position={[0, MODEL_OFFSET_Y, 0]} scale={BASE_SCALE}>
      <primitive object={scene} />
    </group>
  )
}

function JointMarkers({ joints }: { joints: Joint[] }) {
  return (
    <>
      {joints.map(j => (
        <Html key={j.id} position={j.position} center zIndexRange={[40, 0]}>
          <div className={styles.marker} aria-hidden />
        </Html>
      ))}
    </>
  )
}

export function Character3D() {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const [zoom, setZoom] = useState(0)
  const [joints, setJoints] = useState<Joint[]>(FALLBACK_JOINTS)

  const handleJoints = useCallback((extracted: Joint[]) => {
    if (extracted.length > 0) setJoints(extracted)
  }, [])

  const targetScale = BASE_SCALE * (1 + zoom * 0.15)

  const handleReset = () => {
    setZoom(0)
    controlsRef.current?.reset()
  }

  return (
    <div className={styles.viewer}>
      <div className={styles.canvasWrap}>
        <Canvas camera={{ position: [0, 0, 3.8], fov: 32 }} gl={{ alpha: true, antialias: true }}>
          <ambientLight intensity={0.85} />
          <directionalLight position={[2, 4, 3]} intensity={0.9} />
          <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#c8b6ff" />
          <Suspense fallback={null}>
            <CharacterModel targetScale={targetScale} onJoints={handleJoints} />
            <JointMarkers joints={joints} />
          </Suspense>
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            enableZoom
            minDistance={3.0}
            maxDistance={6.0}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={(2 * Math.PI) / 3}
            target={[0, 0.05, 0]}
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
            className={`${styles.controlBtn} ${styles.controlBtnActive}`}
            aria-label="기본 뷰"
          >
            <PersonIcon width={18} height={18} />
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
