import { useQuery } from '@tanstack/react-query'
import {
  getExerciseMotionMovementAnalysis,
  getExerciseSessionDetail,
  getExerciseSessions,
  type ExerciseMotionMovementAnalysisJointRange,
  type ExerciseMotionMovementAnalysisResponse,
  type ExerciseSessionDetail,
  type ExerciseSessionSummary,
} from '@wish/api-client'
import {
  ROM_JOINT_GROUPS,
  type RomExcludedSegment,
  type RomJointDetail,
  type RomJointGroup,
  type RomJointTrendPoint,
  type RomMovementAnalysisView,
} from './data/model'

export const ROM_MOVEMENT_ANALYSIS_QUERY_KEY = 'rom-movement-analysis'

type MotionJointValue = {
  motionName: string
  routineOrder: number
  left: ExerciseMotionMovementAnalysisJointRange | null
  right: ExerciseMotionMovementAnalysisJointRange | null
  rangeDeg: number | null
  confidencePercent: number | null
}

function isGymnasticsSession(session: Pick<ExerciseSessionSummary, 'exerciseType'>): boolean {
  return session.exerciseType === 'TOP' || session.exerciseType === 'DANIEL'
}

function sessionTime(session: Pick<ExerciseSessionSummary, 'createdAt'>): number {
  const time = Date.parse(session.createdAt)
  return Number.isFinite(time) ? time : 0
}

function findLatestGymnasticsSession(
  sessions: ExerciseSessionSummary[],
): ExerciseSessionSummary | null {
  return (
    [...sessions].filter(isGymnasticsSession).sort((a, b) => sessionTime(b) - sessionTime(a))[0] ??
    null
  )
}

function round(value: number, digits = 1): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function average(values: number[]): number | null {
  const filtered = values.filter(Number.isFinite)
  if (filtered.length === 0) return null
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length
}

function averageRounded(values: number[], digits = 1): number | null {
  const value = average(values)
  return value === null ? null : round(value, digits)
}

function percent(rate: number | null | undefined): number | null {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return null
  return Math.round(Math.min(1, Math.max(0, rate)) * 100)
}

function findJoint(
  analysis: ExerciseMotionMovementAnalysisResponse,
  jointName: string,
): ExerciseMotionMovementAnalysisJointRange | null {
  return (
    analysis.joints.find(
      joint =>
        joint.jointName === jointName &&
        joint.analysisAvailable &&
        typeof joint.rangeDeg === 'number',
    ) ?? null
  )
}

function resolveMotionJointValue(
  analysis: ExerciseMotionMovementAnalysisResponse,
  group: RomJointGroup,
): MotionJointValue {
  const left = findJoint(analysis, group.leftJointName)
  const right = findJoint(analysis, group.rightJointName)
  const rangeDeg = averageRounded(
    [left?.rangeDeg, right?.rangeDeg].filter((value): value is number => typeof value === 'number'),
  )
  const confidencePercent = percent(
    average(
      [left?.averageConfidence, right?.averageConfidence].filter(
        (value): value is number => typeof value === 'number',
      ),
    ),
  )

  return {
    motionName: analysis.motionName,
    routineOrder: analysis.routineOrder,
    left,
    right,
    rangeDeg,
    confidencePercent,
  }
}

function buildTrend(values: MotionJointValue[]): RomJointTrendPoint[] {
  return values
    .sort((a, b) => a.routineOrder - b.routineOrder)
    .map(value => ({
      label: value.motionName.length > 7 ? `${value.motionName.slice(0, 7)}…` : value.motionName,
      motionName: value.motionName,
      rangeDeg: value.rangeDeg,
      confidencePercent: value.confidencePercent,
    }))
}

function buildExcludedSegments(
  analyses: ExerciseMotionMovementAnalysisResponse[],
): RomExcludedSegment[] {
  return analyses.flatMap(analysis =>
    analysis.excludedSegments.map(segment => ({
      motionName: analysis.motionName,
      startMs: segment.startMs,
      endMs: segment.endMs,
      reason: segment.reason,
    })),
  )
}

function buildInsight(group: RomJointGroup, detail: RomJointDetail): string {
  if (!detail.analysisAvailable) {
    return `${group.name}은 최근 세션에서 분석 가능한 좌표가 부족합니다. 다음 세션에서 카메라 정면과 전신이 보이도록 기록하면 더 안정적으로 확인할 수 있습니다.`
  }
  if ((detail.confidencePercent ?? 0) < 60) {
    return `${group.name}은 좌표 신뢰도가 낮은 구간이 있어 해석을 보수적으로 봐야 합니다. 분석 제외 시간이 줄어드는지 먼저 확인하세요.`
  }
  if ((detail.coveragePercent ?? 0) < 60) {
    return `${group.name}은 전체 세션 중 분석에 사용된 프레임 비율이 낮습니다. 움직임 범위보다 기록 품질을 먼저 확인하는 것이 좋습니다.`
  }
  const left = detail.leftRangeDeg
  const right = detail.rightRangeDeg
  if (left !== null && right !== null && Math.abs(left - right) >= 15) {
    return `${group.name}은 좌우 움직임 범위 차이가 크게 나타났습니다. 어느 한쪽으로만 크게 움직인 동작이 있었는지 확인해 보세요.`
  }
  return `${group.name}은 최근 세션에서 분석 가능한 좌표가 안정적으로 확보되었습니다. 이 값은 의료적 관절 가동 범위가 아니라 운동 중 관절 각도 변화량입니다.`
}

