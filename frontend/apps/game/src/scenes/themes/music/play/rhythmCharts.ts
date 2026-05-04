export type RhythmLane = 0 | 1 | 2 | 3

export type RhythmNote = {
  id: string
  timeMs: number
  lane: RhythmLane
  durationMs?: number
}

export type RhythmChart = {
  id: string
  title: string
  subtitle: string
  bpm: number
  audioKey: string
  audioPath: string
  durationMs: number
  notes: RhythmNote[]
}

type TimedLaneNote = {
  timeMs: number
  lane: RhythmLane
  durationMs?: number
}

type TwinkleStep = {
  lane: RhythmLane
  beats: number
}

const TWINKLE_BPM = 120
const TWINKLE_BEAT_MS = 60_000 / TWINKLE_BPM
const TWINKLE_START_MS = 1_800
const TWINKLE_DURATION_MS = 27_000

// 노래 박자(beats)는 그대로 유지하고, 레인만 4개로 골고루 흩뿌림.
// 같은 레인이 연속으로 오지 않도록 → 손가락 인식 기반 입력에 친화적.
const twinkleSteps: TwinkleStep[] = [
  // 도-도-솔-솔-라-라-솔
  { lane: 0, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 3, beats: 1 },
  { lane: 0, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 1, beats: 2 },
  // 파-파-미-미-레-레-도
  { lane: 3, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 0, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 3, beats: 1 },
  { lane: 2, beats: 2 },
  // 솔-솔-파-파-미-미-레
  { lane: 0, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 3, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 0, beats: 2 },
  // 솔-솔-파-파-미-미-레
  { lane: 3, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 0, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 3, beats: 2 },
  // 도-도-솔-솔-라-라-솔
  { lane: 0, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 3, beats: 1 },
  { lane: 0, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 1, beats: 2 },
  // 파-파-미-미-레-레-도
  { lane: 3, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 0, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 3, beats: 1 },
  { lane: 2, beats: 2 },
]

function createTwinkleNotes(): RhythmNote[] {
  let cursorMs = TWINKLE_START_MS

  return twinkleSteps.map((step, index) => {
    const note = {
      id: `twinkle-star-${String(index + 1).padStart(2, '0')}`,
      timeMs: cursorMs,
      lane: step.lane,
    }

    cursorMs += step.beats * TWINKLE_BEAT_MS

    return note
  })
}

const BABY_SHARK_BPM = 115
const BABY_SHARK_BEAT_MS = 60_000 / BABY_SHARK_BPM
const BABY_SHARK_GRID_OFFSET_MS = 420
const BABY_SHARK_DURATION_MS = 96_196
const BABY_SHARK_FIRST_MAIN_BEAT = 18
const BABY_SHARK_LAST_MAIN_BEAT = 182

const babySharkIntroNotes: TimedLaneNote[] = [
  { timeMs: 2_507, lane: 0 },
  { timeMs: 3_029, lane: 2 },
  { timeMs: 3_290, lane: 1 },
  { timeMs: 5_116, lane: 3 },
  { timeMs: 5_377, lane: 0 },
  { timeMs: 7_203, lane: 1 },
  { timeMs: 7_463, lane: 2 },
  { timeMs: 8_246, lane: 3 },
  { timeMs: 8_507, lane: 0 },
  { timeMs: 9_290, lane: 2 },
]

const babySharkLanePatterns: RhythmLane[][] = [
  [0, 1, 2, 3, 2, 1, 0, 1],
  [3, 2, 1, 0, 1, 2, 3, 2],
  [0, 2, 1, 3, 0, 1, 2, 3],
]

function createBabySharkNotes(): RhythmNote[] {
  const notes: TimedLaneNote[] = [...babySharkIntroNotes]

  for (
    let beatIndex = BABY_SHARK_FIRST_MAIN_BEAT;
    beatIndex <= BABY_SHARK_LAST_MAIN_BEAT;
    beatIndex += 1
  ) {
    const stepIndex = beatIndex - BABY_SHARK_FIRST_MAIN_BEAT
    const phraseIndex = Math.floor(stepIndex / 8)
    const pattern = babySharkLanePatterns[phraseIndex % babySharkLanePatterns.length]
    const lane = pattern[stepIndex % pattern.length]
    const timeMs = Math.round(BABY_SHARK_GRID_OFFSET_MS + beatIndex * BABY_SHARK_BEAT_MS)

    notes.push({ timeMs, lane })
  }

  return notes.map((note, index) => ({
    id: `baby-shark-${String(index + 1).padStart(3, '0')}`,
    ...note,
  }))
}

export const TWINKLE_STAR_RHYTHM_CHART: RhythmChart = {
  id: 'twinkle-star',
  title: '작은별',
  subtitle: '밝은 실로폰 리듬',
  bpm: TWINKLE_BPM,
  audioKey: 'music-rhythm-twinkle-star',
  audioPath: 'sounds/themes/music/twinkle-star.wav',
  durationMs: TWINKLE_DURATION_MS,
  notes: createTwinkleNotes(),
}

export const BABY_SHARK_RHYTHM_CHART: RhythmChart = {
  id: 'baby-shark',
  title: '아기상어',
  subtitle: 'BPM 115 리듬 차트',
  bpm: BABY_SHARK_BPM,
  audioKey: 'music-rhythm-baby-shark',
  audioPath: 'sounds/themes/music/babyshark.wav',
  durationMs: BABY_SHARK_DURATION_MS,
  notes: createBabySharkNotes(),
}

export const DEFAULT_RHYTHM_CHART = BABY_SHARK_RHYTHM_CHART

export const ALL_RHYTHM_CHARTS: RhythmChart[] = [BABY_SHARK_RHYTHM_CHART, TWINKLE_STAR_RHYTHM_CHART]

export function getRhythmChart(id?: string | null): RhythmChart {
  if (!id) return DEFAULT_RHYTHM_CHART
  return ALL_RHYTHM_CHARTS.find(chart => chart.id === id) ?? DEFAULT_RHYTHM_CHART
}
