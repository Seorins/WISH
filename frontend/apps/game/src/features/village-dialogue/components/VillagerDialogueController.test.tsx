import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VillagerDialogueController } from './VillagerDialogueController'

const PATIENT_PROFILE_ID = 7
const SESSION_ID = 9123

type FetchCall = { url: string; init?: RequestInit }

function clickAdvanceHitarea() {
  const hitarea = document.querySelector('.dialogue-advance-hitarea')
  if (!(hitarea instanceof HTMLElement)) {
    throw new Error('Dialogue advance hitarea was not rendered')
  }
  fireEvent.click(hitarea)
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

function finishResponseDelay() {
  act(() => {
    vi.advanceTimersByTime(1700)
  })
}

describe('VillagerDialogueController', () => {
  let originalFetch: typeof fetch
  let calls: FetchCall[]

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    localStorage.clear()
    calls = []
    originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      calls.push({ url, init })
      if (url.endsWith('/dialogue/sessions')) {
        return new Response(
          JSON.stringify({
            code: 'SUCCESS',
            message: 'OK',
            data: { sessionId: SESSION_ID, status: 'IN_PROGRESS' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ code: 'SUCCESS', message: 'OK', data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  it('starts a backend session, keeps greeting separate, and sends enum npcName in turn payload', async () => {
    const onClose = vi.fn()
    const onTextChange = vi.fn()

    render(
      <VillagerDialogueController
        npcId="nurse_bunny"
        patientProfileId={PATIENT_PROFILE_ID}
        isOpen
        onClose={onClose}
        onTextChange={onTextChange}
      />,
    )

    expect(onTextChange).toHaveBeenCalledWith('안녕, 왔네.\n잠깐 쉬어가도 돼.')
    expect(screen.queryByRole('button', { name: '쉬고 싶어요' })).toBeNull()

    await flushPromises()

    const startCall = calls.find(c => c.url.endsWith('/dialogue/sessions'))
    expect(startCall).toBeTruthy()
    expect(startCall!.init?.method).toBe('POST')
    expect(JSON.parse(startCall!.init!.body as string)).toEqual({
      patientProfileId: PATIENT_PROFILE_ID,
      npcName: 'JOEUN',
    })

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onTextChange).not.toHaveBeenCalledWith(
      '안녕, 왔네.\n잠깐 쉬어가도 돼.\n오늘은 뭐가 좋을까?',
    )
    expect(screen.queryByRole('button', { name: '쉬고 싶어요' })).toBeNull()

    fireEvent.keyDown(window, { key: 'e' })

    expect(onTextChange).toHaveBeenCalledWith('오늘은 뭐가 좋을까?')
    expect(screen.getByRole('button', { name: '쉬고 싶어요' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '뭔가 해보고 싶어요' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '얘기하고 싶어요' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '뭔가 해보고 싶어요' }))

    await flushPromises()

    const turnCall = calls.find(c => c.url.endsWith(`/dialogue/sessions/${SESSION_ID}/turns`))
    expect(turnCall).toBeTruthy()
    expect(turnCall!.init?.method).toBe('POST')
    expect(JSON.parse(turnCall!.init!.body as string)).toMatchObject({
      npcId: 'nurse_bunny',
      npcName: 'JOEUN',
      topicId: 'villager_entry_body',
      sceneId: 'entry_01',
      nodeId: 'entry_01',
      questionText: '오늘은 뭐가 좋을까?',
      selectedChoice: {
        choiceIntentId: 'entry_activity',
        text: '뭔가 해보고 싶어요',
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['agency_coping', 'positive_activity_interest'],
      },
      generatedBy: 'STATIC',
    })
  })

  it('does not advance to choices until the backend session id is ready', async () => {
    const onClose = vi.fn()
    const onTextChange = vi.fn()
    let resolveStart!: (response: Response) => void
    const startResponse = new Promise<Response>(resolve => {
      resolveStart = resolve
    })

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      calls.push({ url, init })
      if (url.endsWith('/dialogue/sessions')) {
        return startResponse
      }
      return new Response(JSON.stringify({ code: 'SUCCESS', message: 'OK', data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    render(
      <VillagerDialogueController
        npcId="nurse_bunny"
        patientProfileId={PATIENT_PROFILE_ID}
        isOpen
        onClose={onClose}
        onTextChange={onTextChange}
      />,
    )

    fireEvent.keyDown(window, { key: 'e' })
    expect(screen.queryByRole('button', { name: '쉬고 싶어요' })).toBeNull()

    await act(async () => {
      resolveStart(
        new Response(
          JSON.stringify({
            code: 'SUCCESS',
            message: 'OK',
            data: { sessionId: SESSION_ID, status: 'IN_PROGRESS' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      await startResponse
    })

    fireEvent.keyDown(window, { key: 'e' })
    expect(screen.getByRole('button', { name: '쉬고 싶어요' })).toBeTruthy()
  })

  it('waits on ending lines and does not close with E', async () => {
    const onClose = vi.fn()
    const onTextChange = vi.fn()

    render(
      <VillagerDialogueController
        npcId="nurse_bunny"
        patientProfileId={PATIENT_PROFILE_ID}
        isOpen
        onClose={onClose}
        onTextChange={onTextChange}
      />,
    )

    await flushPromises()
    clickAdvanceHitarea()
    fireEvent.click(screen.getByRole('button', { name: '뭔가 해보고 싶어요' }))
    await flushPromises()
    finishResponseDelay()

    expect(onTextChange).toHaveBeenCalledWith('가볍게 뭘 해볼까?')

    fireEvent.click(screen.getByRole('button', { name: '음악을 들어볼래요' }))
    await flushPromises()
    finishResponseDelay()

    expect(onTextChange).toHaveBeenCalledWith('그럼 음악 활동부터 가볍게 해보자.')
    expect(screen.queryByRole('button', { name: '마을로 돌아가기' })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'e' })
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onClose).toHaveBeenCalled()
  })

  it('uses completed activity state in final villager ending lines', async () => {
    const onClose = vi.fn()
    const onTextChange = vi.fn()

    render(
      <VillagerDialogueController
        npcId="nurse_bunny"
        patientProfileId={PATIENT_PROFILE_ID}
        isOpen
        onClose={onClose}
        onTextChange={onTextChange}
        dailyActivityState={{
          completedActivityCount: 1,
          hasDoneAnyActivityToday: true,
          recommendedActivityLabel: '음악',
        }}
      />,
    )

    await flushPromises()
    clickAdvanceHitarea()
    fireEvent.click(screen.getByRole('button', { name: '얘기하고 싶어요' }))
    await flushPromises()
    finishResponseDelay()

    fireEvent.click(screen.getByRole('button', { name: '몸 얘기' }))
    await flushPromises()
    finishResponseDelay()

    fireEvent.click(screen.getByRole('button', { name: '괜찮아요' }))
    await flushPromises()
    finishResponseDelay()

    expect(onTextChange).toHaveBeenCalledWith('오늘은 해본 게 있으니까, 잠깐 쉬어도 괜찮아.')
  })
})
