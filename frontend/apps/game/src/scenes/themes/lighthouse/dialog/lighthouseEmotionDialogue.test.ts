import { describe, expect, it } from 'vitest'
import {
  getLighthouseEmotionScene,
  getChoiceDisplayText,
  getQuestionDisplayText,
  getVisibleChoices,
  globalRestTodayChoice,
  LIGHTHOUSE_EMOTION_START_SCENE_ID,
  LIGHTHOUSE_MAX_QUESTION_SCENES,
  lighthouseShortEmotionDialogue,
  waveMeterCards,
} from './lighthouseEmotionDialogue'

describe('lighthouseShortEmotionDialogue', () => {
  it('starts from the required mood check scene', () => {
    const scene = getLighthouseEmotionScene(LIGHTHOUSE_EMOTION_START_SCENE_ID)

    expect(scene?.id).toBe('lh_00_greeting_mood_check')
    expect(scene?.mode).toBe('PLAYER_CHOICE')
  })

  it('keeps the required first lines in order', () => {
    const scene = getLighthouseEmotionScene(LIGHTHOUSE_EMOTION_START_SCENE_ID)

    expect(scene?.npcLines).toEqual(['안녕, 오늘도 와줬구나.', '오늘 기분은 어떻니?'])
  })

  it('uses the Korean question text above the choice list', () => {
    const scene = getLighthouseEmotionScene(LIGHTHOUSE_EMOTION_START_SCENE_ID)
    expect(scene).not.toBeNull()

    expect(getQuestionDisplayText(scene!)).toBe('오늘 기분은 어떻니?')
  })

  it('limits each visible player choice screen to at most three choices', () => {
    const playerChoiceScenes = lighthouseShortEmotionDialogue.filter(
      scene => scene.mode === 'PLAYER_CHOICE',
    )

    playerChoiceScenes.forEach(scene => {
      expect(getVisibleChoices(scene)).toHaveLength(Math.min(scene.choices?.length ?? 0, 3))
      expect(getVisibleChoices(scene).length).toBeLessThanOrEqual(3)
    })
  })

  it('keeps the rest button separate from the three-choice limit', () => {
    const scene = getLighthouseEmotionScene(LIGHTHOUSE_EMOTION_START_SCENE_ID)
    expect(scene).not.toBeNull()

    const visibleChoices = getVisibleChoices(scene!)

    expect(visibleChoices).toHaveLength(3)
    expect(visibleChoices.some(choice => choice.id === globalRestTodayChoice.id)).toBe(false)
    expect(globalRestTodayChoice.text).toBe('오늘은 쉬기')
    expect(globalRestTodayChoice.iconKey).toBe('pause')
  })

  it('does not expose icon keys in child-facing display text', () => {
    const scene = getLighthouseEmotionScene(LIGHTHOUSE_EMOTION_START_SCENE_ID)
    expect(scene).not.toBeNull()
    const displayTexts = [...getVisibleChoices(scene!), globalRestTodayChoice].map(choice =>
      getChoiceDisplayText(choice),
    )

    expect(displayTexts).toEqual(['괜찮아요', '걱정돼요', '힘들어요', '오늘은 쉬기'])
    expect(displayTexts.join(' ')).not.toMatch(
      /sun|fog|wave|rest|pause|heart|bandage|friend|anchor|lantern|iconKey|choiceId|sceneId|emotionWeights|intensity|concernFlags|protectiveFactors/,
    )
  })

  it('keeps normal branches within the three-question limit', () => {
    const paths = [
      ['lh_00_greeting_mood_check', 'mood_okay', 'lh_03_small_light', 'light_breathe'],
      [
        'lh_00_greeting_mood_check',
        'mood_worried',
        'lh_01_worry_source',
        'worry_pain',
        'lh_04_support_choice',
        'support_family',
      ],
      [
        'lh_00_greeting_mood_check',
        'mood_hard',
        'lh_02_hard_part',
        'hard_body',
        'lh_04_support_choice',
        'support_medical',
      ],
    ]

    paths.forEach(path => {
      const questionSceneCount = path.filter(item => item.startsWith('lh_')).length
      expect(questionSceneCount).toBeLessThanOrEqual(LIGHTHOUSE_MAX_QUESTION_SCENES)
    })
  })

  it('defines wave meter as three non-numeric cards', () => {
    expect(waveMeterCards).toHaveLength(3)
    expect(waveMeterCards.map(card => card.text)).toEqual(['잔잔해요', '흔들려요', '너무 높아요'])
  })
})
