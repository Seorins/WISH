import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getDialogueSessionDetail,
  sanitizeEmotionScene,
  submitLighthouseEmotionTurn,
} from './lighthouseEmotionClient'

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as Response
}

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

describe('getDialogueSessionDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('requests dialogue session detail with auth and unwraps response data', async () => {
    localStorage.setItem('wish_access_token', 'token-1')
    const detail = {
      sessionId: 42,
      patientProfileId: 7,
      npcName: 'YEONGCHEOL',
      status: 'IN_PROGRESS',
      stepCount: 1,
      maxSteps: 5,
      finishReason: null,
      startedAt: '2026-05-10T13:51:02.586Z',
      endedAt: null,
      turns: [
        {
          id: 1,
          stepIndex: 0,
          questionText: '오늘 기분은 어떠니?',
          choiceIntentId: 'mood_worried',
          choiceText: '걱정돼요',
          intensity: 1,
          concernFlags: ['worry'],
          protectiveFactors: ['talked'],
          generatedBy: 'CLAUDE',
          createdAt: '2026-05-10T13:51:02.586Z',
        },
      ],
    }
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 'OK',
        message: '조회 성공',
        data: detail,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getDialogueSessionDetail(42)).resolves.toEqual(detail)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/dialogue\/sessions\/42$/),
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer token-1',
        },
      },
    )
  })

  it('throws when dialogue session detail data is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: null })))

    await expect(getDialogueSessionDetail(404)).rejects.toThrow(
      'Dialogue session detail response is invalid.',
    )
  })
})

describe('submitLighthouseEmotionTurn', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('submits a dialogue turn with question text and unwraps next scene', async () => {
    localStorage.setItem('wish_access_token', 'token-1')
    const nextScene = {
      questionText: 'è­°ê³Œíˆ‘ ??ï§ë¨°ë¹ä»¥ê¾¨ì˜’?',
      choices: [{ choiceIntentId: 'worry_body', text: 'ï§ëª„ì”  å«„ê¹†ì ™?ì‡±ìŠ‚' }],
      secondaryAction: null,
      shouldEndSession: false,
      generatedBy: 'CLAUDE',
    }
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 'OK',
        message: 'è­°ê³ ì‰¶ ?ê¹ƒë‚¬',
        data: {
          sessionId: 42,
          status: 'IN_PROGRESS',
          nextScene,
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      submitLighthouseEmotionTurn('42', {
        questionText: '?ã…»ë’› æ¹²ê³•í…‡?Â€ ?ëŒ€ë¼š??',
        selectedChoice: {
          choiceIntentId: 'mood_worried',
          text: 'å«„ê¹†ì ™?ì‡±ìŠ‚',
          intensity: 2,
          concernFlags: ['worry_present'],
          protectiveFactors: ['emotion_named'],
        },
      }),
    ).resolves.toEqual({ nextScene })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/dialogue\/sessions\/42\/turns$/),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer token-1',
        },
        body: JSON.stringify({
          questionText: '?ã…»ë’› æ¹²ê³•í…‡?Â€ ?ëŒ€ë¼š??',
          selectedChoice: {
            choiceIntentId: 'mood_worried',
            text: 'å«„ê¹†ì ™?ì‡±ìŠ‚',
            intensity: 2,
            concernFlags: ['worry_present'],
            protectiveFactors: ['emotion_named'],
          },
        }),
      },
    )
  })

  it('fills backend-required choice metadata when backend scene omits it', async () => {
    localStorage.setItem('wish_access_token', 'token-1')
    const nextScene = {
      questionText: '다음 질문',
      choices: [{ choiceIntentId: 'next', text: '다음 선택' }],
      secondaryAction: null,
      shouldEndSession: false,
    }
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 'OK',
        message: 'ok',
        data: {
          sessionId: 42,
          status: 'IN_PROGRESS',
          nextScene,
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      submitLighthouseEmotionTurn('42', {
        questionText: '오늘 기분은 어떠니?',
        selectedChoice: {
          choiceIntentId: 'mood_okay',
          text: '괜찮아요',
        },
      }),
    ).resolves.toEqual({ nextScene })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/dialogue\/sessions\/42\/turns$/),
      expect.objectContaining({
        body: JSON.stringify({
          questionText: '오늘 기분은 어떠니?',
          selectedChoice: {
            choiceIntentId: 'mood_okay',
            text: '괜찮아요',
            intensity: 0,
            concernFlags: [],
            protectiveFactors: [],
          },
        }),
      }),
    )
  })
})
