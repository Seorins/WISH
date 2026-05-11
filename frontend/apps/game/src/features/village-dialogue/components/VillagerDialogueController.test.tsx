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
    globalThis.fetch = originalFetch
  })

  it('starts a real session and POSTs the selected turn with the session id', async () => {
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

    const startCall = calls.find(c => c.url.endsWith('/dialogue/sessions'))
    expect(startCall).toBeTruthy()
    expect(startCall!.init?.method).toBe('POST')
    expect(JSON.parse(startCall!.init!.body as string)).toEqual({
      patientProfileId: PATIENT_PROFILE_ID,
      npcName: 'JOEUN',
    })

    expect(onTextChange).toHaveBeenCalledWith('안녕! 오늘 몸이 어떤지 같이 살펴볼까?')

    await act(async () => {
      vi.advanceTimersByTime(2200)
    })

    await act(async () => {
      vi.advanceTimersByTime(1400)
    })

    const okayButton = screen.getByRole('button', { name: '괜찮아요' })
    fireEvent.click(okayButton)

    await act(async () => {
      await Promise.resolve()
    })

    const turnCall = calls.find(c => c.url.endsWith(`/dialogue/sessions/${SESSION_ID}/turns`))
    expect(turnCall).toBeTruthy()
    expect(turnCall!.init?.method).toBe('POST')
    expect(JSON.parse(turnCall!.init!.body as string)).toEqual({
      questionText: '오늘 몸은 어때?',
      selectedChoice: {
        choiceIntentId: 'nurse_body_okay',
        text: '괜찮아요',
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['positive_body_state'],
      },
    })
    expect(onTextChange).toHaveBeenCalledWith('좋아. 괜찮다고 느끼는구나.')
  })
})
