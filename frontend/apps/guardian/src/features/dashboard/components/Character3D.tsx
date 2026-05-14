import { Suspense, useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, useAnimations, useGLTF } from '@react-three/drei'
import { Matrix4, MathUtils, Quaternion, Vector3, type Bone, type Group } from 'three'
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
// Front-facing replay should be driven mostly by x/y; z is noisy and can twist limbs backward.
const RETARGET_DEPTH_DAMPING_RATIO = 0.15
const RETARGET_DEPTH_SCALE = KP_SCALE * RETARGET_DEPTH_DAMPING_RATIO
// Smooths replay bone rotation across render frames.
const RETARGET_SLERP_FACTOR = 0.45
const RETARGET_MIN_DIRECTION_LENGTH = 0.001
const RETARGET_UPPER_LIMB_MAX_ROTATION_RAD = Math.PI * 0.68
const RETARGET_LOWER_LIMB_MAX_ROTATION_RAD = Math.PI * 0.78
const TORSO_GUARD_VERTICAL_PADDING = 0.04
const TORSO_GUARD_SIDE_MARGIN_RATIO = 0.1
const TORSO_GUARD_FORWARD_Z = 0.08
const TORSO_MIN_SHOULDER_SPAN = 0.08
// Keep a small reach margin because replay landmarks and GLB arm length are not identical.
const ARM_IK_MAX_REACH_RATIO = 1.15
const ARM_IK_MIN_REACH_RATIO = 0.18
const ARM_IK_OBSERVED_POLE_WEIGHT = 0.72
const ARM_IK_CROSS_BODY_OBSERVED_POLE_WEIGHT = 0.45
const ARM_IK_ELBOW_SIDE_BIAS = 0.7
const ARM_IK_ELBOW_FORWARD_BIAS = 0.18
const UPPER_BODY_SLERP_FACTOR = 0.28
const HEAD_RETARGET_SLERP_FACTOR = 0.24
const SHOULDER_RETARGET_SLERP_FACTOR = 0.32
const TORSO_MAX_YAW_RAD = Math.PI * 0.08
const TORSO_MAX_ROLL_RAD = Math.PI * 0.06
const TORSO_YAW_SCALE = 0.32
const TORSO_ROLL_SCALE = 0.4
const SHOULDER_MAX_ROTATION_RAD = Math.PI * 0.18
const NECK_MAX_ROTATION_RAD = Math.PI * 0.14
const HEAD_MAX_ROTATION_RAD = Math.PI * 0.12
const LOCAL_X_AXIS = new Vector3(1, 0, 0)
const LOCAL_Y_AXIS = new Vector3(0, 1, 0)
const LOCAL_Z_AXIS = new Vector3(0, 0, 1)

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
  NOSE: 'head',
  LEFT_EAR: 'ear-l',
  RIGHT_EAR: 'ear-r',
  LEFT_SHOULDER: 'shoulder-l',
  RIGHT_SHOULDER: 'shoulder-r',
  LEFT_ELBOW: 'elbow-l',
  RIGHT_ELBOW: 'elbow-r',
  LEFT_WRIST: 'wrist-l',
  RIGHT_WRIST: 'wrist-r',
  LEFT_PINKY: 'pinky-l',
  RIGHT_PINKY: 'pinky-r',
  LEFT_INDEX: 'index-l',
  RIGHT_INDEX: 'index-r',
  LEFT_THUMB: 'thumb-l',
  RIGHT_THUMB: 'thumb-r',
  LEFT_HIP: 'hip-l',
  RIGHT_HIP: 'hip-r',
  LEFT_KNEE: 'knee-l',
  RIGHT_KNEE: 'knee-r',
  LEFT_ANKLE: 'ankle-l',
  RIGHT_ANKLE: 'ankle-r',
  LEFT_HEEL: 'heel-l',
  RIGHT_HEEL: 'heel-r',
  LEFT_FOOT_INDEX: 'foot-index-l',
  RIGHT_FOOT_INDEX: 'foot-index-r',
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
  maxRotationRad: number
}> = [
  {
    bone: 'LeftArm',
    childBone: 'LeftForeArm',
    parentKp: 'LEFT_SHOULDER',
    childKp: 'LEFT_ELBOW',
    maxRotationRad: RETARGET_UPPER_LIMB_MAX_ROTATION_RAD,
  },
  {
    bone: 'LeftForeArm',
    childBone: 'LeftHand',
    parentKp: 'LEFT_ELBOW',
    childKp: 'LEFT_WRIST',
    maxRotationRad: RETARGET_LOWER_LIMB_MAX_ROTATION_RAD,
  },
  {
    bone: 'RightArm',
    childBone: 'RightForeArm',
    parentKp: 'RIGHT_SHOULDER',
    childKp: 'RIGHT_ELBOW',
    maxRotationRad: RETARGET_UPPER_LIMB_MAX_ROTATION_RAD,
  },
  {
    bone: 'RightForeArm',
    childBone: 'RightHand',
    parentKp: 'RIGHT_ELBOW',
    childKp: 'RIGHT_WRIST',
    maxRotationRad: RETARGET_LOWER_LIMB_MAX_ROTATION_RAD,
  },
  {
    bone: 'LeftUpLeg',
    childBone: 'LeftLeg',
    parentKp: 'LEFT_HIP',
    childKp: 'LEFT_KNEE',
    maxRotationRad: RETARGET_UPPER_LIMB_MAX_ROTATION_RAD,
  },
  {
    bone: 'LeftLeg',
    childBone: 'LeftFoot',
    parentKp: 'LEFT_KNEE',
    childKp: 'LEFT_ANKLE',
    maxRotationRad: RETARGET_LOWER_LIMB_MAX_ROTATION_RAD,
  },
  {
    bone: 'RightUpLeg',
    childBone: 'RightLeg',
    parentKp: 'RIGHT_HIP',
    childKp: 'RIGHT_KNEE',
    maxRotationRad: RETARGET_UPPER_LIMB_MAX_ROTATION_RAD,
  },
  {
    bone: 'RightLeg',
    childBone: 'RightFoot',
    parentKp: 'RIGHT_KNEE',
    childKp: 'RIGHT_ANKLE',
    maxRotationRad: RETARGET_LOWER_LIMB_MAX_ROTATION_RAD,
  },
]

