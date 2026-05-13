import { Suspense, useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, useAnimations, useGLTF } from '@react-three/drei'
import { Quaternion, Vector3, type Bone, type Group } from 'three'
import squatGlbUrl from '@/assets/squat.glb?url'
import walkingGlbUrl from '@/assets/walking.glb?url'
import wishGlbUrl from '@/assets/wish.glb?url'
import type { LandmarkName, MotionClip, MotionFrame } from '../data/motionClips'
import { MinusIcon, PersonIcon, PlusIcon, RefreshIcon } from './icons'
import styles from './Character3D.module.css'

useGLTF.preload(wishGlbUrl)
useGLTF.preload(walkingGlbUrl)
useGLTF.preload(squatGlbUrl)

/**
 * 동작 id → GLB 클립 이름 매핑.
 * 별도 GLB(walking/squat)에서 클립만 추출해 wish.glb 캐릭터에 적용 (재질 일관성 유지).
 */
const MOTION_CLIP_NAME: Record<string, string> = {
  march: 'Armature|walking_man|baselayer',
  'sit-stand': 'Armature|air_squat|baselayer',
}

const BASE_SCALE = 1.0
const MODEL_OFFSET_Y = -0.95

const KP_SCALE = 0.43
const HIP_LOCAL_Y = 0.85
const RETARGET_DEPTH_SCALE = KP_SCALE * 0.35
const RETARGET_SLERP_FACTOR = 0.45
const RETARGET_MIN_DIRECTION_LENGTH = 0.001

/** UpLeg 본 위치(허리 라인)를 시각적 hip(엉덩이) 라인으로 내리는 오프셋 */
const HIP_Y_OFFSET = -0.18

/**
 * 캐릭터 본 retargeting on/off.
 * 더미 sin 기반 keypoint로는 자세가 자연스럽게 안 나옴 + 본 rest pose 보정이 GLB마다 까다로워
 * 현재는 비활성화. GLB에 동작 클립이 직접 들어오면 useAnimations로 갈아끼울 예정.
 * 실제 mocap 데이터(아이별)가 들어오는 시점에 다시 활성화해서 좌표·정규화 검증 후 안정화 작업.
 */
const ENABLE_BONE_RETARGETING = true

/**
 * sin 기반 더미 마커 motion playback on/off.
 * 클립이 없는 동작(사이드 스텝/몸통 가로 지르기/얼굴 가로 지르기)에서 마커가 sin 패턴으로
 * 움직이는 게 어색해서 비활성. 해당 동작들도 추후 GLB 클립 추가될 예정이라 그때까진 정적 유지.
 */
const ENABLE_SIN_MARKER_MOTION = false

const KP_TO_JOINT_ID: Record<LandmarkName, string> = {
  LEFT_SHOULDER: 'shoulder-l',
  RIGHT_SHOULDER: 'shoulder-r',
  LEFT_ELBOW: 'elbow-l',
  RIGHT_ELBOW: 'elbow-r',
  LEFT_WRIST: 'wrist-l',
  RIGHT_WRIST: 'wrist-r',
  LEFT_HIP: 'hip-l',
  RIGHT_HIP: 'hip-r',
  LEFT_KNEE: 'knee-l',
  RIGHT_KNEE: 'knee-r',
  LEFT_ANKLE: 'ankle-l',
  RIGHT_ANKLE: 'ankle-r',
}

/** 마커 id → 추적할 Mixamo 본 이름 (클립 재생 중 마커가 본 따라가도록) */
const JOINT_ID_TO_BONE: Record<string, string> = {
  'shoulder-l': 'LeftArm',
  'shoulder-r': 'RightArm',
  'elbow-l': 'LeftForeArm',
  'elbow-r': 'RightForeArm',
  'wrist-l': 'LeftHand',
  'wrist-r': 'RightHand',
  'hip-l': 'LeftUpLeg',
  'hip-r': 'RightUpLeg',
  'knee-l': 'LeftLeg',
  'knee-r': 'RightLeg',
  'ankle-l': 'LeftFoot',
  'ankle-r': 'RightFoot',
}

