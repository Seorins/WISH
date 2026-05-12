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

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

async function advanceOpeningToEntry() {
  fireEvent.keyDown(window, { key: 'Enter' })
  await flushPromises()
  fireEvent.keyDown(window, { key: 'Enter' })
  await flushPromises()
}

async function advanceDialogueDelay() {
  await act(async () => {
    vi.advanceTimersByTime(1700)
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

    await flushPromises()

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

    fireEvent.keyDown(window, { key: 'Enter' })
    await flushPromises()
    expect(onTextChange).toHaveBeenCalledWith('여기서는 천천히 쉬어도 괜찮아.')

    fireEvent.keyDown(window, { key: 'Enter' })
    await flushPromises()
    expect(onTextChange).toHaveBeenCalledWith('오늘은 어떻게 지내고 싶니?')
    expect(screen.getByRole('button', { name: '쉬고 싶어요' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '뭔가 해보고 싶어요' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '잠깐 얘기하고 싶어요' })).toBeTruthy()
    expect(screen.queryByText('choiceIntentId')).toBeNull()
    expect(screen.queryByText('LLM')).toBeNull()
  })

  it('uses LLM only as a fast response rewrite and advances by static node id', async () => {
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

    await flushPromises()
    await advanceOpeningToEntry()

    fireEvent.click(screen.getByRole('button', { name: '잠깐 얘기하고 싶어요' }))
    await flushPromises()

    expect(onTextChange).toHaveBeenCalledWith(
      '그래, 길게 말하지 않아도 괜찮단다.\n편한 얘기부터 골라보자.',
    )
    expect(screen.queryByRole('button', { name: '잠깐 얘기하고 싶어요' })).toBeNull()

    turnDeferred.resolve(
      jsonResponse({
        data: {
          sessionId: 2,
          status: 'IN_PROGRESS',
          npcResponse: ['좋아. 편한 얘기부터 골라보자.'],
          nextScene: {
            questionText: 'Backend question should be ignored',
            choices: [{ choiceIntentId: 'ignored', text: 'Ignored' }],
            secondaryAction: null,
            shouldEndSession: false,
          },
        },
      }),
    )

    await flushPromises()
    expect(onTextChange).toHaveBeenCalledWith('좋아. 편한 얘기부터 골라보자.')

    await advanceDialogueDelay()

    expect(onTextChange).toHaveBeenCalledWith('무슨 얘기가 좋을까?')
    expect(screen.getByRole('button', { name: '몸 얘기' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '친구나 학교 얘기' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '걱정되는 얘기' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ignored' })).toBeNull()
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
          data: {
            sessionId: 3,
            status: 'IN_PROGRESS',
            npcResponse: ['그래, 쉬고 싶은 날도 있지.'],
            nextScene: null,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            sessionId: 3,
            status: 'IN_PROGRESS',
            npcResponse: ['그래. 조용히 있어도 괜찮아.'],
            nextScene: null,
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
            closingLines: ['오늘은 여기까지 해도 괜찮아.'],
          },
        }),
      )

    render(<LighthouseEmotionController patientProfileId={7} isOpen onClose={onClose} />)

    await flushPromises()
    await advanceOpeningToEntry()

    fireEvent.click(screen.getByRole('button', { name: '쉬고 싶어요' }))
    await flushPromises()
    await advanceDialogueDelay()
    expect(screen.getByRole('button', { name: '조용히 있을래요' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '조용히 있을래요' }))
    await flushPromises()
    await advanceDialogueDelay()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/dialogue\/sessions\/3\/finish$/),
      expect.objectContaining({
        body: JSON.stringify({ finishReason: 'COMPLETED' }),
      }),
    )
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Enter' })
    await flushPromises()
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

    await flushPromises()

    expect(onTextChange).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'API error' })).toBeNull()
  })
})
