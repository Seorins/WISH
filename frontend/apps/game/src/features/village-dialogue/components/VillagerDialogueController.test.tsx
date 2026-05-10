import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VillagerDialogueController } from './VillagerDialogueController'

describe('VillagerDialogueController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('shows only child-facing text and saves the selected raw event locally', async () => {
    const onClose = vi.fn()
    const onTextChange = vi.fn()

    render(
      <VillagerDialogueController
        npcId="nurse_bunny"
        isOpen
        onClose={onClose}
        onTextChange={onTextChange}
      />,
    )

    expect(onTextChange).toHaveBeenCalledWith('안녕! 오늘 몸이 어떤지 같이 살펴볼까?')

    act(() => {
      vi.advanceTimersByTime(2200)
    })

    expect(onTextChange).toHaveBeenCalledWith('오늘 몸은 어때?')
    expect(screen.queryByRole('button', { name: '괜찮아요' })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1400)
    })

    expect(screen.getByRole('button', { name: '괜찮아요' })).toBeTruthy()
    expect(screen.queryByText('nurse_body_okay')).toBeNull()
    expect(screen.queryByText('positive_body_state')).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
    expect(screen.queryByText('오늘은 쉬고 싶어요')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '괜찮아요' }))

    await act(async () => {
      await Promise.resolve()
    })

    const events = JSON.parse(localStorage.getItem('villager_dialogue_events') ?? '[]') as Array<{
      choiceIntentId: string
      choiceText: string
      intensity: number
      protectiveFactors: string[]
    }>
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      choiceIntentId: 'nurse_body_okay',
      choiceText: '괜찮아요',
      intensity: 0,
      protectiveFactors: ['positive_body_state'],
    })
    expect(onTextChange).toHaveBeenCalledWith('좋아. 괜찮다고 느끼는구나.')

    act(() => {
      vi.advanceTimersByTime(1800)
    })

    expect(onTextChange).toHaveBeenCalledWith('불편하면 어떻게 할까?')
    expect(screen.queryByRole('button', { name: '조은에게 말해요' })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1400)
    })

    expect(screen.getByRole('button', { name: '조은에게 말해요' })).toBeTruthy()
  })
})
