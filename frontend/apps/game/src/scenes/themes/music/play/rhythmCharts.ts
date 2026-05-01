export type RhythmLane = 0 | 1 | 2

export type RhythmNote = {
  id: string
  timeMs: number
  lane: RhythmLane
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

type TwinkleStep = {
  lane: RhythmLane
  beats: number
}

const TWINKLE_BPM = 120
const TWINKLE_BEAT_MS = 60_000 / TWINKLE_BPM
const TWINKLE_START_MS = 1_800
const TWINKLE_DURATION_MS = 27_000

const twinkleSteps: TwinkleStep[] = [
  { lane: 0, beats: 1 },
  { lane: 0, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 1, beats: 2 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 0, beats: 1 },
  { lane: 0, beats: 1 },
  { lane: 0, beats: 2 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 0, beats: 2 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 0, beats: 2 },
  { lane: 0, beats: 1 },
  { lane: 0, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 2, beats: 1 },
  { lane: 1, beats: 2 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 1, beats: 1 },
  { lane: 0, beats: 1 },
  { lane: 0, beats: 1 },
  { lane: 0, beats: 2 },
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
