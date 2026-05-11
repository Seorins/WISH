import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LighthouseEmotionController } from './LighthouseEmotionController'

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as Response
}

async function flushStartOpening() {
  await act(async () => {
    await Promise.resolve()
  })

  await act(async () => {
    vi.advanceTimersByTime(3000)
    await Promise.resolve()
  })
}

describe('LighthouseEmotionController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('runs backend-driven choice flow without exposing internal fields or postcards', async () => {
    const fetchMock = vi.mocked(fetch)
    const onClose = vi.fn()
    const onTextChange = vi.fn()

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          code: 'CREATED',
          message: 'created',
          data: {
            sessionId: 1,
            status: 'IN_PROGRESS',
            scene: {
              sceneId: 'first',
              questionText: '오늘 기분은 어떠니?',
              choices: [
                { choiceIntentId: 'mood_okay', text: '괜찮아요' },
                { choiceIntentId: 'rest_today', text: '오늘은 쉬고 싶어요' },
                { choiceIntentId: 'mood_worried', text: '걱정돼요' },
                { choiceIntentId: 'mood_hard', text: '힘들어요' },
                { choiceIntentId: 'extra', text: '더보기' },
              ],
              secondaryAction: { choiceIntentId: 'rest_today', text: '오늘은 쉬고 싶어요' },
              shouldEndSession: false,
              generatedBy: 'CLAUDE',
              reasonCode: 'safe_reason',
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          npcResponse: ['걱정이 찾아온 날이구나.', '괜찮아, 천천히 골라도 돼.'],
          nextScene: {
            sceneId: 'follow-up',
            questionText: '무엇이 가장 걱정되니?',
            choices: [
              { choiceIntentId: 'rest_today', text: '오늘은 쉬고 싶어요' },
              { choiceIntentId: 'worry_body', text: '몸이 걱정돼요' },
              { choiceIntentId: 'worry_family', text: '가족이 걱정돼요' },
            ],
            secondaryAction: { choiceIntentId: 'rest_today', text: '오늘은 쉬고 싶어요' },
            shouldEndSession: false,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          npcResponse: ['말해줘서 고맙구나.'],
          nextScene: {
            questionText: '',
            choices: [],
            secondaryAction: null,
            shouldEndSession: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          code: 'OK',
          message: 'finished',
          data: {
            sessionId: 1,
            status: 'FINISHED',
            closingLines: ['오늘 이야기해줘서 고맙구나.', '등대 불은 계속 켜둘게.'],
          },
        }),
      )

    render(
      <LighthouseEmotionController
        patientProfileId={7}
        isOpen
        onClose={onClose}
        onTextChange={onTextChange}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/dialogue\/sessions$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          patientProfileId: 7,
          npcId: 'lighthouse_keeper',
          npcName: 'YEONGCHEOL',
          mode: 'LIGHTHOUSE_LLM',
        }),
      }),
    )
    expect(onTextChange).toHaveBeenCalledWith(
      '안녕, 또 와줬구나.\n오늘 등대 불은 잔잔하게 켜져 있어.\n괜찮다면 지금 마음을 조금 나눠볼래?',
    )

    await act(async () => {
      vi.advanceTimersByTime(3000)
      await Promise.resolve()
    })

    expect(onTextChange).toHaveBeenCalledWith('오늘 기분은 어떠니?')
    expect(screen.getByRole('button', { name: '괜찮아요' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '걱정돼요' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '힘들어요' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '오늘은 쉬고 싶어요' })).toBeTruthy()
    expect(screen.queryByText('choiceIntentId')).toBeNull()
    expect(screen.queryByText('CLAUDE')).toBeNull()
    expect(screen.queryByText('safe_reason')).toBeNull()
    expect(screen.queryByText('마음엽서')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '걱정돼요' }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/dialogue\/sessions\/1\/turns$/),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"questionText"'),
      }),
    )
    expect(screen.queryByRole('button', { name: '괜찮아요' })).toBeNull()
    expect(onTextChange).toHaveBeenCalledWith('걱정이 찾아온 날이구나.\n괜찮아, 천천히 골라도 돼.')

    await act(async () => {
      vi.advanceTimersByTime(1700)
      await Promise.resolve()
    })

    expect(onTextChange).toHaveBeenCalledWith('무엇이 가장 걱정되니?')
    expect(screen.getByRole('button', { name: '몸이 걱정돼요' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '몸이 걱정돼요' }))

    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(1700)
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/dialogue\/sessions\/1\/finish$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ finishReason: 'COMPLETED' }),
      }),
    )
    expect(onTextChange).toHaveBeenCalledWith('오늘 이야기해줘서 고맙구나.\n등대 불은 계속 켜둘게.')

    expect(screen.queryByRole('button', { name: '마을로 돌아가기' })).toBeNull()
    await act(async () => {
      vi.advanceTimersByTime(3200)
      await Promise.resolve()
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('finishes with REST when the first secondary action is selected', async () => {
    const fetchMock = vi.mocked(fetch)

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          code: 'CREATED',
          message: 'created',
          data: {
            sessionId: 2,
            status: 'IN_PROGRESS',
            scene: {
              questionText: '오늘 기분은 어떠니?',
              choices: [{ choiceIntentId: 'mood_okay', text: '괜찮아요' }],
              secondaryAction: { choiceIntentId: 'rest_today', text: '오늘은 쉬고 싶어요' },
              shouldEndSession: false,
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          npcResponse: ['알겠다. 오늘은 쉬어도 괜찮단다.'],
          nextScene: {
            questionText: '',
            choices: [],
            secondaryAction: null,
            shouldEndSession: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          code: 'OK',
          message: 'finished',
          data: {
            sessionId: 2,
            status: 'FINISHED',
            closingLines: ['편할 때 다시 와.'],
          },
        }),
      )

    render(
      <LighthouseEmotionController
        patientProfileId={7}
        isOpen
        onClose={vi.fn()}
        onTextChange={vi.fn()}
      />,
    )

    await flushStartOpening()

    fireEvent.click(screen.getByRole('button', { name: '오늘은 쉬고 싶어요' }))

    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(1700)
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/dialogue\/sessions\/2\/finish$/),
      expect.objectContaining({
        body: JSON.stringify({ finishReason: 'REST' }),
      }),
    )
  })

  it('shows a child-safe error message when start API fails', async () => {
    const fetchMock = vi.mocked(fetch)
    const onTextChange = vi.fn()

    fetchMock.mockResolvedValueOnce(jsonResponse({}, false))

    render(
      <LighthouseEmotionController
        patientProfileId={7}
        isOpen
        onClose={vi.fn()}
        onTextChange={onTextChange}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(onTextChange).toHaveBeenCalledWith('잠시 후 다시 말을 걸어줘.')
    expect(screen.queryByRole('button', { name: 'API error' })).toBeNull()
  })
})
