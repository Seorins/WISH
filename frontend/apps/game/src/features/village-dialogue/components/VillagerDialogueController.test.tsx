import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VillagerDialogueController } from './VillagerDialogueController'

describe('VillagerDialogueController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('separates greeting, context, question, and waits on ending lines', async () => {
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

    expect(onTextChange).toHaveBeenCalledWith('안녕, 와줬구나.')
    expect(screen.queryByRole('button', { name: '괜찮아요' })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(onTextChange).toHaveBeenCalledWith('잠깐 쉬어가도 돼.')
    expect(screen.queryByRole('button', { name: '괜찮아요' })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(onTextChange).toHaveBeenCalledWith('지금 몸은 어때?')
    expect(screen.getByRole('button', { name: '괜찮아요' })).toBeTruthy()
    expect(screen.queryByText('body_okay_now')).toBeNull()
    expect(screen.queryByText('positive_body_state')).toBeNull()
    expect(screen.queryByText('0')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '괜찮아요' }))

    await act(async () => {
      await Promise.resolve()
    })

    const events = JSON.parse(localStorage.getItem('villager_dialogue_events') ?? '[]') as Array<{
      displayName: string
      npcName: string
      topicId: string
      sceneId: string
      nodeId: string
      choiceIntentId: string
      choiceText: string
      protectiveFactors: string[]
    }>
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      displayName: '간호사 조은',
      npcName: 'JOEUN',
      topicId: 'body_discomfort_support',
      sceneId: 'body_01',
      nodeId: 'body_01',
      choiceIntentId: 'body_okay_now',
      choiceText: '괜찮아요',
      protectiveFactors: ['positive_body_state'],
    })
    expect(onTextChange).toHaveBeenCalledWith('좋아. 지금은 괜찮구나.')

    act(() => {
      vi.advanceTimersByTime(1800)
    })

    expect(onTextChange).toHaveBeenCalledWith(
      '좋아. 지금은 괜찮구나.\n그래도 불편해지면 바로 말해도 돼.',
    )

    act(() => {
      vi.advanceTimersByTime(1800)
    })

    expect(onTextChange).toHaveBeenCalledWith('천천히 둘러보고 와.\n필요하면 다시 들러.')
    expect(screen.queryByRole('button', { name: '괜찮아요' })).toBeNull()
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

  it('does not close from greeting with E and can advance with Escape', () => {
    const onClose = vi.fn()
    const onTextChange = vi.fn()

    render(
      <VillagerDialogueController
        npcId="monkey_friend"
        isOpen
        onClose={onClose}
        onTextChange={onTextChange}
      />,
    )

    fireEvent.keyDown(window, { key: 'e' })
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).not.toHaveBeenCalled()
    expect(onTextChange).toHaveBeenLastCalledWith('잠깐 쉬어가도 돼.')
  })
})