const UPPER_BODY_DIRECTION_CHAINS = [
  {
    bone: 'LeftShoulder',
    childBone: 'LeftArm',
    maxRotationRad: SHOULDER_MAX_ROTATION_RAD,
    slerpFactor: SHOULDER_RETARGET_SLERP_FACTOR,
  },
  {
    bone: 'RightShoulder',
    childBone: 'RightArm',
    maxRotationRad: SHOULDER_MAX_ROTATION_RAD,
    slerpFactor: SHOULDER_RETARGET_SLERP_FACTOR,
  },
  {
    bone: 'neck',
    childBone: 'Head',
    maxRotationRad: NECK_MAX_ROTATION_RAD,
    slerpFactor: HEAD_RETARGET_SLERP_FACTOR,
  },
  {
    bone: 'Head',
    childBone: 'headfront',
    maxRotationRad: HEAD_MAX_ROTATION_RAD,
    slerpFactor: HEAD_RETARGET_SLERP_FACTOR,
  },
] as const

const UPPER_BODY_LOCAL_BONES = ['Spine', 'Spine01', 'Spine02'] as const
const DIRECTION_REST_CHAINS = [...BONE_CHAINS, ...UPPER_BODY_DIRECTION_CHAINS]

type Joint = { id: string; position: [number, number, number] }

const FALLBACK_JOINTS: Joint[] = [
  { id: 'head', position: [0, 1.54, 0.05] },
  { id: 'ear-l', position: [-0.12, 1.48, 0.05] },
  { id: 'ear-r', position: [0.12, 1.48, 0.05] },
  { id: 'shoulder-l', position: [-0.18, 1.3, 0.06] },
  { id: 'shoulder-r', position: [0.18, 1.3, 0.06] },
  { id: 'elbow-l', position: [-0.22, 1.0, 0.05] },
  { id: 'elbow-r', position: [0.22, 1.0, 0.05] },
  { id: 'wrist-l', position: [-0.24, 0.7, 0.05] },
  { id: 'wrist-r', position: [0.24, 0.7, 0.05] },
  { id: 'pinky-l', position: [-0.28, 0.68, 0.05] },
  { id: 'pinky-r', position: [0.28, 0.68, 0.05] },
  { id: 'index-l', position: [-0.27, 0.69, 0.05] },
  { id: 'index-r', position: [0.27, 0.69, 0.05] },
  { id: 'thumb-l', position: [-0.23, 0.7, 0.05] },
  { id: 'thumb-r', position: [0.23, 0.7, 0.05] },
  { id: 'hip-l', position: [-0.1, 0.62, 0.06] },
  { id: 'hip-r', position: [0.1, 0.62, 0.06] },
  { id: 'knee-l', position: [-0.1, 0.4, 0.06] },
  { id: 'knee-r', position: [0.1, 0.4, 0.06] },
  { id: 'ankle-l', position: [-0.1, 0.05, 0.06] },
  { id: 'ankle-r', position: [0.1, 0.05, 0.06] },
  { id: 'heel-l', position: [-0.11, 0.02, 0.07] },
  { id: 'heel-r', position: [0.11, 0.02, 0.07] },
  { id: 'foot-index-l', position: [-0.1, 0, 0.0] },
  { id: 'foot-index-r', position: [0.1, 0, 0.0] },
]