/**
 * Mixamo 본 chain.
 *  - 본을 회전시켜 (parentKp → childKp) 방향을 따라가게 한다.
 *  - childBone은 rest 상태에서의 자식 본 (rest world direction 계산에만 사용).
 *  - 처리 순서는 부모부터: 자식 본 처리 시 부모의 새 회전이 반영된 matrixWorld를 사용해야 함.
 */
const BONE_CHAINS: ReadonlyArray<{
  bone: string
  childBone: string
  parentKp: LandmarkName
  childKp: LandmarkName
}> = [
  { bone: 'LeftArm', childBone: 'LeftForeArm', parentKp: 'LEFT_SHOULDER', childKp: 'LEFT_ELBOW' },
  { bone: 'LeftForeArm', childBone: 'LeftHand', parentKp: 'LEFT_ELBOW', childKp: 'LEFT_WRIST' },
  {
    bone: 'RightArm',
    childBone: 'RightForeArm',
    parentKp: 'RIGHT_SHOULDER',
    childKp: 'RIGHT_ELBOW',
  },
  {
    bone: 'RightForeArm',
    childBone: 'RightHand',
    parentKp: 'RIGHT_ELBOW',
    childKp: 'RIGHT_WRIST',
  },
  { bone: 'LeftUpLeg', childBone: 'LeftLeg', parentKp: 'LEFT_HIP', childKp: 'LEFT_KNEE' },
  { bone: 'LeftLeg', childBone: 'LeftFoot', parentKp: 'LEFT_KNEE', childKp: 'LEFT_ANKLE' },
  { bone: 'RightUpLeg', childBone: 'RightLeg', parentKp: 'RIGHT_HIP', childKp: 'RIGHT_KNEE' },
  { bone: 'RightLeg', childBone: 'RightFoot', parentKp: 'RIGHT_KNEE', childKp: 'RIGHT_ANKLE' },
]

type Joint = { id: string; position: [number, number, number] }

const FALLBACK_JOINTS: Joint[] = [
  { id: 'shoulder-l', position: [-0.18, 1.3, 0.06] },
  { id: 'shoulder-r', position: [0.18, 1.3, 0.06] },
  { id: 'elbow-l', position: [-0.22, 1.0, 0.05] },
  { id: 'elbow-r', position: [0.22, 1.0, 0.05] },
  { id: 'wrist-l', position: [-0.24, 0.7, 0.05] },
  { id: 'wrist-r', position: [0.24, 0.7, 0.05] },
  { id: 'hip-l', position: [-0.1, 0.62, 0.06] },
  { id: 'hip-r', position: [0.1, 0.62, 0.06] },
  { id: 'knee-l', position: [-0.1, 0.4, 0.06] },
  { id: 'knee-r', position: [0.1, 0.4, 0.06] },
  { id: 'ankle-l', position: [-0.1, 0.05, 0.06] },
  { id: 'ankle-r', position: [0.1, 0.05, 0.06] },
]

const FALLBACK_JOINT_BY_ID = new Map(FALLBACK_JOINTS.map(joint => [joint.id, joint]))
const DEFAULT_JOINT_POSITION: [number, number, number] = [0, 0, 0]

function classifyBone(rawName: string): string | null {
  const n = rawName.toLowerCase()
  const isLeft = /^left|(^|[._\-:])l(?=$|[._\-:])|\.l\b|_l\b/.test(n)
  const isRight = /^right|(^|[._\-:])r(?=$|[._\-:])|\.r\b|_r\b/.test(n)
  const side = isLeft ? 'l' : isRight ? 'r' : null
  if (!side) return null

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
  return null
}

function frameToJoints(clip: MotionClip, frameIdx: number): Joint[] {
  const frame = clip.frames[frameIdx]
  return clip.landmarks.map((name, i) => {
    const id = KP_TO_JOINT_ID[name]
    const lm = frame.lm[i]
    const fallback = FALLBACK_JOINT_BY_ID.get(id)?.position ?? DEFAULT_JOINT_POSITION
    if (!lm || lm[0] == null || lm[1] == null || lm[2] == null || lm[3] <= 0.05) {
      return { id, position: fallback }
    }

    return {
      id,
      position: [lm[0] * KP_SCALE, HIP_LOCAL_Y - lm[1] * KP_SCALE, -lm[2] * KP_SCALE],
    }
  })
}

