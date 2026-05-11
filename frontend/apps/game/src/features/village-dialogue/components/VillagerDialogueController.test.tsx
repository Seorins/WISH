import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VillagerDialogueController } from './VillagerDialogueController'

const PATIENT_PROFILE_ID = 7
const SESSION_ID = 9123

type FetchCall = { url: string; init?: RequestInit }

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

  it('starts a backend session, separates opening steps, and sends enum npcName in turn payload', async () => {
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

    expect(onTextChange).toHaveBeenCalledWith('안녕, 와줬구나.')

    await act(async () => {
      await Promise.resolve()
    })

    const startCall = calls.find(c => c.url.endsWith('/dialogue/sessions'))
    expect(startCall).toBeTruthy()
    expect(startCall!.init?.method).toBe('POST')
    expect(JSON.parse(startCall!.init!.body as string)).toEqual({
      patientProfileId: PATIENT_PROFILE_ID,
      npcName: 'JOEUN',
    })

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onTextChange).toHaveBeenCalledWith('잠깐 쉬어가도 돼.')

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onTextChange).toHaveBeenCalledWith('지금 몸은 어때?')
    expect(screen.getByRole('button', { name: '괜찮아요' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '괜찮아요' }))

    await act(async () => {
      await Promise.resolve()
    })

    const turnCall = calls.find(c => c.url.endsWith(`/dialogue/sessions/${SESSION_ID}/turns`))
    expect(turnCall).toBeTruthy()
    expect(turnCall!.init?.method).toBe('POST')
    expect(JSON.parse(turnCall!.init!.body as string)).toMatchObject({
      npcId: 'nurse_bunny',
      npcName: 'JOEUN',
      topicId: 'body_discomfort_support',
      sceneId: 'body_01',
      nodeId: 'body_01',
      questionText: '지금 몸은 어때?',
      selectedChoice: {
        choiceIntentId: 'body_okay_now',
        text: '괜찮아요',
      },
      intensity: 0,
      concernFlags: [],
      protectiveFactors: ['positive_body_state'],
      generatedBy: 'STATIC',
    })
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

    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    fireEvent.click(screen.getByRole('button', { name: '괜찮아요' }))
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      vi.advanceTimersByTime(3600)
    })

    expect(onTextChange).toHaveBeenCalledWith('천천히 둘러보고 와.\n필요하면 다시 들러.')
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
})
