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
  it('keeps up to three display-safe choices and hides secondary actions', () => {
    const scene = sanitizeEmotionScene(
      {
        questionText: '다음에는 뭘 해볼까?',
        choices: [
          { choiceIntentId: 'entry_rest', text: '쉬고 싶어요' },
          { choiceIntentId: 'entry_activity', text: '뭔가 해보고 싶어요' },
          { choiceIntentId: 'entry_talk', text: '잠깐 얘기하고 싶어요' },
          { choiceIntentId: 'extra_choice', text: '네 번째' },
        ],
        secondaryAction: { choiceIntentId: 'rest_today', text: '오늘은 쉬고 싶어요' },
        shouldEndSession: false,
        generatedBy: 'CLAUDE',
        reasonCode: 'internal_reason',
      },
      true,
    )

    expect(scene.choices.map(choice => choice.choiceIntentId)).toEqual([
      'entry_rest',
      'entry_activity',
      'entry_talk',
    ])
    expect(scene.secondaryAction).toBeNull()
    expect(scene.generatedBy).toBe('CLAUDE')
    expect(scene.reasonCode).toBeUndefined()
  })

  it('uses the lighthouse entry fallback when backend text is empty', () => {
    const scene = sanitizeEmotionScene(
      {
        questionText: '',
        choices: [],
        secondaryAction: null,
        shouldEndSession: false,
      },
      true,
    )

    expect(scene.questionText).toBe('오늘은 어떻게 지내고 싶니?')
    expect(scene.choices.map(choice => choice.choiceIntentId)).toEqual([
      'entry_rest',
      'entry_activity',
      'entry_talk',
    ])
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
          questionText: '오늘은 어떻게 지내고 싶니?',
          choiceIntentId: 'entry_talk',
          choiceText: '잠깐 얘기하고 싶어요',
          intensity: 0,
          concernFlags: [],
          protectiveFactors: ['support_seeking'],
          generatedBy: 'CLAUDE',
          createdAt: '2026-05-10T13:51:02.586Z',
        },
      ],
    }
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 'OK',
        message: 'ok',
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
      questionText: '무슨 얘기가 좋을까?',
      choices: [{ choiceIntentId: 'talk_body', text: '몸 얘기' }],
      secondaryAction: null,
      shouldEndSession: false,
      generatedBy: 'CLAUDE',
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
        questionText: '오늘은 어떻게 지내고 싶니?',
        selectedChoice: {
          choiceIntentId: 'entry_talk',
          text: '잠깐 얘기하고 싶어요',
          intensity: 0,
          concernFlags: [],
          protectiveFactors: ['support_seeking', 'verbal_expression'],
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
          npcId: 'lighthouse_keeper',
          npcName: 'YEONGCHEOL',
          questionText: '오늘은 어떻게 지내고 싶니?',
          selectedChoice: {
            choiceIntentId: 'entry_talk',
            text: '잠깐 얘기하고 싶어요',
            intensity: 0,
            concernFlags: [],
            protectiveFactors: ['support_seeking', 'verbal_expression'],
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
        questionText: '오늘은 어떻게 지내고 싶니?',
        selectedChoice: {
          choiceIntentId: 'entry_activity',
          text: '뭔가 해보고 싶어요',
        },
      }),
    ).resolves.toEqual({ nextScene })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/dialogue\/sessions\/42\/turns$/),
      expect.objectContaining({
        body: JSON.stringify({
          npcId: 'lighthouse_keeper',
          npcName: 'YEONGCHEOL',
          questionText: '오늘은 어떻게 지내고 싶니?',
          selectedChoice: {
            choiceIntentId: 'entry_activity',
            text: '뭔가 해보고 싶어요',
            intensity: 0,
            concernFlags: [],
            protectiveFactors: [],
          },
        }),
      }),
    )
  })
})