const FALLBACK_JOINT_BY_ID = new Map(FALLBACK_JOINTS.map(joint => [joint.id, joint]))
const DEFAULT_JOINT_POSITION: [number, number, number] = [0, 0, 0]
const ARM_ELBOW_LANDMARK_NAMES = new Set<LandmarkName>(['LEFT_ELBOW', 'RIGHT_ELBOW'])
const ARM_TARGET_LANDMARK_NAMES = new Set<LandmarkName>([
  'LEFT_ELBOW',
  'RIGHT_ELBOW',
  'LEFT_WRIST',
  'RIGHT_WRIST',
])
type ArmSide = 'LEFT' | 'RIGHT'
const ARM_KPS_BY_SIDE = {
  LEFT: {
    shoulder: 'LEFT_SHOULDER',
    elbow: 'LEFT_ELBOW',
    wrist: 'LEFT_WRIST',
  },
  RIGHT: {
    shoulder: 'RIGHT_SHOULDER',
    elbow: 'RIGHT_ELBOW',
    wrist: 'RIGHT_WRIST',
  },
} as const satisfies Record<
  ArmSide,
  { shoulder: LandmarkName; elbow: LandmarkName; wrist: LandmarkName }
>

type ArmIkScratch = {
  shoulder: Vector3
  elbow: Vector3
  wrist: Vector3
  targetElbow: Vector3
  targetWrist: Vector3
  chainDir: Vector3
  projectedBase: Vector3
  observedPole: Vector3
  fallbackPole: Vector3
  pole: Vector3
  leftShoulder: Vector3
  rightShoulder: Vector3
  leftHip: Vector3
  rightHip: Vector3
}

type DirectionRetargetScratch = {
  startWorld: Vector3
  endWorld: Vector3
  desiredDir: Vector3
  restDir: Vector3
  parentPosition: Vector3
  parentRotation: Quaternion
  parentScale: Vector3
  parentInvRotation: Quaternion
  delta: Quaternion
  targetRotation: Quaternion
}

type UpperBodyScratch = {
  leftShoulder: Vector3
  rightShoulder: Vector3
  leftHip: Vector3
  rightHip: Vector3
  nose: Vector3
  leftEar: Vector3
  rightEar: Vector3
  shoulderCenter: Vector3
  hipCenter: Vector3
  headCenter: Vector3
  targetStart: Vector3
  targetEnd: Vector3
  yawRotation: Quaternion
  rollRotation: Quaternion
  pitchRotation: Quaternion
  targetRotation: Quaternion
}

function isFiniteVector3(v: Vector3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)
}

function normalizeDirection(v: Vector3): boolean {
  const lengthSq = v.lengthSq()
  if (!Number.isFinite(lengthSq) || lengthSq <= RETARGET_MIN_DIRECTION_LENGTH) return false
  v.normalize()
  return isFiniteVector3(v)
}

function limitDirectionFromRest(restDir: Vector3, desiredDir: Vector3, maxRadians: number): void {
  const angle = restDir.angleTo(desiredDir)
  if (!Number.isFinite(angle) || angle <= maxRadians) return

  desiredDir.copy(restDir).lerp(desiredDir, maxRadians / angle)
  normalizeDirection(desiredDir)
}

function isArmElbowLandmark(name: LandmarkName): boolean {
  return ARM_ELBOW_LANDMARK_NAMES.has(name)
}

function isArmTargetLandmark(name: LandmarkName): boolean {
  return ARM_TARGET_LANDMARK_NAMES.has(name)
}

function isLeftSideLandmark(name: LandmarkName): boolean {
  return name.startsWith('LEFT_')
}

function getArmSide(parentKp: LandmarkName, childKp: LandmarkName): ArmSide | null {
  if (
    (parentKp === 'LEFT_SHOULDER' && childKp === 'LEFT_ELBOW') ||
    (parentKp === 'LEFT_ELBOW' && childKp === 'LEFT_WRIST')
  ) {
    return 'LEFT'
  }
  if (
    (parentKp === 'RIGHT_SHOULDER' && childKp === 'RIGHT_ELBOW') ||
    (parentKp === 'RIGHT_ELBOW' && childKp === 'RIGHT_WRIST')
  ) {
    return 'RIGHT'
  }
  return null
}

function getArmSideSign(side: ArmSide): number {
  return side === 'LEFT' ? -1 : 1
}

