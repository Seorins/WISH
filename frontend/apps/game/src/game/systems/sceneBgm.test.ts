import { describe, expect, it, vi } from 'vitest'

vi.mock('@/game/settings/gameSettings', () => ({
  getGameSettings: () => ({ masterVolume: 0.8 }),
}))

const { getBgmTrackForScene } = await import('./sceneBgm')

describe('scene BGM mapping', () => {
  it('maps major screens to their BGM groups', () => {
    expect(getBgmTrackForScene('StartScene')).toBe('start')
    expect(getBgmTrackForScene('VillageScene')).toBe('village')
    expect(getBgmTrackForScene('ArtSelectScene')).toBe('art')
    expect(getBgmTrackForScene('QuizPlayScene')).toBe('quiz')
    expect(getBgmTrackForScene('TaekwondoPoomsaePracticeScene')).toBe('taekwondo')
    expect(getBgmTrackForScene('GymnasticsDanielScene')).toBe('gymnastics')
    expect(getBgmTrackForScene('LighthouseSelectScene')).toBe('lighthouse')
    expect(getBgmTrackForScene('PhotoBoothCameraScene')).toBe('photoBooth')
  })

  it('keeps rhythm gameplay clear for the selected song audio', () => {
    expect(getBgmTrackForScene('MusicSelectScene')).toBe('musicLobby')
    expect(getBgmTrackForScene('MusicRhythmScene')).toBeNull()
  })

  it('does not play BGM for unknown scenes', () => {
    expect(getBgmTrackForScene('UnknownScene')).toBeNull()
  })
})