function readRetargetKp(
  frame: MotionFrame,
  clip: MotionClip,
  name: LandmarkName,
  out: Vector3,
): boolean {
  const idx = clip.landmarks.indexOf(name)
  const lm = frame.lm[idx]
  if (!lm || lm[0] == null || lm[1] == null || lm[2] == null || lm[3] <= 0.05) {
    return false
  }
  out.set(lm[0] * KP_SCALE, HIP_LOCAL_Y - lm[1] * KP_SCALE, -lm[2] * RETARGET_DEPTH_SCALE)
  return true
}

function CharacterModel({
  targetScale,
  joints,
  onStaticJoints,
  activeMotion,
  activeClipName,
  playbackTimeMs,
  onMotionFrame,
}: {
  targetScale: number
  joints: Joint[]
  onStaticJoints: (joints: Joint[]) => void
  activeMotion: MotionClip | null
  activeClipName: string | null
  playbackTimeMs?: number | null
  onMotionFrame: (joints: Joint[]) => void
}) {
  const { scene } = useGLTF(wishGlbUrl)
  const { animations: walkingClips } = useGLTF(walkingGlbUrl)
  const { animations: squatClips } = useGLTF(squatGlbUrl)
  const allClips = [...walkingClips, ...squatClips]
  const { actions } = useAnimations(allClips, scene)
  const groupRef = useRef<Group>(null)
  const playStartMs = useRef<number>(0)
  const lastFrameIdx = useRef<number>(-1)
  const bonesRef = useRef<Map<string, Bone>>(new Map())
  const restQuatsRef = useRef<Map<string, Quaternion>>(new Map())
  const restWorldDirsRef = useRef<Map<string, Vector3>>(new Map())
  const markerRefs = useRef<Map<string, Group>>(new Map())

  // 매 프레임 재사용할 임시 객체들
  const tmpKpP = useRef(new Vector3())
  const tmpKpC = useRef(new Vector3())
  const tmpBonePos = useRef(new Vector3())
  const tmpChildPos = useRef(new Vector3())
  const tmpRestDir = useRef(new Vector3())
  const tmpDesiredDir = useRef(new Vector3())
  const tmpKpPWorld = useRef(new Vector3())
  const tmpKpCWorld = useRef(new Vector3())
  const tmpDelta = useRef(new Quaternion())
  const tmpParentRot = useRef(new Quaternion())
  const tmpParentInvRot = useRef(new Quaternion())
  const tmpTargetRot = useRef(new Quaternion())

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    group.updateMatrixWorld(true)

    const bones = new Map<string, Bone>()
    scene.traverse(obj => {
      if ((obj as Bone).isBone) bones.set(obj.name, obj as Bone)
    })
    bonesRef.current = bones

    const restQuats = new Map<string, Quaternion>()
    const restWorldDirs = new Map<string, Vector3>()
    for (const c of BONE_CHAINS) {
      const bone = bones.get(c.bone)
      const childBone = bones.get(c.childBone)
      if (bone) restQuats.set(c.bone, bone.quaternion.clone())
      if (bone && childBone) {
        bone.getWorldPosition(tmpBonePos.current)
        childBone.getWorldPosition(tmpChildPos.current)
        const restDir = tmpChildPos.current.clone().sub(tmpBonePos.current)
        if (restDir.lengthSq() > RETARGET_MIN_DIRECTION_LENGTH) {
          restWorldDirs.set(c.bone, restDir.normalize())
        }
      }
    }
    restQuatsRef.current = restQuats
    restWorldDirsRef.current = restWorldDirs

    // 정적 마커 위치 (GLB 본 추출 결과)
    const found = new Map<string, [number, number, number]>()
    const tmp = new Vector3()
    scene.traverse(obj => {
      if (!obj.name) return
      const id = classifyBone(obj.name)
      if (!id || found.has(id)) return
      obj.getWorldPosition(tmp)
      group.worldToLocal(tmp)
      const yOffset = id === 'hip-l' || id === 'hip-r' ? HIP_Y_OFFSET : 0
      found.set(id, [tmp.x, tmp.y + yOffset, tmp.z])
    })
    if (found.size > 0) {
      onStaticJoints(Array.from(found, ([id, position]) => ({ id, position })))
    }
  }, [scene, onStaticJoints])

  useEffect(() => {
    playStartMs.current = performance.now()
    lastFrameIdx.current = -1
    if (!activeMotion || activeMotion.source === 'recorded' || activeMotion.source === 'compact') {
      // motion 종료 시 본 회전 rest 복원
      for (const [name, q] of restQuatsRef.current) {
        const bone = bonesRef.current.get(name)
        if (bone) bone.quaternion.copy(q)
      }
    }
  }, [activeMotion])

  // GLB에 베이크된 클립 재생 / 정지
  useEffect(() => {
    Object.values(actions).forEach(a => a?.stop())
    if (activeClipName) {
      actions[activeClipName]?.reset().play()
    }
  }, [activeClipName, actions])

  // 클립 정지 시 useFrame에서 ref로 mutate된 마커 group transform을 다시 props 좌표로 복원.
  // (React 입장에선 position prop이 같아 자동 갱신 안 되므로 명시적 reset 필요)
  useEffect(() => {
    if (activeClipName) return
    for (const j of joints) {
      const ref = markerRefs.current.get(j.id)
      if (!ref) continue
      ref.position.set(j.position[0], j.position[1], j.position[2])
    }
  }, [activeClipName, joints])

  useFrame(() => {
    const g = groupRef.current
    if (g) {
      const next = g.scale.x + (targetScale - g.scale.x) * 0.15
      g.scale.set(next, next, next)
    }
    if (!g) return

    // GLB 클립 재생 중에는 본 worldPosition을 따라 마커 group transform을 매 frame 동기화
    if (activeClipName) {
      const tmpV = tmpBonePos.current
      for (const j of joints) {
        const boneName = JOINT_ID_TO_BONE[j.id]
        if (!boneName) continue
        const bone = bonesRef.current.get(boneName)
        const ref = markerRefs.current.get(j.id)
        if (!bone || !ref) continue
        bone.getWorldPosition(tmpV)
        g.worldToLocal(tmpV)
        ref.position.copy(tmpV)
        if (j.id === 'hip-l' || j.id === 'hip-r') ref.position.y += HIP_Y_OFFSET
      }
      return
    }

    if (!activeMotion) return
    const shouldPlayKeypointMotion =
      activeMotion.source === 'recorded' ||
      activeMotion.source === 'compact' ||
      ENABLE_SIN_MARKER_MOTION
    if (!shouldPlayKeypointMotion) return

    const durationMs = Math.max(1, activeMotion.durationMs)
    const elapsed =
      playbackTimeMs == null
        ? (performance.now() - playStartMs.current) % durationMs
        : Math.min(durationMs, Math.max(0, playbackTimeMs))
    const idx = Math.min(
      activeMotion.frames.length - 1,
      Math.floor((elapsed / 1000) * activeMotion.fps),
    )
    const frame = activeMotion.frames[idx]
    if (idx !== lastFrameIdx.current) {
      lastFrameIdx.current = idx
      onMotionFrame(frameToJoints(activeMotion, idx))
    }

    if (!ENABLE_BONE_RETARGETING) return

    const groupMatrix = g.matrixWorld
    for (const c of BONE_CHAINS) {
      const bone = bonesRef.current.get(c.bone)
      const restQuat = restQuatsRef.current.get(c.bone)
      const restDir = restWorldDirsRef.current.get(c.bone)
      if (!bone || !restQuat || !restDir || !bone.parent) continue

      // 1. rest quaternion으로 일단 복원 후 matrixWorld 갱신 → rest world direction 측정
      if (
        !readRetargetKp(frame, activeMotion, c.parentKp, tmpKpP.current) ||
        !readRetargetKp(frame, activeMotion, c.childKp, tmpKpC.current)
      ) {
        continue
      }

      // 2. desired world direction (motion frame keypoint 기반)
      const kpP = tmpKpP.current
      const kpC = tmpKpC.current
      tmpKpPWorld.current.copy(kpP).applyMatrix4(groupMatrix)
      tmpKpCWorld.current.copy(kpC).applyMatrix4(groupMatrix)
      tmpDesiredDir.current.copy(tmpKpCWorld.current).sub(tmpKpPWorld.current)
      if (tmpDesiredDir.current.lengthSq() <= RETARGET_MIN_DIRECTION_LENGTH) continue
      tmpDesiredDir.current.normalize()

      // 3. world space에서의 회전 변화량
      tmpRestDir.current.copy(restDir)
      tmpDelta.current.setFromUnitVectors(tmpRestDir.current, tmpDesiredDir.current)

      // 4. 부모 본의 현재 world 회전
      bone.parent.updateMatrixWorld(true)
      bone.parent.matrixWorld.decompose(
        tmpBonePos.current, // pos (재활용, 사용 안 함)
        tmpParentRot.current,
        tmpChildPos.current, // scale (재활용, 사용 안 함)
      )
      tmpParentInvRot.current.copy(tmpParentRot.current).invert()

      // 5. bone.quaternion = parentInv × deltaWorld × parent × restQuat
      tmpTargetRot.current
        .copy(tmpParentInvRot.current)
        .multiply(tmpDelta.current)
        .multiply(tmpParentRot.current)
        .multiply(restQuat)
      bone.quaternion.slerp(tmpTargetRot.current, RETARGET_SLERP_FACTOR)
      bone.updateMatrixWorld(true)
    }
  })

  return (
    <group ref={groupRef} position={[0, MODEL_OFFSET_Y, 0]} scale={BASE_SCALE}>
      <primitive object={scene} />
      {joints.map(j => (
        <group
          key={j.id}
          ref={el => {
            if (el) markerRefs.current.set(j.id, el)
            else markerRefs.current.delete(j.id)
          }}
          position={j.position}
        >
          <Html center zIndexRange={[40, 0]}>
            <div className={styles.marker} aria-hidden />
          </Html>
        </group>
      ))}
    </group>
  )
}