function buildTip(group: RomJointGroup): string {
  const tips: Record<RomJointGroup['id'], string> = {
    elbow:
      '팔꿈치는 팔 흔들기와 몸통 지르기 동작에서 크게 변합니다. 손목과 어깨가 화면 밖으로 나가면 범위가 작게 잡힐 수 있습니다.',
    shoulder:
      '어깨는 팔을 들어 올리거나 몸통을 비트는 동작에서 민감합니다. 상체가 화면 중앙에 있는 세션일수록 신뢰도가 높습니다.',
    hip: '고관절은 걷기, 사이드 스텝, 앉았다 일어서기에서 유의미합니다. 골반과 무릎이 함께 보여야 안정적으로 계산됩니다.',
    knee: '무릎은 앉았다 일어서기와 제자리 걷기에서 변화가 큽니다. 발목이 가려지면 무릎 각도 계산이 제외될 수 있습니다.',
  }
  return tips[group.id]
}

function buildJointDetail(
  group: RomJointGroup,
  analyses: ExerciseMotionMovementAnalysisResponse[],
): RomJointDetail {
  const motionValues = analyses
    .filter(analysis => analysis.analysisAvailable)
    .map(analysis => resolveMotionJointValue(analysis, group))
  const availableValues = motionValues.filter(value => value.rangeDeg !== null)
  const sideJoints = availableValues.flatMap(value => [value.left, value.right]).filter(Boolean)
  const leftRangeDeg = averageRounded(
    availableValues
      .map(value => value.left?.rangeDeg)
      .filter((value): value is number => typeof value === 'number'),
  )
  const rightRangeDeg = averageRounded(
    availableValues
      .map(value => value.right?.rangeDeg)
      .filter((value): value is number => typeof value === 'number'),
  )

  const detail: RomJointDetail = {
    ...group,
    analysisAvailable: availableValues.length > 0,
    currentRangeDeg: averageRounded(
      availableValues
        .map(value => value.rangeDeg)
        .filter((value): value is number => typeof value === 'number'),
    ),
    leftRangeDeg,
    rightRangeDeg,
    minAngleDeg: averageRounded(
      sideJoints
        .map(joint => joint?.minAngleDeg)
        .filter((value): value is number => typeof value === 'number'),
    ),
    maxAngleDeg: averageRounded(
      sideJoints
        .map(joint => joint?.maxAngleDeg)
        .filter((value): value is number => typeof value === 'number'),
    ),
    coveragePercent: percent(
      average(
        sideJoints
          .map(joint => joint?.coverageRate)
          .filter((value): value is number => typeof value === 'number'),
      ),
    ),
    confidencePercent: percent(
      average(
        sideJoints
          .map(joint => joint?.averageConfidence)
          .filter((value): value is number => typeof value === 'number'),
      ),
    ),
    validFrameCount: sideJoints.reduce((sum, joint) => sum + (joint?.validFrameCount ?? 0), 0),
    motionCount: analyses.length,
    analyzedMotionCount: availableValues.length,
    analyzedDurationMs: analyses.reduce(
      (sum, analysis) => sum + Math.max(0, analysis.analyzedDurationMs ?? 0),
      0,
    ),
    excludedDurationMs: analyses.reduce(
      (sum, analysis) => sum + Math.max(0, analysis.excludedDurationMs ?? 0),
      0,
    ),
    excludedSegments: buildExcludedSegments(analyses),
    trend: buildTrend(motionValues),
    insight: '',
    tip: buildTip(group),
  }

  return {
    ...detail,
    insight: buildInsight(group, detail),
  }
}

function buildView(
  session: ExerciseSessionDetail,
  analyses: ExerciseMotionMovementAnalysisResponse[],
  failedMotionCount: number,
): RomMovementAnalysisView {
  return {
    sessionId: session.id,
    exerciseType: session.exerciseType,
    createdAt: session.createdAt,
    motionCount: session.motions.length,
    analyzedMotionCount: analyses.filter(analysis => analysis.analysisAvailable).length,
    failedMotionCount,
    joints: ROM_JOINT_GROUPS.map(group => buildJointDetail(group, analyses)),
  }
}

export function useRomMovementAnalysis(patientId: number | undefined | null) {
  return useQuery({
    queryKey: [ROM_MOVEMENT_ANALYSIS_QUERY_KEY, patientId],
    queryFn: async () => {
      const sessions = await getExerciseSessions(patientId!)
      const latestSession = findLatestGymnasticsSession(sessions)
      if (!latestSession) return null

      const detail = await getExerciseSessionDetail(latestSession.id)
      const motionsWithReplay = detail.motions.filter(motion => motion.replayAvailable === true)
      if (motionsWithReplay.length === 0) {
        return buildView(detail, [], 0)
      }

      const results = await Promise.allSettled(
        motionsWithReplay.map(motion => getExerciseMotionMovementAnalysis(motion.id)),
      )
      const analysisByMotionResultId = new Map<number, ExerciseMotionMovementAnalysisResponse>()
      let failedMotionCount = 0

      results.forEach((result, index) => {
        const expectedMotionResultId = motionsWithReplay[index]?.id
        if (
          result.status === 'fulfilled' &&
          typeof expectedMotionResultId === 'number' &&
          result.value.motionResultId === expectedMotionResultId
        ) {
          analysisByMotionResultId.set(expectedMotionResultId, result.value)
          return
        }
        failedMotionCount += 1
      })

      const analyses = motionsWithReplay
        .map(motion => analysisByMotionResultId.get(motion.id))
        .filter(
          (analysis): analysis is ExerciseMotionMovementAnalysisResponse => analysis !== undefined,
        )

      return buildView(detail, analyses, failedMotionCount)
    },
    enabled: typeof patientId === 'number' && patientId > 0,
  })
}