function mutateTorsoGuardedArmPoint(
  frame: MotionFrame,
  clip: MotionClip,
  childKp: LandmarkName,
  point: Vector3,
  leftShoulder: Vector3,
  rightShoulder: Vector3,
  leftHip: Vector3,
  rightHip: Vector3,
): void {
  if (!isArmTargetLandmark(childKp)) return
  if (
    !tryReadRetargetKp(frame, clip, 'LEFT_SHOULDER', leftShoulder) ||
    !tryReadRetargetKp(frame, clip, 'RIGHT_SHOULDER', rightShoulder) ||
    !tryReadRetargetKp(frame, clip, 'LEFT_HIP', leftHip) ||
    !tryReadRetargetKp(frame, clip, 'RIGHT_HIP', rightHip)
  ) {
    return
  }
  if (
    !isFiniteVector3(leftShoulder) ||
    !isFiniteVector3(rightShoulder) ||
    !isFiniteVector3(leftHip) ||
    !isFiniteVector3(rightHip)
  ) {
    return
  }

  const shoulderSpan = Math.abs(rightShoulder.x - leftShoulder.x)
  if (!Number.isFinite(shoulderSpan) || shoulderSpan <= TORSO_MIN_SHOULDER_SPAN) return

  const topY = Math.max(leftShoulder.y, rightShoulder.y) + TORSO_GUARD_VERTICAL_PADDING
  const bottomY = Math.min(leftHip.y, rightHip.y) - TORSO_GUARD_VERTICAL_PADDING
  if (point.y > topY || point.y < bottomY) return

  const torsoMinX = Math.min(leftShoulder.x, rightShoulder.x, leftHip.x, rightHip.x)
  const torsoMaxX = Math.max(leftShoulder.x, rightShoulder.x, leftHip.x, rightHip.x)
  const centerZ = (leftShoulder.z + rightShoulder.z + leftHip.z + rightHip.z) / 4

  if (point.x >= torsoMinX && point.x <= torsoMaxX) {
    point.z = Math.max(point.z, centerZ + TORSO_GUARD_FORWARD_Z)
  }

  if (!isArmElbowLandmark(childKp)) return

  const sideMargin = shoulderSpan * TORSO_GUARD_SIDE_MARGIN_RATIO
  if (isLeftSideLandmark(childKp)) {
    const leftLimit = Math.min(leftShoulder.x, leftHip.x) - sideMargin
    if (point.x > leftLimit) point.x = leftLimit
  } else {
    const rightLimit = Math.max(rightShoulder.x, rightHip.x) + sideMargin
    if (point.x < rightLimit) point.x = rightLimit
  }
}

