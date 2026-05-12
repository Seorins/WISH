import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LighthouseEmotionController } from './LighthouseEmotionController'

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as Response
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(innerResolve => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

async function flushStart() {
  await act(async () => {
    await Promise.resolve()
  })
}

async function advanceOpeningToEntry() {
  fireEvent.click(screen.getByRole('button', { name: '대화 계속하기' }))
  await act(async () => {
    await Promise.resolve()
  })
  fireEvent.click(screen.getByRole('button', { name: '대화 계속하기' }))
  await act(async () => {
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

  it('starts a backend session but shows the fixed lighthouse opening first', async () => {
    const fetchMock = vi.mocked(fetch)
    const onTextChange = vi.fn()

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        code: 'CREATED',
        message: 'created',
        data: {
          sessionId: 1,
          status: 'IN_PROGRESS',
          scene: {
            questionText: 'Backend first scene should not show first',
            choices: [{ choiceIntentId: 'mood_okay', text: 'Okay' }],
            secondaryAction: null,
            shouldEndSession: false,
          },
        },
      }),
    )

    render(
      <LighthouseEmotionController
        patientProfileId={7}
        isOpen
        onClose={vi.fn()}
        onTextChange={onTextChange}
      />,
    )

    await flushStart()

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
      '어서 와, 기다리고 있었단다.\n우리만의 작은 등대에 온 걸 환영해.',
    )
    expect(screen.queryByRole('button', { name: 'Okay' })).toBeNull()

    await advanceOpeningToEntry()

    expect(onTextChange).toHaveBeenCalledWith('오늘은 어떻게 지내고 싶니?')
    expect(screen.getByRole('button', { name: '쉬고 싶어요' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '뭔가 해보고 싶어요' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '잠깐 얘기하고 싶어요' })).toBeTruthy()
    expect(screen.queryByText('choiceIntentId')).toBeNull()
    expect(screen.queryByText('LLM')).toBeNull()
  })

  it('shows bridge lines, then lighthouse loading copy, then the validated next scene', async () => {
    const fetchMock = vi.mocked(fetch)
    const onTextChange = vi.fn()

    const turnDeferred = createDeferred<Response>()

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          code: 'CREATED',
          message: 'created',
          data: {
            sessionId: 2,
            status: 'IN_PROGRESS',
            scene: null,
          },
        }),
      )
      .mockReturnValueOnce(turnDeferred.promise)

    render(
      <LighthouseEmotionController
        patientProfileId={7}
        isOpen
        onClose={vi.fn()}
        onTextChange={onTextChange}
      />,
    )

    await flushStart()
    await advanceOpeningToEntry()

    fireEvent.click(screen.getByRole('button', { name: '잠깐 얘기하고 싶어요' }))

    await act(async () => {
      await Promise.resolve()
    })
    expect(onTextChange).toHaveBeenCalledWith(
      '그래, 길게 말하지 않아도 괜찮단다.\n편한 얘기부터 골라보자.',
    )
    expect(screen.queryByRole('button', { name: '잠깐 얘기하고 싶어요' })).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(1400)
      await Promise.resolve()
    })
    expect(onTextChange).toHaveBeenCalledWith('등대지기가 불빛을 살피고 있어요...')

    turnDeferred.resolve(
      jsonResponse({
        npcResponse: ['그래, 그 얘기부터 해보자.'],
        nextScene: {
          questionText: '무슨 얘기가 좋을까?',
          choices: [
            { choiceIntentId: 'talk_body', text: '몸 얘기' },
            { choiceIntentId: 'talk_peer', text: '친구나 학교 얘기' },
            { choiceIntentId: 'talk_worry', text: '걱정되는 얘기' },
          ],
          secondaryAction: null,
          shouldEndSession: false,
        },
      }),
    )

    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(1700)
      await Promise.resolve()
    })

    expect(onTextChange).toHaveBeenCalledWith('무슨 얘기가 좋을까?')
    expect(screen.getByRole('button', { name: '몸 얘기' })).toBeTruthy()
  })

  it('waits on final lines instead of auto-closing', async () => {
    const fetchMock = vi.mocked(fetch)
    const onClose = vi.fn()

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          code: 'CREATED',
          message: 'created',
          data: {
            sessionId: 3,
            status: 'IN_PROGRESS',
            scene: null,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          npcResponse: ['쉬어도 괜찮단다.'],
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
            sessionId: 3,
            status: 'FINISHED',
            closingLines: ['오늘은 여기까지 해도 괜찮단다.'],
          },
        }),
      )

    render(<LighthouseEmotionController patientProfileId={7} isOpen onClose={onClose} />)

    await flushStart()
    await advanceOpeningToEntry()

    fireEvent.click(screen.getByRole('button', { name: '쉬고 싶어요' }))
    await act(async () => {
      vi.advanceTimersByTime(1400)
      await Promise.resolve()
    })
    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(1700)
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/dialogue\/sessions\/3\/finish$/),
      expect.objectContaining({
        body: JSON.stringify({ finishReason: 'COMPLETED' }),
      }),
    )
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Enter' })
    await act(async () => {
      await Promise.resolve()
    })
    expect(onClose).toHaveBeenCalled()
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

    expect(onTextChange).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'API error' })).toBeNull()
  })
})
