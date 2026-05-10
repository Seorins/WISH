import { describe, expect, it } from 'vitest'
import { sanitizeEmotionScene } from './lighthouseEmotionClient'

describe('sanitizeEmotionScene', () => {
  it('keeps only display-safe choices and allows rest_today only as first secondary action', () => {
    const firstScene = sanitizeEmotionScene(
      {
        questionText: '오늘 마음은 어때?',
        choices: [
          { choiceIntentId: 'mood_okay', text: '괜찮아요' },
          { choiceIntentId: 'rest_today', text: '오늘은 쉬고 싶어요' },
          { choiceIntentId: 'mood_worried', text: '걱정돼요' },
          { choiceIntentId: 'mood_hard', text: '힘들어요' },
          { choiceIntentId: 'extra_choice', text: '네 번째' },
        ],
        secondaryAction: { choiceIntentId: 'rest_today', text: '오늘은 쉬고 싶어요' },
        shouldEndSession: false,
        generatedBy: 'CLAUDE',
        reasonCode: 'internal_reason',
      },
      true,
    )

    expect(firstScene.choices.map(choice => choice.choiceIntentId)).toEqual([
      'mood_okay',
      'mood_worried',
      'mood_hard',
    ])
    expect(firstScene.secondaryAction).toEqual({
      choiceIntentId: 'rest_today',
      text: '오늘은 쉬고 싶어요',
    })
    expect(firstScene.generatedBy).toBeUndefined()
    expect(firstScene.reasonCode).toBeUndefined()

    const followUpScene = sanitizeEmotionScene(
      {
        questionText: '조금 더 말해줄래?',
        choices: [{ choiceIntentId: 'rest_today', text: '오늘은 쉬고 싶어요' }],
        secondaryAction: { choiceIntentId: 'rest_today', text: '오늘은 쉬고 싶어요' },
        shouldEndSession: false,
      },
      false,
    )

    expect(followUpScene.choices).toEqual([])
    expect(followUpScene.secondaryAction).toBeNull()
  })

  it('uses a safe fallback question when backend text is empty', () => {
    const scene = sanitizeEmotionScene(
      {
        questionText: '',
        choices: [],
        secondaryAction: null,
        shouldEndSession: false,
      },
      true,
    )

    expect(scene.questionText).toBe('오늘 기분은 어떠니?')
  })
})