function applyArmIkTargets(
  frame: MotionFrame,
  clip: MotionClip,
  parentKp: LandmarkName,
  childKp: LandmarkName,
  parentPoint: Vector3,
  childPoint: Vector3,
  scratch: ArmIkScratch,
): void {
  const side = getArmSide(parentKp, childKp)
  if (!side) return

  const kps = ARM_KPS_BY_SIDE[side]
  if (
    !tryReadRetargetKp(frame, clip, kps.shoulder, scratch.shoulder) ||
    !tryReadRetargetKp(frame, clip, kps.elbow, scratch.elbow) ||
    !tryReadRetargetKp(frame, clip, kps.wrist, scratch.wrist)
  ) {
    return
  }

  const upperLen = scratch.shoulder.distanceTo(scratch.elbow)
  const lowerLen = scratch.elbow.distanceTo(scratch.wrist)
  if (
    !Number.isFinite(upperLen) ||
    !Number.isFinite(lowerLen) ||
    upperLen <= RETARGET_MIN_DIRECTION_LENGTH ||
    lowerLen <= RETARGET_MIN_DIRECTION_LENGTH
  ) {
    return
  }

  scratch.targetWrist.copy(scratch.wrist)
  mutateTorsoGuardedArmPoint(
    frame,
    clip,
    kps.wrist,
    scratch.targetWrist,
    scratch.leftShoulder,
    scratch.rightShoulder,
    scratch.leftHip,
    scratch.rightHip,
  )

  scratch.chainDir.copy(scratch.targetWrist).sub(scratch.shoulder)
  let reach = scratch.chainDir.length()
  if (!Number.isFinite(reach) || reach <= RETARGET_MIN_DIRECTION_LENGTH) return

  const maxReach = (upperLen + lowerLen) * ARM_IK_MAX_REACH_RATIO
  const minReach = Math.max(
    Math.abs(upperLen - lowerLen) + RETARGET_MIN_DIRECTION_LENGTH,
    (upperLen + lowerLen) * ARM_IK_MIN_REACH_RATIO,
  )
  scratch.chainDir.normalize()
  if (reach > maxReach) {
    reach = maxReach
    scratch.targetWrist.copy(scratch.shoulder).addScaledVector(scratch.chainDir, reach)
  } else if (reach < minReach) {
    reach = minReach
    scratch.targetWrist.copy(scratch.shoulder).addScaledVector(scratch.chainDir, reach)
  }

  const mid =
    (upperLen * upperLen - lowerLen * lowerLen + reach * reach) / Math.max(2 * reach, 0.0001)
  const bendHeight = Math.sqrt(Math.max(0, upperLen * upperLen - mid * mid))
  scratch.projectedBase.copy(scratch.shoulder).addScaledVector(scratch.chainDir, mid)

  scratch.observedPole.copy(scratch.elbow).sub(scratch.shoulder)
  scratch.observedPole.addScaledVector(
    scratch.chainDir,
    -scratch.observedPole.dot(scratch.chainDir),
  )
  const observedPoleValid = normalizeDirection(scratch.observedPole)

  const sideSign = getArmSideSign(side)
  scratch.fallbackPole.set(sideSign * ARM_IK_ELBOW_SIDE_BIAS, 0, ARM_IK_ELBOW_FORWARD_BIAS)
  scratch.fallbackPole.addScaledVector(
    scratch.chainDir,
    -scratch.fallbackPole.dot(scratch.chainDir),
  )
  if (!normalizeDirection(scratch.fallbackPole)) {
    scratch.fallbackPole.set(sideSign, 0, 0)
  }

  scratch.pole.copy(scratch.fallbackPole)
  if (observedPoleValid && scratch.observedPole.x * sideSign > 0) {
    scratch.pole.lerp(scratch.observedPole, ARM_IK_OBSERVED_POLE_WEIGHT)
    normalizeDirection(scratch.pole)
  } else if (observedPoleValid) {
    scratch.pole.lerp(scratch.observedPole, ARM_IK_CROSS_BODY_OBSERVED_POLE_WEIGHT)
    normalizeDirection(scratch.pole)
  }

  scratch.targetElbow.copy(scratch.projectedBase).addScaledVector(scratch.pole, bendHeight)
  mutateTorsoGuardedArmPoint(
    frame,
    clip,
    kps.elbow,
    scratch.targetElbow,
    scratch.leftShoulder,
    scratch.rightShoulder,
    scratch.leftHip,
    scratch.rightHip,
  )

  if (parentKp === kps.shoulder && childKp === kps.elbow) {
    parentPoint.copy(scratch.shoulder)
    childPoint.copy(scratch.targetElbow)
  } else if (parentKp === kps.elbow && childKp === kps.wrist) {
    parentPoint.copy(scratch.targetElbow)
    childPoint.copy(scratch.targetWrist)
  }
}

function retargetBoneFromPoints(
  bone: Bone | undefined,
  restQuat: Quaternion | undefined,
  restParentDir: Vector3 | undefined,
  groupMatrix: Matrix4,
  startPoint: Vector3,
  endPoint: Vector3,
  maxRotationRad: number,
  slerpFactor: number,
  scratch: DirectionRetargetScratch,
): boolean {
  if (!bone || !restQuat || !restParentDir || !bone.parent) return false
  const parent = bone.parent

  scratch.startWorld.copy(startPoint).applyMatrix4(groupMatrix)
  scratch.endWorld.copy(endPoint).applyMatrix4(groupMatrix)
  scratch.desiredDir.copy(scratch.endWorld).sub(scratch.startWorld)
  if (!normalizeDirection(scratch.desiredDir)) return false

  parent.updateWorldMatrix(true, false)
  parent.matrixWorld.decompose(scratch.parentPosition, scratch.parentRotation, scratch.parentScale)
  scratch.parentInvRotation.copy(scratch.parentRotation).invert()
  scratch.desiredDir.applyQuaternion(scratch.parentInvRotation)
  if (!normalizeDirection(scratch.desiredDir)) return false

  scratch.restDir.copy(restParentDir)
  if (!normalizeDirection(scratch.restDir)) return false
  limitDirectionFromRest(scratch.restDir, scratch.desiredDir, maxRotationRad)
  scratch.delta.setFromUnitVectors(scratch.restDir, scratch.desiredDir)
  scratch.targetRotation.copy(scratch.delta).multiply(restQuat)
  bone.quaternion.slerp(scratch.targetRotation, slerpFactor)
  return true
}

