import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { Vector3, type Group } from 'three'
import wishGlbUrl from '@/assets/wish.glb?url'
import type { JointId } from '../data/mock'
import sharedStyles from '@/features/dashboard/components/Character3D.module.css'
import styles from './ROMCharacter3D.module.css'

useGLTF.preload(wishGlbUrl)

const MODEL_OFFSET_Y = -0.95

/**
 * 관절별 줌 프리셋 — 캐릭터 그룹 로컬 Y(=마커 Y) 기준.
 * targetY: OrbitControls.target.y (월드)
 * distance: 카메라 거리 (작을수록 줌인)
 */
const JOINT_FOCUS: Record<JointId, { targetY: number; distance: number }> = {
  shoulder: { targetY: 0.32, distance: 2.0 },
  hip: { targetY: -0.12, distance: 2.05 },
  knee: { targetY: -0.5, distance: 2.0 },
  ankle: { targetY: -0.85, distance: 1.95 },
}

/**
 * 관절별 좌/우 마커 위치 — 캐릭터 그룹 로컬 좌표.
 * (Character3D의 FALLBACK_JOINTS 어깨/엉덩이/무릎/발목 값과 동일)
 */
const JOINT_MARKERS: Record<JointId, [[number, number, number], [number, number, number]]> = {
  shoulder: [
    [-0.18, 1.3, 0.06],
    [0.18, 1.3, 0.06],
  ],
  hip: [
    [-0.1, 0.8, 0.06],
    [0.1, 0.8, 0.06],
  ],
  knee: [
    [-0.1, 0.4, 0.06],
    [0.1, 0.4, 0.06],
  ],
  ankle: [
    [-0.1, 0.05, 0.06],
    [0.1, 0.05, 0.06],
  ],
}

function CharacterModel() {
  const groupRef = useRef<Group>(null)
  const { scene } = useGLTF(wishGlbUrl)
  return (
    <group ref={groupRef} position={[0, MODEL_OFFSET_Y, 0]}>
      <primitive object={scene} />
    </group>
  )
}

function FocusMarkers({ focusJoint }: { focusJoint: JointId }) {
  const positions = JOINT_MARKERS[focusJoint]
  return (
    <group position={[0, MODEL_OFFSET_Y, 0]}>
      {positions.map((pos, i) => (
        <group key={`${focusJoint}-${i}`} position={pos}>
          <Html center zIndexRange={[40, 0]}>
            <div className={`${sharedStyles.marker} ${styles.markerLarge}`} aria-hidden />
          </Html>
        </group>
      ))}
    </group>
  )
}

type CameraRigProps = {
  focusJoint: JointId
}

/**
 * focusJoint가 바뀌면 카메라 위치와 lookAt 타깃이 부드럽게 보간됩니다.
 * OrbitControls 없이 직접 카메라를 제어해 충돌을 피합니다.
 */
function CameraRig({ focusJoint }: CameraRigProps) {
  const lerpedTarget = useMemo(() => new Vector3(0, JOINT_FOCUS.shoulder.targetY, 0), [])
  const desiredDistance = useRef<number>(JOINT_FOCUS.shoulder.distance)
  const tmpDir = useMemo(() => new Vector3(0, 0, 1), [])
  const tmpDesired = useMemo(() => new Vector3(), [])

  useFrame((state, delta) => {
    const focus = JOINT_FOCUS[focusJoint]
    const t = Math.min(1, delta * 4) // ~250ms 정도에 수렴
    tmpDesired.set(0, focus.targetY, 0)
    lerpedTarget.lerp(tmpDesired, t)
    desiredDistance.current += (focus.distance - desiredDistance.current) * t

    const cam = state.camera
    cam.position.copy(lerpedTarget).addScaledVector(tmpDir, desiredDistance.current)
    cam.lookAt(lerpedTarget)
  })

  return null
}

type Props = {
  focusJoint: JointId
}

export function ROMCharacter3D({ focusJoint }: Props) {
  return (
    <div className={styles.viewer}>
      <div className={styles.canvasWrap}>
        <Canvas
          camera={{ position: [0, 0.32, 2.0], fov: 28 }}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[2, 4, 3]} intensity={0.95} />
          <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#c8b6ff" />
          <Suspense fallback={null}>
            <CharacterModel />
            <FocusMarkers focusJoint={focusJoint} />
          </Suspense>
          <CameraRig focusJoint={focusJoint} />
        </Canvas>
      </div>
    </div>
  )
}