type Character3DProps = {
  activeMotion?: MotionClip | null
  playbackTimeMs?: number | null
}

export function Character3D({ activeMotion = null, playbackTimeMs = null }: Character3DProps) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const [zoom, setZoom] = useState(0)
  const [joints, setJoints] = useState<Joint[]>(FALLBACK_JOINTS)
  const staticJointsRef = useRef<Joint[]>(FALLBACK_JOINTS)
  const activeMotionRef = useRef(activeMotion)

  const motionId = activeMotion?.id
  const activeClipName = (motionId && MOTION_CLIP_NAME[motionId]) ?? null

  useEffect(() => {
    activeMotionRef.current = activeMotion
    if (!activeMotion) setJoints(staticJointsRef.current)
  }, [activeMotion])

  const handleStaticJoints = useCallback((extracted: Joint[]) => {
    if (extracted.length === 0) return
    staticJointsRef.current = extracted
    if (!activeMotionRef.current) setJoints(extracted)
  }, [])

  const handleMotionFrame = useCallback((frameJoints: Joint[]) => {
    setJoints(frameJoints)
  }, [])

  const targetScale = BASE_SCALE * (1 + zoom * 0.15)

  const handleReset = () => {
    setZoom(0)
    controlsRef.current?.reset()
  }

  return (
    <div className={styles.viewer}>
      <div className={styles.canvasWrap}>
        <Canvas
          flat
          camera={{ position: [0, 0, 3.8], fov: 32 }}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={1.5} />
          <hemisphereLight args={['#fefdfb', '#f6f3ff', 0.4]} />
          <directionalLight position={[2, 4, 3]} intensity={1.1} color="#fefdfa" />
          <directionalLight position={[-3, 2, -2]} intensity={0.25} color="#ebe5ff" />
          <directionalLight position={[0, 2, 5]} intensity={0.15} color="#fefaf2" />
          <Suspense fallback={null}>
            <CharacterModel
              targetScale={targetScale}
              joints={joints}
              onStaticJoints={handleStaticJoints}
              activeMotion={activeMotion}
              activeClipName={activeClipName}
              playbackTimeMs={playbackTimeMs}
              onMotionFrame={handleMotionFrame}
            />
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