function slerpBoneLocalRotation(
  bone: Bone | undefined,
  restQuat: Quaternion | undefined,
  yawRad: number,
  rollRad: number,
  pitchRad: number,
  slerpFactor: number,
  scratch: UpperBodyScratch,
): boolean {
  if (!bone || !restQuat) return false

  scratch.yawRotation.setFromAxisAngle(LOCAL_Y_AXIS, yawRad)
  scratch.rollRotation.setFromAxisAngle(LOCAL_Z_AXIS, rollRad)
  scratch.pitchRotation.setFromAxisAngle(LOCAL_X_AXIS, pitchRad)
  scratch.targetRotation
    .copy(restQuat)
    .multiply(scratch.yawRotation)
    .multiply(scratch.rollRotation)
    .multiply(scratch.pitchRotation)
  bone.quaternion.slerp(scratch.targetRotation, slerpFactor)
  return true
}

function applyUpperBodyRetargeting(
  frame: MotionFrame,
  clip: MotionClip,
  bones: Map<string, Bone>,
  restQuats: Map<string, Quaternion>,
  restParentDirs: Map<string, Vector3>,
  groupMatrix: Matrix4,
  upperScratch: UpperBodyScratch,
  directionScratch: DirectionRetargetScratch,
): boolean {
  if (
    !tryReadRetargetKp(frame, clip, 'LEFT_SHOULDER', upperScratch.leftShoulder) ||
    !tryReadRetargetKp(frame, clip, 'RIGHT_SHOULDER', upperScratch.rightShoulder) ||
    !tryReadRetargetKp(frame, clip, 'LEFT_HIP', upperScratch.leftHip) ||
    !tryReadRetargetKp(frame, clip, 'RIGHT_HIP', upperScratch.rightHip)
  ) {
    return false
  }

  const shoulderSpan = upperScratch.leftShoulder.distanceTo(upperScratch.rightShoulder)
  if (!Number.isFinite(shoulderSpan) || shoulderSpan <= TORSO_MIN_SHOULDER_SPAN) {
    return false
  }

  upperScratch.shoulderCenter
    .copy(upperScratch.leftShoulder)
    .add(upperScratch.rightShoulder)
    .multiplyScalar(0.5)
  upperScratch.hipCenter.copy(upperScratch.leftHip).add(upperScratch.rightHip).multiplyScalar(0.5)

  const yaw = MathUtils.clamp(
    ((upperScratch.rightShoulder.z - upperScratch.leftShoulder.z) / shoulderSpan) * TORSO_YAW_SCALE,
    -TORSO_MAX_YAW_RAD,
    TORSO_MAX_YAW_RAD,
  )
  const roll = MathUtils.clamp(
    Math.atan2(upperScratch.rightShoulder.y - upperScratch.leftShoulder.y, shoulderSpan) *
      TORSO_ROLL_SCALE,
    -TORSO_MAX_ROLL_RAD,
    TORSO_MAX_ROLL_RAD,
  )

  let didRetarget = false
  didRetarget =
    slerpBoneLocalRotation(
      bones.get('Spine'),
      restQuats.get('Spine'),
      yaw * 0.2,
      roll * 0.2,
      0,
      UPPER_BODY_SLERP_FACTOR,
      upperScratch,
    ) || didRetarget
  didRetarget =
    slerpBoneLocalRotation(
      bones.get('Spine01'),
      restQuats.get('Spine01'),
      yaw * 0.35,
      roll * 0.3,
      0,
      UPPER_BODY_SLERP_FACTOR,
      upperScratch,
    ) || didRetarget
  didRetarget =
    slerpBoneLocalRotation(
      bones.get('Spine02'),
      restQuats.get('Spine02'),
      yaw * 0.45,
      roll * 0.4,
      0,
      UPPER_BODY_SLERP_FACTOR,
      upperScratch,
    ) || didRetarget

  upperScratch.targetStart.copy(upperScratch.shoulderCenter)
  upperScratch.targetEnd.copy(upperScratch.leftShoulder)
  didRetarget =
    retargetBoneFromPoints(
      bones.get('LeftShoulder'),
      restQuats.get('LeftShoulder'),
      restParentDirs.get('LeftShoulder'),
      groupMatrix,
      upperScratch.targetStart,
      upperScratch.targetEnd,
      SHOULDER_MAX_ROTATION_RAD,
      SHOULDER_RETARGET_SLERP_FACTOR,
      directionScratch,
    ) || didRetarget

  upperScratch.targetEnd.copy(upperScratch.rightShoulder)
  didRetarget =
    retargetBoneFromPoints(
      bones.get('RightShoulder'),
      restQuats.get('RightShoulder'),
      restParentDirs.get('RightShoulder'),
      groupMatrix,
      upperScratch.targetStart,
      upperScratch.targetEnd,
      SHOULDER_MAX_ROTATION_RAD,
      SHOULDER_RETARGET_SLERP_FACTOR,
      directionScratch,
    ) || didRetarget

  const hasNose = tryReadRetargetKp(frame, clip, 'NOSE', upperScratch.nose)
  const hasLeftEar = tryReadRetargetKp(frame, clip, 'LEFT_EAR', upperScratch.leftEar)
  const hasRightEar = tryReadRetargetKp(frame, clip, 'RIGHT_EAR', upperScratch.rightEar)
  if (hasLeftEar && hasRightEar) {
    upperScratch.headCenter
      .copy(upperScratch.leftEar)
      .add(upperScratch.rightEar)
      .multiplyScalar(0.5)
  } else if (hasNose) {
    upperScratch.headCenter.copy(upperScratch.nose)
  } else {
    return didRetarget
  }

  didRetarget =
    retargetBoneFromPoints(
      bones.get('neck'),
      restQuats.get('neck'),
      restParentDirs.get('neck'),
      groupMatrix,
      upperScratch.shoulderCenter,
      upperScratch.headCenter,
      NECK_MAX_ROTATION_RAD,
      HEAD_RETARGET_SLERP_FACTOR,
      directionScratch,
    ) || didRetarget

  if (hasNose && hasLeftEar && hasRightEar) {
    didRetarget =
      retargetBoneFromPoints(
        bones.get('Head'),
        restQuats.get('Head'),
        restParentDirs.get('Head'),
        groupMatrix,
        upperScratch.headCenter,
        upperScratch.nose,
        HEAD_MAX_ROTATION_RAD,
        HEAD_RETARGET_SLERP_FACTOR,
        directionScratch,
      ) || didRetarget
  }

  return didRetarget
}

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

