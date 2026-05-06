import { describe, expect, it } from 'vitest'
import {
  buildExerciseSessionReportSummary,
  formatAccuracy,
  formatDateTime,
  formatDurationSec,
  formatExerciseType,
} from './format'
import type { ExerciseSessionSummary } from '@wish/api-client'

const sessions: ExerciseSessionSummary[] = [
  {
    id: 1,
    patientProfileId: 1,
    exerciseType: 'TOP',
    durationSec: 200,
    averageAccuracy: 0.8,
    completedMotionCount: 12,
    createdAt: '2026-05-06T01:36:20.863Z',
  },
  {
    id: 2,
    patientProfileId: 1,
    exerciseType: 'DANIEL',
    durationSec: 100,
    averageAccuracy: 90,
    completedMotionCount: 8,
    createdAt: '2026-05-07T01:36:20.863Z',
  },
]

describe('exercise session formatters', () => {
  it('formats duration seconds as Korean minutes and seconds', () => {
    expect(formatDurationSec(200)).toBe('3분 20초')
    expect(formatDurationSec(12)).toBe('12초')
    expect(formatDurationSec(0)).toBe('0초')
  })

  it('formats accuracy safely for 0-1 and 0-100 values', () => {
    expect(formatAccuracy(0.82)).toBe('82%')
    expect(formatAccuracy(82)).toBe('82%')
    expect(formatAccuracy(null)).toBe('-')
  })

  it('formats exercise type and date labels', () => {
    expect(formatExerciseType('TOP')).toBe('상체')
    expect(formatExerciseType('UNKNOWN')).toBe('UNKNOWN')
    expect(formatDateTime('2026-05-06T01:36:20.863Z')).toContain('2026.')
  })

  it('builds report summary from session list', () => {
    expect(buildExerciseSessionReportSummary(sessions)).toEqual({
      totalSessionCount: 2,
      totalDurationSec: 300,
      averageAccuracy: 45.4,
      totalCompletedMotionCount: 20,
      latestSessionAt: '2026-05-07T01:36:20.863Z',
      exerciseTypeCounts: {
        TOP: 1,
        DANIEL: 1,
      },
    })
  })

  it('builds empty report summary without treating empty data as an error', () => {
    expect(buildExerciseSessionReportSummary([])).toEqual({
      totalSessionCount: 0,
      totalDurationSec: 0,
      averageAccuracy: null,
      totalCompletedMotionCount: 0,
      latestSessionAt: null,
      exerciseTypeCounts: {},
    })
  })
})