function tryReadRetargetKp(
  frame: MotionFrame,
  clip: MotionClip,
  name: LandmarkName,
  out: Vector3,
): boolean {
  const idx = clip.landmarks.indexOf(name)
  const lm = frame.lm[idx]
  if (!lm || lm[0] == null || lm[1] == null || lm[2] == null || lm[3] <= 0.05) {
    out.set(0, 0, 0)
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
  const restParentDirsRef = useRef<Map<string, Vector3>>(new Map())
  const markerRefs = useRef<Map<string, Group>>(new Map())
  const updatedParentIdsRef = useRef<Set<string>>(new Set())

  // 매 프레임 재사용할 임시 객체들
  const tmpKpP = useRef(new Vector3())
  const tmpKpC = useRef(new Vector3())
  const tmpGuardLeftShoulder = useRef(new Vector3())
  const tmpGuardRightShoulder = useRef(new Vector3())
  const tmpGuardLeftHip = useRef(new Vector3())
  const tmpGuardRightHip = useRef(new Vector3())
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
  const upperBodyScratch = useRef<UpperBodyScratch>({
    leftShoulder: new Vector3(),
    rightShoulder: new Vector3(),
    leftHip: new Vector3(),
    rightHip: new Vector3(),
    nose: new Vector3(),
    leftEar: new Vector3(),
    rightEar: new Vector3(),
    shoulderCenter: new Vector3(),
    hipCenter: new Vector3(),
    headCenter: new Vector3(),
    targetStart: new Vector3(),
    targetEnd: new Vector3(),
    yawRotation: new Quaternion(),
    rollRotation: new Quaternion(),
    pitchRotation: new Quaternion(),
    targetRotation: new Quaternion(),
  })
  const directionRetargetScratch = useRef<DirectionRetargetScratch>({
    startWorld: new Vector3(),
    endWorld: new Vector3(),
    desiredDir: new Vector3(),
    restDir: new Vector3(),
    parentPosition: new Vector3(),
    parentRotation: new Quaternion(),
    parentScale: new Vector3(),
    parentInvRotation: new Quaternion(),
    delta: new Quaternion(),
    targetRotation: new Quaternion(),
  })
  const armIkScratch = useRef<ArmIkScratch>({
    shoulder: new Vector3(),
    elbow: new Vector3(),
    wrist: new Vector3(),
    targetElbow: new Vector3(),
    targetWrist: new Vector3(),
    chainDir: new Vector3(),
    projectedBase: new Vector3(),
    observedPole: new Vector3(),
    fallbackPole: new Vector3(),
    pole: new Vector3(),
    leftShoulder: new Vector3(),
    rightShoulder: new Vector3(),
    leftHip: new Vector3(),
    rightHip: new Vector3(),
  })

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
    const restParentDirs = new Map<string, Vector3>()
    for (const boneName of UPPER_BODY_LOCAL_BONES) {
      const bone = bones.get(boneName)
      if (bone) restQuats.set(boneName, bone.quaternion.clone())
    }
    for (const c of DIRECTION_REST_CHAINS) {
      const bone = bones.get(c.bone)
      const childBone = bones.get(c.childBone)
      if (bone) restQuats.set(c.bone, bone.quaternion.clone())
      if (bone && childBone && bone.parent) {
        bone.getWorldPosition(tmpBonePos.current)
        childBone.getWorldPosition(tmpChildPos.current)
        tmpRestDir.current.copy(tmpChildPos.current).sub(tmpBonePos.current)
        if (normalizeDirection(tmpRestDir.current)) {
          bone.parent.updateWorldMatrix(true, false)
          bone.parent.matrixWorld.decompose(
            tmpBonePos.current,
            tmpParentRot.current,
            tmpChildPos.current,
          )
          tmpParentInvRot.current.copy(tmpParentRot.current).invert()
          tmpRestDir.current.applyQuaternion(tmpParentInvRot.current)
          if (normalizeDirection(tmpRestDir.current)) {
            restParentDirs.set(c.bone, tmpRestDir.current.clone())
          }
        }
      }
    }
    restQuatsRef.current = restQuats
    restParentDirsRef.current = restParentDirs

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

    g.updateWorldMatrix(false, false)
    const groupMatrix = g.matrixWorld
    let didRetarget = false
    const updatedParentIds = updatedParentIdsRef.current
    updatedParentIds.clear()
    if (
      applyUpperBodyRetargeting(
        frame,
        activeMotion,
        bonesRef.current,
        restQuatsRef.current,
        restParentDirsRef.current,
        groupMatrix,
        upperBodyScratch.current,
        directionRetargetScratch.current,
      )
    ) {
      g.updateWorldMatrix(false, true)
      didRetarget = true
    }
    for (const c of BONE_CHAINS) {
      const bone = bonesRef.current.get(c.bone)
      const restQuat = restQuatsRef.current.get(c.bone)
      const restParentDir = restParentDirsRef.current.get(c.bone)
      if (!bone || !restQuat || !restParentDir || !bone.parent) continue
      const parent = bone.parent

      // 1. rest quaternion으로 일단 복원 후 matrixWorld 갱신 → rest world direction 측정
      if (
        !tryReadRetargetKp(frame, activeMotion, c.parentKp, tmpKpP.current) ||
        !tryReadRetargetKp(frame, activeMotion, c.childKp, tmpKpC.current)
      ) {
        continue
      }

      // 2. desired world direction (motion frame keypoint 기반)
      applyArmIkTargets(
        frame,
        activeMotion,
        c.parentKp,
        c.childKp,
        tmpKpP.current,
        tmpKpC.current,
        armIkScratch.current,
      )

      mutateTorsoGuardedArmPoint(
        frame,
        activeMotion,
        c.childKp,
        tmpKpC.current,
        tmpGuardLeftShoulder.current,
        tmpGuardRightShoulder.current,
        tmpGuardLeftHip.current,
        tmpGuardRightHip.current,
      )
      const kpP = tmpKpP.current
      const kpC = tmpKpC.current
      tmpKpPWorld.current.copy(kpP).applyMatrix4(groupMatrix)
      tmpKpCWorld.current.copy(kpC).applyMatrix4(groupMatrix)
      tmpDesiredDir.current.copy(tmpKpCWorld.current).sub(tmpKpPWorld.current)
      if (!normalizeDirection(tmpDesiredDir.current)) continue

      const parentId = parent.uuid
      if (!updatedParentIds.has(parentId)) {
        parent.updateWorldMatrix(true, false)
        updatedParentIds.add(parentId)
      }
      parent.matrixWorld.decompose(tmpBonePos.current, tmpParentRot.current, tmpChildPos.current)
      tmpParentInvRot.current.copy(tmpParentRot.current).invert()
      tmpDesiredDir.current.applyQuaternion(tmpParentInvRot.current)
      if (!normalizeDirection(tmpDesiredDir.current)) continue

      // 3. world space에서의 회전 변화량
      tmpRestDir.current.copy(restParentDir)
      const restDirLengthSq = tmpRestDir.current.lengthSq()
      if (!Number.isFinite(restDirLengthSq) || restDirLengthSq <= RETARGET_MIN_DIRECTION_LENGTH) {
        continue
      }
      if (!normalizeDirection(tmpRestDir.current)) continue
      limitDirectionFromRest(tmpRestDir.current, tmpDesiredDir.current, c.maxRotationRad)
      tmpDelta.current.setFromUnitVectors(tmpRestDir.current, tmpDesiredDir.current)

      // 4. bone.quaternion = parent-local delta * restQuat
      tmpTargetRot.current.copy(tmpDelta.current).multiply(restQuat)
      bone.quaternion.slerp(tmpTargetRot.current, RETARGET_SLERP_FACTOR)
      didRetarget = true
    }
    if (didRetarget) g.updateWorldMatrix(false, true)
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
